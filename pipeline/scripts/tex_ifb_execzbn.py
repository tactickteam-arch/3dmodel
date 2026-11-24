"""Textures and layout for the IFB Executive ZBN CMS washer dryer refresher (9 kg wash / 6 kg dry / 3 kg refresh, 1400 rpm),
in its three colours: Black Hairline (Executive ZBN CMS), White (Executive ZVN) and Mocha (Executive ZMN CMS). One body: IFB's
manual UF421PKMAN772-B covers "Executive ZVN/ZMN/ZBN 9.0/6.0/3.0 Kg 1400 RPM" with one set of figures, and IFB's pages give the
three one size (598 x 667 x 875 mm) and one panel.

usage: python3 tex_ifb_execzbn.py <photos dir> <logos dir> <out dir>
  photos: ifb_execzbn/front_zbn.webp       IFB's straight-on photo of the Executive ZBN (its panel reads "EXECUTIVE ZBN
                                           9.0/6.0/3.0"), 2200 x 1320 with transparency
          ifb_execzbn/front_zvn.webp       the same for the Executive ZVN (white), and front_zmn.webp, the ZMN (mocha)
          ifb_execzbn/door_open_zbn.webp   IFB's photo of the ZBN with its door open, same framing
          ifb_execzbn/ifb_logo_big.png     IFB's own logo file (ifbappliances.com, icons/ifb-logo.svg), rasterised
  writes <out dir>/ifb_execzbn/*.jpg and layout.json (every position the builder needs, in metres)

Scale. IFB's straight-on renders of the three colours share one framing to a pixel or two (and the Executive Plus's, 12 px to
the left): the cabinet spans columns 711-1513 (803 px for 598 mm, 1.343 px per mm), and the door's ring is round, so the pixels
are square. At that scale the photo's cabinet is 838 mm tall, but IFB publishes 875 mm: the fascia and the door keep the photo's
size and place under the top edge, and the 37 mm goes into the plain front below the door (ESTIMATED, as for the Executive Plus).

Text. Every word on the fascia, the display glass and the drawer is set again (Arial or Arial Narrow, whichever matches the
photo's width to height; DIN Alternate for the drawer's words; the model line in the face that correlates best), each fitted to
the ink box it has in the photo. The display's icons are drawn again as shapes after the manual's own display drawing and icon
list (pages 8-10); its seven-segment figures as hexagonal bars. The dial and the power button are 3D.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "ifb_execzbn"
SRC = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
ARIALB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
NARROW = "/System/Library/Fonts/Supplemental/Arial Narrow.ttf"
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
KRUNG = "/System/Library/Fonts/Supplemental/Krungthep.ttf"
DIN = "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf"
MASK = 240

# ── IFB's size: 598 W x 875 H mm (product page, manual p.85); 667 mm deep on IFB's pages for all three colours, 62.1 cm
# ("Net Size WxDxH 59.8 x 62.1 x 87.5", manual p.85). Read together: the cabinet is 621 mm to the fascia's face and the door
# stands 46 mm in front of it (667 overall; the Executive Plus's door, the same part family, measured 45.8 mm proud). ──
W_MM, H_MM, D_MM, D_ALL = 598.0, 875.0, 621.0, 667.0

# ── the photo's scale and rows (front_zbn.webp; the other colours are lined up to it below) ──
C0, C1 = 711, 1513                 # the cabinet's columns (the fascia, its widest part)
PPM = (C1 - C0 + 1) / W_MM          # 1.3428 px per mm, both ways
CXP = (C0 + C1 + 1) / 2
TOP = 96.0                          # the fascia's top edge (875 mm)
FACE_BOT = 259.5                    # the fascia's front face ends here (its rounded lower edge)
CHIN_BOT = 288.5                    # under it a dark chin slopes back to the front (rows 260-288)
FEET = 12.0                         # mm, ESTIMATED as on the Executive Plus: 10-15 px of foot under the cabinet
SEAM = 979.5                        # the groove between the drawer's face and the control panel (column 979)
T = 7.0
K = T / PPM

COLOURS = ["zbn", "zvn", "zmn"]
NAMES = {"zbn": "Black Hairline", "zvn": "White", "zmn": "Mocha"}
MODEL_WORD = {"zbn": "ZBN", "zvn": "ZVN", "zmn": "ZMN"}
# the model line under the dial, each colour's own photo boxes (the renders place it 0-4 px apart)
MODEL_LINE = {
    "zbn": [("EXECUTIVE", (1277.5, 238.0, 1325.8, 245.6)), ("ZBN", (1330.7, 238.0, 1349.0, 245.6)), ("9.0/6.0/3.0", (1356.0, 238.0, 1410.0, 245.6))],
    "zmn": [("EXECUTIVE", (1274.0, 238.3, 1321.8, 245.8)), ("ZMN", (1326.5, 238.3, 1346.5, 245.8)), ("9.0/6.0/3.0", (1354.0, 238.3, 1407.0, 245.8))],
    "zvn": [("EXECUTIVE", (1272.5, 241.0, 1321.8, 248.4)), ("ZVN", (1326.5, 241.0, 1345.5, 248.4)), ("9.0/6.0/3.0", (1353.0, 241.0, 1407.0, 248.4))],
}


def mx(col):
    return round((col - CXP) / PPM / 1000, 5)


def my_top(row):
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
    return np.asarray(b.convert("RGB")).astype(np.float32), np.asarray(im)[..., 3]


PH, AL = {}, {}
for v in COLOURS:
    PH[v], AL[v] = load(f"front_{v}.webp")
ph, ALPHA = PH["zbn"], AL["zbn"]
grey = ph.mean(-1)


def fit_circle(ys, xs):
    A = np.c_[2 * xs, 2 * ys, np.ones(len(xs))]
    cx, cy, c = np.linalg.lstsq(A, xs ** 2 + ys ** 2, rcond=None)[0]
    return cx, cy, math.sqrt(c + cx ** 2 + cy ** 2)


# ── the door's chrome ring on the ZBN (bright, grey) ──
sat = ph.max(-1) - ph.min(-1)
m = (grey > 150) & (sat < 25) & (ALPHA > 200)
m[:280] = False
m[1010:] = False
m[:, :C0 + 5] = False
m[:, C1 - 5:] = False
ys, xs = np.where(m)
dcx, dcy, dr = fit_circle(ys.astype(float), xs.astype(float))
for _ in range(4):
    d = np.hypot(xs - dcx, ys - dcy)
    k = np.abs(d - dr) < 10
    dcx, dcy, dr = fit_circle(ys[k].astype(float), xs[k].astype(float))
d = np.hypot(xs[k] - dcx, ys[k] - dcy)
RING_OUT, RING_IN = np.percentile(d, 98) / PPM, np.percentile(d, 2) / PPM
print(f"door ring: centre col {dcx:.1f} row {dcy:.1f}, chrome {RING_IN:.1f}-{RING_OUT:.1f} mm")

CHIN_Y = my_top(CHIN_BOT)
DOOR_Y = round(CHIN_Y - (dcy - CHIN_BOT) / PPM / 1000, 5)       # the door's centre at the photo's own distance under the chin
DOOR_ROW_BOT = dcy + RING_OUT * PPM

# the cabinet's lower edge: where the silhouette narrows to the feet
wid = np.array([(ALPHA[r] > 128).sum() for r in range(ALPHA.shape[0])])
CAB_BOT = float(np.where(wid > 0.97 * (C1 - C0 + 1))[0].max() + 1)
print(f"cabinet bottom row {CAB_BOT}, silhouette ends at row {np.where(wid > 0)[0].max() + 1}")


def my(row):                        # any photo row -> metres above the floor
    if row <= CHIN_BOT:
        return my_top(row)
    if row <= DOOR_ROW_BOT:
        return round(DOOR_Y - (row - dcy) / PPM / 1000, 5)
    y0, y1 = DOOR_Y - RING_OUT / 1000, FEET / 1000
    return round(y0 + (row - DOOR_ROW_BOT) / (CAB_BOT - DOOR_ROW_BOT) * (y1 - y0), 5)


# ── the pump-filter flap: a thin circle at the lower right, found on the white ZVN (the clearest line), checked on the ZBN ──
def find_flap(img, x0=1212, y0=985, x1=1436, y1=1197):
    g = img.mean(-1)[y0:y1, x0:x1]
    mm = np.abs(cv2.GaussianBlur(g, (0, 0), 6) - g) > 6
    ys, xs = np.where(mm)
    fcx, fcy, fr = fit_circle((ys + y0).astype(float), (xs + x0).astype(float))
    for _ in range(5):
        dd = np.hypot(xs + x0 - fcx, ys + y0 - fcy)
        k = np.abs(dd - fr) < 4
        fcx, fcy, fr = fit_circle((ys[k] + y0).astype(float), (xs[k] + x0).astype(float))
    return fcx, fcy, fr


fcx, fcy, fr = find_flap(PH["zvn"])
print(f"flap (ZVN): centre col {fcx:.1f} row {fcy:.1f}, r {fr / PPM:.1f} mm; ZBN: " + " ".join(f"{v:.1f}" for v in find_flap(ph)))


# ── fonts, words, marks ──
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
    bx0, by0, bx1, by1 = [(v - o) * K for v, o in zip(box, origin * 2)]
    bw, bh = bx1 - bx0, by1 - by0
    h, w = m.shape
    k = bw / w if keep == "w" else bh / h if keep == "h" else min(bw / w, bh / h)
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    if keep == "xy":
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


def icon(kind):
    """The display's icons, drawn at 200 units after the manual's display drawing and icon list (pp. 8-10)."""
    S = 200
    im = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(im)
    L = 14
    if kind == "wifi":                                      # Wi-Fi: three arcs over a dot
        for r in (90, 62, 34):
            d.arc([100 - r * 1.1, 150 - r, 100 + r * 1.1, 150 + r], 215, 325, fill=255, width=22)
        d.ellipse([86, 150, 114, 178], fill=255)
    elif kind == "kg":                                      # "Kg": the maximum load
        d.text((100, 100), "Kg", font=ImageFont.truetype(ARIAL, 150), fill=255, anchor="mm")
    elif kind == "tap":                                     # Tap: a drop outline with a lightning stroke through it
        d.arc([30, 70, 170, 196], -40, 220, fill=255, width=L)
        d.line([(42, 105), (100, 8), (158, 105)], fill=255, width=L, joint="curve")
        d.polygon([(118, 70), (70, 135), (100, 135), (80, 180), (132, 112), (102, 112)], fill=255)
    elif kind == "childlock":                               # Child lock: a padlock whose body carries two eyes and a smile
        d.rounded_rectangle([28, 88, 172, 196], 22, fill=255)
        d.arc([52, 10, 148, 140], 180, 360, fill=255, width=20)
        d.line([(52, 74), (52, 92)], fill=255, width=20)
        d.line([(148, 74), (148, 92)], fill=255, width=20)
        d.ellipse([64, 116, 84, 136], fill=0)
        d.ellipse([116, 116, 136, 136], fill=0)
        d.arc([70, 120, 130, 176], 20, 160, fill=0, width=12)
    elif kind == "door":                                    # Door: a ring with a crescent inside its left half
        d.ellipse([14, 14, 186, 186], outline=255, width=L)
        d.arc([40, 34, 172, 166], 100, 260, fill=255, width=L)
    elif kind == "prewash":                                 # Prewash: a tub with a shirt in it
        d.line([(14, 44), (40, 44), (40, 186), (160, 186), (160, 44), (186, 44)], fill=255, width=L, joint="curve")
        d.polygon([(62, 58), (84, 50), (100, 64), (116, 50), (138, 58), (146, 92), (128, 92), (128, 150), (72, 150), (72, 92), (54, 92)], outline=255, width=11)
        d.line([(100, 92), (100, 132)], fill=255, width=10)
    elif kind == "steam":                                   # Steam: a shirt over a steam cloud with drops
        d.polygon([(24, 32), (64, 14), (100, 40), (136, 14), (176, 32), (186, 92), (152, 92), (152, 186), (48, 186), (48, 92), (14, 92)], outline=255, width=12)
        d.arc([62, 104, 104, 146], 140, 360, fill=255, width=10)
        d.arc([92, 94, 140, 142], 180, 30, fill=255, width=10)
        d.line([(66, 144), (134, 144)], fill=255, width=10)
        for x in (78, 100, 122):
            d.line([(x, 156), (x, 172)], fill=255, width=9)
    elif kind == "timesaver":                               # Time Saver: a clock with an arrow round it
        d.arc([22, 22, 178, 178], 230, 170, fill=255, width=L)
        d.polygon([(10, 66), (52, 40), (58, 84)], fill=255)
        d.line([(100, 56), (100, 104), (136, 104)], fill=255, width=L, joint="curve")
    elif kind == "cupboard":                                # Cupboard Dry: a wardrobe, two doors with handles, on feet
        d.rectangle([24, 14, 176, 172], outline=255, width=16)
        d.line([(100, 14), (100, 172)], fill=255, width=12)
        d.line([(86, 76), (86, 110)], fill=255, width=10)
        d.line([(114, 76), (114, 110)], fill=255, width=10)
        d.rectangle([30, 172, 50, 192], fill=255)
        d.rectangle([150, 172, 170, 192], fill=255)
    elif kind == "iron":                                    # Iron Dry: an iron over a wavy line
        d.line([(20, 128), (180, 128)], fill=255, width=L)
        d.line([(20, 128), (34, 84), (70, 62), (180, 62), (180, 128)], fill=255, width=L, joint="curve")
        d.line([(90, 62), (102, 36), (160, 36)], fill=255, width=L, joint="curve")
        xs = np.linspace(20, 180, 60)
        d.line([(x, 166 + 10 * math.sin((x - 20) / 160 * 4 * math.pi)) for x in xs], fill=255, width=12)
    elif kind == "clock":                                   # Time Dry: a clock
        d.ellipse([16, 16, 184, 184], outline=255, width=L)
        d.line([(100, 46), (100, 104), (140, 104)], fill=255, width=L, joint="curve")
    elif kind == "playpause":
        d.polygon([(10, 10), (110, 100), (10, 190)], outline=255, width=L)
        d.rectangle([132, 10, 150, 190], fill=255)
        d.rectangle([172, 10, 190, 190], fill=255)
    elif kind == "house":                                   # My IFB: a house with a Wi-Fi mark at its roof
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
    return np.asarray(im).astype(np.float32) / 255


def power_steam_icon():
    """IFB's Power Steam mark: a red rounded square with a white cloud and three steam strokes (manual p.8, panel)."""
    im = Image.new("L", (200, 200), 0)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, 200, 200], 40, fill=255)
    d.arc([36, 50, 96, 110], 150, 330, fill=0, width=16)
    d.arc([76, 30, 150, 104], 190, 20, fill=0, width=16)
    d.arc([120, 64, 170, 114], 250, 80, fill=0, width=16)
    d.line([(48, 106), (154, 106)], fill=0, width=16)
    for x in (78, 100, 122):
        d.line([(x, 126), (x, 166)], fill=0, width=12)
    return np.asarray(im).astype(np.float32) / 255


