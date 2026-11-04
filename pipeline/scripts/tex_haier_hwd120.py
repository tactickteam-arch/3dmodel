"""Textures for the Haier HWD120-DM14F11BKU1, F11 12 kg front-load washer & dryer, Black.

usage: python3 tex_haier_hwd120.py <photos dir> <logos dir> <out dir>
  photos: haier_hwd120/front.jpg       Haier India's straight-on gallery photo of this model (1200 x 1200)
          haier_hwd120/panel.jpg       Haier's straight-on close-up of its control panel (1200 x 1200, 1.805 px per mm)
          haier_hwd120/l34.jpg, r34.jpg   Haier's 3/4 gallery photos from the left and from the right (the side walls)
          haier_hwd120/open_front.jpg  Haier's straight-on photo with the door open (the door seat, gasket, drum)
  logos:  haier.png
  writes <out dir>/haier_hwd120/*.jpg and layout.json (every position the builder needs, in metres)

Scale. Haier publishes 595 W x 850 H x 593 D mm (haier.com/in, this model's page). In the front photo the cabinet spans
columns 243-986 (744 px) and rows 82 (the panel's top edge) to 1128 (under the feet): 1.2504 px per mm across and 1.2306
down. The door rim is as tall as it is wide in the photo (664 px both ways), so the photo's own pixels are square and its
aspect is 1.6% wider than Haier's 595 x 850. Positions here are mapped with the two scales, so every part lands inside
Haier's published box; the round parts take the mean of the two (ESTIMATED to +-3 mm).
The panel photo spans columns 70.5-1144.5 (1.805 px per mm) from row 732 (the top edge), scaled down the same way.

Text. Every word, number and icon on the panel is set again: the words in Arial Narrow (Haier's print is a narrow grotesque;
Arial Narrow matches its width and letter height), "ULTRA FRESH AIR" in Arial Bold, the Haier wordmark from logos/haier.png,
the time as outlined seven-segment digits, and every icon redrawn as vector strokes from 8x enlargements of the panel photo,
each fitted to the ink box it has in the photo. The eleven programme tiles keep their pictures (the photo's, enlarged; they
are pictures on the colour display), with their names set again over them.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "haier_hwd120")
D = os.path.join(OUT, "haier_hwd120")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(1120)
NARROW = "/System/Library/Fonts/Supplemental/Arial Narrow.ttf"
NARROW_B = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"

W_MM, H_MM, D_MM = 595.0, 850.0, 593.0          # Haier: 595 x 850 x 593 mm (WxHxD), haier.com/in
FEET = 11.0                                       # ESTIMATED: the feet show 14 px under the cabinet in the front photo

# ── the photos' scales ──
FX0, FKX, FYB, FKY = 614.5, 744 / 595.0, 1128.0, 1046 / 850.0          # front.jpg: centre column, px/mm across; floor row, px/mm down
PX0, PKX, PY0 = 607.5, 1074 / 595.0, 732.0                             # panel.jpg: centre column, px/mm across; top row
PKY = PKX * FKY / FKX                                                  # the same aspect as the front photo


def fX(px):  # front photo column -> mm from the centre
    return (px - FX0) / FKX


def fY(py):  # front photo row -> mm above the floor
    return (FYB - py) / FKY


def pX(px):  # panel photo column -> mm from the centre
    return (px - PX0) / PKX


def pY(py):  # panel photo row -> mm above the floor
    return H_MM - (py - PY0) / PKY


# ── the layout, mm (VERIFIED where Haier gives it, else measured on Haier's photos: ESTIMATED) ──
PANEL_BOT = 771.0                      # the black glass panel and its rim: 771-850 (panel photo rows 732-872)
GLASS = (pX(83), pY(870.5), pX(1132), pY(741))          # the glass inside the rim
STRIP_BOT = 737.0                      # the recessed strip under the panel: 737-771 (rows 872-933)
SEAM = pX(434)                         # the gap between the drawer's section of the panel and the display's
DRAWER = (pX(83), pX(433.5))           # the drawer's glass face, across (the smart-dosing photo shows the left of the panel pulling out)
LIP = (pX(90), pX(433))                # its ribbed grip in the strip below
PLATE = (pX(489), pY(919.5), pX(726.5), pY(883))       # the ULTRA FRESH AIR plate
DOOR = dict(x=0.0, y=450.0)            # door centre: front photo (613, 574): 1.2 mm left of the centre line, 450 mm up
RIM_R = (332 / FKX + 332 / FKY) / 2    # the door's silver rim: 664 px across and up (267.7 mm)
DISH_R = (346 / FKX + 353 / FKY) / 2   # the dark groove round the door, the outer edge of the door seat (279 mm)
FLAP = dict(x=fX(883.5), y=fY(1035.5), r=72.5 / FKX)   # the round pump-filter flap, bottom right (its outline in the photo)
FEET_X = (fX(280), fX(941))            # the front feet's centres (front photo)
BODY = np.array([66, 69, 76], np.float32)              # the cabinet's colour where the front photo is evenly lit
SHADE = {"front.jpg": 0.55, "side_l.jpg": 1.0, "side_r.jpg": 1.0, "strip.jpg": 0.9, "drum.jpg": 0.6}   # the front faces the viewer's key light, the sides don't

S = 4096 / W_MM                       # panel and strip texture px per mm (6.88)


def save(img, name, q=88):
    if name in SHADE:                  # lit by the viewer's environment light, a texture renders about a quarter brighter than its pixels
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * SHADE[name]).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def tx(X):  # mm across -> panel texture px
    return (X + W_MM / 2) * S


def blend(canvas, m, X, Y, colour):
    h, w = m.shape
    xa, ya, xb, yb = max(0, X), max(0, Y), min(canvas.shape[1], X + w), min(canvas.shape[0], Y + h)
    if xb <= xa or yb <= ya:
        return
    a = np.clip(m[ya - Y:yb - Y, xa - X:xb - X], 0, 1)[..., None]
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + np.array(colour, np.float32) * a


def crop_ink(a, thr=0.3):
    ys, xs = np.where(a > thr)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def text_mask(s, px, path=NARROW):
    f = ImageFont.truetype(path, max(4, round(px)))
    w = int(f.getlength(s) + px * 2)
    im = Image.new("L", (w, int(px * 2.2)), 0)
    ImageDraw.Draw(im).text((px * 0.5, px * 0.4), s, font=f, fill=255)
    return crop_ink(np.asarray(im).astype(np.float32) / 255)


class Canvas:
    """A float image in texture px, with photo-box helpers: a box is (x0, y0, x1, y1) in panel-photo px."""

    def __init__(self, w, h, y_top_mm):
        self.a = np.zeros((h, w, 3), np.float32)
        self.top = y_top_mm

    def box(self, b):
        x0, y0, x1, y1 = b
        return tx(pX(x0)), (self.top - pY(y0)) * S, tx(pX(x1)), (self.top - pY(y1)) * S

    def place(self, m, b, colour, keep="fit", align="c"):
        x0, y0, x1, y1 = self.box(b)
        bw, bh = x1 - x0, y1 - y0
        h, w = m.shape
        k = bw / w if keep == "w" else bh / h if keep == "h" else min(bw / w, bh / h)
        nw, nh = max(1, round(w * k)), max(1, round(h * k))
        mm = cv2.resize(m.astype(np.float32), (nw, nh), interpolation=cv2.INTER_AREA)
        X = round(x0) if align == "l" else round(x1 - nw) if align == "r" else round((x0 + x1) / 2 - nw / 2)
        blend(self.a, mm, X, round((y0 + y1) / 2 - nh / 2), colour)

    def word(self, s, b, colour, path=NARROW, keep="fit", align="c"):
        x0, y0, x1, y1 = self.box(b)
        self.place(text_mask(s, max(8, (y1 - y0) * 2), path), b, colour, keep, align)

    def cap(self, s, x0, x1, top, base, colour, path=ARIAL):
        """Set s with its capitals from row top to row base (photo px) and its ink from column x0 to x1, as measured on
        8x enlargements of the panel photo; descenders hang below the base line as they do in print."""
        _, Y0, _, _ = self.box((0, top, 0, top))
        _, Y1, _, _ = self.box((0, base, 0, base))
        X0, _, X1, _ = self.box((x0, 0, x1, 0))
        big = 240
        f = ImageFont.truetype(path, big)
        hb = f.getbbox("H")
        im = Image.new("L", (int(f.getlength(s) + big), int(big * 1.6)), 0)
        ImageDraw.Draw(im).text((big * 0.25, 0), s, font=f, fill=255)
        m = np.asarray(im).astype(np.float32) / 255
        cols = np.where(m.max(0) > 0.3)[0]
        m = m[:, cols.min():cols.max() + 1]
        k = (Y1 - Y0) / (hb[3] - hb[1])
        mm = cv2.resize(m, (max(1, round(X1 - X0)), max(1, round(m.shape[0] * k))), interpolation=cv2.INTER_AREA)
        blend(self.a, mm, round(X0), round(Y0 - hb[1] * k), colour)

    def stroke(self, pts, w, colour):
        """An anti-aliased line through photo-px points, w photo px wide."""
        q = np.array([[tx(pX(x)), (self.top - pY(y)) * S] for x, y in pts]) * 8
        m = np.zeros(self.a.shape[:2], np.uint8)
        cv2.polylines(m, [np.round(q).astype(np.int32)], False, 255, max(1, round(w * S / PKY)), cv2.LINE_AA, shift=3)
        blend(self.a, m.astype(np.float32) / 255, 0, 0, colour)


# ── icons: strokes on an 8x canvas, white on black; each returns a mask cropped to its ink ──
def icon(name):
    N = 400
    im = Image.new("L", (N, N), 0)
    d = ImageDraw.Draw(im)
    t = 24                                                     # the photo's strokes are about 0.35 mm on a 5 mm icon

    def arc(cx, cy, r, a0, a1, w=t):
        d.arc([cx - r, cy - r, cx + r, cy + r], a0, a1, fill=255, width=w)

    def ln(pts, w=t):
        d.line(pts, fill=255, width=w, joint="curve")

    def rr(b, r, w=t):
        d.rounded_rectangle(b, radius=r, outline=255, width=w)

    if name == "bottle":          # a detergent bottle: cap, neck, rounded body
        rr([150, 40, 250, 90], 10); ln([(170, 90), (160, 140), (130, 175)]); ln([(230, 90), (240, 140), (270, 175)])
        rr([110, 160, 290, 370], 40)
    elif name == "shirt":         # a T-shirt
        ln([(150, 60), (60, 110), (30, 200), (100, 225), (110, 360), (290, 360), (300, 225), (370, 200), (340, 110), (250, 60), (230, 100), (200, 110), (170, 100), (150, 60)])
    elif name == "cup":           # a jug with its lid and a spout to the right (pre-wash)
        rr([70, 150, 290, 350], 40); ln([(110, 150), (110, 110), (250, 110), (250, 150)]); d.ellipse([160, 50, 200, 95], outline=255, width=t)
        ln([(290, 200), (360, 230), (290, 280)])
    elif name == "iron":          # an iron
        ln([(40, 330), (360, 330), (360, 290), (300, 170), (200, 130), (130, 160), (40, 330)]); ln([(180, 200), (300, 120), (340, 60)])
    elif name == "tub":           # a basin with a hand (soak)
        ln([(40, 220), (60, 350), (340, 350), (360, 220)]); ln([(40, 220), (360, 220)])
        ln([(150, 220), (210, 110), (250, 70)]); ln([(210, 220), (260, 120), (300, 90)]); ln([(260, 260), (300, 290), (340, 270)])
    elif name == "wifi":
        for r in (300, 210, 120):
            arc(200, 330, r * 0.62, 225, 315)
        d.ellipse([180, 300, 220, 340], fill=255)
    elif name == "lock":
        rr([70, 170, 330, 370], 20); arc(200, 170, 90, 180, 360); ln([(110, 170), (110, 150)]); ln([(290, 170), (290, 150)])
        d.ellipse([180, 240, 220, 280], fill=255)
    elif name == "percent":
        d.ellipse([60, 60, 160, 160], outline=255, width=t); d.ellipse([240, 240, 340, 340], outline=255, width=t); ln([(320, 70), (80, 330)])
    elif name == "clock":
        d.ellipse([50, 50, 350, 350], outline=255, width=t); ln([(200, 110), (200, 200), (270, 240)])
    elif name == "drum":          # a round window with a swirl (the drum)
        d.ellipse([40, 40, 360, 360], outline=255, width=t); d.ellipse([110, 110, 290, 290], outline=255, width=t); arc(200, 200, 50, 200, 470)
    elif name == "shirt_dot":     # a shirt with a stain spot
        ln([(150, 60), (60, 110), (30, 200), (100, 225), (110, 360), (290, 360), (300, 225), (370, 200), (340, 110), (250, 60), (230, 100), (200, 110), (170, 100), (150, 60)])
        d.ellipse([230, 250, 330, 350], fill=255)
    elif name == "door":          # a card with a folded corner
        ln([(80, 40), (250, 40), (330, 120), (330, 360), (80, 360), (80, 40)]); ln([(250, 40), (250, 120), (330, 120)])
    elif name == "flower":        # a round mark with six petals
        d.ellipse([40, 40, 360, 360], outline=255, width=t)
        for k in range(6):
            a = math.radians(k * 60)
            arc(200 + 80 * math.cos(a), 200 + 80 * math.sin(a), 55, 0, 360, 18)
    elif name == "lips":          # an eye-shaped outline with a line through it
        ln([(20, 200), (200, 70), (380, 200), (200, 330), (20, 200)]); ln([(70, 200), (330, 200)])
    elif name == "playpause":
        ln([(40, 40), (40, 360), (230, 200), (40, 40)]); ln([(290, 40), (290, 360)], 34); ln([(360, 40), (360, 360)], 34)
    elif name == "power":
        arc(200, 220, 150, 300, 240 + 360); ln([(200, 30), (200, 210)], 30)
    elif name == "fan":           # four blades curling clockwise round the hub, each drawn as an outline
        for k in range(4):
            a0 = math.radians(k * 90 - 60)
            inner = [(200 + r * math.cos(a0 + 0.9 * r / 170), 200 + r * math.sin(a0 + 0.9 * r / 170)) for r in np.linspace(30, 170, 12)]
            outer = [(200 + r * math.cos(a0 + 0.9 * r / 170 + 0.85 * math.sin(math.pi * (r - 30) / 140) ** 0.8),
                      200 + r * math.sin(a0 + 0.9 * r / 170 + 0.85 * math.sin(math.pi * (r - 30) / 140) ** 0.8)) for r in np.linspace(170, 30, 12)]
            ln(inner + outer + [inner[0]], 20)
    elif name == "remote":        # a phone with signal arcs
        rr([60, 130, 230, 380], 24); ln([(130, 340), (160, 340)])
        for r in (70, 130):
            arc(250, 120, r, 270, 360)
    elif name == "onetouch":      # a ring of arrows round a tick, a play mark at the lower right
        arc(190, 190, 150, 20, 330); arc(190, 190, 115, 200, 500, 18); ln([(120, 190), (170, 240), (260, 140)])
        ln([(300, 260), (300, 370), (380, 315), (300, 260)])
    elif name == "dd":            # two arrows chasing round a ring (the direct drive badge)
        arc(200, 200, 150, 30, 170, 40); arc(200, 200, 150, 210, 350, 40)
        ln([(60, 190), (50, 120), (110, 150)], 34); ln([(340, 210), (350, 280), (290, 250)], 34)
    elif name == "steam":         # a shirt with a steam curl
        ln([(150, 60), (60, 110), (30, 200), (100, 225), (110, 360), (290, 360), (300, 225), (370, 200), (340, 110), (250, 60), (230, 100), (200, 110), (170, 100), (150, 60)])
        arc(250, 280, 60, 0, 360, 20)
    elif name == "dosing":        # a bottle tipped over a drop (smart dosing)
        rr([60, 70, 330, 330], 120); ln([(150, 330), (150, 380)]); ln([(250, 330), (250, 380)]); ln([(170, 230), (200, 180), (230, 230)], 18)
    elif name == "haismart":      # Haier's HaiSmart mark: three house outlines stepped to the right, signal arcs in the front one's corner
        P = lambda x, y: ((x - 170) * 1.5, (y - 75) * 1.5)
        for o in (0, 33, 68):
            pts = [P(185 + o, 345), P(185 + o, 150 + o * 0.35), P(255 + o, 88 + o * 0.35)]
            if o == 68:
                pts += [P(420, 205)]
            else:
                pts += [P(275 + o, 100 + o * 0.35)]
            ln(pts, 26)
        for r in (55, 105):
            arc(*P(415, 345), r * 1.5, 180, 270, 26)
        cx, cy = P(415, 345)
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=255)
    return crop_ink(np.asarray(im.resize((N // 4, N // 4), Image.LANCZOS)).astype(np.float32) / 255, 0.15)


def seven(canvas, b, colour, segs="abcdefg"):
    """An outlined seven-segment '8' in the photo box b (panel photo px), the way the display's digits are drawn."""
    x0, y0, x1, y1 = canvas.box(b)
    w, h = x1 - x0, y1 - y0
    k = 8
    im = Image.new("L", (round(w * k), round(h * k)), 0)
    d = ImageDraw.Draw(im)
    W, H = w * k, h * k
    th = W * 0.2                                       # segment thickness
    g = th * 0.18                                      # gap between segments
    lw = max(2, round(W * 0.045))

    def hseg(yc):
        return [(th / 2 + g, yc), (th + g, yc - th / 2), (W - th - g, yc - th / 2), (W - th / 2 - g, yc), (W - th - g, yc + th / 2), (th + g, yc + th / 2)]

    def vseg(xc, ya, yb):
        return [(xc, ya + g), (xc + th / 2, ya + th / 2 + g), (xc + th / 2, yb - th / 2 - g), (xc, yb - g), (xc - th / 2, yb - th / 2 - g), (xc - th / 2, ya + th / 2 + g)]

    P = {"a": hseg(th / 2), "g": hseg(H / 2), "d": hseg(H - th / 2), "f": vseg(th / 2, th / 2, H / 2), "e": vseg(th / 2, H / 2, H - th / 2),
         "b": vseg(W - th / 2, th / 2, H / 2), "c": vseg(W - th / 2, H / 2, H - th / 2)}
    for s in segs:
        d.polygon(P[s], outline=255, width=lw)
    m = np.asarray(im.resize((round(w), round(h)), Image.LANCZOS)).astype(np.float32) / 255
    blend(canvas.a, m, round(x0), round(y0), colour)


