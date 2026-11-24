"""Textures for the Haier HWM70-306ES5N1 7 kg top-load washing machine with Ultra Fresh Air (Brown Grey).

usage: python3 tex_haier_hwm70es5.py <photos dir> <logos dir> <out dir> [--debug <dir>]
  photos:  haier_hwm70es5/haier/  Haier India's own gallery for this body (its HWM70-306ES5 page, the same renders
           Sangeetha's listing of HWM70-306ES5N1 shows; 1200 x 1200):
             W020231128548357025872_1200.jpg  the top seen from straight above with the lid up: the control panel and the
                                              drum, pulsator and filters (2.20 px per mm across: the top cover's 520 mm is
                                              photo x 21-1176 at row 300; framed the same as the HWM70-306S8's render of the
                                              same body, within 2 px)
  logos:   haier.png (the Haier word mark)
  writes <out dir>/haier_hwm70es5/*

The control panel is drawn new: the strip is plain gloss black (this panel has no grey field, no ribs and no display);
every word is set again in Arial, fitted to the box the word's ink has in Haier's photo, in the photo's own colour; the
Haier mark is the brand's own outline; the rings round the two round keys, the frames of the two square keys, the LED
lines and rules are drawn as shapes at the places, sizes and stroke widths fitted on the photo (circle fits, line
centroids); the cup, the programme diamonds and the two key symbols are drawn as shapes read off the photo's ink; the small
tub icons and the four feature marks are the photo's own ink cut out of a cubic enlargement with a hard threshold, and the child-lock face is drawn from its outline.
The face is the black strip between the top cover's front lip and the silver trim in front of the lid: photo x 48-1146,
y 406-566 (the same box as the HWM70-306S8's panel: the two renders share the body).
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

args = list(sys.argv[1:])
DEBUG = None
if "--debug" in args:
    DEBUG = args[args.index("--debug") + 1]
    del args[args.index("--debug"):args.index("--debug") + 2]
    os.makedirs(DEBUG, exist_ok=True)
PHOTOS, LOGOS, OUT = args[:3]
P = os.path.join(PHOTOS, "haier_hwm70es5", "haier")
D = os.path.join(OUT, "haier_hwm70es5")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(70365)
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
ARIAL_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
ARIAL_N = "/System/Library/Fonts/Supplemental/Arial Narrow.ttf"
ARIAL_NB = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def load(name):
    return np.asarray(Image.open(os.path.join(P, name)).convert("RGB")).astype(np.float32)


# ───────────────────────── control panel ─────────────────────────
TOP = "W020231128548357025872_1200.jpg"
top = load(TOP)
X0, Y0, X1, Y1 = 48, 406, 1146, 566          # the black strip in the photo (its front edge arcs down to 561 at the middle)
PX_MM = 7.2                                   # the panel texture's px per mm (panel.jpg; the close-up decals are drawn at 12)


def T(x, y):
    return int(round((x - X0) * S)), int(round((y - Y0) * S))


def put(alpha, colour, x0, y0):
    h, w = alpha.shape
    xs0, ys0 = max(0, x0), max(0, y0)
    xs1, ys1 = min(CW, x0 + w), min(CH, y0 + h)
    if xs1 <= xs0 or ys1 <= ys0:
        return
    a = alpha[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
    canvas[ys0:ys1, xs0:xs1] = canvas[ys0:ys1, xs0:xs1] * (1 - a) + np.array(colour, np.float32) * a


def ink(win, thr, colour=None, soft=6.0):
    """copy the photo's ink inside a photo window as a hard-edged shape (flat colour, or the photo's own per pixel)"""
    x0, y0 = T(win[0], win[1])
    x1, y1 = T(win[2], win[3])
    L = blum[y0:y1, x0:x1]
    a = np.clip((L - thr) / soft + 0.5, 0, 1).astype(np.float32)
    if colour == "photo":
        # the photo's own colour per pixel, its cut edge lifted towards the ink's bright core (the enlargement softens
        # the edge pixels darker than the ink they belong to)
        px = big[y0:y1, x0:x1]
        lum = px.mean(2, keepdims=True)
        sel = lum[a > 0.9]
        hiL = np.percentile(sel, 85) if len(sel) else 200.0
        lift = np.clip(hiL / np.maximum(lum, 1), 1, 1.4)
        a3 = a[..., None]
        canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - a3) + np.minimum(px * lift, 255) * a3
        return
    if colour is None:
        px = big[y0:y1, x0:x1].reshape(-1, 3)
        sel = px[a.reshape(-1) > 0.9]
        colour = tuple(np.percentile(sel, 80, axis=0)) if len(sel) else (230, 230, 230)
    put(a, colour, x0, y0)
    return colour


def sample(win, thr=60):
    """the bright colour of the ink in a photo window (photo px, not enlarged)"""
    x0, y0, x1, y1 = win
    px = top[y0:y1, x0:x1].reshape(-1, 3)
    L = px.mean(1)
    sel = px[L >= max(thr, np.percentile(L, 90))]
    return tuple(sel.mean(0)) if len(sel) else (200, 200, 200)


def shape(bbox, colour, draw, k=4):
    """draw shapes (photo coordinates) at k x supersampling over bbox = photo (x0, y0, x1, y1); tf maps photo -> patch"""
    bx0, by0 = T(bbox[0], bbox[1])
    bx1, by1 = T(bbox[2], bbox[3])
    w, h = (bx1 - bx0) * k, (by1 - by0) * k
    img = Image.new("L", (w, h), 0)
    tf = lambda x, y: (((x - X0) * S - bx0) * k, ((y - Y0) * S - by0) * k)
    draw(ImageDraw.Draw(img), tf, S * k)
    a = cv2.resize(np.asarray(img).astype(np.float32) / 255, (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_AREA)
    put(a, colour, bx0, by0)


def vline(x, y0, y1, width, colour):
    shape((x - width - 2, y0 - 2, x + width + 2, y1 + 2), colour,
          lambda d, tf, s: d.rectangle([*tf(x - width / 2, y0), *tf(x + width / 2, y1)], fill=255))


def hline(y, x0, x1, width, colour):
    shape((x0 - 2, y - width - 2, x1 + 2, y + width + 2), colour,
          lambda d, tf, s: d.rectangle([*tf(x0, y - width / 2), *tf(x1, y + width / 2)], fill=255))


def ring(cx, cy, r, width, colour):
    def dr(d, tf, s):
        a0, b0 = tf(cx - r - width / 2, cy - r - width / 2)
        a1, b1 = tf(cx + r + width / 2, cy + r + width / 2)
        d.ellipse([a0, b0, a1, b1], fill=255)
        a0, b0 = tf(cx - r + width / 2, cy - r + width / 2)
        a1, b1 = tf(cx + r - width / 2, cy + r - width / 2)
        d.ellipse([a0, b0, a1, b1], fill=0)
    shape((cx - r - width - 2, cy - r - width - 2, cx + r + width + 2, cy + r + width + 2), colour, dr)


def frame(x0, y0, x1, y1, rad, width, colour):
    """a rounded-rectangle outline; the box is the frame's outer edge"""
    def dr(d, tf, s):
        d.rounded_rectangle([*tf(x0, y0), *tf(x1, y1)], radius=rad * s, fill=255)
        d.rounded_rectangle([*tf(x0 + width, y0 + width), *tf(x1 - width, y1 - width)], radius=max(rad - width, 0) * s, fill=0)
    shape((x0 - 2, y0 - 2, x1 + 2, y1 + 2), colour, dr)


