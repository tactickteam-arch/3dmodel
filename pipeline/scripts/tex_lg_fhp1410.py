"""Textures for the LG FHP1410Z5M 10 kg front-load washer (Middle Black), from LG's own photos of this model and its manual.

usage: python3 tex_lg_fhp1410.py <photos dir> <logos dir> <out dir> [--compare <dir>]
  photos: lg_fhp1410/  front_mz.jpg (LG gallery front, straight on, 1044 x 1334; the drawer reads "10kg"),
          DZ-10.jpg / DZ-11.jpg (left / right side), DZ-12.jpg (rear),
          manual_p23_display.png (the display drawing of LG's owner's manual MFL72036405, p.23, 800 dpi: the AI DD mark,
          the bar and the three wash / rinse / spin marks)
  writes <out dir>/lg_fhp1410/
  (the BEE label is cut separately: tex_bee_label.py label_gal.jpg -> bee_label.png)

Scale and frame of front_mz.jpg (all ESTIMATED, about +-1 mm): the cabinet's sides at half height between the white ground
and the cabinet on five rows are x 120.8 and 936.4 (815.6 px for 600 mm: 1.3593 px/mm); the feet stand on y 1248 and
the top edge is y 86.5 (1161.5 px for 850 mm: 1.3665 px/mm; the camera is a little above the top, so the vertical scale
is taken as 1.3647, the mean of the two edges' fits). Read off it:
  - the control strip's lower seam at y 224 -> 750.4 mm above the floor; the strip face reaches the top lid at 847 mm;
  - the drawer face runs from the left edge to the seam at x 412.5 -> 214.6 mm;
  - the front frame's vertical edges are rounded: their highlight is 14 mm in from each side.
Every word, number and digit on the strip and the drawer is set again sharp at 7.2 px/mm, fitted to the box its ink has
in the photo (found at half the way from the background to the brightest ink, at 8x). Programme names in Avenir Next
Condensed, one size for all (the real panel prints them one size): not LG's own typeface. The display's AI DD mark, bar
and wash / rinse / spin marks come from the manual's vector drawing (the same marks and order as the photo); the three
unlit marks under the digits differ from the manual's five, so they stay as the photo's (soft), as do the two tiny marks
over the power and start buttons (unreadable).
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

Image.MAX_IMAGE_PIXELS = None
PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = sys.argv[5] if len(sys.argv) > 5 and sys.argv[4] == "--compare" else None
SRC = os.path.join(PHOTOS, "lg_fhp1410")
DEST = os.path.join(OUT, "lg_fhp1410")
os.makedirs(DEST, exist_ok=True)
if COMPARE:
    os.makedirs(COMPARE, exist_ok=True)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
COND = "/System/Library/Fonts/Avenir Next Condensed.ttc"
SUP = "/System/Library/Fonts/Supplemental/"
ARIAL_B = SUP + "Arial Bold.ttf"

S = float(os.environ.get("STRIP_PXMM", "7.2"))  # STRIP_PXMM: redraw only the strip and the drawer at that density (21 Nov: 10.5); px per mm on the strip and the drawer
PX0, PSX = 120.8, 815.6 / 600         # front_mz: the cabinet's left edge, px per mm across
FLOOR, PSY = 1248.0, 1.3647           # front_mz: the floor row, px per mm up
W = 600.0
STRIP_BOT, STRIP_TOP = 750.4, 849.5   # mm above the floor (the strip's face reaches the top lid's 1 mm rim)
STRIP_H = STRIP_TOP - STRIP_BOT
DRAWER_W = 214.6
PANEL_W = W - DRAWER_W

# Colours. The photo's strip reads 77-80 (grey), the front plate 67-68, the drawer face 80. Textures render about 25%
# brighter under the viewer light than the photo, so they are written lower and checked on the render.
SHADE = 0.78
STRIP_RGB = (61, 61, 63)
DRAWER_RGB = (62, 62, 64)
PROG = (204, 204, 208)
DISP = (236, 236, 240)
DIM = (92, 92, 98)                    # unlit print on the display (the photo's unlit numbers read 70-95 on 0-5 black)
SMALL = (170, 170, 176)

PHOTO = Image.open(os.path.join(SRC, "front_mz.jpg")).convert("RGB")
PA = np.asarray(PHOTO).astype(np.float32)
PV = PA.mean(2)


def save(img, name, q=90):
    p = os.path.join(DEST, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def mm_x(px):
    return (px - PX0) / PSX


def mm_y(py):
    return (FLOOR - py) / PSY


def ink_box(win, V=PV, k=8, dark=False, frac=0.5):
    x0, y0, x1, y1 = win
    sub = V[y0:y1, x0:x1]
    up = cv2.resize(sub, ((x1 - x0) * k, (y1 - y0) * k), interpolation=cv2.INTER_CUBIC)
    border = np.concatenate([sub[0], sub[-1], sub[:, 0], sub[:, -1]])
    bg = np.median(border)
    m = up < bg - frac * (bg - up.min()) if dark else up > bg + frac * (up.max() - bg)
    ys, xs = np.where(m)
    return (x0 + xs.min() / k, y0 + ys.min() / k, x0 + (xs.max() + 1) / k, y0 + (ys.max() + 1) / k)


def text_layer(text, font, aspect=None, index=0):
    f = ImageFont.truetype(font, 200, index=index)
    bb = f.getbbox(text)
    nat = (bb[2] - bb[0]) / max(1, bb[3] - bb[1])
    if aspect and aspect > nat * 1.18 and len(text) > 2:
        gap = (aspect * (bb[3] - bb[1]) - (bb[2] - bb[0])) / (len(text) - 1)
        w = int(sum(f.getlength(c) for c in text) + gap * len(text)) + 40
        im = Image.new("L", (w, bb[3] - bb[1] + 40), 0)
        dr = ImageDraw.Draw(im)
        x = 20
        for c in text:
            dr.text((x, 20 - bb[1]), c, font=f, fill=255)
            x += f.getlength(c) + gap
    else:
        im = Image.new("L", (bb[2] - bb[0] + 20, bb[3] - bb[1] + 20), 0)
        ImageDraw.Draw(im).text((10 - bb[0], 10 - bb[1]), text, font=f, fill=255)
    a = np.asarray(im)
    ys, xs = np.where(a > 40)
    return Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1])


def set_text(canvas, text, font, box, colour, index=0):
    x0, y0, x1, y1 = box
    w, h = max(1, round(x1 - x0)), max(1, round(y1 - y0))
    lay = text_layer(text, font, w / h, index).resize((w, h), Image.LANCZOS)
    canvas.paste(Image.new("RGB", lay.size, colour), (round(x0), round(y0)), lay)


def seven(box, digit):
    """Polygons of one seven-segment digit (hexagonal bars, bar 0.21 of the width, gap 0.62 of the bar)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    t = w * 0.21
    g = t * 0.62
    xl, xr, yt, ym, yb = t / 2, w - t / 2, t / 2, h / 2, h - t / 2

    def bar(p0, p1):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        d = (p1 - p0) / np.linalg.norm(p1 - p0)
        n = np.array([-d[1], d[0]])
        c = t / 2
        pts = [p0, p0 + d * c + n * c, p1 - d * c + n * c, p1, p1 - d * c - n * c, p0 + d * c - n * c]
        return [(x0 + px, y0 + py) for px, py in pts]
    segs = {"a": bar((xl + g, yt), (xr - g, yt)), "g": bar((xl + g, ym), (xr - g, ym)), "d": bar((xl + g, yb), (xr - g, yb)),
            "f": bar((xl, yt + g), (xl, ym - g * 0.5)), "e": bar((xl, ym + g * 0.5), (xl, yb - g)),
            "b": bar((xr, yt + g), (xr, ym - g * 0.5)), "c": bar((xr, ym + g * 0.5), (xr, yb - g))}
    on = {"3": "abgcd", "8": "abcdefg", "1": "bc"}[digit]
    return [(pts, k in on) for k, pts in segs.items()]


