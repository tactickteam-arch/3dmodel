"""Textures for the LG GL-B257JDS3 side-by-side refrigerator (650 L, Dazzle Steel).

usage: python3 tex_lg_glb257.py <photos dir> <logos dir> <out dir>
  photos: lg_glb257/energy_label.jpg (LG's energy-label image for this model), lg_glb257/dz-15.jpg (LG's rear photo)
  logos:  lg.png
  writes <out dir>/lg_glb257/*.jpg|png

Doors: LG lists the doors as PET in Dazzle Steel: a dark grey steel print with fine horizontal brushing (LG's close-up
dz-12) under a glossy film. The texture holds the colour, long horizontal streaks and part of the studio fall LG's
front photo shows (brightest about a third of the way down, darker at the foot); the hairline grain map adds the fine
lines. Print is redrawn: the LG mark from the brand logo, the energy label as a die-cut crop of LG's own label for
this model (it names GL-B257JDS3), and the words LG prints inside ("Convertible", "Multi Air Flow", "Fresh Zone /
Fruit & Vegetables", "Freezing Zone / Fish & Meat") set again in PT Sans, the closest system face to LG's.
"""
import os
import sys

sys.path.append("/Users/apple/Library/Python/3.9/lib/python/site-packages")
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "lg_glb257")
D = os.path.join(OUT, "lg_glb257")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(257)
PT = "/System/Library/Fonts/Supplemental/PTSans.ttc"


def pt(px, bold=False):
    return ImageFont.truetype(PT, px, index=7 if bold else 0)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def dazzle(w, h, door_mm, base=(122, 122, 126), grain=1.0):
    """Horizontal-grain dark steel for one door, w x h px over the door's full height door_mm.
    LG's straight front (front_label.jpg) is brightest about 0.37 of the way down and falls to about 0.55 of that at
    the foot and 0.75 at the top. The viewer's own light adds a fall too, so half of it is kept."""
    n = rng.normal(0, 1, (h // 2 + 1, 1))
    n = np.repeat(n, 2, axis=0)[:h]
    n = np.repeat(n, w, axis=1)
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((60, 0.8)))
    a = (np.asarray(img).astype(float) / 255 - 0.5) * 2 * grain * 2.2
    a += rng.normal(0, 0.7, (h, w))
    yy = np.linspace(0, 1, h)[:, None]
    xx = np.linspace(-1, 1, w)[None, :]
    photo = np.where(yy < 0.37, 0.75 + 0.25 * np.sin(np.clip(yy / 0.37, 0, 1) * np.pi / 2), 1 - 0.45 * np.clip((yy - 0.37) / 0.63, 0, 1) ** 1.15)
    # the render adds its own light on top, so the fall is tuned on renders against LG's front photo (ratios to the
    # label's white at 0.08, 0.2, 0.37, 0.6, 0.75 and 0.9 of the door's height: 0.49, 0.55, 0.60, 0.52, 0.43, 0.34,
    # the two doors averaged)
    tune = np.interp(yy, [0, 0.08, 0.2, 0.37, 0.6, 0.75, 0.9, 1], [0.84, 0.86, 0.92, 0.99, 0.94, 0.83, 0.70, 0.64]) ** 1.15
    shade = (0.5 + 0.5 * photo) * tune - 0.03 * np.abs(xx) ** 2
    out = np.stack([(np.full((h, w), c) + a) * shade for c in base], axis=2)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def main():
    # ── doors: the freezer door is 391 mm wide, the fridge door 516 mm, both 1768 mm tall ──
    save(dazzle(320, 1024, 1768), "door_freezer.jpg", 86)
    save(dazzle(420, 1024, 1768), "door_fridge.jpg", 86)

    # ── energy label: LG's own image for GL-B257JDS3 (552 units a year, 650 L), die-cut ──
    src = Image.open(os.path.join(SRC, "energy_label.jpg")).convert("RGB")
    sa = np.asarray(src).astype(int)
    m = sa.sum(2) < 735
    m[:, 1000:] = False
    ys_, xs_ = np.where(m)
    lab = src.crop((xs_.min() - 2, ys_.min() - 2, xs_.max() + 3, ys_.max() + 3))
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
        if min(r, g, bl) < 205:
            continue
        seen[y, x] = True
        px[x, y] = (r, g, bl, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = lab.getchannel("A").filter(ImageFilter.MinFilter(3))
    lab = lab.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    lab.putalpha(alpha)
    save(lab, "label.png")

    # ── LG mark: light silver on the dark door, as LG's front photo shows it (about 200 grey on a 99 door) ──
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    mark = np.zeros(a.shape, np.uint8)
    mark[..., :3] = (206, 208, 212)
    # the face drawn in white inside the disc is cut out, so the door shows through it as on LG's photos
    face = np.clip((a[..., :3].min(2) - 140) / 80, 0, 1)
    mark[..., 3] = (a[..., 3] * 0.95 * (1 - face)).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(mark), "lgmark.png")

    # ── rear: LG's rear photo of the cabinet back (0.66 px/mm), from the top edge to the bottom ──
    rear = Image.open(os.path.join(SRC, "dz-15.jpg")).convert("RGB")
    ra = np.asarray(rear).astype(int)
    nonwhite = ra.sum(2) < 735
    rows = [y for y in range(ra.shape[0]) if nonwhite[y].sum() > 550]
    cols = np.where(nonwhite[rows[0]:rows[-1]].any(0))[0]
    r = rear.crop((cols.min() + 1, rows[0] + 1, cols.max(), rows[-1] - 2))
    save(r, "rear.jpg", 84)
    print("rear crop rows", rows[0], rows[-1], "cols", cols.min(), cols.max())

    # ── words LG prints inside, as transparent decals (set in PT Sans; LG's own face is not available) ──
    ink = (52, 54, 58, 255)
    def words(name, parts, size, sub=None, px=110, subpx=46):
        im = Image.new("RGBA", size, (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        fonts = [pt(px, b) for _, b in parts]
        widths = [d.textlength(t, font=f) for (t, _), f in zip(parts, fonts)]
        gap = px * 0.26
        total = sum(widths) + gap * (len(parts) - 1)
        x = (size[0] - total) / 2
        y = size[1] * (0.42 if sub else 0.5)
        for (t, _), f, wd in zip(parts, fonts, widths):
            d.text((x, y), t, font=f, fill=ink, anchor="lm")
            x += wd + gap
        if sub:
            d.text((size[0] / 2, size[1] * 0.78), sub, font=pt(subpx), fill=(70, 72, 76, 255), anchor="mm")
        save(im, name)
    # 1.4 times the first draft, so every word is set at 7.6 to 8.6 px/mm on the model (sharp at the 4 degree close-up)
    k = 1.4
    sc = lambda wh: (round(wh[0] * k), round(wh[1] * k))
    words("print_convertible.png", [("Convertible", True)], sc((900, 200)), px=round(110 * k))
    words("print_multiairflow.png", [("Multi", True), ("Air Flow", False)], sc((1000, 200)), px=round(110 * k))
    words("print_freshzone.png", [("Fresh", True), ("Zone", False)], sc((900, 300)), "Fruit & Vegetables", round(96 * k), round(44 * k))
    words("print_freezingzone.png", [("Freezing", True), ("Zone", False)], sc((900, 300)), "Fish & Meat", round(96 * k), round(44 * k))


main()
