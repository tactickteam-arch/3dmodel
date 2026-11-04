"""Page photos for the Carrier 19K XCEED EDGE GXi indoor unit (STANDARD.md section 2: 4 photos at 900 x 900, 0 = hero).

usage: python3 tex_carrier_xceed.py <photos dir> <site photos dir>
  photos: carrier/1.jpg, 9.jpg, 6.jpg, 8.jpg   Carrier's own gallery on its XCEED EDGE GXi page (carriermideaindia.com),
          550 x 550 px each. That is the largest size Carrier serves (the uploads have no bigger original, checked 4 Nov 2026),
          and Sangeetha does not list this model, so there is no larger photo of it.
  writes <site photos dir>/carrier-19k-xceed-edge-gxi/0.jpg .. 3.jpg

Each photo is enlarged from 550 to 900 px with Lanczos, nothing else: no sharpening and no retouching, so it shows only what
Carrier's photo shows. The model's textures still come from prep_textures.py (the shared script), unchanged.
"""
import os
import sys

from PIL import Image

PHOTOS, OUT = sys.argv[1:3]
D = os.path.join(OUT, "carrier-19k-xceed-edge-gxi")
os.makedirs(D, exist_ok=True)
# 0 the unit on white (hero), 1 instant cooling and cleaner air, 2 the auto cleaner, 3 the pull-down front panel
for i, src in enumerate(["1.jpg", "9.jpg", "6.jpg", "8.jpg"]):
    im = Image.open(os.path.join(PHOTOS, "carrier", src)).convert("RGB")
    assert im.size == (550, 550), (src, im.size)
    out = os.path.join(D, f"{i}.jpg")
    im.resize((900, 900), Image.LANCZOS).save(out, quality=90, optimize=True)
    print("wrote", out, "from", src)
