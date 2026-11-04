"""Textures for the Bosch WGA1420PIN 9 kg front-load washing machine (Dark lake).

usage: python tex_bosch_wga1420.py <photos dir> <logos dir> <out dir>
  photos: bosch_fl/23188986_WGA1420PIN_STP_def.png   Bosch's straight-on studio photo, 1600 x 2233 (2.68 px/mm across, 2.63 down)
          bosch_fl/side_left.jpg, side_right.jpg, rear.jpg   Bosch's 360 degree turntable frames, taken square-on to those faces
  logos:  bosch.png
  writes <out dir>/bosch_wga1420/*

The control strip is drawn again from the photo's measurements at twice its resolution: every word (set in Avenir Next) at the
place and size it has in the photo, the leader lines, the 7-segment time, the display. The small icons are the photo's own,
smoothed by upscaling and re-thresholding so their edges are clean. The knob in the photo is left out because the model has a real 3D knob.
The side panels (concentric ring relief), the open steel back and the drawer front are cropped from Bosch's photos.
The drain hose, the inlet hose, the power cord and its plug lie over the back; the builder models them in 3D along the centre
lines below (written to rear_paths.json), so the flat back has them painted out along the same lines.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
D = os.path.join(OUT, "bosch_wga1420")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(14)
FONT = "/System/Library/Fonts/Avenir Next Condensed.ttc"       # matches the widths and letter height of Bosch's panel print
S = 2                                        # texture px per photo px
BODY = np.array([74, 80, 96], np.float32)    # Dark lake, sampled from the studio photo
STRIP_BG = np.array([81, 86, 99], np.float32)
PW, PH = 1600, 2228                          # photo px that span 598 x 848 mm (rows 5..2232 of the file)


def font(px, face=5):                                           # 5 Medium, 7 Regular, 0 Bold
    return ImageFont.truetype(FONT, max(4, round(px * S)), index=face)


SHADE = {"panel.jpg": 0.80, "drawer.jpg": 0.88, "body.jpg": 0.78, "front.jpg": 0.78, "side_l.jpg": 0.85, "side_r.jpg": 0.85, "rear.jpg": 0.9}


def save(img, name, q=88):
    if name in SHADE:                                              # lit by the viewer's environment light, a texture renders about a quarter brighter than its pixels
        img = Image.fromarray((np.asarray(img.convert("RGB")).astype(np.float32) * SHADE[name]).clip(0, 255).astype(np.uint8))
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def photo():
    im = Image.open(os.path.join(PHOTOS, "bosch_fl", "23188986_WGA1420PIN_STP_def.png")).convert("RGBA")
    bg = Image.new("RGBA", im.size, tuple(int(v) for v in BODY) + (255,))
    bg.alpha_composite(im)
    return bg.convert("RGB")                       # kept at the file's own pixel rows (the machine starts at row 5); every measurement below is in these rows


def icon(ph, box, fg_pad=3, bg_val=None):
    """The photo's icon at `box` (x0,y0,x1,y1 in photo px) as a clean alpha mask at texture scale (S x)."""
    x0, y0, x1, y1 = box
    c = ph.crop((x0 - fg_pad, y0 - fg_pad, x1 + fg_pad, y1 + fg_pad))
    a = np.asarray(c.convert("L")).astype(np.float32)
    lo, hi = np.percentile(a, 5), np.percentile(a, 99)
    if hi - lo < 25:
        return None
    big = cv2.resize(a, None, fx=8, fy=8, interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), 3.0)
    t = lo + 0.45 * (hi - lo)
    m = np.clip((big - t) / 14 + 0.5, 0, 1)                       # a soft edge about two device pixels wide
    h, w = a.shape
    return cv2.resize(m, (w * S, h * S), interpolation=cv2.INTER_AREA), (x0 - fg_pad, y0 - fg_pad)


def blend(canvas, mask, x, y, colour):
    h, w = mask.shape
    x, y = int(round(x * S)), int(round(y * S))
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(canvas.shape[1], x + w), min(canvas.shape[0], y + h)
    if x1 <= x0 or y1 <= y0:
        return
    a = mask[y0 - y:y1 - y, x0 - x:x1 - x][..., None]
    canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - a) + np.array(colour, np.float32) * a


