"""Textures for the Bosch WGA244ZPIN, Series 6 front-load washing machine, 9 kg, 1400 rpm (Dark lake / blue).

usage: python3 tex_bosch_wga244.py <photos dir> <logos dir> <out dir> [--hi]
  photos: bosch_wga244/24491159_WGA244ZPIN_STP_def.webp   Bosch's straight-on studio photo of this model, 2400 x 3350; it is
                                                          resampled to 2415 x 3371 (x 1.0063) so it lies on the same pixel grid
                                                          as the WGA254ZPIN's studio photo (the cabinet spans columns 0-2398 and
                                                          rows 9-3349, the same body drawn 0.6% smaller), and every body
                                                          position measured on that sibling is checked against this photo
          bosch_wga244/360_15.jpg                         frame 15 of the 360-degree view on Bosch's WGA244ZPIN page (square-on
                                                          to the back; Bosch uses the same 360 frames for WGA254ZPIN, pixel for
                                                          pixel, so the rear trace is the sibling's)
          bosch_wga244/22972646_..._darklake_PGA9_def.webp  Bosch's Dark lake side-wall image, on this model's page
          bosch_wga244/display_WGA244ZPIN.png             the display drawing named "WGA244ZPIN" in Bosch's interactive manual
                                                          9001852525, rendered from its SVG at 12 px per unit
          bosch_wga244/icon_*.png                         the manual's own symbols, rendered from its SVGs: SY_Steaming_BO,
                                                          SY_Wool_11, SY_DrumClean_BO1, SY_Spin, SY_Rinse_BO1, SY_ChildLock_1,
                                                          SY_Softener_iDOS_3
  logos:  bosch.png
  writes <out dir>/bosch_wga244/*.jpg and layout.json (every position the builder needs, in metres) and rear_paths.json

Scale. On the resampled photo the cabinet's 598 mm span columns 0 to 2413 (4.037 px per mm) and its top edge is row 9, as on
the sibling's; the photo's last row is 15 mm above the floor, so the feet (15 mm, ESTIMATED) are under its bottom edge.

Text. This model's fascia has its own print (icons beside the programme names, "9 kg / 1400 rpm / Iron Steam Assist" under the
display, the childproof-lock key under the buttons). Every word is set again in Avenir Next, each fitted to the ink box it has
in the photo. Programme symbols that Bosch's manual has as drawings (Steam, Wool, Drum Descale, Spin, Rinse, the key) are its
drawings; the others (Allergy Plus, Shirts, Quick, Duvet, Drain, Cottons, Cottons 60, Synthetics, Daily Mix Load, the wool
skein, Delicates/Silk and the stain symbol lit on the display) exist in no Bosch drawing, so they are the photo's own ink,
lifted from the panel and scaled up smoothly (4 px per mm source: they stay soft at a close look; noted). The display's words,
numbers, symbols and buttons are the ink of Bosch's own vector drawing of this model's display, each scaled into the box it
has in the photo; the time is the drawing's own seven-segment shapes with the photo's lit segments (1:25).
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# --hi: draw only the fascia's print again at 12 px per mm on the model and cut it into the decals the builder lays over the
# strip (print_a.jpg: the programme names and the dial's words; print_b.jpg: the words over the display) and on the display's
# glass (print_c.jpg), with decals.json (their places in panel.jpg's UVs); panel.jpg and the other textures are left alone
HI = "--hi" in sys.argv
PHOTOS, LOGOS, OUT = [a for a in sys.argv[1:] if a != "--hi"][:3]
SRC = os.path.join(PHOTOS, "bosch_wga244")
D = os.path.join(OUT, "bosch_wga244")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(244)
FONT = "/System/Library/Fonts/Avenir Next.ttc"          # Regular: within 2% of the width-to-height of every printed word

# ── the photo's scale ──
PPM = 2414 / 598.0                      # px per mm, both ways
ROW0 = 9                                # the cabinet's top edge (848 mm)
W_MM, H_MM, D_MM = 598.0, 848.0, 590.0  # Bosch's size (product page, product sheet; manual 9001924974 gives width 59.8 cm)
FEET = 0.015                            # ESTIMATED from the 360 frames (13-16 mm) and the photo's scale (15.4 mm)


def mx(col):                            # photo column -> metres from the centre line
    return round((col - 1206.5) / PPM / 1000, 5)


def my(row):                            # photo row -> metres above the floor
    return round((H_MM - (row - ROW0) / PPM) / 1000, 5)


BODY = np.array([74, 80, 96], np.float32)          # Dark lake, the photo's front (median of the lit face)
STRIP_TOP, STRIP_BOT = ROW0, 543.5                  # the fascia: from the top edge to the groove under it (rows 539-548)
S = 12 * 598.0 / 2414 if HI else 4096 / 2414         # panel texture px per photo px (6.85 px per mm; --hi 12)
INK = (198, 200, 203)                               # the fascia print: light grey in the photo (188-192 at its strokes)
WHITE, DIM = (246, 246, 246), (200, 201, 204)       # the display lit print, and its divider lines
SHADE = {"panel.jpg": 0.86, "print_a.jpg": 0.86, "print_b.jpg": 0.86, "print_c.jpg": 0.86, "print_d.jpg": 0.86, "drawer.jpg": 0.9, "front.jpg": 0.8, "side_l.jpg": 0.86, "side_r.jpg": 0.86, "rear.jpg": 0.92}


def save(img, name, q=88):
    if name in SHADE:          # lit by the viewer's environment light, a texture renders about a quarter brighter than its pixels
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * SHADE[name]).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def font(px, face=7):                               # 7 Regular, 5 Medium, 0 Bold (Avenir Next.ttc)
    return ImageFont.truetype(FONT, max(4, round(px)), index=face)


def photo():
    im = Image.open(os.path.join(SRC, "24491159_WGA244ZPIN_STP_def.webp")).convert("RGBA")
    bg = Image.new("RGBA", im.size, tuple(int(v) for v in BODY) + (255,))
    bg.alpha_composite(im)
    return bg.convert("RGB").resize((2415, 3371), Image.LANCZOS)     # onto the sibling's grid (see the top)


# ── drawing ink: the manual's vector drawing of this model's display, rendered at 12 px per unit ──
def drawing():
    a = np.asarray(Image.open(os.path.join(SRC, "display_WGA244ZPIN.png")).convert("L")).astype(np.float32)
    return 1 - a / 255.0


def crop_ink(ink, box):
    x0, y0, x1, y1 = box
    m = ink[y0:y1, x0:x1]
    ys, xs = np.where(m > 0.35)
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def place(canvas, mask, box, colour, keep="w"):
    """Scales an ink mask into a photo box (photo px; x0, y0, x1, y1 of the ink) on the texture canvas, centred, keeping its
    aspect: fitted by width ("w"), by height ("h") or to whichever is tighter ("fit")."""
    x0, y0, x1, y1 = [v * S for v in box]
    bw, bh = x1 - x0, y1 - y0
    h, w = mask.shape
    k = bw / w if keep == "w" else bh / h if keep == "h" else min(bw / w, bh / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    m = cv2.resize(mask.astype(np.float32), (nw, nh), interpolation=cv2.INTER_AREA)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    X, Y = round(cx - nw / 2), round(cy - nh / 2)
    blend(canvas, m, X, Y, colour)


def blend(canvas, m, X, Y, colour):
    h, w = m.shape
    xa, ya, xb, yb = max(0, X), max(0, Y), min(canvas.shape[1], X + w), min(canvas.shape[0], Y + h)
    if xb <= xa or yb <= ya:
        return
    a = np.clip(m[ya - Y:yb - Y, xa - X:xb - X], 0, 1)[..., None]
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + np.array(colour, np.float32) * a


def text_mask(s, px, face=7, spacing=0.0):
    """White-on-black mask of a word set in Avenir Next Condensed, cropped to its ink."""
    f = font(px, face)
    w = int(sum(f.getlength(c) for c in s) + spacing * len(s) + px * 2)
    h = int(px * 2.2)
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    if spacing:
        x = px * 0.5
        for c in s:
            d.text((x, px * 0.4), c, font=f, fill=255)
            x += f.getlength(c) + spacing
    else:
        d.text((px * 0.5, px * 0.4), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.3)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def word(canvas, s, box, colour=INK, face=5, spacing=0.0):   # Medium: the print's stroke weight on this panel
    """A word fitted to the photo's ink box by its width (the letter height follows the font's own proportions)."""
    bw = (box[2] - box[0]) * S
    m = text_mask(s, 60, face, spacing * 60 / max(1, (box[3] - box[1]) * S) if spacing else 0)
    k = bw / m.shape[1]
    m = text_mask(s, 60 * k, face, spacing * S)
    place(canvas, m, box, colour, keep="w")


# ── the fascia: programme names, leader lines, the dial's recess, the drawer's bay, the display ──
# Every box is photo px (x0, y0, x1, y1 of the ink) on the resampled studio photo, read off it with a threshold at 125 and
# connected components (checked on 3x enlargements).
LEFT = [("Steam", (942, 130, 995, 143)), ("Allergy Plus", (947, 173, 1046, 186)), ("Shirts", (948, 218, 999, 232)),
        ("Quick", (948, 255, 997, 269)), ("15/30 min", (947, 273, 1021, 285)), ("Duvet", (948, 310, 998, 324)),
        ("Drum Descale", (948, 357, 1073, 371)), ("Spin/Drain", (977, 398, 1074, 412))]
RIGHT = [("Cottons", (1393, 130, 1462, 143)), ("Cottons 60°", (1356, 163, 1462, 176)), ("Label", (1423, 181, 1463, 193)),
         ("Synthetics", (1370, 219, 1463, 233)), ("Daily", (1391, 255, 1434, 269)), ("Mix Load", (1366, 274, 1433, 286)),
         ("Wool", (1426, 311, 1472, 325)), ("Delicates/", (1375, 351, 1464, 365)), ("Silk", (1437, 369, 1465, 382)),
         ("Rinse", (1415, 399, 1463, 413))]
LEADERS = [(1003, 1102, 136.5), (1056, 1066, 180.5), (1007, 1050, 225.0), (1028, 1044, 271.5), (1006, 1051, 318.0),
           (1079, 1125, 406.5), (1307, 1385, 137.0), (1333, 1350, 178.0), (1359, 1363, 225.0), (1357, 1389, 319.0),
           (1331, 1369, 366.0), (1292, 1408, 407.0)]
# the manual's drawings of the symbols beside a programme name, and where they stand
SYMBOLS = [("icon_steam.png", (916, 126, 933, 146)), ("icon_drumclean.png", (915, 345, 944, 371)),
           ("icon_spin.png", (914, 391, 935, 412)), ("icon_wool.png", (1396, 302, 1419, 324)), ("icon_rinse.png", (1471, 403, 1495, 414))]
# symbols no Bosch drawing has: the photo's own ink (Allergy Plus, Shirts, Quick, Duvet, the Drain symbol, Cottons, Cottons 60,
# Synthetics, the Daily Mix Load group, the wool skein, Delicates/Silk); a margin round each ink box
PHOTO_SYMBOLS = [(917, 166, 938, 188), (916, 210, 938, 233), (916, 260, 940, 282), (915, 304, 937, 325), (946, 390, 970, 413),
                 (1472, 125, 1493, 146), (1472, 167, 1493, 189), (1471, 212, 1493, 234), (1438, 258, 1495, 287),
                 (1482, 304, 1494, 325), (1470, 354, 1495, 379)]
DIAL = (1204.0, 256.0)                     # photo px of the knob's centre
DISPLAY = (1578, 111, 2262, 421)           # the black glass panel
DRAWER = (148, 113, 838, 428)              # the drawer's face (the builder's drawer part)
BAR = (150, 236, 838, 295)                 # the chrome grip bar on it
SPLIT = 908.5                              # the groove between the drawer's section and the controls


def seven_segments(ink):
    """The drawing's middle '8' (drawing px 2745-2925, 690-982) split into its seven segment shapes, by position."""
    x0, y0, x1, y1 = 2735, 680, 2935, 992
    m = ink[y0:y1, x0:x1]
    n, lab, st, cen = cv2.connectedComponentsWithStats((m > 0.4).astype(np.uint8))
    segs = {}
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 100:
            continue
        cx, cy = cen[i]
        rx, ry = cx / m.shape[1], cy / m.shape[0]
        if w > h:                                       # horizontal bars: a top, g middle, d bottom
            k = "a" if ry < 0.3 else "g" if ry < 0.7 else "d"
        else:
            k = ("f" if ry < 0.5 else "e") if rx < 0.5 else ("b" if ry < 0.5 else "c")
        segs[k] = (lab == i).astype(np.float32) * m
    ys, xs = np.where(m > 0.4)
    return segs, (xs.min(), ys.min(), xs.max(), ys.max())


