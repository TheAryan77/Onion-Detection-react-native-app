"""Try the hosted model on your own onion photos before writing any app code.

Usage (from backend/, the key is read from .env):
  .venv/bin/python scripts/test_roboflow.py photos          # every image in the folder
  .venv/bin/python scripts/test_roboflow.py photos/a.png b.jpg
Writes <photo>.pred.jpg next to each input with boxes drawn.
"""
import base64
import json
import os
import sys
from pathlib import Path

import cv2
import httpx

MODEL = os.getenv("ROBOFLOW_MODEL_ID", "onions-ciqkj/3")
URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")

def _key_from_env_file() -> str:
    env = Path(__file__).resolve().parents[1] / ".env"
    for line in env.read_text().splitlines() if env.exists() else []:
        if line.startswith("ROBOFLOW_API_KEY="):
            return line.split("=", 1)[1].strip()
    return ""


KEY = os.getenv("ROBOFLOW_API_KEY") or _key_from_env_file()
if not KEY:
    sys.exit("Set ROBOFLOW_API_KEY in backend/.env")

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
paths = []
for arg in sys.argv[1:] or ["photos"]:
    p = Path(arg)
    paths += sorted(f for f in p.iterdir() if f.suffix.lower() in IMAGE_EXTS) if p.is_dir() else [p]
paths = [str(p) for p in paths if not p.name.endswith(".pred.jpg")]  # skip this script's own output

for path in paths:
    img = cv2.imread(path)
    if img is None:
        print("skip (unreadable):", path)
        continue
    scale = 1280 / max(img.shape[:2])
    if scale < 1:
        img = cv2.resize(img, None, fx=scale, fy=scale)
    _, buf = cv2.imencode(".jpg", img)
    r = httpx.post(
        f"{URL}/{MODEL}",
        params={"api_key": KEY, "confidence": 25},
        content=base64.b64encode(buf.tobytes()),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=60,
    )
    r.raise_for_status()
    preds = r.json().get("predictions", [])
    print(path, json.dumps([{"class": p["class"], "conf": round(p["confidence"], 2)} for p in preds]))
    for p in preds:
        x1, y1 = int(p["x"] - p["width"] / 2), int(p["y"] - p["height"] / 2)
        x2, y2 = int(p["x"] + p["width"] / 2), int(p["y"] + p["height"] / 2)
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 2)
        cv2.putText(img, f"{p['class']} {p['confidence']:.2f}", (x1, max(15, y1 - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    cv2.imwrite(path + ".pred.jpg", img)