# ── the control panel: the fascia right of the seam, the display glass and its print (ZBN photo px) ──
PANEL_BOX = (SEAM, TOP, C1 + 1, FACE_BOT)
DISPLAY = (1003.0, 123.3, 1221.8, 230.4)                         # the black glass
DIGITS_WIN = (1082.2, 153.2, 1140.9, 175.9)                     # the lighter window behind the time
KNOB = (1306.0, 142.0, 1375.0, 211.0)                           # the dial's base circle (its face is seen a little from above)
POWER = (1402.5, 163.5, 1433.5, 195.0)                          # the power button
TEXT = (226, 226, 226)
SUBTXT = (200, 200, 200)
LEFT = [("Bulky/My IFB", (1007.5, 130.2, 1048.0, 138.5)), ("Mix/Daily", (1007.0, 146.0, 1035.0, 154.0)), ("Cotton", (1007.0, 161.0, 1027.3, 168.0)),
        ("Synthetic", (1007.0, 176.0, 1036.0, 184.0)), ("CradleWash®", (1007.0, 192.0, 1049.0, 198.5))]
HOUSE = (1050.0, 127.2, 1059.0, 136.7)
RIGHT = [("Wash+Dry2Hr", (1172.0, 130.3, 1216.0, 139.0)), ("Wash+Dry4Hr", (1172.0, 146.0, 1216.0, 154.5)), ("Spin & Dry", (1183.0, 161.0, 1216.0, 170.0)),
         ("Express 15’", (1180.0, 176.0, 1216.0, 184.2)), ("Refresh", (1192.0, 192.0, 1216.0, 199.0))]
