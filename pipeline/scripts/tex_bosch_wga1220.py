"""Textures for the Bosch WGA1220SIN, Series 4 front-load washing machine, 7 kg, 1200 rpm, Silver, and its Dark lake twin
WGA12208IN (the same machine in Bosch's other colour; written with the suffix _dl).

usage: python3 tex_bosch_wga1220.py <photos dir> <logos dir> <out dir>
  photos: bosch_wga1220/21832651_WGA1220SIN_STP_def.webp   Bosch's straight-on studio photo of WGA1220SIN (Silver), 2416 x 3366
          bosch_wga1220/22530739_WGA12208IN_STP_def.webp   the same for WGA12208IN (Dark lake)
          bosch_wga1220/22972645_..._silver_PGA9_def.webp, 22972646_..._darklake_PGA9_def.webp   Bosch's side-wall photos
          bosch_wga1220/360_16.jpg                         Bosch's 360-degree frame of WGA1220SIN square-on to the back
          bosch_wga1220/display_WGA1220SIN.png             the display drawing titled "WGA1220SIN" in Bosch's interactive manual
                                                           9001973120 (graphic 18014429530563851), rendered from its SVG at
                                                           12 px per unit
          bosch_wga1220/icon_wool.png, icon_softener.png   the manual's own symbols (SY_Wool_11, SY_Softener_iDOS_3)
  logos:  bosch.png
  writes <out dir>/bosch_wga1220/*.jpg, layout.json (every position the builder needs, in metres) and rear_paths.json

Scale. Both studio photos are drawn straight on with square pixels: the cabinet's 598 mm spans columns 1 to 2414 (4.037 px per
mm), its top edge is row 1.5. The photo's last row (3365) is 14.8 mm above the floor: the feet (15 mm, ESTIMATED from the 360
frames) are under it.

Text. Every word on the fascia is set again in Avenir Next (Medium; "Steam" and "4" Bold), each fitted to the ink box it has in
the photo. The display's words, numbers and icons are the ink of Bosch's own vector drawing of this model's display, each scaled
into the box it has in the photo; the time is the drawing's seven-segment shapes with the photo's lit segments (1:25). The dial
in the photo is left out (the model has a 3D knob). The Dark lake photo prints the same words a few pixels away (up to 11 px,
2.7 mm, for "Steam Cycle" and "Serie 4"); each colour's print is placed where its own photo has it.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# --hi: draw only the fascia's print again at 12 px per mm on the model, for each colour, and cut it into the decals the builder
# lays over the strip (print_a: the programme names and the dial's words; print_b: the words over the display) and on the
# display's glass (print_c), with decals.json (their places in panel.jpg's UVs); panel.jpg and the other textures are left alone
HI = "--hi" in sys.argv
PHOTOS, LOGOS, OUT = [a for a in sys.argv[1:] if a != "--hi"][:3]
SRC = os.path.join(PHOTOS, "bosch_wga1220")
D = os.path.join(OUT, "bosch_wga1220")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(1220)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FONT_C = "/System/Library/Fonts/Avenir Next Condensed.ttc"

# ── the photos' scale ──
PPM = 2413 / 598.0                      # px per mm, both ways (columns 1-2414)
ROW0 = 1.5                              # the cabinet's top edge (848 mm)
CX0 = 1207.5                            # the cabinet's centre line
W_MM, H_MM, D_MM = 598.0, 848.0, 590.0  # Bosch's size (product page, product sheet, manual 9001795571)
FEET = 0.015                            # ESTIMATED from the 360 frames (13-16 mm) and the photo's bottom row (14.8 mm)


def mx(col):                            # photo column -> metres from the centre line
    return round((col - CX0) / PPM / 1000, 5)


def my(row):                            # photo row -> metres above the floor
    return round((H_MM - (row - ROW0) / PPM) / 1000, 5)


# The two colours. Both studio photos are neutral grey. Bosch names WGA12208IN's colour "Blue" / "Dark lake" and its side-wall
# photo for that colour (PGA9, on the WGA12208IN page) is blue-grey (31, 37, 43): the Dark lake textures take their lightness
# from the studio photo and that photo's hue (R 0.865, G 1.022, B 1.174 of its luminance).
COLOURS = {
    "silver": {"stp": "21832651_WGA1220SIN_STP_def.webp", "side": "22972645_Sidewall_W-WD_L_fullsize_standard_silver_PGA9_def.webp",
               "suf": "", "tint": (1.0, 1.0, 1.0), "ink": (34, 35, 37), "grad": (1.05, 0.93),
               "off": {"top": (0, 0), "off": (0, 0), "left": (0, 0), "right": (0, 0)}},
    "dark": {"stp": "22530739_WGA12208IN_STP_def.webp", "side": "22972646_Sidewall_W-WD_L_fullsize_standard_darklake_PGA9_def.webp",
             "suf": "_dl", "tint": (0.865, 1.022, 1.174), "ink": (186, 187, 189), "grad": (1.14, 0.78),
             # where the Dark lake photo's print sits against the Silver photo's (measured on both: ink boxes of Off, Quick,
             # Cottons, Steam Cycle, Serie 4)
             "off": {"top": (11, -1), "off": (3, -1), "left": (3, -1), "right": (2, -2)}},
}
STRIP_TOP, STRIP_BOT = ROW0, 534.5                  # the fascia: from the top edge to the groove under it (rows 531-537)
S = 12 * 598.0 / 2413 if HI else 4096 / 2414         # panel texture px per photo px (6.85 px per mm; --hi 12)
WHITE, DIM = (246, 246, 246), (200, 201, 204)       # the display's lit print, and its divider lines
SHADE = {"panel": 0.80, "print_a": 0.80, "print_b": 0.80, "print_c": 0.80, "drawer": 0.84, "front": 0.8, "side_l": 0.86, "side_r": 0.86, "rear.jpg": 0.92}


def save(img, name, q=88):
    base = name.split(".")[0].replace("_dl", "")
    k = SHADE.get(name, SHADE.get(base))
    if k:              # lit by the viewer's environment light, a texture renders about a quarter brighter than its pixels
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * k).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def font(px, face=7, fam=FONT):                     # 7 Regular, 5 Medium, 0 Bold (both .ttc files)
    return ImageFont.truetype(fam, max(4, round(px)), index=face)


def photo(c):
    im = Image.open(os.path.join(SRC, c["stp"])).convert("RGBA")
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    body = np.median(a[2200:2800, 200:600].reshape(-1, 3), 0)
    bg = Image.new("RGBA", im.size, tuple(int(v) for v in body) + (255,))
    bg.alpha_composite(im)
    return bg.convert("RGB")


def tinted(a, c):
    return a * np.array(c["tint"], np.float32)


def body_colour(c):
    a = np.asarray(photo(c)).astype(np.float32)
    return tinted(np.median(a[2200:2800, 200:600].reshape(-1, 3), 0), c)


# ── drawing ink: the manual's vector drawing of this model's display ──
def drawing():
    a = np.asarray(Image.open(os.path.join(SRC, "display_WGA1220SIN.png")).convert("L")).astype(np.float32)
    return 1 - a / 255.0


def crop_ink(ink, box):
    x0, y0, x1, y1 = [int(round(v)) for v in box]
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
    blend(canvas, m, round(cx - nw / 2), round(cy - nh / 2), colour)


def blend(canvas, m, X, Y, colour):
    h, w = m.shape
    xa, ya, xb, yb = max(0, X), max(0, Y), min(canvas.shape[1], X + w), min(canvas.shape[0], Y + h)
    if xb <= xa or yb <= ya:
        return
    a = np.clip(m[ya - Y:yb - Y, xa - X:xb - X], 0, 1)[..., None]
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + np.array(colour, np.float32) * a


def text_mask(s, px, face=7, spacing=0.0, fam=FONT):
    f = font(px, face, fam)
    w = int(sum(f.getlength(ch) for ch in s) + spacing * len(s) + px * 2)
    h = int(px * 2.2)
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    if spacing:
        x = px * 0.5
        for ch in s:
            d.text((x, px * 0.4), ch, font=f, fill=255)
            x += f.getlength(ch) + spacing
    else:
        d.text((px * 0.5, px * 0.4), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.3)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def word(canvas, s, box, colour, face=5, spacing=0.0):
    """A word fitted to the photo's ink box by its width, in Avenir Next (Medium unless given): side by side with the photo at
    4x it matches the print's weight and letter height better than Avenir Next Condensed, which came out too narrow."""
    bw, bh = (box[2] - box[0]) * S, (box[3] - box[1]) * S
    best = None
    for fam in (FONT,):
        m = text_mask(s, 60, face, spacing * 60 / max(1, bh) if spacing else 0, fam)
        err = abs(math.log((m.shape[1] / m.shape[0]) / (bw / bh)))
        if best is None or err < best[0]:
            best = (err, fam, m)
    _, fam, m = best
    k = bw / m.shape[1]
    m = text_mask(s, 60 * k, face, spacing * S, fam)
    place(canvas, m, box, colour, keep="w")


