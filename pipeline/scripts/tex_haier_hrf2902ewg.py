"""Textures for the Haier HRF-2902EWG-P (240 L frost-free double door, Wave Glass: black glass doors with Haier's print).

usage: python3 tex_haier_hrf2902ewg.py <photos dir> <logos dir> <out dir> [--compare]
  photos (pipeline/sources/photos/haier_hrf2902ewg/, Haier India's own gallery for this code, 1200 x 1200):
    g01_front.jpg   closed, straight on: the body x 414-786 for its 548 mm (0.679 px per mm), the door top row 70, the
                    floor row 1139 (0.685 px per mm up). Freezer glass rows 72-401 (its lit bottom edge 402-403), the gap
                    404-411, the fridge glass's lit top edge 412-414, its print rows 415-1110. The Haier mark x 581-621,
                    rows 119-131. The black of the glass reads (10, 10, 17) top to bottom: no studio veil to take out.
    g05_open.jpg    open and empty: the words inside (NAVI, the dial, FRESHBOX, BOTTLEGUARD) for their size and colour
    g07_freezer_closeup.jpg  the freezer's COOL PACK plate from above (its moulded corner marks and words)
  logos: haier.png (Haier's own wordmark)
  writes <out dir>/haier_hrf2902ewg/:
    door_freezer.jpg, door_fridge.jpg   the print on each door's glass, the Haier mark painted out (it is a sharp decal).
                    0.68 px per mm is all the detail Haier's front has; enlarged 3 x with Lanczos for filtering only.
    logo.png        the Haier wordmark in the front's white
    print_navi.png  the NAVI badge on the fridge's back panel (NAVI, COOLING & FRESH, its frame with two arrow notches);
                    the five lines of small print under it can't be read on any photo: left out
    print_dial.png  the numbers 1-7 and their arc round the temperature knob, and "Temp Control" under it; the two words at
                    the arc's ends can't be read for sure: left out
    print_fresh.png FRESHBOX on the vegetable box's front (its three small icons can't be read: left out)
    print_bottle.png BOTTLEGUARD on the bottle rack's front (its small icon left out)
    print_glass.png TOUGHENED GLASS, printed on each fridge shelf's glass near its front (g07, and Haier's feature image)
    coolpack.jpg    the top of the freezer's COOL PACK plate: white plastic, an inset border, eight moulded corner marks and
                    "COOL PACK" between two snowflakes, moulded (relief drawn as light and shade; sizes ESTIMATED off g07)
"""
import os
import site
import sys

site.addsitedir(os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = "--compare" in sys.argv
SLUG = "haier_hrf2902ewg"
P = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
AV = "/System/Library/Fonts/Avenir Next.ttc"
FRONT = os.path.join(P, "g01_front.jpg")
X0, X1 = 416, 785                  # print columns [X0, X1): the outer column each side is the glass's lit edge
FZ = (72, 402)                     # freezer print rows
FR = (415, 1110)                   # fridge print rows
LOGO_BOX = (578, 116, 625, 134)    # the Haier mark, padded
UP = 3
SHADE = 1.0                        # the print on black glass: kept as photographed (tuned on the gate's renders)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def doors():
    src = np.asarray(Image.open(FRONT).convert("RGB")).copy()
    mask = np.zeros(src.shape[:2], np.uint8)
    x0, y0, x1, y1 = LOGO_BOX
    mask[y0:y1, x0:x1] = 255
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(src, cv2.COLOR_RGB2BGR), mask, 4, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)

    def door(rows, name):
        a = clean[rows[0]:rows[1], X0:X1].astype(float) * SHADE
        img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
        img = img.resize((img.width * UP, img.height * UP), Image.LANCZOS)
        save(img, name, q=86)
        return img

    fz = door(FZ, "door_freezer.jpg")
    fr = door(FR, "door_fridge.jpg")
    if COMPARE:
        ph = Image.open(FRONT).convert("RGB")
        a = ph.crop((X0, FZ[0], X1, FZ[1])); b = fz.resize(a.size)
        c = ph.crop((X0, FR[0], X1, FR[1])); d = fr.resize(c.size)
        sheet = Image.new("RGB", (a.width * 2 + 10, a.height + c.height + 10), "white")
        sheet.paste(a, (0, 0)); sheet.paste(b, (a.width + 10, 0)); sheet.paste(c, (0, a.height + 10)); sheet.paste(d, (a.width + 10, a.height + 10))
        sheet.save(os.path.join(D, "_compare.png"))


