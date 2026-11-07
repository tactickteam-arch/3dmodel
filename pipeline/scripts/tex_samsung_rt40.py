"""Textures for the Samsung RT40H28W1CPNL (236 L, Camellia Purple: flat doors with the camellia print), written to
<out dir>/samsung_rt40/.

usage: python3 tex_samsung_rt40.py <photos dir> <logos dir> <out dir> [--compare]
  photos: samsung_rt40/g_551092233.jpg    Samsung India's straight-on front of this code: body x 736-1183 (447 px for
                                          555 mm, 0.805 px per mm), door top row 22, floor row 1258 (0.805 px per mm up)
          samsung_rt40/label_553849566.jpg Samsung India's picture of this model's own BEE label
                                          ("Model No.: RT40H28W1CPNL", 236 L, 1 star, 263 units/yr)
          samsung_rt40/g_551092223.jpg    the rear view of this code (x 735-1183, rows 20-1258: 0.807 px per mm)
          samsung_rt40/g_551092221.jpg    the freezer close-up: the marks round the freezer's slider control
  logos:  samsung.png
  writes:
    door_freezer.jpg, door_fridge.jpg   the print, Samsung's own picture of it at its own resolution (0.8 px per mm is all
                                        the detail any source of this door has), enlarged 3 x with Lanczos only so it
                                        filters smoothly; the SAMSUNG wordmark painted out (it is a sharp decal)
    mark.png                            the SAMSUNG wordmark in its light ink, from Samsung's own logo file
    label.png                           the BEE label, die-cut, from Samsung's own picture of it
    side_paint.jpg                      the dark teal-navy painted sides (Samsung's 3/4 views)
    rear.jpg, bay.jpg, base_rear.jpg    the embossed rear panel, the open compressor bay and the base plate under it
    cord_path.json                      the cord's route (ESTIMATED: Samsung's rear photo shows the connector, not the
                                        cord) and the bay's height
    back_freezer.png, back_fridge.png   the raised back-wall panels inside, redrawn: vents, screw caps, the freezer's
                                        slider marks (Max / Min), the fridge dial's scale
    bigbox_print.png                    "Big Box" and its three fruit icons, drawn by tex_samsung_fridge.py (the RT34's,
                                        run unchanged into a scratch folder): Samsung's open-door photo of this code
                                        shows the same print
"""
import json
import math
import os
import runpy
import shutil
import sys
import tempfile
from collections import deque

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = "--compare" in sys.argv
D = os.path.join(OUT, "samsung_rt40")
os.makedirs(D, exist_ok=True)
P = os.path.join(PHOTOS, "samsung_rt40")
rng = np.random.default_rng(40)
PAD = 10                             # clear margin round the decals' textures


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


# ── the doors (g_551092233.jpg) ──
# freezer door rows 22.5-434.5 (1535-1023 mm); the doors' gap 435-443; the fridge door's 7 mm silver top strip rows
# 443.5-449.5 (geometry); its print from row 450 to its bottom edge, row 1217 (51 mm). Columns 738-1180 are the doors'
# face (the outer 2 px each side are the edge's shading and the silver deco line, which is geometry).
X0, X1 = 738, 1180
FZ = (24, 434)
FR = (450, 1217)
UP = 3                               # enlargement, for filtering only
# the doors are satin, part metal (metalness 0.5, roughness 0.5 in the builder), so that the studio's tall light at 28 deg
# doesn't wash the dark print pale grey in the default view: that halves the print's own light, so it is saved at SHADE of
# the photo, less HL times its own lightness (0-1) as the viewer's tone curve lifts the light petals more than the dark
# ground; tuned on the render against Samsung's front (ratios of the label's white) and 3/4 photos (NOTES.md)
SHADE, HL = 1.06, 0.4
MARK_BOX = (939, 87, 980, 96)        # SAMSUNG on the freezer door: ink x 941-978, rows 89-94, padded