LEDS = [(1066.7, 132.0, 1071.3, 136.3, True), (1067, 147, 1071, 151, False), (1067, 162.5, 1071, 166.5, False), (1066.5, 178, 1070.5, 182, False),
        (1066.5, 194, 1070.5, 198, False)] + [(1153, 132, 1157, 136, False), (1153, 147, 1157, 151, False), (1153, 163, 1157, 167, False),
        (1152.8, 178, 1156.8, 182, False), (1152.5, 194, 1156.5, 198, False)]
KEYS = [("Temp", (1016.5, 207.5, 1033.5, 215.0)), ("Spin", (1052.0, 207.5, 1066.0, 215.0)), ("Steam", (1084.0, 208.0, 1104.0, 213.6)),
        ("TimeSaver", (1113.0, 207.5, 1144.0, 213.6)), ("Dry", (1157.5, 207.5, 1168.0, 215.0))]
PLAY = (1192.0, 207.0, 1203.0, 216.0)
BARS = [1007.5, 1042.0, 1076.5, 1110.8, 1145.2, 1180.5, 1214.6]   # the key row's separators ("|TimeSaver|" uses two)
SUBS = [("Prewash", (1017.0, 217.0, 1032.0, 220.5)), ("*Extra Rinse", (1048.0, 217.0, 1069.0, 221.0)), ("*WiFi Reset", (1083.0, 217.0, 1104.0, 221.0)),
        ("*Tub Clean", (1119.0, 217.0, 1138.0, 221.0)), ("*Clear", (1157.0, 217.0, 1166.0, 221.0))]
