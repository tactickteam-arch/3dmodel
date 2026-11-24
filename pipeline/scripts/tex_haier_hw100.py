"""Textures for the Haier HW100-DM14F9BKU1, F9 10 kg front-load washer, Black.

usage: python3 tex_haier_hw100.py <photos dir> <logos dir> <out dir> [--hi]
  photos: haier_hw100/front.jpg       Haier's straight-on gallery photo of this model (its online shop, product 1966, 1000 px)
          haier_hw100/panel.jpg       Haier's straight-on close-up of this model's control panel (same gallery, 1.55 px per mm)
          haier_hw100/l34.jpg, r34.jpg   Haier's 3/4 gallery photos from the left and from the right (the side walls)
  logos:  haier.png
  writes <out dir>/haier_hw100/*.jpg and layout.json (every position the builder needs, in metres)
  --hi:   only the print decals: the panel's and the strip's print drawn again at 12 px per mm, cut in pieces (decals.json)

Scale. Haier publishes 600 W x 600 D x 850 H mm (its shop, this model; Sangeetha 60 x 60 x 85 cm). In the front photo the
cabinet spans columns 220-780 (561 px) and rows 105 (the panel's top edge) to 892 (under the feet): 0.935 px per mm across
and 0.926 down. The door rim is round in the photo (Hough circle r 250.5 px), so the positions here use the two scales and
the round parts their mean (ESTIMATED to +-3 mm). The panel photo spans columns 34.5-964.5 (1.55 px per mm) from row 595.5
(the panel's top edge); its panel face (rows 595.5-715.5) is 79 mm tall as in the front photo (rows 105-179), so its vertical
scale is 1.519 px per mm. The panel photo is taken from a little above, so it shows the strip's floor under the panel; the
strip's height comes from the front photo (rows 179-211: 771 to 737 mm).

Text. Every word, number and icon is set again sharp: the words in Arial Narrow fitted to the ink boxes measured on 8x
enlargements of the panel photo (Haier's print is a narrow grotesque), the badges' capitals in Arial Bold, the Haier wordmark
from logos/haier.png, the time as outlined seven-segment digits, the keys' outlines and icons as drawn shapes. The small line
icons beside the time (5 mm, 8 px in the photo): 9 are drawn as shapes, traced from Haier's own drawing of this display in its
HW120-DM14F9 series manual (Fig. 3-4) where this model's photo confirms the same icon (bottle, shirt, iron, Wi-Fi, padlock,
moon, the ringed tick, baby face, clock); the other 2 aren't in that drawing and stay the photo's own ink, enlarged. The thirteen programme pictures are coloured art; they stay the photo's, enlarged and sharpened, with their
names set again.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HI = "--hi" in sys.argv
PHOTOS, LOGOS, OUT = [x for x in sys.argv[1:] if x != "--hi"][:3]
SRC = os.path.join(PHOTOS, "haier_hw100")
D = os.path.join(OUT, "haier_hw100")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(1100)
NARROW = "/System/Library/Fonts/Supplemental/Arial Narrow.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"

W_MM, H_MM, D_MM = 600.0, 850.0, 600.0           # Haier: 600 x 600 x 850 mm (WxDxH), its shop page for this model
DOOR_PROUD = 27.0                                # ESTIMATED: the door's rim and glass in front of the cabinet (see the builder)
D_CAB = D_MM - DOOR_PROUD                        # the cabinet, so the door stays inside Haier's 600 mm
FEET = 12.0                                      # ESTIMATED: the feet show 11 px under the cabinet in the front photo

FX0, FKX, FYB, FKY = 500.5, 561 / 600.0, 892.0, 787 / 850.0            # front.jpg: centre column, px/mm across; floor row, px/mm down
PX0, PKX, PY0 = 499.5, 930 / 600.0, 595.5                              # panel.jpg: centre column, px/mm across; top row
PKY = 120.0 / 79.0                                                     # its panel face: rows 595.5-715.5 for 850-771 mm


def fX(px):
    return (px - FX0) / FKX


def fY(py):
    return (FYB - py) / FKY


def pX(px):
    return (px - PX0) / PKX


def pY(py):
    return H_MM - (py - PY0) / PKY


# ── the layout, mm (VERIFIED where Haier gives it, else measured on Haier's photos: ESTIMATED) ──
PANEL_BOT = 771.0                      # the panel 771-850 (front photo rows 105-179)
STRIP_BOT = 737.0                      # the recessed strip under it 737-771 (rows 179-211)
GLASS = (pX(40), pY(713), pX(958), pY(601))            # the panel's faces inside its edge
SEAM = pX(350.5)                       # the gap between the drawer's section of the panel and the display's
DRAWER = (pX(40), pX(349.5))           # the drawer's face, across
LIP = (pX(44), pX(372))                # its grip in the strip below (to the first chevron)
PLATE = (pX(391), pY(723), pX(610), pY(757))            # the DIRECT MOTION plate
KNOB = dict(x=pX(822), y=pY(651), r=44 / PKX)           # the dial's face: columns 778-866 (28.4 mm radius)
DOOR = dict(x=fX(499.5), y=fY(475.5))  # door centre (Hough circle)
FM = (FKX + FKY) / 2
RIM_R = 250.0 / FM                     # the silver rim: 250 px (268 mm)
DISH_R = 261.0 / FM                    # the door seat's outer edge (280 mm)
FLAP = dict(x=fX(701.5), y=fY(820.5), r=54.1 / FM)      # the round pump-filter cover (Hough circle)
FEET_X = (fX(248), fX(752))            # the front feet's centres: outer edges at columns 231 and 769, 36 mm feet
BODY = np.array([66, 69, 76], np.float32)              # the cabinet's colour where the front photo is evenly lit
SHADE = {"front.jpg": 0.55, "side_l.jpg": 1.0, "side_r.jpg": 1.0, "strip.jpg": 0.9, "drum.jpg": 0.6}

S = 4096 / W_MM
F = 1.0
if HI:
    S = 12.0
    F = S / (4096 / W_MM)
TW = round(W_MM * S)


def save(img, name, q=88):
    if name in SHADE:
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * SHADE[name]).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def tx(X):
    return (X + W_MM / 2) * S


def blend(canvas, m, X, Y, colour):
    h, w = m.shape
    xa, ya, xb, yb = max(0, X), max(0, Y), min(canvas.shape[1], X + w), min(canvas.shape[0], Y + h)
    if xb <= xa or yb <= ya:
        return
    a = np.clip(m[ya - Y:yb - Y, xa - X:xb - X], 0, 1)[..., None]
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + np.array(colour, np.float32) * a


def crop_ink(a, thr=0.3):
    ys, xs = np.where(a > thr)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


class Canvas:
    """A float image in texture px; boxes are (x0, y0, x1, y1) in panel-photo px."""

    def __init__(self, a, y_top_mm):
        self.a = a
        self.top = y_top_mm

    def box(self, b):
        x0, y0, x1, y1 = b
        return tx(pX(x0)), (self.top - pY(y0)) * S, tx(pX(x1)), (self.top - pY(y1)) * S

    def place(self, m, b, colour):
        x0, y0, x1, y1 = self.box(b)
        h, w = m.shape
        k = min((x1 - x0) / w, (y1 - y0) / h)
        nw, nh = max(1, round(w * k)), max(1, round(h * k))
        mm = cv2.resize(m.astype(np.float32), (nw, nh), interpolation=cv2.INTER_AREA)
        blend(self.a, mm, round((x0 + x1) / 2 - nw / 2), round((y0 + y1) / 2 - nh / 2), colour)

    def cap(self, s, x0, x1, top, base, colour, path=NARROW):
        """s with its capitals from row top to row base (photo px), its ink from column x0 to x1; descenders hang below."""
        _, Y0, _, _ = self.box((0, top, 0, top))
        _, Y1, _, _ = self.box((0, base, 0, base))
        X0, _, X1, _ = self.box((x0, 0, x1, 0))
        big = 240
        f = ImageFont.truetype(path, big)
        hb = f.getbbox("H")
        im = Image.new("L", (int(f.getlength(s) + big), int(big * 1.6)), 0)
        ImageDraw.Draw(im).text((big * 0.25, 0), s, font=f, fill=255)
        m = np.asarray(im).astype(np.float32) / 255
        cols = np.where(m.max(0) > 0.3)[0]
        m = m[:, cols.min():cols.max() + 1]
        k = (Y1 - Y0) / (hb[3] - hb[1])
        nat = m.shape[1] * k                                 # the word's own width at that height
        tw = X1 - X0
        if tw > nat * 1.18:                                  # far wider than the type: spread the letters, never stretch them
            return self.spaced(s, X0, X1, Y0, k, f, hb, colour)
        mm = cv2.resize(m, (max(1, round(tw)), max(1, round(m.shape[0] * k))), interpolation=cv2.INTER_AREA)
        blend(self.a, mm, round(X0), round(Y0 - hb[1] * k), colour)

    def spaced(self, s, X0, X1, Y0, k, f, hb, colour):
        glyphs = []
        for ch in s:
            if ch == " ":
                glyphs.append(None)
                continue
            im = Image.new("L", (int(f.getlength(ch) + 240), int(240 * 1.6)), 0)
            ImageDraw.Draw(im).text((60, 0), ch, font=f, fill=255)
            m = np.asarray(im).astype(np.float32) / 255
            cols = np.where(m.max(0) > 0.3)[0]
            glyphs.append(m[:, cols.min():cols.max() + 1])
        ws = [(g.shape[1] * k if g is not None else f.getlength(" ") * k) for g in glyphs]
        gap = (X1 - X0 - sum(ws)) / max(1, len(ws) - 1)
        x = X0
        for g, w in zip(glyphs, ws):
            if g is not None:
                mm = cv2.resize(g, (max(1, round(w)), max(1, round(g.shape[0] * k))), interpolation=cv2.INTER_AREA)
                blend(self.a, mm, round(x), round(Y0 - hb[1] * k), colour)
            x += w + gap

    def rule(self, x0, x1, y, w, colour):
        bx0, by0, bx1, by1 = self.box((x0, y - w / 2, x1, y + w / 2))
        blend(self.a, np.ones((max(1, round(by1 - by0)), max(1, round(bx1 - bx0))), np.float32), round(bx0), round(by0), colour)

    def stroke(self, pts, w, colour, closed=False):
        q = np.array([[tx(pX(x)), (self.top - pY(y)) * S] for x, y in pts]) * 8
        m = np.zeros(self.a.shape[:2], np.uint8)
        cv2.polylines(m, [np.round(q).astype(np.int32)], closed, 255, max(1, round(w * S / PKX)), cv2.LINE_AA, shift=3)
        blend(self.a, m.astype(np.float32) / 255, 0, 0, colour)

    def rrect(self, b, r, w, colour):
        """A rounded rectangle's outline: box b and radius r in photo px, line w photo px wide."""
        x0, y0, x1, y1 = self.box(b)
        rr = r * S / PKX
        k = 4
        H_, W_ = round((y1 - y0) * k) + 8, round((x1 - x0) * k) + 8
        im = Image.new("L", (W_, H_), 0)
        ImageDraw.Draw(im).rounded_rectangle([4, 4, W_ - 5, H_ - 5], radius=rr * k, outline=255, width=max(1, round(w * S / PKX * k)))
        m = np.asarray(im.resize((round(W_ / k), round(H_ / k)), Image.LANCZOS)).astype(np.float32) / 255
        blend(self.a, m, round(x0 - 1), round(y0 - 1), colour)


