"""Textures for the Samsung WW80TA046AB1TL, 8 kg front-load washing machine (EcoBubble, Hygiene Steam, Digital Inverter), Black.

usage: python3 tex_samsung_ww80.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>] [--photos <dir>]
  --photos <dir> also writes the page's four photos there (SITE/photos/samsung-ww80ta046ab1tl/0-3.jpg, 900 x 900 on white):
           0 three_quarter.png (the hero), 1 front.jpg, 2 three_quarter_open.png, 3 the control strip close (panel.png)
  photos:  samsung_ww80/ (Samsung India's own gallery for WW80TA046AB1TL, 1920 x 1280):
           panel.png              the control strip, close, a little from above
           front.jpg              straight on, door shut, with this model's energy label on the front
           front_open.png         straight on, door open
           side.png               the right side, front to the left (the pressed panels)
           rear.png               the back, square on, with the drain hose and the cord as delivered (1.403 px per mm)
           drum.png               the 2nd Diamond drum, close
           label.jpg              Samsung's energy label for WW80TA046AB1TL (5 stars, 0.05 kWh/kg/cycle, 8.0 kg)
  manual:  the control-panel drawing of Samsung's user manual DC68-04383A-11 (WW8*T / WW9*T), page 1 of the poster, rendered
           at 2400 dpi with  pdftoppm -r 2400 -f 1 -l 1 -x 29350 -y 31850 -W 6200 -H 1950 -gray  (kept in .work/, not in git)
  logos:   samsung.png
  writes <out dir>/samsung_ww80/*.jpg, label.png, layout.json and rear_paths.json

Every position is in mm: x from the centre line (+ to the right, seen from the front), h above the floor.

The control strip (panel.jpg) covers the whole width and h 721 to 850 mm at 6.83 px per mm. The close photo is rectified to
the strip's front (8 px per mm; its rows read about 3 mm low against the straight-on photos, where the strip is curved, so 3 mm
is added: ESTIMATED). On it, nothing is copied from the photo: the colour is flat, the programme names are the manual's vector
ink, each scaled into the box the word has in the photo; the leader lines, the dial's ring and its 14 lamps are drawn where the
photo has them; the display, its keys, the brackets under them, "*(3 sec)" and the two buttons' symbols are the manual's
drawing, mapped by one affine fit (the drawing is to scale there: every element lands within 0.5 mm of the photo) and coloured
as the photo shows them lit (1:27, the wash, rinse and spin stages, 40, 2 and 1400) and unlit. SAMSUNG is the logo file; the
drawer's "Ecobubble(TM) DigitalInverter [Woolmark] 8kg", which the manual doesn't draw, is the photo's own ink, enlarged 4x and
re-thresholded so its edges are sharp.
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
P = os.path.join(PHOTOS, "samsung_ww80")
D = os.path.join(OUT, "samsung_ww80")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(80)

# ── colours (sRGB) ──
BODY = np.array([50, 51, 54], np.float32)       # "Black" (Samsung): a dark graphite in every photo (front 26-62, side 27-34)
INK = (224, 225, 228)                           # the strip's print
LIGHT = (196, 198, 202)                         # the small print round the display (brackets, *(3 sec))
CYAN = (82, 202, 235)                           # lit segments and lamps (the photo's own: 82, 202, 235)
GHOST = (36, 39, 42)                            # unlit segments, seen faintly through the glass
GREYBAR = (96, 98, 102)                         # unlit level bars
GLASS = (16, 17, 19)
BAND = (27, 29, 31)
KEYINK = (44, 46, 50)
BTN = (66, 67, 70)                              # the two buttons' faces (the photo's 55 on a 37 strip)
RECESS = (20, 21, 23)
SHADE = {"panel.jpg": 0.86, "front.jpg": 0.86, "side_l.jpg": 0.9, "side_r.jpg": 0.9, "rear.jpg": 0.92}


def save(img, name, q=88):
    if name in SHADE:          # lit by the viewer's environment light, a texture renders about a quarter brighter than its pixels
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * SHADE[name]).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def photo(name, bg=(0, 0, 0)):
    im = Image.open(os.path.join(P, name)).convert("RGBA")
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


# ── the strip's texture space ──
PX = 4096 / 600.0                               # px per mm
TW, TH = 4096, round(129 * PX)                  # x -300..300, h 721..850
DH = 3.0                                        # rectified close photo -> true height (ESTIMATED, see above)


def cx_(x):
    return (x + 300.0) * PX


def ry_(h):
    return (850.0 - h) * PX


def rect_photo():
    """The close photo rectified to the strip's front at 8 px per mm: x -300..300, rows from h 850 (rectified h, add DH)."""
    a = photo("panel.png")
    K, H0, H1 = 8.0, 721.0, 850.0
    src = np.float32([[100, 342], [1812, 342], [90, 728], [1825, 728]])        # the strip's corners in the photo
    dst = np.float32([[0, (H1 - 848) * K], [600 * K, (H1 - 848) * K], [0, (H1 - H0) * K], [600 * K, (H1 - H0) * K]])
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(a, M, (int(600 * K), int((H1 - H0) * K)), flags=cv2.INTER_CUBIC)


