"""Cut a panel drawn at high density into uvDecals pieces (pipeline/build3d/decal_curved.mjs), each under the 4096 px a phone
or headset loads.

    import decal_cut
    decal_cut.cut(img, ground, out_dir, prefix="print", margin_px=24)

img is the whole panel drawn again at 12+ px per mm in the same layout as the panel's own texture (so its UVs, 0..1 across the
image, are the panel mesh's UVs). Only the inked part is kept: the rows and columns where the drawing differs from the plain
ground (an RGB colour) by more than 24 levels, plus a margin. If that span is wider than TEX_MAX it is cut at the emptiest strip
of columns that leaves every piece under TEX_MAX. Writes <prefix>_a.jpg, <prefix>_b.jpg, ... and decals.json
({ key: { file, rect: [u0, v0, u1, v1] } }, rows from the top: v0 is the first row's place, as the mesh's UVs run).
Returns the rects.
"""
import json
import os

import numpy as np
from PIL import Image

TEX_MAX = 4096


def cut(img, ground, out_dir, prefix="print", margin_px=24, quality=88):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    H, W = a.shape[:2]
    ink = np.abs(a - np.array(ground, np.float32)).max(2) > 24
    cols, rows = np.where(ink.any(0))[0], np.where(ink.any(1))[0]
    x0, x1 = max(0, cols[0] - margin_px), min(W, cols[-1] + 1 + margin_px)
    y0, y1 = max(0, rows[0] - margin_px), min(H, rows[-1] + 1 + margin_px)
    if y1 - y0 > TEX_MAX:
        raise SystemExit(f"decal_cut: the print is {y1 - y0} px tall, over {TEX_MAX}")
    n = -(-(x1 - x0) // TEX_MAX)
    colink = np.convolve(ink[y0:y1].sum(0).astype(np.float32), np.ones(25), "same")   # an empty strip, not one empty column
    cuts = [x0]
    for k in range(1, n):
        left = x1 - (n - k) * (TEX_MAX - 16)          # the rest must still fit in n - k pieces
        lo, hi = max(cuts[-1] + 64, left), cuts[-1] + TEX_MAX - 16
        lo = max(lo, x0 + k * (x1 - x0) // n - 600)   # near the even split, so the pieces stay alike in size
        hi = min(hi, x0 + k * (x1 - x0) // n + 600)
        if hi <= lo:
            lo, hi = max(cuts[-1] + 64, left), cuts[-1] + TEX_MAX - 16
        cuts.append(int(lo + np.argmin(colink[lo:hi])))
    cuts.append(x1)
    rects = {}
    for k in range(n):
        key = f"{prefix}{chr(65 + k)}"
        name = f"{prefix}_{chr(97 + k)}.jpg"
        xa, xb = cuts[k], cuts[k + 1]
        img.convert("RGB").crop((xa, y0, xb, y1)).save(os.path.join(out_dir, name), quality=quality, subsampling=0, optimize=True)
        rects[key] = {"file": name, "rect": [xa / W, y0 / H, xb / W, y1 / H]}
        print(f"decal {name}: {xb - xa} x {y1 - y0} px, ink at the cut {float(colink[xa]) if k else 0:.0f}")
    with open(os.path.join(out_dir, "decals.json"), "w") as f:
        json.dump(rects, f, indent=1)
    return rects
