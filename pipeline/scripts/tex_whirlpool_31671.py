"""Textures for the Whirlpool 360 Bloomwash Pro top-load washers, model code 31671 (8.5 kg, Midnight Grey).
tex_whirlpool_31688.py imports this file and runs it with the 31688's own photos and settings (10 kg, Graphite).

usage: python3 tex_whirlpool_31671.py <photos dir> <out dir> [--debug <dir>]
  photos:  whirlpool_31671/ (Whirlpool India's own gallery for 31671, 1200 x 1200; the label 1500 x 1500):
           top_open.jpg   the machine from above with the lid open: the control panel seen near its normal
                          (the panel's Whirlpool wordmark has the official mark's proportions in it, 3.0 : 1)
           label.jpg      Whirlpool's energy label published on 31671's page (0.0107 kWh/kg/cycle, 8.5 kg, VA I4 85 5S / 2025)
           back.jpg       the machine from behind: the black back, the drain hose, the inlet pipe, the cord and its plug
  writes <out dir>/whirlpool_31671/*, with rear_paths.json (the back's hose, pipe, cord and plug, for the builder)

The control panel is drawn new at 7.2 px/mm. Every word is set again in Avenir Next, fitted to the box the word has in
Whirlpool's photo, in the photo's own colour (white, the Eco Wash green, the heater orange), one type size for each group of
words (programmes, key names, step names, the bottom line) as the print has. Whirlpool publishes no manual or vector panel
drawing for these models, so each icon is traced on the photo: enlarged 16x, sharpened (Richardson-Lucy), thinned to its
centre line and drawn again as strokes at the line width measured on the photo (solid shapes stay solid); the spirals (the
Dry key, the Dry-level LEDs, Power Dry, Rinse+Dry), the Dynamix arrows and the heater's "!" are drawn as shapes fitted to
the photo's ink. The key outlines, the display window, the rules, the brackets and the LED dashes are drawn as shapes where
the photo has them. The Whirlpool wordmark is the official mark (pipeline/sources/logos/whirlpool.svg), white with its gold ring
as on the panel. The side relief, the drum and the impeller are drawn from the photos; the back is Whirlpool's rear photo
itself, with the parts modelled in 3D painted out.
"""
import json
import math
import os
import re
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BOLD, BOLDI, DEMI, MED, MEDI, REG = 0, 1, 2, 5, 6, 7
BASK = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
PX_MM = 7.2

# ── the 31671's settings (tex_whirlpool_31688.py passes its own) ──
CFG = {
    "slug": "whirlpool_31671",
    "photo": "top_open.jpg",
    # the panel face in the photo (its printed glass, between the arched top edge and the lid's edge), and its size in mm:
    # 842 photo px across 508 mm, and the photo is at true aspect there (the wordmark measures 3.0 : 1, as the official mark)
    "quad": [[183, 141], [1025, 141], [1025, 343], [183, 343]],
    "rect": (842, 202),
    "face_mm": (508, 122),
    "kg": "8.5 kg",
    "body": (70, 77, 86),          # Midnight Grey, sRGB: the same as the cabinet (0x464d56), so the side decal blends into it
    "label": "label.jpg",
    "map": None,                    # photo windows below are the 31671's own
}

# Windows round each element, in the rectified 31671 photo's px. ink_box() tightens each one to the ink inside it.
TEXTS = [
    ("P1 - Daily", (82, 54, 118, 67)), ("P2 - Heavy", (82, 68, 122, 81)), ("P3 - Delicate", (82, 82, 128, 95)), ("P4 - Whites", (82, 96, 124, 109)),
    ("P5 - Stainwash", (156, 54, 208, 67)), ("P6 - Anti - Bac", (156, 68, 208, 81)), ("P7 - Woollens", (156, 82, 208, 95)), ("P8 - Bedsheet", (156, 96, 208, 109)),
    ("P 9 - Eco Wash", (236, 54, 292, 67)), ("P10 - Rinse+Dry", (236, 68, 292, 81)), ("P11 - Dry Only", (236, 82, 292, 95)), ("P12- Wash Only", (236, 96, 292, 109)),
    ("Check\nWater", (320, 47, 344, 62)), ("Voltage\nFluctuation", (345, 47, 381, 62)),
    ("Soak", (321, 85, 343, 96)), ("Wash", (350, 85, 374, 96)), ("Rinse", (380, 85, 404, 96)), ("Dry", (412, 85, 431, 96)),
    ("HR", (329, 118, 341, 130)), ("MIN", (396, 118, 411, 130)), ("Time Remaining", (339, 140, 401, 153)),
    ("Power", (171, 141, 203, 154)), ("Program", (212, 141, 250, 154)), ("Start / Pause", (252, 141, 300, 154)),
    ("Dynamix", (176, 178, 213, 193)), ("Zero Pressure Fill Technology", (259, 178, 352, 193)), ("Power Dry Technology", (395, 178, 474, 193)),
    ("In Built Heater", (514, 178, 566, 193)),
    ("Express Wash", (443, 55, 501, 68)), ("Dry", (510, 55, 531, 68)), ("Child\nLock", (471, 96, 490, 111)),
    ("Gentle", (540, 84, 561, 96)), ("Normal", (567, 84, 590, 96)), ("Extra", (596, 84, 614, 96)), ("Power Dry", (619, 84, 649, 96)),
    ("Auto fill", (417, 113, 441, 125)), ("Manual\n(10 levels)", (415, 126, 442, 144)),
    ("Water Level", (446, 141, 492, 154)), ("Hard Water\nWash", (498, 141, 543, 163)), ("Hot Wash", (565, 141, 604, 154)),
    ("Warm", (603, 128, 623, 140)), ("Hot", (627, 128, 643, 140)), ("Allergen\nFree", (643, 126, 671, 145)),
]
BOLD_TEXTS = {"KG": (599, 171, 654, 194)}
ICONS = [
    (62, 53, 80, 68), (62, 67, 80, 82), (62, 81, 80, 96), (62, 95, 80, 110),
    (138, 53, 155, 68), (138, 67, 155, 82), (138, 81, 155, 96), (138, 95, 155, 110),
    (218, 53, 234, 68), (218, 67, 234, 82), (218, 81, 234, 96), (218, 95, 234, 110),
    (324, 62, 341, 74), (353, 62, 368, 74),
    (159, 177, 175, 193), (243, 177, 259, 193), (378, 177, 395, 193), (503, 177, 513, 193),
    (542, 59, 560, 72.5), (568, 59, 586, 72.5), (595, 59, 613, 72.5), (621, 59, 639, 72.5),
]
BUTTONS = [  # outer window, the key's outline colour, how its icon is drawn (the icon is white on every key, the Hot Wash too)
    ((165, 112, 208, 143), "white", "strokes"), ((209, 112, 252, 143), "white", "strokes"), ((253, 112, 297, 143), "white", "strokes"),
    ((448, 69, 487, 97), "white", "solid"), ((500, 69, 539, 97), "white", "spiral"),   # Express Wash: a solid runner
    # Water Level: the window starts at 450, clear of the Auto fill bracket at x 448 (it had joined the key's outline)
    ((450, 111, 488, 140), "white", "strokes"), ((500, 111, 539, 140), "white", "strokes"), ((565, 111, 604, 140), "orange", "strokes"),
]
# the spiral icons among ICONS (the Power Dry Technology mark, P11 Dry Only, the four Dry levels), the Dynamix arrows and the
# heater's "!": drawn as fitted vector shapes (see spiral, dynamix, bang)
SPIRALS = {(218, 81, 234, 96), (378, 177, 395, 193), (542, 59, 560, 72.5), (568, 59, 586, 72.5), (595, 59, 613, 72.5), (621, 59, 639, 72.5)}
DYNAMIX, HEATER = (159, 177, 175, 193), (503, 177, 513, 193)
SOLID = {(138, 53, 155, 68)}            # P5 Stainwash: a solid shirt with its stains as holes, as the photo shows
LINE_ONLY = set()
# P10 Rinse+Dry is 11 x 7 px in the photo, its drops touching the disc: traced whole, with a lower ink level (the drops are dim)
P10 = (218, 67, 234, 82)
# the words in groups that share one type size on the panel (each word's height in the photo is only 4-8 px, so one px of
# rounding made words of one column 5 to 7 px tall; the group's median sets the size, each word keeps its own width)
GROUPS = {
    "prog": {t for t, _ in TEXTS if re.match(r"P ?\d", t)},   # P1 to P12
    "key": {"Power", "Program", "Start / Pause", "Time Remaining", "Water Level", "Hard Water\nWash", "Hot Wash", "Express Wash"},
    "bottom": {"Dynamix", "Zero Pressure Fill Technology", "Power Dry Technology", "In Built Heater"},
}
DISPLAY = (341, 106, 397, 139)
LOGO = (668, 44, 782, 87)
SIXTH = {"6": (74, 156, 101, 184.5), "th": (94, 158.5, 103, 163.5), "sense": (73, 184.5, 105, 194)}   # "th" exact (it touches the 6)
B360 = {"flower": (692, 135, 735, 171), "360": (737, 140, 776.5, 159), "deg": (775, 138, 782, 146), "BLOOMWASH": (736, 161, 779, 167),
        "rule": (737, 168, 778, 169), "PRO": (760, 169, 778, 175)}   # 360 and BLOOMWASH: exact boxes, the ring overlaps the 0
