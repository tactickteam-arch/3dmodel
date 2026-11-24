"""Textures for the IFB TL900NB2SID, 9 kg DeepClean top-load washer, Noir Black (pipeline/build3d/make_ifb_tl900.mjs).

usage: python3 tex_ifb_tl900.py <repo pipeline dir> [--compare]
  reads  sources/ifb-tl900-panel/manual_p08_panel.png  IFB's own panel drawing for the TL900 RB/NB 2SID (user manual
                                                     TL421PKMAN360 B, printed page 08), rendered at 900 dpi
         sources/ifb-tl900-panel/manual_p10_panel.png  the same panel on printed page 11 (its 2SWID twin; used only for
         sources/ifb-tl900-panel/manual_p11_panel.png  printed page 12            areas the two models share, see PATCHES)
         sources/photos/ifb_tl900/top.jpg               IFB's straight-down photo of this model (the panel's left block)
         sources/photos/ifb_tl900/side_r.jpg            IFB's side photo (the body's sparkle and colour)
         sources/photos/ifb_exec1014/ifb_logo_big.png   IFB's own logo file (ifbappliances.com icons/ifb-logo.svg)
  writes tex/ifb_tl900/: print_l.jpg, print_c.jpg, print_r.jpg + decals.json (the panel print at 12.3 px/mm, in panel mm),
         knob_top.jpg, sparkle.jpg, drum.jpg, filter.jpg, detergent.jpg, glass_print.png, layout.json

Every word and icon on the panel is IFB's own drawing (vector, rendered at 900 dpi = 12.34 px per mm of panel), except the
left block (logo, 9.0KG, the Ai / Power Steam / Eco Inverter line), which the drawing leaves out: it is set again from
IFB's straight-down photo of this model at its measured place, size and colour (private/research/ifb_tl900/NOTES.md).
"""
import json, os, sys
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

PIPE = os.path.abspath(sys.argv[1])
SRC = os.path.join(PIPE, "sources")
OUT = os.path.join(PIPE, "tex", "ifb_tl900")
os.makedirs(OUT, exist_ok=True)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"

# ── the panel's own coordinates (metres in the builder, mm here): x across from the centre line, s up the 21 degree slope
# from the top cover's front-top edge. The drawing (crop px, 40 px pad round its black band) maps onto them as measured on
# IFB's straight-down photo (top.jpg, 2.075 px/mm across; four features: the '9' LED, Power, Start/Pause, 'Water'):
#   photo x = 0.16819 * cx + 869.48, photo y = 0.13874 * cy + 1072.48   ->   x mm = 0.081057 cx - 110.85,
#   s = 5 + (1290 - cy) / 12.337 (the black glass ends at photo row 1252 = drawing row 1290, 5 mm above the front edge)
PPM = 12.337                                   # drawing px per mm of panel
def x_mm(cx): return 0.081057 * cx - 110.85
def s_mm(cy): return 5 + (1290 - cy) / PPM
def photo_to_mm(X, Y):                         # top.jpg px -> panel mm
    return (X - 1099.5) / 2.075, s_mm((Y - 1072.48) / 0.13874)

BASE = np.array([22, 22, 24], np.float32)      # the panel glass's black (its material colour in the builder)
INK_WHITE = (238, 238, 240)


def save(img, name, q=88):
    p = os.path.join(OUT, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", name, img.size)


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32)


# ── 1. the panel drawing: IFB's 2SID page, with its callout lines taken out ──
# Printed page 08 is the only drawing of this model's own panel (Delay key, "Bulky / Jeans"); it carries light-blue callout
# lines and discs. Under them sit the display, Power, Start/Pause and the Rinse key's "*Pre Clean", which printed pages 11
# and 12 draw identically on the 2SWID twin with no callouts there: those rectangles are copied from them (PATCHES, in
# drawing px). The knob's chrome ring is left out of the print: the builder makes the ring and the knob in 3D.
P08 = load_rgb(os.path.join(SRC, "ifb-tl900-panel", "manual_p08_panel.png"))
P10 = load_rgb(os.path.join(SRC, "ifb-tl900-panel", "manual_p10_panel.png"))
P11 = load_rgb(os.path.join(SRC, "ifb-tl900-panel", "manual_p11_panel.png"))
H, W = P08.shape[:2]


