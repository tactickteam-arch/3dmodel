"""Textures for the Samsung WA80F08S2CTL 8 kg top-load washing machine (Deep Charcoal).

usage: python3 tex_samsung_wa80.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>]
  photos:  samsung_wa80/ (Samsung India's own gallery for WA80F08S2CTL, 1920 x 1280):
           panel.png       the control panel seen from above, near its normal (the Washing Cycles ring is a circle in it: 192 x 187 px)
           label.png       Samsung's energy label for WA80F08S2CTL (0.0083 kWh/kg/cycle, 8.0 kg)
           side.png        the right side, front to the left (the relief of the side panels and the handle pocket)
           drum_filter.jpg, pulsator.jpg, lid_open.jpg, detergent_open.jpg   the drum, the pulsator, the detergent box
  manual:  the control-panel drawing of Samsung's user manual DC68-04429E-04 (WA80F08 / WA80F10 / WA40F08 / WA40F10),
           page 28, the second panel (the one with JEANS ... DOWNLOADED), rendered at 1600 dpi with
           pdftoppm -r 1600 -f 2 -l 2 -x 5600 -y 2400 -W 4200 -H 1150 -gray  (kept in .work/, not in git)
  logos:   samsung.png
  writes <out dir>/samsung_wa80/*

The control panel is drawn new at 2 texture px per photo px (7.6 px/mm): every word is set again in Avenir Next Condensed,
fitted to the box the word has in Samsung's photo, in the photo's own colour; the icons are the manual's vector ink, scaled into
the photo's icon boxes (the one icon the manual's drawing lacks, the shirt, is the photo's own ink, enlarged and re-thresholded);
the seven-segment display, the bars, the rules, the ring and the dots are drawn as shapes where the photo has them.
This model's panel is the manual's second drawing with the right-hand keys of the first one (Eco Bubble *Intensive Wash,
Super Speed *Power Tub Clean, Delay End, Smart Control), exactly as Samsung's photo of WA80F08S2CTL shows it.
"""
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
args = [a for a in sys.argv[1:]]
DEBUG = None
if "--debug" in args:
    DEBUG = args[args.index("--debug") + 1]
    del args[args.index("--debug"):args.index("--debug") + 2]
    os.makedirs(DEBUG, exist_ok=True)
PHOTOS, MANUAL, LOGOS, OUT = args[:4]
P = os.path.join(PHOTOS, "samsung_wa80")
D = os.path.join(OUT, "samsung_wa80")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(80)
FONT = "/System/Library/Fonts/Avenir Next Condensed.ttc"
MED, REG, DEMI = 5, 7, 2


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def photo(name, bg=(0, 0, 0)):
    im = Image.open(os.path.join(P, name)).convert("RGBA")
    base = Image.new("RGBA", im.size, bg + (255,))
    base.alpha_composite(im)
    return np.asarray(base.convert("RGB")).astype(np.float32)


# ───────────────────────── control panel ─────────────────────────
# The face in the model runs 0.1093 m up the slope from the lid to the top edge, 0.505 m across. Samsung's photo is 1920 px across
# that width (3.80 px/mm), so the face is 416 photo rows; they are taken centred on the printed area (rows 326 to 625).
S = 2
PX0, PY0, PW, PH = 0, 268, 1920, 416
pan = photo("panel.png")
lum = pan.mean(2)
redness = pan[..., 0] - pan[..., 1]
canvas = np.zeros((PH * S, PW * S, 3), np.float32)
canvas[...] = (12, 12, 14)
canvas += rng.normal(0, 0.6, (PH * S, PW * S, 1))


def T(x, y):
    """photo px -> texture px"""
    return ((x - PX0) * S, (y - PY0) * S)


def ink_box(win, thr=None):
    """bounding box of the ink (anything brighter than the panel, or red) inside a window of the photo"""
    x0, y0, x1, y1 = win
    L = lum[y0:y1, x0:x1]
    R = redness[y0:y1, x0:x1]
    t = thr if thr is not None else max(34.0, 0.35 * L.max())
    m = (L > t) | (R > 60)
    ys, xs = np.where(m)
    if not len(xs):
        raise SystemExit(f"no ink in {win}")
    return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1), m


