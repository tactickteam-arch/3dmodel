"""Door, side and print textures for the Samsung RT34HG5A42BXHL (Luxe Black), so the doors and sides can carry surface
grain (BENCHMARK.md section 10) while every print stays a separate, sharp decal with no grain under it.

usage: python3 tex_samsung_rt34.py <photos dir> <logos dir> <out dir>
  photos: samsung/0.jpg (Sangeetha's front photo of this model), samsung/1.jpg (its own BEE label, "Model No.: RT34HG5A42BXHL")
  logos:  samsung.png
  writes <out dir>/samsung/:
    door_freezer.jpg, door_fridge.jpg   the Luxe Black fronts with no print on them: the light-to-dark fall of
                                        samsung/0.jpg (Sangeetha's front photo) and horizontal hairlines (the label and the
                                        wordmark are decals)
    side_paint.jpg                      the painted sides: the same shading as side.jpg without its brushed streaks (Samsung's
                                        3/4 photo shows a fine speckled paint on the sides, not a brush)
    label.png                           the BEE label, die-cut, at the photo's own resolution (about 3.6 px per mm)
    mark.png                            the SAMSUNG wordmark in dark ink, as printed on the silver strip at the top of the fridge door
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

PHOTOS, LOGOS, OUT = sys.argv[1:4]
D = os.path.join(OUT, "samsung")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(7)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def brushed(w, h, strength=6.0, streak=180):
    """Horizontal hairline noise (copied from prep_textures.py)."""
    n = rng.normal(0, 1, (h, w // 4 + 1))
    n = np.repeat(n, 4, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur((streak / 40, 0.4)))
    return (np.asarray(img).astype(float) / 255 - 0.5) * 2 * strength


# the doors' light-to-dark fall, read off Sangeetha's straight-on photo of this model (samsung/0.jpg): each row's mean
# across the door (5-95% of its width; beside the BEE label, 5-55% scaled by the ratio of the two just below it), at
# 0.495 px per mm from the 1710 mm body (top row 115, floor row 962). GAIN then corrects for the viewer's own light,
# which darkens the lower door more than the photo's studio did: render and photo compared as ratios of the label's
# white, at the freezer's top and bottom and the fridge's top, middle and bottom (NOTES.md)
BODY = (115, 962, 384, 697)
GAIN = [(0, 0.85), (300, 0.85), (562, 0.92), (582, 0.92), (800, 1.0), (1100, 1.2), (1670, 1.25)]


def doors():
    px_mm, W = 1.6, 630
    src = np.asarray(Image.open(os.path.join(PHOTOS, "samsung", "0.jpg")).convert("RGB")).astype(float)
    y0, y1, x0, x1 = BODY
    s, bw = (y1 - y0) / 1710, x1 - x0
    whole = src[:, int(x0 + 0.05 * bw):int(x0 + 0.95 * bw)].mean(1)
    left = src[:, int(x0 + 0.05 * bw):int(x0 + 0.55 * bw)].mean(1)
    lab_end = int(y0 + 320 * s)                                       # the label ends 302 mm down
    k = (whole[lab_end:lab_end + 10] / left[lab_end:lab_end + 10]).mean(0)
    band = whole.copy()
    band[:lab_end] = left[:lab_end] * k
    gy, gv = zip(*GAIN)

    def door(a_mm, b_mm):                                             # from a_mm to b_mm below the top of the body
        w, h = round(W * px_mm), round((b_mm - a_mm) * px_mm)
        mm = np.clip(a_mm + np.arange(h) / px_mm, a_mm + 8, b_mm - 8)  # held flat 8 mm from each edge (gap shadows)
        rows = y0 + mm * s
        i = np.floor(rows).astype(int)
        f = (rows - i)[:, None]
        col = band[i] * (1 - f) + band[i + 1] * f
        col *= np.interp(mm, gy, gv)[:, None]
        img = np.repeat(col[:, None, :], w, axis=1)
        img += brushed(w, h, 4.5)[:, :, None]
        return Image.fromarray(img.clip(0, 255).astype(np.uint8))

    save(door(0, 562), "door_freezer.jpg")                            # the freezer door, 562 mm
    save(door(582, 1670), "door_fridge.jpg")                          # the fridge door under its 14 mm silver strip


def side():
    # tex_samsung_extra.py's side shading (lighter at mid-height, as in the 3/4 photo), with only a faint even speckle
    h, w = 768, 512
    yy = np.linspace(0, 1, h)[:, None]
    base = 88 + 22 * np.exp(-((yy - 0.45) / 0.3) ** 2) - 6 * yy
    speck = Image.fromarray(((rng.normal(0, 1, (h, w)) * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    s = (np.asarray(speck).astype(float) / 255 - 0.5) * 3.0
    img = np.stack([base + s, base + s + 0.5, base + s + 3], axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "side_paint.jpg")


def label():
    # the label as Sangeetha photographed it on this model, with its white margin: the fill from the border stops at the
    # faint pink cut line round the sticker, and the line itself is trimmed off
    src = Image.open(os.path.join(PHOTOS, "samsung", "1.jpg")).convert("RGB")
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.min(2) < 225)                          # out to the cut line
    lab = src.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3)).convert("RGBA")
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g, b, _ = px[x, y]
        if min(r, g, b) < 238:                                   # the cut line (pink, about 236/207/211) ends the fill
            continue
        seen[y, x] = True
        px[x, y] = (r, g, b, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = np.asarray(lab.getchannel("A").filter(ImageFilter.MinFilter(5)))   # trim the cut line (2 px) off the edge
    # 95 colours and one clear index: a palette PNG with a tRNS chunk, a third the size of the RGBA one
    q = lab.convert("RGB").quantize(colors=95, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(q).copy()
    idx[alpha < 128] = 95
    out = Image.frombytes("P", q.size, idx.astype(np.uint8).tobytes())
    out.putpalette(q.getpalette()[:95 * 3] + [255, 255, 255])
    p = os.path.join(D, "label.png")
    out.save(p, optimize=True, transparency=bytes([255] * 95 + [0]))
    print("wrote", p, out.size, os.path.getsize(p) // 1024, "KB")


def mark():
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = (52, 55, 61)
    out[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(out), "mark.png")


doors()
side()
label()
mark()