# ── the fascia, as the Silver photo has it (photo px). Ink boxes measured on the photo (connected ink, 3x9 px grouping) ──
LEFT = [("Quick 15/30 min", (917, 116, 1047, 133)), ("Steam/Anti Bacteria", (917, 158, 1074, 174)),
        ("Jeans/Dark Wash", (916, 205, 1052, 221)), ("Sportswear", (917, 253, 1011, 269)), ("Shirts", (917, 300, 964, 315)),
        ("Rinse", (917, 347, 960, 362)), ("Spin/Drain", (916, 388, 1003, 406))]
RIGHT = [("Cottons", (1430, 118, 1494, 131)), ("Cottons 60° Label", (1350, 158, 1493, 173)), ("Synthetics", (1411, 206, 1494, 223)),
         ("Mix Load", (1422, 253, 1494, 267)), ("Delicates/Silk", (1386, 301, 1495, 318)), ("Wool", (1455, 348, 1495, 362)),
         ("Drum Descale", (1383, 390, 1496, 404))]
LEADERS_L = [(1055, 1126, 124.5), (1017, 1045, 260.5), (971, 1052, 308.0), (968, 1079, 355.5), (1010, 1125, 397.0)]
LEADERS_R = [(1285, 1423, 125.0), (1332, 1342, 166.0), (1357, 1403, 214.0), (1364, 1415, 261.0), (1357, 1379, 308.5),
             (1331, 1415, 356.0), (1293, 1376, 398.0)]
