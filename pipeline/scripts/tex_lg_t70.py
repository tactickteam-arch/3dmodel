"""Textures for the LG T70AJMB1Z 7 kg top-load washing machine (Middle Black).

usage: python3 tex_lg_t70.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>]
  photos:  lg_t70/ (LG India's own gallery for T70AJMB1Z, 2010 x 1334; the rating sticker on back.jpg reads T70AJMB1Z.ABMQEIL):
           top_open.jpg   straight down on the machine with the lid open: the control panel (DZ-11)
           back.jpg       the back, straight on (DZ-13)
           inside.jpg     the lid open, close up: the detergent drawer pulled out, the blue lint filter (DZ-09)
           drum.jpg       straight down into the drum: the TurboDrum pulsator (DZ-12)
  manual:  the control-panel drawing for the 10-water-level models (T70AJ* among them) in LG's owner's manual
           MFL72021909, page 25, rendered with  pdftoppm -r 1600 -f 25 -l 25 -x 800 -y 2700 -W 8100 -H 2500 -gray -png
           (kept in .work/, not in git)
  logos:   the logos folder (LG's mark is drawn from pipeline/sources/logos/lg.svg by tex_lg_mark.py)
  writes <out dir>/lg_t70/* (the energy label is cut out separately by tex_bee_label.py into bee_label.png)

Copied from tex_lg_t12.py (LG T12SJMB1Z, the same panel drawing and the same family): the control panel is drawn new at 7 px/mm
from the manual's vector ink, placed by fitting the drawing to LG's straight-down photo of this model; the words and marks the
drawing lacks (LG logo, Smart Diagnosis, the Smart Inverter badge) are set again from the photo; the seven-segment display is
drawn as polygons. The lamps, cycle icons and display are lit as in LG's photo of this model (1:44, Water Level 10, Tub Clean).
Writes panel_layout.json: the raised keys, rings and screw caps in panel millimetres, for the builder.
"""
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
P = os.path.join(PHOTOS, "lg_t70")
D = os.path.join(OUT, "lg_t70")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(70)
import json
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


# LG's straight-down photo (top_open.jpg): the machine is 926 px across its 540 mm (1.715 px/mm, columns 580-1506, centre 1043.5);
# the panel's front edge is at row 1164 on the centre line. The photo sees the 23 degree slope a little foreshortened (0.938, from the manual's
# drawing, which has the panel's true proportions).
def photo_to_panel(X, Y):
    return (X - 1043.5) / 1.715, (1164.0 - Y) / 1.715 / 0.938


def put(alpha, colour, x0, y0):
    """composite an alpha mask (0..1) at texture px (x0, y0) in a colour"""
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
# the frame's inside, clear of the frame lines
keep[int(66 * K):int(456 * K), int(20 * K):int(1460 * K)] = 1
# the callout leader lines and their end dots (callouts 5, 6, 4, 3, 1, 2)
for x0, y0, x1, y1 in [(472, 55, 489, 110), (753, 55, 775, 121), (454, 424, 471, 462), (1019, 424, 1036, 462),
                       (1402, 134, 1466, 151), (1337, 263, 1466, 281)]:
    keep[y0 * K:y1 * K, x0 * K:x1 * K] = 0
ink *= keep
binm = (ink > 0.5).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(binm, 8)
drop = np.zeros(n, bool)
small = lambda i: st[i, 2] <= 6 * K and st[i, 3] <= 6 * K
# the dotted group boxes (cycle icons; keys; programme keys): small dots lying on their edges
for bx0, by0, bx1, by1 in [(333, 100, 628, 172), (57, 323, 870, 432), (905, 323, 1148, 432)]:
    for i in range(1, n):
        if not small(i):
            continue
        cx, cy = cen[i] / K
        on_h = (abs(cy - by0) < 4 or abs(cy - by1) < 4) and bx0 - 4 < cx < bx1 + 4
        on_v = (abs(cx - bx0) < 4 or abs(cx - bx1) < 4) and by0 - 4 < cy < by1 + 4
        if on_h or on_v:
            drop[i] = True
# the display window's outline (LG's panel has none); the printed rings of the power and start keys
for i in range(1, n):
    x, y, w, h = st[i, :4] / K
    cx, cy = cen[i] / K
    if 630 < x and x + w < 892 and 104 < y and y + h < 196 and w > 200:       # the display window's outline
        drop[i] = True
    if 33 < math.hypot(cx - 1370, cy - 142) < 52 or 52 < math.hypot(cx - 1280, cy - 272) < 76:   # bits of the rings
        drop[i] = True
    if abs(cx - 1370) < 6 and abs(cy - 142) < 6 and w > 70:      # the power ring
        drop[i] = True
    if abs(cx - 1280) < 8 and abs(cy - 272) < 8 and w > 110:     # the start ring
        drop[i] = True
