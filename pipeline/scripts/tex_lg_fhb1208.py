"""Textures for the LG FHB1208Z2M 8 kg front-load washer (Middle Black), from LG's own photos and manual.

usage: python3 tex_lg_fhb1208.py <photos dir> <logos dir> <out dir> [--compare <dir>]
  photos: lg_fhb1208/  gal1.jpg (front, straight on), gal2.jpg (this model's BEE label, named FHB1208Z2M),
          gal3.jpg (door open, straight on), DZ-10.jpg / DZ-11.jpg (right / left side), DZ-12.jpg (rear),
          manual_p21_panel.png (the control-panel drawing of LG's owner's manual MFL72036419, page 21, 1000 dpi)
  writes <out dir>/lg_fhb1208/

Scale and frame. gal1 is straight on: the cabinet is 706 px for 600 mm (1.1767 px/mm) and 1000 px for 850 mm, so
both axes agree. Its left edge is photo x 646 and its top photo y 165. Read off it (all ESTIMATED, +-1 mm):
  - the top plate's front face is 31.5 mm tall (photo y 165-202), so the control strip starts 818.5 mm up;
  - the strip is 90.5 mm tall (photo y 202-308), so the front plate starts 728 mm up;
  - the drawer face runs from the left edge to 212.5 mm (photo x 896).
Every word, number, icon and digit on the strip is set again sharp at 7.2 px/mm, each one fitted to the box its ink
has in gal1 (found at half the way from the background to the brightest ink, at 8x). Words are set in Avenir Next
Condensed (the photo's print is 0.77 of Avenir Next's width; not LG's own typeface, so letter shapes differ slightly); the display icons come from the manual's vector drawing.
The Smart Diagnosis mark right of the display is redrawn (ring with a +, phone at its right), as gal3 resolves it.

The energy label is redrawn at 12 px/mm from gal2, where LG shows this model's own label large (535 px for 68 mm):
shapes as shapes, words in Arial fitted to their ink boxes, only the BEE emblem kept as the photo.
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
SRC = os.path.join(PHOTOS, "lg_fhb1208")
DEST = os.path.join(OUT, "lg_fhb1208")
os.makedirs(DEST, exist_ok=True)
if COMPARE:
    os.makedirs(COMPARE, exist_ok=True)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
COND = "/System/Library/Fonts/Avenir Next Condensed.ttc"   # the panel's print is condensed (gal1: 0.77 of Avenir Next's width)
SUP = "/System/Library/Fonts/Supplemental/"
ARIAL_B, ARIAL_BLK, ARIAL_N, ARIAL_NB, ARIAL = SUP + "Arial Bold.ttf", SUP + "Arial Black.ttf", SUP + "Arial Narrow.ttf", SUP + "Arial Narrow Bold.ttf", SUP + "Arial.ttf"
HERE = os.path.dirname(os.path.abspath(__file__))

S = 7.2                               # px per mm on the strip
PS = 706 / 600                        # gal1 px per mm
PX0, PY0 = 646.0, 165.0               # gal1: the cabinet's left edge and top
STRIP_TOP, STRIP_BOT = 818.5, 728.0   # mm above the floor
STRIP_H = STRIP_TOP - STRIP_BOT       # 90.5 mm
DRAWER_W, W = 212.5, 600.0
PANEL_W = W - DRAWER_W
PLATE_BOT = 20.0                      # the cabinet's lower edge: the front plate runs 20 -> 728 mm

# Colours, matched as ratios to the energy label's cream in gal1 (label 245 luminance): strip 0.32, front plate
# 0.26, top plate 0.31. Textures render about 25% brighter under the viewer light, so they are written lower and then
# checked on the render (REVIEW.md).
SHADE = 0.80
STRIP_RGB = (64, 64, 65)              # photo 76-83, x SHADE
PLATE_RGB = (57, 57, 58)              # photo 64 (0.261 of the label cream); 52 rendered 0.240, so raised 9%
DRAWER_RGB = (59, 59, 60)             # photo 76 against the strip's 78-82: the drawer face reads 0.92 of the strip

PHOTO = Image.open(os.path.join(SRC, "gal1.jpg")).convert("RGB")
PV = np.asarray(PHOTO.convert("L")).astype(np.float32)


def save(img, name, q=90):
    p = os.path.join(DEST, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def ink_box(win, dark=False, V=PV, k=8, thr=None):
    """Sub-pixel ink box inside a photo window: upsample 8x, threshold half way from the border's median to the
    strongest ink. Returns photo px (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = win
    sub = V[y0:y1, x0:x1]
    up = cv2.resize(sub, ((x1 - x0) * k, (y1 - y0) * k), interpolation=cv2.INTER_CUBIC)
    border = np.concatenate([sub[0], sub[-1], sub[:, 0], sub[:, -1]])
    bg = np.median(border)
    if thr is not None:
        m = up < thr if dark else up > thr
    elif dark:
        m = up < bg - 0.5 * (bg - up.min())
    else:
        m = up > bg + 0.5 * (up.max() - bg)
    ys, xs = np.where(m)
    return (x0 + xs.min() / k, y0 + ys.min() / k, x0 + (xs.max() + 1) / k, y0 + (ys.max() + 1) / k)


def text_layer(text, font, aspect=None, index=0):
    """White text on black, cropped to its ink, at a large size (for scaling down). When the target box is more than
    1.18x wider than the word's own shape, letter spacing is added instead of stretching the letters."""
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
    """Paint `text` stretched exactly over the canvas box (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    w, h = max(1, round(x1 - x0)), max(1, round(y1 - y0))
    lay = text_layer(text, font, w / h, index).resize((w, h), Image.LANCZOS)
    canvas.paste(Image.new("RGB", lay.size, colour), (round(x0), round(y0)), lay)


def seven(box, digit, lit):
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
    on = {"5": "afgcd", "0": "abcdef", "8": "abcdefg", "1": "bc"}[digit] if lit else ""
    return [(pts, k in on) for k, pts in segs.items()]


def manual_ink(box_thumb, thumb_w=2000, thr=90):
    """One drawing from the manual's panel drawing (box in its 2000-px thumbnail) -> tight alpha array."""
    man = np.asarray(Image.open(os.path.join(SRC, "manual_p21_panel.png")).convert("L"))
    k = man.shape[1] / thumb_w
    x0, y0, x1, y1 = [round(v * k) for v in box_thumb]
    a = (255 - man[y0:y1, x0:x1]).astype(np.uint8)
    ys, xs = np.where(a > thr)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def paste_alpha_box(img, a, box, colour):
    x0, y0, x1, y1 = box
    w, h = max(2, round(x1 - x0)), max(2, round(y1 - y0))
    al = Image.fromarray(a).resize((w, h), Image.LANCZOS)
    img.paste(Image.new("RGB", (w, h), colour), (round(x0), round(y0)), al)


# ── the control strip ─────────────────────────────────────────────────────────────────────────────────────────────
# Words: (text, search window in gal1 px, face of Avenir Next, colour). Windows read off a gridded 6x crop of gal1.
PROG, DISP, SMALL = (206, 206, 210), (240, 240, 244), (176, 176, 182)
STRIP_WORDS = [
    ("Cotton", (930, 220, 958, 232), 7, PROG), ("Cotton+", (928, 233, 958, 245), 7, PROG),
    ("Mixed Fabric", (917, 247, 958, 258), 7, PROG), ("Quick 30", (926, 260, 958, 271), 7, PROG),
    ("Allergy Care", (917, 273, 958, 285), 7, PROG),
    ("Activewear", (1040, 220, 1076, 232), 7, PROG), ("Hand/Wool", (1040, 233, 1076, 245), 7, PROG),
    ("Delicates", (1040, 247, 1072, 258), 7, PROG), ("Tub Clean", (1040, 260, 1074, 271), 7, PROG),
    ("Rinse+Spin", (1040, 273, 1076, 285), 7, PROG),
    ("Delay End", (1247, 235, 1278, 243), 7, DISP), ("*Pre Wash", (1250, 243, 1274, 249), 7, SMALL),
    ("Spin", (1181, 262, 1198, 271), 7, DISP), ("*Rinse+", (1181, 271, 1198, 277), 7, SMALL),
    ("Temp.", (1215, 262, 1236, 271), 7, DISP), ("*Intensive", (1214, 271, 1237, 278), 7, SMALL),
    ("*Hold 3 seconds", (1252, 216, 1281, 223), 7, SMALL), ("*Child Lock", (1194, 280, 1220, 287), 7, SMALL),
    ("Smart", (1282, 270, 1303, 275), 7, SMALL), ("Diagnosis™", (1281, 274, 1305, 279), 7, SMALL),
]
# dashes beside the programme names (x of the photo dash centre); y = the name's centre
DASH_L, DASH_R = 960.0, 1036.5
# display icons from the manual drawing (thumbnail box) -> photo box in gal1 (x0, y0, x1, y1), lit?
ICONS = [
    ("rinse", (1579, 126, 1637, 184), (1206.3, 231.2, 1214.3, 238.0), False),
    ("intensive", (1649, 126, 1707, 184), (1220.0, 231.2, 1228.0, 238.0), False),
    ("prewash", (1730, 138, 1768, 172), (1232.8, 231.4, 1240.4, 237.8), False),
    ("lock", (1579, 208, 1637, 266), (1206.6, 245.8, 1213.8, 252.6), False),
    ("clock", (1730, 219, 1768, 255), (1234.0, 245.8, 1241.0, 252.6), False),
    ("play", (1255, 292, 1325, 362), (1147.6, 262.4, 1158.6, 272.6), True),
    ("power", (1840, 292, 1910, 362), (1256.0, 261.6, 1267.8, 273.4), True),
]
DISPLAY = (1135.0, 225.3, 1280.0, 279.7)          # the black display glass in gal1 px (rounded corners)
SEPARATORS = [1170.8, 1207.5, 1243.3]              # the thin bars between the touch keys (photo x), rows 261-273
DIGITS_Y = (232.4, 255.2)                          # the digits' top and bottom (photo y)
DIGITS = [(1149.6, 1159.4, "1", False), (1161.0, 1169.8, "8", False), (1171.6, 1183.4, "5", True), (1185.6, 1197.6, "0", True)]
SMART_ICON = (1281, 256, 1301, 271)                # photo crop of the Smart Diagnosis mark
DIAL_C, DIAL_R = (999.7, 252.6), 25.6              # photo centre, and the knob's radius in mm


def mm_x(px):
    return (px - PX0) / PS


def strip_y(py):
    """photo y -> mm below the top of the strip."""
    return (py - PY0) / PS - (850.0 - STRIP_TOP)


def panel_strip():
    """The strip right of the drawer: x from 212.5 to 600 mm of the cabinet, 90.5 mm tall."""
    wpx, hpx = round(PANEL_W * S), round(STRIP_H * S)
    img = Image.new("RGB", (wpx, hpx), STRIP_RGB)
    d = ImageDraw.Draw(img, "RGBA")
    X = lambda px: (mm_x(px) - DRAWER_W) * S
    Y = lambda py: strip_y(py) * S
    box = lambda b: (X(b[0]), Y(b[1]), X(b[2]), Y(b[3]))

    # the dial's well: a slightly darker disc under the knob (the photo shows a soft shadow ring round it)
    kx, ky = X(DIAL_C[0]), Y(DIAL_C[1])
    for r, v in [(30.5, 0.93), (28.5, 0.86)]:
        d.ellipse([kx - r * S, ky - r * S, kx + r * S, ky + r * S], fill=(round(STRIP_RGB[0] * v),) * 3)

    # the display glass
    gx0, gy0, gx1, gy1 = box(DISPLAY)
    d.rounded_rectangle([gx0, gy0, gx1, gy1], radius=round(1.6 * S), fill=(8, 8, 9))

    placed = {}
    left = ["Cotton", "Cotton+", "Mixed Fabric", "Quick 30", "Allergy Care"]
    right = ["Activewear", "Hand/Wool", "Delicates", "Tub Clean", "Rinse+Spin"]
    for text, win, face, colour in STRIP_WORDS:
        b = ink_box(win)
        placed[text] = b
        if text not in left + right:
            # the condensed or the regular face, whichever is nearer the photo word's own shape (the display's
            # words are wider than the programme names)
            bx = box(b)
            asp = (bx[2] - bx[0]) / (bx[3] - bx[1])
            nat = lambda fn: (lambda bb: (bb[2] - bb[0]) / (bb[3] - bb[1]))(ImageFont.truetype(fn, 200, index=face).getbbox(text))
            fn = min((COND, AVENIR), key=lambda fn: abs(np.log(asp / nat(fn))))
            set_text(img, text, fn, bx, colour, face)
    # The programme names are one size on the real panel, so they are set at one size: the cap height is the median
    # of the names without descenders, the left list right-aligned and the right list left-aligned to their median
    # edges, each row's cap line from the left list (the rows are level), and a common width factor read off the photo.
    nodesc = ["Cotton", "Mixed Fabric", "Quick 30", "Activewear", "Hand/Wool", "Delicates"]
    cap = float(np.median([placed[t][3] - placed[t][1] for t in nodesc]))          # photo px
    f = ImageFont.truetype(COND, 400, index=7)
    capref = f.getbbox("H")[3] - f.getbbox("H")[1]
    nat = lambda t: (f.getbbox(t)[2] - f.getbbox(t)[0]) / capref                    # width in caps
    wfac = float(np.median([(placed[t][2] - placed[t][0]) / cap / nat(t) for t in nodesc]))
    xr_left = float(np.median([placed[t][2] for t in left]))
    xl_right = float(np.median([placed[t][0] for t in right]))
    rows = [placed[t][1] for t in left]
    print("programme names: cap", round(cap / PS, 2), "mm, width factor", round(wfac, 3))
    for i in range(5):
        for t, side_ in ((left[i], "L"), (right[i], "R")):
            lay = text_layer(t, COND, None, 7)                                      # ink-tight, cap top at 0
            ft = ImageFont.truetype(COND, 200, index=7)
            ink_top = ft.getbbox(t)[1]
            k = cap * S / PS / (ft.getbbox("H")[3] - ft.getbbox("H")[1])              # canvas px per font px
            w, h = round(lay.width * k * wfac), round(lay.height * k)
            al = lay.resize((w, h), Image.LANCZOS)
            top = Y(rows[i]) + (ink_top - ft.getbbox("H")[1]) * k
            x0 = X(xr_left) - w if side_ == "L" else X(xl_right)
            img.paste(Image.new("RGB", al.size, PROG), (round(x0), round(top)), al)
            placed[t] = (0, rows[i], 0, rows[i] + cap)
    d = ImageDraw.Draw(img, "RGBA")
    # dashes beside the programme names; the lamp of the selected programme (Delicates) is lit
    lw = max(2, round(0.35 * S))
    for text in left:
        b = placed[text]
        cy = Y((b[1] + b[3]) / 2)
        d.line([(X(DASH_L) - 1.6 * S, cy), (X(DASH_L) + 1.6 * S, cy)], fill=(140, 140, 146), width=lw)
    for text in right:
        b = placed[text]
        cy = Y((b[1] + b[3]) / 2)
        if text == "Delicates":
            d.ellipse([X(DASH_R) - 1.0 * S, cy - 1.0 * S, X(DASH_R) + 1.0 * S, cy + 1.0 * S], fill=(250, 250, 252))
        else:
            d.line([(X(DASH_R) - 1.6 * S, cy), (X(DASH_R) + 1.6 * S, cy)], fill=(140, 140, 146), width=lw)

    # digits: "18" ghost, "50" lit as in LG's photo; the colon dots unlit
    for x0, x1, digit, lit in DIGITS:
        for pts, on in seven((X(x0), Y(DIGITS_Y[0]), X(x1), Y(DIGITS_Y[1])), digit, True):
            if on:
                d.polygon(pts, fill=(250, 250, 253) if lit else (30, 30, 33))
    cxd = X(1170.6)
    for cy_ in (238.6, 249.0):
        d.rectangle([cxd - 0.6 * S, Y(cy_) - 0.6 * S, cxd + 0.6 * S, Y(cy_) + 0.6 * S], fill=(30, 30, 33))

    # icons from the manual's drawing
    for name, mbox, pbox, lit in ICONS:
        paste_alpha_box(img, manual_ink(mbox), box(pbox), (246, 246, 250) if lit else (120, 120, 126))
    d = ImageDraw.Draw(img, "RGBA")
    for sx in SEPARATORS:
        d.line([(X(sx), Y(261.4)), (X(sx), Y(273.6))], fill=(196, 196, 202), width=max(2, round(0.32 * S)))
    # the Child Lock bracket either side of its words
    b = placed["*Child Lock"]
    cy = Y((b[1] + b[3]) / 2)
    d.line([(X(1184.5), cy), (X(b[0]) - 0.8 * S, cy)], fill=(150, 150, 156), width=max(1, round(0.25 * S)))
    d.line([(X(b[2]) + 0.8 * S, cy), (X(1230.0), cy)], fill=(150, 150, 156), width=max(1, round(0.25 * S)))

    # the Smart Diagnosis mark, redrawn: a ring with a + inside and a phone over its right side. gal3 resolves it that far
    # (and it is the same LG mark the LG T12's photo shows sharply); fitted to its ink box in gal1.
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
    # its ink in gal1 at 35% (the strokes are thin and blurred, so 50% under-reads them), stopping above "Smart"
    paste_alpha_box(img, ia, box((1286.25, 260.4, 1298.0, 269.9)), SMALL)
    save(img, "panel.jpg", 90)
    return img


def drawer_face():
    """The drawer face: the LG mark and the 8kg print; the finger pocket is geometry."""
    wpx, hpx = round(DRAWER_W * S), round(STRIP_H * S)
    img = Image.new("RGB", (wpx, hpx), DRAWER_RGB)
    X = lambda px: mm_x(px) * S
    Y = lambda py: strip_y(py) * S
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    a = np.asarray(lg)
    ys, xs = np.where(a[..., 3] > 20)
    lg = lg.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    b = ink_box((676, 212, 732, 239))                             # the LG mark in gal1
    w, h = round(X(b[2]) - X(b[0])), round(Y(b[3]) - Y(b[1]))
    # the drawer's mark is printed in one light grey: the LG letters, the face's eye and G, and the disc's rim, with the disc
    # itself only a little lighter than the face (gal1). So the ink is built from the logo's colours, not its alpha.
    c = np.asarray(lg).astype(float)
    A = c[..., 3] / 255.0
    ys, xs = np.where((c[..., 0] > 110) & (c[..., 1] < 90) & (A > 0.5))   # the red disc
    dcx, dcy, dr = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, (xs.max() - xs.min() + ys.max() - ys.min()) / 4
    yy, xx = np.mgrid[0:c.shape[0], 0:c.shape[1]]
    rr = np.hypot(xx - dcx, yy - dcy)
    inside = np.clip(dr + 0.5 - rr, 0, 1)
    rim = np.clip(rr - (dr * 0.89 - 0.5), 0, 1) * inside             # the disc's light rim, 11% of its radius
    face = (c[..., 1] / 255.0) * A * inside                           # the white face strokes (red has no green)
    ink = np.maximum.reduce([A * (1 - inside) * 0.95, face * 0.95, rim * 0.85, inside * 0.16])
    al = Image.fromarray((ink * 255).round().astype(np.uint8)).resize((w, h), Image.LANCZOS)
    img.paste(Image.new("RGB", (w, h), (150, 152, 156)), (round(X(b[0])), round(Y(b[1]))), al)
    b = ink_box((834, 237, 856, 251))                             # "8kg"
    set_text(img, "8kg", COND, (X(b[0]), Y(b[1]), X(b[2]), Y(b[3])), (200, 200, 205), 7)
    save(img, "drawer.jpg", 90)
    print("drawer: LG mark", [round(v, 1) for v in (mm_x(b[0]),)], "pocket is geometry")


def front_plate():
    """The front plate under the strip (20 -> 728 mm): its grey and the Inverter Direct Drive / 10 year mark."""
    s = 3.0
    h_mm = STRIP_BOT - PLATE_BOT
    img = Image.new("RGB", (round(W * s), round(h_mm * s)), PLATE_RGB)
    X = lambda px: mm_x(px) * s
    Y = lambda py: ((py - PY0) / PS - (850.0 - STRIP_BOT)) * s
    c = (206, 206, 210)
    for text, win, font, idx in [("INVERTER", (1276, 315, 1310, 322), AVENIR, 5), ("DIRECT DRIVE", (1270, 321, 1316, 331), AVENIR, 5),
                                 ("MOTOR", (1284, 330, 1302, 336), AVENIR, 5), ("WARRANTY", (1321, 333, 1343, 337), AVENIR, 5)]:
        b = ink_box(win)
        set_text(img, text, font, (X(b[0]), Y(b[1]), X(b[2]), Y(b[3])), c, idx)
    d = ImageDraw.Draw(img)
    d.line([(X(1318.5), Y(315.8)), (X(1318.5), Y(335.0))], fill=c, width=max(1, round(0.3 * s)))
    b = ink_box((1320, 314, 1328, 333))                           # the big "1"
    set_text(img, "1", ARIAL_B, (X(b[0]), Y(b[1]), X(b[2]), Y(b[3])), c)
    b = ink_box((1327, 313, 1344, 334))                           # the "0": a thick ring with the LG face inside
    cx_, cy_ = X((b[0] + b[2]) / 2), Y((b[1] + b[3]) / 2)
    rx, ry = (X(b[2]) - X(b[0])) / 2, (Y(b[3]) - Y(b[1])) / 2
    d.ellipse([cx_ - rx, cy_ - ry, cx_ + rx, cy_ + ry], outline=c, width=max(2, round(1.3 * s)))
    d.ellipse([cx_ - rx * 0.32, cy_ - ry * 0.32, cx_ + rx * 0.32, cy_ + ry * 0.32], fill=c)
    save(img.filter(ImageFilter.GaussianBlur(0.25)), "front.jpg", 88)


def knob_top():
    """Spun dark-chrome top of the dial: concentric rings, bright sectors (gal1 shows a cross of light on it)."""
    n = 512
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    cx = cy = n / 2
    r = np.hypot(xx - cx, yy - cy) / (n / 2)
    th = np.arctan2(yy - cy, xx - cx)
    v = 34 + 150 * (np.cos(th) ** 2) ** 6 * np.clip(r * 1.15, 0, 1)
    v += 6 * np.sin(r * 140) + 3 * np.sin(r * 53)
    v += 18 * np.exp(-((r - 0.97) / 0.03) ** 2)
    v = np.clip(v, 0, 255) * 0.85
    img = np.stack([v, v, v + 3], axis=2).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(img), "knob_top.jpg", 92)