def doors():
    src = np.asarray(Image.open(os.path.join(P, "g_551092233.jpg")).convert("RGB")).copy()
    mask = np.zeros(src.shape[:2], np.uint8)
    x0, y0, x1, y1 = MARK_BOX
    mask[y0:y1 + 1, x0:x1 + 1] = 255
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(src, cv2.COLOR_RGB2BGR), mask, 4, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)

    def door(rows, name):
        a = clean[rows[0]:rows[1], X0:X1].astype(float)
        a[:, 0] = a[:, 1]
        a[:, -1] = a[:, -2]
        a = np.minimum(a * (SHADE * (1 - HL * a.mean(2) / 255))[..., None], 255)
        img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
        img = img.resize((img.width * UP, img.height * UP), Image.LANCZOS)
        save(img, name, q=86)
        return img

    fz = door(FZ, "door_freezer.jpg")
    fr = door(FR, "door_fridge.jpg")
    if COMPARE:
        ph = Image.open(os.path.join(P, "g_551092233.jpg")).convert("RGB")
        a = ph.crop((X0, FZ[0], X1, FZ[1])); b = fz.resize(a.size)
        c = ph.crop((X0, FR[0], X1, FR[1])); d = fr.resize(c.size)
        sheet = Image.new("RGB", (a.width * 2 + 10, a.height + c.height + 10), "white")
        sheet.paste(a, (0, 0)); sheet.paste(b, (a.width + 10, 0)); sheet.paste(c, (0, a.height + 10)); sheet.paste(d, (a.width + 10, a.height + 10))
        sheet.save(os.path.join(D, "_compare.png"))


def mark():
    # Samsung's own wordmark, in the light ink the front shows: the mean of the photo's ink pixels at 82% or more of
    # the box's brightest
    src = np.asarray(Image.open(os.path.join(P, "g_551092233.jpg")).convert("RGB")).astype(float)
    x0, y0, x1, y1 = MARK_BOX
    box = src[y0:y1 + 1, x0:x1 + 1].reshape(-1, 3)
    lum = box.mean(1)
    ink = box[lum >= 0.82 * lum.max()].mean(0)
    col = tuple(int(round(v)) for v in ink)
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
    print("mark ink", col, "ink aspect", round(im.width / im.height, 3), "padded", pad.size)


