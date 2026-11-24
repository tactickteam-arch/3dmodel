"""Textures for the Bosch WOE90DV0IN, Series 2 top-load washing machine, 9 kg, 680 rpm (bosch-woe90dv0in).

usage: python3 tex_bosch_woe90.py <photos dir> <logos dir> <out dir>
  photos: bosch_woe90/28143767_WOE90DV0IN_PGA6_def.webp   Bosch's view from above with the lid up, 2033 x 2028 (panel, drum)
          bosch_woe90/28143783_WOE90DV0IN_PGA2_def.webp   Bosch's side view (the right side, front to the right), 1111 x 1986
          bosch_woe90/28143787_WOE90DV0IN_PGA3_def.webp   Bosch's rear view, square on, 1154 x 1984
          bosch_woe90/28143762_WOE90DV0IN_PGA5_def.webp   Bosch's view from above with the lid shut (lid glass, BOSCH plate)
          bosch_woe90/manual_expertcare.png               the ExpertCare mark as printed in Bosch's top-loader manual (fascia)
  logos:  bosch.png
  writes <out dir>/bosch_woe90/*.jpg|png and rear.json (the cord's path on the back, in metres)

The control panel (the strip in front of the lid, 550 x 111 mm) is drawn again at 10 px per mm:
  - PGA6 (lid up, so no word is hidden under the lid's trim) is scaled to 10 px/mm: the body is 1935 px = 550 mm across;
  - the background is a flat colour (the studio's reflection is left out);
  - every word and number is set again in Avenir Next, fitted to the ink box it has in the photo;
  - the rings, the power and start/pause symbols, the lamps and the 7-segment "0:58" are drawn as shapes;
  - the small tub and programme icons are the photo's own ink, cleaned to hard edges (no word is drawn from the photo);
  - the ExpertCare mark is Bosch's own art from the manual.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "bosch_woe90"
SRC = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FONT_C = "/System/Library/Fonts/Avenir Next Condensed.ttc"
W_MM, H_MM, D_MM = 550.0, 960.0, 560.0           # Bosch product page, spec sheet; Sangeetha 96 x 55 x 56 cm

P = 10.0
PANEL_ROW0 = 119                                  # the panel's back edge in the 10 px/mm photo (rows from PGA6 row 1560)
FACE_W, FACE_H = 550.0, 111.0                     # the panel face: full width, 111 mm deep (PGA6 top view, ESTIMATED)


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(np.float32)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", p, img.size)


def font(px, face=5, fam=FONT):                  # 7 Regular, 5 Medium, 2 Demi Bold, 0 Bold
    return ImageFont.truetype(fam, max(4, round(px)), index=face)


def text_mask(s, px, face=5, fam=FONT):
    f = font(px, face, fam)
    w = int(f.getlength(s) + px * 2)
    h = int(px * 2.2)
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).text((px * 0.5, px * 0.4), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.3)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def blend(canvas, m, X, Y, colour):
    h, w = m.shape
    xa, ya, xb, yb = max(0, X), max(0, Y), min(canvas.shape[1], X + w), min(canvas.shape[0], Y + h)
    if xb <= xa or yb <= ya:
        return
    a = np.clip(m[ya - Y:yb - Y, xa - X:xb - X], 0, 1)[..., None]
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + np.array(colour, np.float32) * a


def word(canvas, s, box, colour, face=5):
    """A word fitted to its ink box: Avenir Next or its Condensed cut, whichever shape fits the box best, scaled to the box's
    width and centred on it."""
    bw, bh = box[2] - box[0], box[3] - box[1]
    best = None
    for fam in (FONT, FONT_C):
        m = text_mask(s, 80, face, fam)
        err = abs(math.log((m.shape[1] / m.shape[0]) / (bw / bh)))
        if best is None or err < best[0]:
            best = (err, fam)
    fam = best[1]
    m0 = text_mask(s, 80, face, fam)
    k = bw / m0.shape[1]
    m = text_mask(s, 80 * k, face, fam)
    m = cv2.resize(m, (max(1, round(bw)), max(1, round(m.shape[0] * bw / m.shape[1]))), interpolation=cv2.INTER_AREA)
    cy = (box[1] + box[3]) / 2
    blend(canvas, m, round(box[0]), round(cy - m.shape[0] / 2), colour)
    return os.path.basename(fam)


def tight(ph, box, thr=105, gap=16):
    """A word's ink box inside its search box (white pixels grouped into runs; the run with most ink is the word)."""
    x0, y0, x1, y1 = box
    m = ph[y0:y1, x0:x1].min(2) > thr

    def run(prof):
        idx = np.where(prof > 0)[0]
        groups, start = [], idx[0]
        for a, b in zip(idx[:-1], idx[1:]):
            if b - a > gap:
                groups.append((start, a)); start = b
        groups.append((start, idx[-1]))
        return max(groups, key=lambda g: prof[g[0]:g[1] + 1].sum())
    ya, yb = run(m.sum(1))
    xa, xb = run(m[ya:yb + 1].sum(0))
    ya2, yb2 = run(m[:, xa:xb + 1].sum(1))
    return (x0 + xa, y0 + ya2, x0 + xb + 1, y0 + yb2 + 1)