def align(src, ref):
    """shift src onto ref (phase correlation on the grey images; the pages are the same artwork, offset by whole pixels)"""
    a, b = ref.mean(2), src.mean(2)
    (dx, dy), _ = cv2.phaseCorrelate(a.astype(np.float64), b.astype(np.float64))
    M = np.float32([[1, 0, -dx], [0, 1, -dy]])
    return cv2.warpAffine(src, M, (ref.shape[1], ref.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE), (dx, dy)


P10a, d10 = align(P10, P08)
P11a, d11 = align(P11, P08)
print("page offsets (px):", np.round(d10, 2), np.round(d11, 2))

KNOB = (1371, 666)                              # the knob ring's centre in drawing px (row 680 spans 993-1749: outer radius 378 px = 30.6 mm)
PATCHES = [                                     # (x0, y0, x1, y1) drawing px, source page
    ((2440, 160, 2960, 460), P11a),             # the display ("8:A1") and its window
    ((3700, 140, 4110, 520), P11a),             # Power
    ((3700, 760, 4110, 1150), P11a),            # Start/Pause
    ((2330, 1130, 2560, 1262), P10a),           # Rinse's "*Pre Clean"
]


def panel_drawing():
    d = P08.copy()
    cyan = (d[..., 2] - d[..., 0] > 40) & (d[..., 2] > 150)
    cyan = cv2.dilate(cyan.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    black = np.median(d[(d.sum(2) < 90)], axis=0)
    d[cyan] = black
    for (x0, y0, x1, y1), src in PATCHES:
        d[y0:y1, x0:x1] = src[y0:y1, x0:x1]
    # the page's white round the drawing's black band (connected to the crop's edge) is not print: black too
    page = (d.mean(2) > 150).astype(np.uint8)
    n, lab = cv2.connectedComponents(page, connectivity=8)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    pm = cv2.dilate(np.isin(lab, list(edge)).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    d[pm] = black
    # leftover callout pixels must be gone (checked: none in the patched print)
    left = (d[..., 2] - d[..., 0] > 40) & (d[..., 2] > 150)
    assert left.sum() < 50, f"callout pixels left: {left.sum()}"
    # the knob's ring: drawn in 3D, so black here out to just past its outer edge
    yy, xx = np.mgrid[0:H, 0:W]
    d[(xx - KNOB[0]) ** 2 + (yy - KNOB[1]) ** 2 < 386 ** 2] = black
    # the drawing's black becomes the panel glass's black; ink keeps its colour (screen-style remap, so edges stay smooth)
    out = 255 - (255 - d) * (255 - BASE) / (255 - black)
    return np.clip(out, 0, 255), black


# ── 2. the left block, set again from IFB's straight-down photo (the drawing leaves it out) ──
# boxes in panel mm (x across, s up the slope), measured on top.jpg's ink (90th-percentile colours):
LOGO = (-239.8, 61.9, -211.8, 72.5)            # IFB logo, chrome grey
KG = (-208.4, 61.4, -193.5, 66.6)              # "9.0KG", (219, 219, 218)
AI = (-239.8, 42.7, -231.6, 50.8)              # [Ai] badge, light blue (148, 210, 239)
PS_ICON = (-230.6, 42.7, -222.4, 50.8)         # Power Steam badge, red (230, 56, 84)
POWER_STEAM = (-221.0, 42.1, -183.4, 47.9)     # "POWER STEAM", red
REG = (-182.9, 44.4, -180.5, 46.8)             # "®"
BAR = (-177.1, 42.1, -175.7, 46.8)             # "|"
ECO = (-172.3, 41.5, -136.1, 46.8)             # "ECO INVERTER", (216, 216, 216)
RED = (230, 56, 84)


def text_mask(s, px, path, index=0):
    f = ImageFont.truetype(path, px, index=index)
    w = int(f.getlength(s) + px)
    im = Image.new("L", (w, int(px * 1.6)), 0)
    ImageDraw.Draw(im).text((px * 0.25, px * 0.15), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.5)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def place(can, org, box, m, colour, keep="fit"):
    """lay mask m into the panel-mm box on canvas can (org = canvas origin in mm: x0, s_top; PPM px per mm)"""
    x0, s0, x1, s1 = box
    X0, X1 = (x0 - org[0]) * PPM, (x1 - org[0]) * PPM
    Y0, Y1 = (org[1] - s1) * PPM, (org[1] - s0) * PPM
    bw, bh = X1 - X0, Y1 - Y0
    h, w = m.shape
    if keep == "h":                            # the box's height sets the size; the word keeps its own width (centred)
        sc = bh / h; tw, th = w * sc, bh
        X0 += (bw - tw) / 2 if tw < bw else 0
        if tw > bw:                            # never wider than the box: squeeze to it (checked: under 4 % for each word)
            tw = bw
    else:
        tw, th = bw, bh
    mm = cv2.resize(m, (max(1, round(tw)), max(1, round(th))), interpolation=cv2.INTER_AREA)
    xi, yi = round(X0), round(Y0)
    sub = can[yi:yi + mm.shape[0], xi:xi + mm.shape[1]]
    a = mm[:sub.shape[0], :sub.shape[1], None]
    sub[:] = sub * (1 - a) + np.array(colour, np.float32) * a


def ai_badge(px):
    """[Ai] (IFB's mark, as traced on the Executive Plus panel, tex_ifb_exec1014.py): light-blue rounded square, a thin dark
    frame open at its top right, a geometric A and an i. Drawn at px per side."""
    S = px * 8
    im = Image.new("RGB", (S, S), tuple(int(v) for v in BASE))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.16, fill=(148, 210, 239))
    ink = (34, 72, 112)
    u = S / 10
    w = max(2, int(u * 0.55))
    d.line([(7.6 * u, 2 * u), (2 * u, 2 * u), (2 * u, 8 * u), (8 * u, 8 * u), (8 * u, 7.4 * u)], fill=ink, width=w, joint="curve")
    d.line([(3.2 * u, 7.0 * u), (4.5 * u, 3.3 * u), (5.0 * u, 3.3 * u), (6.3 * u, 7.0 * u)], fill=ink, width=int(w * 1.6))
    d.line([(3.8 * u, 5.7 * u), (5.7 * u, 5.7 * u)], fill=ink, width=int(w * 1.3))
    d.rectangle([7.0 * u, 4.4 * u, 7.6 * u, 7.0 * u], fill=ink)
    d.rectangle([7.0 * u, 3.2 * u, 7.6 * u, 3.8 * u], fill=ink)
    return np.asarray(im.resize((px, px), Image.LANCZOS)).astype(np.float32)


def steam_badge(px):
    """Power Steam badge: a red rounded square with IFB's white house-and-steam mark (the same mark as on the Executive Plus
    panel, tex_ifb_exec1014.py power_steam_icon; on this model's photo it is only 8 mm wide, too soft to trace again)."""
    S = 400
    im = Image.new("RGB", (S, S), tuple(int(v) for v in BASE))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=64, fill=RED)
    m = Image.new("L", (200, 200), 0)
    dm = ImageDraw.Draw(m)
    dm.line([(40, 100), (100, 45), (160, 100)], fill=255, width=20)
    dm.line([(60, 85), (60, 160), (140, 160), (140, 85)], fill=255, width=18)
    for x in (82, 100, 118):
        dm.line([(x, 140), (x, 105)], fill=255, width=9)
    m = m.resize((300, 300), Image.LANCZOS)
    im.paste((255, 255, 255), (50, 40), m)
    return np.asarray(im.resize((px, px), Image.LANCZOS)).astype(np.float32)


def left_block():
    org = (-245.0, 78.0)                       # canvas: x -245..-128 mm, s 78..36 mm
    w, h = round(117 * PPM), round(42 * PPM)
    can = np.ones((h, w, 3), np.float32) * BASE
    logo = np.asarray(Image.open(os.path.join(SRC, "photos", "ifb_exec1014", "ifb_logo_big.png")).convert("RGBA"))[..., 3]
    logo = logo.astype(np.float32) / 255
    ys, xs = np.where(logo > 0.3)
    logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    # chrome: light at the top, darker below (the photo's logo reads 255 at its top edge, about 150 at its foot)
    x0, s0, x1, s1 = LOGO
    X0, Y0 = round((x0 - org[0]) * PPM), round((org[1] - s1) * PPM)
    lw, lh = round((x1 - x0) * PPM), round((s1 - s0) * PPM)
    lm = cv2.resize(logo, (lw, lh), interpolation=cv2.INTER_AREA)
    grad = np.linspace(242, 160, lh)[:, None, None] * np.ones((1, lw, 3))
    sub = can[Y0:Y0 + lh, X0:X0 + lw]
    sub[:] = sub * (1 - lm[..., None]) + grad * lm[..., None]
    place(can, org, KG, text_mask("9.0KG", 200, AVENIR, 5), (219, 219, 218), keep="h")
    for box, img in ((AI, ai_badge), (PS_ICON, steam_badge)):
        x0, s0, x1, s1 = box
        px = round((x1 - x0) * PPM)
        b = img(px)
        X0, Y0 = round((x0 - org[0]) * PPM), round((org[1] - s1) * PPM)
        can[Y0:Y0 + px, X0:X0 + px] = b[:, :, :3]
    place(can, org, POWER_STEAM, text_mask("POWER STEAM", 200, AVENIR, 5), RED, keep="h")
    place(can, org, REG, text_mask("®", 200, ARIAL), RED)
    place(can, org, BAR, text_mask("|", 200, AVENIR, 7), (216, 216, 216))
    place(can, org, ECO, text_mask("ECO INVERTER", 200, AVENIR, 5), (216, 216, 216), keep="h")
    return np.clip(can, 0, 255), org


# ── 3. the print decals: crop each to its ink, as flat planes 0.9 mm over the glass (decals.json in panel mm) ──
def crop_ink(img, pad=24):
    ink = np.abs(img - BASE).max(2) > 12
    ys, xs = np.where(ink)
    return max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad + 1), max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad + 1)