TOP_ICONS = [("wifi", (1082.2, 137.2, 1089.2, 144.0), True), ("kg", (1093.0, 137.8, 1100.0, 145.0), False), ("tap", (1103.0, 136.6, 1109.2, 145.6), True),
             ("childlock", (1114.2, 137.8, 1119.6, 145.0), False), ("door", (1124.0, 138.0, 1130.8, 144.2), False), ("prewash", (1134.2, 138.0, 1140.8, 144.2), False)]
BOT_ICONS = [("steam", (1082.1, 185.0, 1089.2, 192.0), False), ("timesaver", (1092.1, 185.0, 1099.2, 192.0), False), ("cupboard", (1102.2, 185.0, 1109.2, 192.0), True),
             ("iron", (1113.0, 186.0, 1120.0, 192.0), False), ("clock", (1123.8, 185.5, 1131.0, 191.5), False), ("playpause", (1134.0, 186.0, 1140.8, 191.0), False)]
DIGITS = [("1", (1090.2, 156.2, 1092.2, 172.8), False), ("8", (1095.0, 156.2, 1104.3, 172.8), False), ("4", (1110.8, 156.2, 1120.0, 172.8), True),
          ("0", (1122.9, 156.2, 1133.3, 172.8), True)]
COLON = (1107.2, 1108.8, (162.8, 167.6))
PRESS = (1165.0, 115.0, 1218.5, 119.7)                         # "*Press and Hold for 3 sec." over the glass, on the fascia
PS_ICON = (1006.0, 234.6, 1017.0, 245.4)
PS_TEXT = (1020.6, 238.6, 1082.0, 245.2)
PS_REG = (1083.0, 238.5, 1087.5, 242.5)
RED = (232, 64, 84)

# the drawer's face
DRAWER_BOX = (C0, TOP, SEAM, FACE_BOT)
LOGO = (828.0, 154.0, 872.5, 168.8)
GRIP = (755.6, 181.6, 944.6, 228.0)
LIP_BOT = 188.6
ECO_ICON = (760.0, 232.2, 770.6, 243.6)
ECO_TEXT = (771.8, 239.0, 814.4, 244.6)
WDR = [("WASH", (870.0, 239.0, 888.0, 244.6)), ("|", (890.2, 238.6, 891.0, 245.0)), ("DRY", (893.0, 239.0, 905.0, 244.6)),
       ("|", (906.3, 238.6, 907.1, 245.0)), ("REFRESH", (911.0, 239.0, 939.0, 244.6))]
ECO_FRAME = (23.0, 18.0, 92.0, 90.0)


# ── each colour's fascia and print colours, read off its own photo ──
def fascia_profile(v, cols, y0, y1):
    """The fascia's tone row by row (median of print-free columns), the bevel's edge rows held flat."""
    g = PH[v].mean(-1)
    prof = np.median(g[int(y0):int(y1) + 1][:, cols], axis=1)
    prof[:6] = prof[6]
    prof[-5:] = prof[-6]
    return cv2.GaussianBlur(prof.reshape(-1, 1).astype(np.float32), (1, 0), 3).ravel()


def tone(v, x0, y0, x1, y1):
    return np.median(PH[v][int(y0):int(y1), int(x0):int(x1)].reshape(-1, 3), axis=0)