WHITE, SOFT, GREY = (238, 238, 238), (206, 206, 208), (150, 151, 154)
TILES = [(628, "Drum|Clean"), (663, "Spin"), (699, "Rinse +|Spin"), (734, "Dry Only"), (769, "Bedding"), (804, "Cotton"),
         (839, "Delicate"), (875, "Jeans"), (910, "Eco"), (945, "Quick"), (980, "Smart|Wash")]


def panel():
    """The black glass panel and its rim, 595 x 79 mm (771-850 mm up), with the drawer's section at the left."""
    ph = np.asarray(Image.open(os.path.join(SRC, "panel.jpg")).convert("RGB")).astype(np.float32)
    h = round((H_MM - PANEL_BOT) * S)
    c = Canvas(4096, h, H_MM)
    a = c.a
    # the rim: a brushed grey frame round the glass, lit along its top, as the photo has it (rows 732-740, 870-873)
    yy = (np.arange(h) + 0.5) / S
    rim = np.interp(yy, [0, 1.0, 2.5, 4.5, 75, 77.5, 79], [120, 175, 150, 118, 112, 185, 120])
    a[:] = rim[:, None, None] * np.array([1.0, 1.01, 1.04])[None, None]
    a += rng.normal(0, 1.2, a.shape[:2])[..., None]
    gx0, gy1, gx1, gy0 = GLASS
    X0, X1, Y0, Y1 = round(tx(gx0)), round(tx(gx1)), round((H_MM - gy0) * S), round((H_MM - gy1) * S)
    glass = np.ones((Y1 - Y0, X1 - X0, 3), np.float32) * np.array([10, 10, 11], np.float32)
    ref = np.linspace(0.07, 0.0, Y1 - Y0) ** 1.6                        # a faint reflection under the rim
    glass += (ref * 120)[:, None, None]
    a[Y0:Y1, X0:X1] = glass
    # the seam between the drawer's glass and the display's: a hair-line gap (photo column 434)
    sx = round(tx(SEAM))
    a[Y0:Y1, sx - 1:sx + 2] = [[[38, 39, 42]]]
    a[Y0:Y1, sx + 2:sx + 3] = [[[90, 92, 96]]]

    # ── the drawer's section: Haier's wordmark, the three badges, HaiSmart ──
    lg = Image.open(os.path.join(LOGOS, "haier.png")).getchannel("A")
    c.place(crop_ink(np.asarray(lg).astype(np.float32) / 255), (132, 763, 205, 784), WHITE, "fit")
    for ic, box in (("dd", (130.8, 835.8, 141.7, 846.7)), ("steam", (180.8, 835.8, 193.3, 846.7)), ("dosing", (230, 835.8, 240.8, 846.7))):
        c.place(icon(ic), box, SOFT)
    c.cap("SUPER DD", 145, 173.1, 837.25, 841, SOFT, BOLD)
    c.cap("INVERTER", 145, 173.1, 841.9, 844.75, GREY, ARIAL)
    c.cap("STEAM", 198.75, 219, 839, 843.1, SOFT, BOLD)
    c.cap("SMART", 243.75, 265.6, 837.25, 841, SOFT, BOLD)
    c.cap("DOSING", 244.4, 265.6, 841.9, 844.75, GREY, ARIAL)
    for x0, x1 in ((143.75, 173.75), (195, 222.5), (241.9, 267.5)):          # the rules above and under each badge's words
        for y in (835.8, 845.5):
            bx0, by0, bx1, by1 = c.box((x0, y - 0.25, x1, y + 0.25))
            blend(a, np.ones((max(2, round(by1 - by0)), round(bx1 - bx0)), np.float32) * 0.8, round(bx0), round(by0), GREY)
    c.place(icon("haismart"), (350.8, 830, 366.7, 847.5), WHITE)
    c.cap("HaiSmart", 347.5, 369.2, 849.2, 852.0, SOFT, ARIAL)

    # ── the display: icons, the time, the option labels ──
    for ic, box in (("bottle", (472, 780, 477.5, 788.5)), ("shirt", (469.5, 792, 479.5, 800.5)),
                    ("cup", (482.5, 769.5, 492.5, 778.5)), ("iron", (482.5, 780.5, 491.5, 788.5)), ("tub", (481.5, 792.5, 491.5, 800.5)),
                    ("wifi", (587, 769.5, 596.5, 777.5)), ("lock", (588, 780.5, 596, 788.5)), ("percent", (587.5, 792, 596, 800.5)),
                    ("clock", (600, 769.5, 608.5, 777.5)), ("drum", (600, 780.5, 608.5, 788.5)), ("shirt_dot", (599.5, 792, 608.5, 800.5)),
                    ("door", (614, 769.5, 620.5, 777.5)), ("flower", (613, 780.5, 621.5, 788.5)), ("lips", (612, 792.5, 622.5, 800))):
        c.place(icon(ic), box, WHITE)
    c.word("AI", (470.5, 769.8, 479.5, 776.5), WHITE, NARROW, "h")
    for x0 in (495, 517, 546, 567):
        seven(c, (x0, 768, x0 + 18, 801), WHITE)
    for y in (778, 787):
        bx0, by0, bx1, by1 = c.box((538.5, y, 542, y + 4))
        blend(a, np.ones((round(by1 - by0), round(bx1 - bx0)), np.float32), round(bx0), round(by0), WHITE)
    # the option labels: ink and underline spans measured on an 8x enlargement of the photo
    for text, (x0, x1), (u0, u1), (top, base, ul) in (
            ("Stain", (475.6, 493.1), (468.75, 499.4), (807.8, 813.1, 815.3)), ("Dry", (518.75, 530.25), (508.75, 539.6), (807.8, 813.1, 815.3)),
            ("Detergent", (548.5, 579.75), (549, 579.75), (807.8, 813.1, 815.3)), ("Softener", (589.6, 618.5), (588.75, 619.1), (807.8, 813.1, 815.3)),
            ("Temp.", (473.1, 494.4), (468.75, 499.4), (824.6, 830, 832.3)), ("Speed", (515, 533.1), (508.75, 539.6), (824.6, 830, 832.3)),
            ("Extra Rinse", (547.75, 581), (549, 579.75), (824.6, 830, 832.3)), ("Delay", (595.6, 614.6), (589.1, 620), (824.6, 830, 832.3))):
        c.cap(text, x0, x1, top, base, WHITE)
        c.stroke([(u0, ul + 0.5), (u1, ul + 0.5)], 1.0, SOFT)
    for text, (x0, x1), (l0, l1), (r0, r1) in (("Child Lock", (488.75, 522.25), (482.5, 487.5), (523.5, 527.5)),
                                              ("Steam", (575.6, 596.6), (565, 573), (598.75, 606.9))):
        c.cap(text, x0, x1, 838.5, 844, WHITE)
        c.stroke([(l0, 839.1), (l0 + 1.2, 840.6), (l0 + 2.4, 841.3), (l1, 841.3)], 0.8, WHITE)       # the bracket either side, its ends turned up
        c.stroke([(r0, 841.3), (r1 - 2.4, 841.3), (r1 - 1.2, 840.6), (r1, 839.1)], 0.8, WHITE)

    # ── the programme tiles: the photo's pictures enlarged, rounded, the names set again ──
    for x0, name in TILES:
        bx0, by0, bx1, by1 = c.box((x0, 770, x0 + 32, 840))
        tw_, th_ = round(bx1 - bx0), round(by1 - by0)
        tile = cv2.resize(ph[770:840, x0:x0 + 32], (tw_, th_), interpolation=cv2.INTER_CUBIC)
        lum = tile.mean(2)
        band = round(th_ * 0.36)
        txt = np.zeros(lum.shape, np.uint8)
        med = cv2.medianBlur(lum.astype(np.uint8), 31).astype(np.float32)
        txt[:band] = ((lum[:band] - med[:band]) > 18).astype(np.uint8) * 255
        txt = cv2.dilate(txt, np.ones((7, 7), np.uint8))
        tile = cv2.inpaint(tile.clip(0, 255).astype(np.uint8), txt, 9, cv2.INPAINT_TELEA).astype(np.float32)
        blur = cv2.GaussianBlur(tile, (0, 0), 3)
        tile = np.clip(tile + (tile - blur) * 0.6, 0, 255)
        r = round(1.6 * S)
        mask = np.zeros((th_, tw_), np.uint8)
        cv2.rectangle(mask, (r, 0), (tw_ - r, th_), 255, -1); cv2.rectangle(mask, (0, r), (tw_, th_ - r), 255, -1)
        for cx_, cy_ in ((r, r), (tw_ - r - 1, r), (r, th_ - r - 1), (tw_ - r - 1, th_ - r - 1)):
            cv2.circle(mask, (cx_, cy_), r, 255, -1, cv2.LINE_AA)
        m = mask.astype(np.float32)[..., None] / 255
        X, Y = round(bx0), round(by0)
        a[Y:Y + th_, X:X + tw_] = a[Y:Y + th_, X:X + tw_] * (1 - m) + tile * m
        f = ImageFont.truetype(ARIAL, 240)
        hb = f.getbbox("H")
        for i, t in enumerate(name.split("|")):
            w = (f.getbbox(t)[2] - f.getbbox(t)[0]) / (hb[3] - hb[1]) * 5.5          # Arial's own width at the photo's 5.5 px capitals
            top = 775.5 + i * 6.5
            c.cap(t, x0 + 16 - w / 2, x0 + 16 + w / 2, top, top + 5.5, WHITE)

    # ── the keys at the right ──
    for ic, box in (("playpause", (1022, 772, 1035, 784)), ("power", (1055, 771, 1067, 785)), ("fan", (1021.5, 797.5, 1036.5, 810.5)),
                    ("remote", (1025, 818.8, 1037.5, 833.3)), ("onetouch", (1055, 818.8, 1069.4, 832.5))):
        c.place(icon(ic), box, WHITE)
    c.cap("Remote", 1019.4, 1041.25, 835, 838.8, WHITE)
    c.cap("AI Onetouch", 1046.9, 1080, 835, 838.8, WHITE)
    c.cap("Hold 3s", 1055, 1071.9, 841.5, 844.6, GREY)
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "panel.jpg", 92)


