"""Textures for the Haier HRB-3152PMG-P (265 L bottom mount, Mirror Glass) and its Black Glass colour HRB-3152PKG-P.

usage: python3 tex_haier_hrb3152.py <photos dir> <logos dir> <out dir>
  photos (pipeline/sources/photos/haier_hrb3152/, Haier India's gallery, 1200 x 1200; SOURCES.txt there):
    pmg_g01.jpg  Mirror Glass straight on: body x 440-760, rows 153 (top) to 1044 (floor at the front feet).
                 Haier's images of this fridge are drawn about 10 % wider than its published 548 x 1685 mm (every
                 photo of every HRB-3152 code reads 0.355-0.36 wide for tall against 0.325), so sizes across are read at
                 0.584 px per mm and heights at 0.529 px per mm.
    pkg_g01.jpg  Black Glass straight on (x 416-778, rows 93-1099).
    pmg_g06.jpg  open, empty: the inside's words and the control display.
    pmg_g09.jpg  the back straight on: body x 447-759, rows 150-1028 (the cabinet's underside).
  logos: haier.png
  writes <out dir>/haier_hrb3152/:
    logo_dark.png, logo_white.png   the Haier wordmark (black on Mirror Glass, white on Black Glass), 60 mm wide
    badge_mg.png, badge_kg.png      CONVERTIBLE in its rounded frame at the fridge door's bottom right, 79 x 17 mm:
                                    black frame and word on a white ground (Mirror Glass), white on black (Black Glass)
    display.jpg   the control display in the fridge's ceiling: Haier's open photo, cropped and cleaned. Its icons are
                  too small to read on any photo, so they stay as soft as the photo (nothing redrawn, nothing made up)
    duct.jpg      the moulded air duct on the fridge's back wall: the diamond pattern and NAVI as the open photo shows
                  them (drawn as light and shade, the relief itself is not modelled); the small second line under NAVI
                  can't be read and is left out
    rear.jpg      the back: Haier's rear photo cropped to the cabinet
    print_fruit.png, print_bigbox.png, print_freezebox.png, print_icemaker.png, print_bottle.png
                  FRUITBOX, 2XBIGBOX, FREEZEBOX, ICEMAKER, BOTTLEGUARD set again sharp, each followed by the small
                  squares the photo shows after it (3, 1, 3, 1, 1). The icons inside the squares can't be read: the
                  squares are left plain
Every word is set at 7.2 px per mm in Avenir Next.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "haier_hrb3152"
SRC = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
AV = "/System/Library/Fonts/Avenir Next.ttc"
DEMI, REG, BOLD = 2, 7, 0
S = 7.2                                     # px per mm for print


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print(name, img.size)


def font(face, px):
    return ImageFont.truetype(AV, px, index=face)


def words(parts, cap_mm, fill, track=0.0, gap=0.0):
    """Words in a row, each [text, face], set large and cropped to the ink; cap height cap_mm at S px per mm."""
    px = 300
    ims = []
    for text, face in parts:
        f = font(face, px)
        wd = int(sum(f.getlength(c) for c in text) + track * px * len(text) + px)
        im = Image.new("L", (wd, int(px * 1.6)), 0)
        d = ImageDraw.Draw(im)
        x = px * 0.3
        for c in text:
            d.text((x, px * 0.2), c, font=f, fill=255)
            x += f.getlength(c) + track * px
        ims.append(im.crop(im.getbbox()))
    capH = font(DEMI, px).getbbox("H")[3] - font(DEMI, px).getbbox("H")[1]
    W = sum(i.width for i in ims) + int(gap * px) * (len(ims) - 1)
    H = max(i.height for i in ims)
    out = Image.new("RGBA", (W, H), fill + (0,))
    x = 0
    for i in ims:
        layer = Image.new("RGBA", i.size, fill + (255,))
        layer.putalpha(i)
        out.alpha_composite(layer, (x, H - i.height))
        x += i.width + int(gap * px)
    k = cap_mm * S / capH
    return out.resize((max(1, round(W * k)), max(1, round(H * k))), Image.LANCZOS)


def pad(im, m=4):
    out = Image.new("RGBA", (im.width + 2 * m, im.height + 2 * m), im.getpixel((0, 0))[:3] + (0,))
    out.alpha_composite(im, (m, m))
    return out


def fitw(t, w):
    return t.resize((round(w), round(t.height * w / t.width)), Image.LANCZOS)


def logo():
    # the wordmark: ink x 585-620 on pmg_g01 (36 px at 0.584 px per mm across: 60 mm), rows 194-204, its middle 87 mm
    # under the door's top and 3 mm right of the middle (the builder places it)
    al = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA").getchannel("A")
    al = al.crop(al.getbbox())
    w = round(60 * S)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    for name, col in (("logo_dark.png", (16, 17, 19)), ("logo_white.png", (244, 246, 250))):
        out = Image.new("RGBA", al.size, col + (0,))
        out.putalpha(al)
        save(out, name)


def badge():
    # CONVERTIBLE: the frame x 695-741 on pmg_g01 (79 mm), rows 659-668 (17 mm), its right end 33 mm in from the hinge
    # edge, its foot 10 mm above the fridge door's bottom edge. A rounded frame about 1 mm wide, the word in heavy capitals
    # filling it; Mirror Glass: black on white; Black Glass: white on black (pkg_g01)
    w, h, r, t = round(79 * S), round(17 * S), round(3.0 * S), round(1.0 * S)
    for name, ink, ground in (("badge_mg.png", (20, 21, 23), (238, 239, 241)), ("badge_kg.png", (238, 240, 244), (8, 8, 9))):
        im = Image.new("RGBA", (w, h), ground + (0,))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 0, w - 1, h - 1), r, fill=ink + (255,))
        d.rounded_rectangle((t, t, w - 1 - t, h - 1 - t), max(1, r - t), fill=ground + (255,))
        word = words([["CONVERTIBLE", BOLD]], 9.0, ink, track=0.0)
        word = fitw(word, w - round(8 * S)) if word.width > w - round(8 * S) else word
        im.alpha_composite(word, ((w - word.width) // 2, (h - word.height) // 2))
        save(im, name)


def display():
    # the display window across the front of the fridge's ceiling (pmg_g06 x 432-548, rows 205-226), 4x LANCZOS
    a = Image.open(os.path.join(SRC, "pmg_g06.jpg")).convert("RGB").crop((432, 205, 548, 226))
    save(a.resize((a.width * 4, a.height * 4), Image.LANCZOS), "display.jpg", 92)


def duct():
    # the duct panel on the back wall (pmg_g06 x 437-543, from row 258 down behind the shelves and the fruit box): a
    # diamond lattice of moulded ridges about 24 mm across, NAVI on a raised plate 300 mm under its top (row 395) with a
    # rounded tab under it. 2.5 px per mm; the panel 210 x 600 mm (ESTIMATED: the photo at the back wall's depth, about
    # 0.44 px per mm)
    k = 2.5
    w, h = round(210 * k), round(600 * k)
    base = 236
    im = Image.new("RGB", (w, h), (base, base + 2, base + 4))
    d = ImageDraw.Draw(im)
    step = round(24 * k)
    for x0 in range(-h, w + h, step):                    # ridges: a light line with a shade line beside it
        for sgn in (1, -1):
            pts = [(x0, 0), (x0 + sgn * h, h)]
            d.line(pts, fill=(214, 218, 223), width=2)
            d.line([(p[0] + 2, p[1]) for p in pts], fill=(248, 249, 250), width=1)
    py = round(300 * k)
    pw, ph = round(64 * k), round(60 * k)
    d.rounded_rectangle(((w - pw) // 2, py, (w + pw) // 2, py + ph), round(6 * k), fill=(238, 240, 243), outline=(214, 217, 221), width=2)
    nav = words([["NAVI", REG]], 13.0, (196, 199, 204), track=0.06)
    nav = nav.resize((round(nav.width * k / S), round(nav.height * k / S)), Image.LANCZOS)
    im.paste(nav, ((w - nav.width) // 2, py + round(6 * k)), nav)
    ty = py + round(32 * k)
    d.rounded_rectangle(((w - round(56 * k)) // 2, ty, (w + round(56 * k)) // 2, ty + round(18 * k)), round(5 * k), outline=(150, 154, 160), width=3)
    save(im, "duct.jpg", 88)


def rear():
    src = cv2.imread(os.path.join(SRC, "pmg_g09.jpg"))
    crop = cv2.cvtColor(src[150:1028, 447:760], cv2.COLOR_BGR2RGB)
    save(Image.fromarray((crop.astype(float) * 0.9).clip(0, 255).astype(np.uint8)), "rear.jpg", 86)


def squares_after(im, grey, n, size_mm, gap_mm):
    s, g = round(size_mm * S), round(gap_mm * S)
    out = Image.new("RGBA", (im.width + n * (s + g), max(im.height, s)), grey + (0,))
    out.alpha_composite(im, (0, out.height - im.height))
    d = ImageDraw.Draw(out)
    for i in range(n):
        x = im.width + g + i * (s + g)
        d.rounded_rectangle((x, out.height - s, x + s - 1, out.height - 1), round(1.2 * S), fill=grey + (255,))
    return out


def inside_words():
    # sizes read off the open photo against the part they are on (about 0.5 px per mm): FRUITBOX 98 mm, caps 9 mm;
    # 2XBIGBOX 90 mm, FREEZEBOX 120 mm, caps 11 mm; ICEMAKER caps 6.5 mm; BOTTLEGUARD caps 8 mm. The heavy first half
    # and light second half as the photo shows
    grey = (100, 104, 110)
    save(pad(squares_after(words([["FRUIT", DEMI], ["BOX", REG]], 9.0, grey, gap=0.02), grey, 3, 9, 2)), "print_fruit.png")
    save(pad(squares_after(words([["2XBIG", DEMI], ["BOX", REG]], 9.5, grey, gap=0.02), grey, 1, 9.5, 2.5)), "print_bigbox.png")
    save(pad(squares_after(words([["FREEZE", DEMI], ["BOX", REG]], 11.0, grey, gap=0.02), grey, 3, 11, 2.5)), "print_freezebox.png")
    save(pad(squares_after(words([["ICE", DEMI], ["MAKER", REG]], 6.5, grey, track=0.03, gap=0.02), grey, 1, 6.5, 2)), "print_icemaker.png")
    save(pad(squares_after(words([["BOTTLE", DEMI], ["GUARD", REG]], 8.0, grey, gap=0.02), grey, 1, 8, 2)), "print_bottle.png")


logo()
badge()
display()
duct()
rear()
inside_words()
