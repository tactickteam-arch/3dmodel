"""Textures for the Haier HSU18C-TQB3BN-INV 1.5 ton 3 star Clean Cool Triple Inverter+ indoor unit (blue trim).
Every mark is redrawn crisp on flat white, placed from the straight-on front photo on Sangeetha's listing 18668
(sang/s0.jpg, 823 x 823; the unit is 821 px across for Haier's 910 mm, 0.902 px per mm, cols 1..822, top at row 284):
- the Haier wordmark, from Haier's own logo file, black, 42 mm wide, centred 0.1925 m above the bottom;
- the "26" display, seven-segment, lit white with a faint outline, 26.6 mm tall, each digit 15.5 mm wide with 2.2 mm bars, and the cyan snowflake beside it
  (the display shows through the panel, as in Haier's photos);
- the "DCinverter" badge, bottom right, 103 x 12.2 mm: DC with the C's top stroke running on over the i, then "nverter".
Haier's 3/4 photos (1200 x 1200) confirm the same marks at the same places.
usage: python tex_haier_hsu18c.py <photos dir> <logos dir> <out dir>
Writes into <out dir>/haier_hsu18c/.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
rng = np.random.default_rng(7)
PRODUCT = "haier_hsu18c"
AV = "/System/Library/Fonts/Avenir Next.ttc"

S = 3.0                                     # px per mm in the panel texture
XIN, H, YS1 = 0.447, 0.310, 0.0805          # half width of the panel (m), unit height, top of the blue strip
PPM, CX, TOP = 821 / 910.0, 411.5, 284.0    # the photo: px per mm, centre column, row of the unit's top


def save(img, name, quality=88):
    os.makedirs(os.path.join(OUT, PRODUCT), exist_ok=True)
    path = os.path.join(OUT, PRODUCT, name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(path, quality=quality, optimize=True, subsampling=0)
    else:
        img.save(path, optimize=True)
    print("wrote", path, img.size, os.path.getsize(path) // 1024, "KB")


W_PX, H_PX = round(2 * XIN * 1000 * S), round((H - YS1) * 1000 * S)
OX = OY = 0.0                               # the drawing's origin: 0 for the whole panel, a print's box for its decal
X = lambda mm: W_PX / 2 + mm * S - OX
Y = lambda m: (H - m) * 1000 * S - OY
Xp = lambda col: X((col - CX) / PPM)
Yp = lambda row: (row - TOP) / PPM * S - OY


def seven(d, cx, cy, h, w, ch, col, t):
    """one seven-segment digit centred on (cx, cy), segments as bars with bevelled ends"""
    segs = {"2": "abdeg", "6": "acdefg"}[ch]
    x0, x1, y0, y1, ym = cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2, cy
    g = t * 0.55
    L = {"a": (x0 + g, y0, x1 - g, y0), "b": (x1, y0 + g, x1, ym - g), "c": (x1, ym + g, x1, y1 - g), "d": (x0 + g, y1, x1 - g, y1),
         "e": (x0, ym + g, x0, y1 - g), "f": (x0, y0 + g, x0, ym - g), "g": (x0 + g, ym, x1 - g, ym)}
    for s in segs:
        a, b, c, e = L[s]
        if a == c:   # vertical bar: a hexagon
            d.polygon([(a, b - t / 2), (a + t / 2, b), (a + t / 2, e), (a, e + t / 2), (a - t / 2, e), (a - t / 2, b)], fill=col)
        else:
            d.polygon([(a - t / 2, b), (a, b - t / 2), (c, b - t / 2), (c + t / 2, b), (c, b + t / 2), (a, b + t / 2)], fill=col)


def snowflake(d, cx, cy, r, col, t):
    for k in range(6):
        a = math.radians(60 * k + 90)
        ex, ey = cx + r * math.cos(a), cy - r * math.sin(a)
        d.line((cx, cy, ex, ey), fill=col, width=round(t))
        for sgn in (-1, 1):
            b = a + sgn * math.radians(40)
            mx, my = cx + 0.62 * r * math.cos(a), cy - 0.62 * r * math.sin(a)
            d.line((mx, my, mx + 0.34 * r * math.cos(b), my - 0.34 * r * math.sin(b)), fill=col, width=round(t))


def draw_panel(box=None):
    """the panel's print at the current scale S; box = (x0, y0, x1, y1) in px at S draws only that part"""
    K = 4                                   # everything is drawn at K x and reduced, so edges are smooth
    bw, bh = (W_PX, H_PX) if box is None else (box[2] - box[0], box[3] - box[1])
    big = Image.new("RGB", (bw * K, bh * K), (240, 241, 243))
    d = ImageDraw.Draw(big, "RGBA")
    XK, YK = (lambda mm: X(mm) * K), (lambda m: Y(m) * K)
    # Haier wordmark from Haier's own logo file, black as on the unit, fitted to the photo's box (cols 394..432, rows 384..396)
    lg = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    col = np.zeros_like(a); col[:, :, 0], col[:, :, 1], col[:, :, 2] = 22, 23, 26; col[:, :, 3] = a[:, :, 3]
    lg = Image.fromarray(col.astype(np.uint8)); lg = lg.crop(lg.getbbox())
    w = round((Xp(432) - Xp(394)) * K)
    lg = lg.resize((w, round(w * lg.height / lg.width)), Image.LANCZOS)
    cy = (Yp(384) + Yp(396)) / 2 * K
    big.paste(lg, (round((Xp(394)) * K), round(cy - lg.height / 2)), lg)
    # the 26 display: digit 2 at cols 665..679, 6 at 681..695, rows 380..404, bars about 2 px (2.2 mm);
    # lit white segments with a faint grey outline, and the cyan snowflake (cols 707..722, rows 384..399)
    t = 2.2 * S * K
    top, bot = Yp(380) * K + t / 2, Yp(404) * K - t / 2
    for ch, c0, c1 in (("2", 665, 679), ("6", 681, 695)):
        l, r = Xp(c0) * K + t / 2, Xp(c1 + 1) * K - t / 2
        seven(d, (l + r) / 2, (top + bot) / 2, bot - top, r - l, ch, (128, 134, 142, 255), t + 1.2 * S * K)
        seven(d, (l + r) / 2, (top + bot) / 2, bot - top, r - l, ch, (252, 252, 253, 255), t)
    snowflake(d, Xp(714.5) * K, Yp(391.5) * K, 8.3 * S * K, (66, 186, 224, 255), 1.4 * S * K)
    # DCinverter (ink cols 713..799, rows 470..481): one medium-weight face, D and C set tight, the C's top stroke
    # running on to the right and ending over the i in place of its dot, then "nverter"
    bx0, bx1, by0, by1 = Xp(713) * K, Xp(800) * K, Yp(470) * K, Yp(482) * K
    cap = by1 - by0
    px = 100
    for _ in range(30):
        f = ImageFont.truetype(AV, round(px), index=2)
        bb = f.getbbox("D")
        if abs((bb[3] - bb[1]) - cap) < 1:
            break
        px *= cap / (bb[3] - bb[1])
    ink = (44, 46, 50, 255)
    word = "DC\u0131nverter"
    kern = {1: -0.10 * cap, 2: 0.10 * cap}          # D to C tight, a little room between the C and the i
    adv = [d.textlength(ch, font=f) for ch in word]
    natural = sum(adv) + sum(kern.values())
    track = ((bx1 - bx0) - natural) / (len(word) - 1)
    x, xs = bx0, []
    for k, ch in enumerate(word):
        x += kern.get(k, 0)
        xs.append(x)
        d.text((x, by1), ch, font=f, fill=ink, anchor="ls")
        x += adv[k] + track
    # the C's top stroke carried on over the i: as thick as the C's stroke, from the C's top to the i's right side
    sw = 0.16 * cap
    ib = f.getbbox("\u0131")
    d.rectangle((xs[1] + 0.45 * adv[1], by0 - 0.01 * cap, xs[2] + ib[2], by0 + sw), fill=ink)
    img = big.resize((bw, bh), Image.LANCZOS)
    # a 1.5 % fall to the bottom, as on the Haier HSO52 panel
    g = (1.0 - 0.015 * (OY + np.arange(bh)) / (H_PX - 1))[:, None, None]
    return Image.fromarray((np.asarray(img).astype(float) * g).clip(0, 255).astype(np.uint8))


