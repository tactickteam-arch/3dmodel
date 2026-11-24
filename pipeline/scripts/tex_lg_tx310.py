"""Textures for the LG TX310NWO 10 kg top-load washer (Onyx Black), from LG's own photos and owner's manual.

usage: python3 tex_lg_tx310.py <photos dir> <logos dir> <out dir> [--compare <dir>]
  photos: lg_tx310/  gal1.jpg (front, from above), gal2.jpg (this model's BEE label, named TX310NWO), gal4.jpg (lid up,
          detergent drawer out), DZ-3.jpg (straight down, lid shut), DZ-4.jpg (straight down, lid up), DZ-5.jpg (the drum,
          straight down), DZ-13.jpg / DZ-14.jpg (left / right side), DZ-15.jpg (back),
          manual_p23_panel.png (the control-panel drawing on page 23 of LG's owner's manual MFL72021945, which covers
          TX*11NW* / TX*10NW* / TX*09NW*; rendered at 1000 dpi and cut to 1 bit)
  writes <out dir>/lg_tx310/

The control panel (the console's sloped face, 565 mm across and 145.9 mm up its 30.6 degree slope) is drawn again at 12 px/mm
from the manual's vector drawing: the drawing's ink is warped onto the panel with an affine fitted to 9 anchor points (ink
centres in the manual against the same marks in DZ-3, the straight-down photo, read in panel millimetres; residual 0.8 mm
at most). DZ-3 is a top view of the slope: its panel spans x = (X - xl) / (xr - xl) * 565 mm with xl = 529 + (Y - 310) * 23/180
and xr = 1480 - (Y - 310) * 24/180 (the panel's side edges), and s = (505 - Y) / 215.5 * 145.9 mm up the slope.
What the manual draws but the panel does not print (DZ-3 and gal9 show this): the frame, the leader lines and their dots, the
dashed boxes, the dial's circle, the display's icons above the digits (unlit LEDs, not printed) and the LED dots before Strong
Wave and Delay End. The digits are the display's own: DZ-3 shows "39" lit, drawn as seven-segment bars in the manual's digit
places. What the panel prints but the manual leaves out (placed from their ink boxes in DZ-3): LG's mark (filled disc, face
cut out, as DZ-3 shows it), "10.0kg", "ThinQ" and the Inverter Direct Drive / 10 year mark; and a third bar, between Wash
and Rinse (the manual draws two, the panel has three). The four LED columns light as DZ-3 shows them.
Colours sampled on DZ-3: words 205, the small grey words and the dim icons 96-110, the lit digits (233, 244, 255).

The energy label is redrawn at 12 px/mm from gal2, where LG shows this model's own label large (552 px wide): shapes as
shapes, words in Arial fitted to their ink boxes, only the BEE emblem kept as the photo.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = sys.argv[5] if len(sys.argv) > 5 and sys.argv[4] == "--compare" else None
SRC = os.path.join(PHOTOS, "lg_tx310")
DEST = os.path.join(OUT, "lg_tx310")
os.makedirs(DEST, exist_ok=True)
if COMPARE:
    os.makedirs(COMPARE, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
COND = "/System/Library/Fonts/Avenir Next Condensed.ttc"
SUP = "/System/Library/Fonts/Supplemental/"
ARIAL_B, ARIAL_BLK, ARIAL_N, ARIAL_NB, ARIAL = SUP + "Arial Bold.ttf", SUP + "Arial Black.ttf", SUP + "Arial Narrow.ttf", SUP + "Arial Narrow Bold.ttf", SUP + "Arial.ttf"

PANEL_W, PANEL_S = 565.0, 145.9          # mm: across, and up the slope
HI = 12.0                                 # px per mm for the print
GROUND = (15, 15, 18)                     # the panel's black glass (DZ-3 median 15-17)
WHITE, GREY_SUB, GREY_ICON, LIT, DIGIT = (205, 207, 211), (96, 97, 100), (110, 111, 114), (236, 238, 242), (226, 238, 255)
# manual px (the 1000 dpi crop) -> (x mm from the panel's left edge, s mm up the slope)
AFF = np.array([[0.075328, -0.001613, 160.193774], [0.00023, -0.074493, 113.427687]])


def load(name):
    return Image.open(os.path.join(SRC, name)).convert("RGB")


def save(img, name, q=90):
    p = os.path.join(DEST, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def ink_box(V, win, dark=False, k=8, thr=None):
    """Sub-pixel ink box inside a photo window (half way from the border's median to the strongest ink)."""
    x0, y0, x1, y1 = win
    sub = V[y0:y1, x0:x1]
    up = cv2.resize(sub, ((x1 - x0) * k, (y1 - y0) * k), interpolation=cv2.INTER_CUBIC)
    border = np.concatenate([sub[0], sub[-1], sub[:, 0], sub[:, -1]])
    bg = np.median(border)
    if thr is not None:
        m = up < thr if dark else up > thr
    elif dark:
        m = up < bg - 0.5 * (bg - up.min())
    else:
        m = up > bg + 0.5 * (up.max() - bg)
    ys, xs = np.where(m)
    return (x0 + xs.min() / k, y0 + ys.min() / k, x0 + (xs.max() + 1) / k, y0 + (ys.max() + 1) / k)


def text_layer(text, font, index=0):
    f = ImageFont.truetype(font, 200, index=index)
    bb = f.getbbox(text)
    im = Image.new("L", (bb[2] - bb[0] + 40, bb[3] - bb[1] + 40), 0)
    ImageDraw.Draw(im).text((20 - bb[0], 20 - bb[1]), text, font=f, fill=255)
    a = np.asarray(im)
    ys, xs = np.where(a > 0)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def set_text(canvas, text, font, box, colour, index=0):
    """Paint `text` stretched exactly over the canvas box (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    w, h = max(1, round(x1 - x0)), max(1, round(y1 - y0))
    lay = text_layer(text, font, index).resize((w, h), Image.LANCZOS)
    canvas.paste(Image.new("RGB", lay.size, colour), (round(x0), round(y0)), lay)


def seven(box, digit):
    """Polygons of the lit bars of one seven-segment digit (hexagonal bars, bar 0.21 of the width)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    t = w * 0.21
    g = t * 0.62
    xl, xr, yt, ym, yb = t / 2, w - t / 2, t / 2, h / 2, h - t / 2

    def bar(p0, p1):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        d = (p1 - p0) / np.linalg.norm(p1 - p0)
        n = np.array([-d[1], d[0]])
        c = t / 2
        pts = [p0, p0 + d * c + n * c, p1 - d * c + n * c, p1, p1 - d * c - n * c, p0 + d * c - n * c]
        return [(x0 + px, y0 + py) for px, py in pts]
    segs = {"a": bar((xl + g, yt), (xr - g, yt)), "g": bar((xl + g, ym), (xr - g, ym)), "d": bar((xl + g, yb), (xr - g, yb)),
            "f": bar((xl, yt + g), (xl, ym - g * 0.5)), "e": bar((xl, ym + g * 0.5), (xl, yb - g)),
            "b": bar((xr, yt + g), (xr, ym - g * 0.5)), "c": bar((xr, ym + g * 0.5), (xr, yb - g))}
    on = {"3": "abgcd", "9": "abcdfg"}[digit]
    return [segs[k] for k in on]


# ── DZ-3 (straight down on the panel) -> panel millimetres ──
def dz2mm(X, Y):
    xl, xr = 529 + (Y - 310) * 23 / 180, 1480 - (Y - 310) * 24 / 180
    return (X - xl) / (xr - xl) * PANEL_W, (505 - Y) / 215.5 * PANEL_S


def panel():
    man = np.asarray(Image.open(os.path.join(SRC, "manual_p23_panel.png")).convert("L"))
    ink = (man < 128).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    keep = np.ones(n, bool)
    keep[0] = False
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if w > 150 or h > 150:
            power = 340 < x < 370 and 460 < y < 490
            separator = 4490 < x < 4530 and h <= 8
            if not (power or separator):
                keep[i] = False                       # frame, leader lines with their dots, the dial's circles, the digit frame
        elif area <= 200 and min(w, h) <= 6 and 9 <= max(w, h) <= 23 and not (4560 < x < 4740 and 940 < y < 1010):
            keep[i] = False                           # the dashes of the dashed boxes (not the hyphen in Wi-Fi)
        elif 4460 < x < 4480 and (250 < y < 290 or 675 < y < 705):
            keep[i] = False                           # the LED dots before Strong Wave and Delay End (unlit in DZ-3)
    # the dashed boxes' corners (small L shapes): any small piece on a line the removed dashes run along
    dashes = [st[i] for i in range(1, n) if not keep[i] and st[i][4] <= 200]
    lines = []
    for vert in (True, False):
        pos = [(d[0] + d[2] / 2) if vert else (d[1] + d[3] / 2) for d in dashes if (d[3] > d[2]) == vert]
        along = [(d[1] + d[3] / 2) if vert else (d[0] + d[2] / 2) for d in dashes if (d[3] > d[2]) == vert]
        for c in set(round(p_ / 10) for p_ in pos):
            sel = [a_ for p_, a_ in zip(pos, along) if abs(p_ / 10 - c) <= 1]
            if len(sel) >= 3:
                lines.append((vert, c * 10, min(sel) - 40, max(sel) + 40))
    corners = [(cx_, cy_) for v1, cx_, a0, a1 in lines if v1 for v2, cy_, b0, b1 in lines if not v2 and a0 <= cy_ <= a1 and b0 <= cx_ <= b1]
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if keep[i] and area <= 300 and max(w, h) <= 30 and any(x - 12 <= cx_ <= x + w + 12 and y - 12 <= cy_ <= y + h + 12 for cx_, cy_ in corners):
            keep[i] = False
    print("dashed-box lines", [(("x" if v else "y"), c) for v, c, _, _ in lines])
    ink = keep[lab].astype(np.uint8)
    # the manual's digits: their boxes (the last two of "18:88" take "3" and "9"), then the whole display and its icons go
    dsub = (lab[365:648, 3010:3610] > 0) & ~np.isin(lab[365:648, 3010:3610], [i for i in range(n) if st[i][2] > 150])
    cols = np.where(dsub.any(0))[0]
    groups, start = [], cols[0]
    for a_, b_ in zip(cols[:-1], cols[1:]):
        if b_ - a_ > 12:
            groups.append((start, a_)); start = b_
    groups.append((start, cols[-1]))
    groups = [g for g in groups if g[1] - g[0] > 40]              # digits, not the colon
    rows = np.where(dsub.any(1))[0]
    dig_boxes = [(3010 + g[0], 365 + rows[0], 3010 + g[1] + 1, 365 + rows[-1] + 1) for g in groups[-2:]]
    print("manual digit boxes (last two)", dig_boxes)
    ink[365:648, 3010:3610] = 0
    ink[170:352, 2990:3630] = 0                                    # the display's icons above the digits (unlit)
    ink[1240:] = 0
    ink[1075:, 3640:4440] = 0                                      # the leader's dot under the Water ... Spin box

    # colour classes, in manual px
    colour = np.zeros(ink.shape + (3,), np.uint8)
    colour[:] = WHITE
    for (x0, y0, x1, y1), c in [
        ((380, 850, 720, 950), GREY_SUB), ((2420, 330, 2760, 400), GREY_SUB), ((2390, 510, 2640, 580), GREY_SUB),
        ((3640, 940, 4440, 1065), GREY_SUB), ((4560, 940, 4740, 1010), GREY_SUB), ((4470, 100, 4850, 160), GREY_SUB),
        ((2990, 690, 3630, 810), GREY_ICON), ((3700, 250, 4380, 740), GREY_ICON), ((1100, 140, 1160, 930), GREY_ICON),
        ((2090, 140, 2150, 930), GREY_ICON), ((4455, 465, 4505, 515), GREY_ICON)]:
        colour[y0:y1, x0:x1] = c
    for i in range(1, n):                                          # the separator lines in the right column
        if keep[i] and 4490 < st[i][0] < 4530 and st[i][3] <= 8 and st[i][2] > 150:
            x, y, w, h, _ = st[i]
            colour[y:y + h, x:x + w] = GREY_ICON
    # the bars between Water | Wash | Rinse | Spin: grey; the manual draws two, the panel (DZ-3) three
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    bars = [st2[i] for i in range(1, n2) if 3640 < st2[i][0] < 4440 and 850 < st2[i][1] < 940 and st2[i][3] > 4 * st2[i][2] and st2[i][3] > 40]
    for x, y, w, h, _ in bars:
        colour[y:y + h, x:x + w] = GREY_ICON
    bars.sort(key=lambda b: b[0])
    words = [st2[i] for i in range(1, n2) if 3640 < st2[i][0] < 4440 and 850 < st2[i][1] < 940 and st2[i][1] + st2[i][3] < 945 and not (st2[i][3] > 4 * st2[i][2] and st2[i][3] > 40)]
    print("bars", [tuple(b[:4]) for b in bars])
    # the widest gap between the letters of Wash and Rinse takes the new bar
    span = sorted((b[0], b[0] + b[2]) for b in words if bars[0][0] < b[0] < bars[1][0])
    merged = [list(span[0])]
    for a_, b_ in span[1:]:
        if a_ <= merged[-1][1] + 2:
            merged[-1][1] = max(merged[-1][1], b_)
        else:
            merged.append([a_, b_])
    gaps = [(merged[k + 1][0] - merged[k][1], merged[k][1], merged[k + 1][0]) for k in range(len(merged) - 1)]
    _, wash_end, rinse_start = max(gaps)
    bx = round((wash_end + rinse_start) / 2 - bars[0][2] / 2)
    ink[bars[0][1]:bars[0][1] + bars[0][3], bx:bx + bars[0][2]] = 1
    colour[bars[0][1]:bars[0][1] + bars[0][3], bx:bx + bars[0][2]] = GREY_ICON
    # the LED grid: 4 columns x 5 rows of dots; DZ-3 shows Water row 3, Wash row 5, Rinse row 4, Spin row 5 lit
    dots = [st2[i] for i in range(1, n2) if 3700 < st2[i][0] < 4380 and 250 < st2[i][1] < 740 and 15 < st2[i][2] < 40]
    xs_ = sorted(set(round(d[0] / 60) for d in dots))
    ys_ = sorted(set(round(d[1] / 60) for d in dots))
    print("LED grid", len(dots), "dots,", len(xs_), "cols x", len(ys_), "rows")
    lit = {(0, 2), (1, 4), (2, 3), (3, 4)}
    for x, y, w, h, _ in dots:
        if (xs_.index(round(x / 60)), ys_.index(round(y / 60))) in lit:
            colour[y - 2:y + h + 2, x - 2:x + w + 2] = LIT

    # warp to the panel at 12 px/mm
    Wp, Hp = round(PANEL_W * HI), round(PANEL_S * HI)
    M = np.float32([[HI * AFF[0, 0], HI * AFF[0, 1], HI * AFF[0, 2]], [-HI * AFF[1, 0], -HI * AFF[1, 1], HI * (PANEL_S - AFF[1, 2])]])
    a = cv2.warpAffine(ink.astype(np.float32), M, (Wp, Hp), flags=cv2.INTER_AREA)
    a = cv2.GaussianBlur(a, (0, 0), 0.35)
    col = np.stack([cv2.warpAffine((colour[..., k] * ink).astype(np.float32), M, (Wp, Hp), flags=cv2.INTER_AREA) for k in range(3)], 2)
    col = cv2.GaussianBlur(col, (0, 0), 0.35)
    rgb = np.where(a[..., None] > 1e-3, col / np.maximum(a[..., None], 1e-3), 0)
    a = np.clip(a, 0, 1)[..., None]
    img = Image.fromarray((np.array(GROUND, np.float32) * (1 - a) + rgb * a).clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)

    def m2p(mx, my):
        x, s = AFF @ np.array([mx, my, 1.0])
        return x * HI, (PANEL_S - s) * HI
    for box, digit in zip(dig_boxes, "39"):
        (ax, ay), (bx_, by) = m2p(box[0], box[1]), m2p(box[2], box[3])
        for poly in seven((ax, ay, bx_, by), digit):
            d.polygon(poly, fill=DIGIT)

    # from DZ-3: LG's mark, 10.0kg, ThinQ, the Inverter Direct Drive mark
    V = np.asarray(load("DZ-3.jpg").convert("L")).astype(np.float32)

    def to_px(b):
        x0, s0 = dz2mm(b[0], b[3])
        x1, s1 = dz2mm(b[2], b[1])
        return x0 * HI, (PANEL_S - s1) * HI, x1 * HI, (PANEL_S - s0) * HI
    sys.path.insert(0, HERE)
    import tex_lg_mark
    lg = tex_lg_mark.lg_hi(LOGOS, 2400)
    c = np.asarray(lg).astype(float)
    A = c[..., 3] / 255.0
    ys, xs = np.where(A > 0.08)
    c, A = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1], A[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    red = (c[..., 0] > 110) & (c[..., 1] < 90) & (A > 0.5)
    ys, xs = np.where(red)
    dcx, dcy, dr = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, (xs.max() - xs.min() + ys.max() - ys.min()) / 4
    yy, xx = np.mgrid[0:c.shape[0], 0:c.shape[1]]
    inside = np.clip(dr + 0.5 - np.hypot(xx - dcx, yy - dcy), 0, 1)
    white = np.clip((c[..., :3].min(2) - 150) / 70, 0, 1)        # the face's strokes: cut out of the filled disc
    al = np.maximum(A * (1 - inside), inside * (1 - white))
    b = to_px(ink_box(V, (598, 341, 678, 374)))
    w, h = round(b[2] - b[0]), round(b[3] - b[1])
    img.paste(Image.new("RGB", (w, h), (200, 202, 206)), (round(b[0]), round(b[1])),
              Image.fromarray((al * 255).round().astype(np.uint8)).resize((w, h), Image.LANCZOS))
    print("LG mark mm", [round(v / HI, 1) for v in b])
    for text, win in [("10.0kg", (1238, 466, 1272, 482)), ("ThinQ", (1279, 466, 1313, 482))]:
        b = to_px(ink_box(V, win))
        set_text(img, text, COND, b, WHITE, 0)
        print(text, "mm", [round(v / HI, 1) for v in b])
    mk = Image.open(os.path.join(os.path.dirname(DEST), "lg_fhb1209", "mark.png")).convert("RGBA")
    ma = np.asarray(mk)[..., 3]
    ys, xs = np.where(ma > 20)
    mk = mk.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    b = to_px(ink_box(V, (1319, 463, 1394, 488)))
    w, h = round(b[2] - b[0]), round(b[3] - b[1])
    img.paste(Image.new("RGB", (w, h), WHITE), (round(b[0]), round(b[1])), mk.getchannel("A").resize((w, h), Image.LANCZOS))
    print("inverter mark mm", [round(v / HI, 1) for v in b])

    geo = {"panel_mm": [PANEL_W, PANEL_S]}
    kx, ks = AFF @ np.array([1613.0, 633.0, 1.0])
    geo["knob"] = {"x_mm": round(kx - PANEL_W / 2, 2), "s_mm": round(ks, 2), "dial_r_mm": round(413 * 0.0753, 2)}
    json.dump(geo, open(os.path.join(DEST, "panel_geo.json"), "w"))
    print("panel geo", geo)
    save(img.resize((round(PANEL_W * 3), round(PANEL_S * 3)), Image.LANCZOS), "panel.jpg", 90)
    import decal_cut
    decal_cut.cut(img, GROUND, DEST, prefix="print")
    if COMPARE:
        dz = load("DZ-3.jpg")
        # the photo resampled into panel mm at 3 px/mm next to the print at 3 px/mm
        Y, X = np.mgrid[0:round(PANEL_S * 3), 0:round(PANEL_W * 3)].astype(np.float32)
        s = PANEL_S - Y / 3
        x = X / 3
        Yp = 505 - s / PANEL_S * 215.5
        xl, xr = 529 + (Yp - 310) * 23 / 180, 1480 - (Yp - 310) * 24 / 180
        Xp = xl + x / PANEL_W * (xr - xl)
        ph = cv2.remap(np.asarray(dz), Xp, Yp.astype(np.float32), cv2.INTER_LINEAR)
        lo = img.resize((ph.shape[1], ph.shape[0]), Image.LANCZOS)
        o = Image.new("RGB", (ph.shape[1], ph.shape[0] * 2 + 10), (128, 128, 128))
        o.paste(Image.fromarray(ph), (0, 0))
        o.paste(lo, (0, ph.shape[0] + 10))
        o.save(os.path.join(COMPARE, "panel_compare.png"))


LABEL_W_MM = 69.3      # gal1: the red arch 65 px at 0.966 px/mm = 67.3 mm, inside the label's black frame (552 px of 536)


def label():
    src = load("gal2.jpg")
    A = np.asarray(src).astype(np.float32)
    L = A.mean(2)
    sub = L[100:1250, 300:980]
    ys, xs = np.where(sub < 120)
    X0, Y0, X1, Y1 = 300 + xs.min(), 100 + ys.min(), 300 + xs.max() + 1, 100 + ys.max() + 1
    K = 12.0 * LABEL_W_MM / (X1 - X0)
    WL, HL = round((X1 - X0) * K), round((Y1 - Y0) * K)
    SS = 3
    P = lambda x, y: ((x - X0) * K * SS, (y - Y0) * K * SS)
    CX = (X0 + X1) / 2
    col = lambda x, y0, y1: L[y0:y1, x]
    c = col(X0 + 23, 360, 470)                            # under the red, at the label's straight side
    BASE = 360 + int(np.argmax(c < 60))
    c = col(X0 + 14, BASE + 5, 700)
    BAND_BOT = BASE + 5 + int(np.argmax(c > 150))
    r = L[900, X0:X0 + 30]
    first = int(np.argmax(r < 120))
    FR = first + int(np.argmax(r[first:] > 150))            # the black frame's width on the straight side
    row = A[BASE - 6, X0:X1]
    yel = np.where((row[:, 0] > 200) & (row[:, 1] > 200) & (row[:, 2] < 190))[0]
    YX0, YX1 = X0 + yel.min(), X0 + yel.max() + 1
    c = A[BASE - 200:BASE, round(CX)]
    YTOP = BASE - 200 + int(np.argmax((c[:, 0] > 200) & (c[:, 1] > 200) & (c[:, 2] < 190)))
    c = A[BAND_BOT:BAND_BOT + 300, round(CX)]
    g = np.where((c[:, 1] > 110) & (c[:, 0] < 60))[0]
    GH0, GH1 = BAND_BOT + g.min(), BAND_BOT + g.max() + 1
    r = A[(GH0 + GH1) // 2, X0:X1]
    g = np.where((r[:, 1] > 110) & (r[:, 0] < 60))[0]
    GX0, GX1 = X0 + g.min(), X0 + g.max() + 1
    rule = (L[GH1:GH1 + 200, GX0 + 20:GX1 - 20] < 80).mean(1)    # the box's bottom rule: a row dark nearly all across
    BOXB = GH1 + int(np.argmax(rule > 0.8))
    c = A[Y1 - 150:Y1, round(CX)]
    g = np.where((c[:, 1] > 110) & (c[:, 0] < 60))[0]
    FT0 = Y1 - 150 + g.min()
    print("label px", (X0, Y0, X1, Y1), "base", BASE, "band", BAND_BOT, "frame", FR, "yellow", (YX0, YX1, YTOP),
          "green head", (GX0, GH0, GX1, GH1), "box bottom", BOXB, "footer", FT0, "K", round(K, 4))
    RED = tuple(int(v) for v in np.median(A[BASE - 40:BASE - 20, X0 + 20:X0 + 40].reshape(-1, 3), 0))
    YEL = tuple(int(v) for v in np.median(A[BASE - 30:BASE - 10, round(CX) - 20:round(CX) + 20].reshape(-1, 3), 0))
    CREAM = tuple(int(v) for v in np.median(A[960:990, 720:900].reshape(-1, 3), 0))
    GREEN = tuple(int(v) for v in np.median(A[GH0 + 4:GH0 + 10, round(CX) - 150:round(CX) - 100].reshape(-1, 3), 0))
    INK = (14, 14, 16)
    print("label colours red", RED, "yellow", YEL, "cream", CREAM, "green", GREEN)

    can = Image.new("RGB", (WL * SS, HL * SS), INK)
    d = ImageDraw.Draw(can)
    rx, ry = (X1 - X0) / 2 - FR, BASE - Y0 - FR
    (ax, ay), (bx, by) = P(CX - rx, BASE - ry), P(CX + rx, BASE + ry)
    d.pieslice((ax, ay, bx, by), 180, 360, fill=RED)
    yrx, yry = (YX1 - YX0) / 2, BASE - YTOP
    t = 3.2
    (ax, ay), (bx, by) = P(CX - yrx - t, BASE - yry - t), P(CX + yrx + t, BASE + yry + t)
    d.pieslice((ax, ay, bx, by), 180, 360, fill=INK)
    (ax, ay), (bx, by) = P(CX - yrx, BASE - yry), P(CX + yrx, BASE + yry)
    d.pieslice((ax, ay, bx, by), 180, 360, fill=YEL)
    d.rectangle((*P(X0 + FR, BASE), *P(X1 - FR, BAND_BOT)), fill=INK)
    d.rectangle((*P(X0 + FR, BAND_BOT), *P(X1 - FR, FT0)), fill=CREAM)
    d.rectangle((*P(X0 + FR, FT0), *P(X1 - FR, Y1 - FR)), fill=GREEN)
    bt = 3.4
    d.rounded_rectangle((*P(GX0 - bt, GH0 - bt), *P(GX1 + bt, BOXB + bt)), radius=16 * K * SS, fill=INK)
    d.rounded_rectangle((*P(GX0, GH0), *P(GX1, BOXB)), radius=13 * K * SS, fill=CREAM)
    d.rounded_rectangle((*P(GX0, GH0), *P(GX1, GH1 + 20)), radius=13 * K * SS, fill=GREEN)
    d.rectangle((*P(GX0, GH1), *P(GX1, GH1 + 21)), fill=CREAM)

    redmask = (A[..., 0] > 180) & (A[..., 1] < 110)
    white = (L > 200).astype(np.uint8)
    white[BASE:] = 0
    n, lab, stats, cents = cv2.connectedComponentsWithStats(white, 8)
    stars = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 1500 or x < X0 or x + w > X1 or y > BASE:
            continue
        ring = cv2.dilate((lab == i).astype(np.uint8), np.ones((9, 9), np.uint8)) & ~(lab == i)
        if redmask[ring.astype(bool)].mean() < 0.5:
            continue
        ys_, xs_ = np.where(lab == i)
        cx_, cy_ = xs_.mean(), ys_.mean()
        rr = np.hypot(xs_ - cx_, ys_ - cy_)
        ang = np.degrees(np.arctan2(ys_ - cy_, xs_ - cx_))
        stars.append((cx_, cy_, rr.max(), ang[np.argmax(rr)]))
    stars.sort()
    for sx, sy, ro, tip in stars:
        pts = []
        for j in range(10):
            rad = ro if j % 2 == 0 else ro * 0.40
            a_ = np.radians(tip + j * 36)
            pts.append(P(sx + rad * np.cos(a_), sy + rad * np.sin(a_)))
        d.polygon(pts, fill=(255, 255, 255))
    print("stars", [(round(s[0]), round(s[1]), round(s[2], 1), round(s[3])) for s in stars])

    def put(text, font, win, dark=True, colour=None, thr=None):
        b = ink_box(L, win, dark=dark, k=4, thr=thr)
        (ax_, ay_), (bx_, by_) = P(b[0], b[1]), P(b[2], b[3])
        set_text(can, text, font, (ax_, ay_, bx_, by_), colour or (INK if dark else (255, 255, 255)))

    for (sx, sy, ro, tip), num in zip(stars, "12345"):
        put(num, ARIAL_B, (round(sx - ro * 0.33), round(sy - ro * 0.36), round(sx + ro * 0.33), round(sy + ro * 0.36)), thr=70)
    # every word read off this model's gal2 (TX310NWO)
    put("MORE STARS", ARIAL_B, (565, 316, 772, 352))
    put("MORE SAVINGS", ARIAL_B, (552, 352, 785, 388))
    put("2024 - 26", ARIAL_B, (412, 420, 912, 518), dark=False, thr=200)
    put("Label Series", ARIAL_B, (492, 518, 835, 568), dark=False, thr=200)
    put("ENERGY CONSUMPTION", ARIAL_BLK, (432, 622, 900, 670), dark=False, thr=200)
    put("0.0064", ARIAL_BLK, (432, 700, 722, 778))
    put("*", ARIAL_B, (722, 700, 768, 748))
    put("kWh/kg/cycle", ARIAL_B, (765, 748, 897, 776))
    put("Washing Machine", ARIAL_NB, (415, 835, 628, 872))
    put("Top Load", ARIAL_NB, (720, 835, 838, 872))
    put("LG", ARIAL_NB, (415, 886, 452, 920))
    put("Load Capacity : 10.0 (kg)", ARIAL_NB, (415, 932, 682, 972))
    put("Model No.: TX310NWO", ARIAL_NB, (415, 998, 652, 1037))
    put("India", ARIAL_NB, (625, 1038, 700, 1072))
    put("*Under test conditions, when tested in accordance with relevant standards.", ARIAL_B, (472, 1086, 934, 1105), dark=False, thr=200)
    put("Actual energy consumption will depend on how the appliance being used.", ARIAL_B, (472, 1106, 934, 1126), dark=False, thr=200)
    put("Issued by Bureau of Energy Efficiency www.beeindia.gov.in", ARIAL_B, (488, 1128, 918, 1150), dark=False, thr=200)

    em = L[FT0 + 2:Y1 - FR, X0 + FR:X0 + 82]                    # the emblem only (the footer's words start at X0 + 85)
    ys_, xs_ = np.where(em > 140)
    ecx, ecy = X0 + FR + (xs_.min() + xs_.max()) / 2, FT0 + 2 + (ys_.min() + ys_.max()) / 2
    er = max(xs_.max() - xs_.min(), ys_.max() - ys_.min()) / 2 - 0.5
    crop = src.crop((round(ecx - er), round(ecy - er), round(ecx + er), round(ecy + er)))
    (ax, ay), (bx, by) = P(ecx - er, ecy - er), P(ecx + er, ecy + er)
    size = round(bx - ax)
    crop = crop.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    can.paste(crop, (round(ax), round(ay)), mask)

    lab_img = can.resize((WL, HL), Image.LANCZOS)
    save(lab_img, "label.jpg", 92)
    geo = {"w_mm": LABEL_W_MM, "h_mm": round((Y1 - Y0) / (X1 - X0) * LABEL_W_MM, 2),
           "arch_ry_mm": round((BASE - Y0) / (X1 - X0) * LABEL_W_MM, 2)}
    json.dump(geo, open(os.path.join(DEST, "label_geo.json"), "w"))
    print("label geometry", geo)
    if COMPARE:
        ref = src.crop((X0, Y0, X1, Y1)).resize((WL, HL), Image.LANCZOS)
        o = Image.new("RGB", (WL * 2 + 20, HL), (128, 128, 128))
        o.paste(ref, (0, 0))
        o.paste(lab_img, (WL + 20, 0))
        o.save(os.path.join(COMPARE, "label_compare.png"))


# ── sides and back: LG's straight photos resampled to the model's planes ──
def resample(name, front, back, floor, h0, h1, ppm, mirror=False):
    """A side photo -> texture: columns from the front (xf 0) to the back (xf 565 mm), rows from h1 down to h0 mm.
    front / back: the photo x of the cabinet's front and back edges at rows 400 and 1150 (lines between)."""
    im = np.asarray(load(name))
    Wt, Ht = round(565 * ppm), round((h1 - h0) * ppm)
    Y, X = np.mgrid[0:Ht, 0:Wt].astype(np.float32)
    h = h1 - Y / ppm
    xf = X / ppm
    k = ((front[0] - back[0]) + (front[1] - back[1])) / 2 / 565 * (1 if front[0] > back[0] else -1)
    yp = floor - h * k
    t = (yp - 400) / 750
    xF = front[0] + (front[1] - front[0]) * t
    xB = back[0] + (back[1] - back[0]) * t
    xp = xF + (xB - xF) * xf / 565
    out = cv2.remap(im, xp.astype(np.float32), yp.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return Image.fromarray(out)


def sides_and_rear():
    # DZ-13: the left side, the front at the right; DZ-14: the right side, the front at the left. Cabinet h 40 -> 824 mm
    # (under 40 mm the photo shows the floor between the feet; the plain gloss cabinet is left there).
    save(resample("DZ-13.jpg", (1332, 1326), (681, 691), 1247, 40, 824, 1.2), "side_l.jpg", 88)
    save(resample("DZ-14.jpg", (696, 693), (1323, 1320), 1247, 40, 824, 1.2), "side_r.jpg", 88)
    # DZ-15: the back; columns from the machine's right (+x, photo left) to its left, h 24 -> 960 mm
    im = np.asarray(load("DZ-15.jpg"))
    ppm = 1.3
    Wt, Ht = round(565 * ppm), round((960 - 24) * ppm)
    Y, X = np.mgrid[0:Ht, 0:Wt].astype(np.float32)
    h = 960 - Y / ppm
    k = 1.145
    yp = 1246 - h * k
    t = (yp - 400) / 750
    xl = 678 + 3 * t
    xr = 1331 - 9 * t
    xp = xl + (xr - xl) * X / Wt
    save(Image.fromarray(cv2.remap(im, xp.astype(np.float32), yp.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)), "rear.jpg", 88)


# ── inside: the drum (DZ-5, straight down) and the deck (DZ-4, straight down, lid up) ──
DZ5_C, DZ5_PR = (1002.0, 668.0), 268.0        # the pulsator's centre and radius in DZ-5 px


def inside():
    im = load("DZ-5.jpg")
    a = np.asarray(im)
    cx, cy = DZ5_C
    R = 345
    save(im.crop((round(cx - R), round(cy - R), round(cx + R), round(cy + R))).resize((768, 768), Image.LANCZOS), "pulsator.jpg", 88)
    # the embossed drum wall: a patch from the left of the drum, mirrored into a seamless tile
    p = a[330:590, 455:655]
    tile = np.concatenate([np.concatenate([p, p[:, ::-1]], 1), np.concatenate([p[::-1], p[::-1, ::-1]], 1)], 0)
    save(Image.fromarray(tile).resize((400, 520), Image.LANCZOS), "drum.jpg", 85)

    def strip(centre, tw, rh, name):
        # rotate DZ-5 about the drum's centre so `centre` stands straight above it, then cut tw x rh px round it
        ang = np.degrees(np.arctan2(centre[0] - cx, -(centre[1] - cy)))
        M = cv2.getRotationMatrix2D((cx, cy), ang, 1.0)
        r = cv2.warpAffine(a, M, (a.shape[1], a.shape[0]), flags=cv2.INTER_CUBIC)
        dist = np.hypot(centre[0] - cx, centre[1] - cy)
        c = Image.fromarray(r).crop((round(cx - tw / 2), round(cy - dist - rh / 2), round(cx + tw / 2), round(cy - dist + rh / 2)))
        save(c, name, 88)
    strip((1290, 375), 150, 230, "filter.jpg")          # the lint filter at the back right
    strip((690, 878), 190, 250, "waterfall.jpg")       # the ribbed panel at the front left
    # the deck round the tub ring, mapped straight down: x = (X - 1007) / 1.545, xf = (1127 - Y) / 1.545 (mm)
    d4 = load("DZ-4.jpg")
    save(d4.crop((560, 560, 1455, 1131)), "deck.jpg", 88)
    json.dump({"crop": [560, 560, 1455, 1131], "cx": 1007, "front_y": 1127, "ppm": 1.545},
              open(os.path.join(DEST, "deck_geo.json"), "w"))


def drawer():
    """The detergent drawer's face ("Detergent") and the tray top's words, at 12 px/mm, light grey on black (gal4, DZ-5)."""
    face = Image.new("RGB", (round(215 * HI), round(40 * HI)), (16, 16, 19))
    set_text(face, "Detergent", COND, (215 * HI / 2 - 13 * HI, 16 * HI, 215 * HI / 2 + 13 * HI, 22.5 * HI), (120, 121, 125), 0)
    save(face, "drawer_face.jpg", 88)
    top = Image.new("RGB", (round(215 * HI), round(12 * HI)), (16, 16, 19))   # the 12 mm strip behind the face
    set_text(top, "Powdered Detergent", COND, (14 * HI, 3 * HI, 64 * HI, 9 * HI), (170, 171, 175), 0)
    set_text(top, "Liquid Detergent", COND, (110 * HI, 3 * HI, 152 * HI, 9 * HI), (170, 171, 175), 0)
    set_text(top, "Softener", COND, (170 * HI, 3 * HI, 194 * HI, 9 * HI), (170, 171, 175), 0)
    save(top, "drawer_top.jpg", 88)


if __name__ == "__main__":
    only = [a for a in sys.argv[4:] if not a.startswith("--") and a != COMPARE]
    for f in (panel, label, sides_and_rear, inside, drawer):
        if not only or f.__name__ in only:
            f()
