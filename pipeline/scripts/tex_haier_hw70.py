"""Textures for the Haier HW70-IM12929BK, 7 kg front-load washer (929 series), Black.

usage: python3 tex_haier_hw70.py <photos dir> <logos dir> <out dir>
  photos: haier_hw70/sangeetha/6a0ed052bc5e5.jpg   Sangeetha's straight-on front photo of this model (listing 20616, 1080 px)
          haier_hw70/sangeetha/6a0ed052d7690.jpg   Sangeetha's 3/4 photo from the left (the left side's pressed relief)
          haier_hw70/manual/manual_p10_929panel_1200dpi.png   the "For 929 Series" control-panel drawing, Fig. 3-1 of the
                                                   929-series user manual (0030516193B) that Haier India's page for this
                                                   model links, rendered from the PDF at 1200 dpi
  logos:  haier.png
  writes <out dir>/haier_hw70/*.jpg and layout.json

Scale. Haier publishes 595 W x 850 H x 468 D mm (haier.com/in, this model's page; Sangeetha's listing and the manual agree).
In Sangeetha's front photo the cabinet spans columns 237-844 (607 px: 1.0202 px per mm across) and rows 120 (the panel's top
edge) to 966 (under the feet): 0.995 px per mm down. The door is round in the photo at 563 x 556 px, so its pixels are not
quite square; each axis keeps its own scale and the round parts take the mean (ESTIMATED to +-3 mm).

The control panel. The black glass band (750-850 mm) is a short upright lip (750-776 mm) under a face that leans back about
30 degrees (ESTIMATED: the dial's ring is 0.85 as tall as wide in the front photo and 0.78 in the manual's drawing; the 3/4
photo shows the panel's side edge leaning back). panel.jpg covers that leaning face, measured along its slope: a point the
front photo puts y mm above the floor sits (850 - y) / cos 30 mm down the face from its top edge.
The print is the manual's own drawing of this panel, cut into groups (the display and the keys; the dial's programmes; the
words and badges on the drawer) and each group placed where the front photo puts it: the drawing is a diagram, not to scale
across the whole panel (its dial sits 28 mm nearer the middle than the photo's), but each group is drawn true. The drawing
marks what is lit: its white (lit), its light grey (print) and its dim grey; the photo shows the dim marks (the Steam key, the
dial's ring, the programme lines and icons) in cyan, so they are set in cyan. The Haier wordmark is logos/haier.png. The time
is set as solid seven-segment digits, lit as in the photo.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "haier_hw70")
D = os.path.join(OUT, "haier_hw70")
os.makedirs(D, exist_ok=True)

W_MM, H_MM, D_MM = 595.0, 850.0, 468.0
FEET = 15.0                       # ESTIMATED: the feet show 15 px under the cabinet in the front photo (a 5 mm stem, a 10 mm pad)
TILT = math.radians(30)           # ESTIMATED (above)
LIP_TOP = 776.0                   # ESTIMATED: the upright lip under the leaning face (3/4 photo: its bright top edge)
PANEL_BOT = 750.0                 # the black band's lower edge, front photo row 219.5
SLANT = (H_MM - LIP_TOP) / math.cos(TILT)    # the leaning face's length along its slope (85.4 mm)

# front photo -> mm
FX0, FKX, FYB, FKY = 540.5, 607 / 595.0, 966.0, 0.995
fX = lambda px: (px - FX0) / FKX
fY = lambda py: (FYB - py) / FKY

S = 7.0                           # panel texture px per mm
PW = round(W_MM * S)
PH = round((H_MM - PANEL_BOT) * S)                    # the panel is drawn as the front photo sees it (750-850 mm upright) ...
OUT_SLANT = round(SLANT * S)                          # ... then unfolded: the leaning face along its slope, then the lip
OUT_H = OUT_SLANT + round((LIP_TOP - PANEL_BOT) * S)
tX = lambda x: (x + W_MM / 2) * S
tY = lambda y: (H_MM - y) * S                         # a height in the front photo (mm above the floor) -> drawing row

WHITE = (236, 237, 240)           # lit print (the drawing's white: the time, the lit icons, Delay, Temp., the keys' words)
GREY = (200, 202, 206)            # the drawing's light grey print (the programme names, Inverter, the badges)
CYAN = (38, 168, 204)             # the drawing's dim marks, cyan in the photo (Steam, the dial ring, the programme lines)
BLACK = np.array([12, 12, 13], np.float32)     # the glass (front photo, 11/11/11 where nothing reflects)
KEY = (40, 41, 44)                # the keys' faces (photo 53/54/55 on a soft photo; the drawing's key fill)
WINDOW = (44, 45, 48)             # the display window (photo 103 with the digits' glow; drawing 90 on 67)

drawing = cv2.imread(os.path.join(SRC, "manual", "manual_p10_929panel_1200dpi.png"), cv2.IMREAD_GRAYSCALE).astype(np.float32)
# The drawing's own extras, taken out: its black callout lines (level 32; numbers 1 and 2 run through OFF, the dial and Spin,
# and lines hang from the keys) and the lighter square it puts behind the dial (86 on the panel's 67). Where callout line 1
# and 2 cross the dial's ring it is drawn again on the drawing's own ellipse (centre 4060, 546.5; 244 x 185.5 px outside, 8 px
# thick), and Spin's "i", hidden under line 2, is the "i" of the drawing's own "Shirts".
_dark = cv2.dilate((drawing < 60).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
drawing[_dark] = 67
_sq = drawing[303:813, 3816:4488]
_sq[(_sq >= 76) & (_sq <= 95)] = 67
_ring = np.zeros(drawing.shape, np.uint8)
cv2.ellipse(_ring, (4060 * 16, round(546.5 * 16)), (240 * 16, 182 * 16), 0, 0, 360, 255, 7, cv2.LINE_AA, 4)
_ring = _ring.astype(np.float32) / 255
_fix = np.zeros(drawing.shape, bool)
_fix[340:400, 4040:4085] = True
_fix[700:760, 4040:4085] = True
drawing = np.where(_fix, np.maximum(drawing, 67 + (113 - 67) * _ring), drawing)
# Spin's p and i, under line 2: the p of the drawing's "Sportswear" (its S sits 333 px above Spin's, the same type) and the i
# of its "Shirts" (baseline 767, Spin's 815)
_p = drawing[463:491, 4419:4442].copy()
_i = drawing[744:771, 4545:4554].copy()
drawing[796:824, 4045:4068] = np.maximum(drawing[796:824, 4045:4068], _p)
drawing[792:819, 4069:4078] = np.maximum(drawing[792:819, 4069:4078], _i)


def ink(x0, y0, x1, y1, exclude=None):
    """The drawing's print in a box: alpha and colour, at the drawing's resolution. The local background is a 15 px minimum,
    each stroke's own level a 7 px maximum; the level picks the colour (white >= 200, grey 125-199, dim 100-124)."""
    L = drawing[y0:y1, x0:x1]
    bg = cv2.erode(L, np.ones((15, 15), np.uint8))
    pk = cv2.dilate(L, np.ones((7, 7), np.uint8))
    a = np.clip((L - bg - 6) / np.maximum(pk - bg - 6, 1), 0, 1) * (pk - bg > 25) * (pk >= 100)
    col = np.zeros(L.shape + (3,), np.float32)
    col[:] = CYAN
    col[pk >= 125] = GREY
    col[pk >= 200] = WHITE
    if exclude is not None:
        a = a * exclude(np.arange(x0, x1)[None, :], np.arange(y0, y1)[:, None])
    return a, col


