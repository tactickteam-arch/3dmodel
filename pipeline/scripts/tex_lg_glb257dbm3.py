"""Textures for the LG GL-B257DBM3 side-by-side refrigerator (650 L, glass doors) in its three colours:
Black Mirror (GL-B257DBM3), Linen White (GL-B257DLW3) and Linen Brown (GL-B257DLN3), LG's D series.

usage: python3 tex_lg_glb257dbm3.py <photos dir> <logos dir> <out dir>
  photos: lg_glb257dbm3/<colour>_energy_label.jpg (LG's energy-label image for each code), lg_glb257dbm3/dbm3_rear.jpg
  logos:  lg.png
  writes <out dir>/lg_glb257dbm3/*.jpg|png

Doors: LG lists the doors as glass. Black Mirror is a plain near-black glass; the two Linen colours have a fine linen
weave printed under the glass (LG's close-ups dlw3_handle.jpg and dln3_handle.jpg). The door texture is a 64 mm tile
the builder repeats across each door, so the weave keeps its real size at any distance: about 2.5 mm a thread, read off
LG's close-ups (about 3.5 px a thread at about 1.5 px/mm, ESTIMATED). The door colours are set as ratios to the
energy label's white on LG's straight front photos (Black Mirror 0.13, Linen White 0.90, Linen Brown 0.09, brown cast)
and then tuned on renders (NOTES.md).
Print is redrawn: the LG mark from the brand logo, each colour's own energy label as a die-cut crop of LG's image for
that code, and the words LG prints inside (Convertible, Fresh Zone, Freezing Zone, Hygiene Fresh+, Ice Maker, and the
fridge's internal display, laid out as LG's photo dln3_display.jpg and the owner's manual page 24 show it) set again in
PT Sans, the closest system face to LG's.
"""
import os
import sys
from collections import deque

sys.path.append("/Users/apple/Library/Python/3.9/lib/python/site-packages")
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "lg_glb257dbm3")
D = os.path.join(OUT, "lg_glb257dbm3")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(2573)
PT = "/System/Library/Fonts/Supplemental/PTSans.ttc"


def pt(px, bold=False):
    return ImageFont.truetype(PT, max(6, round(px)), index=7 if bold else 0)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", p, img.size)


# ── door tiles: 64 mm square at 8 px/mm, repeated by the builder ──
TILE_PX = 512


def plain(base, noise=0.6):
    """Plain glass: one colour with a faint noise so the JPEG holds no banding."""
    a = np.stack([np.full((128, 128), c, float) for c in base], 2) + rng.normal(0, noise, (128, 128, 1))
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def linen(base, thread, amp, slub=0.35):
    """A linen weave: 26 threads each way across the 64 mm tile (2.46 mm a thread), each thread a little lighter or
    darker than the next and uneven along its length (slubs), as LG's close-ups show it under the glass. `thread` is the
    colour the light threads move towards, `amp` how far (0..1)."""
    n = TILE_PX
    k = 26
    y = np.arange(n)[:, None] / n
    x = np.arange(n)[None, :] / n
    # each warp (vertical) and weft (horizontal) thread: its own brightness, varying slowly along it; the phase
    # (sin) gives the thread its rounded profile
    wv = rng.normal(0, 1, k)
    wf = rng.normal(0, 1, k)
    iv = np.floor(x * k).astype(int) % k
    ih = np.floor(y * k).astype(int) % k
    along_v = np.sin(2 * np.pi * (y * 3 + rng.random(k)[iv])) * slub
    along_h = np.sin(2 * np.pi * (x * 3 + rng.random(k)[ih])) * slub
    prof_v = 0.5 - 0.5 * np.cos(2 * np.pi * x * k)
    prof_h = 0.5 - 0.5 * np.cos(2 * np.pi * y * k)
    # over-under: where the warp is on top it shows, else the weft (checker of thread crossings)
    over = ((np.floor(x * k) + np.floor(y * k)) % 2 == 0)
    v = np.where(over, prof_v * (0.6 + 0.25 * wv[iv] + along_v), prof_h * (0.6 + 0.25 * wf[ih] + along_h))
    v = (v - v.min()) / (v.max() - v.min())
    v = v + rng.normal(0, 0.08, (n, n))
    v = np.asarray(Image.fromarray((v.clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255
    b = np.array(base, float)[None, None, :]
    t = np.array(thread, float)[None, None, :]
    out = b + (t - b) * (amp * v)[..., None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def lscale(img, k):
    """Scale an sRGB image's colour in linear light, per channel (k: three factors). On a metal door the texture is the
    reflection's tint, and the viewer's tone curve is steep in the blacks, so the colour is tuned this way on renders."""
    a = np.asarray(img).astype(float) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4) * np.array(k, float)[None, None, :]
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin.clip(0, 1), 1 / 2.4) - 0.055)
    return Image.fromarray((s * 255 + 0.5).clip(0, 255).astype(np.uint8))


def label(code):
    """The energy label from LG's image for this code, die-cut (flood-filled from the border) and reduced to 64 colours."""
    src = Image.open(os.path.join(SRC, f"{code}_energy_label.jpg")).convert("RGB")
    sa = np.asarray(src).astype(int)
    m = sa.sum(2) < 735
    m[:, 1000:] = False
    ys_, xs_ = np.where(m)
    lab = src.crop((xs_.min() - 2, ys_.min() - 2, xs_.max() + 3, ys_.max() + 3)).convert("RGBA")
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
    # 720 px tall, 4.3 px/mm on the 169 mm label: three labels (one per colour) must fit the GLB's budget; every line
    # still reads at the 4 degree close-up (REVIEW.md)
    size = (round(lab.width * 720 / lab.height), 720)
    alpha = alpha.resize(size, Image.LANCZOS).point(lambda v: 255 if v > 128 else 0)
    lab = lab.convert("RGB").resize(size, Image.LANCZOS)
    lab = lab.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    lab.putalpha(alpha)
    print(code, "label crop", lab.size)
    return lab


def mark(rgb):
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = rgb
    face = np.clip((a[..., :3].min(2) - 140) / 80, 0, 1)   # the face inside the disc is cut out, as on LG's photos
    out[..., 3] = (a[..., 3] * 0.95 * (1 - face)).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out)


