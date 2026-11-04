"""Textures for the Whirlpool 360 Bloomwash Pro top-load washers, model code 31671 (8.5 kg, Midnight Grey).
tex_whirlpool_31688.py imports this file and runs it with the 31688's own photos and settings (10 kg, Graphite).

usage: python3 tex_whirlpool_31671.py <photos dir> <out dir> [--debug <dir>]
  photos:  whirlpool_31671/ (Whirlpool India's own gallery for 31671, 1200 x 1200; the label 1500 x 1500):
           top_open.jpg   the machine from above with the lid open: the control panel seen near its normal
                          (the panel's Whirlpool wordmark has the official mark's proportions in it, 3.0 : 1)
           label.jpg      Whirlpool's energy label published on 31671's page (0.0107 kWh/kg/cycle, 8.5 kg, VA I4 85 5S / 2025)
  writes <out dir>/whirlpool_31671/*

The control panel is drawn new at 7.2 px/mm. Every word is set again in Avenir Next, fitted to the box the word has in
Whirlpool's photo, in the photo's own colour (white, the Eco Wash green, the heater orange). Whirlpool publishes no manual or
vector panel drawing for these models, so each icon is the photo's own ink, enlarged 8x, smoothed and re-thresholded into
clean edges. The key outlines, the display window, the rules, the brackets and the LED dashes are drawn as shapes where the
photo has them. The Whirlpool wordmark is the official mark (pipeline/sources/logos/whirlpool.svg), white with its gold ring
as on the panel. The side relief, the black back, the drum, the impeller and the lid's chrome are drawn from the photos.
"""
import math
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BOLD, BOLDI, DEMI, MED, MEDI, REG = 0, 1, 2, 5, 6, 7
BASK = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
PX_MM = 7.2

# ── the 31671's settings (tex_whirlpool_31688.py passes its own) ──
CFG = {
    "slug": "whirlpool_31671",
    "photo": "top_open.jpg",
    # the panel face in the photo (its printed glass, between the arched top edge and the lid's edge), and its size in mm:
    # 842 photo px across 508 mm, and the photo is at true aspect there (the wordmark measures 3.0 : 1, as the official mark)
    "quad": [[183, 141], [1025, 141], [1025, 343], [183, 343]],
    "rect": (842, 202),
    "face_mm": (508, 122),
    "kg": "8.5 kg",
    "body": (70, 77, 86),          # Midnight Grey, sRGB: the same as the cabinet (0x464d56), so the side decal blends into it
    "label": "label.jpg",
    "map": None,                    # photo windows below are the 31671's own
}

# Windows round each element, in the rectified 31671 photo's px. ink_box() tightens each one to the ink inside it.
TEXTS = [
    ("P1 - Daily", (82, 54, 118, 67)), ("P2 - Heavy", (82, 68, 122, 81)), ("P3 - Delicate", (82, 82, 128, 95)), ("P4 - Whites", (82, 96, 124, 109)),
    ("P5 - Stainwash", (156, 54, 208, 67)), ("P6 - Anti - Bac", (156, 68, 208, 81)), ("P7 - Woollens", (156, 82, 208, 95)), ("P8 - Bedsheet", (156, 96, 208, 109)),
    ("P 9 - Eco Wash", (236, 54, 292, 67)), ("P10 - Rinse+Dry", (236, 68, 292, 81)), ("P11 - Dry Only", (236, 82, 292, 95)), ("P12- Wash Only", (236, 96, 292, 109)),
    ("Check\nWater", (320, 47, 344, 62)), ("Voltage\nFluctuation", (345, 47, 381, 62)),
    ("Soak", (321, 85, 343, 96)), ("Wash", (350, 85, 374, 96)), ("Rinse", (380, 85, 404, 96)), ("Dry", (412, 85, 431, 96)),
    ("HR", (329, 118, 341, 130)), ("MIN", (396, 118, 411, 130)), ("Time Remaining", (339, 140, 401, 153)),
    ("Power", (171, 141, 203, 154)), ("Program", (212, 141, 250, 154)), ("Start / Pause", (252, 141, 300, 154)),
    ("Dynamix", (176, 178, 213, 193)), ("Zero Pressure Fill Technology", (259, 178, 352, 193)), ("Power Dry Technology", (395, 178, 474, 193)),
    ("In Built Heater", (514, 178, 566, 193)),
    ("Express Wash", (443, 55, 501, 68)), ("Dry", (510, 55, 531, 68)), ("Child\nLock", (473, 96, 490, 111)),
    ("Gentle", (540, 84, 561, 96)), ("Normal", (567, 84, 590, 96)), ("Extra", (596, 84, 614, 96)), ("Power Dry", (619, 84, 649, 96)),
    ("Auto fill", (417, 113, 437, 125)), ("Manual\n(10 levels)", (415, 126, 442, 144)),
    ("Water Level", (446, 141, 492, 154)), ("Hard Water\nWash", (498, 141, 543, 163)), ("Hot Wash", (565, 141, 604, 154)),
    ("Warm", (603, 128, 623, 140)), ("Hot", (627, 128, 643, 140)), ("Allergen\nFree", (643, 126, 671, 145)),
]
BOLD_TEXTS = {"KG": (599, 171, 654, 194)}
ICONS = [
    (62, 53, 80, 68), (62, 67, 80, 82), (62, 81, 80, 96), (62, 95, 80, 110),
    (138, 53, 155, 68), (138, 67, 155, 82), (138, 81, 155, 96), (138, 95, 155, 110),
    (218, 53, 234, 68), (218, 67, 234, 82), (218, 81, 234, 96), (218, 95, 234, 110),
    (324, 62, 341, 74), (353, 62, 368, 74),
    (159, 177, 175, 193), (243, 177, 259, 193), (378, 177, 395, 193), (503, 177, 513, 193),
    (542, 59, 560, 72.5), (568, 59, 586, 72.5), (595, 59, 613, 72.5), (621, 59, 639, 72.5),
]
BUTTONS = [  # outer window, colour key
    ((165, 112, 208, 143), "white"), ((209, 112, 252, 143), "white"), ((253, 112, 297, 143), "white"),
    ((448, 69, 487, 97), "white"), ((500, 69, 539, 97), "white"),
    ((448, 111, 488, 140), "white"), ((500, 111, 539, 140), "white"), ((565, 111, 604, 140), "orange"),
]
DISPLAY = (341, 106, 397, 139)
LOGO = (668, 44, 782, 87)
SIXTH = {"6": (74, 156, 101, 184.5), "th": (94, 158.5, 103, 163.5), "sense": (73, 184.5, 105, 194)}   # "th" exact (it touches the 6)
B360 = {"flower": (692, 135, 735, 171), "360": (737, 140, 776.5, 159), "deg": (775, 138, 782, 146), "BLOOMWASH": (736, 161, 779, 167),
        "rule": (737, 168, 778, 169), "PRO": (760, 169, 778, 175)}   # 360 and BLOOMWASH: exact boxes, the ring overlaps the 0
