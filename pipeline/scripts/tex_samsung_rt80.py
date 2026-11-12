"""Textures for the Samsung RT80H51C2FHL (467 L, Black DOI) and its two sibling colours, RT80H51C2SHL (EZ Clean Steel) and
RT80H51C2BHL (Black Glass), written to <out dir>/samsung_rt80/.

usage: python3 tex_samsung_rt80.py <photos dir> <logos dir> <out dir> [--compare]
  photos: samsung_rt80/<c>_labelp_*.jpg   Samsung India's straight-on front of each code (c = fhl, shl, bhl), with its BEE label
          samsung_rt80/<c>_label_*.jpg    Samsung India's picture of each code's own BEE label ("Model No.: RT80H51C2FHL" ...)
          samsung_rt80/fhl_g_550460086.jpg  Samsung India's rear view (the same on all three codes' galleries)
  logos:  samsung.png
  writes, per colour (suffix f / s / b):
    door_freezer_<c>.jpg, door_fridge_<c>.jpg   the door fronts: each photo's own light field (the face, the label filled in,
                                                blurred over 6 mm so the photo's polish bands and diagonals stay and its
                                                noise goes), at the photo's brightness times GAIN; EZ Clean Steel also gets
                                                the photo's horizontal brushing as fine noise (its normal map adds the rest)
    label_<c>.png                               that code's BEE label, die-cut, from Samsung's own picture of it
  and, for all three:
    side_paint.jpg                      the dark grey painted sides (Samsung's 3/4 views: 88 at the top to 57 at the foot)
    mark.png                            the SAMSUNG wordmark in dark ink, as on the silver strip across the fridge door
    rear.jpg, bay.jpg, cord_path.json   the dimpled rear panel with the cord painted out, the open compressor bay, and the cord's
                                        route and plug read off the rear photo
    back_freezer.png, back_fridge.png   the raised duct panels on the back walls inside, redrawn at this model's positions
    filter_print.png                    the Active Fresh Filter+ unit's face: louvres and its name plate, redrawn
    inner_panel.png, bigbox_print.png, icemaker_print.png
                                        drawn by tex_samsung_fridge.py (the RT34's, run unchanged into a scratch folder):
                                        Samsung's close-up g_550460090 shows this model's touch panel word for word the same,
                                        and the open-door photo the same "Big Box" and "Movable Ice Maker" prints

Samsung's photos read 1.2 % shorter for their width than the published 700 x 1820 mm (front 457 x 1174 px), so heights are
taken as fractions of each door and of the body (NOTES.md).
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
D = os.path.join(OUT, "samsung_rt80")
os.makedirs(D, exist_ok=True)
P = os.path.join(PHOTOS, "samsung_rt80")
rng = np.random.default_rng(80)
H_MM = 1820


def save(img, name, q=86):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def brushed(w, h, strength=4.5, streak=180):
    """Horizontal hairline noise (as tex_samsung_rt45.py)."""
    n = rng.normal(0, 1, (h, w // 4 + 1))
    n = np.repeat(n, 4, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur((streak / 40, 0.4)))
    return (np.asarray(img).astype(float) / 255 - 0.5) * 2 * strength


# ── the doors ──
# Each code's straight-on front (2052 x 1641): the body's columns X0..X1 (457 px = 700 mm, 0.653 px per mm across), the
# freezer door's face rows FZ, the 7 mm gap, the silver strip (geometry), the fridge door's face rows FR (to its bottom
# edge, 37 mm up), and the BEE label's box LAB (filled in before the blur; the label is its own decal).
COLOURS = {
    "f": dict(photo="fhl_labelp_553849691.jpg", label="fhl_label_553849686.jpg", X=(806, 1262), FZ=(240, 609), FR=(628, 1388),
              LAB=(1134, 282, 1229, 446), steel=False),
    "s": dict(photo="shl_labelp_553849708.jpg", label="shl_label_553849697.jpg", X=(798, 1254), FZ=(239, 608), FR=(627, 1387),
              LAB=(1122, 281, 1221, 447), steel=True),
    "b": dict(photo="bhl_labelp_553849680.jpg", label="bhl_label_553849677.jpg", X=(798, 1254), FZ=(239, 608), FR=(627, 1387),
              LAB=(1126, 281, 1229, 446), steel=False, glass=True),
}
# the viewer's own light lifts a door and darkens its foot: GAIN corrects the photo's field for it, tuned by comparing the
# gate's front render with the photo as ratios of the label's white (NOTES.md). (fraction of the door from its top, gain)
GAIN = {
    "f": {"fz": [(0.0, 0.72), (1.0, 0.757)], "fr": [(0.0, 0.73), (0.25, 0.755), (1.0, 0.755)]},
    "s": {"fz": [(0.0, 0.78), (1.0, 0.80)], "fr": [(0.0, 0.83), (0.2, 0.81), (1.0, 0.80)]},
    "b": {"fz": [(0.0, 0.84), (1.0, 0.86)], "fr": [(0.0, 0.86), (1.0, 0.86)]},
}
# Black Glass: under the builder's full clear coat (base specular 0, metal 0.65) the base keeps the photo's own colour, lifted
# per channel (R, G, B) in linear light until the gate's front render and the Apple render both come near the photo's
# [19, 17, 28]: three.js draws the same base bluer and darker than RealityKit, so neither is exact (NOTES.md, 11 Nov)
LIN_K = {"b": (1.94, 1.86, 1.54)}
PX_MM = {"f": 0.8, "s": 1.2, "b": 0.8}             # the smooth films need little; the brushed steel carries its grain


def door_field(c):
    cfg = COLOURS[c]
    src = np.asarray(Image.open(os.path.join(P, cfg["photo"])).convert("RGB")).astype(np.float32)
    x0, x1 = cfg["X"]
    lx0, ly0, lx1, ly1 = cfg["LAB"]
    # the label's box (and a 6 px margin for its white edge and shadow) is filled in with a cubic surface fitted to the
    # door's face round it, blended in over a soft edge, so the door blur sees no label
    a = src.copy()
    r0, r1 = cfg["FZ"][0] + 5, cfg["FZ"][1] - 4
    c0, c1 = max(x0 + 8, lx0 - 90), x1 - 7
    hole = np.zeros(a.shape[:2], np.float32)
    hole[ly0 - 6:ly1 + 7, lx0 - 6:min(lx1 + 7, c1)] = 1
    yy, xx = np.mgrid[r0:r1, c0:c1]
    keep = hole[r0:r1, c0:c1] == 0
    u, v = (xx - c0) / (c1 - c0), (yy - r0) / (r1 - r0)
    terms = lambda u, v: np.stack([u ** i * v ** j for i in range(4) for j in range(4 - i)], -1)
    A = terms(u[keep], v[keep])
    fit = np.zeros((r1 - r0, c1 - c0, 3), np.float32)
    for ch in range(3):
        coef, *_ = np.linalg.lstsq(A, a[r0:r1, c0:c1, ch][keep], rcond=None)
        fit[..., ch] = terms(u, v) @ coef
    soft = cv2.GaussianBlur(hole, (0, 0), 3.0)[r0:r1, c0:c1, None]
    a[r0:r1, c0:c1] = a[r0:r1, c0:c1] * (1 - soft) + fit * soft
    out = {}
    for key, (r0, r1), h_mm in (("fz", cfg["FZ"], 575), ("fr", cfg["FR"], 1201 - 15)):
        face = a[r0:r1 + 1, x0 + 3:x1 - 2]
        # hold the outermost 5 px (8 mm: the gap shadows and the edges' highlights) at their neighbours' values
        face[:5] = face[5]
        face[-5:] = face[-6]
        face[:, :5] = face[:, 5:6]
        face[:, -5:] = face[:, -6:-5]
        face = cv2.GaussianBlur(face, (0, 0), 4.0)                    # 6 mm at 0.653 px per mm
        if cfg.get("glass"):
            # Black Glass: the photo's diagonal streaks are the studio's reflections in the glass, and the viewer's own light
            # reflects in the model's glass, so keep only the glass's own colour: each row's 25th percentile (the streak-free
            # part), smoothed down the door
            base = np.percentile(face, 25, axis=1)
            base = cv2.GaussianBlur(base[:, None, :], (0, 0), 12.0)[:, 0, :]
            face = np.repeat(base[:, None, :], face.shape[1], axis=1).astype(np.float32)
        px = PX_MM[c]
        w, h = round(700 * px), round(h_mm * px)
        img = cv2.resize(face, (w, h), interpolation=cv2.INTER_AREA)
        f = np.arange(h) / (h - 1)
        img *= np.interp(f, *zip(*GAIN[c][key]))[:, None, None]
        if c in LIN_K:
            v = np.clip(img / 255, 0, 1)
            v = np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4) * np.array(LIN_K[c], np.float32)
            v = np.clip(v, 0, 1)
            img = 255 * np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)
        if cfg["steel"]:
            img += brushed(w, h, strength=3.5 * px / 1.6)[:, :, None]
        out[key] = img
    return out


def doors():
    for c in COLOURS:
        f = door_field(c)
        save(Image.fromarray(f["fz"].clip(0, 255).astype(np.uint8)), f"door_freezer_{c}.jpg", q=88)
        save(Image.fromarray(f["fr"].clip(0, 255).astype(np.uint8)), f"door_fridge_{c}.jpg", q=88)


def side():
    # Samsung's 3/4 views (fhl_g_550460084/085): the sides read 80-88 near the top, 65-78 at mid-height and 56-58 at the foot;
    # the two dark codes' and the steel's sides are the same paint
    h, w = 768, 512
    yy = np.linspace(0, 1, h)[:, None]
    base = 80 - 22 * yy + 4 * np.exp(-((yy - 0.35) / 0.3) ** 2)
    speck = Image.fromarray(((rng.normal(0, 1, (h, w)) * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    s = (np.asarray(speck).astype(float) / 255 - 0.5) * 3.0
    img = np.stack([base + s, base + s + 1, base + s + 3], axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "side_paint.jpg")


def label(c):
    # Samsung's picture of the label: the sticker with its white margin and a thin pink cut line round it. The fill from
    # the border stops at the cut line, and the line itself is trimmed off (as tex_samsung_rt45.py does)
    src = Image.open(os.path.join(P, COLOURS[c]["label"])).convert("RGB")
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.min(2) < 225)
    lab = src.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3))
    # Samsung's picture's own 5.2 px per mm (about 680 px across the 130 mm label; 11 Nov: up from 546 px, so the small
    # print reads on 2-3x phone screens; the three labels still fit the GLB budget as 47-colour PNGs)
    lab = lab.convert("RGBA")
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
    q = lab.convert("RGB").quantize(colors=47, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(q).copy()
    idx[alpha < 128] = 47
    out = Image.frombytes("P", q.size, idx.astype(np.uint8).tobytes())
    out.putpalette(q.getpalette()[:47 * 3] + [255, 255, 255])
    p = os.path.join(D, f"label_{c}.png")
    out.save(p, optimize=True, transparency=bytes([255] * 47 + [0]))
    print("wrote", p, out.size, os.path.getsize(p) // 1024, "KB", "aspect h/w", round(out.height / out.width, 4))


def mark():
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = (52, 55, 61)
    out[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(out), "mark.png")


# ── the rear (fhl_g_550460086.jpg; the SHL's and BHL's galleries carry the same picture) ──
# body x 774-1277 (504 px for 700 mm, 0.720 px per mm across), top edge row 170, floor row 1469 (1299 px for 1820 mm,
# 0.714 up: the rear photo has the published proportions). The compressor bay opens at row 1276; the cabinet floor inside
# it is 77 mm up (row 1414). The cord leaves the cover's connector at (882, 478), runs straight down at x 882, turns at rows
# 1212-1245 and runs across at row 1246 to the plug, centred at (1197, 1247).
R_X0, R_X1, R_TOP, R_FLOOR, R_BAY, R_BAYFLOOR = 774, 1277, 170, 1469, 1276, 1414
PPM_X, PPM_Y = 504 / 700, 1299 / 1820
CORD = [(882, 480), (882, 600), (882, 750), (882, 900), (882, 1050), (882, 1180), (883, 1210), (886, 1224), (892, 1234),
        (900, 1240), (912, 1245), (930, 1246), (1000, 1246), (1080, 1246), (1150, 1246), (1172, 1246)]
PLUG = (1197, 1247)


def rear_y(row):
    """photo row -> height above the floor (metres)."""
    return (R_FLOOR - row) / PPM_Y / 1000


def rear():
    src = Image.open(os.path.join(P, "fhl_g_550460086.jpg")).convert("RGB")
    a = np.asarray(src).copy()
    mask = np.zeros(a.shape[:2], np.uint8)
    cv2.polylines(mask, [np.array(CORD, np.int32)], False, 255, 9, cv2.LINE_AA)
    cv2.rectangle(mask, (PLUG[0] - 28, PLUG[1] - 18), (PLUG[0] + 26, PLUG[1] + 18), 255, -1)   # plug and its strain relief
    cv2.rectangle(mask, (869, 466), (893, 486), 255, -1)                                        # the cord's connector
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    clean = cv2.inpaint(a, mask, 5, cv2.INPAINT_TELEA)
    x0, x1 = R_X0 + 5, R_X1 - 5
    panel = Image.fromarray(clean[R_TOP + 3:R_BAY, x0:x1])
    # the panel at about 1 px per mm (its dimples and the cover's relief read at that size; the photo has 0.72)
    panel = panel.resize((round(panel.width / PPM_X), round(panel.height / PPM_Y)), Image.LANCZOS)
    panel = panel.resize((panel.width * 3 // 4, panel.height * 3 // 4), Image.LANCZOS)
    save(panel, "rear.jpg", q=84)
    bay = Image.fromarray(a).crop((R_X0 + 8, R_BAY, R_X1 - 8, R_BAYFLOOR))
    save(bay.resize((bay.width * 2, bay.height * 2), Image.LANCZOS), "bay.jpg")
    xc = (R_X0 + R_X1) / 2
    to_m = lambda x, r: (round(-(x - xc) / PPM_X / 1000, 4), round(rear_y(r), 4))   # seen from behind: x mirrors
    json.dump({"ppm": [PPM_X, PPM_Y], "cord": [to_m(x, r) for x, r in CORD], "plug": to_m(*PLUG), "bay_top": round(rear_y(R_BAY), 4),
               "bay_floor": round(rear_y(R_BAYFLOOR), 4), "cord_d": 0.0065},
              open(os.path.join(D, "cord_path.json"), "w"), indent=1)
    print("wrote cord_path.json; bay top", round(rear_y(R_BAY), 3), "m")


# ── back-wall duct panels, redrawn (the RT45's drawing code, at this model's positions) ──
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


# Positions read off the open-door photo fhl_g_550460087 at the back wall: the front plane's 0.6236 px per mm (floor row
# 1401, cabinet top row 266), the eye 1.29 m up (the freezer floor reads edge-on there; shelves below it are seen from
# above, the freezer shelf from below) and the back wall at 0.88 of the front's size (its width against the opening's):
# x = (col - 932) / 548.8, y = 1.29 - (row - 597) / 548.8, in metres. Each panel is its box (x from the middle, y above the
# floor) and each mark is placed in the same metres.
FZ_PANEL = (-0.259, 0.261, 1.300, 1.745)
FR_PANEL = (-0.173, 0.160, 0.600, 1.160)


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
        th = 10 * PX / 2
        # five vent slots under the ceiling (photo row 359; x 805-837, 844-876, 905-955, 982-1013, 1021-1053)
        for xa, xb in ((-0.231, -0.173), (-0.160, -0.102), (-0.049, 0.042), (0.091, 0.148), (0.162, 0.220)):
            vent(d, (X(xa) + X(xb)) / 2, Y(1.724), X(xb) - X(xa), th)
        badge(d, X(-0.005), Y(1.656), 57 * PX)
        for gx in (-0.248, 0.235):          # the two small screw caps beside the badge (photo (796, 384), (1061, 384))
            d.ellipse((X(gx) * S - 6 * PX * S, Y(1.678) * S - 6 * PX * S, X(gx) * S + 6 * PX * S, Y(1.678) * S + 6 * PX * S), outline=(214, 217, 221, 255), width=2 * S)
        d.ellipse((X(-0.018) * S - 22 * PX * S, Y(1.379) * S - 22 * PX * S, X(-0.018) * S + 22 * PX * S, Y(1.379) * S + 22 * PX * S), outline=(150, 154, 160, 255), width=3 * S)
        # the thin rail across the right half (photo row 487) with its small dark tab
        line(d, [(X(-0.095), Y(1.490)), (X(0.255), Y(1.490))], 2.4, (212, 215, 219, 255))
        rrect(d, (X(0.180), Y(1.497), X(0.205), Y(1.483)), 2, fill=(120, 124, 130, 255))
        # two low vents over the floor (photo row 581)
        vent(d, (X(-0.100) + X(-0.049)) / 2, Y(1.319), X(-0.049) - X(-0.100), th / 2)
        vent(d, (X(0.033) + X(0.148)) / 2, Y(1.319), X(0.148) - X(0.033), th / 2)
    back_panel("back_freezer.png", FZ_PANEL, b)


def back_fridge():
    def b(d, X, Y, PX):
        ink = (96, 100, 108, 255)
        th = 5 * PX
        for y in (1.117, 1.006):                        # two pairs of slots: behind the Fresh Room and under it
            for xa, xb in ((-0.159, -0.113), (0.095, 0.144)):
                vent(d, (X(xa) + X(xb)) / 2, Y(y), X(xb) - X(xa), th)
        for xa, xb in ((-0.155, -0.104), (0.097, 0.148)):   # the darker pair under shelf 1 (photo row 844)
            vent(d, (X(xa) + X(xb)) / 2, Y(0.840), X(xb) - X(xa), th * 1.3, (40, 42, 46, 255))
        s = 33 * PX
        for i, x in enumerate((-0.053, -0.013, 0.029)):  # the Fresh Room's three icons, as on the RT45: roast, fish, steak
            cx, cy = X(x), Y(1.113)
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
        badge(d, X(-0.005), Y(0.931), 57 * PX)
        d.ellipse((X(-0.005) * S - 9 * PX * S, Y(0.721) * S - 9 * PX * S, X(-0.005) * S + 9 * PX * S, Y(0.721) * S + 9 * PX * S), outline=(170, 174, 180, 255), width=2 * S)
    back_panel("back_fridge.png", FR_PANEL, b)


def filter_print():
    # the Active Fresh Filter+ unit (Samsung's close-up g_550460089 and the open-door photo, rows 944-968, x 842-1019):
    # a light grey face, eleven louvres to each side and the name plate in the middle with "Active Fresh / Filter+"
    PX = 6
    wm, hm = 323, 44
    w, h = wm * PX, hm * PX
    img = Image.new("RGB", (w * S, h * S), (236, 238, 241))
    d = ImageDraw.Draw(img)
    rrect(d, (2, 2, w - 2, h - 2), 4 * PX, outline=(214, 217, 222), w=2.5)
    plate = (wm / 2 - 30, 7, wm / 2 + 30, hm - 7)
    for side in (-1, 1):
        xa, xb = (6, plate[0] - 5) if side < 0 else (plate[2] + 5, wm - 6)
        for k in range(8):
            y = 8 + k * 4
            rrect(d, (xa * PX, y * PX, xb * PX, (y + 1.4) * PX), 0.7 * PX, fill=(176, 180, 186))
    rrect(d, tuple(v * PX for v in plate), 2 * PX, fill=(212, 214, 218), outline=(190, 193, 198), w=2)
    f = font(AV, 6.2 * PX, 5)
    text(d, (wm / 2 * PX, (hm / 2 - 3.6) * PX), "Active Fresh", f, (70, 73, 80))
    text(d, (wm / 2 * PX, (hm / 2 + 3.8) * PX), "Filter⁺", f, (70, 73, 80))
    img = img.resize((w, h), Image.LANCZOS).quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    p = os.path.join(D, "filter_print.png")
    img.save(p, optimize=True)
    print("wrote", p, img.size)


def shared_prints():
    # the touch panel, "Big Box" and "Movable Ice Maker" are the same on this model as on the RT34 and RT45: run the RT34's
    # own drawing script, unchanged, into a scratch folder and keep those three
    tmp = tempfile.mkdtemp()
    argv = sys.argv
    sys.argv = ["tex_samsung_fridge.py", tmp]
    try:
        runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex_samsung_fridge.py"), run_name="__main__")
    finally:
        sys.argv = argv
    # drawn at 12 px per mm; kept at 8 (above the 7.2 the print needs at the 4 degree close-up), so the GLB with its three
    # colours stays within the fridge budget
    for n in ("inner_panel.png", "bigbox_print.png", "icemaker_print.png"):
        im = Image.open(os.path.join(tmp, "samsung", n))
        im = im.resize((round(im.width * 2 / 3), round(im.height * 2 / 3)), Image.LANCZOS)
        if im.mode == "RGBA":
            im = im.quantize(colors=64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        save(im, n)
    shutil.rmtree(tmp)


doors()
side()
for c in COLOURS:
    label(c)
mark()
rear()
back_freezer()
back_fridge()
filter_print()
shared_prints()