def icon(name):
    """Haier's marks as drawn shapes on an 8x canvas, white on black; returns a mask cropped to its ink."""
    N = 400
    im = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(im)
    t = 24

    def arc(cx, cy, r, a0, a1, w=t):
        d.arc([cx - r, cy - r, cx + r, cy + r], a0, a1, fill=255, width=w)

    def ln(pts, w=t):
        d.line(pts, fill=255, width=w, joint="curve")

    def rr(b, r, w=t):
        d.rounded_rectangle(b, radius=r, outline=255, width=w)

    if name == "playpause":          # a play triangle and two bars (Add item)
        ln([(40, 40), (40, 360), (230, 200), (40, 40)], 30); ln([(290, 40), (290, 360)], 34); ln([(360, 40), (360, 360)], 34)
    elif name == "power":
        arc(200, 220, 150, 300, 240 + 360); ln([(200, 30), (200, 210)], 30)
    elif name == "onetouch":         # a ring round a tick, open at the right (the AI Onetouch key)
        arc(190, 200, 160, 40, 330, 26); arc(190, 200, 115, 220, 500, 20); ln([(115, 205), (170, 255), (265, 150)], 26)
    elif name == "dd":               # the Super DD badge: an open ring with an arrow head, a block under it
        arc(200, 190, 140, 150, 400, 44); ln([(330, 260), (360, 190), (290, 200)], 34); d.rectangle([110, 300, 300, 360], fill=255)
    elif name == "steam":            # a shirt with a steam curl at its lower right
        ln([(150, 60), (60, 110), (30, 200), (100, 225), (110, 360), (290, 360), (300, 225), (370, 200), (340, 110), (250, 60), (230, 100), (200, 110), (170, 100), (150, 60)])
        arc(270, 290, 55, 0, 360, 22)
    elif name == "drum525":          # two rings round a dot (the 525 drum badge)
        d.ellipse([30, 30, 370, 370], outline=255, width=30); d.ellipse([110, 110, 290, 290], outline=255, width=26)
        d.ellipse([170, 170, 230, 230], fill=255)
    elif name == "haismart":         # Haier's HaiSmart mark: three house outlines stepped to the right, signal arcs in the corner
        P = lambda x, y: ((x - 170) * 1.5, (y - 75) * 1.5)
        for o in (0, 33, 68):
            pts = [P(185 + o, 345), P(185 + o, 150 + o * 0.35), P(255 + o, 88 + o * 0.35)]
            pts += [P(420, 205)] if o == 68 else [P(275 + o, 100 + o * 0.35)]
            ln(pts, 26)
        for r in (55, 105):
            arc(*P(415, 345), r * 1.5, 180, 270, 26)
        cx, cy = P(415, 345)
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=255)
    elif name == "lock":             # the child-lock mark under Temp. and Speed: a ring between two short lines
        d.ellipse([150, 140, 250, 240], outline=255, width=26); ln([(20, 190), (150, 190)], 22); ln([(250, 190), (380, 190)], 22)
        ln([(200, 140), (200, 110)], 22)
    elif name == "diamonds":         # the dial's centre mark: four small diamonds in a diamond
        for cx, cy in ((200, 90), (90, 200), (310, 200), (200, 310)):
            d.polygon([(cx, cy - 80), (cx + 80, cy), (cx, cy + 80), (cx - 80, cy)], outline=255, width=26)
    # the display's small status icons, traced from Haier's own drawing of this display (HW120-DM14F9 series manual,
    # Fig. 3-4); only the ones this model's panel photo confirms in shape (see NOTES)
    elif name == "wifi":             # three arcs over a dot
        for r in (85, 165, 245):
            arc(200, 330, r, 228, 312, 30)
        d.ellipse([178, 318, 222, 362], fill=255)
    elif name == "circ":             # a ring open at the lower right round a tick, a thin inner ring, a play mark in the gap
        arc(200, 200, 168, 75, 375, 30); arc(200, 200, 118, 0, 360, 18)
        ln([(140, 200), (188, 245), (265, 152)], 28)
        d.polygon([(300, 272), (300, 372), (382, 322)], outline=255, width=22)
    elif name == "padlock":          # a padlock: the shackle over a rounded body with a keyhole
        arc(200, 165, 82, 180, 360, 30); ln([(118, 165), (118, 205)], 30); ln([(282, 165), (282, 205)], 30)
        rr([78, 200, 322, 372], 30, 30); ln([(200, 262), (200, 306)], 30)
    elif name == "face":             # a baby's face: the head with an ear each side, a curl of hair, two eyes, a smile
        d.ellipse([60, 80, 340, 360], outline=255, width=30)
        arc(48, 225, 34, 90, 270, 26); arc(352, 225, 34, 270, 450, 26)
        arc(200, 108, 38, 180, 470, 22)
        for x in (148, 252):
            d.ellipse([x - 17, 205, x + 17, 239], fill=255)
        arc(200, 255, 48, 25, 155, 24)
    elif name == "moon":             # a crescent moon outline, two small stars at its lower right
        yy, xx = np.mgrid[0:N, 0:N]
        cres = ((xx - 175) ** 2 + (yy - 200) ** 2 < 165 ** 2) & ~((xx - 275) ** 2 + (yy - 130) ** 2 < 140 ** 2)
        er = cv2.erode(cres.astype(np.uint8), np.ones((31, 31), np.uint8)).astype(bool)
        a_ = np.asarray(im).copy(); a_[cres & ~er] = 255; im.paste(Image.fromarray(a_)); d = ImageDraw.Draw(im)
        d.ellipse([262, 250, 326, 314], outline=255, width=24); d.ellipse([318, 318, 378, 378], fill=255)
    elif name == "clock":            # a ring with its two hands at three o'clock
        d.ellipse([35, 35, 365, 365], outline=255, width=30); ln([(200, 85), (200, 205), (292, 205)], 28)
    elif name == "bottle":           # a milk bottle: cap, neck, shoulders, a level line across
        ln([(165, 35), (235, 35)], 30)
        ln([(168, 40), (168, 100), (112, 165), (112, 340), (140, 372), (260, 372), (288, 340), (288, 165), (232, 100), (232, 40)], 30)
        ln([(112, 235), (288, 235)], 22)
    elif name == "shirt":            # a T-shirt with short sleeves and a round neck
        ln([(145, 55), (55, 100), (20, 190), (95, 215), (100, 368), (300, 368), (305, 215), (380, 190), (345, 100), (255, 55),
            (230, 95), (170, 95), (145, 55)], 30)
    elif name == "iron":             # a clothes iron's sole, its curved nose at the left, the handle rising to a knob
        pts = [(30 + 200 * t_, 340 - 175 * math.sin(t_ * math.pi / 2)) for t_ in np.linspace(0, 1, 9)]
        ln(pts + [(355, 165), (370, 340), (30, 340)], 36)
        ln([(250, 165), (325, 62)], 32); d.ellipse([312, 22, 372, 82], outline=255, width=24)
    return crop_ink(np.asarray(im.resize((N // (2 if HI else 4), N // (2 if HI else 4)), Image.LANCZOS)).astype(np.float32) / 255, 0.15)


def seven(canvas, b, colour):
    """An outlined seven-segment '8' in the photo box b, the way the display's digits are drawn."""
    x0, y0, x1, y1 = canvas.box(b)
    w, h = x1 - x0, y1 - y0
    k = 8
    im = Image.new("L", (round(w * k), round(h * k)), 0)
    d = ImageDraw.Draw(im)
    W, H = w * k, h * k
    th = W * 0.2
    g = th * 0.18
    lw = max(2, round(W * 0.05))

    def hseg(yc):
        return [(th / 2 + g, yc), (th + g, yc - th / 2), (W - th - g, yc - th / 2), (W - th / 2 - g, yc), (W - th - g, yc + th / 2), (th + g, yc + th / 2)]

    def vseg(xc, ya, yb):
        return [(xc, ya + g), (xc + th / 2, ya + th / 2 + g), (xc + th / 2, yb - th / 2 - g), (xc, yb - g), (xc - th / 2, yb - th / 2 - g), (xc - th / 2, ya + th / 2 + g)]

    for p in (hseg(th / 2), hseg(H / 2), hseg(H - th / 2), vseg(th / 2, th / 2, H / 2), vseg(th / 2, H / 2, H - th / 2),
              vseg(W - th / 2, th / 2, H / 2), vseg(W - th / 2, H / 2, H - th / 2)):
        d.polygon(p, outline=255, width=lw)
    m = np.asarray(im.resize((round(w), round(h)), Image.LANCZOS)).astype(np.float32) / 255
    blend(canvas.a, m, round(x0), round(y0), colour)


WHITE, SOFT, GREY = (238, 238, 238), (206, 206, 208), (150, 151, 154)
PH = None


def photo():
    global PH
    if PH is None:
        PH = np.asarray(Image.open(os.path.join(SRC, "panel.jpg")).convert("RGB")).astype(np.float32)
    return PH


def ink_colour(box):
    """The print's own colour in a photo box: the mean of its pixels at or above 82% of the box's brightest."""
    x0, y0, x1, y1 = box
    p = photo()[y0:y1, x0:x1].reshape(-1, 3)
    L = p.max(1)
    return tuple(p[L >= L.max() * 0.82].mean(0))


def photo_art(c, box, k_sharp=0.8, thr=14):
    """The photo's coloured picture in box (photo px), enlarged and sharpened, cut from the panel by how far it stands
    from the local background."""
    x0, y0, x1, y1 = box = (math.floor(box[0]), math.floor(box[1]), math.ceil(box[2]), math.ceil(box[3]))
    p = photo()[y0:y1, x0:x1]
    X0, Y0, X1, Y1 = c.box(box)
    w, h = round(X1 - X0), round(Y1 - Y0)
    big = cv2.resize(p, (w, h), interpolation=cv2.INTER_CUBIC)
    blur = cv2.GaussianBlur(big, (0, 0), 2.5 * F)
    big = np.clip(big + (big - blur) * k_sharp, 0, 255)
    bgc = np.median(np.r_[p[0], p[-1], p[:, 0], p[:, -1]], 0)
    dist = np.abs(p - bgc).max(2)
    m = np.clip((dist - thr) / 22, 0, 1).astype(np.float32)
    m = cv2.resize(m, (w, h), interpolation=cv2.INTER_CUBIC)
    m = np.clip((m - 0.5) * 2.2 + 0.5, 0, 1)
    ya, xa = round(Y0), round(X0)
    a = c.a[ya:ya + h, xa:xa + w]
    a[:] = a * (1 - m[..., None]) + big * m[..., None]


def ink_box(box, thr=0.45):
    """The extent of the photo's light ink inside box (photo px), to the half pixel."""
    x0, y0, x1, y1 = (math.floor(box[0]), math.floor(box[1]), math.ceil(box[2]), math.ceil(box[3]))
    L = photo()[y0:y1, x0:x1].max(2)
    bg = np.percentile(L, 30)
    n = np.clip((L - bg) / max(L.max() - bg, 1), 0, 1)
    ys, xs = np.where(n > thr)
    return (x0 + xs.min() - 0.25, y0 + ys.min() - 0.25, x0 + xs.max() + 1.25, y0 + ys.max() + 1.25)


def photo_ink(c, box, colour, thr=0.38):
    """The photo's own light line art in box, enlarged with a hard edge (the display's small icons)."""
    x0, y0, x1, y1 = box = (math.floor(box[0]), math.floor(box[1]), math.ceil(box[2]), math.ceil(box[3]))
    L = photo()[y0:y1, x0:x1].max(2)
    bg = np.percentile(L, 30)
    top = max(L.max(), bg + 1)
    n = np.clip((L - bg) / (top - bg), 0, 1)
    X0, Y0, X1, Y1 = c.box(box)
    w, h = round(X1 - X0), round(Y1 - Y0)
    m = cv2.resize(n.astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    m = cv2.GaussianBlur(m, (0, 0), 0.3 * S)                   # rounder strokes: the photo's 8 px icons hold no finer shape
    m = np.clip((m - thr) * 5 + 0.5, 0, 1)
    blend(c.a, m, round(X0), round(Y0), colour)


def panel_base(h):
    """The panel's own face from the photo, every printed mark painted out (and the dial, which is modelled), enlarged."""
    p = photo().copy()
    L = p.max(2)
    bg = cv2.medianBlur(L.clip(0, 255).astype(np.uint8), 21).astype(np.float32)
    ink = (np.abs(L - bg) > 10).astype(np.uint8)
    keep = np.zeros_like(ink)
    keep[604:708, 44:346] = 1                                  # inside the drawer's section
    keep[604:709, 355:953] = 1                                 # inside the display's section
    ink &= keep
    ink = cv2.dilate(ink, np.ones((3, 3), np.uint8))
    cv2.circle(ink, (822, 653), 50, 1, -1)                     # the dial and its shadow
    p = cv2.inpaint(p.clip(0, 255).astype(np.uint8), ink * 255, 5, cv2.INPAINT_TELEA).astype(np.float32)
    # the faces are evened to their own medians (the photo's grain is noise at this size), the rims kept
    for x0, x1 in ((46, 344), (357, 951)):
        face = p[606:706, x0:x1]
        med = np.median(face.reshape(-1, 3), 0)
        rows = np.median(face, 1)
        face[:] = rows[:, None, :] * 0 + med * (rows.mean(1) / rows.mean(1).mean())[:, None, None]
    y0, y1 = PY0, PY0 + (H_MM - PANEL_BOT) * PKY
    x0, x1 = PX0 - W_MM / 2 * PKX, PX0 + W_MM / 2 * PKX
    M = np.float32([[TW / (x1 - x0), 0, -x0 * TW / (x1 - x0)], [0, h / (y1 - y0), -y0 * h / (y1 - y0)]])
    a = cv2.warpAffine(p, M, (TW, h), flags=cv2.INTER_CUBIC)
    return a + rng.normal(0, 0.8, a.shape[:2])[..., None]


PROGS = [  # name, picture box (photo px), name ink x0-x1
    ("Mix", (381, 665, 401, 688), (385, 396.5)), ("Quick", (410, 665, 430, 688), (411, 428.5)),
    ("Heavy", (438, 665, 461, 688), (440, 458.5)), ("Cotton", (467, 665, 489, 688), (467, 488.5)),
    ("Sport", (497, 665, 518, 688), (499, 515.5)), ("Jeans", (529, 665, 545, 688), (527, 545.5)),
    ("Delicate", (553, 665, 576, 688), (554, 577.5)), ("Shirt", (582, 665, 605, 688), (586, 600.5)),
    ("Babycare", (613, 665, 635, 688), (612, 635.5)), ("Towel", (641, 665, 664, 688), (643, 661.5)),
    ("Spin", (670, 665, 692, 688), (673, 687.5)), ("Self Clean", (699, 665, 724, 688), (698, 723.5)),
    ("Remote", (729, 662, 753, 689), (728, 751.5)),
]


def panel():
    """The panel, 600 x 79 mm (771-850 mm up): the drawer's section at the left, the display, the dial's place, the keys."""
    h = round((H_MM - PANEL_BOT) * S)
    c = Canvas(panel_base(h), H_MM)
    # ── the drawer's section: Haier's wordmark, the three badges, HaiSmart ──
    lg = Image.open(os.path.join(LOGOS, "haier.png")).getchannel("A")
    c.place(crop_ink(np.asarray(lg).astype(np.float32) / 255), (90, 617, 154.5, 638.5), WHITE)
    for ic, box in (("dd", (89, 684.5, 100.5, 695.5)), ("steam", (132.5, 684, 144.5, 695.5)), ("drum525", (175, 684, 186, 695))):
        c.place(icon(ic), box, SOFT)
    c.cap("SUPER DD", 101.5, 127.5, 686.6, 690.4, SOFT, BOLD)
    c.cap("INVERTER", 101.5, 127.5, 691.6, 694.2, GREY, ARIAL)
    c.cap("STEAM", 149, 166.5, 688.2, 692.2, SOFT, BOLD)
    c.cap("525 DRUM", 189.5, 210.5, 688.2, 692.2, SOFT, BOLD)
    for x0, x1 in ((100.5, 128.5), (145.5, 170), (186.5, 214)):     # the rules above and under each badge's words
        for y in (685.6, 695.2):
            c.rule(x0, x1, y, 0.45, GREY)
    c.place(icon("haismart"), (279.5, 679, 295, 695.5), WHITE)
    c.cap("Haismart", 277.5, 297.5, 697.2, 700.4, SOFT, ARIAL)

    # ── the display ──
    c.cap("Night", 382, 398.5, 630, 636.4, WHITE)
    c.cap("Stain", 406, 419.5, 630, 636.4, WHITE)
    for x0, x1 in ((382, 398), (405, 420.5)):
        c.rule(x0, x1, 640.2, 0.9, GREY)
    c.cap("AI", 427.2, 435, 621.5, 628.6, WHITE, ARIAL)
    # the 11 small icons beside the time: 9 drawn as shapes (each fitted to the ink box this model's photo shows for it), the
    # 2 the manual's drawing doesn't confirm kept as the photo's own ink
    for name, box in (("bottle", (426.5, 631, 436, 643)), ("shirt", (426, 644, 436, 654)), (None, (437.5, 619, 448, 631)),
                      ("iron", (437.5, 631.5, 448, 643)), (None, (437.5, 644, 448, 654)), ("wifi", (532, 620, 542.5, 630)),
                      ("padlock", (532, 632, 542, 642.5)), ("moon", (532, 644, 542.5, 654)), ("circ", (543.5, 620, 554, 630.5)),
                      ("face", (542.5, 632, 554.5, 643)), ("clock", (543.5, 644, 554, 654))):
        if name:
            c.place(icon(name), ink_box(box), WHITE)
        else:
            photo_ink(c, box, WHITE)
    for x0 in (449, 468, 492.5, 511):
        seven(c, (x0, 621, x0 + 15.5, 652.5), WHITE)
    for y in (628.5, 639.5):
        c.rule(487.2, 489.4, y + 2.4, 4.6, WHITE)
    blue = ink_colour((571, 629, 588, 638))
    blue = tuple(min(255, v * 1.15) for v in blue)
    for text, x0, x1, col in (("Steam", 571, 587.5, blue), ("Delay", 594, 609.5, WHITE), ("Time", 617, 632.5, WHITE),
                              ("Temp.", 640, 655.5, WHITE), ("Speed", 663, 678.5, WHITE), ("Rinse+", 685, 700.5, WHITE),
                              ("Eco", 710, 721.5, WHITE)):
        c.cap(text, x0, x1, 630, 636.4, col)
        ux0, ux1 = (708, 723.5) if text == "Eco" else (x0 - 0.5, x1 + 0.5)
        c.rule(ux0, ux1, 640.2, 0.9, GREY if text != "Steam" else blue)
    c.place(icon("lock"), (649, 646.5, 668.5, 653.5), GREY)
    c.place(icon("playpause"), (733, 626, 746.5, 638.5), WHITE)
    c.cap("Add item", 732, 748.5, 640.3, 643.6, SOFT, ARIAL)
    for name, box, (x0, x1) in PROGS:
        photo_art(c, box)
        c.cap(name, x0, x1, 690, 695.8, WHITE)

    # ── the keys at the right: the power key and the AI Onetouch key, outlined ──
    c.rrect((881.5, 630.5, 938, 654.5), 5, 1.2, SOFT)
    c.rrect((881.5, 662.5, 938, 686), 5, 1.2, SOFT)
    c.place(icon("power"), (900, 635.5, 912.5, 649), WHITE)
    c.place(icon("onetouch"), (888.5, 666.5, 902, 680.5), SOFT)
    c.cap("AI Onetouch", 904, 934.5, 669.2, 675.2, SOFT)
    c.cap("Hold 3s", 912, 928.5, 677, 679.8, GREY, ARIAL)
    a = c.a
    if HI:
        return a
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "panel.jpg", 92)


def strip():
    """The strip under the panel, 600 x 34 mm (737-771 mm up): the drawer's ribbed grip at the left, the DIRECT MOTION plate
    between two ribbed chevrons, the ribbed recess at the right; the photo's own light and shade, enlarged, the plate's words
    set again."""
    ph = Image.open(os.path.join(SRC, "panel.jpg")).convert("RGB")
    y0, y1 = PY0 + (H_MM - PANEL_BOT) * PKY, PY0 + (H_MM - STRIP_BOT) * PKY
    h = round((PANEL_BOT - STRIP_BOT) * S)
    a = np.asarray(ph.crop((PX0 - W_MM / 2 * PKX, y0, PX0 + W_MM / 2 * PKX, y1)).resize((TW, h), Image.LANCZOS)).astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), 1.0 * F)
    c = Canvas(a, PANEL_BOT)
    # strip rows map by the strip's own scale
    ks = (y1 - y0) / (PANEL_BOT - STRIP_BOT)
    yrow = lambda r: (r - y0) / ks * S
    px0, px1 = tx(pX(395)), tx(pX(607))
    face = a[round(yrow(726)):round(yrow(754)), round(px0):round(px1)]
    face[:] = np.median(face.reshape(-1, 3), 0) * np.linspace(1.04, 0.96, face.shape[0])[:, None, None]
    # DIRECT MOTION: capitals rows 738-746, ink columns 462-536
    big = 240
    f = ImageFont.truetype(BOLD, big)
    hb = f.getbbox("H")
    im = Image.new("L", (int(f.getlength("DIRECT MOTION") + big), int(big * 1.6)), 0)
    ImageDraw.Draw(im).text((big * 0.25, 0), "DIRECT MOTION", font=f, fill=255)
    m = crop_ink(np.asarray(im).astype(np.float32) / 255)
    Y0, Y1 = yrow(738), yrow(746.2)
    X0, X1 = tx(pX(462)), tx(pX(536.5))
    mm = cv2.resize(m, (round(X1 - X0), round(Y1 - Y0)), interpolation=cv2.INTER_AREA)
    blend(a, mm, round(X0), round(Y0), (228, 228, 230))
    if HI:
        return a
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "strip.jpg", 90)


def knob_top():
    """The dial's face, 704 px across its 56.8 mm (12.4 px per mm): dark, a faint ring of light at its rim, the four-diamond mark at its
    centre (9 mm across in the panel photo)."""
    n = 704
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    r = np.hypot(xx - n / 2, yy - n / 2) / (n / 2)
    a = 34 + 6 * (1 - r) + np.clip((r - 0.93) / 0.07, 0, 1) * 40
    a = np.repeat(a[..., None], 3, 2) * np.array([1.0, 1.01, 1.04])
    a += rng.normal(0, 1.0, a.shape[:2])[..., None]
    m = icon("diamonds")
    k = (9.0 / 56.8 * n) / max(m.shape)
    m = cv2.resize(m, (round(m.shape[1] * k), round(m.shape[0] * k)), interpolation=cv2.INTER_AREA)
    blend(a, m, n // 2 - m.shape[1] // 2, n // 2 - m.shape[0] // 2, (170, 172, 176))
    Image.fromarray(a.clip(0, 255).astype(np.uint8)).save(os.path.join(D, "knob_top.jpg"), quality=90, subsampling=0, optimize=True)
    print("wrote knob_top.jpg")


def front():
    """The front below the strip, 600 x 725 mm (12-737 mm up), 2 px per mm: the photo's own paint with the studio light
    evened out and tinted to the cabinet's colour, the door and its seat filled in from round about, the flap kept."""
    ph = np.asarray(Image.open(os.path.join(SRC, "front.jpg")).convert("RGB")).astype(np.float32)
    k = 2.0
    w, h = round(W_MM * k), round((STRIP_BOT - FEET) * k)
    xs = FX0 + (np.arange(w) / k - W_MM / 2) * FKX
    ys = FYB - (STRIP_BOT - np.arange(h) / k) * FKY
    mx, my = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
    a = cv2.remap(ph, mx, my, cv2.INTER_LINEAR)
    a[:, :4] = a[:, 4:5]; a[:, -4:] = a[:, -5:-4]
    yy, xx = np.mgrid[0:h, 0:w]
    Xmm, Ymm = xx / k - W_MM / 2, STRIP_BOT - yy / k
    r = np.hypot(Xmm - DOOR["x"], Ymm - DOOR["y"])
    lum = a.mean(2)
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y, y ** 3, x * y * y], -1).reshape(-1, 8)
    use = ((r > DISH_R + 12) & (np.hypot(Xmm - FLAP["x"], Ymm - FLAP["y"]) > FLAP["r"] + 6) & (yy > 8)).reshape(-1)
    use &= (xx.reshape(-1) > 12) & (xx.reshape(-1) < w - 12)
    cf, *_ = np.linalg.lstsq(A[use], np.log(np.maximum(lum, 1)).reshape(-1)[use], rcond=None)
    n = lum / np.exp(A @ cf).reshape(h, w)
    n = 1 + (n / np.median(n.reshape(-1)[use]) - 1) * 0.7
    a = np.clip(n, 0.3, 2.0)[..., None] * BODY
    R0 = DISH_R + 9
    ang = np.arctan2(Ymm - DOOR["y"], Xmm - DOOR["x"])
    ts = np.linspace(-np.pi, np.pi, 721)
    sx = (DOOR["x"] + R0 * np.cos(ts) + W_MM / 2) * k
    sy = (STRIP_BOT - (DOOR["y"] + R0 * np.sin(ts))) * k
    ok = (sx >= 0) & (sx < w) & (sy >= 8) & (sy < h)
    ring = np.zeros((len(ts), 3), np.float32)
    ring[ok] = a[sy[ok].astype(int), sx[ok].astype(int)]
    med = np.median(a.reshape(-1, 3), 0)
    iok = np.where(ok)[0]
    for ch in range(3):
        ring[~ok, ch] = np.interp(np.where(~ok)[0], np.r_[iok - 721, iok, iok + 721], np.tile(ring[iok, ch], 3))
    ker = np.exp(-np.linspace(-3, 3, 61) ** 2)
    ker /= ker.sum()
    ring = np.stack([np.convolve(np.r_[ring[-30:, ch], ring[:, ch], ring[:30, ch]], ker, "same")[30:-30] for ch in range(3)], 1)
    idx = np.clip(np.round((ang + np.pi) / (2 * np.pi) * 720).astype(int), 0, 720)
    t = np.clip(r / R0, 0, 1)[..., None] ** 2
    fill = ring[idx] * t + med * (1 - t) + rng.normal(0, 1.0, (h, w))[..., None]
    hole = cv2.GaussianBlur((r < DISH_R + 6).astype(np.float32), (0, 0), 1.5)[..., None]
    a = cv2.GaussianBlur(a, (0, 0), 0.8) * (1 - hole) + fill * hole
    a[:6] = a[6:7]
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "front.jpg", 88)


