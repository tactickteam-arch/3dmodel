"""Textures for the LG T12SJMB1Z 12 kg top-load washing machine (Middle Black).

usage: python3 tex_lg_t12.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>]
  photos:  lg_t12/ (LG India's own gallery for T12SJMB1Z, 2010 x 1334):
           top.jpg        straight down on the closed machine: the control panel, the lid and its crescent handle
           label.jpg      LG's energy label for T12SJMB1Z (0.0077 kWh/kg/cycle, 12.0 kg) beside the machine
           back.jpg       the back, straight on
           inside.jpg     the lid open, close up: the detergent drawer, the blue lint filter, the drum wall
           drum.jpg       straight down into the drum: the TurboDrum pulsator
  manual:  the control-panel drawing for the 10-water-level models (T12SJ* among them) in LG's owner's manual
           MFL72021909, page 25, rendered with  pdftoppm -r 1600 -f 25 -l 25 -x 800 -y 2700 -W 8100 -H 2500 -gray -png
           (kept in .work/, not in git)
  logos:   lg.png
  writes <out dir>/lg_t12/*

The control panel is drawn new at 7 px/mm: every word, number and icon is the manual's vector ink (the same layout as LG's
photo), placed by fitting the drawing to the photo; the callout discs, leader lines, the dotted group boxes and the printed
button rings are removed (the rings are raised 3D parts in the model). The words and marks the drawing lacks (LG logo,
Smart Diagnosis, the Smart Inverter badge) are set again from the photo. The seven-segment display is drawn as polygons.
Colours (lit lamps, the orange cycle icons, the blue Turbo Wash, the yellow display) are the ones in LG's photo.
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
PHOTOS, MANUAL, LOGOS, OUT = args[:4]
P = os.path.join(PHOTOS, "lg_t12")
D = os.path.join(OUT, "lg_t12")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(12)
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
# The panel face is the sloped front of the top cover, 23 degrees up toward the lid. Texture coordinates: x across (590 mm, the
# machine's width, centred), s up the slope from the front edge (0 to 140 mm). Row 0 is the back (s = 140 mm).
PXMM = 7.0
XW, SMAX = 590.0, 140.0
TW, TH = int(XW * PXMM), int(SMAX * PXMM)
BG = np.array((12, 12, 13), np.float32)
canvas = np.zeros((TH, TW, 3), np.float32)
canvas[...] = BG
canvas += rng.normal(0, 0.5, (TH, TW, 1))


def tex_xy(x_mm, s_mm):
    return ((x_mm + XW / 2) * PXMM, (SMAX - s_mm) * PXMM)


# LG's straight-down photo (top.jpg): the machine is 911 px across its 590 mm at the top (1.544 px/mm); the panel's front edge is
# at row 1131 on the centre line (column 1004). The photo sees the 23 degree slope a little foreshortened (0.938, from the manual's
# drawing, which has the panel's true proportions).
def photo_to_panel(X, Y):
    return (X - 1004.0) / 1.544, (1131.0 - Y) / 1.544 / 0.938


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


# colour classes, by where the drawing has them (overview units)
LIT = [(78, 244), (215, 215), (348, 220), (549, 249), (667, 308), (779, 279), (908, 220)]      # lamps lit in LG's photo
TURBO = (908, 249)
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
    if 450 < cx < 628 and 100 < cy < 172:          # Wash, Rinse, Spin cycle icons and their words: lit orange in the photo
        c = SALMON
    elif 333 < cx < 450 and 100 < cy < 172:        # Sensing, Soak: unlit
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
    if 640 < cx < 880 and 104 < cy < 196:          # the display: the drawing's own italic segments, lit as in LG's photo (1 8 : 4 6)
        c = DIM
        digit = next((d for d, (lo, hi) in enumerate([(690, 718), (718, 765), (775, 822), (822, 872)]) if lo <= cx < hi), None)
        if digit in (2, 3):
            if w > 20:
                seg = "a" if cy < 135 else "g" if cy < 165 else "d"
            else:
                mids = {2: (801.8, 797.0), 3: (848.4, 843.6)}[digit]
                upper = cy < 150
                seg = ("f" if cx < mids[0] else "b") if upper else ("e" if cx < mids[1] else "c")
            if seg in {2: "bcfg", 3: "acdefg"}[digit]:
                c = YEL
    colour_of[i] = c

print("lamps lit:", sorted((round(cen[i][0] / K), round(cen[i][1] / K)) for i in range(1, n) if colour_of[i] in (ORANGE, BLUE)))
# fit: drawing -> panel (x mm, s mm). Matched centres, drawing overview units against LG's photo px (top.jpg)
pairs = [((110, 361), (795.7, 1089.3)), ((246, 362), (845.7, 1093.3)), ((397, 362), (901.0, 1097.3)), ((540, 362), (952.7, 1097.3)),
         ((678, 362), (1003.3, 1097.3)), ((816, 362), (1053.7, 1097.3)), ((956, 362), (1104.3, 1096.7)), ((1096, 362), (1155.0, 1096.7)),
         ((959, 163), (1106.7, 1030.0)), ((364, 128), (888.7, 1017.3)), ((595, 128), (974.3, 1017.3))]
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
    """place drawing components centred on a photo point (top.jpg px), at the drawing's true size"""
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


