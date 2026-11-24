"""Textures for the Whirlpool Xpert Care front-load washers: item code 33015 (8 kg, 1400 RPM, Majestic Silver) and, run by
tex_whirlpool_33027.py with its own settings, 33027 (9 kg, Volcano Grey).

usage: python3 tex_whirlpool_33015.py [<config name>]      (33015 by default; writes pipeline/tex/whirlpool_<code>/)

The control band (600 x 138 mm, 712 to 850 mm up) is drawn new from Whirlpool's own close-up of the 33015's panel
(pipeline/sources/photos/whirlpool_33015/panel_closeup.jpg), rectified to the panel's plane at 8 px/mm through six points
whose places are known (the drawer's groove corners and the display window's corners, from the straight-on front photo).
Every word is set again in Avenir Next, fitted to the box its ink has in that photo; the leader lines and their dots are
drawn as lines at the places measured there; the Whirlpool wordmark is the official mark (pipeline/sources/logos/
whirlpool.svg) in the print's one colour, without the registered mark (the panel has none). The four small icons (Ozone
Refresh, the child lock, the key, the steam cloud) are the photo's own ink, enlarged and cleaned; the power and play/pause
marks are drawn as shapes. The 33027's panel (its own front photo, Whirlpool's gallery for 33027) is the same print with
More Cycles in place of Drum Clean, an Ozone key in place of the Steam key, 9kg and the RPM the photo shows.

Writes: panel.jpg (the band at 4 px/mm), print_*.jpg + decals_panel.json (the band's print at 12 px/mm, for uvDecals),
display.jpg (the black display slab at 12 px/mm), drawer.jpg (the drawer's face with the wordmark), knob_top.jpg, drum.jpg,
side.jpg (the side sheet's pressed panel and round boss, as light and shade).
"""
import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import decal_cut  # noqa: E402

AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BOLD, BOLDI, DEMI, MED, REG = 0, 1, 2, 5, 7
BASK = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
PH = os.path.join(SITE, "pipeline/sources/photos/whirlpool_33015")

# The band in mm: x from the cabinet's left edge (0..600), Yt down from 852 mm (the frame the photo was rectified to);
# the band's face runs from Yt 2 (850 mm, the top) to Yt 140 (712 mm, the seam over the lower front).
BAND_W, BAND_T, BAND_B = 600.0, 2.0, 140.0

CONFIGS = {
    "33015": {
        "slug": "whirlpool_33015",
        "ground": (184, 187, 192),      # Majestic Silver: the front's paint (the builder's Front material is the same sRGB)
        "ink": (38, 40, 45),            # the print on the silver: near black in the photo
        "drum_clean": ("Drum", "Clean"),
        "key2": "Steam",
        "kg": "8kg",
        "rpm": "1400 RPM",
    },
    "33027": {
        "slug": "whirlpool_33027",
        "ground": (78, 80, 86),         # Volcano Grey (Whirlpool's 33027 front photo, the lower front 71-78)
        "ink": (206, 208, 212),         # the print on the grey: light grey in the photo
        "drum_clean": ("More", "Cycles"),
        "key2": "Ozone",
        "kg": "9kg",
        "rpm": "1200 RPM",              # as printed on the panel in Whirlpool's 33027 photo (see NOTES: Whirlpool's page says 1400)
    },
}

SLAB = (379.4, 33.0, 547.0, 129.0)      # the black display slab (front photo: 379.4-547 mm across, 723-819 mm up)
SLAB_R = 4.0                            # its corners (ESTIMATED, the close-up)
LCD = (399.3, 41.0, 482.4, 98.5)        # the LCD window inside it
KEYCOL = (522.4, 35.4, 543.0, 117.0)    # the three keys' column, split at Yt 61.6 and 87.3
KEY_SPLITS = (61.6, 87.3)
DRAWER = (10.3, 14.0, 193.0, 134.0)     # the drawer's face (718-838 mm up); the groove round it 9.3-194, 717-839
GROOVE = (9.3, 13.0, 194.0, 135.0)
SLOT = (41.0, 68.4, 161.5, 103.2)       # the drawer's handle slot (a hole in the face, modelled)
LOGO = (67.62, 30.12, 133.0, 50.0)
KNOB = (299.0, 72.5, 31.0)              # the dial's centre and radius