# The child-lock icon is a baby face (outline with ears, a hair fringe, two eyes): on Haier's top photo it is only 12 x 10
# px. Its outline was traced for the HWM70-306S8 (tex_haier_hwm70.py) from a sharper render of this same later panel
# (no display; water levels 41/33/24/12 and 46/37/29/18 L, the panel this model carries) and agrees with this photo's
# icon; drawn as outlines (x, y as fractions of the icon's box; even-odd fill) in the box the icon's ink takes here.
CHILD_LOCK = [
    [[0.464, 0.0], [0.32, 0.051], [0.22, 0.145], [0.141, 0.266], [0.128, 0.28], [0.081, 0.309], [0.026, 0.382], [0.01, 0.419],
     [0.004, 0.444], [0.0, 0.511], [0.006, 0.562], [0.018, 0.597], [0.088, 0.688], [0.155, 0.739], [0.232, 0.847], [0.283, 0.911],
     [0.318, 0.935], [0.399, 0.973], [0.473, 0.995], [0.507, 0.997], [0.605, 0.978], [0.654, 0.957], [0.697, 0.93], [0.768, 0.866],
     [0.792, 0.833], [0.804, 0.809], [0.87, 0.718], [0.939, 0.664], [0.972, 0.621], [0.994, 0.57], [0.998, 0.543], [0.994, 0.441],
     [0.978, 0.392], [0.906, 0.301], [0.845, 0.253], [0.786, 0.161], [0.758, 0.126], [0.67, 0.051], [0.619, 0.022], [0.578, 0.011],
     [0.536, 0.011]],
    [[0.083, 0.478], [0.092, 0.449], [0.12, 0.411], [0.153, 0.384], [0.191, 0.374], [0.257, 0.371], [0.303, 0.36], [0.336, 0.339],
     [0.375, 0.298], [0.413, 0.293], [0.483, 0.315], [0.525, 0.352], [0.554, 0.366], [0.625, 0.371], [0.644, 0.376], [0.703, 0.374],
     [0.76, 0.384], [0.843, 0.387], [0.874, 0.395], [0.896, 0.419], [0.902, 0.435], [0.912, 0.481], [0.912, 0.516], [0.902, 0.565],
     [0.888, 0.586], [0.839, 0.61], [0.804, 0.637], [0.77, 0.685], [0.743, 0.745], [0.664, 0.841], [0.637, 0.858], [0.583, 0.871],
     [0.53, 0.892], [0.485, 0.895], [0.367, 0.855], [0.34, 0.833], [0.31, 0.798], [0.281, 0.774], [0.265, 0.753], [0.242, 0.694],
     [0.198, 0.634], [0.167, 0.61], [0.116, 0.583], [0.102, 0.567], [0.092, 0.548], [0.084, 0.522]],
    [[0.456, 0.156], [0.468, 0.137], [0.485, 0.126], [0.507, 0.121], [0.538, 0.121], [0.595, 0.132], [0.619, 0.145], [0.662, 0.191],
     [0.686, 0.226], [0.69, 0.237], [0.69, 0.261], [0.68, 0.28], [0.658, 0.293], [0.623, 0.293], [0.583, 0.282], [0.552, 0.263],
     [0.515, 0.223], [0.472, 0.191], [0.458, 0.172]],
    [[0.344, 0.462], [0.328, 0.47], [0.314, 0.492], [0.308, 0.516], [0.308, 0.54], [0.314, 0.562], [0.324, 0.578], [0.34, 0.589],
     [0.356, 0.589], [0.371, 0.573], [0.377, 0.556], [0.379, 0.516], [0.375, 0.489], [0.369, 0.476], [0.36, 0.465]],
    [[0.682, 0.457], [0.666, 0.454], [0.652, 0.462], [0.639, 0.484], [0.631, 0.505], [0.627, 0.53], [0.629, 0.554], [0.633, 0.565],
     [0.644, 0.578], [0.66, 0.578], [0.672, 0.57], [0.682, 0.556], [0.692, 0.532], [0.697, 0.505], [0.697, 0.484], [0.692, 0.468]],
]


