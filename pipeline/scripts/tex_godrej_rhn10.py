"""Textures for the Godrej Eon Rhine 10 kg top-load washer (WTEON RHN 10 5.0 FEFH C GLGR), from Godrej's own gallery
(pipeline/sources/photos/godrej_rhn10/: front, back, panel, drum, left34, right34, top_front; 3060 x 3426 renders).

    python3 tex_godrej_rhn10.py [--debug <dir>]

Writes pipeline/tex/godrej_rhn10/:
  front.jpg      the cabinet's front, from the front photo (it is square-on: the front's edges stay 1539 px apart all the way down)
  side_l/r.jpg   the cabinet's sides, warped flat from the 3/4 photos (the racetrack pressings and the side grip)
  back.jpg       the back, from the rear photo, its cord kept (the builder lays a modelled cord over it)
  housing.jpg    the panel housing's back (the grey plate above the cord)
  panel.jpg      the control panel's glass at 4 px/mm (the whole panel; the print is also cut out sharp, below)
  print_*.jpg    the panel's print drawn again at 12 px/mm and cut to the ink (decal_cut.py) + decals.json
  drum.jpg, pulsator.jpg, filter.jpg   the inside, from the drum photo

The panel print: Godrej's panel photo was warped flat (its four corners below) to the panel's own frame, 580 x 156 mm
(ESTIMATED: 580 wide from the lid's 600 at the photo's own ratio, 2269 / 2348 px; 156 along the slope from the power key's
round ring, which the photo foreshortens to 0.94). On that frame the print is drawn again:
  - the words set in Avenir Next, each fitted to the ink box it has in the photo (tex_lg_panel's method);
  - the line art, icons and key bars traced as shapes: the photo's ink, interpolated 3x and cut at half its contrast
    (an iso-line, so straight strokes come out straight and sharp, not blurred);
  - the display's two digits as seven-segment shapes, the logo from logos/godrej.png.
The photo's "12.0 kg" capacity print is left off: this is the 10 kg model (Godrej's page, Sangeetha, BEE's register) and
Godrej's gallery for it shows a 12 kg panel; no source shows this model's own capacity print.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import decal_cut  # noqa: E402

SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(SITE, "pipeline", "sources", "photos", "godrej_rhn10")
OUT = os.path.join(SITE, "pipeline", "tex", "godrej_rhn10")
LOGO = os.path.join(SITE, "logos", "godrej.png")
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"   # faces: 0 Bold, 2 Demi Bold, 5 Medium, 6 Medium Italic, 7 Regular, 8 Italic
DEBUG = sys.argv[sys.argv.index("--debug") + 1] if "--debug" in sys.argv else None
os.makedirs(OUT, exist_ok=True)

# ── sizes (mm), the same as the builder's ──
W_MM, D_MM, H_MM = 620, 605, 1020          # Sangeetha's listing (62 x 60.5 x 102 cm)
PLINTH_TOP, BODY_TOP = 104, 886            # front photo rows 2708 and 800 (2.439 px/mm, from the feet at row 2962)
PW, PL = 580, 156                          # the control panel's glass: width, length along its slope (ESTIMATED, above)
GLASS = (14, 14, 15)                       # the panel glass where the photo has no ink (median of the warped panel)


def load(name):
    return cv2.imread(os.path.join(SRC, name), cv2.IMREAD_COLOR)[:, :, ::-1].astype(np.float32)


def save(a, name, q=88):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=q, subsampling=0, optimize=True)
    print(name, a.shape[1], "x", a.shape[0])


def warp(img, quad, w, h):
    M = cv2.getPerspectiveTransform(np.float32(quad), np.float32([[0, 0], [w, 0], [w, h], [0, h]]))
    return cv2.warpPerspective(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


# ── the control panel ─────────────────────────────────────────────────────────────────────────────────────────────────
# Its corners in panel.jpg: the side edges are straight lines (rows 1000-1420: x 429 -> 396 on the left, 2630 -> 2665 on
# the right), carried up to the top edge at row 865 (the top corners themselves are rounded) and down to row 1428, where
# the glass meets the lid's blue rim.
PANEL_QUAD = [(440.5, 865), (2618.6, 865), (2665, 1428), (396, 1428)]
P0 = 3.9                                   # px per mm of the flat panel taken from the photo


def panel_flat():
    a = warp(load("panel.jpg"), PANEL_QUAD, round(PW * P0), round(PL * P0))
    return a


PS = 12.0                                  # px per mm of the print drawn again
WHITE = (240, 240, 242)

# Every word on the panel: (text, rough box in the flat photo's px (x0, y0, x1, y1), Avenir Next face). The word's own ink box
# is found inside the rough one; the word is set in that box and its colour is the photo's (the mean of its brightest ink).
# Faces: 5 Medium (labels), 6 Medium Italic (the programme numbers and the small italic captions), 2 Demi Bold (key names).
PROGRAMS = ["Auto / Mix Fabric", "Tub Clean", "Hot Wash", "Saree", "Cotton", "Woollens", "Bulky / Denim", "Anti Wrinkle",
            "Quick Wash", "Delicate / Baby Care"]
PROG_Y = [135, 161.5, 187, 213, 238.5, 264.6, 290.8, 316, 342, 368]     # each programme line's middle row
WORDS = [
    ("Water Level Code", (520, 130, 645, 150), 6),
    ("Soak", (935, 178, 989, 193), 5), ("Wash", (935, 206, 989, 221), 5),
    ("Rinse", (935, 234, 989, 249), 5), ("Spin", (935, 262, 989, 277), 5),
    ("Remaining Time (Min)", (1062, 174, 1200, 193), 6),
    ("Delay (Hrs)", (1062, 276, 1140, 296), 6),
    ("WiFi", (1252, 174, 1300, 194), 5),
    ("WATER LEVEL", (795, 428, 925, 452), 5), ("CYCLE", (975, 428, 1042, 452), 5),
    ("DELAY", (1085, 428, 1156, 452), 5), ("PROGRAM", (1178, 428, 1280, 452), 5),
    ("Inbuilt Heater", (1950, 493, 2084, 519), 6),
    ("~ Zero Pressure (0.02MPa) Technology", (1800, 530, 2084, 552), 6),
]
LEVELS = [548, 586, 625, 663, 702, 740, 778, 815]                     # the eight water-level cups' centres (L1-L8)
CHILD_LOCK = [("Child", (1153, 367, 1193, 385)), ("Lock", (1155, 385, 1191, 400))]
GOLD = (232, 203, 120)                                                 # "Hot Wash", "Inbuilt Heater" and their icons (photo's ink, x1.08)
HEATER_ICON = (2084, 490, 2110, 522)                                  # the thermometer after "Inbuilt Heater" (another follows "Hot Wash")
PROGRAMS_V = (156, 222, 182, 300)                                      # "Programs", set upright beside the list
DISPLAY = (1068, 196, 1172, 274)                                       # the display window (grey) with its two digits
LOGO_BOX = (1905, 85, 2130, 200)
ERASE = [(80, 495, 225, 545)]                                          # the photo's "12.0 kg" (a 12 kg panel; see above)


def text_ink(s, face, px=300):
    f = ImageFont.truetype(AVENIR, px, index=face)
    l, t, r, b = f.getbbox(s)
    im = Image.new("L", (r - l + 40, b - t + 40), 0)
    ImageDraw.Draw(im).text((20 - l, 20 - t), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.5)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def text_ink_base(s, face, px=300):
    """The word's ink, plus where its top-of-ink and its baseline are (rows of the returned array)."""
    f = ImageFont.truetype(AVENIR, px, index=face)
    l, t, r, b = f.getbbox(s)
    im = Image.new("L", (r - l + 40, b - t + 40), 0)
    ImageDraw.Draw(im).text((20 - l, 20 - t), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.5)
    base = 20 - t + f.getmetrics()[0]                         # the baseline's row in im
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], base - ys.min()


