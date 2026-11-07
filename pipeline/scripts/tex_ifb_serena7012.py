"""Textures and layout for the IFB Serena MBN 7012K CMS, 7 kg front-load washing machine, Mocha.

usage: python3 tex_ifb_serena7012.py <photos dir> <logos dir> <out dir>
  photos: ifb_serena7012/front.webp        IFB's straight-on product photo of this model (its print reads
                                           "SERENA MBN 7.0KG 1200RPM"), 2200 x 1320 with transparency
          ifb_serena7012/door_open.webp    IFB's photo of this model with the door open, same framing
          ifb_serena7012/ifb_logo_big.png  IFB's own logo file (ifbappliances.com, icons/ifb-logo.svg), rasterised
  writes <out dir>/ifb_serena7012/*.jpg and layout.json (every position the builder needs, in metres)

IFB draws the Serena and the Executive Plus on one cabinet: their photos share the framing to a pixel or two, and the
fascias carry the same print apart from the model line and the drawer's marks. So this script is tex_ifb_serena7012.py with
those two changed, and with the door found as the edge of its black glass disc (the Serena has no chrome ring).

Scale. IFB's photo is a straight-on render: the cabinet spans columns 699-1501 (803 px for IFB's 598 mm, 1.343 px per mm)
and the door's round edge is round in it, so its pixels are square. At that scale the photo's cabinet is 838 mm tall, but
IFB publishes 875 mm (product page, manual p.77, Sangeetha's listing). The model is built to 875 mm: the fascia and the door
keep the photo's size and place under the top edge, and the 37 mm goes into the plain front below the door (the pump-filter
flap keeps its share of that height). This is an ESTIMATE of where the real machine is taller than IFB's render.

Text. Every word on the fascia and the display is set again in Arial or Arial Narrow (whichever matches the photo's
width-to-height), each fitted to the ink box it has in the photo; the display's icons and seven-segment digits are drawn
again as shapes in their photo boxes. The model line keeps the photo's own words. The dial and the power button are 3D.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "ifb_serena7012"
SRC = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
NARROW = "/System/Library/Fonts/Supplemental/Arial Narrow.ttf"
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"

# ── IFB's size (product page and Sangeetha's listing): 598 W x 521 D x 875 H mm (the shared manual, p.77, gives 518 for 7 kg) ──
W_MM, H_MM, D_MM = 598.0, 875.0, 521.0
MODEL_LINE = [("SERENA MBN", (1258, 241, 1320, 249.5)), ("7.0KG", (1326, 241, 1350, 249.5)), ("1200RPM", (1355, 241, 1398, 249.5))]
DRAWER_ICONS = "leaf"              # the drawer's print under the grip: [leaf] ECO INVERTER (IFB's front and drawer photos)

# ── the photo's scale and rows ──
C0, C1 = 699, 1501                 # the cabinet's columns (the fascia, its widest part)
PPM = (C1 - C0 + 1) / W_MM          # 1.3428 px per mm, both ways
CXP = (C0 + C1 + 1) / 2             # the centre line
TOP = 97.0                          # the fascia's top edge (875 mm)
FACE_BOT = 261.5                    # the fascia's front face ends here (its rounded lower edge, rows 258-261)
CHIN_BOT = 288.5                    # under it a dark chin slopes back to the mocha front (rows 262-288)
CAB_BOT = 1207.0                    # the cabinet's lower edge; the feet stand under it to row 1222
FEET = 12.0                         # mm, ESTIMATED: 10-15 px of foot under the cabinet in the photos
SEAM = 967.0                        # the groove between the drawer's face and the control panel
T = 7.0                             # texture px per mm on the fascia (BENCHMARK 2: about 7 px per mm for control panels)
K = T / PPM                         # texture px per photo px


def mx(col):                        # photo column -> metres from the centre line
    return round((col - CXP) / PPM / 1000, 5)


def my_top(row):                    # fascia rows -> metres above the floor, measured down from the top edge
    return round((H_MM - (row - TOP) / PPM) / 1000, 5)


def save(img, name, q=90):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def load(name, bg=(255, 255, 255)):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    b = Image.new("RGBA", im.size, bg + (255,))
    b.alpha_composite(im)
    return np.asarray(b.convert("RGB")).astype(np.float32)


ph = load("front.webp")
grey = ph.mean(-1)
ALPHA = np.asarray(Image.open(os.path.join(SRC, "front.webp")).convert("RGBA"))[..., 3]


def fit_circle(ys, xs):
    A = np.c_[2 * xs, 2 * ys, np.ones(len(xs))]
    cx, cy, c = np.linalg.lstsq(A, xs ** 2 + ys ** 2, rcond=None)[0]
    return cx, cy, math.sqrt(c + cx ** 2 + cy ** 2)


# ── the door: a black glass disc with a thin black rim; its edge is where the photo turns from black to mocha ──
gs = cv2.GaussianBlur(grey, (0, 0), 1.2)
dcx, dcy = 1097.6, 626.7                       # start from the Executive Plus's door centre (same cabinet)
pts, seam_r = [], []
for ang in np.arange(0, 360, 3):
    if 40 < ang < 140:                          # the top of the door touches the chin: no mocha edge there
        continue
    t = math.radians(ang)
    rs = np.arange(235, 272, 0.25)
    v = np.array([gs[int(round(dcy - math.sin(t) * r * 1.3428)), int(round(dcx + math.cos(t) * r * 1.3428))] for r in rs])
    i = int(np.argmax(np.diff(v)))
    pts.append((dcx + math.cos(t) * rs[i] * 1.3428, dcy - math.sin(t) * rs[i] * 1.3428))
    if 100 <= ang <= 220:                       # the rim's inner seam: the darkest line just inside the edge (lit side)
        k = (rs > 238) & (rs < rs[i] - 4)
        seam_r.append(rs[k][np.argmin(v[k])])
p = np.array(pts)
dcx, dcy, dr = fit_circle(p[:, 1], p[:, 0])
for _ in range(3):
    k = np.abs(np.hypot(p[:, 0] - dcx, p[:, 1] - dcy) - dr) < 4
    dcx, dcy, dr = fit_circle(p[k, 1], p[k, 0])
RING_OUT, RING_IN = dr / PPM, float(np.median(seam_r))     # mm: the door's edge and its rim's inner seam
print(f"door edge: centre col {dcx:.1f} row {dcy:.1f}, rim {RING_IN:.1f}-{RING_OUT:.1f} mm")

# the door sits just under the chin (IFB's photo shows its ring touching the chin), so its centre is placed from there
CHIN_Y = my_top(CHIN_BOT)
DOOR_Y = CHIN_Y - RING_OUT / 1000 - 0.0015
DOOR_ROW_BOT = dcy + RING_OUT * PPM


def my(row):                        # any photo row -> metres above the floor
    if row <= CHIN_BOT:
        return my_top(row)
    if row <= DOOR_ROW_BOT:         # the door's zone: kept at the photo's scale round the door's centre
        return round(DOOR_Y - (row - dcy) / PPM / 1000, 5)
    # below the door: the photo's 177 mm stretched to the published height (ESTIMATED, see the note at the top)
    y0, y1 = DOOR_Y - RING_OUT / 1000, FEET / 1000
    return round(y0 + (row - DOOR_ROW_BOT) / (CAB_BOT - DOOR_ROW_BOT) * (y1 - y0), 5)


# ── the pump-filter flap: a thin dark circle at the lower right with the coin slot at its left edge ──
x0, y0, x1, y1 = 1180, 980, 1460, 1205
g = grey[y0:y1, x0:x1]
m = (cv2.GaussianBlur(g, (0, 0), 6) - g) > 6
ys, xs = np.where(m)
fcx, fcy, fr = fit_circle((ys + y0).astype(float), (xs + x0).astype(float))
for _ in range(4):
    d = np.hypot(xs + x0 - fcx, ys + y0 - fcy)
    k = np.abs(d - fr) < 4
    fcx, fcy, fr = fit_circle((ys[k] + y0).astype(float), (xs[k] + x0).astype(float))
print(f"flap: centre col {fcx:.1f} row {fcy:.1f}, r {fr / PPM:.1f} mm")


# ── fonts and words ──
def text_mask(s, px, path, index=0):
    f = ImageFont.truetype(path, max(4, round(px)), index=index)
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


def put(canvas, m, box, origin, colour, keep="w", align="c"):
    """Scales a mask into a photo box (photo px x0, y0, x1, y1) on a texture whose top left is the photo point `origin`."""
    bx0, by0, bx1, by1 = [(v - o) * K for v, o in zip(box, origin * 2)]
    bw, bh = bx1 - bx0, by1 - by0
    h, w = m.shape
    k = bw / w if keep == "w" else bh / h if keep == "h" else min(bw / w, bh / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    if keep == "xy":                # stretched to the box both ways (a measured ink box)
        nw, nh = max(1, round(bw)), max(1, round(bh))
    mm = cv2.resize(m.astype(np.float32), (nw, nh), interpolation=cv2.INTER_AREA)
    X = bx0 if align == "l" else bx1 - nw if align == "r" else (bx0 + bx1) / 2 - nw / 2
    blend(canvas, mm, round(X), round((by0 + by1) / 2 - nh / 2), colour)


def word(canvas, s, box, origin, colour, align="c"):
    """A word fitted to its photo ink box by width, in Arial or Arial Narrow, whichever gives the photo's letter height."""
    bw, bh = box[2] - box[0], box[3] - box[1]
    best = None
    for path in (ARIAL, NARROW):
        mm = text_mask(s, 80, path)
        hh = mm.shape[0] * bw / mm.shape[1]
        if best is None or abs(hh - bh) < best[0]:
            best = (abs(hh - bh), path, mm)
    k = bw * K / best[2].shape[1]
    put(canvas, text_mask(s, 80 * k, best[1]), box, origin, colour, keep="w", align=align)


