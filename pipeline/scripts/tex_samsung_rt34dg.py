"""Textures for the Samsung RT34DG5A2BS8HL, 330 L Bespoke AI double door, in its three colours (Elegant Inox, Luxe Black,
EZ Clean Steel). Each colour's doors and sides come from Samsung's own gallery photos of that colour's code; the prints
inside and the rear come from the shared Samsung scripts, run on this model's own photos.

usage: python3 tex_samsung_rt34dg.py <site dir>
  reads pipeline/sources/photos/samsung_rt34dg/:
    g_<c>_5492642xx.png  Samsung's straight-on front of each colour (c = s8hl, bxhl, slhl), 1920 x 1280
    g_<c>_5481906xx.png  Samsung's 3/4 view from the left of each colour (the side's shade)
    g_s8hl_544358023.png Samsung's rear photo (the same picture for all three codes)
  writes pipeline/tex/samsung_rt34dg/:
    door_freezer_<slug>.jpg, door_fridge_<slug>.jpg  each colour's door fronts, no print on them: the photo's own
                                                     light-to-dark fall down the door, and horizontal hairlines
    side_paint_<slug>.jpg                            each colour's painted sides
    mark.png                                         the SAMSUNG wordmark in dark ink (the silver strip on the fridge door)
    inner_panel.png, back_freezer.png, back_fridge.png, bigbox_print.png, icemaker_print.png
                                                     tex_samsung_fridge.py's redrawn prints; this model's open-door and
                                                     display close-up photos show the same prints, word for word
    rear.jpg, bay.jpg, cord_path.json                tex_samsung_extra.py on this model's own rear photo (it is framed
                                                     exactly as the RT34HG's, so the script's pixel boxes apply)
The BEE label is not drawn: Samsung's label image for these codes is for the period 2023-25 (see NOTES.md).
"""
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

SITE = sys.argv[1]
SRC = os.path.join(SITE, "pipeline/sources/photos/samsung_rt34dg")
OUT = os.path.join(SITE, "pipeline/tex/samsung_rt34dg")
SCRIPTS = os.path.join(SITE, "pipeline/scripts")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(34)

# the colours: Samsung's front photo, hairline strength, the gain on the photo's fall, and the side's shade against the
# RT34HG's (its 3/4 photo reads 83/94/72 at 200/600/1000 px; these read as below on their own 3/4 photos) and tint
COLOURS = {
    "elegant-inox":   dict(front="g_s8hl_549264280.png", hair=4.0, gain=1.0, side=1.04, tint=(0, 0, 0)),
    "luxe-black":     dict(front="g_bxhl_549264106.png", hair=6.0, gain=1.0, side=1.18, tint=(1, 0, -1)),
    "ez-clean-steel": dict(front="g_slhl_549264362.png", hair=2.5, gain=1.0, side=1.33, tint=(2, 1, -2)),
}
# GAIN corrects for the viewer's own light. The RT34HG's curve (0.85 at the top to 1.25 at the bottom) made this model's
# front render 127 at the freezer's top and 172 at the fridge's foot against the photo's 153 and 144 (gate run 1, straight-on
# view against Samsung's front photo, 10-50% of the width): this curve is that one divided by the measured ratio
GAIN = [(0, 1.02), (171, 1.02), (342, 1.05), (1026, 1.05), (1283, 1.02), (1539, 1.04), (1670, 1.04)]


def flat(name):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    return bg.convert("RGB")


