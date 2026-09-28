# Onion Grader: SIH Problem Statement 26031, Complete Build Spec

> **For the coding agent (Claude Code / Cursor / etc.):** This file is the single source of truth.
> Build it in the milestone order in section 12. Every file listed in section 7 has full starter code in
> sections 8 and 9. Keep the constraints in section 11. When something here conflicts with the installed
> library version (Expo SDK APIs change between releases), adapt to the installed version and leave a short comment.

---

## 1. Problem statement (DoCA, Ministry of Consumer Affairs, Food & Public Distribution)

Quality assessment and grading of onions is subjective and varies across procurement centres, which causes disputes.
Build an AI-based mobile application that:

| # | Requirement | How this solution meets it |
|---|---|---|
| 1 | Uses image processing to assess onion quality | OpenCV segmentation + Roboflow object-detection model on every photo |
| 2 | Identifies damaged, rotten, sprouted, undersized onions | Model classes `cuts` (damaged), `rotten`, `sprout`; undersized from real diameter in mm using a printed reference marker |
| 3 | Estimates Grade A and URS percentages | Per-onion rules engine → counts → percentages → lot verdict |
| 4 | Generates a digital quality report instantly | In-app report screen + shareable PDF (expo-print) |
| 5 | Reduces human bias, improves transparency | Same rules file for every centre, annotated evidence image, per-onion reasons, rules version + SHA-256 report hash on every report |

### A note on "URS"
In Indian government procurement (e.g., FCI), **URS usually means "Under Relaxed Specifications"**: stock that misses the
standard grade but is still accepted with relaxed norms or a value cut. It is not automatically "reject".
Confirm with the SIH mentors how DoCA defines URS for onions. The rules file (`grading_rules.json`) supports three buckets
(`GRADE_A`, `URS`, `REJECT`) so either interpretation is a config change, not a code change.

---

## 2. Key decisions (the quickest path that still works)

1. **Do not train a model first.** Use the already-deployed Roboflow model **`onions-ciqkj/3`** (Onion Grading dataset,
   classes: `cuts`, `rotten`, `sprout`) through Roboflow's hosted inference API.
2. **The model only finds defects; it does not count onions.** So the backend counts onions itself with OpenCV
   (onions photographed on a plain blue sheet → colour-difference segmentation → one contour per onion),
   then assigns each defect box to the onion it sits on.
3. **Size needs a physical reference.** A printed **ArUco marker** (50 mm black square) lies next to the onions.
   OpenCV detects it reliably and gives pixels-per-mm. This is far more robust than detecting a coin
   (coins look like small round onions to a segmenter).
4. **The AI detects; the rules engine grades.** Grade thresholds live in one JSON file tied to a cited spec.
   This is what you tell the judges: the neural network doesn't decide "Grade A", the published specification does.
5. **Expo (managed) + Expo Go.** Every library used runs inside Expo Go, so nobody needs Android Studio.
   You develop on the Mac; your friend installs **Expo Go** from the Play Store and scans a QR code.
   When you want a real APK, **EAS Build** compiles it in the cloud from the Mac.
6. **The Roboflow API key never goes into the app.** The phone talks only to our FastAPI backend, which holds the key.
7. **The backend draws the annotated image.** The app just displays a JPEG, so there's no SVG overlay code to debug.

---

## 3. System architecture

```
┌──────────────────────────── ANDROID PHONE (Expo Go / APK) ────────────────────────────┐
│                                                                                       │
│  Home ──► Scan (camera) ──► Analyze (upload + progress) ──► Report ──► Share PDF      │
│    │         │                                                  ▲                     │
│    │         └── or pick from gallery                           │                     │
│    └── Settings (server URL, marker size, centre name)    AsyncStorage (last 10)      │
│                                                                                       │
└───────────────────────────────┬───────────────────────────────────────────────────────┘
                                │  POST /analyze  (multipart: photo, mode, marker_mm)
                                ▼
┌──────────────────────────── FASTAPI BACKEND (Python) ─────────────────────────────────┐
│                                                                                       │
│  1. Load image, fix EXIF rotation, resize to 1280 px                                  │
│                                                                                       │
│  2. In parallel:                                                                      │
│     ┌───────────────────────────┐        ┌─────────────────────────────────────┐      │
│     │ OpenCV (thread pool)      │        │ Roboflow hosted model               │      │
│     │ • find ArUco marker       │        │ onions-ciqkj/3                      │      │
│     │   → px per mm             │        │ → boxes: cuts / rotten / sprout     │      │
│     │ • segment onions on sheet │        │   + confidence                      │      │
│     │   → one contour per onion │        │ (API key stays on server)           │      │
│     └─────────────┬─────────────┘        └──────────────────┬──────────────────┘      │
│                   └──────────────────┬───────────────────────┘                        │
│                                      ▼                                                │
│  3. Matcher: attach each defect box to the onion contour it falls on                  │
│  4. Size: diameter_mm = short side of min-area rectangle ÷ px_per_mm                  │
│  5. Rules engine (grading_rules.json): per onion → GRADE_A / URS / REJECT + reasons   │
│  6. Summary: counts, Grade A %, URS %, lot verdict                                    │
│  7. Annotate image (coloured outlines + labels), SHA-256 hash of the result           │
│                                                                                       │
└───────────────────────────────┬───────────────────────────────────────────────────────┘
                                ▼
                     JSON result + annotated JPEG (base64)
```

### Sequence for one scan

```
User          App                     Backend                    Roboflow
 │  tap Scan   │                         │                           │
 │────────────►│ takePictureAsync        │                           │
 │             │ resize to 1280 w        │                           │
 │             │── POST /analyze ───────►│                           │
 │             │                         │── base64 JPEG ───────────►│
 │             │                         │   (OpenCV runs meanwhile) │
 │             │                         │◄── predictions ───────────│
 │             │                         │ match → grade → annotate  │
 │             │◄── AnalysisResult ──────│                           │
 │             │ save to AsyncStorage    │                           │
 │◄── Report ──│                         │                           │
 │  Share PDF  │ expo-print → share      │                           │
```

---

## 4. Photography protocol (this decides accuracy more than the code does)

The segmentation assumes a controlled capture. Put this on a laminated card at the demo table.

1. **Background:** one plain, matte **blue** sheet (chart paper or cloth) that fills the whole frame.
   Blue contrasts with red, white and yellow onions and with green sprouts.
2. **Spacing:** onions **not touching**, roughly 2 cm apart. (Touching onions get a best-effort watershed split.)
3. **Marker:** print `marker_50mm.png` (section 8.14), cut the paper to about 7 cm square, lay it flat on the sheet, fully visible.
4. **Camera:** phone held flat and parallel to the sheet, 40–60 cm above it. Marker and onions in the same plane.
5. **Light:** even, diffuse light (daylight or a tube light). Avoid hard shadows; they get counted as onion edges.
6. **Batch size:** 10–30 onions per photo. For a lot, take several photos of random samples and grade each.
7. **Single mode:** one onion on the sheet with the marker beside it (for dispute resolution on a specific bulb).

---

## 5. Grading logic

### Per onion
```
defects = model detections on this onion with confidence ≥ per-class threshold
diameter_mm = short side of min-area rectangle / px_per_mm        (only if marker found)

category = GRADE_A
for each defect type present:        category = worse(category, rules.category_by_defect[type])
if diameter_mm < size_mm.min:        category = worse(category, rules.category_by_defect["undersized"])
if diameter_mm > size_mm.max:        category = worse(category, rules.category_by_defect["oversized"])
severity order: GRADE_A < URS < REJECT
```

### Lot
```
grade_a_pct = grade_a / total × 100
urs_pct     = urs / total × 100
reject_pct  = reject / total × 100

if total == 0                          → NO_ONIONS
elif reject_pct > lot.reject_above_pct → REJECT
elif grade_a_pct ≥ lot.grade_a_min_pct → GRADE_A
else                                   → URS
```