def digit(canvas, segs, bb, lit, box, colour):
    """Draws the lit segments, scaled so the drawing's full '8' fills the photo's digit box (photo px)."""
    x0, y0, x1, y1 = bb
    on = sum(segs[k] for k in lit)[y0:y1 + 1, x0:x1 + 1]
    bx0, by0, bx1, by1 = [v * S for v in box]
    k = (by1 - by0) / (y1 - y0 + 1)
    m = cv2.resize(on, (max(1, round(on.shape[1] * k)), max(1, round(on.shape[0] * k))), interpolation=cv2.INTER_AREA)
    blend(canvas, m, round(bx0), round(by0), colour)


def photo_ink(ph, box, pad=3):
    """The photo's own light ink inside a box (photo px), as a 0-1 mask at the texture's scale: the box's border median is the
    ground, its brightest pixels the ink; enlarged with cubic interpolation and given a gentle S-curve so the strokes keep a
    clean edge instead of a blur. Returns the mask and its top-left corner in photo px."""
    x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
    a = np.asarray(ph.convert("L").crop((x0, y0, x1, y1))).astype(np.float32)
    border = np.r_[a[0], a[-1], a[:, 0], a[:, -1]]
    bg, top = np.median(border), np.percentile(a, 99.5)
    m = np.clip((a - bg) / max(1.0, top - bg), 0, 1)
    m = cv2.resize(m, (round((x1 - x0) * S), round((y1 - y0) * S)), interpolation=cv2.INTER_CUBIC)
    m = np.clip((m - 0.18) / 0.62, 0, 1)
    m = m * m * (3 - 2 * m)
    return m, (x0, y0)