def place(c, ink, box, colour, k):
    """Fit an ink mask exactly to box (x0, y0, x1, y1, flat photo px) on the canvas c (k canvas px per photo px)."""
    x0, y0, x1, y1 = box
    u0, v0 = round(x0 * k), round(y0 * k)
    w, h = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
    m = np.asarray(Image.fromarray((ink * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    m = np.clip((m - 0.5) * 1.6 + 0.5, 0, 1)
    sub = c[v0:v0 + h, u0:u0 + w]
    sub[:] = sub * (1 - m[..., None]) + np.asarray(colour, np.float32) * m[..., None]


def ink_box(lum, box, thr=95):
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    ys, xs = np.where(lum[y0:y1, x0:x1] > thr)
    return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)


def ink_colour(flat, lum, b):
    x0, y0, x1, y1 = b
    L, C = lum[y0:y1, x0:x1], flat[y0:y1, x0:x1]
    sel = L >= 0.82 * L.max()
    col = C[sel].mean(0)
    return tuple(float(v) for v in col * min(1.0, 245 / max(col.max(), 1)) * 1.04)


def seg7(c, box, colour, k):
    """Two seven-segment 8s in the display window (all segments lit, as the photo shows), hexagonal bars, slanted 6 deg."""
    x0, y0, x1, y1 = [v * k for v in box]
    im = Image.new("L", (round(x1 - x0) * 4, round(y1 - y0) * 4), 0)
    d = ImageDraw.Draw(im)
    W4, H4 = im.size
    dw, dh = W4 * 0.30, H4 * 0.62          # one digit's width and height (photo: 21 x 45 px in a 104 x 78 px window)
    t = dw * 0.18
    g = t * 0.25
    sl = np.tan(np.radians(6))
    for i, cx in enumerate((W4 * 0.33, W4 * 0.69)):
        top = (H4 - dh) / 2
        def bar(xa, ya, xb, yb):
            if abs(ya - yb) < 1e-6:            # horizontal
                pts = [(xa + g, ya), (xa + g + t / 2, ya - t / 2), (xb - g - t / 2, ya - t / 2), (xb - g, ya), (xb - g - t / 2, ya + t / 2), (xa + g + t / 2, ya + t / 2)]
            else:
                pts = [(xa, ya + g), (xa + t / 2, ya + g + t / 2), (xa + t / 2, yb - g - t / 2), (xa, yb - g), (xa - t / 2, yb - g - t / 2), (xa - t / 2, ya + g + t / 2)]
            d.polygon([(x + (top + dh - y) * sl, y) for x, y in pts], fill=255)
        L, R, T, M, B = cx - dw / 2, cx + dw / 2, top, top + dh / 2, top + dh
        for seg in ((L, T, R, T), (L, M, R, M), (L, B, R, B), (L, T, L, M), (R, T, R, M), (L, M, L, B), (R, M, R, B)):
            bar(*seg)
    m = np.asarray(im.resize((round(x1 - x0), round(y1 - y0)), Image.LANCZOS)).astype(np.float32)[..., None] / 255
    sub = c[round(y0):round(y0) + m.shape[0], round(x0):round(x0) + m.shape[1]]
    sub[:] = sub * (1 - m) + np.asarray(colour, np.float32) * m


def thermometer(h=400):
    """The heater icon as the photo draws it: a bulb with the stem rising out of it (outlined), three ticks on the right."""
    w = round(h * 0.62)
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    lw = round(h * 0.075)
    sx0, sx1 = round(w * 0.12), round(w * 0.52)                  # the stem's outline
    d.rounded_rectangle([sx0, 0, sx1, round(h * 0.72)], radius=(sx1 - sx0) // 2, outline=255, width=lw)
    r = round(h * 0.2)
    cx, cy = (sx0 + sx1) // 2, h - r - 1
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)        # the bulb
    d.rectangle([cx - lw // 2, round(h * 0.3), cx + lw // 2, cy], fill=255)
    for t in (0.12, 0.28, 0.44):
        y = round(h * t)
        d.rectangle([sx1 + lw, y, w - 1, y + lw], fill=255)
    return np.asarray(im).astype(np.float32) / 255


def panel_print():
    """The panel's print at PS px per mm, PW x PL mm, on the plain glass."""
    flat = panel_flat()
    lum = flat.mean(2)
    k = PS / P0
    Hh, Ww = round(PL * PS), round(PW * PS)
    erase = np.zeros(lum.shape, bool)
    texts = []                                                   # (ink, box, colour)

    def word(s, rough, face, cut=None):
        b = ink_box(lum, rough)
        if cut: b = (b[0], b[1], min(b[2], cut), b[3])
        erase[b[1] - 1:b[3] + 1, b[0] - 1:b[2] + 1] = True
        texts.append((text_ink(s, face), b, ink_colour(flat, lum, b)))
        return b

    def runs(y, x0, x1, merge=5):
        """Column runs of ink on the programme line round row y, from x0: [(start, end)], gaps up to `merge` px joined."""
        band = lum[int(y - 8):int(y + 9), x0:x1] > 95
        cols = np.where(band.sum(0) >= 2)[0] + x0
        out = []
        for c_ in cols:
            if out and c_ - out[-1][1] <= merge: out[-1][1] = c_ + 1
            else: out.append([c_, c_ + 1])
        return out

    thermo = []
    # the numbers start at column 194 (186 for "10"), the words at 215 (209): read off the warped photo. Diagonal lines of the
    # art cross the numbers of lines 2, 4 and 5, so a number's box is its glyph's own shape at the word's cap height.
    for i, (name, y) in enumerate(zip(PROGRAMS, PROG_Y)):
        r = runs(y, 215 if i < 9 else 204, 378 if i == 9 else 400, merge=6)
        wrd = next(q for q in r if q[1] - q[0] > 20)
        band = lum[int(y - 8):int(y + 9), wrd[0]:wrd[1]] > 95
        rows = np.where(band.sum(1) >= max(5, 0.12 * band.shape[1]))[0] + int(y - 8)   # (lines crossing add 2-3 px a row)
        ink, base = text_ink_base(name, 5)                         # top of the word's ink -> base line: rows[0] -> rows[-1] + 1
        sy = (rows[-1] + 1 - rows[0]) / base
        wb = (wrd[0], rows[0], wrd[1], rows[0] + ink.shape[0] * sy)
        bi = tuple(int(round(v)) for v in wb)
        erase[bi[1] - 3:bi[3] + 2, bi[0] - 1:bi[2] + 2] = True      # (the photo's slashes stand 2 px over the capitals)
        texts.append((ink, wb, GOLD if name == "Hot Wash" else WHITE))
        erase[int(y - 7):int(y + 8), 186:wrd[0] - 1] = True       # the photo's number (set again below)
        ink = text_ink(str(i + 1), 6)
        top = wb[1]
        hgt = 12.4                                                # the photo's numbers: 12-13 px tall
        x0 = 194 if i < 9 else 186
        b = (x0, top, x0 + hgt * ink.shape[1] / ink.shape[0], top + hgt)
        bi = tuple(int(round(v)) for v in b)
        erase[bi[1] - 1:bi[3] + 2, bi[0] - 1:bi[2] + 2] = True
        texts.append((ink, b, WHITE if name != "Hot Wash" else GOLD))
        if name == "Hot Wash":
            ic = r[1]
            thermo.append(ink_box(lum, (ic[0], y - 9, ic[1], y + 10)))
    for s, rough, face in WORDS:                                   # (the rough boxes stop short of the icons after the words)
        word(s, rough, face)
    for j, cx in enumerate(LEVELS):
        word(f"L{j + 1}", (cx - 12, 196, cx + 12, 211), 5)
    for s, rough in CHILD_LOCK:
        word(s, rough, 6)
    thermo.append(ink_box(lum, HEATER_ICON))
    for b in thermo:
        erase[b[1] - 1:b[3] + 1, b[0] - 1:b[2] + 1] = True
    # "Programs", set upright (it reads from the bottom up)
    bv_ = ink_box(lum, PROGRAMS_V)
    bvx = ink_box(lum, (bv_[0], 228, bv_[2], 296))
    erase[bvx[1] - 9:bvx[3] + 4, bvx[0] - 1:bvx[2] + 1] = True
    texts.append((np.rot90(text_ink("Programs", 5)), bvx, ink_colour(flat, lum, bvx)))
    # display window, logo, the 12 kg print: out of the traced ink
    x0, y0, x1, y1 = DISPLAY
    win = ink_box(np.abs(flat - np.array(GLASS, np.float32)).max(2) + 60, DISPLAY, thr=60 + 25)
    erase[win[1]:win[3], win[0]:win[2]] = True
    lb = ink_box(lum, LOGO_BOX)
    erase[lb[1] - 2:lb[3] + 2, lb[0] - 2:lb[2] + 2] = True
    for x0, y0, x1, y1 in ERASE:
        erase[y0:y1, x0:x1] = True

    # the rest of the print (line art, cups, bars, key icons, frames) traced: ink interpolated 3x and cut at half contrast
    a0 = np.clip((lum - 22) / (235 - 22), 0, 1)
    a0[erase] = 0
    colour = cv2.dilate(flat, np.ones((3, 3), np.uint8))
    up = cv2.resize(a0, (Ww, Hh), interpolation=cv2.INTER_CUBIC)
    up = cv2.GaussianBlur(up, (0, 0), 0.9)
    al = np.clip((up - 0.22) / 0.16, 0, 1)
    al = al * al * (3 - 2 * al)
    cu = cv2.resize(colour, (Ww, Hh), interpolation=cv2.INTER_LINEAR)
    cu = cu * np.clip(235 / np.maximum(cu.max(2, keepdims=True), 1), 0, 1.15)
    c = np.empty((Hh, Ww, 3), np.float32)
    c[:] = GLASS
    c = c * (1 - al[..., None]) + cu * al[..., None]

    # the display: the photo's grey window, two orange 8s
    gx0, gy0, gx1, gy1 = win
    wcol = np.median(flat[gy0 + 3:gy1 - 3, gx0 + 3:gx0 + 10].reshape(-1, 3), 0)
    c[round(gy0 * k):round(gy1 * k), round(gx0 * k):round(gx1 * k)] = wcol
    sub = flat[gy0:gy1, gx0:gx1]
    orange = sub[sub[..., 0] > 200].mean(0)
    seg7(c, win, orange, k)
    # the Godrej mark, white
    logo = np.asarray(Image.open(LOGO).convert("RGBA"))[..., 3].astype(np.float32) / 255
    ys, xs = np.where(logo > 0.3)
    place(c, logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1], lb, ink_colour(flat, lum, lb), k)
    for ink, b, col in texts:
        place(c, ink, b, col if col[2] > 0.7 * col[0] else GOLD, k)
    for b in thermo:
        place(c, thermometer(), b, GOLD, k)
    return c


def panel():
    c = panel_print()
    decal_cut.cut(Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)), GLASS, OUT, prefix="print")
    small = cv2.resize(c, (round(PW * 4), round(PL * 4)), interpolation=cv2.INTER_AREA)
    save(small, "panel.jpg")
    if DEBUG:
        Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).save(os.path.join(DEBUG, "panel_hi.png"))


