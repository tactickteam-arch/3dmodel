"""Textures for the Haier HWM70-306S8 7 kg top-load washing machine with Ultra Fresh Air (Dark Jade Silver).

usage: python3 tex_haier_hwm70.py <photos dir> <logos dir> <out dir> [--debug <dir>]
  photos:  haier_hwm70/haier/  Haier India's own gallery for HWM70-306S8 (1200 x 1200 renders):
             W020231128540638969138_1200.jpg  the top seen from straight above with the lid up: the control panel and the
                                              drum, pulsator and filters (2.20 px per mm across: the top cover's 520 mm is
                                              photo x 27-1172)
             W020231128540638743408_1200.jpg  the top with the lid shut (the rear ridge's "ULTRA FRESH AIR" print)
  logos:   haier.png (the Haier word mark)
  writes <out dir>/haier_hwm70/*  (the BEE label is cut by tex_bee_label.py, not here)

The control panel is drawn new at 7.2 px per mm: the zones (the gloss black ends with their slanted ribs, the dark grey
printed field, the black display window) are flat colours; every word is set again in Arial, fitted to the box the word
has in Haier's photo, in the photo's own colour; the Haier mark is the brand's own outline; icons, rings, key frames,
ribs, LED slits and rules are the photo's own ink, cut out of a 3.27x cubic enlargement with a hard threshold so their
edges are sharp and their colour flat. The face is the black strip between the top cover's front lip and the silver
trim in front of the lid: photo x 48-1146, y 406-548 (499 x 64.5 mm).
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

args = list(sys.argv[1:])
DEBUG = None
if "--debug" in args:
    DEBUG = args[args.index("--debug") + 1]
    del args[args.index("--debug"):args.index("--debug") + 2]
    os.makedirs(DEBUG, exist_ok=True)
PHOTOS, LOGOS, OUT = args[:3]
P = os.path.join(PHOTOS, "haier_hwm70", "haier")
D = os.path.join(OUT, "haier_hwm70")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(70306)
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
ARIAL_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ARIAL_N = "/System/Library/Fonts/Supplemental/Arial Narrow.ttf"


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def load(name):
    return np.asarray(Image.open(os.path.join(P, name)).convert("RGB")).astype(np.float32)


# ───────────────────────── control panel ─────────────────────────
top = load("W020231128540638969138_1200.jpg")
X0, Y0, X1, Y1 = 48, 406, 1146, 566          # the black strip in the photo (its front edge arcs down to 563 at the middle)
S = 7.2 / 2.2                                 # texture px per photo px: 7.2 px/mm
CW, CH = int(round((X1 - X0) * S)), int(round((Y1 - Y0) * S))
big = cv2.resize(top[Y0 - 4:Y1 + 4, X0 - 4:X1 + 4], None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
o = int(round(4 * S))
big = big[o:o + CH, o:o + CW]
blum = big.mean(2)
canvas = np.zeros((CH, CW, 3), np.float32)


def T(x, y):
    return int(round((x - X0) * S)), int(round((y - Y0) * S))


def put(alpha, colour, x0, y0):
    h, w = alpha.shape
    xs0, ys0 = max(0, x0), max(0, y0)
    xs1, ys1 = min(CW, x0 + w), min(CH, y0 + h)
    if xs1 <= xs0 or ys1 <= ys0:
        return
    a = alpha[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
    canvas[ys0:ys1, xs0:xs1] = canvas[ys0:ys1, xs0:xs1] * (1 - a) + np.array(colour, np.float32) * a


# zones: gloss black ends (with the ribs), dark grey printed field, black display window. Photo colours:
# black 0, field (54, 52, 53), display glass 0-7, its readout window (62, 58, 57)
FIELD = (40, 39, 40)            # the photo's 54 under Haier's render light; the viewer adds about 25%
BLACK = (9, 9, 10)
canvas[...] = BLACK
fx0, _ = T(253, 0)
fx1, _ = T(953, 0)
canvas[:, fx0:fx1] = FIELD
wx0, _ = T(565, 0)
wx1, _ = T(634, 0)
canvas[:, wx0:wx1] = BLACK
canvas += rng.normal(0, 0.5, (CH, CW, 1))


def ink(win, thr, colour=None, soft=6.0, mode="light"):
    """copy the photo's ink inside a photo window as a hard-edged flat-colour shape"""
    x0, y0 = T(win[0], win[1])
    x1, y1 = T(win[2], win[3])
    L = blum[y0:y1, x0:x1]
    a = np.clip((L - thr) / soft + 0.5, 0, 1) if mode == "light" else np.clip((thr - L) / soft + 0.5, 0, 1)
    if colour == "photo":                      # keep the photo's own colour per pixel (rings that fade white to cyan)
        a = a.astype(np.float32)[..., None]
        canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - a) + np.maximum(big[y0:y1, x0:x1], 0) * a
        return colour
    if colour is None:
        px = big[y0:y1, x0:x1].reshape(-1, 3)
        sel = px[a.reshape(-1) > 0.9]
        colour = tuple(np.percentile(sel, 70, axis=0)) if len(sel) else (230, 230, 230)
    put(a.astype(np.float32), colour, x0, y0)
    return colour