def place(canvas, a, col, x0, y0, ax, bx, ay, by):
    """Warp a drawing box into the canvas: texture x = ax * (drawing x) + bx, texture y = ay * (drawing y) + by
    (drawing x, y counted from the box's own corner x0, y0)."""
    M = np.array([[ax, 0, ax * 0 + bx], [0, ay, by]], np.float32)
    h, w = canvas.shape[:2]
    A = cv2.warpAffine(a, M, (w, h), flags=cv2.INTER_AREA if ax < 1 else cv2.INTER_CUBIC)
    C = cv2.warpAffine(col, M, (w, h), flags=cv2.INTER_NEAREST)
    A = np.clip(A, 0, 1)[..., None]
    canvas[:] = canvas * (1 - A) + C * A


def group_map(dx0, dy0, mx, my):
    """The affine (ax, bx, ay, by) for a drawing box at (dx0, dy0) whose drawing x maps to mm by mx(dx) and drawing y to a
    front-photo height by my(dy); both are linear."""
    x_a, x_b = tX(mx(dx0)), tX(mx(dx0 + 1000))
    y_a, y_b = tY(my(dy0)), tY(my(dy0 + 1000))
    return (x_b - x_a) / 1000, x_a, (y_b - y_a) / 1000, y_a


def rrect(canvas, x0, y0, x1, y1, r, colour, feather=1.0):
    """A filled rounded rectangle in texture px."""
    h, w = canvas.shape[:2]
    m = np.zeros((h, w), np.uint8)
    k = 4
    big = np.zeros((h * 0 + 1, 1), np.uint8)
    pts = []
    for (cx, cy, a0) in [(x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)]:
        for t in range(0, 91, 10):
            a = math.radians(a0 + t)
            pts.append([(cx + r * math.cos(a)) * k, (cy + r * math.sin(a)) * k])
    mm = np.zeros((h, w), np.float32)
    big = np.zeros((h * 1, w * 1), np.uint8)
    cv2.fillPoly(big, [np.round(np.array(pts)).astype(np.int32)], 255, lineType=cv2.LINE_AA, shift=2)
    a = (big.astype(np.float32) / 255)[..., None]
    canvas[:] = canvas * (1 - a) + np.array(colour, np.float32) * a


