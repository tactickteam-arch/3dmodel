"""Textures for the Whirlpool Ace Turbo Dry Xtra 8.5 kg semi-automatic (twin-tub) washer, item code 30350 (Purple Dazzle),
with Whirlpool's two other colours of the same body (Wine 30351, Grey 30352).

usage: python3 tex_whirlpool_30350.py              (writes pipeline/tex/whirlpool_30350/)

The console's print is drawn new from Whirlpool's own top-down close-up of it (pipeline/sources/photos/whirlpool_30350/
console_top.jpg, 1.93 px/mm across, 1.72 px/mm down the sloped face: the knob rings are circles, so the face is
foreshortened to 0.89). Every word is set again in Avenir Next, fitted to the box its ink has in that photo (converted
to mm on the face); the knob rings, their tick marks and the TURBO DRY XTRA badge are drawn as shapes at the measured
places; the heading and feature icons are the photo's own ink, enlarged and cleaned. The print is one RGBA picture
(white and light grey ink, clear elsewhere), so the same print sits on all three colours.

Writes: console_print.png (344 x 125 mm at 10 px/mm), lid_logo.png (the Whirlpool wordmark on the wash lid, 10 px/mm),
spin_logo.png ("ace TurboDry" on the spin lid, 10 px/mm), deck_print.png (WATER SELECTOR), detergent.png, impeller.jpg,
spin_cap.jpg (the white impeller and spin cap, from Whirlpool's top view).
"""
import math
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, ".."))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
PH = os.path.join(SITE, "pipeline/sources/photos/whirlpool_30350")
OUT = os.path.join(SITE, "pipeline/tex/whirlpool_30350")
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BOLD, BOLDI, DEMI, DEMII, MED, REG = 0, 1, 2, 3, 5, 7
PX = 10                                   # px per mm of every print

# the console face in the photo: its printed area x 310-990 px, y 115-330 px; true mm across 1.93 px, down 1.72 px
FX0, FY0, SX, SY = 310, 115, 1.93, 1.72
FACE_W, FACE_H = 344.0, 125.0             # the face as built (the photo's 352 mm scaled to the 344 mm face: 0.977)
K = FACE_W / ((990 - FX0) / SX)


def uv(x, y):
    """photo px -> face mm"""
    return (x - FX0) / SX * K, (y - FY0) / SY * K


def render(text, face=DEMI, px=240, font=AVENIR):
    f = ImageFont.truetype(font, px, index=face)
    img = Image.new("L", (int(px * 0.8 * len(text) + px * 2), int(px * 2.2)), 0)
    ImageDraw.Draw(img).text((px, int(px * 1.5)), text, font=f, fill=255, anchor="ls")
    a = np.asarray(img).astype(np.float32) / 255
    ys, xs = np.where(a > 0.02)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


