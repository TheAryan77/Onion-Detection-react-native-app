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
