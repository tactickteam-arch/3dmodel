"""Textures for the Samsung RT28C3053S8 (236 L, Elegant Inox: brushed-steel-look doors), written to <out dir>/samsung_rt28/.

usage: python3 tex_samsung_rt28.py <photos dir> <logos dir> <out dir> [--photos <site photos dir>]
  photos: samsung_rt28/g52_535218367.jpg  Samsung's 3/4 view from the right (the same picture set Sangeetha's listing for
                                          RT28C3053S8 shows; Samsung files it under RT28C3052S8, the same body)
          samsung_rt28/g52_535218369.jpg  Samsung's 3/4 view from the left (= Sangeetha's listing image 5 for this code)
          samsung_rt28/g52_535050747.jpg  the open doors, empty (= Sangeetha's listing image 7)
          samsung_rt28/g52_535050748.jpg  the open doors, stocked (= Sangeetha's listing image 8)
          samsung_rt28/g52_535050750.jpg  the freezer close-up (Cool Pack, Movable Ice Maker, the slider control)
          samsung_rt28/g52_535050753.jpg  the rear view
  logos:  samsung.png
  writes:
    door_freezer.jpg, door_fridge.jpg   the Elegant Inox fronts: the light-to-dark fall of Samsung's two 3/4 views, row by
                                        row, with horizontal hairlines (the wordmark and the badge are decals)
    mark.png                            the SAMSUNG wordmark in the light ink the doors show, from Samsung's own logo file
    badge.png                           the Digital Inverter Technology badge on the freezer door's chrome lip, redrawn
    side_paint.jpg                      the dark grey painted sides
    rear.jpg, bay.jpg, base_rear.jpg    the dimpled rear panel, the open compressor bay and the base plate under it
    cord_path.json                      the cord's route (ESTIMATED: Samsung's rear photo shows no cord) and the bay's height
    back_freezer.png, back_fridge.png   the back-wall panels inside, redrawn: vents, screw caps, the freezer's slider control
                                        (Freezer / Max, Refrigerator / Min, Optimal), the fridge's Temp. Control dial scale
    deodorizer.png                      the Deodorizing Filter badge on the back wall
    coolpack.png                        the blue Cool Pack shelf with its moulded "Cool Pack"
    print_freshroom.png, print_easyslide.png, print_tallbottle.png, print_moistfresh.png
                                        the words printed on the Fresh Room tray, the Easy Slide shelf, the Tall Bottle Guard
                                        bin and the MoistFresh Zone plate, set again sharp
    bigbox_print.png, icemaker_print.png drawn by tex_samsung_fridge.py (the RT34's, run unchanged into a scratch folder):
                                        Samsung's photos of this model show the same "Big Box" with its three fruit icons and
                                        the same "Movable Ice Maker"
  --photos: also writes the page's four 900 x 900 photos into <site photos dir>/samsung-rt28c3053s8/
"""
import json
import math
import os
import runpy
import shutil
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SITE_PHOTOS = sys.argv[sys.argv.index("--photos") + 1] if "--photos" in sys.argv else None
D = os.path.join(OUT, "samsung_rt28")
os.makedirs(D, exist_ok=True)
P = os.path.join(PHOTOS, "samsung_rt28")
rng = np.random.default_rng(28)
PAD = 10                             # clear margin round the decals' textures

# the door geometry the builder uses (mm): the freezer door 1021-1535 with its chrome lip along the bottom 17 mm, the
# fridge door 36-1004 with the handle pocket in its top 36 mm (both ESTIMATED off the 3/4 views, NOTES.md)
FZ_H, FR_H, LIP_H, POCKET_H, DOOR_W = 514, 968, 17, 36, 553


