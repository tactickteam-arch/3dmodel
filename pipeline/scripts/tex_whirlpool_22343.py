"""Textures for the Whirlpool 22343 (Intellifresh Pro 235 L convertible frost-free double door, Illusia Steel).

Writes pipeline/tex/whirlpool_22343/:
  door_freezer.jpg, door_fridge.jpg  the Illusia Steel doors: brushed steel with half the depth of the soft vertical
                                     bands Whirlpool's straight front shows (the hairline map adds the fine brushing)
  side_l.jpg, side_r.jpg             the painted steel sides, brightest at the front as on Whirlpool's 3/4 views
  panel.jpg                          the External UI touch panel (black glass), redrawn sharp at 7.2 px/mm from
                                     Whirlpool's own close-up of it (feature "up to 50% energy saving")
  cap.jpg                            the fridge door's top cap: black on the left, silver from the crescent tip on
  print_*.png                        the inside prints as Whirlpool's open-door photo shows them (first word dark on
                                     white, last word white on black)
usage: python3 -I pipeline/scripts/tex_whirlpool_22343.py [--compare]
Sources (pipeline/sources/photos/whirlpool_22343/): front.webp (Whirlpool's straight front, 0.863 px/mm across),
feature_panel.jpg (the panel straight on), sibling21972_open_empty.jpg (the same model in Sapphire Luxuria, open).
Every size is in NOTES.md (private/research/whirlpool_22343/) with how it was measured.
"""
import os
import site
import subprocess
import sys

sys.path.append(site.getusersitepackages())
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(SITE, "pipeline/sources/photos/whirlpool_22343")
OUT = os.path.join(SITE, "pipeline/tex/whirlpool_22343")
WORK = os.path.join(SITE, ".work", "whirlpool_22343_tex")
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BASK = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
BOLD, BOLDI, DEMI, MED, REG = 0, 1, 2, 5, 7
PX_MM = 7.2
SS = 3                                    # supersampling while drawing the panel
WHITE = (236, 236, 238)
GLASS = (9, 9, 10)

# ── the doors and sides ──
# Whirlpool's renders of this steel show bright brushed steel crossed by soft vertical light and dark bands (the studio's
# reflections; every row of the straight front has the same bands, so they run the full height). The viewer's narrow lens
# sees the whole door in one reflection, so most of the bands' depth is kept in the texture (as the LG GL-B257 keeps its
# photo's fall); the clear coat and the hairline map add the gloss and the fine brushing. BASE, BANDS and SIDE were tuned
# on renders at the front and both 3/4 views against Whirlpool's (doors 151-157 / 177-182 / 157-162 of 255 against the
# photos' 154 / 156 / 175; sides 101 and 105 against 99 and 103; REVIEW.md).
BASE = 134
BANDS = 0.8                                          # the share of the photo's band depth kept
SIDE = 122                                           # the sides' mean
SIDE_FALL = (1.25, 0.82)                             # front and back of the side, as a share of its mean (3/4 views)
DOOR_MM = {"door_freezer": (562, 454), "door_fridge": (562, 1069)}
SIDE_MM = (605, 1550)
DOOR_PX_MM = 1.0
SIDE_PX_MM = 0.5
# front.webp: the body spans columns 24-515 (564 mm); rows clear of the panel and the two infographic overlays
FRONT_X = (24, 515)
CLEAN_ROWS = [(240, 430), (640, 1140)]


def band_profile(w):
    """the straight front's brightness across the doors, w samples left to right, as a share of its mean"""
    g = np.asarray(Image.open(os.path.join(SRC, "front.webp")).convert("L")).astype(np.float32)
    rows = np.concatenate([g[a:b, FRONT_X[0]:FRONT_X[1] + 1] for a, b in CLEAN_ROWS], 0)
    p = rows.mean(0)
    p[:4], p[-4:] = p[4], p[-5]                       # the outermost columns are the doors' rounded edges
    k = np.exp(-0.5 * (np.arange(-30, 31) / 9.0) ** 2); k /= k.sum()
    p = np.convolve(np.pad(p, 30, mode="edge"), k, "same")[30:-30]
    p = np.interp(np.linspace(0, len(p) - 1, w), np.arange(len(p)), p)
    return p / p.mean()