POWER_XY, START_XY = (1257.3, 1021.7), (1222.3, 1067.3)
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
    """fit an alpha into the box a word has in LG's photo (top.jpg px)"""
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
# Smart Diagnosis: a round + sign with a phone over its right side, the words below (photo: icon 1206-1232 x 1006-1027)
icon = Image.new("L", (400, 330), 0)
d = ImageDraw.Draw(icon)
d.ellipse((20, 40, 250, 270), outline=255, width=20)
d.rectangle((115, 85, 155, 225), fill=255)
d.rectangle((65, 135, 205, 175), fill=255)
d.rounded_rectangle((200, 30, 370, 300), radius=26, fill=0)
d.rounded_rectangle((210, 40, 360, 290), radius=22, outline=255, width=20)
d.rectangle((270, 255, 300, 268), fill=255)
put_box(np.asarray(icon).astype(np.float32) / 255.0, WHITE, 1205.0, 1004.5, 1233.5, 1028.0)
put_box(text_alpha("Smart", DEMI, 200), WHITE, 1206.5, 1029.0, 1222.0, 1034.0)
put_box(text_alpha("Diagnosis™", DEMI, 200), WHITE, 1201.0, 1034.0, 1228.5, 1039.5)
# the Smart Inverter Motor badge: SMART / INVERTER / MOTOR | 10 / WARRANTY
put_box(text_alpha("SMART", (AVENIR, 2), 200, 0.12), SILVER, 1325.0, 1003.0, 1356.0, 1011.0)
put_box(text_alpha("INVERTER", (AVENIR, 2), 200, 0.18), SILVER, 1327.0, 1012.5, 1354.0, 1016.0)
put_box(text_alpha("MOTOR", (AVENIR, 2), 200, 0.18), SILVER, 1332.0, 1016.8, 1349.0, 1020.0)
put_box(np.ones((60, 4), np.float32), SILVER, 1357.8, 1004.0, 1359.0, 1022.0, keep_aspect=False)
put_box(text_alpha("1", (AVENIR, 2), 400), SILVER, 1361.0, 1004.5, 1365.0, 1017.5)
ring = Image.new("L", (300, 300), 0)
ImageDraw.Draw(ring).ellipse((10, 10, 290, 290), outline=255, width=46)
put_box(np.asarray(ring).astype(np.float32) / 255.0, SILVER, 1365.5, 1004.5, 1378.5, 1017.5)
put_box(text_alpha("WARRANTY", (AVENIR, 2), 200, 0.12), SILVER, 1361.0, 1018.5, 1378.5, 1021.5)

