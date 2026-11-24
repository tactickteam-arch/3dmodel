"""Textures for the Haier HW90-DM14929EBKF, 9 kg front-load washer (929 series), Black.

usage: python3 tex_haier_hw90.py <photos dir> <logos dir> <out dir>
  photos: haier_hw90/panel_art.png   Haier's own picture of this model's control panel (the band cut from a product image
                                     Haier put on its marketplace listing of this model, which it sells online as
                                     EFL90-DM14IBIEBK; BEE's register files both codes as one 9 kg, 5 star front loader)
          haier_hw90/haier/W020240424518074963603_1200.jpg   Haier India's gallery: 3/4 from the right (the right side)
          haier_hw90/haier/W020240424518075168681_1200.jpg   Haier India's gallery: 3/4 from the left (the left side)
  logos:  haier.png
  writes <out dir>/haier_hw90/*.jpg, layout.json, decals_*.json, keys.json

Size. Haier India's page for this model gives 595 x 500 x 850 mm (W x D x H); the manual's technical data agrees.

The control panel. The black glass band across the top is 109 mm tall in Haier's straight-on front photo (741-850 mm): a
short upright lip under a face that leans back (ESTIMATED 30 degrees; the 3/4 photos show the lip about 28 mm tall). The
print is set from Haier's panel picture (panel_art.png): every word, line, icon and key is placed where that picture has it.
The picture sees the leaning face from in front: its columns are 2.321 px per mm across (the band's 595 mm span 1381 px),
and down the face 0.5217 mm per px (the dial's ring, round on the machine, is 0.826 as tall as wide in the picture); below
the fold (picture row 199.3) the lip runs to the band's foot (row 251). The words are set in Avenir Next, each fitted to the
picture's own ink box; the icons are drawn as lines from the picture (the manual's drawing, Fig. 3-1, carries the same
layout, but its icons are low-resolution bitmaps); the digits are the picture's outlined seven-segment 88:88. The picture
shows the Steam key, the dial's ring and the programme marks lit cyan; they are set in cyan.
The manual's drawing prints "9.0 kg" on the drawer; Haier's pictures of this model do not, so it is left out.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "haier_hw90")
D = os.path.join(OUT, "haier_hw90")
os.makedirs(D, exist_ok=True)

W_MM, H_MM, D_MM = 595.0, 850.0, 500.0
FEET = 11.4                       # ESTIMATED: the feet show 14 px under the cabinet in Haier's front photo (1.23 px per mm)
TILT = math.radians(30)           # ESTIMATED (above)
LIP_TOP = 769.0                   # ESTIMATED: a 28 mm upright lip
PANEL_BOT = 741.0                 # the band's lower edge in Haier's front photo (109 mm under the top)
SLANT = (H_MM - LIP_TOP) / math.cos(TILT)    # the leaning face along its slope (93.5 mm)
SIDE_TOP = 815.0                  # ESTIMATED: the side sheets' top edge under the black top cover (3/4 photos: 804-817 mm)

# panel picture (panel_art.png) -> the face: u mm across from the middle, s mm down the slope, then l mm down the lip
CX, KX = 716.5, 2.321
Y0, KS = 20.0, 0.5217
YF = Y0 + SLANT / KS              # the fold between the leaning face and the lip (row 199.3)
YB = 251.0                        # the band's foot
KL = (LIP_TOP - PANEL_BOT) / (YB - YF)
pu = lambda X: (X - CX) / KX


S = 12.0                          # print px per mm
PW = round(W_MM * S)
OUT_SLANT = round(SLANT * S)
OUT_H = OUT_SLANT + round((LIP_TOP - PANEL_BOT) * S)
col = lambda X: (pu(X) + W_MM / 2) * S
row = lambda Y: (Y - Y0) * KS * S if Y <= YF else OUT_SLANT + (Y - YF) * KL * S

GLASS = (18, 19, 21)              # the picture's glass where nothing reflects
WINDOW = (13, 11, 12)             # the display's window, a touch darker than the glass
DIGIT_BOX = (66, 66, 68)          # the grey plate behind 88:88
KEY = (52, 57, 62)                # the six keys' faces
RECESS = (32, 27, 27)             # the drawer's finger recess (the picture: 25-44, darkest at its top)
WHITE = (232, 233, 236)
LINE = (205, 207, 211)            # the dial's right-hand lines and the rule under the icons
DIGIT = (214, 215, 218)
CYAN = (38, 166, 192)             # the picture's lit cyan (Steam, the ring, the programme marks)
RING_GREY = (88, 85, 83)          # the thin ring outside the cyan one

SS = 4                            # supersampling for the drawn lines


def comp(canvas, alpha, colour, x0, y0):
    """lay a colour through an alpha (float, 0-1) onto the canvas at integer (x0, y0)"""
    h, w = alpha.shape
    X0, Y0_, X1, Y1 = max(0, x0), max(0, y0), min(canvas.shape[1], x0 + w), min(canvas.shape[0], y0 + h)
    if X1 <= X0 or Y1 <= Y0_:
        return
    a = alpha[Y0_ - y0:Y1 - y0, X0 - x0:X1 - x0][..., None]
    canvas[Y0_:Y1, X0:X1] = canvas[Y0_:Y1, X0:X1] * (1 - a) + np.array(colour, np.float32) * a


class Ink:
    """Lines, rings and shapes in canvas px, drawn 4x oversampled and laid on in one colour."""

    def __init__(self):
        self.ops = []

    def line(self, pts, w):
        self.ops.append(("line", [tuple(p) for p in pts], w))
        return self

    def poly(self, pts, w=None):
        """closed outline (w) or filled (w None)"""
        self.ops.append(("poly", [tuple(p) for p in pts], w))
        return self

    def circle(self, c, r, w=None):
        self.ops.append(("circle", (c, r), w))
        return self

    def arc(self, c, r, a0, a1, w, n=None):
        n = n or max(12, int(abs(a1 - a0) * r / 3))
        t = np.linspace(math.radians(a0), math.radians(a1), n)
        return self.line([(c[0] + r * math.cos(v), c[1] + r * math.sin(v)) for v in t], w)

    def draw(self, canvas, colour):
        pts = []
        for k, a, w in self.ops:
            if k == "circle":
                (cx, cy), r = a
                pts += [(cx - r, cy - r), (cx + r, cy + r)]
            else:
                pts += a
        pts = np.array(pts)
        pad = 8
        x0, y0 = int(math.floor(pts[:, 0].min())) - pad, int(math.floor(pts[:, 1].min())) - pad
        x1, y1 = int(math.ceil(pts[:, 0].max())) + pad, int(math.ceil(pts[:, 1].max())) + pad
        m = np.zeros(((y1 - y0) * SS, (x1 - x0) * SS), np.uint8)
        P = lambda p: (int(round((p[0] - x0) * SS * 16)), int(round((p[1] - y0) * SS * 16)))
        for k, a, w in self.ops:
            t = None if w is None else max(1, int(round(w * SS)))
            if k == "line":
                cv2.polylines(m, [np.array([P(p) for p in a], np.int32)], False, 255, t, cv2.LINE_AA, 4)
            elif k == "poly":
                q = np.array([P(p) for p in a], np.int32)
                if t is None:
                    cv2.fillPoly(m, [q], 255, cv2.LINE_AA, 4)
                else:
                    cv2.polylines(m, [q], True, 255, t, cv2.LINE_AA, 4)
            else:
                (cx, cy), r = a
                c = P((cx, cy))
                cv2.circle(m, c, int(round(r * SS * 16)), 255, -1 if t is None else t, cv2.LINE_AA, 4)
        a = cv2.resize(m.astype(np.float32) / 255, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA)
        comp(canvas, np.clip(a, 0, 1), colour, x0, y0)


def rrect(canvas, X0, Y0_, X1, Y1, r_mm, colour):
    """a rounded rectangle given in picture px (mapped to the face), corner radius in mm"""
    x0, x1, y0, y1, r = col(X0), col(X1), row(Y0_), row(Y1), r_mm * S
    pts = []
    for (cx, cy, a0) in [(x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)]:
        for t in range(0, 91, 6):
            a = math.radians(a0 + t)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    Ink().poly(pts).draw(canvas, colour)


FONT = "/System/Library/Fonts/Avenir Next.ttc"
FACE = {"reg": 7, "med": 5, "demi": 2, "bold": 0}


def word(canvas, text, box, colour, face="med"):
    """the word's ink fitted to the picture's ink box (picture px)"""
    X0, Y0_, X1, Y1 = box
    x0, x1, y0, y1 = col(X0), col(X1), row(Y0_), row(Y1)
    f = ImageFont.truetype(FONT, 400, index=FACE[face])
    bb = f.getbbox(text)
    im = Image.new("L", (bb[2] - bb[0] + 80, bb[3] - bb[1] + 80), 0)
    ImageDraw.Draw(im).text((40 - bb[0], 40 - bb[1]), text, font=f, fill=255)
    im = im.crop(im.getbbox())
    a = np.asarray(im).astype(np.float32) / 255
    sx, sy = (x1 - x0) / a.shape[1], (y1 - y0) / a.shape[0]
    ix0, iy0 = int(math.floor(x0)) - 2, int(math.floor(y0)) - 2
    w, h = int(math.ceil(x1)) - ix0 + 3, int(math.ceil(y1)) - iy0 + 3
    M = np.array([[sx, 0, x0 - ix0], [0, sy, y0 - iy0]], np.float32)
    A = cv2.warpAffine(a, M, (w, h), flags=cv2.INTER_AREA)
    comp(canvas, np.clip(A, 0, 1), colour, ix0, iy0)


def at(X, Y):
    """a point of the picture on the canvas"""
    return (col(X), row(Y))


def icon_frame(X, Y, size_px):
    """an icon's frame: its centre at picture (X, Y), its size the picture's width (size_px) in mm; unit coordinates
    (-0.5..0.5, y down) -> canvas px, round on the machine"""
    cx, cy = at(X, Y)
    s = size_px / KX * S
    return lambda x, y: (cx + x * s, cy + y * s), s


def tee(F, s, w, curl=True):
    """a shirt outline (the programme marks, Steam's and the display's shirt), with the small curl inside"""
    ink = Ink()
    out = [(-0.17, -0.42), (-0.48, -0.27), (-0.5, -0.03), (-0.3, 0.0), (-0.3, 0.44), (0.3, 0.44), (0.3, 0.0), (0.5, -0.03),
           (0.48, -0.27), (0.17, -0.42)]
    neck = [(0.17 * math.cos(t), -0.42 + 0.14 * math.sin(t)) for t in np.linspace(0, math.pi, 9)]
    ink.line([F(*p) for p in out + neck + [out[0]]], w * s)
    if curl:
        t = np.linspace(0, 1.6 * math.pi, 18)
        ink.line([F(0.02 + 0.12 * math.cos(v) * (1 - v / 9), 0.2 + 0.12 * math.sin(v) * (1 - v / 9)) for v in t], w * s)
    return ink


def clock(F, s, w):
    ink = Ink()
    ink.arc(F(0, 0), 0.43 * s, -50, 250, w * s)
    ink.line([F(0, -0.25), F(0, 0.02), F(0.2, 0.02)], w * s)
    ink.line([F(0.31, -0.42), F(0.28, -0.28), F(0.42, -0.25)], w * s)
    return ink


# ════════ the panel, drawn at 12 px per mm, unfolded (the leaning face's rows, then the lip's) ════════
P = np.zeros((OUT_H, PW, 3), np.float32)
P[:] = GLASS

# ── the drawer (left of the seam): Haier, "Direct motion", the 525 DRUM and REFRESH badges, the finger recess ──
SEAM_X = 443.8                    # the drawer's right edge in the picture (Haier's front photo agrees: 117 mm left of the middle)
rrect(P, 123, 124, 329, 182, 4.0, RECESS)
logo = np.asarray(Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")).astype(np.float32)
la = logo[..., 3] / 255
ys, xs = np.where(la > 0.1)
la = la[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
lx0, lx1, ly0, ly1 = col(124), col(203), row(38), row(65)
lm = cv2.resize(la, (round(lx1 - lx0), round(ly1 - ly0)), interpolation=cv2.INTER_AREA)
comp(P, lm, WHITE, round(lx0), round(ly0))
word(P, "Direct motion", (128, 108, 204, 118), (214, 215, 219), "med")
# the badges: a drum mark (two rings and a dot) and "525 DRUM" between two rules; a shirt mark and "REFRESH" between two rules
F, s = icon_frame(252.5, 114, 13)
Ink().circle(F(0, 0), 0.45 * s, 0.09 * s).circle(F(0, 0), 0.24 * s, 0.09 * s).circle(F(0, 0), 0.07 * s).draw(P, (206, 207, 211))
word(P, "525 DRUM", (262, 111, 286, 117), (206, 207, 211), "demi")
F, s = icon_frame(298, 114.5, 13)
tee(F, s, 0.08).draw(P, (206, 207, 211))
word(P, "REFRESH", (308, 111, 331, 117), (206, 207, 211), "demi")
for (x0, x1) in ((260.5, 287.5), (306.5, 332.5)):
    for y in (109.6, 118.6):
        Ink().line([at(x0, y), at(x1, y)], 0.22 * S).draw(P, (206, 207, 211))
# the seam: a fine dark line where the drawer meets the panel
Ink().line([(col(SEAM_X), 0), (col(SEAM_X), OUT_H)], 0.5 * S).draw(P, (6, 6, 7))

# ── the display: the window, the grey plate with 88:88 and its four marks, the six icons over a rule ──
rrect(P, 532, 35, 902, 208, 2.0, WINDOW)
rrect(P, 648, 58.5, 786, 101.5, 0.8, DIGIT_BOX)


def seg_digit(ink, x0, x1, y0, y1, w):
    """an outlined seven-segment 8: each bar a hexagon outline (the picture's digits are outlines on the grey plate)"""
    X0, X1, Ya, Yb = col(x0), col(x1), row(y0), row(y1)
    t = (X1 - X0) * 0.22
    g = t * 0.18
    Ym = (Ya + Yb) / 2
    hbar = lambda xa, xb, y: [(xa + g, y), (xa + g + t / 2, y - t / 2), (xb - g - t / 2, y - t / 2), (xb - g, y), (xb - g - t / 2, y + t / 2), (xa + g + t / 2, y + t / 2)]
    vbar = lambda x, ya, yb: [(x, ya + g), (x + t / 2, ya + g + t / 2), (x + t / 2, yb - g - t / 2), (x, yb - g), (x - t / 2, yb - g - t / 2), (x - t / 2, ya + g + t / 2)]
    L, R, T, B = X0 + t / 2, X1 - t / 2, Ya + t / 2, Yb - t / 2
    for p in (hbar(L, R, T), hbar(L, R, Ym), hbar(L, R, B), vbar(L, T, Ym), vbar(R, T, Ym), vbar(L, Ym, B), vbar(R, Ym, B)):
        ink.poly(p, w)


dig = Ink()
for (x0, x1) in ((667, 686), (691, 709.5), (720, 739), (745, 764)):
    seg_digit(dig, x0, x1, 60.8, 99.8, 0.42 * S)
dig.draw(P, DIGIT)
for (y0, y1) in ((73, 80), (84, 89)):
    rrect(P, 714.2, y0, 716.8, y1, 0.3, DIGIT)
# the plate's marks: delay clock (top left), a shirt (bottom left), the child lock (top right), a round drum mark (bottom right)
F, s = icon_frame(656.5, 66.5, 13)
clock(F, s, 0.09).draw(P, DIGIT)
F, s = icon_frame(657, 95, 13)
tee(F, s, 0.09).draw(P, DIGIT)
F, s = icon_frame(776, 66.5, 12)
Ink().poly([F(-0.36, -0.05), F(0.36, -0.05), F(0.36, 0.45), F(-0.36, 0.45)], 0.09 * s).arc(F(0, -0.05), 0.24 * s, 180, 360, 0.09 * s) \
    .line([F(-0.24, -0.05), F(-0.24, -0.06)], 0.09 * s).circle(F(0, 0.2), 0.06 * s).draw(P, DIGIT)
F, s = icon_frame(775, 95, 13)
Ink().circle(F(0, 0), 0.44 * s, 0.09 * s).circle(F(0, -0.2), 0.07 * s).circle(F(0, 0.2), 0.07 * s).circle(F(-0.2, 0), 0.07 * s) \
    .circle(F(0.2, 0), 0.07 * s).draw(P, DIGIT)

# the icon row (picture rows 113-132): Delay's clock, Steam's shirt (cyan), Temp.'s thermometer, Speed's spiral, Extra
# Rinse's shirt and drops, Start/Pause's play and pause
IW = 0.075                        # their line weight, as a share of the icon's size
F, s = icon_frame(582.5, 123, 17)
clock(F, s, IW).draw(P, WHITE)
F, s = icon_frame(636, 122.5, 18)
ink = tee(F, s, IW, curl=False)
t = np.linspace(0, 1.75 * math.pi, 24)
ink.line([F(0.04 + (0.05 + 0.03 * v) * math.cos(v + 1.2), 0.18 + (0.05 + 0.03 * v) * math.sin(v + 1.2)) for v in t], IW * s)
ink.draw(P, CYAN)
F, s = icon_frame(689.5, 122.5, 15)
ink = Ink()
st = [(-0.11, 0.18), (-0.11, -0.36)] + [(0.11 * math.cos(v), -0.36 + 0.11 * math.sin(v)) for v in np.linspace(math.pi, 2 * math.pi, 9)] + [(0.11, 0.18)]
ink.line([F(*p) for p in st], IW * s)
ink.arc(F(0, 0.33), 0.2 * s, -60, 240, IW * s)
ink.line([F(0, 0.33), F(0, -0.2)], IW * s * 1.1)
ink.circle(F(0, 0.33), 0.09 * s)
for y in (-0.33, -0.18, -0.03):
    ink.line([F(0.22, y), F(0.4, y)], IW * s)
ink.draw(P, WHITE)
F, s = icon_frame(743, 123, 16)
t = np.linspace(0, 2.3 * 2 * math.pi, 140)
Ink().line([F(0.46 * (v / t[-1]) * math.cos(v + 2.2), 0.46 * (v / t[-1]) * math.sin(v + 2.2)) for v in t], IW * s * 1.1).draw(P, WHITE)
F, s = icon_frame(797, 123, 18)
ink = Ink()
top = [(-0.32, 0.02), (-0.46, -0.08), (-0.4, -0.3), (-0.14, -0.42)] + [(0.14 * math.cos(v), -0.42 + 0.12 * math.sin(v)) for v in np.linspace(math.pi, 0, 9)] + [(0.14, -0.42), (0.4, -0.3), (0.46, -0.08), (0.32, 0.02)]
ink.line([F(*p) for p in top], IW * s)
t = np.linspace(-0.36, 0.1, 20)
ink.line([F(x, 0.1 + 0.05 * math.sin(x * 18)) for x in t], IW * s)
ink.line([F(-0.3, 0.1), F(-0.3, 0.4), F(0.05, 0.4)], IW * s)
ink.line([F(0.28, 0.08), F(0.28, 0.42)], IW * s).line([F(0.11, 0.25), F(0.45, 0.25)], IW * s)
ink.draw(P, WHITE)
F, s = icon_frame(850.5, 123, 15)
Ink().poly([F(-0.47, -0.44), F(0.08, 0), F(-0.47, 0.44)], IW * s * 1.1).line([F(0.25, -0.44), F(0.25, 0.44)], IW * s * 1.1) \
    .line([F(0.45, -0.44), F(0.45, 0.44)], IW * s * 1.1).draw(P, WHITE)
Ink().line([at(534, 136), at(899, 136)], 1.0 * S).draw(P, LINE)

# the six keys: their faces, then their words (Steam in cyan)
KEYS_X = [(557, 608), (610, 662), (664, 716), (717, 769), (771, 822), (824, 876)]
KEY_Y = (156.5, 177.0)
for (x0, x1) in KEYS_X:
    rrect(P, x0, KEY_Y[0], x1, KEY_Y[1], 0.9, KEY)
for text, box, colour in (("Delay", (570, 163, 594, 173), WHITE), ("Steam", (621, 163, 649, 171), CYAN),
                          ("Temp.", (674, 162, 704, 172), WHITE), ("Speed", (728, 162, 757, 172), WHITE),
                          ("Extra Rinse", (776, 163, 817, 170), WHITE), ("Start/Pause", (828, 161, 875, 170), WHITE)):
    word(P, text, box, colour, "demi")
# the child-lock mark under Delay and Steam: a bracket with a lock in a ring at its middle
ink = Ink()
ink.line([at(589, 180), at(591, 183.5), at(603.5, 183.5)], 0.45 * S).line([at(612.5, 183.5), at(625, 183.5), at(627, 180)], 0.45 * S)
F, s = icon_frame(608, 183.5, 9)
ink.circle(F(0, 0), 0.42 * s, 0.11 * s).poly([F(-0.16, -0.02), F(0.16, -0.02), F(0.16, 0.22), F(-0.16, 0.22)]).arc(F(0, -0.02), 0.11 * s, 180, 360, 0.08 * s)
ink.draw(P, (200, 201, 205))

# ── the dial: its rings (the knob is a part of its own and covers the middle), OFF and Spin, the 15 programmes ──
DX, DY = 1151.5, 116.2            # the dial's centre in the picture
dc = at(DX, DY)
Ink().circle(dc, 28.3 * S, 0.95 * S).draw(P, CYAN)
Ink().poly([(dc[0] - 2.2 * S, dc[1] - 28.9 * S), (dc[0] + 2.2 * S, dc[1] - 28.9 * S), (dc[0] + 1.3 * S, dc[1] - 27.4 * S), (dc[0] - 1.3 * S, dc[1] - 27.4 * S)]).draw(P, CYAN)
Ink().circle(dc, 30.6 * S, 0.6 * S).draw(P, RING_GREY)
Ink().arc(dc, 33.2 * S, 130, 230, 0.8 * S).draw(P, CYAN)
word(P, "OFF", (1142, 37, 1162, 45), WHITE, "med")
word(P, "Spin", (1141, 188, 1164, 197), WHITE, "med")
Ink().line([at(1150, 48), at(1150, 54.5)], 0.6 * S).line([at(1152, 180), at(1152, 187)], 0.6 * S).draw(P, WHITE)
for text, box in (("Cotton", (991, 49, 1025, 57)), ("Synthetics", (991, 71, 1045, 81)), ("Mix", (991, 91, 1009, 99)),
                  ("Allergen", (991, 113, 1033, 123)), ("Baby Care", (991, 135, 1043, 145)), ("Daily", (991, 156, 1018, 166)),
                  ("Delicate", (991, 177, 1033, 186)), ("Refresh", (1274, 45, 1313, 54)), ("Quick 15’", (1267, 71, 1312, 80)),
                  ("Sportswear", (1255, 91, 1315, 101)), ("Jeans", (1282, 112, 1314, 121)), ("Duvet", (1285, 135, 1314, 143)),
                  ("Self Clean", (1262, 154, 1314, 163)), ("Shirts", (1284, 175, 1314, 184))):
    word(P, text, box, WHITE, "med")
# the programme marks (cyan shirts) after six names on the left and before Refresh
for (X, Y) in ((1033, 52.5), (1053.5, 76.5), (1017.5, 95.5), (1042, 118), (1050.5, 140), (1024, 160.5), (1264.5, 50.5)):
    F, s = icon_frame(X, Y, 11.5)
    tee(F, s, 0.1).draw(P, CYAN)
# the left lines run to the outer cyan arc; Cotton's and Delicate's (white) turn towards OFF and Spin; the right lines (white)
LR = 33.2 * S


def to_arc(Y):
    dy = row(Y) - dc[1]
    return dc[0] - math.sqrt(max(LR * LR - dy * dy, 0))


lw = 0.7 * S
ink = Ink()
ink.line([at(1044, 52.5), at(1122, 52.5), (col(1124), row(52.5) + 1.2 * S), (col(1124), row(57.5))], lw)
for (X, Y) in ((1064, 74.5), (1032, 94.5), (1055, 117), (1061, 140), (1042, 160)):
    ink.line([at(X, Y), (to_arc(Y) + 0.3 * S, row(Y))], lw)
ink.draw(P, CYAN)
ink = Ink()
ink.line([at(1037, 182), at(1120, 182), (col(1122), row(182) - 1.2 * S), (col(1122), row(175.5))], lw)
ink.line([(col(1179), row(56.5)), (col(1179), row(50) + 1.2 * S), at(1181, 50), at(1252, 50)], lw)
ink.line([(col(1181), row(175)), (col(1181), row(181) - 1.2 * S), at(1183, 181), at(1278, 181)], lw)
for (X0, X1, Y) in ((1210, 1258, 74.5), (1224, 1250, 95), (1229, 1276, 116.5), (1224, 1278, 139.5), (1208, 1255, 159.5)):
    ink.line([at(X0, Y), at(X1, Y)], lw)
ink.draw(P, LINE)

SHADE = {"panel.jpg": 0.85, "knob_top.jpg": 0.85, "side_l.jpg": 0.8, "side_r.jpg": 0.8, "drum.jpg": 0.75}


def save(img, name, q=88):
    p = os.path.join(D, name)
    img = img * SHADE.get(name, 1.0)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", p, img.shape[1], "x", img.shape[0])


# panel.jpg: the whole band at 7 px per mm (the close-up pieces below carry it at 12)
LO = 7.0
lo_w, lo_slant = round(W_MM * LO), round(SLANT * LO)
lo_h = lo_slant + round((LIP_TOP - PANEL_BOT) * LO)
lo = np.concatenate([cv2.resize(P[:OUT_SLANT], (lo_w, lo_slant), interpolation=cv2.INTER_AREA),
                     cv2.resize(P[OUT_SLANT:], (lo_w, lo_h - lo_slant), interpolation=cv2.INTER_AREA)])
save(lo, "panel.jpg", 90)

# ════════ the knob's top: dark, the four-diamond mark in the middle (the picture: 29 x 24 px, 12.5 mm across) ════════
KR = 27.3                         # ESTIMATED: the knob's dark disc reaches the cyan ring's inner edge in the picture
KN = 1024
KSc = KN / (2 * KR)
K = np.zeros((KN, KN, 3), np.float32)
yy, xx = np.mgrid[0:KN, 0:KN]
rr = np.hypot(xx - KN / 2 + 0.5, yy - KN / 2 + 0.5) / (KN / 2)
K[:] = np.array([30, 26, 25], np.float32) * (1.0 + 0.3 * (1 - rr))[..., None]
ink = Ink()
dm = 3.2 * KSc                    # each diamond's half diagonal
for (dx, dy) in ((0, -1), (-1, 0), (1, 0), (0, 1)):
    c = (KN / 2 + dx * 3.35 * KSc, KN / 2 + dy * 3.35 * KSc)
    ink.poly([(c[0], c[1] - dm), (c[0] + dm, c[1]), (c[0], c[1] + dm), (c[0] - dm, c[1])])
ink.draw(K, (222, 223, 226))
save(K, "knob_top.jpg", 90)

# ════════ the sides: the pressed relief of Haier's 3/4 photos ════════
# Each side rectified from its photo: the right side from the photo taken from the right (corners front-top 861,104;
# back-top 1052,158; back-bottom 1052,1092; front-bottom 861,1141), the left from the photo taken from the left (back-top
# 197,156; front-top 406,103; front-bottom 406,1123; back-bottom 197,1038), each to 500 mm deep x (FEET..815 mm) high.
# The photo's own light on the relief (its ridges' highlights and shadows) is kept as a high-pass laid on the side's flat
# paint, so the shapes are the photo's own: three arched bands above, the framed panel in the middle, three bands below.
SSD = 2.0
SW, SH = round(D_MM * SSD), round((SIDE_TOP - FEET) * SSD)
BODY = np.array([24, 27, 36], np.float32)       # the side's paint where it is flat (3/4 photos)


def side(photo, quad, flip):
    q = cv2.imread(os.path.join(SRC, "haier", photo)).astype(np.float32)[:, :, ::-1]
    dst = np.float32([[0, 0], [SW, 0], [SW, SH], [0, SH]])
    Hs = cv2.getPerspectiveTransform(np.float32(quad), dst)
    rect = cv2.warpPerspective(q, Hs, (SW, SH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    Lr = rect.mean(2)
    detail = Lr - cv2.GaussianBlur(Lr, (0, 0), 12 * SSD)
    detail = detail + 0.6 * (detail - cv2.GaussianBlur(detail, (0, 0), 1.5 * SSD))
    _ex = np.minimum(np.arange(SW), SW - 1 - np.arange(SW))[None, :] / 8
    _ey = np.minimum(np.arange(SH), SH - 1 - np.arange(SH))[:, None] / 8
    detail *= np.minimum(1, np.minimum(_ex, _ey))
    gain = np.clip(1 + detail / 22.0, 0.45, 3.2)
    img = BODY[None, None, :] * gain[..., None]
    return img[:, ::-1] if flip else img


# u runs back -> front for the left side (seen from the left) and front -> back for the right side (seen from the right)
save(side("W020240424518075168681_1200.jpg", [[197, 156], [406, 103], [406, 1123], [197, 1038]], False), "side_l.jpg", 88)
save(side("W020240424518074963603_1200.jpg", [[861, 104], [1052, 158], [1052, 1092], [861, 1141]], False), "side_r.jpg", 88)

# ════════ the drum: the 525 mm drum's pillow wall ════════
# Haier: "Pillow shape drum". Haier's close-up of the drum shows a wall of small domed cushions with a hole at each corner;
# a strip 82.5 mm round (20 round the 1649 mm drum) by its 330 mm depth, three cushions across on a 27.5 mm pitch (pitch,
# hole size and depth ESTIMATED from the close-up).
DS = 6.0
DWm, DHm = 82.5, 330.0
dw, dh = round(DWm * DS), round(DHm * DS)
yy, xx = np.mgrid[0:dh, 0:dw].astype(np.float32)
pitch = 27.5 * DS
u = (xx % pitch) / pitch - 0.5
v = (yy % pitch) / pitch - 0.5
rr2 = np.maximum(abs(u), abs(v)) * 0.75 + np.hypot(u, v) * 0.35
cush = np.clip(np.cos(np.clip(rr2 * math.pi, 0, math.pi / 2)), 0, 1) ** 0.7
hl = np.exp(-((u + 0.12) ** 2 + (v + 0.12) ** 2) / 0.02)
drum = np.zeros((dh, dw, 3), np.float32)
drum[:] = np.array([150, 154, 158], np.float32)
drum *= (0.8 + 0.2 * cush + 0.1 * hl)[..., None]
holes = np.zeros((dh, dw), np.uint8)
for gy in np.arange(0, dh + pitch, pitch):
    for gx in np.arange(0, dw + pitch, pitch):
        cv2.circle(holes, (int(round(gx)), int(round(gy))), int(round(1.1 * DS)), 255, -1, cv2.LINE_AA)
h = cv2.GaussianBlur(holes.astype(np.float32) / 255, (0, 0), 0.7)[..., None]
drum = drum * (1 - h) + np.array([28, 30, 33], np.float32) * h
save(drum, "drum.jpg", 85)

# ════════ layout.json for the builder ════════
# The back: the manual's rear view (Fig. 2-2, page 8 rendered at 200 dpi; the cabinet's outline spans x 637-935 and y 524-925
# of it). Seen from behind, the drawing's left is the machine's right. ESTIMATED +-10 mm (a drawing, not a photo).
RX0, RX1, RY0, RY1 = 637.0, 935.0, 524.0, 925.0
rx = lambda X: W_MM / 2 - (X - RX0) / (RX1 - RX0) * W_MM
ry = lambda Y: H_MM - (Y - RY0) / (RY1 - RY0) * (H_MM - FEET)
bolts = {"T1": (670, 786), "T2": (748, 568), "T3": (900, 620), "T4": (900, 786)}
screws = [(793, 621), (712, 700), (867, 703), (710, 797), (866, 807), (762, 866), (817, 866)]
hgt = lambda Y: H_MM - (Y - Y0) * KS * math.cos(TILT)       # a picture row on the leaning face -> mm above the floor
layout = {
    "W": W_MM, "H": H_MM, "D": D_MM, "feet": FEET, "tilt_deg": 30, "lip_top": LIP_TOP, "panel_bot": PANEL_BOT, "slant": SLANT,
    "seam": pu(SEAM_X), "panel_px": [lo_w, lo_h], "panel_slant_rows": lo_slant, "panel_px_per_mm": LO,
    "keys": [[pu(a), pu(b)] for a, b in KEYS_X], "key_y": [hgt(KEY_Y[1]), hgt(KEY_Y[0])],
    "knob": {"x": pu(DX), "y": hgt(DY)}, "knob_r": KR,
    # Haier's front photo (door open): the door's centre 469 mm up, the door 279 mm round, its glass 198 mm; the seat 272 mm,
    # the gasket's lip 193 mm; the raised navy ring round the seat 282 mm (it rises over the band's foot); +-3 mm
    "door": {"x": 0.0, "y": 469.0, "rim": 279.0, "glass": 198.0, "seat": 272.0, "gasket": 193.0, "ring": 282.0},
    "flap": {"x": 207.0, "y": 87.0, "r": 50.0},
    "feet_x": [-268.5, 266.5],
    "bolts": {k: [rx(x), ry(y)] for k, (x, y) in bolts.items()},
    "screws": [[rx(x), ry(y)] for (x, y) in screws],
    "inlet": [rx(878), ry(548)],
    "side_top": SIDE_TOP,
}
with open(os.path.join(D, "layout.json"), "w") as f:
    json.dump(layout, f, indent=1)
print(json.dumps({k: layout[k] for k in ("seam", "keys", "key_y", "knob", "bolts", "inlet")}, indent=None))

# ════════ the close-up print at 12 px per mm ════════
# Cut into pieces, each cropped to its print and under 4096 px, laid 0.9 mm over the band's flat faces by the builder with
# decal_curved.mjs; the keys' faces get their own texture (keys.jpg). The pieces stop short of the raised keys.
Phi_s = P * SHADE["panel.jpg"]
inkm = np.abs(Phi_s - np.array(GLASS, np.float32) * SHADE["panel.jpg"]).max(2) > 18
HI = S
col_mm = lambda x: (x + W_MM / 2) * HI


def piece(name, x0, x1, r0, r1, pad=1.0):
    x0, x1, r0, r1 = (int(round(v)) for v in (x0, x1, r0, r1))
    m = inkm[r0:r1, x0:x1]
    ys, xs = np.where(m)
    if not len(ys):
        return None
    p = round(pad * HI)
    bx0, bx1 = max(x0, x0 + xs.min() - p), min(x1, x0 + xs.max() + 1 + p)
    by0, by1 = max(r0, r0 + ys.min() - p), min(r1, r0 + ys.max() + 1 + p)
    assert bx1 - bx0 <= 4096 and by1 - by0 <= 4096, (name, bx1 - bx0, by1 - by0)
    Image.fromarray(np.clip(Phi_s[by0:by1, bx0:bx1], 0, 255).astype(np.uint8)).save(os.path.join(D, name), quality=88, optimize=True, subsampling=0)
    print("wrote", name, bx1 - bx0, "x", by1 - by0, "px at", HI, "px/mm")
    return bx0, by0, bx1, by1


rect = lambda b: [b[0] / PW, b[1] / OUT_H, b[2] / PW, b[3] / OUT_H]
gap = 0.6 * HI
key_top, key_bot = row(KEY_Y[0]), row(KEY_Y[1])
seam_mm = pu(SEAM_X)
mid = pu(940)                      # between the window's right edge and the dial's programme names
decals_panel, decals_drawer = {}, {}
lip_end = OUT_H - 1.0 * HI
for name, x0, x1, r0, r1, into in (
        ("drawer", col_mm(-W_MM / 2 + 3), col_mm(seam_mm - 1), 0, OUT_SLANT, decals_drawer),
        ("display", col_mm(seam_mm + 1.5), col_mm(mid), 0, key_top - gap, decals_panel),
        ("under", col_mm(seam_mm + 1.5), col_mm(mid), key_bot + gap, OUT_SLANT, decals_panel),
        ("mid_lip", col_mm(seam_mm + 1.5), col_mm(mid), OUT_SLANT, lip_end, decals_panel),
        ("dial", col_mm(mid), col_mm(W_MM / 2 - 3.5), 0, OUT_SLANT, decals_panel)):
    b = piece(f"print_{name}.jpg", x0, x1, r0, r1)
    if b:
        into[name] = {"file": f"print_{name}.jpg", "rect": rect(b)}
kb = [int(round(v)) for v in (col(KEYS_X[0][0]) - HI, key_top - HI, col(KEYS_X[-1][1]) + HI, key_bot + HI)]
Image.fromarray(np.clip(Phi_s[kb[1]:kb[3], kb[0]:kb[2]], 0, 255).astype(np.uint8)).save(os.path.join(D, "keys.jpg"), quality=90, optimize=True, subsampling=0)
print("wrote keys.jpg", kb[2] - kb[0], "x", kb[3] - kb[1])
for name, obj in (("decals_panel.json", decals_panel), ("decals_drawer.json", decals_drawer), ("keys.json", {"rect": rect(kb)})):
    with open(os.path.join(D, name), "w") as f:
        json.dump(obj, f, indent=1)
# a full-resolution look at the print for checking (not used by the builder)
if os.environ.get("HW90_PREVIEW"):
    Image.fromarray(np.clip(P, 0, 255).astype(np.uint8)).save(os.environ["HW90_PREVIEW"])

# ════════ the drain hose's corrugation: one rib, repeated by the builder every 4.3 mm along the hose (ESTIMATED: no photo
# shows this model's hose; the manual draws it ribbed) ════════
rib = np.ones((16, 64, 3), np.float32) * np.array([150, 152, 155], np.float32)
rib *= (0.68 + 0.32 * (0.5 + 0.5 * np.cos(np.linspace(0, 2 * np.pi, 64, endpoint=False))) ** 1.4)[None, :, None]
Image.fromarray(rib.clip(0, 255).astype(np.uint8)).save(os.path.join(D, "hose.jpg"), quality=92)
print("wrote hose.jpg")