# the power symbol and the play-pause mark are placed separately (where LG's photo has them)
power_ids = [i for i in range(1, n) if not drop[i] and 1340 < cen[i][0] / K < 1400 and 110 < cen[i][1] / K < 175]
start_ids = [i for i in range(1, n) if not drop[i] and 1240 < cen[i][0] / K < 1320 and 240 < cen[i][1] / K < 305]
for i in power_ids + start_ids:
    drop[i] = True
mask_keep = (~drop)[lab]
ink_main = np.where(mask_keep, ink, 0)
ink_main[lab == 0] = 0


def comp_ink(ids):
    m = np.isin(lab, ids)
    return np.where(m, ink, 0)


# the lamps (small bars left of each option), found in the drawing, so the ones lit in this model's photo can be named
LAMPS = []
for i in range(1, n):
    w_, h_ = st[i, 2] / K, st[i, 3] / K
    if 5.5 < w_ < 7.2 and 10.5 < h_ < 14 and st[i, 4] / max(1, st[i, 2] * st[i, 3]) > 0.75:
        LAMPS.append((round(cen[i][0] / K), round(cen[i][1] / K)))
LAMPS.sort()
print("lamps in the drawing:", LAMPS)
# Water Level "10": the lamp in the water-level block's right column, top row; Tub Clean: the last programme column, bottom row
wl = [l for l in LAMPS if 330 < l[0] < 470]
WL10 = min((l for l in wl if l[0] > min(x for x, _ in wl) + 10), key=lambda l: l[1])
pg = [l for l in LAMPS if l[0] > 1000]
TUBCLEAN = max(pg, key=lambda l: l[1])
print("lit: water level 10 at", WL10, "tub clean at", TUBCLEAN)
# colour classes, by where the drawing has them (overview units)
LIT = [(78, 244), (215, 215), WL10, TUBCLEAN]      # lamps lit in LG's photo of T70AJMB1Z: Soil Normal, Beeper High, Water Level 10, Tub Clean
TURBO = (-999, -999)    # the Turbo Wash lamp is unlit in this photo (its words are printed blue)
WHITE = (205, 205, 205)
GREY = (160, 160, 162)
SALMON = (214, 136, 108)
ORANGE = (236, 118, 66)
BLUE = (38, 156, 226)
DIM = (46, 46, 48)
YEL = (222, 232, 46)
colour_of = np.zeros(n, object)
for i in range(1, n):
    cx, cy = cen[i] / K
    c = WHITE
    if 395 < cx < 628 and 100 < cy < 172:          # Soak, Wash, Rinse, Spin cycle icons and their words: lit orange in the photo
        c = SALMON
    elif 333 < cx < 395 and 100 < cy < 172:        # Sensing: unlit
        c = GREY
    w, h = st[i, 2] / K, st[i, 3] / K
    fill = st[i, 4] / max(1, st[i, 2] * st[i, 3])
    if 5.5 < w < 7.2 and 10.5 < h < 14 and fill > 0.75:   # a lamp (the small bar left of each option)
        c = GREY
        for lx, ly in LIT:
            if abs(cx - lx) < 6 and abs(cy - ly) < 6:
                c = ORANGE
        if abs(cx - TURBO[0]) < 6 and abs(cy - TURBO[1]) < 6:
            c = BLUE
    elif 915 < cx < 1032 and 240 < cy < 258:        # the words Turbo Wash
        c = BLUE
    if 640 < cx < 880 and 104 < cy < 196:          # the display: the drawing's own italic segments, lit as in LG's photo ( 1:44)
        c = DIM
        digit = next((d for d, (lo, hi) in enumerate([(690, 718), (718, 765), (775, 822), (822, 872)]) if lo <= cx < hi), None)
        if digit is None and 765 <= cx < 775:       # the colon, lit
            c = YEL
        if digit in (1, 2, 3):
            if w > 20:
                seg = "a" if cy < 135 else "g" if cy < 165 else "d"
            else:
                mids = {1: (744.8, 740.0), 2: (801.8, 797.0), 3: (848.4, 843.6)}[digit]
                upper = cy < 150
                seg = ("f" if cx < mids[0] else "b") if upper else ("e" if cx < mids[1] else "c")
            if seg in {1: "bc", 2: "bcfg", 3: "bcfg"}[digit]:
                c = YEL
    colour_of[i] = c