# ── the cabinet ───────────────────────────────────────────────────────────────────────────────────────────────────────
R_MM = 15                                  # the cabinet's vertical corners (rounded; ESTIMATED from the 3/4 photos)
SHADE = {"front": 0.80, "side": 0.80, "back": 0.86}     # the viewer's light adds about a quarter: tuned on the renders


def front():
    """front.jpg: the cabinet's flat front between its rounded corners, 104-886 mm up (rows 2706-802 of the front photo,
    columns 746-2285 for the 620 mm: 2.482 px/mm across)."""
    ph = load("front.jpg")
    k = 1539 / W_MM
    x0, x1 = 746 + R_MM * k, 2285 - R_MM * k
    a = ph[802:2706, int(round(x0)):int(round(x1))]
    a = cv2.resize(a, (round((W_MM - 2 * R_MM) * 2), round((BODY_TOP - PLINTH_TOP) * 2)), interpolation=cv2.INTER_AREA)
    save(a * SHADE["front"], "front.jpg")
    return a


def sides():
    """side_r.jpg, side_l.jpg: each side, 605 mm deep x 782 mm (104-886 mm up), warped flat from the 3/4 photos. Corners
    read off the photos: the seam under the top cover and the seam over the plinth, at the side's front and back edges."""
    w, h = round(D_MM * 2), round((BODY_TOP - PLINTH_TOP) * 2)
    r = warp(load("right34.jpg"), [(1705, 1195), (2315, 950), (2315, 2352), (1705, 2616)], w, h)     # front at the left
    l = warp(load("left34.jpg"), [(632, 975), (1250, 1203), (1268, 2752), (676, 2392)], w, h)       # back at the left
    for a, name in ((r, "side_r.jpg"), (l, "side_l.jpg")):
        # the 3/4 photos light the sides unevenly (the right one is lit from the front): even the light out across, keep
        # the pressing's relief (a quadratic fit of the log light, divided out, then the mean put back)
        L = np.log(np.maximum(a.mean(2), 1))
        yy, xx = np.mgrid[0:h, 0:w] / np.float32(max(w, h))
        A = np.stack([np.ones_like(xx), xx, yy, xx * xx, yy * yy, xx * yy], -1).reshape(-1, 6)
        coef = np.linalg.lstsq(A[::7], L.reshape(-1)[::7], rcond=None)[0]
        fit = (A @ coef).reshape(h, w)
        a = a * np.exp(fit.mean() - fit)[..., None]
        save(a * SHADE["side"], name)