# The prints again at 15 px per mm (12+ on the curved panel), each on its own decal over the panel: the box round each
# print, in the panel texture's px (3 per mm), and the same box of the same drawing at 5 x; the panel ground is in both,
# so the decal's edge doesn't show. decals.json gives each box as a UV rectangle of the panel for the builder.
DECAL_K = 5
DECALS = {                                  # photo boxes (cols, rows) of each print, 4 mm round it
    "wordmark": (394, 384, 432, 396),
    "display": (665, 380, 722, 404),
    "badge": (713, 470, 800, 482),
}


def panel():
    global S, W_PX, H_PX, OX, OY
    save(draw_panel(), "panel.jpg", 90)
    S0, W0, H0 = S, W_PX, H_PX
    out = {}
    for name, (c0, r0, c1, r1) in DECALS.items():
        m = 4 * S0
        box = (math.floor(Xp(c0) - m), math.floor(Yp(r0) - m), math.ceil(Xp(c1 + 1) + m), math.ceil(Yp(r1 + 1) + m))
        S, W_PX, H_PX = S0 * DECAL_K, W0 * DECAL_K, H0 * DECAL_K
        OX, OY = box[0] * DECAL_K, box[1] * DECAL_K
        img = draw_panel(tuple(v * DECAL_K for v in box))
        S, W_PX, H_PX, OX, OY = S0, W0, H0, 0.0, 0.0
        save(img, f"decal_{name}.jpg", 90)
        out[name] = {"file": f"decal_{name}.jpg", "rect": [box[0] / W0, box[1] / H0, box[2] / W0, box[3] / H0]}
    with open(os.path.join(OUT, PRODUCT, "decals.json"), "w") as f:
        json.dump(out, f, indent=1)