def ink_box(win, thr):
    x0, y0 = T(win[0], win[1])
    x1, y1 = T(win[2], win[3])
    m = blum[y0:y1, x0:x1] > thr
    ys, xs = np.where(m)
    if not len(xs):
        raise SystemExit(f"no ink in {win}")
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def glyph(win, thr, polys):
    """draw an outline glyph (even-odd) in the box its ink takes in a photo window, in the photo's ink colour"""
    bx0, by0, bx1, by1 = ink_box(win, thr)
    px = big[by0:by1, bx0:bx1].reshape(-1, 3)
    L = px.mean(1)
    colour = tuple(px[L >= np.percentile(L, 92)].mean(0))
    k = 8
    w, h = (bx1 - bx0) * k, (by1 - by0) * k
    a = np.zeros((h, w), bool)
    for p in polys:
        m = Image.new("1", (w, h), 0)
        ImageDraw.Draw(m).polygon([(x * w, y * h) for x, y in p], fill=1)
        a ^= np.asarray(m)
    a = cv2.resize(a.astype(np.float32), (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_AREA)
    put(a, colour, bx0, by0)


def render(text, font, px=200):
    f = ImageFont.truetype(font, px)
    img = Image.new("L", (int(f.getlength(text)) + px, px * 2), 0)
    ImageDraw.Draw(img).text((px // 2, px * 1.5), text, font=f, fill=255, anchor="ls")
    a = np.asarray(img).astype(np.float32) / 255
    ys, xs = np.where(a > 0.02)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


BOXES = []


def word(text, win, font=ARIAL_B, thr=110, colour=None, box=None):
    """set the word again sharp in the box its ink takes in the photo (the canvas starts black: nothing of the photo's
    word is on it); box: the ink box given in photo px where a ring's edge shares the window"""
    if box:
        bx0, by0 = T(box[0], box[1])
        bx1, by1 = T(box[2], box[3])
    else:
        bx0, by0, bx1, by1 = ink_box(win, thr)
    if colour is None:
        px = big[by0:by1, bx0:bx1].reshape(-1, 3)
        L = px.mean(1)
        colour = tuple(px[L >= np.percentile(L, 92)].mean(0))
    a = render(text, font)
    a = cv2.resize(a, (bx1 - bx0, by1 - by0), interpolation=cv2.INTER_AREA)
    put(a, colour, bx0, by0)
    BOXES.append((text, bx0 / S + X0, by0 / S + Y0, bx1 / S + X0, by1 / S + Y0))
    return (bx0, by0, bx1, by1)


def draw_panel(px_mm):
    """the control panel drawn at px_mm px per mm; returns the canvas"""
    global S, CW, CH, big, blum, canvas
    S = px_mm / 2.2                               # texture px per photo px (2.2 photo px per mm)
    CW, CH = int(round((X1 - X0) * S)), int(round((Y1 - Y0) * S))
    big = cv2.resize(top[Y0 - 4:Y1 + 4, X0 - 4:X1 + 4], None, fx=S, fy=S, interpolation=cv2.INTER_CUBIC)
    o = int(round(4 * S))
    big = big[o:o + CH, o:o + CW]
    blum = big.mean(2)
    BOXES.clear()
    canvas = np.zeros((CH, CW, 3), np.float32)
    # the strip: gloss black all over (the photo reads 0-6 across it); the viewer lifts gloss black, so a near black
    canvas[...] = (9, 9, 10)
    canvas += rng.normal(0, 0.5, (CH, CW, 1))

    WHITE = sample((402, 423, 436, 431))          # the print's grey-white (the "Detergent" heading's bright ink)
    # the Haier mark: the brand's own outline, light grey as in the photo (227), fitted to the photo's box
    logo = np.asarray(Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")).astype(np.float32)[..., 3] / 255
    ys, xs = np.where(logo > 0.05)
    logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    lb = ink_box((150, 440, 262, 473), 120)
    put(cv2.resize(logo, (lb[2] - lb[0], lb[3] - lb[1]), interpolation=cv2.INTER_AREA), sample((163, 444, 255, 472), 150), lb[0], lb[1])
    word("7.0kg", (205, 473, 258, 492), font=ARIAL, thr=110)

    # the water-level table: Detergent (tub icon + litres), Flash and Normally on, the LED line down to the Water Level key
    word("Detergent", (398, 420, 440, 432))
    rows = [(432, 443), (449, 460), (466, 477), (483, 494)]
    for (y0, y1), det in zip(rows, ["41L-46L", "33L-37L", "24L-29L", "12L-18L"]):
        ink((396, y0, 413, y1), 70, colour="photo", soft=10)        # the tub icon (cyan water in the upper ones)
        word(det, (413, y0, 442, y1), thr=100)
    vline(443.67, 434, 493, 1.6, sample((442, 434, 446, 493)))
    word("Flash", (500, 418, 525, 428))
    word("Normally on", (534, 418, 582, 429))
    for (y0, y1), a, b in zip([(428, 441), (446, 459), (463, 476), (480, 493)], ["41L", "33L", "24L", "12L"], ["46L", "37L", "29L", "18L"]):
        word(a, (500, y0, 526, y1))
        word(b, (546, y0, 572, y1))
    blue = (158, 204, 224)                         # the rings' pale blue (their core on the photo; mean 165/179/187 with the edge)
    vline(540.76, 429, 503, 1.6, sample((538, 440, 544, 495)))
    ring(536.97, 520.30, 17.98, 1.35, blue)        # the fit's 1.75 px stroke counts the soft edge
    # the cup mark inside the Water Level ring (read off the photo's ink: walls at x 529.0 and 545.3 from y 511 to the
    # rounded bottom at 528.5, a wavy water line at 514.3-515.3, three dashes at x 537.1, y 512.3, 518.2 and 523.5)
    def cup(d, tf, s):
        sw = int(round(1.5 * s))
        d.line([tf(529.0, 510.8), tf(529.0, 525.5), tf(530.2, 527.7), tf(532.2, 528.5), tf(542.1, 528.5), tf(544.1, 527.7), tf(545.3, 525.5), tf(545.3, 510.2)], fill=255, width=sw, joint="curve")
        d.line([tf(529.5, 514.3), tf(535.0, 514.3), tf(537.2, 514.6), tf(539.2, 515.3), tf(545.0, 515.3)], fill=255, width=int(round(1.3 * s)), joint="curve")
        for y in (512.3, 518.2, 523.5):
            d.rounded_rectangle([*tf(535.6, y - 0.65), *tf(538.6, y + 0.65)], radius=0.6 * s, fill=255)
    shape((524, 507, 551, 533), sample((527, 509, 548, 530), 120), cup)
    word("Water Level", None, box=(510, 538, 564.5, 545.6))       # ink box from the photo's letters (the ring ends at 539)
    # the child-lock link between the two round keys: a rule, the face, the words, a rule
    hline(528.77, 568, 586, 1.2, WHITE)
    hline(528.34, 614, 632, 1.2, WHITE)
    glyph((592, 515, 609, 527), 100, CHILD_LOCK)
    word("Child Lock", None, box=(586.5, 529.3, 613.5, 534.3))   # its letters' ink box, under the rules' line

    # programme list: the steps, two LED lines down to the Program key, the programmes, the child-lock column
    for txt, win in [("Wash", (620, 428, 653, 440)), ("Rinse", (619, 445, 653, 457)), ("Spin", (626, 462, 653, 476)),
                     ("Tub Dry", (610, 478, 654, 492)), ("Smart", (678, 428, 713, 440)), ("Soak", (678, 445, 708, 457)),
                     ("Delicate", (678, 462, 722, 476)), ("Quick", (678, 479, 709, 492))]:
        word(txt, win)
    for x in (661.69, 669.54):
        vline(x, 428, 504, 1.25, sample((int(x) - 2, 440, int(x) + 3, 495)))
    ring(665.74, 520.37, 18.07, 1.35, blue)
    # the programme mark: four diamond outlines round the ring's centre (read off the photo's ink: centres (665.7, 514.0),
    # (659.6, 519.5), (672.3, 519.5), (665.7, 524.8), half-diagonal 4.1 px, stroke 1.4)
    def diamonds(d, tf, s):
        for cx, cy in ((665.7, 514.0), (659.6, 519.5), (672.3, 519.5), (665.7, 524.8)):
            h = 4.1
            d.line([tf(cx, cy - h), tf(cx + h, cy), tf(cx, cy + h), tf(cx - h, cy), tf(cx, cy - h), tf(cx + h, cy)], fill=255, width=int(round(1.4 * s)), joint="curve")
    shape((652, 507, 680, 533), sample((654, 509, 679, 530), 120), diamonds)
    word("Program", None, box=(647, 538.3, 686.2, 547.2))
    vline(732.38, 429, 490, 1.65, sample((731, 440, 734, 488)))
    ink((726, 428, 731, 440), 60, colour="photo", soft=8)            # its small blue LED at the top
    word("Child Lock", (735, 427, 790, 441))
    for y, x0, x1 in ((450.71, 735, 745), (468.0, 734, 744), (483.66, 734, 744)):
        hline(y, x0, x1, 1.25, WHITE)

    # the two square keys: start/pause (pale blue frame, blue symbol) and power (red frame and symbol)
    frame(780, 489, 821, 521, 5.0, 1.45, (150, 208, 222))      # the frame's core colour on the photo (its mean is 156/191/202 with the edge)
    # the play/pause mark: a triangle outline and two bars (fitted: triangle ink x 790-804, y 496-515, its left edge at
    # 791.7; bars at x 806.72 and 811.61, 2.4 px wide, y 495.5-514.5)
    PLAY = (122, 207, 216)
    def play(d, tf, s):
        d.line([tf(791.7, 497.3), tf(802.6, 505.5), tf(791.7, 513.7), tf(791.7, 497.3), tf(802.6, 505.5)], fill=255, width=int(round(1.9 * s)), joint="curve")
        for x in (806.72, 811.61):
            d.rounded_rectangle([*tf(x - 1.15, 495.6), *tf(x + 1.15, 514.4)], radius=0.5 * s, fill=255)
    shape((786, 492, 816, 518), PLAY, play)
    frame(829, 446, 871, 478, 5.0, 1.45, (226, 100, 112))      # likewise (mean 206/104/116)
    # the power mark: an arc open 60 degrees at the top (fitted: centre 850.20, 464.52, r 9.90) and its bar (x 850.33,
    # y 451-464, 2.4 px wide)
    POWER = (232, 112, 120)
    def power(d, tf, s):
        r, cx, cy, sw = 9.9, 850.2, 464.52, 2.2
        d.arc([*tf(cx - r - sw / 2, cy - r - sw / 2), *tf(cx + r + sw / 2, cy + r + sw / 2)], 300, 240, fill=255, width=int(round(sw * s)))
        d.rounded_rectangle([*tf(850.33 - 1.15, 451.2), *tf(850.33 + 1.15, 463.8)], radius=1.1 * s, fill=255)
    shape((835, 448, 866, 477), POWER, power)

    # the four feature marks and their names, light grey, with the rules between them
    for win in ((924, 441, 953, 466), (963, 441, 994, 466), (1004, 441, 1032, 466), (1044, 441, 1080, 466)):
        ink(win, 80, colour="photo", soft=10)
    for x in (958.5, 997.0, 1039.5):
        vline(x, 448, 467, 1.4, sample((int(x) - 2, 448, int(x) + 3, 467)))
    for txt, win in [("FRESH AIR", (923, 466, 953, 474)), ("NZP", (966, 466, 983, 474)), ("AUTO RESTART", (998, 466, 1038, 474)),
                     ("OCEANUS WAVE", (1040, 466, 1083, 474))]:
        word(txt, win, font=ARIAL_NB, thr=70)
    return canvas


canvas = draw_panel(PX_MM)
pan = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
save(pan, "panel.jpg", q=90)
if DEBUG:
    ph = Image.fromarray(np.clip(big, 0, 255).astype(np.uint8))
    st = Image.new("RGB", (CW, CH * 2))
    st.paste(ph, (0, 0)); st.paste(pan, (0, CH))
    st.save(os.path.join(DEBUG, "panel_compare.jpg"), quality=85)
    with open(os.path.join(DEBUG, "boxes.txt"), "w") as f:
        for b in BOXES:
            f.write("%-14s x %.1f-%.1f y %.1f-%.1f\n" % (b[0], b[1], b[3], b[2], b[4]))

# ───────────────────────── the rear ridge print: "ULTRA FRESH AIR" with the fan mark ─────────────────────────
# Haier's lid-shut photo of this body: the print is grey on the ridge's black face, about 56 mm long with 3.6 mm tall
# letters and the fan mark 4.8 mm across left of it, as on the HWM70-306S8 (same render). Drawn at 16 px/mm as a decal.
R = 16
rw, rh = int(64 * R), int(7 * R)
dec = np.zeros((rh, rw), np.float32)
t = render("ULTRA FRESH AIR", ARIAL_B)
th = int(3.6 * R)
t = cv2.resize(t, (int(t.shape[1] * th / t.shape[0]), th), interpolation=cv2.INTER_AREA)
x = int(8 * R)
dec[(rh - th) // 2:(rh - th) // 2 + th, x:x + t.shape[1]] = np.maximum(dec[(rh - th) // 2:(rh - th) // 2 + th, x:x + t.shape[1]], t)
# the fan mark: the panel's own FRESH AIR mark (the same mark), cut from the enlarged photo
fx0_, fy0_ = T(925, 443)
fx1_, fy1_ = T(951, 466)
fan = np.clip((blum[fy0_:fy1_, fx0_:fx1_] - 80) / 12 + 0.5, 0, 1)
ys, xs = np.where(fan > 0.2)
fan = fan[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
fs_ = int(4.8 * R)
fan = cv2.resize(fan, (fs_, int(fan.shape[0] * fs_ / fan.shape[1])), interpolation=cv2.INTER_AREA)
fy = (rh - fan.shape[0]) // 2
dec[fy:fy + fan.shape[0], int(1.5 * R):int(1.5 * R) + fan.shape[1]] = fan
ys, xs = np.where(dec > 0.02)
dec = dec[:, :xs.max() + int(0.5 * R)]
rgba = np.zeros(dec.shape + (4,), np.uint8)
rgba[..., :3] = 150
rgba[..., 3] = np.clip(dec * 255, 0, 255).astype(np.uint8)
save(Image.fromarray(rgba, "RGBA").quantize(16, method=Image.Quantize.FASTOCTREE), "ridge_print.png")
print("ridge print", dec.shape[1] / R, "x", dec.shape[0] / R, "mm")

# ───────────────────────── inside ─────────────────────────
# the pulsator: Haier's lid-up top photo of this model. The blue dish is seen square-on but the photo cuts its far edge off
# (the dish runs past the photo's top). Its rim is fitted with a circle on the rows the photo has; the missing strip at
# the far edge is filled from the dish turned 180 degrees about its centre (the dish and its four vanes repeat every
# quarter turn).
blue_m = (top[..., 2] - top[..., 0] > 45) & (np.arange(top.shape[0])[:, None] < 360)
cols = np.arange(top.shape[1])
edge = []
for y in range(60, 340, 4):                       # the dish's left and right rims on each row (the longest blue run)
    row = blue_m[y]
    runs, st = [], None
    for i, v in enumerate(list(row) + [False]):
        if v and st is None:
            st = i
        if not v and st is not None:
            runs.append((st, i)); st = None
    if runs:
        a, b = max(runs, key=lambda r: r[1] - r[0])
        if b - a > 120:
            edge += [(a, y), (b, y)]
E = np.array(edge, np.float64)
A_ = np.c_[E[:, 0], E[:, 1], np.ones(len(E))]
sol = np.linalg.lstsq(A_, (E ** 2).sum(1), rcond=None)[0]
pcx, pcy = sol[0] / 2, sol[1] / 2
pr = float(np.sqrt(sol[2] + pcx ** 2 + pcy ** 2))
print("pulsator dish: centre (%.1f, %.1f) r %.1f px" % (pcx, pcy, pr))
r = int(round(pr)) + 1
cx, cy = int(round(pcx)), int(round(pcy))
pad = np.zeros((top.shape[0] + 2 * r, top.shape[1] + 2 * r, 3), np.float32)
pad[r:r + top.shape[0], r:r + top.shape[1]] = top
have = np.zeros(pad.shape[:2], bool)
have[r:r + top.shape[0], r:r + top.shape[1]] = True
pul = pad[cy:cy + 2 * r, cx:cx + 2 * r].copy()
hv = have[cy:cy + 2 * r, cx:cx + 2 * r]
rot = pul[::-1, ::-1]
pul = np.where(hv[..., None], pul, rot)
yy, xx = np.mgrid[-r:r, -r:r]
rr = np.hypot(xx, yy) / pr
base = np.median(pul[(rr > 0.55) & (rr < 0.9)].reshape(-1, 3), axis=0)
pul = np.where(rr[..., None] <= 0.985, pul, base)
pul = cv2.resize(pul, (512, 512), interpolation=cv2.INTER_CUBIC)
save(Image.fromarray(np.clip(pul * 0.92, 0, 255).astype(np.uint8)), "pulsator.jpg")

# the Pillow Drum: Haier's drum picture (this model's page) shows square pillows in rows with a round hole at each corner
# where four meet. Haier gives 560 protrusions and 2.2 mm holes; over the modelled drum wall (r 200 mm, 400 mm deep) that is
# a pillow about 31 mm square (ESTIMATED). One tile = 4 x 4 pillows (124 mm), drawn as the shading of a raised cushion.
N, PILL = 4, 128
tile = np.zeros((N * PILL, N * PILL), np.float32)
u = (np.arange(PILL) + 0.5) / PILL * 2 - 1
U, V = np.meshgrid(u, u)
cush = np.clip(1 - (np.abs(U) ** 4 + np.abs(V) ** 4) ** 0.25, 0, 1) ** 0.6
shade = 0.62 + 0.38 * cush - 0.12 * np.clip(U + V, -1, 1) * cush
for i in range(N):
    for j in range(N):
        tile[i * PILL:(i + 1) * PILL, j * PILL:(j + 1) * PILL] = shade
hole = PILL * 2.2 / 31 / 2
yy, xx = np.mgrid[0:N * PILL, 0:N * PILL]
for i in range(N + 1):
    for j in range(N + 1):
        d = np.hypot(xx - j * PILL, yy - i * PILL)
        tile = np.where(d < hole, 0.18, tile)
tile = cv2.GaussianBlur(tile, (0, 0), 0.8)
drum = np.stack([tile * 178, tile * 182, tile * 188], -1)
save(Image.fromarray(np.clip(drum, 0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS), "drum.jpg")

# ───────────────────────── the close-up print: the panel at 12 px per mm ─────────────────────────
# panel.jpg (7.2 px per mm) covers the strip in one texture. For a close look the same panel is drawn again by the same
# code at 12 px per mm and cut in two at the emptiest column of its middle, each half under the 4096 px a phone loads:
# panel_a.jpg and panel_b.jpg, laid over the strip as decals 0.9 mm off it (decals.json: each half's u, v rectangle on the
# strip; make_haier_hwm70es5.mjs lays them with decal_curved.mjs, clipped to the strip's crescent). The raised keys' tops
# take their print from keys.jpg, the same drawing over the four keys (keys.json: its box as a fraction of the strip's u, v).
HI, TEX_MAX = 12.0, 4096
hi = draw_panel(HI)
img = Image.fromarray(np.clip(hi, 0, 255).astype(np.uint8))
Wd = hi.shape[1]
lo_, hi_ = Wd - TEX_MAX + 16, TEX_MAX - 16
inkc = (hi.max(2) > 60).sum(0).astype(np.float32)
inkc = np.convolve(inkc, np.ones(25), "same")
cut = int(lo_ + np.argmin(inkc[lo_:hi_]))
rects = {}
for key, (name, a0, a1) in {"panelA": ("panel_a.jpg", 0, cut), "panelB": ("panel_b.jpg", cut, Wd)}.items():
    img.crop((a0, 0, a1, img.height)).save(os.path.join(D, name), quality=88, subsampling=0, optimize=True)
    rects[key] = {"file": name, "rect": [a0 / Wd, 0, a1 / Wd, 1]}
with open(os.path.join(D, "decals.json"), "w") as f:
    json.dump(rects, f, indent=1)
print("wrote panel_a.jpg, panel_b.jpg", img.size, "cut at", cut, "px; ink there", float(inkc[cut]))
# the keys (KEYS below; each 0.3 mm larger all round than its ring or frame, so the print round the key's foot is under it;, written into keys.json for make_haier_hwm70es5.mjs: the two round keys r 8.6 mm, the two square keys 18.6 x 14.5 and 19.1 x 14.5 mm;
# centres from the photo's ring and frame fits, x = (px - 600) / 2.2 mm, d = (584 - py) / 2.2 mm behind the front)
# (x, d: centre in metres, w x h: size; round keys to the ring's outer edge, 17.98-18.07 + 0.9 px; square keys the frames)
KEYS = [
    {"name": "ButtonWaterLevel", "kind": "round", "x": (536.97 - 600) / 2200, "d": (584 - 520.30) / 2200, "w": 2 * 18.9 / 2200 + 0.0006, "h": 2 * 18.9 / 2200 + 0.0006},
    {"name": "ButtonProgram", "kind": "round", "x": (665.74 - 600) / 2200, "d": (584 - 520.37) / 2200, "w": 2 * 19.0 / 2200 + 0.0006, "h": 2 * 19.0 / 2200 + 0.0006},
    {"name": "ButtonStartPause", "kind": "square", "x": (800.5 - 600) / 2200, "d": (584 - 505.0) / 2200, "w": 41 / 2200 + 0.0006, "h": 32 / 2200 + 0.0006},
    {"name": "ButtonPower", "kind": "square", "x": (850.0 - 600) / 2200, "d": (584 - 462.0) / 2200, "w": 42 / 2200 + 0.0006, "h": 32 / 2200 + 0.0006},
]
kx0 = min(k["x"] - k["w"] / 2 for k in KEYS) - 0.0015
kx1 = max(k["x"] + k["w"] / 2 for k in KEYS) + 0.0015
kd0 = min(k["d"] - k["h"] / 2 for k in KEYS) - 0.0015
kd1 = max(k["d"] + k["h"] / 2 for k in KEYS) + 0.0015
col = lambda x: (600 + 2200 * x - X0) * S
row = lambda d: (584 - 2200 * d - Y0) * S
kb = [int(np.floor(col(kx0))), int(np.floor(row(kd1))), int(np.ceil(col(kx1))), int(np.ceil(row(kd0)))]
img.crop(tuple(kb)).save(os.path.join(D, "keys.jpg"), quality=90, subsampling=0, optimize=True)
with open(os.path.join(D, "keys.json"), "w") as f:
    json.dump({"rect": [kb[0] / Wd, kb[1] / hi.shape[0], kb[2] / Wd, kb[3] / hi.shape[0]], "keys": KEYS}, f, indent=1)
print("wrote keys.jpg", kb[2] - kb[0], "x", kb[3] - kb[1])
if DEBUG:
    img.crop((0, 0, cut, img.height)).resize((cut // 2, img.height // 2)).save(os.path.join(DEBUG, "hi_a.jpg"), quality=85)