def ink_colour(win):
    x0, y0, x1, y1 = win
    px = pan[y0:y1, x0:x1].reshape(-1, 3)
    L = px.mean(1)
    sel = px[L >= np.percentile(L, 97)]
    c = sel.mean(0)
    return tuple(float(v) for v in c)


def put(alpha, colour, x0, y0):
    """composite an alpha mask (0..1, texture px) at texture px (x0, y0) in a colour"""
    h, w = alpha.shape
    xs0, ys0 = max(0, x0), max(0, y0)
    xs1, ys1 = min(canvas.shape[1], x0 + w), min(canvas.shape[0], y0 + h)
    if xs1 <= xs0 or ys1 <= ys0:
        return
    a = alpha[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
    canvas[ys0:ys1, xs0:xs1] = canvas[ys0:ys1, xs0:xs1] * (1 - a) + np.array(colour, np.float32) * a


def render_runs(runs, px=160, track=0.0):
    """runs: [(text, scale, raise, face)] laid on one baseline, letters spread by `track` em; returns the alpha cropped to its ink"""
    W = int(px * (0.9 + track) * sum(len(t) * s for t, s, _, _ in runs) + px * 2)
    img = Image.new("L", (W, px * 3), 0)
    d = ImageDraw.Draw(img)
    x, base = px * 0.5, px * 2.0
    for text, s, up, face in runs:
        f = ImageFont.truetype(FONT, int(px * s), index=face)
        if track:
            for ch in text:
                d.text((x, base - up * px), ch, font=f, fill=255, anchor="ls")
                x += d.textlength(ch, font=f) + track * px * s
        else:
            d.text((x, base - up * px), text, font=f, fill=255, anchor="ls")
            x += d.textlength(text, font=f) + px * 0.04
    a = np.asarray(img).astype(np.float32) / 255
    ys, xs = np.where(a > 0.02)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def fit(alpha, box):
    """stretch an alpha image to exactly a photo box (x0, y0, x1, y1), returned in texture px with its top-left"""
    x0, y0, x1, y1 = box
    tw, th = int(round((x1 - x0) * S)), int(round((y1 - y0) * S))
    a = cv2.resize(alpha, (max(1, tw), max(1, th)), interpolation=cv2.INTER_AREA)
    tx, ty = T(x0, y0)
    return a, int(round(tx)), int(round(ty))


def word(runs, win, colour=None, thr=None, track=0.0):
    if isinstance(runs, str):
        runs = [(runs, 1.0, 0, MED)]
    box, _ = ink_box(win, thr)
    col = colour or ink_colour(win)
    a, tx, ty = fit(render_runs(runs, track=track), box)
    put(a, col, tx, ty)
    return box


def rect(box, colour, r=0):
    x0, y0, x1, y1 = box
    img = Image.new("L", (int((x1 - x0) * S) + 2, int((y1 - y0) * S) + 2), 0)
    ImageDraw.Draw(img).rounded_rectangle([0, 0, (x1 - x0) * S, (y1 - y0) * S], r * S, fill=255)
    tx, ty = T(x0, y0)
    put(np.asarray(img).astype(np.float32) / 255, colour, int(round(tx)), int(round(ty)))


def outline(box, colour, width, r):
    x0, y0, x1, y1 = box
    img = Image.new("L", (int((x1 - x0) * S) + 4, int((y1 - y0) * S) + 4), 0)
    ImageDraw.Draw(img).rounded_rectangle([1, 1, (x1 - x0) * S + 1, (y1 - y0) * S + 1], r * S, outline=255, width=int(round(width * S)))
    tx, ty = T(x0, y0)
    put(np.asarray(img).astype(np.float32) / 255, colour, int(round(tx)) - 1, int(round(ty)) - 1)


def dot(cx, cy, r, colour):
    k = 8
    size = int(2 * r * S * k) + 8
    img = Image.new("L", (size, size), 0)
    ImageDraw.Draw(img).ellipse([4, 4, size - 4, size - 4], fill=255)
    a = cv2.resize(np.asarray(img).astype(np.float32) / 255, (int(2 * r * S) + 1, int(2 * r * S) + 1), interpolation=cv2.INTER_AREA)
    tx, ty = T(cx - r, cy - r)
    put(a, colour, int(round(tx)), int(round(ty)))


def blobs(win, thr=40):
    """small separate ink pieces (dots, bars) inside a window: [(x0, y0, x1, y1, colour)] in photo px, sub-pixel boxes"""
    x0, y0, x1, y1 = win
    L = lum[y0:y1, x0:x1]
    R = redness[y0:y1, x0:x1]
    m = ((L > thr) | (R > 60)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    out = []
    for i in range(1, n):
        bx, by, bw, bh, ar = st[i]
        sel = lab == i
        # sub-pixel extent from the weighted ink, so anti-aliased edges keep their width
        wgt = np.clip((L - thr * 0.5) / max(1, L[sel].max() - thr * 0.5), 0, 1) * sel
        cols, rows = wgt.sum(0), wgt.sum(1)
        cx = (cols * np.arange(len(cols))).sum() / cols.sum()
        cy = (rows * np.arange(len(rows))).sum() / rows.sum()
        ww = max(1.0, (wgt.sum(0) > 0.25 * wgt.sum(0).max()).sum())
        hh = max(1.0, (wgt.sum(1) > 0.25 * wgt.sum(1).max()).sum())
        px = pan[y0:y1, x0:x1][sel]
        col = px[px.mean(1) >= np.percentile(px.mean(1), 80)].mean(0)
        out.append((x0 + cx - ww / 2 + 0.5, y0 + cy - hh / 2 + 0.5, x0 + cx + ww / 2 + 0.5, y0 + cy + hh / 2 + 0.5, tuple(col), ar))
    return out


man = np.asarray(Image.open(MANUAL).convert("L")).astype(np.float32)


def manual_ink(box, thr=160, pad=0):
    x0, y0, x1, y1 = box
    sub = man[y0 - pad:y1 + pad, x0 - pad:x1 + pad]
    a = np.clip((235 - sub) / (235 - 60), 0, 1)
    m = sub < thr
    ys, xs = np.where(m)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def icon_from_manual(mbox, pwin, colour=None, thr=None):
    box, _ = ink_box(pwin, thr)
    col = colour or ink_colour(pwin)
    a, tx, ty = fit(manual_ink(mbox), box)
    put(a, col, tx, ty)
    return box


def icon_from_photo(pwin, colour=None, thr=None):
    """for the one icon the manual lacks: the photo's own ink, enlarged 8x, smoothed and re-thresholded into clean edges"""
    box, _ = ink_box(pwin, thr)
    x0, y0, x1, y1 = box
    sub = lum[y0 - 1:y1 + 1, x0 - 1:x1 + 1]
    big = cv2.resize(sub, None, fx=8, fy=8, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), 3)
    t = 0.5 * (big.max() + 12)
    a = np.clip((big - t) / 6 + 0.5, 0, 1)
    a = cv2.resize(a, (int((x1 - x0 + 2) * S), int((y1 - y0 + 2) * S)), interpolation=cv2.INTER_AREA)
    col = colour or ink_colour(pwin)
    tx, ty = T(x0 - 1, y0 - 1)
    put(a, col, int(round(tx)), int(round(ty)))


def seven_seg(box, lit, on, off):
    """a seven-segment digit in a photo box, segments as polygons"""
    x0, y0, x1, y1 = [v * S for v in box]
    x0 -= PX0 * S; x1 -= PX0 * S; y0 -= PY0 * S; y1 -= PY0 * S
    w, h = x1 - x0, y1 - y0
    t = w * 0.16
    k = 8
    img = Image.new("L", (int(w * k) + 2, int(h * k) + 2), 0)
    imo = Image.new("L", img.size, 0)
    d, do = ImageDraw.Draw(img), ImageDraw.Draw(imo)
    W, H, Tk = w * k, h * k, t * k

    def bar(p0, p1):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        dv = (p1 - p0) / np.linalg.norm(p1 - p0)
        n = np.array([-dv[1], dv[0]])
        c = Tk / 2
        return [tuple(p0), tuple(p0 + dv * c + n * c), tuple(p1 - dv * c + n * c), tuple(p1), tuple(p1 - dv * c - n * c), tuple(p0 + dv * c - n * c)]
    xl, xr, yt, ym, yb = Tk / 2, W - Tk / 2, Tk / 2, H / 2, H - Tk / 2
    g = Tk * 0.7
    segs = {"a": bar((xl + g, yt), (xr - g, yt)), "g": bar((xl + g, ym), (xr - g, ym)), "d": bar((xl + g, yb), (xr - g, yb)),
            "f": bar((xl, yt + g), (xl, ym - g * .6)), "e": bar((xl, ym + g * .6), (xl, yb - g)),
            "b": bar((xr, yt + g), (xr, ym - g * .6)), "c": bar((xr, ym + g * .6), (xr, yb - g))}
    for s, pts in segs.items():
        (d if s in lit else do).polygon(pts, fill=255)
    for im_, col in ((imo, off), (img, on)):
        a = cv2.resize(np.asarray(im_).astype(np.float32) / 255, (int(w) + 1, int(h) + 1), interpolation=cv2.INTER_AREA)
        put(a, col, int(round(x0)), int(round(y0)))


WHITE = (228, 228, 230)
RED = (226, 40, 44)
GREY_BAR = (64, 64, 64)


def build_panel():
    # ── left: SAMSUNG wordmark, power, the Washing Cycles ring, start/pause, and their tactile dots ──
    lg = np.asarray(Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")).astype(np.float32)[..., 3] / 255
    ys, xs = np.where(lg > 0.02)
    lg = lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    box, _ = ink_box((130, 372, 292, 410))
    a, tx, ty = fit(lg, box)
    put(a, ink_colour((130, 372, 292, 410)), tx, ty)
    icon_from_manual((169, 497, 299, 621), (604, 450, 664, 502))                      # power
    icon_from_manual((1099, 499, 1222, 611), (912, 452, 968, 498))                     # start / pause
    for b in blobs((612, 512, 652, 545)) + blobs((922, 512, 958, 545)) + blobs((772, 512, 800, 530)) + blobs((1376, 590, 1396, 604)):
        x0, y0, x1, y1, col, _ = b
        dot((x0 + x1) / 2, (y0 + y1) / 2, 1.9, col)
    # the ring: a silver circle, brighter on its lower left as Samsung's photo shows
    cx, cy, r_out, r_in = 787.0, 473.5, 92.2, 89.3
    k = 6
    size = int(2 * r_out * S * k) + 16
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    rr = np.hypot(xx - size / 2, yy - size / 2) / (S * k)
    ring = ((rr <= r_out) & (rr >= r_in)).astype(np.float32)
    ring = cv2.resize(ring, (size // k, size // k), interpolation=cv2.INTER_AREA)
    ang = np.arctan2(*(np.mgrid[0:ring.shape[0], 0:ring.shape[1]] - ring.shape[0] / 2))
    shade = 150 + 40 * np.cos(ang + 2.4)
    tx, ty = T(cx - size / (2 * S * k), cy - size / (2 * S * k))
    for c in range(3):
        sub = canvas[int(ty):int(ty) + ring.shape[0], int(tx):int(tx) + ring.shape[1], c]
        sub[...] = sub * (1 - ring) + shade * ring
    # the two rules in the ring and its words
    for b in blobs((730, 440, 845, 450), 60) + blobs((730, 503, 845, 513), 60):
        rect(b[:4], ink_colour((730, 440, 845, 450)))
    word([("Washing", 1.0, 0, REG)], (740, 451, 836, 474), track=0.13)
    word([("Cycles", 1.0, 0, MED)], (738, 472, 838, 506), WHITE)

    # ── programmes, two columns of five, each with its bar (NORMAL lit red) ──
    progs = [("NORMAL", "AI WASH", "QUICK WASH", "DELICATES", "BEDDING"), ("JEANS", "ENERGY SAVING", "RINSE+SPIN", "TUB CLEAN", "DOWNLOADED")]
    rows = [(375, 402), (422, 449), (469, 496), (515, 543), (562, 589)]
    for ci, (bx0, tx0, tx1) in enumerate(((1022, 1038, 1160), (1160, 1178, 1312))):
        for ri, (y0, y1) in enumerate(rows):
            text = progs[ci][ri]
            runs = [(text.replace("+", " + "), 1.0, 0, MED)] if "+" in text else [(text, 1.0, 0, MED)]
            word(runs, (tx0, y0, tx1, y1), WHITE)
            for b in blobs((bx0, y0, tx0 - 1, y1), 30):
                rect(b[:4], RED if b[4][0] - b[4][1] > 60 else GREY_BAR)

    # ── display: Wi-Fi, three seven-segment digits with a colon, the three stage tags, the five status icons ──
    icon_from_manual((2315, 277, 2392, 337), (1314, 382, 1352, 408))
    rect((1362, 385.5, 1463.5, 433), (40, 40, 42), r=3)
    for (x0, x1) in ((1366.7, 1391.9), (1402.8, 1428.0), (1433.1, 1458.3)):
        seven_seg((x0, 388.0, x1, 431.0), "g", RED, (60, 60, 61))
    for y in (400.5, 418.5):
        dot(1396.8, y, 1.7, (64, 64, 65))
    # stage tags: the manual's grey tags (arrow, arrow, plain) filled red, their icons cut out dark
    for (mx0, mx1), pw in (((2310, 2425), (1316, 453, 1368, 476)), ((2460, 2580), (1366, 453, 1418, 476)), ((2615, 2730), (1416, 453, 1467, 476))):
        sub = man[485:565, mx0:mx1]
        fill = sub < 238
        ys, xs = np.where(fill)
        sub, fill = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1], fill[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        box, _ = ink_box(pw)
        tag = np.clip((240 - sub) / 30, 0, 1)
        icon = np.clip((150 - sub) / 60, 0, 1)
        a, tx, ty = fit(tag, box)
        put(a, RED, tx, ty)
        a, tx, ty = fit(icon, box)
        put(a, (30, 10, 10), tx, ty)
    icon_from_manual((2315, 588, 2386, 653), (1315, 484, 1346, 510))     # eco leaf
    icon_from_manual((2412, 579, 2480, 659), (1345, 481, 1375, 510))     # child lock
    icon_from_manual((2510, 583, 2580, 658), (1375, 483, 1406, 509))     # sound off
    icon_from_photo((1402, 483, 1434, 509))                              # shirt (not in the manual's drawing)
    icon_from_manual((2604, 585, 2683, 663), (1433, 483, 1466, 511))     # smart check

    # ── Monsoon: a rounded box with two bars, 15 min and 30 min, and the word ──
    box, _ = ink_box((1314, 518, 1468, 592), 40)
    outline(box, (88, 88, 89), 1.6, 4)
    for b in blobs((1336, 526, 1446, 536), 40):
        rect(b[:4], (82, 82, 83))
    for txt, win in (("15", (1336, 538, 1356, 556)), ("30", (1402, 538, 1423, 556))):
        word([(txt, 1.0, 0, MED)], win, WHITE)
    for win in ((1357, 538, 1380, 556), (1424, 538, 1449, 556)):
        word([("min", 1.0, 0, MED)], win, WHITE)
    word([("Monsoon", 1.0, 0, MED)], (1352, 556, 1432, 578), WHITE)

    # ── the four level scales: bars (lit ones red), the end values, the names and their units, the rules between ──
    for b in blobs((1476, 372, 1500, 530), 35) + blobs((1542, 372, 1566, 530), 35) + blobs((1608, 372, 1632, 530), 35) + blobs((1673, 372, 1698, 530), 35):
        x0, y0, x1, y1, col, ar = b
        if (x1 - x0) > 2.2 * (y1 - y0):
            rect((x0, y0, x1, y1), RED if col[0] - col[1] > 60 else GREY_BAR, r=0.6)
    dim = (118, 118, 119)
    for txt, win in (("9·10", (1501, 376, 1542, 398)), ("30", (1567, 376, 1593, 398)), ("5", (1631, 376, 1650, 398)),
                     ("1·2", (1501, 508, 1532, 530)), ("6", (1567, 508, 1582, 530)), ("1", (1631, 508, 1645, 530))):
        word([(txt.replace("·", " · "), 1.0, 0, MED)], win, dim)
    for txt, win in (("Extra", (1699, 372, 1732, 387)), ("High", (1699, 387, 1732, 403)), ("Extra", (1699, 504, 1732, 518)), ("Low", (1699, 518, 1732, 532))):
        word([(txt, 1.0, 0, REG)], win, (98, 98, 99), thr=40)
    for txt, win, col in (("Water", (1464, 545, 1520, 564), WHITE), ("Level", (1464, 564, 1520, 584), WHITE), ("Wash", (1530, 550, 1585, 571), WHITE),
                          ("Rinse", (1596, 550, 1652, 571), WHITE), ("Spin", (1666, 550, 1714, 571), WHITE)):
        word([(txt, 1.0, 0, MED)], win, col)
    for txt, win in (("min", (1540, 570, 1578, 584)), ("times", (1601, 570, 1647, 584)), ("speed", (1667, 570, 1714, 586))):
        word([(txt, 1.0, 0, REG)], win, (74, 74, 75), thr=38)
    for b in blobs((1518, 545, 1532, 585), 38) + blobs((1584, 545, 1598, 585), 38) + blobs((1649, 545, 1663, 585), 38):
        rect(b[:4], (70, 70, 71))
    # combination keys: the manual's row of brackets with the lock, smart-check and sound-off marks, and the dots above them
    a = manual_ink((2780, 900, 3395, 985))
    box, _ = ink_box((1484, 601, 1696, 630), 50)
    a, tx, ty = fit(a, box)
    put(a, ink_colour((1484, 601, 1696, 630)), tx, ty)
    for b in blobs((1480, 592, 1700, 601), 60):
        x0, y0, x1, y1, col, _ = b
        dot((x0 + x1) / 2, (y0 + y1) / 2, 1.6, col)

    # ── right: "*(3 sec)", the four keys with their bars, the hold-for-3-seconds lines, and the rules ──
    word([("*", 1.25, 0.12, MED), ("(3 sec)", 1.0, 0, REG)], (1800, 322, 1866, 346))
    keys = [("Eco Bubble", (1751, 374, 1846, 396)), ("Super Speed", (1751, 437, 1856, 457)), ("Delay End", (1751, 507, 1840, 534)), ("Smart Control", (1751, 571, 1862, 596))]
    for txt, win in keys:
        word([(txt, 1.0, 0, MED)], win, WHITE)
    for txt, win in (("Intensive Wash", (1751, 395, 1850, 413)), ("Power Tub Clean", (1751, 458, 1856, 477))):
        word([("*", 1.0, 0.14, MED), (" " + txt, 1.0, 0, DEMI)], win, WHITE)
    for win in ((1733, 380, 1752, 406), (1733, 444, 1752, 470), (1733, 507, 1752, 533), (1733, 571, 1752, 597)):
        for b in blobs(win, 30):
            rect(b[:4], RED if b[4][0] - b[4][1] > 60 else GREY_BAR)
    for win in ((1730, 419, 1870, 429), (1730, 484, 1870, 492), (1730, 547, 1870, 555)):
        for b in blobs(win, 40):
            rect(b[:4], (70, 70, 71))

    img = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
    save(img, "panel.jpg", 90)
    if DEBUG:
        img.save(os.path.join(DEBUG, "panel_tex.png"))
        crop = pan[PY0:PY0 + PH, PX0:PX0 + PW]
        Image.fromarray(cv2.resize(crop, (PW * S, PH * S), interpolation=cv2.INTER_CUBIC).clip(0, 255).astype(np.uint8)).save(os.path.join(DEBUG, "panel_photo2x.png"))


# ───────────────────────── everything else ─────────────────────────
def label():
    """Samsung's energy label for WA80F08S2CTL, cut out by its alpha, at 600 px wide"""
    im = Image.open(os.path.join(P, "label.png")).convert("RGBA")
    a = np.asarray(im.getchannel("A"))
    ys, xs = np.where(a > 10)
    lab = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    # 256 colours (a printed label has few), kept RGBA: a third of the size, which the Apple file's budget needs
    save(lab.quantize(256, method=Image.Quantize.FASTOCTREE).convert("RGBA"), "label.png")


def side():
    """the relief of the right side (two recessed panels and the handle pocket), flattened from Samsung's side photo and cut to
    the cabinet only (from the plinth top at 99 mm to the cabinet top at 805 mm, from the front to the back); left = mirror"""
    im = Image.open(os.path.join(P, "side.png")).convert("RGBA")
    al = np.asarray(im.getchannel("A")).astype(np.float32)
    sa = np.asarray(im.convert("L")).astype(np.float32)
    ys, xs = np.where(al > 128)
    y_bot, y_top, x0 = ys.max() + 1, ys.min(), xs.min()
    k = (y_bot - y_top) / 988.0                       # photo px per mm, heights
    x_back = x0 + 530.7 * k                           # the cabinet's back face in the photo
    r0, r1 = int(round(y_bot - 805 * k)), int(round(y_bot - 99.4 * k))
    c0, c1 = int(round(x0 + 1.5)), int(round(x_back - 1.5))
    blur = cv2.GaussianBlur(sa, (0, 0), 30)
    detail = sa / np.maximum(blur, 1) - 1.0
    crop = cv2.resize(detail[r0:r1, c0:c1], (576, 712), interpolation=cv2.INTER_AREA)
    crop = cv2.GaussianBlur(crop, (0, 0), 1.0)
    base = np.array(BODY_RGB, np.float32)
    v = (crop * 120).clip(-22, 22)                    # the photo's own shading, at about half strength: the light of the 3D view adds the rest
    img = (base[None, None, :] + v[..., None]).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(img), "side.jpg", 88)
    save(Image.fromarray(img[:, ::-1]), "side_l.jpg", 88)


BODY_RGB = (50, 50, 53)          # Deep Charcoal, matched to Samsung's photos under the studio light (see NOTES.md)


def drum():
    """the "2nd Diamond" drum: bands of diamond pyramids between wavy lines of drain holes, as Samsung's drum photos show.
    One tile is 4 bands (199 mm) across and one wave (200 mm) high; the builder repeats it 6 times round the drum."""
    N = 512
    band = N / 4
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    amp = band * 0.22
    wave = amp * np.sin(2 * np.pi * yy / N)
    u = (xx - wave) / band                              # band coordinate, follows the wave
    fu = u - np.floor(u)
    # two pyramids across each band, pitch half a band down it
    pu = (fu * 2) % 1.0 - 0.5
    pv = ((yy / (band / 2)) + np.floor(u) * 0.5) % 1.0 - 0.5
    du, dv = np.abs(pu), np.abs(pv)
    shade = np.where(du > dv, np.where(pu > 0, 0.70, 1.10), np.where(pv > 0, 0.84, 1.00))
    edge = np.minimum(0.5 - du, 0.5 - dv)
    tex = 176 * shade * (0.86 + 0.32 * np.clip(edge * 2.4, 0, 1))
    # the flat strip carrying the holes between bands
    strip = np.minimum(fu, 1 - fu) < 0.075
    tex = np.where(strip, 188, tex)
    tex += rng.normal(0, 1.2, tex.shape)
    img = np.stack([tex, tex, tex * 1.015], axis=2)
    # drain holes along each band edge, 7.5 mm apart
    holes = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(holes)
    step = N / 27
    for b in range(5):
        for i in range(-1, 28):
            y = i * step
            x = b * band + amp * math.sin(2 * math.pi * y / N)
            for dx in (-N, 0, N):
                d.ellipse([x + dx - 3.0, y - 3.0, x + dx + 3.0, y + 3.0], fill=255)
    ha = np.asarray(holes).astype(np.float32)[..., None] / 255
    img = img * (1 - ha) + np.array([34, 34, 36], np.float32) * ha
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "drum.jpg", 86)


def pulsator():
    """the PP Dual Storm pulsator seen from above (Samsung's photo pulsator.jpg): white plastic, six vanes (geometry, at 12, 2, 4 ...
    o'clock) and between them six groups of small holes at 1, 3, 5 ... o'clock, each a fan of 3-4-5-4 holes widening outward"""
    N = 512
    img = Image.new("RGB", (N, N), (226, 227, 229))
    d = ImageDraw.Draw(img)
    c = N / 2
    for q in range(6):
        a0 = q * math.pi / 3
        for ring, count in ((0.60, 3), (0.69, 4), (0.78, 5), (0.87, 4)):
            for j in range(count):
                a = a0 + (j - (count - 1) / 2) * 0.085
                x, y = c + math.cos(a) * ring * c, c + math.sin(a) * ring * c
                d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(60, 61, 64))
    save(img, "pulsator.jpg", 86)


def filt():
    """the Magic Filter: a grey frame round a honeycomb mesh, "MagicFilter" printed up its side, a latch at the top"""
    w, h = 240, 640
    img = Image.new("RGB", (w, h), (150, 152, 156))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([18, 60, w - 18, h - 18], 14, fill=(132, 134, 139))
    r = 17
    for row in range(17):
        for col in range(5):
            x = 44 + col * 38 + (19 if row % 2 else 0)
            y = 96 + row * 31
            if x > w - 34 or y > h - 40:
                continue
            pts = [(x + r * math.cos(math.radians(60 * i + 30)), y + r * math.sin(math.radians(60 * i + 30))) for i in range(6)]
            d.polygon(pts, fill=(92, 94, 99), outline=(166, 168, 172))
    d.rounded_rectangle([86, 8, 154, 56], 8, fill=(122, 124, 129))
    txt = Image.new("L", (400, 60), 0)
    ImageDraw.Draw(txt).text((200, 30), "MagicFilter", font=ImageFont.truetype(FONT, 34, index=MED), fill=255, anchor="mm")
    txt = txt.rotate(90, expand=True)
    tx = Image.new("RGB", txt.size, (70, 72, 76))
    img.paste(tx, (w - 52, 200), txt)
    save(img, "filter.jpg", 88)


def detergent():
    """the detergent box's front: glossy black, the pour-cup mark, DETERGENT, and Bubble Storm on a light grey bar, as in
    Samsung's photo of the open lid (lid_open.jpg); 180 x 66 mm at 4 px/mm"""
    w, h = 720, 264
    img = Image.new("RGB", (w, h), (16, 16, 18))
    d = ImageDraw.Draw(img)
    d.text((372, 108), "DETERGENT", font=ImageFont.truetype(FONT, 60, index=REG), fill=(206, 206, 210), anchor="lm")
    d.rectangle([372, 140, 590, 182], fill=(190, 191, 195))
    d.text((481, 162), "Bubble Storm", font=ImageFont.truetype(FONT, 34, index=DEMI), fill=(26, 26, 28), anchor="mm")
    # the mark: a cup tipped to pour, and four drops below it
    d.line([(262, 92), (300, 132), (346, 98)], fill=(200, 200, 204), width=4)
    d.line([(300, 132), (318, 150), (350, 128), (346, 98)], fill=(200, 200, 204), width=4)
    d.line([(318, 150), (300, 132)], fill=(200, 200, 204), width=4)
    for (x, y) in ((268, 130), (262, 150), (272, 168), (292, 176)):
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(200, 200, 204))
    save(img, "detergent.jpg", 90)


build_panel()
label()
side()
drum()
pulsator()
filt()
detergent()