def prints():
    dec = {}
    d, black = panel_drawing()
    y0, y1, x0, x1 = crop_ink(d)
    # split at a column of plain glass right of the knob (the drawing is 4100 px wide; a texture stays under 4096)
    clean = [c for c in range(1500, 2600) if np.abs(d[y0:y1, c - 4:c + 4] - BASE).max() < 13]
    assert clean, "no column of plain glass to split the print at"
    cut = min(clean, key=lambda c: abs(c - (x0 + x1) / 2))
    for name, a, b in (("print_c", x0, cut), ("print_r", cut, x1)):
        tile = d[y0:y1, a:b]
        save(Image.fromarray(tile.astype(np.uint8)), name + ".jpg")
        dec[name] = {"file": name + ".jpg", "x": [round(x_mm(a), 3), round(x_mm(b), 3)], "s": [round(s_mm(y1), 3), round(s_mm(y0), 3)]}
    lb, org = left_block()
    y0, y1, x0, x1 = crop_ink(lb)
    save(Image.fromarray(lb[y0:y1, x0:x1].astype(np.uint8)), "print_l.jpg")
    dec["print_l"] = {"file": "print_l.jpg", "x": [round(org[0] + x0 / PPM, 3), round(org[0] + x1 / PPM, 3)],
                      "s": [round(org[1] - y1 / PPM, 3), round(org[1] - y0 / PPM, 3)]}
    json.dump(dec, open(os.path.join(OUT, "decals.json"), "w"), indent=1)
    return dec, black