def logo():
    # Haier's own wordmark, white as on the door (the photo's ink reads 236-246); 59 mm wide, at 7.2 px per mm
    lg = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")
    al = lg.getchannel("A")
    al = al.crop(al.getbbox())
    w = round(59 * 7.2)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    out = Image.new("RGBA", al.size, (240, 242, 246, 0))
    out.putalpha(al)
    save(out, "logo.png")
    print("logo aspect", round(al.width / al.height, 4))


def text_img(s, font, px, fill, track=0.0):
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


def fit(img, w):
    return img.resize((w, max(1, round(img.height * w / img.width))), Image.LANCZOS)


def two_tone(a, b, ca, cb, font, track, mm_w, name, S=7.2):
    """Two words set as one (FRESH+BOX, BOTTLE+GUARD), each in its own grey, fitted to mm_w."""
    ta = text_img(a, font, 200, ca, track)
    tb = text_img(b, font, 200, cb, track)
    gap = round(200 * track)
    h = max(ta.height, tb.height)
    im = Image.new("RGBA", (ta.width + gap + tb.width, h), (0, 0, 0, 0))
    im.alpha_composite(ta, (0, h - ta.height)); im.alpha_composite(tb, (ta.width + gap, h - tb.height))
    save(fit(im, round(mm_w * S)), name)


