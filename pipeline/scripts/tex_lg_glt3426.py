"""Textures for the LG GLT3426SNPZ double-door refrigerator (Shiny Steel, 251 L).

usage: python tex_lg_glt3426.py <photos dir> <logos dir> <out dir>
  photos: lg_glt3426/2010x1334-2-v.jpg (the energy label), lg_glt3426/DZ-12.jpg (rear), DZ-04.jpg (side)
  logos:  lg.png
  writes <out dir>/lg_glt3426/*.jpg|png

Steel: the real doors are PET film printed to look like steel, a soft vertical grain on a mid silver (about 176 grey).
The model's own lighting does the shading, so the texture holds only the grain, not the photo's studio gradient.
Printed items are separate small decals so each stays crisp: the energy label (LG's own copy for this model), the LG mark,
the "Convertible" and "Fresh Zone" prints inside, the dial scale, and the labels on the stocked food (plain words, no brands).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
D = os.path.join(OUT, "lg_glt3426")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(26)
FONT = "/System/Library/Fonts/Avenir Next.ttc"


def tex_lg_mark_hi(logos, w):
    # LG's vector mark drawn sharp (tex_lg_mark.py): 680 px across a 48-55 mm decal is 12-14 px per mm (logos/lg.png's 349 gave 6-7)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import tex_lg_mark
    return tex_lg_mark.lg_hi(logos, w)


def font(px, face=7):
    return ImageFont.truetype(FONT, px, index=face)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def steel(w, h, base=(157, 157, 158), grain=0.85):
    """Vertical-grain brushed silver: long streaks, faint."""
    n = rng.normal(0, 1, (1, w // 2 + 1))
    n = np.repeat(n, h, axis=0)
    n = np.repeat(n, 2, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((1.2, 40)))
    a = (np.asarray(img).astype(float) / 255 - 0.5) * 2 * grain * 2
    a += rng.normal(0, 0.6, (h, w))
    # the studio shading of LG's photo: light across the top and middle, falling to about 80% at the foot, a little darker at both edges
    yy = np.linspace(0, 1, h)[:, None]
    xx = np.linspace(-1, 1, w)[None, :]
    shade = 1.02 - 0.22 * np.clip((yy - 0.55) / 0.45, 0, 1) ** 1.5 - 0.05 * np.abs(xx) ** 2
    out = np.stack([(np.full((h, w), base[0]) + a) * shade, (np.full((h, w), base[1]) + a) * shade, (np.full((h, w), base[2]) + a) * shade], axis=2)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def main():
    # ── doors: 1.5 px per mm ──
    save(steel(420, 376), "door_freezer.jpg", 86)
    save(steel(420, 806), "door_fridge.jpg", 86)
    side = steel(355, 860, base=(150, 150, 151))
    d = ImageDraw.Draw(side)
    save(side, "side.jpg", 86)
    save(steel(355, 860, base=(150, 150, 151)), "side_l.jpg", 86)

    # ── energy label (LG's copy for GLT252, 251 L, 233 units/yr) ──
    src = Image.open(os.path.join(PHOTOS, "lg_glt3426", "2010x1334-2-v1.jpg")).convert("RGB")
    sa = np.asarray(src).astype(int)
    ys_, xs_ = np.where((sa.sum(2) < 735) & (np.arange(sa.shape[1])[None, :] < 1000))
    lab = src.crop((xs_.min() + 6, ys_.min() + 6, xs_.max() - 4, ys_.max() - 4))
    # round the pink halo off: keep the die-cut shape, white outside
    # die-cut: everything light that touches the border (white and the pink halo) is transparent
    from collections import deque
    lab = lab.convert("RGBA")
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g, bl, _ = px[x, y]
        if min(r, g, bl) < 205 and not (r > 235 and g < 215):           # a darker colour (not the pink halo) ends the fill
            continue
        seen[y, x] = True
        px[x, y] = (r, g, bl, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = lab.getchannel("A")
    lab = lab.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")   # flat printed colours: 64 are enough
    lab.putalpha(alpha)
    save(lab, "label.png")

    # ── LG mark: grey disc and wordmark as printed on the freezer door (dark on steel) ──
    lg = tex_lg_mark_hi(LOGOS, 680)
    a = np.asarray(lg).astype(float)
    a[..., 3] *= 1 - np.clip((a[..., :3].min(2) - 150) / 70, 0, 1)   # the face lines inside the disc are cut out, as on LG's photos
    mark = np.zeros(a.shape, np.uint8)
    lum = a[..., :3].mean(axis=2)
    mark[..., :3] = (84, 86, 90)
    mark[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(mark), "lgmark.png")

    # ── rear: LG's rear photo as the back panel ──
    rear = Image.open(os.path.join(PHOTOS, "lg_glt3426", "DZ-12.jpg")).convert("RGB")
    a = np.asarray(rear).astype(int)
    ys, xs = np.where(a.sum(2) < 735)
    r = rear.crop((xs.min() + 2, ys.min() + 2, xs.max() - 1, ys.max() - 1))
    r = r.resize((r.width * 3 // 4, r.height * 3 // 4), Image.LANCZOS)
    save(r, "rear.jpg", 84)
    print("rear px", r.size)

    # ── interior prints, 12 px per mm on the model (LG's open photo DZ-04: the words and their weights) ──
    K = 12

    def spun(w_mm, h_mm, cu, cv, k=K):
        """Brushed steel spun round one centre (cu, cv as fractions of the plate), the light falling in two broad lobes
        as on LG's photo; the rings are fine (about 0.7 mm) and soft."""
        w, h = round(w_mm * k), round(h_mm * k)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        dx, dy = (xx - cu * w) / k, (yy - cv * h) / k               # mm from the spin centre
        r, th = np.hypot(dx, dy), np.arctan2(dy, dx)
        v = 176 + 30 * np.sin(2 * th + 0.9) * (1 - np.exp(-r / 6)) + 5 * np.cos(r * 2 * np.pi / 0.7) * np.exp(-r / 120)
        v += rng.normal(0, 1.6, v.shape)
        return np.stack([v, v, v + 2], axis=2)

    def plate(w_mm, h_mm, cu, cv):
        a = spun(w_mm, h_mm, cu, cv)
        im = Image.fromarray(a.clip(0, 255).astype(np.uint8))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, im.width - 1, im.height - 1], round(2.5 * K), outline=(132, 134, 138), width=round(0.5 * K))
        return im, d

    def words(d, parts, cx, cy, cap_mm, colour, w_img):
        """parts = [(text, face)] on one line, centred at (cx, cy) px, cap height cap_mm"""
        probe = font(200, parts[0][1])
        l, t, r, b = d.textbbox((0, 0), "H", font=probe)
        px = round(200 * cap_mm * K / (b - t))
        fs = [font(px, f) for _, f in parts]
        ws = [d.textlength(tx, font=f) for (tx, _), f in zip(parts, fs)]
        x = cx - sum(ws) / 2
        for (tx, _), f, wd in zip(parts, fs, ws):
            d.text((x, cy), tx, font=f, fill=colour, anchor="lm")
            x += wd

    # the freezer's back-wall plate: "Convertible" in black on steel spun round a centre right of the middle (166 x 77 mm)
    im, d = plate(166, 77, 0.66, 0.30)
    words(d, [("Convertible", 2)], im.width / 2, im.height * 0.50, 9.8, (34, 36, 40), im.width)   # 0.47 of the plate wide, as on the photo
    save(im, "plate_convertible.jpg", 90)
    # the fridge's control plate (162 x 72 mm): steel spun round the dial; the dial's black ring (56 mm across), its spun face,
    # the light dots over and under it. The small words round the dial and on its face can't be read on any photo; the
    # Min and Max of the earlier drawing are kept where it had them (not confirmed on a source)
    im, d = plate(162, 72, 0.5, 0.5)
    cx, cy, R = im.width / 2, im.height / 2, 27.8 * K
    face = Image.fromarray(spun(2 * 26.6, 2 * 26.6, 0.5, 0.5).clip(0, 255).astype(np.uint8))
    m = Image.new("L", face.size, 0)
    ImageDraw.Draw(m).ellipse([0, 0, face.width - 1, face.height - 1], fill=255)
    im.paste(face, (round(cx - face.width / 2), round(cy - face.height / 2)), m)
    d = ImageDraw.Draw(im)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(30, 32, 36), width=round(1.3 * K))
    for sy in (-1, 1):
        y = cy + sy * (R + 3.0 * K)
        d.ellipse([cx - 0.9 * K, y - 0.9 * K, cx + 0.9 * K, y + 0.9 * K], fill=(236, 238, 240))
    for tx, sx, anchor in (("Min", -1, "rm"), ("Max", 1, "lm")):
        d.text((cx + sx * (R + 4 * K), cy + R * 0.6), tx, font=font(round(3.2 * K), 7), fill=(70, 72, 76), anchor=anchor)
    save(im, "plate_control.jpg", 90)

    def tray_print(name, w_mm, h_mm, lines):
        """Words printed on a clear tray (transparent decal); lines = [(parts, centre y fraction, cap mm, colour)]"""
        im = Image.new("RGBA", (round(w_mm * K), round(h_mm * K)), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for parts, fy, cap, col in lines:
            words(d, parts, im.width / 2, im.height * fy, cap, col, im.width)
        save(im, name)
    # the builder lays these 170 mm wide; sizes and places as the earlier drawing had them, the weights as on LG's photo
    # (Fresh 0 / Fresh / Pull-out bold, Zone / Tray and the second lines regular)
    tray_print("print_fresh0.png", 170, 37.8, [([("Fresh 0 ", 2), ("Zone", 7)], 0.35, 8.6, (60, 62, 66, 255)),
                                              ([("Fresh & Cool", 7)], 0.675, 4.6, (96, 98, 104, 255))])
    tray_print("print_pullout.png", 170, 22.7, [([("Pull-out ", 2), ("Tray", 7)], 0.5, 7.2, (60, 62, 66, 255))])
    tray_print("print_freshzone.png", 170, 44.2, [([("Fresh ", 2), ("Zone", 7)], 0.364, 8.8, (60, 62, 66, 255)),
                                                 ([("Fruit & Vegetables", 7)], 0.68, 4.8, (96, 98, 104, 255))])
    # the knob top
    k = Image.new("RGB", (256, 256), (235, 236, 238))
    d = ImageDraw.Draw(k)
    d.ellipse([8, 8, 248, 248], outline=(170, 172, 176), width=10)
    d.line([(128, 128), (128, 26)], fill=(60, 62, 66), width=14)
    save(k, "knob.jpg")
    # "Fresh Zone" on the white front of the vegetable drawer
    img = Image.new("RGB", (900, 220), (247, 248, 250))
    d = ImageDraw.Draw(img)
    d.text((450, 110), "Fresh Zone", font=font(50, 5), fill=(96, 99, 106), anchor="mm")
    save(img, "fresh_zone.jpg")
    # the egg-basket's six cups are geometry; the cold-air louvre strip is a texture
    # ── labels for the stocked food: plain words ──
    def label(name, lines, bg, fg, size=(512, 256), icon=None):
        im = Image.new("RGB", size, bg)
        d = ImageDraw.Draw(im)
        y = size[1] // (len(lines) + 1)
        for i, (txt, px, face) in enumerate(lines):
            d.text((size[0] // 2, y * (i + 1)), txt, font=font(px, face), fill=fg, anchor="mm")
        save(im, name, 90)
    label("lbl_curd.jpg", [("CURD", 120, 0), ("fresh set curd", 48, 7)], (240, 244, 250), (28, 78, 150))
    label("lbl_idli.jpg", [("IDLI", 120, 0), ("BATTER", 78, 0)], (255, 245, 214), (150, 60, 20))
    label("lbl_dosa.jpg", [("DOSA", 120, 0), ("BATTER", 78, 0)], (250, 232, 190), (120, 70, 20))
    label("lbl_ghee.jpg", [("GHEE", 130, 0), ("pure cow ghee", 48, 7)], (255, 236, 160), (110, 60, 10))
    label("lbl_coffee.jpg", [("FILTER", 100, 0), ("COFFEE", 100, 0), ("decoction", 44, 7)], (62, 36, 22), (245, 220, 180), (512, 320))
    label("lbl_pickle.jpg", [("PICKLE", 120, 0), ("mango", 52, 7)], (196, 52, 40), (255, 240, 220))
    label("lbl_milk.jpg", [("MILK", 150, 0), ("toned  500 ml", 50, 7)], (232, 242, 252), (30, 80, 160), (512, 320))
    label("lbl_butter.jpg", [("BUTTER", 90, 0), ("salted", 44, 7)], (255, 218, 80), (140, 30, 20), (400, 200))
    label("lbl_paneer.jpg", [("PANEER", 96, 0)], (250, 250, 244), (70, 110, 70), (400, 200))
    label("lbl_icecream.jpg", [("ICE CREAM", 70, 0), ("chocolate", 48, 7)], (120, 62, 36), (255, 238, 214), (512, 256))
    label("lbl_icecream2.jpg", [("ICE CREAM", 70, 0), ("vanilla", 48, 7)], (246, 232, 190), (170, 40, 36), (512, 256))
    label("lbl_peas.jpg", [("GREEN PEAS", 60, 0), ("frozen", 44, 7)], (58, 150, 70), (255, 255, 255), (400, 300))
    label("lbl_parotta.jpg", [("PAROTTA", 72, 0), ("frozen", 44, 7)], (232, 160, 70), (90, 36, 10), (400, 300))
    label("lbl_mixveg.jpg", [("MIXED VEG", 66, 0), ("frozen", 44, 7)], (232, 112, 40), (255, 255, 255), (400, 300))
    label("lbl_corn.jpg", [("SWEET CORN", 60, 0), ("frozen", 44, 7)], (244, 200, 40), (90, 60, 10), (400, 300))
    label("lbl_sambar.jpg", [("SAMBAR", 100, 0)], (214, 214, 218), (60, 60, 64), (400, 200))
    # ── soft-drink cans and 2 L bottles: wraps for the cylinder, the name centred on the front (u = 0.5) ──
    AV = "/System/Library/Fonts/Avenir Next.ttc"
    def wrap(name, size, bg, text, fg, face, px, stripes=(), sub=None):
        im = Image.new("RGB", size, bg)
        d = ImageDraw.Draw(im)
        for y0, y1, c in stripes:
            d.rectangle((0, round(size[1] * y0), size[0], round(size[1] * y1)), fill=c)
        f = ImageFont.truetype(AV, px, index=face)
        d.text((size[0] // 2, size[1] // 2), text, font=f, fill=fg, anchor="mm")
        if sub:
            d.text((size[0] // 2, round(size[1] * 0.66)), sub, font=ImageFont.truetype(AV, round(px * 0.34), index=0), fill=fg, anchor="mm")
        save(im, name, 90)
    for nm, bg, tx, fg, face, st, sub in [
        ("can_coke", (206, 24, 32), "Coca-Cola", (255, 255, 255), 1, [(0.0, 0.07, (240, 240, 240)), (0.93, 1.0, (240, 240, 240))], None),
        ("can_fanta", (242, 122, 18), "FANTA", (255, 255, 255), 9, [(0.0, 0.07, (36, 78, 160)), (0.93, 1.0, (36, 78, 160))], "ORANGE"),
        ("can_thumsup", (24, 24, 30), "THUMS UP", (230, 36, 36), 9, [(0.0, 0.07, (230, 36, 36)), (0.93, 1.0, (230, 36, 36))], None),
        ("can_sprite", (14, 150, 72), "SPRITE", (255, 255, 255), 9, [(0.0, 0.07, (255, 224, 40)), (0.93, 1.0, (255, 224, 40))], "LEMON-LIME")]:
        wrap(nm + ".jpg", (1024, 600), bg, tx, fg, face, 120, st, sub)
    wrap("bottle_coke.jpg", (1024, 400), (206, 24, 32), "Coca-Cola", (255, 255, 255), 1, 110, [], "2.25 L")
    wrap("bottle_fanta.jpg", (1024, 400), (242, 122, 18), "FANTA", (255, 255, 255), 9, 120, [], "ORANGE  2.25 L")
    # coconut and watermelon skins, vegetables: plain colours in the builder


main()
