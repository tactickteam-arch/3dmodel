"""Textures for the Samsung WW90FG4U04ASTL, 9 kg front-load washing machine (WW4000F, Hygiene Steam, Digital Inverter), in Navy,
and its Black twin WW90FG4U04ABTL (same body, Samsung India's page for each colour).

usage: python3 tex_samsung_ww90fg.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>] [--photos <dir>] [--hi <px/mm>]
  --photos <dir> also writes the page's four photos there (SITE/photos/samsung-ww90fg4u04astl/0-3.jpg, 900 x 900 on white)
  photos:  samsung_ww90fg/navy/   Samsung India's gallery for WW90FG4U04ASTL (1920 x 1280, each scaled to the unit's height)
             g548036451.png  3/4 left        g548036452.png  the back, square on      g548036445.png  the left side
             g548036446.png  straight on, door open (the control band is read off this one: 1.4867 px/mm across, 1.4547 up)
             g548036447.png  the drum        g548036448.png  the control panel, close  g548036449.png  the drawer out
             g548036462.png  straight on, shut
             label_553085452.jpg  Samsung's energy label for WW90FG4U04ASTL; labelprod_553085468.jpg the unit with it
           samsung_ww90fg/black/  the same set for WW90FG4U04ABTL (Black): g548036426-433, 443, label_553085327.jpg
           (the Black photos register on the Navy ones to 0.5 px: the same framing, so every trace serves both)
  manual:  the control-panel drawing of Samsung's user manual DC68-04382A-13 (WW8*T / WW9*T / WW90FG), rendered at 2400 dpi:
             pdftoppm -r 2400 -f 1 -l 1 -x 43334 -y 31925 -W 6200 -H 2050 -gray  (kept in .work/, not in git)
           cut so its panel lands on the same pixels as the WW70FG manual's (tex_samsung_ww70fg.py): every drawing box below
           is the same as there
  logos:   samsung.png
  writes <out dir>/samsung_ww90fg/: panel.jpg / panel_ab.jpg (the control band, Navy / Black), front*.jpg, side_*.jpg,
         rear*.jpg, drum.jpg, tray.jpg, hose.jpg, layout.json, rear_paths.json; with --hi, print_*.jpg and decals.json
         (bee_label*.png come from tex_bee_redraw.py)

Every position is in mm: x from the centre line (+ to the right, seen from the front), h above the floor.

The control band (panel*.jpg) covers the whole width and h 721 to 850 mm. Nothing on it is copied from the photo: the colours
are flat (the drawer face a touch lighter at the top, as the photos show it), every word is the manual's vector ink scaled into
the box the word has in the straight-on photo, the leader lines are drawn from the word to the dial as the photo has them, and the
display (its symbols, level bars, the seven-segment time, the keys and their symbols, the "*(3 sec)" note) is the manual's
drawing mapped by one affine fit of its frame onto the photo's, coloured as Samsung's photo shows it lit (1:27, the wash, rinse
and spin stages, 40 and 1400). Where the photo and the drawing differ, the photo wins: the spin column reads 1400 / 1200 / 800
(the drawing, for all its models, 1400 / 800 / 400: "1200" is set from the drawing's own 1, 2 and 0 glyphs and "800" moved down a
row), "QUICK WASH 15'" has its prime, the hold-3-seconds symbols under the keys sit between corner brackets. SAMSUNG is the logo
file.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None
args = list(sys.argv[1:])
DEBUG = None
if "--debug" in args:
    DEBUG = args[args.index("--debug") + 1]
    del args[args.index("--debug"):args.index("--debug") + 2]
    os.makedirs(DEBUG, exist_ok=True)
PAGE = None
if "--photos" in args:
    PAGE = args[args.index("--photos") + 1]
    del args[args.index("--photos"):args.index("--photos") + 2]
# --hi <px per mm>: draw only the control band, in both colours, at that density and on a ground without noise, and cut its
# print into the decals the builder lays over the band, the drawer face, the display glass, the five keys and the two buttons
# (print_*.jpg / print_*_ab.jpg and decals.json: each piece's rectangle in the band's UVs and the surface it lies on);
# panel*.jpg and the rest are left alone
HI = None
if "--hi" in args:
    HI = float(args[args.index("--hi") + 1])
    del args[args.index("--hi"):args.index("--hi") + 2]
PHOTOS, MANUAL, LOGOS, OUT = args[:4]
P = os.path.join(PHOTOS, "samsung_ww90fg")
D = os.path.join(OUT, "samsung_ww90fg")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(90)

# ── the two colours (sRGB). Samsung shows this body in the same light in both colours, so each is read off its photo at the same
# places and turned into texture colours by the same factors: the Black twin is taken as Samsung's "Black" of the WW70FG
# (50, 51, 55: tex_samsung_ww70fg.py), which fixes the factor; the Navy is its photo times that factor. The front reads (21, 29, 42)
# Navy and (26, 26, 28) Black where the light is even (right of the door, h 560-710 mm); the band right of the drawer is a gloss
# dark navy (8, 16, 29) on the Navy and the body's black on the Black; the drawer face takes the body colour (its top catches the
# studio light in both photos). ESTIMATED, as every colour read off a photo. ──
COLOURS = {
    "": {"body": np.array([40, 57, 82], np.float32), "drawer": np.array([42, 59, 85], np.float32),
         "panel": np.array([14, 30, 55], np.float32), "btn": (48, 66, 92), "recess": (16, 24, 36), "photo": "navy"},
    "_ab": {"body": np.array([50, 51, 55], np.float32), "drawer": np.array([52, 53, 57], np.float32),
            "panel": np.array([46, 47, 51], np.float32), "btn": (60, 61, 64), "recess": (22, 23, 25), "photo": "black"},
}
INK = (226, 227, 230)                           # the band's print
LIGHT = (196, 198, 202)                         # the small print round the display
CYAN = (70, 196, 240)                           # lit segments, bars and the dial's lamp (the photo's)
GHOST = (34, 37, 40)                            # unlit segments, faint through the glass
GREYBAR = (92, 94, 98)                          # unlit level bars
GLASS = (10, 11, 12)
KEYINK = (44, 46, 50)
SHADE = {"panel": 0.86, "front": 0.86, "side_l": 0.9, "side_r": 0.9, "rear": 0.92}


def save(img, name, q=88):
    base = name.split(".")[0].replace("_ab", "")
    if base in SHADE:          # lit by the viewer's environment light, a texture renders about a quarter brighter than its pixels
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * SHADE[base]).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


BLACK = {"g548036451.png": "g548036429.png", "g548036452.png": "g548036430.png", "g548036445.png": "g548036431.png",
         "g548036446.png": "g548036432.png", "g548036448.png": "g548036427.png"}     # the same views of the Black twin


def photo(name, bg=(0, 0, 0), sub="navy"):
    im = Image.open(os.path.join(P, sub, BLACK[name] if sub == "black" else name)).convert("RGBA")
    base = Image.new("RGBA", im.size, bg + (255,))
    base.alpha_composite(im)
    return np.asarray(base.convert("RGB")).astype(np.float32)


def blend(canvas, m, X, Y, colour):
    h, w = m.shape
    xa, ya, xb, yb = max(0, X), max(0, Y), min(canvas.shape[1], X + w), min(canvas.shape[0], Y + h)
    if xb <= xa or yb <= ya:
        return
    a = np.clip(m[ya - Y:yb - Y, xa - X:xb - X], 0, 1)[..., None]
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + np.array(colour, np.float32) * a


# ── the straight-on open-door photo (g548036446): the band spans 892 px across (600 mm) at row 100, the cabinet's foot is row
# 1257.5 and the groove under the band row 210 (h 720 mm) ──
FX0, FPX, FY0, FPY = 1171.5, 1.4867, 1257.5, 1.4547
PXmm = lambda px: (px - FX0) / FPX
PHmm = lambda py: (FY0 - py) / FPY

# ── the band's texture space ──
PX = HI or 4096 / 600.0                         # px per mm
H0, H1 = 721.0, 850.0
TW, TH = round(600 * PX), round((H1 - H0) * PX)
KS = PX / (4096 / 600.0)                        # the slot's inset and blur below are in panel.jpg px: scaled for --hi


def cx_(x):
    return (x + 300.0) * PX


def ry_(h):
    return (H1 - h) * PX


def pbox(x0, y0, x1, y1):
    """photo px box -> mm box (x0, h0, x1, h1)"""
    return PXmm(x0), PHmm(y1), PXmm(x1), PHmm(y0)


def tbox(b):                                    # mm (x0, h0, x1, h1) -> texture px (x0, y0, x1, y1)
    x0, h0, x1, h1 = b
    return cx_(x0), ry_(h1), cx_(x1), ry_(h0)


# what the photo shows (photo px of g548036446, then mm). The band is the WW70FG's: its boxes were found by fitting the WW70FG
# photo's band onto this one (one affine, correlation 0.93) and checked on the photo; the words' ink boxes are measured here.
SEAM = PXmm(1046)                               # the drawer's right edge: the groove between the drawer and the controls
POCKET = pbox(758.4, 124.6, 1032.9, 178.1)      # the drawer's grip slot
LOGO = pbox(782.2, 56.5, 830.5, 64.1)           # SAMSUNG on the drawer
DIAL_PX = (1168.7, 102.0, 44.4)                 # the dial's face: centre and radius (photo px, across)
DIAL = (PXmm(DIAL_PX[0]), PHmm(DIAL_PX[1]), DIAL_PX[2] / FPX)
GLASS_PX = (1306, 54, 1496.2, 159.3)            # the display window (keys included)
POWER_PX = (1523.5, 53.8, 1556.1, 84.5)         # the two buttons' faces
START_PX = (1523.6, 105.0, 1556.2, 159.2)
# programme names: the drawing's box (2400 dpi px), the box the word's ink has in the photo (photo px)
WORDS = [((282, 440, 730, 520), (1064, 53, 1104, 59)),      # MIXED LOAD
         ((282, 610, 828, 705), (1063, 68, 1112, 74)),      # QUICK WASH 15 (the photo's prime is drawn after it)
         ((276, 790, 606, 875), (1063, 84, 1093, 89)),      # BEDDING
         ((276, 955, 571, 1055), (1063, 99, 1089, 104)),    # COLORS
         ((276, 1125, 918, 1225), (1063, 114, 1120, 119)),  # WOOL/DELICATES
         ((276, 1295, 578, 1390), (1064, 129, 1089, 134)),  # TOWELS
         ((2314, 440, 2600, 515), (1253, 54, 1278, 58)),    # COTTON
         ((2200, 600, 2600, 690), (1243, 67, 1278, 74)),    # eCOTTON (with its symbol)
         ((2162, 790, 2600, 865), (1239, 84, 1278, 89)),    # SYNTHETICS
         ((2053, 955, 2597, 1055), (1229, 99, 1278, 104)),  # HYGIENE STEAM
         ((2159, 1125, 2600, 1225), (1239, 114, 1276, 119)),  # RINSE+SPIN
         ((2129, 1310, 2600, 1385), (1236, 129, 1278, 134))]  # DRUM CLEAN

# the drawing's display frame and the photo's: one affine for everything inside it
DF = (2882, 435, 4936, 1655)


def d2p(X, Y):
    x0, y0, x1, y1 = DF
    gx0, gy0, gx1, gy1 = GLASS_PX
    return gx0 + (X - x0) * (gx1 - gx0) / (x1 - x0), gy0 + (Y - y0) * (gy1 - gy0) / (y1 - y0)


def d2tex_affine():
    """2x3 affine: drawing px -> band texture px (through the photo's px and mm)"""
    x0, y0, x1, y1 = DF
    gx0, gy0, gx1, gy1 = GLASS_PX
    sx = (gx1 - gx0) / (x1 - x0) / FPX * PX
    sy = (gy1 - gy0) / (y1 - y0) / FPY * PX
    tx = cx_(PXmm(gx0)) - x0 * sx
    ty = ry_(PHmm(gy0)) - y0 * sy
    return np.float32([[sx, 0, tx], [0, sy, ty]])


def drawing():
    a = 1 - np.asarray(Image.open(MANUAL).convert("L")).astype(np.float32) / 255.0
    # the spin column as this model's photo has it: 1400 / 1200 / 800. Row 2 (y 1095) is set from the drawing's own glyphs: its
    # "1" and "0" from 1400 (row 1, y 982-983), its "2" from the temperature column's "20" (y 1322); row 2's "800" moves to row 3
    # (y 1207), where the drawing had "400"
    g = lambda x, y, w, h: a[y:y + h, x:x + w].copy()
    one, two, zero, eight = g(3454, 983, 20, 50), g(3050, 1322, 30, 51), g(3528, 982, 34, 52), g(3456, 1095, 120, 52)
    a[1085:1265, 3440:3620] = 0
    a[1208:1260, 3456:3576] = eight
    a[1096:1146, 3454:3474] = one
    a[1095:1146, 3487:3517] = two
    a[1095:1147, 3528:3562] = zero
    a[1095:1147, 3572:3606] = zero
    return a


def comps(ink, box, keep):
    """the drawing's ink inside box whose connected components keep(x, y, w, h, area) accepts (absolute drawing px)"""
    x0, y0, x1, y1 = box
    sub = ink[y0:y1, x0:x1]
    n, lab, st, _ = cv2.connectedComponentsWithStats((sub > 0.5).astype(np.uint8))
    ok = np.zeros(n, bool)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        ok[i] = keep(x + x0, y + y0, w, h, a)
    grown = cv2.dilate(ok[lab].astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    m = np.zeros_like(ink)
    m[y0:y1, x0:x1] = sub * grown
    return m


def to_tex(m):
    return cv2.warpAffine(cv2.GaussianBlur(m, (0, 0), 0.9), d2tex_affine(), (TW, TH), flags=cv2.INTER_LINEAR)


def panel(ink, C):
    th = TH
    img = np.zeros((th, TW, 3), np.float32)
    xs = np.arange(TW)
    left = xs < cx_(SEAM)
    g = np.linspace(1.06, 0.96, th)[:, None]
    img[:, left] = (C["drawer"][None, None, :] * g[..., None])[:, :1, :].repeat(left.sum(), 1)
    img[:, ~left] = (C["panel"][None, None, :] * np.linspace(1.03, 0.98, th)[:, None, None])[:, :1, :].repeat((~left).sum(), 1)
    img += rng.normal(0, 0 if HI else 0.6, (th, TW, 1))
    # the grip slot: a little darker inside (the 3D scoop adds its own shade)
    x0, y0, x1, y1 = tbox(POCKET)
    pm = np.zeros((th, TW), np.float32)
    cv2.rectangle(pm, (int(x0 + 40 * KS), int(y0 + 15 * KS)), (int(x1 - 40 * KS), int(y1 - 10 * KS)), 1.0, -1)
    img *= (1 - 0.12 * cv2.GaussianBlur(pm, (0, 0), 25 * KS))[..., None]
    canvas = img

    def shape(c, fn, colour):
        m = Image.new("L", (TW * 2, th * 2), 0)
        fn(ImageDraw.Draw(m), 2.0)
        mm = cv2.resize(np.asarray(m).astype(np.float32) / 255, (TW, th), interpolation=cv2.INTER_AREA)
        blend(c, mm, 0, 0, colour)
        return mm

    def line(c, pts, w, colour):
        m = Image.new("L", (TW * 2, th * 2), 0)
        ImageDraw.Draw(m).line([(cx_(x) * 2, ry_(h) * 2) for x, h in pts], fill=255, width=max(1, round(w * PX * 2)), joint="curve")
        blend(c, cv2.resize(np.asarray(m).astype(np.float32) / 255, (TW, th), interpolation=cv2.INTER_AREA), 0, 0, colour)

    # the groove between the drawer and the controls
    shape(canvas, lambda d, s: d.rectangle([(cx_(SEAM) - 0.5 * PX) * s, 0, (cx_(SEAM) + 0.5 * PX) * s, th * s], fill=255), (12, 13, 15))

    # SAMSUNG, from the logo file, in the photo's box
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    al = np.asarray(lg.getchannel("A")).astype(np.float32) / 255
    ys, xs_ = np.where(al > 0.1)
    al = al[ys.min():ys.max() + 1, xs_.min():xs_.max() + 1]
    x0, y0, x1, y1 = tbox(LOGO)
    blend(canvas, cv2.resize(al, (round(x1 - x0), round(y1 - y0)), interpolation=cv2.INTER_AREA), round(x0), round(y0), INK)

    # programme names: the drawing's ink, fitted to the photo box's width, centred on its row
    for (dx0, dy0, dx1, dy1), (px0, py0, px1, py1) in WORDS:
        w = ink[dy0:dy1, dx0:dx1]
        ys, xs_ = np.where(w > 0.35)
        w = w[ys.min():ys.max() + 1, xs_.min():xs_.max() + 1]
        bx0, bh0, bx1, bh1 = pbox(px0 - 0.5, py0, px1 + 0.5, py1)
        x0, y0, x1, y1 = tbox((bx0, bh0, bx1, bh1))
        k = (x1 - x0) / w.shape[1]
        nw, nh = max(1, round(w.shape[1] * k)), max(1, round(w.shape[0] * k))
        m = cv2.resize(cv2.GaussianBlur(w, (0, 0), 0.25 / k), (nw, nh), interpolation=cv2.INTER_AREA)
        blend(canvas, m, round(x0), round((y0 + y1) / 2 - nh / 2), INK)
    # the prime after QUICK WASH 15 (the photo's)
    qx, qh = PXmm(1113.6), PHmm(68.9)
    line(canvas, [(qx, qh), (qx - 0.35, qh - 1.3)], 0.45, INK)

    # leader lines: from each word to the dial's face (a gap of 2 mm); the top pair bends to the dial's top, as in the photo
    dx, dh, dr = DIAL
    rr = dr + 2.2
    for (_, (px0, py0, px1, py1)), i in zip(WORDS, range(12)):
        h = PHmm((py0 + py1) / 2)
        if i < 6:
            xa = PXmm(px1) + (2.8 if i == 1 else 1.6)
            dy = h - dh
            if abs(dy) < rr - 4:
                line(canvas, [(xa, h), (dx - np.sqrt(rr ** 2 - dy ** 2), h)], 0.5, INK)
            else:                                   # MIXED LOAD: across, then down to the dial's top left
                a = np.radians(112)
                line(canvas, [(xa, h), (dx - 9.5, h), (dx + rr * np.cos(a), dh + rr * np.sin(a))], 0.5, INK)
        else:
            xb = PXmm(px0) - 1.6
            if i == 7:                              # eCOTTON: from the end of the symbol
                xb = PXmm(px0) - 1.6
            dy = h - dh
            if abs(dy) < rr - 4:
                line(canvas, [(dx + np.sqrt(rr ** 2 - dy ** 2), h), (xb, h)], 0.5, INK)
            else:                                   # COTTON: from the dial's top right, up, then across
                a = np.radians(68)
                line(canvas, [(dx + rr * np.cos(a), dh + rr * np.sin(a)), (dx + 9.5, h), (xb, h)], 0.5, INK)

    # ── the display ──
    gx0, gy0, gx1, gy1 = tbox(pbox(*GLASS_PX))
    shape(canvas, lambda d, s: d.rounded_rectangle([gx0 * s, gy0 * s, gx1 * s, gy1 * s], radius=2.4 * PX * s, fill=255), (70, 72, 76))
    shape(canvas, lambda d, s: d.rounded_rectangle([(gx0 + 0.3 * PX) * s, (gy0 + 0.3 * PX) * s, (gx1 - 0.3 * PX) * s, (gy1 - 0.3 * PX) * s], radius=2.1 * PX * s, fill=255), GLASS)
    x0, y0, x1, y1 = DF
    inner = lambda x, y, w, h: x > x0 + 12 and x + w < x1 - 12 and y > y0 + 12 and y + h < 1415
    T = (4200, 470, 4780, 790)                     # the time box
    in_time = lambda x, y, w, h: x >= T[0] and x + w <= T[2] and y >= T[1] and y + h <= T[3]
    seg_lit = set()

    def seg_name(x, y, w, h):
        cxm, cym = x + w / 2, y + h / 2
        if cxm < 4270:
            dig, mid = 1, 4258
        elif cxm < 4420:
            dig, mid = 2, 4350
        elif cxm < 4455:
            return "colon"
        elif cxm < 4600:
            dig, mid = 3, 4530
        else:
            dig, mid = 4, 4668
        if w > h:
            s = "a" if cym < 560 else "g" if cym < 680 else "d"
        else:
            s = ("f" if cxm < mid else "b") if cym < 625 else ("e" if cxm < mid else "c")
        return f"{dig}{s}"
    LIT = {"2b", "2c", "colon", "3a", "3b", "3g", "3e", "3d", "4a", "4b", "4c"}
    is_seg = lambda x, y, w, h, a: in_time(x, y, w, h) and w < 200 and h < 200 and a > 300
    blend(canvas, to_tex(comps(ink, T, lambda x, y, w, h, a: is_seg(x, y, w, h, a) and seg_name(x, y, w, h) in LIT)), 0, 0, CYAN)
    blend(canvas, to_tex(comps(ink, T, lambda x, y, w, h, a: is_seg(x, y, w, h, a) and seg_name(x, y, w, h) not in LIT)), 0, 0, GHOST)
    blend(canvas, to_tex(comps(ink, T, lambda x, y, w, h, a: w > 400)), 0, 0, (78, 80, 84))      # the time box's outline
    # level and stage bars
    lvl = lambda w, h, a: 20 <= w <= 30 and 46 <= h <= 58 and a > 1100
    stage = lambda w, h, a: 48 <= w <= 58 and 22 <= h <= 30 and a > 1100
    LIT_BARS = [(2992, 1207), (3397, 981), (3252, 583), (3430, 583), (3608, 583)]
    near = lambda x, y: any(abs(x - lx) < 8 and abs(y - ly) < 14 for lx, ly in LIT_BARS)
    reg = (x0, y0, x1, 1420)
    blend(canvas, to_tex(comps(ink, reg, lambda x, y, w, h, a: inner(x, y, w, h) and (lvl(w, h, a) or stage(w, h, a)) and near(x, y))), 0, 0, CYAN)
    blend(canvas, to_tex(comps(ink, reg, lambda x, y, w, h, a: inner(x, y, w, h) and (lvl(w, h, a) or stage(w, h, a)) and not near(x, y))), 0, 0, GREYBAR)
    # everything else inside the frame (numbers, symbols, the rule): white
    other = lambda x, y, w, h, a: inner(x, y, w, h) and not in_time(x, y, w, h) and not lvl(w, h, a) and not stage(w, h, a) and a > 25
    blend(canvas, to_tex(comps(ink, reg, other)), 0, 0, INK)
    # the five keys: light grey with the drawing's dark symbols
    KEYS = [(2882, 3290), (3303, 3697), (3710, 4104), (4117, 4511), (4524, 4936)]
    A = d2tex_affine()
    tp = lambda X, Y: (A[0, 0] * X + A[0, 2], A[1, 1] * Y + A[1, 2])
    for i, (k0, k1) in enumerate(KEYS):
        ax0, ay0 = tp(k0 + 6, 1424)
        ax1, ay1 = tp(k1 - 6, 1631)
        if i == 0:
            ax0 = max(ax0, gx0 + 0.4 * PX)
        if i == 4:
            ax1 = min(ax1, gx1 - 0.4 * PX)
        km = shape(np.zeros_like(canvas), lambda d, s: d.rounded_rectangle([ax0 * s, ay0 * s, ax1 * s, ay1 * s], radius=(1.0 * PX if i in (0, 4) else 0.4 * PX) * s, fill=255), (0, 0, 0))
        grad = np.linspace(196, 168, round(ay1) - round(ay0) + 1)
        col = np.zeros_like(canvas)
        col[round(ay0):round(ay1) + 1] = grad[:, None, None] * np.array([1.0, 1.0, 1.02])
        a = km[..., None]
        canvas[:] = canvas * (1 - a) + col * a
        blend(canvas, to_tex(comps(ink, (k0 + 20, 1440, k1 - 20, 1620), lambda x, y, w, h, a, k0=k0, k1=k1: w < 300 and a > 25 and x > k0 + 45 and x + w < k1 - 45 and y + h < 1612)), 0, 0, KEYINK)
    # under the keys: "*" and the hold-3-seconds symbols (Child Lock, Sound, Smart Check), between corner brackets as in the photo
    for bx0, bx1 in ((3225, 3345), (3625, 3760), (4020, 4160)):
        blend(canvas, to_tex(comps(ink, (bx0, 1685, bx1, 1780), lambda x, y, w, h, a: not (w > 3 * h and h <= 8) and h < 95 and a > 25)), 0, 0, LIGHT)
        (ux0, uy0), (ux1, uy1) = tp(bx0 - 70, 1700), tp(bx1 + 70, 1775)
        lh = 0.42 * PX
        for pts in ([(ux0, uy0), (ux0, uy1), (ux0 + 2.0 * PX, uy1)], [(ux1 - 2.0 * PX, uy1), (ux1, uy1), (ux1, uy0)]):
            m = Image.new("L", (TW * 2, th * 2), 0)
            ImageDraw.Draw(m).line([(p[0] * 2, p[1] * 2) for p in pts], fill=255, width=round(lh * 2))
            blend(canvas, cv2.resize(np.asarray(m).astype(np.float32) / 255, (TW, th), interpolation=cv2.INTER_AREA), 0, 0, LIGHT)
    # "*(3 sec)" above the display's top right, brackets and all, as this model's photo has it
    blend(canvas, to_tex(comps(ink, (4630, 330, 4870, 420), lambda x, y, w, h, a: True)), 0, 0, LIGHT)
    # the two buttons: a dark recess, the raised face, the drawing's symbol fitted into it
    for fb, frame in ((POWER_PX, (5240, 420, 5630, 810)), (START_PX, (5240, 995, 5630, 1660))):
        fx0, fy0, fx1, fy1 = tbox(pbox(*fb))
        shape(canvas, lambda d, s: d.rounded_rectangle([(fx0 - 1.5 * PX) * s, (fy0 - 1.5 * PX) * s, (fx1 + 1.5 * PX) * s, (fy1 + 1.5 * PX) * s], radius=3.2 * PX * s, fill=255), C["recess"])
        shape(canvas, lambda d, s: d.rounded_rectangle([fx0 * s, fy0 * s, fx1 * s, fy1 * s], radius=2.4 * PX * s, fill=255), C["btn"])
        X0, Y0, X1, Y1 = frame
        # only the symbol: the callout's hand (lower right) and the frame are left out
        sym = comps(ink, (X0 + 15, Y0 + 15, X1 - 15, Y1 - 15), lambda x, y, w, h, a: w < 300 and a > 25 and x > X0 + 60 and y > Y0 + 60 and x + w < 5530 and y + h < Y0 + 0.75 * (Y1 - Y0))
        M = np.float32([[(fx1 - fx0) / (X1 - X0), 0, fx0 - X0 * (fx1 - fx0) / (X1 - X0)], [0, (fy1 - fy0) / (Y1 - Y0), fy0 - Y0 * (fy1 - fy0) / (Y1 - Y0)]])
        blend(canvas, cv2.warpAffine(cv2.GaussianBlur(sym, (0, 0), 1.2), M, (TW, th), flags=cv2.INTER_LINEAR), 0, 0, INK)
    return Image.fromarray(canvas.clip(0, 255).astype(np.uint8))


def flat(colour, size, grad=(1.0, 1.0)):
    w, h = size
    a = np.ones((h, w, 3), np.float32) * colour * np.linspace(grad[0], grad[1], h)[:, None, None]
    a += rng.normal(0, 0.8, (h, w, 1))
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def side(C, suf):
    """The left side's three nested pressed panels, from Samsung's side photo (front at the left). The side wall runs from column
    625 (its front edge, 550 mm from the back) to 1357 (the back panel's plane) and from row 76 (under the worktop, h 811 mm) to
    row 1220 (h 26 mm). The studio light (a quadratic in log luminance) is divided out, the relief's own light and shade kept at
    half strength, in the body colour. The right side is its mirror (Samsung shows only the left)."""
    a = photo("g548036445.png", (40, 40, 42), C["photo"])
    crop = Image.fromarray(a.astype(np.uint8)).crop((625, 76, 1357, 1220)).resize((576, 900), Image.LANCZOS)
    lum = np.asarray(crop.convert("L")).astype(np.float32)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    c, *_ = np.linalg.lstsq(A, np.log(np.maximum(lum, 1)).reshape(-1), rcond=None)
    n = lum / np.exp(A @ c).reshape(h, w)
    n = 1 + (n / np.median(n) - 1) * 0.5
    tint = np.clip(np.clip(n, 0.3, 2.2)[..., None] * (C["body"] * 0.8), 0, 255).astype(np.uint8)
    # u runs from the front edge (0) to the back (1) on the left side; the right side is the mirror
    save(Image.fromarray(tint), f"side_l{suf}.jpg", 86)
    save(Image.fromarray(tint[:, ::-1]), f"side_r{suf}.jpg", 86)


# ── the back: Samsung's rear photo, square on (g548036452; the Black one, g548036430, lands on it to 0.4 px). The cabinet spans
# columns 523-1396 (600 mm), the floor is row 1256.8: 1.4532 px per mm. This back is the WW80TA's (tex_samsung_ww80.py): the
# two photos match with correlation 0.993 under one affine fit, so its traced centre lines were carried over by that fit and
# checked on this photo row by row (--debug draws them): the drain hose, bolts, inlet, grommet and holder land on it. Seen from behind: photo right = the machine's left. ──
RPPM, RCX, RYB = 1.4532, 958.5, 1256.8
DRAIN = [(604, 610), (604, 577), (604, 556), (604, 536), (605, 515), (607, 494), (610, 474), (614, 453), (617, 432), (624, 411),
         (628, 391), (634, 370), (642, 349), (647, 328), (654, 308), (660, 287), (666, 266), (673, 245), (682, 225), (690, 204),
         (701, 183), (718, 162), (737, 144), (757, 128), (783, 115), (814, 103), (845, 96), (876, 94), (907, 93), (938, 92),
         (969, 91), (1000, 92), (1031, 92), (1062, 94), (1093, 97), (1124, 102), (1156, 112), (1187, 129), (1214, 151),
         (1236, 180), (1249, 212), (1256, 245), (1262, 276), (1268, 307), (1273, 338), (1277, 369), (1284, 400), (1290, 431),
         (1297, 462), (1304, 493), (1310, 524), (1315, 556), (1321, 587), (1325, 618), (1328, 649), (1330, 680), (1331, 711),
         (1333, 742), (1334, 773), (1335, 804), (1337, 835), (1339, 867), (1341, 898), (1342, 929), (1344, 960), (1344, 991),
         (1342, 1022), (1339, 1053), (1335, 1084), (1330, 1115), (1326, 1141), (1323, 1159)]
CUFF = ((1322, 1159), (1318, 1225))      # the drain hose's smooth end piece
# the cord: its loop at the lower left is wider here than on the WW80TA's back, and its last run goes straight down to the plug
# beside the hose: both re-traced on this photo (row by row, by its bright core). Along the top it runs under the hose's upper
# edge (rows 76-80): kept at row 80, so it stays clear of the worktop's underside
CORD = [(609, 221), (606, 248), (606, 277), (601, 308), (596, 339), (591, 375), (585, 411), (580, 442), (580, 465), (584, 485),
        (593, 501), (610, 508), (630, 502), (648, 485), (662, 467), (673, 447), (679, 427), (681, 405), (680, 380), (676, 352),
        (668, 325), (660, 295), (653, 262), (650, 232), (649, 205), (650, 180), (653, 155), (660, 135), (672, 118), (690, 106),
        (711, 96), (737, 86), (773, 80), (845, 80), (949, 80), (1052, 80), (1125, 80), (1171, 79), (1193, 81), (1210, 94),
        (1221, 120), (1226, 151), (1224, 183), (1215, 220), (1211, 250), (1212, 286), (1218, 348), (1230, 395), (1242, 430),
        (1250, 460), (1256, 490), (1263, 520), (1271, 550), (1279, 580), (1285, 610), (1289, 640), (1293, 670), (1296, 700),
        (1298, 730), (1300, 790), (1303, 820), (1306, 850), (1309, 880), (1311, 910), (1314, 940), (1314, 970)]
PLUG = {"relief": (1317, 970, 1003, 14), "body": (1289, 1003, 1326, 1050), "pin_d": 5}
GROMMET = (609, 206)                      # where the cord leaves the cabinet (a rubber boss)
BOLTS = [(961, 158), (622, 319), (1302, 318)]     # the transit bolts in their rubber grommets
VALVE = (1168, 159)                       # the cold-water inlet valve (white ring, blue core)
CLIPS = [(1230, 220, 41, 27), (1322, 754, 60, 30), (665, 251, 40, 22)]   # hose and cord clips: centre, width, height (px)
HOLDER = (604, 575, 48, 72)               # the moulded holder the drain hose comes out of at the bottom left
WIDTH = {"drain": 33, "cord": 8, "cuff": 38}
# the tub's aluminium cover: an arch on straight sides with rounded bottom corners, 4 mm proud; measured on this photo (its edges
# on rows 700-1000 and columns 800, 958 and 1100)
TUB = {"x0": 704, "x1": 1218, "top": 334, "spring": 512, "bottom": 1143, "r": 64}


def to_m(p):
    return [round(-(p[0] - RCX) / RPPM / 1000, 4), round((RYB - p[1]) / RPPM / 1000, 4)]


def fill_rows(img, m):
    out = img.copy()
    for y in range(m.shape[0]):
        xs = np.where(m[y])[0]
        if not len(xs):
            continue
        for r in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
            a_, b_ = r[0], r[-1]
            if a_ < 4 or b_ > m.shape[1] - 5:
                continue
            left, right = img[y, a_ - 4:a_].mean(0), img[y, b_ + 1:b_ + 5].mean(0)
            t = np.linspace(0, 1, b_ - a_ + 3)[1:-1, None]
            out[y, a_:b_ + 1] = left * (1 - t) + right * t
    return out


def rear(sub, suf):
    """The back with the hose, cord, plug, clips and holder painted out (each is built in 3D): a band running up and down is
    filled row by row (straight across it, from the panel either side), one running across column by column, so the pressing
    lines that cross a band carry on through it; the holder, clips and the plug are inpainted (Telea)."""
    rgb = photo("g548036452.png", (0, 0, 0), sub).astype(np.uint8)
    mask = np.zeros(rgb.shape[:2], np.uint8)
    poly = lambda pts, w: cv2.polylines(mask, [np.array(pts, np.int32)], False, 255, int(round(w)), cv2.LINE_AA)
    poly(DRAIN, WIDTH["drain"] + 14)
    poly(list(CUFF), WIDTH["cuff"] + 12)
    poly(CORD, WIDTH["cord"] + 10)
    x0, y0, x1, y1 = PLUG["body"]
    cv2.rectangle(mask, (x0 - 8, PLUG["relief"][1] - 6), (x1 + 8, y1 + 8), 255, -1)
    for cx, cy, w, h in CLIPS + [HOLDER]:
        cv2.rectangle(mask, (cx - w // 2 - 6, cy - h // 2 - 6), (cx + w // 2 + 6, cy + h // 2 + 6), 255, -1)
    mask = (mask >= 100).astype(np.uint8) * 255
    mv, mh = np.zeros_like(mask), np.zeros_like(mask)
    for pts, w in ((DRAIN, WIDTH["drain"] + 14), (list(CUFF), WIDTH["cuff"] + 12), (CORD, WIDTH["cord"] + 10)):
        for (xa, ya), (xb, yb) in zip(pts[:-1], pts[1:]):
            cv2.line(mv if abs(yb - ya) >= abs(xb - xa) else mh, (xa, ya), (xb, yb), 255, int(w), cv2.LINE_AA)
    allm = mask > 0
    mv = (mv >= 100) & allm
    mh = (mh >= 100) & allm & ~mv
    rgbf = rgb.astype(np.float32)
    fh = cv2.GaussianBlur(fill_rows(rgbf, allm), (1, 9), 0)
    fv = cv2.GaussianBlur(fill_rows(rgbf.transpose(1, 0, 2), allm.T).transpose(1, 0, 2), (9, 1), 0)
    filled = np.where(mv[..., None], fh, np.where(mh[..., None], fv, rgbf))
    rest = (allm & ~mv & ~mh).astype(np.uint8) * 255
    filled = cv2.inpaint(filled.clip(0, 255).astype(np.uint8), rest, 7, cv2.INPAINT_TELEA).astype(np.float32)
    a = cv2.GaussianBlur(allm.astype(np.float32), (0, 0), 1.0)[..., None]
    clean = Image.fromarray((rgbf * (1 - a) + filled * a).clip(0, 255).astype(np.uint8))
    # the back panel: x +-300 mm, from 19.2 mm (its bottom edge) to 811 mm (under the worktop's rear face)
    box = (RCX - 300 * RPPM, RYB - 811 * RPPM, RCX + 300 * RPPM, RYB - 19.2 * RPPM)
    save(clean.crop(tuple(round(v) for v in box)).resize((640, 844), Image.LANCZOS), f"rear{suf}.jpg", 86)
    if DEBUG:
        dbg = Image.fromarray(rgb.copy())
        dd = ImageDraw.Draw(dbg)

        def outline(pts, w, col):
            P_ = np.array(pts, np.float32)
            for i in range(len(P_) - 1):
                d = P_[i + 1] - P_[i]
                n = np.array([-d[1], d[0]]) / max(1e-6, np.hypot(*d)) * w / 2
                for sgn in (1, -1):
                    dd.line([tuple(P_[i] + sgn * n), tuple(P_[i + 1] + sgn * n)], fill=col, width=1)
        outline(DRAIN, WIDTH["drain"], (255, 0, 0))
        outline(list(CUFF), WIDTH["cuff"], (255, 0, 0))
        outline(CORD, WIDTH["cord"], (0, 220, 0))
        dd.rectangle(PLUG["body"], outline=(255, 0, 255))
        for cx, cy, w_, h_ in CLIPS + [HOLDER]:
            dd.rectangle((cx - w_ // 2, cy - h_ // 2, cx + w_ // 2, cy + h_ // 2), outline=(255, 140, 0))
        for bx, by in BOLTS + [VALVE, GROMMET]:
            dd.ellipse((bx - 24, by - 24, bx + 24, by + 24), outline=(0, 160, 255))
        t = TUB
        dd.line([(t["x0"], t["spring"]), (t["x0"], t["bottom"]), (t["x1"], t["bottom"]), (t["x1"], t["spring"])], fill=(255, 255, 0))
        dd.arc((t["x0"], t["top"], t["x1"], 2 * t["spring"] - t["top"]), 180, 360, fill=(255, 255, 0))
        dbg.crop((500, 0, 1420, 1270)).save(os.path.join(DEBUG, f"rear_a{suf}.jpg"), quality=88)
        clean.crop((500, 0, 1420, 1270)).save(os.path.join(DEBUG, f"rear_b{suf}.jpg"), quality=88)


def rear_paths():
    # the drain hose's ribs: one rib, repeated every 3.2 mm along the hose (the photo's spacing)
    rib = np.ones((16, 64, 3), np.float32) * np.array([178, 180, 183], np.float32)
    rib *= (0.62 + 0.38 * (0.5 + 0.5 * np.cos(np.linspace(0, 2 * np.pi, 64, endpoint=False))) ** 1.3)[None, :, None]
    Image.fromarray(rib.clip(0, 255).astype(np.uint8)).save(os.path.join(D, "hose.jpg"), quality=92)
    px = lambda v: round(v / RPPM / 1000, 4)
    t = TUB
    paths = {
        "ppm": RPPM, "drain_d": px(WIDTH["drain"]), "cord_d": px(WIDTH["cord"]), "cuff_d": px(WIDTH["cuff"]), "rib": 0.0032,
        "drain": [to_m(p) for p in DRAIN], "cuff": [to_m(p) for p in CUFF], "cord": [to_m(p) for p in CORD],
        "plug": {"relief": [*to_m(PLUG["relief"][:2]), px(PLUG["relief"][2] - PLUG["relief"][1]), px(PLUG["relief"][3])],
                 "body": [to_m(PLUG["body"][:2]), to_m(PLUG["body"][2:])], "pin_d": px(PLUG["pin_d"])},
        "grommet": to_m(GROMMET), "bolts": [to_m(p) for p in BOLTS], "valve": to_m(VALVE),
        "clips": [[*to_m((cx, cy)), px(w), px(h)] for cx, cy, w, h in CLIPS],
        "holder": [*to_m(HOLDER[:2]), px(HOLDER[2]), px(HOLDER[3])],
        "tub": {"x0": to_m((t["x1"], 0))[0], "x1": to_m((t["x0"], 0))[0], "top": to_m((0, t["top"]))[1],
                "spring": to_m((0, t["spring"]))[1], "bottom": to_m((0, t["bottom"]))[1], "r": px(t["r"])},
        "panel": {"y0": 0.0192, "y1": 0.811},
    }
    json.dump(paths, open(os.path.join(D, "rear_paths.json"), "w"), indent=1)


def drum():
    """The Diamond drum's wall, as Samsung's close photo of this model shows it: rows of faceted diamonds (each a lit and a
    shaded pair of triangles) with a row of small holes along each row's edge. A 300 x 150 mm tile. Samsung calls this drum "2nd Diamond" (spec list); its photo (g548036447)
    shows the same pattern as the WW70FG's."""
    w, h = 1024, 512
    img = Image.new("RGB", (w, h), (168, 172, 178))
    d = ImageDraw.Draw(img)
    cw, rh = 64, 64
    for row in range(-1, h // rh + 2):
        y = row * rh
        off = (row % 2) * cw // 2
        for i in range(-1, w // cw + 2):
            x = i * cw + off
            top, mid, bot = (x + cw // 2, y + 4), (x + cw // 2, y + rh // 2 + 6), (x + cw // 2, y + rh - 4)
            d.polygon([(x + 4, y + rh // 2), top, mid], fill=(214, 217, 222))
            d.polygon([(x + cw - 4, y + rh // 2), top, mid], fill=(186, 190, 196))
            d.polygon([(x + 4, y + rh // 2), mid, bot], fill=(132, 136, 142))
            d.polygon([(x + cw - 4, y + rh // 2), mid, bot], fill=(150, 154, 160))
        for i in range(0, w, 16):
            d.ellipse((i - 3.2, y - 3.2, i + 3.2, y + 3.2), fill=(44, 46, 50))
            d.ellipse((i - 3.2, y - 4.2, i + 3.2, y - 1.6), fill=(228, 230, 234))
    save(img, "drum.jpg", 86)


def tray():
    """The drawer's tray from above, as the manual (DC68-04382A, the detergent drawer) names it, left to right: II main wash, the softener with its
    siphon (blue in Samsung's drawer photo) and MAX line, I prewash."""
    t = Image.new("RGB", (512, 256), (222, 225, 229))
    d = ImageDraw.Draw(t)
    d.rectangle((6, 6, 506, 250), outline=(180, 184, 192), width=6)
    d.line([(250, 8), (250, 248)], fill=(184, 188, 196), width=6)
    d.line([(352, 8), (352, 248)], fill=(184, 188, 196), width=6)
    d.rounded_rectangle((262, 26, 340, 92), 8, fill=(78, 140, 210))
    d.line([(262, 132), (340, 132)], fill=(150, 154, 164), width=3)
    for x, s in ((125, "II"), (430, "I")):
        for k in range(len(s)):
            xx = x + (k - (len(s) - 1) / 2) * 18
            d.rectangle((xx - 4, 140, xx + 4, 196), fill=(150, 154, 164))
    save(t, "tray.jpg", 88)


# the decals of --hi: mm boxes (x0, h0, x1, h1) and the surface each lies on, each cut from the band drawn at HI px/mm
KEY_BOXES = [(2882, 3290), (3303, 3697), (3710, 4104), (4117, 4511), (4524, 4936)]       # the keys, drawing px (see layout.json)


def dbox(X0, Y0, X1, Y1):                       # drawing px box -> mm box
    (a0, b0), (a1, b1) = d2p(X0, Y0), d2p(X1, Y1)
    return pbox(a0, b0, a1, b1)


def decal_boxes():
    lx0, lh0, lx1, lh1 = LOGO
    boxes = {
        "logo": ((lx0 - 1.5, lh0 - 1.5, lx1 + 1.5, lh1 + 1.5), "drawer"),
        # the programme names and their leader lines, round the dial
        "dial": ((PXmm(1058), PHmm(134), PXmm(1275), PHmm(51)), "fascia"),
        # the symbols under the keys and their brackets; *3 sec over the display
        "hints": (dbox(3140, 1680, 4245, 1790), "fascia"),
        "sec": (dbox(4620, 320, 4880, 430), "fascia"),
    }
    # the display glass, from just over the keys (the builder's glass starts 0.4 mm over them) to just inside its top
    gx0, gh0, gx1, gh1 = pbox(*GLASS_PX)
    ktop = dbox(2882, 1424, 2890, 1631)[3]
    boxes["display"] = ((gx0 + 0.3, ktop + 0.7, gx1 - 0.3, gh1 - 0.3), "glass")
    # each key's face (the builder's: 0.3 mm in from the box at the sides), 0.5 mm in from its edges, clear of the rounded rim
    for i, (k0, k1) in enumerate(KEY_BOXES):
        x0, h0, x1, h1 = dbox(k0 + 6, 1424, k1 - 6, 1631)
        boxes[f"key{i}"] = ((x0 + 0.8, h0 + 0.5, x1 - 0.8, h1 - 0.5), "key")
    # the buttons' raised faces, 0.7 mm in from their edges (their corners are 2.2 mm round in 3D)
    for n, b in (("power", POWER_PX), ("start", START_PX)):
        x0, h0, x1, h1 = pbox(*b)
        boxes[n] = ((x0 + 0.7, h0 + 0.7, x1 - 0.7, h1 - 0.7), "button")
    return boxes


def cut_decals(ink):
    out = {}
    for suf, C in COLOURS.items():
        img = (np.asarray(panel(ink, C).convert("RGB")).astype(np.float32) * SHADE["panel"]).clip(0, 255).astype(np.uint8)
        img = Image.fromarray(img)
        for n, (b, on) in decal_boxes().items():
            x0, y0, x1, y1 = (round(v) for v in tbox(b))
            img.crop((x0, y0, x1, y1)).save(os.path.join(D, f"print_{n}{suf}.jpg"), quality=88, subsampling=0, optimize=True)
            out[n] = {"file": f"print_{n}.jpg", "rect": [x0 / TW, y0 / TH, x1 / TW, y1 / TH], "on": on}
            print(f"decal print_{n}{suf}.jpg: {x1 - x0} x {y1 - y0} px on the {on}")
    with open(os.path.join(D, "decals.json"), "w") as f:
        json.dump(out, f, indent=1)


def main():
    ink = drawing()
    if HI:
        cut_decals(ink)
        return
    for suf, C in COLOURS.items():
        save(panel(ink, C), f"panel{suf}.jpg", 90)
        save(flat(C["body"], (256, 512), (1.04, 0.94)), f"front{suf}.jpg", 86)
        side(C, suf)
        rear(C["photo"], suf)
    rear_paths()
    drum()
    tray()
    X = lambda x: round(x / 1000, 5)
    Hm = lambda h: round(h / 1000, 5)
    bx = lambda b: {"x0": X(b[0]), "x1": X(b[2]), "y0": Hm(b[1]), "y1": Hm(b[3])}
    keys = []
    for k0, k1 in [(2882, 3290), (3303, 3697), (3710, 4104), (4117, 4511), (4524, 4936)]:
        (a0, b0), (a1, b1) = d2p(k0 + 6, 1424), d2p(k1 - 6, 1631)
        keys.append(bx(pbox(a0, b0, a1, b1)))
    lay = {
        "seam": X(SEAM), "glass": bx(pbox(*GLASS_PX)), "power": bx(pbox(*POWER_PX)), "start": bx(pbox(*START_PX)),
        "pocket": bx(POCKET), "keys": keys,
        "dial": {"x": X(DIAL[0]), "y": Hm(DIAL[1]), "r": round(DIAL[2] / 1000, 5)},
        "band": {"y0": H0 / 1000, "y1": H1 / 1000},
    }
    json.dump(lay, open(os.path.join(D, "layout.json"), "w"), indent=1)
    print(json.dumps(lay))


def page_photos(dst):
    """The page's four photos, Samsung's own of this model, on white: the whole machine centred with the same margin as the
    other products' (804 px tall in 900), or a square crop of the control panel."""
    os.makedirs(dst, exist_ok=True)

    def on_white(name):
        im = Image.open(os.path.join(P, "navy", name)).convert("RGBA")
        base = Image.new("RGBA", im.size, (255, 255, 255, 255))
        base.alpha_composite(im)
        rgb = base.convert("RGB")
        diff = np.abs(np.asarray(rgb).astype(np.int16) - 255).max(axis=2) > 10
        return rgb, diff

    def whole(name, out):
        rgb, diff = on_white(name)
        ys, xs = np.nonzero(diff)
        crop = rgb.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        s = 804 / max(crop.size)
        crop = crop.resize((round(crop.size[0] * s), round(crop.size[1] * s)), Image.LANCZOS)
        sq = Image.new("RGB", (900, 900), (255, 255, 255))
        sq.paste(crop, ((900 - crop.size[0]) // 2, (900 - crop.size[1]) // 2))
        sq.save(os.path.join(dst, out), quality=88, optimize=True)
        print("wrote", os.path.join(dst, out))

    whole("g548036451.png", "0.jpg")
    whole("labelprod_553085468.jpg", "1.jpg")
    whole("g548036446.png", "2.jpg")
    rgb, _ = on_white("g548036448.png")
    rgb.crop((420, 40, 1600, 1220)).resize((900, 900), Image.LANCZOS).save(os.path.join(dst, "3.jpg"), quality=88, optimize=True)
    print("wrote", os.path.join(dst, "3.jpg"))


if PAGE:
    page_photos(PAGE)
else:
    main()
