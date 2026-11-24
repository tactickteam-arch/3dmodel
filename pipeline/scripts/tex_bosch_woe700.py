"""Textures for the Bosch WOE700D0IN, Series 2 top-load washing machine, 7 kg, 680 rpm (bosch-woe700d0in).

usage: python3 tex_bosch_woe700.py <photos dir> <logos dir> <out dir>
  photos: bosch_woe700/27273256_WOE700D0IN_PGA1_def.webp   Bosch's close-up of the rear control panel, 3565 x 1597
          bosch_woe700/27273259_WOE700D0IN_PGA2_def.webp   Bosch's side view (the left side, front to the right), 1107 x 2075
          bosch_woe700/27273291_WOE700D0IN_PGA3_def.webp   Bosch's rear view, 1048 x 1912
          bosch_woe700/27273258_WOE700D0IN_PGA6_def.webp   Bosch's view into the open machine, 2840 x 2160
          bosch_woe700/manual_expertcare.png               the ExpertCare mark as printed in Bosch's manual 9001792021 (fascia, p. 13)
  logos:  bosch.png
  writes <out dir>/bosch_woe700/*.jpg|png and rear.json (the cord's path on the back, in metres)

The control panel (the console's sloped face, 542 x 128 mm) is drawn again at 10 px per mm on the model:
  - PGA1 is warped square-on with the display window's four corners (a 259 x 119 mm rectangle centred on the panel, ESTIMATED
    from PGA1 and the top view PGA5, which agree within 2 %);
  - the studio's reflection is left out: the panel and the window are flat colours;
  - every word and number is set again in Avenir Next, fitted to the ink box it has in the photo;
  - the round keys are drawn as circles at their measured centres and radii;
  - icons, the display's digits, the ring round the display, leader lines and brackets are the photo's own ink, cleaned to hard
    edges (no word is drawn from the photo);
  - the ExpertCare mark is Bosch's own art from the manual.
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "bosch_woe700")
D = os.path.join(OUT, "bosch_woe700")
os.makedirs(D, exist_ok=True)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FONT_C = "/System/Library/Fonts/Avenir Next Condensed.ttc"
W_MM, H_MM, D_MM = 542.0, 1015.0, 552.0          # Bosch (product page, product sheet, manual 9001792021 technical data)

P = 10.0                                          # panel texture: px per mm
FACE_W, FACE_H = 542.0, 128.0                     # the panel face (W across, along the slope ESTIMATED from PGA1 and PGA2)


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(np.float32)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", p, img.size)


def font(px, face=5, fam=FONT):                  # 7 Regular, 5 Medium, 2 Demi Bold, 0 Bold
    return ImageFont.truetype(fam, max(4, round(px)), index=face)


def text_mask(s, px, face=5, fam=FONT):
    f = font(px, face, fam)
    w = int(f.getlength(s) + px * 2)
    h = int(px * 2.2)
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).text((px * 0.5, px * 0.4), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.3)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def blend(canvas, m, X, Y, colour):
    h, w = m.shape
    xa, ya, xb, yb = max(0, X), max(0, Y), min(canvas.shape[1], X + w), min(canvas.shape[0], Y + h)
    if xb <= xa or yb <= ya:
        return
    a = np.clip(m[ya - Y:yb - Y, xa - X:xb - X], 0, 1)[..., None]
    canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + np.array(colour, np.float32) * a


def word(canvas, s, box, colour, face=5):
    """A word fitted to its ink box: the family (Avenir Next or its Condensed cut) whose shape fits the box best, scaled to the
    box's width and centred on it."""
    bw, bh = box[2] - box[0], box[3] - box[1]
    best = None
    for fam in (FONT, FONT_C):
        m = text_mask(s, 80, face, fam)
        err = abs(math.log((m.shape[1] / m.shape[0]) / (bw / bh)))
        if best is None or err < best[0]:
            best = (err, fam)
    fam = best[1]
    m0 = text_mask(s, 80, face, fam)
    k = bw / m0.shape[1]
    m = text_mask(s, 80 * k, face, fam)
    m = cv2.resize(m, (max(1, round(bw)), max(1, round(m.shape[0] * bw / m.shape[1]))), interpolation=cv2.INTER_AREA)
    cy = (box[1] + box[3]) / 2
    blend(canvas, m, round(box[0]), round(cy - m.shape[0] / 2), colour)
    return fam


