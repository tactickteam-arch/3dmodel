"""Textures for the Whirlpool 22457 (Luxuriem 654 L four-door French door refrigerator, Rhodium Steel; the same body in
Cosmos Black, 22458).

Writes pipeline/tex/whirlpool_22457/:
  door_l_<c>.jpg, door_r_<c>.jpg  the steel doors of colour c (rs Rhodium Steel, cb Cosmos Black): horizontally brushed
                                  steel crossed by the soft vertical light bands Whirlpool's straight front shows on the
                                  left and the right doors (the upper and lower doors read the same); the hairline map
                                  adds the fine brushing in the model
  logo.png                        the Whirlpool mark on the right fridge door (white word, gold swirl)
  sixth.png                       the 6th Sense mark on the left fridge door (white)
  panel.jpg                       the door display on the left fridge door's inner edge (black glass), every word and
                                  icon redrawn at 7.2 px/mm on the layout of Whirlpool's close-up of it
  print_360.png, print_triple.png the 360 degree mark and "TRIPLE COOLING" on the fridge's back panel, cut from
                                  Whirlpool's own artwork of the mark (the front render's overlay), recoloured grey
  print_arctic.png                "ARCTIC FREEZE" on the freezer's upper drawer
  icons_crisper.png, icons_drawer.png  the line icons on the crisper fronts and the lower drawers, lifted off
                                  Whirlpool's open photo (0.47 px/mm, so soft)
usage: python3 -I pipeline/scripts/tex_whirlpool_22457.py
Sources (pipeline/sources/photos/whirlpool_22457/): front_rs.jpg and front_cb.jpg (Whirlpool's straight fronts,
0.5633 px/mm), open_rs.jpg (the open render), reasons_panel.jpg (the display close-up). Every size is in NOTES.md
(private/research/whirlpool_22457/) with how it was measured.
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
SRC = os.path.join(SITE, "pipeline/sources/photos/whirlpool_22457")
OUT = os.path.join(SITE, "pipeline/tex/whirlpool_22457")
WORK = os.path.join(SITE, ".work", "whirlpool_22457", "tex")
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BASK = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
BOLD, BOLDI, DEMI, MED, REG = 0, 1, 2, 5, 7
PX_MM = 7.2
SS = 3
WHITE = (236, 236, 238)
GLASS = (9, 9, 10)

# ── the doors ──
# The straight fronts (0.5633 px/mm: the body spans columns 372.5-884.5 for 909 mm) light each door with the same bands
# top to bottom, and the upper and lower doors alike. Columns and rows clear of the marketing overlays (the "2026 MODEL"
# badge, the 360 mark and the "fastest convertible" artwork are drawn over the render; the 3/4 photo of the real door
# has none of them). The outer 8 px of each door are its rounded edges, held flat here.
DOORS = {"l": ((384, 616), [(175, 315), (430, 625), (680, 1100)]),
         "r": ((642, 876), [(130, 625), (680, 775), (1005, 1100)])}
# per colour: the texture's mean grey and the share of the photo's band depth kept (tuned on the gate's front and 3/4
# renders against Whirlpool's photos: REVIEW.md). Rhodium reads 136 (left doors) and 157 (right) on the photo,
# Cosmos Black 55 and 60; both neutral grey (R = G = B)
COLOURS = {"rs": {"src": "front_rs.jpg", "base": {"l": 117, "r": 135}, "bands": 0.8},
           "cb": {"src": "front_cb.jpg", "base": {"l": 47, "r": 50}, "bands": 0.8}}
TEX_W, TEX_H = 450, 900        # 1 px/mm across a door (450.5 mm); stretched up the door (no fall top to bottom)


def band_profile(src, door, w):
    g = np.asarray(Image.open(os.path.join(SRC, src)).convert("L")).astype(np.float32)
    (x0, x1), rows = DOORS[door]
    p = np.concatenate([g[a:b, x0:x1] for a, b in rows], 0).mean(0)
    k = np.exp(-0.5 * (np.arange(-12, 13) / 4.0) ** 2); k /= k.sum()
    p = np.convolve(np.pad(p, 12, mode="edge"), k, "same")[12:-12]
    # the clean columns stand for mm across the door (the left door spans 0..450.5 mm of the body, the right one
    # 458.5..909); hold the ends flat to the door's edges
    xs = (np.arange(x0, x1) - 372.5) / 0.5633 - (0 if door == "l" else 458.5)
    p = np.interp(np.linspace(0, 450.5, w), xs, p)
    return p / p.mean()


def brushed(colour, door, seed):
    c = COLOURS[colour]
    rng = np.random.default_rng(seed)
    w, h = TEX_W, TEX_H
    fine = rng.normal(0, 1, (h, w // 40 + 2))
    fine = np.asarray(Image.fromarray(((fine + 4) * 30).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 30 - 4
    shade = 1 + c["bands"] * (band_profile(c["src"], door, w)[None, :] - 1)
    amp = 1.0 if colour == "rs" else 0.6
    v = (c["base"][door] + amp * fine) * shade
    v = np.repeat(v[..., None], 3, 2)
    return Image.fromarray(v.clip(0, 255).astype(np.uint8))


def font(face, px, path=AVENIR):
    return ImageFont.truetype(path, int(px), index=face)


def ink(text, face, px, path=AVENIR, spacing=0.0):
    """the text's alpha, cropped to its ink; spacing adds that share of px between letters"""
    f = font(face, px, path)
    img = Image.new("L", (int(px * (0.9 + spacing) * len(text) + px * 2), int(px * 2.2)), 0)
    d = ImageDraw.Draw(img)
    if spacing:
        x = px * 0.5
        for ch in text:
            d.text((x, px * 1.6), ch, font=f, fill=255, anchor="ls")
            x += d.textlength(ch, font=f) + spacing * px
    else:
        d.text((px * 0.5, px * 1.6), text, font=f, fill=255, anchor="ls")
    a = np.asarray(img)
    ys, xs = np.where(a > 4)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def decal(alpha, colour):
    """an RGBA decal: colour where alpha, a 2 px colour fringe so the edge never blends to black"""
    a = alpha.convert("L")
    rgb = Image.new("RGB", a.size, colour)
    out = rgb.copy(); out.putalpha(a)
    return out


