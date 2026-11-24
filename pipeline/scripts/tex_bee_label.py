"""A product's own BEE star label, cut out as a die-cut sticker for its builder.

usage: python tex_bee_label.py <label image> <out .png> [--bg dark|outline|auto|purple] [--box x0,y0,x1,y1] [--clean cyan]
  The image is the maker's or Sangeetha's label artwork for this exact model (private/research/<slug>/bee_label*).
  Everything joined to the image's border that is near the background colour (white, or with --bg dark a dark
  backdrop; with --bg outline anything lighter than the label's dark border line, for a label photographed on a
  blurred backdrop) becomes transparent, so the label keeps its own outline: the arch, the corners, the border line.
  Artwork that already has a transparent background keeps it. --box first crops to the label in a larger picture
  (a promo image); --bg auto then takes the backdrop as anything near the colour along the box's border.
  --clean cyan paints out cyan callout dots and lines drawn over the label (Voltas's annotated image) from the
  pixels around them.
  The result is cropped to the label and written as a 64-colour PNG with alpha at the artwork's own resolution (never enlarged),
  and its size and aspect are printed for the builder (width / height).
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

src, out = sys.argv[1:3]
mode = sys.argv[sys.argv.index("--bg") + 1] if "--bg" in sys.argv else "white"

im = Image.open(src)
if "--box" in sys.argv:
    im = im.crop(tuple(int(v) for v in sys.argv[sys.argv.index("--box") + 1].split(",")))
if "--clean" in sys.argv:
    import cv2
    a = np.asarray(im.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    cyan = (b > 150) & (g > 150) & (r < 140) & (b - r > 60)
    mask = cv2.dilate(cyan.astype(np.uint8) * 255, np.ones((7, 7), np.uint8))
    im = Image.fromarray(cv2.inpaint(np.asarray(im.convert("RGB")), mask, 5, cv2.INPAINT_TELEA))
rgba = np.asarray(im.convert("RGBA")).astype(int)
rgb = rgba[..., :3]
h, w, _ = rgb.shape
lum = rgb.mean(axis=2)
spread = rgb.max(axis=2) - rgb.min(axis=2)
# background: near-white and colourless (or near-black with --bg dark); the label's cream is warm, so it stays
if mode == "auto":
    edge = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.zeros(lum.shape, bool)
    for c in edge[:: max(1, len(edge) // 64)]:     # the backdrop can be a gradient: near any of its border colours
        bg |= np.abs(rgb - c).sum(axis=2) < 70
else:
    bg = {"dark": lum < 60, "outline": lum > 75, "white": (lum > 238) & (spread < 14),
          "purple": rgb[..., 2] - rgb[..., 1] > 40}[mode]    # purple: a violet backdrop (Voltas); no label ink is bluer than it is green
if "A" in im.getbands() and (rgba[..., 3] < 128).any():
    bg = rgba[..., 3] < 128

outside = np.zeros((h, w), bool)
q = deque((y, x) for y in range(h) for x in (0, w - 1) if bg[y, x])
q.extend((y, x) for x in range(w) for y in (0, h - 1) if bg[y, x])
for y, x in q:
    outside[y, x] = True
while q:
    y, x = q.popleft()
    for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
        if 0 <= ny < h and 0 <= nx < w and bg[ny, nx] and not outside[ny, nx]:
            outside[ny, nx] = True
            q.append((ny, nx))

ys, xs = np.nonzero(~outside)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
alpha = np.where(outside, 0, 255).astype(np.uint8)
img = np.dstack([rgb.astype(np.uint8), alpha])[y0:y1, x0:x1]
# 64 colours with their alpha, so a label adds tens of KB, not hundreds
Image.fromarray(img).quantize(colors=64, method=Image.Quantize.FASTOCTREE).save(out, optimize=True)
print(f"{out}: {x1 - x0} x {y1 - y0} px, aspect {(x1 - x0) / (y1 - y0):.4f}")