### Worked example
```
Total 20 onions: 15 clean, 2 rotten, 1 sprouted, 1 cut, 1 undersized (38 mm)
Grade A = 15/20 = 75.0 %     URS = 5/20 = 25.0 %
Lot rule grade_a_min_pct = 90 → lot verdict: URS
```

### Default thresholds are placeholders
`size_mm` 45–65 mm and the 90 % lot rule are **demo defaults**. Replace them with the exact figures from the specification
you cite (NCCF/NAFED onion procurement spec or AGMARK grade designation rules) and put the spec's name in `spec_name`.
The spec name and a hash of the rules file print on every report.

---

## 6. API contract

### `GET /health`
```json
{ "status": "ok", "model_id": "onions-ciqkj/3", "mock_mode": false, "rules_version": "3fa1c9e0b2d4" }
```

### `GET /rules`
Returns the active `grading_rules.json` plus its `version` hash.

### `POST /analyze` (multipart/form-data)

| Field | Type | Default | Notes |
|---|---|---|---|
| `file` | image (jpeg/png) | required | max 15 MB |
| `mode` | `batch` \| `single` | `batch` | single = treat as one onion |
| `marker_mm` | float | `50` | measured side of the black square |

Response (`AnalysisResult`):
```json
{
  "report_id": "a1b2c3d4e5f6",
  "created_at": "2026-09-29T08:15:02.123456+00:00",
  "mode": "batch",
  "image_width": 1280,
  "image_height": 960,
  "calibrated": true,
  "px_per_mm": 4.812,
  "onions": [
    {
      "id": 1,
      "box": [0.10, 0.12, 0.21, 0.26],
      "diameter_mm": 58.3,
      "defects": [],
      "size_flag": null,
      "category": "GRADE_A",
      "reasons": []
    },
    {
      "id": 2,
      "box": [0.40, 0.10, 0.50, 0.24],
      "diameter_mm": 52.0,
      "defects": [{ "type": "rotten", "confidence": 0.81, "box": [0.42, 0.13, 0.47, 0.20] }],
      "size_flag": null,
      "category": "URS",
      "reasons": ["rotten detected (81%)"]
    }
  ],
  "summary": {
    "total": 20, "grade_a": 15, "urs": 5, "reject": 0,
    "grade_a_pct": 75.0, "urs_pct": 25.0, "reject_pct": 0.0,
    "defect_counts": { "cuts": 1, "rotten": 2, "sprout": 1, "undersized": 1, "oversized": 0 },
    "lot_verdict": "URS"
  },
  "warnings": [],
  "model_id": "onions-ciqkj/3",
  "rules_version": "3fa1c9e0b2d4",
  "spec_name": "DEMO DEFAULTS ...",
  "report_hash": "9c1e…",
  "annotated_image_b64": "/9j/4AAQSkZJRgABAQ…"
}
```
All boxes are normalised `[x1, y1, x2, y2]` in 0..1. `defect_counts` counts **onions affected**, not boxes.

Errors: `400` bad input · `413` too large · `502` Roboflow returned an error · `504` Roboflow unreachable.

---

## 7. Repository structure

```
onion-grader/
├── README.md
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI routes
│   │   ├── config.py                # env settings
│   │   ├── schemas.py               # response models
│   │   ├── pipeline.py              # orchestrates one analysis
│   │   ├── grading_rules.json       # THE grading spec (edit this, not code)
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── roboflow_client.py   # hosted model call + mock mode
│   │       ├── calibration.py       # ArUco marker → px/mm
│   │       ├── segmentation.py      # onion contours on the blue sheet
│   │       ├── matcher.py           # defect box → onion
│   │       ├── grading.py           # rules engine + summary
│   │       └── annotate.py          # evidence image
│   ├── scripts/
│   │   ├── test_roboflow.py         # Milestone 0: try the model on your photos
│   │   └── generate_marker.py       # printable ArUco marker
│   ├── tests/
│   │   └── test_grading.py
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
└── mobile/                          # created with create-expo-app, then reset-project
    ├── app/                         # expo-router screens
    │   ├── _layout.tsx
    │   ├── index.tsx                # Home + recent reports
    │   ├── scan.tsx                 # camera
    │   ├── analyze.tsx              # upload + progress + errors
    │   ├── report/[id].tsx          # quality report
    │   └── settings.tsx
    ├── src/
    │   ├── types.ts
    │   ├── theme.ts
    │   ├── api/client.ts
    │   ├── lib/settings.ts
    │   ├── lib/storage.ts
    │   ├── lib/image.ts
    │   ├── lib/report.ts            # PDF HTML + share
    │   └── components/
    │       ├── VerdictBanner.tsx
    │       └── StatCard.tsx
    ├── app.json
    ├── eas.json
    └── .env                         # EXPO_PUBLIC_API_URL=...
```

---

## 8. Backend (FastAPI): full code

### 8.1 Setup (Mac)
```bash
cd onion-grader/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # paste your Roboflow key into .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# open http://localhost:8000/docs to try /analyze from the browser
```

### 8.2 `requirements.txt`
```
fastapi>=0.110
uvicorn[standard]>=0.29
python-multipart>=0.0.9
httpx>=0.27
pydantic>=2.6
pydantic-settings>=2.2
numpy>=1.26
opencv-contrib-python-headless>=4.9
pillow>=10.2
pytest>=8.0
```
(`opencv-contrib-python-headless` guarantees `cv2.aruco.ArucoDetector` is present.)

### 8.3 `.env.example`
```
ROBOFLOW_API_KEY=your_key_here
ROBOFLOW_MODEL_ID=onions-ciqkj/3
ROBOFLOW_API_URL=https://serverless.roboflow.com
# Set to true to develop the app without calling Roboflow (fake defects on real segmented onions)
MOCK_MODE=false
```
If `serverless.roboflow.com` returns 404 for this model, try `https://detect.roboflow.com` (older hosted endpoint, same request format).

### 8.4 `pytest.ini`
```ini
[pytest]
pythonpath = .
testpaths = tests
```

### 8.5 `app/__init__.py` and `app/services/__init__.py`
Empty files.

### 8.6 `app/config.py`
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    roboflow_api_key: str = ""
    roboflow_model_id: str = "onions-ciqkj/3"
    roboflow_api_url: str = "https://serverless.roboflow.com"
    # Keep the server-side threshold low; per-class thresholds are applied from grading_rules.json
    roboflow_confidence: int = 25
    roboflow_overlap: int = 30

    mock_mode: bool = False
    max_image_side: int = 1280


settings = Settings()
```

### 8.7 `app/schemas.py`
```python
from typing import Literal, Optional

from pydantic import BaseModel

Category = Literal["GRADE_A", "URS", "REJECT"]


class Defect(BaseModel):
    type: str                 # cuts | rotten | sprout
    confidence: float
    box: list[float]          # normalised [x1, y1, x2, y2]


class Onion(BaseModel):
    id: int
    box: list[float]
    diameter_mm: Optional[float]
    defects: list[Defect]
    size_flag: Optional[Literal["undersized", "oversized"]]
    category: Category
    reasons: list[str]


class Summary(BaseModel):
    total: int
    grade_a: int
    urs: int
    reject: int
    grade_a_pct: float
    urs_pct: float
    reject_pct: float
    defect_counts: dict[str, int]
    lot_verdict: str          # GRADE_A | URS | REJECT | NO_ONIONS


class AnalysisResult(BaseModel):
    report_id: str
    created_at: str
    mode: Literal["batch", "single"]
    image_width: int
    image_height: int
    calibrated: bool
    px_per_mm: Optional[float]
    onions: list[Onion]
    summary: Summary
    warnings: list[str]
    model_id: str
    rules_version: str
    spec_name: str
    report_hash: str
    annotated_image_b64: str