def save(img, name, q=86):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def brushed(w, h, strength=4.5, streak=180):
    """Horizontal hairline noise (as tex_samsung_rt45.py)."""
    n = rng.normal(0, 1, (h, w // 4 + 1))
    n = np.repeat(n, 4, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur((streak / 40, 0.4)))
    return (np.asarray(img).astype(float) / 255 - 0.5) * 2 * strength


# ── the doors ──
# Each 3/4 view gives, at three columns across the pocket's span, the freezer door's top, the top of its chrome lip, the
# pocket's bottom and the fridge door's bottom edge (rows; NOTES.md). Between them each row's median colour over the
# central columns is the door's light at that height; the two views (lit from either side) are averaged.
EDGES = {
    "g52_535218367.jpg": {850: (51, 428, 482, 1196.5), 950: (49.5, 429, 482.5, 1202.5), 1050: (48, 430, 483.5, 1208.5)},
    "g52_535218369.jpg": {850: (49, 434, 490, 1212.5), 950: (50, 435.5, 490, 1207.5), 1050: (52, 436.5, 490, 1204.5)},
}
# the viewer's light: GAIN corrects the photo's fall for it, tuned on the render against the photos (NOTES.md);
# positions are fractions of the door's height from its top
GAIN_FZ = [(0.0, 0.81), (1.0, 0.81)]
GAIN_FR = [(0.0, 0.82), (1.0, 0.80)]


def profile(which):
    """the door's colour down its face, sampled at n points from the face's top to its bottom (both photos averaged)"""
    n = 400
    out = []
    for f, cols in EDGES.items():
        a = np.asarray(Image.open(os.path.join(P, f)).convert("RGB")).astype(float)
        xs = sorted(cols)
        acc = []
        for x in range(xs[0], xs[-1] + 1, 2):
            e = [np.interp(x, xs, [cols[c][k] for c in xs]) for k in range(4)]
            r0, r1 = (e[0] + 3, e[1] - 3) if which == "fz" else (e[2] + 3, e[3] - 3)
            rows = r0 + np.linspace(0, 1, n) * (r1 - r0)
            i = np.floor(rows).astype(int)
            t = (rows - i)[:, None]
            acc.append(a[i, x] * (1 - t) + a[i + 1, x] * t)
        out.append(np.median(np.stack(acc), axis=0))
    return np.mean(out, axis=0)


def doors(px_mm=1.6):
    w = round(DOOR_W * px_mm)

    def door(which, h_mm, f0_mm, f1_mm, gain, name):
        # the photo's profile covers the face from f0_mm to f1_mm below the door's top; it is held flat beyond that
        h = round(h_mm * px_mm)
        prof = profile(which)
        y = np.arange(h) / px_mm
        f = np.clip((y - f0_mm) / (f1_mm - f0_mm), 0, 1)
        col = np.stack([np.interp(f, np.linspace(0, 1, len(prof)), prof[:, k]) for k in range(3)], axis=1)
        col *= np.interp(y / h_mm, *zip(*gain))[:, None]
        img = np.repeat(col[:, None, :], w, axis=1)
        img += brushed(w, h)[:, :, None]
        save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), name)

    door("fz", FZ_H, 4, FZ_H - LIP_H - 4, GAIN_FZ, "door_freezer.jpg")
    door("fr", FR_H, POCKET_H + 4, FR_H - 4, GAIN_FR, "door_fridge.jpg")


def mark():
    # Samsung's own wordmark, in the light ink the doors show (g52_535218367: ink (203, 204, 208) on (125, 126, 130));
    # kept as a ratio of the door at that height, so it reads the same against the texture
    col = (206, 207, 211)
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = col
    out[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out)
    im = im.crop(im.getchannel("A").getbbox())
    pad = Image.new("RGBA", (im.width + 2 * PAD, im.height + 2 * PAD), col + (0,))
    pad.paste(im, (PAD, PAD))
    save(pad, "mark.png")
    print("mark padded", pad.size, "ink", im.size)


# ── print helpers (drawn S x over and reduced) ──
AV = "/System/Library/Fonts/Avenir Next.ttc"
AVC = "/System/Library/Fonts/Avenir Next Condensed.ttc"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
S = 2


def font(path, px, face=0):
    return ImageFont.truetype(path, max(1, round(px * S)), index=face)


def rrect(d, box, r, fill=None, outline=None, w=1):
    x0, y0, x1, y1 = [v * S for v in box]
    d.rounded_rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), r * S, fill=fill, outline=outline, width=max(1, round(w * S)))


def text(d, xy, s, f, fill, anchor="mm"):
    d.text((xy[0] * S, xy[1] * S), s, font=f, fill=fill, anchor=anchor)


def line(d, pts, w, fill):
    d.line([(x * S, y * S) for x, y in pts], fill=fill, width=max(1, round(w * S)), joint="curve")


