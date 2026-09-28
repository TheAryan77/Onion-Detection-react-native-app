import cv2
import numpy as np

from app.services.calibration import find_marker
from app.services.segmentation import segment_onions

BLUE, ONION, SPROUT = (170, 90, 30), (60, 40, 150), (60, 160, 90)  # BGR


def _sheet(h=600, w=800):
    return np.full((h, w, 3), BLUE, np.uint8)


def test_separate_onions_are_counted():
    img = _sheet()
    for x in (150, 400, 650):
        cv2.circle(img, (x, 300), 70, ONION, -1)
    assert len(segment_onions(img)) == 3


def test_touching_onions_are_split():
    img = _sheet()
    for x in (250, 380, 510):
        cv2.circle(img, (x, 300), 70, ONION, -1)
    assert len(segment_onions(img)) == 3


def test_elongated_onion_and_sprout_are_not_split():
    img = _sheet()
    cv2.ellipse(img, (250, 300), (70, 110), 30, 0, 360, ONION, -1)
    cv2.circle(img, (560, 330), 80, ONION, -1)
    cv2.ellipse(img, (560, 220), (12, 45), 0, 0, 360, SPROUT, -1)
    assert len(segment_onions(img)) == 2


def test_marker_gives_scale_and_is_not_an_onion():
    img = _sheet()
    dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    marker = cv2.aruco.generateImageMarker(dictionary, 0, 125)  # 50 mm at 2.5 px/mm
    img[40:205, 40:205] = 255
    img[60:185, 60:185] = cv2.cvtColor(marker, cv2.COLOR_GRAY2BGR)
    cv2.circle(img, (500, 300), 69, ONION, -1)  # 55 mm onion

    found = find_marker(img, 50)
    assert found is not None and abs(found["px_per_mm"] - 2.5) < 0.1
    blobs = segment_onions(img, exclude_polygon=found["polygon"])
    assert len(blobs) == 1
    assert abs(blobs[0]["short_side_px"] / found["px_per_mm"] - 55) < 3