WOOL_ICON = (1423, 344, 1447, 369)
DIAL = (1206.0, 252.0)                     # the knob's centre (its chrome ring spans columns 1064-1348)
DISPLAY = (1579, 105, 2266, 416)           # the black glass panel
DRAWER = (148, 102, 838, 414)              # the drawer's face (the builder's drawer part)
BAR = (150, 226, 838, 284)                 # the chrome grip bar on it
SPLIT = 908.5                              # the groove between the drawer's section and the controls


def seven_segments(ink):
    """The drawing's middle '8' (drawing px 2757-2913, 702-970) split into its seven segment shapes, by position."""
    x0, y0, x1, y1 = 2745, 690, 2925, 982
    m = ink[y0:y1, x0:x1]
    n, lab, st, cen = cv2.connectedComponentsWithStats((m > 0.4).astype(np.uint8))
    segs = {}
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 100:
            continue
        cx, cy = cen[i]
        rx, ry = cx / m.shape[1], cy / m.shape[0]
        if w > h:
            k = "a" if ry < 0.3 else "g" if ry < 0.7 else "d"
        else:
            k = ("f" if ry < 0.5 else "e") if rx < 0.5 else ("b" if ry < 0.5 else "c")
        segs[k] = (lab == i).astype(np.float32) * m
    ys, xs = np.where(m > 0.4)
    return segs, (xs.min(), ys.min(), xs.max(), ys.max())


def digit(canvas, segs, bb, lit, box, colour):
    x0, y0, x1, y1 = bb
    on = sum(segs[k] for k in lit)[y0:y1 + 1, x0:x1 + 1]
    bx0, by0, bx1, by1 = [v * S for v in box]
    k = (by1 - by0) / (y1 - y0 + 1)
    m = cv2.resize(on, (max(1, round(on.shape[1] * k)), max(1, round(on.shape[0] * k))), interpolation=cv2.INTER_AREA)
    blend(canvas, m, round(bx0), round(by0), colour)


