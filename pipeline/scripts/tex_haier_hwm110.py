"""Textures for the Haier HWM110-H688BK 11 kg top-load washing machine with the in-built butterfly heater (Black).

usage: python3 tex_haier_hwm110.py <photos dir> <logos dir> <out dir> [--prep <Haier gallery dir>] [--debug <dir>]
  photos:  haier_hwm110/  cut from Haier's own gallery for this model (its online shop's 4000 x 4000 renders, kept in
           private/research/haier_hwm110/haier/; --prep cuts them again):
             face_rect.jpg   the control console's sloped black glass face, rectified from the panel close-up
                             (HWM110-H688BK_05.png: the face's corners at photo (654, 830), (3453, 830), (3505, 1335),
                             (588, 1335)) to 550 x 95 mm at 8 px per mm (the face's 95 mm slant height is ESTIMATED from
                             its aspect in two photos: 95 mm in this one, 94 mm in the lid-open one)
             inside.jpg      the drum seen from above with the lid open (HWM110-H688BK_07.png at 2000 px)
  logos:   haier.png (the Haier word mark)
  writes <out dir>/haier_hwm110/*

The console face is drawn new at 12 px per mm (panel_l.jpg / panel_r.jpg, its left and right halves, 3300 x 1140 px
each): a flat gloss-black ground; every word set again in Arial Bold, fitted to the box its ink has on the rectified photo
(found by thresholding inside a window round it); key frames, LED squares, rules, the play/pause and power symbols, the
two seven-segment digits and the Program key's four diamonds drawn as shapes at the photo's places and sizes; the Haier
mark from the brand's own outline; the small line icons (child lock, tub clean, auto restart, NZP, fuzzy) are the photo's
own ink cut with a hard threshold from a cubic enlargement; the three coloured pictures in the Process, DIY and Temp.
keys are art and stay the photo's own pixels, enlarged. Words are spelled as printed ("Sanatize" included).
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

args = list(sys.argv[1:])
opt = {}
for k in ("--prep", "--debug"):
    if k in args:
        i = args.index(k)
        opt[k] = args[i + 1]
        del args[i:i + 2]
PHOTOS, LOGOS, OUT = args[:3]
P = os.path.join(PHOTOS, "haier_hwm110")
D = os.path.join(OUT, "haier_hwm110")
os.makedirs(D, exist_ok=True)
os.makedirs(P, exist_ok=True)
ARIAL_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

FW, FH, K = 550, 95, 8           # the face in mm, and the rectified photo's px per mm
PX = 12                          # px per mm of the drawn panel


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def flat(path):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    return np.asarray(bg.convert("RGB"))


# ───────────── --prep: cut the sources out of Haier's 4000 px gallery ─────────────
if "--prep" in opt:
    G = opt["--prep"]
    a = flat(os.path.join(G, "HWM110-H688BK_05.png"))
    src = np.float32([[654, 830], [3453, 830], [3505, 1335], [588, 1335]])
    dst = np.float32([[0, 0], [FW * K, 0], [FW * K, FH * K], [0, FH * K]])
    r = cv2.warpPerspective(a, cv2.getPerspectiveTransform(src, dst), (FW * K, FH * K), flags=cv2.INTER_CUBIC)
    Image.fromarray(r).save(os.path.join(P, "face_rect.jpg"), quality=94, subsampling=0)
    Image.fromarray(flat(os.path.join(G, "HWM110-H688BK_07.png"))).resize((2000, 2000), Image.LANCZOS).save(
        os.path.join(P, "inside.jpg"), quality=90)
    print("prepared", P)

# ───────────────────────── the console face ─────────────────────────
ph = np.asarray(Image.open(os.path.join(P, "face_rect.jpg")).convert("RGB")).astype(np.float32)
S = PX / K                                         # photo px -> panel px
CW, CH = FW * PX, FH * PX
big = cv2.resize(ph, (CW, CH), interpolation=cv2.INTER_CUBIC)
blum = big.mean(2)
GROUND = np.array([9, 9, 10], np.float32)
canvas = np.empty((CH, CW, 3), np.float32)
canvas[:] = GROUND
WHITE = (236, 236, 236)


def put(alpha, colour, x0, y0):
    h, w = alpha.shape
    xs0, ys0, xs1, ys1 = max(0, x0), max(0, y0), min(CW, x0 + w), min(CH, y0 + h)
    if xs1 <= xs0 or ys1 <= ys0:
        return
    a = alpha[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
    if isinstance(colour, np.ndarray) and colour.ndim == 3:
        c = colour[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0]
    else:
        c = np.array(colour, np.float32)
    canvas[ys0:ys1, xs0:xs1] = canvas[ys0:ys1, xs0:xs1] * (1 - a) + c * a


def ink_box(win, thr=110):
    """the box (panel px) of the photo's ink inside a window given in rectified-photo px (x0, y0, x1, y1)"""
    x0, y0, x1, y1 = [int(round(v * S)) for v in win]
    m = blum[y0:y1, x0:x1] > thr
    ys, xs = np.where(m)
    if not len(xs):
        raise SystemExit(f"no ink in {win}")
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def text_alpha(text, w, h):
    f = ImageFont.truetype(ARIAL_B, 200)
    l, t, r, b = f.getbbox(text)
    im = Image.new("L", (r - l + 40, b - t + 40), 0)
    ImageDraw.Draw(im).text((20 - l, 20 - t), text, font=f, fill=255)
    a = np.asarray(im)
    ys, xs = np.where(a > 0)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return cv2.resize(a.astype(np.float32) / 255, (w, h), interpolation=cv2.INTER_AREA)


