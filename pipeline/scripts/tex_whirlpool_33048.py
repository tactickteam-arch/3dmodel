"""Textures for the Whirlpool 9 kg Steam front-load washer with in-built heater (XS9014BWME), item code 33048, Midnight Grey.

usage: python3 tex_whirlpool_33048.py      (writes pipeline/tex/whirlpool_33048/)

The cabinet, door and drum are the Xpert Care body (tex_whirlpool_33015.py and make_whirlpool_33015.mjs): Whirlpool's front
photo of this 9 kg Steam model (pipeline/sources/photos/whirlpool_33048/front.jpg, from Whirlpool India's page for the same
model, see NOTES.md) has the same 0.706 : 1 front and the door ring and glass at the same places. Its control band is its own:
a separate drawer plate, the dial with Sanitize above it and seven programmes each side, a display slab with its touch keys
and a separate key column (Power, Steam, Start / Pause).

The photo is straight on: 1.2328 px per mm, the cabinet's left edge at px 231 and the floor at px 1157, so it maps to the band
frame (mm from the cabinet's left edge, Yt down from 852 mm) by a scale. Every place below was measured on it (about
+-0.8 mm). Every word is set again in Avenir Next, its width the width of its ink in the photo and its top at the ink's top;
the leader lines and their dots are drawn at the places measured; the Whirlpool wordmark is the official mark
(pipeline/sources/logos/whirlpool.svg). The printed key icons are too small in the photo to redraw (about 7 px each): they
are the photo's own ink, enlarged and smoothed, as they are. The power and play / pause marks are drawn as shapes. The LCD is
shown off (dark), as on the other Xpert Care builds.

Writes: panel.jpg (the band at 4 px/mm), print_*.jpg + decals_panel.json (the band's print at 12 px/mm, for uvDecals),
display.jpg and keys.jpg (the two black slabs at 12 px/mm), drawer.jpg (the drawer's face with the wordmark), knob_top.jpg,
drum.jpg, side.jpg, layout.json.
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import decal_cut  # noqa: E402
import tex_whirlpool_33015 as base  # noqa: E402
from tex_whirlpool_33015 import Canvas, render, photo_icon, DEMI, MED, BOLDI, BASK  # noqa: E402

SITE = base.SITE
PH = os.path.join(SITE, "pipeline/sources/photos/whirlpool_33048")
CFG = {
    "slug": "whirlpool_33048",
    "ground": (69, 70, 74),        # Midnight Grey: Whirlpool's front photo, the lower front left of the door (71, 71, 69)
    "ink": (205, 207, 210),        # the print on the grey: light grey in the photo
}
BAND_W, BAND_T, BAND_B = 600.0, 2.0, 140.0

# the photo -> band frame
PX0, PYB, PS = 231.0, 1157.0, 1.2328
RPX = base.RPX                     # 8 px/mm, the frame photo_icon reads

DRAWER = (10.0, 11.4, 192.4, 132.6)    # the drawer's face (the photo's plate, its dark groove 9.0-193.6 x 10.4-133.6)
GROOVE = (9.0, 10.4, 193.6, 133.6)
SLOT = (40.0, 67.0, 161.6, 102.4)      # the handle slot
LOGO_C, LOGO_W = (101.8, 38.85), 65.4  # the wordmark's centre and width (its ink 68.95-134.65 x 27.9-49.8, swoosh included)
KNOB = (299.9, 67.9, 30.0)             # the dial: its bright face fits r 27.2 about (299.9, 67.9); the chrome side 30 (ESTIMATED)
SLAB = (384.0, 39.0, 496.6, 111.3)     # the display slab
SLAB_R = 3.0
LCD = (385.3, 40.3, 469.6, 91.9)       # the LCD window (upper left of the slab)
KEYS = (515.6, 38.1, 545.3, 112.5)     # the key column's slab
KEYS_R = 3.0
KEY_SPLITS = (64.75, 84.4)

# words: (text, x0, x1, top). The ink's left and right edges and its top in the photo; the height follows the font.
WORDS = [
    ("Sanitize", 290.4, 309.8, 16.7),
    ("StainWash", 225.5, 250.6, 30.5), ("Delicates", 350.9, 373.3, 30.6),
    ("Rapid 30 min", 225.5, 256.4, 44.5), ("Cotton", 356.6, 373.4, 44.5),
    ("Bed & Bath", 225.5, 251.4, 58.2), ("Eco Cotton", 347.0, 373.4, 58.2),
    ("Baby Care", 225.5, 249.8, 72.3), ("Daily Wash", 347.3, 373.3, 71.8),
    ("Bedding", 225.5, 245.0, 82.7), ("Curtains", 225.5, 245.9, 88.1), ("Woollens", 351.4, 373.3, 85.6),
    ("Rinse & Spin", 225.5, 255.0, 99.5), ("Active Wear", 344.8, 373.4, 99.8),
    ("Spin & Drain", 225.5, 255.0, 113.6), ("Drum Clean", 345.5, 373.4, 113.6),
    ("9kg", 560.5, 571.1, 119.5),
]
RPM = ("1400 RPM", 552.4, 571.9, 129.0)
# the leader lines (each ends in a dot)
LEADERS = [
    [(299.4, 22.2), (299.4, 37.9)],                                   # Sanitize, down to the dial
    [(252.7, 33.8), (285.9, 33.8), (285.9, 40.6)],                    # StainWash
    [(258.5, 48.0), (274.3, 48.0), (274.3, 49.4)],                    # Rapid 30 min
    [(253.2, 61.6), (267.3, 61.6)],                                   # Bed & Bath
    [(251.8, 75.5), (265.5, 75.5)],                                   # Baby Care
    [(247.7, 89.3), (270.3, 89.3)],                                   # Bedding Curtains
    [(257.3, 103.2), (279.5, 103.2), (279.5, 100.1)],                 # Rinse & Spin
    [(256.4, 117.3), (292.5, 117.3), (292.5, 105.6)],                 # Spin & Drain
    [(349.1, 33.8), (314.3, 33.8), (314.3, 40.5)],                    # Delicates
    [(355.0, 48.9), (325.9, 48.9)],                                   # Cotton
    [(344.8, 61.6), (332.7, 61.6)],                                   # Eco Cotton
    [(345.2, 75.6), (334.1, 75.6)],                                   # Daily Wash
    [(349.4, 89.1), (330.0, 89.1)],                                   # Woollens
    [(342.7, 103.2), (320.5, 103.2), (320.5, 100.2)],                 # Active Wear
    [(343.9, 117.3), (307.3, 117.3), (307.3, 105.6)],                 # Drum Clean
]
LINE_W, DOT_R = 0.32, 0.7
SIXTH = {"6": (559.4, 30.6, 569.4, 39.4), "th": (568.8, 28.5, 571.3, 30.6), "sense": (558.8, 40.6, 571.3, 44.0)}

# the display slab's print (white): the keys' words (text, x0, x1, top) and icons (boxes, the photo's ink)
DWORDS = [
    ("Multi Rinse", 472.0, 493.6, 52.8), ("Fresh Care+", 470.9, 494.4, 79.4),
    ("Temp °C", 391.7, 407.6, 103.3), ("Delay start", 415.3, 437.2, 103.3), ("Spin Speed", 443.6, 465.8, 102.8),
    ("Rapid", 475.8, 487.2, 103.3),
]
DICONS = [(478.9, 44.4, 486.7, 49.4), (478.3, 70.3, 487.2, 78.3), (396.7, 94.4, 400.6, 101.7), (422.0, 93.9, 429.4, 102.8),
          (450.9, 94.8, 458.3, 101.1), (478.3, 95.0, 485.6, 101.1)]
# the cells' dividing lines: (x0, y0, x1, y1), drawn 0.5 mm wide
DLINES = [(385.0, 92.2, 469.8, 92.2), (469.8, 40.0, 469.8, 110.5), (469.8, 64.8, 495.8, 64.8), (469.8, 92.2, 495.8, 92.2),
          (412.2, 92.2, 412.2, 110.5), (440.6, 92.2, 440.6, 110.5)]
# the key column's print
KWORDS = [("Power", 524.8, 536.3, 54.8), ("Steam", 524.4, 536.9, 78.8), ("Start /", 524.4, 536.9, 96.9), ("Pause", 525.0, 536.0, 101.9)]
POWER_ICON = (527.5, 46.9, 533.8, 53.8)
STEAM_ICON = [(526.0, 68.8, 534.8, 71.3), (527.4, 71.6, 533.6, 78.2)]   # its bar, then its cloud (fainter in the photo)
PLAY, PAUSE = (526.0, 91.3, 529.2, 95.0), (530.2, 91.4, 534.4, 95.0)


def photo_frame():
    """the front photo in the band frame at 8 px/mm (grey, float)"""
    im = cv2.imread(os.path.join(PH, "front.jpg"))
    s = PS / RPX
    # band (x mm, Yt mm) -> px: px = PX0 + x*PS ; py = PYB - (852 - Yt)*PS
    M = np.float32([[s, 0, PX0], [0, s, PYB - 852 * PS]])
    r = cv2.warpAffine(im, M, (600 * RPX, 152 * RPX), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    return cv2.cvtColor(r, cv2.COLOR_BGR2GRAY).astype(np.float32)


def word(cv, text, x0, x1, top, colour, face=DEMI, font=base.AVENIR):
    a = render(text, face, font)
    h = (x1 - x0) * a.shape[0] / a.shape[1]
    cv.fit(a, (x0, top, x1, top + h), colour)


def draw_panel(cv, R):
    ink = CFG["ink"]
    for t, x0, x1, top in WORDS:
        word(cv, t, x0, x1, top, ink)
    word(cv, RPM[0], RPM[1], RPM[2], RPM[3], ink, MED)

    def lines(d, P, k):
        for pts in LEADERS:
            d.line([P(x, y) for x, y in pts], fill=255, width=max(1, round(LINE_W * k)), joint="curve")
            (cx, cy), r = P(*pts[-1]), DOT_R * k
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    cv.shape(ink, lines)
    cv.word("6", SIXTH["6"], ink, 2, BASK)
    cv.word("th", SIXTH["th"], ink, BOLDI)
    cv.word("sense", SIXTH["sense"], ink, BOLDI)


def slab_canvas(box, r, px, inner):
    cv = Canvas(box[0], box[1], box[2], box[3], px, CFG["ground"])

    def fn(d, P, k):
        x0, y0 = P(box[0], box[1]); x1, y1 = P(box[2], box[3])
        d.rounded_rectangle((x0, y0, x1, y1), radius=r * k, fill=255)
    cv.shape((34, 35, 38), fn)                # the slab's rim, a shade lighter than its face (the photo)

    def fn2(d, P, k):
        x0, y0 = P(box[0] + 0.9, box[1] + 0.9); x1, y1 = P(box[2] - 0.9, box[3] - 0.9)
        d.rounded_rectangle((x0, y0, x1, y1), radius=(r - 0.9) * k, fill=255)
    cv.shape(inner, fn2)
    return cv


def draw_display(px, R):
    white = (236, 237, 238)
    cv = slab_canvas(SLAB, SLAB_R, px, (16, 17, 19))
    x0, y0 = cv.P(LCD[0] + 0.4, LCD[1] + 0.4); x1, y1 = cv.P(LCD[2] - 0.4, LCD[3] - 0.4)
    yy = np.linspace(0, 1, int(y1) - int(y0))[:, None, None]
    cv.img[int(y0):int(y1), int(x0):int(x1)] = np.array((11, 12, 14), np.float32) + 7 * (1 - yy)

    def lines(d, P, k):
        for a0, b0, a1, b1 in DLINES:
            d.line([P(a0, b0), P(a1, b1)], fill=255, width=max(1, round(0.5 * k)))
    cv.shape((52, 54, 58), lines)
    for t, a0, a1, top in DWORDS:
        word(cv, t, a0, a1, top, white)
    for box in DICONS:
        a, b = photo_icon(R, box, False, pad=0.5)
        cv.fit(a, b, white)
    return cv


def draw_keys(px, R):
    white = (236, 237, 238)
    cv = slab_canvas(KEYS, KEYS_R, px, (16, 17, 19))

    def splits(d, P, k):
        for ys in KEY_SPLITS:
            d.line([P(KEYS[0] + 1.2, ys), P(KEYS[2] - 1.2, ys)], fill=255, width=max(1, round(0.5 * k)))
    cv.shape((52, 54, 58), splits)
    for t, a0, a1, top in KWORDS:
        word(cv, t, a0, a1, top, white)
    for box in STEAM_ICON:
        a, b = photo_icon(R, box, False, pad=0.3)
        cv.fit(a, b, white)

    def marks(d, P, k):
        x0_, y0_, x1_, y1_ = POWER_ICON
        cx, cy = (x0_ + x1_) / 2, (y0_ + y1_) / 2 + 0.3
        r = (x1_ - x0_) / 2 - 0.35
        (qx, qy), rr = P(cx, cy), r * k
        d.arc((qx - rr, qy - rr, qx + rr, qy + rr), start=-60, end=240, fill=255, width=max(1, round(0.5 * k)))
        d.line([P(cx, y0_ + 0.1), P(cx, cy)], fill=255, width=max(1, round(0.55 * k)))
        a0, b0, a1, b1 = PLAY
        d.polygon([P(a0 + 0.3, b0 + 0.3), P(a1 - 0.3, (b0 + b1) / 2), P(a0 + 0.3, b1 - 0.3)], outline=255, width=max(1, round(0.45 * k)))
        a0, b0, a1, b1 = PAUSE
        for xb in (a0 + 0.9, a1 - 0.9):
            d.line([P(xb, b0 + 0.2), P(xb, b1 - 0.2)], fill=255, width=max(1, round(0.5 * k)))
    cv.shape(white, marks)
    return cv


def draw_drawer(cv):
    png = os.path.join(SITE, ".work", "whirlpool_tex", "logo_3000.png")
    os.makedirs(os.path.dirname(png), exist_ok=True)
    if not os.path.exists(png):
        subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"),
                        os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"), png, "3000"], check=True, capture_output=True)
    lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
    a = lg[..., 3] / 255
    xs = np.where((a > 0.1).any(0))[0]
    gaps = np.where(np.diff(xs) > 8)[0]
    right = xs[gaps[-1]] + 1 if len(gaps) else xs[-1] + 1     # without the registered mark (the panel has none)
    ys = np.where((a[:, :right] > 0.1).any(1))[0]
    a = a[ys.min():ys.max() + 1, xs[0]:right]
    h = LOGO_W * a.shape[0] / a.shape[1]
    cx, cy = LOGO_C
    cv.fit(a, (cx - LOGO_W / 2, cy - h / 2, cx + LOGO_W / 2, cy + h / 2), CFG["ink"])


def main():
    out = os.path.join(SITE, "pipeline/tex", CFG["slug"])
    os.makedirs(out, exist_ok=True)
    R = photo_frame()
    g = CFG["ground"]
    low = Canvas(0, BAND_T, BAND_W, BAND_B, 4, g)

    def groove(d, P, k):
        a0, b0 = P(GROOVE[0], GROOVE[1]); a1, b1 = P(GROOVE[2], GROOVE[3])
        d.rounded_rectangle((a0, b0, a1, b1), radius=2.5 * k, fill=255)
    low.shape((26, 27, 29), groove)
    draw_panel(low, R)
    for box, cvx in ((SLAB, draw_display(4, R)), (KEYS, draw_keys(4, R))):
        X0, Y0 = low.P(box[0], box[1])
        low.img[int(round(Y0)):int(round(Y0)) + cvx.h, int(round(X0)):int(round(X0)) + cvx.w] = cvx.img
    low.save(os.path.join(out, "panel.jpg"))
    hi = Canvas(0, BAND_T, BAND_W, BAND_B, 12, g)
    draw_panel(hi, R)
    rects = decal_cut.cut(Image.fromarray(hi.img.clip(0, 255).astype(np.uint8)), g, out, prefix="print_panel")
    os.replace(os.path.join(out, "decals.json"), os.path.join(out, "decals_panel.json"))
    draw_display(12, R).save(os.path.join(out, "display.jpg"))
    draw_keys(12, R).save(os.path.join(out, "keys.jpg"))
    dr = Canvas(DRAWER[0], DRAWER[1], DRAWER[2], DRAWER[3], 8, g)
    draw_drawer(dr)
    dr.save(os.path.join(out, "drawer.jpg"))
    base.knob_top(out)
    base.drum(out)
    base.side(out, CFG)
    json.dump({"band": [0, BAND_T, BAND_W, BAND_B], "slab": SLAB, "slab_r": SLAB_R, "keys": KEYS, "keys_r": KEYS_R,
               "drawer": DRAWER, "groove": GROOVE, "slot": SLOT, "knob": KNOB, "lcd": LCD},
              open(os.path.join(out, "layout.json"), "w"), indent=1)
    print("wrote", out, rects)


if __name__ == "__main__":
    main()
