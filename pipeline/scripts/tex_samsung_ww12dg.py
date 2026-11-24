"""Textures for the Samsung WW12DG5B24ABTL, 12 kg front-load washing machine (WW5000D, AI EcoBubble, SmartThings AI Energy Mode,
Hygiene Steam, 1400 rpm), in Black, and the same body in Navy (WW12DG5B24ASTL) and Refined Inox (WW12DG5B24AXTL): Samsung India's
page for each colour gives the same spec list but the body colour.

usage: python3 tex_samsung_ww12dg.py <photos dir> <manual panel drawing> <logos dir> <out dir> [--debug <dir>] [--photos <dir>] [--hi <px/mm>]
  --photos <dir> also writes the page's four photos there (SITE/photos/samsung-ww12dg5b24abtl/0-3.jpg, 900 x 900 on white)
  photos:  samsung_ww12dg/black/  Samsung India's gallery for WW12DG5B24ABTL (1920 x 1280)
             g543246820.png  3/4 left        g543246822.png  the back, square on      g543246823.png  the left side
             g543246824.png  straight on, door open (the control band is read off this one: 1.4617 px/mm across, 1.4541 up)
             g543246825.png  the drum        g543246826.png  the control panel, close  g543246827.png  the drawer out
             label_553078337.jpg  Samsung's energy label for WW12DG5B24ABTL; labelprod_553078355.jpg the unit with it
           samsung_ww12dg/navy/  the same set for WW12DG5B24ASTL (g543189787-794, label_553078371.jpg)
           samsung_ww12dg/inox/  the same set for WW12DG5B24AXTL (g543189809-816, label_553078432.jpg)
           (the three colours' photos of each view register to the pixel, but the Inox back: framed smaller, it is mapped onto
           the Black's by the cabinet's edges)
  manual:  the control-panel drawing of Samsung's user manual DC68-04531A-03 (WW12DG5*), rendered at 2400 dpi:
             pdftoppm -r 2400 -f 1 -l 1 -x 36300 -y 32000 -W 6200 -H 1700 -gray DC68-04531A-03.pdf ctrl2400  (kept in .work/)
  logos:   samsung.png
  writes <out dir>/samsung_ww12dg/: panel.jpg / panel_as.jpg (the control band: Black, also the Inox's; Navy), front*.jpg,
         side_*.jpg, rear*.jpg, drum.jpg, tray.jpg, hose.jpg, layout.json, rear_paths.json; with --hi, print_*.jpg and decals.json
         (bee_label*.png come from tex_bee_redraw.py)

Every position is in mm: x from the centre line (+ to the right, seen from the front), h above the floor.

The control band (panel*.jpg) covers the whole width and h 721 to 850 mm. Nothing on it is copied from the photo: the colours are
flat, every word and symbol is the manual's vector ink. The programme names are each scaled into the box the word's ink has in the
straight-on photo and the leader lines drawn where the photo has them; the display (one touch glass: the time window, the
temperature and spin columns, the six option keys, the Delay End, Temp. and Spin keys, Power and Start/Pause) is the manual's
drawing mapped by one affine fit of the drawing onto the photo (ECC, correlation 0.46), coloured as Samsung's photos show it lit
(1:27, the rinse, wash and spin stages, 40 and 1400; the rest of the display's print dim). Where the photo and the drawing differ,
the photo wins: no eco outline round 60 and 40 and no indicator box before eCOTTON (the drawing has them, the photos don't), the
"+" of DRUM CLEAN+ is small and raised, "*(3 sec)" has its brackets, "Hold to Start" sits where the photo has it, and the tactile
dots beside Power and Start/Pause are the photo's. SAMSUNG is the logo file.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

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
# --hi <px per mm>: draw only the control band, in each band colour, at that density and on a ground without noise, and cut its
# print into the decals the builder lays over the band, the drawer face and the display glass (print_*.jpg / print_*_as.jpg and
# decals.json: each piece's rectangle in the band's UVs and the surface it lies on); panel*.jpg and the rest are left alone
HI = None
if "--hi" in args:
    HI = float(args[args.index("--hi") + 1])
    del args[args.index("--hi"):args.index("--hi") + 2]
PHOTOS, MANUAL, LOGOS, OUT = args[:4]
P = os.path.join(PHOTOS, "samsung_ww12dg")
D = os.path.join(OUT, "samsung_ww12dg")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(12)

# ── the colours (sRGB). Samsung shows the three in the same light, so each is read off its photo at the same places and turned into
# texture colours by one factor per channel: the WW90FG's Black twin read (27, 27, 29) there and was set to Samsung's "Black" of the
# WW70FG (50, 51, 55), so 1.85 / 1.89 / 1.90. Body, right of the door (h 560-700 mm): Black (26, 27, 32), Navy (29, 37, 50), Inox
# (48, 46, 46). The control area right of the drawer is a gloss panel: Black (4, 5, 9) beside the display, Navy (21, 29, 42). The
# drawer's face reads the same on the Black and the Inox photos (57 / 81 at its foot / top on both), and the band left of the dial
# 34 / 36: the Inox has the Black's band, so it shares its band textures (suffix ""). ESTIMATED, as every colour read off a photo. ──
K = np.array([1.852, 1.889, 1.897], np.float32)
COLOURS = {
    "": {"body": np.array([26, 27, 32], np.float32) * K, "drawer": np.array([26, 27, 32], np.float32) * K * 1.02,
         "panel": np.array([4, 5, 9], np.float32) * K, "photo": "black"},
    "_as": {"body": np.array([29, 37, 50], np.float32) * K, "drawer": np.array([29, 37, 50], np.float32) * K * 1.02,
            "panel": np.array([21, 29, 42], np.float32) * K, "photo": "navy"},
}
BODY_AX = np.array([48, 46, 46], np.float32) * K           # Refined Inox: the body (front, sides, back) only
INK = (226, 227, 230)                           # the band's print
KEYINK = (212, 214, 218)                        # the touch keys' symbols (light, a touch under the lit display)
LIT = (246, 246, 248)                           # lit digits, stages and figures (white in Samsung's photos)
DIM = (92, 94, 98)                              # unlit figures and symbols
GHOST = (30, 31, 33)                            # unlit segments, faint through the glass
LINEC = (84, 86, 90)                            # the display's rules and option dashes
LCDC = (24, 25, 28)                             # the time window behind the glass (a little lighter than the glass)
GLASS = (8, 9, 12)
SHADE = {"panel": 0.86, "front": 0.86, "side_l": 0.9, "side_r": 0.9, "rear": 0.92}


def save(img, name, q=88):
    base = name.split(".")[0].replace("_as", "").replace("_ax", "")
    if base in SHADE:          # lit by the viewer's environment light, a texture renders about a quarter brighter than its pixels
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * SHADE[base]).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


# the same views in each colour
VIEWS = {"black": {"q34": "g543246820.png", "rear": "g543246822.png", "side": "g543246823.png", "open": "g543246824.png",
                   "drum": "g543246825.png", "close": "g543246826.png", "drawer": "g543246827.png", "front": "labelprod_553078355.jpg"},
         "navy": {"q34": "g543189787.png", "rear": "g543189789.png", "side": "g543189790.png", "open": "g543189791.png",
                  "drum": "g543189792.png", "close": "g543189793.png", "drawer": "g543189794.png", "front": "labelprod_553078375.jpg"},
         "inox": {"q34": "g543189814.png", "rear": "g543189816.png", "side": "g543189809.png", "open": "g543189810.png",
                  "drum": "g543189811.png", "close": "g543189812.png", "drawer": "g543189813.png", "front": "labelprod_553078447.jpg"}}


def photo(view, bg=(0, 0, 0), sub="black"):
    im = Image.open(os.path.join(P, sub, VIEWS[sub][view])).convert("RGBA")
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


# ── the straight-on open-door photo (g543246824): the band spans columns 728-1605 (600 mm) at rows 60-150, the floor is row 1258
# and the cabinet's top row 22 (850 mm); the groove under the band is row 208.5 (h 721.7 mm) ──
FX0, FPX, FY0, FPY = 1166.5, 1.46167, 1258.0, 1.4541
PXmm = lambda px: (px - FX0) / FPX
PHmm = lambda py: (FY0 - py) / FPY

# ── the band's texture space ──
PX = HI or 4096 / 600.0                         # px per mm
H0, H1 = 721.0, 850.0
TW, TH = round(600 * PX), round((H1 - H0) * PX)
KS = PX / (4096 / 600.0)


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


# what the photo shows (photo px of g543246824, measured on its edges, +-0.5 px)
SEAM = PXmm(1052.5)                             # the drawer's right edge: the groove between the drawer and the controls
POCKET = pbox(777.5, 131.5, 1001.0, 182.0)      # the drawer's grip slot
LOGO = pbox(780.0, 58.6, 826.5, 65.4)           # SAMSUNG on the drawer
DIAL_PX = (1167.0, 106.0, 43.0)                 # the dial's ring: centre and radius (Hough circles on the photo, averaged)
DIAL = (PXmm(DIAL_PX[0]), PHmm(DIAL_PX[1]), DIAL_PX[2] / FPX)
LAMP_PX = (1194.1, 71.3)                        # the dial's white lamp
GLASS_PX = (1295.0, 57.5, 1548.0, 155.0)        # the touch glass's edges

# the drawing (2400 dpi px) -> the photo (px): one affine for the programme names' region and one for the display's, each fitted
# by ECC on the photo's print (the names: from their ink's extents, then ECC with the dial left out, correlation 0.52; the
# display: correlation 0.46). The names are then fitted one by one to their own ink boxes in the photo.
A_DIAL = np.float32([[0.094494, 0.000998, 1030.664717], [-4.3e-05, 0.089854, 31.365647]])
A_DISP = np.float32([[0.091218, 0.000336, 1034.516855], [-0.000257, 0.090588, 31.918499]])


def p2t():
    """3x3: photo px -> band texture px"""
    return np.float32([[PX / FPX, 0, (300 - FX0 / FPX) * PX], [0, PX / FPY, (H1 - FY0 / FPY) * PX], [0, 0, 1]])


def d2t(A):
    """2x3: drawing px -> band texture px through the photo"""
    return (p2t() @ np.vstack([A, [0, 0, 1]]))[:2].astype(np.float32)


def apply(A, X, Y):
    return A[0, 0] * X + A[0, 1] * Y + A[0, 2], A[1, 0] * X + A[1, 1] * Y + A[1, 2]


def photo_print():
    """the straight-on photo's print as 0..1 (bright ink over the local background), photo px"""
    a = photo("open")
    g = a.mean(2)
    bg = cv2.medianBlur(g.clip(0, 255).astype(np.uint8), 15).astype(np.float32)
    return np.clip((g - bg) / 110, 0, 1)