def side(name, photo_name, quad, front_left):
    """A side wall from Haier's 3/4 photo, made square-on with a perspective warp of its four corners (photo px: front top,
    back top, back bottom, front bottom), 1.5 px per mm; the studio light evened out, the pressed relief kept at 70%."""
    ph = np.asarray(Image.open(os.path.join(SRC, photo_name)).convert("RGB")).astype(np.float32)
    k = 1.5
    w, h = round(D_CAB * k), round((H_MM - FEET) * k)
    ft, bt, bb, fb = quad
    dst = [(0, 0), (w, 0), (w, h), (0, h)] if front_left else [(w, 0), (0, 0), (0, h), (w, h)]
    M = cv2.getPerspectiveTransform(np.float32([ft, bt, bb, fb]), np.float32(dst))
    a = cv2.warpPerspective(ph, M, (w, h), flags=cv2.INTER_AREA)
    lum = a.mean(2)
    yy, xx = np.mgrid[0:h, 0:w]
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    cf, *_ = np.linalg.lstsq(A, np.log(np.maximum(lum, 1)).reshape(-1), rcond=None)
    n = lum / np.exp(A @ cf).reshape(h, w)
    n = 1 + (n / np.median(n) - 1) * 0.7
    n = cv2.GaussianBlur(n, (0, 0), 0.7)
    out = np.clip(np.clip(n, 0.3, 2.0)[..., None] * BODY, 0, 255)
    save(Image.fromarray(out.astype(np.uint8)), name, 88)


