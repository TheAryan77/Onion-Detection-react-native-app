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