# words: (text, box, face). Boxes are the ink's in the rectified photo (mm); each word is fitted to its own box.
WORDS = [
    ("Ozone Refresh", (280.5, 21.5, 316.5, 25.5), DEMI),
    ("StainWash", (222.62, 33.88, 248.62, 38.0), DEMI), ("Delicates", (350.25, 34.0, 372.88, 38.0), DEMI),
    ("Rapid 30 min", (222.88, 47.12, 254.25, 52.0), DEMI), ("Cotton", (356.25, 47.0, 372.88, 51.12), DEMI),
    ("Sanitize", (222.88, 60.0, 242.25, 64.0), DEMI), ("Eco Cotton", (346.12, 59.88, 372.88, 63.88), DEMI),
    ("Baby Care", (223.25, 73.5, 248.0, 78.38), DEMI), ("Daily Wash", (346.75, 73.25, 372.88, 78.12), DEMI),
    ("Bedding", (223.38, 83.62, 243.5, 88.38), DEMI), ("Curtains", (223.38, 89.25, 244.25, 93.38), DEMI),
    ("Woollens", (350.75, 86.0, 373.12, 89.88), DEMI),
    ("Rinse & Spin", (223.62, 99.38, 253.62, 104.0), DEMI), ("Active Wear", (344.12, 99.0, 373.25, 102.88), DEMI),
    ("Spin & Drain", (223.75, 112.38, 253.25, 117.25), DEMI),
    ("8kg", (565.12, 121.88, 576.62, 127.88), DEMI), ("1400 RPM", (556.12, 132.75, 576.88, 136.25), MED),
]
# the leader lines: (points, dot at the last point)
LEADERS_L = [
    ([(250.6, 37.3), (284.6, 37.3), (284.6, 43.9)]),
    ([(256.4, 50.7), (272.6, 50.7), (272.6, 51.6)]),
    ([(244.1, 63.4), (265.6, 63.4)]),
    ([(250.0, 76.8), (264.1, 76.8)]),
    ([(246.4, 89.5), (268.8, 89.5)]),
    ([(255.75, 102.6), (278.6, 102.6), (278.6, 99.6)]),
    ([(255.25, 115.6), (292.0, 115.6), (292.0, 105.1)]),
]
# the right column's lines start at these x (each word's left edge less 2 mm); the rest mirror the left about x 298.5
LEADERS_R_START = [348.4, 354.3, 344.2, 344.8, 348.85, 342.2, 343.1]
MIRROR = 298.5
OZONE_LINE = [(298.5, 27.1), (298.5, 41.2)]
LINE_W, DOT_R = 0.32, 0.7
OZONE_ICON = (273.62, 21.0, 278.75, 26.38)

# the display (white on the black slab)
DWORDS = [
    ("Cold", (387.88, 48.88, 396.12, 52.12)), ("Wash", (387.0, 53.62, 397.0, 56.88)),
    ("Easy", (387.75, 65.62, 396.25, 69.62)), ("Iron", (388.5, 70.25, 395.5, 73.5)),
    ("Pre", (389.25, 79.25, 395.25, 82.5)), ("Wash", (387.25, 83.88, 397.25, 87.12)), ("3 s", (393.0, 89.5, 397.62, 92.38)),
    ("Rapid", (487.62, 54.75, 498.0, 58.62)),
    ("Multi", (488.5, 66.88, 497.25, 70.12)), ("Rinse", (488.0, 71.5, 498.0, 74.75)),
    ("Fresh", (488.0, 80.5, 498.25, 83.75)), ("Care+", (487.62, 85.12, 498.25, 88.5)), ("3 s", (494.62, 90.75, 499.38, 93.62)),
    ("Power", (527.5, 52.38, 540.12, 55.88)),
    ("Start", (529.0, 100.12, 539.38, 103.88)), ("Pause", (528.12, 105.38, 540.38, 108.88)),
    ("Temp°C", (409.62, 103.12, 423.62, 107.25)),
    ("Start", (438.38, 101.38, 447.5, 104.62)), ("Delay", (438.25, 106.0, 448.62, 110.0)),
    ("Spin", (465.38, 101.75, 473.5, 105.5)), ("Speed", (463.75, 106.25, 475.38, 110.25)),
]
DRULES = [(385.5, 59.62, 398.75, 60.5), (385.75, 76.12, 398.5, 77.12), (486.62, 60.75, 499.5, 61.75), (486.62, 77.5, 499.62, 78.38),
          (428.12, 101.12, 429.12, 109.5), (455.62, 101.5, 456.5, 110.12)]