# ── icons, drawn at 20 px per unit then fitted into their photo boxes ──
def icon(kind):
    S = 200
    im = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(im)
    L = 14
    if kind == "hourglass":
        d.polygon([(50, 10), (150, 10), (110, 100), (150, 190), (50, 190), (90, 100)], outline=255, width=L)
        d.line([(40, 10), (160, 10)], fill=255, width=L)
        d.line([(40, 190), (160, 190)], fill=255, width=L)
    elif kind == "kg":
        f = ImageFont.truetype(ARIAL, 150)
        d.text((100, 100), "Kg", font=f, fill=255, anchor="mm")
    elif kind in ("box", "box_lit"):
        d.rectangle([12, 12, 188, 188], outline=255, width=L)
        d.polygon([(55, 55), (85, 45), (100, 60), (115, 45), (145, 55), (150, 95), (130, 95), (130, 150), (70, 150), (70, 95), (50, 95)], outline=255, width=10)
        if kind == "box_lit":
            d.rectangle([12, 12, 188, 188], fill=255)
            d.polygon([(55, 55), (85, 45), (100, 60), (115, 45), (145, 55), (150, 95), (130, 95), (130, 150), (70, 150), (70, 95), (50, 95)], fill=0)
    elif kind == "drop":
        d.ellipse([20, 70, 180, 196], fill=255)
        d.polygon([(100, 0), (30, 110), (170, 110)], fill=255)
        d.ellipse([62, 112, 138, 172], fill=0)
    elif kind == "lock":
        d.rounded_rectangle([20, 90, 180, 196], 18, fill=255)
        d.arc([45, 8, 155, 150], 180, 360, fill=255, width=26)
        d.line([(45, 78), (45, 100)], fill=255, width=26)
        d.line([(155, 78), (155, 100)], fill=255, width=26)
        d.ellipse([86, 120, 114, 148], fill=0)
    elif kind == "door":
        d.ellipse([12, 12, 188, 188], outline=255, width=L)
        d.pieslice([12, 12, 188, 188], 270, 90, fill=255)
    elif kind == "wifi":
        for r in (90, 62, 34):
            d.arc([100 - r * 1.1, 150 - r, 100 + r * 1.1, 150 + r], 215, 325, fill=255, width=22)
        d.ellipse([86, 150, 114, 178], fill=255)
    elif kind == "delay":
        d.arc([20, 20, 180, 180], 300, 230, fill=255, width=L)
        d.polygon([(30, 30), (70, 40), (35, 75)], fill=255)
        d.line([(100, 60), (100, 105), (130, 125)], fill=255, width=L)
    elif kind == "playpause":
        d.polygon([(10, 10), (110, 100), (10, 190)], outline=255, width=L)
        d.rectangle([132, 10, 150, 190], fill=255)
        d.rectangle([172, 10, 190, 190], fill=255)
    elif kind == "house":
        d.line([(30, 95), (100, 25), (170, 95)], fill=255, width=L)
        d.line([(50, 80), (50, 185), (150, 185), (150, 80)], fill=255, width=L)
        d.arc([128, 2, 196, 70], 280, 350, fill=255, width=8)
        d.arc([148, 22, 176, 50], 280, 350, fill=255, width=8)
    elif kind == "lock_small":
        d.rounded_rectangle([40, 95, 160, 190], 12, fill=255)
        d.arc([60, 25, 140, 140], 180, 360, fill=255, width=22)
        d.line([(60, 80), (60, 100)], fill=255, width=22)
        d.line([(140, 80), (140, 100)], fill=255, width=22)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.3)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


