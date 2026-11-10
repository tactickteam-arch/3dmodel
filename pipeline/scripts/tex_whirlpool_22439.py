"""Textures for the Whirlpool 22439 (Intellifresh 431 L 2 star inverter convertible frost-free double door, Alpha Steel).

Writes pipeline/tex/whirlpool_22439/:
  door_freezer.jpg, door_fridge.jpg  Alpha Steel: short fine horizontal brushing on a flat neutral grey (the studio's
                                     light bands in Whirlpool's renders are left out; the 3D light makes its own)
  panel.jpg                          the External UI touch panel (black glass, a darker strip on the right), redrawn
                                     sharp at 7.2 px/mm from Whirlpool's own blow-up of it ("2-UI-Shot"), laid on the
                                     front render's 100 x 248.6 mm
  cap.jpg                            the fridge door's top cap: black on the left, a silver crescent and its fall, as the
                                     front render shows it
  print_*.png                        the inside prints as Whirlpool's open photo of this code shows them: words re-set
                                     sharp (dark grey on the clear and white parts), the line drawings lifted off the photo
  icon_sensor.png, dial_scale.png    the grey sensor plate with its wave icon, the freezer dial's scale
usage: python3 pipeline/scripts/tex_whirlpool_22439.py [--compare]
Sources (pipeline/sources/photos/whirlpool_22439/): front.jpg, lifestyle.jpg, open.jpg, feature_ui_panel.jpg,
feature_icetwister_crop.jpg. Every size, and how it was measured, is in private/research/whirlpool_22439/NOTES.md.
"""
import os
import site
import subprocess
import sys

sys.path.append(site.getusersitepackages())
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(SITE, "pipeline/sources/photos/whirlpool_22439")
OUT = os.path.join(SITE, "pipeline/tex/whirlpool_22439")
WORK = os.path.join(SITE, ".work", "whirlpool_22439_tex")
LOOK = os.path.join(SITE, "private/research/whirlpool_22439/lookpass")
SUP = "/System/Library/Fonts/Supplemental/"
F = {
    "avenir": ("/System/Library/Fonts/Avenir Next.ttc", None),
    "rounded": (SUP + "Arial Rounded Bold.ttf", 0),
    "arialb": (SUP + "Arial Bold.ttf", 0),
    "black": (SUP + "Arial Black.ttf", 0),
    "bask": ("/System/Library/Fonts/Supplemental/Baskerville.ttc", None),
}
BOLD, BOLDI, DEMI, MED, REG = 0, 1, 2, 5, 7     # Avenir Next faces
PX_MM = 7.2
SS = 3
WHITE = (236, 236, 238)


def font(name, px, face=None):
    path, idx = F[name]
    return ImageFont.truetype(path, max(1, int(px)), index=face if face is not None else (idx or 0))


def ink(text, name, px, face=None, track=0.0):
    """the text's alpha cropped to its ink; track = extra space between letters, as a fraction of px"""
    f = font(name, px, face)
    if not track:
        img = Image.new("L", (int(px * 0.9 * len(text) + px * 2), int(px * 2.4)), 0)
        ImageDraw.Draw(img).text((px * 0.5, px * 1.7), text, font=f, fill=255, anchor="ls")
    else:
        img = Image.new("L", (int(px * (0.9 + track) * len(text) + px * 2), int(px * 2.4)), 0)
        d, x = ImageDraw.Draw(img), px * 0.5
        for ch in text:
            d.text((x, px * 1.7), ch, font=f, fill=255, anchor="ls")
            x += f.getlength(ch) + track * px
    a = np.asarray(img)
    ys, xs = np.where(a > 4)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def cap_px(name, face, cap_mm, k):
    """the font size whose capital H is cap_mm tall at k px per mm"""
    probe = ink("H", name, 200, face)
    return 200 * cap_mm * k / probe.height


# ── the doors and sides ──
# Whirlpool's straight front reads the doors at 175.6 of 255 on average, neutral (R = G = B), with no fall top to bottom,
# crossed by soft vertical light and dark bands (147-201: the studio's reflections, the same in every row of both doors).
# As for the Whirlpool 22343, most of the bands' depth is kept in the texture (the viewer's narrow lens sees the whole door
# in one reflection); the clear coat and the hairline map add the gloss and the fine brushing, so the texture's own
# streaks stay faint. BASE, BANDS, SHADE and SIDE are tuned on renders against Whirlpool's photos (REVIEW.md).
BASE = 150
BANDS = 0.8                                          # the share of the photo's band depth kept
DOOR_MM = {"door_freezer": (698, 513), "door_fridge": (698, 1097)}
# the freezer door's shade against the fridge door's: Whirlpool's front reads them 172.6 and 177.0 (0.975); the first
# render with one base read them 182.6 and 175.9, the freezer door catching more of the studio's strip (REVIEW.md)
SHADE = {"door_freezer": 0.94, "door_fridge": 1.0}
# front.jpg: the doors span columns 386-812 (700 mm); rows clear of the panel, the cap and the feet
FRONT_X = (386, 812)
CLEAN_ROWS = [(250, 380), (430, 1080)]
# the sides: dark grey painted steel, lit brightest at the front and falling to the back (left view 73 at the front to 60 at
# the back, right view 68 to 48)
SIDE = 72
SIDE_FALL = (1.2, 0.82)                              # front and back, as a share of the mean
SIDE_MM = (687, 1635)
SIDE_PX_MM = 0.5