```

### 8.8 `app/grading_rules.json`
```json
{
  "spec_name": "DEMO DEFAULTS - replace with the procurement specification you cite (NCCF/NAFED onion spec or AGMARK grade designation rules)",
  "min_confidence": { "cuts": 0.45, "rotten": 0.40, "sprout": 0.40 },
  "size_mm": { "min": 45, "max": 65 },
  "category_by_defect": {
    "cuts": "URS",
    "rotten": "URS",
    "sprout": "URS",
    "undersized": "URS",
    "oversized": "URS"
  },
  "lot": { "grade_a_min_pct": 90, "reject_above_pct": 100 },
  "notes": "Allowed categories: GRADE_A, URS, REJECT. If your spec rejects rotten bulbs outright, set rotten to REJECT and lower reject_above_pct. Set size_mm.max to null to ignore oversize."
}
```

### 8.9 `app/services/roboflow_client.py`
```python
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
```

### 8.10 `app/services/calibration.py`
```python
import cv2
import numpy as np

_DICTIONARY = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
_DETECTOR = cv2.aruco.ArucoDetector(_DICTIONARY, cv2.aruco.DetectorParameters())


def find_marker(bgr: np.ndarray, marker_mm: float) -> dict | None:
    """Detect the printed ArUco marker and return the pixel-per-mm scale.

    marker_mm is the side length of the black square (measure it with a ruler after printing).
    """
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    corners, ids, _ = _DETECTOR.detectMarkers(gray)
    if ids is None or len(corners) == 0:
        return None
    pts = corners[0].reshape(4, 2)
    side_px = float(np.mean([np.linalg.norm(pts[i] - pts[(i + 1) % 4]) for i in range(4)]))
    return {"px_per_mm": side_px / marker_mm, "polygon": pts.astype(np.int32)}
```

### 8.11 `app/services/segmentation.py`
```python
import cv2
import numpy as np


def _background_lab(lab: np.ndarray) -> np.ndarray:
    """Background colour = median of a thin border strip (the sheet should fill the frame)."""
    h, w = lab.shape[:2]
    b = max(4, int(min(h, w) * 0.03))
    border = np.concatenate([
        lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3),
        lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3),
    ])
    return np.median(border, axis=0)


def _blob(contour: np.ndarray, synthetic: bool = False) -> dict:
    x, y, w, h = cv2.boundingRect(contour)
    (_, _), (rw, rh), _ = cv2.minAreaRect(contour)
    return {
        "contour": contour.astype(np.int32),
        "box_px": (x, y, w, h),
        "area": float(cv2.contourArea(contour)),
        # An onion lying on its side shows height × diameter; the short side is the equatorial diameter.
        "short_side_px": float(min(rw, rh)),
        "synthetic": synthetic,
    }


def whole_image_blob(w: int, h: int) -> dict:
    c = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype=np.int32).reshape(-1, 1, 2)
    return _blob(c, synthetic=True)


def _split_touching(comp_mask: np.ndarray, bgr_crop: np.ndarray) -> list[np.ndarray] | None:
    """Watershed split for two or more onions that touch. Returns None if only one peak is found."""
    dist = cv2.distanceTransform(comp_mask, cv2.DIST_L2, 5)
    _, sure_fg = cv2.threshold(dist, 0.55 * dist.max(), 255, cv2.THRESH_BINARY)
    sure_fg = sure_fg.astype(np.uint8)
    n, markers = cv2.connectedComponents(sure_fg)
    if n <= 2:  # background + one peak
        return None
    unknown = cv2.subtract(comp_mask, sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(bgr_crop.copy(), markers.astype(np.int32))
    parts = []
    for label in range(2, n + 1):
        part = np.uint8(markers == label) * 255
        cs, _ = cv2.findContours(part, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if cs:
            parts.append(max(cs, key=cv2.contourArea))
    return parts


def segment_onions(
    bgr: np.ndarray,
    exclude_polygon: np.ndarray | None = None,
    delta_e_thresh: float = 20.0,
    min_area_frac: float = 0.0015,
    max_area_frac: float = 0.9,
) -> list[dict]:
    """Return one blob per onion found on a plain background."""
    h, w = bgr.shape[:2]
    img_area = h * w
    lab = cv2.cvtColor(cv2.GaussianBlur(bgr, (5, 5), 0), cv2.COLOR_BGR2LAB).astype(np.float32)
    d = lab - _background_lab(lab)
    # Down-weight lightness so soft shadows on the sheet aren't mistaken for onions
    dist = np.sqrt((0.5 * d[..., 0]) ** 2 + d[..., 1] ** 2 + d[..., 2] ** 2)
    mask = np.uint8(dist > delta_e_thresh) * 255

    if exclude_polygon is not None:
        # Remove the marker and its white paper margin
        center = exclude_polygon.mean(axis=0)
        grown = ((exclude_polygon - center) * 1.6 + center).astype(np.int32)
        cv2.fillPoly(mask, [grown], 0)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    blobs: list[dict] = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area_frac * img_area or area > max_area_frac * img_area:
            continue
        hull_area = cv2.contourArea(cv2.convexHull(c))
        solidity = area / hull_area if hull_area else 1.0
        if solidity < 0.88:  # concave outline → probably touching onions
            x, y, bw, bh = cv2.boundingRect(c)
            offset = np.array([x, y], dtype=np.int32)
            comp = np.zeros((bh, bw), np.uint8)
            cv2.drawContours(comp, [(c - offset).astype(np.int32)], -1, 255, cv2.FILLED)
            parts = _split_touching(comp, bgr[y:y + bh, x:x + bw])
            if parts:
                for p in parts:
                    p = (p + offset).astype(np.int32)
                    if cv2.contourArea(p) >= min_area_frac * img_area:
                        blobs.append(_blob(p))
                continue
        blobs.append(_blob(c))
    return blobs
```

### 8.12 `app/services/matcher.py`
```python
import cv2
import numpy as np


def _pred_to_box(p: dict) -> list[float]:
    x1 = p["x"] - p["width"] / 2
    y1 = p["y"] - p["height"] / 2
    return [x1, y1, x1 + p["width"], y1 + p["height"]]


def _overlap_ratio(defect_box: list[float], onion_box_px: tuple) -> float:
    """Fraction of the defect box that lies inside the onion's bounding box."""
    dx1, dy1, dx2, dy2 = defect_box
    ox, oy, ow, oh = onion_box_px
    ix = max(0.0, min(dx2, ox + ow) - max(dx1, ox))
    iy = max(0.0, min(dy2, oy + oh) - max(dy1, oy))
    area = max(1e-6, (dx2 - dx1) * (dy2 - dy1))
    return ix * iy / area


def _synthetic_onion(box: list[float]) -> dict:
    """A defect the segmenter missed still represents an onion; count it from the box."""
    x1, y1, x2, y2 = [int(round(v)) for v in box]
    contour = np.array([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], dtype=np.int32).reshape(-1, 1, 2)
    return {
        "contour": contour,
        "box_px": (x1, y1, x2 - x1, y2 - y1),
        "area": float((x2 - x1) * (y2 - y1)),
        "short_side_px": float(min(x2 - x1, y2 - y1)),
        "synthetic": True,
        "defects": [],
    }


def assign_defects(blobs: list[dict], preds: list[dict], force_single: bool = False) -> list[dict]:
    onions = [{**b, "defects": []} for b in blobs]
    for p in preds:
        box = _pred_to_box(p)
        defect = {"type": p["class"], "confidence": float(p["confidence"]), "box_px": box}

        if force_single and onions:
            onions[0]["defects"].append(defect)
            continue

        target = None
        for o in onions:  # 1) defect centre inside an onion outline
            if cv2.pointPolygonTest(o["contour"], (float(p["x"]), float(p["y"])), False) >= 0:
                target = o
                break
        if target is None and onions:  # 2) mostly overlapping an onion (e.g., a sprout sticking out)
            best = max(onions, key=lambda o: _overlap_ratio(box, o["box_px"]))
            if _overlap_ratio(box, best["box_px"]) >= 0.3:
                target = best
        if target is None:  # 3) segmenter missed it
            target = _synthetic_onion(box)
            onions.append(target)
        target["defects"].append(defect)
    return onions
```

### 8.13 `app/services/grading.py`
```python
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
```

### 8.14 `app/services/annotate.py`
```python
import base64

import cv2
import numpy as np

COLORS = {"GRADE_A": (79, 125, 47), "URS": (0, 119, 199), "REJECT": (30, 38, 179)}  # BGR
SHORT = {"cuts": "CUT", "rotten": "ROT", "sprout": "SPR"}


def _label(img: np.ndarray, text: str, org: tuple[int, int], color: tuple) -> None:
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = max(0.5, img.shape[1] / 1800)
    (tw, th), _ = cv2.getTextSize(text, font, scale, 2)
    x, y = org
    y = max(y, th + 6)
    cv2.rectangle(img, (x, y - th - 6), (x + tw + 6, y + 2), color, -1)
    cv2.putText(img, text, (x + 3, y - 3), font, scale, (255, 255, 255), 2, cv2.LINE_AA)


def annotate(bgr: np.ndarray, onions: list[dict], marker: dict | None) -> str:
    out = bgr.copy()
    for o in onions:
        color = COLORS[o["category"]]
        cv2.drawContours(out, [o["contour"]], -1, color, 3)
        for d in o["defects"]:
            x1, y1, x2, y2 = [int(v) for v in d["box_px"]]
            cv2.rectangle(out, (x1, y1), (x2, y2), (255, 255, 255), 1)

        text = f"#{o['id']}"
        if o.get("diameter_mm"):
            text += f" {o['diameter_mm']:.0f}mm"
        tags = sorted({SHORT.get(d["type"], d["type"]) for d in o["defects"]})
        if o.get("size_flag") == "undersized":
            tags.append("SMALL")
        elif o.get("size_flag") == "oversized":
            tags.append("LARGE")
        if tags:
            text += " " + ",".join(tags)
        x, y, _, _ = o["box_px"]
        _label(out, text, (int(x), int(y) - 4), color)

    if marker is not None:
        cv2.polylines(out, [marker["polygon"].reshape(-1, 1, 2)], True, (255, 0, 255), 3)

    ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 72])
    if not ok:
        raise ValueError("Could not encode annotated image")
    return base64.b64encode(buf.tobytes()).decode("ascii")