SEG = {"0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "8": "abcdefg"}


def seven(ch, thick):
    """A seven-segment digit as hexagonal bars (the display's own kind of figure), 100 x 180 units."""
    im = Image.new("L", (110, 190), 0)
    d = ImageDraw.Draw(im)
    t = thick
    def bar(x0, y0, x1, y1):
        if x1 - x0 > y1 - y0:
            c = (y0 + y1) / 2
            d.polygon([(x0, c), (x0 + t / 2, y0), (x1 - t / 2, y0), (x1, c), (x1 - t / 2, y1), (x0 + t / 2, y1)], fill=255)
        else:
            c = (x0 + x1) / 2
            d.polygon([(c, y0), (x1, y0 + t / 2), (x1, y1 - t / 2), (c, y1), (x0, y1 - t / 2), (x0, y0 + t / 2)], fill=255)
    g = 3
    P = {"a": (5 + g, 5, 105 - g, 5 + t), "g": (5 + g, 95 - t / 2, 105 - g, 95 + t / 2), "d": (5 + g, 185 - t, 105 - g, 185),
         "f": (5, 5 + g, 5 + t, 95 - g), "b": (105 - t, 5 + g, 105, 95 - g), "e": (5, 95 + g, 5 + t, 185 - g), "c": (105 - t, 95 + g, 105, 185 - g)}
    for s in SEG[ch]:
        bar(*P[s])
    a = np.asarray(im).astype(np.float32) / 255
    return a


# ── the control panel: the fascia right of the seam, the display glass, its print ──
PANEL_BOX = (SEAM, TOP, C1 + 1, FACE_BOT)                        # photo px
DISPLAY = (990.0, 124.5, 1209.5, 231.5)                         # the black glass
DIGITS_WIN = (1071.0, 155.0, 1129.0, 179.5)                     # the dim window behind the time
KNOB = (1294.0, 143.0, 1362.0, 211.0)                           # bounding box of the dial
POWER = (1390.5, 166.0, 1421.5, 195.0)                          # the power button
TEXT = (226, 226, 226)
DIMTXT = (150, 150, 150)
LEFT = [("My IFB", (995, 130.5, 1016.5, 139.5)), ("Express 15'", (995, 148, 1031, 156.5)), ("Bulky", (995, 164, 1012, 172.5)),
        ("CradleWash®", (995, 177.5, 1037, 185.5)), ("Spin Dry/Rinse", (995, 194, 1041, 202.5))]
RIGHT = [("Mix/Daily", (1177, 133, 1205, 141.5)), ("Cotton", (1185, 148, 1205, 155.5)), ("Synthetic", (1177, 164, 1205, 172.5)),
         ("Baby Wear", (1171, 179, 1205, 187.5)), ("Refresh", (1181, 194, 1205, 201.5))]
LEDS_L = [(1053.5, 133, 1060, 140, True)] + [(1055, y, 1059, y + 4, False) for y in (150, 165, 180, 196)]
LEDS_R = [(1142, y, 1146, y + 4, False) for y in (134, 150, 165, 180, 196)]
KEYS = [("Temp", (1004, 209.5, 1022, 216.5)), ("Spin", (1041, 209.5, 1055, 216.5)), ("Steam", (1073, 209.5, 1093, 216.5)),
        ("TimeSaver", (1102, 209.5, 1132.5, 216.5)), ("WarmSoak", (1137.5, 209.5, 1169.5, 216.5))]
BARS = [995.5, 1030.5, 1065.5, 1100.5, 1135, 1170.5, 1204.5]   # the separators of the key row
SUBS = [("Prewash", (1006, 219.5, 1021, 222.5)), ("*Extra Rinse", (1037, 219.5, 1060, 222.5)), ("*WiFi Reset", (1073, 219.5, 1093, 222.5)),
        ("*Tub Clean", (1143, 219.5, 1162, 222.5))]
TOP_ICONS = [("hourglass", (1072, 140, 1076.5, 147.5), False), ("kg", (1081, 140.5, 1088.5, 147), False), ("box", (1091, 140, 1098, 147.5), False),
             ("drop", (1101.5, 139, 1109, 149), True), ("lock", (1113, 138.5, 1120.5, 149), True), ("door", (1123, 140, 1130.5, 147.5), False)]
BOT_ICONS = [("box", (1071, 187, 1078, 194.5), False), ("box", (1081, 187, 1088, 194.5), False), ("wifi", (1091, 186.5, 1100.5, 194), True),
             ("box_lit", (1102.5, 186.5, 1110.5, 194.5), True), ("delay", (1113, 187, 1119.5, 194), False), ("playpause", (1123, 188, 1130, 193.5), False)]
DIGITS = [("1", (1078.5, 158, 1082, 176.5), False), ("8", (1083, 158, 1093.5, 176.5), False), ("4", (1098, 158, 1110.5, 176.5), True),
          ("0", (1111.5, 158, 1124, 176.5), True)]


# the fascia's charcoal: IFB's photo reads 44 (median of print-free columns on the panel; 0.17 of white), a little darker than
# the Executive Plus's 49. Under the page's light (studio.hdr, exposure 1.05) this gloss black renders at about its texture
# value, so the texture holds 44 (look pass 5 Nov 2026; it held 30 for the older neutral light, which lifted it about 2x).
BASE = 44


def panel():
    x0, y0, x1, y1 = PANEL_BOX
    tw, th = round((x1 - x0) * K), round((y1 - y0) * K)
    # the fascia's tone row by row, from print-free columns (between the display and the dial, and right of the button)
    cols = np.r_[1222:1240, 1440:1495]
    prof = np.median(grey[int(y0):int(y1) + 1][:, cols], axis=1)
    prof[:6] = prof[6]                                        # the top edge's highlight belongs to the 3D bevel
    prof[-5:] = prof[-6]
    prof = cv2.GaussianBlur(prof.reshape(-1, 1).astype(np.float32), (1, 0), 3).ravel()
    prof = BASE + (prof - prof.mean()) * 0.5                  # half the photo's studio gradient; the viewer lights the rest
    rows = np.interp(np.arange(th) / K + y0, np.arange(len(prof)) + y0, prof)
    can = np.repeat(np.repeat(rows[:, None, None], tw, 1), 3, 2).astype(np.float32)
    org = (x0, y0)
    # the display glass: near black, a little lighter towards its lower edge, a fine light rim (the photo's 1 px edge)
    gx0, gy0, gx1, gy1 = [(v - o) * K for v, o in zip(DISPLAY, org * 2)]
    mask = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(mask).rounded_rectangle([gx0, gy0, gx1, gy1], radius=1.5 * T, fill=255)
    mk = np.asarray(mask).astype(np.float32)[..., None] / 255
    yy = (np.arange(th)[:, None, None] - gy0) / max(1, gy1 - gy0)
    glass = 7 + 14 * np.clip((yy - 0.8) / 0.2, 0, 1) ** 2
    can = can * (1 - mk) + glass * mk
    rim = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(rim).rounded_rectangle([gx0, gy0, gx1, gy1], radius=1.5 * T, outline=255, width=max(1, round(0.3 * T)))
    blend(can, np.asarray(rim).astype(np.float32) / 255 * 0.35, 0, 0, (120, 120, 122))
    # the time window
    wx0, wy0, wx1, wy1 = [(v - o) * K for v, o in zip(DIGITS_WIN, org * 2)]
    win = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(win).rounded_rectangle([wx0, wy0, wx1, wy1], radius=0.8 * T, fill=255)
    blend(can, np.asarray(win).astype(np.float32) / 255, 0, 0, (24, 24, 25))
    # the words
    for s, b in LEFT:
        word(can, s, b, org, TEXT, "l")
    put(can, icon("house"), (1019, 130, 1028.5, 139.5), org, TEXT, keep="fit")
    for s, b in RIGHT:
        word(can, s, b, org, TEXT, "r")
    for s, b in KEYS:
        word(can, s, b, org, TEXT)
    for s, b in SUBS:
        word(can, s, b, org, (200, 200, 200))
    put(can, icon("playpause"), (1182, 209.5, 1193.5, 218), org, TEXT, keep="fit")
    for bx in BARS:
        put(can, np.ones((10, 1), np.float32), (bx - 0.45, 209.5, bx + 0.45, 218), org, (200, 200, 200), keep="h")
    # the child-lock mark between "*Extra Rinse" and "*WiFi Reset": a short dash, the padlock, a dash
    put(can, icon("lock_small"), (1062.5, 218.5, 1066.5, 224.5), org, (200, 200, 200), keep="fit")
    for xa, xb in ((1060.8, 1062), (1067, 1068.3)):
        put(can, np.ones((1, 10), np.float32), (xa, 221.3, xb, 221.9), org, (200, 200, 200), keep="w")
    for xa, ya, xb, yb, lit in LEDS_L + LEDS_R:
        put(can, np.ones((10, 10), np.float32), (xa, ya, xb, yb), org, (250, 250, 250) if lit else (118, 118, 118), keep="fit")
    for kind, b, lit in TOP_ICONS + BOT_ICONS:
        put(can, icon(kind), b, org, (246, 246, 246) if lit else (96, 96, 98), keep="fit")
    for ch, b, lit in DIGITS:
        put(can, seven(ch, 22 if lit else 12), b, org, (250, 250, 250) if lit else (88, 88, 90), keep="h", align="r")
    for yc in (163.5, 170.5):
        put(can, np.ones((10, 10), np.float32), (1095.2, yc - 0.9, 1097, yc + 0.9), org, (88, 88, 90), keep="fit")
    # under the knob: "*Press and Hold for 3 sec." above the glass, the POWER STEAM mark, the model line
    word(can, "*Press and Hold for 3 sec.", (1154, 116.8, 1208.5, 122.5), org, (170, 170, 170), "r")
    red = (236, 70, 88)
    put(can, power_steam_icon(), (991, 238, 1002.5, 248.5), org, red, keep="fit")
    m = text_mask("POWER STEAM", 80, ARIAL.replace("Arial.ttf", "Arial Bold.ttf"))
    put(can, m, (1006, 241.2, 1066.5, 248.4), org, red, keep="w", align="l")
    put(can, text_mask("®", 80, ARIAL), (1067.5, 239.5, 1071.5, 243.5), org, red, keep="fit")
    for s, b in MODEL_LINE:
        put(can, text_mask(s, 80, AVENIR, 7), b, org, (205, 205, 205), keep="w")
    can = np.clip(can, 0, 255).astype(np.uint8)
    save(Image.fromarray(can), "panel.jpg", 90)
    return tw, th


def power_steam_icon():
    im = Image.new("L", (200, 200), 0)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, 200, 200], 40, fill=255)
    d.line([(40, 100), (100, 45), (160, 100)], fill=0, width=20)
    d.line([(60, 85), (60, 160), (140, 160), (140, 85)], fill=0, width=18)
    for x in (82, 100, 118):
        d.line([(x, 140), (x, 105)], fill=0, width=9)
    a = np.asarray(im).astype(np.float32) / 255
    return a