def symbol(name):
    a = 1 - np.asarray(Image.open(os.path.join(SRC, name)).convert("L")).astype(np.float32) / 255
    ys, xs = np.where(a > 0.35)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def cell_parts(ink, a, b):
    """One button's cell of the display drawing (drawing columns a-b): its symbol (rows 1360-1545), and its label's two
    lines, each glyph sorted to a line by its centre row (the first line's centres lie above row 1665, the second's below;
    "Ready" and "In" overlap in rows, so a blank-row split can't separate them)."""
    sym = crop_ink(ink, (a, 1360, b, 1545))
    m = ink[1545:1800, a:b]
    n, lab, st, cen = cv2.connectedComponentsWithStats((m > 0.35).astype(np.uint8))
    lines = [np.zeros_like(m), np.zeros_like(m)]
    for i in range(1, n):
        if st[i, 4] < 20:
            continue
        top, h = st[i, 1] + 1545, st[i, 3]
        k = 0 if top + h / 2 < 1665 else 1
        if h < 40:                                     # a dot or a hyphen: the line its top sits in
            k = 0 if top < 1662 else 1
        lines[k] += (lab == i) * m
    out = [sym]
    for L in lines:
        ys, xs = np.where(L > 0.35)
        out.append(L[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    return [np.clip(o / o.max(), 0, 1) for o in out]          # "Ready In" is drawn grey in the drawing; lit, it is white


def panel(ph, ink):
    W, H = 2414, STRIP_BOT - STRIP_TOP
    tw, th = round(W * S), round(H * S)
    # the fascia's light and shade, row by row, as the photo has it where nothing is printed
    a = np.asarray(ph).astype(np.float32)
    cols = np.r_[0:140, 850:900, 1510:1570, 2275:2400]
    prof = cv2.GaussianBlur(np.median(a[:, cols], axis=1)[:, None, :], (1, 0), sigmaX=0.1, sigmaY=1.0)[:, 0, :]   # (rows, 3)
    rows = STRIP_TOP + (np.arange(th) + 0.5) / S
    img = np.stack([np.interp(rows, np.arange(len(prof)), prof[:, c]) for c in range(3)], 1)[:, None, :] * np.ones((1, tw, 1), np.float32)
    if not HI:                                                      # the decals' ground stays smooth: it compresses far better
        img += rng.normal(0, 0.8, (th, tw, 1))
    off = STRIP_TOP * S                                             # texture row 0 = photo row 9

    def r(y):
        return y * S - off

    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    # the groove between the drawer's section and the controls
    d.line([(SPLIT * S, 0), (SPLIT * S, th)], fill=(34, 37, 46), width=round(4 * S))
    d.line([((SPLIT + 3) * S, 0), ((SPLIT + 3) * S, th)], fill=(98, 103, 118), width=round(1 * S))
    # the drawer's bay: what shows when the drawer is pulled out (the drawer covers it when shut)
    x0, y0, x1, y1 = DRAWER
    d.rounded_rectangle([x0 * S, r(y0), x1 * S, r(y1)], radius=6 * S, fill=(20, 22, 28), outline=(60, 64, 78), width=round(2 * S))
    # the dial's recess: a darker ring round the knob, with its fine edge
    cx, cy = DIAL
    R = 37.0 * PPM
    d.ellipse([(cx - R) * S, r(cy - R), (cx + R) * S, r(cy + R)], fill=(52, 55, 66))
    d.ellipse([(cx - R) * S, r(cy - R), (cx + R) * S, r(cy + R)], outline=(70, 74, 88), width=round(1.2 * S))
    # leader lines
    for xa, xb, y in LEADERS:
        d.line([(xa * S, r(y)), (xb * S, r(y))], fill=INK, width=max(2, round(1.6 * S)))
    # the childproof lock's lines under the buttons: "-- key 3 sec. --"
    for xa, xb, y in ((2007, 2048, 451.5), (2126, 2170, 452.0)):
        d.line([(xa * S, r(y)), (xb * S, r(y))], fill=INK, width=max(2, round(1.2 * S)))
    # the divider in "Serie | 6"
    d.line([(2215.0 * S, r(64)), (2215.0 * S, r(99))], fill=INK, width=max(2, round(1.4 * S)))
    canvas = np.asarray(im).astype(np.float32)

    def put(fn, *a, **k):
        tmp = np.zeros((round(STRIP_BOT * S) + 4, tw, 3), np.float32)
        tmp[round(off):round(off) + th] = canvas
        fn(tmp, *a, **k)
        canvas[:] = tmp[round(off):round(off) + th]

    for s, box in LEFT + RIGHT:
        put(word, s, box)
    put(word, "Off", (1191, 77, 1218, 91))
    put(word, "Serie", (2114, 71, 2199, 92), INK, 7, 5.0)        # "Serie" is the light face, letter-spaced
    put(word, "6", (2230, 71, 2245, 92), INK, 0)
    put(word, "/", (936, 391, 944, 412))                             # between the Spin and Drain symbols
    put(word, "9 kg", (1624, 481, 1672, 504))
    put(word, "1400 rpm", (1806, 482, 1916, 505))
    put(word, "Iron Steam Assist", (2053, 483, 2255, 501))
    put(word, "3 sec.", (2084, 447, 2119, 456))
    put(place, symbol("icon_childlock.png"), (2054, 444, 2077, 456), INK, "fit")
    for name, box in SYMBOLS:
        put(place, symbol(name), box, INK, "fit")
    for box in PHOTO_SYMBOLS:
        m, (X, Y) = photo_ink(ph, box)
        put(lambda c, mm, x, y: blend(c, mm, round(x * S), round(y * S), INK), m, X, Y)

    # ── the display: black glass, a soft reflection along its top, the lit words and symbols ──
    d2 = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
    dd = ImageDraw.Draw(d2)
    x0, y0, x1, y1 = DISPLAY
    dd.rounded_rectangle([x0 * S, r(y0), x1 * S, r(y1)], radius=5 * S, fill=(14, 15, 17), outline=(96, 100, 112), width=round(1.5 * S))
    canvas = np.asarray(d2).astype(np.float32)
    gx0, gy0, gx1, gy1 = round(x0 * S) + 4, round(r(y0)) + 4, round(x1 * S) - 4, round(r(y0 + 70))
    grad = np.linspace(0.16, 0.0, gy1 - gy0)[:, None, None] ** 1.3
    canvas[gy0:gy1, gx0:gx1] = canvas[gy0:gy1, gx0:gx1] * (1 - grad) + 120 * grad
    d3 = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
    d4 = ImageDraw.Draw(d3)
    # the buttons' strip is a shade lighter than the glass above it, under a fine dark line (photo rows 335-337)
    d4.rectangle([x0 * S + 6, r(338), x1 * S - 6, r(y1) - 6], fill=(18, 19, 21))
    d4.line([(x0 * S + 6, r(336)), (x1 * S - 6, r(336))], fill=(4, 4, 5), width=round(0.6 * S))
    canvas = np.asarray(d3).astype(np.float32)

    # cells of the button row: separators in the photo and in the drawing (its frame at the two ends)
    ph_sep = [1578, 1663.5, 1749.5, 1835.5, 1921.5, 2007.5, 2093.5, 2179.5, 2262]
    dr_sep = [0, 474.5, 988.5, 1505, 2019.5, 2534.5, 3048.5, 3564.5, 4083]
    for xs_ in ph_sep[1:-1]:
        put(lambda c, x: blend(c, np.ones((round((414 - 349) * S), max(2, round(0.9 * S))), np.float32) * 0.85, round(x * S - 0.45 * S), round(349 * S), DIM), xs_)
    icons_ph = [(1607, 354, 1630, 375), (1702, 354, 1710, 376), (1781, 355, 1802, 375), (1867, 358, 1890, 373),
                (1953, 350, 1977, 374), (2041, 357, 2063, 374), (2124, 355, 2147, 377), (2204, 357, 2240, 375)]
    line1 = [(1606, 384, 1634, 395), (1685, 384, 1724, 398), (1777, 384, 1809, 398), (1865, 384, 1893, 395),
             (1951, 385, 1979, 396), (2037, 385, 2066, 396), (2115, 384, 2160, 399), (2200, 384, 2246, 399)]
    line2 = [(1602, 400, 1638, 412), (1699, 400, 1715, 412), (1770, 400, 1816, 414), (1843, 400, 1916, 412),
             (1942, 401, 1989, 415), (2024, 401, 2080, 413), (2132, 403, 2144, 414), (2197, 401, 2250, 413)]
    for i in range(8):
        a = dr_sep[i] + (40 if i == 0 else 22)
        b = dr_sep[i + 1] - (40 if i == 7 else 22)
        parts = cell_parts(ink, round(a), round(b))
        assert len(parts) == 3, (i, len(parts))
        put(place, parts[0], icons_ph[i], WHITE, "fit")
        put(place, parts[1], line1[i], WHITE, "fit")
        put(place, parts[2], line2[i], WHITE, "fit")
    # what Bosch's photo shows lit
    put(place, crop_ink(ink, (1100, 85, 1415, 220)), (1763, 150, 1810, 166), WHITE, "w")        # 1400
    put(place, crop_ink(ink, (670, 280, 910, 415)), (1688, 183, 1722, 198), WHITE, "w")          # 60°
    put(place, crop_ink(ink, (2245, 292, 2427, 458)), (1946, 186, 1970, 206), WHITE, "fit")      # the tub with bubbles
    put(place, crop_ink(ink, (3695, 519, 3925, 578)), (2200, 224, 2233, 226), WHITE, "w")        # the bar over Start/Pause
    put(place, crop_ink(ink, (3730, 675, 3912, 815)), (2209, 244, 2232, 259), WHITE, "fit")      # play/pause symbol
    put(place, crop_ink(ink, (3670, 831, 3974, 948)), (2200, 269, 2242, 283), WHITE, "fit")      # Start/
    put(place, crop_ink(ink, (3672, 950, 3977, 1054)), (2200, 286, 2243, 297), WHITE, "fit")     # Pause
    put(place, crop_ink(ink, (3540, 643, 3589, 1108)), (2176, 239, 2179, 306), DIM, "h")         # the divider
    m, (X, Y) = photo_ink(ph, (1606, 277, 1627, 300))                                             # the stain symbol (photo)
    put(lambda c, mm, x, y: blend(c, mm, round(x * S), round(y * S), WHITE), m, X, Y)
    segs, bb = seven_segments(ink)
    put(digit, segs, bb, "bc", (1990, 251, 2017, 296), WHITE)          # 1: the photo's lit segments are the right-hand pair
    put(digit, segs, bb, "abged", (2037, 251, 2064, 296), WHITE)       # 2
    put(digit, segs, bb, "afgcd", (2076, 251, 2103, 296), WHITE)       # 5
    for cy_ in (266.5, 280.5):                                          # the colon
        put(lambda c, y: blend(c, np.ones((round(5 * S), round(5 * S)), np.float32), round(2024 * S), round((y - 2.5) * S), WHITE), cy_)
    return Image.fromarray(canvas.clip(0, 255).astype(np.uint8))


def drawer(ph):
    """The drawer's face: the photo's own (the moulded grip under the bar keeps its light and shade), at twice the photo's
    pixels; the chrome bar is the builder's own 3D bar, so its band here is the face's plain colour."""
    x0, y0, x1, y1 = DRAWER
    k = 2
    c = ph.crop((x0, y0, x1, y1)).resize(((x1 - x0) * k, (y1 - y0) * k), Image.LANCZOS)
    a = np.asarray(c).astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), 1.2)                       # the photo's speckle is the grain map's job
    bx0, by0, bx1, by1 = BAR
    ya, yb = (by0 - y0 - 2) * k, (by1 - y0 + 2) * k
    a[ya:yb] = a[ya - 6:ya - 2].mean(0)[None]                  # the face's own colour where the bar stands over it
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def bar(ph):
    """The chrome grip bar's face: the photo's polished gradient, with Bosch's mark and name set again crisp from logos/bosch.png."""
    x0, y0, x1, y1 = BAR
    k = 3                                                      # 12 px per mm: Bosch's mark and name on it are print
    c = ph.crop((x0, y0, x1, y1)).resize(((x1 - x0) * k, (y1 - y0) * k), Image.LANCZOS)
    a = np.asarray(c).astype(np.float32)
    # erase the soft logo: rebuild each column of the logo's span from the bar's vertical profile either side of it
    lx0, lx1 = (380 - x0) * k, (605 - x0) * k
    left, right = a[:, lx0 - 10:lx0 - 4].mean(1, keepdims=True), a[:, lx1 + 4:lx1 + 10].mean(1, keepdims=True)
    t = np.linspace(0, 1, lx1 - lx0)[None, :, None]
    a[:, lx0:lx1] = left * (1 - t) + right * t
    out = Image.fromarray(a.clip(0, 255).astype(np.uint8)).convert("RGBA")
    lg = Image.open(os.path.join(LOGOS, "bosch.png")).convert("RGBA")
    alpha = lg.getchannel("A")
    ys, xs = np.where(np.asarray(alpha) > 20)
    alpha = alpha.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    # the photo's mark and name span columns 389-594, rows 244-287
    w, h = (594 - 389) * k, (287 - 244) * k
    alpha = alpha.resize((w, round(w * alpha.height / alpha.width)), Image.LANCZOS)
    mark = Image.new("RGBA", alpha.size, (72, 74, 80, 255))
    mark.putalpha(alpha)
    out.alpha_composite(mark, ((389 - x0) * k, round((265.5 - y0) * k - alpha.height / 2)))
    return out.convert("RGB")