# Under the page's light (studio.hdr, exposure 1.05) a dark gloss fascia renders at about its texture value (the Executive
# Plus's look pass); a white one is lifted about 1.2 x, so the white fascia's texture holds its photo value x WHITE_SHADE.
WHITE_SHADE = 0.86
FASCIA = {}
INK = {}
for v in COLOURS:
    c = tone(v, 1440, 105, 1500, 140)                          # plain fascia right of the power button
    light = c.mean() > 128
    FASCIA[v] = (c * WHITE_SHADE) if light else c
    # print colours: light print on the dark fascias (as the Executive Plus: 205-214), dark grey print on the white one,
    # each read as the 2nd percentile of its photo box and pushed 1.3 x from the fascia (the photo blurs thin strokes)
    def ink(box):
        px = PH[v][int(box[1]):int(math.ceil(box[3])), int(box[0]):int(math.ceil(box[2]))].reshape(-1, 3)
        p = np.percentile(px, 2 if light else 98, axis=0)
        return np.clip(c + (p - c) * 1.3, 0, 255) * (WHITE_SHADE if light else 1.0)
    INK[v] = {"model": ink(MODEL_LINE[v][0][1]), "press": ink(PRESS), "logo": ink(LOGO), "drawer": ink(WDR[0][1])}
    if not light:   # light print on a dark fascia: no brighter than the Executive Plus's checked print greys (look pass 5 Nov)
        for key, cap in (("model", 205), ("press", 170), ("logo", 214), ("drawer", 205)):
            INK[v][key] = np.minimum(INK[v][key], cap)
    print(v, "fascia", c.round(0), "->", np.round(FASCIA[v]), {k: list(np.round(x).astype(int)) for k, x in INK[v].items()})


def base_canvas(v, box, cols, tw, th):
    prof = fascia_profile(v, cols, box[1], box[3])
    base = FASCIA[v]
    rel = (prof - prof.mean()) * 0.5 / max(prof.mean(), 1)
    rows = np.interp(np.arange(th) / K + box[1], np.arange(len(prof)) + box[1], rel)
    return np.clip(base[None, None, :] * (1 + rows[:, None, None]) * np.ones((1, tw, 1)), 0, 255).astype(np.float32)


def display_print(can, org):
    """Everything on the display glass (the same in every colour)."""
    gx0, gy0, gx1, gy1 = [(v - o) * K for v, o in zip(DISPLAY, org * 2)]
    th, tw = can.shape[:2]
    mask = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(mask).rounded_rectangle([gx0, gy0, gx1, gy1], radius=1.5 * T, fill=255)
    mk = np.asarray(mask).astype(np.float32)[..., None] / 255
    yy = (np.arange(th)[:, None, None] - gy0) / max(1, gy1 - gy0)
    glass = 7 + 14 * np.clip((yy - 0.8) / 0.2, 0, 1) ** 2
    can[:] = can * (1 - mk) + glass * mk
    rim = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(rim).rounded_rectangle([gx0, gy0, gx1, gy1], radius=1.5 * T, outline=255, width=max(1, round(0.3 * T)))
    blend(can, np.asarray(rim).astype(np.float32) / 255 * 0.35, 0, 0, (120, 120, 122))
    wx0, wy0, wx1, wy1 = [(v - o) * K for v, o in zip(DIGITS_WIN, org * 2)]
    win = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(win).rounded_rectangle([wx0, wy0, wx1, wy1], radius=0.6 * T, fill=255)
    blend(can, np.asarray(win).astype(np.float32) / 255, 0, 0, (30, 30, 31))
    for s, b in LEFT:
        word(can, s, b, org, TEXT, "l")
    put(can, icon("house"), HOUSE, org, TEXT, keep="fit")
    for s, b in RIGHT:
        word(can, s, b, org, TEXT, "r")
    for s, b in KEYS:
        word(can, s, b, org, TEXT)
    for s, b in SUBS:
        word(can, s, b, org, SUBTXT)
    put(can, icon("playpause"), PLAY, org, TEXT, keep="fit")
    for bx in BARS:
        put(can, np.ones((10, 1), np.float32), (bx - 0.45, 207.8, bx + 0.45, 215.5), org, (200, 200, 200), keep="h")
    put(can, icon("lock_small"), (1074.2, 217.5, 1078.8, 223.0), org, SUBTXT, keep="fit")
    for xa, xb in ((1070.2, 1072.8), (1079.8, 1082.2)):
        put(can, np.ones((1, 10), np.float32), (xa, 220.0, xb, 220.6), org, SUBTXT, keep="w")
    for xa, ya, xb, yb, lit in LEDS:
        put(can, np.ones((10, 10), np.float32), (xa, ya, xb, yb), org, (250, 250, 250) if lit else (118, 118, 118), keep="fit")
    for kind, b, lit in TOP_ICONS + BOT_ICONS:
        put(can, icon(kind), b, org, (246, 246, 246) if lit else (96, 96, 98), keep="fit")
    for ch, b, lit in DIGITS:
        put(can, seven(ch, 22 if lit else 12), b, org, (250, 250, 250) if lit else (88, 88, 90), keep="h", align="r")
    for yc in COLON[2]:
        put(can, np.ones((10, 10), np.float32), (COLON[0], yc - 0.8, COLON[1], yc + 0.8), org, (88, 88, 90), keep="fit")


MODEL_FONT = None