# ── the energy label (gal2: this model's own label, 535 px for 68 mm) ────────────────────────────────────────────
LABEL_W_MM = 68.0


def label():
    src = Image.open(os.path.join(SRC, "gal2.jpg")).convert("RGB")
    A = np.asarray(src).astype(np.float32)
    L = A.mean(2)
    # the sticker's outer edge: the black frame
    sub = L[100:1250, 300:930]
    ys, xs = np.where(sub < 120)
    X0, Y0, X1, Y1 = 300 + xs.min(), 100 + ys.min(), 300 + xs.max() + 1, 100 + ys.max() + 1
    K = 12.0 * LABEL_W_MM / (X1 - X0)                     # photo px -> label px at 12 px/mm
    WL, HL = round((X1 - X0) * K), round((Y1 - Y0) * K)
    SS = 3
    P = lambda x, y: ((x - X0) * K * SS, (y - Y0) * K * SS)
    CX = (X0 + X1) / 2
    col = lambda x, y0, y1: L[y0:y1, x]
    # the base line of the arch: where the black band starts under the red (column 400, from 380 down)
    c = col(400, 380, 470)
    BASE = 380 + int(np.argmax(c < 60))
    # the black band's lower edge and the cream below it (column 640)
    c = col(X0 + 12, BASE + 5, 700)
    BAND_BOT = BASE + 5 + int(np.argmax(c > 150))
    # frame thickness (left edge, row 900)
    r = L[900, X0:X0 + 30]
    FR = int(np.argmax(r > 150))
    # the yellow inner arch: its width on the row just above BASE and its top on the centre column
    row = A[BASE - 6, X0:X1]
    yel = np.where((row[:, 0] > 200) & (row[:, 1] > 200) & (row[:, 2] < 190))[0]
    YX0, YX1 = X0 + yel.min(), X0 + yel.max() + 1
    c = A[BASE - 200:BASE, round(CX)]
    YTOP = BASE - 200 + int(np.argmax((c[:, 0] > 200) & (c[:, 1] > 200) & (c[:, 2] < 190)))
    # the energy box and its green header, the green footer
    c = A[BAND_BOT:BAND_BOT + 300, round(CX)]
    g = np.where((c[:, 1] > 110) & (c[:, 0] < 60))[0]
    GH0, GH1 = BAND_BOT + g.min(), BAND_BOT + g.max() + 1
    r = A[(GH0 + GH1) // 2, X0:X1]
    g = np.where((r[:, 1] > 110) & (r[:, 0] < 60))[0]
    GX0, GX1 = X0 + g.min(), X0 + g.max() + 1
    c = L[GH1:GH1 + 200, round(CX)]
    BOXB = GH1 + int(np.argmax(c < 80))                   # the box's bottom rule
    c = A[Y1 - 150:Y1, round(CX)]
    g = np.where((c[:, 1] > 110) & (c[:, 0] < 60))[0]
    FT0 = Y1 - 150 + g.min()
    print("label px", (X0, Y0, X1, Y1), "base", BASE, "band", BAND_BOT, "frame", FR, "yellow", (YX0, YX1, YTOP),
          "green head", (GX0, GH0, GX1, GH1), "box bottom", BOXB, "footer", FT0, "K", round(K, 4))

    RED = tuple(int(v) for v in np.median(A[BASE - 40:BASE - 20, X0 + 20:X0 + 40].reshape(-1, 3), 0))
    YEL = tuple(int(v) for v in np.median(A[BASE - 30:BASE - 10, round(CX) - 20:round(CX) + 20].reshape(-1, 3), 0))
    CREAM = tuple(int(v) for v in np.median(A[960:990, 700:880].reshape(-1, 3), 0))
    GREEN = tuple(int(v) for v in np.median(A[GH0 + 4:GH0 + 10, round(CX) - 150:round(CX) - 100].reshape(-1, 3), 0))
    INK = (14, 14, 16)
    print("label colours red", RED, "yellow", YEL, "cream", CREAM, "green", GREEN)

    can = Image.new("RGB", (WL * SS, HL * SS), INK)
    d = ImageDraw.Draw(can)
    # outside the die-cut stays black (the geometry cuts the arch); inside the frame:
    rx, ry = (X1 - X0) / 2 - FR, BASE - Y0 - FR
    (ax, ay), (bx, by) = P(CX - rx, BASE - ry), P(CX + rx, BASE + ry)
    d.pieslice((ax, ay, bx, by), 180, 360, fill=RED)
    yrx, yry = (YX1 - YX0) / 2, BASE - YTOP
    t = 3.2
    (ax, ay), (bx, by) = P(CX - yrx - t, BASE - yry - t), P(CX + yrx + t, BASE + yry + t)
    d.pieslice((ax, ay, bx, by), 180, 360, fill=INK)
    (ax, ay), (bx, by) = P(CX - yrx, BASE - yry), P(CX + yrx, BASE + yry)
    d.pieslice((ax, ay, bx, by), 180, 360, fill=YEL)
    d.rectangle((*P(X0 + FR, BASE), *P(X1 - FR, BAND_BOT)), fill=INK)
    d.rectangle((*P(X0 + FR, BAND_BOT), *P(X1 - FR, FT0)), fill=CREAM)
    d.rectangle((*P(X0 + FR, FT0), *P(X1 - FR, Y1 - FR)), fill=GREEN)
    # the energy box: a rounded black outline, the green header with rounded top corners
    bt = 3.4
    d.rounded_rectangle((*P(GX0 - bt, GH0 - bt), *P(GX1 + bt, BOXB + bt)), radius=16 * K * SS, fill=INK)
    d.rounded_rectangle((*P(GX0, GH0), *P(GX1, BOXB)), radius=13 * K * SS, fill=CREAM)
    d.rounded_rectangle((*P(GX0, GH0), *P(GX1, GH1 + 20)), radius=13 * K * SS, fill=GREEN)
    d.rectangle((*P(GX0, GH1), *P(GX1, GH1 + 21)), fill=CREAM)

    # the five stars: white components in the red band; each fitted with its tips (a regular 5-point star)
    redmask = (A[..., 0] > 180) & (A[..., 1] < 110)
    white = (L > 200).astype(np.uint8)
    white[BASE:] = 0
    n, lab, stats, cents = cv2.connectedComponentsWithStats(white, 8)
    stars = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 1500 or x < X0 or x + w > X1 or y > BASE:
            continue
        ring = cv2.dilate((lab == i).astype(np.uint8), np.ones((9, 9), np.uint8)) & ~(lab == i)
        if redmask[ring.astype(bool)].mean() < 0.5:
            continue
        ys_, xs_ = np.where(lab == i)
        cx_, cy_ = xs_.mean(), ys_.mean()
        rr = np.hypot(xs_ - cx_, ys_ - cy_)
        ang = np.degrees(np.arctan2(ys_ - cy_, xs_ - cx_))
        tip = ang[np.argmax(rr)]
        stars.append((cx_, cy_, rr.max(), tip))
    stars.sort()
    for k, (sx, sy, ro, tip) in enumerate(stars):
        pts = []
        for j in range(10):
            rad = ro if j % 2 == 0 else ro * 0.40
            a_ = np.radians(tip + j * 36)
            pts.append(P(sx + rad * np.cos(a_), sy + rad * np.sin(a_)))
        d.polygon(pts, fill=(255, 255, 255))
    print("stars", [(round(s[0]), round(s[1]), round(s[2], 1), round(s[3])) for s in stars])

    def put(text, font, win, dark=True, colour=None, thr=None):
        b = ink_box(win, dark=dark, V=L, k=4, thr=thr)
        (ax_, ay_), (bx_, by_) = P(b[0], b[1]), P(b[2], b[3])
        set_text(can, text, font, (ax_, ay_, bx_, by_), colour or (INK if dark else (255, 255, 255)))

    for (sx, sy, ro, tip), num in zip(stars, "12345"):
        put(num, ARIAL_B, (round(sx - ro * 0.33), round(sy - ro * 0.36), round(sx + ro * 0.33), round(sy + ro * 0.36)), thr=70)
    put("MORE STARS", ARIAL_B, (540, 348, 750, 378))
    put("MORE SAVINGS", ARIAL_B, (530, 378, 760, 410))
    put("2024 - 26", ARIAL_B, (420, 448, 865, 536), dark=False)
    put("Label Series", ARIAL_B, (505, 538, 780, 582), dark=False)
    put("ENERGY CONSUMPTION", ARIAL_BLK, (405, 642, 875, 684), dark=False)
    put("0.07", ARIAL_BLK, (412, 718, 640, 795))
    put("*", ARIAL_B, (642, 714, 664, 738))
    put("kWh/kg/cycle", ARIAL_B, (668, 760, 872, 794))
    put("Washing Machine", ARIAL_NB, (405, 843, 592, 878))
    put("Front Load", ARIAL_NB, (674, 843, 794, 876))
    put("LG", ARIAL_N, (405, 894, 446, 924), colour=(80, 80, 82))
    put("Load Capacity : 8.0 (kg)", ARIAL_NB, (405, 943, 652, 978))
    put("Model No.: FHB1208Z2M", ARIAL_NB, (405, 994, 660, 1024))
    put("INDIA", ARIAL_B, (603, 1043, 683, 1074))
    put("*Under test conditions, when tested in accordance with relevant standards.", ARIAL, (462, 1098, 868, 1118), dark=False)
    put("Actual energy consumption will depend on how the appliance being used.", ARIAL, (465, 1117, 866, 1137), dark=False)
    put("Issued by Bureau of Energy Efficiency  www.beeindia.gov.in", ARIAL, (500, 1132, 830, 1152), dark=False)

    # the BEE emblem: the photo, upscaled, in its circle
    em = L[FT0 + 2:Y1 - FR, X0 + FR:X0 + 120]
    ys_, xs_ = np.where(em > 140)
    ecx, ecy = X0 + FR + (xs_.min() + xs_.max()) / 2, FT0 + 2 + (ys_.min() + ys_.max()) / 2
    er = max(xs_.max() - xs_.min(), ys_.max() - ys_.min()) / 2 - 0.5
    crop = src.crop((round(ecx - er), round(ecy - er), round(ecx + er), round(ecy + er)))
    (ax, ay), (bx, by) = P(ecx - er, ecy - er), P(ecx + er, ecy + er)
    size = round(bx - ax)
    crop = crop.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    can.paste(crop, (round(ax), round(ay)), mask)

    lab_img = can.resize((WL, HL), Image.LANCZOS)
    save(lab_img, "label.jpg", 92)
    geo = {"w_mm": LABEL_W_MM, "h_mm": round((Y1 - Y0) / (X1 - X0) * LABEL_W_MM, 2),
           "arch_ry_mm": round((BASE - Y0) / (X1 - X0) * LABEL_W_MM, 2)}
    json.dump(geo, open(os.path.join(DEST, "label_geo.json"), "w"))
    print("label geometry", geo)
    if COMPARE:
        ref = src.crop((X0, Y0, X1, Y1)).resize((WL, HL), Image.LANCZOS)
        o = Image.new("RGB", (WL * 2 + 20, HL), (128, 128, 128))
        o.paste(ref, (0, 0))
        o.paste(lab_img, (WL + 20, 0))
        o.save(os.path.join(COMPARE, "label_compare.png"))


def stickers():
    """The two stickers LG's open-door photo (gal3) shows on the door seat, as photo crops (their print is too small to
    read, so it is not redrawn). Corners measured on gal3 (photo px, clockwise from top-left)."""
    src = Image.open(os.path.join(SRC, "gal3.jpg")).convert("RGB")
    a = np.asarray(src)
    out = {}
    for name, quad, mm in [("sticker_top.jpg", [(1200.0, 377.5), (1280.0, 420.0), (1269.2, 447.5), (1186.7, 404.7)], (77.0, 25.8)),
                           ("sticker_side.jpg", [(1318.3, 700.0), (1350.3, 710.0), (1300.0, 805.8), (1267.5, 795.0)], (28.5, 92.0))]:
        k = 8.0                                                    # px per mm in the output (upscaled; the source is soft)
        w, h = round(mm[0] * k), round(mm[1] * k)
        M = cv2.getPerspectiveTransform(np.float32(quad), np.float32([(0, 0), (w, 0), (w, h), (0, h)]))
        warped = cv2.warpPerspective(a, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        save(Image.fromarray(warped), name, 86)
        out[name] = quad
    return out


def drum_texture():
    """Stainless drum wall, one 160 x 80 mm tile at 6.4 px/mm: round holes 5 mm across on a 10 mm staggered pitch (gal3 shows
    them on the drum's floor at about that size), each with a pressed rim, brushed steel between. The steel's grey is set so
    the drum seen through the door glass straight on matches gal1 there (the exporter keeps a textured colour white)."""
    w, h = 1024, 512
    rng = np.random.default_rng(5)
    base = np.full((h, w), 112.0) + rng.normal(0, 2.5, (h, w))
    base += 4 * np.sin(np.arange(w)[None, :] / 3.0)              # faint brushing
    img = Image.fromarray(base.clip(0, 255).astype(np.uint8)).convert("RGB")
    d = ImageDraw.Draw(img)
    pitch, r = 64, 16
    for j, y in enumerate(range(pitch // 2, h, pitch)):
        for x in range(pitch // 4 + (pitch // 2 if j % 2 else 0), w + pitch, pitch):
            xx = x % w
            for dx in (0, -w, w):
                cx_ = xx + dx
                d.ellipse([cx_ - r - 3, y - r - 3, cx_ + r + 3, y + r + 3], fill=(140, 141, 143))
                d.ellipse([cx_ - r, y - r, cx_ + r, y + r], fill=(30, 31, 34))
                d.ellipse([cx_ - r + 5, y - r + 5, cx_ + r - 3, y + r - 3], fill=(14, 15, 17))
    save(img.filter(ImageFilter.GaussianBlur(0.8)), "drum.jpg", 88)


def flatten_light(im, keep=0.7):
    """Divide out a quadratic fit of the photo's log luminance (the studio light), keeping `keep` of the relief."""
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


def sides_and_rear():
    """Side panels from LG's side photos (the ribbed panel only: from under the top plate to the cabinet's lower edge,
    from the front frame's seam to the back), the studio light taken out; the rear with the hoses and cord painted out."""
    # DZ-10 shows the machine's right side, front at the left; DZ-11 the left side, front at the right. Rows: the top
    # plate's lower edge (140), the cabinet's lower edge (1215). Columns: the front frame's seam and the back edge.
    for name, f, (x0, x1) in (("side_r.jpg", "DZ-10.jpg", (683, 1359)), ("side_l.jpg", "DZ-11.jpg", (660, 1346))):
        im = Image.open(os.path.join(SRC, f)).convert("RGB").crop((x0, 141, x1, 1215))
        flat, mean = flatten_light(im, 0.7)
        target = PLATE_RGB[0] * 1.08                              # the painted side reads a little lighter than the front
        flat = (flat.astype(np.float32) * (target / mean)).clip(0, 255).astype(np.uint8)
        side = Image.fromarray(flat).resize((round((x1 - x0) * 0.75), round(1074 * 0.75)), Image.LANCZOS)
        save(side, name, 86)

    paths = json.load(open(os.path.join(DEST, "rear_paths.json")))
    im = Image.open(os.path.join(SRC, "DZ-12.jpg")).convert("RGB").crop((596, 85, 1413, 1243))
    arr = np.asarray(im).copy()
    lum = arr.astype(np.float32).mean(axis=2)
    corridor = np.zeros(arr.shape[:2], np.uint8)
    # corridors only a little wider than the hose (33 px) and the cord (9 px): the traces sit on their centre lines, and the
    # back's own pressed ribs beside them must stay
    for key, rad in (("hose", 26), ("cord", 12), ("loop", 30)):
        cv2.polylines(corridor, [np.array(paths[key], np.float32).round().astype(np.int32)], False, 255, rad * 2)
    cv2.circle(corridor, (406, 140), 40, 255, -1)
    px, py = paths["plug"]
    cv2.circle(corridor, (round(px), round(py)), 48, 255, -1)
    cv2.circle(corridor, (783, 1062), 30, 255, -1)
    for (bx, by) in paths["bolts"]:                                  # the transit bolts stay
        cv2.circle(corridor, (bx, by), 36, 0, -1)
    plate_core = np.zeros(arr.shape[:2], np.uint8)
    cv2.rectangle(plate_core, (176, 312), (644, 984), 255, -1)
    mask = ((lum > 52) & (corridor > 0) & (plate_core == 0)).astype(np.uint8) * 255
    loop = np.zeros_like(mask)
    cv2.polylines(loop, [np.array(paths["loop"], np.float32).round().astype(np.int32)], False, 255, 46)
    mask[(loop > 0) & (plate_core > 0)] = 255
    mask[(loop > 0) & (np.arange(arr.shape[0])[:, None] > 270) & (np.arange(arr.shape[0])[:, None] < 372)] = 255
    mask[(loop > 0) & (lum > 52)] = 255
    cv2.rectangle(mask, (20, 300), (110, 360), 255, -1)            # the hose clamp and label on the left
    cv2.rectangle(mask, (700, 320), (780, 370), 255, -1)           # the clip on the right
    cv2.rectangle(mask, (24, 480), (100, 600), 255, -1)            # the hose holder at bottom left
    mask[:, :14] = 0
    mask[:, -14:] = 0
    mask = cv2.dilate(mask, np.ones((9, 9), np.uint8))
    mask[:, :10] = 0
    mask[:, -10:] = 0
    # The fill must not draw on the cabinet's bright outer edges: inpaint from a copy whose outer columns carry the dark
    # flange beside them (columns 12 and 800), then put the edges back.
    src = arr.copy()
    src[:, :12] = arr[:, 12:13]
    src[:, 801:] = arr[:, 800:801]
    out = cv2.inpaint(src, mask, 9, cv2.INPAINT_NS)
    body = cv2.GaussianBlur(out, (0, 0), 6)
    plate = np.zeros(mask.shape, np.uint8)
    cv2.rectangle(plate, (150, 285), (670, 1010), 255, -1)
    fill = (mask > 0) & (plate == 0)
    out[fill] = (body[fill] * 0.6 + out[fill] * 0.4).astype(np.uint8)
    out[:, :12] = arr[:, :12]
    out[:, 801:] = arr[:, 801:]
    save(Image.fromarray(out), "rear.jpg", 86)


def hose_texture():
    """One rib of the drain hose per tile (the builder repeats it every 4.0 mm, as measured on LG's rear photo): a light crest
    and a dark groove, grey as the hose in that photo (crest about 150, groove about 85)."""
    w, h = 64, 16
    x = np.arange(w) / w
    v = 118 + 34 * np.cos(2 * np.pi * x)
    a = np.repeat(v[None, :], h, 0)
    img = Image.fromarray(np.stack([a, a + 2, a + 5], -1).clip(0, 255).astype(np.uint8))
    save(img, "hose.jpg", 92)


def compare_strip(panel):
    """gal1's strip, resampled to 7.2 px/mm, over the redrawn one."""
    x0, x1 = PX0 + DRAWER_W * PS, PX0 + W * PS
    y0, y1 = PY0 + (850 - STRIP_TOP) * PS, PY0 + (850 - STRIP_BOT) * PS
    ref = PHOTO.transform(panel.size, Image.EXTENT, (x0, y0, x1, y1), Image.BICUBIC)
    o = Image.new("RGB", (panel.width, panel.height * 2 + 6), "white")
    o.paste(ref, (0, 0))
    o.paste(panel, (0, panel.height + 6))
    o.save(os.path.join(COMPARE, "strip_compare.png"))
    a = np.asarray(ref.convert("L")).astype(float)
    b = np.asarray(panel.convert("L")).astype(float)
    norm = lambda v: np.clip((v - np.percentile(v, 5)) / (np.percentile(v, 99.5) - np.percentile(v, 5)) * 255, 0, 255)
    Image.fromarray(np.stack([norm(b), norm(a), np.zeros_like(a)], 2).astype(np.uint8)).save(os.path.join(COMPARE, "strip_overlay.png"))


if __name__ == "__main__":
    pan = panel_strip()
    drawer_face()
    front_plate()
    knob_top()
    label()
    stickers()
    drum_texture()
    hose_texture()
    sides_and_rear()
    for old in ("label.png", "sticker_top_old.jpg"):
        if os.path.exists(os.path.join(DEST, old)):
            os.remove(os.path.join(DEST, old))
    if COMPARE:
        compare_strip(pan)