def seven_seg(canvas, digits, x0, y0, w, h, colour):
    """Solid seven-segment digits (hexagonal bars, bar t = 0.21 w, gap 0.62 t), each w x h px, from (x0, y0), with a colon
    between the second and third."""
    t = 0.21 * w
    g = 0.62 * t * 0.5
    segs = {"a": ((0, 0), (1, 0)), "b": ((1, 0), (1, 0.5)), "c": ((1, 0.5), (1, 1)), "d": ((0, 1), (1, 1)),
            "e": ((0, 0.5), (0, 1)), "f": ((0, 0), (0, 0.5)), "g": ((0, 0.5), (1, 0.5))}
    on = {"8": "abcdefg"}
    big = np.zeros(canvas.shape[:2], np.uint8)
    k = 4
    x = x0
    for i, d in enumerate(digits):
        if d == ":":
            for fy in (0.3, 0.7):
                cv2.circle(big, (round((x + t * 0.6) * k), round((y0 + fy * h) * k)), round(t * 0.45 * k), 255, -1, cv2.LINE_AA, 2)
            x += t * 1.6
            continue
        for s in on[d]:
            (ax, ay), (bx, by) = segs[s]
            px0, py0 = x + t / 2 + ax * (w - t), y0 + t / 2 + ay * (h - t)
            px1, py1 = x + t / 2 + bx * (w - t), y0 + t / 2 + by * (h - t)
            if py0 == py1:   # horizontal bar
                P = [(px0 + g, py0), (px0 + g + t / 2, py0 - t / 2), (px1 - g - t / 2, py1 - t / 2), (px1 - g, py1),
                     (px1 - g - t / 2, py1 + t / 2), (px0 + g + t / 2, py0 + t / 2)]
            else:
                P = [(px0, py0 + g), (px0 + t / 2, py0 + g + t / 2), (px1 + t / 2, py1 - g - t / 2), (px1, py1 - g),
                     (px1 - t / 2, py1 - g - t / 2), (px0 - t / 2, py0 + g + t / 2)]
            cv2.fillPoly(big, [np.round(np.array(P) * k).astype(np.int32)], 255, cv2.LINE_AA, 2)
        x += w + t * 0.55
    a = (big.astype(np.float32) / 255)[..., None]
    canvas[:] = canvas * (1 - a) + np.array(colour, np.float32) * a


