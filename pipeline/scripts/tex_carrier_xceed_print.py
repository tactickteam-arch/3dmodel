"""The Carrier oval on the 19K XCEED EDGE GXi front panel, drawn sharp as a decal (12 px per mm on the model).

usage: python3 -I tex_carrier_xceed_print.py <site dir>
  reads  pipeline/tex/carrier/front.jpg (prep_textures.py: the panel at 2 px per mm, the oval painted in)
         pipeline/sources/logos/carrier.svg (the oval as vector shapes)
  writes pipeline/tex/carrier/front_print.jpg  the panel with its soft 2 px/mm oval taken out (the decal goes over it)
         pipeline/tex/carrier/logo.png         the oval, 34 mm tall, 12 px per mm, transparent round it

The size and place are the ones prep_textures.py already gives the oval (34 mm tall, centred across, its centre at 56% of
the panel's height, as in Carrier's photo); the blue is sampled off the badge on Carrier's main photo (below).
"""
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

SITE = sys.argv[1]
D = os.path.join(SITE, "pipeline/tex/carrier")
PX_MM = 2.0                     # front.jpg
K = 12                          # the decal
OVAL_H = 34                     # mm, as prep_textures.py draws it

front = np.asarray(Image.open(os.path.join(D, "front.jpg")).convert("RGB")).astype(np.float32)
h, w = front.shape[:2]
# where prep_textures.py pasted the oval (logos/carrier.png scaled to 68 px tall, centred, centre at 0.56 h)
site_logo = Image.open(os.path.join(SITE, "logos/carrier.png"))
oh = round(OVAL_H * PX_MM)
ow = round(site_logo.width * oh / site_logo.height)
x0, y0 = (w - ow) // 2, round(0.56 * h - oh / 2)
# fill the oval's box (and 8 px round it) row by row with a straight blend from the panel just left of it to the panel just
# right of it: the panel there is flat white with only a slow vertical shading, so the blend is the panel without the oval
pad = 8
ya, yb, xa, xb = y0 - pad, y0 + oh + pad, x0 - pad, x0 + ow + pad
left = front[ya:yb + 1, xa - 6:xa].mean(1)
right = front[ya:yb + 1, xb:xb + 6].mean(1)
t = np.linspace(0, 1, xb - xa)[None, :, None]
front[ya:yb + 1, xa:xb] = left[:, None] * (1 - t) + right[:, None] * t
Image.fromarray(front.clip(0, 255).astype(np.uint8)).save(os.path.join(D, "front_print.jpg"), quality=90, optimize=True)
print("wrote front_print.jpg", (w, h), "oval box", (x0, y0, ow, oh))

# the decal: the SVG drawn so its ink is 34 mm tall at 12 px per mm
with tempfile.TemporaryDirectory() as tmp:
    png = os.path.join(tmp, "carrier.png")

    def draw(width):
        subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"),
                        os.path.join(SITE, "pipeline/sources/logos/carrier.svg"), png, str(width)], check=True, capture_output=True)
        im = Image.open(png).convert("RGBA")
        ys, xs = np.where(np.asarray(im)[..., 3] > 8)
        return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

    im = draw(1000)
    im = draw(round(1000 * OVAL_H * K / im.height))
# its blue is the real badge's, not the SVG's (2, 2, 152), which reads purple: the oval's saturated core on Carrier's main photo
# (photos/carrier/1.jpg, the 21 x 9 px badge: median (3, 64, 161)) set against the white panel beside it on the same photo
# (214, 215, 233), the ratio taken in linear light and applied to this panel's white near the mark (246, 247, 249)
BLUE = (4, 75, 172)
a = np.asarray(im).astype(np.float32)
w = np.clip(1 - (a[..., 0] - 2) / (255 - 2), 0, 1)[..., None]         # 1 on the SVG's blue (red 2), 0 on its white (red 255)
a[..., :3] = a[..., :3] * (1 - w) + np.array(BLUE, np.float32) * w      # the blue changes; the white word and ring stay white
im = Image.fromarray(a.round().clip(0, 255).astype(np.uint8))
im.save(os.path.join(D, "logo.png"), optimize=True)
print("wrote logo.png", im.size, "mm", round(im.width / K, 1), "x", round(im.height / K, 1))