def brushed(w_mm, h_mm, seed):
    rng = np.random.default_rng(seed)
    w, h = int(w_mm * DOOR_PX_MM), int(h_mm * DOOR_PX_MM)
    # fine horizontal streaks, faint: each 1 mm row its own grey, stretched along x
    fine = rng.normal(0, 1, (h, w // 40 + 2))
    fine = np.asarray(Image.fromarray(((fine + 4) * 30).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 30 - 4
    shade = 1 + BANDS * (band_profile(w)[None, :] - 1)
    v = (BASE + 1.0 * fine) * shade
    v = np.repeat(v[..., None], 3, 2)
    v[..., 2] += 2.5                       # Illusia Steel reads a touch cool (photo: B over R by 2-3)
    return Image.fromarray(v.clip(0, 255).astype(np.uint8))


def side(mirror, seed):
    """the painted steel sides: the 3/4 views light them brightest at the front, falling towards the back.
    u runs from the back (0) to the front (1); the right side's face runs the other way, so it is mirrored."""
    rng = np.random.default_rng(seed)
    w, h = int(SIDE_MM[0] * SIDE_PX_MM), int(SIDE_MM[1] * SIDE_PX_MM)
    u = np.linspace(0, 1, w)[None, :]
    fall = SIDE_FALL[1] + (SIDE_FALL[0] - SIDE_FALL[1]) * u ** 1.3
    v = SIDE * fall + rng.normal(0, 0.8, (h, w))
    v = np.repeat(v[..., None], 3, 2)
    v[..., 2] += 2.0
    img = Image.fromarray(v.clip(0, 255).astype(np.uint8))
    return img.transpose(Image.FLIP_LEFT_RIGHT) if mirror else img


# ── the panel ──
PANEL_MM = (94.0, 236.0)                  # 81 x 204 px on the front at 0.863 px/mm (the panel is the same part on every
                                          # render, so it is kept at its true size; NOTES.md)
# the layout, from the feature image (panel x 51.5-206.5, y 40-453 px: 0.6065 mm/px across, 0.5714 mm/px down; the
# feature's print sits 1.3 degrees off level, so the left and right columns are averaged to level rows)
ROWS = [87.4 + i * 7.57 for i in range(5)]
LEFT = ["All Season", "Grocery Day", "Beverages", "Deep Freeze", "Energy Saver"]
RIGHT = ["Fast Ice", "Party", "Vacation", "Chef", "Mini Ref"]
LOGO = (20.9, 26.3, 73.7, 42.9)
KEYS = [(13.0, 125.2, 28.9, 137.2), (39.4, 125.2, 55.3, 137.2), (65.7, 125.2, 81.6, 137.2)]
BADGE = (17.3, 212.9, 77.3, 221.9)
BADGE_SPLIT = 62.2


def font(face, px, path=AVENIR):
    return ImageFont.truetype(path, int(px), index=face)


def ink(text, face, px, path=AVENIR):
    """the text's alpha, cropped to its ink"""
    f = font(face, px, path)
    img = Image.new("L", (int(px * 0.8 * len(text) + px * 2), int(px * 2.2)), 0)
    ImageDraw.Draw(img).text((px * 0.5, px * 1.6), text, font=f, fill=255, anchor="ls")
    a = np.asarray(img)
    ys, xs = np.where(a > 4)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


class Panel:
    def __init__(self):
        self.k = PX_MM * SS
        self.w, self.h = int(PANEL_MM[0] * self.k), int(PANEL_MM[1] * self.k)
        self.img = Image.new("RGB", (self.w, self.h), GLASS)
        self.d = ImageDraw.Draw(self.img)

    def P(self, x, y):
        return (x * self.k, y * self.k)

    def paste(self, a, colour, x, y):
        """paste alpha a (PIL L) with its top-left at mm (x, y)"""
        layer = Image.new("RGB", a.size, colour)
        self.img.paste(layer, (int(round(x * self.k)), int(round(y * self.k))), a)

    def text(self, s, face, cap_mm, x, yc, anchor="l", colour=WHITE, path=AVENIR, width=None):
        """a word whose capitals are cap_mm tall and centred on yc; anchor l/r/c on x (or fitted to width)"""
        probe = ink("H", face, 200, path)
        px = 200 * cap_mm * self.k / probe.height
        capH = probe.height * px / 200
        f = font(face, px, path)
        B = int(px * 1.6)
        img = Image.new("L", (int(px * 0.8 * len(s) + px * 2), int(px * 2.4)), 0)
        ImageDraw.Draw(img).text((px * 0.5, B), s, font=f, fill=255, anchor="ls")
        arr = np.asarray(img)
        ys, xs = np.where(arr > 4)
        a = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        above = (B - capH) - ys.min()          # how far the word's ink rises over the capitals' top (brackets, l)
        sc = width * self.k / a.width if width else 1
        if width:
            a = a.resize((max(1, int(a.width * sc)), max(1, int(a.height * sc))), Image.LANCZOS)
        wmm = a.width / self.k
        x0 = {"l": x, "r": x - wmm, "c": x - wmm / 2}[anchor]
        self.paste(a, colour, x0, yc - capH * sc / self.k / 2 - above * sc / self.k)
        return wmm

    def logo(self):
        os.makedirs(WORK, exist_ok=True)
        png = os.path.join(WORK, "logo_3000.png")
        if not os.path.exists(png):
            subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"),
                            os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"), png, "3000"], check=True, capture_output=True)
        lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
        a, rgb = lg[..., 3] / 255, lg[..., :3]
        gold = (rgb[..., 0] - rgb[..., 2]) > 60
        cols = np.where((a > 0.1).any(0))[0]
        gaps = np.where(np.diff(cols) > 8)[0]            # drop the registered mark (the panel's print has none)
        right = cols[gaps[-1]] + 1 if len(gaps) else cols[-1] + 1
        ys = np.where((a[:, :right] > 0.1).any(1))[0]
        a, gold = a[ys.min():ys.max() + 1, cols[0]:right], gold[ys.min():ys.max() + 1, cols[0]:right]
        x0, y0, x1, y1 = LOGO
        sc = min((x1 - x0) / a.shape[1], (y1 - y0) / a.shape[0]) * self.k
        size = (int(a.shape[1] * sc), int(a.shape[0] * sc))
        ox, oy = (x0 + x1) / 2 - size[0] / self.k / 2, (y0 + y1) / 2 - size[1] / self.k / 2
        for alpha, col in ((a * ~gold, WHITE), (a * gold, (214, 165, 52))):
            m = Image.fromarray((alpha * 255).astype(np.uint8)).resize(size, Image.LANCZOS)
            self.paste(m, col, ox, oy)

    def zone_icons(self):
        """the two zone icons over LOW/MID/HIGH: a door outline each, the left one lit below, the right one lit above"""
        k, lw = self.k, 0.32 * self.k
        for i, (x0, lit) in enumerate(((41.6, "low"), (48.0, "high"))):
            x1, y0, y1 = x0 + 4.6, 90.0, 97.1
            ys = y0 + (y1 - y0) * 0.42
            self.d.rounded_rectangle([x0 * k, y0 * k, x1 * k, y1 * k], radius=0.6 * k, outline=WHITE, width=int(lw))
            self.d.line([x0 * k, ys * k, x1 * k, ys * k], fill=WHITE, width=int(lw))
            ya, yb = (ys, y1) if lit == "low" else (y0, ys)
            self.d.rectangle([(x0 + 0.7) * k, (ya + 0.7) * k, (x1 - 0.7) * k, (yb - 0.7) * k], fill=WHITE)

    def key(self, box, kind):
        k = self.k
        x0, y0, x1, y1 = box
        self.d.rounded_rectangle([x0 * k, y0 * k, x1 * k, y1 * k], radius=0.5 * k, outline=(205, 205, 208), width=int(0.3 * k))
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if kind == "modes":                    # three rings with a line out of each (the photo's list icon, 4.2 x 7.6 mm)
            for j in (-1, 0, 1):
                y = cy + j * 2.3
                self.d.ellipse([(cx - 2.1) * k, (y - 0.75) * k, (cx - 0.6) * k, (y + 0.75) * k], outline=WHITE, width=int(0.3 * k))
                self.d.line([(cx - 0.1) * k, y * k, (cx + 2.1) * k, y * k], fill=WHITE, width=int(0.35 * k))
        else:                                  # a thermometer with a small burst beside it (the photo's Manual Temp icon)
            self.d.rounded_rectangle([(cx - 2.0) * k, (cy - 3.8) * k, (cx - 0.6) * k, (cy + 1.4) * k], radius=0.7 * k, outline=WHITE, width=int(0.3 * k))
            self.d.ellipse([(cx - 2.7) * k, (cy + 0.7) * k, (cx + 0.1) * k, (cy + 3.5) * k], fill=WHITE)
            self.d.ellipse([(cx + 0.5) * k, (cy - 2.2) * k, (cx + 2.5) * k, (cy - 0.2) * k], outline=WHITE, width=int(0.3 * k))
            for t in range(8):
                ang = t * np.pi / 4
                ax, ay = cx + 1.5 + np.cos(ang) * 1.35, cy - 1.2 + np.sin(ang) * 1.35
                self.d.ellipse([(ax - 0.25) * k, (ay - 0.25) * k, (ax + 0.25) * k, (ay + 0.25) * k], fill=WHITE)

    def badge(self):
        k = self.k
        x0, y0, x1, y1 = BADGE
        self.d.rectangle([x0 * k, y0 * k, BADGE_SPLIT * k, y1 * k], fill=(240, 240, 240))
        self.d.rectangle([BADGE_SPLIT * k, y0 * k, x1 * k, y1 * k], fill=GLASS, outline=(240, 240, 240), width=int(0.45 * k))
        cy = (y0 + y1) / 2
        self.text("INTELLIFRESH", DEMI, 5.0, (x0 + BADGE_SPLIT) / 2, cy, "c", colour=(20, 20, 22), width=BADGE_SPLIT - x0 - 2.4)
        self.text("PRO", DEMI, 5.0, (BADGE_SPLIT + x1) / 2, cy, "c", colour=(240, 240, 240), width=x1 - BADGE_SPLIT - 4.2)

    def sixth(self):
        # "6" in Baskerville, "th" and "sense" in Avenir bold italic, at their boxes on the feature image
        self.fit_box("6", 4, (42.6, 197.7, 50.8, 205.7), BASK)   # SemiBold, upright as on the photo
        self.fit_box("th", BOLDI, (49.9, 194.0, 53.4, 196.8))
        self.fit_box("sense", BOLDI, (42.0, 206.3, 52.8, 209.1))

    def fit_box(self, s, face, box, path=AVENIR, colour=WHITE):
        x0, y0, x1, y1 = box
        a = ink(s, face, 300, path)
        sc = min((x1 - x0) / a.width, (y1 - y0) / a.height) * self.k
        a = a.resize((max(1, int(a.width * sc)), max(1, int(a.height * sc))), Image.LANCZOS)
        self.paste(a, colour, (x0 + x1) / 2 - a.width / self.k / 2, (y0 + y1) / 2 - a.height / self.k / 2)

    def draw(self):
        self.logo()
        cap = 2.3                               # the mode words' capitals (fitted: "Grocery Day" spans 18 mm on the photo)
        for y, s in zip(ROWS, LEFT):
            self.text(s, DEMI, cap, 24.7, y, "r")
            self.d.rectangle([25.9 * self.k, (y - 0.45) * self.k, 28.6 * self.k, (y + 0.45) * self.k], fill=WHITE)
        for y, s in zip(ROWS, RIGHT):
            self.text(s, DEMI, cap, 69.8, y, "l")
            self.d.rectangle([64.7 * self.k, (y - 0.45) * self.k, 67.4 * self.k, (y + 0.45) * self.k], fill=WHITE)
        self.zone_icons()
        for y, s in zip(ROWS[2:], ["LOW", "MID", "HIGH"]):
            self.text(s, DEMI, cap, 47.6, y, "c")
        for b, kind in zip(KEYS, ["modes", "temp", "modes"]):
            self.key(b, kind)
        self.fit_box("Modes", DEMI, (15.1, 140.0, 27.0, 143.6))
        self.fit_box("Modes", DEMI, (67.4, 140.0, 79.4, 143.6))
        self.fit_box("Manual Temp", DEMI, (36.4, 140.4, 58.6, 144.3))
        self.fit_box("(Press 2 sec", DEMI, (40.4, 145.6, 54.2, 148.3))
        self.fit_box("to change zone)", DEMI, (38.1, 148.6, 56.9, 151.4))
        self.sixth()
        self.badge()
        out = self.img.resize((int(PANEL_MM[0] * PX_MM), int(PANEL_MM[1] * PX_MM)), Image.LANCZOS)
        # round the two bottom corners (3.5 mm, the photo) into the door's grey: the builder cuts the same corners
        return out


# ── the fridge door's top cap ──
CAP_MM = (562, 20)
CAP_PX_MM = 4
TIP = 230                                 # the silver's tip, mm from the door's left edge (front: x 225 px of 26-512)
TIP_LEN = 33                              # it reaches the cap's full height 33 mm further right (x 253 px)


def cap():
    w, h = CAP_MM[0] * CAP_PX_MM, CAP_MM[1] * CAP_PX_MM
    k = 3
    img = Image.new("RGB", (w * k, h * k), (40, 41, 44))          # the black part reads 37-54 on the front
    m = Image.new("L", (w * k, h * k), 0)
    d = ImageDraw.Draw(m)
    # the silver: a long shape whose left end is a pointed oval, tip a little under the middle (as on the front)
    pts = []
    yc = 0.55
    for i in range(41):
        t = i / 40
        y = t
        dy = (y - yc) / (yc if y < yc else 1 - yc)
        x = TIP + TIP_LEN * (1 - np.sqrt(max(0.0, 1 - dy * dy)))
        pts.append((x * CAP_PX_MM * k, y * h * k))
    pts += [(w * k, h * k), (w * k, 0)]
    d.polygon(pts, fill=255)
    rows = np.linspace(0, 1, h * k)[:, None]
    silver = 182 + 26 * np.exp(-((rows - 0.12) / 0.07) ** 2) - 18 * rows      # a bright top edge, falling below
    sv = np.repeat(np.repeat(silver, w * k, 1)[..., None], 3, 2)
    sv[..., 2] += 3
    s_img = Image.fromarray(sv.clip(0, 255).astype(np.uint8))
    img.paste(s_img, (0, 0), m)
    return img.resize((w, h), Image.LANCZOS)


# ── the inside prints ──
def label(parts, cap_mm, pad_mm=0.9, k=12, lines=None):
    """Whirlpool's two-tone label: [(text, dark_on_white)], each part a box, side by side"""
    probe = ink("H", DEMI, 200)
    px = 200 * cap_mm * k / probe.height
    tiles = []
    for text, light in parts:
        a = ink(text, DEMI, px)
        bw, bh = a.width + int(2 * pad_mm * k), int((cap_mm + 2 * pad_mm) * k)
        t = Image.new("RGB", (bw, bh), (246, 246, 246) if light else (16, 16, 18))
        t.paste(Image.new("RGB", a.size, (24, 24, 26) if light else (246, 246, 246)), ((bw - a.width) // 2, (bh - a.height) // 2 + (int(cap_mm * k) - a.height) // 2 * 0), a)
        if light:
            ImageDraw.Draw(t).rectangle([0, 0, bw - 1, bh - 1], outline=(40, 40, 42), width=max(1, int(0.25 * k)))
        tiles.append(t)
    W = sum(t.width for t in tiles)
    out = Image.new("RGB", (W, tiles[0].height))
    x = 0
    for t in tiles:
        out.paste(t, (x, 0))
        x += t.width
    return out


def stacked(top, bottom, cap_mm, k=12):
    """CONVERTIBLE (white on black) over FREEZER (dark on white)"""
    a, b = label([(top, False)], cap_mm, k=k), label([(bottom, True)], cap_mm * 0.85, k=k)
    w = max(a.width, b.width)
    out = Image.new("RGB", (w, a.height + b.height), (246, 246, 246))
    out.paste(a.resize((w, a.height)), (0, 0))
    out.paste(b, ((w - b.width) // 2, a.height))
    return out


def fruits(cap_mm, k=12):
    """FRUITS & / VEGETABLES, white on black, and the grey icon box beside it (its icon too small to read: left blank)"""
    pad = int(1.2 * k)
    probe = ink("H", DEMI, 200)
    px = 200 * cap_mm * k / probe.height
    l1, l2 = ink("FRUITS &", DEMI, px), ink("VEGETABLES", DEMI, px)
    bw = max(l1.width, l2.width) + 2 * pad
    bh = l1.height + l2.height + 3 * pad
    box = Image.new("RGB", (bw, bh), (16, 16, 18))
    box.paste(Image.new("RGB", l1.size, (246, 246, 246)), ((bw - l1.width) // 2, pad), l1)
    box.paste(Image.new("RGB", l2.size, (246, 246, 246)), ((bw - l2.width) // 2, 2 * pad + l1.height), l2)
    ib = Image.new("RGB", (int(bh * 1.05), bh), (214, 216, 218))
    ImageDraw.Draw(ib).rectangle([0, 0, ib.width - 1, bh - 1], outline=(150, 152, 156), width=max(1, int(0.25 * k)))
    out = Image.new("RGB", (bw + ib.width + int(0.8 * k), bh), (238, 240, 242))
    out.paste(box, (0, 0))
    out.paste(ib, (bw + int(0.8 * k), 0))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, (name, (w, h)) in enumerate(DOOR_MM.items()):
        brushed(w, h, 20261105 + i).save(os.path.join(OUT, name + ".jpg"), quality=86, optimize=True)
    side(False, 20261107).save(os.path.join(OUT, "side_l.jpg"), quality=86, optimize=True)
    side(True, 20261107).save(os.path.join(OUT, "side_r.jpg"), quality=86, optimize=True)
    pan = Panel().draw()
    pan.save(os.path.join(OUT, "panel.jpg"), quality=90, optimize=True)
    cap().save(os.path.join(OUT, "cap.jpg"), quality=90, optimize=True)
    prints = {
        "print_everyday": label([("EVERYDAY", True), ("FRESH", False)], 2.6),
        "print_arctic": label([("ARCTIC", True), ("FRESH", False)], 1.6),
        "print_convertible": stacked("CONVERTIBLE", "FREEZER", 2.0),
        "print_frozen": label([("FROZEN", True), ("FOOD", False)], 2.4),
        "print_easy": label([("EASY", True), ("RACK", False)], 2.6),
        "print_bigbottle": label([("BIG BOTTLE", True), ("RACK", False)], 2.6),
        "print_bottle": label([("BOTTLE", True), ("RACK", False)], 2.6),
        "print_fruits": fruits(3.4),
    }
    sizes = {}
    for n, im in prints.items():
        im.save(os.path.join(OUT, n + ".png"), optimize=True)
        sizes[n] = (round(im.width / 12, 1), round(im.height / 12, 1))
    print("prints (mm):", sizes)
    if "--compare" in sys.argv:
        ph = Image.open(os.path.join(SRC, "feature_panel.jpg")).convert("RGB").crop((52, 40, 206, 453))
        ph = ph.resize((pan.width, pan.height), Image.LANCZOS)
        c = Image.new("RGB", (pan.width * 2 + 20, pan.height), "white")
        c.paste(ph, (0, 0))
        c.paste(pan, (pan.width + 20, 0))
        os.makedirs(os.path.join(SITE, "private/research/whirlpool_22343/lookpass"), exist_ok=True)
        c.save(os.path.join(SITE, "private/research/whirlpool_22343/lookpass/panel_compare.jpg"), quality=88)


if __name__ == "__main__":
    main()
