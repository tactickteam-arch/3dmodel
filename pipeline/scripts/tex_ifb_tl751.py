"""Textures and print for the IFB TL751MS2SID, 7.5 kg top-load washing machine, Mystic Silver.

usage: python3 tex_ifb_tl751.py <photos dir> <logos dir> <out dir>
  photos: ifb_tl751/top.jpg       IFB's straight-down photo of this model (lid shut): the control panel's print, the lid
                                  (window, TEMPERED GLASS band, the glass maker's ISI marking), the hinge bar
          ifb_tl751/side.jpg      IFB's right-side photo (the profile, the pressed C pattern, the grip, the seam)
          ifb_tl751/bee_label_src.png  IFB's picture of this model's BEE label (the label, drawn again at the end)
  The silver's brightness, the well, the drum, the lint tower, the ActivMix tray and the pulsator were read off IFB's front
  and lid-open photos (not needed to run this).
  writes <out dir>/ifb_tl751/*.jpg|png and panel.json (the print pieces' places on the panel face, in mm)

Scale. IFB's photos are 2200 x 1320 renders on transparency, composited on white here. The top photo looks straight
down: the cabinet spans columns 523-1677 (1155 px for IFB's 543 mm, 2.127 px per mm), the lid's front edge is row 1252.
The control panel's face slopes up toward the back at 20.3 degrees (side photo), so the top photo shows its print
foreshortened by cos 20.3 = 0.938 front to back; the print is drawn here on the face itself (12 px per mm).
The side photo: the feet stand on row 1260 and the panel's peak is row 48 (1212 px for IFB's 946 mm, 1.2812 px per mm
up the photo); front to back it spans columns 740-1461 (722 px for IFB's 575 mm, 1.2557 px per mm). IFB's renders are
about 2% taller than IFB's own figures, so each axis has its own scale.

Text. Every word and figure on the panel is set again in Arial or Arial Narrow (whichever matches the photo's
width-to-height), or DIN Alternate Bold for IFB's squared lettering (7.5KG, POWER STEAM, ECO INVERTER), each fitted to the
ink box it has in the top photo. The display's digits are seven-segment bars; the power and start keys, the heart, the
lock, the arrows, the Programs frame and the key underlines are drawn as shapes. The small pictograms (the four wash
stages, the eight key icons, the Ai, steam and eco marks) are traced: the photo's ink, enlarged and cut at half its
strength, so their edges are sharp at 12 px per mm while their shapes stay IFB's. The IFB mark is IFB's own logo file.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "ifb_tl751"
SRC = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
SUP = "/System/Library/Fonts/Supplemental/"
ARIAL, NARROW, BOLD = SUP + "Arial.ttf", SUP + "Arial Narrow.ttf", SUP + "Arial Bold.ttf"
DIN = SUP + "DIN Alternate Bold.ttf"
rng = np.random.default_rng(20261123)

# ── IFB's size (product page, Amazon IFB store listing): 543 W x 575 D x 946 H mm ──
W_MM, D_MM, H_MM = 543.0, 575.0, 946.0
# top photo
TPX, TCX, TFRONT = 2.127, 1100.0, 1252.0          # px per mm, centre column, the lid's front edge row
# the panel face (side photo): from its front edge at 452 mm from the front, 915 mm up, to the peak at 536 mm, 946 mm up
F0, F1, H0, H1 = 452.0, 536.0, 915.0, 946.0
FL = math.hypot(F1 - F0, H1 - H0)                   # 89.5 mm up the slope
COS = (F1 - F0) / FL
PX = 12.0                                          # print, px per mm
# side photo
SPX_X, SPX_Y, SX0, SFLOOR = 1.2557, 1.2812, 741.0, 1260.0


def save(img, name, q=88):
    path = os.path.join(D, name)
    if isinstance(img, np.ndarray):
        img = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    if name.endswith(".png"):
        img.save(path, optimize=True)
    else:
        img.convert("RGB").save(path, quality=q, optimize=True)
    print(f"{name:24s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path) / 1024:.0f} KB")


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(np.float32)


TOP = load("top.jpg")
TOPL = TOP.mean(2)


# ── the panel's coordinates: x mm from the panel's left edge, s mm up the slope from its front edge ──
def face_xs(px, py):
    x = (px - TCX) / TPX + W_MM / 2
    s = ((TFRONT - py) / TPX - F0) / COS
    return x, s


def tbox(box):
    """A top-photo box (x0, y0, x1, y1) as a box on the face in mm (x0, s1, x1, s0): s1 is the far (upper) edge."""
    x0, s0 = face_xs(box[0], box[3])
    x1, s1 = face_xs(box[2], box[1])
    return x0, s0, x1, s1


# ── a canvas over the face, 12 px per mm, row 0 at the panel's back (upper) edge ──
CW, CH = int(round(W_MM * PX)), int(round(FL * PX))
BG = np.array([14, 14, 15], np.float32)            # the panel's gloss black (the photo reads 20-45 with its reflections)
canvas = np.ones((CH, CW, 3), np.float32) * BG


def cpx(x_mm, s_mm):
    return x_mm * PX, (FL - s_mm) * PX


def blend(m, X, Y, colour, cv=None):
    cv = canvas if cv is None else cv
    h, w = m.shape
    xa, ya, xb, yb = max(0, X), max(0, Y), min(cv.shape[1], X + w), min(cv.shape[0], Y + h)
    if xb <= xa or yb <= ya:
        return
    a = np.clip(m[ya - Y:yb - Y, xa - X:xb - X], 0, 1)[..., None]
    cv[ya:yb, xa:xb] = cv[ya:yb, xa:xb] * (1 - a) + np.array(colour, np.float32) * a


def mask_text(s, px, path, index=0):
    f = ImageFont.truetype(path, max(4, round(px)), index=index)
    w = int(f.getlength(s) + px * 2)
    h = int(px * 2.4)
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).text((px * 0.5, px * 0.4), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.3)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def place(m, box, colour, keep="xy", align="c"):
    """Fits a mask into a top-photo box, on the face."""
    x0, s0, x1, s1 = tbox(box)
    X0, Y0 = cpx(x0, s1)
    X1, Y1 = cpx(x1, s0)
    bw, bh = X1 - X0, Y1 - Y0
    h, w = m.shape
    if keep == "w":
        k = bw / w; nw, nh = round(w * k), round(h * k)
    elif keep == "h":
        k = bh / h; nw, nh = round(w * k), round(h * k)
    else:
        nw, nh = round(bw), round(bh)
    mm = cv2.resize(m.astype(np.float32), (max(1, nw), max(1, nh)), interpolation=cv2.INTER_AREA)
    X = X0 if align == "l" else X1 - nw if align == "r" else (X0 + X1) / 2 - nw / 2
    blend(mm, round(X), round((Y0 + Y1) / 2 - nh / 2), colour)


def word(s, box, colour, fonts=(ARIAL, NARROW)):
    """A word fitted to its ink box by width, in whichever font gives the photo's letter height (on the face)."""
    x0, s0, x1, s1 = tbox(box)
    bw, bh = x1 - x0, s1 - s0
    best = None
    for path in fonts:
        m = mask_text(s, 100, path)
        hh = m.shape[0] * bw / m.shape[1]
        if best is None or abs(hh - bh) < best[0]:
            best = (abs(hh - bh), path)
    k = bw * PX / mask_text(s, 100, best[1]).shape[1]
    place(mask_text(s, 100 * k, best[1]), box, colour, keep="xy")