def panel(c, ph, ink):
    W, H = 2414, STRIP_BOT - STRIP_TOP
    tw, th = round(W * S), round(H * S)
    INK = c["ink"]
    sh = lambda box, g: (box[0] + c["off"][g][0], box[1] + c["off"][g][1], box[2] + c["off"][g][0], box[3] + c["off"][g][1])
    # the fascia's light and shade, row by row, as the photo has it where nothing is printed
    a = tinted(np.asarray(ph).astype(np.float32), c)
    cols = np.r_[0:140, 850:900, 1510:1570, 2275:2400]
    prof = cv2.GaussianBlur(np.median(a[:, cols], axis=1)[:, None, :], (1, 0), sigmaX=0.1, sigmaY=1.0)[:, 0, :]
    rows = STRIP_TOP + (np.arange(th) + 0.5) / S
    img = np.stack([np.interp(rows, np.arange(len(prof)), prof[:, k]) for k in range(3)], 1)[:, None, :] * np.ones((1, tw, 1), np.float32)
    if not HI:                                                      # the decals' ground stays smooth: it compresses far better
        img += rng.normal(0, 0.8, (th, tw, 1))
    off = STRIP_TOP * S

    def r(y):
        return y * S - off

    base = np.median(prof[150:300], 0)
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    groove = tuple(int(v) for v in base * 0.25)
    d.line([(SPLIT * S, 0), (SPLIT * S, th)], fill=groove, width=round(4 * S))
    d.line([((SPLIT + 3) * S, 0), ((SPLIT + 3) * S, th)], fill=tuple(int(v) for v in np.minimum(base * 1.12, 255)), width=round(1 * S))
    x0, y0, x1, y1 = DRAWER
    d.rounded_rectangle([x0 * S, r(y0), x1 * S, r(y1)], radius=6 * S, fill=tuple(int(v) for v in base * 0.18), outline=tuple(int(v) for v in base * 0.6), width=round(2 * S))
    cx, cy = DIAL
    R = 37.0 * PPM
    d.ellipse([(cx - R) * S, r(cy - R), (cx + R) * S, r(cy + R)], fill=tuple(int(v) for v in base * 0.8))
    for grp, lines in (("left", LEADERS_L), ("right", LEADERS_R)):
        for xa, xb, y in lines:
            dx, dy = c["off"][grp]
            d.line([((xa + dx) * S, r(y + dy)), ((xb + dx) * S, r(y + dy))], fill=INK, width=max(2, round(1.8 * S)))
    canvas = np.asarray(im).astype(np.float32)

    def put(fn, *aa, **k):
        tmp = np.zeros((round(STRIP_BOT * S) + 4, tw, 3), np.float32)
        tmp[round(off):round(off) + th] = canvas
        fn(tmp, *aa, **k)
        canvas[:] = tmp[round(off):round(off) + th]

    for s, box in LEFT:
        put(word, s, sh(box, "left"), INK)
    for s, box in RIGHT:
        put(word, s, sh(box, "right"), INK)
    put(word, "Off", sh((1193, 64, 1218, 79), "off"), INK)
    put(word, "Steam", sh((1613, 61, 1687, 79), "top"), INK, 0)
    put(word, "Cycle", sh((1697, 60, 1759, 83), "top"), INK, 7)
    put(word, "Serie", sh((2110, 58, 2197, 80), "top"), INK, 7, 5.0)
    put(word, "4", sh((2226, 59, 2244, 80), "top"), INK, 0)
    wool = 1 - np.asarray(Image.open(os.path.join(SRC, "icon_wool.png")).convert("L")).astype(np.float32) / 255
    ys, xs = np.where(wool > 0.35)
    put(place, wool[ys.min():ys.max() + 1, xs.min():xs.max() + 1], sh(WOOL_ICON, "right"), INK, "fit")
    d2 = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
    dd = ImageDraw.Draw(d2)
    tx, ty = c["off"]["top"]
    dd.line([((2210 + tx) * S, r(52 + ty)), ((2210 + tx) * S, r(87 + ty))], fill=INK, width=max(2, round(1.6 * S)))

    # ── the display: black glass, a soft reflection along its top, the lit words and symbols (same on both colours) ──
    x0, y0, x1, y1 = DISPLAY
    dd.rounded_rectangle([x0 * S, r(y0), x1 * S, r(y1)], radius=5 * S, fill=(14, 15, 17), outline=(96, 100, 112), width=round(1.5 * S))
    canvas = np.asarray(d2).astype(np.float32)
    gx0, gy0, gx1, gy1 = round(x0 * S) + 4, round(r(y0)) + 4, round(x1 * S) - 4, round(r(y0 + 70))
    grad = np.linspace(0.16, 0.0, gy1 - gy0)[:, None, None] ** 1.3
    canvas[gy0:gy1, gx0:gx1] = canvas[gy0:gy1, gx0:gx1] * (1 - grad) + 120 * grad
    d3 = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
    d4 = ImageDraw.Draw(d3)
    d4.line([(x0 * S + 6, r(327)), (x1 * S - 6, r(327))], fill=(4, 4, 5), width=round(1.5 * S))   # the groove over the buttons
    canvas = np.asarray(d3).astype(np.float32)

    # the button row: separators, labels and icons, each from its own cell of the drawing
    ph_sep = [1579, 1659.5, 1745.5, 1832, 1918, 2004, 2090, 2175.5, 2266]
    dr_sep = [0, 466.5, 982.5, 1497.5, 2013.5, 2529.5, 3046, 3562.5, 4083]
    for xs_ in ph_sep[1:-1]:            # the one between Anti Wrinkle and Ready In stops over the "3 sec." line
        y1_ = 390 if xs_ == 2090 else 406
        put(lambda cc, x: blend(cc, np.ones((round((y1_ - 338) * S), max(2, round(1.3 * S))), np.float32) * 0.85, round(x * S), round(338 * S), DIM), xs_)
    lab_y, icon_y = (1330, 1435), (1450, 1612)
    labels_ph = [(1589, 346, 1642, 356), (1678, 347, 1727, 359), (1757, 347, 1821, 359), (1838, 347, 1912, 356),
                 (1930, 347, 1991, 359), (2014, 347, 2081, 357), (2109, 347, 2157, 359), (2179, 347, 2258, 359)]
    icons_ph = [(1604, 366, 1627, 388), (1698, 366, 1707, 388), (1778, 367, 1798, 387), (1863, 369, 1886, 385),
                (1949, 368, 1973, 386), (2038, 368, 2060, 386), (2121, 366, 2144, 389), (2200, 368, 2237, 387)]
    for i in range(8):
        a_ = dr_sep[i] + (35 if i == 0 else 10)
        b_ = dr_sep[i + 1] - (35 if i == 7 else 10)
        put(place, crop_ink(ink, (a_, lab_y[0], b_, lab_y[1])), labels_ph[i], WHITE, "w")
        put(place, crop_ink(ink, (a_, icon_y[0], b_, icon_y[1])), icons_ph[i], WHITE, "fit")
    put(place, crop_ink(ink, (2635, 1630, 3460, 1720)), (2024, 396, 2158, 407), WHITE, "w")   # — key 3 sec. —
    # the top of the display: what Bosch's photo shows lit
    put(place, crop_ink(ink, (1115, 95, 1400, 215)), (1764, 138, 1811, 153), WHITE, "w")       # 1200
    put(place, crop_ink(ink, (685, 290, 900, 405)), (1689, 171, 1723, 187), WHITE, "w")        # 60°
    put(place, crop_ink(ink, (220, 462, 335, 600)), (1609, 200, 1625, 221), WHITE, "fit")      # the drop symbol
    put(place, crop_ink(ink, (2485, 300, 2645, 445)), (1990, 173, 2014, 194), WHITE, "fit")    # the tub with bubbles
    put(place, crop_ink(ink, (3705, 530, 3915, 565)), (2201, 212, 2234, 215), WHITE, "w")      # the bar over Start/Pause
    put(place, crop_ink(ink, (3605, 670, 4030, 765)), (2183, 236, 2249, 248), WHITE, "w")      # Start/Pause
    put(place, crop_ink(ink, (3695, 810, 3940, 1000)), (2198, 259, 2236, 287), WHITE, "fit")   # play/pause symbol
    put(place, crop_ink(ink, (3550, 625, 3575, 1050)), (2173, 228, 2175.5, 295), DIM, "h")    # the divider
    put(place, crop_ink(ink, (3230, 860, 3375, 1000)), (2227, 118, 2247, 136), WHITE, "fit")   # kg
    put(word, "7", (2211, 118, 2220, 132), WHITE)
    segs, bb = seven_segments(ink)
    put(digit, segs, bb, "bc", (1990, 239, 2018, 286), WHITE)          # 1
    put(digit, segs, bb, "abged", (2038, 239, 2066, 286), WHITE)       # 2
    put(digit, segs, bb, "afgcd", (2075, 239, 2105, 286), WHITE)       # 5
    for y_ in (253, 267):                                               # the colon
        put(lambda cc, y: blend(cc, np.ones((round(5 * S), round(5 * S)), np.float32), round(2025 * S), round(y * S), WHITE), y_)
    return Image.fromarray(canvas.clip(0, 255).astype(np.uint8))