def text(d, xy, s, px, fill, anchor="lm", face=5, spacing=0):
    f = font(px, face)
    if spacing:                                                    # letter-spaced words ("Serie")
        w = sum(f.getlength(c) for c in s) + spacing * S * (len(s) - 1)
        x = xy[0] * S - (w if anchor[0] == "r" else w / 2 if anchor[0] == "m" else 0)
        for c in s:
            d.text((x, xy[1] * S), c, font=f, fill=fill, anchor="l" + anchor[1])
            x += f.getlength(c) + spacing * S
        return
    d.text((xy[0] * S, xy[1] * S), s, font=f, fill=fill, anchor=anchor)


def seven(d, x, y, w, h, digit, on):
    t = max(2.0, w * 0.17)
    xl, xr, yt, ym, yb = x + t / 2, x + w - t / 2, y + t / 2, y + h / 2, y + h - t / 2
    g = t * 0.55

    def bar(p0, p1):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        dv = (p1 - p0) / np.linalg.norm(p1 - p0)
        n = np.array([-dv[1], dv[0]])
        c = t / 2
        return [tuple(p0), tuple(p0 + dv * c + n * c), tuple(p1 - dv * c + n * c), tuple(p1), tuple(p1 - dv * c - n * c), tuple(p0 + dv * c - n * c)]
    segs = {"a": bar((xl + g, yt), (xr - g, yt)), "g": bar((xl + g, ym), (xr - g, ym)), "d": bar((xl + g, yb), (xr - g, yb)),
            "f": bar((xl, yt + g), (xl, ym - g * .5)), "e": bar((xl, ym + g * .5), (xl, yb - g)),
            "b": bar((xr, yt + g), (xr, ym - g * .5)), "c": bar((xr, ym + g * .5), (xr, yb - g))}
    lit = {"1": "bc", "2": "abged", "5": "afgcd", "8": "abcdefg"}[digit]
    for k, pts in segs.items():
        if k in lit:
            d.polygon([(px * S, py * S) for px, py in pts], fill=on)


