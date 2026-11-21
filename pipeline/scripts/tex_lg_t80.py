"""Textures for the LG T80SPMB1Z 8 kg top-load washing machine (Middle Black).

usage: python3 tex_lg_t80.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>]
  photos:  lg_t80/ (LG India's own gallery for T80SPMB1Z, 2010 x 1334). The close-ups LG publishes on this model's page
           (top_open, inside, drum, back) carry a rating sticker that reads T70SPMB1Z.ABMQEIL: the 7 kg model of the same
           series, which LG's owner's manual MFL72021909 gives the same 540 x 560 x 925 mm cabinet, the same 32 kg and the
           same control panel (the "6 Water Level Model" drawing, T65SP* / T70SP* / T75SP* / T80SP*). They are used for the
           panel's layout, the back and the inside; nothing printed with a model's name or capacity is taken from them.
           top_open.jpg   straight down on the machine with the lid open: the control panel
           back.jpg       the back, straight on
           inside.jpg     the lid open, close up: the detergent drawer pulled out, the blue lint filter
           drum.jpg       straight down into the drum: the TurboDrum pulsator, the lint filter
  manual:  the control-panel drawing for the 6-water-level models (T80SP* among them) in LG's owner's manual MFL72021909,
           page 25, rendered with  pdftoppm -r 1600 -f 25 -l 25 -x 900 -y 6000 -W 8200 -H 2500 -gray -png
           (kept in private/research/lg_t80/manual_render/, not in git)
  logos:   the logos folder (LG's mark is drawn from pipeline/sources/logos/lg.svg by tex_lg_mark.py)
  writes <out dir>/lg_t80/* (the energy label is cut out separately by tex_bee_label.py into bee_label.png)

Copied from tex_lg_t70.py (LG T70AJMB1Z, the same family and the same manual): the control panel is drawn new at 7 px/mm from the
manual's vector ink, placed by fitting the drawing to LG's straight-down photo; the words and marks the drawing lacks (LG logo,
Smart Diagnosis, the Smart Inverter badge) are set again from the photo; the seven-segment display is lit as in LG's photo
(1:44, Beeper High, Water Level 6, Tub Clean). Writes panel_layout.json: the raised keys, rings and screw caps in panel millimetres.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
DEBUG = None
if "--debug" in args:
    DEBUG = args[args.index("--debug") + 1]
    del args[args.index("--debug"):args.index("--debug") + 2]
    os.makedirs(DEBUG, exist_ok=True)
# --hi <px per mm>: draw only the control panel, at that density, and cut its print into the uvDecals pieces the builder lays on
# the panel (print_a.jpg, print_b.jpg, ..., decals.json; pipeline/scripts/decal_cut.py); panel.jpg and the rest are left alone
HI = None
if "--hi" in args:
    HI = float(args[args.index("--hi") + 1])
    del args[args.index("--hi"):args.index("--hi") + 2]
PHOTOS, MANUAL, LOGOS, OUT = args[:4]
P = os.path.join(PHOTOS, "lg_t80")
D = os.path.join(OUT, "lg_t80")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(80)
COND = "/System/Library/Fonts/Avenir Next Condensed.ttc"
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def photo(name):
    return np.asarray(Image.open(os.path.join(P, name)).convert("RGB")).astype(np.float32)


# ───────────────────────── control panel ─────────────────────────
# The panel face is the sloped front of the top cover, 23 degrees up toward the lid. Texture coordinates: x across (540 mm, the
# machine's width, centred), s up the slope from the front edge (0 to 140 mm). Row 0 is the back (s = 140 mm).
PXMM = HI or 7.0
XW, SMAX = 540.0, 140.0
TW, TH = int(XW * PXMM), int(SMAX * PXMM)
BG = np.array((12, 12, 13), np.float32)
canvas = np.zeros((TH, TW, 3), np.float32)
canvas[...] = BG
canvas += rng.normal(0, 0.5, (TH, TW, 1))


def tex_xy(x_mm, s_mm):
    return ((x_mm + XW / 2) * PXMM, (SMAX - s_mm) * PXMM)


# LG's straight-down photo (top_open.jpg): the machine is 936 px across its 540 mm (1.733 px/mm, columns 516-1452, centre 984);
# the panel's front edge is at row 1165 on the centre line. The 23 degree slope is seen foreshortened (0.938, as the T70's photo).
PXP = 936.0 / 540.0


def photo_to_panel(X, Y):
    return (X - 984.0) / PXP, (1165.0 - Y) / PXP / 0.938


def put(alpha, colour, x0, y0):
    """composite an alpha mask (0..1) at texture px (x0, y0) in a colour"""
    global canvas
    h, w = alpha.shape
    xs0, ys0 = max(0, x0), max(0, y0)
    xs1, ys1 = min(TW, x0 + w), min(TH, y0 + h)
    if xs1 <= xs0 or ys1 <= ys0:
        return
    a = alpha[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
    canvas[ys0:ys1, xs0:xs1] = canvas[ys0:ys1, xs0:xs1] * (1 - a) + np.array(colour, np.float32) * a


# ── the manual's drawing: ink, cleaned of everything that is not printed on the panel ──
g = cv2.imread(MANUAL, cv2.IMREAD_GRAYSCALE)
if g is None:
    raise SystemExit(f"cannot read {MANUAL}")
K = 5  # the drawing is measured below in units of 5 render px (the 320 dpi overview)
ink = 1.0 - g.astype(np.float32) / 255.0
keep = np.zeros_like(ink)
keep[int(87 * K):int(481 * K), 0:int(1442 * K)] = 1          # the frame's inside, clear of the frame lines
ink *= keep
for lx in (411.5, 961.9):                                     # callouts 4 and 3: their leaders and end dots under the keys
    ink[int(447 * K):int(481 * K), int((lx - 8) * K):int((lx + 8) * K)] = 0
    # the key outline is notched round the callout's dot: its bottom line is copied over the notch from 20 units to the left
    ink[int(440 * K):int(447 * K), int((lx - 8) * K):int((lx + 8) * K)] = ink[int(440 * K):int(447 * K), int((lx - 28) * K):int((lx - 12) * K)]
binm = (ink > 0.5).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(binm, 8)
drop = np.zeros(n, bool)
small = lambda i: st[i, 2] <= 6 * K and st[i, 3] <= 6 * K
# the dotted group boxes (cycle icons; option keys; programme keys): small dashes lying on their edges
BOXES = [(188, 125.5, 455, 212), (37.3, 373.6, 785.7, 455.6), (827.5, 373.6, 1097, 455.6)]
for bx0, by0, bx1, by1 in BOXES:
    for i in range(1, n):
        if not small(i):
            continue
        cx, cy = cen[i] / K
        on_h = (abs(cy - by0) < 4 or abs(cy - by1) < 4) and bx0 - 4 < cx < bx1 + 4
        on_v = (abs(cx - bx0) < 4 or abs(cx - bx1) < 4) and by0 - 4 < cy < by1 + 4
        if on_h or on_v:
            drop[i] = True
POWER_C, POWER_R = (1345.6, 170.6), 49.0
START_C, START_R = (1242.6, 317.8), 74.0
for i in range(1, n):
    x, y, w, h = st[i, :4] / K
    cx, cy = cen[i] / K
    if w > 300 or h > 130:                                         # frame lines
        drop[i] = True
    if 520 < x and x + w < 812 and 130 < y and y + h < 230 and w > 200:     # the display window's outline (the panel has none)
        drop[i] = True
    if (x > 1290 and y < 240) or (x > 1160 and y > 240 and x < 1330 and y < 400 and w > 100):   # power ring (+ callout 1), start ring
        if abs(cx - POWER_C[0]) < 60 and abs(cy - POWER_C[1]) < 60 and (w > 80 or x > 1380):
            drop[i] = True
        if abs(cx - START_C[0]) < 8 and abs(cy - START_C[1]) < 8 and w > 110:
            drop[i] = True
    if x > 1300 and w > 100:                                       # callouts 1 and 2 with their leaders
        drop[i] = True
    if y < 92 and h > 25 and w < 20:                               # callouts 5 and 6: their leaders into the frame
        drop[i] = True
    if y > 440 and h > 25 and w < 20:                              # the leaders of callouts 3 and 4
        drop[i] = True
    if any(abs(cx - lx) < 8 and abs(cy - 455.6) < 8 and w < 12 for lx in (411.5, 961.9)):   # and their end dots
        drop[i] = True
# the power symbol and the play-pause mark are placed separately (where LG's photo has them)
power_ids = [i for i in range(1, n) if not drop[i] and math.hypot(cen[i][0] / K - POWER_C[0], cen[i][1] / K - POWER_C[1]) < 35]
start_ids = [i for i in range(1, n) if not drop[i] and math.hypot(cen[i][0] / K - START_C[0], cen[i][1] / K - START_C[1]) < 50]
for i in power_ids + start_ids:
    drop[i] = True
print("power parts", len(power_ids), "start parts", len(start_ids))


def comp_ink(ids):
    m = np.isin(lab, ids)
    return np.where(m, ink, 0)


# lamps (the small bars left of each option); lit in LG's photo: Beeper High, Water Level 6, Tub Clean
LIT = [(59, 294), (261, 290), (991, 355)]
WHITE = (205, 205, 205)
GREY = (160, 160, 162)
SALMON = (214, 136, 108)
ORANGE = (236, 118, 66)
DIM = (46, 46, 48)
YEL = (222, 232, 46)
colour_of = np.zeros(n, object)
for i in range(1, n):
    cx, cy = cen[i] / K
    w, h = st[i, 2] / K, st[i, 3] / K
    fill = st[i, 4] / max(1, st[i, 2] * st[i, 3])
    c = WHITE
    if 188 < cx < 455 and 125 < cy < 212:          # Soak, Wash, Rinse, Spin cycle icons and their words: lit orange in the photo
        c = SALMON
    if 4 < w < 9 and 9 < h < 16 and fill > 0.75:   # a lamp
        c = GREY
        for lx, ly in LIT:
            if abs(cx - lx) < 6 and abs(cy - ly) < 6:
                c = ORANGE
    if 528 < cx < 806 and 135 < cy < 226:          # the display: lock and clock icons and the segments, lit as in the photo ( 1:44)
        c = DIM
        if 666 <= cx < 685:                        # the colon, lit
            c = YEL
        digit = next((d for d, (lo, hi) in enumerate([(598, 618), (618, 670), (684, 734), (734, 790)]) if lo <= cx < hi), None)
        if digit in (1, 2, 3):
            if w > 20:
                seg = "a" if cy < 165 else "g" if cy < 195 else "d"
            else:
                mids = {1: (648.0, 642.6), 2: (712.0, 706.4), 3: (763.7, 758.6)}[digit]
                upper = cy < 180
                seg = ("f" if cx < mids[0] else "b") if upper else ("e" if cx < mids[1] else "c")
            if seg in {1: "bc", 2: "bcfg", 3: "bcfg"}[digit]:
                c = YEL
    colour_of[i] = c

# fit: drawing -> panel (x mm, s mm). Matched centres, drawing overview units against LG's photo px (top_open.jpg, key outlines
# measured at 5x): the seven keys and Delay
pairs = [((93.8, 414.3), (823.0, 1129.2)), ((262.3, 414.3), (879.9, 1133.5)), ((420.2, 414.3), (932.9, 1133.4)),
         ((574.6, 414.7), (984.9, 1133.2)), ((729.4, 414.3), (1036.8, 1132.7)), ((884.2, 414.3), (1088.7, 1132.1)),
         ((1039.8, 414.3), (1140.5, 1131.3)), ((887.6, 194.2), (1090.9, 1063.9))]
M = np.zeros((2 * len(pairs), 4))
rhs = np.zeros(2 * len(pairs))
for j, ((dx, dy), (X, Y)) in enumerate(pairs):
    x, s = photo_to_panel(X, Y)
    M[2 * j] = (dx, 1, 0, 0)
    rhs[2 * j] = x
    M[2 * j + 1] = (-dy, 0, 1, x ** 2 / 1000.0)
    rhs[2 * j + 1] = s
k, x0, s0, bend = np.linalg.lstsq(M, rhs, rcond=None)[0]
res = M @ np.array([k, x0, s0, bend]) - rhs
print(f"drawing fit: {k:.4f} mm/unit, bend {bend:.3f} mm per 1000 mm2, residual rms {np.sqrt((res ** 2).mean()):.2f} mm, max {abs(res).max():.2f}")


def draw_to_panel(dx, dy):
    x = k * dx + x0
    return x, -k * dy + s0 + bend * x * x / 1000.0


ys, xs = np.mgrid[0:TH, 0:TW].astype(np.float32)
x_mm = xs / PXMM - XW / 2
s_mm = SMAX - ys / PXMM
dxu = (x_mm - x0) / k
dyu = -(s_mm - s0 - bend * x_mm * x_mm / 1000.0) / k
mapx, mapy = (dxu * K).astype(np.float32), (dyu * K).astype(np.float32)
sig = (K / k / PXMM) / 2.5

# the display window: a slightly lighter dark rectangle in LG's photo (no printed outline), under the segments
win = np.zeros_like(ink)
win[int(136 * K):int(225 * K), int(529 * K):int(805 * K)] = 1
a = cv2.remap(cv2.GaussianBlur(win, (0, 0), sig * 2), mapx, mapy, cv2.INTER_LINEAR, borderValue=0)
canvas = canvas * (1 - a[..., None]) + np.array((24, 24, 25), np.float32) * a[..., None]

for c in set(colour_of[1:]):
    ids = [i for i in range(1, n) if not drop[i] and colour_of[i] == c]
    if not ids:
        continue
    layer = comp_ink(ids).astype(np.float32)
    layer = cv2.GaussianBlur(layer, (0, 0), sig)
    a = cv2.remap(layer, mapx, mapy, cv2.INTER_LINEAR, borderValue=0)
    a = np.clip((a - 0.08) / 0.84, 0, 1)
    canvas = canvas * (1 - a[..., None]) + np.array(c, np.float32) * a[..., None]


def place_component(ids, colour, X, Y, scale=1.0):
    """place drawing components centred on a photo point (top_open.jpg px), at the drawing's true size"""
    m = np.isin(lab, ids)
    yy, xx = np.where(m)
    x0c, y0c, x1c, y1c = xx.min(), yy.min(), xx.max() + 1, yy.max() + 1
    crop = ink[y0c:y1c, x0c:x1c] * m[y0c:y1c, x0c:x1c]
    px_per_unit = k * PXMM / K * scale
    w, h = max(1, int(round(crop.shape[1] * px_per_unit))), max(1, int(round(crop.shape[0] * px_per_unit)))
    a = cv2.resize(cv2.GaussianBlur(crop, (0, 0), sig), (w, h), interpolation=cv2.INTER_AREA)
    a = np.clip((a - 0.08) / 0.84, 0, 1)
    x, s = photo_to_panel(X, Y)
    tx, ty = tex_xy(x, s)
    put(a, colour, int(round(tx - w / 2)), int(round(ty - h / 2)))


