import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .pipeline import analyze_image
from .schemas import AnalysisResult, ChatReply, ChatRequest
from .services.assistant import ask
from .services.grading import load_rules

MAX_UPLOAD_BYTES = 15 * 1024 * 1024

app = FastAPI(title="Onion Grader API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_id": settings.roboflow_model_id,
        "mock_mode": settings.mock_mode,
        "rules_version": load_rules()["version"],
        "assistant": bool(settings.gemini_api_key),
    }


@app.get("/rules")
def rules():
    return load_rules()


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(...),
    mode: str = Form("batch"),
    marker_mm: float = Form(50.0),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "Empty file")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image too large (max 15 MB)")
    if not 10 <= marker_mm <= 300:
        raise HTTPException(400, "marker_mm must be between 10 and 300")
    try:
        return await analyze_image(raw, mode, marker_mm)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"Roboflow returned {e.response.status_code}: {e.response.text[:200]}")
    except httpx.HTTPError as e:
        raise HTTPException(504, f"Could not reach Roboflow: {e}")
    except RuntimeError as e:
        raise HTTPException(500, str(e))


@app.post("/chat", response_model=ChatReply)
async def chat(req: ChatRequest):
    try:
        reply = await ask([m.model_dump() for m in req.messages], req.report)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"The AI service returned {e.response.status_code}: {e.response.text[:200]}")
    except httpx.HTTPError as e:
        raise HTTPException(504, f"Could not reach the AI service: {e}")
    return {"reply": reply}