def panel(ph):
    W, H = 1600, 358
    img = np.ones((H * S, W * S, 3), np.float32) * STRIP_BG
    yy = np.linspace(0, 1, H * S)[:, None, None]
    img *= (1.0 + 0.05 * (1 - yy))                                 # a touch lighter along the top edge
    img += rng.normal(0, 0.9, (H * S, W * S, 1))
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    WHITE, DIM = (236, 237, 240), (190, 193, 202)

    # rim of the strip: the top highlight and the groove under it
    d.line([(0, 9 * S), (W * S, 9 * S)], fill=(104, 109, 124), width=2 * S)
    d.line([(0, 357 * S), (W * S, 357 * S)], fill=(40, 43, 52), width=2 * S)
    # the drawer's bay: the drawer is its own part, so this is what shows when it is pulled out
    d.rounded_rectangle([100 * S, 75 * S, 555 * S, 282 * S], 6 * S, fill=(22, 24, 30), outline=(58, 62, 76), width=2 * S)
    d.line([(600 * S, 6 * S), (600 * S, 356 * S)], fill=(34, 36, 44), width=3 * S)
    # the dial's recess: a dark ring round where the 3D knob stands
    d.ellipse([(800 - 101) * S, (176 - 101) * S, (800 + 101) * S, (176 + 101) * S], fill=(46, 49, 60))

    # programme names and their leader lines
    for s, y in [("Quick 15/30 min", 89), ("Steam/Anti Bacteria", 116), ("Jeans/Dark Wash", 148), ("Sportswear", 179), ("Shirts", 211), ("Rinse", 241), ("Spin/Drain", 269)]:
        text(d, (608, y), s, 14.8, WHITE, "lm")
    for s, y in [("Cottons", 89), ("Cottons 60° Label", 116), ("Synthetics", 148), ("Mix Load", 179), ("Delicates/Silk", 211), ("Wool", 241), ("Drum Descale", 269)]:
        text(d, (991, y), s, 14.8, WHITE, "rm")
    lw = lambda t: font(14.8, 5).getlength(t) / S
    left_end = {89: 608 + lw("Quick 15/30 min"), 179: 608 + lw("Sportswear"), 211: 608 + lw("Shirts"), 241: 608 + lw("Rinse"), 269: 608 + lw("Spin/Drain")}
    right_start = {89: 991 - lw("Cottons"), 116: 991 - lw("Cottons 60\u00b0 Label"), 148: 991 - lw("Synthetics"), 179: 991 - lw("Mix Load"), 211: 991 - lw("Delicates/Silk"), 241: 991 - lw("Wool") - 26, 269: 991 - lw("Drum Descale")}
    for y, x0, x1 in [(89, 700, 747), (179, 676, 693), (211, 645, 698), (241, 643, 717), (269, 670, 747)]:
        d.line([(max(x0, left_end[y] + 6) * S, y * S), (x1 * S, y * S)], fill=DIM, width=S)
    for y, x0, x1 in [(89, 850, 943), (116, 883, 889), (148, 900, 932), (179, 905, 958), (211, 901, 912), (241, 883, 938), (269, 858, 912)]:
        if x1 - 6 > x0 and min(x1, right_start[y] - 6) > x0:
            d.line([(x0 * S, y * S), (min(x1, right_start[y] - 6) * S, y * S)], fill=DIM, width=S)
    text(d, (800, 54), "Off", 13.5, DIM, "mm")
    text(d, (1076, 53), "Steam", 16, WHITE, "lm", face=0)
    text(d, (1131, 53), "Cycle", 16, WHITE, "lm", face=7)
    text(d, (1405, 53), "Serie", 16, WHITE, "lm", face=7, spacing=2.6)
    d.line([(1456 * S, 43 * S), (1456 * S, 63 * S)], fill=DIM, width=S)
    text(d, (1481, 53), "6", 17, WHITE, "lm", face=0)

    # the display
    d.rounded_rectangle([1046 * S, 75 * S, 1500 * S, 282 * S], 5 * S, fill=(11, 12, 15), outline=(52, 56, 68), width=2 * S)
    d.rectangle([1048 * S, 222 * S, 1498 * S, 280 * S], fill=(8, 9, 11))
    text(d, (1184, 102), "1200", 15, WHITE, "mm")
    text(d, (1130, 124), "60°", 14.5, WHITE, "mm")
    text(d, (1493, 90), "9 kg", 14.5, WHITE, "rm", face=5)
    d.line([(1458 * S, 146 * S), (1481 * S, 146 * S)], fill=WHITE, width=2 * S)
    text(d, (1469, 166), "Start/Pause", 9.6, WHITE, "mm")
    for i, (cx, name) in enumerate([(1072, "Anti Stain"), (1129, "Temp.°C"), (1186, "Spin Speed"), (1243, "Pretreatment"), (1300, "Anti Tangle"), (1357, "Anti Wrinkle"), (1414, "Ready In"), (1471, "Speed Perfect")]):
        text(d, (cx, 240), name, 9.6, WHITE, "mm")
    for x in (1101, 1157, 1215, 1272, 1329, 1386, 1443):
        d.line([(x * S, 231 * S), (x * S, 276 * S)], fill=(152, 98, 100), width=S)
    d.line([(1348 * S, 272.5 * S), (1366 * S, 272.5 * S)], fill=DIM, width=S)
    d.line([(1411 * S, 272.5 * S), (1430 * S, 272.5 * S)], fill=DIM, width=S)
    text(d, (1391, 273), "3 sec.", 9.6, WHITE, "lm")
    # the time, drawn as 7-segment digits like the photo's "1:25"
    on = (240, 240, 244)
    seven(d, 1331, 164, 8, 31, "1", on)
    for cy in (172, 188):
        d.ellipse([(1344 - 1.8) * S, (cy - 1.8) * S, (1344 + 1.8) * S, (cy + 1.8) * S], fill=on)
    seven(d, 1352, 164, 17, 31, "2", on)
    seven(d, 1377, 164, 17, 31, "5", on)

    # icons, from the photo
    canvas = np.asarray(im).astype(np.float32)
    boxes = {"drop": (1066, 138, 1076, 150), "basket": (1319, 121, 1334, 134), "playpause": (1457, 178, 1483, 197), "wool": (944, 234, 963, 251),
             "stain": (1063, 249, 1079, 263), "temp": (1124, 248, 1134, 263), "spin": (1179, 249, 1192, 263), "pre": (1235, 251, 1250, 262),
             "tangle": (1292, 251, 1308, 262), "wrinkle": (1351, 250, 1366, 260), "ready": (1406, 249, 1421, 264), "speed": (1459, 250, 1483, 263), "key": (1364, 267, 1382, 278)}
    arr = np.asarray(ph).astype(np.float32)
    for k, b in boxes.items():
        r = icon(ph, b)
        if r:
            blend(canvas, r[0], r[1][0], r[1][1], WHITE)
    full = Image.fromarray(canvas.clip(0, 255).astype(np.uint8))
    return full.crop((0, 5 * S, W * S, 358 * S))     # the strip: from the machine's top edge (row 5) to the groove under it (row 358)