# lit by the viewer's environment light a texture renders about a quarter brighter than its pixels; the panel's print and the
# drum are set back by these factors (tuned on the gate's renders against the photos)
SHADE = {"panel.jpg": 0.85, "knob_top.jpg": 0.8, "side_l.jpg": 0.8, "side_r.jpg": 0.8, "drum.jpg": 0.6}


def save(img, name, q=88):
    p = os.path.join(D, name)
    img = img * SHADE.get(name, 1.0)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", p, img.shape[1], "x", img.shape[0])


# ════════ the panel ════════
P = np.zeros((PH, PW, 3), np.float32)
P[:] = BLACK

# ── the layout from the front photo (projected mm; ESTIMATED to +-1.5 mm, the photo is 1 px per mm) ──
SEAM = fX(421.5)                                    # the drawer's right edge (a fine vertical seam right through the band)
KEYS = [(fX(460.8), fX(484.2)), (fX(487.5), fX(510.8)), (fX(513.0), fX(537.0)), (fX(541.0), fX(564.0)),
        (fX(567.5), fX(590.0)), (fX(594.0), fX(616.7))]                    # Delay, Steam, Temp., Speed, Extra Rinse, Start/Pause
KEY_Y = (fY(188.5), fY(177.5))
KNOB = dict(x=fX(730.0), y=fY(160.3))               # the dial's centre
GRIP = (fX(280.0), fY(184.0), fX(374.0), fY(165.3))  # the drawer's dark finger recess
WIN = (fX(505.0), fY(148.7), fX(570.0), fY(127.8))  # the display window

# key faces and the display window (drawn first, the print goes over them)
for (x0, x1) in KEYS:
    rrect(P, tX(x0), tY(KEY_Y[1]), tX(x1), tY(KEY_Y[0]), 1.2 * S, KEY)
rrect(P, tX(WIN[0]), tY(WIN[3]), tX(WIN[2]), tY(WIN[1]), 1.0 * S, WINDOW)
# the drawer's finger recess: a darker rounded slot with a faint lit lower lip
rrect(P, tX(GRIP[0]), tY(GRIP[3]), tX(GRIP[2]), tY(GRIP[1]), 3 * S, (6, 6, 7))
rrect(P, tX(GRIP[0]) + 2 * S, tY(GRIP[1]) - 1.0 * S, tX(GRIP[2]) - 2 * S, tY(GRIP[1]) - 0.4 * S, 0.3 * S, (34, 35, 38))

# ── the display, the six icons over the keys, their line, the keys' words, the child-lock mark: one group of the drawing.
# Its scale from the photo: the icons' line (drawing x 1811-3414, y 583) runs from column 448.3 to 626.7 at row 165; the
# keys' words (drawing y 701) sit at row 183. Checked: Delay's centre lands 0.1 mm and Start/Pause's 1.3 mm from the photo's,
# the display's 1.6 mm.
mxC = lambda dx: fX(448.3) + (dx - 1811) / ((3414 - 1811) / (fX(626.7) - fX(448.3)))
myC = lambda dy: fY(165.0) - (dy - 583) / ((701 - 583) / (fY(165.0) - fY(183.0)))
cx0, cy0, cx1, cy1 = 1780, 300, 3440, 800
a, col = ink(cx0, cy0, cx1, cy1)
# the drawing's digits are outlines; the photo shows them solid: they are set below, so the drawing's are left out
dmask = np.ones_like(a)
dmask[330 - cy0:470 - cy0, 2380 - cx0:2850 - cx0] = 0
a = a * dmask
place(P, a, col, cx0, cy0, *group_map(cx0, cy0, mxC, myC))
# the time, 88:88, solid and lit as in the photo, inside the drawing's digit box
dx0, dx1, dy0, dy1 = 2392, 2846, 338, 452
X0, X1 = tX(mxC(dx0)), tX(mxC(dx1))
Y0, Y1 = tY(myC(dy0)), tY(myC(dy1))
dw = (X1 - X0) / (4 + 4 * 0.21 * 0.55 + 0.21 * 1.6 / 1.0) * 1.0
seven_seg(P, "88:88", X0, Y0, dw, Y1 - Y0, WHITE)