BOTTOM_RULE = (384.0, 114.3, 542.75, 115.0)   # the slab's dim grey line over the Xpert Care strip
XPERT = [("Xpert", (388.62, 117.75, 407.62, 124.75)), ("Care", (409.25, 118.12, 425.0, 124.0))]
KEY2 = {"Steam": ((530.62, 72.62, 538.0, 79.12), (527.75, 80.25, 540.75, 83.88))}   # the key's icon and word boxes
LOCK_ICON = (387.75, 88.5, 392.38, 92.88)
KEY_ICON = (488.25, 91.0, 493.5, 93.12)
POWER_ICON = (530.25, 44.5, 537.12, 51.5)
PLAY, PAUSE = (529.62, 93.0, 534.0, 97.88), (535.38, 93.25, 538.5, 97.38)
SIXTH = {"6": (561.62, 24.6, 570.8, 36.12), "th": (570.3, 22.5, 574.25, 26.2), "sense": (561.0, 36.75, 574.5, 39.5)}

# ── the photo, rectified (six points: the drawer groove's corners and the display window's, mm from the front photo) ──
P_PHOTO = [[112, 494], [128, 806], [974, 571], [1319, 578], [983, 810], [1333, 811]]
P_MM = [[9.3, 839], [9.3, 717], [379.4, 819], [547, 819], [379.4, 723], [547, 723]]
RPX = 8


def rectified():
    im = cv2.imread(os.path.join(PH, "panel_closeup.jpg"))
    T = np.float32([[x * RPX, (852 - y) * RPX] for x, y in P_MM])
    Hm, _ = cv2.findHomography(np.float32(P_PHOTO), T, 0)
    r = cv2.warpPerspective(im, Hm, (600 * RPX, 152 * RPX), flags=cv2.INTER_CUBIC)
    return cv2.cvtColor(r, cv2.COLOR_BGR2GRAY).astype(np.float32)


def render(text, face=DEMI, font=AVENIR, px=240):
    f = ImageFont.truetype(font, px, index=face)
    img = Image.new("L", (int(px * 0.8 * len(text) + px * 2), int(px * 2.2)), 0)
    ImageDraw.Draw(img).text((px, int(px * 1.5)), text, font=f, fill=255, anchor="ls")
    a = np.asarray(img).astype(np.float32) / 255
    ys, xs = np.where(a > 0.02)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


class Canvas:
    """an RGB float image of a region of the band (mm), at px per mm"""

    def __init__(self, x0, y0, x1, y1, px, ground):
        self.x0, self.y0, self.px = x0, y0, px
        self.w, self.h = int(round((x1 - x0) * px)), int(round((y1 - y0) * px))
        self.img = np.zeros((self.h, self.w, 3), np.float32) + np.array(ground, np.float32)

    def P(self, x, y):
        return (x - self.x0) * self.px, (y - self.y0) * self.px

    def put(self, alpha, colour, X, Y):
        h, w = alpha.shape
        X, Y = int(round(X)), int(round(Y))
        ax0, ay0 = max(0, -X), max(0, -Y)
        bx0, by0 = max(0, X), max(0, Y)
        bx1, by1 = min(self.w, X + w), min(self.h, Y + h)
        if bx1 <= bx0 or by1 <= by0:
            return
        a = alpha[ay0:ay0 + by1 - by0, ax0:ax0 + bx1 - bx0][..., None]
        reg = self.img[by0:by1, bx0:bx1]
        reg[:] = reg * (1 - a) + np.array(colour, np.float32) * a

    def fit(self, alpha, box, colour):
        x0, y0, x1, y1 = box
        X0, Y0 = self.P(x0, y0)
        X1, Y1 = self.P(x1, y1)
        tw, th = max(1, int(round(X1 - X0))), max(1, int(round(Y1 - Y0)))
        a = cv2.resize(alpha, (tw, th), interpolation=cv2.INTER_AREA if tw < alpha.shape[1] else cv2.INTER_CUBIC).clip(0, 1)
        self.put(a, colour, X0, Y0)

    def word(self, text, box, colour, face=DEMI, font=AVENIR):
        self.fit(render(text, face, font), box, colour)

    def shape(self, colour, fn, ss=4):
        """fn(draw, P) draws white on an L image at ss x; composited in colour"""
        m = Image.new("L", (self.w * ss, self.h * ss), 0)
        d = ImageDraw.Draw(m)
        fn(d, lambda x, y: tuple(v * ss for v in self.P(x, y)), self.px * ss)
        a = np.asarray(m.resize((self.w, self.h), Image.LANCZOS)).astype(np.float32) / 255
        self.put(a, colour, 0, 0)

    def save(self, path, q=88):
        Image.fromarray(self.img.clip(0, 255).astype(np.uint8)).save(path, quality=q, optimize=True, subsampling=0)