def drawer(ph):
    """The drawer's front: the studio photo's drawer, with the soft logo replaced by Bosch's own crisp one."""
    x0, y0, x1, y1 = 100, 75, 556, 283
    c = ph.crop((x0, y0, x1, y1)).resize(((x1 - x0) * S, (y1 - y0) * S), Image.LANCZOS)
    a = np.asarray(c).astype(np.float32)
    lx0, lx1 = (258 - x0) * S, (397 - x0) * S
    ly0, ly1 = (158 - y0) * S, (194 - y0) * S
    left, right = a[ly0:ly1, lx0 - 8:lx0 - 2].mean(axis=1, keepdims=True), a[ly0:ly1, lx1 + 2:lx1 + 8].mean(axis=1, keepdims=True)
    t = np.linspace(0, 1, lx1 - lx0)[None, :, None]
    a[ly0:ly1, lx0:lx1] = left * (1 - t) + right * t
    out = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    lg = Image.open(os.path.join(LOGOS, "bosch.png")).convert("RGBA")
    alpha = lg.getchannel("A")
    h = int(31 * S)
    w = int(h * lg.width / lg.height)
    alpha = alpha.resize((w, h), Image.LANCZOS)
    mark = Image.new("RGBA", (w, h), (92, 94, 100, 255))
    mark.putalpha(alpha)
    out = out.convert("RGBA")
    out.alpha_composite(mark, (int((327 - x0) * S - w / 2), int((176 - y0) * S - h / 2)))
    return out.convert("RGB")


def crop_side(name, box, size):
    im = Image.open(os.path.join(PHOTOS, "bosch_fl", name)).convert("RGB")
    return im.crop(box).resize(size, Image.LANCZOS)


# ── the back: Bosch's 360-degree frame taken square-on to it (rear.jpg). The body spans columns 616-1026 (598 mm) and rows
# 163-747 (848 mm to the floor under the feet): 0.688 px per mm. Centre lines below are photo pixels read off a 4x enlargement,
# seen from behind (photo right = the machine's left). Hose, cord and plug sizes are measured on the photo (ESTIMATED); Bosch
# publishes only their lengths (inlet hose 120 cm, drain hose 150 cm, cord 160 cm: the manual's technical data, p. 13).
PPM, CX, YB = 0.688, 821.0, 747.5
DRAIN = [(657, 210), (660, 240), (663, 290), (666, 350), (667, 400), (667, 450), (668, 500), (669, 550), (674, 580), (684, 605),
         (700, 627), (726, 648), (762, 663), (800, 671), (840, 672), (880, 666), (910, 652), (935, 633), (952, 610), (966, 585),
         (975, 555), (979, 520), (981, 480), (981, 430), (981, 380), (980, 345), (979, 314)]
INLET = [(967, 243), (975, 256), (984, 275), (991, 297), (997, 322), (1001, 350), (1003, 385), (1003, 420), (1001, 445), (996, 465),
         (985, 485), (968, 500), (945, 512), (915, 520), (885, 523), (855, 521), (830, 513), (805, 501), (780, 490), (755, 477),
         (730, 465), (705, 452), (680, 437), (662, 418), (652, 400), (647, 375), (646, 350), (648, 328), (655, 313), (668, 305),
         (685, 305), (700, 311), (713, 319)]