def disc(cx, cy, r, colour):
    """a filled circle, centre and radius in photo px"""
    k = 4
    rr = int(np.ceil(r * S)) + 2
    img = Image.new("L", (2 * rr * k, 2 * rr * k), 0)
    c = rr * k
    ImageDraw.Draw(img).ellipse([c - r * S * k, c - r * S * k, c + r * S * k, c + r * S * k], fill=255)
    a = cv2.resize(np.asarray(img).astype(np.float32) / 255, (2 * rr, 2 * rr), interpolation=cv2.INTER_AREA)
    tx, ty = T(cx, cy)
    put(a, colour, tx - rr, ty - rr)


def ink_box(win, thr):
    x0, y0 = T(win[0], win[1])
    x1, y1 = T(win[2], win[3])
    m = blum[y0:y1, x0:x1] > thr
    ys, xs = np.where(m)
    if not len(xs):
        raise SystemExit(f"no ink in {win}")
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def render(text, font, px=200):
    f = ImageFont.truetype(font, px)
    img = Image.new("L", (int(f.getlength(text)) + px, px * 2), 0)
    ImageDraw.Draw(img).text((px // 2, px * 1.5), text, font=f, fill=255, anchor="ls")
    a = np.asarray(img).astype(np.float32) / 255
    ys, xs = np.where(a > 0.02)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def word(text, win, font=ARIAL_B, thr=110, colour=None):
    """erase the photo's word (nothing of it is on the canvas) and set it again sharp in its ink box"""
    bx0, by0, bx1, by1 = ink_box(win, thr)
    if colour is None:
        px = big[by0:by1, bx0:bx1].reshape(-1, 3)
        L = px.mean(1)
        colour = tuple(px[L >= np.percentile(L, 92)].mean(0))
    a = render(text, font)
    a = cv2.resize(a, (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_AREA)
    put(a, colour, bx0, by0)
    return (bx0, by0, bx1, by1)


# slanted ribs in the two black ends: nine dark grey strokes each side (and the field's own edge), found on photo
# rows 412 and 520 where the strip's grey frame is clear of them, and drawn straight from the strip's top to its bottom
def rib_runs(y, lo, hi):
    row = cv2.resize(top[y:y + 1, 0:1200], None, fx=S, fy=1, interpolation=cv2.INTER_CUBIC).mean(2)[0]
    seg = row[int(lo * S):int(hi * S)] > 12
    runs, st = [], None
    for i, v in enumerate(list(seg) + [False]):
        if v and st is None:
            st = i
        if not v and st is not None:
            if i - st > 1:
                runs.append((lo + st / S, lo + i / S))
            st = None
    return runs


RIB = (34, 34, 36)
for (lo, hi), (lo2, hi2) in (((95, 245), (95, 250)), ((955, 1092), (948, 1092))):
    ra, rb = rib_runs(412, lo, hi), rib_runs(520, lo2, hi2)
    assert len(ra) == len(rb), (ra, rb)
    for (a0, a1), (b0, b1) in zip(ra, rb):
        # centres from the runs, a constant 3.8 photo px (1.7 mm) stroke: the runs' own widths follow the photo's light
        ca, cb = (a0 + a1) / 2, (b0 + b1) / 2
        a0, a1, b0, b1 = ca - 1.9, ca + 1.9, cb - 1.9, cb + 1.9
        def at(y, u0, u1, v0, v1):
            t_ = (y - 412) / 108
            return u0 + (v0 - u0) * t_, u1 + (v1 - u1) * t_
        k = 4
        img = Image.new("L", (CW * k // 8 + 8, CH * k), 0)        # draw at 4x in a strip wide enough
        p0, p1 = at(Y0, a0, a1, b0, b1), at(Y1, a0, a1, b0, b1)
        xs_min = min(p0[0], p1[0]) - 2
        poly = [((p0[0] - xs_min) * S * k, 0), ((p0[1] - xs_min) * S * k, 0), ((p1[1] - xs_min) * S * k, CH * k), ((p1[0] - xs_min) * S * k, CH * k)]
        ImageDraw.Draw(img).polygon(poly, fill=255)
        a = cv2.resize(np.asarray(img).astype(np.float32) / 255, (img.width // k, CH), interpolation=cv2.INTER_AREA)
        put(a, RIB, T(xs_min, 0)[0], 0)
canvas[:, fx0:fx1] = FIELD
canvas[:, wx0:wx1] = BLACK

# the Haier mark: the brand's own outline, silver as in the photo (198-214), fitted to the photo's box
logo = np.asarray(Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")).astype(np.float32)[..., 3] / 255
ys, xs = np.where(logo > 0.05)
logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
lb = ink_box((140, 446, 252, 478), 120)
put(cv2.resize(logo, (lb[2] - lb[0], lb[3] - lb[1]), interpolation=cv2.INTER_AREA), (206, 206, 210), lb[0], lb[1])
word("7.0kg", (195, 479, 250, 497), font=ARIAL, thr=110, colour=(206, 206, 210))

# water-level table
word("Detergent", (366, 419, 410, 430))
word("Flash", (434, 419, 462, 430))
word("Normally on", (462, 419, 512, 430))
rows = [(433, 444), (449, 460), (465, 476), (481, 492)]
for (y0, y1), a, b, c in zip(rows, ["48L-54L", "39L-43L", "27L-33L", "15L-21L"], ["48L", "39L", "27L", "15L"], ["54L", "43L", "33L", "21L"]):
    word(a, (380, y0, 412, y1), font=ARIAL, thr=105)
    word(b, (437, y0, 460, y1), font=ARIAL, thr=105)
    word(c, (472, y0, 496, y1), font=ARIAL, thr=105)
    ink((365, y0, 381, y1), 70, colour="photo", soft=10)         # the tub icon (cyan water in the top two)
ink((462, 428, 470, 505), 18, colour=(0, 0, 0), mode="dark", soft=4)   # the LED column
ink((462, 428, 470, 505), 22, colour=(48, 46, 47), soft=6)              # its four slits
disc(472.5, 517.5, 20.5, (6, 6, 7))
ink((448, 495, 497, 537), 60, colour="photo", soft=10)           # its button ring and icon
word("Water Level", (438, 537, 505, 551))
word("Child Lock", (517, 528, 545, 535), thr=150)
ink((520, 514, 541, 528), 80, soft=10)                           # the child-lock icon
ink((496, 524, 516, 532), 60, soft=10)                           # the rule joining the two buttons, either side of its words
ink((546, 524, 565, 532), 60, soft=10)

# display window
word("Remaining Minutes", (566, 436, 633, 446), thr=120)
word("Delay Hours", (575, 476, 622, 487))
x0, y0 = T(574, 447)
x1, y1 = T(625, 473)
canvas[y0:y1, x0:x1] = (44, 41, 40)
disc(597.5, 517.5, 20.5, (6, 6, 7))
ink((574, 495, 621, 538), 60, colour="photo", soft=10)
word("Delay", (580, 539, 615, 553))

# programme list
for txt, win in [("Wash", (692, 432, 718, 443)), ("Rinse", (690, 448, 718, 459)), ("Spin", (692, 463, 718, 475)),
                 ("Tub Dry", (680, 479, 718, 491)), ("Smart", (738, 432, 768, 443)), ("Soak", (738, 448, 766, 459)),
                 ("Delicate", (737, 463, 776, 475)), ("Quick", (737, 479, 766, 491))]:
    word(txt, win)
for xx in ((718, 727), (736, 745)):
    ink((xx[0], 428, xx[1], 506), 18, colour=(0, 0, 0), mode="dark", soft=4)
    ink((xx[0], 428, xx[1], 506), 22, colour=(48, 46, 47), soft=6)
disc(728, 517.5, 20.5, (6, 6, 7))
ink((704, 495, 752, 537), 60, colour="photo", soft=10)
word("Program", (704, 537, 752, 551))

# keys: power (orange frame and symbol), start/pause (cyan)
ink((820, 444, 870, 484), 60, colour=(238, 92, 24), soft=12)
ink((772, 484, 822, 523), 60, colour=(40, 196, 236), soft=12)

# the four feature icons and their names, silver
ink((925, 440, 1100, 471), 80, colour="photo", soft=12)
for txt, win in [("FRESH AIR", (921, 472, 955, 478)), ("NZP", (967, 472, 984, 478)), ("AUTO RESTART", (1000, 470, 1050, 476)),
                 ("OCEANUS WAVE", (1054, 470, 1104, 476))]:
    word(txt, win, font=ARIAL_N, thr=70)

pan = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
save(pan, "panel.jpg", q=90)
if DEBUG:
    ph = Image.fromarray(np.clip(big, 0, 255).astype(np.uint8))
    st = Image.new("RGB", (CW, CH * 2))
    st.paste(ph, (0, 0)); st.paste(pan, (0, CH))
    st.save(os.path.join(DEBUG, "panel_compare.jpg"), quality=85)

# ───────────────────────── the rear ridge print: "ULTRA FRESH AIR" with the fan mark ─────────────────────────
# Haier's lid-shut photo: the print is grey (150) on the ridge's black face, 56 mm long, 3.6 mm tall letters, the fan mark
# 4.8 mm across left of it (photo 16 at about 2.1 px/mm there). Drawn at 16 px/mm as a decal with alpha.
R = 16
rw, rh = int(64 * R), int(7 * R)
dec = np.zeros((rh, rw), np.float32)
t = render("ULTRA FRESH AIR", ARIAL_B)
th = int(3.6 * R)
t = cv2.resize(t, (int(t.shape[1] * th / t.shape[0]), th), interpolation=cv2.INTER_AREA)
x = int(8 * R)
dec[(rh - th) // 2:(rh - th) // 2 + th, x:x + t.shape[1]] = np.maximum(dec[(rh - th) // 2:(rh - th) // 2 + th, x:x + t.shape[1]], t)
# the fan mark: the panel's own FRESH AIR icon ink (the same mark), cut from the enlarged photo
fx0_, fy0_ = T(925, 443)
fx1_, fy1_ = T(951, 467)
fan = np.clip((blum[fy0_:fy1_, fx0_:fx1_] - 80) / 12 + 0.5, 0, 1)
ys, xs = np.where(fan > 0.2)
fan = fan[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
fs_ = int(4.8 * R)
fan = cv2.resize(fan, (fs_, int(fan.shape[0] * fs_ / fan.shape[1])), interpolation=cv2.INTER_AREA)
fy = (rh - fan.shape[0]) // 2
dec[fy:fy + fan.shape[0], int(1.5 * R):int(1.5 * R) + fan.shape[1]] = fan
ys, xs = np.where(dec > 0.02)
dec = dec[:, :xs.max() + int(0.5 * R)]
rgba = np.zeros(dec.shape + (4,), np.uint8)
rgba[..., :3] = 150
rgba[..., 3] = np.clip(dec * 255, 0, 255).astype(np.uint8)
save(Image.fromarray(rgba, "RGBA").quantize(16, method=Image.Quantize.FASTOCTREE), "ridge_print.png")
print("ridge print", dec.shape[1] / R, "x", dec.shape[0] / R, "mm")

# ───────────────────────── inside ─────────────────────────
# the pulsator: Sangeetha's top photo of this model (690c98289f3f1.jpg), the blue dish seen square-on: centre (561, 553),
# radius 136 px to the dish's rim (Haier's own top photo cuts the dish off at its upper edge)
sg = np.asarray(Image.open(os.path.join(PHOTOS, "haier_hwm70", "sangeetha", "690c98289f3f1.jpg")).convert("RGB")).astype(np.float32)
cx, cy, r = 561, 553, 137
pul = sg[cy - r:cy + r, cx - r:cx + r].copy()
yy, xx = np.mgrid[-r:r, -r:r]
rr = np.hypot(xx, yy) / r
base = np.array([128, 140, 236], np.float32)            # the photo's blue between the holes
pul = np.where(rr[..., None] <= 0.985, pul, base)
pul = cv2.resize(pul, (512, 512), interpolation=cv2.INTER_CUBIC)
save(Image.fromarray(np.clip(pul * 0.92, 0, 255).astype(np.uint8)), "pulsator.jpg")

# the Pillow Drum: Haier's drum picture shows square pillows in rows with a round hole at each corner where four meet.
# Haier gives 560 protrusions and 2.2 mm holes; over the modelled drum wall (r 215 mm, 400 mm deep: 0.54 m2) that is a
# pillow about 31 mm square (ESTIMATED). One tile = 4 x 4 pillows (124 mm), drawn as the shading of a raised cushion.
N, PILL = 4, 128
tile = np.zeros((N * PILL, N * PILL), np.float32)
u = (np.arange(PILL) + 0.5) / PILL * 2 - 1
U, V = np.meshgrid(u, u)
cush = np.clip(1 - (np.abs(U) ** 4 + np.abs(V) ** 4) ** 0.25, 0, 1) ** 0.6
shade = 0.62 + 0.38 * cush - 0.12 * np.clip(U + V, -1, 1) * cush
for i in range(N):
    for j in range(N):
        tile[i * PILL:(i + 1) * PILL, j * PILL:(j + 1) * PILL] = shade
hole = PILL * 2.2 / 31 / 2
yy, xx = np.mgrid[0:N * PILL, 0:N * PILL]
for i in range(N + 1):
    for j in range(N + 1):
        d = np.hypot(xx - j * PILL, yy - i * PILL)
        tile = np.where(d < hole, 0.18, tile)
tile = cv2.GaussianBlur(tile, (0, 0), 0.8)
drum = np.stack([tile * 178, tile * 182, tile * 188], -1)
save(Image.fromarray(np.clip(drum, 0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS), "drum.jpg")