# ── the Whirlpool mark (right fridge door; 69 mm wide on the front: columns 815.5-854.5) ──
def logo():
    os.makedirs(WORK, exist_ok=True)
    png = os.path.join(WORK, "logo_3000.png")
    if not os.path.exists(png):
        subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"),
                        os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"), png, "3000"], check=True, capture_output=True)
    lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
    a, rgb = lg[..., 3] / 255, lg[..., :3]
    gold = (rgb[..., 0] - rgb[..., 2]) > 60
    cols = np.where((a > 0.1).any(0))[0]
    gaps = np.where(np.diff(cols) > 8)[0]            # drop the registered mark (the photo's is too small to read)
    right = cols[gaps[-1]] + 1 if len(gaps) else cols[-1] + 1
    ys = np.where((a[:, :right] > 0.1).any(1))[0]
    a, gold = a[ys.min():ys.max() + 1, cols[0]:right], gold[ys.min():ys.max() + 1, cols[0]:right]
    W = int(69 * 8)                                   # 8 px/mm
    Hh = int(round(a.shape[0] * W / a.shape[1]))
    A = Image.fromarray((a * 255).astype(np.uint8)).resize((W, Hh), Image.LANCZOS)
    G = Image.fromarray((gold * 255).astype(np.uint8)).resize((W, Hh), Image.LANCZOS)
    g = np.asarray(G).astype(np.float32)[..., None] / 255
    col = (1 - g) * np.array(WHITE, np.float32) + g * np.array((214, 165, 52), np.float32)
    out = np.dstack([col, np.asarray(A)]).clip(0, 255).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(os.path.join(OUT, "logo.png"), optimize=True)
    return W / 8, Hh / 8


# ── the 6th Sense mark (left fridge door; 19 x 24 mm on the 3/4 photos, ESTIMATED): "6" in Baskerville with "th", and
# "sense" under it in Avenir bold italic, as on Whirlpool's other panels ──
def sixth():
    k = 12                                            # px/mm
    W, Hh = int(20 * k), int(25 * k)
    img = Image.new("L", (W, Hh), 0)

    def put(s, face, box, path=AVENIR):
        x0, y0, x1, y1 = [v * k for v in box]
        a = ink(s, face, 300, path)
        sc = min((x1 - x0) / a.width, (y1 - y0) / a.height)
        a = a.resize((max(1, int(a.width * sc)), max(1, int(a.height * sc))), Image.LANCZOS)
        img.paste(255, (int((x0 + x1) / 2 - a.width / 2), int((y0 + y1) / 2 - a.height / 2)), a)
    put("6", 4, (3.0, 1.0, 15.0, 17.5), BASK)
    put("th", BOLDI, (14.0, 0.5, 19.5, 5.0))
    put("sense", BOLDI, (1.5, 18.5, 18.5, 24.0))
    decal(img, WHITE).save(os.path.join(OUT, "sixth.png"), optimize=True)