print("lamps lit:", sorted((round(cen[i][0] / K), round(cen[i][1] / K)) for i in range(1, n) if colour_of[i] in (ORANGE, BLUE)))
# fit: drawing -> panel (x mm, s mm). Matched centres, drawing overview units against LG's photo px (top.jpg)
# (the eight keys, Delay, the Sensing and Spin icons, measured on top_open.jpg at 5x)
pairs = [((110, 361), (831.3, 1122.0)), ((246, 362), (881.3, 1127.0)), ((397, 362), (936.3, 1131.0)), ((540, 362), (988.8, 1131.7)),
         ((678, 362), (1039.6, 1131.7)), ((816, 362), (1090.4, 1130.4)), ((956, 362), (1141.7, 1130.4)), ((1096, 362), (1191.7, 1129.2)),
         ((959, 163), (1142.5, 1063.0)), ((364, 128), (924.2, 1051.3)), ((595, 128), (1009.2, 1051.3))]
A, bx, by = [], [], []
for (dx, dy), (X, Y) in pairs:
    x, s = photo_to_panel(X, Y)
    A.append((dx, dy, x * x))
    bx.append(x)
    by.append(s)
A = np.array(A)
# isotropic scale k (mm per drawing unit), offsets; s also bends with x^2 (the print follows the panel's curved front edge)
M = np.zeros((2 * len(pairs), 4))
rhs = np.zeros(2 * len(pairs))
for j, (dx, dy, _) in enumerate(A):
    M[2 * j] = (dx, 1, 0, 0)
    rhs[2 * j] = bx[j]
    M[2 * j + 1] = (-dy, 0, 1, bx[j] ** 2 / 1000.0)
    rhs[2 * j + 1] = by[j]
k, x0, s0, bend = np.linalg.lstsq(M, rhs, rcond=None)[0]
res = M @ np.array([k, x0, s0, bend]) - rhs
print(f"drawing fit: {k:.4f} mm/unit, bend {bend:.3f} mm per 1000 mm2, residual rms {np.sqrt((res ** 2).mean()):.2f} mm, max {abs(res).max():.2f}")


def draw_to_panel(dx, dy):
    x = k * dx + x0
    return x, -k * dy + s0 + bend * x * x / 1000.0


# warp the drawing's ink into the texture: for each texture px find the drawing px (inverse map), per colour class
ys, xs = np.mgrid[0:TH, 0:TW].astype(np.float32)
x_mm = xs / PXMM - XW / 2
s_mm = SMAX - ys / PXMM
dxu = (x_mm - x0) / k
dyu = -(s_mm - s0 - bend * x_mm * x_mm / 1000.0) / k
mapx, mapy = (dxu * K).astype(np.float32), (dyu * K).astype(np.float32)
# supersample: blur the 21 px/mm drawing to the texture's 7 px/mm before sampling (no aliasing)
sig = (K / k / PXMM) / 2.5
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


POWER_XY, START_XY = (1297.0, 1055.0), (1262.5, 1101.5)
place_component(power_ids, WHITE, *POWER_XY)
place_component(start_ids, WHITE, *START_XY)

# ── words and marks the drawing lacks: set again in LG's layout from the photo ──
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


