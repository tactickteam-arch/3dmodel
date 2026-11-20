"""The SAMSUNG mark moulded into the front of the Samsung single doors' base-stand drawer, drawn sharp as a decal, and the
stand photo with the photo's soft mark taken out (the decal goes over it).

Used by tex_samsung_rr20.py, tex_samsung_rr21.py, tex_samsung_rr24.py and tex_samsung_rr24c.py:
    sys.path.insert(0, HERE); import tex_samsung_standmark as sm
    sm.paint_out(array, box)       # the photo's mark box (x0, y0, x1, y1) in texture px, filled from the rows round it
    sm.decal(logos_dir, w_mm)      # an RGBA image of the mark, 12 px per mm, w_mm wide

The mark is the SAMSUNG wordmark (pipeline/sources/logos/samsung.svg, drawn at the decal's own 12 px per mm) sunk into the plastic: on every colour's front photo
the letters read a little darker than the face, with a light rim along their lower and left edges and a dark rim along
their upper and right edges (the face is lit from above). The decal holds only that light and shade (white and black at
part opacity), so one decal serves every colour of stand.
"""
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageFilter

K = 12          # px per mm


def paint_out(a, box, pad=4):
    """Fill the box (and pad px round it) column by column with a straight blend from the rows above to the rows below.
    a: H x W x 3 float or uint8 array, changed in place and returned."""
    x0, y0, x1, y1 = box
    ya, yb = max(0, y0 - pad), min(a.shape[0] - 1, y1 + pad)
    top = a[max(0, ya - 3):ya + 1].astype(np.float32).mean(0)
    bot = a[yb:min(a.shape[0], yb + 4)].astype(np.float32).mean(0)
    xa, xb = max(0, x0 - pad), min(a.shape[1], x1 + pad + 1)
    for y in range(ya, yb + 1):
        t = (y - ya) / max(1, yb - ya)
        a[y, xa:xb] = (top[xa:xb] * (1 - t) + bot[xa:xb] * t).astype(a.dtype)
    return a


def wordmark(logos, w_px):
    """The SAMSUNG wordmark's coverage (0-255), trimmed to its ink, drawn from the SVG at w_px wide."""
    site = os.path.dirname(os.path.abspath(logos))
    with tempfile.TemporaryDirectory() as tmp:
        png = os.path.join(tmp, "samsung.png")
        subprocess.run(["node", os.path.join(site, "pipeline/build3d/rasterize_svg.mjs"),
                        os.path.join(site, "pipeline/sources/logos/samsung.svg"), png, str(w_px)], check=True, capture_output=True)
        lg = np.asarray(Image.open(png).convert("RGBA"))[..., 3]
    ys, xs = np.where(lg > 8)
    return lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def decal(logos, w_mm):
    W = round(w_mm * K)
    lg = wordmark(logos, W)
    lg = wordmark(logos, round(W * W / lg.shape[1]))            # the SVG has a margin: draw again so the ink is W wide
    W = lg.shape[1]
    H = lg.shape[0]
    pad = round(1.5 * K)
    m = Image.fromarray(lg)
    M = np.zeros((H + 2 * pad, W + 2 * pad), np.float32)
    M[pad:pad + H, pad:pad + W] = np.asarray(m, np.float32) / 255
    s = max(1, round(0.35 * K))                                  # the rim: the wall of the sunk letter, about 0.35 mm
    def shift(dx, dy):
        return np.roll(np.roll(M, dy, 0), dx, 1)
    light = np.clip(shift(-s, s) - M, 0, 1)                      # lower and left edges
    dark = np.clip(shift(s, -s) - M, 0, 1)                       # upper and right edges
    blur = lambda x: np.asarray(Image.fromarray((x * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.12 * K)), np.float32) / 255
    light, dark = blur(light), blur(dark)
    a_dark = np.clip(0.22 * M + 0.45 * dark, 0, 1)               # the sunk face a little darker, the upper rim darker still
    a_light = 0.40 * light * (1 - M)
    alpha = np.clip(a_dark + a_light, 0, 1)
    rgb = np.where((a_light > a_dark)[..., None], 255, 0) * np.ones(3)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")
