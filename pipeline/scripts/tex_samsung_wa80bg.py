"""Textures for the Samsung WA80BG4441BDTL 8 kg top-load washing machine (Versailles Gray, and its Light Gray twin WA80BG4441BGTL).

usage: python3 tex_samsung_wa80bg.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>]
  photos:  samsung_wa80bg/ (Samsung India's own gallery for WA80BG4441BDTL and WA80BG4441BGTL, 1920 x 1280):
           panel.png        the control panel seen square-on (the Washing Cycles ring is a circle in it: 180 x 181 px)
           side.png         the right side of the Versailles Gray unit, front to the left; side_bg.png the same for Light Gray
           rear_bg.png      the back of the Light Gray unit (Samsung shows no back of the Versailles Gray one)
           drum_filter.jpg, pulsator.jpg, lid_open.jpg, lid_open_bg.jpg   the drum, the pulsator, the detergent box
  manual:  the third control-panel drawing on page 28 of Samsung's user manual DC68-04429A-13 (WA**BG4*******), the one
           with NORMAL ... ECO TUB CLEAN, rendered at 1600 dpi with
           pdftoppm -r 1600 -f 2 -l 2 -x 5653 -y 3450 -W 4042 -H 986 -gray   (kept in private/, not in git)
  logos:   samsung.png
  writes <out dir>/samsung_wa80bg/*  (the two BEE labels are cut by tex_bee_label.py, not here)

The control panel is drawn new: every word is set again in Avenir Next Condensed, fitted to the box the word has in Samsung's
photo, in the photo's own colour; every icon and the numbered badges are the manual's vector ink, scaled into the photo's own
icon boxes; the seven-segment display, the bars, the rules, the key frames and the ring are drawn as shapes. The face is the
whole slanted top of the control housing (524 mm across, 115 mm up the slope); the photo shows its middle 463 mm.
"""
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
args = list(sys.argv[1:])
DEBUG = None
if "--debug" in args:
    DEBUG = args[args.index("--debug") + 1]
    del args[args.index("--debug"):args.index("--debug") + 2]
    os.makedirs(DEBUG, exist_ok=True)
PHOTOS, MANUAL, LOGOS, OUT = args[:4]
P = os.path.join(PHOTOS, "samsung_wa80bg")
D = os.path.join(OUT, "samsung_wa80bg")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(8044)
FONT = "/System/Library/Fonts/Avenir Next Condensed.ttc"
FONT_W = "/System/Library/Fonts/Avenir Next.ttc"
MED, REG, DEMI = 5, 7, 2

# the two colours: Samsung's body colour names; RGB matched to Samsung's photos under the studio light (NOTES.md)
FINISHES = {
    "": {"body": (68, 68, 71), "tub": (20, 20, 22), "side": "side.png"},              # Versailles Gray (WA80BG4441BDTL)
    "_bg": {"body": (172, 173, 176), "tub": (178, 179, 183), "side": "side_bg.png"},  # Light Gray (WA80BG4441BGTL)
}


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def photo(name, bg=(0, 0, 0)):
    im = Image.open(os.path.join(P, name)).convert("RGBA")
    base = Image.new("RGBA", im.size, bg + (255,))
    base.alpha_composite(im)
    return np.asarray(base.convert("RGB")).astype(np.float32)


# ───────────────────────── control panel ─────────────────────────
# Photo rows 236 (the face's top edge) to 714 (the lid line) are the face's 115.3 mm: 4.146 photo px per mm, the same across
# (the ring is round in the photo). The face is 524 mm across, so it runs from photo x -124 to 2048 round the ring's centre (962).
S = 1.8                                   # texture px per photo px: 7.5 px/mm
PX0, PY0 = -124.0, 236.0
PW, PH = 2172, 478
pan = photo("panel.png")
lum = pan.mean(2)
redness = pan[..., 0] - pan[..., 1]
CW, CH = int(round(PW * S)), int(round(PH * S))
canvas = np.zeros((CH, CW, 3), np.float32)
canvas[...] = (13, 13, 15)
canvas += rng.normal(0, 0.6, (CH, CW, 1))