def strip():
    """The strip under the panel, 595 x 34 mm (737-771 mm up): the drawer's ribbed grip at the left, the ULTRA FRESH AIR
    plate between two ribbed chevrons, the ribbed recess at the right; the photo's own light and shade, enlarged 3.8x,
    with the plate's words set again."""
    ph = Image.open(os.path.join(SRC, "panel.jpg")).convert("RGB")
    y0, y1 = PY0 + (H_MM - PANEL_BOT) * PKY, PY0 + (H_MM - STRIP_BOT) * PKY
    h = round((PANEL_BOT - STRIP_BOT) * S)
    im = ph.crop((PX0 - W_MM / 2 * PKX, y0, PX0 + W_MM / 2 * PKX, y1)).resize((4096, h), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    a = cv2.GaussianBlur(a, (0, 0), 1.0)
    c = Canvas(4096, h, PANEL_BOT)
    c.a = a
    # the plate: its face evened out, then the words
    px0, py0, px1, py1 = c.box((491, 885, 724.5, 917.5))
    face = a[round(py0):round(py1), round(px0):round(px1)]
    face[:] = np.median(face.reshape(-1, 3), 0) * np.linspace(1.05, 0.95, face.shape[0])[:, None, None]
    c.word("ULTRA FRESH AIR", (563, 897, 653, 904.5), (226, 226, 228), BOLD, "fit")
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "strip.jpg", 90)