def trace(box, colour, pad=1.5, cut=0.5, inv=False, ref=None):
    """The photo's ink in a box, enlarged to 12 px per mm on the face and cut at `cut` of its strength: a sharp-edged
    shape that keeps IFB's drawing. ref: an (x0, y0, x1, y1) box whose median is the background."""
    x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
    xi0, yi0, xi1, yi1 = int(math.floor(x0)), int(math.floor(y0)), int(math.ceil(x1)), int(math.ceil(y1))
    crop = TOPL[yi0:yi1, xi0:xi1]
    if ref is None:
        ring = np.concatenate([crop[0], crop[-1], crop[:, 0], crop[:, -1]])
        bg = np.median(ring)
    else:
        bg = np.median(TOPL[ref[1]:ref[3], ref[0]:ref[2]])
    ink = (bg - crop) if inv else (crop - bg)
    ink = np.clip(ink / max(1e-3, np.percentile(ink, 99)), 0, 1.2)
    bx0, bs0, bx1, bs1 = tbox((xi0, yi0, xi1, yi1))
    nw, nh = round((bx1 - bx0) * PX), round((bs1 - bs0) * PX)
    big = cv2.resize(ink, (nw, nh), interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), 0.25 * PX / TPX)
    a = np.clip((big - cut) / 0.12 + 0.5, 0, 1)
    X, Y = cpx(bx0, bs1)
    blend(a, round(X), round(Y), colour)


