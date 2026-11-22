"""WW70FG4S02 energy labels: the label as tex_bee_redraw.py redrew it (12 px per mm, bee_redraw/samsung_ww70fg*.json) with
the barcode strip under it that the label image carries (bee_cut_barcode*.png: the white sticker, the part number's barcode
and its digits), enlarged to the same width. The strip stays the source's picture: it carries no words a shopper reads.

usage: python3 tex_samsung_ww70fg_bee.py      (run after tex_bee_redraw.py on both data files; rewrites the two labels)
The builder lays the label 64 mm wide at the source's aspect (554 x 1095 px), which the result keeps.
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(SITE, "pipeline", "sources", "photos", "samsung_ww70fg")
TEX = os.path.join(SITE, "pipeline", "tex", "samsung_ww70fg")
for suf in ("", "_ax"):
    out = os.path.join(TEX, f"bee_label{suf}.png")
    top = Image.open(out).convert("RGBA")
    strip = Image.open(os.path.join(SRC, f"bee_cut_barcode{suf}.png")).convert("RGBA")
    full = Image.open(os.path.join(SRC, f"bee_cut_label{suf}.png"))
    W = top.size[0]
    total = round(W * (full.size[1] + strip.size[1]) / full.size[0])      # the source's whole aspect
    h = total - top.size[1]
    strip = strip.resize((W, h), Image.LANCZOS)
    res = Image.new("RGBA", (W, total), (0, 0, 0, 0))
    res.paste(top, (0, 0))
    res.paste(strip, (0, top.size[1]))
    res.quantize(256, method=Image.Quantize.FASTOCTREE).save(out, optimize=True)      # a palette, as the redraw writes
    print(out, res.size, f"{os.path.getsize(out) // 1024} KB", f"aspect {W / total:.4f}")
