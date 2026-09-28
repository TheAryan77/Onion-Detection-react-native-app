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