# ── 4. generated surfaces ──
def knob_top():
    # the dial's conical brushed top (IFB's photos: concentric brushing, bright and dark wedges, a small centre point)
    n = 512
    yy, xx = np.mgrid[0:n, 0:n] - (n - 1) / 2
    ang = np.arctan2(yy, xx)
    r = np.hypot(xx, yy) / (n / 2)
    rng = np.random.default_rng(900)
    rings = np.interp(r, np.linspace(0, 1.5, 900), rng.normal(0, 1, 900)) * 6
    sect = 0.5 + 0.5 * np.cos(2 * ang + 0.9)
    v = 95 + 140 * sect + rings
    v = v * (0.9 + 0.1 * r)
    v[r > 0.985] = 120
    im = np.repeat(np.clip(v, 0, 255)[..., None], 3, 2).astype(np.uint8)
    save(Image.fromarray(im), "knob_top.jpg", 88)


def sparkle():
    """Noir Black: a dark grey paint with fine bright flecks. IFB's side photo (1.28 px/mm) reads the body at 66-67 of 255
    (neutral, R/G 0.99, B/G 1.00) with single-pixel flecks about 16 above it, 1.1 per 100 px; the 3/4 and front photos read
    52 and 51. The flecks are smaller than the photo's pixel, so their size and count are ESTIMATED: 0.3-0.6 mm, 4 per cm2,
    bright enough to average to the photo's lift. A 128 mm tile at 4 px/mm, wrapping."""
    n = 512
    rng = np.random.default_rng(90002)
    base = np.full((n, n), 0.0, np.float32)
    k = int(128 * 128 / 100 * 4)
    for _ in range(k):
        x, y = rng.uniform(0, n, 2)
        r = rng.uniform(0.6, 1.2)
        a = rng.uniform(25, 70)
        for dx in (-n, 0, n):
            for dy in (-n, 0, n):
                cv2.circle(base, (int((x + dx) * 4), int((y + dy) * 4)), int(r * 4), float(a), -1, cv2.LINE_AA, 2)
    base = cv2.GaussianBlur(base, (0, 0), 0.5)
    v = 41 + base   # look pass 24 Nov: base 58 with flecks 60-150 rendered the front at 71 (photo 50) and too coarse
    im = np.repeat(np.clip(v, 0, 255)[..., None], 3, 2)
    im[..., 2] += 1
    save(Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)), "sparkle.jpg", 90)