def photo_icon(R, box, dark_ink, pad=0.6):
    """the photo's ink in a box as a clean alpha at 4x the photo's 8 px/mm (32 px/mm): normalised, enlarged, sharpened"""
    x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
    c = R[int(y0 * RPX):int(math.ceil(y1 * RPX)), int(x0 * RPX):int(math.ceil(x1 * RPX))]
    lo, hi = np.percentile(c, 3), np.percentile(c, 97)
    a = (hi - c) / max(hi - lo, 1) if dark_ink else (c - lo) / max(hi - lo, 1)
    a = cv2.resize(a.clip(0, 1), (c.shape[1] * 4, c.shape[0] * 4), interpolation=cv2.INTER_CUBIC)
    a = cv2.GaussianBlur(a, (0, 0), 1.6)
    a = np.clip((a - 0.42) / 0.2, 0, 1)                  # a clean edge at half the ink's level
    a = a * a * (3 - 2 * a)
    return a, (x0, y0, x1, y1)


def leaders(cfg):
    out = []
    for pts in LEADERS_L:
        out.append(pts)
    for pts, xs in zip(LEADERS_L, LEADERS_R_START):
        m = [(2 * MIRROR - x, y) for x, y in pts]
        m[0] = (xs, m[0][1])
        out.append(m)
    return out


def draw_panel(cv, cfg, R, icons=True):
    ink = cfg["ink"]
    words = [w for w in WORDS if w[0] not in ("8kg", "1400 RPM")]
    for t, b, f in words:
        cv.word(t, b, ink, f)
    # Drum Clean / More Cycles: right-aligned on the column at 373 mm, the Woollens size
    a_, b_ = cfg["drum_clean"]
    t = f"{a_} {b_}"
    if t == "Drum Clean":
        cv.word(t, (345.0, 111.88, 373.0, 115.88), ink)
    else:
        al = render(t)
        hmm = 4.0 * al.shape[0] / render("Drum Clean").shape[0]     # the same type size as Drum Clean
        wmm = hmm * al.shape[1] / al.shape[0]
        cv.fit(al, (373.0 - wmm, 111.88, 373.0, 111.88 + hmm), ink)
    cv.word(cfg["kg"], (565.12, 121.88, 576.62, 127.88), ink)
    rw = render(cfg["rpm"], MED)
    rh = 3.5
    cv.fit(rw, (576.88 - rh * rw.shape[1] / rw.shape[0], 132.75, 576.88, 136.25), ink, )
    # leader lines with their dots
    L = leaders(cfg)
    if t != "Drum Clean":                   # the last line starts 2 mm left of the word
        al = render(t)
        hmm = 4.0 * al.shape[0] / render("Drum Clean").shape[0]
        L[-1][0] = (373.0 - hmm * al.shape[1] / al.shape[0] - 2.0, L[-1][0][1])

    def lines(d, P, k):
        for pts in L + [OZONE_LINE]:
            d.line([P(x, y) for x, y in pts], fill=255, width=max(1, round(LINE_W * k)), joint="curve")
            ex, ey = pts[-1]
            (cx, cy), r = P(ex, ey), DOT_R * k
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    cv.shape(ink, lines)
    # the 6th sense mark
    cv.word("6", SIXTH["6"], ink, 2, BASK)
    cv.word("th", SIXTH["th"], ink, BOLDI)
    cv.word("sense", SIXTH["sense"], ink, BOLDI)
    # the Ozone Refresh icon: the photo's ink
    if icons:
        a, box = photo_icon(R, OZONE_ICON, True)
        cv.fit(a, box, ink)