DEMI, MED, BOLD = (COND, 2), (COND, 5), (COND, 0)
SILVER = (196, 198, 202)
# Smart Diagnosis: a round + sign with a phone over its right side, the words below (photo: icon 1250-1269 x 1041-1058)
icon = Image.new("L", (400, 330), 0)
d = ImageDraw.Draw(icon)
d.ellipse((20, 40, 250, 270), outline=255, width=20)
d.rectangle((115, 85, 155, 225), fill=255)
d.rectangle((65, 135, 205, 175), fill=255)
d.rounded_rectangle((200, 30, 370, 300), radius=26, fill=0)
d.rounded_rectangle((210, 40, 360, 290), radius=22, outline=255, width=20)
d.rectangle((270, 255, 300, 268), fill=255)
put_box(np.asarray(icon).astype(np.float32) / 255.0, WHITE, 1249.5, 1040.5, 1269.5, 1058.0)
put_box(text_alpha("Smart", DEMI, 200), WHITE, 1252.0, 1059.0, 1267.0, 1063.2)
put_box(text_alpha("Diagnosis™", DEMI, 200), WHITE, 1248.0, 1063.6, 1275.0, 1069.0)
# the Smart Inverter Motor badge: SMART / INVERTER / MOTOR | 10 / WARRANTY
put_box(text_alpha("SMART", (AVENIR, 2), 200, 0.12), SILVER, 1371.0, 1037.9, 1397.5, 1043.5)
put_box(text_alpha("INVERTER", (AVENIR, 2), 200, 0.18), SILVER, 1373.1, 1044.8, 1396.3, 1047.3)
put_box(text_alpha("MOTOR", (AVENIR, 2), 200, 0.18), SILVER, 1378.0, 1048.5, 1390.6, 1050.6)
put_box(np.ones((60, 4), np.float32), SILVER, 1400.0, 1035.6, 1401.0, 1051.9, keep_aspect=False)
put_box(text_alpha("1", (AVENIR, 2), 400), SILVER, 1403.8, 1036.9, 1407.5, 1048.8)
ring = Image.new("L", (300, 300), 0)
ImageDraw.Draw(ring).ellipse((10, 10, 290, 290), outline=255, width=46)
put_box(np.asarray(ring).astype(np.float32) / 255.0, SILVER, 1407.3, 1036.9, 1419.6, 1048.8)
put_box(text_alpha("WARRANTY", (AVENIR, 2), 200, 0.12), SILVER, 1403.8, 1050.0, 1419.4, 1051.6)