def drawing():
    """the manual's ink (0..1): the callout discs and their numbers, the panel's outline, the dial's rings, the display frame
    (with the callout lines along it) and the time window's outline taken out; the eco outlines round 60 and 40 and the
    indicator box before eCOTTON too (not in Samsung's photos)"""
    g = np.asarray(Image.open(MANUAL).convert("L")).astype(np.float32) / 255
    a = 1 - g
    # the discs (grey fills about 180 px across, their numbers on them): all that survives an opening by a 120 px disc, as no
    # stroke of the print is that thick
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (120, 120))
    dm = cv2.morphologyEx((a > 0.12).astype(np.uint8), cv2.MORPH_OPEN, k)
    dm = cv2.dilate(dm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
    a[dm > 0] = 0
    FR = (2852, 290, 5640, 1362)                 # the display frame's edges (the glass's outline: built in 3D)
    for y in (FR[1], FR[3]):
        r = np.arange(y - 20, y + 21)
        prof = a[r, FR[0] + 300:FR[2] - 300].mean(1)
        yc = r[np.argmax(prof)]
        a[yc - 12:yc + 13, FR[0] - 20:FR[2] + 20] = 0
    for x in (FR[0], FR[2]):
        r = np.arange(x - 20, x + 21)
        prof = a[FR[1] + 100:FR[3] - 100, r].mean(0)
        xc = r[np.argmax(prof)]
        a[FR[1] - 20:FR[3] + 20, xc - 12:xc + 13] = 0
    ink = (a > 0.5).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink)
    keep = np.ones(n, bool)
    keep[0] = False
    for i in range(1, n):
        x, y, w, h, ar = st[i]
        thin = min(w, h) < 22
        on_frame = thin and ((w > h and (abs(y - FR[1]) < 25 or abs(y + h - FR[3]) < 25)) or
                             (h > w and (abs(x - FR[0]) < 25 or abs(x + w - FR[2]) < 25)))
        if w > 1500 or h > 700 or on_frame:
            keep[i] = False                      # the outline, the rings, the frame and its callout lines
        elif w > 700 and h > 400:
            keep[i] = False                      # the time window's outline
        elif 3860 < x < 4160 and 480 < y < 760 and w > 80:
            keep[i] = False                      # the eco outlines round 60 and 40
        elif 2050 < x < 2200 and 380 < y < 500 and w > 60 and ar < 0.5 * w * h:
            keep[i] = False                      # the box before eCOTTON
    return a * keep[lab]


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