POWER_XY, START_XY = (1245.1, 1054.9), (1209.2, 1101.0)
place_component(power_ids, WHITE, *POWER_XY)
place_component(start_ids, WHITE, *START_XY)


def text_alpha(text, font, px, track=0.0):
    f = ImageFont.truetype(font[0], int(px), index=font[1])
    W = int(px * (len(text) + 2) * (0.8 + track))
    img = Image.new("L", (W, int(px * 2)), 0)
    d = ImageDraw.Draw(img)
    x = px * 0.3
    for ch in text:
        d.text((x, px * 0.3), ch, font=f, fill=255)
        x += f.getlength(ch) + track * px
    a = np.asarray(img).astype(np.float32) / 255.0
    yy, xx = np.where(a > 0.02)
    return a[yy.min():yy.max() + 1, xx.min():xx.max() + 1]


def put_box(alpha, colour, X0, Y0, X1, Y1, keep_aspect=True):
    """fit an alpha into the box a word has in LG's photo (top_open.jpg px)"""
    x0p, s0p = photo_to_panel(X0, Y1)
    x1p, s1p = photo_to_panel(X1, Y0)
    tx0, ty0 = tex_xy(x0p, s1p)
    tx1, ty1 = tex_xy(x1p, s0p)
    bw, bh = tx1 - tx0, ty1 - ty0
    h, w = alpha.shape
    sc = min(bw / w, bh / h) if keep_aspect else None
    nw, nh = (int(round(w * sc)), int(round(h * sc))) if keep_aspect else (int(round(bw)), int(round(bh)))
    a = cv2.resize(alpha, (max(1, nw), max(1, nh)), interpolation=cv2.INTER_AREA)
    put(a, colour, int(round((tx0 + tx1) / 2 - nw / 2)), int(round((ty0 + ty1) / 2 - nh / 2)))