def flat(colour, size, grad=(1.0, 1.0)):
    w, h = size
    a = np.ones((h, w, 3), np.float32) * colour * np.linspace(grad[0], grad[1], h)[:, None, None]
    a += rng.normal(0, 0.8, (h, w, 1))
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def side(name, mirror):
    """Bosch's side-wall photo (PGA9), square-on to the right side: the front edge at the left, the concentric Anti
    Vibration rings with one arc over them and two under. This model's own photos (PGA3 the right side, PGA12 the left)
    show the same pattern, two arcs under the rings; the 360-degree frames show one, with the older panel print, so they
    are not used for the sides. Cropped to the side wall (columns 7-1297, rows 3-1914: 2.30 px per mm both ways, the
    top plate's overhang at the back left out). The studio light falls from the top left; a smooth fit of it (a quadratic
    in log luminance) is divided out, the relief's own light and shade kept at half strength, and the studio photo's
    Dark lake given to it, as tex_bosch_wga1420.py does. The left side is its mirror image (PGA12)."""
    im = Image.open(os.path.join(SRC, "22972646_Sidewall_W-WD_L_fullsize_standard_darklake_PGA9_def.webp")).convert("RGB")
    crop = im.crop((7, 3, 1297, 1914)).resize((600, 870), Image.LANCZOS)
    if mirror:
        crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    lum = np.asarray(crop.convert("L")).astype(np.float32)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    c, *_ = np.linalg.lstsq(A, np.log(np.maximum(lum, 1)).reshape(-1), rcond=None)
    n = lum / np.exp(A @ c).reshape(h, w)
    n = 1 + (n / np.median(n) - 1) * 0.5
    tint = np.clip(np.clip(n, 0.2, 2.0)[..., None] ** 1.15 * (BODY * 0.92), 0, 255)
    save(Image.fromarray(tint.astype(np.uint8)), name, 88)


