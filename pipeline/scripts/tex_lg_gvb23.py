"""Textures for the LG GV-B23FFGMB French door refrigerator (574 L, glass doors, Black Mirror) and the same body in
Prime Silver (GV-B23FFLMB, VCM doors), LG India's two colours of this model.

usage: python3 tex_lg_gvb23.py <photos dir> <logos dir> <out dir>
  photos: lg_gvb23/bm_energy_label.jpg and ps_energy_label.jpg (LG's energy-label image for each code), bm_front.jpg and
          ps_front.jpg (LG's straight fronts, for the LG mark's colour and the brightness ratios)
  logos:  lg.png
  writes <out dir>/lg_gvb23/*.jpg|png

Doors: LG lists GV-B23FFGMB's doors as glass, Black Mirror: a plain deep black under the builder's glass coat (no light
baked in: the coat's own reflection is the sheen).
GV-B23FFLMB's are VCM, Prime Silver: polished silver steel with soft light and dark patches (brighter at the upper left,
darker towards the floor on LG's straight front). That light is kept: door_ps.jpg covers the whole front (835 x 1777 mm,
the builder maps each door onto its own part of it), its level following LG's front read in two dimensions with the
label, the LG mark, the seams and the rail masked off and blurred over 10 mm. Its very fine vertical brush is the
builder's hairline normal map. The colours are set as ratios to the energy label's white on LG's straight fronts (Black
Mirror 0.14 to 0.19, Prime Silver 0.55 to 0.86 across the four doors) and then tuned on renders (NOTES.md).
Print is redrawn: the LG mark from the brand logo, each colour's energy label as a die-cut crop of LG's image for that
code (they name GV-B23FFGMB and GV-B23FFLMB), the words LG prints inside ("Multi Air Flow" on the air filter, "Big Fresh
Zone" on the two vegetable boxes, "Fresh Converter+" on the pantry drawer) set again in PT Sans, the closest system face
to LG's, and the control panel on the fridge's right wall laid out as the owner's manual's drawing (page 27).
"""
import os
import sys
from collections import deque

sys.path.append("/Users/apple/Library/Python/3.9/lib/python/site-packages")
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import cv2

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "lg_gvb23")
D = os.path.join(OUT, "lg_gvb23")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(2323)
LEVEL_PS = 146
LEVEL_BM = 40
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