def pick_model_font():
    """The model line's face: the one whose set word correlates best with the ZBN photo's "EXECUTIVE" (light on dark)."""
    box = MODEL_LINE["zbn"][0][1]
    x0, y0, x1, y1 = int(box[0]) - 1, int(box[1]) - 1, int(math.ceil(box[2])) + 1, int(math.ceil(box[3])) + 1
    ref = cv2.resize(grey[y0:y1, x0:x1], ((x1 - x0) * 6, (y1 - y0) * 6), interpolation=cv2.INTER_CUBIC)
    ref = (ref - ref.mean()) / (ref.std() + 1e-6)
    best = None
    for path, idx in ((KRUNG, 0), (AVENIR, 7), (AVENIR, 5), (DIN, 0), (ARIAL, 0)):
        m = text_mask("EXECUTIVE", MASK, path, idx)
        can = np.zeros(((y1 - y0) * 6, (x1 - x0) * 6), np.float32)
        bw, bh = (box[2] - box[0]) * 6, (box[3] - box[1]) * 6
        mm = cv2.resize(m, (max(1, round(bw)), max(1, round(bh))), interpolation=cv2.INTER_AREA)
        ox, oy = round((box[0] - x0) * 6), round((box[1] - y0) * 6)
        can[oy:oy + mm.shape[0], ox:ox + mm.shape[1]] = mm[:can.shape[0] - oy, :can.shape[1] - ox]
        can = cv2.GaussianBlur(can, (0, 0), 3.5)
        cc = float(((can - can.mean()) / (can.std() + 1e-6) * ref).mean())
        aspect = (m.shape[1] / m.shape[0]) / (bw / bh)
        print(f"model-line face {os.path.basename(path)}[{idx}]: correlation {cc:.3f}, natural/box aspect {aspect:.2f}")
        if best is None or cc > best[0]:
            best = (cc, path, idx)
    return best[1], best[2]


def panel(v, name):
    x0, y0, x1, y1 = PANEL_BOX
    tw, th = round((x1 - x0) * K), round((y1 - y0) * K)
    can = base_canvas(v, PANEL_BOX, np.r_[1235:1255, 1445:1500], tw, th)
    org = (x0, y0)
    display_print(can, org)
    word(can, "*Press and Hold for 3 sec.", PRESS, org, INK[v]["press"], "r")
    put(can, power_steam_icon(), PS_ICON, org, RED, keep="fit")
    put(can, text_mask("POWER STEAM", MASK, ARIALB), PS_TEXT, org, RED, keep="w", align="l")
    put(can, text_mask("®", MASK, ARIAL), PS_REG, org, RED, keep="fit")
    for s, b in MODEL_LINE[v]:
        put(can, text_mask(s, MASK, *MODEL_FONT), b, org, INK[v]["model"], keep="xy")
    can = np.clip(can, 0, 255).astype(np.uint8)
    if name:
        save(Image.fromarray(can), name, 88)
    return can


# ── the drawer's face ──
def tbox(box, org, pad=0.0):
    x0, y0, x1, y1 = [(v - o) * K for v, o in zip(box, org * 2)]
    return int(x0 - pad * K), int(y0 - pad * K), int(np.ceil(x1 + pad * K)), int(np.ceil(y1 + pad * K))


def vec(can, org, box, colour, fn, ss=8):
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
    """IFB's eco mark (the drop, the leaf and two bubbles: the same on the Executive Plus and the Serena, traced on IFB's
    drawer photos there), fitted into this drawer's measured box."""
    fx0, fy0, fx1, fy1 = ECO_FRAME
    sx, sy = (box[2] - box[0]) / (fx1 - fx0), (box[3] - box[1]) / (fy1 - fy0)
    def fn(d, P, W):
        Q = lambda pts: [P(box[0] + (x - fx0) * sx, box[1] + (y - fy0) * sy) for x, y in pts]
        ww = lambda u: W(u * sx * weight)
        a = np.linspace(-np.pi / 2, 0, 50)
        stroke(d, Q([(32, 44), (32, 19)] + list(zip(32 + 28.5 * np.cos(a), 70 + 51 * np.sin(a))) + [(60.5, 72)]), ww(5.4))
        A, Tt = (26.5, 49.0), (57.0, 87.0)
        stroke(d, Q(bez(A, (44, 55), (55, 64), Tt)), ww(4.3))
        stroke(d, Q([A, (26.5, 66)] + bez((26.5, 66), (28, 74), (42, 82), Tt)), ww(4.3))
        stroke(d, Q(bez((37, 60), (37.5, 70), (44, 77), (54, 84))), ww(4.0))
        for (cx, cy), r, w in (((70, 30.3), 5.4, 4.4), ((79, 56), 7.6, 4.8)):
            (X, Y), = Q([(cx, cy)])
            for rr, fill in ((r + w * weight / 2, 255), (r - w * weight / 2, 0)):
                rx, ry = W(rr * sx), W(rr * sy)
                d.ellipse([X - rx, Y - ry, X + rx, Y + ry], fill=fill)
    return fn


def drawer(v, name):
    x0, y0, x1, y1 = DRAWER_BOX
    tw, th = round((x1 - x0) * K), round((y1 - y0) * K)
    can = base_canvas(v, DRAWER_BOX, np.r_[720:745, 950:972], tw, th)
    org = (x0, y0)
    logo = np.asarray(Image.open(os.path.join(SRC, "ifb_logo_big.png")).convert("RGBA"))[..., 3].astype(np.float32) / 255
    ys, xs = np.where(logo > 0.3)
    logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    put(can, logo, LOGO, org, INK[v]["logo"], keep="w")
    col = INK[v]["drawer"]
    vec(can, org, ECO_ICON, col, eco_mark(ECO_ICON, 0.9))
    put(can, text_mask("ECO INVERTER", MASK, DIN), ECO_TEXT, org, col, keep="xy")
    for s, b in WDR:
        if s == "|":
            put(can, np.ones((10, 1), np.float32), b, org, col, keep="xy")
        else:
            put(can, text_mask(s, MASK, DIN), b, org, col, keep="xy")
    save(Image.fromarray(np.clip(can, 0, 255).astype(np.uint8)), name, 88)


# ── the fronts: each colour's own body colour, half the photo's fall from top to bottom; the ZBN's black hairline brushing ──
FALL = 0.5