# the LG logo, silver: the face's disc becomes a silver disc with the face cut out of it, the letters silver
# (LG's vector mark, tex_lg_mark.py, in logos/lg.png's layout: sharp at any density; lg.png's 349 px were 9 px per mm here)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tex_lg_mark
logo = np.asarray(tex_lg_mark.lg_hi(LOGOS, 1200)).astype(np.float32)
lg_a = logo[..., 3] / 255.0 * (1 - np.clip((logo[..., :3].min(2) - 150) / 70, 0, 1))
put_box(lg_a, SILVER, 665.0, 1037.0, 721.6, 1061.0)

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
    crop = ph[1020:1164, 580:1506]
    Image.fromarray(crop.astype(np.uint8)).resize((TW // 2, int(TW / 2 * 144 / 926))).save(os.path.join(DEBUG, "panel_photo.png"))
    Image.fromarray(canvas.astype(np.uint8)).resize((TW // 2, TH // 2)).save(os.path.join(DEBUG, "panel_half.png"))

# ───────────────────────── the panel's raised parts, for the builder ─────────────────────────
# key centres from the fitted drawing (the drawing's key outlines are where the keys are); the Power and Start rings and the two
# screw caps from LG's photo (top_open.jpg: Power ring centre (1297, 1055) radius 17 px, Start (1262.5, 1101.5) radius 24 px,
# screw caps at (644, 1049) and (1445, 1044), radius 16 px)
KEYS_DRAW = [(110, 361), (246, 362), (397, 362), (540, 362), (678, 362), (816, 362), (956, 362), (1096, 362), (959, 163)]
layout = {
    "keys": [[round(v, 1) for v in draw_to_panel(*k)] for k in KEYS_DRAW],
    "rings": [[*[round(v, 1) for v in photo_to_panel(*xy)], round(r / 1.715, 1)] for xy, r in [((1297.0, 1055.0), 17), ((1262.5, 1101.5), 24)]],
    "caps": [[round(v, 1) for v in photo_to_panel(*xy)] for xy in [(644.0, 1049.0), (1445.0, 1044.0)]],
    "capR": round(16 / 1.715, 1),
}
with open(os.path.join(D, "panel_layout.json"), "w") as f:
    json.dump(layout, f)
print("panel layout (mm):", layout)

# ───────────────────────── back ─────────────────────────
# back.jpg, straight on (1.311 px/mm: 1160 px for the 885 mm height): the cabinet's back from the top cover's lower edge (row 219)
# to the plinth (row 1138), corners measured on the photo. Rectified to 540 x 701 mm at 1.6 px/mm.
bk = photo("back.jpg")
src = np.float32([[646, 219], [1340, 219], [1338, 1138], [648, 1138]])
BW, BH = 864, 1122
dst = np.float32([[0, 0], [BW, 0], [BW, BH], [0, BH]])
Hm = cv2.getPerspectiveTransform(src, dst)
back = cv2.warpPerspective(bk, Hm, (BW, BH), flags=cv2.INTER_CUBIC)
# the serial-number sticker at the lower left (it reads T70AJMB1Z.ABMQEIL(EN), which confirms the photo is this model) carries a
# serial number: painted out. Filled smoothly from its edges, then given the steel's grain from the plain panel above it.
src_lbl = np.float32([[[756, 1088]], [[848, 1088]], [[848, 1128]], [[756, 1128]]])
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
# LG's "Punch + 3" drum (drum.jpg, inside.jpg): stainless steel with large round embossed dimples (about 20 mm) in staggered rows
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


def wrap(d):
    return (d + T / 2) % T - T / 2


R = 10 * TPX
for cx, cy in [(T / 4, T / 4), (3 * T / 4, 3 * T / 4)]:          # dimples, staggered
    X, Y = wrap(xx - cx), wrap(yy - cy)
    r = np.sqrt(X * X + Y * Y)
    inside = np.clip((R - r) / 2.0, 0, 1)
    sh += inside * (-(0.6 * X + Y) / R) * 46                     # lit from above, like the photos
    sh += inside * np.exp(-((X + 0.35 * R) ** 2 + (Y + 0.35 * R) ** 2) / (2 * (0.22 * R) ** 2)) * 50
    sh -= np.exp(-((r - R) ** 2) / (2 * 1.5 ** 2)) * 26
for cx, cy in [(3 * T / 4, T / 4), (T / 4, 3 * T / 4), (0, 0), (T / 2, T / 2), (T / 2, 0), (0, T / 2)]:   # holes in the gaps
    X, Y = wrap(xx - cx), wrap(yy - cy)
    rh = np.sqrt(X * X + Y * Y)
    holes = np.maximum(holes, np.clip((2.6 * TPX - rh) / 1.2, 0, 1))
img = img + sh[..., None]
img = img * (1 - holes[..., None]) + np.array((44, 46, 50), np.float32) * holes[..., None]
save(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), "drum.jpg", q=84)

# ───────────────────────── pulsator ─────────────────────────
# drum.jpg looks straight down on the TurboDrum pulsator: its centre cap at (1056, 716), its dotted rim 228 px from it, the three
# turbines 152 px from it at -60, 60 and 180 degrees. A square of radius 301 px round the cap is taken, for discs UV-mapped from
# above: in the texture the pulsator's rim is 194 px from the centre and the turbines' centres 129 px.
dr = photo("drum.jpg")
cx, cy, R = 1056, 716, 301
pul = dr[cy - R:cy + R, cx - R:cx + R].copy()
pul = cv2.resize(pul, (512, 512), interpolation=cv2.INTER_AREA)
save(Image.fromarray(np.clip(pul, 0, 255).astype(np.uint8)), "pulsator.jpg", q=86)

# ───────────────────────── lint filter ─────────────────────────
# inside.jpg: the blue lint filter on the drum wall, centre (1252, 776), 119 x 96 px
ins = photo("inside.jpg")
fx, fy, fr = 1252, 776, 62
fil = cv2.resize(ins[fy - fr:fy + fr, fx - fr:fx + fr].copy(), (256, 256), interpolation=cv2.INTER_AREA)
save(Image.fromarray(np.clip(fil, 0, 255).astype(np.uint8)), "filter.jpg", q=86)

# ───────────────────────── detergent drawer face ─────────────────────────
# inside.jpg: the drawer's front face (pulled out), its four corners on the photo; rectified to 150 x 45 mm at 4 px/mm
src = np.float32([[822, 585], [1161, 485], [1161, 545], [829, 662]])
dst = np.float32([[0, 0], [600, 0], [600, 180], [0, 180]])
face = cv2.warpPerspective(ins, cv2.getPerspectiveTransform(src, dst), (600, 180), flags=cv2.INTER_CUBIC)
save(Image.fromarray(np.clip(face, 0, 255).astype(np.uint8)), "detergent.jpg", q=86)

# ───────────────────────── "7.0kg" print on the rear cover (front.jpg, top_open.jpg) ─────────────────────────
a = text_alpha("7.0kg", (AVENIR, 2), 300)
pad = 24
canvas2 = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + 2 * pad), np.float32)
canvas2[pad:pad + a.shape[0], pad:pad + a.shape[1]] = a
rgba = np.dstack([np.full(canvas2.shape, 218, np.float32)] * 3 + [canvas2 * 255]).astype(np.uint8)
save(Image.fromarray(rgba, "RGBA"), "kg7.png")
print("kg7 aspect", canvas2.shape[1] / canvas2.shape[0])