def drum():
    """The drum wall, front (top) to back, a 96 mm strip of its circumference: pillows behind the lip, a double rib, staggered
    holes, plain steel (Haier's open-door photos of this model; the bands, pitch and holes ESTIMATED)."""
    k = 4.0
    w, h = round(96 * k), round(330 * k)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ymm, xmm = yy / k, xx / k
    a = 150 + 22 * np.cos(xmm / 96 * 2 * np.pi) + cv2.GaussianBlur(rng.normal(0, 14, (h, w)).astype(np.float32), (0, 0), sigmaX=0.6, sigmaY=30)
    P = 9.0
    u, v = (xmm % P) / P - 0.5, ((ymm - 18) % P) / P - 0.5
    sq = (np.maximum(abs(u), abs(v)) < 0.39)
    edge = np.clip((0.39 - np.maximum(abs(u), abs(v))) * 30, 0, 1)
    lit = np.where(abs(u) > abs(v), np.sign(-u), np.sign(-v))
    zone = (ymm > 18) & (ymm < 110)
    a = np.where(zone, np.where(sq, a * (1.05 + 0.18 * lit * (1 - edge)), a * 0.62), a)
    for cc in (115.0, 122.5):
        dd = abs(ymm - cc)
        a = np.where(dd < 2.6, a * (1.25 - 0.35 * (dd / 2.6) ** 2), a)
    img = np.repeat(a[..., None], 3, 2) * np.array([1.0, 1.01, 1.03])
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    rr, pitch = 2.25 * k, 9.5 * k
    for i, y in enumerate(np.arange(135 * k, 250 * k, pitch * 0.866)):
        off = (pitch / 2) if i % 2 else 0
        for x in np.arange(off - pitch, w + pitch, pitch):
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(20, 21, 23))
            d.arc([x - rr - 1, y - rr - 1, x + rr + 1, y + rr + 1], 200, 340, fill=(205, 207, 210), width=2)
    save(im, "drum.jpg", 86)