# ── the dial's group: the ring, the programme names, their lines and icons, OFF and Spin. Its scale from the photo: the names
# span columns 664-794 (drawing x 3500-4607) and rows 132.8-189 (Cotton to Delicate, drawing y 329-764); the knob (inside the
# ring, drawing radius 205 px across) is a raised part of its own and is left out here.
mxK = lambda dx: fX(730.0) + (dx - 4053.5) / ((4607 - 3500) / (fX(794) - fX(664)))
myK = lambda dy: fY(160.3) - (dy - 546) / ((764 - 329) / (fY(132.8) - fY(189.0)))
kx0, ky0, kx1, ky1 = 3470, 250, 4660, 828          # below 828 the drawing has the panel's dashed lower edge
knob_out = lambda X, Y: (((X - 4060) / 222.0) ** 2 + ((Y - 546) / 172.0) ** 2 > 1).astype(np.float32)
a, col = ink(kx0, ky0, kx1, ky1, exclude=knob_out)
place(P, a, col, kx0, ky0, *group_map(kx0, ky0, mxK, myK))

# ── the drawer's words: Inverter, and the 525 DRUM and REFRESH badges; each drawing box set where the photo has it (its width
# from the photo, its height kept in the drawing's proportion along the slope)
DRAW_FORE = 185.5 / 244