def front():
    """The front below the strip, 595 x 726 mm (11-737 mm up), 2 px per mm: the photo's own paint with the studio light evened
    out (a smooth fit of log luminance divided out, as for the sides: the photo's big softbox reflection on the upper half is
    the room's light, not the paint) and tinted to the cabinet's colour, the door and its seat filled in from round about (the
    builder cuts the seat and models the door), and the pump-filter flap's outline kept."""
    ph = np.asarray(Image.open(os.path.join(SRC, "front.jpg")).convert("RGB")).astype(np.float32)
    k = 2.0
    w, h = round(W_MM * k), round((STRIP_BOT - FEET) * k)
    xs = FX0 + (np.arange(w) / k - W_MM / 2) * FKX
    ys = FYB - (STRIP_BOT - np.arange(h) / k) * FKY
    mx, my = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
    a = cv2.remap(ph, mx, my, cv2.INTER_AREA if False else cv2.INTER_LINEAR)
    # the cabinet's own edge highlights at the far left and right columns are the sides' business
    a[:, :4] = a[:, 4:5]; a[:, -4:] = a[:, -5:-4]
    yy, xx = np.mgrid[0:h, 0:w]
    Xmm, Ymm = xx / k - W_MM / 2, STRIP_BOT - yy / k
    r = np.hypot(Xmm - DOOR["x"], Ymm - DOOR["y"])
    lum = a.mean(2)
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y, y ** 3, x * y * y], -1).reshape(-1, 8)
    use = ((r > DISH_R + 12) & (np.hypot(Xmm - FLAP["x"], Ymm - FLAP["y"]) > FLAP["r"] + 6) & (yy > 8)).reshape(-1)
    use &= (xx.reshape(-1) > 12) & (xx.reshape(-1) < w - 12)
    cf, *_ = np.linalg.lstsq(A[use], np.log(np.maximum(lum, 1)).reshape(-1)[use], rcond=None)
    n = lum / np.exp(A @ cf).reshape(h, w)
    n = 1 + (n / np.median(n.reshape(-1)[use]) - 1) * 0.7
    a = np.clip(n, 0.3, 2.0)[..., None] * BODY
    # the door and its seat are filled in from the paint just outside the seat, at the same angle (smoothed round the circle),
    # fading to the paint's median toward the centre; the strip's lit lower edge (the top 3 mm) takes the row below it
    R0 = DISH_R + 9
    ang = np.arctan2(Ymm - DOOR["y"], Xmm - DOOR["x"])
    ts = np.linspace(-np.pi, np.pi, 721)
    sx = (DOOR["x"] + R0 * np.cos(ts) + W_MM / 2) * k
    sy = (STRIP_BOT - (DOOR["y"] + R0 * np.sin(ts))) * k
    ok = (sx >= 0) & (sx < w) & (sy >= 8) & (sy < h)
    ring = np.zeros((len(ts), 3), np.float32)
    ring[ok] = a[sy[ok].astype(int), sx[ok].astype(int)]
    med = np.median(a.reshape(-1, 3), 0)
    iok = np.where(ok)[0]                                              # where the circle leaves the texture (at the top), the
    for c in range(3):                                                 # angles either side carry over
        ring[~ok, c] = np.interp(np.where(~ok)[0], np.r_[iok - 721, iok, iok + 721], np.tile(ring[iok, c], 3))
    ker = np.exp(-np.linspace(-3, 3, 61) ** 2)
    ker /= ker.sum()
    ring = np.stack([np.convolve(np.r_[ring[-30:, c], ring[:, c], ring[:30, c]], ker, "same")[30:-30] for c in range(3)], 1)
    idx = np.clip(np.round((ang + np.pi) / (2 * np.pi) * 720).astype(int), 0, 720)
    t = np.clip(r / R0, 0, 1)[..., None] ** 2
    fill = ring[idx] * t + med * (1 - t) + rng.normal(0, 1.0, (h, w))[..., None]
    hole = cv2.GaussianBlur((r < DISH_R + 6).astype(np.float32), (0, 0), 1.5)[..., None]
    a = cv2.GaussianBlur(a, (0, 0), 0.8) * (1 - hole) + fill * hole
    a[:6] = a[6:7]
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "front.jpg", 88)