def label():
    # the sticker with its white margin and a thin pink cut line round it: the fill from the border stops at the cut line,
    # and the line itself is trimmed off (as tex_samsung_rt45.py does)
    src = Image.open(os.path.join(P, "label_553849566.jpg")).convert("RGB")
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.min(2) < 225)
    lab = src.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3)).convert("RGBA")
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g, b, _ = px[x, y]
        if min(r, g, b) < 238:
            continue
        seen[y, x] = True
        px[x, y] = (r, g, b, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = np.asarray(lab.getchannel("A").filter(ImageFilter.MinFilter(5)))
    q = lab.convert("RGB").quantize(colors=63, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(q).copy()
    idx[alpha < 128] = 63
    out = Image.frombytes("P", q.size, idx.astype(np.uint8).tobytes())
    out.putpalette(q.getpalette()[:63 * 3] + [255, 255, 255])
    # a clear margin of PAD px all round, so the texture's filtering never wraps one edge onto the other (a faint line
    # along the top); the builder sizes the plane to include it
    pad = Image.new("P", (out.width + 2 * PAD, out.height + 2 * PAD), 63)
    pad.putpalette(out.getpalette())
    pad.paste(out, (PAD, PAD))
    out = pad
    p = os.path.join(D, "label.png")
    out.save(p, optimize=True, transparency=bytes([255] * 63 + [0]))
    print("wrote", p, out.size, os.path.getsize(p) // 1024, "KB", "aspect h/w", round(out.height / out.width, 4))


def side():
    # Samsung's 3/4 views g_551092218 (right side) and g_551092224 (left): teal-navy, (14, 31, 41) at the top,
    # (20-23, 37-40, 47-50) at mid-height, (4, 21, 31) at the foot
    h, w = 768, 512
    yy = np.linspace(0, 1, h)[:, None]
    lift = 7 * np.exp(-((yy - 0.45) / 0.28) ** 2) - 9 * np.clip((yy - 0.75) / 0.25, 0, 1)
    speck = Image.fromarray(((rng.normal(0, 1, (h, w)) * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    s = (np.asarray(speck).astype(float) / 255 - 0.5) * 2.0
    img = np.stack([15 + lift + s, 32 + lift + s, 42 + lift + s], axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "side_paint.jpg")


# ── the rear (g_551092223.jpg) ──
# body x 735-1183 (448 px for 555 mm), top row 20 (the cabinet's top, 1535 mm), floor row 1258: 0.807 px per mm both
# ways. The compressor bay opens at row 1037 (274 mm); the cabinet's underside is 40 mm up (row 1226), and the grey base
# plate below it reaches the floor. The cord's connector is the black block at x 800-822, rows 268-290; Samsung's
# photo shows no cord on it, so its route is ESTIMATED: straight down from the connector, as Samsung's rear photo of
# the RT45 shows that model's cord leaving the same connector, then across just above the bay to the plug.
R_X0, R_X1, R_TOP, R_FLOOR, R_BAY, R_BASE = 735, 1183, 20, 1258, 1037, 1226
PPM = 448 / 555
CORD = [(811, 291), (811, 450), (811, 650), (811, 850), (811, 960), (813, 990), (820, 1006), (834, 1013),
        (860, 1015), (950, 1015), (1040, 1015), (1085, 1016)]
PLUG = (1110, 1016)


def rear():
    src = Image.open(os.path.join(P, "g_551092223.jpg")).convert("RGB")
    save(src.crop((R_X0 + 3, R_TOP + 2, R_X1 - 3, R_BAY)), "rear.jpg", q=84)
    bay = src.crop((R_X0 + 8, R_BAY, R_X1 - 8, R_BASE))
    save(bay.resize((bay.width * 2, bay.height * 2), Image.LANCZOS), "bay.jpg", q=84)
    save(src.crop((R_X0 + 3, R_BASE, R_X1 - 3, R_FLOOR)), "base_rear.jpg", q=84)
    xc = (R_X0 + R_X1) / 2
    to_m = lambda x, r: (round(-(x - xc) / PPM / 1000, 4), round((R_FLOOR - r) / PPM / 1000, 4))   # seen from behind
    json.dump({"ppm": PPM, "cord": [to_m(x, r) for x, r in CORD], "plug": to_m(*PLUG),
               "bay_top": round((R_FLOOR - R_BAY) / PPM / 1000, 4), "base": round((R_FLOOR - R_BASE) / PPM / 1000, 4),
               "cord_d": 0.008}, open(os.path.join(D, "cord_path.json"), "w"), indent=1)
    print("wrote cord_path.json; bay top", round((R_FLOOR - R_BAY) / PPM / 1000, 3), "m")


# ── back-wall panels, redrawn ──
AV = "/System/Library/Fonts/Avenir Next.ttc"
ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"
S = 2                                                     # drawn 2 x over and reduced


def font(path, px, face=0):
    return ImageFont.truetype(path, max(1, round(px * S)), index=face)


def rrect(d, box, r, fill=None, outline=None, w=1):
    x0, y0, x1, y1 = [v * S for v in box]
    d.rounded_rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), r * S, fill=fill, outline=outline, width=max(1, round(w * S)))


def text(d, xy, s, f, fill, anchor="mm"):
    d.text((xy[0] * S, xy[1] * S), s, font=f, fill=fill, anchor=anchor)


def line(d, pts, w, fill):
    d.line([(x * S, y * S) for x, y in pts], fill=fill, width=max(1, round(w * S)), joint="curve")


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


# Positions on the freezer's back wall are measured on Samsung's freezer close-up g_551092221 (the back wall 1030 px
# across for its 495 mm, 2.174 px per mm, its middle at x 935; the floor at the back wall row 1040), on the open-door
# photo g_551092219 for the fridge's (the back wall at 0.614 px per mm across and 0.666 up, its middle x 826, corrected
# for the camera: eye 0.662 m up at row 749). Each panel is its box in metres (x from the middle, y above the floor).
FZ_PANEL = (-0.21, 0.21, 1.071, 1.489)
FR_PANEL = (-0.13, 0.13, 0.607, 0.945)
FZ_FLOOR = 1.065


def back_freezer():
    yb = lambda row: FZ_FLOOR + (1040 - row) / 2.174 / 1000         # close-up row -> height
    xb = lambda col: (col - 935) / 2.174 / 1000

    def b(d, X, Y, PX):
        ink = (70, 74, 80, 255)
        # three vent slots under the ceiling (photo x 570-720, 835-1035, 1150-1305 at rows 145-172)
        for ca, cb in ((570, 720), (835, 1035), (1150, 1305)):
            slot(d, X, Y, xb(ca), xb(cb), yb(158), 12, PX)
        # the two round screw caps (photo (538, 255) and (1328, 255), 18 px across)
        for c in (538, 1328):
            cx, cy, r = X(xb(c)), Y(yb(255)), 8.3 * PX
            d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), fill=(242, 243, 245, 255), outline=(176, 180, 186, 255), width=round(0.5 * PX * S))
        # the lower raised panel's left edge (photo x 905, rows 595-1040) and its vent slot (x 1145-1300, row 615)
        line(d, [(X(xb(905)), Y(yb(598))), (X(xb(905)), Y(yb(1036)))], 0.5 * PX, (222, 225, 229, 255))
        line(d, [(X(xb(905)), Y(yb(598))), (X(xb(1395)), Y(yb(598)))], 0.5 * PX, (222, 225, 229, 255))
        slot(d, X, Y, xb(1145), xb(1300), yb(615), 9, PX)
        # the slider control (close-up x 917-1031, rows 800-816): its groove and the slide at the left end
        rrect(d, (X(xb(917)), Y(yb(800)), X(xb(1031)), Y(yb(816))), 3.6 * PX, fill=(236, 238, 241, 255), outline=(206, 209, 214, 255), w=0.5 * PX)
        rrect(d, (X(xb(918)), Y(yb(801)), X(xb(950)), Y(yb(815))), 3.4 * PX, fill=(250, 250, 251, 255), outline=(214, 217, 221, 255), w=0.4 * PX)
        # above it: a down triangle, two ticks, three hexagons with a snowflake each, "Max" over them
        tri = lambda cx, cy, s, up: d.polygon([((cx - s) * S, (cy + (s if up else -s) * 0.8) * S), ((cx + s) * S, (cy + (s if up else -s) * 0.8) * S), (cx * S, (cy - (s if up else -s) * 0.8) * S)], fill=ink)
        tri(X(xb(931.8)), Y(yb(778.8)), 1.3 * PX, False)
        for c in (951.3, 971.8):
            line(d, [(X(xb(c)), Y(yb(776.3))), (X(xb(c)), Y(yb(781.3)))], 0.35 * PX, ink)
        for c in (995.8, 1011.0, 1026.5):
            cx, cy, r = X(xb(c)), Y(yb(778.8)), 3.4 * PX
            d.polygon([((cx + r * math.cos(math.radians(30 + 60 * k))) * S, (cy + r * math.sin(math.radians(30 + 60 * k))) * S) for k in range(6)], outline=ink, width=round(0.32 * PX * S))
            for k in range(3):
                a = math.radians(90 + 60 * k)
                line(d, [(cx - 0.6 * r * math.cos(a), cy - 0.6 * r * math.sin(a)), (cx + 0.6 * r * math.cos(a), cy + 0.6 * r * math.sin(a))], 0.3 * PX, ink)
        text(d, (X(xb(1011.3)), Y(yb(766.3))), "Max", font(AV, 2.9 * PX, 5), ink)
        # below it: an up triangle, three ticks, a drop with a snowflake in it, "Min" under it
        tri(X(xb(931.8)), Y(yb(838.8)), 1.3 * PX, True)
        for c in (951.3, 971.8, 991.8):
            line(d, [(X(xb(c)), Y(yb(836.3))), (X(xb(c)), Y(yb(841.3)))], 0.35 * PX, ink)
        cx, cy, r = X(xb(1011.3)), Y(yb(841.5)), 2.6 * PX
        d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), outline=ink, width=round(0.32 * PX * S))
        line(d, [(cx - r * 0.72, cy - r * 0.7), (cx, cy - r * 2.1), (cx + r * 0.72, cy - r * 0.7)], 0.32 * PX, ink)
        for k in range(3):
            a = math.radians(90 + 60 * k)
            line(d, [(cx - 0.55 * r * math.cos(a), cy - 0.55 * r * math.sin(a)), (cx + 0.55 * r * math.cos(a), cy + 0.55 * r * math.sin(a))], 0.28 * PX, ink)
        text(d, (X(xb(1011.3)), Y(yb(853.5))), "Min", font(AV, 2.9 * PX, 5), ink)
    back_panel("back_freezer.png", FZ_PANEL, b)