def draw_display(cv, cfg, R):
    white = (236, 237, 238)
    slab = (14, 15, 17)
    # the slab (the canvas is the slab's rectangle; its corners rounded: outside them the band's ground)
    cv.img[:] = np.array(cfg["ground"], np.float32)

    def slab_fn(d, P, k):
        x0, y0 = P(SLAB[0], SLAB[1]); x1, y1 = P(SLAB[2], SLAB[3])
        d.rounded_rectangle((x0, y0, x1, y1), radius=SLAB_R * k, fill=255)
    cv.shape(slab, slab_fn)
    # the LCD window: a deeper black with a faint sheen to the top
    x0, y0 = cv.P(LCD[0], LCD[1]); x1, y1 = cv.P(LCD[2], LCD[3])
    yy = np.linspace(0, 1, int(y1) - int(y0))[:, None, None]
    cv.img[int(y0):int(y1), int(x0):int(x1)] = np.array((20, 22, 24), np.float32) + 8 * (1 - yy)
    # the key column: a raised-looking strip, darker splits between the three keys
    def keys_fn(d, P, k):
        a0, b0 = P(KEYCOL[0], KEYCOL[1]); a1, b1 = P(KEYCOL[2], KEYCOL[3])
        d.rounded_rectangle((a0, b0, a1, b1), radius=1.5 * k, fill=255)
    cv.shape((30, 31, 34), keys_fn)

    def splits_fn(d, P, k):
        for ys in KEY_SPLITS:
            d.line([P(KEYCOL[0] + 0.6, ys), P(KEYCOL[2] - 0.6, ys)], fill=255, width=max(1, round(0.5 * k)))
    cv.shape((10, 10, 12), splits_fn)
    for t, b in DWORDS:
        cv.word(t, b, white, DEMI)
    for t, b in XPERT:
        cv.word(t, b, white, BOLD)

    def rules_fn(d, P, k):
        for (a0, b0, a1, b1) in DRULES:
            p0, p1 = P(a0, b0), P(a1, b1)
            d.rectangle((p0[0], p0[1], p1[0], p1[1]), fill=255)
        # power: a ring open at the top with a bar
        x0_, y0_, x1_, y1_ = POWER_ICON
        cx, cy = (x0_ + x1_) / 2, (y0_ + y1_) / 2 + 0.4
        r = (x1_ - x0_) / 2 - 0.35
        (px, py) = P(cx, cy)
        rr = r * k
        d.arc((px - rr, py - rr, px + rr, py + rr), start=-60, end=240, fill=255, width=max(1, round(0.55 * k)))
        d.line([P(cx, y0_ + 0.1), P(cx, cy)], fill=255, width=max(1, round(0.6 * k)))
        # play (an outlined triangle) and pause (two bars)
        a0, b0, a1, b1 = PLAY
        d.polygon([P(a0 + 0.3, b0 + 0.3), P(a1 - 0.3, (b0 + b1) / 2), P(a0 + 0.3, b1 - 0.3)], outline=255, width=max(1, round(0.45 * k)))
        a0, b0, a1, b1 = PAUSE
        for xb in (a0 + 0.35, a1 - 0.35):
            d.line([P(xb, b0 + 0.2), P(xb, b1 - 0.2)], fill=255, width=max(1, round(0.5 * k)))
    cv.shape(white, rules_fn)

    def bottom_fn(d, P, k):
        p0, p1 = P(BOTTOM_RULE[0], BOTTOM_RULE[1]), P(BOTTOM_RULE[2], BOTTOM_RULE[3])
        d.rectangle((p0[0], p0[1], p1[0], p1[1]), fill=255)
    cv.shape((62, 64, 68), bottom_fn)
    # the small icons: the photo's own ink (white on the slab)
    for box in (LOCK_ICON, KEY_ICON):
        a, b = photo_icon(R, box, False, pad=0.4)
        cv.fit(a, b, white)
    ib, wb = KEY2["Steam"]
    if cfg["key2"] == "Steam":
        a, b = photo_icon(R, ib, False, pad=0.4)
        cv.fit(a, b, white)
        cv.word("Steam", wb, white, DEMI)
    else:                                   # Ozone: the Ozone Refresh icon (the photo's), the word at the Steam word's size
        a, b = photo_icon(R, OZONE_ICON, True)
        h_ = ib[3] - ib[1]
        w_ = h_ * a.shape[1] / a.shape[0]
        c = (ib[0] + ib[2]) / 2
        cv.fit(a, (c - w_ / 2, ib[1], c + w_ / 2, ib[3]), white)
        al = render("Ozone")
        hh = (wb[3] - wb[1]) * al.shape[0] / render("Steam").shape[0]
        ww = hh * al.shape[1] / al.shape[0]
        c = (wb[0] + wb[2]) / 2
        cv.fit(al, (c - ww / 2, wb[1], c + ww / 2, wb[1] + hh), white)