def word_group(bx, photo_x0, photo_x1, photo_yc):
    x0, y0, x1, y1 = bx
    a, col = ink(x0, y0, x1, y1)
    ys, xs = np.where(a > 0.3)
    a, col = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], col[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    w_tex = tX(photo_x1) - tX(photo_x0)
    ax = w_tex / a.shape[1]
    # the drawing draws the leaning face 0.76 as tall as it is (its dial ring, 244 x 185.5 px, is round on the machine); the
    # front photo sees it cos 30 as tall
    ay = ax / DRAW_FORE * math.cos(TILT)
    yc = tY(photo_yc)
    place(P, a, col, 0, 0, ax, tX(photo_x0), ay, yc - a.shape[0] * ay / 2)

word_group((440, 525, 670, 590), fX(283.3), fX(305.3), fY(157.0))
word_group((970, 535, 1370, 595), fX(335.3), fX(372.7), fY(158.0))

# ── the Haier wordmark (logos/haier.png), light grey, where the photo has it (columns 283.3-318, rows 127.8-138.3)
logo = np.asarray(Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")).astype(np.float32)
la = logo[..., 3] / 255
ys, xs = np.where(la > 0.1)
la = la[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
lw = tX(fX(318.0)) - tX(fX(283.3))
lh = lw * la.shape[0] / la.shape[1] * math.cos(TILT)         # the logo's own shape, seen on the leaning face
lyc = tY(fY(133.0))
lm = cv2.resize(la, (round(lw), round(lh)), interpolation=cv2.INTER_AREA)
X, Y = round(tX(fX(283.3))), round(lyc - lh / 2)
A = lm[..., None]
P[Y:Y + lm.shape[0], X:X + lm.shape[1]] = P[Y:Y + lm.shape[0], X:X + lm.shape[1]] * (1 - A) + np.array([214, 216, 220], np.float32) * A

# the band's foot: a thin light edge (front photo row 219, 1 px)
P[PH - round(0.8 * S):, :] = P[PH - round(0.8 * S):, :] * 0.4 + np.array([96, 99, 106], np.float32) * 0.6

# unfold: texture rows 0..OUT_SLANT run down the leaning face along its slope, the rest down the upright lip
r = np.arange(OUT_H, dtype=np.float32)
src_row = np.where(r < OUT_SLANT, r * math.cos(TILT), (H_MM - LIP_TOP) * S + (r - OUT_SLANT))
mapy = np.repeat(src_row[:, None], PW, 1).astype(np.float32)
mapx = np.repeat(np.arange(PW, dtype=np.float32)[None, :], OUT_H, 0)
P = cv2.remap(P, mapx, mapy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
save(P, "panel.jpg", 90)

# ── the knob's top: dark, with the drawing's four-diamond mark in the middle (drawing centre 4060, 546) ──
KR = 24.0                                            # ESTIMATED: the knob, inside the ring (ring radius 27.9 mm across)
KS = 512 / (2 * KR)
K = np.zeros((512, 512, 3), np.float32)
yy, xx = np.mgrid[0:512, 0:512]
rr = np.hypot(xx - 255.5, yy - 255.5) / 256
K[:] = (np.array([13, 12, 12], np.float32) * (1.0 + 0.25 * (1 - rr))[..., None])
a = np.clip((drawing[480:612, 3990:4130] - 90) / (109 - 90), 0, 1)     # the diamonds are solid (109 on the knob's 84-86)
col = np.zeros(a.shape + (3,), np.float32)
kx = KS / ((4607 - 3500) / (fX(794) - fX(664)))     # drawing px -> knob texture px (across)
place(K, a, col * 0 + np.array([210, 212, 216], np.float32), 0, 0, kx, 256 + (3990 - 4060) * kx, kx / DRAW_FORE, 256 + (480 - 546) * kx / DRAW_FORE)
save(K, "knob_top.jpg", 90)

# ════════ the sides: the pressed relief of Sangeetha's 3/4 photo ════════
# The left side, rectified from the photo: its corners (back-top 197,192; front-top 355,150; front-bottom 355,943;
# back-bottom 197,878) to 468 mm deep x (FEET..826 mm) high. The photo's own light on the relief (its ridges' highlights and
# shadows) is kept as a high-pass (the photo less its 12 mm blur) laid on the side's flat paint, so the shapes are the photo's
# own (three arched bands above, the framed panel in the middle, three bands below). The photo gives about 0.35 px per mm
# across the side and 1 px per mm up it: the ridges, which run along, are sharp enough; their ends are soft. The right side
# has no photo; it is drawn as the left's mirror image (ESTIMATED).
SIDE_TOP = 826.0
SS = 2.0
SW, SH = round(D_MM * SS), round((SIDE_TOP - FEET) * SS)
q = cv2.imread(os.path.join(SRC, "sangeetha", "6a0ed052d7690.jpg")).astype(np.float32)
src = np.float32([[197, 192], [355, 150], [355, 943], [197, 878]])
dst = np.float32([[0, 0], [SW, 0], [SW, SH], [0, SH]])
Hs = cv2.getPerspectiveTransform(src, dst)
rect = cv2.warpPerspective(q, Hs, (SW, SH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
Lr = rect.mean(2)
detail = Lr - cv2.GaussianBlur(Lr, (0, 0), 12 * SS)
detail = detail + 0.6 * (detail - cv2.GaussianBlur(detail, (0, 0), 1.5 * SS))       # a light unsharp mask
_ex = np.minimum(np.arange(SW), SW - 1 - np.arange(SW))[None, :] / 8
_ey = np.minimum(np.arange(SH), SH - 1 - np.arange(SH))[:, None] / 8
edge = np.minimum(1, np.minimum(_ex, _ey))
detail *= edge                                                                      # no seam at the side's own edges
BODY = np.array([25, 28, 37], np.float32)       # the side's paint where it is flat (3/4 photo 25/28/37 RGB)
gain = np.clip(1 + detail / 22.0, 0.45, 3.2)
side_rgb = BODY[None, None, :] * gain[..., None]
save(side_rgb, "side_l.jpg", 88)        # u: back (left) -> front (right), as the left side is seen from the left
save(side_rgb[:, ::-1], "side_r.jpg", 88)

# ════════ the drum: the 525 mm Super Drum's pillow wall ════════
# Sangeetha's listing image "Pillow Drum: 560 protrusions, 720 microporous" shows domed square cushions with the holes at their
# corners; the listing gives the holes as 2.2 mm. A strip 82.5 mm round (20 round the 1649 mm drum) by the drum's 300 mm depth,
# three cushions across on a 27.5 mm pitch: about 600 cushions and as many holes (pitch and depth ESTIMATED from those counts).
DS = 6.0
DWm, DHm = 82.5, 300.0
dw, dh = round(DWm * DS), round(DHm * DS)
yy, xx = np.mgrid[0:dh, 0:dw].astype(np.float32)
pitch = 27.5 * DS
u = (xx % pitch) / pitch - 0.5
v = (yy % pitch) / pitch - 0.5
rr2 = np.maximum(abs(u), abs(v)) * 0.75 + np.hypot(u, v) * 0.35
cush = np.clip(np.cos(np.clip(rr2 * math.pi, 0, math.pi / 2)), 0, 1) ** 0.7
hl = np.exp(-((u + 0.12) ** 2 + (v + 0.12) ** 2) / 0.02)       # each dome's soft highlight
drum = np.zeros((dh, dw, 3), np.float32)
drum[:] = np.array([150, 154, 158], np.float32)
drum *= (0.62 + 0.42 * cush + 0.25 * hl)[..., None]
holes = np.zeros((dh, dw), np.uint8)
for gy in np.arange(0, dh + pitch, pitch):
    for gx in np.arange(0, dw + pitch, pitch):
        cv2.circle(holes, (int(round(gx)), int(round(gy))), int(round(1.1 * DS)), 255, -1, cv2.LINE_AA)
h = cv2.GaussianBlur(holes.astype(np.float32) / 255, (0, 0), 0.7)[..., None]
drum = drum * (1 - h) + np.array([28, 30, 33], np.float32) * h
save(drum, "drum.jpg", 85)

# ════════ the back: from the manual's rear view (Fig. 2-2) ════════
# layout.json: the transit bolts T1-T4 and the 9 back-cover screws, read off the manual's rear drawing (rendered at 600 dpi,
# 1080 x 1440 px crop; the cabinet's outline spans x 60-1067 and y 47-1407 of it). Seen from behind, the drawing's left is
# the machine's right. ESTIMATED +-10 mm (a drawing, not a photo; the manual says illustrations may differ).
RX0, RX1, RY0, RY1 = 60.0, 1067.0, 47.0, 1407.0
rx = lambda X: W_MM / 2 - (X - RX0) / (RX1 - RX0) * W_MM
ry = lambda Y: H_MM - (Y - RY0) / (RY1 - RY0) * (H_MM - FEET)
k3 = 1080 / 810
bolts = {"T1": (130, 700), "T2": (335, 140), "T3": (705, 275), "T4": (710, 700)}
screws = [(233, 483), (220, 612), (228, 722), (440, 278), (625, 490), (625, 620), (622, 757), (362, 905), (498, 912)]
layout = {
    "W": W_MM, "H": H_MM, "D": D_MM, "feet": FEET, "tilt_deg": 30, "lip_top": LIP_TOP, "panel_bot": PANEL_BOT, "slant": SLANT,
    "seam": SEAM, "panel_px": [PW, OUT_H], "panel_slant_rows": OUT_SLANT, "keys": KEYS, "key_y": KEY_Y, "knob": KNOB, "knob_r": KR, "ring_r": 240 / ((4607 - 3500) / (fX(794) - fX(664))),
    "door": {"x": 0.0, "y": fY(508.0), "rim": ((821 - 258) / 2 / FKX + (786 - 230) / 2 / FKY) / 2,
             "silver_in": (539.5 - 263) / FKX, "glass": (539.5 - 351) / FKX},
    "flap": {"x": fX(759.0), "y": fY(885.0), "r": (59 / FKX + 58.6 / FKY) / 2},
    "feet_x": [fX(266.0), fX(818.0)],
    "bolts": {k: [rx(x * k3), ry(y * k3)] for k, (x, y) in bolts.items()},
    "screws": [[rx(x * k3), ry(y * k3)] for (x, y) in screws],
    "inlet": [rx(655 * k3), ry(110 * k3)],
    "side_ridges_px_per_mm": SS, "side_top": SIDE_TOP,
}
with open(os.path.join(D, "layout.json"), "w") as f:
    json.dump(layout, f, indent=1)
print(json.dumps({k: layout[k] for k in ("seam", "knob", "door", "flap", "feet_x", "bolts", "inlet")}, indent=None))