# The four colours Whirlpool sells this 431 L body in (one BEE label, one spec table; Whirlpool's catalogue API, 10 Nov
# 2026), each textured from its own straight front and 3/4 views. Alpha Steel keeps the files above (suffix ""). Per
# colour: its photo, the doors' columns and clean rows on it (the same share of the doors' height as Alpha Steel's
# 250-380 and 430-1080), BASE from its doors' mean against Alpha Steel's (175.0: Illusia 157.5, Platina 161.4, Gravity
# 50.4), its streaks (rows-to-row change 3.71 Alpha, 4.45 both Illusias, 1.68 Gravity; across 1.35, 0.70, 0.70, 0.91),
# and SIDE from its sides' mean over both 3/4 views against Alpha Steel's (66: Illusia 78, Gravity and Platina 41).
# base and side are tuned on renders against each colour's photos (REVIEW.md).
COLOURS = {
    "": dict(photo="front.jpg", x=FRONT_X, rows=CLEAN_ROWS, base=BASE, fine=1.0, streak=40, iso=0.0, side=SIDE),
    "_is": dict(photo="is_front.jpg", x=(391, 805), rows=[(260, 391), (442, 1092)], base=135, fine=3.0, streak=120, iso=0.0, side=85),
    "_gb": dict(photo="gb_front.jpg", x=(387, 806), rows=[(243, 375), (427, 1085)], base=41, fine=0.6, streak=20, iso=1.6, side=45),
    "_pis": dict(photo="pis_front.jpg", x=(385, 805), rows=[(241, 374), (426, 1086)], base=138, fine=3.0, streak=120, iso=0.0, side=None),
}
# Platina Illusia Steel's sides read as Gravity Black's (both 3/4 views: 45 and 37 against 45 and 37), so it uses side_*_gb


def band_profile(w, photo="front.jpg", x=FRONT_X, rows=CLEAN_ROWS):
    """the straight front's brightness across the doors, w samples left to right, as a share of its mean"""
    FRONT_X, CLEAN_ROWS = x, rows
    g = np.asarray(Image.open(os.path.join(SRC, photo)).convert("L")).astype(np.float32)
    rows = np.concatenate([g[a:b, FRONT_X[0]:FRONT_X[1] + 1] for a, b in CLEAN_ROWS], 0)
    p = rows.mean(0)
    p[:4], p[-4:] = p[4], p[-5]                       # the outermost columns are the doors' edges
    k = np.exp(-0.5 * (np.arange(-20, 21) / 6.0) ** 2); k /= k.sum()
    p = np.convolve(np.pad(p, 20, mode="edge"), k, "same")[20:-20]
    p = np.interp(np.linspace(0, len(p) - 1, w), np.arange(len(p)), p)
    return p / p.mean()


