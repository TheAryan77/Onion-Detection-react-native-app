import hashlib
import json
from pathlib import Path

RULES_PATH = Path(__file__).resolve().parents[1] / "grading_rules.json"
SEVERITY = {"GRADE_A": 0, "URS": 1, "REJECT": 2}


def load_rules(path: Path = RULES_PATH) -> dict:
    raw = path.read_bytes()
    rules = json.loads(raw)
    rules["version"] = hashlib.sha256(raw).hexdigest()[:12]
    return rules


def _worse(a: str, b: str) -> str:
    return a if SEVERITY[a] >= SEVERITY[b] else b


def grade_onion(defects: list[dict], diameter_mm: float | None, rules: dict):
    """Returns (category, size_flag, reasons). Defects must already be confidence-filtered."""
    mapping = rules["category_by_defect"]
    category, reasons = "GRADE_A", []

    for t in sorted({d["type"] for d in defects}):
        conf = max(d["confidence"] for d in defects if d["type"] == t)
        category = _worse(category, mapping.get(t, "URS"))
        reasons.append(f"{t} detected ({conf:.0%})")

    size_flag = None
    size = rules.get("size_mm", {})
    if diameter_mm is not None:
        if size.get("min") is not None and diameter_mm < size["min"]:
            size_flag = "undersized"
        elif size.get("max") is not None and diameter_mm > size["max"]:
            size_flag = "oversized"
    if size_flag:
        category = _worse(category, mapping.get(size_flag, "URS"))
        reasons.append(f"{size_flag}: {diameter_mm:.0f} mm (spec {size.get('min')}–{size.get('max')} mm)")

    return category, size_flag, reasons


def summarize(onions: list[dict], rules: dict) -> dict:
    total = len(onions)
    n = {c: sum(1 for o in onions if o["category"] == c) for c in SEVERITY}

    def pct(k: int) -> float:
        return round(100.0 * k / total, 1) if total else 0.0

    defect_counts = {"cuts": 0, "rotten": 0, "sprout": 0, "undersized": 0, "oversized": 0}
    for o in onions:
        for t in {d["type"] for d in o["defects"]}:
            defect_counts[t] = defect_counts.get(t, 0) + 1
        if o.get("size_flag"):
            defect_counts[o["size_flag"]] += 1

    lot = rules.get("lot", {})
    if total == 0:
        verdict = "NO_ONIONS"
    elif pct(n["REJECT"]) > lot.get("reject_above_pct", 100):
        verdict = "REJECT"
    elif pct(n["GRADE_A"]) >= lot.get("grade_a_min_pct", 90):
        verdict = "GRADE_A"
    else:
        verdict = "URS"

    return {
        "total": total,
        "grade_a": n["GRADE_A"], "urs": n["URS"], "reject": n["REJECT"],
        "grade_a_pct": pct(n["GRADE_A"]), "urs_pct": pct(n["URS"]), "reject_pct": pct(n["REJECT"]),
        "defect_counts": defect_counts,
        "lot_verdict": verdict,
    }