DEMI = (COND, 2)
SILVER = (196, 198, 202)
# Smart Diagnosis: a round + sign with a phone over its right side, the words below (photo boxes measured at 10x)
icon = Image.new("L", (400, 330), 0)
d = ImageDraw.Draw(icon)
d.ellipse((20, 40, 250, 270), outline=255, width=20)
d.rectangle((115, 85, 155, 225), fill=255)
d.rectangle((65, 135, 205, 175), fill=255)
d.rounded_rectangle((200, 30, 370, 300), radius=26, fill=0)
d.rounded_rectangle((210, 40, 360, 290), radius=22, outline=255, width=20)
d.rectangle((270, 255, 300, 268), fill=255)
put_box(np.asarray(icon).astype(np.float32) / 255.0, WHITE, 1199.0, 1041.0, 1217.0, 1057.5)
put_box(text_alpha("Smart", DEMI, 200), WHITE, 1200.0, 1059.0, 1215.0, 1063.5)
put_box(text_alpha("Diagnosis™", DEMI, 200), WHITE, 1196.0, 1063.6, 1223.0, 1068.5)
# the Smart Inverter Motor badge: SMART / INVERTER / MOTOR | 10 / WARRANTY
put_box(text_alpha("SMART", (AVENIR, 2), 200, 0.12), SILVER, 1314.0, 1041.8, 1340.5, 1047.0)
put_box(text_alpha("INVERTER", (AVENIR, 2), 200, 0.18), SILVER, 1316.0, 1048.2, 1339.0, 1050.8)
put_box(text_alpha("MOTOR", (AVENIR, 2), 200, 0.18), SILVER, 1321.3, 1051.8, 1333.5, 1054.0)
put_box(np.ones((60, 4), np.float32), SILVER, 1342.8, 1039.5, 1343.8, 1055.5, keep_aspect=False)
put_box(text_alpha("1", (AVENIR, 2), 400), SILVER, 1346.5, 1040.0, 1350.5, 1051.5)
ring = Image.new("L", (300, 300), 0)
ImageDraw.Draw(ring).ellipse((10, 10, 290, 290), outline=255, width=46)
put_box(np.asarray(ring).astype(np.float32) / 255.0, SILVER, 1351.5, 1040.0, 1363.5, 1051.5)
put_box(text_alpha("WARRANTY", (AVENIR, 2), 200, 0.12), SILVER, 1347.0, 1053.2, 1361.5, 1054.8)