```

### 8.15 `app/pipeline.py`
```python
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
```

### 8.16 `app/main.py`
```python
import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .pipeline import analyze_image
from .schemas import AnalysisResult
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
```

### 8.17 `tests/test_grading.py`
```python
from app.services.grading import grade_onion, load_rules, summarize

RULES = load_rules()


def test_clean_onion_is_grade_a():
    cat, flag, reasons = grade_onion([], 55.0, RULES)
    assert cat == "GRADE_A" and flag is None and reasons == []


def test_rotten_is_downgraded():
    cat, _, reasons = grade_onion([{"type": "rotten", "confidence": 0.8}], 55.0, RULES)
    assert cat == "URS" and "rotten" in reasons[0]


def test_undersized():
    cat, flag, _ = grade_onion([], 30.0, RULES)
    assert flag == "undersized" and cat == "URS"


def test_no_marker_skips_size_check():
    cat, flag, _ = grade_onion([], None, RULES)
    assert cat == "GRADE_A" and flag is None


def test_summary_percentages_and_verdict():
    good = {"category": "GRADE_A", "defects": [], "size_flag": None}
    bad = {"category": "URS", "defects": [{"type": "rotten"}], "size_flag": None}
    s = summarize([good, good, good, bad], RULES)
    assert s["grade_a_pct"] == 75.0 and s["urs_pct"] == 25.0
    assert s["defect_counts"]["rotten"] == 1
    assert s["lot_verdict"] == "URS"


def test_empty():
    assert summarize([], RULES)["lot_verdict"] == "NO_ONIONS"
```

### 8.18 `scripts/test_roboflow.py` (Milestone 0)
```python
"""Try the hosted model on your own onion photos before writing any app code.

Usage:
  export ROBOFLOW_API_KEY=xxxx
  python scripts/test_roboflow.py photos/*.jpg
Writes <photo>.pred.jpg next to each input with boxes drawn.
"""
import base64
import json
import os
import sys

import cv2
import httpx

MODEL = os.getenv("ROBOFLOW_MODEL_ID", "onions-ciqkj/3")
URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
KEY = os.environ["ROBOFLOW_API_KEY"]

for path in sys.argv[1:]:
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
```

### 8.19 `scripts/generate_marker.py`
```python
"""Creates marker_50mm.png: ArUco DICT_4X4_50 id 0, 50 mm black square at 300 DPI.

Print at 100% / "actual size" (NOT "fit to page"). Then measure the black square with a ruler
and enter that number in the app's Settings → Marker size. Cut the paper to about 7 cm square.
"""
import cv2
import numpy as np
from PIL import Image