# ── the back: Bosch's 360 frame square-on to it. The cabinet spans columns 545-1383 (598 mm) and the floor is row 1283:
# 1.40 px per mm. Centre lines are photo pixels read off 3x and 4x enlargements with a 10 px grid (the drain hose's edges
# then moved onto the hoses as a segmentation of the photo finds them: the ribbed hose by its corrugation, the smooth
# one by its tone), seen from behind (photo right = the machine's left). Hose, cord and plug sizes are measured on
# the photo (ESTIMATED); Bosch publishes their lengths only (inlet hose 120 cm and drain hose 150 cm in manual 9001946103,
# cord 160 cm on the product page). ──
RPPM, RCX, RYB = 1.401, 964.0, 1283.0
# the ribbed drain hose: from its bracket at the top left, down the left, round the bottom, up the right into the upper holder
DRAIN = [(621, 196), (627, 252), (636, 299), (643, 355), (647, 410), (649, 458), (650, 514), (651, 570), (651, 618), (650, 674), (648, 722), (648, 778), (651, 834), (653, 882), (661, 937), (680, 989), (707, 1029), (749, 1068), (797, 1099), (841, 1119), (897, 1132), (953, 1140), (1002, 1142), (1058, 1135), (1113, 1117), (1156, 1093), (1200, 1055), (1236, 1010), (1257, 966), (1275, 912), (1284, 864), (1288, 808), (1290, 752), (1292, 704), (1293, 648), (1292, 592), (1292, 544), (1292, 482)]
CUFF = ((1293, 482), (1293, 402))         # the drain hose's smooth end piece, standing up out of the upper right holder
BRACKET = [(583, 156), (672, 156), (668, 200), (655, 260), (600, 260), (587, 200)]   # the moulded guide the hose hangs from
# the smooth inlet hose: from the valve at the top right, down the right (over the drain hose), along the bottom of a loop,
# up the left (behind the drain hose low down, over it at the top) to the tap nut
INLET = [(1263, 246), (1275, 284), (1291, 320), (1305, 358), (1316, 396), (1326, 434), (1333, 473), (1338, 512), (1339, 552), (1339, 592), (1338, 631), (1335, 671), (1320, 707), (1296, 739), (1266, 764), (1232, 785), (1196, 800), (1158, 811), (1119, 817), (1079, 819), (1040, 819), (1000, 816), (962, 807), (925, 792), (892, 771), (855, 756), (818, 743), (782, 726), (746, 708), (712, 688), (682, 663), (655, 634), (630, 603), (611, 569), (600, 531), (600, 491), (608, 452), (629, 420), (663, 402), (702, 399), (744, 410)]
NUT = ((763, 425), 44)                    # the tap nut at the hose's free end: centre and width across (px); it faces out
CORDS = {                                 # the power cord's runs as they show; the ends of each run are hidden behind a hose
    "CordLow": [(659, 1192), (651, 1173), (642, 1139), (626, 1093), (612, 1047), (600, 1001), (597, 969), (594, 941), (600, 910),
                (611, 890), (623, 876), (644, 859), (672, 856), (740, 857), (814, 868), (888, 883), (958, 900), (997, 909),
                (1100, 929), (1168, 936), (1228, 932), (1268, 925)],
    "CordBack": [(1272, 867), (1259, 865), (1220, 856), (1166, 843), (1100, 826), (1052, 806), (999, 788), (917, 754),
                 (838, 717), (792, 703), (759, 679), (732, 656), (700, 625), (670, 588), (652, 562), (642, 544)],
    "CordDrop": [(706, 628), (704, 660), (700, 700), (696, 732)],
}
PLUG = {"relief": (691.5, 735, 770, 21), "body": (664, 770, 709, 810), "pins": [(678.5, 810, 850), (686.5, 810, 850), (694.5, 810, 850)], "pin_d": 5}
HOLDERS = [(650, 476), (1283, 468), (650, 880), (1279, 868)]          # the hose holders on the 4 transit bolts (70 x 30 px)
VALVE = (1263, 246)                                                    # the inlet valve's connector
GROMMET = (655, 1193)                                                  # where the cord leaves the cabinet
WIDTH = {"drain": 37, "inlet": 16, "cord": 6, "cuff": 36}            # photo px across