# ── the drawer's face: the IFB mark, the grip (a 3D pocket with a chrome lip) and the print under it ──
DRAWER_BOX = (C0, TOP, SEAM, FACE_BOT)
LOGO = (816.0, 155.0, 860.5, 171.5)                # IFB's mark (photo ink box)
GRIP = (743.5, 183.5, 932.5, 229.5)                # the grip pocket, its chrome lip along the top (rows 183-191)
LIP_BOT = 191.0
PRINT = (747.0, 235.0, 825.0, 248.5)               # [Ai] [eco] ECO INVERTER
# IFB's drawer photo (photo 7) lined up on the front photo with cv2.findTransformECC (affine, look pass 5 Nov 2026) gives the
# print's boxes in front px. The mark drawn before (an arc over a small leaf) inked 9.4 x 10.0 px (7.0 x 7.4 mm); IFB's
# inks 10.9 x 11.9 px (8.1 x 8.9 mm), its leaf filling the lower half:
ECO_ICON = (748.0, 235.17, 759.5, 246.93)          # the eco mark (ECO_FRAME fitted by correlation, 0.81)
ECO_TEXT = (759.5, 242.0, 802.5, 247.0)            # ECO INVERTER's ink box
DIN = "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf"   # ECO INVERTER: square C and O, upright (I stems within 2 deg)
PRINT_GREY = (205, 205, 205)
# IFB's eco mark (the same on the Executive Plus), traced on IFB's lined-up drawer photos: a drop outline with a leaf in its
# lower left and two bubbles at its right. Units are px of the 6 x lined-up crop; ECO_FRAME is the mark's frame in them.
ECO_FRAME = (23.0, 18.0, 92.0, 90.0)