class RGBA:
    """an RGBA print (mm, PX px per mm): colour where ink is, alpha = ink cover"""

    def __init__(self, w, h):
        self.w, self.h = int(round(w * PX)), int(round(h * PX))
        self.rgb = np.zeros((self.h, self.w, 3), np.float32)
        self.a = np.zeros((self.h, self.w), np.float32)

    def put(self, alpha, colour, X, Y):
        h, w = alpha.shape
        X, Y = int(round(X)), int(round(Y))
        ax0, ay0, bx0, by0 = max(0, -X), max(0, -Y), max(0, X), max(0, Y)
        bx1, by1 = min(self.w, X + w), min(self.h, Y + h)
        if bx1 <= bx0 or by1 <= by0:
            return
        a = alpha[ay0:ay0 + by1 - by0, ax0:ax0 + bx1 - bx0]
        reg, ra = self.rgb[by0:by1, bx0:bx1], self.a[by0:by1, bx0:bx1]
        reg[:] = reg * (1 - a[..., None]) + np.array(colour, np.float32) * a[..., None]
        ra[:] = ra + a * (1 - ra)

    def fit(self, alpha, box, colour):
        x0, y0, x1, y1 = [v * PX for v in box]
        tw, th = max(1, int(round(x1 - x0))), max(1, int(round(y1 - y0)))
        a = cv2.resize(alpha, (tw, th), interpolation=cv2.INTER_AREA if tw < alpha.shape[1] else cv2.INTER_CUBIC).clip(0, 1)
        self.put(a, colour, x0, y0)

    def word(self, text, box, colour, face=DEMI):
        """the word at the box's width, its own proportions, centred on the box's middle (the photo's heights blur)"""
        a = render(text, face)
        x0, y0, x1, y1 = box
        h = (x1 - x0) * a.shape[0] / a.shape[1]
        ym = (y0 + y1) / 2
        self.fit(a, (x0, ym - h / 2, x1, ym + h / 2), colour)

    def rotated(self, text, centre, height, angle, colour, face=DEMI):
        """a word of the given ink height (mm) centred at centre, turned angle degrees (counter-clockwise)"""
        a = render(text, face)
        s = height * PX / a.shape[0]
        a = cv2.resize(a, (max(1, int(a.shape[1] * s)), max(1, int(a.shape[0] * s))), interpolation=cv2.INTER_AREA)
        pad = int(max(a.shape) * 0.8)
        big = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + 2 * pad), np.float32)
        big[pad:pad + a.shape[0], pad:pad + a.shape[1]] = a
        M = cv2.getRotationMatrix2D((big.shape[1] / 2, big.shape[0] / 2), angle, 1)
        r = cv2.warpAffine(big, M, (big.shape[1], big.shape[0]), flags=cv2.INTER_CUBIC).clip(0, 1)
        self.put(r, colour, centre[0] * PX - big.shape[1] / 2, centre[1] * PX - big.shape[0] / 2)

    def shape(self, colour, fn, ss=4):
        m = Image.new("L", (self.w * ss, self.h * ss), 0)
        fn(ImageDraw.Draw(m), lambda x, y: (x * PX * ss, y * PX * ss), PX * ss)
        self.put(np.asarray(m.resize((self.w, self.h), Image.LANCZOS)).astype(np.float32) / 255, colour, 0, 0)

    def save(self, path):
        a = self.a.copy()
        a = np.where(a > 0.5, 1.0, a)     # the cut-out takes ink from half cover: keep the colour solid there
        rgba = np.dstack([self.rgb, a * 255]).clip(0, 255).astype(np.uint8)
        Image.fromarray(rgba, "RGBA").save(path, optimize=True)


def photo_icon(img, box_px, pad=1.5):
    """the photo's light ink on the purple ground, enlarged 6x and cleaned (an edge at half the ink's level)"""
    x0, y0, x1, y1 = box_px[0] - pad, box_px[1] - pad, box_px[2] + pad, box_px[3] + pad
    c = img[int(y0):int(math.ceil(y1)), int(x0):int(math.ceil(x1))].astype(np.float32)
    lo, hi = np.percentile(c, 5), np.percentile(c, 98)
    a = ((c - lo) / max(hi - lo, 1)).clip(0, 1)
    a = cv2.resize(a, (c.shape[1] * 6, c.shape[0] * 6), interpolation=cv2.INTER_CUBIC)
    a = cv2.GaussianBlur(a, (0, 0), 2.2)
    a = np.clip((a - 0.45) / 0.16, 0, 1)
    a = a * a * (3 - 2 * a)
    return a, (x0, y0, x1, y1)


WHITE = (246, 246, 248)
RING = (218, 218, 222)        # the knobs' light grey scale rings (photo, median 214-224)
RINGINK = (62, 62, 70)        # the words printed on them
TICK = (196, 196, 204)

# the knobs, measured on the photo (centre px), their words (photo centre px of each word) and the light rings' arcs
KNOBS = [   # words: (text, (X, Y) on the 4x gridded crop of the left or right half: crop_px)
    {"c": (406, 211), "crop": "L", "light": [(0, 180)],
     "words": [("Normal", (460, 288)), ("Delicate", (230, 430)), ("Heavy", (695, 445))]},
    {"c": (575, 216), "crop": "L", "light": [(-218, 95)],
     "words": [("Off", (1140, 290)), ("5min", (1290, 335)), ("10min", (1375, 460)), ("15min", (1365, 620)), ("40 min", (910, 440))],
     # the small line round the bottom: read as far as the photo shows it either side of the knob's grip
     "small": [("SOAK \u2022 Impeller rotates", -166), ("intervals", -80)]},
    {"c": (726, 214), "crop": "R", "light": [(-15, 101)], "words": [("Wash", (310, 300)), ("Drain", (540, 520))]},
    {"c": (892.5, 219), "crop": "R", "light": [(-220, 96)],
     "words": [("Off", (975, 300)), ("2min", (1190, 420)), ("4min", (1195, 630)), ("8min", (790, 690)), ("10min", (745, 450))]},
]
R_IN, R_OUT = 27.0, 35.8      # the scale ring (mm): inner edge 52 px, outer 69-70 px across in the photo
GRIP_GAP = 11                 # degrees each side of straight down left clear where the knob's grip runs over the ring