def filters():
    """The air filter behind the panel: a fine mesh over the coil's fins, in a frame with ribs and pull tabs
    (ESTIMATED: Haier's manual names the air purifying filter inside the inlet grille but shows no photo of it)."""
    w, h = 1024, 512
    a = np.zeros((h, w, 3))
    fins = np.where((np.arange(w) % 4) < 2, 150.0, 178.0)
    a[:] = np.array([1.0, 1.01, 1.03])[None, None, :] * fins[None, :, None]
    a += rng.normal(0, 1.5, (h, w, 1))
    mesh = np.zeros((h, w), bool)
    mesh[::5, :] = True
    mesh[:, ::5] = True
    a[mesh] = a[mesh] * 0.35 + 232 * 0.65
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    frame, edge = (236, 238, 240), (205, 208, 212)
    d.rectangle((0, 0, w - 1, h - 1), outline=frame, width=16)
    d.rectangle((w // 2 - 10, 0, w // 2 + 10, h), fill=frame)
    for cx in (w // 4, 3 * w // 4):
        for x in (cx - 128, cx + 128):
            d.rectangle((x - 4, 0, x + 4, h), fill=frame)
        d.rectangle((cx - w // 4 + 8, h // 2 - 4, cx + w // 4 - 8, h // 2 + 4), fill=frame)
        d.rounded_rectangle((cx - 34, h - 70, cx + 34, h - 8), 8, fill=(244, 245, 246), outline=edge, width=3)
    save(img, "filter.jpg", 80)


def top_grille():
    """The air inlet on top: Haier's 3/4 photos show slot groups broken by ribs about every 105 mm (8 groups)."""
    w, h = 1024, 128                 # spans x = +-447 mm and the top from the wall to the panel
    img = Image.new("RGB", (w, h), (243, 244, 245))
    d = ImageDraw.Draw(img)
    px = w / 894.0
    slot = (118, 122, 128)
    rows = [(14, 30), (40, 56), (66, 82), (92, 108)]
    n = 8
    pitch = 894.0 / n
    for k in range(n):
        x, x2 = k * pitch + 8, (k + 1) * pitch - 8
        for y0, y1 in rows:
            d.rounded_rectangle((round(x * px), y0, round(x2 * px), y1), 4, fill=slot)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    save(img, "top.jpg", 86)


panel()
filters()
top_grille()