def draw_drawer(cv, cfg, svg):
    png = os.path.join(SITE, ".work", "whirlpool_tex", "logo_3000.png")
    os.makedirs(os.path.dirname(png), exist_ok=True)
    if not os.path.exists(png):
        subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"), svg, png, "3000"], check=True, capture_output=True)
    lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
    a = lg[..., 3] / 255
    cols = (a > 0.1).any(0)
    xs = np.where(cols)[0]
    gaps = np.where(np.diff(xs) > 8)[0]
    right = xs[gaps[-1]] + 1 if len(gaps) else xs[-1] + 1     # without the registered mark
    ys = np.where((a[:, :right] > 0.1).any(1))[0]
    a = a[ys.min():ys.max() + 1, xs[0]:right]
    cv.fit(a, LOGO, cfg["ink"])


def knob_top(out):
    N = 1024
    rng = np.random.default_rng(7)
    Y, X = np.mgrid[0:N, 0:N].astype(np.float32) - N / 2 + 0.5
    r = np.hypot(X, Y) / (N / 2)
    th = np.arctan2(Y, X)
    # spun metal: fine concentric rings, a soft cone of light across (the close-up's bright wedge)
    rings = rng.normal(0, 1, 4096).astype(np.float32)
    rings = np.convolve(rings, np.ones(3) / 3, "same")
    v = 172 + 10 * rings[(r * 2000).astype(int).clip(0, 4095)] + 34 * np.cos(2 * (th + 0.6)) * np.clip(r * 1.4, 0, 1)
    v = v - 22 * np.clip((r - 0.92) / 0.08, 0, 1)          # the rounded rim, darker
    # the marker: a short dark line at the top (the close-up: 12 o'clock, from about half the radius to near the rim)
    mark = (np.abs(X) < N * 0.006) & (Y < -N * 0.5 * 0.55) & (Y > -N * 0.5 * 0.86)
    v[mark] = 70
    img = np.dstack([v, v * 1.005, v * 1.015]).clip(0, 255).astype(np.uint8)
    Image.fromarray(img).save(os.path.join(out, "knob_top.jpg"), quality=88, optimize=True)


def drum(out):
    """the stainless drum: staggered rows of small holes in a brushed sheet (the door-open photo); one tile, 20 round"""
    N = 512
    rng = np.random.default_rng(3)
    base = np.full((N, N), 160.0, np.float32)
    base += cv2.GaussianBlur(rng.normal(0, 14, (N, N)).astype(np.float32), (0, 0), sigmaX=10, sigmaY=0.6)
    Y, X = np.mgrid[0:N, 0:N].astype(np.float32)
    holes = np.zeros((N, N), np.float32)
    step = N / 8
    for r in range(8):
        for c in range(8):
            cx = (c + 0.5 * (r % 2) + 0.25) * step
            cy = (r + 0.5) * step
            for dx in (-N, 0, N):
                d = np.hypot(X - cx - dx, Y - cy)
                holes = np.maximum(holes, np.clip((9 - d) / 1.5, 0, 1))
    v = base * (1 - 0.8 * holes)
    img = np.dstack([v * 0.98, v, v * 1.02]).clip(0, 255).astype(np.uint8)
    Image.fromarray(img).save(os.path.join(out, "drum.jpg"), quality=86, optimize=True)