def vec(box, fn, colour, ss=8):
    """A shape drawn by fn(draw, w, h) on a supersampled mask the size of the box on the face."""
    x0, s0, x1, s1 = tbox(box)
    X0, Y0 = cpx(x0, s1)
    X1, Y1 = cpx(x1, s0)
    w, h = max(1, round(X1 - X0)), max(1, round(Y1 - Y0))
    im = Image.new("L", (w * ss, h * ss), 0)
    fn(ImageDraw.Draw(im), w * ss, h * ss)
    m = np.asarray(im.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    blend(m, round(X0), round(Y0), colour)


SEG = {"8": "abcdefg", "A": "abcefg", "1": "bc"}


def seven(box, lit, colour_on, colour_off, ss=8):
    """A seven-segment digit in a box; lit is the set of lit segments (the rest dim)."""
    x0, s0, x1, s1 = tbox(box)
    X0, Y0 = cpx(x0, s1)
    X1, Y1 = cpx(x1, s0)
    w, h = round(X1 - X0), round(Y1 - Y0)
    for on in (False, True):
        im = Image.new("L", (w * ss, h * ss), 0)
        d = ImageDraw.Draw(im)
        W, H = w * ss, h * ss
        t = 0.2 * W
        g = 0.035 * W

        def bar(a0, b0, a1, b1):
            if a1 - a0 > b1 - b0:
                c = (b0 + b1) / 2
                d.polygon([(a0, c), (a0 + t / 2, b0), (a1 - t / 2, b0), (a1, c), (a1 - t / 2, b1), (a0 + t / 2, b1)], fill=255)
            else:
                c = (a0 + a1) / 2
                d.polygon([(c, b0), (a1, b0 + t / 2), (a1, b1 - t / 2), (c, b1), (a0, b1 - t / 2), (a0, b0 + t / 2)], fill=255)
        P = {"a": (g, 0, W - g, t), "g": (g, H / 2 - t / 2, W - g, H / 2 + t / 2), "d": (g, H - t, W - g, H),
             "f": (0, g, t, H / 2 - g), "b": (W - t, g, W, H / 2 - g), "e": (0, H / 2 + g, t, H - g), "c": (W - t, H / 2 + g, W, H - g)}
        for sg in "abcdefg":
            if (sg in lit) == on:
                bar(*P[sg])
        m = np.asarray(im.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
        blend(m, round(X0), round(Y0), colour_on if on else colour_off)


# ── colours (top photo, 90th percentile of each element's ink, lifted for the photo's blur) ──
WHITE = (226, 226, 228)
SUBT = (178, 178, 180)
DIM = (92, 92, 96)                 # unlit pictograms
RULE = (150, 151, 153)
MARK = (122, 122, 126)             # unlit programme lights
AMBER = (250, 146, 42)
RED = (240, 48, 56)
BLUE = (138, 210, 250)
STEAMRED = (248, 72, 96)
DISPLAY = (52, 52, 54)             # the display window's grey (the photo reads 50-54)
SEGOFF = (84, 86, 90)


def panel():
    # IFB and 7.5KG
    logo = np.asarray(Image.open(os.path.join(LOGOS, "ifb.png")).convert("RGBA"))[..., 3].astype(np.float32) / 255
    ys, xs = np.where(logo > 0.3)
    place(logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (568, 206, 631, 227), (212, 214, 216))
    word("7.5KG", (639, 218, 671, 227), (222, 222, 222), fonts=(DIN,))
    # [Ai] [steam] POWER STEAM®
    vec((570, 253, 588, 270), lambda d, w, h: d.rounded_rectangle([0, 0, w - 1, h - 1], w * 0.18, fill=255), BLUE)
    vec((570, 253, 588, 270), lambda d, w, h: d.rounded_rectangle([w * 0.16, h * 0.16, w * 0.84, h * 0.84], w * 0.1, outline=255, width=max(1, int(w * 0.06))), (22, 40, 56))
    word("Ai", (574.5, 257.5, 583.5, 266), (22, 40, 56), fonts=(BOLD,))
    vec((592, 253, 609, 269), lambda d, w, h: d.rounded_rectangle([0, 0, w - 1, h - 1], w * 0.18, fill=255), STEAMRED)
    trace((594.5, 255.5, 606.5, 267), (110, 18, 34), pad=0.5, cut=0.45, inv=True, ref=(596, 254, 607, 256))
    word("POWER STEAM", (613, 260, 701, 269), STEAMRED, fonts=(DIN,))
    word("®", (701.5, 259, 705.5, 263.5), STEAMRED, fonts=(ARIAL,))

    # the programme list: a light per programme (Cotton lit) and its name
    for x0, y0, lit in [(852, 164, False), (852, 184, False), (852.5, 208.5, False), (853, 230.5, False),
                        (945, 164, False), (945, 186, True), (946, 208.5, False), (946, 229, False)]:
        vec((x0, y0, x0 + 3, y0 + 9), lambda d, w, h: d.rectangle([0, 0, w - 1, h - 1], fill=255), AMBER if lit else MARK)
    word("StainFighter™", (859, 163, 926, 176), WHITE)
    word("Bulky", (859, 181.5, 886.5, 193), WHITE)
    word("(Blankets/Curtains)", (858.5, 195, 912, 202), SUBT)
    word("Baby Wear", (859, 207, 915, 220), WHITE)
    word("Anti-Allergen", (859.5, 229, 924, 242), WHITE)
    word("Mix/Daily", (952, 163, 998, 176), WHITE)
    word("Cotton", (952, 185, 985, 196), WHITE)
    word("Express 30'", (953, 207, 1011, 220), WHITE)
    word("Delicates", (953, 228, 999, 239), WHITE)

    # the display: *Hold for 3 sec., the grey window with the heart, 8:A1 and the lock
    word("*Hold for 3 sec.", (1075, 153, 1128, 161), (196, 196, 196))
    vec((1047, 165.5, 1156.5, 202), lambda d, w, h: d.rounded_rectangle([0, 0, w - 1, h - 1], h * 0.12, fill=255), DISPLAY)

    def heart(d, w, h):
        lw = max(2, int(w * 0.11))
        d.arc([0, 0, w * 0.56, h * 0.62], 150, 360, fill=255, width=lw)
        d.arc([w * 0.44, 0, w, h * 0.62], 180, 30, fill=255, width=lw)
        d.line([(w * 0.06, h * 0.45), (w * 0.5, h * 0.96), (w * 0.94, h * 0.45)], fill=255, width=lw, joint="curve")
    vec((1052, 178, 1063, 188), heart, (118, 120, 122))
    seven((1071, 169, 1086, 197), "", AMBER, SEGOFF)
    for y in (178, 186, 194):
        vec((1091, y, 1093.2, y + 3), lambda d, w, h: d.rectangle([0, 0, w - 1, h - 1], fill=255), SEGOFF)
    seven((1096, 169, 1112, 197), "abcef", AMBER, SEGOFF)
    seven((1117, 169, 1133, 197), "ef", AMBER, SEGOFF)

    def lock(d, w, h):
        d.rounded_rectangle([0, h * 0.42, w - 1, h - 1], w * 0.14, fill=255)
        d.arc([w * 0.16, 0, w * 0.84, h * 0.75], 180, 360, fill=255, width=max(2, int(w * 0.16)))
        d.line([(w * 0.16 + w * 0.08, h * 0.36), (w * 0.24, h * 0.5)], fill=255, width=max(2, int(w * 0.16)))
        d.line([(w * 0.76, h * 0.36), (w * 0.76, h * 0.5)], fill=255, width=max(2, int(w * 0.16)))
        d.ellipse([w * 0.4, h * 0.6, w * 0.6, h * 0.8], fill=0)
    vec((1141, 177, 1150, 189), lock, RED)
    # the wash stages: four tub pictograms with arrows between (the second arrow lit)
    for b in [(1050, 215, 1064, 227), (1080, 215, 1094, 227), (1109, 215, 1124, 227), (1139, 215, 1154, 227)]:
        trace(b, (205, 206, 208), pad=1.0, cut=0.42)
    for b, lit in [((1069.5, 216, 1074.5, 226), False), ((1099.5, 216, 1104.5, 226), True), ((1128.5, 216, 1133.5, 226), False)]:
        vec(b, lambda d, w, h: d.line([(w * 0.15, h * 0.08), (w * 0.82, h * 0.5), (w * 0.15, h * 0.92)], fill=255, width=max(2, int(w * 0.3)), joint="curve"),
            AMBER if lit else (104, 104, 106))
    vec((1070, 243, 1134, 268), lambda d, w, h: d.rounded_rectangle([1, 1, w - 2, h - 2], h * 0.18, outline=255, width=max(2, int(h * 0.075))), (176, 180, 182))
    word("Programs", (1077, 249, 1128, 263), WHITE)
    word("*Favourite", (1088, 270, 1117, 276), SUBT)

    # the keys: pictogram, name, underline, and the hold function under some
    tops = [("Soak", (1179, 188, 1205, 199), (1185, 163, 1199, 174), (1184, 202, 1200, 204)),
            ("Wash", (1230, 188, 1259, 198), (1238, 163, 1251, 174), (1236, 202, 1253, 204)),
            ("Water", (1281, 187, 1312, 198), (1291, 163, 1303, 174), (1289, 202, 1305, 204)),
            ("Steam", (1333, 187, 1365, 198), (1343, 162, 1356, 174), (1341, 202, 1357, 204))]
    bots = [("Rinse", (1178, 246, 1207, 256), (1185, 221, 1199, 232), (1184, 260, 1200, 262), "*Child Lock", (1176, 264, 1209, 271)),
            ("Spin", (1233, 246, 1256, 259), (1238, 221, 1251, 232), (1236, 260, 1252, 262), "*Air Dry", (1233, 264, 1256, 272)),
            ("Delay", (1282, 246, 1311, 259), (1290, 221, 1303, 232), (1288, 260, 1305, 262), "*Tub Clean", (1281, 264, 1313, 271)),
            ("PreClean", (1325, 245, 1372, 256), (1342, 221, 1356, 232), (1340, 260, 1357, 262), None, None)]
    for name, wb, ib, ub, *sub in tops + bots:
        word(name, wb, WHITE)
        lit = name == "Rinse"
        trace(ib, AMBER if lit else (104, 104, 108), pad=1.0, cut=0.42)
        vec((ub[0], ub[1] - 0.2, ub[2], ub[3] + 0.2), lambda d, w, h: d.rectangle([0, 0, w - 1, h - 1], fill=255), RULE)
        if sub and sub[0]:
            word(sub[0], sub[1], SUBT)
    word("Temp", (1341, 206, 1357, 214), SUBT)

    def power(d, w, h):
        lw = max(2, int(w * 0.085))
        d.arc([lw, h * 0.14, w - lw, h - 1 - lw * 0.2], 300, 240, fill=255, width=lw)
        d.line([(w / 2, 0), (w / 2, h * 0.5)], fill=255, width=lw)
    vec((1395, 177, 1417, 201), power, (222, 224, 226))

    def playpause(d, w, h):
        lw = max(2, int(w * 0.07))
        d.polygon([(lw, lw), (w * 0.56, h / 2), (lw, h - lw)], outline=255, width=lw)
        d.rectangle([w * 0.7, 0, w * 0.7 + lw * 1.1, h - 1], fill=255)
        d.rectangle([w - 1 - lw * 1.1, 0, w - 1, h - 1], fill=255)
    vec((1394, 235, 1417, 255), playpause, (210, 212, 214))

    # [eco] ECO INVERTER
    # the eco mark: a light rounded square with IFB's leaf and bubbles in the panel's black (traced)
    vec((1531, 251, 1549, 268), lambda d, w, h: d.rounded_rectangle([0, 0, w - 1, h - 1], w * 0.2, fill=255), (224, 224, 224))
    trace((1533.5, 253.5, 1546.5, 265.5), (30, 30, 32), pad=0.0, cut=0.3, inv=True, ref=(1533, 262, 1536, 265))
    word("ECO", (1553, 259, 1574, 268), (226, 226, 226), fonts=(DIN,))
    word("INVERTER", (1577, 259, 1632, 268), (226, 226, 226), fonts=(DIN,))


panel()
# the print pieces: the inked parts of the face, each with 2 mm round it, cut from the canvas
PIECES = {"logo": (564, 202, 709, 274), "progs": (848, 159, 1016, 245), "display": (1043, 149, 1160, 279),
          "keys": (1172, 158, 1421, 275), "eco": (1527, 247, 1637, 272)}
layout = {"face": {"front": [F0 / 1000, H0 / 1000], "peak": [F1 / 1000, H1 / 1000], "len": round(FL / 1000, 5)},
          "bg": [int(v) for v in BG], "pieces": {}}
for k, b in PIECES.items():
    x0, s0, x1, s1 = tbox(b)
    X0, Y0 = [int(math.floor(v)) for v in cpx(x0, s1)]
    X1, Y1 = [int(math.ceil(v)) for v in cpx(x1, s0)]
    save(canvas[Y0:Y1, X0:X1], f"print_{k}.jpg", q=88)
    # the piece's rectangle on the face, mm: x from the panel's left edge, s up the slope (s0 lower edge)
    layout["pieces"][k] = [round(X0 / PX, 3), round(FL - Y1 / PX, 3), round(X1 / PX, 3), round(FL - Y0 / PX, 3)]
save(Image.new("RGB", (8, 8), tuple(int(v) for v in BG)), "panel_base.jpg", q=95)
if "--compare" in sys.argv:
    big = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
    big.save(os.path.join(D, "_panel_full.png"))


# ── the mystic silver: a neutral grey with fine silver flecks (IFB: "Mystic Silver (Sparkle)") ──
# The photos are neutral (R = G = B). IFB's front reads 157 at the top to 98 at the foot (0.62 to 0.38 of the white
# background), the side 209 to 134 in the brighter side light. The page's light lifts textures about 25 %, so the
# texture keeps the front's middle, about 0.8 of it.
SILVER = 112.0


def flecks(h, w, ppm, base, amp=1.0):
    """White silver flecks, about 0.3-0.6 mm across, as the photos' speckle (1 in every ~30 mm2)."""
    out = np.zeros((h, w), np.float32)
    n = int(h * w / (ppm * ppm) / 9.0 * amp)
    ys, xs = rng.integers(0, h, n), rng.integers(0, w, n)
    out[ys, xs] = rng.uniform(40, 120, n)
    out = cv2.GaussianBlur(out, (0, 0), max(0.5, 0.18 * ppm))
    return out * (0.3 * ppm + 0.7)


def tile_mystic(size=512, ppm=4.0):
    base = np.full((size, size), SILVER, np.float32)
    # (no mottle: any broad pattern repeats visibly every tile across the front)
    f = flecks(size, size, ppm, SILVER)
    f = np.roll(f, (size // 2, size // 2), (0, 1)) * 0.5 + f * 0.5
    v = base + f
    save(np.dstack([v, v, v]), "mystic.jpg", q=90)


tile_mystic()


# ── the right side: IFB's side photo, its light taken out, flecks laid again (the left side is this mirrored) ──
def side():
    S = load("side.jpg").mean(2)
    ppm = 2.0
    XF1, HB, HT = 545.0, 59.0, 896.0          # front edge to the back, plinth top to the top cover's highest side line
    w, h = int(XF1 * ppm), int((HT - HB) * ppm)
    xs = SX0 + (np.arange(w) + 0.5) / ppm * SPX_X
    ys = SFLOOR - (HT - (np.arange(h) + 0.5) / ppm) * SPX_Y
    mx, my = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
    src = cv2.medianBlur(S.astype(np.uint8), 3).astype(np.float32)      # the photo's own speckle out
    v = cv2.remap(src, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    # the studio light: divide out a broad blur (the pressed C, the grip and the seam are small and stay), keep 30 % of it
    broad = cv2.GaussianBlur(v, (0, 0), 60)
    rel = v / np.maximum(broad, 1)
    fall = (broad / broad.mean()) ** 0.3
    v = SILVER * 1.05 * rel * fall
    v += flecks(h, w, ppm, SILVER) * (v > 70)
    save(np.dstack([v, v, v]), "side.jpg", q=82)
    return w, h


side()


# the front, the top cover and the plinth's silver parts use the mystic tile; the page light gives the fall.


# ── the lid's window: tinted glass with IFB's dot screen round its edge; the TEMPERED GLASS band and the ISI mark ──
def lid():
    # window (top photo): columns 594-1606, rows 462-1047 (476 x 275 mm), corners about 10 mm
    ppm = 4.0
    ww, wh = 476.0, 275.0
    w, h = int(ww * ppm), int(wh * ppm)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32) / ppm
    r = 10.0
    dx = np.maximum(np.maximum(r - xx, xx - (ww - r)), 0)
    dy = np.maximum(np.maximum(r - yy, yy - (wh - r)), 0)
    dist = np.minimum.reduce([xx, ww - xx, yy, wh - yy])
    corner = np.hypot(dx, dy) - r
    inside = np.where((dx > 0) & (dy > 0), -corner, dist)
    # the dot screen: a 7 mm border of dots that shrink inward (a frit), drawn as a fade of the glass's opacity
    a = np.full((h, w), 0.92, np.float32)
    band = np.clip(1 - inside / 7.0, 0, 1)
    gx, gy = (xx % 1.0) - 0.5, (yy % 1.0) - 0.5
    dot = (np.hypot(gx, gy) < 0.5 * np.sqrt(band)).astype(np.float32)
    a = np.maximum(a, dot * 0.97)
    a[inside < 0.6] = 0.99
    # the black band along the window's front edge (rows 992-1047: 26 mm), TEMPERED GLASS printed on it
    a[yy > wh - 25.9] = 0.99
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = 8
    rgba[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
    Image.fromarray(rgba).resize((w // 2, h // 2), Image.LANCZOS).quantize(64).save(os.path.join(D, "lid_window.png"), optimize=True)
    print("lid_window.png", os.path.getsize(os.path.join(D, "lid_window.png")) // 1024, "KB")
    # TEMPERED GLASS: columns 1027-1172, rows 1003-1014 (light grey, IFB's squared letters), on the band, 12 px per mm
    # (light grey letters on clear: the band under it is the window's own solid black)
    bw, bh = 120.0, 25.9
    alpha = np.zeros((int(bh * PX), int(bw * PX)), np.float32)
    m = mask_text("TEMPERED GLASS", 160, DIN)
    tw, th = (1172 - 1027) / TPX * PX, (1014.5 - 1003) / TPX * PX
    mm = cv2.resize(m, (round(tw), round(th)), interpolation=cv2.INTER_AREA)
    cy = (1008.75 - 992) / TPX * PX
    X0, Y0 = round(bw * PX / 2 - tw / 2), round(cy - th / 2)
    alpha[Y0:Y0 + mm.shape[0], X0:X0 + mm.shape[1]] = mm
    rgba = np.zeros(alpha.shape + (4,), np.uint8)
    rgba[..., :3] = (178, 180, 182)
    rgba[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    Image.fromarray(rgba).save(os.path.join(D, "lid_tempered.png"), optimize=True)
    # the glass maker's ISI marking (top left of the window): too small in the photo to read every figure of its licence
    # number, so it stays the photo, enlarged 6x (12.7 px per mm) and cleaned, white on clear
    crop = TOPL[464:504, 596:684]
    bg = np.median(crop)
    ink = np.clip((crop - bg) / max(1, np.percentile(crop - bg, 99.5)), 0, 1)
    ink = cv2.resize(ink, (ink.shape[1] * 6, ink.shape[0] * 6), interpolation=cv2.INTER_CUBIC)
    rgba = np.zeros(ink.shape + (4,), np.uint8)
    rgba[..., :3] = 200
    rgba[..., 3] = (np.clip(ink, 0, 1) * 230).astype(np.uint8)
    Image.fromarray(rgba).save(os.path.join(D, "lid_isi.png"), optimize=True)


lid()


# ── inside: the drum's raised drops, the lint tower, the ActivMix tray's face, the pulsator ──
def drum():
    # IFB's drum (lid-open photo, IFB store pictures): rows of raised tear drops, point up, with small
    # holes between; a tile 96 x 96 mm, 4 px per mm (the drop's size and spacing ESTIMATED off those photos)
    ppm, tw = 4.0, 96.0
    n = int(tw * ppm)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / ppm
    v = np.full((n, n), 168.0, np.float32)
    shade = np.zeros((n, n), np.float32)
    for row in range(4):
        for col in range(4):
            cx = (col + 0.5 * (row % 2) + 0.25) * 24.0
            cy = (row + 0.5) * 24.0
            for ox in (-tw, 0, tw):
                for oy in (-tw, 0, tw):
                    dx, dy = xx - cx - ox, yy - cy - oy
                    # a drop: round below, pointed above (radius grows down the drop)
                    t = np.clip((dy + 8) / 14.0, 0, 1)
                    rr = 1.5 + 5.0 * np.sqrt(t)
                    inside = (np.abs(dx) < rr) & (dy > -8) & (dy < 6.5)
                    d = np.clip(1 - np.hypot(dx / np.maximum(rr, 0.1), np.clip(dy - 1, 0, None) / 5.5), 0, 1)
                    shade += np.where(inside, d * (-dx * 3.0 - dy * 2.0) / 7.0, 0)
                    hole = np.hypot(dx - 12, dy - 10) < 0.9
                    v[hole] = 70
    v = v + shade * 22
    save(np.dstack([v, v * 1.005, v * 1.012]), "drum.jpg", q=88)


drum()


def filt():
    # the lint tower's window: a grey frame round two columns of slots (lid-open photo), 52 x 150 mm, 4 px per mm
    ppm = 4.0
    w, h = int(52 * ppm), int(150 * ppm)
    v = np.full((h, w), 128.0, np.float32)
    im = Image.fromarray(v.astype(np.uint8))
    d = ImageDraw.Draw(im)
    for c in range(2):
        for r in range(14):
            x0 = (8 + c * 19) * ppm
            y0 = (20 + r * 8.5) * ppm
            d.rounded_rectangle([x0, y0, x0 + 15 * ppm, y0 + 4.5 * ppm], 2 * ppm, fill=176)
    save(im, "filter.jpg", q=88)


filt()


def tray():
    # the ActivMix tray's face at the back of the well (lid-open photo): light grey, the ActivMix arrows over a dark
    # label, an icon either side. The words under the side icons can't be read in any photo, so they are left off.
    ppm = 12.0
    w, h = int(200 * ppm), int(40 * ppm)
    can = np.ones((h, w, 3), np.float32) * 150
    m = mask_text("ACTIVMIX", 160, DIN)
    tw, th = 30 * ppm, 3.6 * ppm
    blend(np.ones((round(5.6 * ppm), round(33 * ppm)), np.float32), round(w / 2 - 16.5 * ppm), round(22 * ppm), (34, 36, 40), cv=can)
    blend(cv2.resize(m, (round(tw), round(th)), interpolation=cv2.INTER_AREA), round(w / 2 - tw / 2), round(23 * ppm), (220, 222, 224), cv=can)
    # the two swirl arrows over the label
    im = Image.new("L", (round(16 * ppm) * 4, round(12 * ppm) * 4), 0)
    d = ImageDraw.Draw(im)
    W4, H4 = im.size
    lw = int(1.4 * ppm * 4)
    d.arc([0, H4 * 0.1, W4 * 0.6, H4 * 0.9], 120, 300, fill=255, width=lw)
    d.arc([W4 * 0.4, H4 * 0.1, W4, H4 * 0.9], 300, 120, fill=255, width=lw)
    d.polygon([(W4 * 0.3, 0), (W4 * 0.45, H4 * 0.12), (W4 * 0.3, H4 * 0.26)], fill=255)
    d.polygon([(W4 * 0.7, H4), (W4 * 0.55, H4 * 0.88), (W4 * 0.7, H4 * 0.74)], fill=255)
    a = np.asarray(im.resize((W4 // 4, H4 // 4), Image.LANCZOS)).astype(np.float32) / 255
    blend(a, round(w / 2 - 8 * ppm), round(7 * ppm), (60, 62, 66), cv=can)
    # left: the detergent mark (a cup with a wave); right: the softener mark (a bottle) - outlines, as the photo shows
    for cx, kind in ((w / 2 - 58 * ppm, "cup"), (w / 2 + 58 * ppm, "bottle")):
        im = Image.new("L", (int(10 * ppm) * 4, int(10 * ppm) * 4), 0)
        d = ImageDraw.Draw(im)
        S4 = im.size[0]
        lw = int(0.9 * ppm * 4)
        if kind == "cup":
            d.ellipse([S4 * 0.15, S4 * 0.15, S4 * 0.85, S4 * 0.85], outline=255, width=lw)
            d.arc([S4 * 0.3, S4 * 0.35, S4 * 0.7, S4 * 0.65], 200, 340, fill=255, width=lw)
        else:
            d.rounded_rectangle([S4 * 0.25, S4 * 0.3, S4 * 0.75, S4 * 0.95], S4 * 0.1, outline=255, width=lw)
            d.rectangle([S4 * 0.4, S4 * 0.08, S4 * 0.6, S4 * 0.3], outline=255, width=lw)
        a = np.asarray(im.resize((S4 // 4, S4 // 4), Image.LANCZOS)).astype(np.float32) / 255
        blend(a, round(cx - 5 * ppm), round(14 * ppm), (70, 72, 76), cv=can)
    save(can, "tray.jpg", q=88)


tray()


def pulsator():
    # the triadic pulsator from above (lid-open photo): light grey dish, three curved ribs from the centre, rings of
    # small holes; the three round pads and the centre cap are modelled. 300 mm across, 2 px per mm
    ppm, R = 2.0, 150.0
    n = int(2 * R * ppm)
    yy, xx = (np.mgrid[0:n, 0:n].astype(np.float32) + 0.5) / ppm - R
    rr, th = np.hypot(xx, yy), np.arctan2(yy, xx)
    v = np.full((n, n), 196.0, np.float32)
    for k in range(3):
        a0 = k * 2 * np.pi / 3
        rib = np.abs(np.angle(np.exp(1j * (th - a0 - 0.006 * rr)))) * rr < 9
        v[rib & (rr > 30) & (rr < 140)] = 214
        v[(np.abs(np.angle(np.exp(1j * (th - a0 - 0.006 * rr)))) * rr < 11) & ~rib & (rr > 30) & (rr < 140)] = 170
    for ring in (100, 120, 135):
        for k in range(int(2 * np.pi * ring / 9)):
            a = k * 9 / ring
            hole = np.hypot(xx - ring * np.cos(a), yy - ring * np.sin(a)) < 1.2
            v[hole] = 110
    v[rr > R - 3] = 160
    save(np.dstack([v, v, v * 1.01]), "pulsator.jpg", q=88)


pulsator()
json.dump(layout, open(os.path.join(D, "panel.json"), "w"), indent=1)
print("panel.json", layout["pieces"])


# ── the BEE star label, drawn again sharp (12 px per mm) the way tex_psg_label.py draws the others ──
# Source: IFB's own label graphic for this model (IFB's store listing on Amazon, the label-and-size picture), the whole
# sticker 443 x 846 px for its 64 mm. Every word and figure is this label's own, read off that picture: 5 stars,
# 0.0065* KWh/kg/cycle, Label Period : 1st January 2024 to 31st December 2026, Model/Year TL751MS2SID/2025, 20 L/kg/cycle,
# and the registration code BEE/IFB/21/008/19 (sharp enough in this picture to set as text). The art (the hand-with-notes
# emblem, the BEE logo) stays the picture, enlarged. The table is kept here, not in tex_psg_label.py, and that script's
# draw_label is used as it is (its file is run without its last line, main()).
def bee_label():
    psg = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex_psg_label.py")
    code = open(psg, encoding="utf-8").read()
    code = code[:code.rstrip().rindex("\nmain()")]
    ns = {"__file__": psg, "__name__": "tex_psg_label"}
    exec(compile(code, psg, "exec"), ns)
    ox, oy = 62, 124                                  # the crop's corner in the picture (all figures below: picture px)
    X = lambda x: round(x - ox, 2)
    Y = lambda y: round(y - oy, 2)
    B = lambda b: (X(b[0]), Y(b[1]), X(b[2]), Y(b[3]))
    stars = [(134.56, 294.65, 35.75, 11.0, 0.38), (201.49, 211.67, 35.25, 18.0, 0.38), (287.24, 185.29, 35.25, 19.0, 0.39),
             (377.93, 216.58, 35.0, 19.0, 0.39), (433.29, 293.73, 35.25, 18.0, 0.38)]
    foot = ["*Under test conditions, when tested in accordance with latest IEC 60456 standards.",
            "Actual energy consumption will depend on how the appliance is being used."]
    L = dict(
        src="pipeline/sources/photos/ifb_tl751/bee_label_src.png", crop=(ox, oy, 505, 970),
        out="pipeline/tex/ifb_tl751/bee_label.png", width_mm=64,
        colours=dict(red=(228, 1, 16), yellow=(254, 248, 176), cream=(255, 251, 219), green=(22, 155, 74),
                     margin=(255, 251, 219), white=(255, 255, 255), ink=(26, 26, 24)),
        cx=X(283.5), base=Y(346.3),
        outline=dict(r=221.0, ry=221.8, w=1.2, bottom=Y(969.3), margin=0),
        red=dict(rx=208.8, ry=210.0, stroke=3.0),
        disc=dict(rx=103.1, ry=103.9, stroke=3.4),
        band=dict(side=Y(397.5), apex=Y(521.0)),
        emblem=dict(cx=X(283.5), cy=Y(507.5), r=49.5, ring=3.6, fill="cream"),
        box=dict(x0=X(133.7), x1=X(433.5), y0=Y(576.4), y1=Y(667.7), w=2.0, green=(Y(596.6), Y(625.8)), rules=[Y(647.5)]),
        rules=dict(ys=[Y(v + 0.5) for v in (683, 704, 725, 746, 767, 788, 809)], x0=X(132.5), x1=X(434.5), w=1.4),
        foot_rule=dict(y=Y(930.0), x0=X(133.0), x1=X(434.0), w=1.6),
        stars=[(X(sx), Y(sy), R, rot, inner) for sx, sy, R, rot, inner in stars],
        star_sectors=None, star_fill="white",
        num=dict(h=0.44, font="reg", dy=0.07),
        words=[("MORE STARS", "black", B((214, 295, 358, 317)), "dark"),
               ("MORE SAVINGS", "black", B((202, 316, 366, 337)), "dark"),
               ("POWER SAVINGS", "black", B((105, 366, 465, 403)), "light"),
               ("GUIDE", "black", B((200, 408, 370, 446)), "light"),
               ("ENERGY CONSUMPTION", "bold", B((150, 578.5, 420, 595.5)), "dark"),
               ("0.0065*", "bold", B((200, 598, 380, 624)), "green"),
               ("KWh/kg/cycle", "bold", B((200, 627, 370, 646)), "dark"),
               ("Label Period : 1st January 2024 to 31st December 2026", "bold", B((136, 649.5, 431, 666.5)), "dark"),
               ("BEE/IFB/21/008/19", "bold", B((246, 913, 322, 925.5)), "dark"),
               (foot[0], "narrow", B((125, 932, 442, 945.5)), "faint"),
               (foot[1], "narrow", B((138, 945.5, 430, 961)), "faint")],
        table=dict(split=X(274), x0=X(134), x1=X(436), rows=[("Appliance", ": Washing Machine"), ("Brand", ": IFB"),
                                                            ("Model/Year", ": TL751MS2SID/2025"), ("Type", ": Top Load"),
                                                            ("Load Capacity", ": 7.5 kg"),
                                                            ("Water Consumption", ": 20 L/kg/cycle")]),
        pictures=[dict(circle=(X(283.5), Y(507.5), 45.7)), dict(box=B((245, 830, 321, 912)))],
    )
    cmp_dir = sys.argv[sys.argv.index("--label-compare") + 1] if "--label-compare" in sys.argv else None
    ns["draw_label"](SLUG, L, cmp_dir)


bee_label()