def comp_list(ink, box):
    x0, y0, x1, y1 = box
    n, lab, st, cen = cv2.connectedComponentsWithStats((ink[y0:y1, x0:x1] > 0.5).astype(np.uint8))
    return [(st[i][0] + x0, st[i][1] + y0, st[i][2], st[i][3], st[i][4], cen[i][0] + x0, cen[i][1] + y0) for i in range(1, n)]


def to_tex(m, A):
    return cv2.warpAffine(cv2.GaussianBlur(m, (0, 0), 0.9), d2t(A), (TW, TH), flags=cv2.INTER_LINEAR)


# ── the programme names: each row's word (left of the dial and right of it) in the drawing, and its ink box in the photo ──
def name_layout(ink, pp):
    """[(the word's components in the drawing, drawing box, photo ink box, the superscript's box or None, side)] and the leader
    lines' photo runs [(x0, x1, y)]: each word's ink in the photo is found round where the region's affine puts it (columns with
    ink off the leader line's row), and its leader line followed along that row from the word towards the dial"""
    out, lines = [], []
    for side, (X0, X1) in (("L", (300, 1000)), ("R", (1900, 2650))):
        cs = comp_list(ink, (X0, 150, X1, 1450))
        text = [c for c in cs if not (c[2] > 4 * c[3] and c[3] < 20 and c[2] > 20)]
        rows = {}
        for c in text:
            r = int(round((c[6] - 280) / 174))     # the drawing's rows are 174 px apart from y 280
            rows.setdefault(r, []).append(c)
        for r, cl in sorted(rows.items()):
            sup = None
            if side == "R" and r == 5:             # DRUM CLEAN+: the "+" is the row's last component
                plus = max(cl, key=lambda c: c[0])
                sup = (plus[0], plus[1], plus[0] + plus[2], plus[1] + plus[3])
                cl = [c for c in cl if c is not plus]
            bx0, by0 = min(c[0] for c in cl), min(c[1] for c in cl)
            bx1, by1 = max(c[0] + c[2] for c in cl), max(c[1] + c[3] for c in cl)
            (ex0, ey0), (ex1, ey1) = apply(A_DIAL, bx0, by0), apply(A_DIAL, bx1, by1)
            sx0, sx1, sy0, sy1 = int(ex0 - 10), int(ex1 + 10), int(ey0 - 3), int(ey1 + 4)
            sub = pp[sy0:sy1, sx0:sx1] > 0.3
            # the letters: columns with ink in 3 rows or more (a leader line has 1 or 2), in runs over the expected box
            cols = np.where(sub.sum(0) >= 3)[0]
            runs = [rr for rr in np.split(cols, np.where(np.diff(cols) > 5)[0] + 1) if len(rr)]
            runs = [rr for rr in runs if rr[-1] >= ex0 - sx0 - 6 and rr[0] <= ex1 - sx0 + 6]
            c0, c1 = runs[0][0], runs[-1][-1]
            rows_ = np.where(sub[:, c0:c1 + 1].sum(1) >= 1)[0]
            mid = sy0 + (rows_.min() + rows_.max()) / 2
            # the leader line's row: the fullest row near the word's middle, just past it on the dial's side
            r0 = int(round(mid)) - 3
            if side == "L":
                probe = pp[r0:r0 + 7, sx0 + c1 + 2:sx0 + c1 + 30] > 0.22
            else:
                probe = pp[r0:r0 + 7, sx0 + c0 - 30:sx0 + c0 - 1] > 0.22
            ly = r0 + int(np.argmax(probe.sum(1))) if probe.sum() >= 2 else None
            # a letter's edge with less ink (the apostrophe, a T's bar): columns next to the run with ink off the line's row
            off = sub.copy()
            if ly is not None:
                off[max(0, ly - 1 - sy0):ly + 2 - sy0] = False
            while c0 > 0 and off[:, c0 - 1].any():
                c0 -= 1
            while c1 < sub.shape[1] - 1 and off[:, c1 + 1].any():
                c1 += 1
            rows_ = np.where(sub[:, c0:c1 + 1].sum(1) >= 1)[0]
            pbx = (sx0 + c0 - 0.5, sy0 + rows_.min() - 0.5, sx0 + c1 + 0.5, sy0 + rows_.max() + 0.5)
            out.append((cl, (bx0, by0, bx1, by1), pbx, sup, side))
            if ly is None:
                continue
            row = pp[ly - 1:ly + 2].max(0) > 0.22
            step = 1 if side == "L" else -1
            x = int(pbx[2] + 1) if side == "L" else int(pbx[0] - 1)
            for _ in range(3):                     # past what is left of the last letter on that row
                if row[x]:
                    x += step
            while not row[x] and abs(x - (pbx[2] if side == "L" else pbx[0])) < 14:
                x += step
            start, gap, end = x, 0, x
            while gap <= 3 and 1060 < x < 1275:
                if row[x]:
                    end, gap = x, 0
                else:
                    gap += 1
                x += step
            if abs(end - start) >= 1:
                yy = ly - 1 + float(np.argmax(pp[ly - 1:ly + 2, (start + end) // 2]))
                lines.append((min(start, end) - 0.5, max(start, end) + 0.5, yy))
    return out, lines


def panel(ink, C, pp):
    th = TH
    img = np.zeros((th, TW, 3), np.float32)
    xs = np.arange(TW)
    left = xs < cx_(SEAM)
    g = np.linspace(1.04, 0.97, th)[:, None]
    img[:, left] = (C["drawer"][None, None, :] * g[..., None])[:, :1, :].repeat(left.sum(), 1)
    img[:, ~left] = (C["panel"][None, None, :] * np.linspace(1.03, 0.98, th)[:, None, None])[:, :1, :].repeat((~left).sum(), 1)
    img += rng.normal(0, 0 if HI else 0.6, (th, TW, 1))
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

    def put(w, box_mm, colour, fit="width"):
        """drawing ink crop w scaled uniformly into the mm box (by its width, centred on the box's middle row)"""
        ys, xs_ = np.where(w > 0.35)
        w = w[ys.min():ys.max() + 1, xs_.min():xs_.max() + 1]
        x0, y0, x1, y1 = tbox(box_mm)
        k = (x1 - x0) / w.shape[1] if fit == "width" else (y1 - y0) / w.shape[0]
        nw, nh = max(1, round(w.shape[1] * k)), max(1, round(w.shape[0] * k))
        m = cv2.resize(cv2.GaussianBlur(w, (0, 0), 0.25 / k), (nw, nh), interpolation=cv2.INTER_AREA)
        X = round(x0) if fit == "width" else round((x0 + x1) / 2 - nw / 2)
        blend(canvas, m, X, round((y0 + y1) / 2 - nh / 2), colour)

    # the groove between the drawer and the controls
    shape(canvas, lambda d, s: d.rectangle([(cx_(SEAM) - 0.5 * PX) * s, 0, (cx_(SEAM) + 0.5 * PX) * s, th * s], fill=255), (6, 7, 9))

    # SAMSUNG, from the logo file, in the photo's box
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    al = np.asarray(lg.getchannel("A")).astype(np.float32) / 255
    ys, xs_ = np.where(al > 0.1)
    al = al[ys.min():ys.max() + 1, xs_.min():xs_.max() + 1]
    x0, y0, x1, y1 = tbox(LOGO)
    blend(canvas, cv2.resize(al, (round(x1 - x0), round(y1 - y0)), interpolation=cv2.INTER_AREA), round(x0), round(y0), INK)

    # the programme names, each fitted to its photo box, and their leader lines where the photo has them
    words, lines = name_layout(ink, pp)
    for cl, (bx0, by0, bx1, by1), pb, sup, side in words:
        ids = {(c[0], c[1]) for c in cl}
        w = comps(ink, (bx0 - 2, by0 - 2, bx1 + 2, by1 + 2), lambda x, y, w_, h_, a_: (x, y) in ids)[by0:by1, bx0:bx1]
        put(w, pbox(*pb), INK)
        if sup:                                    # the small raised "+" after DRUM CLEAN, right after the word, its top at the caps' top
            px0, py0, px1, py1 = pb
            s = (sup[2] - sup[0]) * 0.55 * A_DIAL[0, 0]
            put(ink[sup[1]:sup[3], sup[0]:sup[2]], pbox(px1 + 0.6, py0 - 0.2, px1 + 0.6 + s, py0 - 0.2 + s), INK)
    for lx0, lx1, ly in lines:
        line(canvas, [(PXmm(lx0), PHmm(ly)), (PXmm(lx1), PHmm(ly))], 0.42, INK)

    # ── the touch glass: a thin light edge round the black glass, the time window, then the drawing's print ──
    gx0, gy0, gx1, gy1 = tbox(pbox(*GLASS_PX))
    shape(canvas, lambda d, s: d.rounded_rectangle([gx0 * s, gy0 * s, gx1 * s, gy1 * s], radius=2.0 * PX * s, fill=255), (60, 62, 66))
    shape(canvas, lambda d, s: d.rounded_rectangle([(gx0 + 0.3 * PX) * s, (gy0 + 0.3 * PX) * s, (gx1 - 0.3 * PX) * s, (gy1 - 0.3 * PX) * s], radius=1.7 * PX * s, fill=255), GLASS)
    A = d2t(A_DISP)
    (lx0, ly0), (lx1, ly1) = apply(A, 2908, 402), apply(A, 3800, 1000)
    shape(canvas, lambda d, s: d.rounded_rectangle([lx0 * s, ly0 * s, lx1 * s, ly1 * s], radius=1.2 * PX * s, fill=255), LCDC)
    # the time: 1:27 lit (the photos), the rest of 18:88 faint
    T = (3220, 560, 3800, 820)
    segs = [c for c in comp_list(ink, T) if c[4] > 150]
    colon = [c for c in segs if c[2] < 60 and c[3] < 60]
    bars = [c for c in segs if c not in colon]
    groups = []                                                  # the digits: bars whose spans overlap
    for c in sorted(bars, key=lambda c: c[0]):
        if groups and c[0] <= groups[-1][1] + 6:
            groups[-1][1] = max(groups[-1][1], c[0] + c[2])
        else:
            groups.append([c[0], c[0] + c[2]])
    digit = lambda cxm: [k for k, (g0, g1) in enumerate(groups) if g0 - 1 <= cxm <= g1 + 1][0]     # 0..3
    def seg(c):
        d = digit(c[5])
        dx = [cc for cc in bars if digit(cc[5]) == d]
        xm = (min(cc[0] for cc in dx) + max(cc[0] + cc[2] for cc in dx)) / 2
        ym = (min(cc[1] for cc in dx) + max(cc[1] + cc[3] for cc in dx)) / 2
        if c[2] > c[3]:
            s = "a" if c[6] < ym - 40 else "d" if c[6] > ym + 40 else "g"
        else:
            s = ("f" if c[5] < xm else "b") if c[6] < ym else ("e" if c[5] < xm else "c")
        return d, s
    LITSEG = {(1, "b"), (1, "c"), (2, "a"), (2, "b"), (2, "g"), (2, "e"), (2, "d"), (3, "a"), (3, "b"), (3, "c")}
    lit = [c for c in bars if seg(c) in LITSEG] + colon
    for cl, colour in ((lit, LIT), ([c for c in bars if seg(c) not in LITSEG], GHOST)):
        ids = {(c[0], c[1]) for c in cl}
        blend(canvas, to_tex(comps(ink, T, lambda x, y, w, h, a: (x, y) in ids), A_DISP), 0, 0, colour)
    # the stages over the time (rinse, wash, spin lit; the first dim), the Wi-Fi and eco symbols and the four under it: dim
    ST = (3080, 400, 3800, 560)
    blend(canvas, to_tex(comps(ink, ST, lambda x, y, w, h, a: x > 3270 and a > 20), A_DISP), 0, 0, LIT)
    blend(canvas, to_tex(comps(ink, ST, lambda x, y, w, h, a: x <= 3270 and a > 20), A_DISP), 0, 0, DIM)
    blend(canvas, to_tex(comps(ink, (2920, 560, 3220, 1000), lambda x, y, w, h, a: a > 20), A_DISP), 0, 0, DIM)
    blend(canvas, to_tex(comps(ink, (2920, 820, 3800, 1000), lambda x, y, w, h, a: a > 20 and y > 820), A_DISP), 0, 0, DIM)
    # the temperature and spin columns: 40 and 1400 lit, the rest dim; their rules dim
    lit40 = lambda x, y, w, h: 4020 < x and x + w < 4130 and 630 < y and y + h < 740
    lit1400 = lambda x, y, w, h: 4370 < x and x + w < 4560 and 530 < y and y + h < 640
    COL = (3840, 480, 4600, 1010)
    is_rule = lambda w, h: w > 4 * h and h < 20
    blend(canvas, to_tex(comps(ink, COL, lambda x, y, w, h, a: (lit40(x, y, w, h) or lit1400(x, y, w, h)) and not is_rule(w, h)), A_DISP), 0, 0, LIT)
    blend(canvas, to_tex(comps(ink, COL, lambda x, y, w, h, a: not (lit40(x, y, w, h) or lit1400(x, y, w, h)) and not is_rule(w, h) and a > 10), A_DISP), 0, 0, DIM)
    blend(canvas, to_tex(comps(ink, (2950, 360, 4600, 1060), lambda x, y, w, h, a: is_rule(w, h) and w > 200), A_DISP), 0, 0, LINEC)
    # the keys' symbols (Delay End, Temp., Spin; the six options; Power, Start/Pause) light; the option lamps' dashes and the
    # rule before Power dim
    blend(canvas, to_tex(comps(ink, (3300, 1080, 4500, 1300), lambda x, y, w, h, a: a > 20), A_DISP), 0, 0, KEYINK)
    dash = lambda w, h: w > 2 * h and h < 25 and w < 80
    OPT = (4640, 330, 5600, 1290)
    blend(canvas, to_tex(comps(ink, OPT, lambda x, y, w, h, a: dash(w, h)), A_DISP), 0, 0, LINEC)
    # the rule between the options and Power / Start: one line in the photo, the drawing's broken by the callout discs over it
    rule = np.zeros_like(ink)
    rule[380:1271, 5262:5269] = 1
    blend(canvas, to_tex(rule, A_DISP), 0, 0, LINEC)
    blend(canvas, to_tex(comps(ink, OPT, lambda x, y, w, h, a: not dash(w, h) and not (h > 5 * w and h > 300) and a > 20), A_DISP), 0, 0, KEYINK)

    # under the glass: the Child Lock and Sound symbols with their brackets (the drawing's, mapped), Hold to Start in the photo's box
    blend(canvas, to_tex(comps(ink, (3950, 1380, 4900, 1560), lambda x, y, w, h, a: a > 10), A_DISP), 0, 0, INK)
    hb = photo_box(pp, (1505, 157, 1565, 172))
    put(comps(ink, (5240, 1400, 5600, 1520), lambda x, y, w, h, a: a > 10)[1400:1520, 5240:5600], pbox(*hb), INK)
    # "*(3 sec)" over the glass's top right, in the photo's box: the drawing's "*" and "3 sec" with the photo's brackets
    sb = photo_box(pp, (1505, 42, 1560, 56.5))
    txt_mm = pbox(*sb)
    m = text_ink("*(3 sec)", round((txt_mm[3] - txt_mm[1]) * PX * 4))
    put(m, txt_mm, INK)
    # the tactile dots beside Power and Start/Pause (the photo's, each a dot 0.9 mm across)
    for dx, dy in tactile_dots(pp):
        x, h = PXmm(dx), PHmm(dy)
        shape(canvas, lambda d, s, x=x, h=h: d.ellipse([(cx_(x) - 0.45 * PX) * s, (ry_(h) - 0.45 * PX) * s, (cx_(x) + 0.45 * PX) * s, (ry_(h) + 0.45 * PX) * s], fill=255), DIM)
    return Image.fromarray(canvas.clip(0, 255).astype(np.uint8))


def photo_box(pp, win):
    """the ink box of the print inside a photo window (photo px)"""
    x0, y0, x1, y1 = (int(round(v)) for v in win)
    sub = pp[y0:y1, x0:x1] > 0.28
    ys, xs = np.where(sub)
    return (x0 + xs.min() - 0.5, y0 + ys.min() - 0.5, x0 + xs.max() + 0.5, y0 + ys.max() + 0.5)


def text_ink(s, px):
    f = ImageFont.truetype("/System/Library/Fonts/Avenir Next Condensed.ttc", px, index=5)
    w, h = f.getbbox(s)[2] + 20, px * 2
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).text((10, px // 4), s, font=f, fill=255)
    return np.asarray(im).astype(np.float32) / 255


def tactile_dots(pp):
    """the raised dots right of the glass beside Power and Start/Pause: their centres in the photo (px)"""
    sub = (pp[60:150, 1549:1566] > 0.25).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(sub)
    return [(1549 + cen[i][0], 60 + cen[i][1]) for i in range(1, n) if 1 <= st[i][4] <= 12]


def flat(colour, size, grad=(1.0, 1.0)):
    w, h = size
    a = np.ones((h, w, 3), np.float32) * colour * np.linspace(grad[0], grad[1], h)[:, None, None]
    a += rng.normal(0, 0.8, (h, w, 1))
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def side(C, suf, body):
    """The left side's three nested pressed panels, from Samsung's side photo (front at the left). The side wall runs from column
    614.5 (its front edge) to 1346.5 (the back panel's plane) and from row 77 (under the worktop) to row 1221 (h 26 mm); the
    WW90FG's crop (tex_samsung_ww90fg.py) moved by the cabinet's place in this photo, the same pressed panels. The studio light (a quadratic in log luminance) is divided out, the relief's own light and shade kept at
    half strength, in the body colour. The right side is its mirror (Samsung shows only the left)."""
    a = photo("side", (40, 40, 42), C["photo"])
    crop = Image.fromarray(a.astype(np.uint8)).resize((576, 900), Image.LANCZOS, box=(614.5, 77, 1346.5, 1221))
    lum = np.asarray(crop.convert("L")).astype(np.float32)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w]
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    c, *_ = np.linalg.lstsq(A, np.log(np.maximum(lum, 1)).reshape(-1), rcond=None)
    n = lum / np.exp(A @ c).reshape(h, w)
    n = 1 + (n / np.median(n) - 1) * 0.5
    tint = np.clip(np.clip(n, 0.3, 2.2)[..., None] * (body * 0.8), 0, 255).astype(np.uint8)
    # u runs from the front edge (0) to the back (1) on the left side; the builder mirrors it onto the right side
    save(Image.fromarray(tint), f"side_l{suf}.jpg", 86)


# ── the back: Samsung's rear photo, square on (g543246822; the Navy one, g543189789, lands on it to the pixel; the Inox one,
# g543189816, is framed smaller and is mapped onto it by the cabinet's edges: x' = 522 + (x - 541) * 1.0455,
# y' = 22 + (y - 43) * 1.0385). The cabinet spans columns 522-1396 (600 mm), the floor is row 1257: 1.4532 px per mm. This back
# is the WW90FG's (tex_samsung_ww90fg.py): the same moulding, tub cover, hose and cord runs; its traced centre lines were checked
# on this photo (--debug draws them) and moved where this photo differs. Seen from behind: photo right = the machine's left. ──
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
    rgb = photo("rear", (0, 0, 0), sub).astype(np.uint8)
    if sub == "inox":
        M = np.float32([[1.0455, 0, 522 - 541 * 1.0455], [0, 1.0385, 22 - 43 * 1.0385]])
        rgb = cv2.warpAffine(rgb, M, (rgb.shape[1], rgb.shape[0]), flags=cv2.INTER_LANCZOS4)
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
    """The Swirl drum's wall (Samsung's spec list: drum type "Swirl"), as Samsung's drum photo of this model (g543246825) shows it:
    staggered rows of small raised bosses, each lit on its upper side and shaded below, with a hole in its middle, on plain
    brushed steel. A 300 x 150 mm tile; the spacing (about 19 mm across, 16 mm between rows) is read off the photo, ESTIMATED."""
    w, h = 1024, 512
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    img = np.ones((h, w, 3), np.float32) * np.array([170, 174, 179], np.float32)
    img += rng.normal(0, 3, (h, 1, 1)).repeat(w, 1) * 0.6          # the brushing runs round the drum
    cw, rh = 64, 56                                                # px: 3.413 px per mm
    for row in range(-1, h // rh + 2):
        cy = row * rh + rh / 2
        off = (row % 2) * cw / 2
        for i in range(-1, w // cw + 2):
            cx = i * cw + off + cw / 2
            x0, x1, y0, y1 = int(cx - 26), int(cx + 26), int(cy - 18), int(cy + 18)
            xa, xb, ya, yb = max(0, x0), min(w, x1), max(0, y0), min(h, y1)
            if xb <= xa or yb <= ya:
                continue
            dx, dy = (xx[ya:yb, xa:xb] - cx) / 22, (yy[ya:yb, xa:xb] - cy) / 15
            r = np.sqrt(dx * dx + dy * dy)
            m = np.clip(1 - r, 0, 1) ** 0.7
            shade = 1 + 0.38 * (-dy) * m - 0.05 * m                  # lit from above
            img[ya:yb, xa:xb] *= shade[..., None]
            hole = np.clip((0.2 - r) * 25, 0, 1)
            img[ya:yb, xa:xb] = img[ya:yb, xa:xb] * (1 - hole[..., None]) + np.array([40, 42, 46], np.float32) * hole[..., None]
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "drum.jpg", 86)


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
def decal_boxes():
    lx0, lh0, lx1, lh1 = LOGO
    gx0, gh0, gx1, gh1 = pbox(*GLASS_PX)
    return {
        "logo": ((lx0 - 1.5, lh0 - 1.5, lx1 + 1.5, lh1 + 1.5), "drawer"),
        # the programme names and their leader lines, round the dial (clear of the dial's ring, which is built in 3D)
        "dial": ((PXmm(1056), PHmm(160), PXmm(1282), PHmm(48)), "fascia"),
        # the display glass, 0.3 mm in from its edges
        "display": ((gx0 + 0.3, gh0 + 0.3, gx1 - 0.3, gh1 - 0.3), "glass"),
        # under the glass: the Child Lock and Sound symbols, Hold to Start; over it: *(3 sec); right of it: the tactile dots
        "hints": ((gx0 - 0.5, PHmm(174), gx1 + 0.5, PHmm(155.6)), "fascia"),
        "sec": ((PXmm(1500), PHmm(57.2), PXmm(1564), PHmm(40)), "fascia"),
        "dots": ((PXmm(1548.6), PHmm(150), PXmm(1567), PHmm(60)), "fascia"),
    }


def cut_decals(ink):
    out = {}
    pp = photo_print()
    for suf, C in COLOURS.items():
        img = (np.asarray(panel(ink, C, pp).convert("RGB")).astype(np.float32) * SHADE["panel"]).clip(0, 255).astype(np.uint8)
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
    pp = photo_print()
    for suf, C in COLOURS.items():
        save(panel(ink, C, pp), f"panel{suf}.jpg", 84)     # under the sharp print decals: q84 keeps the GLB in its budget
    for suf, body, sub in (("", COLOURS[""]["body"], "black"), ("_as", COLOURS["_as"]["body"], "navy"), ("_ax", BODY_AX, "inox")):
        save(flat(body, (256, 512), (1.04, 0.94)), f"front{suf}.jpg", 86)
        side({"photo": sub}, suf, body)
        rear(sub, suf)
    rear_paths()
    drum()
    tray()
    X = lambda x: round(x / 1000, 5)
    Hm = lambda h: round(h / 1000, 5)
    bx = lambda b: {"x0": X(b[0]), "x1": X(b[2]), "y0": Hm(b[1]), "y1": Hm(b[3])}
    lay = {
        "seam": X(SEAM), "glass": bx(pbox(*GLASS_PX)), "pocket": bx(POCKET), "keys": [],
        "dial": {"x": X(DIAL[0]), "y": Hm(DIAL[1]), "r": round(DIAL[2] / 1000, 5)},
        "lamp": {"x": X(PXmm(LAMP_PX[0])), "y": Hm(PHmm(LAMP_PX[1]))},
        "band": {"y0": H0 / 1000, "y1": H1 / 1000},
    }
    json.dump(lay, open(os.path.join(D, "layout.json"), "w"), indent=1)
    print(json.dumps(lay))
    if DEBUG:
        # the band over the photo's, side by side, for checking the print
        a = photo("open")[0:240, 700:1630]
        b = np.asarray(Image.open(os.path.join(D, "panel.jpg")).convert("RGB").resize(
            (round(600 * FPX), round((H1 - H0) * FPY)), Image.LANCZOS)).astype(np.float32)
        y0 = round(FY0 - H1 * FPY)
        x0 = round(FX0 - 300 * FPX) - 700
        c = a.copy()
        c[y0:y0 + b.shape[0], x0:x0 + b.shape[1]] = b[:c.shape[0] - y0, :c.shape[1] - x0]
        Image.fromarray(np.vstack([a, c]).clip(0, 255).astype(np.uint8)).resize((1860, 960), Image.LANCZOS).save(os.path.join(DEBUG, "band_cmp.png"))


def page_photos(dst):
    """The page's four photos, Samsung's own of this model, on white: the whole machine centred with the same margin as the
    other products' (804 px tall in 900), or a square crop of the control panel."""
    os.makedirs(dst, exist_ok=True)

    def on_white(name):
        im = Image.open(os.path.join(P, "black", name)).convert("RGBA")
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

    whole(VIEWS["black"]["q34"], "0.jpg")
    whole(VIEWS["black"]["front"], "1.jpg")
    whole(VIEWS["black"]["open"], "2.jpg")
    rgb, _ = on_white(VIEWS["black"]["close"])
    rgb.crop((420, 40, 1600, 1220)).resize((900, 900), Image.LANCZOS).save(os.path.join(dst, "3.jpg"), quality=88, optimize=True)
    print("wrote", os.path.join(dst, "3.jpg"))


if PAGE:
    page_photos(PAGE)
else:
    main()
