"""Door prints and printed words for the Haier HRF-2902ICMC-P (240 L, Marine Carnation, flat doors with the floral print).

usage: python3 tex_haier_hrf2902.py <photos dir> <logos dir> <out dir> [--compare]
  photos: haier_hrf2902/haier_front.jpg   Haier India's straight-on front of this model (1200 x 1200; the fridge is
                                           314 px wide for its 548 mm, 0.573 px per mm across, 0.567 px per mm up)
          haier_hrf2902/sangeetha_4.jpg   Sangeetha's open-door photo of this listing (the words inside)
  logos:  haier.png
  writes <out dir>/haier_hrf2902/:
    door_freezer.jpg   the freezer door's print, door top to door bottom, with the Haier wordmark and the CONVERTIBLE
                       badge painted out (both are sharp decals)
    door_fridge.jpg    the fridge door's print, from under the silver strip to the door's bottom edge
    logo.png           the Haier wordmark in white, from Haier's own logo file
    badge.png          the CONVERTIBLE badge: a light rim round a dark navy plate and the word in white, set again
    print_sliding.png  SLIDING SHELF, as printed on the top shelf's front rim (Sangeetha's open-door photo)
    print_fruit.png    FRUIT BOX, as printed on the fruit box's front (the same photo, and its Fruit Box close-up)
    print_navi.png     the NAVI badge on the fridge's back wall (its two lines of small print can't be read: left out)
    cover_ribs.png     the vegetable box cover's ribbed front rim (vertical ribs, as in the Fruit Box close-up)

The print is Haier's own picture at its own resolution: 0.57 px per mm is all the detail any source of this door has
(Haier's 1200 px front; Sangeetha's photos are no sharper). It is enlarged 3 x with Lanczos only so the texture filters
smoothly; that adds no detail. Every word on the door is set again sharp at 7 px per mm.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = "--compare" in sys.argv
D = os.path.join(OUT, "haier_hrf2902")
os.makedirs(D, exist_ok=True)
SRC = os.path.join(PHOTOS, "haier_hrf2902", "haier_front.jpg")
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
AV = "/System/Library/Fonts/Avenir Next.ttc"

# the body on Haier's front: x 441-755 (548 mm), door top row 146.5, floor row 1031 (1560 mm)
# freezer door print rows 147-421; the gap 422-424; the fridge door's recess 427-441 and silver strip 442-453 are
# geometry; its print rows 455-1007; the door's bottom edge row 1008.5. The outermost column each side is the door's edge.
X0, X1 = 443, 755                  # print columns [X0, X1)
FZ = (147, 422)                    # freezer print rows [a, b)
FR = (455, 1008)                   # fridge print rows [a, b)
UP = 3                             # enlargement, for filtering only
# the viewer's light lifts textures about a quarter (BENCHMARK 7): the print is held at SHADE of the photo,
# tuned by comparing the render with Haier's front (NOTES.md)
SHADE = 0.86
# words on the freezer door, measured on the same photo (padded 2 px): the Haier wordmark x 582-615, rows 187-197;
# the CONVERTIBLE badge x 699-745, rows 408-417
LOGO_BOX = (582, 187, 615, 197)
BADGE_BOX = (699, 408, 745, 417)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def doors():
    src = np.asarray(Image.open(SRC).convert("RGB")).copy()
    # paint the two printed words out of the photo (they come back as sharp decals): their ink and a 2 px margin
    mask = np.zeros(src.shape[:2], np.uint8)
    for (x0, y0, x1, y1) in (LOGO_BOX, BADGE_BOX):
        mask[y0 - 2:y1 + 3, x0 - 2:x1 + 3] = 255
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(src, cv2.COLOR_RGB2BGR), mask, 4, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)

    def door(rows, name):
        a = clean[rows[0]:rows[1], X0:X1].astype(float)
        # the first and last column carry the edge's shading: repeat their neighbours
        a[:, 0] = a[:, 1]
        a[:, -1] = a[:, -2]
        a *= SHADE
        img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
        img = img.resize((img.width * UP, img.height * UP), Image.LANCZOS)
        save(img, name)
        return img

    fz = door(FZ, "door_freezer.jpg")
    fr = door(FR, "door_fridge.jpg")
    if COMPARE:   # the photo's crops and the textures side by side, at the photo's scale
        ph = Image.open(SRC).convert("RGB")
        a = ph.crop((X0, FZ[0], X1, FZ[1])); b = fz.resize(a.size)
        c = ph.crop((X0, FR[0], X1, FR[1])); d = fr.resize(c.size)
        sheet = Image.new("RGB", (a.width * 2 + 10, a.height + c.height + 10), "white")
        sheet.paste(a, (0, 0)); sheet.paste(b, (a.width + 10, 0)); sheet.paste(c, (0, a.height + 10)); sheet.paste(d, (a.width + 10, a.height + 10))
        sheet.save(os.path.join(D, "_compare.png"))


def logo():
    # Haier's own wordmark (logos/haier.png), white as on the door; 59 mm wide on the photo, at 7.2 px per mm
    lg = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")
    al = lg.getchannel("A")
    bb = al.getbbox()
    al = al.crop(bb)
    w = round(59 * 7.2)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    out = Image.new("RGBA", al.size, (244, 246, 250, 0))
    out.putalpha(al)
    save(out, "logo.png")
    print("logo aspect", al.width / al.height)


def text_img(s, font, px, fill, track=0.0):
    """A word set at px, cropped to its ink, with track (a fraction of px) added between letters."""
    f = ImageFont.truetype(font[0], px, index=font[1]) if isinstance(font, tuple) else ImageFont.truetype(font, px)
    widths = [f.getlength(ch) for ch in s]
    W = int(sum(widths) + track * px * (len(s) - 1) + px)
    im = Image.new("L", (W, int(px * 1.6)), 0)
    d = ImageDraw.Draw(im)
    x = px * 0.5
    for ch, w in zip(s, widths):
        d.text((x, px * 0.2), ch, font=f, fill=255)
        x += w + track * px
    im = im.crop(im.getbbox())
    out = Image.new("RGBA", im.size, fill + (0,))
    out.putalpha(im)
    return out


def badge():
    # the CONVERTIBLE badge: 82 x 17.6 mm on the photo (47 x 10 px), a light rim about 1 mm wide round a dark navy plate
    # with the word in white capitals filling about 86% of it. Drawn at 7.2 px per mm, 3 x over and reduced.
    S, k = 7.2, 3
    w, h = round(82 * S * k), round(17.6 * S * k)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = round(2.2 * S * k)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=(214, 220, 232, 255))
    rim = round(1.1 * S * k)
    d.rounded_rectangle((rim, rim, w - 1 - rim, h - 1 - rim), radius=r - rim, fill=(10, 18, 58, 255))
    word = text_img("CONVERTIBLE", BOLD, 200, (246, 247, 250), track=0.04)
    tw = round(w * 0.86)
    th = round(word.height * tw / word.width)
    if th > h * 0.5:                                   # keep the cap height to half the badge, as on the photo
        th = round(h * 0.5); tw = round(word.width * th / word.height)
    word = word.resize((tw, th), Image.LANCZOS)
    im.alpha_composite(word, ((w - tw) // 2, (h - th) // 2))
    im = im.resize((w // k, h // k), Image.LANCZOS)
    save(im, "badge.png")


def words():
    # grey words on the clear and white plastic inside, set in Avenir Next Medium (size and colour from the open-door photo)
    def word(s, mm_w, name, col=(118, 124, 132)):
        t = text_img(s, (AV, 5), 200, col, track=0.08)
        W = round(mm_w * 7.2)
        save(t.resize((W, round(t.height * W / t.width)), Image.LANCZOS), name)
    word("SLIDING SHELF", 120, "print_sliding.png")
    word("FRUIT BOX", 95, "print_fruit.png")
    # the NAVI badge: a rounded square outline with the word; its small print below can't be read and is left out
    S, k = 7.2, 3
    n = round(46 * S * k)
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, n - 1, n - 1), radius=round(6 * S * k), outline=(120, 126, 134, 255), width=round(1.0 * S * k))
    t = text_img("NAVI", (AV, 5), 300, (96, 102, 110), track=0.06)
    tw = round(n * 0.62); th = round(t.height * tw / t.width)
    t = t.resize((tw, th), Image.LANCZOS)
    im.alpha_composite(t, ((n - tw) // 2, round(n * 0.22)))
    save(im.resize((n // k, n // k), Image.LANCZOS), "print_navi.png")
    # the cover's ribbed front rim: thin light ribs every 6 mm
    w, h = 512, 32
    a = np.zeros((h, w), np.uint8)
    for x in range(0, w, 12):
        a[:, x:x + 4] = 200
    out = Image.new("RGBA", (w, h), (236, 240, 244, 0))
    out.putalpha(Image.fromarray(a))
    save(out, "cover_ribs.png")


doors()
logo()
badge()
words()