def side(out, cfg):
    """The side sheet (595 mm deep, 15 to 838 mm up) at 1.5 px/mm: the pressed panel (a rounded rectangle 4 mm deep, 70 mm in
    from the front, 60 from the back, 90 to 740 mm up, corners r 60) and the round boss at its middle (r 85 out, 58 in), as
    light and shade on the paint (all ESTIMATED from the 3/4 photos). u runs from the back (0) to the front (1)."""
    PX = 1.5
    Dm, y0m, y1m = 595.0, 15.0, 838.0
    W, H = int(Dm * PX), int((y1m - y0m) * PX)
    hgt = np.zeros((H, W), np.float32)
    m = Image.new("L", (W * 2, H * 2), 0)
    d = ImageDraw.Draw(m)
    P = lambda u, y: (u * PX * 2, (y1m - y) * PX * 2)
    a, b = P(60, 740), P(Dm - 70, 90)
    d.rounded_rectangle((a[0], a[1], b[0], b[1]), radius=60 * PX * 2, fill=255)
    rec = np.asarray(m.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    hgt -= cv2.GaussianBlur(rec, (0, 0), 5) * 4
    cu, cy_ = (60 + Dm - 70) / 2, 467.0
    Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
    rr = np.hypot(X - cu * PX, Y - (y1m - cy_) * PX) / PX
    boss = np.clip((85 - rr) / 6, 0, 1) - np.clip((58 - rr) / 6, 0, 1)
    hgt += cv2.GaussianBlur(boss, (0, 0), 3) * 3
    gy, gx = np.gradient(hgt)
    shade = 1 + 0.35 * (gx * 0.5 - gy * 0.8)
    img = np.array(cfg["ground"], np.float32)[None, None] * shade[..., None]
    Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(os.path.join(out, "side.jpg"), quality=86, optimize=True)


def main(cfg):
    out = os.path.join(SITE, "pipeline/tex", cfg["slug"])
    os.makedirs(out, exist_ok=True)
    R = rectified()
    g = cfg["ground"]
    # the band at 4 px/mm (the whole face, Yt 2 to 140)
    low = Canvas(0, BAND_T, BAND_W, BAND_B, 4, g)

    def groove(d, P, k):
        a0, b0 = P(GROOVE[0], GROOVE[1]); a1, b1 = P(GROOVE[2], GROOVE[3])
        d.rounded_rectangle((a0, b0, a1, b1), radius=2.5 * k, fill=255)
    low.shape((30, 31, 33), groove)
    draw_panel(low, cfg, R)
    disp_low = Canvas(SLAB[0], SLAB[1], SLAB[2], SLAB[3], 4, g)
    draw_display(disp_low, cfg, R)
    X0, Y0 = low.P(SLAB[0], SLAB[1])
    low.img[int(round(Y0)):int(round(Y0)) + disp_low.h, int(round(X0)):int(round(X0)) + disp_low.w] = disp_low.img
    low.save(os.path.join(out, "panel.jpg"))
    # the print at 12 px/mm, cut to its ink (decal_cut), the display left out (the slab has its own texture)
    hi = Canvas(0, BAND_T, BAND_W, BAND_B, 12, g)
    draw_panel(hi, cfg, R)
    rects = decal_cut.cut(Image.fromarray(hi.img.clip(0, 255).astype(np.uint8)), g, out, prefix="print_panel")
    os.replace(os.path.join(out, "decals.json"), os.path.join(out, "decals_panel.json"))
    disp = Canvas(SLAB[0], SLAB[1], SLAB[2], SLAB[3], 12, g)
    draw_display(disp, cfg, R)
    disp.save(os.path.join(out, "display.jpg"))
    dr = Canvas(DRAWER[0], DRAWER[1], DRAWER[2], DRAWER[3], 8, g)
    draw_drawer(dr, cfg, os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"))
    dr.save(os.path.join(out, "drawer.jpg"))
    knob_top(out)
    drum(out)
    side(out, cfg)
    json.dump({"band": [0, BAND_T, BAND_W, BAND_B], "slab": SLAB, "slab_r": SLAB_R, "drawer": DRAWER, "groove": GROOVE,
               "slot": SLOT, "knob": KNOB, "lcd": LCD}, open(os.path.join(out, "layout.json"), "w"), indent=1)
    print("wrote", out, rects)


if __name__ == "__main__":
    main(CONFIGS[sys.argv[1] if len(sys.argv) > 1 else "33015"])
