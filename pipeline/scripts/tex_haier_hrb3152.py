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
    print_navi.png  the NAVI plate (64 x 60 mm) again at 12 px per mm, laid over the duct as a decal
    rear.jpg      the back: Haier's rear photo cropped to the cabinet
    print_fruit.png, print_bigbox.png, print_freezebox.png, print_icemaker.png, print_bottle.png
                  FRUITBOX, 2XBIGBOX, FREEZEBOX, ICEMAKER, BOTTLEGUARD set again sharp, each followed by the small
                  squares the photo shows after it (3, 1, 3, 1, 1). The icons inside the squares can't be read: the
                  squares are left plain
Every word is set at 12 px per mm in Avenir Next.
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
S = 12.0                                    # px per mm for print (11-12 on the model: the handover clarity pass)


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
    """The control display in the fridge's ceiling, drawn again at 12 px per mm.

    The plane (226 x 40.9 mm) shows the housing's grey frame round a dark window, as on pmg_g06 (x 432-548, rows
    205-226): the window's edges are measured there (top row 209.5, bottom 220; left x 439.2 -> 442.4, right 538.7 ->
    536.2). What is in the window is read off Haier's own close-up of this display on the HRB-3152PKG-P page
    (pkg_micom.jpg, "Internal MI-COM", lit): the keys R/F and Energy Saving (each "3 Sec" under it), a lit mode icon,
    the temperature 02 with its unlit segments and minus, deg c, a two-step bar, the keys Ref. and Frz. Its layout matches
    pmg_g06's (two framed keys left, digits and bar, two framed keys right, within 2 % of the width). The close-up's
    window corners are mapped onto pmg_g06's by a homography; keys, words, digits and bar are drawn as shapes and type,
    the icon and deg c are its own lit ink cut from a 16x enlargement. The unlit marks between the icon and the digits
    can't be read: left dark.
    """
    PX = 12.0
    Wmm, Hmm = 226.0, 226.0 * 84 / 464
    CW, CH = round(Wmm * PX), round(Hmm * PX)
    k = CW / 464                                         # canvas px per px of the old 464 x 84 crop (4x pmg_g06)
    g6 = Image.open(os.path.join(SRC, "pmg_g06.jpg")).convert("RGB").crop((432, 205, 548, 226))
    # the frame: the photo's grey, row by row as its two ends show it (columns clear of the window), smoothed; nothing
    # is printed on it
    g6a = np.asarray(g6).astype(np.float32)
    rows = np.concatenate([g6a[:, :4], g6a[:, -4:]], 1).mean(1)           # 21 x 3
    prof = cv2.resize(rows[:, None, :], (1, CH), interpolation=cv2.INTER_CUBIC)[:, 0, :]
    prof = cv2.GaussianBlur(prof[:, None, :], (1, 0), sigmaX=0.1, sigmaY=1.5 * PX)[:, 0, :]
    canvas = np.repeat(prof[:, None, :], CW, 1).astype(np.float32)

    def to_c(x, y):                                     # pmg_g06 photo px -> canvas px
        return (x - 432) * 4 * k, (y - 205) * 4 * k

    win = [to_c(439.2, 209.5), to_c(538.7, 209.5), to_c(536.2, 220.0), to_c(442.4, 220.0)]
    src = np.float32([[214.9, 309.4], [615.9, 308.5], [602.3, 348.3], [231.8, 352.1]])   # the same corners on pkg_micom
    Hm = cv2.getPerspectiveTransform(src, np.float32(win))

    def mp(pts):
        p = cv2.perspectiveTransform(np.float32(pts).reshape(-1, 1, 2), Hm).reshape(-1, 2)
        return [tuple(q) for q in p]

    SS = 4

    def layer():
        return Image.new("L", (CW * SS, CH * SS), 0)

    def put(lay, colour):
        a = np.asarray(lay.resize((CW, CH), Image.BOX)).astype(np.float32)[..., None] / 255
        canvas[...] = canvas * (1 - a) + np.array(colour, np.float32) * a

    def poly(d, pts):
        d.polygon([(x * SS, y * SS) for x, y in mp(pts)], fill=255)

    WIN = (39, 39, 39)                                  # the window on pmg_g06
    PRINT = (122, 124, 110)                             # the keys' frames and words: dim and warm, about 3x the window
    LIT = (233, 236, 252)                               # the lit segments, icon and deg c (pkg_micom)
    UNLIT = (64, 66, 74)                                # unlit segments, faint
    BAR = (103, 109, 169)                               # the bar's upper step, lavender

    lay = layer()
    ImageDraw.Draw(lay).polygon([(x * SS, y * SS) for x, y in win], fill=255)
    put(lay, WIN)

    # the four framed keys: rounded frames about 1 px of the close-up wide (0.5 mm)
    keys = {"R/F": (246.5, 320.0, 282.5, 342.8), "ES": (292.2, 320.0, 326.5, 342.8),
            "Ref.": (518.5, 318.1, 550.6, 340.6), "Frz.": (558.5, 318.1, 590.9, 339.8)}
    lay = layer()
    d = ImageDraw.Draw(lay)
    for x0, y0, x1, y1 in keys.values():
        q = mp([(x0, y0), (x1, y1)])
        (a0, b0), (a1, b1) = q
        lw = 0.55 * PX * SS
        d.rounded_rectangle((a0 * SS, b0 * SS, a1 * SS, b1 * SS), radius=1.4 * PX * SS, outline=255, width=round(lw))
    put(lay, PRINT)

    # their words, each fitted to the box its ink takes on the close-up
    mic = np.asarray(Image.open(os.path.join(SRC, "pkg_micom.jpg")).convert("RGB")).astype(np.float32)
    lum = mic.mean(2)

    def ink_box(x0, y0, x1, y1):
        c = lum[y0:y1, x0:x1]
        t = (np.percentile(c, 97) + np.percentile(c, 30)) / 2
        ys, xs = np.where(c > t)
        return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1

    ARIAL = "/System/Library/Fonts/Supplemental/Arial.ttf"

    def word(text, box):
        f = ImageFont.truetype(ARIAL, 400)
        im = Image.new("L", (int(f.getlength(text)) + 400, 800), 0)
        ImageDraw.Draw(im).text((200, 600), text, font=f, fill=255, anchor="ls")
        im = im.crop(im.getbbox())
        (a0, b0), (a1, b1) = mp([(box[0], box[1]), (box[2], box[3])])
        w, h = round((a1 - a0) * SS), round((b1 - b0) * SS)
        lay = layer()
        lay.paste(im.resize((w, h), Image.LANCZOS), (round(a0 * SS), round(b0 * SS)))
        put(lay, PRINT)

    word("R/F", (253.0, 327.0, 270.5, 336.5))                     # the reflection left of it upsets a threshold
    word("Energy", ink_box(295, 322, 325, 331))
    word("Saving", ink_box(295, 331, 325, 341))
    word("Ref.", ink_box(521, 321, 548, 338))
    word("Frz.", ink_box(561, 321, 588, 337))
    # "3 Sec" under the first two keys: dim, just above the window's lower edge (read off an 8x enlargement; a threshold
    # there catches the frame)
    word("3 Sec", (255.6, 345.0, 274.4, 350.6))
    word("3 Sec", (300.6, 345.0, 318.8, 350.4))

    # the temperature: two seven-segment digits (outer boxes on the close-up), stroke 2.4 px, chamfered ends
    def segs(x0, y0, x1, y1, t=2.4):
        ym = (y0 + y1) / 2
        c = t / 2
        h = lambda xa, xb, y: [(xa + c, y), (xa + t, y - c), (xb - t, y - c), (xb - c, y), (xb - t, y + c), (xa + t, y + c)]
        v = lambda x, ya, yb: [(x, ya + c), (x + c, ya + t), (x + c, yb - t), (x, yb - c), (x - c, yb - t), (x - c, ya + t)]
        g = 0.35
        return {"a": h(x0 + g, x1 - g, y0 + c), "g": h(x0 + g, x1 - g, ym), "d": h(x0 + g, x1 - g, y1 - c),
                "f": v(x0 + c, y0 + g, ym - g), "e": v(x0 + c, ym + g, y1 - g),
                "b": v(x1 - c, y0 + g, ym - g), "c": v(x1 - c, ym + g, y1 - g)}

    lit, unlit = layer(), layer()
    dl, du = ImageDraw.Draw(lit), ImageDraw.Draw(unlit)
    for (box, on) in (((442.0, 317.8, 455.6, 342.8), "abcdef"), ((459.6, 317.6, 474.0, 342.8), "abged")):
        for name, pts in segs(*box).items():
            poly(dl if name in on else du, pts)
    poly(du, [(433.3, 329.6), (438.0, 329.6), (438.0, 331.6), (433.3, 331.6)])      # the minus, unlit
    put(unlit, UNLIT)
    put(lit, LIT)

    # the bar: two steps, the upper lavender, the lower lit
    lay = layer()
    poly(ImageDraw.Draw(lay), [(494.8, 317.4), (504.8, 317.4), (504.8, 328.8), (494.8, 328.8)])
    put(lay, BAR)
    lay = layer()
    poly(ImageDraw.Draw(lay), [(494.8, 330.8), (504.8, 330.8), (504.8, 342.9), (494.8, 342.9)])
    put(lay, LIT)

    # the lit mode icon (a drop and a ring with two arcs round them) and deg c: the close-up's own lit ink (its blue
    # channel), cut with a hard threshold from a 16x enlargement and warped onto the window
    def lit_ink(x0, y0, x1, y1, thr):
        E = 16
        c = mic[y0:y1, x0:x1, 2]
        b = cv2.resize(c, None, fx=E, fy=E, interpolation=cv2.INTER_CUBIC)
        b = cv2.GaussianBlur(b, (0, 0), E * 0.3)
        m = np.clip((b - thr) / 12 + 0.5, 0, 1).astype(np.float32)
        S = np.float32([[1 / E, 0, x0], [0, 1 / E, y0], [0, 0, 1]])
        Z = np.float32([[SS, 0, 0], [0, SS, 0], [0, 0, 1]])
        w = cv2.warpPerspective(m, Z @ Hm @ S, (CW * SS, CH * SS), flags=cv2.INTER_LINEAR)
        put(Image.fromarray(np.clip(w * 255, 0, 255).astype(np.uint8)), LIT)

    lit_ink(343, 319, 371, 344, 130)
    lit_ink(476, 332, 488, 344, 130)                    # the c
    lay = layer()                                       # the degree ring: 3.4 px across, too small to cut, drawn
    d = ImageDraw.Draw(lay)
    for r, f in ((1.7, 255), (0.75, 0)):
        q = mp([(479.8 - r, 329.6 - r), (479.8 + r, 329.6 + r)])
        d.ellipse((q[0][0] * SS, q[0][1] * SS, q[1][0] * SS, q[1][1] * SS), fill=f)
    put(lay, LIT)

    canvas += np.random.default_rng(3152).normal(0, 0.6, canvas.shape)
    save(Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)), "display.jpg", 90)


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
    # the same NAVI plate again as its own decal at S px per mm (the duct's 2.5 px per mm blurs the word up close):
    # the 64 x 60 mm plate, NAVI 6 mm under its top, the tab's outline 32 mm under it, drawn exactly as above
    k2 = 3
    pw2, ph2 = round(64 * S * k2), round(60 * S * k2)
    pl = Image.new("RGBA", (pw2, ph2), (238, 240, 243, 0))
    d2 = ImageDraw.Draw(pl)
    d2.rounded_rectangle((0, 0, pw2 - 1, ph2 - 1), round(6 * S * k2), fill=(238, 240, 243, 255), outline=(214, 217, 221, 255), width=round(0.8 * S * k2))
    nav2 = words([["NAVI", REG]], 13.0 * k2, (196, 199, 204), track=0.06)
    pl.alpha_composite(nav2, ((pw2 - nav2.width) // 2, round(6 * S * k2)))
    tw2, th2 = round(56 * S * k2), round(18 * S * k2)
    d2.rounded_rectangle(((pw2 - tw2) // 2, round(32 * S * k2), (pw2 + tw2) // 2, round(32 * S * k2) + th2), round(5 * S * k2), outline=(150, 154, 160, 255), width=round(1.2 * S * k2))
    save(pl.resize((pw2 // k2, ph2 // k2), Image.LANCZOS), "print_navi.png")


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