def ink_of(ph, box, pad=4):
    x0, y0, x1, y1 = box
    X0, Y0, X1, Y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    L = ph[Y0:Y1, X0:X1].min(2)
    bg = np.median(np.concatenate([L[:3].ravel(), L[-3:].ravel(), L[:, :3].ravel(), L[:, -3:].ravel()]))
    peak = np.percentile(L, 99.5)
    a = np.clip((L - bg) / max(20, peak - bg), 0, 1)
    a = cv2.GaussianBlur(a, (0, 0), 1.2)
    a = np.clip((a - 0.36) / 0.2, 0, 1)
    return a, (X0, Y0)


FACE_C, WIN_C, KEY_C = (30, 30, 32), (6, 6, 7), (36, 36, 38)
WHITE, ORANGE, LAMP_OFF = (236, 236, 238), (250, 116, 62), (84, 84, 86)

# every word on the panel: (text, search box in the 10 px/mm photo, face). Boxes found as ink clusters in PGA6.
WORDS = [
    ("Water Level", (1500, 500, 1740, 548), 0), ("Wash Program", (2860, 498, 3140, 550), 0),
    ("L09 - 10", (1396, 600, 1560, 645), 5), ("L07 - 08", (1396, 666, 1560, 710), 5), ("L05 - 06", (1396, 731, 1560, 776), 5),
    ("L03 - 04", (1396, 797, 1560, 841), 5), ("L01 - 02", (1396, 862, 1560, 906), 5),
    ("Soak", (2598, 600, 2712, 646), 5), ("Wash", (2598, 666, 2716, 711), 5), ("Rinse", (2598, 731, 2720, 777), 5),
    ("Spin", (2598, 797, 2706, 847), 5), ("Favorite", (2598, 862, 2758, 907), 5),
    ("Smart", (2942, 600, 3078, 646), 2), ("Water Save", (2941, 665, 3164, 710), 2), ("Quick", (2941, 728, 3073, 776), 2),
    ("Wool", (2941, 793, 3066, 840), 2), ("Synthetics", (2941, 857, 3151, 910), 2),
    ("Prewash", (3343, 598, 3518, 645), 2), ("Delicates", (3343, 663, 3532, 710), 2), ("Intense", (3342, 729, 3501, 775), 2),
    ("Tub Clean", (3341, 793, 3542, 839), 2), ("Spin", (3342, 857, 3452, 909), 2),
    ("Water", (1425, 1026, 1563, 1073), 0), ("Delay", (1718, 1025, 1848, 1079), 0), ("Favorite", (1993, 1025, 2150, 1074), 0),
    ("Soak", (2590, 1026, 2708, 1074), 0),
    ("Wash", (2873, 1009, 3001, 1052), 0), ("Time", (2873, 1052, 3001, 1093), 0),
    ("Rinse", (3163, 1009, 3292, 1054), 0), ("Cycle", (3163, 1054, 3292, 1098), 0),
    ("Spin", (3456, 1008, 3574, 1051), 0), ("Time", (3456, 1051, 3574, 1092), 0),
    ("Child Lock", (3030, 1150, 3196, 1194), 5),
    ("EcoSilence Drive", (4697, 659, 5190, 727), 7), ("9", (5222, 660, 5284, 727), 7), ("kg", (5279, 658, 5375, 737), 7),
    ("P", (2318, 1004, 2410, 1097), 7),
]
ICONS = [(1658, 608, 1734, 640), (1658, 737, 1735, 770), (1659, 867, 1735, 899),           # water-level tubs
         (2428, 607, 2504, 640), (2428, 658, 2504, 713), (2428, 736, 2504, 768), (2432, 792, 2500, 845), (2428, 859, 2505, 914),
         (2966, 1157, 3014, 1188)]                                                          # child-lock key