def save(img, name, q=88):
    p = os.path.join(OUT, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def brushed(w, h, strength):
    """horizontal hairline noise (as tex_samsung_rt34.py)"""
    n = rng.normal(0, 1, (h, w // 4 + 1))
    n = np.repeat(n, 4, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur((180 / 40, 0.4)))
    return (np.asarray(img).astype(float) / 255 - 0.5) * 2 * strength


def body_box(a):
    """top row, floor row (under the feet), and the body's columns at mid height"""
    dark = a.min(2) < 235
    ys = np.where(dark.any(1))[0]
    mid = (ys.min() + ys.max()) // 2
    xs = np.where(dark[mid])[0]
    return ys.min(), ys.max(), xs.min(), xs.max()


def doors(slug, c):
    px_mm, W = 1.3, 630                                                 # 1.3 px per mm keeps the GLB in its 3.8 MB budget with three colours
    a = np.asarray(flat(c["front"])).astype(float)
    y0, y1, x0, x1 = body_box(a)
    s, bw = (y1 - y0) / 1710, x1 - x0
    # each row's mean over 5-55% of the width: the label sits on the freezer door's right half in these photos, and the
    # left half keeps the same fall; scaled to the whole width's mean on the fridge door, where nothing is printed
    left = a[:, int(x0 + 0.05 * bw):int(x0 + 0.55 * bw)].mean(1)
    whole = a[:, int(x0 + 0.05 * bw):int(x0 + 0.95 * bw)].mean(1)
    r = slice(int(y0 + 700 * s), int(y0 + 1500 * s))
    band = left * (whole[r] / left[r]).mean(0)
    # the gap between the doors (the darkest row 30-40% down) anchors both doors: the photos are framed differently
    g0, g1 = int(y0 + 0.30 * (y1 - y0)), int(y0 + 0.40 * (y1 - y0))
    gap = g0 + int(np.argmin(left[g0:g1].mean(1)))
    sf = (gap - y0) / 565                                                    # the freezer door: 562 mm and half the gap
    gy, gv = zip(*GAIN)

    def door(a_mm, b_mm):
        w, h = round(W * px_mm), round((b_mm - a_mm) * px_mm)
        mm = np.clip(a_mm + np.arange(h) / px_mm, a_mm + 8, b_mm - 8)      # held flat 8 mm from each edge (gap shadows)
        rows = np.where(mm < 565, y0 + mm * sf, gap + (mm - 565) * s)
        i = np.floor(rows).astype(int)
        f = (rows - i)[:, None]
        col = band[i] * (1 - f) + band[i + 1] * f
        col = col.mean(1, keepdims=True).repeat(3, 1)                       # the finishes are neutral greys
        col *= (np.interp(mm, gy, gv) * c["gain"])[:, None]
        img = np.repeat(col[:, None, :], w, axis=1)
        img += brushed(w, h, c["hair"])[:, :, None]
        return Image.fromarray(img.clip(0, 255).astype(np.uint8))

    save(door(0, 562), f"door_freezer_{slug}.jpg", 85)
    save(door(582, 1670), f"door_fridge_{slug}.jpg", 85)


def side(slug, c):
    h, w = 768, 512
    yy = np.linspace(0, 1, h)[:, None]
    # 1.15: gate run 1's 3/4 render read the sides 74/96/80 against the photo's 105/98/80 (top, middle, foot)
    base = (88 + 22 * np.exp(-((yy - 0.45) / 0.3) ** 2) - 6 * yy) * c["side"] * 1.15
    speck = Image.fromarray(((rng.normal(0, 1, (h, w)) * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    sp = (np.asarray(speck).astype(float) / 255 - 0.5) * 3.0
    t = c["tint"]
    img = np.stack([base + sp + t[0], base + sp + 0.5 + t[1], base + sp + 3 + t[2]], axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), f"side_paint_{slug}.jpg")


def mark():
    lg = Image.open(os.path.join(SITE, "logos/samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = (52, 55, 61)
    out[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(out), "mark.png")


def shared():
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, os.path.join(SCRIPTS, "tex_samsung_fridge.py"), tmp], check=True)
        # tex_samsung_extra.py reads <photos>/samsung/g_550669406.jpg: stage this model's rear photo under that name
        os.makedirs(os.path.join(tmp, "photos", "samsung"))
        flat("g_s8hl_544358023.png").save(os.path.join(tmp, "photos", "samsung", "g_550669406.jpg"), quality=95)
        subprocess.run([sys.executable, os.path.join(SCRIPTS, "tex_samsung_extra.py"), os.path.join(tmp, "photos"), tmp], check=True)
        for n in ["inner_panel.png", "back_freezer.png", "back_fridge.png", "bigbox_print.png", "icemaker_print.png",
                  "rear.jpg", "bay.jpg", "cord_path.json"]:
            shutil.copy(os.path.join(tmp, "samsung", n), os.path.join(OUT, n))
            print("copied", n)


for slug, c in COLOURS.items():
    doors(slug, c)
    side(slug, c)
mark()
shared()