MM, DPI, MARGIN_MM = 50, 300, 8
px = round(MM / 25.4 * DPI)
margin = round(MARGIN_MM / 25.4 * DPI)
dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
marker = cv2.aruco.generateImageMarker(dictionary, 0, px)
canvas = np.full((px + 2 * margin, px + 2 * margin), 255, np.uint8)
canvas[margin:margin + px, margin:margin + px] = marker
Image.fromarray(canvas).save("marker_50mm.png", dpi=(DPI, DPI))
print("Saved marker_50mm.png")
```

### 8.20 `Dockerfile`
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

---

## 9. Mobile app (Expo + expo-router): full code

### 9.1 Create the project (Mac)
```bash
cd onion-grader
npx create-expo-app@latest mobile        # default template = TypeScript + expo-router
cd mobile
npm run reset-project                     # clears the example screens (answer "n" to delete them)
npx expo install expo-camera expo-image-picker expo-image-manipulator expo-print expo-sharing @react-native-async-storage/async-storage
```
Always install native libs with `npx expo install` (not `npm install`) so versions match the Expo SDK.
The default template's `tsconfig.json` maps `@/*` to the project root, which the imports below rely on.

### 9.2 `.env`
```
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```
Use the Mac's LAN IP (`ipconfig getifaddr en0`) or a tunnel / Render URL (section 10). It can also be changed at runtime in Settings.

### 9.3 `app.json` (merge into the generated one)
```json
{
  "expo": {
    "name": "Onion Grader",
    "slug": "onion-grader",
    "scheme": "oniongrader",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "android": { "package": "com.sih.oniongrader" },
    "plugins": [
      "expo-router",
      ["expo-camera", { "cameraPermission": "Onion Grader uses the camera to photograph onion samples." }],
      ["expo-image-picker", { "photosPermission": "Onion Grader opens your gallery so you can grade saved onion photos." }]
    ]
  }
}
```

### 9.4 `src/types.ts`
```ts
export type Category = 'GRADE_A' | 'URS' | 'REJECT';
export type LotVerdict = Category | 'NO_ONIONS';
export type ScanMode = 'batch' | 'single';

export interface Defect {
  type: string; // cuts | rotten | sprout
  confidence: number;
  box: number[];
}

export interface Onion {
  id: number;
  box: number[];
  diameter_mm: number | null;
  defects: Defect[];
  size_flag: 'undersized' | 'oversized' | null;
  category: Category;
  reasons: string[];
}

export interface Summary {
  total: number;
  grade_a: number;
  urs: number;
  reject: number;
  grade_a_pct: number;
  urs_pct: number;
  reject_pct: number;
  defect_counts: Record<string, number>;
  lot_verdict: LotVerdict;
}

export interface AnalysisResult {
  report_id: string;
  created_at: string;
  mode: ScanMode;
  image_width: number;
  image_height: number;
  calibrated: boolean;
  px_per_mm: number | null;
  onions: Onion[];
  summary: Summary;
  warnings: string[];
  model_id: string;
  rules_version: string;
  spec_name: string;
  report_hash: string;
  annotated_image_b64: string;
}

export interface ReportMeta {
  id: string;
  batchId: string;
  createdAt: string;
  mode: ScanMode;
  total: number;
  gradeAPct: number;
  ursPct: number;
  lotVerdict: LotVerdict;
  centreName: string;
  operatorName: string;
}

export interface StoredReport {
  meta: ReportMeta;
  result: AnalysisResult;
}
```

### 9.5 `src/theme.ts`
Visual direction: a field tool for procurement centres. Red-onion aubergine as the brand colour, a clean paper background,
and three unambiguous status colours. Large numbers, sentence-case labels, readable in sunlight.
```ts
import type { LotVerdict } from '@/src/types';

export const colors = {
  brand: '#4A2040',     // red-onion skin
  brandSoft: '#EFE6EC',
  bg: '#FAFAF8',
  card: '#FFFFFF',
  ink: '#1E1A1D',
  muted: '#6E6770',
  border: '#E6E1E4',
  gradeA: '#2F7D4F',
  urs: '#C77700',
  reject: '#B3261E',
};

export const categoryColor: Record<LotVerdict, string> = {
  GRADE_A: colors.gradeA,
  URS: colors.urs,
  REJECT: colors.reject,
  NO_ONIONS: colors.muted,
};

export const categoryLabel: Record<LotVerdict, string> = {
  GRADE_A: 'Grade A',
  URS: 'URS',
  REJECT: 'Reject',
  NO_ONIONS: 'No onions found',
};

export const defectLabel: Record<string, string> = {
  cuts: 'Cut / damaged',
  rotten: 'Rotten',
  sprout: 'Sprouted',
  undersized: 'Undersized',
  oversized: 'Oversized',
};
```

### 9.6 `src/lib/settings.ts`
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  apiUrl: string;
  markerMm: number;
  centreName: string;
  operatorName: string;
}

const KEY = 'settings:v1';

export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.10:8000',
  markerMm: 50,
  centreName: '',
  operatorName: '',
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
```

### 9.7 `src/lib/storage.ts`
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnalysisResult, ReportMeta, StoredReport } from '@/src/types';

// Each report holds a ~200–300 KB base64 image, so keep only the latest 10 (AsyncStorage on Android is small).
const INDEX_KEY = 'reports:index:v1';
const MAX_REPORTS = 10;
const itemKey = (id: string) => `reports:item:${id}`;

function makeBatchId(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `ON-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function listReports(): Promise<ReportMeta[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getReport(id: string): Promise<StoredReport | null> {
  const raw = await AsyncStorage.getItem(itemKey(id));
  return raw ? JSON.parse(raw) : null;
}

export async function saveReport(
  result: AnalysisResult,
  ctx: { centreName: string; operatorName: string },
): Promise<string> {
  const meta: ReportMeta = {
    id: result.report_id,
    batchId: makeBatchId(),
    createdAt: result.created_at,
    mode: result.mode,
    total: result.summary.total,
    gradeAPct: result.summary.grade_a_pct,
    ursPct: result.summary.urs_pct,
    lotVerdict: result.summary.lot_verdict,
    centreName: ctx.centreName,
    operatorName: ctx.operatorName,
  };
  await AsyncStorage.setItem(itemKey(meta.id), JSON.stringify({ meta, result }));
  const index = [meta, ...(await listReports())];
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, MAX_REPORTS)));
  const dropped = index.slice(MAX_REPORTS);
  if (dropped.length) await AsyncStorage.multiRemove(dropped.map((m) => itemKey(m.id)));
  return meta.id;
}

export async function deleteReport(id: string): Promise<void> {
  const index = (await listReports()).filter((m) => m.id !== id);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  await AsyncStorage.removeItem(itemKey(id));
}
```

### 9.8 `src/lib/image.ts`
```ts
import * as ImageManipulator from 'expo-image-manipulator';

/** Shrink the photo before upload: faster on mobile data, and the server works at 1280 px anyway.
 *  If manipulateAsync is removed in your SDK, use ImageManipulator.manipulate(uri).resize(...).renderAsync()
 *  then .saveAsync({ compress: 0.8, format: SaveFormat.JPEG }). */
export async function prepareForUpload(uri: string): Promise<string> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return out.uri;
}
```

### 9.9 `src/api/client.ts`
```ts
import type { AnalysisResult, ScanMode } from '@/src/types';
import type { AppSettings } from '@/src/lib/settings';

const base = (url: string) => url.trim().replace(/\/+$/, '');

export async function analyzeImage(uri: string, mode: ScanMode, s: AppSettings): Promise<AnalysisResult> {
  const form = new FormData();
  // React Native's FormData accepts { uri, name, type } for files. Do not set Content-Type yourself.
  form.append('file', { uri, name: 'onions.jpg', type: 'image/jpeg' } as any);
  form.append('mode', mode);
  form.append('marker_mm', String(s.markerMm));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${base(s.apiUrl)}/analyze`, {
      method: 'POST',
      body: form,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = await res.text();
      try { detail = JSON.parse(detail).detail ?? detail; } catch {}
      throw new Error(`Server error ${res.status}: ${String(detail).slice(0, 200)}`);
    }
    return (await res.json()) as AnalysisResult;
  } finally {
    clearTimeout(timer);
  }
}

/** Also wakes up a sleeping free-tier server when the Home screen opens. */
export async function pingHealth(apiUrl: string, timeoutMs = 10_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base(apiUrl)}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
```

### 9.10 `src/lib/report.ts` (PDF)
```ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { categoryColor, categoryLabel, defectLabel } from '@/src/theme';
import type { StoredReport } from '@/src/types';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function buildReportHtml({ meta, result }: StoredReport): string {
  const s = result.summary;
  const verdictColor = categoryColor[s.lot_verdict];
  const defectRows = Object.entries(s.defect_counts)
    .map(([k, v]) => `<tr><td>${esc(defectLabel[k] ?? k)}</td><td class="num">${v}</td></tr>`)
    .join('');
  const onionRows = result.onions
    .map(
      (o) => `<tr>
        <td>#${o.id}</td>
        <td class="num">${o.diameter_mm ?? '—'}</td>
        <td style="color:${categoryColor[o.category]};font-weight:700">${categoryLabel[o.category]}</td>
        <td>${esc(o.reasons.join('; ') || 'No defects detected')}</td>
      </tr>`,
    )
    .join('');
  const when = new Date(result.created_at).toLocaleString('en-IN');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, 'Noto Sans', sans-serif; color:#1E1A1D; margin:28px; font-size:12px; }
  h1 { font-size:22px; margin:0 0 4px; color:#4A2040; }
  .sub { color:#6E6770; margin-bottom:16px; }
  .verdict { background:${verdictColor}; color:#fff; padding:14px 18px; border-radius:10px; font-size:20px; font-weight:700; }
  .stats { display:flex; gap:12px; margin:14px 0; }
  .stat { flex:1; border:1px solid #E6E1E4; border-radius:10px; padding:12px; }
  .stat b { font-size:26px; display:block; }
  table { width:100%; border-collapse:collapse; margin:10px 0 18px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid #E6E1E4; vertical-align:top; }
  th { color:#6E6770; font-weight:600; }
  .num { text-align:right; font-variant-numeric: tabular-nums; }
  img { width:100%; border-radius:8px; margin:6px 0 14px; }
  .meta td:first-child { color:#6E6770; width:34%; }
  .foot { color:#6E6770; font-size:10px; margin-top:18px; line-height:1.5; word-break:break-all; }
  h2 { font-size:14px; margin:18px 0 4px; }
</style></head><body>
  <h1>Onion quality report</h1>
  <div class="sub">Batch ${esc(meta.batchId)} · ${esc(when)}</div>
  <div class="verdict">Lot verdict: ${categoryLabel[s.lot_verdict]}</div>
  <div class="stats">
    <div class="stat"><b style="color:${categoryColor.GRADE_A}">${s.grade_a_pct}%</b>Grade A (${s.grade_a} of ${s.total})</div>
    <div class="stat"><b style="color:${categoryColor.URS}">${s.urs_pct}%</b>URS (${s.urs} of ${s.total})</div>
    ${s.reject ? `<div class="stat"><b style="color:${categoryColor.REJECT}">${s.reject_pct}%</b>Reject (${s.reject})</div>` : ''}
  </div>

  <h2>Evidence image</h2>
  <img src="data:image/jpeg;base64,${result.annotated_image_b64}" />

  <h2>Defects found (onions affected)</h2>
  <table>${defectRows}</table>

  <h2>Per-onion assessment</h2>
  <table><tr><th>Onion</th><th class="num">Diameter (mm)</th><th>Grade</th><th>Reason</th></tr>${onionRows}</table>

  <h2>Record</h2>
  <table class="meta">
    <tr><td>Procurement centre</td><td>${esc(meta.centreName || '—')}</td></tr>
    <tr><td>Operator</td><td>${esc(meta.operatorName || '—')}</td></tr>
    <tr><td>Grading specification</td><td>${esc(result.spec_name)}</td></tr>
    <tr><td>Rules version</td><td>${esc(result.rules_version)}</td></tr>
    <tr><td>Detection model</td><td>${esc(result.model_id)}</td></tr>
    <tr><td>Size calibration</td><td>${result.calibrated ? `Marker found (${result.px_per_mm} px/mm)` : 'Marker not found — sizes not measured'}</td></tr>
  </table>
  ${result.warnings.length ? `<p><b>Warnings:</b> ${result.warnings.map(esc).join(' ')}</p>` : ''}
  <div class="foot">
    Report hash (SHA-256): ${result.report_hash}<br/>
    Automated assessment to support the grader. Grades follow the rules file named above; detections are shown on the evidence image for verification.
  </div>
</body></html>`;
}