INK = (52, 54, 58, 255)


def words(name, parts, size, sub=None, px=110, subpx=46, ink=INK, bg=None, sup=None):
    """Words set in PT Sans across a canvas (transparent unless bg), with an optional second line and superscript."""
    im = Image.new("RGBA", size, bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fonts = [pt(px, b) for _, b in parts]
    widths = [d.textlength(t, font=f) for (t, _), f in zip(parts, fonts)]
    gap = px * 0.26
    supw = d.textlength(sup, font=pt(px * 0.55)) if sup else 0
    total = sum(widths) + gap * (len(parts) - 1) + supw
    x = (size[0] - total) / 2
    y = size[1] * (0.42 if sub else 0.5)
    for (t, _), f, wd in zip(parts, fonts, widths):
        d.text((x, y), t, font=f, fill=ink, anchor="lm")
        x += wd + gap
    if sup:
        d.text((x - gap + px * 0.04, y - px * 0.28), sup, font=pt(px * 0.55, True), fill=ink, anchor="lm")
    if sub:
        d.text((size[0] / 2, size[1] * 0.78), sub, font=pt(subpx), fill=(70, 72, 76, 255), anchor="mm")
    return im


SEG = {"1": "bc", "3": "abgcd", "8": "abcdefg", "-": "g"}


def seven(dr, x, y, w, h, ch, fill, t):
    """A seven-segment digit in the box (x, y, w, h), bar width t, small gaps where the bars meet."""
    hh = h / 2
    g = t * 0.25
    seg = {"a": (x + g, y, x + w - g, y + t), "g": (x + g, y + hh - t / 2, x + w - g, y + hh + t / 2), "d": (x + g, y + h - t, x + w - g, y + h),
           "f": (x, y + g, x + t, y + hh - g), "b": (x + w - t, y + g, x + w, y + hh - g),
           "e": (x, y + hh + g, x + t, y + h - g), "c": (x + w - t, y + hh + g, x + w, y + h - g)}
    for s in SEG[ch]:
        dr.rounded_rectangle(seg[s], radius=t * 0.35, fill=fill)


def display():
    """The fridge's internal display (LG's photo dln3_display.jpg; the owner's manual, page 24, Wi-Fi panel): a white
    panel 70 x 220 mm (ESTIMATED from the photo against the shelf spacing), drawn at 7.2 px/mm. Rows as fractions of
    the panel's height, read off the photo: ThinQ 0.057, fridge temperature 0.12-0.21, freezer 0.23-0.31, then Fridge,
    Freezer / *Convertible, *Wi-Fi, Express Cool, Express Freeze, *Lock and "*Hold 3 seconds"."""
    S = 7.2
    W, H = 70.0, 220.0
    im = Image.new("RGB", (round(W * S), round(H * S)), (238, 240, 242))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle((1, 1, im.width - 2, im.height - 2), radius=round(3 * S), outline=(214, 217, 221), width=round(0.8 * S))
    ink = (86, 88, 92)
    seg = (150, 153, 158)      # the digits are unlit segments behind the glass, a light grey on the photo

    def text(s, yf, mm, bold=False, xc=0.5, fill=ink):
        f = pt(mm * S / 0.72, bold)   # PT Sans cap height is about 0.72 of the size
        dr.text((W * S * xc, H * S * yf), s, font=f, fill=fill, anchor="mm")
    text("ThinQ", 0.057, 3.4, True)
    # 3 °C and -18 °C, seven segments 13 mm tall
    dh, dw, t = 13.0 * S, 6.6 * S, 1.3 * S
    y1, y2 = H * S * 0.125, H * S * 0.235
    seven(dr, W * S * 0.52 - dw / 2, y1, dw, dh, "3", seg, t)
    seven(dr, W * S * 0.31 - dw / 2, y2, dw * 0.7, dh, "-", seg, t)
    seven(dr, W * S * 0.44 - dw / 2, y2, dw, dh, "1", seg, t)
    seven(dr, W * S * 0.58 - dw / 2, y2, dw, dh, "8", seg, t)
    for yy in (y1, y2):
        dr.text((W * S * 0.70, yy + 1.0 * S), "°C", font=pt(3.0 * S / 0.72), fill=seg, anchor="lt")
    rows = [("Fridge", 0.365), ("Freezer", 0.452), ("*Convertible", 0.482), ("*Wi-Fi", 0.556), ("Express Cool", 0.648),
            ("Express Freeze", 0.737), ("*Lock", 0.832)]
    for s, yf in rows:
        text(s, yf, 2.6)
    # the small indicator bars to the left of the settings (manual page 24)
    for yf in (0.482, 0.556, 0.648, 0.737, 0.832):
        dr.rounded_rectangle((W * S * 0.12, H * S * yf - 1.6 * S, W * S * 0.12 + 0.7 * S, H * S * yf + 1.6 * S), radius=0.3 * S, fill=(176, 179, 184))
    text("*Hold 3 seconds", 0.90, 1.9)
    return im


def main():
    # ── doors: one tile per colour ──
    # As ratios to the energy label's white. LG's straight fronts: Black Mirror 0.13 (a composite with lifted blacks),
    # Linen White 0.905, Linen Brown 0.09-0.13; LG's three-quarter photos: 0.02, 0.84-0.89 and 0.13-0.15.
    # Every door carries a full clear coat (the glass, in the builder). Black Mirror is a metal door under it, so its tile
    # is the colour layer's faint reflection: 29-31 x 1.5 in linear light renders 0.044 straight on, 0.11 at the default
    # view (-20 degrees) and 0.10 at -40, near LG's three-quarter photos (0.02; its front, a composite, reads 0.13).
    save(lscale(plain((29, 29, 31)), (1.5, 1.5, 1.5)), "door_bm.jpg", 92)
    # Linen White: the iPhone colour fix (BENCHMARK 12). As plain glass (metal 0) the 165-191 tile matched LG on the web
    # (0.87 straight on, LG 0.905) but Apple's renderers drew it mid-grey: 0.73 of the label's white in SceneKit and 0.65
    # in RealityKit under the studio light. The tile is now x 1.6 in linear light and the builder makes the door part-metal
    # (0.3), which the web draws darker and the Apple file writes as non-metal: web 0.87 straight on, 0.90 at the default
    # view, 0.87 at -40 degrees; SceneKit 0.905; RealityKit 0.81 (x 1.9 put the web at 0.90-0.92 and SceneKit at 0.98).
    save(lscale(linen((165, 165, 170), (191, 191, 197), 0.55), (1.6, 1.6, 1.6)), "door_lw.jpg", 88)
    # Linen Brown: as a metal door under the coat (the tile x (2.4, 2.95, 3.25) in linear light) RealityKit drew it the
    # same neutral grey as Black Mirror, (15, 15, 15). Now a part-metal door (0.3) on the photo's own brown: web (34, 26,
    # 23) 0.11 straight on against LG's (29, 21, 18), (53, 47, 45) 0.19 at the default view against LG's three-quarter
    # (40-45, 32-37, 29-34) 0.13-0.20; RealityKit (31, 27, 25), SceneKit (31, 24, 22).
    save(linen((22, 17, 15), (46, 37, 33), 0.6), "door_ln.jpg", 88)

    # ── energy labels: each colour's own (they name GL-B257DBM3, GL-B257DLW3 and GL-B257DLN3) ──
    for c in ("dbm3", "dlw3", "dln3"):
        save(label(c), f"label_{c}.png")

    # ── LG mark: light silver on the dark doors (about 200 grey on LG's Black Mirror front), mid grey on Linen White ──
    save(mark((206, 208, 212)), "lgmark_light.png")
    save(mark((128, 130, 134)), "lgmark_dark.png")

    # ── side vent grille (LG's side photos dbm3_side.jpg and dlw3_side.jpg): a 129 x 128 mm plate in the side's paint
    # with a darker edge, around a 4 x 9 grid of slots in an 85 x 84 mm field (dividers 3 and 2.5 mm), drawn at 8 px/mm
    # and reduced to 2 px/mm. One flat decal box in the builder: stacked relief was pushed apart by the export's z-fight
    # fix and made RealityKit's body 91.7 cm wide ──
    def grille(ground, slot):
        k = 8
        W, H = 129 * k, 128 * k
        im = Image.new("RGB", (W, H), tuple(round(c * 0.72) for c in ground))
        d = ImageDraw.Draw(im)
        d.rectangle((k, k, W - 1 - k, H - 1 - k), fill=ground)
        x0, y0 = 22 * k, 22 * k
        cw, rh = (85 - 3 * 3) / 4, (84 - 8 * 2.5) / 9
        for c in range(4):
            for r in range(9):
                xa = x0 + (c * (cw + 3)) * k
                ya = y0 + (r * (rh + 2.5)) * k
                d.rectangle((round(xa), round(ya), round(xa + cw * k) - 1, round(ya + rh * k) - 1), fill=slot)
        return im.resize((W // 4, H // 4), Image.LANCZOS).quantize(16)
    save(grille((46, 47, 51), (14, 15, 17)), "grille_dark.png")
    save(grille((214, 215, 218), (52, 53, 57)), "grille_white.png")

    # ── rear: LG's rear photo of GL-B257DBM3 (0.53 px/mm), the cabinet back from its top edge to the bottom ──
    rear = Image.open(os.path.join(SRC, "dbm3_rear.jpg")).convert("RGB")
    ra = np.asarray(rear).astype(int)
    nonwhite = ra.sum(2) < 735
    rs = nonwhite.sum(1)
    rows = [y for y in range(ra.shape[0]) if rs[y] > 0.8 * rs.max()]
    cols = np.where(nonwhite[rows[0]:rows[-1]].any(0))[0]
    r = rear.crop((cols.min() + 1, rows[0] + 1, cols.max(), rows[-1] - 2))
    save(r, "rear.jpg", 84)
    print("rear crop rows", rows[0], rows[-1], "cols", cols.min(), cols.max())

    # ── words LG prints inside, at about 8 px/mm on the model ──
    k = 1.4
    sc = lambda wh: (round(wh[0] * k), round(wh[1] * k))
    save(words("c", [("Convertible", True)], sc((900, 200)), px=round(110 * k)), "print_convertible.png")
    save(words("f", [("Fresh", True), ("Zone", False)], sc((900, 300)), "Fruit & Vegetables", round(96 * k), round(44 * k)), "print_freshzone.png")
    save(words("z", [("Freezing", True), ("Zone", False)], sc((900, 300)), "Fish & Meat", round(96 * k), round(44 * k)), "print_freezingzone.png")
    # Ice Maker: the label plate on the door's ice maker, 207 x 57 mm (LG's close-up dbm3_icemaker.jpg), drawn at 7 px/mm
    save(words("i", [("Ice", True), ("Maker", False)], (1449, 399), px=150, ink=(70, 72, 76, 255), bg=(244, 245, 246, 255)), "print_icemaker.png")
    # Hygiene Fresh+: the filter's face, 205 x 90 mm with its grey rim (open photo; LG's feature image shows the cartridge)
    hf = words("h", [("Hygiene", True), ("Fresh", False)], (1435, 630), px=150, ink=(60, 62, 66, 255), bg=(238, 240, 242, 255), sup="+")
    d = ImageDraw.Draw(hf)
    d.rounded_rectangle((4, 4, hf.width - 5, hf.height - 5), radius=40, outline=(178, 182, 188, 255), width=22)
    save(hf, "print_hygienefresh.png")
    save(display(), "print_display.png")


main()