LEFTOVER_REGION = (40, 40, 800, 199)

WHITE = (232, 232, 232)


class Panel:
    def __init__(self, cfg, photos, debug=None):
        self.cfg, self.debug = cfg, debug
        src = os.path.join(photos, cfg.get("photo_slug", cfg["slug"]), cfg["photo"])
        im = cv2.imread(src).astype(np.float32)[..., ::-1]
        W, H = cfg["rect"]
        M = cv2.getPerspectiveTransform(np.float32(cfg["quad"]), np.float32([[0, 0], [W, 0], [W, H], [0, H]]))
        self.pan = cv2.warpPerspective(im, M, (W, H), flags=cv2.INTER_CUBIC)
        self.lum = self.pan.mean(2)
        self.sat = self.pan.max(2) - self.pan.min(2)
        self.S = PX_MM * cfg["face_mm"][0] / W                 # texture px per rectified photo px
        self.Sx = self.Sy = self.S
        self.ox = self.oy = 0.0
        if cfg.get("place"):   # the print drawn from another photo of the same print, placed by (ax, bx, ay, by) into this panel
            ax, bx, ay, by = cfg["place"]["map"]
            St = PX_MM * cfg["face_mm"][0] / cfg["place"]["rect_w"]
            self.Sx, self.Sy, self.ox, self.oy = ax * St, ay * St, bx * St, by * St
        self.TW, self.TH = int(round(PX_MM * cfg["face_mm"][0])), int(round(PX_MM * cfg["face_mm"][1]))
        rng = np.random.default_rng(31671)
        self.canvas = np.zeros((self.TH, self.TW, 3), np.float32)
        self.canvas[...] = (10, 10, 12)
        self.canvas += rng.normal(0, 0.5, (self.TH, self.TW, 1))
        self.used = np.zeros((H, W), bool)
        self.m = cfg.get("map")       # (ax, bx, ay, by): 31671 window px -> this photo's px

    def win(self, w, pad=0):
        x0, y0, x1, y1 = w
        if self.m:
            ax, bx, ay, by = self.m
            x0, x1, y0, y1 = ax * x0 + bx, ax * x1 + bx, ay * y0 + by, ay * y1 + by
        H, W = self.lum.shape
        return (max(0, int(math.floor(x0)) - pad), max(0, int(math.floor(y0)) - pad), min(W, int(math.ceil(x1)) + pad), min(H, int(math.ceil(y1)) + pad))

    def ink(self, x0, y0, x1, y1, thr=None):
        L, C = self.lum[y0:y1, x0:x1], self.sat[y0:y1, x0:x1]
        t = thr if thr is not None else max(48.0, 0.42 * L.max())
        return (L > t) | ((C > 70) & (L > 40))

    def ink_box(self, w, thr=None):
        x0, y0, x1, y1 = self.win(w)
        m = self.ink(x0, y0, x1, y1, thr)
        ys, xs = np.where(m)
        if not len(xs):
            raise SystemExit(f"no ink in {w} -> {(x0, y0, x1, y1)}")
        self.used[y0:y1, x0:x1] = True
        return (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)

    def colour(self, w):
        x0, y0, x1, y1 = self.win(w)
        px = self.pan[y0:y1, x0:x1].reshape(-1, 3)
        L = px.mean(1)
        c = px[L >= np.percentile(L, 97)].mean(0)
        if c.max() - c.min() < 40:            # white print: the photo dims thin strokes, so set it at the panel's white
            return WHITE
        return tuple(float(v) for v in c)

    def T(self, x, y):
        return (x * self.Sx + self.ox, y * self.Sy + self.oy)

    def put(self, alpha, colour, x0, y0):
        c = self.canvas
        h, w = alpha.shape
        xs0, ys0 = max(0, x0), max(0, y0)
        xs1, ys1 = min(c.shape[1], x0 + w), min(c.shape[0], y0 + h)
        if xs1 <= xs0 or ys1 <= ys0:
            return
        a = alpha[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
        c[ys0:ys1, xs0:xs1] = c[ys0:ys1, xs0:xs1] * (1 - a) + np.array(colour, np.float32) * a

    def fit(self, alpha, box):
        x0, y0, x1, y1 = box
        tw, th = int(round((x1 - x0) * self.Sx)), int(round((y1 - y0) * self.Sy))
        a = cv2.resize(alpha, (max(1, tw), max(1, th)), interpolation=cv2.INTER_AREA)
        tx, ty = self.T(x0, y0)
        return a, int(round(tx)), int(round(ty))

    @staticmethod
    def render(text, face=MED, font=AVENIR, px=200, line_gap=0.18):
        """the text's alpha, cropped to its ink; lines are centred under each other"""
        lines = text.split("\n")
        f = ImageFont.truetype(font, px, index=face)
        img = Image.new("L", (int(px * 0.75 * max(len(l) for l in lines) + px * 2), int(px * (1.5 + (1 + line_gap) * len(lines)))), 0)
        d = ImageDraw.Draw(img)
        for i, l in enumerate(lines):
            d.text((img.width / 2, px * (1.2 + (1 + line_gap) * i)), l, font=f, fill=255, anchor="ms")
        a = np.asarray(img).astype(np.float32) / 255
        ys, xs = np.where(a > 0.02)
        return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

    def word(self, text, w, face=DEMI, colour=None, font=AVENIR):
        box = self.ink_box(w)
        col = colour or self.colour(w)
        a, tx, ty = self.fit(self.render(text, face, font), box)
        self.put(a, col, tx, ty)
        return box

    def icon(self, w, colour=None, thr=None):
        box = self.ink_box(w, thr)
        x0, y0, x1, y1 = box
        col = colour or self.colour(w)
        sub = self.lum[y0 - 1:y1 + 1, x0 - 1:x1 + 1]
        k = 8
        big = cv2.resize(sub, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC)
        big = cv2.GaussianBlur(big, (0, 0), 1.7)
        t = 0.45 * big.max() + 0.55 * 10
        a = np.clip((big - t) / 7 + 0.5, 0, 1)
        tw, th = int(round((x1 - x0 + 2) * self.Sx)), int(round((y1 - y0 + 2) * self.Sy))
        a = cv2.resize(a, (tw, th), interpolation=cv2.INTER_AREA)
        tx, ty = self.T(x0 - 1, y0 - 1)
        self.put(a, col, int(round(tx)), int(round(ty)))
        return box

    def shape(self, draw_fn, box, colour, pad=2):
        """draw a vector shape (PIL, at 4x) over a photo box"""
        x0, y0, x1, y1 = box
        k = 4
        W, H = int((x1 - x0 + 2 * pad) * self.Sx * k), int((y1 - y0 + 2 * pad) * self.Sy * k)
        img = Image.new("L", (W, int((y1 - y0 + 2 * pad) * self.Sx * k)), 0)       # drawn at the x scale, then fitted to y
        draw_fn(ImageDraw.Draw(img), pad * self.Sx * k, self.Sx * k)
        a = cv2.resize(np.asarray(img).astype(np.float32) / 255, (W // k, H // k), interpolation=cv2.INTER_AREA)
        tx, ty = self.T(x0 - pad, y0 - pad)
        self.put(a, colour, int(round(tx)), int(round(ty)))

    def button(self, w, key):
        """a key's rounded outline: its box is where the ink runs most of the window's height and width (the key's own sides),
        so the rules joined to it are left for the leftover pass"""
        wx0, wy0, wx1, wy1 = self.win(w)
        m = self.ink(wx0, wy0, wx1, wy1, thr=60)
        cs, rs = m.sum(0), m.sum(1)
        xs, ys = np.where(cs >= 0.6 * cs.max())[0], np.where(rs >= 0.6 * rs.max())[0]
        box = (wx0 + xs.min(), wy0 + ys.min(), wx0 + xs.max() + 1, wy0 + ys.max() + 1)
        bx0, by0, bx1, by1 = box
        self.used[by0:by1, bx0:bx1] = True
        x0, y0, x1, y1 = box
        col = (240, 150, 30) if key == "orange" else WHITE
        lw = 1.15
        self.shape(lambda d, o, s: d.rounded_rectangle([o, o, o + (x1 - x0) * s, o + (y1 - y0) * s], radius=1.6 * s, outline=255, width=int(lw * s)), box, col)
        # the icon inside: the photo's own ink, inside the outline
        inner = (x0 + 3, y0 + 3, x1 - 3, y1 - 3)
        self.icon_abs(inner, colour=col if key == "orange" else WHITE)
        return box

    def icon_abs(self, box, colour, thr=None):
        """icon_from_photo for a box already in this photo's px"""
        x0, y0, x1, y1 = box
        m = self.ink(x0, y0, x1, y1, thr)
        ys, xs = np.where(m)
        if not len(xs):
            return
        b = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
        bx0, by0, bx1, by1 = b
        sub = self.lum[by0 - 1:by1 + 1, bx0 - 1:bx1 + 1]
        k = 8
        big = cv2.GaussianBlur(cv2.resize(sub, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC), (0, 0), 1.7)
        t = 0.45 * big.max() + 0.55 * 10
        a = np.clip((big - t) / 7 + 0.5, 0, 1)
        a = cv2.resize(a, (int(round((bx1 - bx0 + 2) * self.Sx)), int(round((by1 - by0 + 2) * self.Sy))), interpolation=cv2.INTER_AREA)
        tx, ty = self.T(bx0 - 1, by0 - 1)
        self.put(a, colour, int(round(tx)), int(round(ty)))

    def leftovers(self, region):
        """lines, rules, brackets, separators and LED dashes: every piece of ink not in a window, drawn as a clean shape"""
        x0, y0, x1, y1 = self.win(region)
        m = self.ink(x0, y0, x1, y1, thr=38) & ~cv2.dilate(self.used[y0:y1, x0:x1].astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
        drawn = 0
        for i in range(1, n):
            bx, by, bw, bh, ar = st[i]
            if ar < 2:
                continue
            sel = lab == i
            L = self.lum[y0:y1, x0:x1]
            px = self.pan[y0:y1, x0:x1][sel]
            col = px[px.mean(1) >= np.percentile(px.mean(1), 70)].mean(0)
            col = tuple(float(v) for v in (col * 1.15).clip(0, 255))
            gx0, gy0 = x0 + bx, y0 + by
            if bh <= 3 and bw >= 3 or bw <= 3 and bh >= 3 or ar <= 8:
                # a rule or a dash: its weighted extent, drawn as a crisp bar
                wgt = np.clip((L - 20) / 80, 0, 1) * sel
                cols, rows = wgt.sum(0), wgt.sum(1)
                if bh <= 3 and bw > bh:
                    cy = (rows * np.arange(len(rows))).sum() / rows.sum()
                    th = max(0.8, min(1.6, wgt.sum() / max(1, bw)))
                    box = (gx0, y0 + cy - th / 2 + 0.5, gx0 + bw, y0 + cy + th / 2 + 0.5)
                elif bw <= 3 and bh > bw:
                    cx = (cols * np.arange(len(cols))).sum() / cols.sum()
                    tw = max(0.8, min(1.6, wgt.sum() / max(1, bh)))
                    box = (x0 + cx - tw / 2 + 0.5, gy0, x0 + cx + tw / 2 + 0.5, gy0 + bh)
                else:
                    box = (gx0, gy0, gx0 + bw, gy0 + bh)
                bx0, by0, bx1, by1 = box
                self.shape(lambda d, o, s: d.rectangle([o, o, o + (bx1 - bx0) * s, o + (by1 - by0) * s], fill=255), box, col, pad=1)
            else:
                # bracket or corner pieces: the photo's ink, smoothed
                self.icon_abs((gx0, gy0, gx0 + bw, gy0 + bh), col, thr=38)
            drawn += 1
        print("leftover pieces drawn:", drawn)

    def display(self, w):
        x0, y0, x1, y1 = self.win(w)
        m = (self.lum[y0:y1, x0:x1] > 32) & (self.lum[y0:y1, x0:x1] < 90)
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)).astype(bool)
        ys, xs = np.where(m)
        box = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1)
        col = tuple(float(v) for v in np.median(self.pan[y0:y1, x0:x1][m], 0))
        bx0, by0, bx1, by1 = box
        self.shape(lambda d, o, s: d.rounded_rectangle([o, o, o + (bx1 - bx0) * s, o + (by1 - by0) * s], radius=1.2 * s, fill=255), box, col)
        self.used[y0:y1, x0:x1] = True

    def logo(self, w, svg):
        box = self.ink_box(w, thr=70)
        png = os.path.join(SITE, ".work", "whirlpool_tex", "logo_3000.png")
        os.makedirs(os.path.dirname(png), exist_ok=True)
        if not os.path.exists(png):
            subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"), svg, png, "3000"], check=True, capture_output=True)
        lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
        a = lg[..., 3] / 255
        rgb = lg[..., :3]
        gold = (rgb[..., 0] - rgb[..., 2]) > 60
        # drop the registered mark (the panel's print has none): keep columns left of the last gap
        cols = (a > 0.1).any(0)
        xs = np.where(cols)[0]
        gaps = np.where(np.diff(xs) > 8)[0]
        right = xs[gaps[-1]] + 1 if len(gaps) else xs[-1] + 1
        ys = np.where((a[:, :right] > 0.1).any(1))[0]
        a, gold = a[ys.min():ys.max() + 1, xs[0]:right], gold[ys.min():ys.max() + 1, xs[0]:right]
        ag = a * gold
        aw = a * ~gold
        for alpha, col in ((aw, WHITE), (ag, (214, 165, 52))):
            f, tx, ty = self.fit(alpha, box)
            self.put(f, col, tx, ty)

    def sixth(self):
        self.word("6", SIXTH["6"], face=2, font=BASK, colour=WHITE)
        a, tx, ty = self.fit(self.render("th", BOLDI), self.fixed(SIXTH["th"]))
        self.put(a, WHITE, tx, ty)
        self.word("sense", SIXTH["sense"], face=BOLDI, colour=WHITE)

    def fixed(self, w):
        """a box given exactly (where two pieces of ink overlap), mapped into this photo"""
        x0, y0, x1, y1 = w
        if self.m:
            ax, bx, ay, by = self.m
            x0, x1, y0, y1 = ax * x0 + bx, ax * x1 + bx, ay * y0 + by, ay * y1 + by
        self.used[int(y0):int(math.ceil(y1)), int(x0):int(math.ceil(x1))] = True
        return (x0, y0, x1, y1)

    def bloom(self):
        """the 360 Bloomwash Pro mark: the flower (the photo's ink), 360 and its degree ring, BLOOMWASH, the rule, the PRO tab"""
        self.icon(B360["flower"], colour=WHITE)
        a, tx, ty = self.fit(self.render("360", DEMI), self.fixed(B360["360"]))
        self.put(a, WHITE, tx, ty)
        b = self.fixed(B360["deg"])
        x0, y0, x1, y1 = b
        self.shape(lambda d, o, s: d.ellipse([o, o, o + (x1 - x0) * s, o + (y1 - y0) * s], outline=255, width=int(0.9 * s)), b, WHITE)
        a, tx, ty = self.fit(self.render("BLOOMWASH", DEMI), self.fixed(B360["BLOOMWASH"]))
        self.put(a, WHITE, tx, ty)
        b = self.fixed(B360["rule"])
        x0, y0, x1, y1 = b
        self.shape(lambda d, o, s: d.rectangle([o, o, o + (x1 - x0) * s, o + (y1 - y0) * s], fill=255), b, (200, 200, 202), pad=1)
        b = self.fixed(B360["PRO"])
        x0, y0, x1, y1 = b
        self.shape(lambda d, o, s: d.rounded_rectangle([o, o, o + (x1 - x0) * s, o + (y1 - y0) * s], radius=0.8 * s, fill=255), b, (176, 178, 182))
        inner = (x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.2, x1 - (x1 - x0) * 0.25, y1 - (y1 - y0) * 0.2)
        a, tx, ty = self.fit(self.render("PRO", DEMI), inner)
        self.put(a, (24, 24, 26), tx, ty)

    def draw(self):
        self.display(DISPLAY)
        for text, w in TEXTS:
            self.word(text, w, colour=None)
        if self.cfg.get("kg_fixed"):   # the capacity's box measured on the model's own photo (the print drawn from another's)
            a, tx, ty = self.fit(self.render(self.cfg["kg"], BOLD), self.fixed(self.cfg["kg_fixed"]))
            self.put(a, WHITE, tx, ty)
        else:
            self.word(self.cfg["kg"], self.cfg.get("kg_box", BOLD_TEXTS["KG"]), face=BOLD, colour=WHITE)
        for w in ICONS:
            self.icon(w)
        for w, key in BUTTONS:
            self.button(w, key)
        self.logo(LOGO, os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"))
        self.sixth()
        self.bloom()
        self.leftovers(LEFTOVER_REGION)
        return Image.fromarray(self.canvas.clip(0, 255).astype(np.uint8))

    def debug_overlay(self, out):
        """the photo's windows and the boxes found, at 3x, for checking"""
        big = cv2.resize(self.pan, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC).clip(0, 255).astype(np.uint8).copy()
        def rect(w, c):
            x0, y0, x1, y1 = self.win(w)
            cv2.rectangle(big, (x0 * 3, y0 * 3), (x1 * 3, y1 * 3), c, 1)
        for _, w in TEXTS: rect(w, (0, 200, 255))
        for w in ICONS: rect(w, (255, 80, 80))
        for w, _ in BUTTONS: rect(w, (80, 255, 80))
        Image.fromarray(big).save(out)


# ───────────────────────── the other textures ─────────────────────────
def label(photos, cfg, out):
    """Whirlpool's own energy label, cut out of its white backdrop by the label's outline, quantised for the Apple file's size"""
    im = Image.open(os.path.join(photos, cfg["slug"], cfg["label"])).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    fg = (a.min(2) < 236).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
    big = 1 + np.argmax(st[1:, 4])
    m = (lab == big).astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(m)
    cv2.drawContours(filled, cnts, -1, 1, -1)
    x, y, w, h = cv2.boundingRect(filled)
    alpha = cv2.GaussianBlur((filled * 255).astype(np.float32), (0, 0), 0.8)
    rgba = np.dstack([np.asarray(im), alpha.clip(0, 255).astype(np.uint8)])[y:y + h, x:x + w]
    img = Image.fromarray(rgba, "RGBA")
    img = img.resize((int(img.width * 900 / img.height), 900), Image.LANCZOS)
    q = img.quantize(256, method=Image.Quantize.FASTOCTREE)
    q.save(os.path.join(out, "label.png"), optimize=True)
    print("wrote label.png", img.size, "aspect w/h", round(img.width / img.height, 4))


def relief_shade(height, base, strength, light=(-0.45, 0.6, 0.66)):
    """shades a height map (mm) lit from the upper front, onto a base colour"""
    gy, gx = np.gradient(height)
    n = np.dstack([-gx, gy, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    l = np.array(light) / np.linalg.norm(light)
    d = (n * l).sum(2) - l[2]
    shade = 1 + strength * d
    return (np.array(base, np.float32)[None, None, :] * shade[..., None]).clip(0, 255)


def side(cfg, out, rng):
    """The side panel's relief, from Whirlpool's 3/4 photos of both models (measured on 31688's three_quarter_left_low.jpg,
    the clearest, through a homography of the side face; the 31671's photos show the same moulding): a raised band in a G round
    the side (outer and inner rounded rectangles), its front arm broken round the handle pocket with rounded ends, a raised
    rounded square inside, and the pocket in the break. Seen from outside, the pocket is at the right-hand end on both sides
    (Whirlpool's photos: near the front on the left side, near the back on the right side), so it is one moulding used both ways
    round and both sides take this same texture. Drawn as a height map and shaded."""
    g = cfg["side"]
    D, Hs = g["d"], g["h"]                 # mm: the decal's width (front to back) and height
    k = 2.0                                # px per mm
    W, H = int(D * k), int(Hs * k)
    hgt = np.zeros((H, W), np.float32)
    def P(u, v):  # u: mm from the pocket's end, v: mm up from the decal's bottom -> px; the pocket's end is the texture's right
        return (int(round((D - u) * k)), int(round(H - v * k)))
    def rr(img, u0, v0, u1, v1, r, val, thick=-1):
        (xa, y1), (xb, y0) = P(u0, v0), P(u1, v1)
        x0, x1 = min(xa, xb), max(xa, xb)
        pil = Image.fromarray(img)
        d = ImageDraw.Draw(pil)
        d.rounded_rectangle([x0, y0, x1, y1], radius=int(r * k), fill=None if thick > 0 else val, outline=val if thick > 0 else None, width=int(thick * k) if thick > 0 else 0)
        return np.asarray(pil).copy()
    def disc(img, u, v, r, val):
        pil = Image.fromarray(img)
        x, y = P(u, v)
        ImageDraw.Draw(pil).ellipse([x - r * k, y - r * k, x + r * k, y + r * k], fill=val)
        return np.asarray(pil).copy()
    o, i = g["outer"], g["inner"]           # u0, v0, u1, v1, r (u from the pocket's end, v from the decal's bottom)
    band = rr(np.zeros((H, W), np.uint8), *o, 255)
    band = rr(band, *i, 0)
    # the break in the front arm round the pocket; each arm ends round
    lo, hi = g["gap"]                       # the lower arm's top and the upper arm's bottom
    r = (i[0] - o[0]) / 2
    um = o[0] + r
    band = rr(band, o[0] - 5, lo - r, i[0] + 1, hi + r, 0, 0)
    arm = np.zeros((H, W), np.uint8)
    arm = disc(arm, um, hi + r, r, 255)
    arm = disc(arm, um, lo - r, r, 255)
    band = np.maximum(band, arm)
    sq = rr(np.zeros((H, W), np.uint8), *g["square"], 255)
    hgt += cv2.GaussianBlur(band.astype(np.float32) / 255 * 2.5, (0, 0), 2.2 * k)
    hgt += cv2.GaussianBlur(sq.astype(np.float32) / 255 * 1.6, (0, 0), 2.2 * k)
    # handle pocket: a recess with a lip
    hu, hv, hw, hh = g["handle"]
    pocket = np.zeros((H, W), np.uint8)
    pocket = rr(pocket, hu - hw / 2, hv - hh / 2, hu + hw / 2, hv + hh / 2, 6, 255)
    hgt -= cv2.GaussianBlur(pocket.astype(np.float32) / 255 * 6, (0, 0), 1.0 * k)
    img = relief_shade(hgt, cfg["body"], g.get("strength", 0.9))
    # the pocket's dark gloss inside and its lighter rim (as in the photos)
    inner_p = rr(np.zeros((H, W), np.uint8), hu - hw / 2 + 4, hv - hh / 2 + 4, hu + hw / 2 - 4, hv + hh / 2 - 4, 4, 255).astype(np.float32) / 255
    inner_p = cv2.GaussianBlur(inner_p, (0, 0), 1.0)[..., None]
    grad = np.linspace(0.55, 0.2, H)[:, None, None]
    img = img * (1 - inner_p) + (np.array(cfg["body"], np.float32) * grad) * inner_p
    if g.get("rim"):   # a bright trim round the pocket (the 31688's photos show one)
        outer_p = rr(np.zeros((H, W), np.uint8), hu - hw / 2, hv - hh / 2, hu + hw / 2, hv + hh / 2, 6, 255).astype(np.float32) / 255
        ring = cv2.GaussianBlur(np.clip(outer_p - cv2.GaussianBlur(inner_p[..., 0], (0, 0), 0.1), 0, 1), (0, 0), 0.8)[..., None]
        shade = np.linspace(1.15, 0.7, H)[:, None, None]
        img = img * (1 - ring) + (np.array(g["rim"], np.float32) * shade) * ring
    img += rng.normal(0, 0.8, img.shape)
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    im = im.resize((1024, int(1024 * H / W)), Image.LANCZOS)
    im.save(os.path.join(out, "side.jpg"), quality=88, optimize=True)
    print("wrote side.jpg", im.size)


def back(cfg, out, rng):
    """The black back, from Whirlpool's rear photo: a raised outer frame with corner returns, two square covers one above the
    other, the slot under the top edge with two screw holes, small vent holes and ribs. Drawn as a height map and shaded."""
    b = cfg["back"]
    Wm, Hm = b["w"], b["h"]
    k = 1.6
    W, H = int(Wm * k), int(Hm * k)
    hgt = np.zeros((H, W), np.float32)
    def box(u0, v0, u1, v1, r, val, thick=0, blur=1.5):
        nonlocal hgt
        pil = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(pil)
        x0, x1 = int((u0 + Wm / 2) * k), int((u1 + Wm / 2) * k)
        y0, y1 = int(H - v1 * k), int(H - v0 * k)
        if thick:
            d.rounded_rectangle([x0, y0, x1, y1], radius=int(r * k), outline=255, width=int(thick * k))
        else:
            d.rounded_rectangle([x0, y0, x1, y1], radius=int(r * k), fill=255)
        hgt += cv2.GaussianBlur(np.asarray(pil).astype(np.float32) / 255 * val, (0, 0), blur * k)
    for (u0, v0, u1, v1, r, val, thick) in b["shapes"]:
        box(u0, v0, u1, v1, r, val, thick)
    img = relief_shade(hgt, (24, 24, 26), 1.6, light=(-0.3, 0.7, 0.65))
    img += rng.normal(0, 0.7, img.shape)
    im = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    im.save(os.path.join(out, "back.jpg"), quality=86, optimize=True)
    print("wrote back.jpg", im.size)


def drum(out, rng):
    """The stainless drum: rows of raised 'bloom' bubbles, each with a drain hole at its foot, staggered, as in Whirlpool's
    lid-open photos (top_open.jpg, lid_open_34.jpg). One tile, repeated round the drum."""
    N = 512
    base = np.full((N, N), 150.0, np.float32)
    base += cv2.GaussianBlur(rng.normal(0, 14, (N, N)).astype(np.float32), (0, 0), sigmaX=12, sigmaY=0.6)   # brushed round the drum
    hgt = np.zeros((N, N), np.float32)
    holes = np.zeros((N, N), np.float32)
    rows, per = 4, 4
    for r in range(rows):
        for c in range(per):
            cx = (c + 0.5 * (r % 2) + 0.5) * N / per
            cy = (r + 0.5) * N / rows
            for dx in (-N, 0, N):
                for dy in (-N, 0, N):
                    X, Y = np.meshgrid(np.arange(N) - (cx + dx), np.arange(N) - (cy + dy))
                    d = np.sqrt(X ** 2 + (Y * 1.15) ** 2)
                    hgt += np.clip(1 - d / 44, 0, 1) ** 1.5 * 9
                    hd = np.sqrt((X) ** 2 + (Y - 30) ** 2)
                    holes = np.maximum(holes, np.clip(1 - hd / 6.5, 0, 1) > 0)
    gy, gx = np.gradient(hgt)
    shade = 1 + 0.09 * (-gx * 0.4 + gy * 0.9)
    v = (base * shade).clip(0, 255)
    v = v * (1 - holes * 0.85)
    img = np.dstack([v * 0.98, v, v * 1.02])
    Image.fromarray(img.clip(0, 255).astype(np.uint8)).save(os.path.join(out, "drum.jpg"), quality=86, optimize=True)
    print("wrote drum.jpg")


def impeller(out, cols=None):
    """The Hexa Bloom impeller's white dish with its ring of small holes (Whirlpool's top_open.jpg); the six grey vanes are
    modelled. UVs map the dish's plan straight onto this square."""
    N = 1024
    cols = cols or {"dish": 236, "holes": (70, 72, 76), "hub": (150, 152, 156)}
    img = np.full((N, N, 3), cols["dish"], np.float32)
    Y, X = np.mgrid[0:N, 0:N]
    r = np.hypot(X - N / 2, Y - N / 2) / (N / 2)
    img *= (1 - 0.08 * r)[..., None]
    pil = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)
    for ring, n, rad in ((0.86, 64, 5), (0.92, 72, 4)):
        for i in range(n):
            a = 2 * math.pi * i / n
            x, y = N / 2 + math.cos(a) * ring * N / 2, N / 2 + math.sin(a) * ring * N / 2
            d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=cols["holes"])
    d.ellipse([N * 0.47, N * 0.47, N * 0.53, N * 0.53], fill=cols["hub"])
    pil.save(os.path.join(out, "impeller.jpg"), quality=88, optimize=True)
    print("wrote impeller.jpg")


# the side relief in mm (u from the pocket's end, v from the decal's bottom just above the plinth). Measured on 31688's
# three_quarter_left_low.jpg: edge lines traced along rows and columns, mapped through a homography of the side face (607 mm
# deep; plinth bottom 20 mm, seam 770 mm at the front and 843 mm at the back) -> outer band u 68-519 v 135-701, inner edge
# u 121-458 v 210-627, arm ends v 406 and 522, square u 182-367 v 281-552, pocket u 51-139 v 440-481 (mm above the floor).
# Scaled here to the 31671's side (580 mm deep; plinth top 67 mm to seam 760 mm): u x 0.9555, v = 67 + (v - 35) x 0.9429 - 68
SIDE = {"d": 580, "h": 690, "outer": (65, 93, 496, 627, 48), "inner": (116, 164, 438, 557, 24), "gap": (349, 458),
        "square": (174, 231, 351, 486, 43), "handle": (91, 400, 84, 39)}
BACK = {"w": 516, "h": 760, "shapes": [
    # the raised outer frame (a band) and its corner returns, the two square covers, the slot under the top
    (-195, 40, 195, 600, 22, 3.0, 14),
    (-112, 330, 112, 560, 18, 7.0, 0), (-112, 135, 112, 320, 18, 7.0, 0),
    (-96, 345, 96, 545, 10, -1.5, 3), (-96, 150, 96, 305, 10, -1.5, 3),
    (-12, 315, 12, 340, 3, 4.0, 0),
]}
CFG.update({"side": SIDE, "back": BACK})


def main(cfg, argv):
    args = list(argv)
    debug = None
    if "--debug" in args:
        debug = args[args.index("--debug") + 1]
        del args[args.index("--debug"):args.index("--debug") + 2]
        os.makedirs(debug, exist_ok=True)
    photos, outroot = args[:2]
    out = os.path.join(outroot, cfg["slug"])
    os.makedirs(out, exist_ok=True)
    rng = np.random.default_rng(31671)
    p = Panel(cfg, photos, debug)
    img = p.draw()
    img.save(os.path.join(out, "panel.jpg"), quality=90, optimize=True)
    print("wrote panel.jpg", img.size)
    if debug:
        p.debug_overlay(os.path.join(debug, "windows.png"))
        ph = Image.fromarray(cv2.resize(p.pan, img.size, interpolation=cv2.INTER_CUBIC).clip(0, 255).astype(np.uint8))
        both = Image.new("RGB", (img.width, img.height * 2))
        both.paste(ph, (0, 0)); both.paste(img, (0, img.height))
        both.save(os.path.join(debug, "panel_vs_photo.jpg"), quality=85)
    label(photos, cfg, out)
    side(cfg, out, rng)
    if cfg.get("back"):   # the 31688 has no rear photo, so no back texture
        back(cfg, out, rng)
    drum(out, rng)
    impeller(out, cfg.get("impeller"))


if __name__ == "__main__":
    main(CFG, sys.argv[1:])