export async function shareReportPdf(report: StoredReport): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(report) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share quality report' });
  }
}
```

### 9.11 `src/components/VerdictBanner.tsx`
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { categoryColor, categoryLabel } from '@/src/theme';
import type { LotVerdict } from '@/src/types';

export function VerdictBanner({ verdict, total }: { verdict: LotVerdict; total: number }) {
  return (
    <View style={[styles.box, { backgroundColor: categoryColor[verdict] }]}>
      <Text style={styles.caption}>Lot verdict · {total} onions checked</Text>
      <Text style={styles.title}>{categoryLabel[verdict]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, paddingVertical: 18, paddingHorizontal: 20 },
  caption: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  title: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 2 },
});
```

### 9.12 `src/components/StatCard.tsx`
```tsx
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme';

export function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  value: { fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { fontSize: 15, color: colors.ink, fontWeight: '600', marginTop: 2 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
```

### 9.13 `app/_layout.tsx`
```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/src/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Onion Grader' }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="analyze" options={{ title: 'Grading', headerBackVisible: false }} />
        <Stack.Screen name="report/[id]" options={{ title: 'Quality report' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
```

### 9.14 `app/index.tsx` (Home)
```tsx
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { pingHealth } from '@/src/api/client';
import { getSettings } from '@/src/lib/settings';
import { listReports } from '@/src/lib/storage';
import { categoryColor, categoryLabel, colors } from '@/src/theme';
import type { ReportMeta, ScanMode } from '@/src/types';

export default function Home() {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      listReports().then(setReports);
      getSettings().then((s) => pingHealth(s.apiUrl)).then(setOnline);
    }, []),
  );

  const scan = (mode: ScanMode) => router.push({ pathname: '/scan', params: { mode } });

  const pickFromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) {
      router.push({ pathname: '/analyze', params: { uri: res.assets[0].uri, mode: 'batch' } });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: online == null ? colors.muted : online ? colors.gradeA : colors.reject }]} />
        <Text style={styles.statusText}>
          {online == null ? 'Checking grading server…' : online ? 'Grading server connected' : 'Grading server unreachable. Check Settings.'}
        </Text>
      </View>

      <Pressable style={styles.primary} onPress={() => scan('batch')}>
        <Text style={styles.primaryTitle}>Scan a batch</Text>
        <Text style={styles.primarySub}>10–30 onions on the blue sheet with the marker</Text>
      </Pressable>

      <View style={styles.row}>
        <Pressable style={styles.secondary} onPress={() => scan('single')}>
          <Text style={styles.secondaryText}>Check one onion</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={pickFromGallery}>
          <Text style={styles.secondaryText}>Grade a saved photo</Text>
        </Pressable>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.h2}>Recent reports</Text>
        <Pressable onPress={() => router.push('/settings')}>
          <Text style={styles.link}>Settings</Text>
        </Pressable>
      </View>

      {reports.length === 0 ? (
        <Text style={styles.empty}>No reports yet. Scan a batch to create the first one.</Text>
      ) : (
        reports.map((r) => (
          <Pressable key={r.id} style={styles.item} onPress={() => router.push({ pathname: '/report/[id]', params: { id: r.id } })}>
            <View style={[styles.bar, { backgroundColor: categoryColor[r.lotVerdict] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{r.batchId}</Text>
              <Text style={styles.itemSub}>
                {r.total} onions · Grade A {r.gradeAPct}% · URS {r.ursPct}%
              </Text>
            </View>
            <Text style={[styles.itemVerdict, { color: categoryColor[r.lotVerdict] }]}>{categoryLabel[r.lotVerdict]}</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: colors.muted, fontSize: 14 },
  primary: { backgroundColor: colors.brand, borderRadius: 18, padding: 22 },
  primaryTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  primarySub: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  secondary: { flex: 1, backgroundColor: colors.brandSoft, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 12 },
  secondaryText: { color: colors.brand, fontSize: 16, fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  h2: { fontSize: 18, fontWeight: '700', color: colors.ink },
  link: { color: colors.brand, fontSize: 15, fontWeight: '600' },
  empty: { color: colors.muted, fontSize: 15, paddingVertical: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border },
  bar: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  itemSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  itemVerdict: { fontSize: 14, fontWeight: '700' },
});
```

### 9.15 `app/scan.tsx` (Camera)
```tsx
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/src/theme';
import type { ScanMode } from '@/src/types';

const TIPS: Record<ScanMode, string> = {
  batch: 'Onions spaced apart on the blue sheet, marker fully visible. Hold the phone flat above them.',
  single: 'One onion on the blue sheet with the marker beside it. Hold the phone flat above it.',
};

export default function Scan() {
  const { mode = 'batch' } = useLocalSearchParams<{ mode?: ScanMode }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is needed to photograph the onions.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}><Text style={styles.cancel}>Go back</Text></Pressable>
      </View>
    );
  }

  const goAnalyze = (uri: string) => router.replace({ pathname: '/analyze', params: { uri, mode } });

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) goAnalyze(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) goAnalyze(res.assets[0].uri);
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      {/* Overlay is a sibling of CameraView, not a child */}
      <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <View style={styles.tip}>
          <Text style={styles.tipText}>{TIPS[mode]}</Text>
        </View>
        <View style={styles.frame} pointerEvents="none" />
        <View style={styles.controls}>
          <Pressable style={styles.sideBtn} onPress={() => router.back()}>
            <Text style={styles.sideText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.shutter, busy && { opacity: 0.5 }]} onPress={capture} disabled={busy}>
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable style={styles.sideBtn} onPress={pick}>
            <Text style={styles.sideText}>Gallery</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  permText: { color: '#fff', fontSize: 17, textAlign: 'center' },
  permBtn: { backgroundColor: colors.brand, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { color: '#ccc', fontSize: 15 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingHorizontal: 16 },
  tip: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 12 },
  tipText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  frame: { flex: 1, marginVertical: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 18 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideBtn: { width: 84, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10 },
  sideText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
```