# ── the door display: 64 x 250 mm of black glass on the left fridge door's inner edge. The layout is read off
# reasons_panel.jpg (the panel's left edge at column 915, its right at 1033: 0.545 mm per px, both ways) and laid 35 mm
# under the panel's top (the open photo puts the print in the panel's upper half) ──
PANEL_MM = (64.0, 250.0)
MMPX = 0.545
def P(xp, yp):
    return ((xp - 915) * MMPX, 35 + (yp - 238) * MMPX)


class Panel:
    def __init__(self):
        self.k = PX_MM * SS
        self.w, self.h = int(PANEL_MM[0] * self.k), int(PANEL_MM[1] * self.k)
        self.img = Image.new("RGB", (self.w, self.h), GLASS)
        self.d = ImageDraw.Draw(self.img)

    def paste(self, a, colour, x, y):
        layer = Image.new("RGB", a.size, colour)
        self.img.paste(layer, (int(round(x * self.k)), int(round(y * self.k))), a)

    def text(self, s, face, cap_mm, x, yc, anchor="l", colour=WHITE):
        probe = ink("H", face, 200)
        px = 200 * cap_mm * self.k / probe.height
        capH = probe.height * px / 200
        f = font(face, px)
        B = int(px * 1.6)
        img = Image.new("L", (int(px * 0.8 * len(s) + px * 2), int(px * 2.4)), 0)
        ImageDraw.Draw(img).text((px * 0.5, B), s, font=f, fill=255, anchor="ls")
        arr = np.asarray(img)
        ys, xs = np.where(arr > 4)
        a = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        above = (B - capH) - ys.min()
        wmm = a.width / self.k
        x0 = {"l": x, "r": x - wmm, "c": x - wmm / 2}[anchor]
        self.paste(a, colour, x0, yc - capH / self.k / 2 - above / self.k)
        return wmm

    def box(self, x0, y0, x1, y1, r=0.6, w=0.3, fill=None, colour=(205, 205, 208)):
        k = self.k
        self.d.rounded_rectangle([x0 * k, y0 * k, x1 * k, y1 * k], radius=r * k, outline=colour, width=max(1, int(w * k)), fill=fill)

    def line(self, pts, w=0.3, colour=WHITE):
        self.d.line([(x * self.k, y * self.k) for x, y in pts], fill=colour, width=max(1, int(w * self.k)))

    def seg(self, s, x0, y0, dh, colour=(250, 250, 250)):
        """seven-segment digits, each dh tall, from (x0, y0): hexagonal bars, t = 0.21 w"""
        k = self.k
        segs = {"2": "abged", "-": "g", "0": "abcdef"}
        dw = dh * 0.36
        t = 0.21 * dw
        g = 0.62 * t
        x = x0
        for ch in s:
            on = segs.get(ch, "")
            def bar(xa, ya, xb, yb):
                if ya == yb:
                    pts = [(xa + g, ya), (xa + g + t / 2, ya - t / 2), (xb - g - t / 2, ya - t / 2), (xb - g, ya), (xb - g - t / 2, ya + t / 2), (xa + g + t / 2, ya + t / 2)]
                else:
                    pts = [(xa, ya + g), (xa + t / 2, ya + g + t / 2), (xa + t / 2, yb - g - t / 2), (xa, yb - g), (xa - t / 2, yb - g - t / 2), (xa - t / 2, ya + g + t / 2)]
                self.d.polygon([(px * k, py * k) for px, py in pts], fill=colour)
            yA, yG, yD = y0, y0 + dh / 2, y0 + dh
            L, R = x, x + dw
            pos = {"a": (L, yA, R, yA), "g": (L, yG, R, yG), "d": (L, yD, R, yD),
                   "f": (L, yA, L, yG), "b": (R, yA, R, yG), "e": (L, yG, L, yD), "c": (R, yG, R, yD)}
            for sname in on:
                bar(*pos[sname])
            x += dw + dh * 0.2

    def lock(self, cx, cy, s=1.0):
        k = self.k
        self.d.rounded_rectangle([(cx - 1.0 * s) * k, (cy - 0.2 * s) * k, (cx + 1.0 * s) * k, (cy + 1.4 * s) * k], radius=0.2 * k, fill=WHITE)
        self.d.arc([(cx - 0.65 * s) * k, (cy - 1.3 * s) * k, (cx + 0.65 * s) * k, (cy + 0.1 * s) * k], 180, 360, fill=WHITE, width=max(1, int(0.28 * s * k)))
        self.d.line([((cx - 0.65 * s) * k, (cy - 0.6 * s) * k), ((cx - 0.65 * s) * k, (cy - 0.1 * s) * k)], fill=WHITE, width=max(1, int(0.28 * s * k)))
        self.d.line([((cx + 0.65 * s) * k, (cy - 0.6 * s) * k), ((cx + 0.65 * s) * k, (cy - 0.1 * s) * k)], fill=WHITE, width=max(1, int(0.28 * s * k)))

    def draw(self):
        cap = 1.75                                  # the mode words' capitals ("Auto Mode" spans 12 mm on the close-up)
        xr = P(956.5, 0)[0]
        for yp, s in [(243, "Auto Mode"), (251.5, "Quick Chill"), (260, "Fast Ice"), (268.5, "Eco Mode"), (277, "Vacation"),
                      (296, "Groceries"), (305.5, "Beverages"), (314.5, "Soft Freeze")]:
            y = P(0, yp)[1]
            self.text(s, MED, cap, xr, y, "r", colour=(214, 214, 218))
            self.box(xr + 0.8, y - 0.35, xr + 3.4, y + 0.35, r=0.2, w=0.0, fill=(150, 150, 154), colour=(150, 150, 154))
        # the four keys: an outlined square each (TEMP. CONTROL a tall one), the label to the right
        kx0, kx1 = P(978, 0)[0], P(997, 0)[0]
        keys = [(252, 275, "EXPERT"), (298, 320, "CONVERT"), (342, 363, "ZONE"), (390, 460, None)]
        for ya, yb, lab in keys:
            y0, y1 = P(0, ya)[1], P(0, yb)[1]
            self.box(kx0, y0, kx1, y1, r=0.7, w=0.32)
            if lab:
                self.text(lab, DEMI, 2.3, P(1000.5, 0)[0], (y0 + y1) / 2 + 0.4 if lab != "ZONE" else P(0, 349)[1], "l")
        self.text("2 sec", DEMI, 1.6, P(1004.5, 0)[0], P(0, 358)[1], "l")
        self.lock(P(1001.5, 0)[0], P(0, 357.6)[1], 0.75)
        self.text("TEMP.", DEMI, 2.3, P(1000.5, 0)[0], P(0, 418)[1], "l")
        self.text("CONTROL", DEMI, 2.3, P(1000.5, 0)[0], P(0, 426)[1], "l")
        cx = (kx0 + kx1) / 2
        yp_, ym_ = P(0, 401)[1], P(0, 447)[1]
        self.line([(cx - 2.1, yp_), (cx + 2.1, yp_)], 0.32); self.line([(cx, yp_ - 2.1), (cx, yp_ + 2.1)], 0.32)
        self.line([(cx - 2.1, ym_), (cx + 2.1, ym_)], 0.32)
        # the key icons: EXPERT three rings with a line each, CONVERT the cabinet split with a small lit box, ZONE two
        # triangles
        ey = (P(0, 252)[1] + P(0, 275)[1]) / 2
        for j in (-1, 0, 1):
            y = ey + j * 2.0
            self.d.ellipse([(cx - 2.6) * self.k, (y - 0.6) * self.k, (cx - 1.4) * self.k, (y + 0.6) * self.k], outline=WHITE, width=int(0.26 * self.k))
            self.line([(cx - 0.9, y), (cx + 2.4, y)], 0.3)
        cy = (P(0, 298)[1] + P(0, 320)[1]) / 2
        self.box(cx - 2.4, cy - 4.0, cx + 2.4, cy + 4.0, r=0.4, w=0.28, colour=WHITE)
        self.line([(cx, cy - 4.0), (cx, cy + 4.0)], 0.28)
        self.box(cx + 0.6, cy + 1.2, cx + 1.9, cy + 2.6, r=0.1, w=0.0, fill=WHITE, colour=WHITE)
        zy = (P(0, 342)[1] + P(0, 363)[1]) / 2
        k = self.k
        self.d.polygon([(cx * k, (zy - 3.8) * k), ((cx - 2.0) * k, (zy - 0.6) * k), ((cx + 2.0) * k, (zy - 0.6) * k)], outline=WHITE, width=int(0.28 * k))
        self.d.polygon([(cx * k, (zy + 3.8) * k), ((cx - 2.0) * k, (zy + 0.6) * k), ((cx + 2.0) * k, (zy + 0.6) * k)], outline=WHITE, width=int(0.28 * k))
        # the zone map: an outline, the upper compartment lit, two small boxes under it
        (mx0, my0), (mx1, my1) = P(945, 335), P(963, 365)
        self.box(mx0, my0, mx1, my1, r=0.3, w=0.32, colour=WHITE)
        self.box(mx0 + 1.0, my0 + 1.0, mx1 - 1.0, my0 + 0.62 * (my1 - my0), r=0.1, w=0.0, fill=(200, 200, 204), colour=(200, 200, 204))
        sy0, sy1 = my0 + 0.68 * (my1 - my0), my1 - 1.0
        midx = (mx0 + mx1) / 2
        self.box(mx0 + 1.0, sy0, midx - 0.4, sy1, r=0.1, w=0.28, colour=WHITE)
        self.box(midx + 0.4, sy0, mx1 - 1.0, sy1, r=0.1, w=0.28, colour=WHITE)
        # lock, M and degrees above the display
        self.lock(P(955, 0)[0], P(0, 386.5)[1], 0.9)
        self.text("M", DEMI, 1.9, P(955, 0)[0], P(0, 399)[1], "c")
        self.text("°C", DEMI, 1.9, P(955, 0)[0], P(0, 412)[1], "c")
        # the reading: -22 (degrees) as the close-up shows it
        self.seg("-22", P(930, 0)[0], P(0, 431)[1], 15.5)

    def save(self, path):
        self.img.resize((int(PANEL_MM[0] * PX_MM), int(PANEL_MM[1] * PX_MM)), Image.LANCZOS).save(path, quality=90, optimize=True)


