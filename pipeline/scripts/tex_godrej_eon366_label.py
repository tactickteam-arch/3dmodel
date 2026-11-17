"""Godrej RT EONVIBE 366BN RCIT energy label, redrawn from BEE's register (application 188576: frost free, 2 star,
239 units a year, 330 L, valid to 31 Dec 2028, so the 2026-28 series). Godrej publishes no image of this label.

usage: python tex_godrej_eon366_label.py <template> <out .jpg>
  template: a 2026-28 frost-free 2-star label in BEE's layout (Whirlpool's NFT43127IRM1C1TE artwork, 1200 x 1200,
  private/research/whirlpool_22439/bee_label.jpg). Its stars, series and layout are the same; only the figures,
  the brand and the model differ, so each of those is painted out in the label's cream and set again, stretched to
  the ink box the old word had (found by thresholding inside a search window). Then tex_bee_label.py cuts it out.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1:3]
SUP = "/System/Library/Fonts/Supplemental/"
im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(int)
CREAM = tuple(int(v) for v in np.median(a[880:900, 700:800].reshape(-1, 3), axis=0))


def ink(box):
    """The dark ink's bounding box inside a search window (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    m = a[y0:y1, x0:x1].mean(axis=2) < 110
    ys, xs = np.nonzero(m)
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def put(box, text, font, size, keep_width=False):
    """Paint the old word out and set `text` at the old word's left edge and cap height."""
    x0, y0, x1, y1 = ink(box)
    d = ImageDraw.Draw(im)
    d.rectangle(box, fill=CREAM)
    f = ImageFont.truetype(SUP + font, size)
    l, t, r, b = f.getbbox(text)
    word = Image.new("L", (r - l, b - t), 0)
    ImageDraw.Draw(word).text((-l, -t), text, font=f, fill=255)
    h = y1 - y0
    w = (x1 - x0) if keep_width else round(word.width * h / word.height)
    word = word.resize((w, h), Image.LANCZOS)
    ink_rgb = tuple(int(v) for v in np.median(a[y0:y1, x0:x1][a[y0:y1, x0:x1].mean(axis=2) < 80], axis=0))
    im.paste(Image.new("RGB", word.size, ink_rgb), (x0, y0), word)


# (search window, new text, font). Windows hold only the word to change.
put((430, 650, 625, 735), "239", "Arial Black.ttf", 120)                       # 248 -> 239 units/yr
put((365, 812, 470, 852), "Godrej", "Arial Narrow Bold.ttf", 60)              # Whirlpool -> Godrej
put((505, 860, 541, 895), "330", "Arial Narrow Bold.ttf", 60)                 # 431 -> 330 (Ltr)
put((480, 905, 690, 945), "RT EONVIBE 366BN RCIT", "Arial Narrow Bold.ttf", 60)   # model no.
im.save(OUT, quality=95)
print(OUT, "cream", CREAM)