def drawer(c, ph):
    """The drawer's face: the photo's own (its moulded grip keeps its light and shade), at twice the photo's pixels; the chrome
    bar is the builder's own 3D bar, so its band here is the face's plain colour."""
    x0, y0, x1, y1 = DRAWER
    k = 2
    cimg = ph.crop((x0, y0, x1, y1)).resize(((x1 - x0) * k, (y1 - y0) * k), Image.LANCZOS)
    a = tinted(np.asarray(cimg).astype(np.float32), c)
    a = cv2.GaussianBlur(a, (0, 0), 1.2)
    bx0, by0, bx1, by1 = BAR
    ya, yb = (by0 - y0 - 2) * k, (by1 - y0 + 2) * k
    a[ya:yb] = a[ya - 6:ya - 2].mean(0)[None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def bar(ph):
    """The chrome grip bar's face: the photo's polished gradient, with Bosch's mark and name set again crisp from logos/bosch.png."""
    x0, y0, x1, y1 = BAR
    k = 3                                                      # 12 px per mm: Bosch's mark and name on it are print
    cimg = ph.crop((x0, y0, x1, y1)).resize(((x1 - x0) * k, (y1 - y0) * k), Image.LANCZOS)
    a = np.asarray(cimg).astype(np.float32)
    lx0, lx1 = (380 - x0) * k, (605 - x0) * k            # the logo's span (mark and name, columns 389-594)
    left, right = a[:, lx0 - 10:lx0 - 4].mean(1, keepdims=True), a[:, lx1 + 4:lx1 + 10].mean(1, keepdims=True)
    t = np.linspace(0, 1, lx1 - lx0)[None, :, None]
    a[:, lx0:lx1] = left * (1 - t) + right * t
    out = Image.fromarray(a.clip(0, 255).astype(np.uint8)).convert("RGBA")
    lg = Image.open(os.path.join(LOGOS, "bosch.png")).convert("RGBA")
    alpha = lg.getchannel("A")
    ys, xs = np.where(np.asarray(alpha) > 20)
    alpha = alpha.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w = (595 - 390) * k                                   # the photo's mark and name: columns 390-595, centre row 255
    alpha = alpha.resize((w, round(w * alpha.height / alpha.width)), Image.LANCZOS)
    mark = Image.new("RGBA", alpha.size, (72, 74, 80, 255))
    mark.putalpha(alpha)
    out.alpha_composite(mark, ((390 - x0) * k, round((255 - y0) * k - alpha.height / 2)))
    return out.convert("RGB")


def front(c):
    """The plain front below the strip: the body colour with the photo's own fall from top to bottom (rows 600 to 3300)."""
    w, h = 512, 768
    body = body_colour(c)
    g0, g1 = c["grad"]
    a = np.ones((h, w, 3), np.float32) * body * np.linspace(g0, g1, h)[:, None, None]
    a += rng.normal(0, 0.8, (h, w, 1))
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def side(c, name, mirror):
    """Bosch's side-wall photo for this colour (PGA9), square-on to the right side: the concentric Anti Vibration rings with one
    arc over them and two under, as this model's own 3/4 photo (PGA12) shows its side. (The 360-degree frames show one arc under
    the rings; PGA12 and both PGA9 photos on the model's pages show two.) Cropped to the side wall, the studio light divided out
    (a quadratic fit in log luminance), the relief kept at half strength and given this colour's body colour; the left side is
    its mirror image."""
    im = Image.open(os.path.join(SRC, c["side"])).convert("RGB")
    W_, H_ = im.size
    crop = im.crop((7, 3, W_ - 79, 1914)).resize((600, 870), Image.LANCZOS)
    if mirror:
        crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    lum = np.asarray(crop.convert("L")).astype(np.float32)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    cf, *_ = np.linalg.lstsq(A, np.log(np.maximum(lum, 1)).reshape(-1), rcond=None)
    n = lum / np.exp(A @ cf).reshape(h, w)
    n = 1 + (n / np.median(n) - 1) * 0.5
    tint = np.clip(np.clip(n, 0.2, 2.0)[..., None] ** 1.15 * (body_colour(c) * 0.92), 0, 255)
    save(Image.fromarray(tint.astype(np.uint8)), name, 88)


# ── the back: Bosch's 360 frame of WGA1220SIN square-on to it (frame 16). The cabinet spans columns 546-1382 (598 mm) and the
# floor is row 1283: 1.40 px per mm. Centre lines are photo pixels traced on 3x and 4x enlargements of the frame; the drain hose's
# end piece stands 8 px taller than on the WGA254ZPIN's frame, which otherwise shows the same back and hoses within 3 px.
# Hose, cord and plug sizes are measured on the photo (ESTIMATED); Bosch publishes their lengths only (inlet hose 120 cm, drain
# hose 150 cm and cord 160 cm in manual 9001795571). ──
RPPM, RCX, RYB = 1.401, 964.0, 1283.0
DRAIN = [(621, 196), (627, 252), (636, 299), (643, 355), (647, 410), (649, 458), (650, 514), (651, 570), (651, 618), (650, 674), (648, 722), (648, 778), (651, 834), (653, 882), (661, 937), (680, 989), (707, 1029), (749, 1068), (797, 1099), (841, 1119), (897, 1132), (953, 1140), (1002, 1142), (1058, 1135), (1113, 1117), (1156, 1093), (1200, 1055), (1236, 1010), (1257, 966), (1275, 912), (1284, 864), (1288, 808), (1290, 752), (1292, 704), (1293, 648), (1292, 592), (1292, 544), (1292, 482)]
CUFF = ((1293, 482), (1293, 393))
BRACKET = [(583, 156), (672, 156), (668, 200), (655, 260), (600, 260), (587, 200)]
INLET = [(1263, 246), (1275, 284), (1291, 320), (1305, 358), (1316, 396), (1326, 434), (1333, 473), (1338, 512), (1339, 552), (1339, 592), (1338, 631), (1335, 671), (1320, 707), (1296, 739), (1266, 764), (1232, 785), (1196, 800), (1158, 811), (1119, 817), (1079, 819), (1040, 819), (1000, 816), (962, 807), (925, 792), (892, 771), (855, 756), (818, 743), (782, 726), (746, 708), (712, 688), (682, 663), (655, 634), (630, 603), (611, 569), (600, 531), (600, 491), (608, 452), (629, 420), (663, 402), (702, 399), (744, 410)]
NUT = ((763, 425), 44)
CORDS = {
    "CordLow": [(659, 1192), (651, 1173), (642, 1139), (626, 1093), (612, 1047), (600, 1001), (597, 969), (594, 941), (600, 910),
                (611, 890), (623, 876), (644, 859), (672, 856), (740, 857), (814, 868), (888, 883), (958, 900), (997, 909),
                (1100, 929), (1168, 936), (1228, 932), (1268, 925)],
    "CordBack": [(1272, 867), (1259, 865), (1220, 856), (1166, 843), (1100, 826), (1052, 806), (999, 788), (917, 754),
                 (838, 717), (792, 703), (759, 679), (732, 656), (700, 625), (670, 588), (652, 562), (642, 544)],
    "CordDrop": [(706, 628), (704, 660), (700, 700), (696, 732)],
}
PLUG = {"relief": (691.5, 735, 770, 21), "body": (664, 770, 709, 810), "pins": [(678.5, 810, 850), (686.5, 810, 850), (694.5, 810, 850)], "pin_d": 5}
HOLDERS = [(650, 476), (1283, 468), (650, 880), (1279, 868)]
VALVE = (1263, 246)
GROMMET = (655, 1193)
WIDTH = {"drain": 37, "inlet": 16, "cord": 6, "cuff": 36}


def to_m(p):
    return [round(-(p[0] - RCX) / RPPM / 1000, 4), round((RYB - p[1]) / RPPM / 1000, 4)]


def rear_and_paths():
    im = Image.open(os.path.join(SRC, "360_16.jpg")).convert("RGB")
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
    # paint the steel back in under them: the pressed panel is left-right symmetric about column 965, so a pixel under a hose
    # takes its mirror twin where that one is clear (except where the panel isn't symmetric); the rest is Telea inpainting
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
    box = (RCX - 287 * RPPM, RYB - 834 * RPPM, RCX + 287 * RPPM, RYB - 15 * RPPM)
    rear = clean.crop(tuple(round(v) for v in box)).resize((640, 913), Image.LANCZOS)
    save(rear, "rear.jpg", 86)
    if os.environ.get("REAR_DEBUG"):   # the traced outlines over the photo, and the painted-out back
        dbg = im.copy()
        dd = ImageDraw.Draw(dbg)

        def outline(pts, w, col):
            P = np.array(pts, np.float32)
            for i in range(len(P) - 1):
                dv = P[i + 1] - P[i]
                n = np.array([-dv[1], dv[0]]) / max(1e-6, np.hypot(*dv)) * w / 2
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
        dbg.crop((540, 60, 1400, 1300)).save(os.environ["REAR_DEBUG"] + "_a.jpg", quality=88)
        clean.crop((540, 60, 1400, 1300)).save(os.environ["REAR_DEBUG"] + "_b.jpg", quality=88)
    rib = np.ones((16, 64, 3), np.float32) * np.array([152, 153, 155], np.float32)
    rib *= (0.68 + 0.32 * (0.5 + 0.5 * np.cos(np.linspace(0, 2 * np.pi, 64, endpoint=False))) ** 1.4)[None, :, None]
    Image.fromarray(rib.clip(0, 255).astype(np.uint8)).save(os.path.join(D, "hose.jpg"), quality=92)
    px = lambda v: round(v / RPPM / 1000, 4)
    grommet_rgb = np.median(rgb[1186:1200, 648:662].reshape(-1, 3), 0).astype(int).tolist()
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
        "valve": to_m(VALVE), "grommet": to_m(GROMMET), "grommet_rgb": grommet_rgb,
    }
    json.dump(paths, open(os.path.join(D, "rear_paths.json"), "w"), indent=1)


