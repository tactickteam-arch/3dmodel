"""Textures for the Samsung WW70FG4S02ABTL, 7 kg front-load washing machine (WW4100F, Digital Inverter, Hygiene Steam),
in Black, and its Refined Inox twin WW70FG4S02AXTL (same body, Samsung India's page for each colour).

usage: python3 tex_samsung_ww70fg.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>] [--photos <dir>]
  --photos <dir> also writes the page's four photos there (SITE/photos/samsung-ww70fg4s02abtl/0-3.jpg, 900 x 900 on white)
  photos:  samsung_ww70fg/samsung/  Samsung India's gallery for WW70FG4S02ABTL (1920 x 1280, each scaled to the unit's height:
                                    1238 px for 850 mm)
             g552386176.png  3/4 left        g552386178.png  the back, square on      g552386179.png  the left side
             g552386180.png  straight on, door open (the control band is read off this one: 1.472 px/mm across, 1.4565 up)
             g552386181.png  the drum        g552386182.png  the control panel, close  g552386183.png  the drawer out
             label_552855263.png  Samsung's energy label for WW70FG4S02ABTL; labelprod_552855315.png the unit with it
           samsung_ww70fg/inox/     the same set for WW70FG4S02AXTL (Refined Inox): g552386195-202, label_552855786.png
  manual:  the control-panel drawing of Samsung's user manual DC68-04378C-01 (WW70FG********), page 1 of the poster, rendered
           at 2400 dpi:  pdftoppm -r 2400 -f 1 -l 1 -x 29350 -y 32150 -W 6200 -H 2050 -gray  (kept in .work/, not in git)
  logos:   samsung.png
  writes <out dir>/samsung_ww70fg/: panel.jpg / panel_ax.jpg (the control band, Black / Refined Inox), front*.jpg, side_*.jpg,
         rear*.jpg, drum.jpg, tray.jpg, hose.jpg, bee_label.png / bee_label_ax.png, layout.json, rear_paths.json

Every position is in mm: x from the centre line (+ to the right, seen from the front), h above the floor.

The control band (panel*.jpg) covers the whole width and h 722 to 850 mm at 6.83 px per mm. Nothing on it is copied from the
photo: the colours are flat (the drawer face a touch lighter at the top, as the photos show it), every word is the manual's
vector ink scaled into the box the word has in the straight-on photo, the leader lines are drawn from the word to the dial as
the photo has them, and the display (its symbols, level bars, the seven-segment time, the keys and their symbols, the
"*3 sec" note) is the manual's drawing mapped by one affine fit of its frame onto the photo's (the time box and the keys then
land within 1 px of the photo), coloured as Samsung's photo shows it lit (1:27, the wash, rinse and spin stages, 40 and 1000).
Where the photo and the drawing differ, the photo wins: "QUICK WASH 15'" has its prime, the hold-3-seconds symbols under the
keys sit between corner brackets (the drawing draws dashes), "*3 sec" has no brackets. SAMSUNG is the logo file.
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
PHOTOS, MANUAL, LOGOS, OUT = args[:4]
P = os.path.join(PHOTOS, "samsung_ww70fg")
D = os.path.join(OUT, "samsung_ww70fg")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(70)

# ── the two colours (sRGB). Black: Samsung's "Black" body, a dark graphite; the band right of the drawer is gloss black.
# Refined Inox: a warm mid grey, the band all in it (the inox photos read 1.85-1.9x the black ones on the front and drawer). ──
COLOURS = {
    "": {"body": np.array([50, 51, 55], np.float32), "drawer": np.array([52, 53, 57], np.float32),
         "panel": np.array([15, 16, 18], np.float32), "btn": (60, 61, 64), "recess": (22, 23, 25), "photo": "samsung"},
    "_ax": {"body": np.array([96, 93, 92], np.float32), "drawer": np.array([98, 95, 94], np.float32),
            "panel": np.array([90, 88, 86], np.float32), "btn": (104, 102, 100), "recess": (58, 57, 56), "photo": "inox"},
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
    base = name.split(".")[0].replace("_ax", "")
    if base in SHADE:          # lit by the viewer's environment light, a texture renders about a quarter brighter than its pixels
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * SHADE[base]).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


INOX = {"g552386176.png": "g552386195.png", "g552386178.png": "g552386197.png", "g552386179.png": "g552386198.png",
        "g552386180.png": "g552386199.png"}            # the same views of the Refined Inox twin


def photo(name, bg=(0, 0, 0), sub="samsung"):
    im = Image.open(os.path.join(P, sub, INOX[name] if sub == "inox" else name)).convert("RGBA")
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


# ── the straight-on open-door photo (g552386180): the cabinet spans columns 725-1608 (600 mm) and rows 22-1258.5 (850 mm) ──
FX0, FPX, FY0, FPY = 1166.5, 1.472, 1258.5, 1.4565
PXmm = lambda px: (px - FX0) / FPX
PHmm = lambda py: (FY0 - py) / FPY

# ── the band's texture space ──
PX = 4096 / 600.0                               # px per mm
H0, H1 = 722.0, 850.0
TW, TH = 4096, round((H1 - H0) * PX)


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


# what the photo shows (photo px of g552386180, then mm)
SEAM = PXmm(1043)                               # the drawer's right edge: the groove between the drawer and the controls
POCKET = pbox(760, 122.5, 1030, 175)            # the drawer's grip slot
LOGO = pbox(783.5, 56, 831, 63.5)               # SAMSUNG on the drawer
DIAL_PX = (1163.75, 100.8, 43.7)                # the dial's face: centre and radius (photo px, across)
DIAL = (PXmm(DIAL_PX[0]), PHmm(DIAL_PX[1]), DIAL_PX[2] / FPX)
GLASS_PX = (1299, 54, 1486, 157)                # the display window (keys included)
POWER_PX = (1513, 54, 1545, 84)                 # the two buttons' faces
START_PX = (1513, 104, 1545, 157)
# programme names: the drawing's box (2400 dpi px), the box the word's ink has in the photo (photo px)
WORDS = [((282, 440, 730, 520), (1061, 53, 1100, 57)),      # MIXED LOAD
         ((282, 610, 828, 705), (1060, 68, 1107, 73)),      # QUICK WASH 15 (the photo's prime is drawn after it)
         ((276, 790, 606, 875), (1060, 83, 1089, 87)),      # BEDDING
         ((276, 955, 571, 1055), (1060, 98, 1085, 102)),    # COLORS
         ((276, 1125, 918, 1225), (1060, 113, 1115, 117)),  # WOOL/DELICATES
         ((276, 1295, 578, 1390), (1061, 128, 1086, 132)),  # TOWELS
         ((2314, 440, 2600, 515), (1247, 53, 1272, 57)),    # COTTON
         ((2200, 600, 2600, 690), (1237, 66, 1272, 72)),    # eCOTTON (with its symbol)
         ((2162, 790, 2600, 865), (1233, 83, 1272, 87)),    # SYNTHETICS
         ((2053, 955, 2597, 1055), (1226, 98, 1271, 102)),  # HYGIENE STEAM
         ((2159, 1125, 2600, 1225), (1233, 113, 1272, 117)),  # RINSE+SPIN
         ((2129, 1310, 2600, 1385), (1230, 128, 1272, 132))]  # DRUM CLEAN

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
    a = np.asarray(Image.open(MANUAL).convert("L")).astype(np.float32)
    return 1 - a / 255.0


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
    img += rng.normal(0, 0.6, (th, TW, 1))
    # the grip slot: a little darker inside (the 3D scoop adds its own shade)
    x0, y0, x1, y1 = tbox(POCKET)
    pm = np.zeros((th, TW), np.float32)
    cv2.rectangle(pm, (int(x0 + 40), int(y0 + 15)), (int(x1 - 40), int(y1 - 10)), 1.0, -1)
    img *= (1 - 0.12 * cv2.GaussianBlur(pm, (0, 0), 25))[..., None]
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
    qx, qh = PXmm(1109.6), PHmm(68.4)
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
    LIT_BARS = [(2992, 1207), (3397, 1092), (3252, 583), (3430, 583), (3608, 583)]
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
    # "*3 sec" above the display's top right (the drawing's "(" and ")" left out: the photo has none)
    blend(canvas, to_tex(comps(ink, (4630, 330, 4870, 420), lambda x, y, w, h, a: not (w <= 14 and h >= 48))), 0, 0, LIGHT)
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
    """The left side's three pressed channels, from Samsung's side photo (front at the left). The side wall runs from column 697
    (its front edge, 416 mm from the back) to 1302 (the back) and from row 62 (under the top's skirt, h 821.5 mm) to row 1222
    (h 25 mm): 1.4565 px per mm. The studio light (a quadratic in log luminance) is divided out, the relief's own light and shade
    kept at half strength, in the body colour. The right side is its mirror (Samsung shows only the left)."""
    a = photo("g552386179.png", (40, 40, 42), "samsung" if not suf else "inox")
    crop = Image.fromarray(a.astype(np.uint8)).crop((697, 62, 1302, 1222)).resize((560, 1072), Image.LANCZOS)
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


# ── the back: Samsung's rear photo, square on. The cabinet spans columns 522-1396 (600 mm), the floor is row 1258 (the feet
# stand on it): 1.4583 px per mm. Seen from behind: photo right = the machine's left. The drain hose's centre line is found row
# by row by its lit band (rows 380-1070) and traced by eye above that; the cord's from its ridge (thin bright line) on the right
# and by eye round its loop at the top. ──
RPPM, RCX, RYB = 1.4583, 959.0, 1258.0
DRAIN = [(586, 702), (592, 650), (602, 600), (613, 560), (625, 530), (640, 500), (650, 470), (661, 440), (671, 410), (690, 365),
         (710, 320), (740, 270), (780, 220), (820, 182), (870, 150), (920, 128), (960, 121), (1000, 121), (1035, 128), (1062, 145),
         (1110, 190), (1150, 240), (1180, 290), (1210, 340), (1225, 380), (1243, 440), (1252, 485), (1256, 530), (1256, 600),
         (1255, 700), (1254, 800), (1253, 900), (1252, 1000), (1250, 1062)]
SLEEVE = [(584, 708), (590, 660), (598, 612), (608, 572), (621, 538)]      # the black foam sleeve on the hose's lower end
CUFF = ((1250, 1062), (1248, 1098))       # the hose's smooth end
LOOP_C, LOOP_R = (990.0, 230.0), 112.0     # the cord's coil at the top middle
CORD = [(624, 214), (662, 206), (720, 190), (790, 170), (850, 155)] + \
    [(LOOP_C[0] + LOOP_R * np.cos(np.radians(t)), LOOP_C[1] + LOOP_R * np.sin(np.radians(t))) for t in range(235, 235 + 360 + 50, 18)] + \
    [(1093, 150), (1122, 170), (1150, 190), (1176, 210), (1199, 230), (1219, 250), (1237, 270), (1253, 290), (1267, 310),
     (1278, 330), (1288, 350), (1296, 370), (1301, 390), (1306, 410), (1309, 440), (1311, 500), (1311, 620), (1311, 800),
     (1311, 950), (1311, 1062)]
PLUG = {"relief": (1311, 1062, 1098, 14), "body": (1286, 1098, 1336, 1160)}
GROMMET = (617, 217)                       # where the cord leaves the cabinet
BOLTS = [(612, 320), (1300, 322), (600, 830), (1305, 830)]
VALVE = (1190, 155)                        # the cold-water inlet: a white ring round a blue core
VALVE_SCREWS = [(1158, 155), (1222, 155)]
BLOCK = (1275, 150, 62, 54)                # the white moulded fitting beside it (centre, width, height px)
CLIPS = [(655, 375, 30, 20), (1052, 130, 24, 16), (1028, 166, 22, 14)]    # the white hose and cord clips
WIDTH = {"drain": 32, "cord": 7, "cuff": 36, "sleeve": 44}
TUB = {"x0": 697, "x1": 1223, "top": 300, "spring": 540, "bottom": 1150, "r": 70}


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
    rgb = photo("g552386178.png", (0, 0, 0), sub).astype(np.uint8)
    mask = np.zeros(rgb.shape[:2], np.uint8)
    poly = lambda pts, w: cv2.polylines(mask, [np.array(pts, np.int32)], False, 255, int(round(w)), cv2.LINE_AA)
    poly(DRAIN, WIDTH["drain"] + 12)
    poly(SLEEVE, WIDTH["sleeve"] + 10)
    poly(list(CUFF), WIDTH["cuff"] + 10)
    poly([(round(x), round(y)) for x, y in CORD], WIDTH["cord"] + 9)
    x0, y0, x1, y1 = PLUG["body"]
    cv2.rectangle(mask, (x0 - 8, PLUG["relief"][1] - 4), (x1 + 8, y1 + 8), 255, -1)
    for cx, cy, w, h in CLIPS:
        cv2.rectangle(mask, (cx - w // 2 - 6, cy - h // 2 - 6), (cx + w // 2 + 6, cy + h // 2 + 6), 255, -1)
    allm = mask >= 100
    rgbf = rgb.astype(np.float32)
    fh = cv2.GaussianBlur(fill_rows(rgbf, allm), (1, 9), 0)
    fv = cv2.GaussianBlur(fill_rows(rgbf.transpose(1, 0, 2), allm.T).transpose(1, 0, 2), (9, 1), 0)
    # bands running up and down are filled across each row, bands running across down each column
    mv = np.zeros_like(mask)
    for pts, w in ((DRAIN, WIDTH["drain"] + 12), (SLEEVE, WIDTH["sleeve"] + 10), (list(CUFF), WIDTH["cuff"] + 10), ([(round(x), round(y)) for x, y in CORD], WIDTH["cord"] + 9)):
        for (xa, ya), (xb, yb) in zip(pts[:-1], pts[1:]):
            if abs(yb - ya) >= abs(xb - xa):
                cv2.line(mv, (int(xa), int(ya)), (int(xb), int(yb)), 255, int(w), cv2.LINE_AA)
    mv = (mv >= 100) & allm
    mh = allm & ~mv
    filled = np.where(mv[..., None], fh, np.where(mh[..., None], fv, rgbf))
    a = cv2.GaussianBlur(allm.astype(np.float32), (0, 0), 1.0)[..., None]
    clean = Image.fromarray((rgbf * (1 - a) + filled * a).clip(0, 255).astype(np.uint8))
    # the back panel: x +-300 mm, from 15 mm (its bottom edge) to 821.5 mm (under the top's rear skirt)
    box = (RCX - 300 * RPPM, RYB - 821.5 * RPPM, RCX + 300 * RPPM, RYB - 15 * RPPM)
    save(clean.crop(tuple(round(v) for v in box)).resize((640, 860), Image.LANCZOS), f"rear{suf}.jpg", 86)
    if DEBUG and not suf:
        dbg = Image.fromarray(rgb.copy())
        dd = ImageDraw.Draw(dbg)
        for pts, col in ((DRAIN, (255, 0, 0)), (SLEEVE, (255, 128, 0)), (CORD, (0, 255, 0))):
            dd.line([tuple(map(float, p)) for p in pts], fill=col, width=2)
        for bx, by in BOLTS:
            dd.ellipse((bx - 22, by - 22, bx + 22, by + 22), outline=(0, 160, 255), width=2)
        t = TUB
        dd.line([(t["x0"], t["spring"]), (t["x0"], t["bottom"]), (t["x1"], t["bottom"]), (t["x1"], t["spring"])], fill=(255, 255, 0), width=2)
        dd.rectangle(PLUG["body"], outline=(255, 0, 255), width=2)
        both = Image.new("RGB", (dbg.width * 2, dbg.height))
        both.paste(dbg, (0, 0))
        both.paste(clean, (dbg.width, 0))
        both.crop((500, 0, 1420, 1270)).save(os.path.join(DEBUG, "rear_a.jpg"), quality=88)
        both.crop((dbg.width + 500, 0, dbg.width + 1420, 1270)).save(os.path.join(DEBUG, "rear_b.jpg"), quality=88)


def rear_paths():
    # the drain hose's ribs: one rib, repeated every 3.2 mm along the hose (the photo's spacing)
    rib = np.ones((16, 64, 3), np.float32) * np.array([176, 178, 181], np.float32)
    rib *= (0.62 + 0.38 * (0.5 + 0.5 * np.cos(np.linspace(0, 2 * np.pi, 64, endpoint=False))) ** 1.3)[None, :, None]
    Image.fromarray(rib.clip(0, 255).astype(np.uint8)).save(os.path.join(D, "hose.jpg"), quality=92)
    px = lambda v: round(v / RPPM / 1000, 4)
    t = TUB
    paths = {
        "ppm": RPPM, "drain_d": px(WIDTH["drain"]), "cord_d": px(WIDTH["cord"]), "cuff_d": px(WIDTH["cuff"]), "sleeve_d": px(WIDTH["sleeve"]),
        "rib": 0.0032, "drain": [to_m(p) for p in DRAIN], "sleeve": [to_m(p) for p in SLEEVE], "cuff": [to_m(p) for p in CUFF],
        "cord": [to_m(p) for p in CORD],
        "plug": {"relief": [*to_m(PLUG["relief"][:2]), px(PLUG["relief"][2] - PLUG["relief"][1]), px(PLUG["relief"][3])],
                 "body": [to_m(PLUG["body"][:2]), to_m(PLUG["body"][2:])]},
        "grommet": to_m(GROMMET), "bolts": [to_m(p) for p in BOLTS], "valve": to_m(VALVE),
        "valve_screws": [to_m(p) for p in VALVE_SCREWS], "block": [*to_m(BLOCK[:2]), px(BLOCK[2]), px(BLOCK[3])],
        "clips": [[*to_m((cx, cy)), px(w), px(h)] for cx, cy, w, h in CLIPS],
        "tub": {"x0": to_m((t["x1"], 0))[0], "x1": to_m((t["x0"], 0))[0], "top": to_m((0, t["top"]))[1],
                "spring": to_m((0, t["spring"]))[1], "bottom": to_m((0, t["bottom"]))[1], "r": px(t["r"])},
        "panel": {"y0": 0.015, "y1": 0.8215},
    }
    json.dump(paths, open(os.path.join(D, "rear_paths.json"), "w"), indent=1)


def drum():
    """The Diamond drum's wall, as Samsung's close photo of this model shows it: rows of faceted diamonds (each a lit and a
    shaded pair of triangles) with a row of small holes along each row's edge. A 300 x 150 mm tile."""
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
    """The drawer's tray from above, as the manual (pages 32-34) names it, left to right: II main wash, the softener with its
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


def main():
    ink = drawing()
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
        im = Image.open(os.path.join(P, "samsung", name)).convert("RGBA")
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

    whole("g552386176.png", "0.jpg")
    whole("labelprod_552855315.png", "1.jpg")
    whole("g552386180.png", "2.jpg")
    rgb, _ = on_white("g552386182.png")
    rgb.crop((300, 100, 1480, 1280)).resize((900, 900), Image.LANCZOS).save(os.path.join(dst, "3.jpg"), quality=88, optimize=True)
    print("wrote", os.path.join(dst, "3.jpg"))


if PAGE:
    page_photos(PAGE)
else:
    main()