def fit_text(d, x0, y_mid, w_target, parts, size, ink):
    """parts: [(string, font path, face)], laid left to right with a space between, scaled so the whole line is
    w_target wide (letters never stretched: the size changes)"""
    fs = lambda k: [font(p, k, i) for _, p, i in parts]
    sp = 0.28
    def width(k):
        fl = fs(k)
        return sum(d.textlength(s, font=f) / S for (s, _, _), f in zip(parts, fl)) + sp * k * (len(parts) - 1)
    k = size * w_target / width(size)
    x = x0
    for (s, _, _), f in zip(parts, fs(k)):
        text(d, (x, y_mid), s, f, ink, anchor="lm")
        x += d.textlength(s, font=f) / S + sp * k


def decal(name, w_mm, h_mm, build, PX=12, bg=(0, 0, 0, 0), palette=True):
    w, h = round(w_mm * PX), round(h_mm * PX)
    img = Image.new("RGBA", (w * S, h * S), bg)
    d = ImageDraw.Draw(img)
    build(d, w, h, PX)
    img = img.resize((w, h), Image.LANCZOS)
    p = os.path.join(D, name)
    img.save(p, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def badge():
    # "DIGITAL INVERTER" over a spaced-out "TECHNOLOGY", Samsung's round D mark to the left, in dark ink on the chrome
    # lip: 69 mm by 12 mm (the 3/4 views, NOTES.md). The mark is drawn from those views (a ring with an upright stem)
    def b(d, w, h, PX):
        ink = (52, 54, 60, 255)
        cx, cy, r = 6.2 * PX, 6.0 * PX, 4.6 * PX
        d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), outline=ink, width=round(2.2 * PX * S))
        rrect(d, (cx - r, cy - r - 1.2 * PX, cx - r + 2.2 * PX, cy + r), 0.4 * PX, fill=ink)
        d.polygon([((cx - 1.2 * PX) * S, (cy - 1.8 * PX) * S), ((cx + 1.6 * PX) * S, cy * S), ((cx - 1.2 * PX) * S, (cy + 1.8 * PX) * S)], fill=ink)
        fit_text(d, 13.5 * PX, 4.6 * PX, 54 * PX, [("DIGITAL", AVC, 2), ("INVERTER", AVC, 2)], 6.2 * PX, ink)
        f = font(AVC, 2.0 * PX, 2)
        s = "T E C H N O L O G Y"
        text(d, (13.5 * PX + 54 * PX, 9.6 * PX), s, f, ink, anchor="rm")
    decal("badge.png", 69, 12, b)


