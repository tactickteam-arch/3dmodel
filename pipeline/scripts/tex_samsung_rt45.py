"""Textures for the Samsung RT45HG6A22SLHL (419 L, EZ Clean Steel), written to <out dir>/samsung_rt45/.

usage: python3 tex_samsung_rt45.py <photos dir> <logos dir> <out dir> [--compare]
  photos: samsung_rt45/labelp_553824086.jpg  Samsung India's straight-on front of this code, with its BEE label
          samsung_rt45/label_553824071.jpg   Samsung India's picture of this model's own BEE label
                                             ("Model No.: RT45HG6A22SLHL", 419 L, 252 units/yr)
          samsung_rt45/g_550663862.jpg       Samsung India's rear view of this code
  logos:  samsung.png
  writes:
    door_freezer.jpg, door_fridge.jpg   the EZ Clean Steel fronts: the light-to-dark fall of Samsung's straight-on front,
                                        row by row, with horizontal hairlines (the label and the wordmark are decals)
    side_paint.jpg                      the dark grey painted sides (Samsung's 3/4 views: 69-87 at mid-height)
    label.png                           the BEE label, die-cut, from Samsung's own picture of it (about 5 px per mm)
    mark.png                            the SAMSUNG wordmark in dark ink, as on the silver strip across the fridge door
    rear.jpg, bay.jpg, cord_path.json   the dimpled rear panel with the cord painted out, the open compressor bay, and
                                        the cord's route and plug read off the rear photo (NOTES.md)
    back_freezer.png, back_fridge.png   the raised duct panels on the back walls inside, redrawn: vents, the Twin Cooling
                                        Plus badges, the round grommets and the Fresh Room's three icons
    inner_panel.png, bigbox_print.png, icemaker_print.png
                                        drawn by tex_samsung_fridge.py (the RT34's, run unchanged into a scratch folder):
                                        Samsung's close-up g_550663865 shows this model's touch panel word for word the
                                        same, and the open-door photo the same "Big Box" and "Movable Ice Maker" prints

Samsung's photos for this code show a body 4% wider for its height than the published 700 x 1790 mm: they read
700 x 1720, the 396 L RT41's size in the manual (NOTES.md). The freezer is the same in both (95 L), so everything is
measured at the photo's own scale (0.640 px per mm across the front, 0.719 on the rear) and the extra 70 mm is put
where it is on the real one: in the fridge.
"""
import json
import math
import os
import runpy
import shutil
import sys
import tempfile
from collections import deque

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = "--compare" in sys.argv
D = os.path.join(OUT, "samsung_rt45")
os.makedirs(D, exist_ok=True)
P = os.path.join(PHOTOS, "samsung_rt45")
rng = np.random.default_rng(45)
H_MM = 1790