### 9.16 `app/analyze.tsx` (upload + progress)
```tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { analyzeImage } from '@/src/api/client';
import { prepareForUpload } from '@/src/lib/image';
import { getSettings } from '@/src/lib/settings';
import { saveReport } from '@/src/lib/storage';
import { colors } from '@/src/theme';
import type { ScanMode } from '@/src/types';

const STEPS = ['Preparing photo', 'Uploading to grading server', 'Finding cuts, rot and sprouting', 'Measuring onion size', 'Applying grading rules'];

export default function Analyze() {
  const { uri, mode } = useLocalSearchParams<{ uri: string; mode?: ScanMode }>();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setError(null);
    setStep(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      const settings = await getSettings();
      const prepared = await prepareForUpload(uri);
      setStep(1);
      // The server does these steps in one request; the ticker only shows the user what is happening.
      timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1200);
      const result = await analyzeImage(prepared, mode ?? 'batch', settings);
      const id = await saveReport(result, settings);
      router.replace({ pathname: '/report/[id]', params: { id } });
    } catch (e: any) {
      setError(
        e?.name === 'AbortError'
          ? 'The server took too long to respond. A free-tier server may still be waking up. Try again in a moment.'
          : e?.message?.includes('Network request failed')
            ? 'Could not reach the grading server. Check the server address in Settings and that the phone is online.'
            : (e?.message ?? 'Grading failed.'),
      );
    } finally {
      if (timer) clearInterval(timer);
    }
  }, [uri, mode]);

  useEffect(() => { run(); }, [run]);

  if (error) {
    return (
      <View style={styles.page}>
        <Text style={styles.errTitle}>Grading didn't finish</Text>
        <Text style={styles.errText}>{error}</Text>
        <Pressable style={styles.btn} onPress={run}><Text style={styles.btnText}>Try again</Text></Pressable>
        <Pressable onPress={() => router.replace('/')}><Text style={styles.link}>Back to home</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ActivityIndicator size="large" color={colors.brand} />
      <View style={{ gap: 10, marginTop: 24 }}>
        {STEPS.map((label, i) => (
          <Text key={label} style={[styles.step, i < step && styles.done, i === step && styles.active]}>
            {i < step ? '✓ ' : i === step ? '• ' : '  '}{label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 24, justifyContent: 'center' },
  step: { fontSize: 17, color: colors.muted },
  done: { color: colors.gradeA },
  active: { color: colors.ink, fontWeight: '700' },
  errTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
  errText: { fontSize: 16, color: colors.muted, marginTop: 8, lineHeight: 22 },
  btn: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { color: colors.brand, fontSize: 15, textAlign: 'center', marginTop: 16 },
});
```

### 9.17 `app/report/[id].tsx`
```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatCard } from '@/src/components/StatCard';
import { VerdictBanner } from '@/src/components/VerdictBanner';
import { shareReportPdf } from '@/src/lib/report';
import { getReport } from '@/src/lib/storage';
import { categoryColor, categoryLabel, colors, defectLabel } from '@/src/theme';
import type { StoredReport } from '@/src/types';

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<StoredReport | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => { if (id) getReport(id).then(setData); }, [id]);

  if (!data) return <ActivityIndicator style={{ flex: 1 }} color={colors.brand} />;
  const { meta, result } = data;
  const s = result.summary;

  const share = async () => {
    setSharing(true);
    try { await shareReportPdf(data); }
    catch (e: any) { Alert.alert('PDF not created', e?.message ?? 'Unknown error'); }
    finally { setSharing(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <VerdictBanner verdict={s.lot_verdict} total={s.total} />

      <View style={styles.row}>
        <StatCard label="Grade A" value={`${s.grade_a_pct}%`} sub={`${s.grade_a} of ${s.total}`} color={colors.gradeA} />
        <StatCard label="URS" value={`${s.urs_pct}%`} sub={`${s.urs} of ${s.total}`} color={colors.urs} />
      </View>
      {s.reject > 0 && <StatCard label="Reject" value={`${s.reject_pct}%`} sub={`${s.reject} of ${s.total}`} color={colors.reject} />}

      {result.warnings.map((w) => (
        <View key={w} style={styles.warn}><Text style={styles.warnText}>{w}</Text></View>
      ))}

      <Image
        source={{ uri: `data:image/jpeg;base64,${result.annotated_image_b64}` }}
        style={[styles.image, { aspectRatio: result.image_width / result.image_height }]}
        resizeMode="contain"
      />
      <View style={styles.legend}>
        {(['GRADE_A', 'URS', 'REJECT'] as const).map((c) => (
          <View key={c} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: categoryColor[c] }]} />
            <Text style={styles.legendText}>{categoryLabel[c]}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Defects found</Text>
        {Object.entries(s.defect_counts).map(([k, v]) => (
          <View key={k} style={styles.line}>
            <Text style={styles.lineLabel}>{defectLabel[k] ?? k}</Text>
            <Text style={[styles.lineValue, v > 0 && { color: colors.urs }]}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Each onion</Text>
        {result.onions.map((o) => (
          <View key={o.id} style={styles.onion}>
            <Text style={styles.onionId}>#{o.id}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.onionGrade, { color: categoryColor[o.category] }]}>{categoryLabel[o.category]}</Text>
              <Text style={styles.onionReason}>
                {o.diameter_mm ? `${o.diameter_mm} mm · ` : ''}{o.reasons.join('; ') || 'No defects detected'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Record</Text>
        {[
          ['Batch', meta.batchId],
          ['Centre', meta.centreName || '—'],
          ['Operator', meta.operatorName || '—'],
          ['Time', new Date(result.created_at).toLocaleString('en-IN')],
          ['Specification', result.spec_name],
          ['Rules version', result.rules_version],
          ['Model', result.model_id],
          ['Report hash', result.report_hash.slice(0, 16) + '…'],
        ].map(([k, v]) => (
          <View key={k} style={styles.line}>
            <Text style={styles.lineLabel}>{k}</Text>
            <Text style={[styles.lineValue, { flex: 1, textAlign: 'right', fontWeight: '500' }]} numberOfLines={2}>{v}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.btn} onPress={share} disabled={sharing}>
        <Text style={styles.btnText}>{sharing ? 'Creating PDF…' : 'Share PDF report'}</Text>
      </Pressable>
      <Pressable style={styles.btnGhost} onPress={() => router.replace({ pathname: '/scan', params: { mode: result.mode } })}>
        <Text style={styles.btnGhostText}>Scan next batch</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 12 },
  warn: { backgroundColor: '#FFF4E0', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#F2D19B' },
  warnText: { color: '#7A4B00', fontSize: 14, lineHeight: 20 },
  image: { width: '100%', borderRadius: 12, backgroundColor: '#000' },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 3 },
  legendText: { color: colors.muted, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  lineLabel: { color: colors.muted, fontSize: 15 },
  lineValue: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  onion: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  onionId: { width: 36, fontWeight: '700', color: colors.ink, fontSize: 15 },
  onionGrade: { fontWeight: '700', fontSize: 15 },
  onionReason: { color: colors.muted, fontSize: 13, marginTop: 2 },
  btn: { backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  btnGhost: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: colors.brand },
  btnGhostText: { color: colors.brand, fontSize: 16, fontWeight: '700' },
});
```