# the LG logo, silver: the face's disc a silver disc with the face cut out of it, the letters silver
# (LG's vector mark, tex_lg_mark.py, in logos/lg.png's layout: sharp at any density; lg.png's 349 px were 9 px per mm here)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tex_lg_mark
logo = np.asarray(tex_lg_mark.lg_hi(LOGOS, 1200)).astype(np.float32)
lg_a = logo[..., 3] / 255.0 * (1 - np.clip((logo[..., :3].min(2) - 150) / 70, 0, 1))
put_box(lg_a, SILVER, 605.4, 1042.2, 663.5, 1066.4)

canvas = np.clip(canvas, 0, 255)
# the plain ground's faint noise (half a level) snapped to the ground colour: no visible change, and the files compress far better
canvas[np.abs(canvas - BG).max(2) <= 3] = BG
if HI:
    import decal_cut
    decal_cut.cut(Image.fromarray(canvas.astype(np.uint8)), BG, D, prefix="print")
    sys.exit(0)
save(Image.fromarray(canvas.astype(np.uint8)), "panel.jpg", q=90)
if DEBUG:
    ph = photo("top_open.jpg")
    crop = ph[1025:1165, 516:1452]
    Image.fromarray(crop.astype(np.uint8)).resize((TW // 2, int(TW / 2 * 140 / 936))).save(os.path.join(DEBUG, "panel_photo.png"))
    Image.fromarray(canvas.astype(np.uint8)).resize((TW // 2, TH // 2)).save(os.path.join(DEBUG, "panel_half.png"))

# ───────────────────────── the panel's raised parts, for the builder ─────────────────────────
KEYS_DRAW = [(93.8, 414.3), (262.3, 414.3), (420.2, 414.3), (574.6, 414.7), (729.4, 414.3), (884.2, 414.3), (1039.8, 414.3), (887.6, 194.2)]
layout = {
    "keys": [[round(v, 1) for v in draw_to_panel(*kk)] for kk in KEYS_DRAW],
    "rings": [[*[round(v, 1) for v in photo_to_panel(*xy)], round(r / PXP, 1)] for xy, r in [(POWER_XY, 16.7), (START_XY, 24.6)]],
    "caps": [[round(v, 1) for v in photo_to_panel(*xy)] for xy in [(577.0, 1050.0), (1390.8, 1048.0)]],
    "capR": round(16.7 / PXP, 1),
    "keyW": round(95.2 * k, 1), "keyH": round(63.4 * k, 1),
}
with open(os.path.join(D, "panel_layout.json"), "w") as f:
    json.dump(layout, f)
print("panel layout (mm):", layout)

# ───────────────────────── back ─────────────────────────
# back.jpg, straight on: the cabinet's back from the top cover's lower edge (row 234) to the plinth (row 1134), corners measured
# on the photo (the camera is a little above, so the bottom is narrower). Rectified to 540 x 715 mm at 1.6 px/mm.
bk = photo("back.jpg")
src = np.float32([[664, 234], [1345, 234], [1329, 1134], [674, 1134]])
BW, BH = 864, 1144
dst = np.float32([[0, 0], [BW, 0], [BW, BH], [0, BH]])
Hm = cv2.getPerspectiveTransform(src, dst)
back = cv2.warpPerspective(bk, Hm, (BW, BH), flags=cv2.INTER_CUBIC)
# the serial-number sticker at the lower left reads T70SPMB1Z.ABMQEIL(IN) (another model's code and a serial): painted out,
# filled from its edges, then given the steel's grain from the plain panel above it
src_lbl = np.float32([[[760, 1085]], [[868, 1085]], [[868, 1126]], [[760, 1126]]])
pts = cv2.perspectiveTransform(src_lbl, Hm).reshape(-1, 2)
x0b, y0b = pts.min(0).astype(int) - 4
x1b, y1b = pts.max(0).astype(int) + 4
y1b = min(y1b, BH - 3)
b8 = np.clip(back, 0, 255).astype(np.uint8)
m = np.zeros(b8.shape[:2], np.uint8)
m[y0b:y1b, x0b:x1b] = 255
b8 = cv2.inpaint(b8, m, 9, cv2.INPAINT_TELEA)
hh, ww = y1b - y0b, x1b - x0b
ref = back[700:700 + hh, 300:300 + ww].astype(np.float32)
grain = ref - cv2.GaussianBlur(ref, (0, 0), 6)
back = b8.astype(np.float32)
back[y0b:y1b, x0b:x1b] += 0.55 * grain
save(Image.fromarray(np.clip(back, 0, 255).astype(np.uint8)), "back.jpg", q=82)


# ───────────────────────── drum wall ─────────────────────────
# LG's "Punch + 3" embossed drum (drum.jpg, inside.jpg): stainless steel with large round dimples (about 20 mm) in staggered rows
# and small drain holes (about 5 mm) between them. One tile is 96 x 96 mm at 5 px/mm; it repeats round the drum.
TPX = 5
T = 96 * TPX
yy, xx = np.mgrid[0:T, 0:T].astype(np.float32)
base = 172 + 10 * np.sin(xx / T * 2 * np.pi) + rng.normal(0, 2.5, (T, T))
base = cv2.GaussianBlur(base.astype(np.float32), (0, 0), 1.2)
base += cv2.GaussianBlur(rng.normal(0, 5, (T, 1)).astype(np.float32), (0, 0), 0.8) * np.ones((1, T), np.float32)
img = np.dstack([base, base + 2, base + 5])
sh = np.zeros((T, T), np.float32)
holes = np.zeros((T, T), np.float32)


def wrap(dd):
    return (dd + T / 2) % T - T / 2


R = 10 * TPX
for cx, cy in [(T / 4, T / 4), (3 * T / 4, 3 * T / 4)]:
    X, Y = wrap(xx - cx), wrap(yy - cy)
    r = np.sqrt(X * X + Y * Y)
    inside = np.clip((R - r) / 2.0, 0, 1)
    sh += inside * (-(0.6 * X + Y) / R) * 46
    sh += inside * np.exp(-((X + 0.35 * R) ** 2 + (Y + 0.35 * R) ** 2) / (2 * (0.22 * R) ** 2)) * 50
    sh -= np.exp(-((r - R) ** 2) / (2 * 1.5 ** 2)) * 26
for cx, cy in [(3 * T / 4, T / 4), (T / 4, 3 * T / 4), (0, 0), (T / 2, T / 2), (T / 2, 0), (0, T / 2)]:
    X, Y = wrap(xx - cx), wrap(yy - cy)
    rh = np.sqrt(X * X + Y * Y)
    holes = np.maximum(holes, np.clip((2.6 * TPX - rh) / 1.2, 0, 1))
img = img + sh[..., None]
img = img * (1 - holes[..., None]) + np.array((44, 46, 50), np.float32) * holes[..., None]
save(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), "drum.jpg", q=84)

# ───────────────────────── pulsator ─────────────────────────
# drum.jpg looks straight down on the TurboDrum pulsator: its centre cap at (1026, 656), its dotted rim about 262 px from it, the three
# turbines about 170 px from it at -104, 17 and 136 degrees. A square of radius 346 px round the cap is taken, for discs UV-mapped
# from above: in the texture the rim is 194 px from the centre and the turbines' centres 126 px.
dr = photo("drum.jpg")
cx, cy, R = 1026, 656, 346
pul = dr[cy - R:cy + R, cx - R:cx + R].copy()
pul = cv2.resize(pul, (512, 512), interpolation=cv2.INTER_AREA)
save(Image.fromarray(np.clip(pul, 0, 255).astype(np.uint8)), "pulsator.jpg", q=86)

# ───────────────────────── lint filter ─────────────────────────
# drum.jpg: the blue lint filter on the drum wall at the right, toward the back, centre (1385, 495), 88 x 158 px
fx, fy, fr = 1385, 495, 84
fil = cv2.resize(dr[fy - fr:fy + fr, fx - fr:fx + fr].copy(), (256, 256), interpolation=cv2.INTER_AREA)
save(Image.fromarray(np.clip(fil, 0, 255).astype(np.uint8)), "filter.jpg", q=86)

# ───────────────────────── detergent drawer face ─────────────────────────
# inside.jpg: the drawer's front face (pulled out), its four corners on the photo; rectified to 150 x 45 mm at 4 px/mm
ins = photo("inside.jpg")
src = np.float32([[765, 567], [1192, 427], [1195, 512], [767, 650]])
dst = np.float32([[0, 0], [600, 0], [600, 180], [0, 180]])
face = cv2.warpPerspective(ins, cv2.getPerspectiveTransform(src, dst), (600, 180), flags=cv2.INTER_CUBIC)
save(Image.fromarray(np.clip(face, 0, 255).astype(np.uint8)), "detergent.jpg", q=86)

# ───────────────────────── "8.0kg" print on the rear cover (front.jpg, LG's photo of T80SPMB1Z) ─────────────────────────
a = text_alpha("8.0kg", (AVENIR, 2), 300)
pad = 24
canvas2 = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + 2 * pad), np.float32)
canvas2[pad:pad + a.shape[0], pad:pad + a.shape[1]] = a
rgba = np.dstack([np.full(canvas2.shape, 218, np.float32)] * 3 + [canvas2 * 255]).astype(np.uint8)
save(Image.fromarray(rgba), "kg8.png")
print("kg8 aspect", canvas2.shape[1] / canvas2.shape[0])