def crop_px(X, Y, left):
    """a point on the 4x gridded crops (left: x0 290, right: x0 650; both y0 85) -> photo px"""
    return (290 if left else 650) + X / 4, 85 + Y / 4


def arc_text(cv, text, c, r, a0, height, colour, face=MED):
    """text round the bottom of a ring, read counter-clockwise from angle a0, letters facing the centre"""
    f = ImageFont.truetype(AVENIR, 200, index=face)
    cap = f.getbbox("H")[3] - f.getbbox("H")[1]
    mm = height / cap                       # mm per font px
    a = a0
    for ch in text:
        adv = f.getlength(ch) * mm
        am = a + math.degrees(adv / 2 / r)
        if ch.strip():
            g = render(ch, face)
            gh = (f.getbbox(ch)[3] - f.getbbox(ch)[1]) * mm
            # the glyph's own centre sits at its own height above the baseline: shift it outward from the base circle
            off = (f.getbbox(ch)[1] + f.getbbox(ch)[3]) / 2 * mm - (f.getbbox("H")[1] + f.getbbox("H")[3]) / 2 * mm
            rr = r + off
            x, y = c[0] + rr * math.cos(math.radians(am)), c[1] - rr * math.sin(math.radians(am))
            cv.rotated(ch, (x, y), gh, am + 90, colour, face)
        a += math.degrees(adv / r)