def lin(v):
    v = np.asarray(v, np.float64) / 255
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def srgb(v):
    v = np.clip(v, 0, 1)
    return 255 * np.where(v <= 0.0031308, v * 12.92, 1.055 * v ** (1 / 2.4) - 0.055)


# body colour as texture value, from the photo's mean body colour: dark paints render at about 0.8 of the photo value under the
# page's light (the Executive Plus's mocha: photo (55, 48, 43) -> base (44, 38, 34), checked against its white card), the
# white body like the white fascia (WHITE_SHADE)
BODY = {}


def front_fall(v):
    p = PH[v]
    Y = lin(p).mean(-1)
    H, W = Y.shape
    yy, xx = np.mgrid[0:H, 0:W]
    body = (AL[v] > 250) & (xx > C0 + 10) & (xx < C1 - 10) & (yy > CHIN_BOT + 4) & (yy < CAB_BOT - 4)
    body &= np.hypot(xx - dcx, yy - dcy) > RING_OUT * PPM + 10
    body &= np.hypot(xx - fcx, yy - fcy) > fr + 10
    low = body & (yy > DOOR_ROW_BOT + 10)
    mean = np.median(p[low], axis=0)
    light = mean.mean() > 128
    BODY[v] = np.round(mean * (WHITE_SHADE if light else 0.8)).astype(int)
    col = np.array([np.median(Y[low[:, c], c]) if low[:, c].sum() > 20 else np.nan for c in range(W)])
    cs = np.isfinite(col)
    col = np.interp(np.arange(W), np.where(cs)[0], col[cs])
    col /= np.median(col[C0 + 10:C1 - 10])
    rows = np.arange(int(CHIN_BOT) + 5, int(CAB_BOT) - 4)
    prof = np.array([np.median(Y[r, body[r]] / col[body[r]]) for r in rows])
    weight = np.array([body[r].sum() for r in rows], np.float64)
    prof = cv2.GaussianBlur(prof.reshape(-1, 1).astype(np.float32), (1, 0), 12).ravel()
    gain = (prof / np.average(prof, weights=weight)) ** FALL
    gain /= np.average(gain, weights=weight)
    th = 512
    ys = CHIN_Y - (np.arange(th) + 0.5) / th * (CHIN_Y - FEET / 1000)
    row_of = np.interp(ys[::-1], [my(r) for r in rows[::-1]], rows[::-1])[::-1]
    g = np.interp(row_of, rows, gain)
    if v == "zbn":
        # Black Hairline: the photo shows fine horizontal brushing in light and dark streaks a few cm long. Drawn here as
        # streaks of filtered noise (the pattern is generated; its contrast is the photo's: the streaks span about +-6% of
        # the body's level in the photo's plain front under the door); the hairline grain map adds the fine lines.
        sub = Y[int(DOOR_ROW_BOT) + 15:int(fcy - fr) - 10, C0 + 30:int(fcx - fr) - 20]
        hp = sub / cv2.GaussianBlur(sub, (0, 0), 8) - 1
        amp = float(np.std(hp))
        tw = 1024
        rng = np.random.default_rng(20261123)
        n = rng.normal(0, 1, (th * 2, tw * 2)).astype(np.float32)
        n = cv2.GaussianBlur(n, (0, 0), sigmaX=60, sigmaY=0.7)
        n = cv2.resize(n, (tw, th), interpolation=cv2.INTER_AREA)
        n = n / n.std() * amp
        tex = srgb(lin(BODY[v])[None, None, :] * g[:, None, None] * (1 + n[..., None]))
        print(f"front_zbn: photo streak contrast {amp:.3f} (std of the high-passed luminance)")
        img = tex
    else:
        tex = srgb(lin(BODY[v])[None, :] * g[:, None])
        img = np.repeat(tex[:, None, :], 8, 1)
    save(Image.fromarray(np.clip(np.round(img), 0, 255).astype(np.uint8)), f"front_{v}.jpg", 88 if v == "zbn" else 92)
    print(f"front {v}: photo body {mean.round(0)} -> base {BODY[v]}; fall top {g[:20].mean():.2f}, bottom {g[-20:].mean():.2f}")


# ── generated surfaces: the dial's brushed top, the power button, the drum's holes, the ribbed hose (as the Executive Plus) ──
def knob_top():
    n = 512
    yy, xx = np.mgrid[0:n, 0:n] - (n - 1) / 2
    ang = np.arctan2(yy, xx)
    r = np.hypot(xx, yy) / (n / 2)
    rng = np.random.default_rng(1014)
    streak = np.interp(ang, np.linspace(-np.pi, np.pi, 720), rng.normal(0, 1, 720).cumsum() % 6 / 6) * 0.25
    sect = 0.55 + 0.45 * np.cos(2 * ang + 0.6) * np.cos(ang * 1 - 0.3)
    v = 120 + 110 * sect + 40 * (streak - 0.12)
    v = v * (0.92 + 0.08 * r)
    v[r > 0.985] = 90
    save(Image.fromarray(np.repeat(np.clip(v, 0, 255)[..., None], 3, 2).astype(np.uint8)), "knob_top.jpg", 88)


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
    w, h = 64, 16
    u = np.arange(w) / w
    v = 120 + 70 * np.sin(u * 2 * np.pi) ** 2
    save(Image.fromarray(np.clip(np.repeat(np.repeat(v[None, :, None], h, 0), 3, 2), 0, 255).astype(np.uint8)), "hose.jpg", 90)