def set_nat(canvas, text, font, box, colour, index=0, align="l"):
    """Set `text` at its own width: its ink height fills the box's height, aligned left / centre / right in the box."""
    x0, y0, x1, y1 = box
    h = max(1, round(y1 - y0))
    lay = text_layer(text, font, None, index)
    w = max(1, round(lay.width * h / lay.height))
    lay = lay.resize((w, h), Image.LANCZOS)
    x = x0 if align == "l" else (x1 - w if align == "r" else (x0 + x1 - w) / 2)
    canvas.paste(Image.new("RGB", lay.size, colour), (round(x), round(y0)), lay)
    return x, x + w


def set_cap(canvas, text, font, x, ycap, cap_px, colour, index=0, align="l", wfac=1.0):
    """Set `text` with its capitals cap_px tall, their top at ycap; x is the left edge, centre or right edge."""
    f = ImageFont.truetype(font, 400, index=index)
    hb = f.getbbox("H")
    k = cap_px / (hb[3] - hb[1])
    bb = f.getbbox(text)
    pad = 20
    im = Image.new("L", (bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad), 0)
    ImageDraw.Draw(im).text((pad - bb[0], pad - bb[1]), text, font=f, fill=255)
    w, h = max(1, round(im.width * k * wfac)), max(1, round(im.height * k))
    lay = im.resize((w, h), Image.LANCZOS)
    ink_w = (bb[2] - bb[0]) * k * wfac
    left = x if align == "l" else (x - ink_w / 2 if align == "c" else x - ink_w)
    top = ycap - (hb[1] - bb[1] + pad) * k
    canvas.paste(Image.new("RGB", lay.size, colour), (round(left - pad * k * wfac), round(top)), lay)


def paste_alpha_box(img, a, box, colour):
    x0, y0, x1, y1 = box
    w, h = max(2, round(x1 - x0)), max(2, round(y1 - y0))
    al = Image.fromarray(a).resize((w, h), Image.LANCZOS)
    img.paste(Image.new("RGB", (w, h), colour), (round(x0), round(y0)), al)