LINES = [(1375, 559, 1730, 563), (2869, 558, 3901, 562), (5203, 668, 5208, 718),          # header rules, the "|"
         (2936, 1106, 2939, 1174), (2936, 1171, 2958, 1174), (3226, 1106, 3229, 1174), (3204, 1171, 3229, 1174)]   # child-lock bracket (PGA5)
LAMPS_X = [1587, 2534, 2879, 3282]
LAMPS_Y = [623, 688, 753, 818, 884]
LIT = {(1587, 688), (2534, 688), (2534, 753), (2534, 818), (2879, 623)}
KEYS = [(1494, 1050), (1783, 1052), (2071, 1050), (2650, 1050), (2937, 1051), (3227, 1054), (3515, 1050)]   # word keys
RINGS = {"P": (2360.5, 1051, 80), "power": (3795, 694.5, 80), "start": (3793.5, 910.5, 80)}


def ss(m, s=4):
    return cv2.resize(m, (m.shape[1] // s, m.shape[0] // s), interpolation=cv2.INTER_AREA).astype(np.float32) / 255


def seven_seg(c, x0, y0, w, h, digit, colour, t=14, slant=0.085):
    """One italic 7-segment digit, mitred bars as the photo's display has them, drawn at 4x and reduced."""
    on = {"0": "abcdef", "5": "acdfg", "8": "abcdefg"}[digit]
    s = 4
    W, H = int((w + h * slant + 8) * s), int((h + 8) * s)
    m = np.zeros((H, W), np.uint8)
    T, g = t * s, 2.2 * s
    X0, Y0, ww, hh = 4 * s, 4 * s, w * s, h * s
    sh = lambda x, y: (x + (Y0 + hh - y) * slant, y)

    def bar(p, q, horiz):
        (xa, ya), (xb, yb) = p, q
        if horiz:
            pts = [(xa + g, ya), (xa + g + T / 2, ya - T / 2), (xb - g - T / 2, yb - T / 2), (xb - g, yb), (xb - g - T / 2, yb + T / 2), (xa + g + T / 2, ya + T / 2)]
        else:
            pts = [(xa, ya + g), (xa + T / 2, ya + g + T / 2), (xb + T / 2, yb - g - T / 2), (xb, yb - g), (xb - T / 2, yb - g - T / 2), (xa - T / 2, ya + g + T / 2)]
        cv2.fillPoly(m, [np.int32([sh(x, y) for x, y in pts])], 255, lineType=cv2.LINE_AA)
    L, R, Tp, Md, Bt = X0 + T / 2, X0 + ww - T / 2, Y0 + T / 2, Y0 + hh / 2, Y0 + hh - T / 2
    segs = {"a": ((L, Tp), (R, Tp), 1), "b": ((R, Tp), (R, Md), 0), "c": ((R, Md), (R, Bt), 0), "d": ((L, Bt), (R, Bt), 1),
            "e": ((L, Md), (L, Bt), 0), "f": ((L, Tp), (L, Md), 0), "g": ((L, Md), (R, Md), 1)}
    for k in on:
        p, q, hz = segs[k]
        bar(p, q, hz)
    blend(c, ss(m, s), x0 - 4, y0 - 4, colour)


def panel():
    im = load("28143767_WOE90DV0IN_PGA6_def.webp")
    x0, x1, y0, y1 = 48, 1984, 1560, 2000
    k = 10 / ((x1 - x0) / W_MM)
    ph = cv2.resize(im[y0:y1, x0:x1], None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
    Hh, Ww = 1250, int(W_MM * P)
    c = np.zeros((Hh, Ww, 3), np.float32) + np.array(FACE_C, np.float32)
    # key discs (faint, as the lid-down photo PGA5 shows them) and the three white rings
    s = 4
    for cx, cy in KEYS:
        r = 52
        m = np.zeros(((2 * r + 8) * s, (2 * r + 8) * s), np.uint8)
        cv2.circle(m, (m.shape[1] // 2, m.shape[0] // 2), r * s, 255, -1, lineType=cv2.LINE_AA)
        mm = ss(m, s)
        blend(c, mm, round(cx - mm.shape[1] / 2), round(cy - mm.shape[0] / 2), KEY_C)
    for cx, cy, r in RINGS.values():
        m = np.zeros((int(2 * r + 16) * s, int(2 * r + 16) * s), np.uint8)
        cv2.circle(m, (m.shape[1] // 2, m.shape[0] // 2), int((r - 3) * s), 255, int(5.5 * s), lineType=cv2.LINE_AA)
        mm = ss(m, s)
        blend(c, mm, round(cx - mm.shape[1] / 2), round(cy - mm.shape[0] / 2), WHITE)
    # power symbol: an open arc and a bar; start/pause: a triangle and two bars (shapes as the photo shows them)
    cx, cy, _ = RINGS["power"]
    m = np.zeros((200 * s, 200 * s), np.uint8)
    o = 100 * s
    cv2.ellipse(m, (o, o + 5 * s), (34 * s, 34 * s), -90, 38, 322, 255, int(6.5 * s), lineType=cv2.LINE_AA)
    cv2.line(m, (o, o - 39 * s), (o, o + 1 * s), 255, int(6.5 * s), lineType=cv2.LINE_AA)
    blend(c, ss(m, s), round(cx - 100), round(cy - 100), WHITE)
    cx, cy, _ = RINGS["start"]
    m = np.zeros((200 * s, 200 * s), np.uint8)
    tri = np.int32([(o - 37 * s, o - 29 * s), (o - 37 * s, o + 29 * s), (o - 2 * s, o)])
    cv2.polylines(m, [tri], True, 255, int(6 * s), lineType=cv2.LINE_AA)
    for bx in (o + 13 * s, o + 30 * s):
        cv2.line(m, (bx, o - 29 * s), (bx, o + 29 * s), 255, int(6 * s), lineType=cv2.LINE_AA)
    blend(c, ss(m, s), round(cx - 100), round(cy - 100), WHITE)
    # lamps: rounded bars, lit orange or unlit grey
    for x in LAMPS_X:
        for y in LAMPS_Y:
            m = np.zeros((19 * s, 42 * s), np.uint8)
            cv2.rectangle(m, (9 * s, 0), (33 * s, 19 * s - 1), 255, -1)
            for ex in (9 * s, 33 * s):
                cv2.circle(m, (ex, int(9.5 * s)), int(9.5 * s), 255, -1, lineType=cv2.LINE_AA)
            blend(c, ss(m, s), x, y - 9, ORANGE if (x, y) in LIT else LAMP_OFF)
    # the display window and "0:58"
    c[608:856, 1869:2286] = WIN_C
    for ch, gx in (("0", 1922), ("5", 2056), ("8", 2149)):
        seven_seg(c, gx, 693, 93 - 12, 136, ch, ORANGE, t=17)
    for cy in (735, 790):
        m = np.zeros((40 * s, 30 * s), np.uint8)
        cv2.fillPoly(m, [np.int32([(12 * s, 2 * s), (24 * s, 2 * s), (20 * s, 30 * s), (8 * s, 30 * s)])], 255, lineType=cv2.LINE_AA)
        blend(c, ss(m, s), 2018, cy - 16, ORANGE)
    # icons: the photo's ink, cleaned
    for box in ICONS:
        a, (X, Y) = ink_of(ph, box)
        blend(c, a, X, Y, WHITE)
    for x0_, y0_, x1_, y1_ in LINES:
        c[y0_:y1_, x0_:x1_] = (200, 200, 203)
    # words
    out = []
    for s_, box, face in WORDS:
        thr = 70 if s_ in ("EcoSilence Drive", "9", "kg", "Child Lock") else 105
        tb = tight(ph, box, thr=thr, gap=26 if " " in s_ else 14)
        if s_ == "P":
            tb = (2330, 1012, 2396, 1090)
        fam = word(c, s_, tb, WHITE if face != 7 or s_ == "P" else (222, 222, 224), face=face)
        out.append((s_, [int(v) for v in tb], fam))
    # ExpertCare: Bosch's art from the manual, the hands and the name each fitted to the photo's ink boxes
    man = 1 - np.asarray(Image.open(os.path.join(SRC, "manual_expertcare.png")).convert("L")).astype(np.float32) / 255
    for m, (bx0, by0, bx1, by1) in ((man[0:250, 0:330], (137, 653, 256, 737)), (man[0:250, 380:1460], (267, 666, 610, 726))):
        ys, xs = np.where(m > 0.4)
        m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        m = cv2.resize(m, (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_AREA)
        blend(c, m, bx0, by0, (226, 226, 228))
    face = c[PANEL_ROW0:PANEL_ROW0 + int(FACE_H * P)]
    img = Image.fromarray(face.clip(0, 255).astype(np.uint8))
    half = img.size[0] // 2
    save(img.crop((0, 0, half, img.size[1])), "face_l.jpg", 90)
    save(img.crop((half, 0, img.size[0], img.size[1])), "face_r.jpg", 90)
    return out


# ── the sides: Bosch's side photo PGA2 (the right side, front to the right), the grey body only ──
def side():
    im = load("28143783_WOE90DV0IN_PGA2_def.webp")
    a = im[386:1838, 36:1111].copy()                 # body rows; columns from 36 (the cord's clip on the back edge left out)
    L = a.mean(2)
    yy, xx = np.mgrid[0:L.shape[0], 0:L.shape[1]]
    A = np.stack([np.ones_like(L), xx / L.shape[1], yy / L.shape[0], (xx / L.shape[1]) ** 2, (yy / L.shape[0]) ** 2], -1).reshape(-1, 5)
    mask = (L > 40).reshape(-1)
    coef, *_ = np.linalg.lstsq(A[mask], np.log(L.reshape(-1)[mask] + 1), rcond=None)
    fit = np.exp(A @ coef).reshape(L.shape)
    flat = a / (fit / fit.mean())[..., None] ** 0.5
    img = Image.fromarray((flat * 0.95).clip(0, 255).astype(np.uint8)).resize((1080, 1460), Image.LANCZOS)
    save(img, "side_r.jpg", 86)
    save(img.transpose(Image.FLIP_LEFT_RIGHT), "side_l.jpg", 86)


# ── the back: Bosch's rear view (square on: 1154 px = 550 mm, 1984 rows = 960 mm); the cord and plug painted out ──
RPX_H = 1154 / W_MM
RPX_V = 1984 / H_MM
CORD = [(100, 160), (120, 196), (180, 202), (400, 200), (700, 200), (980, 202), (1030, 220), (1062, 300), (1068, 450),
        (1055, 650), (1010, 850), (930, 1080), (820, 1230), (660, 1300), (500, 1310), (380, 1250), (320, 1100), (312, 960),
        (312, 905)]
PLUG = (312, 848)
CORD_EXIT = (100, 150)


def rear():
    im = load("28143787_WOE90DV0IN_PGA3_def.webp")
    h, w = im.shape[:2]
    m = np.zeros((h, w), np.uint8)
    cv2.polylines(m, [np.array(CORD, np.int32)], False, 255, 22)
    cv2.ellipse(m, PLUG, (58, 70), 0, 0, 360, 255, -1)
    cv2.circle(m, CORD_EXIT, 24, 255, -1)
    L = im.mean(2)
    m = ((m > 0) & (L > 80)).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    outi = cv2.inpaint(im.clip(0, 255).astype(np.uint8), m, 7, cv2.INPAINT_TELEA)
    a = outi.astype(np.float32)
    a[a.min(2) > 225] = (22, 22, 24)
    img = Image.fromarray((a * 0.92).clip(0, 255).astype(np.uint8))
    save(img, "rear.jpg", 86)
    to_m = lambda p: [round((p[0] / RPX_H - W_MM / 2) / -1000, 4), round((H_MM - p[1] / RPX_V) / 1000, 4)]
    json.dump({"cord": [to_m(p) for p in [CORD_EXIT] + CORD], "plug": to_m(PLUG), "size": [w, h], "pxPerMmH": RPX_H, "pxPerMmV": RPX_V},
              open(os.path.join(D, "rear.json"), "w"), indent=1)
    print("wrote rear.json")


# ── the lid's glass: black print round a tinted window (PGA5 at 3.51 px/mm) ──
GL_W, GL_D, GP = 540.0, 338.0, 4.0
WIN = (53.0, 66.0, 487.0, 300.0, 22.0)       # x0, y0 from the glass's back edge, x1, y1, corner radius (PGA5, ESTIMATED)


def glass():
    w, h = round(GL_W * GP), round(GL_D * GP)
    s = 4
    m = np.zeros((h * s, w * s), np.uint8)
    x0, y0, x1, y1, r = [v * GP * s for v in WIN]
    r = int(r)
    cv2.rectangle(m, (int(x0 + r), int(y0)), (int(x1 - r), int(y1)), 255, -1)
    cv2.rectangle(m, (int(x0), int(y0 + r)), (int(x1), int(y1 - r)), 255, -1)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        cv2.circle(m, (int(cx), int(cy)), r, 255, -1, lineType=cv2.LINE_AA)
    win = ss(m, s)
    rgb = np.zeros((h, w, 3), np.float32) + (12, 12, 14)
    rgb = rgb * (1 - win[..., None]) + np.array((20, 22, 25), np.float32) * win[..., None]
    alpha = 1 - win * 0.3
    img = Image.fromarray(np.dstack([rgb.clip(0, 255), (alpha * 255)[..., None]]).astype(np.uint8), "RGBA")
    save(img, "glass.png")


# ── the BOSCH plate on the lid glass: a white strip with Bosch's mark and name (135 x 15.5 mm, PGA5) ──
def plate(logos):
    PP = 12
    w, h = round(135 * PP), round(15.5 * PP)
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = (238, 238, 240)
    rgba[..., 3] = 255
    lg = np.asarray(Image.open(os.path.join(logos, "bosch.png")).convert("RGBA")).astype(np.float32)[..., 3]
    ys, xs = np.where(lg > 10)
    lg = lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    lh = round(9.0 * PP)                     # the mark and name 9 mm tall, starting 9 mm from the plate's left (PGA5)
    lw = round(lg.shape[1] * lh / lg.shape[0])
    lg = cv2.resize(lg, (lw, lh), interpolation=cv2.INTER_AREA) / 255
    X, Y = round(9 * PP), (h - lh) // 2
    sub = rgba[Y:Y + lh, X:X + lw, :3].astype(np.float32)
    rgba[Y:Y + lh, X:X + lw, :3] = (sub * (1 - lg[..., None]) + np.array((40, 40, 44)) * lg[..., None]).astype(np.uint8)
    save(Image.fromarray(rgba, "RGBA"), "plate.png")
    return lw / PP


# ── the drum: Bosch's view into the drum (PGA6) as the pulsator's picture; the drum wall's holes ──
def drum():
    im = load("28143767_WOE90DV0IN_PGA6_def.webp")
    cx, cy, r = 1012, 1010, 540                       # the pulsator's rim in PGA6 (ESTIMATED from the photo)
    crop = im[cy - r:cy + r, cx - r:cx + r]
    img = Image.fromarray((crop * 0.92).clip(0, 255).astype(np.uint8)).resize((768, 768), Image.LANCZOS)
    save(img, "pulsator.jpg", 88)
    T = 512
    img = Image.new("RGB", (T, T), (176, 178, 182))
    d = ImageDraw.Draw(img)
    for j in range(10):
        for i in range(10):
            x = (i + 0.5 * (j % 2)) * T / 10 + T / 20
            y = j * T / 10 + T / 20
            for dx in (-T, 0, T):
                d.ellipse((x + dx - 5, y - 5, x + dx + 5, y + 5), fill=(118, 120, 126))
    save(img, "drum.jpg", 88)


def main():
    words = panel()
    side()
    rear()
    glass()
    pw = plate(LOGOS)
    drum()
    json.dump({"words": words, "plateLogoMm": pw}, open(os.path.join(D, "layout.json"), "w"), indent=1)


main()