# ── the prints at 12 px per mm: the display glass's face (one texture, every colour), the strip's flat face in two halves
# per colour (each under 4096 px), cut at the emptiest column right of the display, and the drawer's face per colour ──
HI = 12.0
TEX_MAX = 4096


def save_hi(a, name, q=88):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(D, name), quality=q, subsampling=0, optimize=True)
    print("wrote", os.path.join(D, name), a.shape[1], "x", a.shape[0])


def panel_hi():
    rects = {}
    cut = None
    for v in COLOURS:
        can = panel(v, None)
        x0, y0 = PANEL_BOX[0], PANEL_BOX[1]
        h, w = can.shape[:2]
        if cut is None:
            lo = max(w - TEX_MAX + 16, math.ceil((DISPLAY[2] + 3 - x0) * K))
            hi = min(TEX_MAX - 16, round((DISPLAY[2] + 80 - x0) * K))
            g = can.astype(np.float32).max(2)
            ink = (np.abs(g - np.median(g, axis=1, keepdims=True)) > 14).sum(0).astype(np.float32)
            ink = np.convolve(ink, np.ones(61), "same")
            run = np.flatnonzero(ink[lo:hi] == ink[lo:hi].min())
            run = run[:np.argmax(np.diff(np.r_[run, 10 ** 9]) > 1) + 1]
            cut = int(lo + run[len(run) // 2])
            print("join at photo column", round(x0 + cut / K, 1), "ink there", float(ink[cut]))
            assert cut <= TEX_MAX and w - cut <= TEX_MAX, (w, cut)
            a, b = math.floor((DISPLAY[0] - x0) * K) - 2, math.ceil((DISPLAY[2] - x0) * K) + 2
            c, d = math.floor((DISPLAY[1] - y0) * K) - 2, math.ceil((DISPLAY[3] - y0) * K) + 2
            save_hi(can[c:d, a:b], "display.jpg")
            rects["display"] = {"file": "display.jpg", "rect": [a / w, c / h, b / w, d / h]}
            rects["panelA"] = {"file": "panel_a.jpg", "rect": [0.0, 0.0, cut / w, 1.0]}
            rects["panelB"] = {"file": "panel_b.jpg", "rect": [cut / w, 0.0, 1.0, 1.0]}
        face = can.copy()
        face[c + 4:d - 4, a + 4:b - 4] = 10
        save_hi(face[:, :cut], f"panel_a_{v}.jpg")
        save_hi(face[:, cut:], f"panel_b_{v}.jpg")
    with open(os.path.join(D, "decals.json"), "w") as f:
        json.dump(rects, f, indent=1)
    print("wrote decals.json, cut at", cut)


MODEL_FONT = pick_model_font()
print("model line face:", MODEL_FONT)
for v in COLOURS:
    front_fall(v)
T, K = 3.0, 3.0 / PPM                  # the strip's own texture under its 12 px per mm decals (only its bevel shows)
for v in COLOURS:
    panel(v, f"panel_{v}.jpg")
T, K = HI, HI / PPM
panel_hi()
for v in COLOURS:
    drawer(v, f"drawer_{v}.jpg")
T, K = 7.0, 7.0 / PPM
knob_top()
power_button()
drum()
hose()

L = {
    "W": W_MM / 1000, "H": H_MM / 1000, "D": D_MM / 1000, "D_all": D_ALL / 1000, "feet": FEET / 1000,
    "face_bot": my_top(FACE_BOT), "chin_bot": CHIN_Y, "seam": mx(SEAM),
    "panel_uv": {"x0": mx(PANEL_BOX[0]), "x1": mx(PANEL_BOX[2]), "y0": my_top(PANEL_BOX[3]), "y1": my_top(PANEL_BOX[1])},
    "drawer_uv": {"x0": mx(DRAWER_BOX[0]), "x1": mx(DRAWER_BOX[2]), "y0": my_top(DRAWER_BOX[3]), "y1": my_top(DRAWER_BOX[1])},
    "display": {"x0": mx(DISPLAY[0]), "x1": mx(DISPLAY[2]), "y0": my_top(DISPLAY[3]), "y1": my_top(DISPLAY[1])},
    "knob": {"x": mx((KNOB[0] + KNOB[2]) / 2), "y": my_top((KNOB[1] + KNOB[3]) / 2), "r": round((KNOB[2] - KNOB[0]) / 2 / PPM / 1000, 5)},
    "power": {"x": mx((POWER[0] + POWER[2]) / 2), "y": my_top((POWER[1] + POWER[3]) / 2), "r": round((POWER[2] - POWER[0]) / 2 / PPM / 1000, 5)},
    "grip": {"x0": mx(GRIP[0]), "x1": mx(GRIP[2]), "y0": my_top(GRIP[3]), "y1": my_top(GRIP[1]), "lip": my_top(LIP_BOT)},
    "door": {"x": mx(dcx), "y": DOOR_Y, "rim": round(RING_OUT / 1000, 5), "chrome_in": round(RING_IN / 1000, 5)},
    "flap": {"x": mx(fcx), "y": my(fcy), "r": round(fr / PPM / 1000, 5)},
    # the coin slot at the flap's left edge (ZVN photo: columns 1228-1248, rows 1082-1107)
    "flap_slot": {"x": mx(1238), "y": my(1094.5), "w": 0.015, "h": 0.0186},
    "feet_x": round(-mx(739), 5),
    "fascia": {v: [int(round(x)) for x in FASCIA[v]] for v in COLOURS},
    "body": {v: [int(x) for x in BODY[v]] for v in COLOURS},
}
with open(os.path.join(D, "layout.json"), "w") as f:
    json.dump(L, f, indent=1)
print(json.dumps(L))