# The back photo: the cabinet's 620 mm is 1424 px (columns 852-2275), the height 1020 mm rows 485 (top) - 2924 (feet).
BK = 1424 / W_MM
BY = (2924 - 485) / H_MM


def bx(x_mm):
    return 1563.5 + x_mm * BK


def by(y_mm):
    return 2924 - y_mm * BY


# The mains cord as the back photo shows it (photo px): out of the top plate at the left, along the plate, a loop back,
# then down across the back cover to the plug clipped on its left. The builder models it along these points.
CORD = [(990, 748), (1300, 752), (1700, 757), (2000, 762), (2050, 772), (2062, 795), (2040, 812), (1850, 818),
        (1450, 824), (1110, 820), (1045, 808), (1040, 790), (1075, 782), (1500, 786), (2000, 790), (2050, 800),
        (1970, 1000), (1790, 1260), (1510, 1520), (1310, 1640), (1230, 1652), (1200, 1625)]
PLUG = (1180, 1570)                        # the plug's centre, about 70 px across the radius (its pins point at the cover)


def back():
    """back.jpg: the cabinet's back between its rounded corners, 104-886 mm up; housing.jpg: the top plate over it,
    886-995 mm up."""
    ph = load("back.jpg")
    # The cord and plug stay in the photo: painting them out smeared the loop and the cover (TELEA on a dark cord over a
    # dark cover). The builder lays the modelled cord over the photo's own, so straight on it covers it and at an angle the
    # photo's cord reads as its shadow.
    x0, x1 = bx(-W_MM / 2 + R_MM), bx(W_MM / 2 - R_MM)
    a = ph[int(round(by(BODY_TOP))):int(round(by(PLINTH_TOP))), int(round(x0)):int(round(x1))]
    a = cv2.resize(a, (round((W_MM - 2 * R_MM) * 2), round((BODY_TOP - PLINTH_TOP) * 2)), interpolation=cv2.INTER_AREA)
    save(a * SHADE["back"], "back.jpg")
    hx0, hx1 = bx(-265), bx(265)
    t = ph[int(round(by(HOUSING_TOP))):int(round(by(BODY_TOP))), int(round(hx0)):int(round(hx1))]
    t = cv2.resize(t, (530 * 2, round((HOUSING_TOP - BODY_TOP) * 2)), interpolation=cv2.INTER_AREA)
    save(t * SHADE["back"], "housing.jpg")


