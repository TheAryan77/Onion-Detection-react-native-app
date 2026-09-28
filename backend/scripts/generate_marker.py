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