def side(name, photo, quad, front_left):
    """A side wall from Haier's 3/4 photo, made square-on with a perspective warp of the wall's four corners (photo px:
    front top, back top, back bottom, front bottom), 1.5 px per mm, from the top (850 mm) to the cabinet's bottom (11 mm).
    The studio light is evened out (a quadratic fit of log luminance divided out) and the pressed relief's own light and
    shade kept at 70%, tinted to the cabinet's colour."""
    ph = np.asarray(Image.open(os.path.join(SRC, photo)).convert("RGB")).astype(np.float32)
    k = 1.5
    w, h = round(D_MM * k), round((H_MM - FEET) * k)
    ft, bt, bb, fb = quad
    dst = [(0, 0), (w, 0), (w, h), (0, h)] if front_left else [(w, 0), (0, 0), (0, h), (w, h)]
    M = cv2.getPerspectiveTransform(np.float32([ft, bt, bb, fb]), np.float32(dst))
    a = cv2.warpPerspective(ph, M, (w, h), flags=cv2.INTER_AREA)
    lum = a.mean(2)
    yy, xx = np.mgrid[0:h, 0:w]
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    cf, *_ = np.linalg.lstsq(A, np.log(np.maximum(lum, 1)).reshape(-1), rcond=None)
    n = lum / np.exp(A @ cf).reshape(h, w)
    n = 1 + (n / np.median(n) - 1) * 0.7
    n = cv2.GaussianBlur(n, (0, 0), 0.7)
    out = np.clip(np.clip(n, 0.3, 2.0)[..., None] * BODY, 0, 255)
    save(Image.fromarray(out.astype(np.uint8)), name, 88)


