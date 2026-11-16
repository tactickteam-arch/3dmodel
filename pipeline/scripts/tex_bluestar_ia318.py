"""Textures for the Blue Star IA318EXU (E Series) 1.5 ton indoor unit.
Everything printed on the front is redrawn sharp, measured on Blue Star's own straight-on front image
(IA318EXU_GalleryImages01.png, 1200 x 1200; the unit spans cols 59..1142 and rows 410..776 for 931 x 315 mm,
so 1.1643 px per mm both ways):
  - the BLUE STAR badge: blue box cols 123..228, rows 485..506 (91.0 x 18.4 mm, its left edge 55.0 mm from the
    unit's left, its top 64.4 mm under the top). It is Blue Star's own logo (logos/bluestar.png), set on a
    thin white rim as on the photo.
  - the display: "24" in seven segments (each digit 13.7 x 24.1 mm, 2.1 mm strokes), a degree ring and a C,
    and a power icon, white, lit through the panel; cols 960..1016, rows 553..581.
usage: python tex_bluestar_ia318.py <logos dir> <out dir>
Writes into <out dir>/bluestar_ia318/: badge.jpg, display.png.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

LOGOS, OUT = sys.argv[1:3]
PRODUCT = "bluestar_ia318"


def save(img, name, quality=90):
    os.makedirs(os.path.join(OUT, PRODUCT), exist_ok=True)
    path = os.path.join(OUT, PRODUCT, name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(path, quality=quality, optimize=True, subsampling=0)
    else:
        img.save(path, optimize=True)
    print("wrote", path, img.size)


# ── the badge: the logo on a 0.5 mm white rim, 92.0 x 19.4 mm in all ──
BW, BH, RIM = 91.0, 18.4, 0.5               # mm
S = 11.0                                     # px per mm
logo = Image.open(os.path.join(LOGOS, "bluestar.png")).convert("RGBA")
W_PX, H_PX = round((BW + 2 * RIM) * S), round((BH + 2 * RIM) * S)
badge = Image.new("RGBA", (W_PX, H_PX), (246, 246, 248, 255))
lw, lh = round(BW * S), round(BH * S)
badge.alpha_composite(logo.resize((lw, lh), Image.LANCZOS), (round(RIM * S), round(RIM * S)))
save(badge, "badge.jpg")

# ── the display: drawn at 4x and reduced, white on transparent ──
# decal box in mm from the unit's left and top: x 770..826, y 119..151
X0, Y0, DW, DH = 770.0, 119.0, 56.0, 32.0
P = 16.0                                     # px per mm in the file
K = 4                                        # supersampling
big = Image.new("L", (round(DW * P * K), round(DH * P * K)), 0)
d = ImageDraw.Draw(big)
px = lambda x: (x - X0) * P * K
py = lambda y: (y - Y0) * P * K

T, GAP = 2.1, 0.45                           # stroke and the gap at each segment end (mm)


def seg(xa, ya, xb, yb):
    """a hexagonal segment from (xa, ya) to (xb, yb), mm, pointed ends"""
    h = T / 2
    if ya == yb:   # horizontal
        a, b = min(xa, xb) + GAP, max(xa, xb) - GAP
        pts = [(a, ya), (a + h, ya - h), (b - h, ya - h), (b, ya), (b - h, ya + h), (a + h, ya + h)]
    else:          # vertical
        a, b = min(ya, yb) + GAP, max(ya, yb) - GAP
        pts = [(xa, a), (xa + h, a + h), (xa + h, b - h), (xa, b), (xa - h, b - h), (xa - h, a + h)]
    d.polygon([(px(x), py(y)) for x, y in pts], fill=255)


def digit(ch, x0, x1, y0, y1):
    # segment centre lines sit half a stroke inside the digit's ink box
    a, b, c, e = x0 + T / 2, x1 - T / 2, y0 + T / 2, y1 - T / 2
    m = (y0 + y1) / 2
    L = {"a": (a, c, b, c), "b": (b, c, b, m), "c": (b, m, b, e), "d": (a, e, b, e),
         "e": (a, m, a, e), "f": (a, c, a, m), "g": (a, m, b, m)}
    for s in {"2": "abged", "4": "fgbc"}[ch]:
        seg(*L[s])


# ink boxes measured on the photo (mm from the unit's left and top)
digit("2", 773.9, 787.6, 122.8, 146.9)
digit("4", 792.8, 806.5, 122.8, 146.9)
# the degree ring: 3.8 mm across, 0.8 mm stroke, centred (811.2, 124.5)
def ring(cx, cy, r, t, gap_deg=0):
    box = (px(cx - r), py(cy - r), px(cx + r), py(cy + r))
    if gap_deg:
        d.arc(box, -90 + gap_deg / 2, 270 - gap_deg / 2, fill=255, width=round(t * P * K))
    else:
        d.ellipse(box, outline=255, width=round(t * P * K))


ring(811.2, 124.5, 1.9, 0.8)
# the C: ink 7.0 x 9.4 mm, 1.0 mm stroke, open to the right; its tips end at the ink's right edge, so the
# ellipse it is cut from reaches 1.5 mm past it (outer box 814.0..822.5 x 122.8..132.2)
cbox = (px(814.0), py(122.8), px(822.5), py(132.2))
d.arc(cbox, 42, 318, fill=255, width=round(1.0 * P * K))
# the power icon: a 7.7 mm ring open at the top, with its stem
ring(818.5, 143.0, 3.85, 1.0, gap_deg=70)
d.line((px(818.5), py(139.3), px(818.5), py(143.4)), fill=255, width=round(1.0 * P * K))

alpha = big.resize((round(DW * P), round(DH * P)), Image.LANCZOS)
disp = Image.new("RGBA", alpha.size, (250, 250, 252, 0))
disp.putalpha(alpha)
save(disp, "display.png")