# ── --hi: the print decals (12 px per mm), each piece under 4096 px; decals.json gives each piece's face and its u, v
# rectangle in that face's own UVs. The dial's place (columns 770-870) is left out: the dial is modelled. ──
PIECES = {   # name: (face, photo box x0, y0, x1, y1 in panel.jpg px)
    "drawer": ("panel", 80, 612, 302, 703),
    "display": ("panel", 376, 616, 757, 701),
    "keys": ("panel", 878, 626, 942, 690),
    "plate": ("plate", 452, 735, 547, 749),
}


def decals():
    canv = {"panel": (panel(), H_MM, H_MM - PANEL_BOT, "panel.jpg"), "plate": (strip(), PANEL_BOT, PANEL_BOT - STRIP_BOT, "strip.jpg")}
    y0s = PY0 + (H_MM - PANEL_BOT) * PKY
    ks = ((H_MM - STRIP_BOT) * PKY - (H_MM - PANEL_BOT) * PKY) / (PANEL_BOT - STRIP_BOT)
    out = {}
    for key, (face, x0, y0, x1, y1) in PIECES.items():
        a, top, span, base = canv[face]
        X0, X1 = round(tx(pX(x0))), round(tx(pX(x1)))
        if face == "plate":
            Y0, Y1 = round((y0 - y0s) / ks * S), round((y1 - y0s) / ks * S)
        else:
            Y0, Y1 = round((top - pY(y0)) * S), round((top - pY(y1)) * S)
        assert X1 - X0 <= 4096 and Y1 - Y0 <= 4096
        piece = a[Y0:Y1, X0:X1] * SHADE.get(base, 1.0)
        name = f"print_{key}.jpg"
        Image.fromarray(piece.clip(0, 255).astype(np.uint8)).save(os.path.join(D, name), quality=88, subsampling=0, optimize=True)
        h, w = a.shape[:2]
        out[key] = {"file": name, "face": face, "rect": [X0 / w, Y0 / h, X1 / w, Y1 / h]}
        print("wrote", name, (X1 - X0, Y1 - Y0))
    with open(os.path.join(D, "decals.json"), "w") as fh:
        json.dump(out, fh, indent=1)