# the LG logo, silver: the face's disc becomes a silver disc with the face cut out of it, the letters silver
logo = np.asarray(Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")).astype(np.float32)
la = logo[..., 3] / 255.0
red = (logo[..., 0] - logo[..., 1] > 60)
white = (logo[..., :3].min(2) > 200)
lg_a = la * np.where(white & ~red, 0.0, 1.0)
put_box(lg_a, SILVER, 630.0, 1006.0, 690.0, 1024.0)

canvas = np.clip(canvas, 0, 255)
save(Image.fromarray(canvas.astype(np.uint8)), "panel.jpg", q=90)
if DEBUG:
    ph = photo("top.jpg")
    crop = ph[985:1125, 560:1450]
    Image.fromarray(crop.astype(np.uint8)).resize((TW // 2, int(TW / 2 * 140 / 890))).save(os.path.join(DEBUG, "panel_photo.png"))
    Image.fromarray(canvas.astype(np.uint8)).resize((TW // 2, TH // 2)).save(os.path.join(DEBUG, "panel_half.png"))

# ───────────────────────── energy label ─────────────────────────
# LG's own label image for T12SJMB1Z (label.jpg, the left half): cut out from the white backdrop
lab_img = photo("label.jpg")[160:1176, 368:920]
lum = lab_img.mean(2)
mask = (lab_img.min(2) < 236).astype(np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
n2, l2, s2, _ = cv2.connectedComponentsWithStats(mask, 8)
big = 1 + int(np.argmax(s2[1:, 4]))
m = (l2 == big).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
# fill holes
ff = np.pad(m, 2)
h, w = ff.shape
cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 1)
m = m | (1 - ff[2:-2, 2:-2])
yy, xx = np.where(m)
lab_img, m = lab_img[yy.min():yy.max() + 1, xx.min():xx.max() + 1], m[yy.min():yy.max() + 1, xx.min():xx.max() + 1]
alpha = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.8)
# the photo's JPEG noise, smoothed out of the flat colours (it doubled the file's size); the print's edges are kept
lab_img = cv2.fastNlMeansDenoisingColored(np.clip(lab_img, 0, 255).astype(np.uint8), None, 6, 6, 5, 15).astype(np.float32)
rgba = np.dstack([lab_img, alpha * 255]).astype(np.uint8)
lab_pil = Image.fromarray(rgba, "RGBA")
lab_pil = lab_pil.resize((lab_pil.width * 520 // lab_pil.height * 2 // 2, 520 * 2 // 2) if False else (int(round(lab_pil.width * 1040 / lab_pil.height)), 1040), Image.LANCZOS)
q = lab_pil.convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT)
out = q.convert("RGBA")
out.putalpha(lab_pil.getchannel("A"))
save(out, "label.png")
print("label aspect", lab_pil.width / lab_pil.height)

# ───────────────────────── back ─────────────────────────
# back.jpg, straight on: the cabinet's back from the top cover's lower edge (row 232) to the plinth (row 1144), its corners
# measured on the photo (a slight keystone: 698 px wide at the top, 680 at the bottom). Rectified to 590 x 778 mm at 1.6 px/mm.
bk = photo("back.jpg")
src = np.float32([[658, 232], [1356, 232], [1347, 1144], [666, 1144]])
BW, BH = 944, 1245
dst = np.float32([[0, 0], [BW, 0], [BW, BH], [0, BH]])
Hm = cv2.getPerspectiveTransform(src, dst)
back = cv2.warpPerspective(bk, Hm, (BW, BH), flags=cv2.INTER_CUBIC)
# the serial-number sticker at the lower left (it reads T12SJMB1Z.ABMQEIL, which confirms the photo is this model) carries a
# serial number: painted out. Filled smoothly from its edges, then given the steel's grain from the plain panel above it.
src_lbl = np.float32([[[776, 1100]], [[870, 1100]], [[870, 1142]], [[776, 1142]]])
pts = cv2.perspectiveTransform(src_lbl, Hm).reshape(-1, 2)
x0b, y0b = pts.min(0).astype(int) - 4
x1b, y1b = pts.max(0).astype(int) + 4
y1b = min(y1b, BH - 3)
b8 = np.clip(back, 0, 255).astype(np.uint8)
m = np.zeros(b8.shape[:2], np.uint8)
m[y0b:y1b, x0b:x1b] = 255
b8 = cv2.inpaint(b8, m, 9, cv2.INPAINT_TELEA)
hh, ww = y1b - y0b, x1b - x0b
ref = back[60:60 + hh, 300:300 + ww].astype(np.float32)
grain = ref - cv2.GaussianBlur(ref, (0, 0), 6)
back = b8.astype(np.float32)
back[y0b:y1b, x0b:x1b] += 0.55 * grain
save(Image.fromarray(np.clip(back, 0, 255).astype(np.uint8)), "back.jpg", q=82)

# ───────────────────────── drum wall ─────────────────────────
# LG's "Punch+3" drum (inside.jpg, drum.jpg): stainless steel with large round embossed dimples (about 20 mm) in staggered rows
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
# drum.jpg looks straight down on the TurboDrum pulsator: its centre cap at (1000, 653), its dotted rim 176 px from it, the
# drum wall's foot about 226 px. A square of radius 232 px round the cap is taken, for discs UV-mapped from above: in the
# texture the pulsator's rim is 194 px from the centre and the turbines' centres 128 px.
dr = photo("drum.jpg")
cx, cy, R = 1000, 653, 232
pul = dr[cy - R:cy + R, cx - R:cx + R].copy()
pul = cv2.resize(pul, (512, 512), interpolation=cv2.INTER_AREA)
save(Image.fromarray(np.clip(pul, 0, 255).astype(np.uint8)), "pulsator.jpg", q=86)

# ───────────────────────── lint filter ─────────────────────────
# inside.jpg: the blue lint filter on the drum wall, centre (1200, 731), radius 86 px
ins = photo("inside.jpg")
fx, fy, fr = 1200, 731, 92
fil = cv2.resize(ins[fy - fr:fy + fr, fx - fr:fx + fr].copy(), (256, 256), interpolation=cv2.INTER_AREA)
save(Image.fromarray(np.clip(fil, 0, 255).astype(np.uint8)), "filter.jpg", q=86)

# ───────────────────────── detergent drawer face ─────────────────────────
# inside.jpg: the drawer's front face (pulled out), its four corners on the photo; rectified to 150 x 45 mm at 4 px/mm
src = np.float32([[784, 572], [1163, 430], [1170, 505], [790, 640]])
dst = np.float32([[0, 0], [600, 0], [600, 180], [0, 180]])
face = cv2.warpPerspective(ins, cv2.getPerspectiveTransform(src, dst), (600, 180), flags=cv2.INTER_CUBIC)
save(Image.fromarray(np.clip(face, 0, 255).astype(np.uint8)), "detergent.jpg", q=86)

# ───────────────────────── "12kg" print on the rear cover ─────────────────────────
a = text_alpha("12kg", (AVENIR, 2), 300)
pad = 24
canvas2 = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + 2 * pad), np.float32)
canvas2[pad:pad + a.shape[0], pad:pad + a.shape[1]] = a
rgba = np.dstack([np.full(canvas2.shape, 218, np.float32)] * 3 + [canvas2 * 255]).astype(np.uint8)
save(Image.fromarray(rgba, "RGBA"), "kg12.png")
print("kg12 aspect", canvas2.shape[1] / canvas2.shape[0])