def T(x, y):
    return ((x - PX0) * S, (y - PY0) * S)


def ink_box(win, thr=None):
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
    return tuple(float(v) for v in sel.mean(0))


def put(alpha, colour, x0, y0):
    h, w = alpha.shape
    xs0, ys0 = max(0, x0), max(0, y0)
    xs1, ys1 = min(CW, x0 + w), min(CH, y0 + h)
    if xs1 <= xs0 or ys1 <= ys0:
        return
    a = alpha[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
    canvas[ys0:ys1, xs0:xs1] = canvas[ys0:ys1, xs0:xs1] * (1 - a) + np.array(colour, np.float32) * a


def render_runs(runs, px=160, track=0.0, font=FONT):
    W = int(px * (0.9 + track) * sum(len(t) * s for t, s, _, _ in runs) + px * 2)
    img = Image.new("L", (W, px * 3), 0)
    d = ImageDraw.Draw(img)
    x, base = px * 0.5, px * 2.0
    for text, s, up, face in runs:
        f = ImageFont.truetype(font, int(px * s), index=face)
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
    x0, y0, x1, y1 = box
    tw, th = int(round((x1 - x0) * S)), int(round((y1 - y0) * S))
    a = cv2.resize(alpha, (max(1, tw), max(1, th)), interpolation=cv2.INTER_AREA)
    tx, ty = T(x0, y0)
    return a, int(round(tx)), int(round(ty))


def word(runs, win, colour=None, thr=None, track=0.0, font=FONT):
    if isinstance(runs, str):
        runs = [(runs, 1.0, 0, MED)]
    box, _ = ink_box(win, thr)
    col = colour or ink_colour(win)
    a, tx, ty = fit(render_runs(runs, track=track, font=font), box)
    put(a, col, tx, ty)
    return box


def rect(box, colour, r=0):
    x0, y0, x1, y1 = box
    img = Image.new("L", (int((x1 - x0) * S) + 2, int((y1 - y0) * S) + 2), 0)
    ImageDraw.Draw(img).rounded_rectangle([0, 0, (x1 - x0) * S, (y1 - y0) * S], r * S, fill=255)
    tx, ty = T(x0, y0)
    put(np.asarray(img).astype(np.float32) / 255, colour, int(round(tx)), int(round(ty)))


def outline(box, colour, width, r):
    k = 4
    x0, y0, x1, y1 = box
    img = Image.new("L", (int((x1 - x0) * S * k) + 8, int((y1 - y0) * S * k) + 8), 0)
    ImageDraw.Draw(img).rounded_rectangle([4, 4, (x1 - x0) * S * k + 4, (y1 - y0) * S * k + 4], r * S * k, outline=255, width=int(round(width * S * k)))
    a = cv2.resize(np.asarray(img).astype(np.float32) / 255, (img.width // k, img.height // k), interpolation=cv2.INTER_AREA)
    tx, ty = T(x0, y0)
    put(a, colour, int(round(tx)) - 1, int(round(ty)) - 1)


def blobs(win, thr=40):
    """separate ink pieces (bars, rules) inside a window: [(x0, y0, x1, y1, colour)] in photo px, sub-pixel extents"""
    x0, y0, x1, y1 = win
    L = lum[y0:y1, x0:x1]
    R = redness[y0:y1, x0:x1]
    m = ((L > thr) | (R > 60)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    out = []
    for i in range(1, n):
        if st[i][4] < 4:
            continue
        sel = lab == i
        wgt = np.clip((L - thr * 0.5) / max(1, L[sel].max() - thr * 0.5), 0, 1) * sel
        cols, rows = wgt.sum(0), wgt.sum(1)
        cx = (cols * np.arange(len(cols))).sum() / cols.sum()
        cy = (rows * np.arange(len(rows))).sum() / rows.sum()
        ww = max(1.0, (cols > 0.25 * cols.max()).sum())
        hh = max(1.0, (rows > 0.25 * rows.max()).sum())
        px = pan[y0:y1, x0:x1][sel]
        col = px[px.mean(1) >= np.percentile(px.mean(1), 80)].mean(0)
        out.append((x0 + cx - ww / 2 + 0.5, y0 + cy - hh / 2 + 0.5, x0 + cx + ww / 2 + 0.5, y0 + cy + hh / 2 + 0.5, tuple(col)))
    return out


# the manual's drawing, its six grey callout discs (01 02 03 06 12 15) taken out, placed on the photo by the ring
man = np.asarray(Image.open(MANUAL).convert("L")).astype(np.float32)
_g = ((man > 150) & (man < 235)).astype(np.uint8)
_n, _lab, _st, _ = cv2.connectedComponentsWithStats(_g)
for _i in range(1, _n):
    _x, _y, _w, _h, _a = _st[_i]
    if 80 <= _w <= 110 and 80 <= _h <= 110:
        cv2.circle(man, (int(_x + _w / 2), int(_y + _h / 2)), int(max(_w, _h) / 2 + 5), 255, -1)
MK = 180.5 / 637.0                        # the ring: 637 manual px, 180.5 photo px
MC, PC = (2012.5, 498.5), (962.0, 477.5)


def to_manual(x, y):
    return (MC[0] + (x - PC[0]) / MK, MC[1] + (y - PC[1]) / MK)


def manual_ink(pwin, thr=140, pad=14):
    """the manual's ink under a photo window (mapped through the ring), cropped to the ink"""
    x0, y0 = to_manual(pwin[0], pwin[1])
    x1, y1 = to_manual(pwin[2], pwin[3])
    x0, y0, x1, y1 = int(x0) - pad, int(y0) - pad, int(x1) + pad, int(y1) + pad
    sub = man[y0:y1, x0:x1]
    a = np.clip((thr + 40 - sub) / 100, 0, 1)
    m = sub < thr
    # keep only the drawing's pieces that lie inside the window: a word or a rule cut by the window's edge is not this icon
    n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)))
    keep = np.zeros_like(m)
    for i in range(1, n):
        bx, by, bw, bh, _a = st[i]
        if bx > 0 and by > 0 and bx + bw < m.shape[1] and by + bh < m.shape[0]:
            keep |= lab == i
    if keep.any():
        m &= keep
        a = a * keep
    ys, xs = np.where(m)
    if not len(xs):
        raise SystemExit(f"no manual ink under {pwin}")
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def icon(pwin, colour=None, thr=None, mthr=140, mwin=None):
    box, _ = ink_box(pwin, thr)
    col = colour or ink_colour(pwin)
    a, tx, ty = fit(manual_ink(mwin or pwin, mthr), box)
    put(a, col, tx, ty)
    return box


def icon_from_photo(pwin, colour=None, thr=None):
    """thin marks the manual draws differently (the brackets under the keys): the photo's own ink, enlarged 8x, smoothed and
    re-thresholded into clean edges"""
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
    x0, y0, x1, y1 = box
    tx0, ty0 = T(x0, y0)
    w, h = (x1 - x0) * S, (y1 - y0) * S
    k = 8
    W, H = w * k, h * k
    Tk = w * 0.25 * k
    img = Image.new("L", (int(W) + 2, int(H) + 2), 0)
    imo = Image.new("L", img.size, 0)
    d, do = ImageDraw.Draw(img), ImageDraw.Draw(imo)

    def bar(p0, p1):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        dv = (p1 - p0) / np.linalg.norm(p1 - p0)
        n = np.array([-dv[1], dv[0]])
        c = Tk / 2
        return [tuple(p0), tuple(p0 + dv * c + n * c), tuple(p1 - dv * c + n * c), tuple(p1), tuple(p1 - dv * c - n * c), tuple(p0 + dv * c - n * c)]
    xl, xr, yt, ym, yb = Tk / 2, W - Tk / 2, Tk / 2, H / 2, H - Tk / 2
    g = Tk * 0.32
    segs = {"a": bar((xl + g, yt), (xr - g, yt)), "g": bar((xl + g, ym), (xr - g, ym)), "d": bar((xl + g, yb), (xr - g, yb)),
            "f": bar((xl, yt + g), (xl, ym - g * .6)), "e": bar((xl, ym + g * .6), (xl, yb - g)),
            "b": bar((xr, yt + g), (xr, ym - g * .6)), "c": bar((xr, ym + g * .6), (xr, yb - g))}
    for s, pts in segs.items():
        (d if s in lit else do).polygon(pts, fill=255)
    for im_, col in ((imo, off), (img, on)):
        a = cv2.resize(np.asarray(im_).astype(np.float32) / 255, (int(w) + 1, int(h) + 1), interpolation=cv2.INTER_AREA)
        put(a, col, int(round(tx0)), int(round(ty0)))


WHITE = (232, 232, 234)
RED = (232, 34, 40)


def build_panel():
    # ── left: the SAMSUNG wordmark and the BubbleStorm / Digital Inverter line ──
    lg = np.asarray(Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")).astype(np.float32)[..., 3] / 255
    ys, xs = np.where(lg > 0.02)
    lg = lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    box, _ = ink_box((120, 350, 345, 402))
    a, tx, ty = fit(lg, box)
    put(a, ink_colour((120, 350, 345, 402)), tx, ty)
    grey_txt = ink_colour((120, 574, 405, 606))
    word([("BubbleStorm", 1.0, 0, DEMI), ("™", 0.5, 0.42, DEMI)], (120, 574, 263, 606), grey_txt, font=FONT_W)
    word([("Digital", 1.0, 0, MED), ("Inverter", 1.0, 0, REG)], (263, 574, 405, 606), grey_txt, font=FONT_W)

    # ── Washing Cycles: the heading, its rules, the eight programmes (badge, icon, name) ──
    word([("Washing Cycles", 1.0, 0, REG)], (418, 340, 531, 366), thr=40, font=FONT_W)
    for b in blobs((532, 357, 890, 368), 40) + blobs((418, 588, 890, 600), 40):
        rect(b[:4], b[4])
    cols = [(420, 448, 488), (538, 566, 608), (656, 684, 726), (776, 803, 846)]
    for row, (by0, by1, iy0, iy1) in enumerate([(403, 431, 400, 431), (493, 523, 486, 523)]):
        for c, (bx0, ix0, ix1) in enumerate(cols):
            if row == 1 and c == 2:                                        # RINSE+SPIN has two icons: the basin and the spin
                icon((654, by0, 677, by1), WHITE)
                icon((677, iy0, 705, iy1), WHITE)
                icon((705, iy0, 737, iy1), WHITE)
                continue
            icon((bx0, by0, ix0 - 1, by1), WHITE)                          # the numbered badge
            icon((ix0, iy0, ix1, iy1), WHITE)
    names = [("NORMAL", (426, 431, 512, 458)), ("QUICK WASH", (532, 430, 642, 459)), ("DELICATES", (658, 430, 752, 458)),
             ("BEDDING", (778, 431, 868, 459)), ("JEANS", (432, 523, 502, 548)), ("ENERGY", (547, 523, 622, 546)),
             ("SAVING", (547, 545, 622, 568)), ("RINSE+", (670, 523, 740, 546)), ("SPIN", (678, 545, 728, 568)),
             ("ECO TUB", (786, 523, 862, 546)), ("CLEAN", (786, 545, 862, 568))]
    for txt, win in names:
        word([(txt, 1.0, 0, MED)], win, WHITE)

    # ── the Washing Cycles ring: power, the rule, start/pause ──
    cx, cy = 962.0, 477.5
    rl = lum[int(cy) - 2:int(cy) + 3, 860:1065].mean(0)
    edge = np.where(rl > 0.5 * rl.max())[0]
    r_out, r_in = (cx - 860 - edge.min()), (cx - 860 - edge.min()) - 3.4
    k = 6
    size = int(2 * (r_out + 2) * S * k)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    rr = np.hypot(xx - size / 2, yy - size / 2) / (S * k)
    ring = ((rr <= r_out) & (rr >= r_in)).astype(np.float32)
    ring = cv2.resize(ring, (size // k, size // k), interpolation=cv2.INTER_AREA)
    tx, ty = T(cx - size / (2 * S * k), cy - size / (2 * S * k))
    put(ring, ink_colour((860, 470, 880, 486)), int(round(tx)), int(round(ty)))
    print("ring radii", r_out, r_in)
    icon((934, 410, 990, 462), WHITE)                                      # power
    for b in blobs((920, 472, 1006, 484), 40):
        rect(b[:4], b[4])
    icon((934, 500, 990, 548), WHITE)                                      # start / pause

    # ── the display: its two boxes, the red 88, the four dim-red status icons ──
    rect((1068.3, 395.0, 1268.0, 487.3), (34, 34, 36), r=3)
    rect((1117.3, 401.7, 1219.0, 480.0), (52, 50, 50), r=2)
    on = ink_colour((1130, 410, 1206, 472))
    for x0 in (1130.0, 1172.0):                                            # the two digits, 34 x 62 photo px each
        seven_seg((x0, 410.0, x0 + 34.0, 472.0), "abcdefg", on, (70, 30, 30))
    dimred = ink_colour((1078, 408, 1106, 476))
    for win in ((1078, 408, 1106, 436), (1078, 450, 1106, 478), (1230, 408, 1260, 436), (1230, 449, 1258, 478)):
        icon(win, dimred, thr=50, mthr=100)

    # ── wash / rinse / spin: the counts, the red bars, the words ──
    for txt, win in (("5", (1316, 392, 1342, 420)), ("3", (1316, 429, 1342, 457)), ("4", (1345, 429, 1372, 457)),
                     ("1", (1316, 465, 1342, 494)), ("2", (1345, 465, 1372, 494))):
        word([(txt, 1.0, 0, DEMI)], win, WHITE)
    for win in ((1388, 392, 1405, 422), (1388, 429, 1405, 459), (1388, 465, 1405, 495)):
        for b in blobs(win, 40):
            rect(b[:4], RED, r=1.0)
    for txt, win in (("Wash", (1405, 392, 1462, 422)), ("Rinse", (1405, 429, 1462, 459)), ("Spin", (1405, 465, 1462, 496))):
        word([(txt, 1.0, 0, MED)], win, WHITE)

    # ── the keys: Washing Cycles, and Delay End / Water Level / Function in one frame, with the hold marks below ──
    word([("Washing", 1.0, 0, REG)], (1064, 520, 1122, 536), thr=40, track=0.18, font=FONT_W)
    word([("Cycles", 1.0, 0, MED)], (1064, 535, 1122, 558), thr=40)
    for win in ((1123, 508, 1214, 572), (1218, 508, 1474, 572)):
        box, _ = ink_box(win, 45)
        outline(box, ink_colour((win[0], 509, win[2], 514)), 1.7, 4)
    for b in blobs((1300, 520, 1310, 562), 40) + blobs((1382, 520, 1392, 562), 40):
        rect(b[:4], b[4])
    icon((1140, 516, 1196, 562), WHITE)                                    # the cycle key (four squares)
    icon_from_photo((1244, 515, 1282, 544), WHITE)                         # Delay End (in the manual it touches the frame)
    icon((1326, 515, 1364, 544), WHITE)                                    # Water Level
    icon((1408, 515, 1446, 544), WHITE, mwin=(1402, 511, 1452, 541))      # Function
    for txt, win in (("Delay End", (1232, 545, 1296, 568)), ("Water Level", (1310, 545, 1382, 568)), ("Function", (1398, 545, 1456, 568))):
        word([(txt, 1.0, 0, MED)], win, WHITE)
    grey_mark = ink_colour((1145, 572, 1420, 602))
    icon((1146, 572, 1184, 600), grey_mark, thr=40)                        # * tub clean
    # the two hold-together marks: the brackets and asterisks from the photo's ink, the lock and the sound-off icons the manual's
    for win in ((1268, 574, 1296, 592), (1314, 574, 1338, 592), (1350, 574, 1379, 592), (1397, 574, 1420, 592)):
        icon_from_photo(win, grey_mark)
    icon((1296, 574, 1314, 600), grey_mark, thr=40)                        # child lock
    icon((1379, 574, 1398, 600), grey_mark, thr=40)                        # sound off
    word([("*", 1.25, 0.12, MED), ("(3 sec)", 1.0, 0, REG)], (1442, 336, 1508, 364), thr=40)
    for b in blobs((1036, 357, 1508, 368), 40):
        rect(b[:4], b[4])

    # ── the capacity mark at the right: "8" (photo) and "kg" (cut off in this photo; Samsung's high 3/4 photo shows "8kg") ──
    box = word([("8", 1.0, 0, MED)], (1878, 628, 1906, 668), WHITE)
    h8 = box[3] - box[1]
    a = render_runs([("kg", 1.0, 0, MED)])
    kh = h8 * 0.62
    kw = kh * a.shape[1] / a.shape[0]
    a2, tx, ty = fit(a, (box[2] + 2.5, box[3] - kh, box[2] + 2.5 + kw, box[3]))
    put(a2, WHITE, tx, ty)

    img = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
    save(img, "panel.jpg", 88)
    if DEBUG:
        img.save(os.path.join(DEBUG, "panel_tex.png"))
        x0, x1 = int(round(-PX0 * S)), int(round((1920 - PX0) * S))
        ph = cv2.resize(pan[236:714], (x1 - x0, CH), interpolation=cv2.INTER_CUBIC)
        both = np.concatenate([np.asarray(img)[:, x0:x1].astype(np.float32), ph], 0)
        Image.fromarray(both.clip(0, 255).astype(np.uint8)).save(os.path.join(DEBUG, "panel_compare.png"))


# ───────────────────────── sides, back ─────────────────────────
CAB_TOP, PLINTH_TOP = 802.0, 80.0


def sides():
    """the relief of the right side (the two recessed panels and the handle pocket), flattened from each colour's side photo and
    cut to the cabinet (plinth top 80 mm to the cabinet top 802 mm, front face to back face), at half strength; left = mirror"""
    for suf, f in FINISHES.items():
        im = Image.open(os.path.join(P, f["side"])).convert("RGBA")
        al = np.asarray(im.getchannel("A")).astype(np.float32)
        sa = np.asarray(im.convert("L")).astype(np.float32)
        ys, xs = np.where(al > 128)
        y_bot, y_top, x0 = ys.max() + 1, ys.min(), xs.min()
        k = (y_bot - y_top) / 988.0
        row = int(y_bot - 500 * k)
        x_back = np.where(al[row] > 128)[0].max() + 1                       # the cabinet's back face at mid height
        r0, r1 = int(round(y_bot - CAB_TOP * k)), int(round(y_bot - PLINTH_TOP * k))
        c0, c1 = int(round(x0 + 1.5)), int(round(x_back - 1.5))
        blur = cv2.GaussianBlur(sa, (0, 0), 30)
        detail = sa / np.maximum(blur, 1) - 1.0
        crop = cv2.resize(detail[r0:r1, c0:c1], (576, 736), interpolation=cv2.INTER_AREA)
        crop = cv2.GaussianBlur(crop, (0, 0), 1.0)
        base = np.array(f["body"], np.float32)
        lumb = base.mean()
        v = (crop * lumb * 1.6).clip(-0.3 * lumb, 0.3 * lumb)
        img = (base[None, None, :] + v[..., None]).clip(0, 255).astype(np.uint8)
        save(Image.fromarray(img), f"side{suf}.jpg", 88)
        save(Image.fromarray(img[:, ::-1]), f"side_l{suf}.jpg", 88)


# the cord in Samsung's rear photo (rear_bg.png px): it leaves the housing, drops, makes one loop and ends in the plug holder
CORD = [(699, 186), (699, 300), (699, 400), (692, 432), (668, 458), (640, 480), (630, 520), (643, 567), (690, 593), (737, 580),
        (757, 547), (762, 515), (752, 485), (728, 463), (700, 456), (676, 462), (700, 456), (728, 463), (752, 485), (766, 515),
        (790, 524), (812, 530), (822, 560), (821, 600)]
PLUG = (797, 585, 845, 676)          # the plug body in its holder


def rear():
    """the back panel from Samsung's rear photo of the Light Gray twin (the Versailles Gray back is not shown by Samsung; the
    side flanges take each colour's body colour). Rows from 905 mm (where the control housing's back starts to slope) to the
    plinth top; the cord and plug are painted out, they are modelled in 3D. Written at 1.5 px/mm."""
    im = Image.open(os.path.join(P, "rear_bg.png")).convert("RGBA")
    al = np.asarray(im.getchannel("A")).astype(np.float32)
    ys, xs = np.where(al > 128)
    y_bot = ys.max() + 1
    ky = (y_bot - ys.min()) / 988.0
    row = int(y_bot - 500 * ky)
    xr = np.where(al[row] > 128)[0]
    xl0, xl1 = xr.min(), xr.max() + 1
    rgb = photo("rear_bg.png", (14, 14, 15))
    near = np.zeros(rgb.shape[:2], np.uint8)
    cv2.polylines(near, [np.array(CORD, np.int32)], False, 255, 24)
    cv2.rectangle(near, PLUG[:2], PLUG[2:], 255, -1)
    near = cv2.dilate(near, np.ones((31, 31), np.uint8))
    # the left flange (photo x 633 to 707) is the same all the way down: from row 300 to 650, where the cord and its loop and
    # their shadows cross it, every column takes its own median from the rows below the loop
    work = rgb.copy()
    for x in range(xl0, 708):
        work[300:650, x] = np.median(rgb[660:1100, x], axis=0)
    # elsewhere (the black parts) the light grey cord is found by its brightness near its traced route and filled in from around
    L = rgb.mean(2)
    mask = ((L > 62) & (near > 0)).astype(np.uint8) * 255
    mask[300:650, :708] = 0
    mask[:, :xl0] = 0
    mask[:300, :688] = 0                                                # above, only the cord's own band (x 688 to 713)
    mask[:300, 714:] = 0
    mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
    clean = cv2.inpaint(work.clip(0, 255).astype(np.uint8), mask, 8, cv2.INPAINT_TELEA).astype(np.float32)
    r0, r1 = int(round(y_bot - 905 * ky)), int(round(y_bot - PLINTH_TOP * ky))
    crop = clean[r0:r1, xl0:xl1]
    W, H = int(540 * 1.5), int((905 - PLINTH_TOP) * 1.5)
    crop = cv2.resize(crop, (W, H), interpolation=cv2.INTER_AREA)
    # the light grey flanges (low saturation, bright) take each colour's body colour, keeping their shading
    L = crop.mean(2)
    flange = (L > 105).astype(np.float32)
    flange = cv2.GaussianBlur(flange, (0, 0), 0.8)
    ref = np.median(L[L > 105])
    for suf, f in FINISHES.items():
        base = np.array(f["body"], np.float32)
        tint = base[None, None, :] * (L / ref)[..., None]
        out = crop * (1 - flange[..., None]) + tint * flange[..., None]
        out = out * 0.92                                                    # the viewer's light adds about a quarter
        save(Image.fromarray(out.clip(0, 255).astype(np.uint8)), f"rear{suf}.jpg", 86)


# ───────────────────────── inside ─────────────────────────
def drum():
    """the Diamond drum: a square grid of four-sided pyramids, a drain hole at every other valley corner (Samsung's drum photo);
    one tile is 8 x 8 pyramids, 24 mm each (ESTIMATED, as the 7 kg sibling's drum)"""
    N, pitch = 8, 64
    size = N * pitch
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    u = (xx % pitch) / pitch - 0.5
    v = (yy % pitch) / pitch - 0.5
    du, dv = np.abs(u), np.abs(v)
    shade = np.where(du > dv, np.where(u > 0, 0.66, 1.12), np.where(v > 0, 0.80, 1.0))
    edge = np.minimum(0.5 - du, 0.5 - dv)
    tex = 178 * shade * (0.84 + 0.36 * np.clip(edge * 2.4, 0, 1))
    tex += rng.normal(0, 1.2, tex.shape)
    img = np.stack([tex, tex, tex * 1.015], axis=2)
    holes = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(holes)
    for i in range(N + 1):
        for j in range(N + 1):
            if (i + j) % 2 == 0:
                x, y = i * pitch, j * pitch
                d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=255)
    ha = np.asarray(holes).astype(np.float32)[..., None] / 255
    img = img * (1 - ha) + np.array([28, 28, 30], np.float32) * ha
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "drum.jpg", 86)


def pulsator():
    """the PP Dual Wing pulsator seen from above (pulsator.jpg): pale grey plastic, six vanes (geometry) and between them six
    groups of small holes, each a fan widening outward"""
    N = 512
    img = Image.new("RGB", (N, N), (222, 223, 226))
    d = ImageDraw.Draw(img)
    c = N / 2
    for q in range(6):
        a0 = q * math.pi / 3
        for ring, count in ((0.58, 3), (0.67, 4), (0.76, 4), (0.85, 3)):
            for j in range(count):
                a = a0 + (j - (count - 1) / 2) * 0.09
                x, y = c + math.cos(a) * ring * c, c + math.sin(a) * ring * c
                d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(70, 71, 74))
    save(img, "pulsator.jpg", 86)


def filt():
    """the Magic Filter: a grey frame, "Magic Filter" moulded at its top, two columns of slots, a latch on top (drum_filter.jpg)"""
    w, h = 240, 640
    img = Image.new("RGB", (w, h), (156, 158, 162))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([14, 50, w - 14, h - 12], 16, fill=(146, 148, 153))
    d.text((w / 2, 104), "Magic Filter", font=ImageFont.truetype(FONT, 34, index=MED), fill=(118, 120, 125), anchor="mm")
    for colx in (40, 128):
        for i in range(20):
            y = 150 + i * 23
            d.rounded_rectangle([colx, y, colx + 72, y + 11], 3, fill=(92, 94, 99))
    d.rounded_rectangle([84, 6, 156, 46], 6, fill=(132, 134, 139))
    save(img, "filter.jpg", 88)


def detergent():
    """the detergent box's front: the pour mark, DETERGENT, and Ecobubble™ on a bar (lid_open.jpg / lid_open_bg.jpg):
    black on the Versailles Gray unit, light grey on the Light Gray one; 190 x 66 mm at 4 px/mm"""
    for suf, base, ink, bar, barink in (("", (18, 18, 20), (210, 210, 214), (196, 197, 201), (30, 30, 32)),
                                         ("_bg", (176, 177, 181), (78, 79, 84), (98, 99, 104), (232, 232, 236))):
        w, h = 760, 264
        img = Image.new("RGB", (w, h), base)
        d = ImageDraw.Draw(img)
        d.text((362, 104), "DETERGENT", font=ImageFont.truetype(FONT_W, 52, index=MED), fill=ink, anchor="lm")
        d.rectangle([362, 132, 600, 168], fill=bar)
        d.text((481, 150), "Ecobubble™", font=ImageFont.truetype(FONT_W, 26, index=DEMI), fill=barink, anchor="mm")
        # the mark: a cup tipped to pour, drops falling from it
        d.line([(262, 84), (300, 124), (342, 92)], fill=ink, width=4)
        d.line([(300, 124), (316, 140), (346, 116), (342, 92)], fill=ink, width=4)
        for (x, y) in ((276, 128), (268, 146), (280, 162), (300, 170)):
            d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=ink)
        save(img, f"detergent{suf}.jpg", 90)


build_panel()
sides()
rear()
drum()
pulsator()
filt()
detergent()