LEFTOVER_REGION = (40, 40, 800, 199)

WHITE = (232, 232, 232)

# ── redrawing the photo's icons sharp (look pass, 5 Nov 2026) ──
# Whirlpool publishes no manual or panel drawing for these models, so the icons can only come from the photo, where each one
# is 9 to 15 px across (1.66 px/mm). Each is traced on the photo at 16 px per photo px after a deconvolution of the photo's
# blur, thinned to its centre lines, and drawn again as clean strokes of one width (the width measured on the photo); parts
# that are solid in the photo (dots, petals) stay solid. The disc icons that are spirals (Dry, the four Dry levels, Dry Only,
# Power Dry), the Dynamix arrows and the heater's "!" are drawn as vector shapes fitted to the photo's ink (centre, radius,
# tail), since a trace of 9 px discs cannot hold their lines.
K_UP = 16      # trace resolution, px per rectified photo px
SS = 4         # supersampling of the texture when drawing


def thin(m):
    """Zhang-Suen thinning of a bool mask: its strokes' centre lines, one px wide"""
    img = m.astype(np.uint8).copy()
    while True:
        changed = False
        for step in (0, 1):
            P = np.pad(img, 1)
            p2, p3, p4, p5 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:]
            p6, p7, p8, p9 = P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            B = sum(x.astype(np.int16) for x in nb[:8])
            A = sum(((nb[i] == 0) & (nb[i + 1] == 1)).astype(np.int16) for i in range(8))
            c = (((p2 * p4 * p6) == 0) & ((p4 * p6 * p8) == 0)) if step == 0 else (((p2 * p4 * p8) == 0) & ((p2 * p6 * p8) == 0))
            kill = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if kill.any():
                img[kill] = 0
                changed = True
        if not changed:
            return img.astype(bool)


def disc_kernel(r):
    r = max(1, int(round(r)))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def deblur(img, sig, it=12):
    """Richardson-Lucy with a Gaussian blur: the photo's thin strokes and the gaps between them come back"""
    est = img.copy()
    for _ in range(it):
        est = est * cv2.GaussianBlur(img / (cv2.GaussianBlur(est, (0, 0), sig) + 1e-3), (0, 0), sig)
    return est


class Pen:
    """vector shapes in the rectified photo's px, drawn on a canvas in texture px x SS (see Panel.vec)"""
    def __init__(self, draw, P, scale):
        self.d, self.P, self.s = draw, P, scale

    def disc(self, x, y, r):
        (a, b), rr = self.P(x, y), r * self.s
        self.d.ellipse([a - rr, b - rr, a + rr, b + rr], fill=255)

    def line(self, pts, w, closed=False):
        pts = list(pts) + ([pts[0]] if closed else [])
        q = [self.P(x, y) for x, y in pts]
        for p0, p1 in zip(q, q[1:]):
            self.d.line([p0, p1], fill=255, width=max(1, int(round(w * self.s))))
        for x, y in pts:
            self.disc(x, y, w / 2)

    def poly(self, pts):
        self.d.polygon([self.P(x, y) for x, y in pts], fill=255)

    def arc(self, cx, cy, r, a0, a1, w, n=None):
        n = n or max(8, int(abs(a1 - a0) / 4))
        self.line([(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)], w)


