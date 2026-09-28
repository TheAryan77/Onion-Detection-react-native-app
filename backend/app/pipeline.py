import asyncio
import hashlib
import io
import json
import uuid
from datetime import datetime, timezone

import cv2
import numpy as np
from PIL import Image, ImageOps
from starlette.concurrency import run_in_threadpool

from .config import settings
from .services.annotate import annotate
from .services.calibration import find_marker
from .services.grading import grade_onion, load_rules, summarize
from .services.matcher import assign_defects
from .services.roboflow_client import detect_defects, mock_predictions
from .services.segmentation import segment_onions, whole_image_blob


def load_image(raw: bytes, max_side: int) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception as exc:
        raise ValueError("Could not read the uploaded image") from exc
    img.thumbnail((max_side, max_side))
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def _cv_stage(bgr: np.ndarray, mode: str, marker_mm: float):
    marker = find_marker(bgr, marker_mm)
    blobs = segment_onions(bgr, exclude_polygon=marker["polygon"] if marker else None)
    if mode == "single":
        h, w = bgr.shape[:2]
        blobs = [max(blobs, key=lambda b: b["area"])] if blobs else [whole_image_blob(w, h)]
    return marker, blobs


def _norm(box_px: list[float], w: int, h: int) -> list[float]:
    x1, y1, x2, y2 = box_px
    return [round(max(0, x1) / w, 4), round(max(0, y1) / h, 4), round(min(w, x2) / w, 4), round(min(h, y2) / h, 4)]


async def analyze_image(raw: bytes, mode: str, marker_mm: float) -> dict:
    if mode not in ("batch", "single"):
        raise ValueError("mode must be 'batch' or 'single'")

    rules = load_rules()
    bgr = load_image(raw, settings.max_image_side)
    h, w = bgr.shape[:2]
    ok, jpg = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise ValueError("Could not encode image")

    cv_task = run_in_threadpool(_cv_stage, bgr, mode, marker_mm)
    if settings.mock_mode:
        marker, blobs = await cv_task
        preds = mock_predictions(blobs)
    else:
        (marker, blobs), preds = await asyncio.gather(cv_task, detect_defects(jpg.tobytes()))

    # Per-class confidence filter BEFORE matching, so weak detections never create onions
    thresholds = rules["min_confidence"]
    preds = [p for p in preds if p.get("confidence", 0) >= thresholds.get(p.get("class"), 0.5)]

    warnings: list[str] = []
    if marker is None:
        warnings.append("Reference marker not found: sizes were not measured and the undersized check was skipped.")
    if mode == "batch" and not blobs:
        warnings.append("No onions were separated from the background. Use a plain blue sheet that fills the frame and even light.")

    onions = assign_defects(blobs, preds, force_single=(mode == "single"))

    out_onions = []
    for i, o in enumerate(onions, start=1):
        diameter = None
        if marker and not o.get("synthetic"):
            diameter = round(o["short_side_px"] / marker["px_per_mm"], 1)
        category, size_flag, reasons = grade_onion(o["defects"], diameter, rules)
        o.update(id=i, diameter_mm=diameter, category=category, size_flag=size_flag)
        x, y, bw, bh = o["box_px"]
        out_onions.append({
            "id": i,
            "box": _norm([x, y, x + bw, y + bh], w, h),
            "diameter_mm": diameter,
            "defects": [
                {"type": d["type"], "confidence": round(d["confidence"], 3), "box": _norm(d["box_px"], w, h)}
                for d in o["defects"]
            ],
            "size_flag": size_flag,
            "category": category,
            "reasons": reasons,
        })

    result = {
        "report_id": uuid.uuid4().hex[:12],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "image_width": w,
        "image_height": h,
        "calibrated": marker is not None,
        "px_per_mm": round(marker["px_per_mm"], 3) if marker else None,
        "onions": out_onions,
        "summary": summarize(out_onions, rules),
        "warnings": warnings,
        "model_id": "mock" if settings.mock_mode else settings.roboflow_model_id,
        "rules_version": rules["version"],
        "spec_name": rules.get("spec_name", ""),
    }
    # Tamper-evidence: anyone can recompute this hash from the JSON (minus image and hash)
    result["report_hash"] = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    result["annotated_image_b64"] = annotate(bgr, onions, marker)
    return result