def drum():
    """The Vario Drum's wall as Bosch's close photo (PGA8) shows it: rows of raised droplets, each with a small hole, two sizes."""
    w, h = 1024, 512
    base = np.ones((h, w, 3), np.float32) * np.array([176, 180, 186], np.float32) + rng.normal(0, 2.0, (h, w, 1))
    img = Image.fromarray(base.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for row, y in enumerate(range(10, h, 21)):
        for i, x in enumerate(range(8 + (row % 2) * 13, w, 26)):
            big = (i + row) % 3 == 0
            rr = 6.5 if big else 4.2
            d.ellipse((x - rr, y - rr * 1.35, x + rr, y + rr * 0.8), fill=(204, 207, 212))
            d.ellipse((x - rr * 0.8, y - rr * 0.9, x + rr * 0.9, y + rr * 1.0), fill=(150, 154, 160))
            hr = 2.2 if big else 1.6
            d.ellipse((x - hr, y - hr + 1, x + hr, y + hr + 1), fill=(46, 48, 52))
    save(img, "drum.jpg", 86)


def tray():
    """The drawer's tray seen from above, as Bosch's open-drawer photo of this model (PGA6) shows it: compartments II (main
    wash), the fabric softener with its white siphon insert and the moulded flower, and I (prewash), left to right."""
    t = Image.new("RGB", (512, 256), (226, 229, 233))
    d = ImageDraw.Draw(t)
    d.rectangle((6, 6, 506, 250), outline=(184, 188, 196), width=6)
    d.line([(180, 8), (180, 248)], fill=(186, 190, 198), width=6)
    d.line([(333, 8), (333, 248)], fill=(186, 190, 198), width=6)
    d.rounded_rectangle((222, 14, 298, 96), 10, fill=(236, 238, 241), outline=(196, 199, 205), width=4)   # the siphon insert
    f = ImageFont.truetype(FONT, 54, index=7)
    d.text((98, 150), "II", font=f, fill=(196, 199, 205), anchor="mm")
    d.text((420, 150), "I", font=f, fill=(196, 199, 205), anchor="mm")
    fl = 1 - np.asarray(Image.open(os.path.join(SRC, "icon_softener.png")).convert("L")).astype(np.float32) / 255
    ys, xs = np.where(fl > 0.35)
    fl = cv2.resize(fl[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (52, 52), interpolation=cv2.INTER_AREA)
    a = np.asarray(t).astype(np.float32)
    blend(a, fl, 234, 150, (196, 199, 205))
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "tray.jpg", 88)


# the decals, in photo px: A the programme names, leader lines, "Off" and the wool symbol, from right of the drawer's groove to
# the display's left edge (the dial's knob stands over its middle; the builder cuts the knob's foot out of it); B the words over
# the display ("Steam Cycle", "Serie | 4"), from A's edge to the display's right edge, down to the display's top; C the display's
# own print, exactly the glass's face. The Dark lake print sits up to 11 px off the Silver one; both lie inside these boxes.
DECALS = {"printA": (914, 44, DISPLAY[0], 420), "printB": (DISPLAY[0], 44, 2284, DISPLAY[1]), "printC": DISPLAY}


def print_decals(ink):
    rects = {}
    for key, c in COLOURS.items():
        strip = panel(c, photo(c), ink)
        for k, (x0, y0, x1, y1) in DECALS.items():
            name = f"print_{k[-1].lower()}{c['suf']}.jpg"
            save(strip.crop((round(x0 * S), round((y0 - STRIP_TOP) * S), round(x1 * S), round((y1 - STRIP_TOP) * S))), name, 88)
            rects[k] = {"file": f"print_{k[-1].lower()}.jpg", "rect": [x0 / 2414, (y0 - STRIP_TOP) / (STRIP_BOT - STRIP_TOP), x1 / 2414, (y1 - STRIP_TOP) / (STRIP_BOT - STRIP_TOP)],
                        "on": "display" if k == "printC" else "strip"}
    json.dump(rects, open(os.path.join(D, "decals.json"), "w"), indent=1)


def main():
    ink = drawing()
    if HI:
        print_decals(ink)
        return
    sil = COLOURS["silver"]
    ph_s = photo(sil)
    for key, c in COLOURS.items():
        ph = ph_s if key == "silver" else photo(c)
        suf = c["suf"]
        save(panel(c, ph, ink), f"panel{suf}.jpg", 90)
        save(drawer(c, ph), f"drawer{suf}.jpg", 90)
        save(front(c), f"front{suf}.jpg", 85)
        side(c, f"side_l{suf}.jpg", True)
        side(c, f"side_r{suf}.jpg", False)
        bc = (body_colour(c) * SHADE["front"]).round().astype(int).tolist()
        c["body_shaded"] = bc
    save(bar(ph_s), "bar.jpg", 90)
    rear_and_paths()
    drum()
    tray()
    door_r = 993.5 / PPM / 1000
    lay = {
        "feet": FEET, "strip_y": my(STRIP_BOT), "split_x": mx(SPLIT),
        "drawer": {"x0": mx(DRAWER[0]), "x1": mx(DRAWER[2]), "y0": my(DRAWER[3]), "y1": my(DRAWER[1])},
        "bar": {"x0": mx(BAR[0]), "x1": mx(BAR[2]), "y0": my(BAR[3]), "y1": my(BAR[1])},
        "display": {"x0": mx(DISPLAY[0]), "x1": mx(DISPLAY[2]), "y0": my(DISPLAY[3]), "y1": my(DISPLAY[1])},
        "dial": {"x": mx(DIAL[0]), "y": my(DIAL[1])},
        # the door: outer edge fitted on the photo (centre 1207.3, 1557.2, radius 994.4 px; across 215.5-2200 px), the thin
        # line where the outer black rim meets the black glass ring 39 px in, the clear glass from 650.5 px
        "door": {"x": mx(1207.5), "y": my(1557.5), "rim": round(door_r, 4), "ring": round(954.5 / PPM / 1000, 4), "glass": round(650.5 / PPM / 1000, 4)},
        # the pump-filter flap: its outline across columns 1680.5-2295.5, rows 2723 at column 1868 and 3316.5 at the bottom
        "flap": {"x": mx(1988.0), "y": my(3007.5), "r": round(307.5 / PPM / 1000, 4)},
        "lock_slot": {"x": 0.2034, "y": 0.475},          # 360 frame 34, door open (square-on, 1.426 px per mm)
        "body": {k: c["body_shaded"] for k, c in COLOURS.items()},
    }
    json.dump(lay, open(os.path.join(D, "layout.json"), "w"), indent=1)
    print(json.dumps(lay))


main()