def side():
    # Samsung's 3/4 views: the sides read 54-58 at the top, 90-115 at mid-height (the studio's light), 38-60 at the foot,
    # a touch blue (B 3-5 over R)
    h, w = 768, 512
    yy = np.linspace(0, 1, h)[:, None]
    base = 62 + 22 * np.exp(-((yy - 0.38) / 0.25) ** 2) - 12 * np.clip((yy - 0.7) / 0.3, 0, 1)
    speck = Image.fromarray(((rng.normal(0, 1, (h, w)) * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    s = (np.asarray(speck).astype(float) / 255 - 0.5) * 3.0
    img = np.stack([base + s, base + s + 1, base + s + 4], axis=2) * np.ones((1, w, 1))
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "side_paint.jpg")


# ── the rear (g52_535050753.jpg) ──
# body x 740-1179, top row 46 (the cabinet's top, 1535 mm), the base plate's foot row 1234: 0.774 px per mm up (the
# photo is 2% wider than tall for this body, so heights use the vertical scale). The compressor bay opens at row 1035
# (257 mm); the cabinet's underside is row 1215 (25 mm), the grey base plate below it. Samsung's photo shows no cord, so
# its route is ESTIMATED: from under the electrical box at the top left (where the photo's wiring cover ends, x 845,
# row 300) straight down, then across just above the bay to the plug, as the RT40H28 (same cabinet) was built.
R_X0, R_X1, R_TOP, R_FLOOR, R_BAY, R_BASE = 740, 1179, 46, 1234, 1035, 1215
PPM_V = (R_FLOOR - R_TOP) / 1535
PPM_H = (R_X1 - R_X0) / 555
CORD = [(845, 302), (845, 450), (845, 650), (845, 850), (845, 960), (847, 990), (854, 1006), (868, 1014),
        (894, 1017), (960, 1017), (1030, 1017), (1070, 1018)]
PLUG = (1095, 1018)


def rear():
    src = Image.open(os.path.join(P, "g52_535050753.jpg")).convert("RGB")
    save(src.crop((R_X0 + 3, R_TOP + 2, R_X1 - 3, R_BAY)), "rear.jpg", q=84)
    bay = src.crop((R_X0 + 8, R_BAY, R_X1 - 8, R_BASE))
    save(bay.resize((bay.width * 2, bay.height * 2), Image.LANCZOS), "bay.jpg", q=84)
    save(src.crop((R_X0 + 3, R_BASE, R_X1 - 3, R_FLOOR)), "base_rear.jpg", q=84)
    xc = (R_X0 + R_X1) / 2
    to_m = lambda x, r: (round(-(x - xc) / PPM_H / 1000, 4), round((R_FLOOR - r) / PPM_V / 1000, 4))   # seen from behind
    json.dump({"ppm_v": PPM_V, "ppm_h": PPM_H, "cord": [to_m(x, r) for x, r in CORD], "plug": to_m(*PLUG),
               "bay_top": round((R_FLOOR - R_BAY) / PPM_V / 1000, 4), "base": round((R_FLOOR - R_BASE) / PPM_V / 1000, 4),
               "cord_d": 0.008}, open(os.path.join(D, "cord_path.json"), "w"), indent=1)
    print("wrote cord_path.json; bay top", round((R_FLOOR - R_BAY) / PPM_V / 1000, 3), "m, base", round((R_FLOOR - R_BASE) / PPM_V / 1000, 3))


# ── back-wall panels, redrawn ──
def back_panel(name, box_m, build, PX=6):
    x0, x1, y0, y1 = box_m
    w, h = round((x1 - x0) * 1000 * PX), round((y1 - y0) * 1000 * PX)
    img = Image.new("RGBA", (w * S, h * S), (246, 247, 249, 255))
    d = ImageDraw.Draw(img)
    rrect(d, (3, 3, w - 3, h - 3), 10 * PX / 4, outline=(226, 229, 233, 255), w=3)
    X = lambda xm: (xm - x0) * 1000 * PX
    Y = lambda ym: (y1 - ym) * 1000 * PX
    build(d, X, Y, PX)
    img = img.resize((w, h), Image.LANCZOS).convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    p = os.path.join(D, name)
    img.save(p, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def slot(d, X, Y, xa, xb, y, th_mm, PX, fill=(204, 207, 211, 255), edge=(176, 180, 186, 255)):
    rrect(d, (X(xa), Y(y) - th_mm * PX / 2, X(xb), Y(y) + th_mm * PX / 2), th_mm * PX * 0.2, fill=fill, outline=edge, w=PX * 0.4)


# The freezer's back wall on Samsung's close-up g52_535050750: 2.174 px per mm, its middle at x 935, the floor at the back
# wall row 1040 (the same framing as the RT40H28's close-up of the same cabinet; NOTES.md). The fridge's on the open-door
# photo g52_535050747: the back wall at 0.619 px per mm across and 0.670 up, the inside's middle at x 793, eye 0.662 m up
# at row 744. Each panel is its box in metres (x from the middle, y above the floor).
FZ_PANEL = (-0.21, 0.21, 1.071, 1.489)
FR_PANEL = (-0.134, 0.134, 0.690, 0.860)
FZ_FLOOR = 1.065


def back_freezer():
    yb = lambda row: FZ_FLOOR + (1040 - row) / 2.174 / 1000
    xb = lambda col: (col - 935) / 2.174 / 1000

    def b(d, X, Y, PX):
        ink = (40, 42, 46, 255)
        for ca, cb in ((548, 730), (842, 1040), (1152, 1308)):          # three vent slots under the ceiling
            slot(d, X, Y, xb(ca), xb(cb), yb(154), 12, PX)
        for c in (553, 1330):                                          # the two round screw caps
            cx, cy, r = X(xb(c)), Y(yb(250)), 8.5 * PX
            d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=(242, 243, 245, 255), outline=(176, 180, 186, 255), width=round(0.5 * PX * S))
        # the lower raised panel's top edge (row 598) and its vent slot (x 1130-1310, row 612)
        line(d, [(X(xb(905)), Y(yb(598))), (X(xb(1395)), Y(yb(598)))], 0.5 * PX, (222, 225, 229, 255))
        slot(d, X, Y, xb(1130), xb(1310), yb(612), 9, PX)
        # the slider control (close-up, NOTES.md): "Freezer" and a Max box over a box whose black wedge narrows to the
        # right, "Refrigerator" and a black Min box under it, the slider's groove with its slide at the left end, then
        # a triangle over "Optimal" and three ticks. Its left end is behind the ice maker on the real one too.
        k = 1 / 2.174          # mm per close-up px
        f = font(AV, 10.5 * k * PX, 5)
        text(d, (X(xb(917)), Y(yb(737))), "Freezer", f, ink, anchor="lm")
        text(d, (X(xb(907)), Y(yb(773.5))), "Refrigerator", f, ink, anchor="lm")
        rrect(d, (X(xb(984)), Y(yb(731)), X(xb(1007.5)), Y(yb(742.5))), 2.2 * k * PX, outline=ink, w=1.4 * k * PX)
        text(d, (X(xb(995.8)), Y(yb(736.8))), "Max", font(AV, 8.4 * k * PX, 5), ink)
        rrect(d, (X(xb(985)), Y(yb(767.5)), X(xb(1007.5)), Y(yb(779.5))), 2.2 * k * PX, fill=ink)
        text(d, (X(xb(996.2)), Y(yb(773.5))), "Min", font(AV, 8.4 * k * PX, 5), (246, 247, 249, 255))
        rrect(d, (X(xb(905)), Y(yb(743)), X(xb(996)), Y(yb(765.5))), 1.0 * k * PX, outline=ink, w=1.2 * k * PX)
        d.polygon([(X(xb(905)) * S, Y(yb(751.5)) * S), (X(xb(995.5)) * S, Y(yb(765)) * S), (X(xb(905)) * S, Y(yb(765)) * S)], fill=ink)
        rrect(d, (X(xb(905)), Y(yb(791)), X(xb(1033)), Y(yb(808))), 8 * k * PX, fill=(236, 238, 241, 255), outline=(206, 209, 214, 255), w=0.5 * PX)
        rrect(d, (X(xb(907)), Y(yb(792.5)), X(xb(953)), Y(yb(806.5))), 7 * k * PX, fill=(250, 250, 251, 255), outline=(214, 217, 221, 255), w=0.4 * PX)
        cx, cy, s = X(xb(936)), Y(yb(822.5)), 4.2 * k * PX
        d.polygon([((cx - s) * S, (cy + s * 0.8) * S), ((cx + s) * S, (cy + s * 0.8) * S), (cx * S, (cy - s * 0.8) * S)], fill=ink)
        for c in (955.5, 975.5, 995.5):
            line(d, [(X(xb(c)), Y(yb(820.5))), (X(xb(c)), Y(yb(825)))], 0.9 * k * PX, ink)
        text(d, (X(xb(936)), Y(yb(834.5))), "Optimal", f, ink)
    back_panel("back_freezer.png", FZ_PANEL, b)


def back_fridge():
    xb = lambda col: (col - 793) / 0.619 / 1000
    yb = lambda row: (662 + (744 - row) / 0.670) / 1000

    def b(d, X, Y, PX):
        ink = (60, 63, 69, 255)
        slot(d, X, Y, xb(740), xb(756), yb(629.5), 5, PX)              # the two vents at the panel's top
        slot(d, X, Y, xb(832), xb(850), yb(629.5), 5, PX)
        # the dial's scale round the knob (photo centre (794, 660)): five dashes on a 30 mm arc from 190 to 322 degrees;
        # 1 (Cold), 2, 3, Optimal, 5, 6 (Coldest) 39 mm out at 183, 209, 238, 268, 298 and 326 degrees; "Temp. Control"
        # under it, 57 mm wide, 32 mm below the centre
        cx, cy = X(0.0), Y(0.787)
        ra, rn = 30 * PX, 39 * PX
        for a0, a1 in ((190, 210), (218, 238), (246, 264), (273, 292), (300, 322)):
            d.arc(((cx - ra) * S, (cy - ra) * S, (cx + ra) * S, (cy + ra) * S), a0, a1, fill=ink, width=round(2.4 * PX * S))
        f = font(AV, 6.0 * PX, 5)
        fs = font(AV, 3.6 * PX, 5)
        for s, ang in (("1", 183), ("2", 209), ("3", 238), ("5", 298), ("6", 326)):
            a = math.radians(ang)
            text(d, (cx + rn * math.cos(a), cy + rn * math.sin(a)), s, f, ink)
        a = math.radians(268)
        text(d, (cx + (rn + 2 * PX) * math.cos(a), cy + (rn + 2 * PX) * math.sin(a)), "Optimal", fs, ink)
        a = math.radians(183)
        text(d, (cx + rn * math.cos(a), cy + rn * math.sin(a) + 6.5 * PX), "Cold", fs, ink)
        a = math.radians(326)
        text(d, (cx + rn * math.cos(a) + 2 * PX, cy + rn * math.sin(a) + 5 * PX), "Coldest", fs, ink, anchor="lm")
        fit_text(d, cx - 28.5 * PX, cy + 32 * PX, 57 * PX, [("Temp.", AV, 5), ("Control", AV, 5)], 7 * PX, ink)
    back_panel("back_fridge.png", FR_PANEL, b, PX=5)


def deodorizer():
    # the Deodorizing Filter housing on the back wall, 135 x 35 mm (open-door photo): a dot grid at each end, brackets,
    # the D icon in a dark square, "Deodorizing" over "Filter"
    def b(d, w, h, PX):
        ink = (58, 60, 66, 255)
        rrect(d, (1, 1, w - 1, h - 1), 6 * PX, fill=(238, 240, 243, 255), outline=(206, 209, 214, 255), w=0.6 * PX)
        for x0 in (12 * PX, w - 24 * PX):
            for i in range(4):
                for j in range(3):
                    cx, cy, r = x0 + i * 3.4 * PX, h / 2 + (j - 1) * 3.6 * PX, 0.9 * PX
                    d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=(120, 124, 130, 255))
        for x, s in ((32 * PX, 1), (w - 32 * PX, -1)):
            line(d, [(x + s * 2 * PX, h / 2 - 9 * PX), (x, h / 2 - 9 * PX), (x, h / 2 + 9 * PX), (x + s * 2 * PX, h / 2 + 9 * PX)], 0.9 * PX, (110, 114, 120, 255))
        rrect(d, (38 * PX, h / 2 - 7.5 * PX, 53 * PX, h / 2 + 7.5 * PX), 0.8 * PX, fill=ink)
        text(d, (45.5 * PX, h / 2), "D", font(AV, 11 * PX, 0), (236, 238, 241, 255))
        text(d, (56 * PX, h / 2 - 3.6 * PX), "Deodorizing", font(AV, 6.2 * PX, 0), ink, anchor="lm")
        text(d, (56 * PX, h / 2 + 4.0 * PX), "Filter", font(AV, 6.0 * PX, 4), (110, 114, 120, 255), anchor="lm")
    decal("deodorizer.png", 135, 35, b, PX=12, bg=(0, 0, 0, 0))  # 12 px per mm (was 8)


def coolpack():
    # the blue Cool Pack slab: (149, 192, 237) on Samsung's close-up, a little lighter at its front; "Cool Pack" moulded
    # into its top (a slightly lighter, soft-edged relief), with a snowflake before it. 470 x 270 mm top
    PX = 3
    w, h = 470 * PX, 270 * PX
    img = Image.new("RGB", (w * S, h * S), (140, 184, 230))
    d = ImageDraw.Draw(img)
    f = font(AV, 30 * PX, 0)
    rel = (152, 196, 240)
    text(d, (w / 2 + 18 * PX, h * 0.42), "Cool Pack", f, rel)
    cx, cy, r = w / 2 - 82 * PX, h * 0.42, 10 * PX
    for k in range(3):
        a = math.radians(90 + 60 * k)
        line(d, [(cx - r * math.cos(a), cy - r * math.sin(a)), (cx + r * math.cos(a), cy + r * math.sin(a))], 2.4 * PX, rel)
    img = img.filter(ImageFilter.GaussianBlur(1.2 * S)).resize((w, h), Image.LANCZOS)
    save(img, "coolpack.png")


def prints():
    ink = (40, 43, 50, 255)
    # "Fresh Room" on the tray's clear front: 120 mm wide, 12.5 mm caps (open-door photo)
    decal("print_freshroom.png", 140, 22, lambda d, w, h, PX: fit_text(d, 10 * PX, h / 2, 120 * PX, [("Fresh", AV, 0), ("Room", AV, 7)], 15 * PX, ink))
    # "Easy Slide" on the shelf's white front: 81 mm wide, 11 mm caps
    decal("print_easyslide.png", 100, 20, lambda d, w, h, PX: fit_text(d, 9.5 * PX, h / 2, 81 * PX, [("Easy", AV, 0), ("Slide", AV, 7)], 14 * PX, ink))

    def tall(d, w, h, PX):
        # the bottle icon (an outline with a neck), then "Tall Bottle Guard": 137 mm wide in all, 14 mm caps (close-up
        # g52_535050752: Tall and Bottle bold, Guard regular)
        x, yb, bw = 4 * PX, h - 3.5 * PX, 8 * PX
        line(d, [(x, yb), (x, yb - 12 * PX), (x + 2 * PX, yb - 16 * PX), (x + 2.6 * PX, yb - 21 * PX), (x + bw - 2.6 * PX, yb - 21 * PX),
                 (x + bw - 2 * PX, yb - 16 * PX), (x + bw, yb - 12 * PX), (x + bw, yb), (x, yb)], 1.2 * PX, ink)
        line(d, [(x, yb - 9 * PX), (x + bw, yb - 9 * PX)], 1.0 * PX, ink)
        fit_text(d, 16 * PX, h / 2 + 1 * PX, 125 * PX, [("Tall", AV, 0), ("Bottle", AV, 0), ("Guard", AV, 7)], 18 * PX, ink)
    decal("print_tallbottle.png", 145, 28, tall)

    def moist(d, w, h, PX):
        # the MoistFresh Zone plate on the Big Box cover's front (close-up g52_535050749): a white plate, the words over
        # three fine slots
        rrect(d, (1, 1, w - 1, h - 1), 3 * PX, fill=(240, 242, 245, 255), outline=(206, 209, 214, 255), w=0.5 * PX)
        fit_text(d, 22 * PX, h * 0.38, 106 * PX, [("MoistFresh", AV, 0), ("Zone", AV, 7)], 12 * PX, ink)
        for k in range(3):
            line(d, [(28 * PX, h * 0.66 + k * 2.2 * PX), (w - 28 * PX, h * 0.66 + k * 2.2 * PX)], 0.6 * PX, (196, 200, 206, 255))
    decal("print_moistfresh.png", 150, 32, moist, PX=10)


def shared_prints():
    tmp = tempfile.mkdtemp()
    argv = sys.argv
    sys.argv = ["tex_samsung_fridge.py", tmp]
    try:
        runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex_samsung_fridge.py"), run_name="__main__")
    finally:
        sys.argv = argv
    for n in ("bigbox_print.png", "icemaker_print.png"):
        shutil.copy(os.path.join(tmp, "samsung", n), os.path.join(D, n))
        print("copied", n)
    shutil.rmtree(tmp)


def page_photos():
    # four 900 x 900 photos on white, the product centred: the 3/4 view, the open doors empty and stocked, the other 3/4
    out = os.path.join(SITE_PHOTOS, "samsung-rt28c3053s8")
    os.makedirs(out, exist_ok=True)
    for i, f in enumerate(("g52_535218369.jpg", "g52_535050747.jpg", "g52_535050748.jpg", "g52_535218367.jpg")):
        im = Image.open(os.path.join(P, f)).convert("RGB")
        a = np.asarray(im).astype(int)
        ys, xs = np.where(a.min(2) < 244)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        side_ = int(max(x1 - x0, y1 - y0) * 1.08)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        sq = Image.new("RGB", (side_, side_), "white")
        bx0, by0 = cx - side_ // 2, cy - side_ // 2
        cx0, cy0, cx1, cy1 = max(0, bx0), max(0, by0), min(im.width, bx0 + side_), min(im.height, by0 + side_)
        sq.paste(im.crop((cx0, cy0, cx1, cy1)), (cx0 - bx0, cy0 - by0))
        sq = sq.resize((900, 900), Image.LANCZOS)
        p = os.path.join(out, f"{i}.jpg")
        sq.save(p, quality=88, optimize=True)
        print("wrote", p)


doors()
mark()
badge()
side()
rear()
back_freezer()
back_fridge()
deodorizer()
coolpack()
prints()
shared_prints()
if SITE_PHOTOS:
    page_photos()
