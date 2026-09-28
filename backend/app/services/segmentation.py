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
    # Two overlapping onions often still share one peak at 0.55, so raise the cut until they separate
    for frac in (0.55, 0.7, 0.8):
        _, sure_fg = cv2.threshold(dist, frac * dist.max(), 255, cv2.THRESH_BINARY)
        sure_fg = sure_fg.astype(np.uint8)
        n, markers = cv2.connectedComponents(sure_fg)
        if n > 2:  # background + two or more peaks
            break
    else:
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
    # A sprout or a bump is not a second onion: every part must be a sizeable share of the blob
    total = float(np.count_nonzero(comp_mask))
    if len(parts) < 2 or min(cv2.contourArea(p) for p in parts) < 0.2 * total:
        return None
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
        if solidity < 0.95:  # concave outline → probably touching onions
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
