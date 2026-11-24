"""Textures for the Bosch WOE80AG0IN, Series 2 top-load washing machine, 8 kg, 700 rpm (bosch-woe80ag0in), and its Silver
twin WOE80AH0IN (same body, same panel; Bosch's own photos of each colour).

usage: python3 tex_bosch_woe80.py <photos dir> <logos dir> <out dir>
  photos: bosch_woe80/28054168_WOE80AG0IN_PGA6_def.webp   Bosch's view from above with the lid up, 2041 x 1952 (panel, drum)
          bosch_woe80/28054164_WOE80AG0IN_PGA2_def.webp   Bosch's side view, Dark Grey, 1059 x 1982
          bosch_woe80/28054165_WOE80AH0IN_PGA2_def.webp   the same side view, Silver
          bosch_woe80/28054162_WOE80AG0IN_PGA3_def.webp   Bosch's rear view, square on, Dark Grey, 1115 x 1975
          bosch_woe80/28054166_WOE80AH0IN_PGA3_def.webp   the same rear view, Silver
          bosch_woe80/manual_expertcare.png               the ExpertCare mark as printed in Bosch's top-loader manual
  logos:  bosch.png
  writes <out dir>/bosch_woe80/*.jpg|png and rear.json (the cord's path on the back, in metres)

The control panel is a black glass strip on the sloping front of the top (540 x 82 mm in plan, about 106 mm along its slope).
It is drawn again at 10 px per mm of its surface:
  - PGA6 is scaled to 10 px/mm across (the body is 1879 px = 540 mm) and stretched 1.19 x down the slope (the photo sees the
    sloping strip foreshortened: the P ring is 160 px wide and 134 px tall in it);
  - the glass and the frame round it are flat colours (the studio's reflection is left out);
  - every word and number is set again in Avenir Next, fitted to the ink box it has in the photo;
  - the key discs, rings, P, start/pause and power symbols, the red lamps and the red "50" are drawn as shapes;
  - the small tub and status icons are the photo's own ink, cleaned to hard edges;
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
SLUG = "bosch_woe80"
SRC = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FONT_C = "/System/Library/Fonts/Avenir Next Condensed.ttc"
W_MM, H_MM, D_MM = 540.0, 950.0, 565.0           # Bosch product page and spec sheet: 950 x 540 x 565 mm; Sangeetha agrees

P = 10.0
SY = 160 / 134                                    # the panel strip's slope: the P ring is 160 px wide, 134 px tall in PGA6

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


def word(canvas, s, box, colour, face=5, fams=(FONT, FONT_C)):
    """A word fitted to its ink box: Avenir Next or its Condensed cut, whichever shape fits the box best, scaled to the box's
    width and centred on it."""
    bw, bh = box[2] - box[0], box[3] - box[1]
    best = None
    for fam in fams:
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


def ss(m, s=4):
    return cv2.resize(m, (m.shape[1] // s, m.shape[0] // s), interpolation=cv2.INTER_AREA).astype(np.float32) / 255


GLASS_C, FRAME_C, KEY_C, WIN_C = (20, 20, 21), (50, 46, 45), (50, 50, 51), (2, 1, 1)
WHITE, SOFT, RING_C, RED, LINE_C = (236, 236, 238), (220, 220, 222), (156, 156, 158), (208, 8, 8), (150, 150, 152)

# every word on the panel: (text, its box in plan canvas px (10 px/mm across, PGA6 crop x 80..1959, y 1660..1945), face)
WORDS = [
    ("Water Level", (1877, 244, 2096, 272), 0), ("Wash Program", (2829, 242, 3090, 275), 0),
    ("High 09 - 10", (1795, 331, 2006, 363), 5), ("Medium 05 - 08", (1738, 388, 2006, 415), 5), ("Low 01 - 04", (1802, 445, 2006, 472), 5),
    ("Soak", (2605, 277, 2699, 304), 5), ("Wash", (2601, 330, 2703, 357), 5), ("Rinse", (2605, 388, 2709, 414), 5),
    ("Spin", (2605, 445, 2694, 475), 5), ("Lock", (2605, 501, 2695, 527), 5),
    ("01 Normal", (2829, 331, 3021, 359), 2), ("04 Quick", (3102, 330, 3266, 359), 2), ("07 Water Save", (3330, 331, 3587, 359), 2),
    ("10 Tub clean", (3626, 330, 3852, 359), 2), ("02 Eco wash", (2829, 388, 3053, 415), 2), ("05 Mix", (3102, 387, 3232, 415), 2),
    ("08 Spin", (3330, 387, 3473, 420), 2), ("03 Delicates", (2829, 444, 3053, 472), 2), ("06 Cottons", (3102, 445, 3301, 472), 2),
    ("09 Heavy", (3329, 445, 3500, 477), 2),
    ("Wash", (1797, 582, 1889, 610), 0), ("Cycle", (1797, 612, 1889, 641), 0), ("Water", (2072, 597, 2192, 626), 0),
    ("Delay", (2366, 596, 2479, 631), 0),
    ("Child Lock", (2199, 704, 2348, 727), 5),
    ("EcoSilence Drive", (4319, 377, 4804, 426), 7), ("8 kg", (4848, 380, 4985, 433), 7),
]
ICONS = [(2020, 332, 2092, 358), (2020, 389, 2092, 415), (2021, 446, 2092, 471),            # water-level tubs
         (2449, 276, 2521, 302), (2450, 319, 2521, 366), (2449, 388, 2521, 414), (2453, 436, 2517, 480), (2449, 503, 2522, 531)]
LINES = [(1743, 289, 2097, 292), (2828, 289, 3870, 292), (4823, 377, 4827, 426),           # header rules, the "|"
         (2131, 683, 2134, 716), (2131, 713, 2190, 716), (2357, 713, 2422, 716), (2419, 683, 2422, 716)]   # child-lock bracket
LAMPS = [(2563.5, 290.5), (2563.5, 345.5), (2563.5, 403), (2563.5, 459), (2563.5, 516)]
KEYS = [(1843, 612), (2132, 612), (2422, 613)]
RINGS = {"P": (2709, 611), "start": (2999, 611), "power": (3288, 611)}             # all 165 px across
DIGIT_SEGS = [(2203, 338, 2244, 350), (2203, 396, 2245, 407), (2203, 453, 2246, 464), (2183, 355, 2197, 390), (2251, 412, 2265, 447),
              (2311, 338, 2354, 350), (2312, 453, 2354, 464), (2292, 355, 2305, 390), (2360, 355, 2373, 390), (2292, 412, 2305, 447),
              (2360, 412, 2374, 447)]                                                  # "5" and "0", each bar as the photo has it


def Y(v):
    return v * SY


def sb(box):                                      # a plan box to the stretched canvas
    return (box[0], round(Y(box[1])), box[2], round(Y(box[3])))


def capsule(c, x0, y0, x1, y1, colour, s=4):
    w, h = x1 - x0, y1 - y0
    m = np.zeros((int((h + 4) * s), int((w + 4) * s)), np.uint8)
    r = min(w, h) / 2 * s
    p0, p1 = (2 * s + r, 2 * s + r), (2 * s + w * s - r, 2 * s + h * s - r)
    cv2.rectangle(m, (int(p0[0]), int(2 * s)), (int(p1[0]), int(2 * s + h * s)), 255, -1)
    cv2.rectangle(m, (int(2 * s), int(p0[1])), (int(2 * s + w * s), int(p1[1])), 255, -1)
    for cx, cy in ((p0[0], p0[1]), (p1[0], p0[1]), (p0[0], p1[1]), (p1[0], p1[1])):
        cv2.circle(m, (int(cx), int(cy)), int(r), 255, -1, lineType=cv2.LINE_AA)
    blend(c, ss(m, s), round(x0 - 2), round(y0 - 2), colour)


def panel():
    im = load("28054168_WOE80AG0IN_PGA6_def.webp")
    x0, x1, y0, y1 = 80, 1959, 1660, 1945
    k = 10 / ((x1 - x0) / W_MM)
    ph = cv2.resize(im[y0:y1, x0:x1], None, fx=k, fy=k * SY, interpolation=cv2.INTER_CUBIC)
    Hh, Ww = round(819 * SY), int(W_MM * P)
    c = np.zeros((Hh, Ww, 3), np.float32) + np.array(FRAME_C, np.float32)
    # the black glass, its corners slightly rounded
    s = 4
    gx0, gy0, gx1, gy1, gr = 405, Y(75), 5012, Y(775), 18
    m = np.zeros((Hh * 1, Ww * 1), np.uint8)
    cv2.rectangle(m, (gx0 + gr, int(gy0)), (gx1 - gr, int(gy1)), 255, -1)
    cv2.rectangle(m, (gx0, int(gy0 + gr)), (gx1, int(gy1 - gr)), 255, -1)
    for cx, cy in ((gx0 + gr, gy0 + gr), (gx1 - gr, gy0 + gr), (gx0 + gr, gy1 - gr), (gx1 - gr, gy1 - gr)):
        cv2.circle(m, (int(cx), int(cy)), gr, 255, -1, lineType=cv2.LINE_AA)
    a = m.astype(np.float32)[..., None] / 255
    c = c * (1 - a) + np.array(GLASS_C, np.float32) * a
    # key discs and the three rings (182 px across in the photo)
    for cx, cy in KEYS:
        r = 60
        m = np.zeros(((2 * r + 8) * s, (2 * r + 8) * s), np.uint8)
        cv2.circle(m, (m.shape[1] // 2, m.shape[0] // 2), r * s, 255, -1, lineType=cv2.LINE_AA)
        mm = ss(m, s)
        blend(c, mm, round(cx - mm.shape[1] / 2), round(Y(cy) - mm.shape[0] / 2), KEY_C)
    for cx, cy in RINGS.values():
        r = 82
        m = np.zeros(((2 * r + 16) * s, (2 * r + 16) * s), np.uint8)
        cv2.circle(m, (m.shape[1] // 2, m.shape[0] // 2), int((r - 3) * s), 255, int(5 * s), lineType=cv2.LINE_AA)
        mm = ss(m, s)
        blend(c, mm, round(cx - mm.shape[1] / 2), round(Y(cy) - mm.shape[0] / 2), RING_C)
    o = 100 * s
    # power: an open arc and a bar (its box 101 x 79 plan px -> about 101 across)
    cx, cy = RINGS["power"]
    m = np.zeros((200 * s, 200 * s), np.uint8)
    cv2.ellipse(m, (o, o + 5 * s), (36 * s, 36 * s), -90, 40, 320, 255, int(5.5 * s), lineType=cv2.LINE_AA)
    cv2.line(m, (o, o - 40 * s), (o, o + 1 * s), 255, int(5.5 * s), lineType=cv2.LINE_AA)
    blend(c, ss(m, s), round(cx - 100), round(Y(cy) - 100), RING_C)
    # start/pause: an outlined triangle and two bars (box 102 x 71 plan px)
    cx, cy = RINGS["start"]
    m = np.zeros((200 * s, 200 * s), np.uint8)
    tri = np.int32([(o - 44 * s, o - 30 * s), (o - 44 * s, o + 30 * s), (o - 6 * s, o)])
    cv2.polylines(m, [tri], True, 255, int(5.5 * s), lineType=cv2.LINE_AA)
    for bx in (o + 12 * s, o + 32 * s):
        cv2.line(m, (bx, o - 30 * s), (bx, o + 30 * s), 255, int(5.5 * s), lineType=cv2.LINE_AA)
    blend(c, ss(m, s), round(cx - 100), round(Y(cy) - 100), RING_C)
    # the display window and the red "50", each bar its own rounded capsule
    c[round(Y(314)):round(Y(487)), 2143:2410] = WIN_C
    for x0_, y0_, x1_, y1_ in DIGIT_SEGS:
        capsule(c, x0_, Y(y0_), x1_, Y(y1_), RED)
    # the red lamps
    for cx, cy in LAMPS:
        r = 16
        m = np.zeros(((2 * r + 4) * s, (2 * r + 4) * s), np.uint8)
        cv2.circle(m, (m.shape[1] // 2, m.shape[0] // 2), r * s, 255, -1, lineType=cv2.LINE_AA)
        mm = ss(m, s)
        blend(c, mm, round(cx - mm.shape[1] / 2), round(Y(cy) - mm.shape[0] / 2), RED)
    # icons: the photo's ink, cleaned
    for box in ICONS:
        a_, (X, Y0) = ink_of(ph, sb(box))
        blend(c, a_, X, Y0, SOFT)
    for x0_, y0_, x1_, y1_ in LINES:
        c[round(Y(y0_)):round(Y(y1_)), x0_:x1_] = LINE_C
    # words, and the P in its ring
    out = []
    for s_, box, face in WORDS:
        tb = sb(box)
        fam = word(c, s_, tb, WHITE if face in (0, 2) else SOFT, face=face, fams=(FONT,))
        out.append((s_, [int(v) for v in tb], fam))
    word(c, "P", sb((2681, 577, 2747, 646)), RING_C, face=7, fams=(FONT,))
    # ExpertCare: Bosch's art from the manual, the hands and the name each fitted to the photo's ink boxes
    man = 1 - np.asarray(Image.open(os.path.join(SRC, "manual_expertcare.png")).convert("L")).astype(np.float32) / 255
    for mk, box in ((man[0:250, 0:330], (437, 369, 552, 440)), (man[0:250, 380:1460], (569, 381, 911, 433))):
        bx0, by0, bx1, by1 = sb(box)
        ys, xs = np.where(mk > 0.4)
        mk = mk[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        mk = cv2.resize(mk, (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_AREA)
        blend(c, mk, bx0, by0, SOFT)
    img = Image.fromarray(c.clip(0, 255).astype(np.uint8))
    half = img.size[0] // 2
    save(img.crop((0, 0, half, img.size[1])), "face_l.jpg", 90)
    save(img.crop((half, 0, img.size[0], img.size[1])), "face_r.jpg", 90)
    return out


# ── the sides: Bosch's side photo PGA2 of each colour, the body between the plinth and the black top ──
def side(name, tag):
    im = load(name)
    a = im[432:1806, 2:1057].copy()
    L = a.mean(2)
    yy, xx = np.mgrid[0:L.shape[0], 0:L.shape[1]]
    A = np.stack([np.ones_like(L), xx / L.shape[1], yy / L.shape[0], (xx / L.shape[1]) ** 2, (yy / L.shape[0]) ** 2], -1).reshape(-1, 5)
    mask = (L > 40).reshape(-1)
    coef, *_ = np.linalg.lstsq(A[mask], np.log(L.reshape(-1)[mask] + 1), rcond=None)
    fit = np.exp(A @ coef).reshape(L.shape)
    flat = a / (fit / fit.mean())[..., None] ** 0.5
    img = Image.fromarray((flat * 0.97).clip(0, 255).astype(np.uint8)).resize((1056, 1376), Image.LANCZOS)
    save(img, f"side_r{tag}.jpg", 86)
    save(img.transpose(Image.FLIP_LEFT_RIGHT), f"side_l{tag}.jpg", 86)


# ── the back: Bosch's rear view (square on: 1115 px = 540 mm, 1975 rows = 950 mm); the cord and plug painted out ──
RPX_H = 1115 / W_MM
RPX_V = 1975 / H_MM
CORD = [(114, 226), (114, 300), (120, 390), (160, 450), (300, 484), (440, 464), (600, 370), (720, 290), (820, 236), (920, 224),
        (990, 250), (1030, 300), (1044, 400), (1030, 560), (990, 700), (900, 820), (780, 940), (700, 1040), (666, 1160), (650, 1300),
        (650, 1420)]                                  # the cord's centre line in PGA3, read off the photo's bright pixels
PLUG = (660, 1448)


def rear(name, tag):
    im = load(name)
    h, w = im.shape[:2]
    m = np.zeros((h, w), np.uint8)
    cv2.polylines(m, [np.array(CORD, np.int32)], False, 255, 44)
    cv2.ellipse(m, PLUG, (75, 85), 0, 0, 360, 255, -1)
    cv2.circle(m, CORD[0], 30, 255, -1)
    L = im.mean(2)
    loc = cv2.medianBlur(L.clip(0, 255).astype(np.uint8), 41).astype(np.float32)
    m = ((m > 0) & (L > loc + 30)).astype(np.uint8) * 255      # the cord's own bright pixels near its path
    m = cv2.dilate(m, np.ones((9, 9), np.uint8))
    outi = cv2.inpaint(im.clip(0, 255).astype(np.uint8), m, 7, cv2.INPAINT_TELEA)
    a = outi.astype(np.float32)
    a[a.min(2) > 225] = (22, 22, 24)
    img = Image.fromarray((a * 0.95).clip(0, 255).astype(np.uint8))
    save(img, f"rear{tag}.jpg", 86)
    if not tag:
        to_m = lambda p: [round((p[0] / RPX_H - W_MM / 2) / -1000, 4), round((H_MM - p[1] / RPX_V) / 1000, 4)]
        json.dump({"cord": [to_m(p) for p in CORD], "plug": to_m(PLUG), "size": [w, h], "pxPerMmH": RPX_H, "pxPerMmV": RPX_V},
                  open(os.path.join(D, "rear.json"), "w"), indent=1)
        print("wrote rear.json")


# ── the lid's glass: black glass round a tinted window (PGA5 at 3.46 px/mm) ──
GL_W, GL_D, GP = 534.0, 452.0, 4.0
WIN = (48.0, 64.0, 479.0, 417.0, 26.0)       # x0, y0 from the glass's back edge, x1, y1, corner radius (PGA5, ESTIMATED)


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
    rgb = rgb * (1 - win[..., None]) + np.array((22, 22, 24), np.float32) * win[..., None]
    alpha = 1 - win * 0.3
    img = Image.fromarray(np.dstack([rgb.clip(0, 255), (alpha * 255)[..., None]]).astype(np.uint8), "RGBA")
    save(img, "glass.png")


# ── the BOSCH plate on the lid glass: a white strip with Bosch's mark and name (134 x 15 mm, PGA5) ──
def plate(logos):
    PP = 12
    w, h = round(134 * PP), round(15 * PP)
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., :3] = (238, 238, 240)
    rgba[..., 3] = 255
    lg = np.asarray(Image.open(os.path.join(logos, "bosch.png")).convert("RGBA")).astype(np.float32)[..., 3]
    ys, xs = np.where(lg > 10)
    lg = lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    lh = round(9.0 * PP)                     # the mark and name 9 mm tall, starting 16 mm from the plate's left (PGA5)
    lw = round(lg.shape[1] * lh / lg.shape[0])
    lg = cv2.resize(lg, (lw, lh), interpolation=cv2.INTER_AREA) / 255
    X, Y0 = round(16 * PP), (h - lh) // 2
    sub = rgba[Y0:Y0 + lh, X:X + lw, :3].astype(np.float32)
    rgba[Y0:Y0 + lh, X:X + lw, :3] = (sub * (1 - lg[..., None]) + np.array((40, 40, 44)) * lg[..., None]).astype(np.uint8)
    save(Image.fromarray(rgba, "RGBA"), "plate.png")
    return lw / PP


# ── the drum: Bosch's view into the drum (PGA6) as the pulsator's picture; the drum wall's holes ──
def drum():
    im = load("28054168_WOE80AG0IN_PGA6_def.webp")
    cx, cy, r = 1020, 978, 500                        # the pulsator's rim in PGA6 (ESTIMATED from the photo)
    crop = im[cy - r:cy + r, cx - r:cx + r]
    img = Image.fromarray((crop * 0.95).clip(0, 255).astype(np.uint8)).resize((768, 768), Image.LANCZOS)
    save(img, "pulsator.jpg", 88)
    T = 512
    img = Image.new("RGB", (T, T), (74, 68, 67))
    d = ImageDraw.Draw(img)
    for j in range(10):
        for i in range(10):
            x = (i + 0.5 * (j % 2)) * T / 10 + T / 20
            y = j * T / 10 + T / 20
            for dx in (-T, 0, T):
                d.ellipse((x + dx - 5, y - 5, x + dx + 5, y + 5), fill=(34, 31, 31))
    save(img, "drum.jpg", 88)


def main():
    words = panel()
    side("28054164_WOE80AG0IN_PGA2_def.webp", "")
    side("28054165_WOE80AH0IN_PGA2_def.webp", "_s")
    rear("28054162_WOE80AG0IN_PGA3_def.webp", "")
    rear("28054166_WOE80AH0IN_PGA3_def.webp", "_s")
    glass()
    pw = plate(LOGOS)
    drum()
    json.dump({"words": words, "plateLogoMm": pw}, open(os.path.join(D, "layout.json"), "w"), indent=1)


main()
