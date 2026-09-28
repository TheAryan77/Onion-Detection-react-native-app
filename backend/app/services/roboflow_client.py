import base64
import random

import httpx

from ..config import settings


async def detect_defects(jpeg_bytes: bytes) -> list[dict]:
    """Call the hosted Roboflow model.

    Returns predictions in pixel coordinates of the image we sent:
    [{"x": cx, "y": cy, "width": w, "height": h, "confidence": 0..1, "class": "rotten"}, ...]
    """
    if not settings.roboflow_api_key:
        raise RuntimeError("ROBOFLOW_API_KEY is not set on the server")

    url = f"{settings.roboflow_api_url.rstrip('/')}/{settings.roboflow_model_id}"
    params = {
        "api_key": settings.roboflow_api_key,
        "confidence": settings.roboflow_confidence,
        "overlap": settings.roboflow_overlap,
    }
    payload = base64.b64encode(jpeg_bytes).decode("ascii")
    async with httpx.AsyncClient(timeout=45) as client:
        response = await client.post(
            url,
            params=params,
            content=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    response.raise_for_status()
    return response.json().get("predictions", [])


def mock_predictions(blobs: list[dict], seed: int = 42) -> list[dict]:
    """Fake defects on ~30% of the segmented onions so the app can be built without Roboflow."""
    rng = random.Random(seed + len(blobs))
    preds = []
    for blob in blobs:
        if rng.random() > 0.3:
            continue
        x, y, w, h = blob["box_px"]
        preds.append({
            "x": x + w / 2,
            "y": y + h / 2,
            "width": w * 0.5,
            "height": h * 0.5,
            "confidence": round(rng.uniform(0.55, 0.95), 2),
            "class": rng.choice(["cuts", "rotten", "sprout"]),
        })
    return preds
