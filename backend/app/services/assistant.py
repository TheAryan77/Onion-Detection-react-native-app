import asyncio
import json

import httpx

from ..config import settings
from .grading import load_rules

MAX_TURNS = 12
MAX_CHARS = 2000
RETRYABLE = {404, 429, 500, 502, 503, 504}  # busy, overloaded or a model briefly unavailable: try the next one

_ABOUT = """You are the assistant inside "Onion Grader", a mobile app used at Indian onion procurement centres
(Department of Consumer Affairs, Smart India Hackathon problem 26031). Staff photograph onions and the app grades them.

How grading works:
- An object-detection model (Roboflow onions-ciqkj/3) finds defects: cuts (damaged), rotten, sprout.
- OpenCV separates each onion from a plain blue sheet and measures its diameter using a printed 50 mm ArUco marker.
- A rules file (below) turns defects and size into a grade per onion: GRADE_A, URS or REJECT.
  URS usually means "Under Relaxed Specifications": below standard grade but still accepted with relaxed norms or a value cut.
- Lot verdict: REJECT if the reject share exceeds lot.reject_above_pct, GRADE_A if the Grade A share is at least
  lot.grade_a_min_pct, otherwise URS.
- Every report carries the rules version and a SHA-256 hash so it can be checked for tampering.

Photo protocol (most accuracy problems come from here):
- Plain matte blue sheet filling the whole frame; onions about 2 cm apart, not touching.
- Marker printed at 100% scale, lying flat and fully visible; its measured size entered in Settings.
- Phone flat and parallel to the sheet, 40-60 cm above; even diffuse light without hard shadows.
- 10-30 onions per batch photo; single mode for one disputed onion.

Honest limitations: the model only knows cuts, rotten and sprout (not mould spots or bruises), it sees one side of
each onion, it can misfire on textured backgrounds, and size needs the marker. The app supports the human grader,
who can verify every decision on the evidence image; it is not the final authority."""

_STYLE = """Rules for your answers:
- Reply in the language the user writes in: English, Hindi or Marathi (Hinglish is fine).
- Be short and practical: 2-6 sentences, or a few lines starting with "- ". Plain text only: no **, #, or tables.
- Never invent or change a grade, count, percentage or measurement. Explain the ones in the report, citing onion
  numbers (#id) and the rule that applied. If no report is open, say so and explain in general terms.
- If something looks wrong (for example a warning about the marker), say what to fix in the next photo.
- For questions unrelated to onion grading or using this app, say briefly that you can only help with that."""


def _report_block(report: dict | None) -> str:
    if not report:
        return "Current report: none is open (the user is on another screen)."
    return "Current report (JSON):\n" + json.dumps(report, ensure_ascii=False, separators=(",", ":"))


def build_system_prompt(report: dict | None) -> str:
    rules = {k: v for k, v in load_rules().items() if k != "notes"}
    return "\n\n".join([
        _ABOUT,
        "Grading rules in force (JSON):\n" + json.dumps(rules, ensure_ascii=False),
        _report_block(report),
        _STYLE,
    ])


def _contents(messages: list[dict]) -> list[dict]:
    recent = messages[-MAX_TURNS:]
    while recent and recent[0]["role"] != "user":  # Gemini expects the conversation to start with the user
        recent = recent[1:]
    return [
        {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["text"][:MAX_CHARS]}]}
        for m in recent
    ]


async def ask(messages: list[dict], report: dict | None) -> str:
    if not settings.gemini_api_key:
        raise RuntimeError("The assistant is not set up yet: add GEMINI_API_KEY to backend/.env and restart the server.")
    contents = _contents(messages)
    if not contents:
        raise ValueError("Send at least one user message")

    body = {
        "system_instruction": {"parts": [{"text": build_system_prompt(report)}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2048},
    }
    fallbacks = [m.strip() for m in settings.gemini_fallback_models.split(",") if m.strip()]
    # Main model twice (a 503 is often gone a second later), then each fallback once
    attempts = [settings.gemini_model, settings.gemini_model] + [m for m in fallbacks if m != settings.gemini_model]
    async with httpx.AsyncClient(timeout=45) as client:
        for i, model in enumerate(attempts):
            url = f"{settings.gemini_api_url.rstrip('/')}/models/{model}:generateContent"
            response = await client.post(url, json=body, headers={"x-goog-api-key": settings.gemini_api_key})
            if response.status_code not in RETRYABLE or i == len(attempts) - 1:
                break
            await asyncio.sleep(0.8)
    response.raise_for_status()

    candidates = response.json().get("candidates") or []
    parts = (candidates[0].get("content") or {}).get("parts", []) if candidates else []
    text = "".join(p.get("text", "") for p in parts).strip()
    return text or "Sorry, I couldn't answer that. Please rephrase the question."