def to_m(p):
    return [round(-(p[0] - RCX) / RPPM / 1000, 4), round((RYB - p[1]) / RPPM / 1000, 4)]


def rear_and_paths():
    im = Image.open(os.path.join(SRC, "360_15.jpg")).convert("RGB")
    rgb = np.asarray(im)
    mask = np.zeros(rgb.shape[:2], np.uint8)
    poly = lambda pts, w: cv2.polylines(mask, [np.array(pts, np.int32)], False, 255, int(round(w)), cv2.LINE_AA)
    poly(DRAIN, WIDTH["drain"] + 16)
    poly(list(CUFF), WIDTH["cuff"] + 12)
    poly(INLET, WIDTH["inlet"] + 14)
    cv2.circle(mask, NUT[0], 30, 255, -1)
    for pts in CORDS.values():
        poly(pts, WIDTH["cord"] + 10)
    x0, y0, x1, y1 = PLUG["body"]
    cv2.rectangle(mask, (x0 - 6, PLUG["relief"][1] - 6), (x1 + 6, PLUG["pins"][0][2] + 6), 255, -1)
    for hx, hy in HOLDERS:
        cv2.rectangle(mask, (hx - 40, hy - 20), (hx + 40, hy + 20), 255, -1)
    cv2.fillPoly(mask, [np.array(BRACKET, np.int32)], 255)
    cv2.polylines(mask, [np.array(BRACKET, np.int32)], True, 255, 10)
    mask = (mask >= 100).astype(np.uint8) * 255
    # paint the steel back in under them. The pressed panel is left-right symmetric about column 965 (the edges of its
    # pressings match their mirror image best there), so a pixel under a hose takes its mirror twin where that one is clear,
    # except where the panel isn't symmetric (the valve bay at the top, the grommet and keyhole strip at the bottom, the
    # notch at the right); the rest is Telea inpainting (as tex_lg_rear.py does), which carries the pressing lines in from
    # the edges. The seams are feathered over 2 px.
    AXIS2 = 1930
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w]
    mx_ = np.clip(AXIS2 - xx, 0, w - 1)
    asym = (yy < 245) | (yy > 1160) | ((xx > 1175) & (xx < 1275) & (yy > 635) & (yy < 775))
    asym_src = asym[yy, mx_]
    use = (mask > 0) & (mask[yy, mx_] == 0) & ~asym & ~asym_src
    mirrored = rgb.copy()
    mirrored[use] = rgb[yy[use], mx_[use]]
    rest = ((mask > 0) & ~use).astype(np.uint8) * 255
    filled = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(mirrored, cv2.COLOR_RGB2BGR), rest, 7, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    a = cv2.GaussianBlur((mask > 0).astype(np.float32), (0, 0), 1.0)[..., None]
    clean = Image.fromarray((rgb * (1 - a) + filled * a).clip(0, 255).astype(np.uint8))
    # the builder's back panel: x +-287 mm (between the side flanges), from the feet (15 mm) to the top plate (834 mm)
    box = (RCX - 287 * RPPM, RYB - 834 * RPPM, RCX + 287 * RPPM, RYB - 15 * RPPM)
    rear = clean.crop(tuple(round(v) for v in box)).resize((640, 913), Image.LANCZOS)
    save(rear, "rear.jpg", 86)
    if os.environ.get("REAR_DEBUG"):   # the traced outlines over the photo, and the painted-out back, side by side
        dbg = im.copy()
        dd = ImageDraw.Draw(dbg)

        def outline(pts, w, col):
            P = np.array(pts, np.float32)
            for i in range(len(P) - 1):
                d = P[i + 1] - P[i]
                n = np.array([-d[1], d[0]]) / max(1e-6, np.hypot(*d)) * w / 2
                for sgn in (1, -1):
                    dd.line([tuple(P[i] + sgn * n), tuple(P[i + 1] + sgn * n)], fill=col, width=1)
        outline(DRAIN, WIDTH["drain"], (255, 0, 0))
        outline(list(CUFF), WIDTH["cuff"], (255, 0, 0))
        outline(INLET, WIDTH["inlet"], (0, 120, 255))
        for pts in CORDS.values():
            outline(pts, WIDTH["cord"], (0, 190, 0))
        dd.rectangle(PLUG["body"], outline=(255, 0, 255))
        for hx, hy in HOLDERS:
            dd.rectangle((hx - 35, hy - 15, hx + 35, hy + 15), outline=(255, 140, 0))
        dd.polygon(BRACKET, outline=(255, 140, 0))
        both = Image.new("RGB", (dbg.width * 2, dbg.height))
        both.paste(dbg, (0, 0))
        both.paste(clean, (dbg.width, 0))
        both.crop((540, 60, 1400, 1300)).save(os.environ["REAR_DEBUG"] + "_a.jpg", quality=88)
        both.crop((dbg.width + 540, 60, dbg.width + 1400, 1300)).save(os.environ["REAR_DEBUG"] + "_b.jpg", quality=88)
    # the drain hose's corrugation, one rib: the builder repeats it every 2.8 mm along the hose (the photo's rib spacing)
    rib = np.ones((16, 64, 3), np.float32) * np.array([152, 153, 155], np.float32)
    rib *= (0.68 + 0.32 * (0.5 + 0.5 * np.cos(np.linspace(0, 2 * np.pi, 64, endpoint=False))) ** 1.4)[None, :, None]
    Image.fromarray(rib.clip(0, 255).astype(np.uint8)).save(os.path.join(D, "hose.jpg"), quality=92)
    px = lambda v: round(v / RPPM / 1000, 4)
    paths = {
        "ppm": RPPM, "drain_d": px(WIDTH["drain"]), "inlet_d": px(WIDTH["inlet"]), "cord_d": px(WIDTH["cord"]), "cuff_d": px(WIDTH["cuff"]),
        "rib": 0.0028,
        "drain": [to_m(p) for p in DRAIN], "cuff": [to_m(p) for p in CUFF], "bracket": [to_m(p) for p in BRACKET],
        "inlet": [to_m(p) for p in INLET], "nut": [*to_m(NUT[0]), px(NUT[1])],
        "cords": {k: [to_m(p) for p in v] for k, v in CORDS.items()},
        "plug": {"relief": [*to_m(PLUG["relief"][:2]), px(PLUG["relief"][2] - PLUG["relief"][1]), px(PLUG["relief"][3])],
                 "body": [to_m(PLUG["body"][:2]), to_m(PLUG["body"][2:])],
                 "pins": [[*to_m((x, y0)), px(y1 - y0)] for x, y0, y1 in PLUG["pins"]], "pin_d": px(PLUG["pin_d"])},
        "holders": [to_m(p) for p in HOLDERS], "holder_size": [px(70), px(30)],
        "valve": to_m(VALVE), "grommet": to_m(GROMMET),
    }
    json.dump(paths, open(os.path.join(D, "rear_paths.json"), "w"), indent=1)