def words():
    S, k = 7.2, 3
    # NAVI badge: 50 mm square on g05 (its frame x 316-391 of the 2x crop: 37 px at about 0.6 px per mm), dark grey
    n = round(50 * S * k)
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    col = (88, 92, 98, 255)
    lw = round(1.4 * S * k)
    d.rounded_rectangle((lw, lw, n - 1 - lw, n - 1 - lw), radius=round(8 * S * k), outline=col, width=lw)
    # the frame is cut by two small arrows: on the top edge right of the middle (pointing right) and on the bottom edge
    # left of the middle (pointing left), as on g05
    for (cx, cy, dirn) in ((0.56, lw * 1.5, 1), (0.44, n - 1 - lw * 1.5, -1)):
        x = cx * n
        d.rectangle((x - 0.05 * n, cy - lw * 1.6, x + 0.05 * n, cy + lw * 1.6), fill=(0, 0, 0, 0))
        tip = x + dirn * 0.06 * n
        d.polygon([(tip, cy), (x - dirn * 0.02 * n, cy - 0.05 * n), (x - dirn * 0.02 * n, cy + 0.05 * n)], fill=col)
    t = fit(text_img("NAVI", (AV, 5), 300, col[:3], track=0.02), round(n * 0.66))
    im.alpha_composite(t, ((n - t.width) // 2, round(n * 0.30)))
    t2 = fit(text_img("COOLING & FRESH", (AV, 5), 200, col[:3], track=0.04), round(n * 0.66))
    im.alpha_composite(t2, ((n - t2.width) // 2, round(n * 0.30) + t.height + round(n * 0.06)))
    save(im.resize((n // k, n // k), Image.LANCZOS), "print_navi.png")

    # the dial's print: 80 x 62 mm round a knob of 18 mm radius: an arc at r 23 mm from 200 to -20 degrees, the numbers
    # 1-7 at r 29 mm, "Temp Control" under the knob (g05: knob centre (475, 635), the arc and numbers, the words below)
    w, h = round(80 * S * k), round(62 * S * k)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx, cy = w / 2, round(30 * S * k)
    r = 23 * S * k
    d.arc((cx - r, cy - r, cx + r, cy + r), start=160, end=380, fill=(110, 114, 120, 255), width=round(0.9 * S * k))
    f = ImageFont.truetype(AV, round(4.2 * S * k), index=5)
    for i in range(7):
        a = np.radians(200 - i * 220 / 6)
        x, y = cx + 29 * S * k * np.cos(a), cy - 29 * S * k * np.sin(a)
        d.text((x, y), str(i + 1), font=f, fill=(110, 114, 120, 255), anchor="mm")
    t = fit(text_img("Temp Control", (AV, 7), 200, (120, 124, 130), track=0.02), round(26 * S * k))
    im.alpha_composite(t, (round(cx - t.width / 2), round(cy + 26 * S * k)))
    save(im.resize((w // k, h // k), Image.LANCZOS), "print_dial.png")

    # FRESHBOX: 92 mm wide on the box's front (g05); FRESH dark grey, BOX light grey
    two_tone("FRESH", "BOX", (84, 88, 94), (150, 154, 160), (AV, 5), 0.04, 92, "print_fresh.png")
    # BOTTLEGUARD: 0.30 of the rack's width on g05 (about 135 mm on the 446 mm rack); BOTTLE darker, GUARD lighter
    two_tone("BOTTLE", "GUARD", (96, 100, 106), (150, 154, 160), (AV, 5), 0.03, 135, "print_bottle.png")
    # TOUGHENED GLASS on the shelves: widely spaced capitals, about 113 mm (g07), a dark grey-green
    save(fit(text_img("TOUGHENED GLASS", (AV, 0), 200, (64, 78, 78), track=0.35), round(113 * S)), "print_glass.png")


def coolpack():
    # the plate's top: 470 x 400 mm (built size), 2 px per mm, white plastic; an inset rim 15 mm in; eight moulded corner
    # marks (arms 35 mm, 5 mm wide), the back four turned as top corners, the front four as bottom corners; "COOL PACK"
    # 190 mm wide between two snowflakes, its middle 80 mm behind the front edge (g07; all ESTIMATED)
    S = 2.0
    W, H = round(470 * S), round(400 * S)
    hmap = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(hmap)
    m = round(15 * S)
    d.rectangle((m, m, W - m, H - m), outline=255, width=round(2 * S))
    arm, th = 35 * S, 5 * S
    for row, (v, top) in enumerate(((0.12, True), (0.55, False))):
        us = (0.15, 0.38, 0.58, 0.81) if top else (0.125, 0.36, 0.575, 0.82)
        y = v * H
        for i, u in enumerate(us):
            x = u * W
            right = i % 2 == 1          # the pair's right mark mirrors the left
            sx = -1 if right else 1
            # horizontal arm
            xa, xb = sorted((x, x + sx * arm))
            if top:
                d.rectangle((xa, y, xb, y + th), fill=255)
                d.rectangle((min(x, x + sx * th), y, max(x, x + sx * th), y + arm), fill=255)
            else:
                d.rectangle((xa, y + arm - th, xb, y + arm), fill=255)
                d.rectangle((min(x, x + sx * th), y, max(x, x + sx * th), y + arm), fill=255)
    t = text_img("COOL PACK", (AV, 5), 200, (255, 255, 255), track=0.06)
    t = fit(t, round(150 * S))
    flake = Image.new("L", (round(16 * S), round(16 * S)), 0)
    fd = ImageDraw.Draw(flake)
    c = flake.width / 2
    for a in range(0, 180, 60):
        r = np.radians(a)
        fd.line((c - c * np.cos(r), c - c * np.sin(r), c + c * np.cos(r), c + c * np.sin(r)), fill=255, width=round(1.6 * S))
    yt = round(H - 80 * S - t.height / 2)
    xt = (W - t.width) // 2
    hmap.paste(255, (xt, yt), t.getchannel("A"))
    hmap.paste(flake, (xt - flake.width - round(10 * S), yt + (t.height - flake.height) // 2), flake)
    hmap.paste(flake, (xt + t.width + round(10 * S), yt + (t.height - flake.height) // 2), flake)
    # relief as light and shade: lit from the front-top (the room), a soft edge
    hm = np.asarray(hmap.filter(ImageFilter.GaussianBlur(1.2)), float) / 255
    gy = np.zeros_like(hm); gy[1:-1] = hm[2:] - hm[:-2]
    gx = np.zeros_like(hm); gx[:, 1:-1] = hm[:, 2:] - hm[:, :-2]
    base = 236.0
    img = base + 48 * gy - 12 * gx - 4 * hm
    img = np.repeat(img[..., None], 3, 2) * np.array([1.0, 1.005, 1.012])
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "coolpack.jpg", q=86)


doors()
logo()
words()
coolpack()