if HI:
    decals()
    sys.exit(0)
panel()
strip()
knob_top()
front()
side("side_l.jpg", "l34.jpg", [(347, 141), (198, 180), (205, 808), (350, 852)], front_left=False)
side("side_r.jpg", "r34.jpg", [(648, 145), (803, 182), (797, 805), (643, 853)], front_left=True)
drum()

m = lambda v: round(v / 1000, 5)
layout = {
    "feet": m(FEET), "panel_bot": m(PANEL_BOT), "strip_bot": m(STRIP_BOT), "d_cab": m(D_CAB), "door_proud": m(DOOR_PROUD),
    "glass": [m(v) for v in GLASS], "seam": m(SEAM), "drawer": [m(v) for v in DRAWER], "lip": [m(v) for v in LIP],
    "plate": [m(v) for v in PLATE], "knob": {"x": m(KNOB["x"]), "y": m(KNOB["y"]), "r": m(KNOB["r"])},
    "door": {"x": m(DOOR["x"]), "y": m(DOOR["y"]), "rim": m(RIM_R), "dish": m(DISH_R)},
    "flap": {"x": m(FLAP["x"]), "y": m(FLAP["y"]), "r": m(FLAP["r"])}, "feet_x": [m(v) for v in FEET_X],
}
with open(os.path.join(D, "layout.json"), "w") as f:
    json.dump(layout, f, indent=1)
print(json.dumps(layout))