def save(img, name, q=86):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def brushed(w, h, strength=4.5, streak=180):
    """Horizontal hairline noise (as tex_samsung_rt34.py, copied from prep_textures.py)."""
    n = rng.normal(0, 1, (h, w // 4 + 1))
    n = np.repeat(n, 4, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur((streak / 40, 0.4)))
    return (np.asarray(img).astype(float) / 255 - 0.5) * 2 * strength


# ── the doors ──
# Samsung's straight-on front (labelp_553824086.jpg): body x 737-1184 (448 px = 700 mm, 0.640 px per mm), top row 96,
# floor row 1195. Freezer door rows 97-462, the doors' gap 462-469, the silver strip 471-480 (geometry), the fridge door's
# brushed face from row 481 to its bottom edge, row 1166. The BEE label covers x 1055-1142, rows 145-302.
FZ_ROWS, FR_ROWS = (97, 462), (481, 1166)
X0, X1 = 737, 1184
LABEL_X = 1050
# the viewer's own light lifts the top and darkens the foot of a tall door: GAIN corrects the photo's fall for it,
# tuned by comparing the render with the photo as ratios of the label's white (NOTES.md). Positions are fractions of the
# door's height from its top.
GAIN_FZ = [(0.0, 0.84), (1.0, 0.86)]
GAIN_FR = [(0.0, 0.85), (0.2, 0.81), (1.0, 0.79)]


def doors():
    src = np.asarray(Image.open(os.path.join(P, "labelp_553824086.jpg")).convert("RGB")).astype(float)
    bw = X1 - X0
    whole = src[:, int(X0 + 0.05 * bw):int(X0 + 0.95 * bw)].mean(1)
    left = src[:, int(X0 + 0.05 * bw):LABEL_X - 8].mean(1)
    # beside the label, the left part of each row, scaled by the ratio of the two just below the label
    k = (whole[306:316] / left[306:316]).mean(0)
    band = whole.copy()
    band[140:306] = left[140:306] * k

    def door(rows, h_mm, gain, name, px_mm=1.6):
        w, h = round(700 * px_mm), round(h_mm * px_mm)
        f = np.arange(h) / (h - 1)
        hold = 8 / h_mm                                                   # held flat 8 mm from each edge (gap shadows)
        f = np.clip(f, hold, 1 - hold)
        r = rows[0] + f * (rows[1] - rows[0])
        i = np.floor(r).astype(int)
        t = (r - i)[:, None]
        col = band[i] * (1 - t) + band[i + 1] * t
        col *= np.interp(f, *zip(*gain))[:, None]
        img = np.repeat(col[:, None, :], w, axis=1)
        img += brushed(w, h)[:, :, None]
        out = Image.fromarray(img.clip(0, 255).astype(np.uint8))
        save(out, name)
        return out

    door(FZ_ROWS, 580, GAIN_FZ, "door_freezer.jpg")                   # 1210-1790 mm
    door(FR_ROWS, 1159 - 14, GAIN_FR, "door_fridge.jpg")               # 45-1190 mm, under the 14 mm strip


def side():
    # Samsung's 3/4 view g_550663869: the right side reads 69 at the top, 83-87 at mid-height and 66 at the foot
    h, w = 768, 512
    yy = np.linspace(0, 1, h)[:, None]
    base = 72 + 15 * np.exp(-((yy - 0.42) / 0.3) ** 2) - 6 * yy
    speck = Image.fromarray(((rng.normal(0, 1, (h, w)) * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    s = (np.asarray(speck).astype(float) / 255 - 0.5) * 3.0
    img = np.stack([base + s, base + s + 1, base + s + 4], axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "side_paint.jpg")


def label():
    # Samsung's picture of the label: the sticker with its white margin and a thin pink cut line round it. The fill from
    # the border stops at the cut line, and the line itself is trimmed off (as tex_samsung_rt34.py does)
    src = Image.open(os.path.join(P, "label_553824071.jpg")).convert("RGB")
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.min(2) < 225)
    lab = src.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3)).convert("RGBA")
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g, b, _ = px[x, y]
        if min(r, g, b) < 238:
            continue
        seen[y, x] = True
        px[x, y] = (r, g, b, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = np.asarray(lab.getchannel("A").filter(ImageFilter.MinFilter(5)))
    q = lab.convert("RGB").quantize(colors=63, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(q).copy()
    idx[alpha < 128] = 63
    out = Image.frombytes("P", q.size, idx.astype(np.uint8).tobytes())
    out.putpalette(q.getpalette()[:63 * 3] + [255, 255, 255])
    p = os.path.join(D, "label.png")
    out.save(p, optimize=True, transparency=bytes([255] * 63 + [0]))
    print("wrote", p, out.size, os.path.getsize(p) // 1024, "KB", "aspect h/w", round(out.height / out.width, 4))


def mark():
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = (52, 55, 61)
    out[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(out), "mark.png")


# ── the rear (g_550663862.jpg) ──
# body x 704-1215 (511 px for 700 mm, 0.730 px per mm across; the side walls' bumps at mid-height stand a little proud),
# top edge row 21, floor row 1258 (1237 px for the photographed 1720 mm body, 0.719 px per mm up). The compressor bay opens
# at row 1058; the cabinet floor inside it is 70 mm up (row 1208). The cord leaves the cover's connector at (809, 338),
# runs straight down at x 809, bends at rows 1000-1018 and runs across at row 1021 to the plug, centred at (1145, 1022).
R_X0, R_X1, R_TOP, R_FLOOR, R_BAY, R_BAYFLOOR = 704, 1215, 21, 1258, 1058, 1208
PPM_X, PPM_Y = 511 / 700, 1237 / 1720
SPLIT = 600                                            # rows above keep their distance from the top; rows below stretch
CORD = [(809, 338), (809, 450), (809, 600), (809, 750), (809, 900), (809, 975), (811, 998), (818, 1012), (832, 1019),
        (860, 1021), (950, 1021), (1050, 1021), (1118, 1022)]
PLUG = (1145, 1022)


def rear_y(row):
    """photo row -> height above the floor on the 1790 mm body (metres)."""
    bay_m = (R_FLOOR - R_BAY) / PPM_Y / 1000
    top_m = H_MM / 1000
    split_m = top_m - (SPLIT - R_TOP) / PPM_Y / 1000
    if row <= SPLIT:
        return top_m - (row - R_TOP) / PPM_Y / 1000
    if row <= R_BAY:
        return split_m + (row - SPLIT) / (R_BAY - SPLIT) * (bay_m - split_m)
    return (R_FLOOR - row) / PPM_Y / 1000


def rear():
    src = Image.open(os.path.join(P, "g_550663862.jpg")).convert("RGB")
    a = np.asarray(src).copy()
    mask = np.zeros(a.shape[:2], np.uint8)
    cv2.polylines(mask, [np.array(CORD, np.int32)], False, 255, 13, cv2.LINE_AA)
    cv2.rectangle(mask, (PLUG[0] - 30, PLUG[1] - 19), (PLUG[0] + 20, PLUG[1] + 19), 255, -1)   # plug and its strain relief
    cv2.rectangle(mask, (793, 320), (824, 342), 255, -1)                                        # the cord's connector
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    clean = cv2.inpaint(a, mask, 5, cv2.INPAINT_TELEA)
    # the upper panel: rows R_TOP+4 .. R_BAY, remapped so the cover keeps its place under the top and the bay its height
    x0, x1 = R_X0 + 6, R_X1 - 6
    top_m, bay_m = H_MM / 1000, rear_y(R_BAY)
    out_h = round((top_m - bay_m) * 1000 * PPM_Y)                       # at the photo's own vertical scale
    rows = []
    for j in range(out_h):
        y = top_m - (j + 0.5) / out_h * (top_m - bay_m)                  # the height this texture row shows
        lo, hi = float(R_TOP), float(R_BAY)                              # invert rear_y by bisection (it falls with row)
        for _ in range(30):
            mid = (lo + hi) / 2
            if rear_y(mid) > y:
                lo = mid
            else:
                hi = mid
        rows.append((lo + hi) / 2)
    rows = np.clip(np.array(rows), 0, a.shape[0] - 2)
    i = np.floor(rows).astype(int)
    t = (rows - i)[:, None, None]
    panel = clean[i, x0:x1].astype(float) * (1 - t) + clean[i + 1, x0:x1].astype(float) * t
    save(Image.fromarray(panel.clip(0, 255).astype(np.uint8)), "rear.jpg", q=84)
    bay = Image.fromarray(a).crop((R_X0 + 8, R_BAY, R_X1 - 8, R_BAYFLOOR))
    save(bay.resize((bay.width * 2, bay.height * 2), Image.LANCZOS), "bay.jpg")
    xc = (R_X0 + R_X1) / 2
    to_m = lambda x, r: (round(-(x - xc) / PPM_X / 1000, 4), round(rear_y(r), 4))   # seen from behind: x mirrors
    json.dump({"ppm": [PPM_X, PPM_Y], "cord": [to_m(x, r) for x, r in CORD], "plug": to_m(*PLUG), "bay_top": round(bay_m, 4),
               "bay_floor": round(rear_y(R_BAYFLOOR), 4), "cord_d": 0.008},
              open(os.path.join(D, "cord_path.json"), "w"), indent=1)
    print("wrote cord_path.json; bay top", round(bay_m, 3), "m")


# ── back-wall duct panels, redrawn (the RT34's drawing code in tex_samsung_fridge.py, at this model's sizes) ──
AV = "/System/Library/Fonts/Avenir Next.ttc"
S = 2


def font(path, px, face=0):
    return ImageFont.truetype(path, round(px * S), index=face)


def rrect(d, box, r, fill=None, outline=None, w=1):
    x0, y0, x1, y1 = [v * S for v in box]
    d.rounded_rectangle((x0, y0, x1, y1), r * S, fill=fill, outline=outline, width=round(w * S))


def text(d, xy, s, f, fill, anchor="mm"):
    d.text((xy[0] * S, xy[1] * S), s, font=f, fill=fill, anchor=anchor)


def line(d, pts, w, fill):
    d.line([(x * S, y * S) for x, y in pts], fill=fill, width=round(w * S), joint="curve")


def badge(d, cx, cy, r):
    for i in range(14):
        k = i / 13
        col = (int(20 + 40 * k), int(88 + 52 * k), int(190 - 10 * k), 255)
        rr = r * (1 - 0.012 * i)
        d.ellipse(((cx - rr) * S, (cy - rr) * S, (cx + rr) * S, (cy + rr) * S), fill=col)
    ri = r * 0.84
    d.ellipse(((cx - ri) * S, (cy - ri) * S, (cx + ri) * S, (cy + ri) * S), fill=(48, 118, 204, 255))
    for k in range(40):
        a0 = math.radians(k * 9 - 20)
        a1 = a0 + math.radians(3.5 if k % 2 else 2)
        shade = (96, 156, 228, 255) if k % 3 == 0 else (66, 134, 214, 255)
        d.pieslice(((cx - ri) * S, (cy - ri) * S, (cx + ri) * S, (cy + ri) * S), math.degrees(a0), math.degrees(a1), fill=shade)
    rj = r * 0.78
    d.ellipse(((cx - rj) * S, (cy - rj) * S, (cx + rj) * S, (cy + rj) * S), outline=(30, 86, 170, 255), width=round(0.025 * r * S))
    text(d, (cx - r * 0.04, cy + r * 0.04), "Twin Cooling", font(AV, r * 0.2, 0), (255, 255, 255, 255))
    text(d, (cx + r * 0.5, cy - r * 0.2), "Plus", font(AV, r * 0.11, 0), (255, 255, 255, 255))


def vent(d, cx, cy, ln, th, col=(78, 82, 88, 255)):
    rrect(d, (cx - ln / 2, cy - th / 2, cx + ln / 2, cy + th / 2), th / 2, fill=col)


def icon_box(d, cx, cy, s):
    rrect(d, (cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2), s * 0.12, outline=(112, 116, 124, 255), w=2.4)


# Positions measured on the open-door photo whose body has the published 1790 mm (NOTES.md), at the back wall: the photo's
# 0.619 px per mm, corrected for the camera (eye 0.868 m up and 0.166 m right of the middle; the back wall reads 0.892 times
# its size). Each panel is given as its box in metres (x from the middle, y above the floor) and each mark in the same.
FZ_PANEL = (-0.276, 0.243, 1.311, 1.758)
FR_PANEL = (-0.153, 0.165, 0.623, 1.146)


def back_panel(name, box_m, build):
    PX = 4
    x0, x1, y0, y1 = box_m
    w, h = round((x1 - x0) * 1000 * PX), round((y1 - y0) * 1000 * PX)
    img = Image.new("RGBA", (w * S, h * S), (246, 247, 249, 255))
    d = ImageDraw.Draw(img)
    rrect(d, (3, 3, w - 3, h - 3), 14, outline=(226, 229, 233, 255), w=3)
    X = lambda xm: (xm - x0) * 1000 * PX
    Y = lambda ym: (y1 - ym) * 1000 * PX
    build(d, X, Y, PX)
    img = img.resize((w, h), Image.LANCZOS).convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    p = os.path.join(D, name)
    img.save(p, optimize=True)
    print("wrote", p, img.size)


def back_freezer():
    def b(d, X, Y, PX):
        th = 5 * PX / 2 * 2
        # five vent slots under the ceiling (photo x 738-769, 779-810, 842-892, 918-949, 957-992)
        for xa, xb in ((-0.237, -0.180), (-0.162, -0.106), (-0.048, 0.042), (0.089, 0.146), (0.160, 0.224)):
            vent(d, (X(xa) + X(xb)) / 2, Y(1.738), X(xb) - X(xa), th)
        badge(d, X(-0.005), Y(1.679), 58 * PX)
        d.ellipse((X(-0.007) * S - 22 * PX * S, Y(1.391) * S - 22 * PX * S, X(-0.007) * S + 22 * PX * S, Y(1.391) * S + 22 * PX * S), outline=(150, 154, 160, 255), width=3 * S)
        vent(d, (X(-0.092) + X(-0.045)) / 2, Y(1.333), X(-0.045) - X(-0.092), th / 2)
        vent(d, (X(0.035) + X(0.193)) / 2, Y(1.333), X(0.193) - X(0.035), th / 2)
    back_panel("back_freezer.png", FZ_PANEL, b)


def back_fridge():
    def b(d, X, Y, PX):
        ink = (96, 100, 108, 255)
        th = 5 * PX
        for y in (1.130, 1.016, 0.849):                 # three pairs of vent slots
            for x in (-0.139, 0.122):
                vent(d, X(x), Y(y), 47 * PX, th)
        s = 31 * PX
        for i, x in enumerate((-0.055, -0.012, 0.028)):  # the Fresh Room's three icons, as on the RT34: roast, fish, steak
            cx, cy = X(x), Y(1.119)
            icon_box(d, cx, cy, s)
            if i == 0:
                d.ellipse((int((cx - s * 0.28) * S), int((cy - s * 0.24) * S), int((cx + s * 0.28) * S), int((cy + s * 0.32) * S)), outline=ink, width=2 * S)
                line(d, [(cx + s * 0.12, cy - s * 0.1), (cx + s * 0.3, cy - s * 0.3)], 2.2, ink)
            elif i == 1:
                d.ellipse((int((cx - s * 0.3) * S), int((cy - s * 0.14) * S), int((cx + s * 0.16) * S), int((cy + s * 0.14) * S)), outline=ink, width=2 * S)
                line(d, [(cx + s * 0.16, cy), (cx + s * 0.32, cy - s * 0.15)], 2.2, ink)
                line(d, [(cx + s * 0.16, cy), (cx + s * 0.32, cy + s * 0.15)], 2.2, ink)
                line(d, [(cx + s * 0.32, cy - s * 0.15), (cx + s * 0.32, cy + s * 0.15)], 2.2, ink)
            else:
                d.ellipse((int((cx - s * 0.3) * S), int((cy - s * 0.24) * S), int((cx + s * 0.3) * S), int((cy + s * 0.24) * S)), outline=ink, width=2 * S)
                d.ellipse((int((cx - s * 0.12) * S), int((cy - s * 0.1) * S), int((cx + s * 0.12) * S), int((cy + s * 0.12) * S)), outline=ink, width=2 * S)
        badge(d, X(-0.005), Y(0.938), 58 * PX)
        d.ellipse((X(-0.005) * S - 22 * PX * S, Y(0.726) * S - 22 * PX * S, X(-0.005) * S + 22 * PX * S, Y(0.726) * S + 22 * PX * S), outline=(150, 154, 160, 255), width=3 * S)
        rrect(d, (X(-0.150), Y(0.666), X(0.162), Y(0.625)), 6, fill=(240, 241, 244, 255), outline=(206, 209, 214, 255), w=3)
        line(d, [(X(-0.12), Y(0.645)), (X(0.13), Y(0.645))], 2.2, (190, 194, 200, 255))
    back_panel("back_fridge.png", FR_PANEL, b)


def shared_prints():
    # the touch panel, "Big Box" and "Movable Ice Maker" are the same on this model as on the RT34: run the RT34's own
    # drawing script, unchanged, into a scratch folder and keep those three
    tmp = tempfile.mkdtemp()
    argv = sys.argv
    sys.argv = ["tex_samsung_fridge.py", tmp]
    try:
        runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex_samsung_fridge.py"), run_name="__main__")
    finally:
        sys.argv = argv
    for n in ("inner_panel.png", "bigbox_print.png", "icemaker_print.png"):
        shutil.copy(os.path.join(tmp, "samsung", n), os.path.join(D, n))
        print("copied", n)
    shutil.rmtree(tmp)


doors()
side()
label()
mark()
rear()
back_freezer()
back_fridge()
shared_prints()