# ── the manual's drawing (2400 dpi): ink 0..1 ──
def drawing():
    a = np.asarray(Image.open(MANUAL).convert("L")).astype(np.float32)
    return 1 - a / 255.0


# drawing px -> rectified mm, fitted on the display (the digits, the keys, the stage symbols, the buttons: within 0.5 mm)
AX, BX, AY, BY = 0.06272, -88.28, -0.0599, 846.8


def d2tex():
    """2x3 affine: drawing px -> panel texture px (true heights)."""
    sx, sy = AX * PX, -AY * PX
    return np.float32([[sx, 0, (BX + 300) * PX], [0, sy, (850 - BY - DH) * PX]])


def ink_to_tex(ink, box, keep=None, drop=()):
    """The drawing's ink inside box (x0, y0, x1, y1 drawing px), optionally only the connected components keep(st) accepts,
    minus the boxes in drop, mapped into a full-size texture mask."""
    x0, y0, x1, y1 = box
    m = np.zeros_like(ink)
    sub = ink[y0:y1, x0:x1].copy()
    if keep is not None:
        n, lab, st, _ = cv2.connectedComponentsWithStats((sub > 0.5).astype(np.uint8))
        ok = np.zeros(n, bool)
        for i in range(1, n):
            ok[i] = keep(st[i][:4] + np.array([x0, y0, 0, 0]), st[i][4])
        grown = cv2.dilate((ok[lab]).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0     # keep the anti-aliased edge
        sub = sub * grown
    m[y0:y1, x0:x1] = sub
    for bx0, by0, bx1, by1 in drop:
        m[by0:by1, bx0:bx1] = 0
    return cv2.warpAffine(m, d2tex(), (TW, TH), flags=cv2.INTER_LINEAR)


def ink_scaled(ink):
    """Downscaling 2400 dpi ink by 0.43 with a plain affine warp aliases thin strokes: pre-blur to the target's pixel size."""
    return cv2.GaussianBlur(ink, (0, 0), 0.9)


# ── programme names: the drawing's word box, and the box the word's ink has in the photo (rectified mm: x0, h0, x1, h1) ──
WORDS = [((294, 359, 841, 431), (-72.0, 820.8, -37.5, 825.5)),      # 15' QUICK WASH
         ((294, 534, 719, 595), (-72.1, 810.8, -45.1, 814.8)),      # DAILY WASH
         ((292, 709, 667, 769), (-72.2, 801.0, -48.4, 804.9)),      # DELICATES
         ((289, 866, 613, 954), (-72.4, 790.1, -51.8, 795.6)),      # WOOL and its symbol
         ((288, 1058, 886, 1119), (-72.4, 780.5, -34.5, 784.4)),    # SUPER ECO WASH
         ((291, 1233, 573, 1294), (-72.1, 770.2, -54.1, 774.1)),    # COLORS
         ((292, 1408, 614, 1468), (-72.1, 759.9, -51.5, 763.9)),    # BEDDING
         ((2323, 359, 2602, 420), (54.9, 821.0, 72.6, 825.1)),      # COTTON
         ((2209, 510, 2602, 596), (47.8, 810.5, 72.6, 816.0)),      # eCOTTON
         ((2171, 709, 2604, 769), (45.5, 800.8, 73.0, 804.8)),      # SYNTHETICS
         ((2059, 884, 2599, 944), (38.6, 790.6, 72.8, 794.5)),      # HYGIENE STEAM
         ((2169, 1058, 2602, 1119), (45.6, 780.4, 73.1, 784.2)),    # RINSE+SPIN
         ((2162, 1233, 2602, 1300), (45.4, 769.9, 73.2, 774.0)),    # DRAIN/SPIN
         ((2136, 1408, 2599, 1468), (43.8, 759.9, 73.1, 763.9))]    # DRUM CLEAN
# leader lines, as the photo has them (rectified mm): each a polyline; SUPER ECO WASH has none in the photo
LEADERS = [[(-35.8, 823.45), (-7.3, 823.45), (-5.5, 818.6)], [(53.1, 823.2), (8.2, 823.2), (7.4, 818.6)],
           [(-42.5, 812.85)] + [(-18.6, 812.85)], [(46.0, 812.7), (20.1, 812.7)],
           [(-46.6, 803.1), (-29.1, 803.1)], [(43.8, 802.9), (30.6, 802.9)],
           [(-49.9, 792.75), (-33.4, 792.75)], [(37.1, 792.7), (35.1, 792.7)],
           [(43.9, 782.3), (35.6, 782.3)],
           [(-52.6, 772.1), (-30.0, 772.1)], [(43.5, 772.1), (31.8, 772.1)],
           [(-49.9, 761.85), (-21.2, 761.85)], [(42.0, 761.85), (22.0, 761.85)]]
DIAL = (2.46, 786.4)                    # rectified: the dial ring's centre (a circle fit to its outer edge)
BEZEL, CHROME, CAP = 32.6, 28.8, 24.4   # radii (mm): the black ring with the lamps, the chrome ring's outside, the black cap
LAMPS = [100.8, 79.3, 122.5, 57.6, 146.6, 33.4, 167.5, 12.5, -172.1, -7.9, -150.3, -29.8, -128.5, -51.6]  # the drawing's 14
LIT_LAMP = 57.6                         # eCOTTON, lit in the photo
GLASS_BOX = (92.2, 753.3, 220.3, 826.3)               # the display glass (rectified mm)
POWER = (241.0, 806.8, 259.5, 823.6)                  # the two buttons' raised faces (rectified mm), and their recesses
START = (241.0, 755.3, 259.5, 790.7)
POWER_REC = (238.8, 804.0, 261.9, 826.5)
START_REC = (238.8, 752.6, 261.9, 793.6)
SEAM = -75.5                                          # the drawer's right edge (the groove between the drawer and the controls)
DRAWER_TEXT = (-266.0, 780.5, -112.0, 794.0)          # the photo's "Ecobubble ... 8kg" (rectified mm)
LOGO = (-262.2, 815.15, -194.8, 825.0)                # the photo's SAMSUNG
POCKET = (-255.0, 744.0, -105.0, 778.5)               # the grip pocket under the drawer's print (rectified mm)


def tbox(b):                                          # rectified (x0, h0, x1, h1) -> texture px (x0, y0, x1, y1)
    x0, h0, x1, h1 = b
    return cx_(x0), ry_(h1 + DH), cx_(x1), ry_(h0 + DH)


def panel(rect, ink):
    th = TH
    # the flat graphite, a touch lighter at the rounded top edge
    g = np.linspace(1.05, 0.97, th)[:, None, None]
    img = np.ones((th, TW, 3), np.float32) * BODY * g + rng.normal(0, 0.7, (th, TW, 1))
    # the pocket: a little darker inside (the 3D scoop adds its own shade)
    x0, y0, x1, y1 = tbox(POCKET)
    pm = np.zeros((th, TW), np.float32)
    cv2.rectangle(pm, (int(x0 + 60), int(y0 + 20)), (int(x1 - 60), int(y1 - 10)), 1.0, -1)
    pm = cv2.GaussianBlur(pm, (0, 0), 30)
    img *= (1 - 0.1 * pm)[..., None]
    canvas = img

    def poly(c, pts, w, colour):
        m = Image.new("L", (TW, th), 0)
        d = ImageDraw.Draw(m)
        d.line([(cx_(x), ry_(h + DH)) for x, h in pts], fill=255, width=max(1, round(w * PX)), joint="curve")
        blend(c, np.asarray(m).astype(np.float32) / 255, 0, 0, colour)

    def shape(c, fn, colour):
        """draws a filled shape at 2x and brings it down, so its edge is anti-aliased"""
        m = Image.new("L", (TW * 2, th * 2), 0)
        fn(ImageDraw.Draw(m), 2.0)
        mm = cv2.resize(np.asarray(m).astype(np.float32) / 255, (TW, th), interpolation=cv2.INTER_AREA)
        blend(c, mm, 0, 0, colour)
        return mm

    # the groove between the drawer and the controls
    shape(canvas, lambda d, s: d.rectangle([(cx_(SEAM) - 0.5 * PX) * s, 0, (cx_(SEAM) + 0.5 * PX) * s, th * s], fill=255), (14, 15, 17))

    # SAMSUNG, from the logo file, in the photo's box
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    al = np.asarray(lg.getchannel("A")).astype(np.float32) / 255
    ys, xs = np.where(al > 0.1)
    al = al[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    x0, y0, x1, y1 = tbox(LOGO)
    m = cv2.resize(al, (round(x1 - x0), round(y1 - y0)), interpolation=cv2.INTER_AREA)
    blend(canvas, m, round(x0), round(y0), INK)

    # the drawer's print: the photo's ink, re-thresholded sharp
    K = 8.0
    L = rect.mean(2)
    bx0, bh0, bx1, bh1 = DRAWER_TEXT
    r0, r1, c0, c1 = int((850 - bh1) * K), int((850 - bh0) * K), int((bx0 + 300) * K), int((bx1 + 300) * K)
    sub = L[r0:r1, c0:c1]
    top = sub - cv2.morphologyEx(sub, cv2.MORPH_OPEN, np.ones((25, 25), np.uint8))
    up = cv2.resize(top, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
    up = cv2.GaussianBlur(up, (0, 0), 1.6)
    lo, hi = np.percentile(up, 50), np.percentile(up, 99.7)
    mask = np.clip((up - (lo + 0.42 * (hi - lo))) / (0.08 * (hi - lo)), 0, 1)
    tw_, th_ = round((bx1 - bx0) * PX), round((bh1 - bh0) * PX)
    mask = cv2.resize(mask, (tw_, th_), interpolation=cv2.INTER_AREA)
    blend(canvas, mask, round(cx_(bx0)), round(ry_(bh1 + DH)), INK)

    # programme names (drawing ink, fitted by width, centred on the photo's box)
    for (dx0, dy0, dx1, dy1), (px0, ph0, px1, ph1) in WORDS:
        w = ink[dy0 - 6:dy1 + 6, dx0 - 6:dx1 + 6]
        ys, xs = np.where(w > 0.35)
        w = w[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        x0, y0, x1, y1 = tbox((px0, ph0, px1, ph1))
        k = (x1 - x0) / w.shape[1]
        nw, nh = max(1, round(w.shape[1] * k)), max(1, round(w.shape[0] * k))
        m = cv2.resize(cv2.GaussianBlur(w, (0, 0), 0.5 / k * 0.5), (nw, nh), interpolation=cv2.INTER_AREA)
        blend(canvas, m, round(x0), round((y0 + y1) / 2 - nh / 2), INK)
    for pts in LEADERS:
        poly(canvas, pts, 0.62, INK)

    # the dial's black ring and its 14 lamps (the chrome ring and the cap are the builder's 3D knob)
    dx, dh = DIAL
    cxp, cyp = cx_(dx), ry_(dh + DH)
    shape(canvas, lambda d, s: d.ellipse([(cxp - BEZEL * PX) * s, (cyp - BEZEL * PX) * s, (cxp + BEZEL * PX) * s, (cyp + BEZEL * PX) * s], fill=255), (19, 20, 22))
    for a in LAMPS:
        t = np.radians(a)
        lx, ly = cxp + np.cos(t) * 30.6 * PX, cyp - np.sin(t) * 30.6 * PX
        col = CYAN if a == LIT_LAMP else (58, 60, 64)

        def lamp(d, s, lx=lx, ly=ly, t=t):
            u, v = np.array([np.cos(t), -np.sin(t)]), np.array([np.sin(t), np.cos(t)])
            c = np.array([lx, ly])
            q = [c + u * 0.75 * PX + v * 0.65 * PX, c + u * 0.75 * PX - v * 0.65 * PX, c - u * 0.75 * PX - v * 0.65 * PX, c - u * 0.75 * PX + v * 0.65 * PX]
            d.polygon([tuple(p * s) for p in q], fill=255)
        shape(canvas, lamp, col)

    # ── the display ──
    gx0, gy0, gx1, gy1 = tbox(GLASS_BOX)
    shape(canvas, lambda d, s: d.rounded_rectangle([gx0 * s, gy0 * s, gx1 * s, gy1 * s], radius=2.6 * PX * s, fill=255), (64, 66, 70))
    shape(canvas, lambda d, s: d.rounded_rectangle([(gx0 + 0.35 * PX) * s, (gy0 + 0.35 * PX) * s, (gx1 - 0.35 * PX) * s, (gy1 - 0.35 * PX) * s], radius=2.3 * PX * s, fill=255), GLASS)
    A = d2tex()
    tp = lambda X, Y: (A[0, 0] * X + A[0, 2], A[1, 1] * Y + A[1, 2])
    bx0_, by0_ = tp(2958, 397)
    bx1_, by1_ = tp(4438, 692)
    shape(canvas, lambda d, s: d.rounded_rectangle([bx0_ * s, by0_ * s, bx1_ * s, by1_ * s], radius=1.4 * PX * s, fill=255), BAND)
    inks = ink_scaled(ink)
    big = lambda b, a: a > 300
    # stage symbols: wash, rinse, spin lit (the 2nd, 3rd and 4th), prewash unlit; the row of status symbols under them, unlit
    blend(canvas, ink_to_tex(inks, (3095, 430, 3245, 535)), 0, 0, GHOST)
    blend(canvas, ink_to_tex(inks, (3258, 430, 3722, 535)), 0, 0, CYAN)
    blend(canvas, ink_to_tex(inks, (3110, 555, 3720, 660)), 0, 0, GHOST)
    # the time: the drawing's seven segments, 1:27 lit, the rest faint
    seg = {"1b": (3805, 432, 3833, 530), "1c": (3802, 545, 3830, 643),
           "2f": (3855, 431, 3883, 530), "2e": (3852, 545, 3879, 643), "2a": (3871, 417, 3977, 447), "2g": (3861, 523, 3979, 553),
           "2d": (3864, 629, 3971, 658), "2b": (3961, 431, 3989, 531), "2c": (3958, 545, 3986, 643),
           "3f": (4057, 432, 4085, 530), "3e": (4055, 546, 4082, 643), "3a": (4074, 417, 4180, 447), "3g": (4064, 523, 4182, 553),
           "3d": (4067, 629, 4173, 659), "3b": (4164, 432, 4192, 531), "3c": (4161, 545, 4189, 643),
           "4f": (4214, 432, 4242, 531), "4e": (4211, 545, 4238, 644), "4a": (4230, 417, 4336, 447), "4g": (4220, 523, 4338, 553),
           "4d": (4223, 629, 4330, 659), "4b": (4320, 432, 4348, 531), "4c": (4317, 545, 4345, 643),
           "col1": (4009, 473, 4035, 498), "col2": (4007, 579, 4033, 604)}
    lit = {"2b", "2c", "col1", "col2", "3a", "3b", "3g", "3e", "3d", "4a", "4b", "4c"}
    for k, (x0, y0, x1, y1) in seg.items():
        blend(canvas, ink_to_tex(inks, (x0 - 3, y0 - 3, x1 + 3, y1 + 3)), 0, 0, CYAN if k in lit else GHOST)
    # the four columns: level bars (lit: 40, 2 and 1400), their numbers and symbols in white
    bars = lambda b, a: 24 <= b[2] <= 30 and b[3] >= 48 and a > 1200
    notbar = lambda b, a: not bars(b, a)
    blend(canvas, ink_to_tex(inks, (2960, 760, 4420, 1320), keep=notbar), 0, 0, INK)
    LIT_BARS = [(2994, 1012), (3399, 1123), (3808, 781)]
    bar_mask = ink_to_tex(inks, (2960, 760, 4420, 1320), keep=lambda b, a: bars(b, a) and not any(abs(b[0] - lx) < 4 and abs(b[1] - ly) < 6 for lx, ly in LIT_BARS))
    blend(canvas, bar_mask, 0, 0, GREYBAR)
    lit_mask = ink_to_tex(inks, (2960, 760, 4420, 1320), keep=lambda b, a: bars(b, a) and any(abs(b[0] - lx) < 4 and abs(b[1] - ly) < 6 for lx, ly in LIT_BARS))
    blend(canvas, lit_mask, 0, 0, CYAN)
    # Delay End's clock, the rule, Easy Iron's symbol (the callout discs 08 and 09 left out)
    for b in ((4540, 540, 4800, 700), (4540, 800, 4870, 830), (4540, 980, 4800, 1090)):
        blend(canvas, ink_to_tex(inks, b), 0, 0, INK)
    # the five keys: light, with the drawing's dark symbols
    KEYS = [(2879, 3291), (3299, 3700), (3707, 4108), (4116, 4527), (4531, 4938)]
    ky0, ky1 = 1340, 1562
    for i, (k0, k1) in enumerate(KEYS):
        x0, y0 = tp(k0 + 4, ky0)
        x1, y1 = tp(k1 - 4, ky1)
        y1 = min(y1, gy1 - 0.4 * PX)
        if i == 0:
            x0 = max(x0, gx0 + 0.4 * PX)
        if i == 4:
            x1 = min(x1, gx1 - 0.4 * PX)
        km = shape(np.zeros_like(canvas), lambda d, s: d.rounded_rectangle([x0 * s, y0 * s, x1 * s, y1 * s], radius=(1.2 * PX if i in (0, 4) else 0.5 * PX) * s, fill=255), (0, 0, 0))
        grad = np.linspace(158, 206, round(y1) - round(y0) + 1)
        col = np.zeros_like(canvas)
        col[round(y0):round(y1) + 1] = grad[:, None, None] * np.array([1.0, 1.0, 1.02])
        a = km[..., None]
        canvas[:] = canvas * (1 - a) + col * a
        blend(canvas, ink_to_tex(inks, (k0 + 30, ky0 + 25, k1 - 30, ky1 - 20)), 0, 0, KEYINK)
    # under the keys: the drawing's "*" and symbols (Child Lock, Sound, Smart Check: hold the two keys 3 s), each fitted to the
    # photo's box, between the photo's corner brackets (the drawing draws these as dashes; the photo, which wins, as corners)
    for (dx0, dy0, dx1, dy1), pb in (((3228, 1608, 3340, 1700), (113.6, 744.9, 120.5, 751.1)),
                                     ((3624, 1608, 3745, 1700), (138.5, 745.4, 145.8, 751.1)),
                                     ((4020, 1608, 4150, 1700), (163.5, 745.4, 171.6, 751.1))):
        w = ink[dy0:dy1, dx0:dx1]
        ys, xs = np.where(w > 0.35)
        w = w[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        x0, y0, x1, y1 = tbox(pb)
        m = cv2.resize(cv2.GaussianBlur(w, (0, 0), 1.0), (round(x1 - x0), round(y1 - y0)), interpolation=cv2.INTER_AREA)
        blend(canvas, m, round(x0), round(y0), LIGHT)
    for (a0, a1), (b0, b1), (h0, h1) in (((108.5, 112.9), (122.1, 126.5), (746.8, 749.9)), ((134.0, 138.4), (147.1, 151.5), (747.0, 750.2)),
                                         ((159.2, 163.5), (172.8, 177.1), (747.4, 750.5))):
        poly(canvas, [(a0 + 0.2, h1), (a0 + 0.2, h0 + 0.2), (a1, h0 + 0.2)], 0.42, LIGHT)
        poly(canvas, [(b0, h0 + 0.2), (b1 - 0.2, h0 + 0.2), (b1 - 0.2, h1)], 0.42, LIGHT)
    blend(canvas, ink_to_tex(inks, (4630, 240, 4870, 320)), 0, 0, LIGHT)
    # the two buttons: the dark recess, the raised face, the drawing's symbols
    for rec, face, sym in ((POWER_REC, POWER, (5350, 455, 5512, 615)), (START_REC, START, (5350, 1175, 5512, 1315))):
        x0, y0, x1, y1 = tbox(rec)
        shape(canvas, lambda d, s: d.rounded_rectangle([x0 * s, y0 * s, x1 * s, y1 * s], radius=3.2 * PX * s, fill=255), RECESS)
        x0, y0, x1, y1 = tbox(face)
        shape(canvas, lambda d, s: d.rounded_rectangle([x0 * s, y0 * s, x1 * s, y1 * s], radius=2.4 * PX * s, fill=255), BTN)
        blend(canvas, ink_to_tex(inks, sym), 0, 0, INK)
    return Image.fromarray(canvas.clip(0, 255).astype(np.uint8))


def flat(colour, size, grad=(1.0, 1.0)):
    w, h = size
    a = np.ones((h, w, 3), np.float32) * colour * np.linspace(grad[0], grad[1], h)[:, None, None]
    a += rng.normal(0, 0.8, (h, w, 1))
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def label():
    """Samsung's energy label for WW80TA046AB1TL, cut out (the white round its arched top made clear), 512 px wide"""
    im = Image.open(os.path.join(P, "label.jpg")).convert("RGB").crop((661, 78, 1260, 1198))
    a = np.asarray(im).astype(np.uint8)
    white = (a.min(2) > 238).astype(np.uint8)
    h, w = white.shape
    ff = white.copy()
    mask = np.zeros((h + 2, w + 2), np.uint8)
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if ff[seed[1], seed[0]]:
            cv2.floodFill(ff, mask, seed, 2)
    alpha = np.where(ff == 2, 0, 255).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.8)
    rgba = np.dstack([a, alpha])
    out = Image.fromarray(rgba, "RGBA").resize((512, round(512 * h / w)), Image.LANCZOS)
    save(out.quantize(256, method=Image.Quantize.FASTOCTREE).convert("RGBA"), "label.png")


def side():
    """The right side's three nested pressed panels, from Samsung's side photo (front at the left). The side wall runs from
    column 620 (the front edge) to 1362 (the back panel) and from row 72 (under the top's skirt, h 815.6 mm) to row 1240 (h 12 mm):
    1.467 px per mm along z (the top, 807 px, is 550 mm), 1.453 px per mm up. The studio light (a quadratic in log luminance)
    is divided out, the relief's own light and shade kept at half strength, in the body colour. The left side is its mirror."""
    im = Image.open(os.path.join(P, "side.png")).convert("RGBA")
    bg = Image.new("RGBA", im.size, (40, 40, 42, 255))
    bg.alpha_composite(im)
    crop = bg.convert("RGB").crop((621, 73, 1361, 1239)).resize((640, 1008), Image.LANCZOS)
    lum = np.asarray(crop.convert("L")).astype(np.float32)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    c, *_ = np.linalg.lstsq(A, np.log(np.maximum(lum, 1)).reshape(-1), rcond=None)
    n = lum / np.exp(A @ c).reshape(h, w)
    n = 1 + (n / np.median(n) - 1) * 0.5
    tint = np.clip(np.clip(n, 0.3, 2.2)[..., None] * (BODY * 0.8), 0, 255).astype(np.uint8)
    save(Image.fromarray(tint), "side_r.jpg", 88)
    save(Image.fromarray(tint[:, ::-1]), "side_l.jpg", 88)


# ── the back: Samsung's rear photo, square on. The cabinet spans columns 539-1381 (600 mm) and the floor is row 1236 (the feet
# stand on it): 1.403 px per mm, square pixels. Centre lines traced off the photo (the hose's by its lit band, blurred over its
# ribs; the cord's by eye on 1.6x and 2x enlargements with a 20 px grid), seen from behind: photo right = the machine's left. ──
RPPM, RCX, RYB = 1.4033, 960.0, 1236.0
DRAIN = [(617, 612), (617, 580), (617, 560), (617, 540), (618, 520), (620, 500), (623, 480), (627, 460), (630, 440), (636, 420),
         (640, 400), (646, 380), (654, 360), (659, 340), (665, 320), (671, 300), (677, 280), (684, 260), (692, 240), (700, 220),
         (711, 200), (727, 180), (745, 162), (765, 147), (790, 134), (820, 123), (850, 116), (880, 114), (910, 113), (940, 112),
         (970, 111), (1000, 112), (1030, 112), (1060, 114), (1090, 117), (1120, 122), (1150, 132), (1180, 148), (1207, 170),
         (1228, 198), (1240, 228), (1247, 260), (1253, 290), (1259, 320), (1264, 350), (1268, 380), (1274, 410), (1280, 440),
         (1287, 470), (1294, 500), (1300, 530), (1305, 560), (1310, 590), (1314, 620), (1317, 650), (1319, 680), (1320, 710),
         (1322, 740), (1323, 770), (1324, 800), (1326, 830), (1328, 860), (1330, 890), (1331, 920), (1333, 950), (1333, 980),
         (1331, 1010), (1328, 1040), (1324, 1070), (1320, 1100), (1316, 1125), (1313, 1142)]
CUFF = ((1312, 1142), (1308, 1206))      # the drain hose's smooth end piece
CORD = [(622, 236), (619, 262), (619, 290), (612, 320), (607, 350), (602, 385), (596, 420), (592, 450), (596, 478), (606, 500),
        (622, 510), (638, 500), (645, 470), (650, 440), (655, 410), (661, 380), (664, 350), (662, 320), (664, 290), (667, 262),
        (670, 230), (674, 195), (684, 163), (700, 135), (720, 118), (745, 106), (780, 99), (850, 98), (950, 98), (1050, 98),
        (1120, 99), (1165, 97), (1186, 101), (1203, 115), (1213, 140), (1218, 170), (1216, 200), (1208, 236), (1204, 265), (1205, 300), (1211, 360), (1222, 400),
        (1234, 440), (1243, 480), (1253, 520), (1263, 560), (1273, 600), (1280, 640), (1284, 680), (1287, 720), (1284, 752),
        (1276, 800), (1268, 850), (1265, 900), (1270, 952)]
PLUG = {"relief": (1278, 952, 992, 20), "body": (1257, 990, 1300, 1062), "pin_d": 5}
GROMMET = (622, 222)                      # where the cord leaves the cabinet (a rubber boss, 30 x 46 px)
BOLTS = [(962, 176), (634, 331), (1292, 331)]     # the transit bolts in their rubber grommets
VALVE = (1162, 177)                       # the cold-water inlet valve (white ring, blue core)
CLIPS = [(1222, 236, 40, 26), (1281, 752, 48, 26), (668, 265, 38, 20)]   # hose and cord clips: centre, width, height (px)
HOLDER = (617, 578, 46, 70)               # the moulded holder the drain hose comes out of at the bottom left
WIDTH = {"drain": 28, "cord": 9, "cuff": 30}
# the tub's aluminium cover: an arch on straight sides with rounded bottom corners (traced off the photo), 4 mm proud
TUB = {"x0": 700, "x1": 1225, "top": 330, "spring": 590, "bottom": 1138, "r": 62}


def to_m(p):
    return [round(-(p[0] - RCX) / RPPM / 1000, 4), round((RYB - p[1]) / RPPM / 1000, 4)]


def rear_and_paths():
    rgb = photo("rear.png").astype(np.uint8)
    mask = np.zeros(rgb.shape[:2], np.uint8)
    poly = lambda pts, w: cv2.polylines(mask, [np.array(pts, np.int32)], False, 255, int(round(w)), cv2.LINE_AA)
    poly(DRAIN, WIDTH["drain"] + 14)
    poly(list(CUFF), WIDTH["cuff"] + 12)
    poly(CORD, WIDTH["cord"] + 10)
    x0, y0, x1, y1 = PLUG["body"]
    cv2.rectangle(mask, (x0 - 8, PLUG["relief"][1] - 6), (x1 + 8, y1 + 8), 255, -1)
    for cx, cy, w, h in CLIPS:
        cv2.rectangle(mask, (cx - w // 2 - 6, cy - h // 2 - 6), (cx + w // 2 + 6, cy + h // 2 + 6), 255, -1)
    mask = (mask >= 100).astype(np.uint8) * 255
    # paint the back in under them. A hose or cord band running up and down is filled row by row (straight across it, from the
    # panel either side), one running across is filled column by column: the pressing lines that cross a band carry on through
    # it. The holders, clips and the plug are inpainted (Telea). The fill is then smoothed along the band, so rows don't streak.
    mv, mh = np.zeros_like(mask), np.zeros_like(mask)
    for pts, w in ((DRAIN, WIDTH["drain"] + 14), (list(CUFF), WIDTH["cuff"] + 12), (CORD, WIDTH["cord"] + 10)):
        for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
            cv2.line(mv if abs(y1 - y0) >= abs(x1 - x0) else mh, (x0, y0), (x1, y1), 255, int(w), cv2.LINE_AA)
    mv, mh = (mv >= 100) & (mask > 0), (mh >= 100) & (mask > 0) & ~((mv >= 100) & (mask > 0))
    rgbf = rgb.astype(np.float32)

    def fill_rows(img, m):
        out = img.copy()
        for y in range(m.shape[0]):
            xs = np.where(m[y])[0]
            if not len(xs):
                continue
            runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
            for r in runs:
                a_, b_ = r[0], r[-1]
                if a_ < 4 or b_ > m.shape[1] - 5:
                    continue
                left, right = img[y, a_ - 4:a_].mean(0), img[y, b_ + 1:b_ + 5].mean(0)
                t = np.linspace(0, 1, b_ - a_ + 3)[1:-1, None]
                out[y, a_:b_ + 1] = left * (1 - t) + right * t
        return out
    allm = mask > 0
    fh = fill_rows(rgbf, allm)
    fv = fill_rows(rgbf.transpose(1, 0, 2), allm.T).transpose(1, 0, 2)
    fh = cv2.GaussianBlur(fh, (1, 9), 0)
    fv = cv2.GaussianBlur(fv, (9, 1), 0)
    filled = np.where(mv[..., None], fh, np.where(mh[..., None], fv, rgbf))
    rest = (allm & ~mv & ~mh).astype(np.uint8) * 255
    filled = cv2.inpaint(filled.clip(0, 255).astype(np.uint8), rest, 7, cv2.INPAINT_TELEA).astype(np.float32)
    a = cv2.GaussianBlur(allm.astype(np.float32), (0, 0), 1.0)[..., None]
    clean = Image.fromarray((rgbf * (1 - a) + filled * a).clip(0, 255).astype(np.uint8))
    # the back panel: x +-300 mm, from 19.2 mm (its bottom edge, row 1209) to 811 mm (under the top's rear skirt, row 98)
    box = (RCX - 300 * RPPM, RYB - 811 * RPPM, RCX + 300 * RPPM, RYB - 19.2 * RPPM)
    rear = clean.crop(tuple(round(v) for v in box)).resize((640, 844), Image.LANCZOS)
    save(rear, "rear.jpg", 86)
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
        for cx, cy, w_, h_ in CLIPS:
            dd.rectangle((cx - w_ // 2, cy - h_ // 2, cx + w_ // 2, cy + h_ // 2), outline=(255, 140, 0))
        for bx, by in BOLTS:
            dd.ellipse((bx - 24, by - 24, bx + 24, by + 24), outline=(0, 160, 255))
        t = TUB
        dd.line([(t["x0"], t["spring"]), (t["x0"], t["bottom"]), (t["x1"], t["bottom"]), (t["x1"], t["spring"])], fill=(255, 255, 0))
        both = Image.new("RGB", (dbg.width * 2, dbg.height))
        both.paste(dbg, (0, 0))
        both.paste(clean, (dbg.width, 0))
        both.crop((520, 30, 1400, 1250)).save(os.path.join(DEBUG, "rear_a.jpg"), quality=88)
        both.crop((dbg.width + 520, 30, dbg.width + 1400, 1250)).save(os.path.join(DEBUG, "rear_b.jpg"), quality=88)
    # the drain hose's ribs: one rib, repeated every 3.2 mm along the hose (the photo's spacing, 4.5 px)
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
    """The 2nd Diamond drum's wall, as Samsung's close photo shows it: rows of faceted diamonds (each a lit and a shaded pair of
    triangles) with a row of small holes along each row's edge. A 300 x 150 mm tile."""
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
    """The drawer's tray seen from above, as the manual's drawing (page 32) numbers it, left to right: II main wash (with the
    liquid detergent guide), the softener with its siphon and MAX line, I prewash."""
    t = Image.new("RGB", (512, 256), (222, 225, 229))
    d = ImageDraw.Draw(t)
    d.rectangle((6, 6, 506, 250), outline=(180, 184, 192), width=6)
    d.line([(250, 8), (250, 248)], fill=(184, 188, 196), width=6)
    d.line([(352, 8), (352, 248)], fill=(184, 188, 196), width=6)
    d.rounded_rectangle((262, 26, 340, 92), 8, fill=(170, 176, 186))           # the softener's siphon cap
    d.line([(262, 132), (340, 132)], fill=(150, 154, 164), width=3)             # MAX
    for x, s in ((125, "II"), (430, "I")):
        for k in range(len(s)):
            xx = x + (k - (len(s) - 1) / 2) * 18
            d.rectangle((xx - 4, 140, xx + 4, 196), fill=(150, 154, 164))
    save(t, "tray.jpg", 88)


def main():
    rect = rect_photo()
    ink = drawing()
    save(panel(rect, ink), "panel.jpg", 90)
    save(flat(BODY, (512, 768), (1.04, 0.92)), "front.jpg", 85)
    label()
    side()
    rear_and_paths()
    drum()
    tray()
    T = lambda h: round((h + DH) / 1000, 5)                           # rectified mm -> metres (true height)
    X = lambda x: round(x / 1000, 5)
    box = lambda b: {"x0": X(b[0]), "x1": X(b[2]), "y0": T(b[1]), "y1": T(b[3])}
    lay = {
        "seam": X(SEAM), "glass": box(GLASS_BOX), "power": box(POWER), "start": box(START), "pocket": box(POCKET),
        "dial": {"x": X(DIAL[0]), "y": T(DIAL[1]), "bezel": BEZEL / 1000, "chrome": CHROME / 1000, "cap": CAP / 1000},
        "keys": [box((AX * k0 + BX, AY * 1562 + BY, AX * k1 + BX, AY * 1340 + BY)) for k0, k1 in
                 [(2883, 3287), (3303, 3696), (3711, 4104), (4120, 4523), (4535, 4934)]],
        # on the lower front (from the straight-on photos, ESTIMATED): the energy label, the filter cover, the door lock
        "label": {"x0": -0.272, "x1": -0.1706, "y0": 0.0445, "y1": 0.2365},
        "flap": {"x0": 0.091, "x1": 0.243, "y0": 0.033, "y1": 0.136, "r": 0.012},
        "lock": {"x": 0.214, "y": 0.461},
    }
    json.dump(lay, open(os.path.join(D, "layout.json"), "w"), indent=1)
    print(json.dumps(lay))



def page_photos(dst):
    """The page's four photos, Samsung's own of this model, on white: the whole machine centred with the same margin as the
    other products' (804 px tall in 900), or a square crop of the control strip."""
    os.makedirs(dst, exist_ok=True)

    def on_white(name):
        im = Image.open(os.path.join(P, name)).convert("RGBA")
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

    whole("three_quarter.png", "0.jpg")
    whole("front.jpg", "1.jpg")
    whole("three_quarter_open.png", "2.jpg")
    rgb, _ = on_white("panel.png")
    rgb.crop((600, 160, 1720, 1280)).resize((900, 900), Image.LANCZOS).save(os.path.join(dst, "3.jpg"), quality=88, optimize=True)
    print("wrote", os.path.join(dst, "3.jpg"))


if PAGE:
    page_photos(PAGE)
else:
    main()