def drum():
    """IFB's Crescent Moon drum: rows of pressed oval dimples, each with a crescent of light, small drain holes between.
    Pattern size and pitch ESTIMATED from IFB's open-lid photo (about 9 dimples across a 90 mm span). A 180 x 120 mm tile."""
    ppm = 4.0
    w, h = round(180 * ppm), round(120 * ppm)
    img = np.full((h, w), 168, np.float32)
    rng = np.random.default_rng(9)
    img += cv2.GaussianBlur(rng.normal(0, 6, (h, w)).astype(np.float32), (0, 0), 6)
    px, py = 20 * ppm, 15 * ppm
    for j in range(int(h / py) + 1):
        for i in range(int(w / px) + 2):
            cx = (i + 0.5 * (j % 2)) * px
            cy = (j + 0.5) * py
            for ox in (-w, 0, w):
                c = (int(cx + ox), int(cy))
                cv2.ellipse(img, c, (int(7.5 * ppm), int(5 * ppm)), 0, 0, 360, 128, -1, cv2.LINE_AA)
                cv2.ellipse(img, (c[0] - int(1.2 * ppm), c[1] - int(1.0 * ppm)), (int(6 * ppm), int(3.8 * ppm)), 0, 200, 340, 222, int(1.4 * ppm), cv2.LINE_AA)
                cv2.circle(img, (int(cx + px / 2 + ox), int(cy + py / 2)), int(1.2 * ppm), 40, -1, cv2.LINE_AA)
    img = cv2.GaussianBlur(img, (0, 0), 0.8)
    save(Image.fromarray(np.repeat(np.clip(img, 0, 255)[..., None], 3, 2).astype(np.uint8)), "drum.jpg", 86)


def lint_filter():
    """the Lint Tower Filter's front: a grey frame round two columns of small slots (IFB's open-lid photo and the manual's
    cleaning drawing, printed page 69). 60 x 260 mm at 4 px/mm; slot count ESTIMATED."""
    ppm = 4
    w, h = 60 * ppm, 260 * ppm
    im = Image.new("RGB", (w, h), (150, 152, 156))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([6 * ppm, 14 * ppm, 54 * ppm, 250 * ppm], radius=5 * ppm, fill=(128, 130, 134))
    for c in (0, 1):
        for r in range(26):
            x0 = (11 + c * 21) * ppm
            y0 = (20 + r * 8.8) * ppm
            d.rounded_rectangle([x0, y0, x0 + 17 * ppm, y0 + 5 * ppm], radius=2 * ppm, fill=(70, 72, 76))
    d.rounded_rectangle([22 * ppm, 2 * ppm, 38 * ppm, 10 * ppm], radius=3 * ppm, fill=(118, 120, 124))
    save(im, "filter.jpg", 88)