def brushed(w_mm, h_mm, seed, shade=1.0, c=COLOURS[""]):
    rng = np.random.default_rng(seed)
    w, h = int(w_mm), int(h_mm)                                   # 1 px per mm
    fine = rng.normal(0, 1, (h, w // c["streak"] + 2))            # faint 1 mm rows, stretched along x
    fine = np.asarray(Image.fromarray(((fine + 4) * 30).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 30 - 4
    bands = 1 + BANDS * (band_profile(w, c["photo"], c["x"], c["rows"])[None, :] - 1)
    v = (c["base"] * shade + c["fine"] * fine) * bands
    if c["iso"]:                                                  # Gravity Black's fine speckle, the same both ways
        v = v + c["iso"] * rng.normal(0, 1, (h, w))
    return Image.fromarray(np.repeat(v[..., None], 3, 2).clip(0, 255).astype(np.uint8))


def side(mirror, seed, level=SIDE):
    """u runs from the back (0) to the front (1) on the left side's face; the right side's face runs the other way"""
    rng = np.random.default_rng(seed)
    w, h = int(SIDE_MM[0] * SIDE_PX_MM), int(SIDE_MM[1] * SIDE_PX_MM)
    u = np.linspace(0, 1, w)[None, :]
    v = level * (SIDE_FALL[1] + (SIDE_FALL[0] - SIDE_FALL[1]) * u ** 1.3) + rng.normal(0, 0.8, (h, w))
    img = Image.fromarray(np.repeat(v[..., None], 3, 2).clip(0, 255).astype(np.uint8))
    return img.transpose(Image.FLIP_LEFT_RIGHT) if mirror else img


# ── the panel ──
PANEL_MM = (100.0, 248.6)          # front.jpg: 61 px at 0.6086 px/mm across, 152 px at 0.6115 px/mm down
SPLIT = 66.4                       # the darker strip starts at 0.664 of the width (front.jpg and lifestyle.jpg)
GLASS_L, GLASS_R = (30, 30, 32), (9, 9, 10)
CORNER = 6.0                       # the two bottom corners' radius (front.jpg, about 3.5 px)
TILT = 0.017                       # the blow-up's print rises 0.017 mm per mm to the right: levelled
UI = os.path.join(SRC, "feature_ui_panel.jpg")
UI_CORNERS = np.float32([[77, 65], [1209, 124], [1209, 3057], [77, 3015]])
UI_W, UI_H = 1132, 2950
UI_DY = -0.0104                    # the front's print sits 1.04% of the height above the blow-up's


def ui_warped():
    a = np.asarray(Image.open(UI).convert("RGB"))
    M = cv2.getPerspectiveTransform(UI_CORNERS, np.float32([[0, 0], [UI_W, 0], [UI_W, UI_H], [0, UI_H]]))
    return Image.fromarray(cv2.warpPerspective(a, M, (UI_W, UI_H), flags=cv2.INTER_CUBIC))


def lv(x0, y0, x1, y1):
    """level a box measured on the blow-up (mm): take out its tilt about the panel's middle"""
    dy = ((x0 + x1) / 2 - 50) * TILT
    return x0, y0 + dy, x1, y1 + dy


# every box in mm on the panel (x from the left edge, y from the top), measured on the warped blow-up
# (ui_boxes in NOTES.md), shifted by UI_DY and levelled
ROWS = [92.56, 100.71, 108.89, 116.98, 125.0]
RIGHT = ["Deep Freeze", "Dessert", "Party", "Chef", "Energy Saver"]
RIGHT_W = [19.52, 12.28, 8.30, 7.33, 20.49]


class Panel:
    def __init__(self):
        self.k = PX_MM * SS
        self.w, self.h = int(PANEL_MM[0] * self.k), int(PANEL_MM[1] * self.k)
        self.img = Image.new("RGB", (self.w, self.h), GLASS_L)
        self.d = ImageDraw.Draw(self.img)
        self.d.rectangle([SPLIT * self.k, 0, self.w, self.h], fill=GLASS_R)

    def paste(self, a, colour, x, y):
        self.img.paste(Image.new("RGB", a.size, colour), (int(round(x * self.k)), int(round(y * self.k))), a)

    def fit(self, s, name, face, box, colour=WHITE, track=0.0, align="c", keep=True):
        """a word fitted into box (mm): the largest size that fits both ways (keep) or stretched to it"""
        x0, y0, x1, y1 = box
        a = ink(s, name, 300, face, track)
        if keep:
            sc = min((x1 - x0) / a.width, (y1 - y0) / a.height) * self.k
            size = (max(1, int(a.width * sc)), max(1, int(a.height * sc)))
        else:
            size = (int((x1 - x0) * self.k), int((y1 - y0) * self.k))
        a = a.resize(size, Image.LANCZOS)
        wmm, hmm = a.width / self.k, a.height / self.k
        x = {"c": (x0 + x1) / 2 - wmm / 2, "l": x0, "r": x1 - wmm}[align]
        self.paste(a, colour, x, (y0 + y1) / 2 - hmm / 2)

    def word(self, s, name, face, cap_mm, x, base, align="l", colour=WHITE):
        """a word on a baseline (mm) with capitals cap_mm tall"""
        px = cap_px(name, face, cap_mm, self.k)
        f = font(name, px, face)
        wpx = f.getlength(s)
        x0 = {"l": x * self.k, "r": x * self.k - wpx, "c": x * self.k - wpx / 2}[align]
        self.d.text((x0, base * self.k), s, font=f, fill=colour, anchor="ls")

    def rrect(self, box, r, width=None, fill=None, colour=WHITE):
        x0, y0, x1, y1 = (v * self.k for v in box)
        self.d.rounded_rectangle([x0, y0, x1, y1], radius=r * self.k, fill=fill,
                                 outline=None if width is None else colour, width=0 if width is None else int(width * self.k))

    def logo(self):
        os.makedirs(WORK, exist_ok=True)
        png = os.path.join(WORK, "logo_3000.png")
        if not os.path.exists(png):
            subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"),
                            os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"), png, "3000"], check=True, capture_output=True)
        lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
        a = lg[..., 3] / 255
        cols = np.where((a > 0.1).any(0))[0]
        gaps = np.where(np.diff(cols) > 8)[0]            # drop the registered mark (the panel's print has none)
        right = cols[gaps[-1]] + 1 if len(gaps) else cols[-1] + 1
        ys = np.where((a[:, :right] > 0.1).any(1))[0]
        a = a[ys.min():ys.max() + 1, cols[0]:right]
        x0, y0, x1, y1 = lv(20.14, 24.8 + UI_DY * 248.6, 78.98, 44.44 + UI_DY * 248.6)
        sc = min((x1 - x0) / a.shape[1], (y1 - y0) / a.shape[0]) * self.k
        size = (int(a.shape[1] * sc), int(a.shape[0] * sc))
        m = Image.fromarray((a * 255).astype(np.uint8)).resize(size, Image.LANCZOS)
        self.paste(m, (226, 226, 228), (x0 + x1) / 2 - size[0] / self.k / 2, (y0 + y1) / 2 - size[1] / self.k / 2)

    def dash(self, cx, cy):
        self.rrect((cx - 1.75, cy - 0.85, cx + 1.75, cy + 0.85), 0.35, fill=WHITE)

    def lock(self, cx, cy, h, colour=WHITE):
        """a padlock h mm tall centred at (cx, cy): the shackle's arc over a solid body"""
        k = self.k
        bw, bh = h * 0.78, h * 0.55
        self.d.rounded_rectangle([(cx - bw / 2) * k, (cy + h / 2 - bh) * k, (cx + bw / 2) * k, (cy + h / 2) * k], radius=0.12 * h * k, fill=colour)
        sw, st = bw * 0.62, 0.13 * h
        self.d.arc([(cx - sw / 2) * k, (cy - h / 2) * k, (cx + sw / 2) * k, (cy - h / 2 + sw) * k], 180, 360, fill=colour, width=max(1, int(st * k)))
        for sx in (-1, 1):
            xx = cx + sx * (sw / 2 - st / 2)
            self.d.line([xx * k, (cy - h / 2 + sw / 2) * k, xx * k, (cy + h / 2 - bh) * k], fill=colour, width=max(1, int(st * k)))

    def key_icons(self, keys):
        k, lw = self.k, 0.36
        (a, b, c) = keys
        # Fridge Temp: a thermometer (rounded stem over a bulb, filled to half) with an up/down mark beside it
        cx, cy = (a[0] + a[2]) / 2 - 0.9, (a[1] + a[3]) / 2
        self.d.rounded_rectangle([(cx - 1.0) * k, (cy - 3.6) * k, (cx + 1.0) * k, (cy + 1.4) * k], radius=1.0 * k, outline=WHITE, width=int(lw * k))
        self.d.ellipse([(cx - 1.7) * k, (cy + 0.6) * k, (cx + 1.7) * k, (cy + 4.0) * k], outline=WHITE, width=int(lw * k))
        self.d.rectangle([(cx - 1.0 + lw) * k, (cy + 1.0) * k, (cx + 1.0 - lw) * k, (cy + 1.6) * k], fill=GLASS_L)
        self.d.line([cx * k, (cy - 1.2) * k, cx * k, (cy + 2.3) * k], fill=WHITE, width=int(0.5 * k))
        self.d.ellipse([(cx - 0.95) * k, (cy + 1.35) * k, (cx + 0.95) * k, (cy + 3.25) * k], fill=WHITE)
        for j in range(3):
            self.d.line([(cx + 1.05) * k, (cy - 2.6 + j * 0.9) * k, (cx + 1.6) * k, (cy - 2.6 + j * 0.9) * k], fill=WHITE, width=int(0.25 * k))
        ax, ay = cx + 3.1, cy - 1.6
        self.d.polygon([(ax * k, (ay - 1.9) * k), ((ax - 1.0) * k, (ay - 0.35) * k), ((ax + 1.0) * k, (ay - 0.35) * k)], fill=WHITE)
        self.d.polygon([(ax * k, (ay + 1.9) * k), ((ax - 1.0) * k, (ay + 0.35) * k), ((ax + 1.0) * k, (ay + 0.35) * k)], fill=WHITE)
        # Intellisense: a dot at the lower left and three quarter arcs round it
        ox, oy = (b[0] + b[2]) / 2 - 3.3, (b[1] + b[3]) / 2 + 3.0
        self.d.ellipse([(ox - 0.75) * k, (oy - 0.75) * k, (ox + 0.75) * k, (oy + 0.75) * k], outline=WHITE, width=int(0.32 * k))
        for r in (3.0, 5.1, 7.2):
            self.d.arc([(ox - r) * k, (oy - r) * k, (ox + r) * k, (oy + r) * k], 270, 360, fill=WHITE, width=int(0.62 * k))
        # Convert: three small squares with a line out of each
        lx, ly = (c[0] + c[2]) / 2 - 1.6, (c[1] + c[3]) / 2
        for j in (-1, 0, 1):
            y = ly + j * 2.2
            self.d.rectangle([(lx - 0.75) * k, (y - 0.75) * k, (lx + 0.75) * k, (y + 0.75) * k], outline=WHITE, width=int(0.3 * k))
            self.d.line([(lx + 1.4) * k, y * k, (lx + 4.4) * k, y * k], fill=WHITE, width=int(0.36 * k))

    def sixth(self, box):
        # "6" in Baskerville italic, "th" and "sense" in Avenir bold italic, fitted to their parts of the blow-up's box
        x0, y0, x1, y1 = box
        w, h = x1 - x0, y1 - y0
        self.fit("6", "bask", 3, (x0 + 0.08 * w, y0 + 0.14 * h, x0 + 0.70 * w, y0 + 0.74 * h))
        self.fit("th", "avenir", BOLDI, (x0 + 0.66 * w, y0, x0 + 0.99 * w, y0 + 0.21 * h))
        self.fit("sense", "avenir", BOLDI, (x0 + 0.04 * w, y0 + 0.79 * h, x0 + 0.92 * w, y1))

    def badge(self, box):
        x0, y0, x1, y1 = box
        split = x0 + (x1 - x0) * 0.522                  # the blow-up: INTELLI's light box ends at 52% of the badge
        lt = (206, 207, 209)
        self.d.rectangle([x0 * self.k, y0 * self.k, split * self.k, y1 * self.k], fill=lt)
        self.d.rectangle([split * self.k, y0 * self.k, x1 * self.k, y1 * self.k], fill=GLASS_L, outline=lt, width=int(0.42 * self.k))
        pad = 1.45
        self.fit("INTELLI", "avenir", REG, (x0 + 1.0, y0 + pad, split - 1.0, y1 - pad), colour=(40, 40, 42), track=0.14, keep=False)
        self.fit("FRESH", "arialb", None, (split + 1.0, y0 + pad - 0.1, x1 - 1.0, y1 - pad + 0.1), colour=WHITE, track=0.04, keep=False)

    def draw(self):
        dy = UI_DY * PANEL_MM[1]
        self.logo()
        for i, y in enumerate(ROWS):
            self.dash(27.5, y)
            self.dash(71.8, y)
            # the right column: left-aligned at 76.15 mm, each word as wide as on the blow-up
            self.fit(RIGHT[i], "rounded", None, (76.15, y - 1.5, 76.15 + RIGHT_W[i], y + 1.5), align="l", keep=True)
        self.fit("Coldest", "rounded", None, (10.6, ROWS[0] - 1.45, 23.3, ROWS[0] + 1.45), align="r")
        self.fit("Cold", "rounded", None, (15.9, ROWS[4] - 1.45, 23.3, ROWS[4] + 1.45), align="r")
        self.fit("DOOR", "rounded", None, lv(46.02, 107.64 + dy, 54.15, 110.0 + dy))
        self.lock(49.91, 116.95 + dy, 3.2)
        self.dash(50.09, ROWS[4])
        keys = [lv(12.37, 133.66 + dy + 0.2, 29.68, 146.32 + dy + 0.2), lv(41.43, 133.66 + dy, 58.57, 146.32 + dy),
                lv(70.23, 133.66 + dy - 0.2, 87.01, 146.32 + dy - 0.2)]
        keys = [(a, (b + d) / 2 - 6.33, c, (b + d) / 2 + 6.33) for a, b, c, d in keys]
        for b in keys:
            self.rrect(b, 0.5, width=0.36)
        self.key_icons(keys)
        self.fit("Fridge", "rounded", None, lv(15.19, 150.28 + dy, 27.12, 153.99 + dy))
        self.fit("Temp", "rounded", None, lv(15.9, 153.99 + dy, 26.41, 157.78 + dy))
        self.fit("Intellisense", "rounded", None, lv(39.31, 149.69 + dy, 60.87, 152.81 + dy))
        # "( lock Press 2 sec )": the brackets and words set, the lock drawn in its gap
        x0, y0, x1, y1 = lv(38.87, 154.33 + dy, 61.13, 157.28 + dy)
        self.fit("(", "rounded", None, (x0, y0, x0 + 1.0, y1))
        self.lock(x0 + 2.4, (y0 + y1) / 2, 2.5)
        self.fit("Press 2 sec", "rounded", None, (x0 + 4.0, y0 + 0.3, x1 - 1.6, y1 - 0.3))
        self.fit(")", "rounded", None, (x1 - 1.0, y0, x1, y1))
        self.fit("Convert", "rounded", None, lv(71.11, 149.1 + dy, 86.13, 152.14 + dy))
        self.sixth(lv(43.99, 190.14 + dy, 57.07, 207.5 + dy))
        bx = lv(24.56, 211.04 + dy, 76.33, 220.14 + dy)
        self.badge((bx[0], bx[1] + 0.45, bx[2], bx[3] - 0.45))
        cv = lv(25.97, 222.76 + dy, 74.82, 226.63 + dy)
        self.fit("CONVERTIBLE", "black", None, (cv[0], cv[1] + 0.35, cv[2], cv[3] - 0.35), track=1.15, keep=False)
        out = self.img.resize((int(PANEL_MM[0] * PX_MM), int(PANEL_MM[1] * PX_MM)), Image.LANCZOS)
        return out


# ── the fridge door's top cap ──
CAP_MM = (698, 18.8)
CAP_PX_MM = 4
# front.jpg (door's left edge at 386.5 px, 0.6086 px/mm): black (55-64) up to the crescent's tip at 278 mm, a pointed
# oval reaching the cap's full height 16 mm further; silver 178-186 to 393 mm, falling evenly to 102 by 523 mm, then 100-104
# to the right end. lifestyle.jpg reads the same (tip 284, plateau to 391, 100 by 532).
TIP, TIP_LEN, PLAT, FALL = 280, 16, 393, 525


def cap():
    w, h = int(CAP_MM[0] * CAP_PX_MM), int(CAP_MM[1] * CAP_PX_MM)
    k = 3
    xs = np.arange(w * k) / (CAP_PX_MM * k)
    dark = 36 + 24 * np.clip((xs - 120) / (TIP - 120), 0, 1) ** 1.6       # the black rises a little towards the tip
    sil = np.where(xs < PLAT, 180, np.where(xs < FALL, 180 - 78 * (xs - PLAT) / (FALL - PLAT), 102.0))
    rows = np.linspace(0, 1, h * k)[:, None]
    sil = sil[None, :] + 6 * np.exp(-((rows - 0.85) / 0.12) ** 2)          # a touch brighter along the lower edge (front)
    m = Image.new("L", (w * k, h * k), 0)
    pts = []
    for i in range(41):
        t = i / 40
        dy = (t - 0.5) / 0.5
        pts.append(((TIP + TIP_LEN * (1 - np.sqrt(max(0.0, 1 - dy * dy)))) * CAP_PX_MM * k, t * h * k))
    pts += [(w * k, h * k), (w * k, 0)]
    ImageDraw.Draw(m).polygon(pts, fill=255)
    m = np.asarray(m).astype(np.float32) / 255
    v = dark[None, :] * (1 - m) + sil * m
    img = Image.fromarray(np.repeat(v[..., None], 3, 2).clip(0, 255).astype(np.uint8))
    return img.resize((w, h), Image.LANCZOS)


# ── the inside prints ──
PK = 8                               # px per mm for the inside prints
INK = (58, 60, 64)


def spaced(text, width_mm, cap_mm, name="avenir", face=DEMI, colour=INK, alpha=1.0):
    """dark spaced capitals, cap_mm tall, tracked out to width_mm (Whirlpool's labels on the clear parts)"""
    px = cap_px(name, face, cap_mm, PK)
    lo, hi = 0.0, 3.0
    for _ in range(30):                     # find the tracking that gives the measured width
        t = (lo + hi) / 2
        if ink(text, name, px, face, t).width > width_mm * PK:
            hi = t
        else:
            lo = t
    a = ink(text, name, px, face, lo)
    if alpha < 1:
        a = a.point(lambda v: int(v * alpha))
    out = Image.new("RGBA", a.size, colour + (0,))
    out.putalpha(a)
    return out


def two_tone(first, second, cap_mm, light_first=True, track=0.25):
    """ARCTIC FRESH: the first word dark on clear, the second white in a black box"""
    px = cap_px("avenir", DEMI, cap_mm, PK)
    a = ink(first, "avenir", px, REG, track)
    b = ink(second, "avenir", px, DEMI, 0.06)
    pad = int(0.9 * PK)
    bh = a.height + 2 * pad
    out = Image.new("RGBA", (a.width + int(1.2 * PK) + b.width + 2 * pad, bh), (0, 0, 0, 0))
    lay = Image.new("RGBA", a.size, INK + (255,))
    out.paste(lay, (0, pad), a)
    bx = a.width + int(1.2 * PK)
    ImageDraw.Draw(out).rectangle([bx, 0, out.width - 1, bh - 1], fill=(14, 14, 16, 255))
    out.paste(Image.new("RGBA", b.size, (246, 246, 246, 255)), (bx + pad, pad), b)
    return out


def logo_word(mark, light, bold, cap_mm, tm=False):
    """MICROBLOCK / SEALFRESH: a small mark, then the word in two weights (as on the open photo, dark on white)"""
    px = cap_px("avenir", MED, cap_mm, PK)
    a, b = ink(light, "avenir", px, REG), ink(bold, "avenir", px, BOLD)
    s = a.height
    gap = int(0.35 * s)
    W = s + gap + a.width + int(0.08 * s) + b.width + (int(0.6 * s) if tm else 0)
    out = Image.new("RGBA", (W + 2, s + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    c = INK + (255,)
    if mark == "diamond":
        cx, cy, r = s / 2, s / 2 + 1, s / 2
        d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], outline=c, width=max(1, int(0.16 * s)))
        d.polygon([(cx, cy - r * 0.45), (cx + r * 0.45, cy), (cx, cy + r * 0.45), (cx - r * 0.45, cy)], fill=c)
    else:
        d.ellipse([1, 1, s, s], outline=c, width=max(1, int(0.2 * s)))
        d.arc([s * 0.3, s * 0.3, s * 0.72, s * 0.72], 200, 470, fill=c, width=max(1, int(0.14 * s)))
    x = s + gap
    out.paste(Image.new("RGBA", a.size, c), (x, 1 + s - a.height), a)
    x += a.width + int(0.08 * s)
    out.paste(Image.new("RGBA", b.size, c), (x, 1 + s - b.height), b)
    if tm:
        t = ink("TM", "avenir", px * 0.35, DEMI)
        out.paste(Image.new("RGBA", t.size, c), (x + b.width + int(0.12 * s), 1), t)
    return out


DK = 4  # px per mm for the drawings lifted off the photo (the photo holds 0.56 px per mm; more is wasted bytes)
# The drawings are thin light-grey lines in a part-clear ink: over food in Whirlpool's stocked photo a line darkens what is
# behind it by 10-30 % in one pixel (the melon 233,200,115 under a line 169,143,66 at its darkest), and they are barely
# seen. So: only the core of each photo line (about 1 mm), a mid-grey ink, at most 60 % cover (first build: the whole
# blurred line, firmed to full cover in near-black, read as bold black outlines over the food)
DRAW_INK = (112, 114, 118)
DRAW_ALPHA = 0.6
DRAW_CORE = (0.45, 0.25)        # the share of the enlarged photo line kept as the stroke: from 0.45, full by 0.70


def drawing(box, out_w_mm, up=6, blank=(), lo=10):
    """a line drawing lifted off the open photo: the dark ink against its local white, enlarged and cleaned. It stays as
    soft as the photo allows (0.56 px per mm); no line is added that the photo does not show."""
    g = np.asarray(Image.open(os.path.join(SRC, "open.jpg")).convert("L")).astype(np.float32)
    x0, y0, x1, y1 = box
    r = g[y0:y1, x0:x1]
    bg = cv2.dilate(r, np.ones((5, 5), np.uint8))                      # the local white under the lines
    a = np.clip((bg - r - lo) / 70, 0, 1)                               # lo: how dark a line must be to count
    for bx0, by0, bx1, by1 in blank:                                   # photo rectangles that hold something else
        a[max(0, by0 - y0):max(0, by1 - y0), max(0, bx0 - x0):max(0, bx1 - x0)] = 0   # (a shelf edge, a printed word)
    im = Image.fromarray((a * 255).astype(np.uint8)).resize(((x1 - x0) * up, (y1 - y0) * up), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(up * 0.35))
    v = np.asarray(im).astype(np.float32) / 255
    v = np.clip((v - DRAW_CORE[0]) / DRAW_CORE[1], 0, 1) * DRAW_ALPHA    # the line's core, in a part-clear ink
    w = int(out_w_mm * DK)
    alpha = Image.fromarray((v * 255).astype(np.uint8)).resize((w, int(w * (y1 - y0) / (x1 - x0))), Image.LANCZOS)
    out = Image.new("RGBA", alpha.size, DRAW_INK + (0,))
    out.putalpha(alpha)
    return out


def sensor_icon(size_mm=44.0):
    """the grey sensor plate (open photo: a mid-grey square with a darker dot and three arcs)"""
    k = 10
    n = int(size_mm * k)
    im = Image.new("RGB", (n, n), (150, 151, 153))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, n - 1, n - 1], outline=(128, 129, 131), width=int(0.8 * k))
    ox, oy = n * 0.3, n * 0.74
    c = (64, 66, 70)
    d.ellipse([ox - 0.075 * n, oy - 0.075 * n, ox + 0.075 * n, oy + 0.075 * n], fill=c)
    for r in (0.24, 0.38, 0.52):
        d.arc([ox - r * n, oy - r * n, ox + r * n, oy + r * n], 270, 360, fill=c, width=int(0.07 * n))
    return im


def dial_scale(r_mm=34.0):
    """the freezer dial's scale (open photo): an arc over the knob with five ticks; the two end words can't be read on the
    photo and are left out"""
    k = 10
    n = int(2 * r_mm * k)
    im = Image.new("RGBA", (n, n), INK + (0,))
    d = ImageDraw.Draw(im)
    c = INK + (255,)
    R = r_mm * 0.78 * k
    d.arc([n / 2 - R, n / 2 - R, n / 2 + R, n / 2 + R], 215, 325, fill=c, width=int(0.7 * k))
    for i in range(5):
        ang = np.radians(220 + i * 25)
        for rr0, rr1 in ((R + 1.2 * k, R + 3.6 * k),):
            d.line([n / 2 + np.cos(ang) * rr0, n / 2 + np.sin(ang) * rr0, n / 2 + np.cos(ang) * rr1, n / 2 + np.sin(ang) * rr1], fill=c, width=int(0.6 * k))
    for sx in (-1, 1):
        x = n / 2 + sx * (R + 5.0 * k)
        d.line([x - 2.2 * k, n / 2 - 0.2 * k, x + 2.2 * k, n / 2 - 0.2 * k], fill=c, width=int(0.6 * k))
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    for sfx, c in COLOURS.items():
        for i, (name, (w, h)) in enumerate(DOOR_MM.items()):
            brushed(w, h, 20261107 + i, SHADE[name], c).save(os.path.join(OUT, name + sfx + ".jpg"), quality=86, optimize=True)
        if c["side"] is None:
            continue
        side(False, 7, c["side"]).save(os.path.join(OUT, "side_l" + sfx + ".jpg"), quality=86, optimize=True)
        side(True, 8, c["side"]).save(os.path.join(OUT, "side_r" + sfx + ".jpg"), quality=86, optimize=True)
    pan = Panel().draw()
    pan.save(os.path.join(OUT, "panel.jpg"), quality=90, optimize=True)
    cap().save(os.path.join(OUT, "cap.jpg"), quality=90, optimize=True)
    # widths (mm) from the open photo at 0.5555 px/mm (cabinet) or the open doors' own scale (door bins): NOTES.md
    prints = {
        # the words on the clear fronts the food is seen through, in the drawings' part-clear grey (the empty photo reads
        # FARM FRESH at 114-151 on 227; over food the stocked photo barely shows them)
        "print_dairy": spaced("DAIRY FRESH", 103, 5.2, colour=DRAW_INK, alpha=0.8),
        "print_freshflow": spaced("FRESH FLOW", 85, 4.4),
        "print_orchard": spaced("ORCHARD FRESH", 121, 4.6, colour=DRAW_INK, alpha=0.8),
        "print_farm": spaced("FARM FRESH", 80, 4.4, colour=DRAW_INK, alpha=0.8),
        "print_frozen": spaced("FROZEN FOODS", 155, 6.0),
        "print_easy": spaced("EASY RACK", 128, 6.0),
        "print_bigbottle": spaced("BIG BOTTLE RACK", 186, 6.0),
        "print_bottle": spaced("BOTTLE RACK", 138, 6.0),
        "print_arctic": two_tone("ARCTIC", "FRESH", 4.0),
        "print_microblock": logo_word("diamond", "MICRO", "BLOCK", 6.0, tm=True),
        "print_sealfresh": logo_word("circle", "SEAL", "FRESH", 6.0),
        "print_cheese": drawing((558, 491, 628, 531), 124),
        "print_fruits": drawing((546, 853, 624, 882), 140, blank=[(546, 853, 598, 863)], lo=13),
        "print_veg": drawing((329, 944, 456, 1037), 228, blank=[(329, 944, 420, 961)]),
    }
    sizes = {}
    for n, im in prints.items():
        im.save(os.path.join(OUT, n + ".png"), optimize=True)
        k = DK if n in ("print_cheese", "print_fruits", "print_veg") else PK
        sizes[n] = (round(im.width / k, 1), round(im.height / k, 1))
    sensor_icon().save(os.path.join(OUT, "icon_sensor.jpg"), quality=88, optimize=True)
    dial_scale().save(os.path.join(OUT, "dial_scale.png"), optimize=True)
    print("prints (mm):", sizes)
    if "--compare" in sys.argv:
        os.makedirs(LOOK, exist_ok=True)
        ph = ui_warped().resize((pan.width, int(pan.width * UI_H / UI_W)), Image.LANCZOS)
        fr = Image.open(os.path.join(SRC, "front.jpg")).convert("RGB").crop((568, 83, 630, 236)).resize((pan.width, pan.height), Image.LANCZOS)
        c = Image.new("RGB", (pan.width * 3 + 40, max(ph.height, pan.height)), "white")
        c.paste(fr, (0, 0))
        c.paste(ph, (pan.width + 20, 0))
        c.paste(pan, (2 * pan.width + 40, 0))
        c.save(os.path.join(LOOK, "panel_compare.jpg"), quality=88)


if __name__ == "__main__":
    main()