def drum():
    """The drum wall, front (top of the image) to back, one 96 mm strip of its circumference (tiled round it): as Haier's
    open-door photos show it, a band of raised square pillows behind the front lip ("Pillow shape drum"), a double rib, then
    staggered rows of round holes, then plain polished steel to the back. 4 px per mm, 96 x 330 mm. The bands' widths, the
    pillow pitch (9 mm) and the holes (4.5 mm, 9.5 mm apart) are ESTIMATED from the photos (open34.jpg, open_front.jpg)."""
    k = 4.0
    w, h = round(96 * k), round(330 * k)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ymm, xmm = yy / k, xx / k
    base = 150 + 22 * np.cos(xmm / 96 * 2 * np.pi) + cv2.GaussianBlur(rng.normal(0, 14, (h, w)).astype(np.float32), (0, 0), sigmaX=0.6, sigmaY=30)
    a = base.copy()
    # pillows, 18-110 mm from the front: 7 mm squares on a 9 mm grid, lit from the top left
    P = 9.0
    u, v = (xmm % P) / P - 0.5, ((ymm - 18) % P) / P - 0.5
    sq = (np.maximum(abs(u), abs(v)) < 0.39)
    edge = np.clip((0.39 - np.maximum(abs(u), abs(v))) * 30, 0, 1)
    lit = np.where(abs(u) > abs(v), np.sign(-u), np.sign(-v))
    zone = (ymm > 18) & (ymm < 110)
    a = np.where(zone, np.where(sq, a * (1.05 + 0.18 * lit * (1 - edge)), a * 0.62), a)
    # the double rib, 112-126 mm
    for c in (115.0, 122.5):
        d = abs(ymm - c)
        a = np.where(d < 2.6, a * (1.25 - 0.55 * (ymm - c) / 2.6 * np.sign(ymm - c) * 0 - 0.35 * (d / 2.6) ** 2), a)
    img = np.repeat(a[..., None], 3, 2) * np.array([1.0, 1.01, 1.03])
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    rr, pitch = 2.25 * k, 9.5 * k
    for i, y in enumerate(np.arange(135 * k, 250 * k, pitch * 0.866)):          # holes, 135-250 mm, staggered rows
        off = (pitch / 2) if i % 2 else 0
        for x in np.arange(off - pitch, w + pitch, pitch):
            d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(20, 21, 23))
            d.arc([x - rr - 1, y - rr - 1, x + rr + 1, y + rr + 1], 200, 340, fill=(205, 207, 210), width=2)
    save(im, "drum.jpg", 86)


panel()
strip()
front()
side("side_l.jpg", "l34.jpg", [(404, 117), (196, 180), (197, 1052), (404, 1113)], front_left=False)
side("side_r.jpg", "r34.jpg", [(825, 108), (1021, 162), (1021, 1050), (825, 1125)], front_left=True)
drum()

m = lambda v: round(v / 1000, 5)
layout = {
    "feet": m(FEET), "panel_bot": m(PANEL_BOT), "strip_bot": m(STRIP_BOT),
    "glass": [m(v) for v in GLASS], "seam": m(SEAM), "drawer": [m(v) for v in DRAWER], "lip": [m(v) for v in LIP],
    "plate": [m(v) for v in PLATE], "door": {"x": m(DOOR["x"]), "y": m(DOOR["y"]), "rim": m(RIM_R), "dish": m(DISH_R)},
    "flap": {"x": m(FLAP["x"]), "y": m(FLAP["y"]), "r": m(FLAP["r"])}, "feet_x": [m(v) for v in FEET_X],
}
with open(os.path.join(D, "layout.json"), "w") as f:
    json.dump(layout, f, indent=1)
print(json.dumps(layout))