def tbox(box, org, pad=0.0):
    x0, y0, x1, y1 = [(v - o) * K for v, o in zip(box, org * 2)]
    return int(x0 - pad * K), int(y0 - pad * K), int(np.ceil(x1 + pad * K)), int(np.ceil(y1 + pad * K))


def vec(can, org, box, colour, fn, ss=8):
    """Vector marks drawn by fn(d, P, W) in front-photo px (P maps a point, W a width), at ss x, then blended on."""
    X0, Y0, X1, Y1 = tbox(box, org, 1.0)
    im = Image.new("L", ((X1 - X0) * ss, (Y1 - Y0) * ss), 0)
    fn(ImageDraw.Draw(im), lambda x, y: (((x - org[0]) * K - X0) * ss, ((y - org[1]) * K - Y0) * ss), lambda w: w * K * ss)
    m = cv2.resize(np.asarray(im).astype(np.float32) / 255, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_AREA)
    blend(can, m, X0, Y0, colour)


def bez(p0, p1, p2, p3, n=40):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = (np.array(q, float) for q in (p0, p1, p2, p3))
    return [tuple(q) for q in (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3]


def stroke(d, pts, w, caps=True):
    d.line(pts, fill=255, width=max(1, round(w)), joint="curve")
    if caps:
        for x, y in (pts[0], pts[-1]):
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)


