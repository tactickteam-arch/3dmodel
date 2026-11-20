"""LG's mark (the face in the circle and the letters LG), sharp at any size, in the layout of logos/lg.png.

Used by the LG fridges' texture scripts in place of logos/lg.png (349 x 160 px, which a 50-100 mm decal stretches to 3.5-7 px
per mm):
    sys.path.insert(0, HERE); import tex_lg_mark as lgm
    lgm.lg_hi(logos_dir, canvas_w)   # a PIL RGBA image, canvas_w x round(canvas_w * 160 / 349)

The mark is drawn from pipeline/sources/logos/lg.svg (LG's mark as vector shapes, the colours of logos/lg.png: the red circle,
the white face lines, the grey letters) and placed as logos/lg.png places it (the ink 339 x 150 of the 349 x 160 canvas,
centred), so the builders' decal planes, sized by 160 / 349, keep their size and place.
"""
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image


def lg_hi(logos, canvas_w):
    site = os.path.dirname(os.path.abspath(logos))
    s = canvas_w / 349
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, "lg.png")

        def draw(width):
            subprocess.run(["node", os.path.join(site, "pipeline/build3d/rasterize_svg.mjs"),
                            os.path.join(site, "pipeline/sources/logos/lg.svg"), png, str(width)], check=True, capture_output=True)
            im = Image.open(png).convert("RGBA")
            ys, xs = np.where(np.asarray(im)[..., 3] > 8)
            return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

        ink = draw(canvas_w)
        ink = draw(round(canvas_w * 339 * s / ink.width))      # the SVG has a margin: draw again so the ink is 339 s wide
    out = Image.new("RGBA", (canvas_w, round(160 * s)), (0, 0, 0, 0))
    out.paste(ink, ((out.width - ink.width) // 2, (out.height - ink.height) // 2))
    return out
