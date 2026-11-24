"""Textures for the Godrej Eon Valor WTEON VAL 80 5.0 FDAN MTBK, 8 kg top-load washing machine (Metallic Black).

usage: python3 tex_godrej_val80.py <photos dir> <logos dir> <out dir>
  photos: godrej_val80/ (Godrej's own gallery for this model, 2754 x 3084, flattened on white and cropped; SOURCES.txt):
          panel.jpg     gallery 2, rows 1100-1900: the 8.0 kg control panel straight on (the only gallery picture with this
                        model's print; 1, 3 and 4 show the 7.5 kg heater panel and are used for shape only)
          rear.jpg      gallery 7, crop (744, 400): the back straight on
          side34.jpg    gallery 3, crop (1380, 560): the right side, 3/4 from the front
          detergent.jpg gallery 5, crop (900, 1450): the detergent box's lid seen from above
          lint_filter.jpg  Godrej's Magic Lint Filter feature picture for this model
  logos:  godrej.png (Godrej's script mark, logos/)
  writes <out dir>/godrej_val80/*

The control panel is drawn new at 12 px/mm: every word set again in Avenir Next and fitted to the box it has in Godrej's
photo, the LED dots and the button discs drawn as circles, the display window as a rectangle, the Godrej mark from the brand
PNG, and the icons (the soak/wash/rinse/spin pictograms, the water-level cups, the button icons, the child-lock padlock)
traced from the photo's ink: the ink upscaled and its edge set sharp. The print is cut into two pieces under 4096 px
(print_a/b.jpg, decals.json) laid on the panel glass as flat decals by make_godrej_val80.mjs.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
P = os.path.join(PHOTOS, "godrej_val80")
D = os.path.join(OUT, "godrej_val80")
os.makedirs(D, exist_ok=True)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"     # faces: 0 Bold, 2 Demi Bold, 5 Medium, 6 Medium Italic, 7 Regular
HELV = "/System/Library/Fonts/HelveticaNeue.ttc"     # 1 Bold
PX = 12.0                                            # px per mm for every print


def load(name):
    return np.asarray(Image.open(os.path.join(P, name)).convert("RGB")).astype(np.float32)


def save(a, name, q=88):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(D, name), quality=q, subsampling=0, optimize=True)
    print("wrote", name, a.shape[1], "x", a.shape[0])


def text_ink(s, face, px=400):
    f = ImageFont.truetype(face[0], px, index=face[1])
    l, t, r, b = f.getbbox(s)
    im = Image.new("L", (r - l + 40, b - t + 40), 0)
    ImageDraw.Draw(im).text((20 - l, 20 - t), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255.0
    ys, xs = np.where(a > 0.02)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def put(canvas, alpha, colour, x0, y0):
    """composite alpha (h, w) in colour at canvas px (x0, y0)"""
    h, w = alpha.shape
    X0, Y0 = max(0, x0), max(0, y0)
    X1, Y1 = min(canvas.shape[1], x0 + w), min(canvas.shape[0], y0 + h)
    if X1 <= X0 or Y1 <= Y0:
        return
    a = alpha[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0, None]
    canvas[Y0:Y1, X0:X1] = canvas[Y0:Y1, X0:X1] * (1 - a) + np.array(colour, np.float32) * a


def fit_box(canvas, alpha, colour, box):
    """resize an ink alpha exactly to a canvas box (x0, y0, x1, y1), the way the word sits in the photo"""
    x0, y0, x1, y1 = box
    w, h = max(1, int(round(x1 - x0))), max(1, int(round(y1 - y0)))
    a = cv2.resize(alpha, (w, h), interpolation=cv2.INTER_AREA)
    put(canvas, a, colour, int(round(x0)), int(round(y0)))


def ink_colour(photo, box, bg):
    """the ink's own colour: the mean of the box's pixels at >= 82 % of its brightest"""
    x0, y0, x1, y1 = box
    c = photo[y0:y1, x0:x1].reshape(-1, 3)
    L = c.mean(1)
    lo, hi = bg, L.max()
    sel = c[L >= lo + 0.82 * (hi - lo)]
    return tuple(float(v) for v in sel.mean(0))


def trace(photo, box, bg, scale, pad=3, gain=2.4):
    """an icon's ink from the photo, upscaled to the print's density and its edge set sharp (a trace, not a blur)"""
    x0, y0, x1, y1 = box
    c = photo[y0 - pad:y1 + pad, x0 - pad:x1 + pad].mean(2)
    peak = np.percentile(c, 99.5)
    a = np.clip((c - bg) / max(1.0, peak - bg), 0, 1)
    h, w = a.shape
    big = cv2.resize(a, (int(round(w * scale)), int(round(h * scale))), interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), scale * 0.25)
    return np.clip((big - 0.5) * gain + 0.5, 0, 1)


# ── the control panel ─────────────────────────────────────────────────────────────────────────────────────────────────────
# Godrej's panel photo (gallery 2) looks straight at the panel's glass. Its white rim, the glass's edge, is 2498 px across at
# photo row 1300 and 2520 px at row 1500 (a slight keystone), centred on column 1377; it runs from row 1160 to row 1708.
# The glass is taken as 505 x 110 mm (the rim's outer edge; Godrej publishes no panel size: ESTIMATED from the 542 mm
# cabinet in the front photo, where the console is 529 mm and the rim 505 mm across). panel.jpg starts at photo row 1100.
PW, PH = 505.0, 110.0
CX, ROW0, ROWB = 1377.0, 1160.0, 1708.0


def sc_at(Y):
    return (2498.0 + (Y - 1300.0) * 0.11) / PW


SV = (ROWB - ROW0) / PH


def to_mm(X, Y):
    return (X - CX) / sc_at(Y), (Y - ROW0) / SV


def to_px(u, v):
    return (u + PW / 2) * PX, v * PX


def box_px(X0, Y0, X1, Y1):
    u0, v0 = to_mm(X0, Y0)
    u1, v1 = to_mm(X1, Y1)
    a, b = to_px(u0, v0)
    c, d = to_px(u1, v1)
    return a, b, c, d


def panel():
    photo = load("panel.jpg")
    full = np.zeros((int(1900 + 1), photo.shape[1], 3), np.float32)
    full[1100:1100 + photo.shape[0]] = photo           # photo rows as in Godrej's full picture
    TW, TH = int(round(PW * PX)), int(round(PH * PX))
    GROUND = (6.0, 6.0, 7.0)                           # the glass's black (photo 6)
    cv = np.zeros((TH, TW, 3), np.float32) + np.array(GROUND, np.float32)
    k = PX / sc_at(1450)                               # photo px -> print px

    # the rim: a light line round the glass's edge, 1.1 mm wide, corners r 11 mm (photo)
    im = Image.new("L", (TW * 2, TH * 2), 0)
    ImageDraw.Draw(im).rounded_rectangle((2, 2, TW * 2 - 3, TH * 2 - 3), radius=int(11 * PX * 2), outline=255, width=int(1.1 * PX * 2))
    rim = cv2.resize(np.asarray(im).astype(np.float32) / 255, (TW, TH), interpolation=cv2.INTER_AREA)
    put(cv, rim, (214, 214, 212), 0, 0)

    # words: (text, photo box, face); every box measured on panel.jpg's ink (connected components, full-picture rows)
    MED, IT = (AVENIR, 5), (AVENIR, 6)
    words = [
        ("Auto", (619, 1330, 662, 1344), MED), ("Sports Wear", (790, 1329, 901, 1347), MED),
        ("Soak", (973, 1331, 1014, 1345), MED), ("Wash", (1036, 1331, 1084, 1345), MED),
        ("Rinse", (1103, 1331, 1149, 1345), MED), ("Spin", (1171, 1331, 1208, 1348), MED),
        ("High", (1831, 1329, 1873, 1347), MED), ("Regular", (612, 1370, 679, 1388), MED),
        ("Gentle", (809, 1370, 869, 1384), MED), ("Medium", (1782, 1370, 1855, 1384), MED),
        ("Strong", (637, 1411, 697, 1429), MED), ("Rinse", (826, 1410, 874, 1425), MED),
        ("Low", (1803, 1412, 1840, 1425), MED), ("Quick Wash", (612, 1451, 720, 1468), MED),
        ("Spin", (844, 1451, 883, 1469), MED), ("Minimum", (1735, 1451, 1821, 1466), MED),
        ("PROGRAM", (746, 1592, 849, 1607), MED), ("DELAY", (968, 1604, 1033, 1619), MED),
        ("WATER LEVEL", (1733, 1607, 1875, 1621), MED), ("8.0 kg", (262, 1601, 353, 1633), MED),
        ("~Zero Pressure (0.02MPa) technology", (2157, 1618, 2460, 1634), IT),
    ]
    # Hr. and Min. beside the display: their boxes from the ink round the display window
    reg = full[1340:1430, 1240:1520].mean(2)
    bright = reg > 120
    cols = np.where(bright.any(0))[0]
    left = cols[cols < 60]
    right = cols[cols > 200]
    for s, cs in (("Hr.", left), ("Min.", right)):
        rows = np.where(bright[:, cs.min():cs.max() + 1].any(1))[0]
        words.append((s, (1240 + cs.min(), 1340 + rows.min(), 1240 + cs.max() + 1, 1340 + rows.max() + 1), MED))
    for s, b, face in words:
        col = ink_colour(full, b, 6)
        fit_box(cv, text_ink(s, face), col, box_px(*b))
        print(f"  {s!r}: {to_mm(b[0], b[1])[0]:.1f},{to_mm(b[0], b[1])[1]:.1f} mm, {(b[2]-b[0])/sc_at(b[1]):.1f} x {(b[3]-b[1])/SV:.1f} mm, colour {tuple(round(c) for c in col)}")

    # the display window: the grey rectangle between Hr. and Min. (fill 68 in the photo), corners r 0.6 mm
    win = ((reg > 50) & (reg < 100)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(win)
    big = 1 + int(np.argmax(st[1:, 4]))                # the window itself, not the words' anti-aliased edges
    ys, xs = np.where(lab == big)
    dbox = (1240 + xs.min(), 1340 + ys.min(), 1240 + xs.max() + 1, 1340 + ys.max() + 1)
    a, b, c, d = box_px(*dbox)
    im = Image.new("L", (TW, TH), 0)
    ImageDraw.Draw(im).rounded_rectangle((a, b, c, d), radius=int(0.6 * PX), fill=255)
    put(cv, np.asarray(im).astype(np.float32) / 255, (68, 68, 70), 0, 0)
    print("  display", [round(v, 1) for v in to_mm(dbox[0], dbox[1]) + to_mm(dbox[2], dbox[3])])

    # LED dots: small dark-grey discs (photo 66) beside every option word
    sub = full[1320:1480, 560:1960].mean(2)
    m = ((sub > 40) & (sub < 110)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    dots = []
    for i in range(1, n):
        x, y, w, h, ar = st[i]
        if 8 <= w <= 15 and 8 <= h <= 15 and ar > 50 and abs(w - h) <= 3:
            dots.append((560 + cen[i][0], 1320 + cen[i][1], (w + h) / 4))
    for X, Y, r in dots:
        u, v = to_mm(X, Y)
        px, py = to_px(u, v)
        R = 1.15 * PX                                  # 2.3 mm across (11-12 px in the photo)
        im = Image.new("L", (int(R * 2 + 4) * 2, int(R * 2 + 4) * 2), 0)
        ImageDraw.Draw(im).ellipse((4, 4, im.width - 4, im.height - 4), fill=255)
        al = cv2.resize(np.asarray(im).astype(np.float32) / 255, (int(R * 2 + 4), int(R * 2 + 4)), interpolation=cv2.INTER_AREA)
        put(cv, al, (66, 66, 69), int(px - al.shape[1] / 2), int(py - al.shape[0] / 2))
    print(f"  {len(dots)} LED dots")

    # buttons: a dark disc (photo 52) inside a raised chrome ring (modelled; buttons.json gives each centre and radius)
    buttons = {"program": (797, 1538, 45), "delay": (999, 1539, 45), "start": (1311, 1550, 53), "power": (1433, 1551, 45), "water": (1803.5, 1543, 45.5)}
    out_b = {}
    for key, (X, Y, r) in buttons.items():
        u, v = to_mm(X, Y)
        R = r / sc_at(Y)
        out_b[key] = {"u": round(u, 2), "v": round(v, 2), "r": round(R, 2)}
        px, py = to_px(u, v)
        Rp = R * PX
        im = Image.new("L", (int(Rp * 2 + 8) * 2, int(Rp * 2 + 8) * 2), 0)
        ImageDraw.Draw(im).ellipse((8, 8, im.width - 8, im.height - 8), fill=255)
        al = cv2.resize(np.asarray(im).astype(np.float32) / 255, (int(Rp * 2 + 8), int(Rp * 2 + 8)), interpolation=cv2.INTER_AREA)
        put(cv, al, (52, 52, 53), int(round(px - al.shape[1] / 2)), int(round(py - al.shape[0] / 2)))
    print("  buttons", out_b)

    # icons traced from the photo's ink: (photo box, background level)
    icons = [
        ((981, 1363, 1011, 1393), 6), ((1046, 1365, 1075, 1393), 6), ((1111, 1362, 1140, 1393), 6), ((1176, 1363, 1204, 1393), 6),
        ((1925, 1331, 1980, 1344), 6), ((1908, 1372, 1962, 1385), 6), ((1890, 1413, 1913, 1426), 6), ((1872, 1453, 1896, 1467), 6),
        ((892, 1548, 914, 1577), 6),                  # the child-lock padlock between PROGRAM and DELAY
        ((777, 1511, 818, 1545), 52), ((972, 1513, 1027, 1566), 52), ((1286, 1531, 1335, 1570), 52),
        ((1415, 1529, 1451, 1570), 52), ((1789, 1528, 1819, 1558), 52),   # on the button discs (photo 52)
    ]
    for (x0, y0, x1, y1), bg in icons:
        # the icon's own ink box: the brighter pixels inside the given box
        c = full[y0:y1, x0:x1].mean(2)
        thr = bg + 0.35 * (c.max() - bg)
        ys, xs = np.where(c > thr)
        b = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
        col = ink_colour(full, b, bg)
        a = trace(full, b, bg, k)
        pad = 3
        u, v = to_mm(b[0] - pad, b[1] - pad)
        px, py = to_px(u, v)
        put(cv, a, col, int(round(px)), int(round(py)))
    # the dotted line from PROGRAM's disc to DELAY's (photo row 1531-1533, dashes 4 px long every 8 px)
    u0, v0 = to_mm(845, 1532)
    u1, _ = to_mm(952, 1532)
    x = u0
    while x < u1 - 0.4:
        a, b = to_px(x, v0 - 0.3)
        c, d = to_px(min(x + 0.8, u1), v0 + 0.3)
        im = Image.new("L", (TW, 1), 0)
        cv[int(b):int(d) + 1, int(a):int(c)] = np.array((190, 190, 190), np.float32)
        x += 1.6

    # the Godrej mark (logos/godrej.png's alpha), white, in its photo box
    logo = np.asarray(Image.open(os.path.join(LOGOS, "godrej.png")).convert("RGBA"))[..., 3].astype(np.float32) / 255
    ys, xs = np.where(logo > 0.02)
    logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    fit_box(cv, logo, ink_colour(full, (2265, 1378, 2447, 1467), 6), box_px(2265, 1378, 2447, 1467))

    # two pieces, cut at u = +45 mm (an empty strip between the power key and the water-level options), each cropped to the
    # rows holding ink; decals.json gives each piece's rectangle in the glass's UVs (u 0..1 left to right, v 0..1 top down)
    cut = int(round((45 + PW / 2) * PX))
    rects = {}
    for key, (xa, xb) in (("printA", (0, cut)), ("printB", (cut, TW))):
        name = f"print_{key[-1].lower()}.jpg"
        save(cv[:, xa:xb], name)
        rects[key] = {"file": name, "rect": [xa / TW, 0.0, xb / TW, 1.0]}
    json.dump(rects, open(os.path.join(D, "decals.json"), "w"), indent=1)
    json.dump({"panel_mm": [PW, PH], "buttons": out_b}, open(os.path.join(D, "panel.json"), "w"), indent=1)
    small = cv2.resize(cv, (TW // 6, TH // 6), interpolation=cv2.INTER_AREA)
    Image.fromarray(np.clip(small, 0, 255).astype(np.uint8)).save(os.path.join(D, "_panel_preview.png"))


# ── the detergent box's lid: "DETERGENT" and the scoop icon, white on black ───────────────────────────────────────────────
# detergent.jpg (gallery 5 from above, crop origin (900, 1450)): the lid is black from row 1572 to 1682 and 624 px across,
# centred on column 1377 (full picture). The lid is taken as 148 x 32 mm (ESTIMATED: 4.22 px/mm at its depth, read off
# the well's 450 mm opening in the same picture).
def detergent():
    photo = load("detergent.jpg")
    full = np.zeros((1950, 1800, 3), np.float32)
    full[1450:1450 + photo.shape[0], 900:900 + photo.shape[1]] = photo
    LW, LD = 148.0, 32.0
    TW, TH = int(LW * PX), int(LD * PX)
    cv = np.zeros((TH, TW, 3), np.float32) + 8.0
    X0, X1, Y0, Y1 = 1377 - 312, 1377 + 312, 1572, 1682
    tob = lambda X, Y: ((X - X0) / (X1 - X0) * TW, (Y - Y0) / (Y1 - Y0) * TH)
    # the word: its ink box in the photo
    c = full[1638:1672, 1150:1600].mean(2)
    ys, xs = np.where(c > 120)
    b = (1150 + xs.min(), 1638 + ys.min(), 1150 + xs.max() + 1, 1638 + ys.max() + 1)
    a, bb = tob(b[0], b[1])
    cc, d = tob(b[2], b[3])
    # the photo sees the lid from above at a slant: its rows are foreshortened to 0.81 (the lid's 32 mm reads 26 mm at the
    # picture's 4.22 px/mm), so the letters stand (d - bb) / 0.81 tall. Godrej's letters are an extended bold sans (each about
    # 1.4 times as wide as tall) spaced wide: Helvetica Neue Bold widened 1.6 times, the letters spread to the photo's width.
    F = 1 / 0.81
    hh = (d - bb) * F
    mid = (bb + d) / 2
    letters = [text_ink(ch, (HELV, 1)) for ch in "DETERGENT"]
    ws = [l.shape[1] * hh / l.shape[0] * 1.6 for l in letters]
    gap = ((cc - a) - sum(ws)) / (len(ws) - 1)
    x = a
    for l, w in zip(letters, ws):
        fit_box(cv, l, (238, 238, 238), (x, mid - hh / 2, x + w, mid + hh / 2))
        x += w + gap
    print(f"  DETERGENT box {b}, {(cc - a) / PX:.1f} x {hh / PX:.1f} mm, letter gap {gap / PX:.2f} mm")
    # the scoop icon above it, traced, its rows stretched back by the same 1 / 0.81
    c = full[1600:1640, 1300:1460].mean(2)
    ys, xs = np.where(c > 110)
    ib = (1300 + xs.min(), 1600 + ys.min(), 1300 + xs.max() + 1, 1600 + ys.max() + 1)
    ia = trace(full, ib, 8, TW / (X1 - X0), pad=2)
    ia = cv2.resize(ia, (ia.shape[1], int(ia.shape[0] * F)), interpolation=cv2.INTER_CUBIC)
    px, py = tob(ib[0] - 2, ib[1] - 2)
    put(cv, np.clip(ia, 0, 1), (238, 238, 238), int(px), int(mid - (mid - py) * F))
    save(cv, "detergent.jpg")


# ── the right side: Godrej's 3/4 photo, straightened ──────────────────────────────────────────────────────────────────────
# side34.jpg (gallery 3, crop origin (1380, 560)). The side's corners in the full picture (its top edge is the cabinet's
# top, under the top cover; its bottom the cabinet's lower edge), read off the side's outline and the cover seam:
#   front top (1495, 968), back top (2072, 820), front bottom (1495, 2559), back bottom (2072, 2246).
# Straightened to 560 x 772 mm (the flat side between the corner radii; 0.052 to 0.824 m) at 1.6 px/mm. The studio light is
# divided out (a smooth fit of the row and column means), keeping the pressings and the handle recess, then set to the side's
# own level so the model's light does the shading.
def side():
    photo = load("side34.jpg")
    src = np.float32([[1495, 968], [2072, 820], [2072, 2246], [1495, 2559]]) - np.float32([1380, 560])
    SW, SH = int(560 * 1.6), int(772 * 1.6)
    dst = np.float32([[0, 0], [SW, 0], [SW, SH], [0, SH]])
    M = cv2.getPerspectiveTransform(src, dst)
    s = cv2.warpPerspective(photo, M, (SW, SH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    L = s.mean(2)
    low = cv2.GaussianBlur(L, (0, 0), 60)
    rel = L / np.maximum(low, 1)
    rel = 1 + (rel - 1) * 0.9                                   # keep 90 % of the relief
    base = np.array((62, 63, 66), np.float32)                   # Metallic Black: the side's mean in Godrej's photo is 48 under
    out = base * rel[..., None]                                 # a side light; the front, lit, reads 69-75
    save(out, "side.jpg", 86)


# ── the back: Godrej's rear photo, the cord and the plug painted out (they are modelled) ──────────────────────────────────
# rear.jpg (gallery 7, crop origin (744, 400)): the body spans columns 764-1998 and rows 423-2643 of the full picture,
# 2.277 px/mm. back.jpg = the cabinet's back (0.045 to 0.893 m), back_top.jpg = the console's back (0.893 to 0.968 m, 6 mm in
# from each side). The cord's path (cord.json, metres) is traced in the full picture's coordinates.
CORD = [(1944, 760), (1945, 860), (1924, 1000), (1874, 1400), (1824, 1680), (1764, 1960), (1684, 2160), (1604, 2300),
        (1504, 2380), (1424, 2394), (1344, 2390), (1264, 2350), (1204, 2240), (1164, 2120), (1146, 2000)]
PLUG = (1144, 1935)       # the plug in its holder (the triangular pocket), its face about 100 x 120 px


def back():
    photo = load("rear.jpg")
    ox, oy = 744, 400
    K = 2.277
    cx, y0 = 1381.0, 2643.0
    # paint out the cord and the plug
    # the cord's own dark pixels within 40 px of its traced path, and the plug's box, grown 5 px
    near = np.zeros(photo.shape[:2], np.uint8)
    pts = np.int32([[x - ox, y - oy] for x, y in CORD])
    cv2.polylines(near, [pts], False, 255, 70)
    L8 = np.clip(photo.mean(2), 0, 255).astype(np.uint8)
    bgL = cv2.medianBlur(cv2.medianBlur(L8, 51), 51).astype(np.float32)
    dark = (photo.mean(2) < bgL - 5).astype(np.uint8) * 255
    mask = cv2.bitwise_and(near, dark)
    cv2.rectangle(mask, (PLUG[0] - ox - 62, PLUG[1] - oy - 85), (PLUG[0] - ox + 62, PLUG[1] - oy + 85), 255, -1)
    mask = cv2.dilate(mask, np.ones((15, 15), np.uint8))
    # each masked run of a row is filled by a straight blend between the pixels just left and right of it (the panel behind
    # the cord is plain across a row), then the fill is softened a little along the cord
    img = photo.copy()
    m = mask > 0
    for y in range(img.shape[0]):
        xs = np.where(m[y])[0]
        if not len(xs):
            continue
        runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
        for r in runs:
            a, b = max(0, r[0] - 3), min(img.shape[1] - 1, r[-1] + 3)
            ca, cb = photo[y, max(0, a - 4):a + 1].mean(0), photo[y, b:b + 5].mean(0)
            t = np.linspace(0, 1, b - a + 1)[:, None]
            img[y, a:b + 1] = ca * (1 - t) + cb * t
    soft = cv2.GaussianBlur(img, (0, 0), 2.5)
    w = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 2)[..., None]
    img = img * (1 - w) + soft * w
    def crop(y_lo, y_hi, half):
        r0, r1 = int(round(y0 - y_hi * 1000 * K)) - oy, int(round(y0 - y_lo * 1000 * K)) - oy
        c0, c1 = int(round(cx - half * 1000 * K)) - ox, int(round(cx + half * 1000 * K)) - ox
        return img[r0:r1, c0:c1]
    save(crop(0.045, 0.893, 0.271 - 0.002) * 0.92, "back.jpg", 86)
    save(crop(0.893, 0.968, 0.2645 - 0.006) * 0.92, "back_top.jpg", 86)
    to_m = lambda X, Y: [round(-(X - cx) / K / 1000, 4), round((y0 - Y) / K / 1000, 4)]
    json.dump({"cord": [to_m(x, y) for x, y in CORD], "plug": to_m(*PLUG)}, open(os.path.join(D, "cord.json"), "w"))


# ── the drum: stainless steel, perforated (holes on a staggered grid) ─────────────────────────────────────────────────────
# Godrej's drum pictures (gallery 5 and the Gravity Drum feature picture) show small round holes in diagonal bands and
# raised contour ribs; the tile is 100 x 100 mm at 5 px/mm with 2.6 mm holes on a 10 mm staggered grid (ESTIMATED).
def drum():
    T = 512
    rng = np.random.default_rng(7)
    base = 168 + rng.normal(0, 3, (T, T)).astype(np.float32)
    base = cv2.GaussianBlur(base, (0, 0), 1.2)
    # brushed: faint horizontal streaks
    streak = cv2.GaussianBlur(rng.normal(0, 6, (T, 1)).astype(np.float32), (0, 0), 1.0)
    base = base + streak
    im = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert("RGB").resize((T * 2, T * 2))
    d = ImageDraw.Draw(im)
    step = T * 2 / 10
    for j in range(10):
        for i in range(10):
            x = (i + 0.5 * (j % 2)) * step + step / 4
            y = j * step + step / 2
            r = 2.6 / 2 * (T * 2 / 100)
            d.ellipse((x - r, y - r, x + r, y + r), fill=(58, 60, 64))
    a = np.asarray(im.resize((T, T), Image.LANCZOS)).astype(np.float32)
    save(a * np.array((1.0, 1.01, 1.03)), "drum.jpg", 86)


# ── the Magic Lint Filter: Godrej's feature picture of it (lavender cartridge with slotted ends) ────────────────────────────
def lint_filter():
    photo = load("lint_filter.jpg")
    # the cartridge stands left of the middle of the picture: columns 292-450, rows 305-712 (picture 918 x 1028)
    c = photo[305:712, 292:450]
    save(cv2.resize(c, (128, 330), interpolation=cv2.INTER_AREA), "filter.jpg", 86)


panel()
detergent()
side()
back()
drum()
lint_filter()