# ── the panel ──
def rectified_panel():
    im = load("27273256_WOE700D0IN_PGA1_def.webp")
    src = np.float32([(1024, 19), (2541, 19), (1015, 718), (2551, 718)])          # the window's corners in PGA1
    dst = np.float32([(141.5 * P, 1.9 * P), (400.5 * P, 1.9 * P), (141.5 * P, 121 * P), (400.5 * P, 121 * P)])
    H = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(im, H, (int(FACE_W * P), int(FACE_H * P)), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def ink_of(ph, box, pad=6):
    """The photo's ink inside a box: how far each pixel stands above the local background, 0..1, cleaned to hard edges."""
    x0, y0, x1, y1 = box
    X0, Y0, X1, Y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    sub = ph[Y0:Y1, X0:X1]
    L = sub.max(2)
    bg = np.median(np.concatenate([L[:3].ravel(), L[-3:].ravel(), L[:, :3].ravel(), L[:, -3:].ravel()]))
    peak = np.percentile(L, 99.5)
    a = np.clip((L - bg) / max(20, peak - bg), 0, 1)
    a = cv2.GaussianBlur(a, (0, 0), 0.9)
    a = np.clip((a - 0.32) / 0.22, 0, 1)                      # a narrow soft threshold: a clean edge, about one pixel of antialias
    return a, sub, (X0, Y0)


BLUE, WHITE, GREEN, DIM = (38, 132, 214), (236, 236, 238), (124, 196, 60), (50, 50, 52)
FACE_C, WIN_C, KEY_C = (30, 30, 32), (21, 21, 23), (66, 66, 66)

# words: (text, search box in the warped photo at 10 px/mm, face). The box is narrowed to the word's own ink first.
WORDS = [
    ("Smart", (2240, 290, 2395, 355)), ("Quick", (2240, 420, 2390, 490)), ("Mix", (2240, 550, 2335, 612)),
    ("Delicates", (2240, 678, 2465, 742)),
    ("Heavy", (3040, 288, 3192, 352)), ("Whites", (3020, 418, 3192, 488)), ("Cottons", (3000, 548, 3192, 612)),
    ("Tub clean", (2960, 678, 3192, 742)),
    ("Soak", (1755, 840, 1860, 890)), ("Water", (1955, 840, 2078, 890)), ("Cycle", (3360, 838, 3472, 892)),
    ("Delay", (3570, 838, 3685, 892)),
    ("Anti-Tangle", (3332, 350, 3492, 384)), ("Wash", (3372, 476, 3460, 510)), ("Rinse", (3368, 602, 3462, 640)),
    ("Spin", (3372, 730, 3455, 770)),
    ("Child Lock", (1822, 984, 2000, 1016)), ("Hold for 3 sec.", (1810, 1016, 2015, 1048)),
    ("Add Rinse", (2636, 984, 2805, 1016)), ("Hold for 3 sec.", (2630, 1016, 2810, 1048)),
    ("Anti-Tangle", (3330, 984, 3500, 1016)), ("Hold for 3 sec.", (3326, 1016, 3504, 1048)),
    ("EcoSilence", (4625, 598, 4958, 670)), ("Drive", (4970, 598, 5128, 670)), ("7", (5195, 600, 5236, 668)),
    ("kg", (5252, 598, 5328, 684)),
]
DIGITS = [("4", (2010, 290, 2055, 352)), ("3", (2010, 415, 2055, 480)), ("2", (2010, 540, 2055, 606)), ("1", (2010, 668, 2055, 737))]
# ink that is not a word: icons (blue and white parts), the display, the ring, leader lines, brackets, key symbols
INK = [
    (1770, 520, 1856, 600), (1770, 648, 1856, 738),                                                     # child lock, soak
    (3336, 268, 3490, 348), (3374, 393, 3460, 474), (3373, 520, 3460, 600), (3364, 648, 3458, 728),     # programme icons
    (3583, 520, 3663, 610), (3575, 648, 3668, 740),                                                     # the two at the right
    (2675, 440, 2915, 592),                                                                             # 1:25
    (2682, 333, 2753, 403), (2677, 622, 2754, 696),                                                     # e leaf, +1 rinse
    (2400, 790, 2512, 940), (2660, 790, 2776, 940), (2920, 790, 3040, 940),                             # key symbols
]
BLUE_ONLY = [(1972, 284, 2054, 356), (1972, 409, 2054, 482), (1972, 535, 2054, 608), (1972, 664, 2054, 740)]   # water levels
RING = (2716.0, 516.0)
LINES = [   # leader lines and brackets: thin boxes whose ink is kept
    (2398, 318, 2520, 332), (2392, 448, 2500, 462), (2340, 576, 2486, 592), (2470, 704, 2560, 718),
    (2878, 314, 3036, 330), (2916, 446, 3012, 460), (2918, 574, 2996, 590), (2870, 700, 2952, 716),
    (1800, 930, 1816, 1020), (2010, 930, 2026, 1020), (1800, 1004, 1830, 1022), (1996, 1004, 2026, 1022),
]
KEYS = [((1807.5, 865), 65), ((2017.5, 865), 65), ((2455.5, 865.5), 81.5), ((2717.5, 865.5), 82), ((2979.5, 865), 82),
        ((3416.5, 865.5), 65.5), ((3627.5, 865), 65)]
DASHES_Y = [324, 455, 584, 709]


def tight(ph, box, thr=110, gap=16):
    """A word's ink box inside its search box: white pixels (every channel above thr), grouped into runs of columns and rows
    no more than gap px apart; the run with the most ink is the word (a leader line's end or an icon's edge falls away)."""
    x0, y0, x1, y1 = box
    m = ph[y0:y1, x0:x1].min(2) > thr

    def run(prof):
        idx = np.where(prof > 0)[0]
        groups, start = [], idx[0]
        for a, b in zip(idx[:-1], idx[1:]):
            if b - a > gap:
                groups.append((start, a)); start = b
        groups.append((start, idx[-1]))
        return max(groups, key=lambda g: prof[g[0]:g[1] + 1].sum())
    ya, yb = run(m.sum(1))
    xa, xb = run(m[ya:yb + 1].sum(0))
    ya2, yb2 = run(m[:, xa:xb + 1].sum(1))
    return (x0 + xa, y0 + ya2, x0 + xb + 1, y0 + yb2 + 1)


def panel():
    ph = rectified_panel()
    Hh, Ww = ph.shape[:2]
    c = np.zeros((Hh, Ww, 3), np.float32) + np.array(FACE_C, np.float32)
    # the display window: a darker glass rectangle with a fine lighter edge
    wx0, wy0, wx1, wy1 = [round(v * P) for v in (141.5, 1.9, 400.5, 121.0)]
    c[wy0:wy1, wx0:wx1] = (44, 44, 46)
    c[wy0 + 3:wy1 - 3, wx0 + 3:wx1 - 3] = WIN_C
    # unlit and lit programme lamps
    for i, y in enumerate(DASHES_Y):
        for x0, x1 in ((2183, 2227), (3208, 3250)):
            m = np.zeros((14 * 4, (x1 - x0) * 4), np.uint8)
            cv2.rectangle(m, (24, 0), (m.shape[1] - 25, m.shape[0] - 1), 255, -1)
            for cx in (24, m.shape[1] - 25):
                cv2.circle(m, (cx, 27), 27, 255, -1, lineType=cv2.LINE_AA)
            m = cv2.resize(m, (x1 - x0, 14), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
            blend(c, m, x0, y - 7, WHITE if (i == 0 and x0 == 2183) else DIM)
    # round keys
    for (cx, cy), r in KEYS:
        s = 4
        m = np.zeros((int(2 * r + 8) * s, int(2 * r + 8) * s), np.uint8)
        cv2.circle(m, (m.shape[1] // 2, m.shape[0] // 2), int(r * s), 255, -1, lineType=cv2.LINE_AA)
        m = cv2.resize(m, (m.shape[1] // s, m.shape[0] // s), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        blend(c, m, round(cx - m.shape[1] / 2), round(cy - m.shape[0] / 2), KEY_C)
    # the ring round the display: a circle 23.1 mm across the middle of its 1.2 mm line (measured), its light falling round it
    # as the photo has it (sampled every 5 degrees: bright at the top right and lower left, fading out between)
    L = ph.max(2)
    angs = np.arange(0, 360, 5)
    lit = []
    for th in angs:
        t = math.radians(th)
        lit.append(max(L[int(round(RING[1] + r * math.sin(t))), int(round(RING[0] + r * math.cos(t)))] for r in range(222, 241)))
    lit = np.array(lit, np.float32)
    lit = (np.roll(lit, 1) + 2 * lit + np.roll(lit, -1)) / 4
    r0, hw = 231.0, 6.0
    X0, Y0 = int(RING[0] - r0 - 12), int(RING[1] - r0 - 12)
    yy, xx = np.mgrid[0:int(2 * r0 + 24), 0:int(2 * r0 + 24)]
    dx, dy = xx + X0 - RING[0], yy + Y0 - RING[1]
    rr = np.hypot(dx, dy)
    th = (np.degrees(np.arctan2(dy, dx)) % 360)
    b = np.interp(th, np.append(angs, 360), np.append(lit, lit[0]))
    a = np.clip(hw + 0.5 - np.abs(rr - r0), 0, 1) * np.clip((b - 30) / 60, 0, 1)
    col = np.clip(b, 60, 245)[..., None].repeat(3, 2)
    region = c[Y0:Y0 + a.shape[0], X0:X0 + a.shape[1]]
    region[:] = region * (1 - a[..., None]) + col * a[..., None]
    # icons and other ink, each pixel blue, green or white as the photo has it
    for box in INK + LINES + BLUE_ONLY:
        a, sub, (X0, Y0) = ink_of(ph, box, pad=2)
        if box in BLUE_ONLY:          # the water-level marks: their numbers are set again as type, so only the blue is kept
            sm0 = cv2.GaussianBlur(sub, (0, 0), 1.0)
            a = a * np.clip(((sm0[..., 2] - sm0[..., 0]) - 15) / 25, 0, 1)
        sm = cv2.GaussianBlur(sub, (0, 0), 1.5)
        r, g, b = sm[..., 0], sm[..., 1], sm[..., 2]
        colr = np.zeros_like(sub) + np.array(WHITE, np.float32)
        colr[((b - r) > 28) & (b >= g)] = BLUE
        colr[((g - r) > 25) & (g > b + 15)] = GREEN
        if box in LINES:
            colr[:] = (205, 205, 208)
        region = c[Y0:Y0 + a.shape[0], X0:X0 + a.shape[1]]
        region[:] = region * (1 - a[..., None]) + colr * a[..., None]
    # words and numbers, set again
    out = []
    for s, box in WORDS + DIGITS:
        eco = s in ("EcoSilence", "Drive", "7", "kg")
        tb = tight(ph, box, thr=95 if eco else 110, gap=10 if len(s) < 3 else 16)
        fam = word(c, s, tb, (214, 214, 216) if eco else WHITE, face=7 if eco else 5)
        out.append((s, [int(v) for v in tb], os.path.basename(fam)))
    # the "|" between Drive and 7, and the two underlines
    for x0, y0, x1, y1, v in ((5158, 600, 5164, 665, 200), (105, 703, 922, 706, 165), (4510, 705, 5328, 708, 165)):
        c[y0:y1, x0:x1] = (v, v, v + 2)
    # the ExpertCare mark: Bosch's art from the manual, its hands and its name each fitted to the photo's ink boxes
    man = 1 - np.asarray(Image.open(os.path.join(SRC, "manual_expertcare.png")).convert("L")).astype(np.float32) / 255
    hands, name = man[0:250, 0:330], man[0:250, 380:1460]
    for m, (x0, y0, x1, y1) in ((hands, (105, 589, 207, 688)), (name, (242, 603, 576, 673))):
        ys, xs = np.where(m > 0.4)
        m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        m = cv2.resize(m, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA)
        blend(c, m, x0, y0, (226, 226, 228))
    img = Image.fromarray(c.clip(0, 255).astype(np.uint8))
    half = img.size[0] // 2
    save(img.crop((0, 0, half, img.size[1])), "face_l.jpg", 90)
    save(img.crop((half, 0, img.size[0], img.size[1])), "face_r.jpg", 90)
    return out


# ── the sides: Bosch's side photo, the grey body only (rows 474-1943, the body 66-840 mm above the floor) ──
SIDE_ROWS = (474, 1943)
SIDE_COLS = (44, 1105)          # the body's back and front edge


def side():
    im = load("27273259_WOE700D0IN_PGA2_def.webp")
    x0, x1 = SIDE_COLS
    y0, y1 = SIDE_ROWS
    a = im[y0:y1, x0:x1].copy()
    # the cord hanging on the back edge (columns 12-35 at rows 460-1050) is outside the crop; the photo's broad light fall is kept
    # at half strength so the 3D light can add its own
    L = a.mean(2)
    yy, xx = np.mgrid[0:L.shape[0], 0:L.shape[1]]
    A = np.stack([np.ones_like(L), xx / L.shape[1], yy / L.shape[0], (xx / L.shape[1]) ** 2, (yy / L.shape[0]) ** 2], -1).reshape(-1, 5)
    mask = (L > 90).reshape(-1)
    coef, *_ = np.linalg.lstsq(A[mask], np.log(L.reshape(-1)[mask] + 1), rcond=None)
    fit = np.exp(A @ coef).reshape(L.shape)
    flat = a / (fit / fit.mean())[..., None] ** 0.5
    img = Image.fromarray((flat * 0.86).clip(0, 255).astype(np.uint8)).resize((1060, 1470), Image.LANCZOS)
    save(img, "side_l.jpg", 86)
    save(img.transpose(Image.FLIP_LEFT_RIGHT), "side_r.jpg", 86)


# ── the back: Bosch's rear view; the cord and plug (modelled in 3D) painted out ──
RROW_840, RPX_MM_V = 338.5, 1.8553       # the grey back starts at row 338.5 (840 mm) and ends at 1774.5 (66 mm)
RPX_MM_H = 1046 / W_MM
CORD = [(130, 440), (100, 405), (70, 345), (66, 300), (90, 276), (200, 274), (350, 282), (500, 290), (650, 296), (800, 292),
        (940, 282), (985, 288), (1012, 315), (1022, 420), (1018, 560), (990, 690), (945, 790), (905, 920), (880, 1030),
        (810, 1085), (690, 1135), (560, 1168), (450, 1152), (355, 1103), (295, 1040), (277, 965), (276, 930)]
PLUG = (268, 862)


def rear():
    im = load("27273291_WOE700D0IN_PGA3_def.webp")
    h, w = im.shape[:2]
    m = np.zeros((h, w), np.uint8)
    pts = np.array(CORD, np.int32)
    cv2.polylines(m, [pts], False, 255, 16)
    cv2.ellipse(m, PLUG, (42, 62), 0, 0, 360, 255, -1)
    # keep the plug's round holder (a dark recess) out of the mask's middle: only the light-grey plug and cord pixels go
    L = im.mean(2)
    m = ((m > 0) & (L > 95)).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    out = cv2.inpaint(im.clip(0, 255).astype(np.uint8), m, 6, cv2.INPAINT_TELEA)
    img = Image.fromarray(out)
    # white background (outside the silhouette) becomes the black of the back's edges
    a = np.asarray(img).astype(np.float32)
    bgm = a.min(2) > 235
    a[bgm] = (24, 24, 26)
    img = Image.fromarray((a * 0.85).clip(0, 255).astype(np.uint8))
    save(img, "rear.jpg", 86)
    to_m = lambda p: [round((W_MM / 2 - p[0] / RPX_MM_H) / 1000, 4), round((840 - (p[1] - RROW_840) / RPX_MM_V) / 1000, 4)]
    json.dump({"cord": [to_m(p) for p in CORD], "plug": to_m(PLUG), "rowOf840": RROW_840, "pxPerMmV": RPX_MM_V,
               "pxPerMmH": RPX_MM_H, "size": [w, h]}, open(os.path.join(D, "rear.json"), "w"), indent=1)
    print("wrote rear.json")


# ── the lid's glass: black print round a tinted window; the Bosch armature in its middle is its own decal ──
GL_W, GL_D, GP = 513.0, 321.0, 4.0            # glass, measured on the top view PGA5 at 3.346 px/mm; 4 px per mm
WIN = (46.0, 39.0, 467.0, 301.0, 12.0)         # the clear window inside it: x0, y0 (from the glass's back edge), x1, y1, radius
EMB = (256.5, 142.0, 61.0)                     # the armature's centre and outer radius


def glass(logos):
    w, h = round(GL_W * GP), round(GL_D * GP)
    rgba = np.zeros((h, w, 4), np.float32)
    rgba[..., :3] = (13, 13, 15)
    rgba[..., 3] = 1.0
    s = 4
    m = np.zeros((h * s, w * s), np.uint8)
    x0, y0, x1, y1, r = [v * GP * s for v in WIN]
    r = int(r)
    cv2.rectangle(m, (int(x0 + r), int(y0)), (int(x1 - r), int(y1)), 255, -1)
    cv2.rectangle(m, (int(x0), int(y0 + r)), (int(x1), int(y1 - r)), 255, -1)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        cv2.circle(m, (int(cx), int(cy)), r, 255, -1, lineType=cv2.LINE_AA)
    win = cv2.resize(m, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    rgba[..., :3] = rgba[..., :3] * (1 - win[..., None]) + np.array((18, 22, 26), np.float32) * win[..., None]
    rgba[..., 3] = 1 - win * 0.22          # tinted: the photos show the glass dark, the drum barely seen through it
    img = Image.fromarray(np.dstack([rgba[..., :3].clip(0, 255), (rgba[..., 3:] * 255).clip(0, 255)]).astype(np.uint8), "RGBA")
    save(img, "glass.png")
    # the armature: the emblem of Bosch's logo, drawn as its outlines (the photo shows it as raised lines on the glass);
    # its own decal at 12 px per mm so the lines stay sharp up close
    AP = 12.0
    lg = np.asarray(Image.open(os.path.join(logos, "bosch.png")).convert("RGBA")).astype(np.float32)[..., 3] / 255
    cols = np.where(lg.max(0) > 0.5)[0]
    gaps = np.where(np.diff(cols) > 20)[0]
    emb = lg[:, cols[0]:cols[gaps[0]] + 1] if len(gaps) else lg
    ys, xs = np.where(emb > 0.5)
    emb = emb[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    D_px = round(2 * EMB[2] * AP * s)
    e = cv2.resize(emb, (D_px, D_px), interpolation=cv2.INTER_CUBIC)
    eb = (e > 0.5).astype(np.uint8)
    lw = max(1, round(1.3 * AP * s))
    edge = cv2.morphologyEx(eb, cv2.MORPH_GRADIENT, np.ones((lw, lw), np.uint8)).astype(np.float32)
    edge = np.pad(edge, s * 12)
    edge = cv2.resize(edge, (edge.shape[1] // s, edge.shape[0] // s), interpolation=cv2.INTER_AREA)
    arm = np.zeros(edge.shape + (4,), np.uint8)
    arm[..., :3] = (70, 72, 76)
    arm[..., 3] = (edge * 0.9 * 255).clip(0, 255)
    save(Image.fromarray(arm, "RGBA"), "armature.png")


# ── Bosch's mark and name on the front's silver band ──
def band_logo(logos):
    lg = Image.open(os.path.join(logos, "bosch.png")).convert("RGBA")
    a = np.asarray(lg).astype(np.float32)[..., 3]
    ys, xs = np.where(a > 10)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    w = round(87 * 12)                         # 87 mm across (PGA6), 12 px per mm
    h = round(a.shape[0] * w / a.shape[1])
    a = cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA)
    rgba = np.zeros((h + 8, w + 8, 4), np.uint8)
    rgba[..., :3] = (92, 93, 96)
    rgba[4:-4, 4:-4, 3] = a.clip(0, 255).astype(np.uint8)
    save(Image.fromarray(rgba, "RGBA"), "band_logo.png")
    return w / 12, (h) / 12


# ── the drum, the lint filter, the detergent drawer's front ──
def drum():
    # Bosch's view into the drum (PGA6) shows a light grey drum with rows of small oval holes; the pattern is ESTIMATED
    T = 512
    img = Image.new("RGB", (T, T), (226, 227, 230))
    d = ImageDraw.Draw(img)
    for j in range(8):
        for i in range(8):
            cx = (i + 0.5 * (j % 2)) * T / 8 + T / 16
            cy = j * T / 8 + T / 16
            for dx in (-T, 0, T):
                d.ellipse((cx + dx - 9, cy - 5, cx + dx + 9, cy + 5), fill=(150, 152, 158))
    save(img, "drum.jpg", 88)
    f = Image.new("RGB", (256, 512), (200, 202, 206))
    d = ImageDraw.Draw(f)
    for j in range(40):
        for i in range(10):
            d.ellipse((20 + i * 22 - 3, 14 + j * 12 - 3, 20 + i * 22 + 3, 14 + j * 12 + 3), fill=(150, 152, 158))
    save(f, "filter.jpg", 88)


def drawer_face():
    im = load("27273258_WOE700D0IN_PGA6_def.webp")
    crop = im[504:584, 1030:1826]
    save(Image.fromarray((crop * 0.9).clip(0, 255).astype(np.uint8)), "drawer.jpg", 90)


def main():
    words = panel()
    side()
    rear()
    glass(LOGOS)
    lw = band_logo(LOGOS)
    drum()
    drawer_face()
    json.dump({"words": words, "bandLogoMm": lw}, open(os.path.join(D, "layout.json"), "w"), indent=1)


main()