def eco_mark(box, weight=1.0):
    """IFB's eco mark fitted into a front-photo box; weight scales the strokes (dark print on light reads thinner in the
    photo than light print on dark: about 3.9 units against 7 at the arch)."""
    fx0, fy0, fx1, fy1 = ECO_FRAME
    sx, sy = (box[2] - box[0]) / (fx1 - fx0), (box[3] - box[1]) / (fy1 - fy0)
    def fn(d, P, W):
        Q = lambda pts: [P(box[0] + (x - fx0) * sx, box[1] + (y - fy0) * sy) for x, y in pts]
        ww = lambda u: W(u * sx * weight)
        a = np.linspace(-np.pi / 2, 0, 50)
        stroke(d, Q([(32, 44), (32, 19)] + list(zip(32 + 28.5 * np.cos(a), 70 + 51 * np.sin(a))) + [(60.5, 72)]), ww(5.4))
        A, T = (26.5, 49.0), (57.0, 87.0)
        stroke(d, Q(bez(A, (44, 55), (55, 64), T)), ww(4.3))
        stroke(d, Q([A, (26.5, 66)] + bez((26.5, 66), (28, 74), (42, 82), T)), ww(4.3))
        stroke(d, Q(bez((37, 60), (37.5, 70), (44, 77), (54, 84))), ww(4.0))
        for (cx, cy), r, w in (((70, 30.3), 5.4, 4.4), ((79, 56), 7.6, 4.8)):
            (X, Y), = Q([(cx, cy)])
            for rr, fill in ((r + w * weight / 2, 255), (r - w * weight / 2, 0)):
                rx, ry = W(rr * sx), W(rr * sy)
                d.ellipse([X - rx, Y - ry, X + rx, Y + ry], fill=fill)
    return fn




def drawer():
    x0, y0, x1, y1 = DRAWER_BOX
    tw, th = round((x1 - x0) * K), round((y1 - y0) * K)
    cols = np.r_[705:735, 940:960]
    prof = np.median(grey[int(y0):int(y1) + 1][:, cols], axis=1)
    prof[:6] = prof[6]
    prof[-5:] = prof[-6]
    prof = cv2.GaussianBlur(prof.reshape(-1, 1).astype(np.float32), (1, 0), 3).ravel()
    prof = BASE + (prof - prof.mean()) * 0.5
    rows = np.interp(np.arange(th) / K + y0, np.arange(len(prof)) + y0, prof)
    can = np.repeat(np.repeat(rows[:, None, None], tw, 1), 3, 2).astype(np.float32)
    org = (x0, y0)
    logo = np.asarray(Image.open(os.path.join(SRC, "ifb_logo_big.png")).convert("RGBA"))[..., 3].astype(np.float32) / 255
    ys, xs = np.where(logo > 0.3)
    logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    put(can, logo, LOGO, org, (214, 214, 214), keep="w")
    # the pocket's inside, seen through its opening, is a separate dark part; here the face keeps its tone
    if DRAWER_ICONS == "leaf":
        # IFB's eco mark (the drop, the leaf and two bubbles), drawn again as vectors on IFB's lined-up drawer photo, then
        # ECO INVERTER in DIN Alternate; both in the print's light grey
        vec(can, org, ECO_ICON, PRINT_GREY, eco_mark(ECO_ICON, 1.0))
        put(can, text_mask("ECO INVERTER", 80, DIN), ECO_TEXT, org, PRINT_GREY, keep="xy")
    if DRAWER_ICONS == "ai_eco":
        # [Ai] in a blue rounded box, the eco mark in a light outlined box, then ECO INVERTER (IFB's drawer photo)
        ai = Image.new("L", (200, 200), 0)
        dd = ImageDraw.Draw(ai)
        dd.rounded_rectangle([0, 0, 200, 200], 30, fill=255)
        aim = np.asarray(ai).astype(np.float32) / 255
        put(can, aim, (752.5, 236.5, 761, 246.5), org, (52, 150, 222), keep="fit")
        put(can, text_mask("Ai", 80, ARIAL), (754.5, 238.8, 759.2, 244.4), org, (235, 245, 252), keep="fit")
        eco = Image.new("L", (200, 200), 0)
        de = ImageDraw.Draw(eco)
        de.rounded_rectangle([6, 6, 194, 194], 30, outline=255, width=14)
        de.ellipse([40, 90, 120, 170], outline=255, width=12)
        de.line([(60, 150), (130, 70)], fill=255, width=10)
        de.ellipse([110, 40, 170, 100], outline=255, width=12)
        de.ellipse([140, 120, 165, 145], outline=255, width=8)
        put(can, np.asarray(eco).astype(np.float32) / 255, (763.5, 236.5, 772, 246.5), org, (205, 205, 205), keep="fit")
        put(can, text_mask("ECO INVERTER", 80, AVENIR, 5), (774.5, 239.5, 825, 247), org, (205, 205, 205), keep="w")
    save(Image.fromarray(np.clip(can, 0, 255).astype(np.uint8)), "drawer.jpg", 90)