class Panel:
    def __init__(self, cfg, photos, debug=None):
        self.cfg, self.debug = cfg, debug
        src = os.path.join(photos, cfg.get("photo_slug", cfg["slug"]), cfg["photo"])
        im = cv2.imread(src).astype(np.float32)[..., ::-1]
        W, H = cfg["rect"]
        M = cv2.getPerspectiveTransform(np.float32(cfg["quad"]), np.float32([[0, 0], [W, 0], [W, H], [0, H]]))
        self.pan = cv2.warpPerspective(im, M, (W, H), flags=cv2.INTER_CUBIC)
        self.lum = self.pan.mean(2)
        self.sat = self.pan.max(2) - self.pan.min(2)
        self.S = PX_MM * cfg["face_mm"][0] / W                 # texture px per rectified photo px
        self.Sx = self.Sy = self.S
        self.ox = self.oy = 0.0
        if cfg.get("place"):   # the print drawn from another photo of the same print, placed by (ax, bx, ay, by) into this panel
            ax, bx, ay, by = cfg["place"]["map"]
            St = PX_MM * cfg["face_mm"][0] / cfg["place"]["rect_w"]
            self.Sx, self.Sy, self.ox, self.oy = ax * St, ay * St, bx * St, by * St
        self.TW, self.TH = int(round(PX_MM * cfg["face_mm"][0])), int(round(PX_MM * cfg["face_mm"][1]))
        rng = np.random.default_rng(31671)
        self.canvas = np.zeros((self.TH, self.TW, 3), np.float32)
        self.canvas[...] = (10, 10, 12)
        self.canvas += rng.normal(0, 0.5, (self.TH, self.TW, 1))
        self.used = np.zeros((H, W), bool)
        self.m = cfg.get("map")       # (ax, bx, ay, by): 31671 window px -> this photo's px

    def win(self, w, pad=0):
        x0, y0, x1, y1 = w
        if self.m:
            ax, bx, ay, by = self.m
            x0, x1, y0, y1 = ax * x0 + bx, ax * x1 + bx, ay * y0 + by, ay * y1 + by
        H, W = self.lum.shape
        return (max(0, int(math.floor(x0)) - pad), max(0, int(math.floor(y0)) - pad), min(W, int(math.ceil(x1)) + pad), min(H, int(math.ceil(y1)) + pad))

    def ink(self, x0, y0, x1, y1, thr=None):
        L, C = self.lum[y0:y1, x0:x1], self.sat[y0:y1, x0:x1]
        t = thr if thr is not None else max(48.0, 0.42 * L.max())
        return (L > t) | ((C > 70) & (L > 40))

    def ink_box(self, w, thr=None):
        x0, y0, x1, y1 = self.win(w)
        m = self.ink(x0, y0, x1, y1, thr)
        ys, xs = np.where(m)
        if not len(xs):
            raise SystemExit(f"no ink in {w} -> {(x0, y0, x1, y1)}")
        self.used[y0:y1, x0:x1] = True
        return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)

    def colour(self, w):
        x0, y0, x1, y1 = self.win(w)
        px = self.pan[y0:y1, x0:x1].reshape(-1, 3)
        L = px.mean(1)
        c = px[L >= np.percentile(L, 97)].mean(0)
        if c.max() - c.min() < 40:            # white print: the photo dims thin strokes, so set it at the panel's white
            return WHITE
        return tuple(float(v) for v in c)

    def T(self, x, y):
        return (x * self.Sx + self.ox, y * self.Sy + self.oy)

    def put(self, alpha, colour, x0, y0):
        c = self.canvas
        h, w = alpha.shape
        xs0, ys0 = max(0, x0), max(0, y0)
        xs1, ys1 = min(c.shape[1], x0 + w), min(c.shape[0], y0 + h)
        if xs1 <= xs0 or ys1 <= ys0:
            return
        a = alpha[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
        c[ys0:ys1, xs0:xs1] = c[ys0:ys1, xs0:xs1] * (1 - a) + np.array(colour, np.float32) * a

    def fit(self, alpha, box):
        x0, y0, x1, y1 = box
        tw, th = int(round((x1 - x0) * self.Sx)), int(round((y1 - y0) * self.Sy))
        a = cv2.resize(alpha, (max(1, tw), max(1, th)), interpolation=cv2.INTER_AREA)
        tx, ty = self.T(x0, y0)
        return a, int(round(tx)), int(round(ty))

    @staticmethod
    def render(text, face=MED, font=AVENIR, px=200, line_gap=0.18):
        """the text's alpha, cropped to its ink; lines are centred under each other"""
        lines = text.split("\n")
        f = ImageFont.truetype(font, px, index=face)
        img = Image.new("L", (int(px * 0.75 * max(len(l) for l in lines) + px * 2), int(px * (1.5 + (1 + line_gap) * len(lines)))), 0)
        d = ImageDraw.Draw(img)
        for i, l in enumerate(lines):
            d.text((img.width / 2, px * (1.2 + (1 + line_gap) * i)), l, font=f, fill=255, anchor="ms")
        a = np.asarray(img).astype(np.float32) / 255
        ys, xs = np.where(a > 0.02)
        return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

    def word(self, text, w, face=DEMI, colour=None, font=AVENIR):
        box = self.ink_box(w)
        col = colour or self.colour(w)
        a, tx, ty = self.fit(self.render(text, face, font), box)
        self.put(a, col, tx, ty)
        return box

    def ink_box_sub(self, w, k=4):
        """the word's ink box to a quarter px: the edge where the ink crosses half its level, on a 4x upsample"""
        x0, y0, x1, y1 = self.ink_box(w)
        X0, Y0 = x0 - 2, y0 - 2
        pa = self.lum[Y0:y1 + 2, X0:x1 + 2]
        bg = np.median(np.concatenate([pa[0], pa[-1], pa[:, 0], pa[:, -1]]))
        up = cv2.resize(pa, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
        m = up > bg + 0.5 * (np.percentile(up, 99) - bg)
        ys, xs = np.where(m)
        return (X0 + xs.min() / k, Y0 + ys.min() / k, X0 + (xs.max() + 1) / k, Y0 + (ys.max() + 1) / k)

    @staticmethod
    def group_of(text, w):
        if "\n" in text:
            return None                          # two-line words fit their own box
        if text == "Dry":
            return "key" if w[1] < 70 else "step"   # the Dry key's title; the Dry step under the rule
        for g, names in GROUPS.items():
            if text in names:
                return g
        return "step" if text in ("Soak", "Wash", "Rinse") else "tiny"

    def words(self, items):
        """every word set again in Avenir Next: one type size per group (the group's median of box height over the word's
        natural height), each word's own width (within 12% of its natural width at that size; Avenir is not Whirlpool's face),
        centred on its box in the photo"""
        meas = []
        for text, w, face, colour in items:
            col = colour or self.colour(w)
            box = self.ink_box_sub(w)
            a = self.render(text, face)
            meas.append((text, w, a, box, col, self.group_of(text, w)))
        scale = {}
        for g in {m[5] for m in meas if m[5]}:
            scale[g] = float(np.median([(b[3] - b[1]) / a.shape[0] for t, w, a, b, c, gg in meas if gg == g]))
        for text, w, a, (x0, y0, x1, y1), col, g in meas:
            sy = scale[g] if g else (y1 - y0) / a.shape[0]
            sx = float(np.clip((x1 - x0) / a.shape[1], 0.88 * sy, 1.12 * sy))
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            hw, hh = a.shape[1] * sx / 2, a.shape[0] * sy / 2
            tx0, ty0 = self.T(cx - hw, cy - hh)
            tx1, ty1 = self.T(cx + hw, cy + hh)
            # rendered at SS x on the texture's own px grid, so the word sits to a quarter of a texture px
            ix0, iy0 = int(math.floor(tx0)), int(math.floor(ty0))
            W, H = int(math.ceil(tx1)) + 1 - ix0, int(math.ceil(ty1)) + 1 - iy0
            M = np.float32([[(tx1 - tx0) * SS / a.shape[1], 0, (tx0 - ix0) * SS], [0, (ty1 - ty0) * SS / a.shape[0], (ty0 - iy0) * SS]])
            can = cv2.warpAffine(a, M, (W * SS, H * SS), flags=cv2.INTER_AREA)
            self.put(cv2.resize(can, (W, H), interpolation=cv2.INTER_AREA), col, ix0, iy0)
            print(f"  {text!r:30} {g or '-':6} h {(y1 - y0):.2f} px  set at {a.shape[0] * sy:.2f}")

    def icon(self, w, colour=None, thr=None):
        box = self.ink_box(w, thr)
        self.strokes(box, colour or self.colour(w), fill=w not in LINE_ONLY, solid=w in SOLID)
        return box

    # -- drawing in texture space --
    def place(self, alpha, X0, Y0, K, colour):
        """an alpha array at K px per photo px, whose pixel (0, 0) starts at photo (X0, Y0), drawn into the texture"""
        h, w = alpha.shape
        tx0, ty0 = [int(math.floor(v)) - 1 for v in self.T(X0, Y0)]
        tx1, ty1 = [int(math.ceil(v)) + 1 for v in self.T(X0 + w / K, Y0 + h / K)]
        W, H = (tx1 - tx0) * SS, (ty1 - ty0) * SS
        ax, ay = SS * self.Sx / K, SS * self.Sy / K
        bx = SS * ((X0 + 0.5 / K) * self.Sx + self.ox - tx0) - 0.5
        by = SS * ((Y0 + 0.5 / K) * self.Sy + self.oy - ty0) - 0.5
        can = cv2.warpAffine(alpha.astype(np.float32), np.float32([[ax, 0, bx], [0, ay, by]]), (W, H), flags=cv2.INTER_LINEAR)
        self.put(cv2.resize(can, (W // SS, H // SS), interpolation=cv2.INTER_AREA), colour, tx0, ty0)

    def vec(self, box, colour, fn):
        """fn(Pen) draws vector shapes given in this photo's px inside box; rendered at SS x the texture"""
        x0, y0, x1, y1 = box
        tx0, ty0 = [int(math.floor(v)) - 1 for v in self.T(x0, y0)]
        tx1, ty1 = [int(math.ceil(v)) + 1 for v in self.T(x1, y1)]
        img = Image.new("L", ((tx1 - tx0) * SS, (ty1 - ty0) * SS), 0)
        def P(x, y):
            tx, ty = self.T(x, y)
            return ((tx - tx0) * SS, (ty - ty0) * SS)
        fn(Pen(ImageDraw.Draw(img), P, SS * (self.Sx + self.Sy) / 2))
        a = cv2.resize(np.asarray(img, np.float32) / 255, (tx1 - tx0, ty1 - ty0), interpolation=cv2.INTER_AREA)
        self.put(a, colour, tx0, ty0)

    def _ink_up(self, box, K, only=None, m=3, it=12):
        """the box's ink above its border's level, upsampled K x and deblurred; pixel (0, 0) is photo (x0 - m, y0 - m)"""
        x0, y0, x1, y1 = box
        X0, Y0 = x0 - m, y0 - m
        pa = self.lum[Y0:y1 + m, X0:x1 + m].copy()
        bg = np.median(np.concatenate([pa[0], pa[-1], pa[:, 0], pa[:, -1]]))
        ink = np.clip(pa - bg, 0, None)
        keep = np.zeros_like(ink, bool)
        keep[m - 1:1 - m, m - 1:1 - m] = True    # the box and the edge of its ink's blur
        if only is not None:
            keep &= only
        ink[~keep] = 0
        up = cv2.resize(ink, None, fx=K, fy=K, interpolation=cv2.INTER_CUBIC).clip(0, None) + 0.5
        return (deblur(up, 0.6 * K, it) if it else up), X0, Y0

    def strokes(self, box, colour, w=None, only=None, fill=True, solid=False):
        """the photo's ink in box (this photo's px) redrawn sharp: traced, thinned to its centre lines and drawn again as clean
        strokes of one width (the stroke's own width on the photo, 0.9-1.35 px); parts clearly wider than a stroke stay solid"""
        K = K_UP
        d, X0, Y0 = self._ink_up(box, K, only, it=0 if solid else 12)
        pk = np.percentile(d[d > 0.3 * d.max()], 80)
        mask = cv2.GaussianBlur((d > 0.36 * pk).astype(np.float32), (0, 0), 0.25 * K) > 0.5
        half = cv2.GaussianBlur((d > 0.5 * pk).astype(np.float32), (0, 0), 0.25 * K) > 0.5
        if solid:   # a filled shape with holes (P5's shirt and its stains, the runner): its outline at half level on the photo (no deblur, which breaks a filled shape into rings), smoothed
            out = cv2.GaussianBlur(half.astype(np.float32), (0, 0), 0.2 * K) > 0.5
            self.place(out.astype(np.float32), X0, Y0, K, colour)
            return None
        sk = thin(mask)
        n, lab, st, _ = cv2.connectedComponentsWithStats(sk.astype(np.uint8), connectivity=8)
        for i in range(1, n):   # specks of skeleton: noise
            if st[i, 4] < 0.6 * K:
                sk[lab == i] = False
        dt = cv2.distanceTransform(half.astype(np.uint8), cv2.DIST_L2, 5)
        if w is None:
            w = float(np.clip(2 * np.median(dt[sk & half]) / K, 0.9, 1.35)) if (sk & half).any() else 1.1
        r = 0.5 * w * K
        out = cv2.dilate(sk.astype(np.uint8), disc_kernel(r)).astype(bool)
        if fill:
            core = cv2.distanceTransform(mask.astype(np.uint8), cv2.DIST_L2, 5) > 1.45 * r
            out |= cv2.dilate(core.astype(np.uint8), disc_kernel(1.45 * r)).astype(bool) & mask
        out = cv2.GaussianBlur(out.astype(np.float32), (0, 0), 0.12 * K) > 0.5
        self.place(out.astype(np.float32), X0, Y0, K, colour)
        return w

    def _disc_fit(self, box, K=8):
        """a disc icon's centre and radius (photo px) from its ink: the vertical extent (the tail sticks out to the right)"""
        d, X0, Y0 = self._ink_up(box, K)
        m = d > 0.4 * np.percentile(d[d > 0.3 * d.max()], 80)
        n, lab, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8))
        big = 1 + np.argmax(st[1:, 4])
        ys, xs = np.where(lab == big)
        y0, y1 = ys.min() / K, (ys.max() + 1) / K
        r = (y1 - y0) / 2
        cy = Y0 + y0 + r
        cx = X0 + xs.min() / K + r
        dd = np.hypot(X0 + (xs + 0.5) / K - cx, Y0 + (ys + 0.5) / K - cy)
        j = np.argmax(dd)
        tail = (X0 + (xs[j] + 0.5) / K, Y0 + (ys[j] + 0.5) / K)
        return cx, cy, r, tail

    def spiral(self, box, colour=WHITE, w=1.05, pitch=1.5):
        """a drying spiral: from a small hole at the centre out to the disc's edge, then out to the tail, as the photo shows"""
        cx, cy, r, (tx, ty) = self._disc_fit(box)
        rin, rout = 0.95, r - w / 2
        at = math.degrees(math.atan2(ty - cy, tx - cx))
        a1 = at - 50
        turns = (rout - rin) / pitch
        a0 = a1 - 360 * turns
        n = int(turns * 72)
        pts = [(cx + (rin + (rout - rin) * i / n) * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
                cy + (rin + (rout - rin) * i / n) * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
        tr = math.hypot(tx - cx, ty - cy) - w / 2
        if tr > rout + 0.4:   # the tail: the last turn leaves the disc toward the photo's tail end
            pts += [(cx + (rout + (tr - rout) * t * t) * math.cos(math.radians(a1 + 50 * t)), cy + (rout + (tr - rout) * t * t) * math.sin(math.radians(a1 + 50 * t))) for t in np.linspace(0.1, 1, 8)]
        self.vec((cx - r - 2, cy - r - 2, cx + r + 4, cy + r + 2), colour, lambda p: p.line(pts, w))

    def dynamix(self, box, colour=WHITE, w=1.25):
        """two arcs round a circle, each ending in an arrowhead, the gaps at the left and right (the photo's ring)"""
        cx, cy, r, _ = self._disc_fit(box)
        rc = r - w / 2
        def draw(p):
            for a0, a1 in ((200, 335), (20, 155)):
                p.arc(cx, cy, rc, a0, a1, w)
                e = math.radians(a1)
                ex, ey = cx + rc * math.cos(e), cy + rc * math.sin(e)
                tx, ty = -math.sin(e), math.cos(e)            # the direction of travel at the end
                nx, ny = math.cos(e), math.sin(e)
                h, b = 1.5 * w, 1.15 * w
                p.poly([(ex + tx * h, ey + ty * h), (ex + nx * b, ey + ny * b), (ex - nx * b, ey - ny * b)])
        self.vec((cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2), colour, draw)

    def bang(self, box, colour, K=8):
        """an exclamation mark: the bar (wider at the top, as in the photo) and the dot, each measured on the photo's ink"""
        d, X0, Y0 = self._ink_up(box, K)
        m = d > 0.45 * np.percentile(d[d > 0.3 * d.max()], 80)
        n, lab, st, cen = cv2.connectedComponentsWithStats(m.astype(np.uint8))
        comps = sorted(range(1, n), key=lambda i: -st[i, 4])[:2]
        bar, dot = sorted(comps, key=lambda i: st[i, 1])
        ys, xs = np.where(lab == bar)
        top, bot = ys.min(), ys.max()
        def row(y):
            r = xs[np.abs(ys - y) <= K // 2]
            return X0 + (r.min() + r.max() + 1) / 2 / K, (r.max() + 1 - r.min()) / K
        (xt, wt), (xb, wb) = row(top + K * 0.6), row(bot - K * 0.6)
        yt, yb = Y0 + top / K + wt / 2, Y0 + (bot + 1) / K - wb / 2
        dx, dy = X0 + (cen[dot][0] + 0.5) / K, Y0 + (cen[dot][1] + 0.5) / K
        dr = math.sqrt(st[dot, 4] / math.pi) / K
        def draw(p):
            p.poly([(xt - wt / 2, yt), (xt + wt / 2, yt), (xb + wb / 2, yb), (xb - wb / 2, yb)])
            p.disc(xt, yt, wt / 2)
            p.disc(xb, yb, wb / 2)
            p.disc(dx, dy, dr)
        x0, y0, x1, y1 = box
        self.vec((x0 - 2, y0 - 2, x1 + 2, y1 + 2), colour, draw)

    def shape(self, draw_fn, box, colour, pad=2):
        """draw a vector shape (PIL, at 4x) over a photo box"""
        x0, y0, x1, y1 = box
        k = 4
        W, H = int((x1 - x0 + 2 * pad) * self.Sx * k), int((y1 - y0 + 2 * pad) * self.Sy * k)
        img = Image.new("L", (W, int((y1 - y0 + 2 * pad) * self.Sx * k)), 0)       # drawn at the x scale, then fitted to y
        draw_fn(ImageDraw.Draw(img), pad * self.Sx * k, self.Sx * k)
        a = cv2.resize(np.asarray(img).astype(np.float32) / 255, (W // k, H // k), interpolation=cv2.INTER_AREA)
        tx, ty = self.T(x0 - pad, y0 - pad)
        self.put(a, colour, int(round(tx)), int(round(ty)))

    def button(self, w, key, kind="strokes"):
        """a key's rounded outline: its box is where the ink runs most of the window's height and width (the key's own sides),
        so the rules joined to it are left for the leftover pass"""
        wx0, wy0, wx1, wy1 = self.win(w)
        m = self.ink(wx0, wy0, wx1, wy1, thr=60)
        cs, rs = m.sum(0), m.sum(1)
        xs, ys = np.where(cs >= 0.6 * cs.max())[0], np.where(rs >= 0.6 * rs.max())[0]
        box = (wx0 + xs.min(), wy0 + ys.min(), wx0 + xs.max() + 1, wy0 + ys.max() + 1)
        bx0, by0, bx1, by1 = box
        self.used[by0:by1, bx0:bx1] = True
        x0, y0, x1, y1 = box
        col = (240, 150, 30) if key == "orange" else WHITE
        lw = 1.15
        self.shape(lambda d, o, s: d.rounded_rectangle([o, o, o + (x1 - x0) * s, o + (y1 - y0) * s], radius=1.6 * s, outline=255, width=int(lw * s)), box, col)
        # the icon inside, white on every key (the Hot Wash key's outline is orange, its icon white, as in the photo)
        inner = (x0 + 3, y0 + 3, x1 - 3, y1 - 3)
        m = self.ink(*inner)
        ys, xs = np.where(m)
        ib = (inner[0] + xs.min(), inner[1] + ys.min(), inner[0] + xs.max() + 1, inner[1] + ys.max() + 1)
        if kind == "spiral":
            self.spiral(ib)
        else:
            self.strokes(ib, WHITE, solid=kind == "solid")
        return box

    def leftovers(self, region):
        """lines, rules, brackets, separators and LED dashes: every piece of ink not in a window, drawn as a clean shape"""
        x0, y0, x1, y1 = self.win(region)
        m = self.ink(x0, y0, x1, y1, thr=38) & ~cv2.dilate(self.used[y0:y1, x0:x1].astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
        drawn = 0
        for i in range(1, n):
            bx, by, bw, bh, ar = st[i]
            if ar < 2:
                continue
            sel = lab == i
            L = self.lum[y0:y1, x0:x1]
            px = self.pan[y0:y1, x0:x1][sel]
            col = px[px.mean(1) >= np.percentile(px.mean(1), 70)].mean(0)
            col = tuple(float(v) for v in (col * 1.15).clip(0, 255))
            gx0, gy0 = x0 + bx, y0 + by
            if (bh <= 3 and bw >= 3 or bw <= 3 and bh >= 3 or ar <= 8) and ar >= 0.6 * bw * bh or ar <= 8:
                # a rule or a dash: its weighted extent, drawn as a crisp bar
                wgt = np.clip((L - 20) / 80, 0, 1) * sel
                cols, rows = wgt.sum(0), wgt.sum(1)
                if bh <= 3 and bw > bh:
                    cy = (rows * np.arange(len(rows))).sum() / rows.sum()
                    th = max(0.8, min(1.6, wgt.sum() / max(1, bw)))
                    box = (gx0, y0 + cy - th / 2 + 0.5, gx0 + bw, y0 + cy + th / 2 + 0.5)
                elif bw <= 3 and bh > bw:
                    cx = (cols * np.arange(len(cols))).sum() / cols.sum()
                    tw = max(0.8, min(1.6, wgt.sum() / max(1, bh)))
                    box = (x0 + cx - tw / 2 + 0.5, gy0, x0 + cx + tw / 2 + 0.5, gy0 + bh)
                else:
                    box = (gx0, gy0, gx0 + bw, gy0 + bh)
                bx0, by0, bx1, by1 = box
                self.shape(lambda d, o, s: d.rectangle([o, o, o + (bx1 - bx0) * s, o + (by1 - by0) * s], fill=255), box, col, pad=1)
            else:
                # brackets and corners: the piece traced and drawn again as clean strokes (only this piece's ink)
                only = cv2.dilate(np.pad(sel[by:by + bh, bx:bx + bw], 3).astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
                self.strokes((gx0, gy0, gx0 + bw, gy0 + bh), col, w=1.1, only=only, fill=False)
            drawn += 1
        print("leftover pieces drawn:", drawn)

    def display(self, w):
        x0, y0, x1, y1 = self.win(w)
        m = (self.lum[y0:y1, x0:x1] > 32) & (self.lum[y0:y1, x0:x1] < 90)
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)).astype(bool)
        ys, xs = np.where(m)
        box = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
        col = tuple(float(v) for v in np.median(self.pan[y0:y1, x0:x1][m], 0))
        bx0, by0, bx1, by1 = box
        self.shape(lambda d, o, s: d.rounded_rectangle([o, o, o + (bx1 - bx0) * s, o + (by1 - by0) * s], radius=1.2 * s, fill=255), box, col)
        self.used[y0:y1, x0:x1] = True

    def logo(self, w, svg):
        box = self.ink_box(w, thr=70)
        png = os.path.join(SITE, ".work", "whirlpool_tex", "logo_3000.png")
        os.makedirs(os.path.dirname(png), exist_ok=True)
        if not os.path.exists(png):
            subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"), svg, png, "3000"], check=True, capture_output=True)
        lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
        a = lg[..., 3] / 255
        rgb = lg[..., :3]
        gold = (rgb[..., 0] - rgb[..., 2]) > 60
        # drop the registered mark (the panel's print has none): keep columns left of the last gap
        cols = (a > 0.1).any(0)
        xs = np.where(cols)[0]
        gaps = np.where(np.diff(xs) > 8)[0]
        right = xs[gaps[-1]] + 1 if len(gaps) else xs[-1] + 1
        ys = np.where((a[:, :right] > 0.1).any(1))[0]
        a, gold = a[ys.min():ys.max() + 1, xs[0]:right], gold[ys.min():ys.max() + 1, xs[0]:right]
        ag = a * gold
        aw = a * ~gold
        for alpha, col in ((aw, WHITE), (ag, (214, 165, 52))):
            f, tx, ty = self.fit(alpha, box)
            self.put(f, col, tx, ty)

    def sixth(self):
        self.word("6", SIXTH["6"], face=2, font=BASK, colour=WHITE)
        a, tx, ty = self.fit(self.render("th", BOLDI), self.fixed(SIXTH["th"]))
        self.put(a, WHITE, tx, ty)
        self.word("sense", SIXTH["sense"], face=BOLDI, colour=WHITE)

    def fixed(self, w):
        """a box given exactly (where two pieces of ink overlap), mapped into this photo"""
        x0, y0, x1, y1 = w
        if self.m:
            ax, bx, ay, by = self.m
            x0, x1, y0, y1 = ax * x0 + bx, ax * x1 + bx, ay * y0 + by, ay * y1 + by
        self.used[int(y0):int(math.ceil(y1)), int(x0):int(math.ceil(x1))] = True
        return (x0, y0, x1, y1)

    def bloom(self):
        """the 360 Bloomwash Pro mark: the flower (the photo's ink), 360 and its degree ring, BLOOMWASH, the rule, the PRO tab"""
        self.icon(B360["flower"], colour=WHITE)
        a, tx, ty = self.fit(self.render("360", DEMI), self.fixed(B360["360"]))
        self.put(a, WHITE, tx, ty)
        b = self.fixed(B360["deg"])
        x0, y0, x1, y1 = b
        self.shape(lambda d, o, s: d.ellipse([o, o, o + (x1 - x0) * s, o + (y1 - y0) * s], outline=255, width=int(0.9 * s)), b, WHITE)
        a, tx, ty = self.fit(self.render("BLOOMWASH", DEMI), self.fixed(B360["BLOOMWASH"]))
        self.put(a, WHITE, tx, ty)
        b = self.fixed(B360["rule"])
        x0, y0, x1, y1 = b
        self.shape(lambda d, o, s: d.rectangle([o, o, o + (x1 - x0) * s, o + (y1 - y0) * s], fill=255), b, (200, 200, 202), pad=1)
        b = self.fixed(B360["PRO"])
        x0, y0, x1, y1 = b
        self.shape(lambda d, o, s: d.rounded_rectangle([o, o, o + (x1 - x0) * s, o + (y1 - y0) * s], radius=0.8 * s, fill=255), b, (176, 178, 182))
        inner = (x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.2, x1 - (x1 - x0) * 0.25, y1 - (y1 - y0) * 0.2)
        a, tx, ty = self.fit(self.render("PRO", DEMI), inner)
        self.put(a, (24, 24, 26), tx, ty)

    def draw(self):
        self.display(DISPLAY)
        self.words([(text, w, DEMI, None) for text, w in TEXTS])
        if self.cfg.get("kg_fixed"):   # the capacity's box measured on the model's own photo (the print drawn from another's)
            a, tx, ty = self.fit(self.render(self.cfg["kg"], BOLD), self.fixed(self.cfg["kg_fixed"]))
            self.put(a, WHITE, tx, ty)
        else:
            self.word(self.cfg["kg"], self.cfg.get("kg_box", BOLD_TEXTS["KG"]), face=BOLD, colour=WHITE)
        for w in ICONS:
            if w in SPIRALS:
                self.spiral(self.ink_box(w), self.colour(w))
            elif w == DYNAMIX:
                self.dynamix(self.ink_box(w), self.colour(w))
            elif w == HEATER:
                self.bang(self.ink_box(w), self.colour(w))
            elif w == P10:
                self.icon(w, thr=30)
            else:
                self.icon(w)
        for w, key, kind in BUTTONS:
            self.button(w, key, kind)
        self.logo(LOGO, os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"))
        self.sixth()
        self.bloom()
        self.leftovers(LEFTOVER_REGION)
        return Image.fromarray(self.canvas.clip(0, 255).astype(np.uint8))

    def debug_overlay(self, out):
        """the photo's windows and the boxes found, at 3x, for checking"""
        big = cv2.resize(self.pan, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC).clip(0, 255).astype(np.uint8).copy()
        def rect(w, c):
            x0, y0, x1, y1 = self.win(w)
            cv2.rectangle(big, (x0 * 3, y0 * 3), (x1 * 3, y1 * 3), c, 1)
        for _, w in TEXTS: rect(w, (0, 200, 255))
        for w in ICONS: rect(w, (255, 80, 80))
        for w, _, _ in BUTTONS: rect(w, (80, 255, 80))
        Image.fromarray(big).save(out)


# ───────────────────────── the other textures ─────────────────────────
def label(photos, cfg, out):
    """Whirlpool's own energy label, cut out of its white backdrop by the label's outline, quantised for the Apple file's size"""
    im = Image.open(os.path.join(photos, cfg["slug"], cfg["label"])).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    fg = (a.min(2) < 236).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
    big = 1 + np.argmax(st[1:, 4])
    m = (lab == big).astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(m)
    cv2.drawContours(filled, cnts, -1, 1, -1)
    x, y, w, h = cv2.boundingRect(filled)
    alpha = cv2.GaussianBlur((filled * 255).astype(np.float32), (0, 0), 0.8)
    rgba = np.dstack([np.asarray(im), alpha.clip(0, 255).astype(np.uint8)])[y:y + h, x:x + w]
    img = Image.fromarray(rgba, "RGBA")
    img = img.resize((int(img.width * 900 / img.height), 900), Image.LANCZOS)
    q = img.quantize(256, method=Image.Quantize.FASTOCTREE)
    q.save(os.path.join(out, "label.png"), optimize=True)
    print("wrote label.png", img.size, "aspect w/h", round(img.width / img.height, 4))


def relief_shade(height, base, strength, light=(-0.45, 0.6, 0.66)):
    """shades a height map (mm) lit from the upper front, onto a base colour"""
    gy, gx = np.gradient(height)
    n = np.dstack([-gx, gy, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    l = np.array(light) / np.linalg.norm(light)
    d = (n * l).sum(2) - l[2]
    shade = 1 + strength * d
    return (np.array(base, np.float32)[None, None, :] * shade[..., None]).clip(0, 255)


def side(cfg, out, rng):
    """The side panel's relief, from Whirlpool's 3/4 photos of both models (measured on 31688's three_quarter_left_low.jpg,
    the clearest, through a homography of the side face; the 31671's photos show the same moulding): a raised band in a G round
    the side (outer and inner rounded rectangles), its front arm broken round the handle pocket with rounded ends, a raised
    rounded square inside, and the pocket in the break. Seen from outside, the pocket is at the right-hand end on both sides
    (Whirlpool's photos: near the front on the left side, near the back on the right side), so it is one moulding used both ways
    round and both sides take this same texture. Drawn as a height map and shaded."""
    g = cfg["side"]
    D, Hs = g["d"], g["h"]                 # mm: the decal's width (front to back) and height
    k = 2.0                                # px per mm
    W, H = int(D * k), int(Hs * k)
    hgt = np.zeros((H, W), np.float32)
    def P(u, v):  # u: mm from the pocket's end, v: mm up from the decal's bottom -> px; the pocket's end is the texture's right
        return (int(round((D - u) * k)), int(round(H - v * k)))
    def rr(img, u0, v0, u1, v1, r, val, thick=-1):
        (xa, y1), (xb, y0) = P(u0, v0), P(u1, v1)
        x0, x1 = min(xa, xb), max(xa, xb)
        pil = Image.fromarray(img)
        d = ImageDraw.Draw(pil)
        d.rounded_rectangle([x0, y0, x1, y1], radius=int(r * k), fill=None if thick > 0 else val, outline=val if thick > 0 else None, width=int(thick * k) if thick > 0 else 0)
        return np.asarray(pil).copy()
    def disc(img, u, v, r, val):
        pil = Image.fromarray(img)
        x, y = P(u, v)
        ImageDraw.Draw(pil).ellipse([x - r * k, y - r * k, x + r * k, y + r * k], fill=val)
        return np.asarray(pil).copy()
    o, i = g["outer"], g["inner"]           # u0, v0, u1, v1, r (u from the pocket's end, v from the decal's bottom)
    band = rr(np.zeros((H, W), np.uint8), *o, 255)
    band = rr(band, *i, 0)
    # the break in the front arm round the pocket; each arm ends round
    lo, hi = g["gap"]                       # the lower arm's top and the upper arm's bottom
    r = (i[0] - o[0]) / 2
    um = o[0] + r
    band = rr(band, o[0] - 5, lo - r, i[0] + 1, hi + r, 0, 0)
    arm = np.zeros((H, W), np.uint8)
    arm = disc(arm, um, hi + r, r, 255)
    arm = disc(arm, um, lo - r, r, 255)
    band = np.maximum(band, arm)
    sq = rr(np.zeros((H, W), np.uint8), *g["square"], 255)
    hgt += cv2.GaussianBlur(band.astype(np.float32) / 255 * 2.5, (0, 0), 2.2 * k)
    hgt += cv2.GaussianBlur(sq.astype(np.float32) / 255 * 1.6, (0, 0), 2.2 * k)
    # handle pocket: a recess with a lip
    hu, hv, hw, hh = g["handle"]
    pocket = np.zeros((H, W), np.uint8)
    pocket = rr(pocket, hu - hw / 2, hv - hh / 2, hu + hw / 2, hv + hh / 2, 6, 255)
    hgt -= cv2.GaussianBlur(pocket.astype(np.float32) / 255 * 6, (0, 0), 1.0 * k)
    img = relief_shade(hgt, cfg["body"], g.get("strength", 0.9))
    # the pocket's dark gloss inside and its lighter rim (as in the photos)
    inner_p = rr(np.zeros((H, W), np.uint8), hu - hw / 2 + 4, hv - hh / 2 + 4, hu + hw / 2 - 4, hv + hh / 2 - 4, 4, 255).astype(np.float32) / 255
    inner_p = cv2.GaussianBlur(inner_p, (0, 0), 1.0)[..., None]
    grad = np.linspace(0.55, 0.2, H)[:, None, None]
    img = img * (1 - inner_p) + (np.array(cfg["body"], np.float32) * grad) * inner_p
    if g.get("rim"):   # a bright trim round the pocket (the 31688's photos show one)
        outer_p = rr(np.zeros((H, W), np.uint8), hu - hw / 2, hv - hh / 2, hu + hw / 2, hv + hh / 2, 6, 255).astype(np.float32) / 255
        ring = cv2.GaussianBlur(np.clip(outer_p - cv2.GaussianBlur(inner_p[..., 0], (0, 0), 0.1), 0, 1), (0, 0), 0.8)[..., None]
        shade = np.linspace(1.15, 0.7, H)[:, None, None]
        img = img * (1 - ring) + (np.array(g["rim"], np.float32) * shade) * ring
    img += rng.normal(0, 0.8, img.shape)
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    im = im.resize((1024, int(1024 * H / W)), Image.LANCZOS)
    im.save(os.path.join(out, "side.jpg"), quality=88, optimize=True)
    print("wrote side.jpg", im.size)


def to_m(r, px, py):
    """a pixel of the rear photo -> (x, y) in metres in the model (the photo is from behind, so its left is the machine's +x)"""
    return (-(px - r["cx"]) / r["ppm"][0] / 1000, (r["floor"] - py) / r["ppm"][1] / 1000)


def lay(pts, d, step=0.002, gap=0.02):
    """Lays a cord (a centre line in metres) on the back: each piece rests on the back or on any earlier piece it crosses,
    so the coil's strands stack where they cross instead of passing through each other. Returns [x, y, lift] (lift: metres
    from the back to the cord's centre)."""
    p = np.array(pts, float)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    s = np.arange(0, seg[-1], step)
    q = np.c_[np.interp(s, seg, p[:, 0]), np.interp(s, seg, p[:, 1])]
    z = np.full(len(q), d / 2)
    tg = np.gradient(q, axis=0)
    tg /= np.linalg.norm(tg, axis=1, keepdims=True)
    for i in range(len(q)):
        j = np.where(s < s[i] - gap)[0]
        if len(j):
            dist = np.hypot(*(q[j] - q[i]).T)
            # a real crossing (more than 25 degrees between the strands) rides over the strand below; strands running
            # side by side lie beside each other on the back, so only one almost on top of another is lifted, by half
            cross = np.abs((tg[j] * tg[i]).sum(1)) < math.cos(math.radians(25))
            near = (dist < d) & cross
            if near.any():
                z[i] = max(z[i], (z[j][near] + np.sqrt(d * d - dist[near] ** 2)).max())
            on = (dist < 0.5 * d) & ~cross
            if on.any():
                z[i] = max(z[i], (z[j][on] + 0.5 * d).max())
    # ease the steps: a running max, then a smooth, so a strand rises over a crossing and settles back
    k = int(0.012 / step)
    zz = np.array([z[max(0, i - k):i + k + 1].max() for i in range(len(z))])
    zz = np.convolve(np.pad(zz, k, mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="valid")
    zz = np.maximum(zz, z)
    keep = sorted(set(range(0, len(q), 3)) | {len(q) - 1})
    return [[round(q[i, 0], 4), round(q[i, 1], 4), round(zz[i], 4)] for i in keep]


def back(photos, cfg, out, rng):
    """The back, from Whirlpool's rear photo (back.jpg): the black moulded back as the photo shows it, from the plinth's foot
    up to the panel housing's top edge, with the drain hose, the inlet pipe, the cord and the plug painted out (they are
    modelled in 3D on the paths written to rear_paths.json). Outside the machine's outline (the top narrows) the edge colour
    is carried out, so the texture never shows the photo's white backdrop."""
    r = cfg["back"]
    im = cv2.imread(os.path.join(photos, cfg["slug"], r["photo"])).astype(np.float32)
    L = im.mean(2)
    mask = np.zeros(L.shape, np.uint8)
    for (x0, y0, x1, y1) in r["parts"]:            # the white parts lying over the back
        sub = (L[y0:y1, x0:x1] > 110).astype(np.uint8)
        mask[y0:y1, x0:x1] |= sub
    mask = cv2.dilate(mask, np.ones((11, 11), np.uint8))
    outside = (L > 200).astype(np.uint8)            # the photo's white backdrop round the machine
    outside[r["floor_px"]:] = 0
    filled = cv2.inpaint(im.clip(0, 255).astype(np.uint8), mask | cv2.dilate(outside, np.ones((5, 5), np.uint8)), 6, cv2.INPAINT_TELEA).astype(np.float32)
    # under each part, where the same place on the other side of the centre line is clear, take that mirror image (the
    # moulding is symmetric about the centre line), so the frame's edges run on behind the hose instead of a smear; feathered
    # into the inpaint, which is kept where the mirror is covered too (the hose's top half faces the cord)
    shift = int(round(2 * r["cx"] - (L.shape[1] - 1)))
    mir = np.roll(filled[:, ::-1], shift, axis=1)
    mmask = np.roll(mask[:, ::-1], shift, axis=1)
    use = (mask > 0) & (mmask == 0)
    w = cv2.GaussianBlur(cv2.dilate(use.astype(np.float32), np.ones((5, 5), np.uint8)), (0, 0), 2.5)[..., None]
    filled = filled * (1 - w) + mir * w
    # the texture: x from +270 mm (the photo's left) to -270 mm, y from the top edge down to the plinth's foot, square pixels
    Wt = 640
    Ht = int(round(Wt * (r["top"] - r["bottom"]) / 0.54))
    xs = r["cx"] + (np.linspace(-0.27, 0.27, Wt) * 1000) * r["ppm"][0]
    ys = r["floor"] - np.linspace(r["top"], r["bottom"], Ht) * 1000 * r["ppm"][1]
    mx, my = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
    tex = cv2.remap(filled, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    tex = (tex * r["shade"]).clip(0, 255)
    cv2.imwrite(os.path.join(out, "back.jpg"), tex.astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 88])
    print("wrote back.jpg", (Wt, Ht))
    # the machine's outline in the photo (half-widths by height), for the builder to keep the back's decal inside it
    sil = []
    for ym in np.arange(r["bottom"], r["top"] + 1e-9, 0.005):
        py = int(round(r["floor"] - ym * 1000 * r["ppm"][1]))
        d = np.where(L[py] < 200)[0]
        hw = min(r["cx"] - d[0], d[-1] - r["cx"]) / r["ppm"][0] / 1000
        sil.append([round(float(ym), 3), round(float(hw), 4)])
    P = lambda pts: [[round(v, 4) for v in to_m(r, x, y)] for x, y in pts]
    paths = {
        "source": "back.jpg (Whirlpool's rear photo of 31671), measured in photo pixels and scaled to 540 x 1025 mm",
        "top": r["top"], "bottom": r["bottom"], "silhouette": sil,
        "hose": P(r["hose"]), "hose_d": r["hose_d"], "hose_cuff": r["hose_cuff"],
        "inlet": {k: (round(-(v - r["cx"]) / r["ppm"][0] / 1000, 4) if k == "x" else v) for k, v in r["inlet"].items()},
        "cord": lay([to_m(r, x, y) for x, y in r["cord"]], r["cord_d"]), "cord_d": r["cord_d"],
        "plug": {"body": P(r["plug"]["body"]), "pins": P(r["plug"]["pins"]), "pin_d": r["plug"]["pin_d"],
                 "sleeve": P(r["plug"]["sleeve"]), "t": r["plug"]["t"]},
        "grommet": P([r["grommet"]])[0],
    }
    json.dump(paths, open(os.path.join(out, "rear_paths.json"), "w"), indent=1)
    print("wrote rear_paths.json: cord lifts up to", round(max(c[2] for c in paths["cord"]) * 1000, 1), "mm")


def drum(out, rng):
    """The stainless drum: rows of raised 'bloom' bubbles, each with a drain hole at its foot, staggered, as in Whirlpool's
    lid-open photos (top_open.jpg, lid_open_34.jpg). One tile, repeated round the drum."""
    N = 512
    base = np.full((N, N), 150.0, np.float32)
    base += cv2.GaussianBlur(rng.normal(0, 14, (N, N)).astype(np.float32), (0, 0), sigmaX=12, sigmaY=0.6)   # brushed round the drum
    hgt = np.zeros((N, N), np.float32)
    holes = np.zeros((N, N), np.float32)
    rows, per = 4, 4
    for r in range(rows):
        for c in range(per):
            cx = (c + 0.5 * (r % 2) + 0.5) * N / per
            cy = (r + 0.5) * N / rows
            for dx in (-N, 0, N):
                for dy in (-N, 0, N):
                    X, Y = np.meshgrid(np.arange(N) - (cx + dx), np.arange(N) - (cy + dy))
                    d = np.sqrt(X ** 2 + (Y * 1.15) ** 2)
                    hgt += np.clip(1 - d / 44, 0, 1) ** 1.5 * 9
                    hd = np.sqrt((X) ** 2 + (Y - 30) ** 2)
                    holes = np.maximum(holes, np.clip(1 - hd / 6.5, 0, 1) > 0)
    gy, gx = np.gradient(hgt)
    shade = 1 + 0.09 * (-gx * 0.4 + gy * 0.9)
    v = (base * shade).clip(0, 255)
    v = v * (1 - holes * 0.85)
    img = np.dstack([v * 0.98, v, v * 1.02])
    Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(os.path.join(out, "drum.jpg"), quality=86, optimize=True)
    print("wrote drum.jpg")


def impeller(out, cols=None):
    """The Hexa Bloom impeller's white dish with its ring of small holes (Whirlpool's top_open.jpg); the six grey vanes are
    modelled. UVs map the dish's plan straight onto this square."""
    N = 1024
    cols = cols or {"dish": 236, "holes": (70, 72, 76), "hub": (150, 152, 156)}
    img = np.full((N, N, 3), cols["dish"], np.float32)
    Y, X = np.mgrid[0:N, 0:N]
    r = np.hypot(X - N / 2, Y - N / 2) / (N / 2)
    img *= (1 - 0.08 * r)[..., None]
    pil = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)
    for ring, n, rad in ((0.86, 64, 5), (0.92, 72, 4)):
        for i in range(n):
            a = 2 * math.pi * i / n
            x, y = N / 2 + math.cos(a) * ring * N / 2, N / 2 + math.sin(a) * ring * N / 2
            d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=cols["holes"])
    d.ellipse([N * 0.47, N * 0.47, N * 0.53, N * 0.53], fill=cols["hub"])
    pil.save(os.path.join(out, "impeller.jpg"), quality=88, optimize=True)
    print("wrote impeller.jpg")


# the side relief in mm (u from the pocket's end, v from the decal's bottom just above the plinth). Measured on 31688's
# three_quarter_left_low.jpg: edge lines traced along rows and columns, mapped through a homography of the side face (607 mm
# deep; plinth bottom 20 mm, seam 770 mm at the front and 843 mm at the back) -> outer band u 68-519 v 135-701, inner edge
# u 121-458 v 210-627, arm ends v 406 and 522, square u 182-367 v 281-552, pocket u 51-139 v 440-481 (mm above the floor).
# Scaled here to the 31671's side (580 mm deep; plinth top 67 mm to seam 760 mm): u x 0.9555, v = 67 + (v - 35) x 0.9429 - 68
SIDE = {"d": 580, "h": 690, "outer": (65, 93, 496, 627, 48), "inner": (116, 164, 438, 557, 24), "gap": (349, 458),
        "square": (174, 231, 351, 486, 43), "handle": (91, 400, 84, 39)}
# The back, measured on back.jpg (Whirlpool's rear photo of 31671, 1200 x 1200 px): the machine is 607 px across its 540 mm
# (1.124 px/mm) and 1086 px from the floor (py 1143) to the top (py 57) over its 1025 mm (1.0595 px/mm: the camera looks down
# a little, so the photo is 0.945 as tall as it is wide; corrected here). Centre line at px 601. Every position below is a
# photo pixel read off the photo; the sizes of the hose, cord, pipe and plug are measured on it too (Whirlpool publishes none).
Y = lambda py: round((1143 - py) / 1.0595 / 1000, 4)
REAR = {
    "photo": "back.jpg", "cx": 601.0, "ppm": (1.124, 1.0595), "floor": 1143.0, "floor_px": 1119,
    "top": 1.012, "bottom": 0.021,      # the texture: from the housing's top back edge down to the plinth's foot
    "shade": 1.9,                       # the back to the white hose in the render as in the photo (linear 0.021 : 1)
    # the white parts over the back, painted out of the texture (photo px boxes): drain hose, inlet pipe, cord and plug
    "parts": [(325, 235, 520, 1113), (605, 155, 676, 446), (700, 108, 872, 600)],
    # the drain hose's centre line, from its open top end down the machine's right to where it goes into the plinth
    "hose": [(348.5, 244), (353.5, 284), (352, 324), (354, 364), (354, 404), (356.5, 444), (359, 484), (358, 524), (360, 564),
             (362.5, 604), (360.5, 644), (361, 684), (365, 724), (369, 764), (373, 804), (379, 844), (390.5, 884), (403, 924),
             (420.5, 964), (439, 1004), (461.5, 1044), (485, 1084), (490, 1105)],
    "hose_d": 0.032,                    # 33-38 px across where it hangs straight
    "hose_cuff": 0.05,                  # the smooth end piece, py 244-297
    # the inlet pipe hanging from its valve: a 4-lobed nut on the valve, the pipe bending out of it and down, a collar, the
    # pipe, a sleeve, then the tap coupling (a ribbed ring with a clip, a neck, the body)
    "inlet": {"x": 640.5, "nut": Y(188), "nut_w": 0.05, "nut_h": 0.046, "collar": [Y(215), Y(247)], "collar_d": 0.0205,
              "pipe": [Y(247), Y(321)], "pipe_d": 0.0169, "sleeve": [Y(321), Y(352)], "sleeve_d": 0.0196,
              "ring": [Y(354), Y(381)], "ring_d": 0.0436, "neck": [Y(381), Y(388)], "neck_d": 0.0267,
              "body": [Y(388), Y(441)], "body_d": 0.0436, "clip": [Y(362), Y(386)]},
    # the cord: out of the back at the top of its slot, two turns of a figure-of-eight hanging below, then up to the plug
    "cord": [(716, 201), (721, 218), (726, 240), (729, 262), (732, 281), (742, 285), (755, 282), (768, 284), (779, 292),
             (784, 310), (783, 340), (778, 375), (770, 405), (760, 430), (750, 450), (738, 475), (728, 505), (722, 535),
             (723, 558), (732, 571), (748, 577), (765, 576), (779, 568), (786, 550), (787, 525), (780, 495), (768, 467),
             (757, 448), (745, 425), (733, 395), (724, 360), (718, 325), (717, 300), (722, 282), (733, 272), (750, 268),
             (766, 270), (780, 278), (787, 295), (788, 325), (784, 360), (777, 395), (766, 425), (754, 450), (740, 478),
             (727, 510), (719, 540), (720, 565), (729, 582), (748, 590), (768, 590), (785, 580), (791, 557), (791, 530),
             (784, 500), (771, 470), (758, 447), (746, 425), (735, 400), (726, 365), (720, 330), (719, 300), (725, 280),
             (737, 268), (752, 264), (768, 267), (779, 272), (787, 265), (791, 254), (796, 245), (799, 240)],
    "cord_d": 0.0053,                   # 6 px
    # the Indian 3-pin plug lying with its pins out: the body's three corners, the pins, the ribbed sleeve the cord leaves by
    "plug": {"body": [(836, 121), (792, 172), (846, 199)], "pins": [(850, 157), (822, 181), (850, 190)], "pin_d": 0.0055,
             "sleeve": [(811, 199), (797, 243)], "t": 0.02},
    "grommet": (716, 203),
}
CFG.update({"side": SIDE, "back": REAR})


def main(cfg, argv):
    args = list(argv)
    debug = None
    if "--debug" in args:
        debug = args[args.index("--debug") + 1]
        del args[args.index("--debug"):args.index("--debug") + 2]
        os.makedirs(debug, exist_ok=True)
    photos, outroot = args[:2]
    out = os.path.join(outroot, cfg["slug"])
    os.makedirs(out, exist_ok=True)
    rng = np.random.default_rng(31671)
    p = Panel(cfg, photos, debug)
    img = p.draw()
    img.save(os.path.join(out, "panel.jpg"), quality=90, optimize=True)
    print("wrote panel.jpg", img.size)
    if debug:
        p.debug_overlay(os.path.join(debug, "windows.png"))
        ph = Image.fromarray(cv2.resize(p.pan, img.size, interpolation=cv2.INTER_CUBIC).clip(0, 255).astype(np.uint8))
        both = Image.new("RGB", (img.width, img.height * 2))
        both.paste(ph, (0, 0)); both.paste(img, (0, img.height))
        both.save(os.path.join(debug, "panel_vs_photo.jpg"), quality=85)
    label(photos, cfg, out)
    side(cfg, out, rng)
    if cfg.get("back"):   # the 31688 has no rear photo, so no back texture
        back(photos, cfg, out, rng)
    drum(out, rng)
    impeller(out, cfg.get("impeller"))


if __name__ == "__main__":
    main(CFG, sys.argv[1:])