def console(img):
    cv = RGBA(FACE_W, FACE_H)
    # the face's moulded edge: a fine dark groove round the printed area (top corners rounded, r 12 mm)
    def groove(d, P, k):
        x0, y0 = P(1.2, 1.2)
        x1, y1 = P(FACE_W - 1.2, FACE_H + 5)
        d.rounded_rectangle([x0, y0, x1, y1], radius=12 * k, outline=255, width=int(0.7 * k))
    cv.shape((22, 20, 30), groove)
    for i, kb in enumerate(KNOBS):
        cu, cvv = uv(*kb["c"])
        cvv = 58.0 * K                        # the four centres sit on one line (the photo's 56-60 is its perspective)
        def ring(d, P, k, kb=kb, cu=cu, cvv=cvv):
            for a0, a1 in kb["light"]:
                # PIL measures angles clockwise from +x; ours run counter-clockwise
                box = [*P(cu - R_OUT, cvv - R_OUT), *P(cu + R_OUT, cvv + R_OUT)]
                d.arc(box, -a1, -a0, fill=255, width=int((R_OUT - R_IN) * k))
        cv.shape(RING, ring)
        def ticks(d, P, k, kb=kb, cu=cu, cvv=cvv):
            lit = lambda a: any(a0 - 0.5 <= a <= a1 + 0.5 or a0 - 0.5 <= a - 360 <= a1 + 0.5 for a0, a1 in kb["light"])
            a = 0.0
            while a < 360:
                if not lit(a) and not (270 - GRIP_GAP < a < 270 + GRIP_GAP):
                    c, s = math.cos(math.radians(a)), -math.sin(math.radians(a))
                    d.line([P(cu + (R_IN + 0.8) * c, cvv + (R_IN + 0.8) * s), P(cu + (R_OUT - 0.4) * c, cvv + (R_OUT - 0.4) * s)],
                           fill=255, width=max(1, int(0.55 * k)))
                a += 3.0
        cv.shape(TICK, ticks)
        rm = (R_IN + R_OUT) / 2
        for text, (X, Y) in kb["words"]:
            wu, wv = uv(*crop_px(X, Y, kb["crop"] == "L"))
            ang = math.degrees(math.atan2(cvv - wv, wu - cu))
            c, s_ = math.cos(math.radians(ang)), -math.sin(math.radians(ang))
            # the photo: letters stand outward round the top and down the right; on the lower left they face the centre
            rot = ang - 90 if ang > -50 else ang + 90
            if rot <= -180: rot += 360
            cv.rotated(text, (cu + rm * c, cvv + rm * s_), 2.9, rot, RINGINK)
        for text, a0 in kb.get("small", []):
            arc_text(cv, text, (cu, cvv), rm - 0.9, a0, 1.9, RINGINK)
    # the headings and the feature line (photo px boxes -> mm)
    def box(x0, y0, x1, y1):
        a, b = uv(x0, y0)
        c, d = uv(x1, y1)
        return (a, b, c, d)
    for text, bx, face in [
        ("Fabric Type", (379, 134, 437.5, 144), BOLD), ("Wash Timer", (556, 135, 616, 145), BOLD),
        ("Drain Selector", (690, 136, 763.75, 146), BOLD), ("Dry Timer", (873.75, 138.75, 925, 147.5), BOLD),
        ("Auto Restart", (361, 297.5, 405, 305), DEMI), ("Buzzer", (455, 297.5, 477.5, 305), DEMI),
        ("Shockproof & Waterproof Panel", (525, 299, 636, 307.5), DEMI), ("Dynamix Dispenser", (685, 300.5, 752.5, 308), DEMI),
        ("8.5 kg", (782.5, 299, 816, 309), BOLD), ("XTRA", (922.5, 300, 957.5, 309), BOLD),
    ]:
        cv.word(text, box(*bx), WHITE, face)
    # TURBO DRY XTRA: TURBO dark on a light box, DRY light in a dark box with a light outline
    tb, db = box(835, 296, 883.75, 312), box(885, 296, 918.75, 312)
    def badge(d, P, k):
        d.rectangle([*P(tb[0], tb[1]), *P(tb[2], tb[3])], fill=255)
        d.rectangle([*P(db[0], db[1]), *P(db[2], db[3])], outline=255, width=int(0.5 * k))
    cv.shape(WHITE, badge)
    cv.word("TURBO", (tb[0] + 1.2, tb[1] + 1.8, tb[2] - 1.2, tb[3] - 1.8), (40, 34, 60), MED)
    cv.word("DRY", (db[0] + 1.6, db[1] + 1.8, db[2] - 1.6, db[3] - 1.8), WHITE, MED)
    # icons: the photo's own ink
    for bx in [(352, 130, 374, 148), (529, 129, 551, 151), (667, 134, 689, 150), (849, 134, 869, 151),
               (337, 289, 356, 308), (432, 289, 451, 309), (504, 294, 521, 310), (663, 294, 683, 312),
               ]:
        a, (x0, y0, x1, y1) = photo_icon(img, bx)
        cv.fit(a, box(x0, y0, x1, y1), WHITE)
    # the two Eco marks (photo: a leaf and "Eco", 626-650 x 162-171 px and 960-982 x 181-189 px): leaf drawn, word set
    for x0, y0, x1, y1 in [(626, 162, 650, 171.5), (960, 180.5, 982.5, 189.5)]:
        a0, b0 = uv(x0, y0)
        a1, b1 = uv(x1, y1)
        lw = (b1 - b0) * 0.95
        def leaf(d, P, k, a0=a0, b0=b0, b1=b1, lw=lw):
            cx, cy = a0 + lw / 2, (b0 + b1) / 2
            pts = []
            for t in np.linspace(0, math.pi, 24):
                pts.append((cx + lw / 2 * math.cos(t) - lw * 0.18 * math.sin(t), cy - lw * 0.5 * math.sin(t) * 0.9 + (lw / 2 * math.cos(t)) * 0.3))
            for t in np.linspace(math.pi, 0, 24):
                pts.append((cx + lw / 2 * math.cos(t), cy + lw * 0.12 * math.sin(t) + (lw / 2 * math.cos(t)) * 0.3))
            d.polygon([P(*q) for q in pts], fill=255)
        cv.shape(WHITE, leaf)
        cv.word("Eco", (a0 + lw + 0.6, b0, a1, b1), WHITE, DEMI)
    cv.save(os.path.join(OUT, "console_print.png"))


def wordmark(w_mm, out):
    """the official Whirlpool wordmark (pipeline/sources/logos/whirlpool.svg), white, without the registered mark"""
    svg = os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg")
    png = os.path.join(SITE, ".work", "whirlpool_tex", "logo_3000.png")
    os.makedirs(os.path.dirname(png), exist_ok=True)
    if not os.path.exists(png):
        subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"), svg, png, "3000"], check=True, capture_output=True)
    lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
    a = lg[..., 3] / 255
    xs = np.where((a > 0.1).any(0))[0]
    gaps = np.where(np.diff(xs) > 8)[0]
    right = xs[gaps[-1]] + 1 if len(gaps) else xs[-1] + 1
    ys = np.where((a[:, :right] > 0.1).any(1))[0]
    a = a[ys.min():ys.max() + 1, xs[0]:right]
    h = w_mm * a.shape[0] / a.shape[1]
    cv = RGBA(w_mm + 2, h + 2)
    cv.fit(a, (1, 1, w_mm + 1, h + 1), (236, 236, 238))
    cv.save(out)
    return h + 2