# ── the back panel's prints, cut from Whirlpool's own artwork of the mark (the gold overlay on the front render:
# the mark at columns 435-573, rows 324-395; "TRIPLE COOLING" at 398-607, rows 408-418), recoloured to the panel's grey ──
def overlay_prints():
    im = np.asarray(Image.open(os.path.join(SRC, "front_rs.jpg")).convert("RGB")).astype(np.float32)
    for name, (x0, x1, y0, y1) in (("print_360", (431, 578, 320, 399)), ("print_triple", (394, 611, 404, 422))):
        c = im[y0:y1, x0:x1]
        gold = np.clip(((c[..., 0] - c[..., 2]) - 12) / 50, 0, 1)
        a = Image.fromarray((gold * 255).astype(np.uint8)).resize(((x1 - x0) * 4, (y1 - y0) * 4), Image.LANCZOS)
        a = a.filter(ImageFilter.GaussianBlur(0.8)).point(lambda v: 255 if v > 150 else int(v * 255 / 150))
        decal(a, (122, 124, 128)).save(os.path.join(OUT, name + ".png"), optimize=True)


def arctic():
    a = ink("ARCTIC FREEZE", MED, 160, spacing=0.55)
    decal(a, (128, 130, 134)).save(os.path.join(OUT, "print_arctic.png"), optimize=True)