def detergent():
    """the detergent tray's cover: dark speckled grey with "Detergent" (IFB's open-lid photo; mixed-case sans, light grey).
    160 x 60 mm at 12 px/mm; the word 32 mm wide, centred 22 mm from the cover's front edge (ESTIMATED from the photo)."""
    w, h = round(160 * PPM), round(60 * PPM)
    can = np.full((h, w, 3), 40, np.float32)
    m = text_mask("Detergent", 300, AVENIR, 7)
    tw = 32 * PPM
    th = tw * m.shape[0] / m.shape[1]
    mm = cv2.resize(m, (round(tw), round(th)), interpolation=cv2.INTER_AREA)
    X0, Y0 = round((w - tw) / 2), round(h - 22 * PPM - th / 2)
    sub = can[Y0:Y0 + mm.shape[0], X0:X0 + mm.shape[1]]
    sub[:] = sub * (1 - mm[..., None]) + np.array((170, 170, 172)) * mm[..., None]
    save(Image.fromarray(can.astype(np.uint8)), "detergent.jpg", 88)


def glass_print():
    """"TEMPERED GLASS" printed on the lid's window near its front edge (IFB's straight-down photo: 67.5 mm wide, white-grey
    capitals). A cut-out PNG; the builder lays it 0.6 mm over the glass."""
    m = text_mask("TEMPERED GLASS", 300, AVENIR, 5)
    tw = round(67.5 * PPM)
    th = round(tw * m.shape[0] / m.shape[1])
    a = cv2.resize(m, (tw, th), interpolation=cv2.INTER_AREA)
    pad = 6
    A = np.zeros((th + 2 * pad, tw + 2 * pad), np.float32)
    A[pad:pad + th, pad:pad + tw] = a
    rgba = np.dstack([np.full_like(A, 205), np.full_like(A, 205), np.full_like(A, 208), A * 255]).astype(np.uint8)
    save(Image.fromarray(rgba, "RGBA"), "glass_print.png")
    return (tw + 2 * pad) / PPM, (th + 2 * pad) / PPM


if __name__ == "__main__":
    dec, black = prints()
    knob_top(); sparkle(); drum(); lint_filter(); detergent()
    gw, gh = glass_print()
    lay = {"panelBase": [int(v) for v in BASE], "knob": [round(x_mm(KNOB[0]), 2), round(s_mm(KNOB[1]), 2)],
           "glassPrint": [round(gw, 2), round(gh, 2)], "drawingBlack": [round(float(v), 1) for v in black]}
    json.dump(lay, open(os.path.join(OUT, "layout.json"), "w"), indent=1)
    print(json.dumps(dec), json.dumps(lay))
    if "--compare" in sys.argv:
        # the print against IFB's photo: the photo's panel band, then the decals laid out at the photo's scale
        top = load_rgb(os.path.join(SRC, "photos", "ifb_tl900", "top.jpg"))
        band = top[1090:1262, 560:1690]
        sc = 2.075 / PPM
        can = np.ones((band.shape[0], band.shape[1], 3), np.float32) * BASE
        for k, v in dec.items():
            im = load_rgb(os.path.join(OUT, v["file"]))
            X0 = (v["x"][0] * 2.075 + 1099.5) - 560
            Y0 = (1290 - (v["s"][1] - 5) * PPM) * 0.13874 + 1072.48 - 1090
            tw, th = round(im.shape[1] * sc), round(im.shape[0] * 0.13874)
            sm = cv2.resize(im, (tw, th), interpolation=cv2.INTER_AREA)
            xi, yi = round(X0), round(Y0)
            sub = can[max(0, yi):yi + th, max(0, xi):xi + tw]
            sub[:] = sm[max(0, -yi):max(0, -yi) + sub.shape[0], max(0, -xi):max(0, -xi) + sub.shape[1]]
        Image.fromarray(np.vstack([band, can]).clip(0, 255).astype(np.uint8)).resize((band.shape[1] * 2, band.shape[0] * 4)).save(
            os.path.join(OUT, "..", "..", "..", ".work", "ifb_tl900_compare.png"))