# ── the mocha front: IFB's colour, with half of the photo's fall in brightness from top to bottom ──
# Colour: IFB's front photo reads (55, 48, 43) on average over the mocha front, 0.191 of white (its print and background
# white are 255), R/G 1.157, B/G 0.893. Rendered as a plain paint (metal 0, rough 0.42) under the page's light, this base
# gives 0.195 of the white card on the web (R/G 1.19, B/G 0.87) and 0.181 in RealityKit (R/G 1.10, B/G 0.93): the web's dark
# end turns redder and RealityKit's greyer, so the base sits between them (look pass 5 Nov 2026). Metal 0.25 (before)
# tinted the web's reflections and read redder (R/G 1.20 at 0.24 of white).
MOCHA = (44, 38, 34)
FALL = 0.5                                       # the share of the photo's top-to-bottom fall kept; the viewer's light gives the rest


def lin(v):
    v = np.asarray(v, np.float64) / 255
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def srgb(v):
    v = np.clip(v, 0, 1)
    return 255 * np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)


def front_fall():
    """front.jpg: the mocha front from the chin (top, v 0) to the feet (bottom, v 1). The photo's light is split into a
    column part (the softbox's bright left and right edges, left out) and a row part, of which FALL is kept."""
    Y = lin(ph).mean(-1)
    H, W = Y.shape
    yy, xx = np.mgrid[0:H, 0:W]
    body = (ALPHA > 250) & (xx > C0 + 8) & (xx < C1 - 8) & (yy > CHIN_BOT + 4) & (yy < CAB_BOT - 4)
    body &= np.hypot(xx - dcx, yy - dcy) > RING_OUT * PPM + 8
    body &= np.hypot(xx - fcx, yy - fcy) > fr + 8
    low = body & (yy > DOOR_ROW_BOT + 10)
    col = np.array([np.median(Y[low[:, c], c]) if low[:, c].sum() > 20 else np.nan for c in range(W)])
    cs = np.isfinite(col)
    col = np.interp(np.arange(W), np.where(cs)[0], col[cs])
    col /= np.median(col[C0 + 8:C1 - 8])
    rows = np.arange(int(CHIN_BOT) + 5, int(CAB_BOT) - 4)
    prof = np.array([np.median(Y[r, body[r]] / col[body[r]]) for r in rows])
    weight = np.array([body[r].sum() for r in rows], np.float64)
    prof = cv2.GaussianBlur(prof.reshape(-1, 1).astype(np.float32), (1, 0), 12).ravel()
    gain = (prof / np.average(prof, weights=weight)) ** FALL
    gain /= np.average(gain, weights=weight)
    # texture rows: v from the chin (y = CHIN_Y) to the floor of the front (y = FEET), through the photo rows
    th = 512
    ys = CHIN_Y - (np.arange(th) + 0.5) / th * (CHIN_Y - FEET / 1000)
    row_of = np.interp(ys[::-1], [my(r) for r in rows[::-1]], rows[::-1])[::-1]
    g = np.interp(row_of, rows, gain)
    tex = srgb(lin(MOCHA)[None, :] * g[:, None])
    img = np.repeat(tex[:, None, :], 8, 1)
    save(Image.fromarray(np.clip(np.round(img), 0, 255).astype(np.uint8)), "front.jpg", 92)
    print(f"front fall: top {g[:20].mean():.2f}, middle {g[th // 2]:.2f}, bottom {g[-20:].mean():.2f} of the mean (linear)")


# ── generated surfaces: the dial's brushed top, the power button, the drum's holes, the ribbed hose ──
def knob_top():
    n = 512
    yy, xx = np.mgrid[0:n, 0:n] - (n - 1) / 2
    ang = np.arctan2(yy, xx)
    r = np.hypot(xx, yy) / (n / 2)
    rng = np.random.default_rng(1014)
    streak = np.interp(ang, np.linspace(-np.pi, np.pi, 720), rng.normal(0, 1, 720).cumsum() % 6 / 6) * 0.25
    # the conical brushed top reflects in sectors (IFB's photos show bright and dark wedges)
    sect = 0.55 + 0.45 * np.cos(2 * ang + 0.6) * np.cos(ang * 1 - 0.3)
    v = 120 + 110 * sect + 40 * (streak - 0.12)
    v = v * (0.92 + 0.08 * r)
    v[r > 0.985] = 90
    im = np.repeat(np.clip(v, 0, 255)[..., None], 3, 2).astype(np.uint8)
    save(Image.fromarray(im), "knob_top.jpg", 88)


def power_button():
    n = 256
    yy, xx = np.mgrid[0:n, 0:n] - (n - 1) / 2
    r = np.hypot(xx, yy) / (n / 2)
    ang = np.arctan2(yy, xx)
    v = 170 + 50 * np.cos(2 * ang + 0.8) * (1 - r * 0.4)
    can = np.repeat(np.clip(v, 0, 255)[..., None], 3, 2).astype(np.float32)
    ic = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(ic)
    d.arc([70, 72, 186, 188], 300, 240, fill=255, width=9)
    d.line([(128, 58), (128, 128)], fill=255, width=9)
    blend(can, cv2.GaussianBlur(np.asarray(ic).astype(np.float32) / 255, (0, 0), 0.8), 0, 0, (110, 112, 116))
    save(Image.fromarray(can.astype(np.uint8)), "btn_power.jpg", 88)