def ratios(code):
    """The door brightness on LG's straight front as a ratio to the energy label's white (printed for NOTES.md)."""
    a = np.asarray(Image.open(os.path.join(SRC, f"{code}_front.jpg")).convert("RGB")).astype(float)
    L = a.mean(2)
    ys = np.where((L < 240)[:, a.shape[1] // 2 - 50:a.shape[1] // 2 + 50].any(1))[0]
    xs = np.where(L[(ys.min() + ys.max()) // 2] < 240)[0]
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    w, h = x1 - x0, y1 - y0
    lab = L[int(y1 - 1749 / 1777 * h):int(y1 - 1580 / 1777 * h), int(x0 + 710 / 835 * w):int(x0 + 803 / 835 * w)]
    white = np.percentile(lab, 97)
    out = {}
    for name, (fx0, fx1, fy0, fy1) in {"upper left": (0.1, 0.4, 0.3, 0.35), "upper right": (0.6, 0.9, 0.3, 0.35),
                                        "lower left": (0.1, 0.4, 0.75, 0.8), "lower right": (0.6, 0.9, 0.75, 0.8)}.items():
        out[name] = round(L[int(y0 + fy0 * h):int(y0 + fy1 * h), int(x0 + fx0 * w):int(x0 + fx1 * w)].mean() / white, 3)
    # the LG mark: x 35-84 mm from the left edge, 1725-1744 mm above the floor (both of LG's fronts)
    m = a[int(y1 - 1744 / 1777 * h):int(y1 - 1725 / 1777 * h), int(x0 + 35 / 835 * w):int(x0 + 84 / 835 * w)].reshape(-1, 3)
    # the mark is lighter than the black glass and darker than the silver; the photo blurs its 2 mm strokes into the
    # door, so its colour is the box's lightest (or darkest) 2 %
    lum = m.mean(1)
    out["mark"] = (m[lum >= np.percentile(lum, 98)] if code == "bm" else m[lum <= np.percentile(lum, 2)]).mean(0).round(0).tolist()
    print(code, "label white", round(white, 1), out)
    return out


# ── door tiles: 64 mm square, repeated by the builder ──
def plain(base, noise=0.6):
    """Plain glass: one colour with a faint noise so the JPEG holds no banding (a 128 px swatch: any UV reads the same)."""
    a = np.stack([np.full((128, 128), c, float) for c in base], 2) + rng.normal(0, noise, (128, 128, 1))
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def light_field(code, w, h):
    """LG's straight front of this colour (Prime Silver) read as a light field over the whole front (835 x 1777 mm, top row first),
    returned at w x h as a share of the doors' mean. The energy label, the LG mark, the seams between the doors, the rail
    between upper and lower doors, the outer 8 mm and the bottom 25 mm of the lower doors (the feet) are masked off; the
    rest is blurred over 10 mm and the masked spots filled from round them."""
    g = np.asarray(Image.open(os.path.join(SRC, f"{code}_front.jpg")).convert("L")).astype(np.float32)
    ys = np.where((g < 240)[:, g.shape[1] // 2 - 50:g.shape[1] // 2 + 50].any(1))[0]
    xs = np.where(g[(ys.min() + ys.max()) // 2] < 240)[0]
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    a = cv2.resize(g[y0:y1 + 1, x0:x1 + 1], (835, 1777), interpolation=cv2.INTER_CUBIC)   # 1 px a mm
    ok = np.ones_like(a)
    Y = lambda mm: 1777 - mm                                   # mm above the floor to the row
    for xa, xb, ya, yb in ((705, 810, 1572, 1756), (28, 92, 1718, 1752), (411, 424, 0, 1777), (0, 835, 652, 718),
                           (0, 8, 0, 1777), (827, 835, 0, 1777), (0, 835, 0, 28 + 25), (0, 835, 1769, 1777)):
        ok[Y(yb):Y(ya), xa:xb] = 0
    # small dark or light marks the boxes miss (the hinge pins, specks): off where the photo leaves its 50 mm blur by 25
    big = cv2.GaussianBlur(a, (0, 0), 50)
    ok *= (np.abs(a - big) < 25).astype(np.float32)
    den = cv2.GaussianBlur(ok, (0, 0), 10)
    fld = cv2.GaussianBlur(a * ok, (0, 0), 10) / np.maximum(den, 1e-3)
    # too little door round a pixel: fill from a wider blur
    den2 = cv2.GaussianBlur(ok, (0, 0), 40)
    wide = cv2.GaussianBlur(a * ok, (0, 0), 40) / np.maximum(den2, 1e-3)
    fld = np.where(den < 0.3, wide, fld)
    mean = fld[ok > 0].mean()
    return cv2.resize(fld, (w, h), interpolation=cv2.INTER_AREA) / mean


def front(base, field, streak=0.5, w=512, h=1090):
    """The whole front in polished steel: base x the light field, with long faint vertical streaks (the hairline's fine
    brush is the builder's normal map)."""
    cols = rng.normal(0, 1, (1, w))
    cols = cv2.GaussianBlur(cols, (0, 0), 1.2)
    along = 1 + 0.35 * np.sin(2 * np.pi * (np.arange(h)[:, None] / h * 3 + rng.random((1, w))))
    v = cols / cols.std() * along + rng.normal(0, 0.25, (h, w))
    out = (np.array(base, float)[None, None, :] + streak * v[..., None]) * field[..., None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def label(code):
    """The energy label from LG's image for this code (the big label at the left of the image), die-cut by flood-filling
    the white from the border, and reduced to 48 colours."""
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
    # 720 px tall: 4.3 px/mm on the 168 mm label, two labels (one per colour) in the GLB
    size = (round(lab.width * 720 / lab.height), 720)
    alpha = alpha.resize(size, Image.LANCZOS).point(lambda v: 255 if v > 128 else 0)
    lab = lab.convert("RGB").resize(size, Image.LANCZOS)
    lab = lab.quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    lab.putalpha(alpha)
    print(code, "label crop", lab.size, "aspect", round(lab.width / lab.height, 4))
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


def words(parts, size, px, ink=INK, bg=None, sup=None):
    """Words set in PT Sans across a canvas (transparent unless bg), with an optional superscript."""
    im = Image.new("RGBA", size, bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fonts = [pt(px, b) for _, b in parts]
    widths = [d.textlength(t, font=f) for (t, _), f in zip(parts, fonts)]
    gap = px * 0.26
    supw = d.textlength(sup, font=pt(px * 0.55)) if sup else 0
    total = sum(widths) + gap * (len(parts) - 1) + supw
    x = (size[0] - total) / 2
    y = size[1] * 0.5
    for (t, _), f, wd in zip(parts, fonts, widths):
        d.text((x, y), t, font=f, fill=ink, anchor="lm")
        x += wd + gap
    if sup:
        d.text((x - gap + px * 0.04, y - px * 0.28), sup, font=pt(px * 0.55, True), fill=ink, anchor="lm")
    return im


SEG = {"0": "abcdef", "1": "bc", "3": "abgcd", "8": "abcdefg", "-": "g"}


def seven(dr, x, y, w, h, ch, fill, t):
    hh = h / 2
    g = t * 0.25
    seg = {"a": (x + g, y, x + w - g, y + t), "g": (x + g, y + hh - t / 2, x + w - g, y + hh + t / 2), "d": (x + g, y + h - t, x + w - g, y + h),
           "f": (x, y + g, x + t, y + hh - g), "b": (x + w - t, y + g, x + w, y + hh - g),
           "e": (x, y + hh + g, x + t, y + h - g), "c": (x + w - t, y + hh + g, x + w, y + h - g)}
    for s in SEG[ch]:
        dr.rounded_rectangle(seg[s], radius=t * 0.35, fill=fill)


def panel():
    """The control panel on the fridge's right wall, laid out as the owner's manual's drawing (page 27): the fridge
    temperature (3 °C) and the freezer's (-18 °C) in seven segments, then Fridge, Freezer / *Convertible, *Lock,
    Express Freeze / *Wi-Fi, the Vegetables / Fish / Meat box with its Select key, and "*Hold 3 seconds". The panel is
    40 x 140 mm (ESTIMATED: its height read off LG's photo of the open fridge at the vegetable boxes' scale, its width
    from the drawing's proportions), drawn at 10 px/mm. Rows are the drawing's, as fractions of the panel's height."""
    S = 10.0
    W, H = 40.0, 140.0
    im = Image.new("RGB", (round(W * S), round(H * S)), (238, 240, 242))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle((1, 1, im.width - 2, im.height - 2), radius=round(2.5 * S), outline=(208, 211, 215), width=round(0.6 * S))
    ink = (78, 80, 84)
    seg = (168, 171, 176)    # unlit segments behind the panel, a light grey on LG's photo (the panel sleeps when unused)

    def text(s, yf, mm, bold=False, xc=0.5, fill=ink, anchor="mm"):
        dr.text((W * S * xc, H * S * yf), s, font=pt(mm * S / 0.72, bold), fill=fill, anchor=anchor)
    # the drawing's rows (page 27, its panel 525 px tall from y 165): digits at 0.07-0.20 and 0.17-0.25
    dh, dw, t = 9.0 * S, 4.6 * S, 0.9 * S
    y1, y2 = H * S * 0.066, H * S * 0.165
    seven(dr, W * S * 0.38 - dw / 2, y1, dw, dh, "0", seg, t)
    seven(dr, W * S * 0.56 - dw / 2, y1, dw, dh, "3", seg, t)
    seven(dr, W * S * 0.22 - dw / 2, y2, dw * 0.7, dh, "-", seg, t)
    seven(dr, W * S * 0.38 - dw / 2, y2, dw, dh, "1", seg, t)
    seven(dr, W * S * 0.56 - dw / 2, y2, dw, dh, "8", seg, t)
    for yy in (y1, y2):
        dr.text((W * S * 0.68, yy + 0.4 * S), "°C", font=pt(2.6 * S / 0.72), fill=seg, anchor="lt")
    text("Fridge", 0.322, 2.2)
    text("Freezer", 0.426, 2.2)
    # the dotted rule under "Freezer" only (the drawing's, x 0.38-0.61 at row 0.442), clear of "*Convertible" below it
    for k in range(round(W * S * 0.38), round(W * S * 0.61), 6):
        dr.line((k, H * S * 0.442, k + 2, H * S * 0.442), fill=ink, width=2)
    text("*Convertible", 0.457, 2.2)
    text("*Lock", 0.53, 2.2)
    text("Express Freeze", 0.633, 2.0)
    text("*Wi-Fi", 0.664, 2.2)
    for yf in (0.457, 0.53, 0.633, 0.664):
        dr.rectangle((W * S * 0.12, H * S * yf - 1.2 * S, W * S * 0.15, H * S * yf + 1.2 * S), fill=ink)
    dr.line((W * S * 0.1, H * S * 0.704, W * S * 0.9, H * S * 0.704), fill=ink, width=3)
    # the dotted box round Vegetables / Fish / Meat
    for k in range(0, round(W * S * 0.78), 10):
        for yy in (H * S * 0.718, H * S * 0.818):
            dr.line((W * S * 0.11 + k, yy, W * S * 0.11 + k + 5, yy), fill=ink, width=2)
    for k in range(0, round(H * S * 0.1), 10):
        for xx in (W * S * 0.11, W * S * 0.89):
            dr.line((xx, H * S * 0.718 + k, xx, H * S * 0.718 + k + 5), fill=ink, width=2)
    for s, yf in (("Vegetables", 0.737), ("Fish", 0.768), ("Meat", 0.799)):
        text(s, yf, 2.2)
        dr.rectangle((W * S * 0.16, H * S * yf - 1.2 * S, W * S * 0.19, H * S * yf + 1.2 * S), fill=ink)
    dr.rounded_rectangle((W * S * 0.3, H * S * 0.84, W * S * 0.7, H * S * 0.88), radius=round(0.8 * S), outline=ink, width=3)
    text("Select", 0.86, 2.2)
    text("*Hold 3 seconds", 0.946, 1.6)
    return im


def main():
    r_bm, r_ps = ratios("bm"), ratios("ps")
    # ── doors: one tile per colour ──
    # Black Mirror: GV-B23FFGMB's straight front reads 0.14 to 0.19 of the label's white (mean 0.159), and its 3/4 view
    # 41 to 43 away from the light band. The paint behind the glass has no reflection of its own in the builder
    # (specular 0, under a glass coat of 1.0 at roughness 0.05), so its own colour carries that level: level 40 renders
    # 0.156 to 0.158 straight on and 38 to 41 at the page's 3/4 (level 16 had needed the paint's grey haze to get there).
    # The coat's reflection is the sheen, so nothing is baked in (NOTES.md)
    save(plain((LEVEL_BM, LEVEL_BM, LEVEL_BM + 1)), "door_bm.jpg", 92)
    # Prime Silver: neutral grey (R = G = B on LG's photos) times LG's own light on its straight front (light_field: p10
    # to p90 printed). Level LEVEL_PS is tuned until the gate's straight front and 3/4 match the photo (NOTES.md)
    fld = light_field("ps", 512, 1090)
    print("ps light field p10/p50/p90", *np.percentile(fld, [10, 50, 90]).round(3))
    save(front((LEVEL_PS, LEVEL_PS + 1, LEVEL_PS + 2), fld), "door_ps.jpg", 90)

    # ── energy labels: each colour's own (they name GV-B23FFGMB and GV-B23FFLMB) ──
    for c in ("bm", "ps"):
        save(label(c), f"label_{c}.png")

    # ── LG mark: light grey on Black Mirror, mid grey on Prime Silver, as each straight front reads it ──
    save(mark(tuple(int(v) for v in r_bm["mark"])), "lgmark_bm.png")
    save(mark(tuple(int(v) for v in r_ps["mark"])), "lgmark_ps.png")

    # ── words LG prints inside, at about 8 px/mm on the model ──
    # "Multi Air Flow" on the air filter's white face (195 x 90 mm, LG's photo of the open fridge)
    maf = words([("Multi", True), ("Air", False), ("Flow", False)], (1560, 720), px=150, ink=(48, 50, 54, 255), bg=(240, 242, 244, 255))
    d = ImageDraw.Draw(maf)
    d.rounded_rectangle((4, 4, maf.width - 5, maf.height - 5), radius=36, outline=(196, 200, 205, 255), width=16)
    save(maf, "print_maf.png")
    # "Big Fresh Zone" on each vegetable box (79 mm wide on LG's photo) and "Fresh Converter+" on the pantry drawer (93 mm)
    save(words([("Big", True), ("Fresh", True), ("Zone", False)], (760, 150), px=112), "print_bigfresh.png")
    save(words([("Fresh", True), ("Converter", False)], (880, 150), px=112, sup="+"), "print_freshconv.png")
    save(panel(), "print_panel.png")


main()