def soft_photo(img, win, X, Y, colour, dark_bg=False, gain=1.0):
    """Paste a photo patch's ink (its lightness over the local background) as alpha in `colour`: for marks too small to
    redraw. The result stays as soft as the photo (noted in NOTES.md)."""
    x0, y0, x1, y1 = win
    sub = PV[y0:y1, x0:x1]
    bg = 3.0 if dark_bg else np.median(np.concatenate([sub[0], sub[-1], sub[:, 0], sub[:, -1]]))
    ink = np.clip((sub - bg) / max(1.0, sub.max() - bg) * gain, 0, 1)
    w, h = round(X(x1) - X(x0)), round(Y(y1) - Y(y0))
    al = Image.fromarray((ink * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    img.paste(Image.new("RGB", (w, h), colour), (round(X(x0)), round(Y(y0))), al)


def manual_marks():
    """The display marks from the manual's drawing (crop of p.23 at 800 dpi), each cut to its ink."""
    man = np.asarray(Image.open(os.path.join(SRC, "manual_p23_display.png")).convert("L"))
    # boxes in the crop (its origin is the page's 1880, 2585): AI DD, bar, wash, rinse, spin
    boxes = {"ai": (23, 33, 141, 132), "bar": (232, 21, 253, 136), "wash": (334, 31, 460, 127), "rinse": (653, 31, 774, 127),
             "spin": (966, 31, 1087, 132)}
    out = {}
    for k, (x0, y0, x1, y1) in boxes.items():
        a = (255 - man[y0:y1, x0:x1]).astype(np.uint8)
        ys, xs = np.where(a > 90)
        out[k] = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return out


# ── the strip right of the drawer ────────────────────────────────────────────────────────────────────────────────────
LEFT = [("Cotton", (429, 98, 452, 107)), ("Cotton+", (429, 109, 457, 118)), ("Mixed Fabric", (429, 120, 470, 129)),
        ("Easy Care", (429, 131, 461, 142)), ("Silent Wash", (429, 143, 468, 152))]
LEFT_RED = [("Allergy Care", (430, 156, 470, 164)), ("Baby Steam Care", (430, 168, 484, 177))]
RIGHT = [("Delicates", (609, 97, 640, 105)), ("Hand/Wool", (602, 108, 640, 116)), ("Sportswear", (602, 119, 640, 128)),
         ("Quick 30", (609, 130, 641, 139)), ("Duvet", (618, 141, 640, 150)), ("Tub Clean", (608, 155, 641, 164)),
         ("Rinse+Spin", (602, 167, 641, 177))]
STEAM = ("STEAM CYCLE", (430, 89, 469, 98))
DASH_LEFT_END = {"Cotton": 503, "Cotton+": 500, "Mixed Fabric": 497, "Easy Care": 495, "Silent Wash": 494, "Allergy Care": 494,
                 "Baby Steam Care": 495}
DASH_RIGHT_START = {"Delicates": 563, "Hand/Wool": 566, "Sportswear": 569, "Quick 30": 572, "Duvet": 573, "Tub Clean": 574,
                    "Rinse+Spin": 573}
DISPLAY = (682.0, 102.0, 893.0, 195.0)                     # the black glass (photo px), corners about 3.7 mm round
DIAL_C = (534.5, 147.5)                                    # the dial's centre (photo px)
DISP_WORDS = [  # text, window (photo px), lit?
    ("Cold", (795, 116, 811, 123), True), ("20°C", (815, 116, 830, 123), False), ("30°C", (838, 116, 851, 123), False),
    ("40°C", (795, 129, 811, 136), False), ("60°C", (815, 129, 830, 136), False), ("95°C", (838, 129, 851, 136), False),
    ("Temp.", (861, 122, 880, 130), False),
    ("No", (800, 148, 810, 155), False), ("400", (816, 148, 832, 155), False), ("800", (838, 148, 851, 155), False),
    ("1000", (795, 160, 811, 168), False), ("1200", (817, 160, 835, 168), True),
    ("Spin", (862, 153, 879, 161), False),
    ("Intensive", (690, 181, 721, 191), True), ("Rinse+", (736, 181, 760, 191), True), ("Pre Wash", (777, 181, 806, 191), True),
    ("Delay End", (815, 181, 848, 191), True), ("Add Item", (859, 181, 889, 191), True),
]
KEY_BARS = [687.5, 730.0, 772.5, 813.3, 855.0]             # the short bright bar before each key's word (photo x)
KEY_SEPS = [727.5, 768.3, 810.0, 852.5]                    # thin separators between the keys
DIGIT_Y = (125.0, 148.7)
DIGITS = [(697.0, 708.3, "1", False), (711.0, 725.0, "8", False), (711.0, 725.0, "1", True), (735.0, 748.3, "3", True),
          (750.8, 765.0, "3", True)]
COLON = (729.2, (129.9, 141.6))
MARKS = [("ai", (700.0, 110.8, 705.2, 116.8), False), ("bar", (712.0, 110.6, 713.4, 117.0), False),
         ("wash", (721.7, 111.5, 730.0, 117.2), True), ("rinse", (745.0, 111.5, 752.5, 117.2), True),
         ("spin", (767.5, 111.3, 775.0, 117.4), True)]


def panel_strip():
    wpx, hpx = round(PANEL_W * S), round(STRIP_H * S)
    img = Image.new("RGB", (wpx, hpx), STRIP_RGB)
    d = ImageDraw.Draw(img, "RGBA")
    X = lambda px: (mm_x(px) - DRAWER_W) * S
    Y = lambda py: (STRIP_TOP - mm_y(py)) * S
    box = lambda b: (X(b[0]), Y(b[1]), X(b[2]), Y(b[3]))

    # the dial's well: a dark ring 35 mm round the knob (front_mz: its outer edge r 47 px, a lighter rim inside it)
    kx, ky = X(DIAL_C[0]), Y(DIAL_C[1])
    for r, c in [(35.6, (40, 40, 42)), (34.4, (52, 52, 55)), (32.8, (36, 36, 38))]:
        d.ellipse([kx - r * S, ky - r * S, kx + r * S, ky + r * S], fill=c)
    # the black display glass
    gx0, gy0, gx1, gy1 = box(DISPLAY)
    d.rounded_rectangle([gx0, gy0, gx1, gy1], radius=round(3.7 * S), fill=(7, 7, 8))

    # programme names: one cap height and one width factor for all (the panel prints them one size), the left list
    # left-aligned, the right list right-aligned, each at its own photo row
    placed = {t: ink_box(w) for t, w in LEFT + LEFT_RED + RIGHT}
    nodesc = ["Cotton", "Mixed Fabric", "Easy Care", "Silent Wash", "Delicates", "Hand/Wool", "Duvet", "Tub Clean"]
    cap = float(np.median([placed[t][3] - placed[t][1] for t in nodesc]))
    f = ImageFont.truetype(COND, 400, index=7)
    capref = f.getbbox("H")[3] - f.getbbox("H")[1]
    nat = lambda t: (f.getbbox(t)[2] - f.getbbox(t)[0]) / capref
    wfac = float(np.median([(placed[t][2] - placed[t][0]) / cap / nat(t) for t in nodesc]))
    xl_left = float(np.median([placed[t][0] for t, _ in LEFT]))
    xr_right = float(np.median([placed[t][2] for t, _ in RIGHT]))
    print("programme names: cap", round(cap / PSY, 2), "mm, width factor", round(wfac, 3))
    red = np.asarray(PHOTO)[157:178, 431:484].reshape(-1, 3).astype(float)
    red = red[(red[:, 0] - red[:, 1]) > 30]
    print("red print in the photo (blurred into the grey)", np.percentile(red, 90, axis=0).round() if len(red) else None)
    RED = (214, 62, 104)                                  # LG's red-pink print (target 232/52/108), toned like PROG
    ft = ImageFont.truetype(COND, 200, index=7)
    k = cap * S / PSY / (ft.getbbox("H")[3] - ft.getbbox("H")[1])
    rows = {}
    for t, _ in LEFT + LEFT_RED + RIGHT:
        lay = text_layer(t, COND, None, 7)
        ink_top = ft.getbbox(t)[1]
        w, h = round(lay.width * k * wfac), round(lay.height * k)
        al = lay.resize((w, h), Image.LANCZOS)
        top = Y(placed[t][1]) + (ink_top - ft.getbbox("H")[1]) * k
        right = t in dict(RIGHT)
        x0 = X(xr_right) - w if right else X(xl_left)
        img.paste(Image.new("RGB", al.size, RED if t in dict(LEFT_RED) else PROG), (round(x0), round(top)), al)
        rows[t] = (Y(placed[t][1]) + Y(placed[t][1] + cap)) / 2, x0, x0 + w
    d = ImageDraw.Draw(img, "RGBA")
    # STEAM CYCLE: red capitals over the list
    b = ink_box(STEAM[1])
    set_text(img, "STEAM CYCLE", COND, box(b), RED, 5)
    # leader lines from each name toward the dial (front_mz shows them as thin grey lines)
    lw = max(2, round(0.3 * S))
    for t, _ in LEFT + LEFT_RED:
        cy, x0, x1 = rows[t]
        d.line([(x1 + 1.2 * S, cy), (X(DASH_LEFT_END[t]), cy)], fill=(128, 128, 134), width=lw)
    for t, _ in RIGHT:
        cy, x0, x1 = rows[t]
        d.line([(X(DASH_RIGHT_START[t]), cy), (x0 - 1.2 * S, cy)], fill=(128, 128, 134), width=lw)
    # the red bracket left of the two steam programmes
    ya, yb = rows["Allergy Care"][0] - 2.4 * S, rows["Baby Steam Care"][0] + 2.4 * S
    d.line([(X(428.0), ya), (X(428.0), yb)], fill=RED, width=max(2, round(0.35 * S)))

    # display: digits " 1:33" lit, the rest of "18:88" a faint ghost, as in LG's photo
    for x0, x1, digit, lit in DIGITS:
        for pts, on in seven((X(x0), Y(DIGIT_Y[0]), X(x1), Y(DIGIT_Y[1])), digit):
            if on:
                d.polygon(pts, fill=(250, 250, 253) if lit else (26, 26, 29))
    cxd = X(COLON[0])
    for cy_ in COLON[1]:
        d.rectangle([cxd - 0.55 * S, Y(cy_) - 0.55 * S, cxd + 0.55 * S, Y(cy_) + 0.55 * S], fill=(246, 246, 250))
    marks = manual_marks()
    for name, pbox, lit in MARKS:
        paste_alpha_box(img, marks[name], box(pbox), (240, 240, 244) if lit else DIM)
    # the three unlit marks under the digits: the photo's (too small and too dim to read; not the manual's five)
    for win in [(699, 154, 709, 163), (733, 154, 743, 163), (766, 154, 776, 163)]:
        soft_photo(img, win, X, Y, (150, 150, 156), dark_bg=True, gain=1.3)
    # the key words: one cap height, each from its photo start (2 mm right of its bar); the tables' words one cap height,
    # centred where the photo has them
    starts = {"Intensive": 691.7, "Rinse+": 737.5, "Pre Wash": 778.0, "Delay End": 816.7, "Add Item": 860.0}
    for text, win, lit in DISP_WORDS:
        col = DISP if lit else DIM
        if text in starts:
            set_cap(img, text, COND, X(starts[text]), Y(184.0), 3.6 * S, col, 5, "l")
        else:
            b = ink_box(win)
            cyp = (b[1] + b[3]) / 2 - (0.6 if text in ("Temp.",) else 0)
            set_cap(img, text, COND, X((b[0] + b[2]) / 2), Y(cyp) - 1.6 * S, 3.2 * S, col, 5, "c")
    d = ImageDraw.Draw(img, "RGBA")
    for x in KEY_BARS:
        d.rectangle([X(x) - 0.45 * S, Y(182.3), X(x) + 0.45 * S, Y(189.6)], fill=(232, 232, 236))
    for x in KEY_SEPS:
        d.line([(X(x), Y(181.0)), (X(x), Y(191.0))], fill=(60, 60, 64), width=max(1, round(0.25 * S)))
    for y in (138.7, 171.7):                                  # the rules under the temperature and spin tables
        d.line([(X(790.0), Y(y)), (X(889.0), Y(y))], fill=(70, 70, 76), width=max(1, round(0.3 * S)))

    # small print round the display, its words confirmed by the manual's panel drawing (p.22)
    b = ink_box((829, 94, 891, 100), frac=0.4)
    set_nat(img, "*Extra function : Hold 3 seconds", COND, (X(b[0]), Y(95.3), X(b[2]), Y(98.6)), SMALL, 5, "r")
    d = ImageDraw.Draw(img, "RGBA")
    for text, cx in [("*Beep On/Off", 768.5), ("*Child Lock", 852.5)]:   # each between two short dashes
        xa, xb = set_nat(img, text, COND, (X(cx - 30), Y(197.9), X(cx + 30), Y(201.7)), SMALL, 5, "c")
        for xs_, xe_ in [(xa - 6.0 * S, xa - 1.2 * S), (xb + 1.2 * S, xb + 6.0 * S)]:
            d.line([(xs_, Y(200.0)), (xe_, Y(200.0))], fill=SMALL, width=max(1, round(0.25 * S)))

    # the Inverter Direct Drive mark and LG's 10-year mark under the display (redrawn; the same LG marks as the 7 kg's)
    for text, yc, hmm in [("INVERTER", 205.9, 1.3), ("DIRECT DRIVE", 211.4, 2.6), ("MOTOR", 215.9, 1.2)]:
        hp = hmm * PSY / 2
        set_nat(img, text, AVENIR, (X(840.0), Y(yc - hp), X(874.0), Y(yc + hp)), SMALL, 5, "c")
    d = ImageDraw.Draw(img, "RGBA")
    d.line([(X(876.3), Y(204.5)), (X(876.3), Y(218.0))], fill=SMALL, width=max(1, round(0.3 * S)))
    b = ink_box((877, 202, 884, 219), frac=0.4)
    set_text(img, "1", ARIAL_B, box(b), (214, 214, 218))
    b = ink_box((883, 201, 897, 219), frac=0.4)
    cx_, cy_ = X((b[0] + b[2]) / 2), Y((b[1] + b[3]) / 2)
    rx, ry = (X(b[2]) - X(b[0])) / 2, (Y(b[3]) - Y(b[1])) / 2
    d.ellipse([cx_ - rx, cy_ - ry, cx_ + rx, cy_ + ry], outline=(214, 214, 218), width=max(2, round(1.1 * S)))
    d.ellipse([cx_ - rx * 0.32, cy_ - ry * 0.32, cx_ + rx * 0.32, cy_ + ry * 0.32], fill=(214, 214, 218))

    # Smart Diagnosis: its mark redrawn (a ring with a +, a phone over its right side) and its two words
    icon = Image.new("L", (400, 330), 0)
    di = ImageDraw.Draw(icon)
    di.ellipse((20, 40, 250, 270), outline=255, width=20)
    di.rectangle((115, 85, 155, 225), fill=255)
    di.rectangle((65, 135, 205, 175), fill=255)
    di.rounded_rectangle((200, 30, 370, 300), radius=26, fill=0)
    di.rounded_rectangle((210, 40, 360, 290), radius=22, outline=255, width=20)
    di.rectangle((270, 255, 300, 268), fill=255)
    ia = np.asarray(icon)
    ys, xs = np.where(ia > 0)
    ia = ia[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    paste_alpha_box(img, ia, box((419.0, 199.5, 432.0, 209.5)), SMALL)
    set_nat(img, "Smart", COND, (X(416.0), Y(211.0), X(436.0), Y(213.6)), SMALL, 5, "c")
    set_nat(img, "Diagnosis™", COND, (X(414.0), Y(214.6), X(438.0), Y(217.4)), SMALL, 5, "c")
    # the tiny marks over the power and start buttons: unreadable at this size, kept soft from the photo
    for win in [(446, 182, 460, 188), (611, 182, 625, 188)]:
        soft_photo(img, win, X, Y, SMALL, gain=1.2)
    # the power and start buttons' recessed wells (the buttons are geometry): a dark ring 12.5 mm round each
    d = ImageDraw.Draw(img, "RGBA")
    for c in [(452.5, 197.0), (617.5, 197.5)]:
        bx, by = X(c[0]), Y(c[1])
        for r, col in [(12.6, (44, 44, 46)), (11.4, (54, 54, 57))]:
            d.ellipse([bx - r * S, by - r * S, bx + r * S, by + r * S], fill=col)
    # flat ground snapped to its colour (the type is drawn on a flat ground) and q80: inside the 3.5 MB Apple-file budget at 10.5 px/mm
    a = np.asarray(img).astype(np.int16); g = np.array(STRIP_RGB, np.int16); a[np.abs(a - g).max(2) <= 2] = g
    save(Image.fromarray(a.astype(np.uint8)), "panel.jpg", 80)
    return img


def drawer_face():
    """The drawer face: LG's mark, ThinQ and 10kg; the finger pocket is geometry."""
    wpx, hpx = round(DRAWER_W * S), round(STRIP_H * S)
    img = Image.new("RGB", (wpx, hpx), DRAWER_RGB)
    X = lambda px: mm_x(px) * S
    Y = lambda py: (STRIP_TOP - mm_y(py)) * S
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    a = np.asarray(lg)
    ys, xs = np.where(a[..., 3] > 20)
    lg = lg.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    b = ink_box((158, 92, 222, 124), frac=0.4)                    # the LG mark in front_mz
    w, h = round(X(b[2]) - X(b[0])), round(Y(b[3]) - Y(b[1]))
    # printed in one light grey: the letters, the face's eye and G and the disc's rim; the disc a little lighter than the face
    c = np.asarray(lg).astype(float)
    A = c[..., 3] / 255.0
    ys, xs = np.where((c[..., 0] > 110) & (c[..., 1] < 90) & (A > 0.5))
    dcx, dcy, dr = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, (xs.max() - xs.min() + ys.max() - ys.min()) / 4
    yy, xx = np.mgrid[0:c.shape[0], 0:c.shape[1]]
    rr = np.hypot(xx - dcx, yy - dcy)
    inside = np.clip(dr + 0.5 - rr, 0, 1)
    rim = np.clip(rr - (dr * 0.89 - 0.5), 0, 1) * inside
    face = (c[..., 1] / 255.0) * A * inside
    ink = np.maximum.reduce([A * (1 - inside) * 0.95, face * 0.95, rim * 0.85, inside * 0.30])
    al = Image.fromarray((ink * 255).round().astype(np.uint8)).resize((w, h), Image.LANCZOS)
    img.paste(Image.new("RGB", (w, h), (196, 198, 202)), (round(X(b[0])), round(Y(b[1]))), al)
    print("drawer LG mark mm", [round(mm_x(b[0]), 1), round(mm_y(b[3]), 1), round(mm_x(b[2]), 1), round(mm_y(b[1]), 1)])
    b = ink_box((341, 100, 388, 118), frac=0.45)                  # ThinQ
    set_text(img, "ThinQ", AVENIR, (X(b[0]), Y(b[1]), X(b[2]), Y(b[3])), (198, 198, 203), 5)
    b = ink_box((349, 155, 389, 172), frac=0.45)                  # 10kg
    set_text(img, "10kg", AVENIR, (X(b[0]), Y(b[1]), X(b[2]), Y(b[3])), (196, 196, 201), 5)
    save(img, "drawer.jpg", 90)


def knob_top():
    """Spun brushed-aluminium top of the dial: concentric rings and a soft cross of light (front_mz)."""
    n = 512
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    cx = cy = n / 2
    r = np.hypot(xx - cx, yy - cy) / (n / 2)
    th = np.arctan2(yy - cy, xx - cx)
    v = 128 + 70 * (np.cos(th * 2) ** 2) ** 3 * np.clip(r * 1.2, 0, 1) - 20 * r
    v += 7 * np.sin(r * 160) + 4 * np.sin(r * 61)
    v += 30 * np.exp(-((r - 0.96) / 0.035) ** 2)
    v = np.clip(v, 0, 255) * 0.9
    img = np.stack([v, v + 1, v + 4], axis=2).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(img), "knob_top.jpg", 92)


def drum_texture():
    """Stainless drum wall, one 160 x 80 mm tile at 6.4 px/mm: round holes about 5 mm across on a 10 mm staggered pitch
    (LG's open-door photos DZ-4 / DZ-6), with a pressed rim; brushed steel between."""
    w, h = 1024, 512
    rng = np.random.default_rng(5)
    base = np.full((h, w), 118.0) + rng.normal(0, 2.5, (h, w))
    base += 4 * np.sin(np.arange(w)[None, :] / 3.0)
    img = Image.fromarray(base.clip(0, 255).astype(np.uint8)).convert("RGB")
    d = ImageDraw.Draw(img)
    pitch, r = 64, 15
    for j, y in enumerate(range(pitch // 2, h, pitch)):
        for x in range(pitch // 4 + (pitch // 2 if j % 2 else 0), w + pitch, pitch):
            xx = x % w
            for dx in (0, -w, w):
                cx_ = xx + dx
                d.ellipse([cx_ - r - 3, y - r - 3, cx_ + r + 3, y + r + 3], fill=(150, 151, 153))
                d.ellipse([cx_ - r, y - r, cx_ + r, y + r], fill=(30, 31, 34))
                d.ellipse([cx_ - r + 5, y - r + 5, cx_ + r - 3, y + r - 3], fill=(14, 15, 17))
    save(img.filter(ImageFilter.GaussianBlur(0.8)), "drum.jpg", 88)


def flatten_light(im, keep=0.7):
    a = np.asarray(im).astype(np.float32) + 1
    lum = a.mean(2)
    h, w = lum.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xx, yy = xx / w - 0.5, yy / h - 0.5
    Amat = np.stack([np.ones_like(xx), xx, yy, xx * xx, yy * yy, xx * yy], -1).reshape(-1, 6)
    lg = np.log(lum).reshape(-1)
    sel = slice(None, None, 7)
    coef = np.linalg.lstsq(Amat[sel], lg[sel], rcond=None)[0]
    fit = (Amat @ coef).reshape(h, w)
    mean = np.exp(fit.mean())
    gain = (mean / np.exp(fit))[..., None]
    out = a * gain
    rel = out / mean
    out = mean * (1 + (rel - 1) * keep)
    return out.clip(0, 255).astype(np.uint8), mean


# ── the rear (DZ-12): its frame, and the routes of the hose and cord ───────────────────────────────────────────────────
# DZ-12 is straight on: the cabinet's sides at x 485.0 and 1134.3 (649.3 px for 600 mm: 1.0822 px/mm); its top y 69.
R_X0, R_PPM, R_Y0 = 485.0, 649.3 / 600, 69.0
# the drain hose's centre line, traced on the photo (rough points snapped to the middle of the hose's band; median band
# 28 px = 26 mm): from its end fitting at the bottom middle, right along the bottom, up the right side, over the top and
# down the left into its holder
HOSE = [[704, 919], [760, 924], [820, 927], [880, 928], [940, 928], [990, 924], [1035, 915], [1070, 900], [1095, 878],
        [1113, 845], [1124, 800], [1126, 740], [1124, 680], [1118, 610], [1108, 540], [1097, 470], [1087, 410],
        [1078, 340], [1070, 285], [1058, 225], [1036, 170], [1000, 135], [950, 115], [880, 106], [800, 108], [740, 113],
        [700, 125], [660, 150], [620, 180], [583, 215], [552, 255], [534, 300], [524, 345], [520, 390], [519, 440], [521, 480]]
CORD_TOP = [[566, 152], [590, 139], [630, 128], [680, 124], [720, 130], [760, 141], [790, 147]]
CORD_RIGHT = [[1047, 300], [1044, 360], [1040, 430], [1036, 500], [1040, 560], [1052, 610], [1062, 650], [1058, 700],
              [1051, 750], [1048, 800], [1047, 850]]
PLUG = [1048, 884]
GROMMET = [566, 152]
CLIPS = [[521, 318, 34, 14], [1052, 318, 34, 16]]                # white hose clips: centre, width, height (px)
HOLDER = [503, 425, 545, 528]                                   # the light grey U the hose end sits in (px box)
HOSE_FIT = [690, 905, 740, 933]                                 # the hose's end fitting


def rear_and_paths():
    im = Image.open(os.path.join(SRC, "DZ-12.jpg")).convert("RGB")
    A = np.asarray(im).astype(np.float32)
    L = A.mean(2)
    # bolts: Hough circles on the four grey caps
    g = cv2.GaussianBlur(L.astype(np.uint8), (5, 5), 0)
    circles = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, 1, 100, param1=80, param2=25, minRadius=12, maxRadius=24)
    bolts = []
    for x, y, r in circles[0]:
        for gx, gy in [(630, 258), (985, 258), (552, 650), (1068, 650)]:
            if abs(x - gx) < 20 and abs(y - gy) < 20:
                bolts.append([float(x), float(y), float(r)])
    bolts = sorted({(round(b[0]), round(b[1])): b for b in bolts}.values())
    for gx, gy in [(630, 258), (985, 258), (552, 650), (1068, 650)]:   # a cap Hough misses: its own brightest-disc centre
        if not any(abs(b[0] - gx) < 20 and abs(b[1] - gy) < 20 for b in bolts):
            sub = L[gy - 25:gy + 25, gx - 25:gx + 25]
            ys_, xs_ = np.where(sub > np.percentile(sub, 80))
            bolts.append([gx - 25 + float(xs_.mean()), gy - 25 + float(ys_.mean()), 17.0])
    bolts.sort()
    # the inlet: the blue cap
    blue = (A[..., 2] > A[..., 0] + 60) & (A[..., 2] > 120)
    ys, xs = np.where(blue[60:250, 800:1050])
    inlet = [800 + float(xs.mean()), 60 + float(ys.mean())]
    # the raised tub plate: the bright silver area
    pl = (L > 150).astype(np.uint8)
    pl[:, :590] = 0
    pl[:, 1030:] = 0
    pl[:250] = 0
    pl[880:] = 0
    n, lab, st, cen = cv2.connectedComponentsWithStats(pl, 8)
    i = 1 + np.argmax(st[1:, 4])
    x, y, w, h, _ = st[i]
    plate = [int(x), int(y), int(x + w), int(y + h)]
    # the cabinet's bottom edge
    col = L[:, 800]
    floor_y = float(R_Y0 + 850 * R_PPM)
    paths = {"px_per_mm": R_PPM, "x0": R_X0, "y0": R_Y0, "hose": HOSE, "hose_d_mm": 26.0, "cord_top": CORD_TOP,
             "cord_right": CORD_RIGHT, "plug": PLUG, "grommet": GROMMET, "clips": CLIPS, "holder": HOLDER, "hose_fit": HOSE_FIT,
             "bolts": bolts, "inlet": inlet, "plate": plate, "floor_y": floor_y}
    json.dump(paths, open(os.path.join(DEST, "rear_paths.json"), "w"), indent=1)
    print("rear: bolts", [[round(v) for v in b] for b in bolts], "inlet", [round(v) for v in inlet], "plate", plate)

    # paint out the hose, cord, plug, clips, holder, fitting and the cord's packing tag
    crop = (int(R_X0), int(R_Y0), int(round(R_X0 + 600 * R_PPM)), int(round(R_Y0 + 850 * R_PPM)))
    arr = np.asarray(im).copy()
    mask = np.zeros(arr.shape[:2], np.uint8)
    cv2.polylines(mask, [np.array(HOSE, np.int32)], False, 255, 38)
    cv2.polylines(mask, [np.array(CORD_TOP, np.int32)], False, 255, 16)
    cv2.polylines(mask, [np.array(CORD_RIGHT, np.int32)], False, 255, 16)
    cv2.circle(mask, tuple(PLUG), 26, 255, -1)
    for cx_, cy_, w_, h_ in CLIPS:
        cv2.rectangle(mask, (cx_ - w_ // 2 - 4, cy_ - h_ // 2 - 4), (cx_ + w_ // 2 + 4, cy_ + h_ // 2 + 4), 255, -1)
    cv2.rectangle(mask, (HOLDER[0] - 4, HOLDER[1] - 4), (HOLDER[2] + 4, HOLDER[3] + 4), 255, -1)
    cv2.rectangle(mask, (HOSE_FIT[0] - 6, HOSE_FIT[1] - 6), (HOSE_FIT[2] + 6, HOSE_FIT[3] + 6), 255, -1)
    cv2.rectangle(mask, (1045, 770), (1095, 805), 255, -1)       # the cord's bar-code tag (packing)
    cv2.circle(mask, (round(inlet[0]), round(inlet[1])), 14, 255, -1)   # the inlet is geometry
    for bx, by, br in bolts:                                      # the bolts are geometry
        cv2.circle(mask, (round(bx), round(by)), round(br) + 4, 255, -1)
    cv2.circle(mask, tuple(GROMMET), 16, 255, -1)
    mask[:, :crop[0] + 6] = 0
    mask[:, crop[2] - 6:] = 0
    out = cv2.inpaint(arr, mask, 9, cv2.INPAINT_NS)
    body = cv2.GaussianBlur(out, (0, 0), 5)
    fill = mask > 0
    out[fill] = (body[fill] * 0.7 + out[fill] * 0.3).astype(np.uint8)
    rear = Image.fromarray(out).crop(crop)
    rear = rear.point(lambda v: v * 0.92)
    save(rear, "rear.jpg", 86)


def sides():
    """Side panels: the ribbed panel only, from the top lid's seam to the cabinet's lower edge and from the front frame's seam
    to the back; the studio light taken out."""
    # DZ-11 is the right side (+x: the door at its left, the hose ending at its holder half way down, as the rear photo has
    # it on its left); DZ-10 the left side (the front at its right, the hose running down to the floor)
    for name, f, (x0, y0, x1, y1) in (("side_l.jpg", "DZ-10.jpg", (531, 104, 1067, 965)), ("side_r.jpg", "DZ-11.jpg", (565, 104, 1113, 965))):
        im = Image.open(os.path.join(SRC, f)).convert("RGB").crop((x0, y0, x1, y1))
        flat, mean = flatten_light(im, 0.75)
        target = 58.0
        flat = (flat.astype(np.float32) * (target / mean)).clip(0, 255).astype(np.uint8)
        side = Image.fromarray(flat).resize((round((x1 - x0) * 0.9), round((y1 - y0) * 0.9)), Image.LANCZOS)
        save(side, name, 86)


def buttons():
    """The power and start / pause buttons' faces: the IEC power mark and the play / pause mark, light grey on the buttons'
    dark cap (front_mz and sg3 straight on: power ring about 10 mm across, play / pause about 8 x 9 mm; redrawn, ESTIMATED
    to 0.5 mm). The face is 19 mm across at 13.5 px/mm."""
    k, n = 13.5, 256
    c = n / 2
    ink = (196, 197, 202)
    for name in ("btn_power.jpg", "btn_start.jpg"):
        big = Image.new("RGB", (n * 4, n * 4), (34, 34, 36))
        d = ImageDraw.Draw(big)
        K = 4 * k
        if name == "btn_power.jpg":
            r, w = 4.3 * K, 1.05 * K
            d.arc([4 * c - r, 4 * c - r + 0.4 * K, 4 * c + r, 4 * c + r + 0.4 * K], -60, 240, fill=ink, width=round(w))
            d.rounded_rectangle([4 * c - w / 2, 4 * c - 5.2 * K, 4 * c + w / 2, 4 * c + 0.2 * K], radius=w / 2, fill=ink)
        else:
            x0, h = 4 * c - 4.0 * K, 7.4 * K
            d.polygon([(x0, 4 * c - h / 2), (x0, 4 * c + h / 2), (x0 + 4.6 * K, 4 * c)], fill=ink)
            for bx in (x0 + 5.0 * K, x0 + 6.9 * K):
                d.rectangle([bx, 4 * c - h / 2, bx + 1.15 * K, 4 * c + h / 2], fill=ink)
        save(big.resize((n, n), Image.LANCZOS), name, 92)


def hose_texture():
    """One rib of the drain hose per tile (repeated every 4.3 mm along the hose, as DZ-12 shows): light crest, dark groove."""
    w, h = 64, 16
    x = np.arange(w) / w
    v = 132 + 40 * np.cos(2 * np.pi * x)
    a = np.repeat(v[None, :], h, 0)
    save(Image.fromarray(np.stack([a, a + 2, a + 5], -1).clip(0, 255).astype(np.uint8)), "hose.jpg", 92)


def compare_strip(panel):
    x0, x1 = PX0 + DRAWER_W * PSX, PX0 + W * PSX
    y0, y1 = FLOOR - STRIP_TOP * PSY, FLOOR - STRIP_BOT * PSY
    ref = PHOTO.transform(panel.size, Image.EXTENT, (x0, y0, x1, y1), Image.BICUBIC)
    o = Image.new("RGB", (panel.width, panel.height * 2 + 6), "white")
    o.paste(ref, (0, 0))
    o.paste(panel, (0, panel.height + 6))
    o.save(os.path.join(COMPARE, "strip_compare.png"))


if __name__ == "__main__":
    pan = panel_strip()
    drawer_face()
    if os.environ.get("STRIP_PXMM"):
        sys.exit(0)
    knob_top()
    drum_texture()
    hose_texture()
    buttons()
    sides()
    rear_and_paths()
    if COMPARE:
        compare_strip(pan)