# ── the line icons on the crisper fronts and the lower drawers (white outlines), lifted off open_rs.jpg ──
def icons():
    im = np.asarray(Image.open(os.path.join(SRC, "open_rs.jpg")).convert("L")).astype(np.float32)
    for name, (x0, x1, y0, y1), light in (("icons_crisper", (512, 562, 532, 553), True), ("icons_drawer", (508, 556, 893, 903), True)):
        c = im[y0:y1, x0:x1]
        bg = np.median(c)
        v = (c - bg) if light else (bg - c)
        a = np.clip((v - 6) / 30, 0, 1)
        A = Image.fromarray((a * 255).astype(np.uint8)).resize(((x1 - x0) * 6, (y1 - y0) * 6), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
        decal(A, (250, 250, 252) if light else (96, 98, 102)).save(os.path.join(OUT, name + ".png"), optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for c in COLOURS:
        for door, seed in (("l", 11), ("r", 12)):
            brushed(c, door, seed + (0 if c == "rs" else 10)).save(os.path.join(OUT, f"door_{door}_{c}.jpg"), quality=88, optimize=True, subsampling=0)
    print("logo mm", logo())
    sixth()
    p = Panel(); p.draw(); p.save(os.path.join(OUT, "panel.jpg"))
    overlay_prints()
    arctic()
    icons()
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)))


if __name__ == "__main__":
    main()