def spin_logo(out):
    # "ace TurboDry" (photo: 106 mm wide, x-height letters 'ace' then TurboDry in italic)
    # console_top.jpg: "ace" 550-620 px (36 mm, a rounded single-storey a: Futura), TurboDry 628-755 px (66 mm, italic)
    cv = RGBA(106, 16)
    a = render("ace", 0, 240, "/System/Library/Fonts/Supplemental/Futura.ttc")
    h = 34 * a.shape[0] / a.shape[1]
    cv.fit(a, (1, 12.4 - h, 35, 12.4), (226, 226, 230))
    t = render("TurboDry", DEMII)
    th = 66 * t.shape[0] / t.shape[1]
    # TurboDry's baseline on ace's: the y's tail hangs below
    f = ImageFont.truetype(AVENIR, 240, index=DEMII)
    desc = (f.getbbox("TurboDry")[3] - f.getbbox("TurboDr")[3]) / (f.getbbox("TurboDry")[3] - f.getbbox("TurboDry")[1]) * th
    cv.fit(t, (39, 12.4 + desc - th, 105, 12.4 + desc), (226, 226, 230))
    cv.save(out)


def small_prints():
    cv = RGBA(30, 11)
    cv.word("WATER", (6.5, 1, 23.5, 4.4), (150, 150, 160), DEMI)
    cv.word("SELECTOR", (1, 6, 29, 9.6), (150, 150, 160), DEMI)
    cv.save(os.path.join(OUT, "deck_print.png"))
    # the Dynamix dispenser's blue cup (tub_inside.jpg): DETERGENT in white
    w, h = 500, 260                         # the cup's face, 50 x 26 mm at 10 px/mm
    im = Image.new("RGB", (w, h), (52, 170, 222))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(AVENIR, 78, index=BOLD)
    d.text((w / 2, h / 2), "DETERGENT", font=f, fill=(244, 248, 252), anchor="mm")
    im.save(os.path.join(OUT, "detergent.jpg"), quality=88)


def hub(out):
    """the impeller's hub (top_open.jpg): dark grey, 56 mm across, "ace" moulded in it (33 mm wide); drawn at 10 px/mm, the
    letters a shade darker with a light lower edge, as the moulding catches the light in the photo"""
    n = 600
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    r = np.hypot(xx - n / 2, yy - n / 2) / (n / 2)
    g = (78 + 26 * np.clip(1 - r * 1.6, 0, 1)) * np.ones_like(r)
    g = np.where(r > 0.93, 150 + 40 * (r - 0.93) / 0.07, g)           # the bright rim round the hub
    img = np.dstack([g, g, g + 3])
    a = render("ace", 1, 240, "/System/Library/Fonts/Supplemental/Futura.ttc")
    w = 330
    hh = int(w * a.shape[0] / a.shape[1])
    a = cv2.resize(a, (w, hh), interpolation=cv2.INTER_AREA)
    x0, y0 = (n - w) // 2, (n - hh) // 2
    for dy, col in [(4, (128, 128, 132)), (0, (48, 48, 52))]:
        reg = img[y0 + dy:y0 + dy + hh, x0:x0 + w]
        reg[:] = reg * (1 - a[..., None]) + np.array(col, np.float32) * a[..., None]
    cv2.imwrite(out, img.clip(0, 255).astype(np.uint8)[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 88])


def disc(img, c, r, out, size=512):
    x, y = c
    crop = img[int(y - r):int(y + r), int(x - r):int(x + r)]
    crop = cv2.resize(crop, (size, size), interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(out, crop, [cv2.IMWRITE_JPEG_QUALITY, 88])


def main():
    os.makedirs(OUT, exist_ok=True)
    g = cv2.cvtColor(cv2.imread(os.path.join(PH, "console_top.jpg")), cv2.COLOR_BGR2GRAY)
    console(g)
    h = wordmark(170, os.path.join(OUT, "lid_logo.png"))
    spin_logo(os.path.join(OUT, "spin_logo.png"))
    small_prints()
    top = cv2.imread(os.path.join(PH, "top_open.jpg"))
    disc(top, (451, 591), 142, os.path.join(OUT, "impeller.jpg"))
    disc(top, (852, 600), 134, os.path.join(OUT, "spin_cap.jpg"))
    hub(os.path.join(OUT, "hub.jpg"))
    print("console_print.png", FACE_W, "x", FACE_H, "mm; lid logo", round(h, 1), "mm tall")


if __name__ == "__main__":
    main()