def drum():
    """The Vario Drum's wall as Bosch's close photo shows it: rows of raised droplets, each with a small hole, two sizes."""
    w, h = 1024, 512
    base = np.ones((h, w, 3), np.float32) * np.array([176, 180, 186], np.float32) + rng.normal(0, 2.0, (h, w, 1))
    img = Image.fromarray(base.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for row, y in enumerate(range(10, h, 21)):
        for i, x in enumerate(range(8 + (row % 2) * 13, w, 26)):
            big = (i + row) % 3 == 0
            rr = 6.5 if big else 4.2
            d.ellipse((x - rr, y - rr * 1.35, x + rr, y + rr * 0.8), fill=(204, 207, 212))           # the droplet's lit side
            d.ellipse((x - rr * 0.8, y - rr * 0.9, x + rr * 0.9, y + rr * 1.0), fill=(150, 154, 160))
            hr = 2.2 if big else 1.6
            d.ellipse((x - hr, y - hr + 1, x + hr, y + hr + 1), fill=(46, 48, 52))                    # the hole
    save(img, "drum.jpg", 86)


def tray():
    """The drawer's tray seen from above: compartments II (main wash), the fabric softener and I (prewash), left to right, as
    the manual's drawing numbers them (1, 2, 3), with the softener's siphon insert."""
    t = Image.new("RGB", (512, 256), (226, 229, 233))
    d = ImageDraw.Draw(t)
    d.rectangle((6, 6, 506, 250), outline=(184, 188, 196), width=6)
    d.line([(236, 8), (236, 248)], fill=(186, 190, 198), width=6)
    d.line([(330, 8), (330, 248)], fill=(186, 190, 198), width=6)
    d.rounded_rectangle((252, 30, 314, 90), 8, fill=(120, 160, 205))                                 # the softener's blue siphon cap
    f = ImageFont.truetype(FONT, 54, index=0)
    d.text((118, 150), "II", font=f, fill=(150, 154, 164), anchor="mm")
    d.text((420, 150), "I", font=f, fill=(150, 154, 164), anchor="mm")
    fl = 1 - np.asarray(Image.open(os.path.join(SRC, "icon_softener.png")).convert("L")).astype(np.float32) / 255
    ys, xs = np.where(fl > 0.35)
    fl = cv2.resize(fl[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (52, 52), interpolation=cv2.INTER_AREA)
    a = np.asarray(t).astype(np.float32)
    blend(a, fl, 257, 140, (150, 154, 164))
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "tray.jpg", 88)


# the decals, in photo px: A the programme names, leader lines, "Off" and the symbols, from right of the drawer's groove to the
# display's left edge (the dial's knob stands over its middle; the builder cuts the knob's foot out of it); B the words over the
# display ("Serie | 6"), from A's edge to the display's right edge, down to the display's top; C the display's own print,
# exactly the glass's face; D the print under the display ("-- key 3 sec. --", "9 kg", "1400 rpm", "Iron Steam Assist")
DECALS = {"printA": (914, 50, DISPLAY[0], 420), "printB": (DISPLAY[0], 50, 2272, DISPLAY[1]), "printC": DISPLAY,
          "printD": (DISPLAY[0], DISPLAY[3] + 4, 2272, 512)}


def print_decals(ph, ink):
    strip = panel(ph, ink)
    rects = {}
    for k, (x0, y0, x1, y1) in DECALS.items():
        name = f"print_{k[-1].lower()}.jpg"
        save(strip.crop((round(x0 * S), round((y0 - STRIP_TOP) * S), round(x1 * S), round((y1 - STRIP_TOP) * S))), name, 88)
        rects[k] = {"file": name, "rect": [x0 / 2414, (y0 - STRIP_TOP) / (STRIP_BOT - STRIP_TOP), x1 / 2414, (y1 - STRIP_TOP) / (STRIP_BOT - STRIP_TOP)],
                    "on": "display" if k == "printC" else "strip"}
    json.dump(rects, open(os.path.join(D, "decals.json"), "w"), indent=1)


def main():
    ph = photo()
    ink = drawing()
    if HI:
        print_decals(ph, ink)
        return
    save(panel(ph, ink), "panel.jpg", 90)
    save(drawer(ph), "drawer.jpg", 90)
    save(bar(ph), "bar.jpg", 90)
    save(flat(BODY, (512, 768), (1.08, 0.80)), "front.jpg", 85)
    side("side_l.jpg", True)                                       # the left side: the back at the left, the front at the right
    side("side_r.jpg", False)                                      # the right side: the front at the left
    rear_and_paths()
    drum()
    tray()
    lay = {
        "feet": FEET, "strip_y": my(STRIP_BOT), "split_x": mx(SPLIT),
        "drawer": {"x0": mx(DRAWER[0]), "x1": mx(DRAWER[2]), "y0": my(DRAWER[3]), "y1": my(DRAWER[1])},
        "bar": {"x0": mx(BAR[0]), "x1": mx(BAR[2]), "y0": my(BAR[3]), "y1": my(BAR[1])},
        "display": {"x0": mx(DISPLAY[0]), "x1": mx(DISPLAY[2]), "y0": my(DISPLAY[3]), "y1": my(DISPLAY[1])},
        "dial": {"x": mx(DIAL[0]), "y": my(DIAL[1])},
        "door": {"x": mx(1207.1), "y": my(1566.7), "rim": round(993.5 / PPM / 1000, 4), "ring": round(955.0 / PPM / 1000, 4), "glass": 0.163},
        "flap": {"x": 0.1938, "y": 0.103, "r": 0.0772},
        "lock_slot": {"x": 0.2034, "y": 0.475},          # 360 frame 33, door open: 1.418 px per mm, the slot's centre
    }
    json.dump(lay, open(os.path.join(D, "layout.json"), "w"), indent=1)
    print(json.dumps(lay))


main()