NUT = ((713, 319), (733, 335))          # the inlet hose's tap nut: from where the hose enters it to its end
CORDS = {                               # the power cord's runs as they show between the hoses and holders
    "CordRight": [(962, 544), (930, 533), (895, 523), (860, 511), (830, 499), (805, 490), (778, 479), (748, 463), (722, 446), (704, 433)],
    "CordToPlug": [(704, 433), (697, 446), (693, 460), (690, 474)],
    "CordUpper": [(652, 360), (656, 377), (668, 395), (683, 412), (704, 433)],
    "CordLower": [(700, 537), (730, 539), (755, 542), (780, 547), (805, 552), (830, 558), (870, 566), (920, 574), (960, 578)],
    "CordDown": [(640, 562), (638, 590), (643, 625), (650, 650), (660, 676), (669, 700)],
}
PLUG = {"sleeve": (690, 478, 690, 490), "body": (676, 490, 697, 520), "pins": [(680, 520, 535), (689, 520, 535)]}
WIDTH = {"drain": 17, "inlet": 10, "cord": 4.5}  # photo px across


def to_m(p):
    return [round(-(p[0] - CX) / PPM / 1000, 4), round((YB - p[1]) / PPM / 1000, 4)]


def rear_and_paths():
    im = Image.open(os.path.join(PHOTOS, "bosch_fl", "rear.jpg")).convert("RGB")
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    mask = np.zeros(bgr.shape[:2], np.uint8)
    poly = lambda pts, w: cv2.polylines(mask, [np.array(pts, np.int32)], False, 255, int(round(w + 8)), cv2.LINE_AA)
    poly(DRAIN, WIDTH["drain"])
    poly(INLET, WIDTH["inlet"])
    poly(list(NUT), 17)
    for pts in CORDS.values():
        poly(pts, WIDTH["cord"])
    x0, y0, x1, y1 = PLUG["body"]
    cv2.rectangle(mask, (x0 - 3, PLUG["sleeve"][1] - 3), (x1 + 3, max(y for _, _, y in PLUG["pins"]) + 3), 255, -1)
    # fill under them with the plain steel round about: close the thin dark pressing lines first (so they don't smear into
    # streaks), then take the local average of the unmasked pixels; feather the edge by 2 px
    rgb = np.asarray(im).astype(np.float32)
    closed = cv2.morphologyEx(rgb, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    keep = (mask < 128).astype(np.float32)
    num = cv2.GaussianBlur(closed * keep[..., None], (0, 0), 10)
    den = cv2.GaussianBlur(keep, (0, 0), 10)[..., None]
    fill = num / np.maximum(den, 1e-3)
    a = cv2.GaussianBlur((mask >= 128).astype(np.float32), (0, 0), 1.2)[..., None]
    clean = Image.fromarray((rgb * (1 - a) + fill * a).clip(0, 255).astype(np.uint8))
    # the builder's back panel: x +-287 mm (between the sides), y 12 to 834 mm (from the feet to under the top)
    box = (CX - 287 * PPM, YB - 834 * PPM, CX + 287 * PPM, YB - 12 * PPM)
    rear = clean.crop(tuple(round(v) for v in box)).resize((396, 566), Image.LANCZOS)
    save(rear, "rear.jpg", 88)
    # the drain hose's ribs: light grey corrugation (the builder repeats it every 4 mm along the hose)
    rib = np.ones((64, 32, 3), np.float32) * np.array([176, 178, 182], np.float32)
    rib *= (0.86 + 0.14 * np.cos(np.linspace(0, 2 * np.pi, 32, endpoint=False)) ** 2)[None, :, None]
    Image.fromarray(rib.clip(0, 255).astype(np.uint8)).save(os.path.join(D, "hose.jpg"), quality=90)
    paths = {
        "drain": [to_m(p) for p in DRAIN], "inlet": [to_m(p) for p in INLET], "nut": [to_m(p) for p in NUT],
        "cords": {k: [to_m(p) for p in v] for k, v in CORDS.items()},
        "plug": {"sleeve": [to_m(PLUG["sleeve"][:2]), to_m(PLUG["sleeve"][2:])],
                 "body": [to_m(PLUG["body"][:2]), to_m(PLUG["body"][2:])],
                 "pins": [[to_m((x, ya)), to_m((x, yb))] for x, ya, yb in PLUG["pins"]]},
        "drain_d": round(WIDTH["drain"] / PPM / 1000, 4), "inlet_d": round(WIDTH["inlet"] / PPM / 1000, 4),
        "cord_d": round(WIDTH["cord"] / PPM / 1000, 4),
    }
    with open(os.path.join(D, "rear_paths.json"), "w") as f:
        json.dump(paths, f, indent=1)
    print("wrote", os.path.join(D, "rear_paths.json"), "and hose.jpg; rear box", [round(v) for v in box])
    if os.environ.get("REAR_DEBUG"):
        Image.fromarray(mask).save(os.environ["REAR_DEBUG"])


def main():
    ph = photo()
    save(panel(ph), "panel.jpg", 90)
    save(drawer(ph), "drawer.jpg", 90)

    # body: a smooth satin plastic in the same colour; the lights do the shading
    n = 256
    base = np.ones((n, n, 3), np.float32) * BODY + rng.normal(0, 1.0, (n, n, 1))
    save(Image.fromarray(base.clip(0, 255).astype(np.uint8)), "body.jpg", 85)
    front = np.ones((1024, 768, 3), np.float32) * BODY * (np.linspace(1.10, 0.84, 1024)[:, None, None]) + rng.normal(0, 1.0, (1024, 768, 1))
    save(Image.fromarray(front.clip(0, 255).astype(np.uint8)), "front.jpg", 85)
    # the door seat ring and the pump-filter recess are dark
    # sides: Bosch's frames square-on to each face, cropped to the flat face of the cabinet (front edge to back edge, top plate to floor)
    for name, src, box in (("side_l.jpg", "side_left.jpg", None), ("side_r.jpg", "side_right.jpg", None)):
        im = Image.open(os.path.join(PHOTOS, "bosch_fl", src)).convert("RGB")
        a = np.asarray(im).astype(int)
        ys, xs = np.where(a.sum(2) < 720)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        h = y1 - y0 + 1
        # the cabinet's flat side runs from 8% to 92% of the frame's width over the whole height (the door and the hoses stand outside it)
        left = name == "side_l.jpg"
        w = x1 - x0 + 1
        bx = (x0 + int(0.095 * w), x1 - int(0.07 * w)) if left else (x0 + int(0.075 * w), x1 - int(0.095 * w))
        crop = im.crop((bx[0], y0 + int(0.02 * h), bx[1], y1 - int(0.035 * h))).resize((560, 790), Image.LANCZOS)
        # Bosch's turntable frames are colour-neutral grey; keep their light and shade (the ring relief) and give it the Dark lake colour of the studio photo
        lum = np.asarray(crop.convert("L")).astype(np.float32)
        lum = lum / max(1.0, float(np.median(lum)))
        tint = np.clip(lum[..., None] ** 1.15 * (BODY * 0.92), 0, 255)
        crop = Image.fromarray(tint.astype(np.uint8))
        save(crop, name, 88)

    rear_and_paths()

    # drum: stainless with the pattern of small dimples, as in Bosch's drum photo
    w, h = 1024, 512
    drum = np.ones((h, w, 3), np.float32) * np.array([178, 181, 186], np.float32)
    drum += rng.normal(0, 2.0, (h, w, 1))
    img = Image.fromarray(drum.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for row, y in enumerate(range(9, h, 18)):
        for x in range(9 + (row % 2) * 9, w, 18):
            d.ellipse((x - 3.2, y - 3.2, x + 3.2, y + 3.2), fill=(88, 91, 98))
            d.ellipse((x - 4.6, y - 4.6, x + 3.4, y + 3.4), outline=(214, 217, 222))
    save(img, "drum.jpg", 86)
    # the detergent tray: white compartments with the softener flower, drawn small
    tray = Image.new("RGB", (400, 240), (228, 230, 234))
    d = ImageDraw.Draw(tray)
    d.rectangle((8, 8, 392, 232), outline=(188, 191, 198), width=5)
    d.rectangle((14, 14, 126, 226), outline=(205, 208, 214), width=3)
    d.line([(138, 12), (138, 228)], fill=(188, 191, 198), width=4)
    d.line([(266, 12), (266, 228)], fill=(188, 191, 198), width=4)
    for i, (cx, lab) in enumerate([(72, "II"), (202, "I"), (330, "✿")]):
        d.text((cx, 120), lab, font=ImageFont.truetype(FONT, 56, index=0), fill=(150, 154, 164), anchor="mm")
    save(tray, "tray.jpg", 88)
    # the door's inner glass ring and the metal band round the drum mouth are plain materials in the builder


main()