HOUSING_TOP = 995                          # the top plate's upper edge on the back (row 485 + the blue trim, 16 px)


# ── inside (the drum photo, looking straight down into the tub) ──────────────────────────────────────────────────────
def drum():
    ph = load("drum.jpg")
    # the pulsator: a circle round (1517, 1843), 455 px across the radius
    cx, cy, r = 1517, 1843, 470
    p = ph[cy - r:cy + r, cx - r:cx + r]
    save(cv2.resize(p, (1024, 1024), interpolation=cv2.INTER_AREA) * 0.92, "pulsator.jpg")
    # the drum's wall: a patch of its perforations and embossed ovals (upper left, between two filters), mirrored into a
    # seamless tile
    w = ph[1160:1300, 1200:1340]
    w = cv2.resize(w, (256, 256), interpolation=cv2.INTER_AREA)
    tile = np.concatenate([np.concatenate([w, w[:, ::-1]], 1), np.concatenate([w[::-1], w[::-1, ::-1]], 1)], 0)
    save(tile * 0.9, "drum.jpg")
    # the lint filter on the drum's back wall (its moulded front)
    f = ph[1053:1353, 1395:1640]
    save(cv2.resize(f, (256, 312), interpolation=cv2.INTER_AREA) * 0.92, "filter.jpg")


if __name__ == "__main__":
    if "--flat" in sys.argv:
        a = panel_flat()
        Image.fromarray(a.astype(np.uint8)).save(os.path.join(DEBUG or OUT, "panel_flat.png"))
    panel()
    front()
    sides()
    back()
    drum()