def word(text, win, colour=WHITE, thr=110):
    bx0, by0, bx1, by1 = ink_box(win, thr)
    put(text_alpha(text, bx1 - bx0, by1 - by0), colour, bx0, by0)


def shape(draw_fn, win, thr=110, k=4):
    """draw a shape (draw_fn(d, w, h) on a k-times canvas of the ink box) in the box the photo's ink takes"""
    bx0, by0, bx1, by1 = ink_box(win, thr)
    w, h = (bx1 - bx0) * k, (by1 - by0) * k
    im = Image.new("L", (w, h), 0)
    draw_fn(ImageDraw.Draw(im), w, h, k)
    a = cv2.resize(np.asarray(im, np.float32) / 255, (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_AREA)
    return a, (bx0, by0)


def stroke_px(win, thr=110):
    """the stroke of a frame: the ink run at the frame's left edge along its middle row, in panel px"""
    bx0, by0, bx1, by1 = ink_box(win, thr)
    row = blum[(by0 + by1) // 2, bx0:bx1] > thr
    n = 0
    while n < len(row) and row[n]:
        n += 1
    return max(n, 2)


def frame(win, radius=0.3, colour=WHITE):
    sw = KEY_STROKE

    def f(d, w, h, k):
        s = sw * k
        d.rounded_rectangle([s / 2, s / 2, w - s / 2, h - s / 2], radius=radius * h, outline=255, width=int(s))
    a, (x, y) = shape(f, win)
    put(a, colour, x, y)


def ink(win, thr=110, colour=WHITE, soft=8.0):
    """the photo's own ink inside a window, hard-edged, in one flat colour (or 'photo': its own pixels)"""
    x0, y0, x1, y1 = [int(round(v * S)) for v in win]
    L = blum[y0:y1, x0:x1]
    a = np.clip((L - thr) / soft + 0.5, 0, 1).astype(np.float32)
    put(a, big[y0:y1, x0:x1] if isinstance(colour, str) else colour, x0, y0)


def art(win, thr=40):
    """a coloured picture: the photo's pixels, where they stand off the black ground"""
    x0, y0, x1, y1 = [int(round(v * S)) for v in win]
    L = blum[y0:y1, x0:x1]
    a = np.clip((L - thr) / 20.0, 0, 1).astype(np.float32)
    put(a, big[y0:y1, x0:x1], x0, y0)


# the key frames' stroke: 0.9 mm, measured on the Process, DIY and Temp. frames (the other frames' edges are fainter
# in the photo, which reflects the studio there)
KEY_STROKE = int(round(0.9 * PX))

# 1. the Haier mark and the capacity (left end)
bx0, by0, bx1, by1 = ink_box((590, 310, 995, 415))
logo = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")
la = np.asarray(logo)[..., 3]
ys, xs = np.where(la > 20)
la = la[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32) / 255
put(cv2.resize(la, (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_AREA), WHITE, bx0, by0)
word("11.0", (710, 445, 846, 502))
word("kg", (847, 445, 897, 480))

# 2. Start/Pause key: frame, play/pause symbol, word
frame((1170, 258, 1350, 389))


def playpause(d, w, h, k):
    s = 0.105 * w                                   # stroke, measured: the symbol's lines are ~1/10 of its width
    tri = [(s / 2, s / 2), (s / 2, h - s / 2), (0.62 * w, h / 2)]
    d.line(tri + [tri[0]], fill=255, width=int(s), joint="curve")
    d.rectangle([0.74 * w, 0, 0.74 * w + s, h], fill=255)
    d.rectangle([w - s, 0, w, h], fill=255)


a, (x, y) = shape(playpause, (1215, 282, 1303, 360))
put(a, WHITE, x, y)
word("Start/Pause", (1170, 386, 1352, 414))

# 3. the programme table, its LED squares and the rule between its two columns
for t, win in [("Water Level", (1480, 170, 1632, 199)), ("Water Time", (1480, 219, 1630, 248)),
               ("Rinse  Time", (1480, 266, 1630, 295)), ("Spin", (1480, 310, 1545, 341)),
               ("Time", (1560, 310, 1630, 341)), ("Delay", (1550, 360, 1630, 392)),
               ("P1", (1697, 172, 1740, 199)), ("P2", (1697, 221, 1740, 248)), ("P3", (1700, 268, 1741, 295)),
               ("P4", (1699, 311, 1740, 339)), ("P5", (1698, 361, 1739, 389)),
               ("Heavy", (1748, 172, 1835, 204)), ("Sports", (1748, 221, 1840, 253)), ("Eco", (1751, 268, 1807, 296)),
               ("Saree", (1750, 311, 1832, 339)), ("Soak", (1748, 361, 1820, 389)),
               ("P6", (1876, 173, 1917, 200)), ("P7", (1882, 221, 1923, 249)), ("P8", (1882, 269, 1923, 296)),
               ("P9", (1881, 312, 1921, 340)), ("PA", (1881, 362, 1925, 390)),
               ("Sanatize", (1926, 173, 2041, 201)), ("Baby Care", (1932, 222, 2069, 254)), ("Mix", (1933, 269, 1983, 297)),
               ("Rinse + Spin", (1931, 312, 2091, 345)), ("Air Dry", (1934, 362, 2030, 395))]:
    word(t, win)
LED = (178, 178, 180)
for win in [(1634, 172, 1657, 199), (1634, 222, 1657, 249), (1635, 270, 1657, 295), (1635, 316, 1657, 342),
            (1635, 363, 1658, 391), (2524, 247, 2547, 275), (2524, 301, 2546, 330), (2524, 356, 2546, 387),
            (2754, 248, 2776, 281), (2754, 303, 2776, 331), (2754, 358, 2776, 388), (2847, 249, 2869, 283),
            (2847, 304, 2869, 338), (2847, 358, 2870, 389)]:
    a, (x, y) = shape(lambda d, w, h, k: d.rectangle([0, 0, w, h], fill=255), win, thr=100)
    put(a, LED, x, y)
a, (x, y) = shape(lambda d, w, h, k: d.rectangle([0, 0, w, h], fill=255), (1848, 160, 1863, 405))
put(a, WHITE, x, y)

# 4. the Process, DIY, Temp. and Program keys with the Child Lock and Tub Clean links between them
for win in [(1556, 427, 1753, 550), (2161, 431, 2355, 553), (2411, 433, 2602, 557), (2712, 433, 2907, 557)]:
    frame(win, radius=0.22)
art((1612, 449, 1698, 534))                         # Process: the water-and-detergent picture
art((2205, 449, 2314, 537))                         # DIY: the hoodie and gear picture
art((2459, 449, 2563, 540))                         # Temp.: the jacket and thermometer picture
CYAN = tuple(np.percentile(big[int(465 * S):int(525 * S), int(2770 * S):int(2852 * S)].reshape(-1, 3)[
    blum[int(465 * S):int(525 * S), int(2770 * S):int(2852 * S)].reshape(-1) > 120], 60, axis=0))


def diamonds(d, w, h, k):
    s = 0.075 * w
    for cx, cy in [(0.5, 0.25), (0.25, 0.5), (0.75, 0.5), (0.5, 0.75)]:
        r = 0.235
        pts = [(cx * w, (cy - r) * h + s / 2), ((cx + r) * w - s / 2, cy * h), (cx * w, (cy + r) * h - s / 2),
               ((cx - r) * w + s / 2, cy * h)]
        d.line(pts + [pts[0]], fill=255, width=int(s), joint="curve")


a, (x, y) = shape(diamonds, (2762, 454, 2860, 534), thr=100)
put(a, CYAN, x, y)
for t, win in [("Process", (1586, 551, 1710, 582)), ("DIY", (2226, 554, 2286, 585)), ("Temp.", (2456, 555, 2555, 591)),
               ("Program", (2743, 557, 2876, 593)), ("Child Lock", (1898, 508, 2021, 533)),
               ("Tub Clean", (2615, 512, 2720, 538))]:
    word(t, win)
for win in [(1756, 480, 1917, 497), (1995, 481, 2156, 498)]:
    a, (x, y) = shape(lambda d, w, h, k: d.rectangle([0, 0, w, h], fill=255), win)
    put(a, WHITE, x, y)
ink((1926, 464, 1990, 510))                         # child-lock face
ink((2606, 472, 2716, 510))                         # tub-clean tub and its two short links

# 5. the display: its grey window, the two digits, "Remaining Minutes" and "Child Lock" under it
x0, y0, x1, y1 = [int(round(v * S)) for v in (2200, 222, 2366, 330)]
win_px = big[y0:y1, x0:x1].reshape(-1, 3)
win_col = np.median(win_px[blum[y0:y1, x0:x1].reshape(-1) < 130], 0)
canvas[y0:y1, x0:x1] = win_col
for xa, xb in [(2224, 2273), (2291, 2341)]:
    def seg8(d, w, h, k):
        t = 0.2 * w
        g = 0.08 * t
        def hseg(y):
            d.polygon([(g + t / 2, y), (t / 2 + g + t / 2, y - t / 2), (w - t / 2 - g - t / 2, y - t / 2),
                       (w - g - t / 2, y), (w - t / 2 - g - t / 2, y + t / 2), (t / 2 + g + t / 2, y + t / 2)], outline=255,
                      width=int(0.22 * t))
        def vseg(x, ya, yb):
            d.polygon([(x, ya + g), (x + t / 2, ya + g + t / 2), (x + t / 2, yb - g - t / 2), (x, yb - g),
                       (x - t / 2, yb - g - t / 2), (x - t / 2, ya + g + t / 2)], outline=255, width=int(0.22 * t))
        for yy in (t / 2, h / 2, h - t / 2):
            hseg(yy)
        for xx in (t / 2, w - t / 2):
            vseg(xx, t / 2, h / 2)
            vseg(xx, h / 2, h - t / 2)
    a, (x, y) = shape(seg8, (xa - 4, 233, xb + 4, 320), thr=150)
    put(a, (226, 226, 228), x, y)
word("Remaining Minutes", (2170, 168, 2412, 202))
word("Child Lock", (2220, 333, 2339, 361))

# 6. the temperature and option columns
for t, win in [("Allergen", (2422, 231, 2520, 259)), ("Free", (2465, 259, 2520, 288)), ("Hot", (2467, 304, 2515, 333)),
               ("Warm", (2449, 358, 2520, 386)), ("Check Water", (2615, 197, 2759, 227)), ("AI Wash", (2660, 248, 2753, 280)),
               ("Shirts", (2680, 305, 2751, 335)), ("Spin", (2695, 359, 2751, 393)), ("Check Voltage", (2865, 199, 3025, 233)),
               ("Delicate", (2871, 249, 2965, 282)), ("Quick 15’", (2872, 304, 2978, 337)), ("P1-PA", (2879, 361, 2952, 389))]:
    word(t, win)

# 7. the Power key and the three badges at the right
frame((3148, 270, 3324, 402))


def power(d, w, h, k):
    s = 0.085 * w
    d.arc([s / 2, 0.14 * h + s / 2, w - s / 2, h - s / 2], start=-55, end=235, fill=255, width=int(s))
    d.rectangle([w / 2 - s / 2, 0, w / 2 + s / 2, 0.52 * h], fill=255)


a, (x, y) = shape(power, (3201, 296, 3277, 372))
put(a, WHITE, x, y)
word("Power", (3186, 398, 3289, 428))
ink((3492, 306, 3576, 377))                         # auto restart: head and clock
ink((3600, 318, 3617, 370))                         # the two rules between the badges
ink((3624, 310, 3815, 380))                         # NZP tap, rule, Fuzzy F
word("AUTO RESTART", (3469, 375, 3603, 398))
word("NZP", (3645, 378, 3697, 399))
word("FUZZY", (3740, 379, 3812, 401))

# the face's own edge: the console is moulded with rounded top corners (the photo's ink outside them is the background)
out = np.clip(canvas, 0, 255).astype(np.uint8)
save(Image.fromarray(out[:, :CW // 2]), "panel_l.jpg", q=90)
save(Image.fromarray(out[:, CW // 2:]), "panel_r.jpg", q=90)
if "--debug" in opt:
    cmp = np.vstack([cv2.resize(ph, (CW // 2, CH // 2)).astype(np.uint8), cv2.resize(out, (CW // 2, CH // 2))])
    Image.fromarray(cmp).save(os.path.join(opt["--debug"], "panel_cmp.png"))

# ───────────────────────── inside: pulsator, filter cap, detergent box print ─────────────────────────
ins = np.asarray(Image.open(os.path.join(P, "inside.jpg")).convert("RGB")).astype(np.float32)
KI = ins.shape[1] / 1000.0  # positions below are in 1000 px units of the lid-open view
# the pulsator, seen from above at a slant in the lid-open view (1000 px units): its rim is an ellipse, centre (500, 755),
# half-axes 214 x 195 px; its front part is hidden by the balance ring, so the back half (photo) is drawn and the hidden
# front half filled by turning the back half 180 degrees (the dish's hole pattern repeats round its centre)
N = 1024
u = (np.arange(N) + 0.5) / N * 2 - 1
U, V = np.meshgrid(u, u)
mx = (KI * (500 + 214 * U)).astype(np.float32)
my = (KI * (755 + 195 * V)).astype(np.float32)
pul = cv2.remap(ins, mx, my, cv2.INTER_CUBIC)
back = V < 0
pul_rot = pul[::-1, ::-1]
pul = np.where(back[..., None], pul, pul_rot)
pul = np.where((U ** 2 + V ** 2 <= 1.0)[..., None], pul, np.array([214, 214, 216], np.float32))
save(Image.fromarray(np.clip(pul, 0, 255).astype(np.uint8)), "pulsator.jpg")
# the Magic filter's white grid cap on the back wall (photo box 432-548 x 350-492)
cap = ins[int(350 * KI):int(492 * KI), int(432 * KI):int(548 * KI)]
save(Image.fromarray(np.clip(cap, 0, 255).astype(np.uint8)).resize((464, 568), Image.LANCZOS), "filter_cap.jpg")

# the drum: Haier's photos show rounded pillows in rows on a light grey drum, a small hole between pillows; no pillow count
# is published for this model, so the pillow is sized off the lid-open photo (about 7 across 90 mm of wall at the back:
# ~30 mm wide, ~33 mm tall, ESTIMATED)
NP, PW, PH = 4, 120, 132
tile = np.zeros((NP * PH, NP * PW), np.float32)
uu = (np.arange(PW) + 0.5) / PW * 2 - 1
vv = (np.arange(PH) + 0.5) / PH * 2 - 1
UU, VV = np.meshgrid(uu, vv)
cush = np.clip(1 - (np.abs(UU) ** 3 + np.abs(VV) ** 3) ** (1 / 3), 0, 1) ** 0.5
shade = 0.66 + 0.34 * cush - 0.14 * np.clip(UU + VV, -1, 1) * cush
for i in range(NP):
    for j in range(NP):
        tile[i * PH:(i + 1) * PH, j * PW:(j + 1) * PW] = shade
yy, xx = np.mgrid[0:NP * PH, 0:NP * PW]
for i in range(NP + 1):
    for j in range(NP + 1):
        tile = np.where(np.hypot(xx - j * PW, yy - i * PH) < 5, 0.2, tile)
tile = cv2.GaussianBlur(tile, (0, 0), 0.8)
drum = np.stack([tile * 196, tile * 198, tile * 203], -1)
save(Image.fromarray(np.clip(drum, 0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS), "drum.jpg")

# the detergent box front: "DETERGENT BOX" in light grey on the box's dark grey (photo: the word 140 mm-wide box's
# print, about 52 x 4 mm), drawn at 12 px per mm as a decal texture with alpha
f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 200)
tw, th = 52 * PX, int(4.2 * PX)
a = text_alpha("DETERGENT BOX", tw, th)
rgba = np.zeros((th + 8, tw + 8, 4), np.uint8)
rgba[..., :3] = 214
rgba[4:4 + th, 4:4 + tw, 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
save(Image.fromarray(rgba, "RGBA"), "detergent_print.png")