def back_fridge():
    xb = lambda col: (col - 826) / 0.614 / 1000
    yb = lambda row: (662 + (748.6 - row) / 0.666) / 1000

    def b(d, X, Y, PX):
        ink = (70, 74, 80, 255)
        slot(d, X, Y, xb(793), xb(820), yb(581), 7, PX)            # two short vents under the top
        slot(d, X, Y, xb(835), xb(860), yb(581), 7, PX)
        slot(d, X, Y, xb(765), xb(788), yb(641), 7, PX)            # two beside the dial
        slot(d, X, Y, xb(862), xb(887), yb(641), 7, PX)
        # the dial's scale, measured round the knob's centre on the photo (827.5, 663.1; about 0.64 px per mm on the back
        # wall): the arc 24 mm out from 180 to 330 degrees, thickening towards 5; the numbers 1-5 31 mm out at 179, 205,
        # 236, 268 and 301 degrees; a drop mark before 1, two over 4, three after the arc's end. The character before
        # the three can't be read on any photo and is left out.
        cx, cy = X(0.0), Y(0.790)
        ra, rn, rd = 24 * PX, 31 * PX, 37 * PX
        for k in range(50):
            t0 = 180 + k * 3.0
            wdt = 0.4 + 1.8 * k / 49
            d.arc(((cx - ra) * S, (cy - ra) * S, (cx + ra) * S, (cy + ra) * S), t0, t0 + 3.2, fill=ink, width=max(1, round(wdt * PX * S)))
        f = font(ARIAL, 3.4 * PX)
        for i, ang in enumerate((179, 205, 236, 268, 301)):
            a = math.radians(ang)
            text(d, (cx + rn * math.cos(a), cy + rn * math.sin(a)), str(i + 1), f, ink)

        def drop(x, y, r):
            w = max(1, round(0.3 * PX * S))
            d.ellipse(((x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S), outline=ink, width=w)
            th = math.radians(42)
            line(d, [(x - r * math.sin(th), y - r * math.cos(th)), (x, y - r * 2.1), (x + r * math.sin(th), y - r * math.cos(th))], 0.3 * PX, ink)
        drop(cx + rd * math.cos(math.radians(180)), cy + 0.6 * PX, 1.5 * PX)
        for k in (-1, 1):
            drop(cx + k * 1.9 * PX, cy - rd, 1.4 * PX)
        for k in range(3):
            drop(cx + (34 + 5.6 * k) * PX, cy - 14.5 * PX, 1.5 * PX)
        # the louvres along the panel's foot (photo rows 765-780: three groups)
        for ca, cb in ((765, 800), (815, 840), (850, 890)):
            for k in range(3):
                line(d, [(X(xb(ca)), Y(yb(767 + k * 5))), (X(xb(cb)), Y(yb(767 + k * 5)))], 1.2 * PX, (200, 204, 209, 255))
    back_panel("back_fridge.png", FR_PANEL, b, PX=5)


def shared_prints():
    tmp = tempfile.mkdtemp()
    argv = sys.argv
    sys.argv = ["tex_samsung_fridge.py", tmp]
    try:
        runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex_samsung_fridge.py"), run_name="__main__")
    finally:
        sys.argv = argv
    shutil.copy(os.path.join(tmp, "samsung", "bigbox_print.png"), os.path.join(D, "bigbox_print.png"))
    print("copied bigbox_print.png")
    shutil.rmtree(tmp)


doors()
mark()
label()
side()
rear()
back_freezer()
back_fridge()
shared_prints()