def drum():
    # a 300 x 150 mm tile of the stainless drum: rows of small round holes in pressed dimples (IFB's open-door photo shows a
    # dense pattern of small holes; the exact layout is ESTIMATED)
    ppm = 3.4
    w, h = round(300 * ppm), round(150 * ppm)
    rng = np.random.default_rng(7012)
    base = 150 + rng.normal(0, 4, (h, w)).cumsum(1) * 0.05
    base = cv2.GaussianBlur(base.astype(np.float32), (0, 0), 3)
    img = np.repeat(base[..., None], 3, 2)
    hole = Image.new("L", (w, h), 0)
    dimple = Image.new("L", (w, h), 0)
    dh, dd = ImageDraw.Draw(hole), ImageDraw.Draw(dimple)
    pitch = 12.5 * ppm
    for j in range(int(h / pitch) + 1):
        for i in range(int(w / pitch) + 1):
            x = (i + 0.5 * (j % 2)) * pitch
            y = (j + 0.5) * pitch
            dd.ellipse([x - 4.2 * ppm, y - 4.2 * ppm, x + 4.2 * ppm, y + 4.2 * ppm], fill=255)
            dh.ellipse([x - 1.3 * ppm, y - 1.3 * ppm, x + 1.3 * ppm, y + 1.3 * ppm], fill=255)
    dm = cv2.GaussianBlur(np.asarray(dimple).astype(np.float32) / 255, (0, 0), 3)
    img = img * (1 - 0.18 * dm[..., None]) + 30 * np.roll(dm, 3, 0)[..., None]
    hm = np.asarray(hole).astype(np.float32)[..., None] / 255
    img = img * (1 - hm) + 18 * hm
    save(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), "drum.jpg", 86)


def hose():
    # one rib of the grey drain hose (u along the hose; the builder repeats it every 4.5 mm)
    w, h = 64, 16
    u = np.arange(w) / w
    v = 120 + 70 * np.sin(u * 2 * np.pi) ** 2
    img = np.repeat(np.repeat(v[None, :, None], h, 0), 3, 2)
    save(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), "hose.jpg", 90)


# ── the open-door photo: the door seat, the gasket, the lock and the hinge plate, about the door's centre ──
def open_layout():
    op = load("door_open.webp")
    al = np.asarray(Image.open(os.path.join(SRC, "door_open.webp")).convert("RGBA"))[..., 3]
    cols = np.where(al[150] > 128)[0]
    ppm = (cols.max() - cols.min() + 1) / W_MM
    print(f"open photo: cabinet columns {cols.min()}-{cols.max()}, {ppm:.4f} px per mm")
    return ppm


panel()
drawer()
front_fall()
knob_top()
power_button()
drum()
hose()
ppm_open = open_layout()

ft = 0.0
L = {
    "W": W_MM / 1000, "H": H_MM / 1000, "D": D_MM / 1000, "feet": FEET / 1000,
    "face_bot": my_top(FACE_BOT), "chin_bot": CHIN_Y, "seam": mx(SEAM),
    "panel_uv": {"x0": mx(PANEL_BOX[0]), "x1": mx(PANEL_BOX[2]), "y0": my_top(PANEL_BOX[3]), "y1": my_top(PANEL_BOX[1])},
    "drawer_uv": {"x0": mx(DRAWER_BOX[0]), "x1": mx(DRAWER_BOX[2]), "y0": my_top(DRAWER_BOX[3]), "y1": my_top(DRAWER_BOX[1])},
    "display": {"x0": mx(DISPLAY[0]), "x1": mx(DISPLAY[2]), "y0": my_top(DISPLAY[3]), "y1": my_top(DISPLAY[1])},
    "knob": {"x": mx((KNOB[0] + KNOB[2]) / 2), "y": my_top((KNOB[1] + KNOB[3]) / 2), "r": round((KNOB[2] - KNOB[0]) / 2 / PPM / 1000, 5)},
    "power": {"x": mx((POWER[0] + POWER[2]) / 2), "y": my_top((POWER[1] + POWER[3]) / 2), "r": round((POWER[2] - POWER[0]) / 2 / PPM / 1000, 5)},
    "grip": {"x0": mx(GRIP[0]), "x1": mx(GRIP[2]), "y0": my_top(GRIP[3]), "y1": my_top(GRIP[1]), "lip": my_top(LIP_BOT)},
    "door": {"x": mx(dcx), "y": round(DOOR_Y, 5), "rim": round(RING_OUT / 1000, 5), "chrome_in": round(RING_IN / 1000, 5)},
    "flap": {"x": mx(fcx), "y": my(fcy), "r": round(fr / PPM / 1000, 5)},
    # the coin slot at the flap's left edge (photo: columns 1214-1236, rows 1081-1107)
    "flap_slot": {"x": mx(1225), "y": my(1094), "w": round(16 / 1000, 4), "h": round(19 / 1000, 4)},
    "feet_x": mx(727) * -1,
    "mocha": list(MOCHA),
}
with open(os.path.join(D, "layout.json"), "w") as f:
    json.dump(L, f, indent=1)
print("wrote", os.path.join(D, "layout.json"))
print(json.dumps(L))