### 9.18 `app/settings.tsx`
```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { pingHealth } from '@/src/api/client';
import { AppSettings, getSettings, saveSettings } from '@/src/lib/settings';
import { colors } from '@/src/theme';

export default function SettingsScreen() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [markerText, setMarkerText] = useState('50');
  const [status, setStatus] = useState('');

  useEffect(() => {
    getSettings().then((v) => { setS(v); setMarkerText(String(v.markerMm)); });
  }, []);

  if (!s) return <ActivityIndicator style={{ flex: 1 }} color={colors.brand} />;

  const save = async () => {
    const markerMm = parseFloat(markerText);
    if (!(markerMm >= 10 && markerMm <= 300)) { setStatus('Marker size must be between 10 and 300 mm.'); return; }
    const next = { ...s, markerMm };
    await saveSettings(next);
    setS(next);
    setStatus('Settings saved.');
  };

  const test = async () => {
    setStatus('Checking server…');
    setStatus((await pingHealth(s.apiUrl, 60_000)) ? 'Server connected.' : 'Server not reachable at this address.');
  };

  const field = (label: string, value: string, onChange: (t: string) => void, extra: object = {}) => (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} {...extra} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {field('Grading server address', s.apiUrl, (t) => setS({ ...s, apiUrl: t }), { keyboardType: 'url', placeholder: 'https://…' })}
      {field('Marker size (black square, mm)', markerText, setMarkerText, { keyboardType: 'decimal-pad' })}
      {field('Procurement centre', s.centreName, (t) => setS({ ...s, centreName: t }), { autoCapitalize: 'words', placeholder: 'e.g. Lasalgaon APMC' })}
      {field('Operator name', s.operatorName, (t) => setS({ ...s, operatorName: t }), { autoCapitalize: 'words' })}
      <Pressable style={styles.btn} onPress={save}><Text style={styles.btnText}>Save settings</Text></Pressable>
      <Pressable style={styles.btnGhost} onPress={test}><Text style={styles.btnGhostText}>Test connection</Text></Pressable>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.ink },
  btn: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhost: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: colors.brand },
  btnGhostText: { color: colors.brand, fontSize: 16, fontWeight: '700' },
  status: { color: colors.muted, fontSize: 15, textAlign: 'center' },
});
```

### 9.19 `eas.json` (only needed for a standalone APK)
```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://YOUR-BACKEND.onrender.com" }
    }
  }
}
```

---

## 10. Running it: Mac developer + friend's Android phone

### 10.1 Development with Expo Go (no Android Studio anywhere)
```bash
# Terminal 1 (Mac): backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2 (Mac): app
cd mobile && npx expo start
```
- Friend installs **Expo Go** from the Play Store and scans the QR code shown in the terminal.
- **Same Wi-Fi:** set the server address to `http://<Mac LAN IP>:8000` (`ipconfig getifaddr en0`). Allow incoming connections if macOS asks.
- **Different networks:** run `npx expo start --tunnel` for the app, and expose the backend with
  `brew install cloudflared && cloudflared tunnel --url http://localhost:8000` (gives an `https://…trycloudflare.com` URL; paste it in Settings).
- If Expo Go says the project's SDK is incompatible, the project and Expo Go are on different SDKs:
  run `npx expo install expo@latest --fix` or create the project again with `create-expo-app@latest`.
- Your friend can also clone the repo and run `npm install && npx expo start` on his own laptop (any OS).

### 10.2 Deploy the backend (so the app works anywhere)
Render (free): New → Web Service → connect the GitHub repo → Root directory `backend` → Runtime **Docker** →
add env var `ROBOFLOW_API_KEY` → deploy. Put the resulting `https://….onrender.com` URL in the app's Settings.
Free instances sleep when idle; the Home screen's health check wakes them, and the first request can take ~30–60 s.

### 10.3 Standalone APK (cloud build from the Mac)
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```
EAS returns a download link / QR for the `.apk`. Release builds block plain `http://`, so use the HTTPS Render or tunnel URL.

---

## 11. Constraints for the coding agent

1. **Never** put the Roboflow API key in the mobile app or in git. It lives only in `backend/.env` / Render env vars.
2. Only use libraries that run in **Expo Go** (everything listed in 9.1 does). No `react-native-vision-camera`, no custom native modules.
3. Install Expo libs with `npx expo install`. Match the installed SDK's API if it differs from this file.
4. Grading thresholds live only in `grading_rules.json`. No magic numbers for grades in Python or TypeScript.
5. The backend response shape in section 6 is the contract. If you change it, update `src/types.ts` in the same commit.
6. Keep `MOCK_MODE=true` working so the app can be developed without spending Roboflow credits.
7. Errors shown to users say what happened and what to do next (see `analyze.tsx`).

---

## 12. Build order and acceptance criteria

| Milestone | Work | Done when |
|---|---|---|
| **M0** Model check | `scripts/test_roboflow.py` on 10–20 of your own onion photos | You have `.pred.jpg` files and a rough sense of where the model misses. Adjust `min_confidence` accordingly. |
| **M1** Backend core | config, roboflow client, `/health`, `/analyze` returning raw counts | `curl -F file=@onions.jpg http://localhost:8000/analyze` returns JSON |
| **M2** CV + grading | marker, segmentation, matcher, grading, annotate, tests | `pytest` passes; annotated image outlines every onion on a test photo taken per section 4 |
| **M3** App skeleton | Expo project, Settings, Home health dot, gallery → analyze → raw JSON | Friend's phone grades a gallery photo via Expo Go |
| **M4** Camera + report | scan.tsx, report screen, storage | Photo → report with evidence image in under ~10 s on Wi-Fi |
| **M5** PDF | report.ts + share | PDF opens in WhatsApp/Drive with image and per-onion table |
| **M6** Deploy + tune | Render deploy, test 30+ real batches, tune `delta_e_thresh` and confidences | Works away from the dev Wi-Fi; accuracy numbers ready for the pitch (section 13) |
| **M7** (optional) | APK via EAS | Installable APK shared with judges |

Suggested schedule for a hackathon: day 1 M0–M2, day 2 M3–M4, day 3 M5–M6, day 4 real-onion testing and pitch.

---

## 13. Proving it works (do this before the demo)

1. Collect 30 batch photos per section 4 (mix of good, cut, rotten, sprouted, small onions).
2. A person grades each onion by hand using the same spec, writing grades against the `#id` numbers on the app's evidence image.
3. Record, in a spreadsheet: per-onion agreement (confusion matrix Grade A vs URS), and per-photo error in Grade A %.
4. Put those numbers on a slide: "App agreed with the manual grader on X of Y onions; mean Grade A % error Z points."
   Real measured numbers beat any claimed accuracy.

---

## 14. Known limitations (say these before the judges do)

- **Small training set.** `onions-ciqkj/3` comes from a few hundred images, so expect misses on unfamiliar varieties or lighting.
  Plan: log hard cases, add them to a fork of the dataset on Roboflow, add an `onion` class, retrain (v4).
- **One side only.** A single top-down photo sees one face of each onion. Upgrade: "flip and rescan" merging two photos.
- **"Damaged" = the model's `cuts` class.** Bruises and other mechanical injury aren't separate classes yet.
- **Controlled capture required.** The blue sheet + marker setup is what makes counting and sizing reliable.
  That's realistic at a procurement centre: one fixed grading station per centre.
- **Size is a 2-D estimate** from a top-down view, calibrated by the marker. Hold the phone parallel to the sheet.
- **Decision support, not the final authority.** The report shows its evidence and cites the rules it applied,
  so a grader can verify or override. That is exactly what removes disputes.

---

## 15. Version 2 ideas (only after the MVP works)

- On-device inference: export a retrained YOLO model to TFLite and run it offline (needs a development build, not Expo Go).
- Central dashboard (Supabase/Postgres) aggregating reports across procurement centres, to spot centres whose manual grades drift.
- Multi-photo lot sampling: grade 5 random samples per lot and combine into one lot report.
- Hindi/Marathi UI strings for field staff.
- QR code on the PDF linking to the stored report JSON so anyone can recompute the hash.
