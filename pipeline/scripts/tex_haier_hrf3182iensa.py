"""Textures for the Haier HRF-3182IENSA-P (268 L, top mount frost free, not convertible, flat doors, recess handle, Nickel
Steel), from Haier India's own photos of the IENSA-P (its product page's gallery, saved in pipeline/sources/photos/haier_hrf3182/
as haier_*.jpg). The body, doors and fridge are the HRF-3182IBNS-P's (tex_haier_hrf3182.py); the IENSA-P has no CONVERTIBLE
badge, no convertible panel and no FRUITBOX, and its freezer shows hexagon vents, a slider control and the ice box on the tray.

usage: python3 tex_haier_hrf3182iensa.py <photos dir> <logos dir> <out dir>
  photos: haier_hrf3182/haier_front.jpg   Haier's straight-on front of the IENSA-P (1200 x 1200; the body is x 436-768 for its
                                           548 mm; door top row 84, about 0.625 px per mm up)
          haier_hrf3182/haier_rear.jpg    Haier's straight-on back of the IENSA-P (body x 432-780, rows 79-1120)
          haier_hrf3182/haier_open.jpg    Haier's empty open-door photo of the IENSA-P (the words, vents and control inside)
  logos:  haier.png
  writes <out dir>/haier_hrf3182iensa/:
    door_freezer.jpg, door_fridge.jpg   brushed nickel steel with the IENSA-P front's soft upright light bands
    channel.jpg       the recess handle's channel, its light read off the IENSA-P front (rows 384-410)
    logo.png          the Haier wordmark, white as on the freezer door, from Haier's own logo file
    rear.jpg          the back: Haier's rear photo of the IENSA-P cropped to the cabinet
    print_sliding.png, print_freshbox.png, print_bottleguard.png, print_navi.png, navi_slots.png, arc_temp.png,
    hexrow.png, grid.png   as on the IBNS-P (the same fridge; measured on this photo)
    hexvent3.png, hexvent2.png   the freezer's dark hexagon vents: groups of three on its back panel over the tray, two under it
    fz_control.png    the freezer's slider control: its window and the dark label plates (their small words can't be read:
                      left out)
Every word is set at 7.2 px per mm in Avenir Next (Demi Bold for the first word, Regular for the second, as printed).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "haier_hrf3182"                      # the photos folder (shared with the IBNS-P's sources)
D = os.path.join(OUT, "haier_hrf3182iensa")
os.makedirs(D, exist_ok=True)
AV = "/System/Library/Fonts/Avenir Next.ttc"
DEMI, REG, BOLD = 2, 7, 0
S = 7.2                                     # px per mm for print
rng = np.random.default_rng(31821)

# the doors' silver. Haier's front reads 170 of 255 on average over both doors (0.67 of the page's white, against 0.76 on
# the HRF-3782BNSA-P's front, whose texture is 176): held at 176 x 170 / 194 and tuned against the gate's front render
# (the IBNS-P's front reads 176 over the doors, the IENSA-P's 177: the same steel)
BASE = 141
# Haier's straight front of the IBNS-P reads 172 (the IENSA-P's front: the same bands, 0.5 % apart) over the fridge door and its 3/4s 176-177, all crossed by the same soft
# vertical light and dark bands (the studio's reflection: every row the same, 0.70x at the edges to 1.19x a little right of
# the middle). As on the Whirlpool 22343, most of the bands' depth goes into the texture (BANDS of it); the clear coat and
# hairline map add the gloss and fine brushing. BASE and BANDS tuned on renders at the front and both 3/4 views against
# Haier's (NOTES.md, Look pass)
BANDS = 1.2
FRONT_X, FRONT_ROWS = (436, 768), (651, 1011)        # haier_front.jpg (IENSA-P): the body's columns, rows across the fridge door
FRONT = "haier_front.jpg"


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def steel(w, h, base=BASE, grain=0.8):
    """Vertical brushed steel: long faint streaks (as LG's steel), no baked light. base: a grey or an (r, g, b)."""
    n = rng.normal(0, 1, (1, w // 2 + 1))
    n = np.repeat(np.repeat(n, h, axis=0), 2, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((1.2, 40)))
    a = (np.asarray(img).astype(float) / 255 - 0.5) * 2 * grain * 2 + rng.normal(0, 0.6, (h, w))
    rgb = np.array(base, float) if isinstance(base, tuple) else np.array([base, base, base * 1.006])
    out = rgb[None, None, :] + a[:, :, None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def font(face, px):
    return ImageFont.truetype(AV, px, index=face)


def words(parts, cap_mm, fill, track=0.0, gap=0.0):
    """Words in a row, each [text, face], set at 300 px and cropped to the ink; cap height cap_mm at S px per mm."""
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
    canvas = Image.new("L", (W, H), 0)
    x = 0
    for i in ims:
        canvas.paste(i, (x, H - i.height))      # baseline: no descenders in these capitals
        x += i.width + int(gap * px)
    k = cap_mm * S / capH
    canvas = canvas.resize((max(1, round(W * k)), max(1, round(H * k))), Image.LANCZOS)
    out = Image.new("RGBA", canvas.size, fill + (0,))
    out.putalpha(canvas)
    return out


def pad(im, m=4):
    out = Image.new("RGBA", (im.width + 2 * m, im.height + 2 * m), im.getpixel((0, 0))[:3] + (0,))
    out.alpha_composite(im, (m, m))
    return out


def with_icons(word, n, size_mm, gap_mm, col):
    """The word, then n small dark rounded squares (the printed icons; what they show can't be read)."""
    k = 3
    sq = round(size_mm * S)
    w = word.width + n * (sq + round(gap_mm * S)) + round(gap_mm * S)
    h = max(word.height, sq)
    out = Image.new("RGBA", (w, h), col + (0,))
    out.alpha_composite(word, (0, h - word.height))
    big = Image.new("RGBA", (sq * k, sq * k), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle((0, 0, sq * k - 1, sq * k - 1), radius=round(sq * k * 0.18), fill=col + (255,))
    big = big.resize((sq, sq), Image.LANCZOS)
    x = word.width + round(gap_mm * S)
    for _ in range(n):
        out.alpha_composite(big, (x, h - sq))
        x += sq + round(gap_mm * S)
    return pad(out)


def band_profile(w, photo=FRONT, cols=None, rows=None):
    """the straight front's brightness across the doors, w samples left to right, as a share of its mean"""
    cols, rows = cols or FRONT_X, rows or FRONT_ROWS
    g = np.asarray(Image.open(os.path.join(PHOTOS, SLUG, photo)).convert("L")).astype(np.float32)
    p = g[rows[0]:rows[1], cols[0]:cols[1] + 1].mean(0)
    e = round(len(p) * 0.02)                          # the outermost columns are the doors' dark edges
    p[:e], p[-e:] = p[e], p[-e - 1]
    k = np.exp(-0.5 * (np.arange(-30, 31) / 9.0) ** 2); k /= k.sum()
    p = np.convolve(np.pad(p, 30, mode="edge"), k, "same")[30:-30]
    p = np.interp(np.linspace(0, len(p) - 1, w), np.arange(len(p)), p)
    return p / p.mean()


def doors():
    # the freezer door 478 mm tall, the fridge door's steel face 1098 mm, both 548 mm wide; about 0.93 px per mm (the
    # hairline grain map carries the fine detail). Each colour carries its own front photo's bands
    shade = 1 + BANDS * (band_profile(512) - 1)
    for name, h in (("door_freezer", 448), ("door_fridge", 1024)):
        a = np.asarray(steel(512, h)).astype(float) * shade[None, :, None]
        save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), name + ".jpg", 86)


def channel():
    # the channel's face from the fridge door's top (row 384) to the lip's top edge (row 410), the photo's mean over x
    # 480-720: nearly black (1-12) down to row 401, then lit, rising to 75 at the lip. Held at 0.85 like the doors.
    ph = np.asarray(Image.open(os.path.join(PHOTOS, SLUG, FRONT)).convert("L")).astype(float)
    prof = ph[384:410, 480:720].mean(1)
    col = np.interp(np.linspace(0, len(prof) - 1, 64), np.arange(len(prof)), prof) * 0.85
    img = np.repeat(np.repeat(col[:, None], 8, axis=1)[:, :, None], 3, axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "channel.jpg", 90)


def logo():
    # Haier's wordmark (logos/haier.png), white as on the freezer door: 59 mm wide on the front photo (x 582-618)
    al = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA").getchannel("A")
    al = al.crop(al.getbbox())
    w = round(59 * S)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    out = Image.new("RGBA", al.size, (244, 246, 250, 0))
    out.putalpha(al)
    save(out, "logo.png")


def rear():
    # the cabinet's back: columns 432-780, rows 79-1120 (Haier's rear photo of the IENSA-P; nothing on it is modelled apart)
    im = Image.open(os.path.join(PHOTOS, SLUG, "haier_rear.jpg")).convert("RGB").crop((432, 79, 781, 1121))
    save(Image.fromarray((np.asarray(im).astype(float) * 0.9).clip(0, 255).astype(np.uint8)), "rear.jpg", 86)


def prints():
    # sizes read off the open-door photo against the part they are on: SLIDINGSHELF 133 mm long (capitals 13.5 mm) and
    # its icon 14 mm on the 464 mm rim; FRESHBOX 106 mm (capitals 15 mm) and three icons on the 462 mm box; BOTTLEGUARD
    # about 115 mm (capitals 11 mm) and one icon on its bin
    grey = (92, 96, 102)
    sl = words([["SLIDING", DEMI], ["SHELF", REG]], 13.5, grey, track=0.02, gap=0.03)
    sl = sl.resize((round(133 * S), round(sl.height * 133 * S / sl.width)), Image.LANCZOS)
    save(with_icons(sl, 1, 13.0, 2.5, grey), "print_sliding.png")
    fb = words([["FRESH", DEMI], ["BOX", REG]], 15.0, grey, track=0.02, gap=0.03)
    fb = fb.resize((round(106 * S), round(fb.height * 106 * S / fb.width)), Image.LANCZOS)
    save(with_icons(fb, 3, 13.0, 2.5, grey), "print_freshbox.png")
    bg = words([["BOTTLE", DEMI], ["GUARD", REG]], 11.0, grey, track=0.0, gap=0.03)
    bg = bg.resize((round(115 * S), round(bg.height * 115 * S / bg.width)), Image.LANCZOS)
    save(with_icons(bg, 1, 10.0, 2.0, grey), "print_bottleguard.png")


def navi():
    # the badge: a rounded square outline (70 mm) broken by an arrow at its top right and its bottom middle, NAVI in heavy
    # capitals across it and COOLING & FRESH small under it (open-door photo); the slots: 2 x 5, each 9 x 2.2 mm
    k = 3
    n = round(70 * S * k)
    ink = (52, 54, 58, 255)
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lw = round(1.6 * S * k)
    d.rounded_rectangle((lw, lw, n - 1 - lw, n - 1 - lw), radius=round(11 * S * k), outline=ink, width=lw)
    # the two arrows: a gap in the outline with a small arrowhead at its end
    g = round(9 * S * k)
    for (cx, cy, dx) in [(round(n * 0.72), lw + lw // 2, 1), (round(n * 0.5), n - 1 - lw - lw // 2, -1)]:
        d.rectangle((cx - g // 2, cy - lw, cx + g // 2, cy + lw), fill=(0, 0, 0, 0))
        a = round(3.2 * S * k)
        tip = cx + dx * g // 2
        d.polygon([(tip, cy), (tip - dx * a, cy - a), (tip - dx * a, cy + a)], fill=ink)
    word = words([["NAVI", BOLD]], 15.0, ink[:3], track=0.02)
    word = word.resize((word.width * k, word.height * k), Image.LANCZOS)
    im.alpha_composite(word, ((n - word.width) // 2, round(n * 0.3)))
    sub = words([["COOLING & FRESH", REG]], 3.4, ink[:3], track=0.04)
    sub = sub.resize((sub.width * k, sub.height * k), Image.LANCZOS)
    im.alpha_composite(sub, ((n - sub.width) // 2, round(n * 0.3) + word.height + round(2.4 * S * k)))
    save(im.resize((n // k, n // k), Image.LANCZOS), "print_navi.png")
    w, h = round(24 * S), round(28 * S)
    im = Image.new("RGBA", (w, h), (40, 42, 46, 0))
    d = ImageDraw.Draw(im)
    for c in range(2):
        for r in range(5):
            x, y = (1.5 + c * 12) * S, (1.5 + r * 5.4) * S
            d.rounded_rectangle((x, y, x + 9 * S, y + 2.2 * S), radius=round(0.8 * S), fill=(40, 42, 46, 255))
    save(im, "navi_slots.png")


def arc_temp():
    # the fridge's small knob (about 36 mm across): an arc of seven dots over its top half, about 48 mm across
    k = 3
    n = round(56 * S)
    im = Image.new("RGBA", (n * k, n * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c, r = n * k / 2, 24 * S * k
    for i in range(7):
        t = np.radians(200 + 140 * i / 6)
        x, y = c + r * np.cos(t), c + r * np.sin(t)
        rr = 1.1 * S * k
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(70, 72, 76, 255))
    d.arc((c - r + 2.6 * S * k, c - r + 2.6 * S * k, c + r - 2.6 * S * k, c + r - 2.6 * S * k), 200, 340, fill=(70, 72, 76, 255), width=round(0.6 * S * k))
    save(im.resize((n, n), Image.LANCZOS), "arc_temp.png")


def hexes(n, unit_mm, gap_mm, col, name):
    # a row of n hexagons, each three rhombi (the freezer's vents on the open-door photo)
    k = 3
    u = unit_mm * S * k
    g = gap_mm * S * k
    W = round(n * u + (n - 1) * g + 4 * k)
    Hh = round(u * 0.9 + 4 * k)
    im = Image.new("RGBA", (W, Hh), col[:3] + (0,))
    d = ImageDraw.Draw(im)
    s = 0.6 * S * k                                   # the light seams between the rhombi
    for i in range(n):
        cx, cy = 2 * k + u / 2 + i * (u + g), Hh / 2
        R = u / 2
        P = [(cx + R * np.cos(np.radians(a)), cy + R * 0.9 * np.sin(np.radians(a))) for a in range(-90, 270, 60)]
        C = (cx, cy)
        for j in (0, 2, 4):                           # three rhombi meeting at the centre
            q = [C, P[j], P[(j + 1) % 6], P[(j + 2) % 6]]
            mx, my = sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4
            q = [(mx + (x - mx) * (1 - s / R), my + (y - my) * (1 - s / R)) for x, y in q]
            d.polygon(q, fill=col)
    save(im.resize((W // k, Hh // k), Image.LANCZOS), name)


def hexvents(n, name, col=(86, 88, 94, 255)):
    # the freezer's dark vent openings (IENSA-P open photo and Haier's stocked close-up of it, 0.725 px per mm): each unit
    # a hexagon pointed left and right, 40 mm across and 26 mm tall, cut into an upright diamond in the middle and four
    # slanted pieces round it, with light webs about 1.6 mm wide between them; units side by side, 0.5 mm apart
    k = 4
    u, hh, web = 40 * S * k, 26 * S * k, 1.6 * S * k
    W = round(n * u + (n - 1) * 0.5 * S * k + 2 * k)
    Hh = round(hh + 2 * k)
    im = Image.new("RGBA", (W, Hh), col[:3] + (0,))
    d = ImageDraw.Draw(im)

    def shrink(q, by):
        mx, my = sum(p[0] for p in q) / len(q), sum(p[1] for p in q) / len(q)
        r = max(np.hypot(x - mx, y - my) for x, y in q)
        return [(mx + (x - mx) * (1 - by / r), my + (y - my) * (1 - by / r)) for x, y in q]
    for i in range(n):
        x0, cy = k + i * (u + 0.5 * S * k), Hh / 2
        L, R, T, B = x0, x0 + u, cy - hh / 2, cy + hh / 2
        q1, q3 = x0 + u * 0.25, x0 + u * 0.75            # the hexagon's top and bottom edges run from q1 to q3
        m, dw = x0 + u / 2, u * 0.13                        # the middle diamond, dw either side of the centre
        pieces = [
            [(m, T), (m + dw, cy), (m, B), (m - dw, cy)],                       # the upright diamond
            [(L, cy), (q1, T), (m, T), (m - dw, cy)],                           # upper left
            [(L, cy), (m - dw, cy), (m, B), (q1, B)],                           # lower left
            [(m, T), (q3, T), (R, cy), (m + dw, cy)],                           # upper right
            [(m + dw, cy), (R, cy), (q3, B), (m, B)],                           # lower right
        ]
        for q in pieces:
            d.polygon(shrink(q, web), fill=col)
    save(im.resize((W // k, Hh // k), Image.LANCZOS), name)


def fz_control():
    # the freezer's control at the lower right of its back (IENSA-P open photo, 0.413 px per mm; the stocked close-up):
    # a slider window 36 x 12 mm (light, a dark rim and a dark slider in it), a small arrow under it, then a dark label
    # band 60 x 6 mm, a row of three dark tabs (13, 17 and 14.5 mm) and one small tab (11 mm) under them. The white words
    # on the plates are a pixel or two tall on every photo: left out
    k = 3
    w, h = round(64 * S * k), round(50 * S * k)
    im = Image.new("RGBA", (w, h), (30, 31, 34, 0))
    d = ImageDraw.Draw(im)
    mm = lambda v: v * S * k
    cx = w / 2
    ink = (30, 31, 34, 255)
    d.rounded_rectangle((cx - mm(18), mm(1), cx + mm(18), mm(13)), radius=mm(2), fill=(226, 228, 231, 255), outline=(150, 153, 158, 255), width=round(mm(0.8)))
    d.rounded_rectangle((cx + mm(3), mm(4), cx + mm(9), mm(10)), radius=mm(1), fill=(96, 99, 104, 255))
    d.polygon([(cx, mm(14.5)), (cx - mm(2.2), mm(17.5)), (cx + mm(2.2), mm(17.5))], fill=ink)
    d.rounded_rectangle((cx - mm(30), mm(18), cx + mm(30), mm(24)), radius=mm(1.2), fill=ink)
    x = cx - mm(30)
    for tw in (13, 17, 14.5):
        d.rounded_rectangle((x, mm(31), x + mm(tw), mm(36)), radius=mm(1.2), fill=ink)
        x += mm(tw) + mm((60 - 13 - 17 - 14.5) / 2)
    d.rounded_rectangle((cx + mm(17), mm(40), cx + mm(28), mm(45)), radius=mm(1.2), fill=ink)
    save(im.resize((w // k, h // k), Image.LANCZOS), "fz_control.png")


def grid():
    # the FRESHBOX cover: white ribs 3 mm wide every 6.5 mm from front to back, gaps open (the open-door photo), one cross
    # bar 4 mm wide every 120 mm; drawn for a 512 x 512 tile over the cover (464 x 420 mm)
    w = h = 512
    a = np.zeros((h, w), np.uint8)
    pxmm = w / 464
    x = 0.0
    while x < 464:
        a[:, round(x * pxmm):round((x + 3) * pxmm)] = 255
        x += 6.5
    for y in (2, 120, 240, 360):
        a[round(y * h / 420):round((y + 4) * h / 420), :] = 255
    out = Image.new("RGBA", (w, h), (246, 247, 248, 0))
    out.putalpha(Image.fromarray(a))
    save(out, "grid.png")


doors()
channel()
logo()
rear()
prints()
navi()
arc_temp()
hexes(11, 22, 3, (200, 204, 210, 255), "hexrow.png")
hexvents(3, "hexvent3.png")
hexvents(2, "hexvent2.png")
fz_control()
grid()
