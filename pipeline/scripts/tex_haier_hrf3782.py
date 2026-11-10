"""Textures for the Haier HRF-3782BNSA-P (328 L, Nickel Steel, top mount, recess handle) and its two other colours,
Graphite Black (HRF-3782BGK-P) and GE Black (HRF-3782BGB-P).

usage: python3 tex_haier_hrf3782.py <photos dir> <logos dir> <out dir>
  photos: haier_hrf3782/haier_front.jpg   Haier India's straight-on front (1200 x 1200; the body is x 394.5-805.5 for its
                                           623 mm, 0.660 px per mm across; rows 74-1140 for its 1640 mm, 0.650 px per mm up)
          haier_hrf3782/haier_rear.jpg    Haier's straight-on back (body x 397-806, rows 80-1129)
          haier_hrf3782/haier_open.jpg    Haier's open-door photo (the words inside)
          haier_hrf3782/bgk_front.jpg, bgb_front.jpg   Haier's straight-on fronts of the Graphite Black and the GE Black
  logos:  haier.png
  writes <out dir>/haier_hrf3782/:
    door_freezer.jpg, door_fridge.jpg   brushed nickel steel: fine vertical streaks on a flat silver. Haier's photos show
                                         only the studio's reflection across the doors (bright down the middle, darker at
                                         both edges, the same on every row), so no light is baked in: the viewer's light
                                         makes the reflection
    door_freezer_gk.jpg, door_fridge_gk.jpg, door_freezer_gb.jpg, door_fridge_gb.jpg   the same brushing on the
                      Graphite Black (a dark blue-grey) and the GE Black (a dark neutral grey)
    channel.jpg       the recess handle's channel, its light read off the front photo (dark under the freezer door, lit
                      towards the fridge door's lip)
    logo.png          the Haier wordmark, white as on the door, from Haier's own logo file
    print_magic.png   MAGICCONVERTIBLE, printed white at the bottom right of the freezer door, set again sharp
    rear.jpg          the back: Haier's rear photo cropped to the cabinet, the cable from the control box painted out (it is
                      modelled)
    ctrlbox.jpg       the control box's cover on the back (it is modelled as a raised box)
    dial_zone.png, dial_cooling.png   the MAGIC ZONE and MAGIC COOLING knobs' faces, set again sharp
    arc_zone.png, arc_cooling.png     the scale arcs round those knobs (their small words can't be read: left out)
    print_icemaker.png, print_freshbox.png, print_bottleguard.png   the words inside, set again sharp (the small icons
                      after them can't be read: left out)
    dots.png          the vent's 3 x 4 dots on the fridge's top duct
Every word is set at 7.2 px per mm in Avenir Next (Demi Bold for the first word, Regular for the second, as printed).
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "haier_hrf3782"
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
AV = "/System/Library/Fonts/Avenir Next.ttc"
DEMI, REG, BOLD = 2, 7, 0
S = 7.2                                     # px per mm for print
rng = np.random.default_rng(3782)

# the doors' silver. Haier's straight front reads 196 over the fridge door and its 3/4s 174, all crossed by the same soft
# vertical light and dark bands (the studio's reflection: every row the same, 0.82x at the edges to 1.15x a little left
# of the middle). As on the Whirlpool 22343, most of the bands' depth goes into the texture (BANDS of it) and the clear
# coat and hairline map add the gloss and fine brushing. BASE and BANDS tuned on renders at the front and both 3/4 views
# against Haier's (NOTES.md, Look pass)
BASE = 150
BANDS = 1.1
FRONT_X, FRONT_ROWS = (395, 805), (652, 1019)        # haier_front.jpg: the body's columns, rows across the fridge door
# the other colours, from their own fronts' mean over both doors: Graphite Black (71, 78, 95), GE Black (71, 71, 71)
# (bgk_front.jpg, bgb_front.jpg). Held at the Nickel Steel's 176 / 201 their front renders read 8 to 12 % over the photos
# (the clear coat's reflection adds about the same light on any colour: render = 1.09 x texture + 9 fits the three), so
# each is (photo - 9) / 1.09; the GE Black 3 more in blue, as its first render read 3 warm
COLOURS = {
    "gk": tuple(round((c - 9) / 1.09) for c in (71, 78, 95)),
    "gb": tuple(round((c - 9) / 1.09) + d for c, d in ((71, 0), (71, 0), (71, 3))),
}


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def steel(w, h, base=BASE, grain=0.8):
    """Vertical brushed steel: long faint streaks (as LG's steel), no baked light."""
    n = rng.normal(0, 1, (1, w // 2 + 1))
    n = np.repeat(np.repeat(n, h, axis=0), 2, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((1.2, 40)))
    a = (np.asarray(img).astype(float) / 255 - 0.5) * 2 * grain * 2 + rng.normal(0, 0.6, (h, w))
    out = np.repeat((base + a)[:, :, None], 3, axis=2) * np.array([1.0, 1.0, 1.006])
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def font(face, px):
    return ImageFont.truetype(AV, px, index=face)


def words(parts, cap_mm, fill, track=0.0, gap=0.0):
    """Words in a row, each [text, face], set at 3x and cropped to the ink; cap height cap_mm at S px per mm."""
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


def band_profile(w):
    """the straight front's brightness across the doors, w samples left to right, as a share of its mean"""
    g = np.asarray(Image.open(os.path.join(PHOTOS, SLUG, "haier_front.jpg")).convert("L")).astype(np.float32)
    p = g[FRONT_ROWS[0]:FRONT_ROWS[1], FRONT_X[0]:FRONT_X[1] + 1].mean(0)
    e = round(len(p) * 0.02)                          # the outermost columns are the doors' dark edges
    p[:e], p[-e:] = p[e], p[-e - 1]
    k = np.exp(-0.5 * (np.arange(-30, 31) / 9.0) ** 2); k /= k.sum()
    p = np.convolve(np.pad(p, 30, mode="edge"), k, "same")[30:-30]
    p = np.interp(np.linspace(0, len(p) - 1, w), np.arange(len(p)), p)
    return p / p.mean()


def doors():
    # the freezer door 525 mm tall, the fridge door's steel face 1027 mm (front photo rows 457-1123), both 623 mm wide;
    # about 0.82 px per mm (the hairline grain map carries the fine detail). The Nickel Steel carries the front photo's
    # bands; each other colour is the same brushing moved onto its own colour, flat (their fronts match flat)
    shade = 1 + BANDS * (band_profile(512) - 1)
    for name, h in (("door_freezer", 432), ("door_fridge", 844)):
        im = steel(512, h)
        save(Image.fromarray((np.asarray(im).astype(float) * shade[None, :, None]).clip(0, 255).astype(np.uint8)), name + ".jpg", 86)
        a = np.asarray(im).astype(float) - np.array([BASE, BASE, BASE * 1.006])
        for tag, rgb in COLOURS.items():
            save(Image.fromarray((a + np.array(rgb, float)).clip(0, 255).astype(np.uint8)), f"{name}_{tag}.jpg", 86)


def channel():
    # the channel's face from the fridge door's top (row 418) to the lip (row 445), the photo's mean over x 470-730:
    # 12 rows dark under the freezer door, then the light rising to 171 at the lip. Held at 0.85 like the doors.
    ph = np.asarray(Image.open(os.path.join(PHOTOS, SLUG, "haier_front.jpg")).convert("L")).astype(float)
    prof = ph[418:446, 470:730].mean(1)
    col = np.interp(np.linspace(0, len(prof) - 1, 64), np.arange(len(prof)), prof) * 0.85
    img = np.repeat(np.repeat(col[:, None], 8, axis=1)[:, :, None], 3, axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "channel.jpg", 90)


def logo():
    # Haier's wordmark (logos/haier.png), white as on the freezer door: 60 mm wide on the front photo (x 579-618)
    al = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA").getchannel("A")
    al = al.crop(al.getbbox())
    w = round(60 * S)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    out = Image.new("RGBA", al.size, (244, 246, 250, 0))
    out.putalpha(al)
    save(out, "logo.png")
    print("logo aspect", round(al.width / al.height, 3))


def magic():
    # MAGICCONVERTIBLE at the freezer door's bottom right: 124 mm long, capitals 9 mm (front photo x 712-794, rows
    # 402-408); MAGIC heavy, CONVERTIBLE light, both white, no space between
    im = words([["MAGIC", BOLD], ["CONVERTIBLE", REG]], 9.0, (242, 244, 247), track=0.04, gap=0.04)
    im = im.resize((round(124 * S), round(im.height * 124 * S / im.width)), Image.LANCZOS)
    save(pad(im), "print_magic.png")


def rear():
    # the cabinet's back from its underside (25 mm) to its top (1628 mm): rows 1129 - mm * 0.640, so rows 87-1113;
    # columns 397-806. The cable from the control box to the compressor bay (traced: x 719-748, rows 745-1000) is painted out
    src = cv2.imread(os.path.join(PHOTOS, SLUG, "haier_rear.jpg"))
    g = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY)
    mask = np.zeros(g.shape, np.uint8)
    pts = [(719, 748), (720, 770), (724, 790), (727, 815), (731, 835), (735, 855), (739, 885), (741, 915), (744, 945), (746, 975), (748, 997)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cv2.line(mask, (x0, y0), (x1, y1), 255, 9)
    mask &= ((g < 110) * 255).astype(np.uint8)
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    clean = cv2.inpaint(src, mask, 5, cv2.INPAINT_TELEA)
    crop = cv2.cvtColor(clean[87:1114, 397:807], cv2.COLOR_BGR2RGB)
    img = Image.fromarray((crop.astype(float) * 0.9).clip(0, 255).astype(np.uint8))
    save(img, "rear.jpg", 86)
    # the control box's cover: x 662-772, rows 506-748
    box = cv2.cvtColor(src[506:749, 662:773], cv2.COLOR_BGR2RGB)
    save(Image.fromarray((box.astype(float) * 0.9).clip(0, 255).astype(np.uint8)), "ctrlbox.jpg", 88)


def fitw(t, maxw):
    return t if t.width <= maxw else t.resize((round(maxw), round(t.height * maxw / t.width)), Image.LANCZOS)


def dial(top, bottom, name, d_mm=92, cap_top=0.18, cap_bot=0.12):
    # a knob's face: a light grey disc, the first word Demi Bold, the second Regular, dark grey. On the open-door photo the
    # words fill about three quarters of the face, the first word's capitals about 0.18 of it, the second's 0.12-0.14
    n = round(d_mm * S)
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    dr.ellipse((0, 0, n - 1, n - 1), fill=(236, 238, 240, 255))
    ink = (58, 60, 64)
    a = fitw(words([[top, DEMI]], d_mm * cap_top, ink, track=0.02), n * 0.74)
    b = fitw(words([[bottom, REG]], d_mm * cap_bot, ink, track=0.02), n * 0.74)
    gap = round(n * 0.05)
    y0 = (n - a.height - gap - b.height) // 2
    im.alpha_composite(a, ((n - a.width) // 2, y0))
    im.alpha_composite(b, ((n - b.width) // 2, y0 + a.height + gap))
    save(im, name)


def arc(name, start, end, r_mm=70, ticks=5):
    # the scale round a knob: a thin dark arc with dots at its ends and ticks along it (open-door photo); the tiny words
    # at its ends can't be read on any photo and are left out
    m = r_mm + 6
    n = round(2 * m * S)
    k = 3
    im = Image.new("RGBA", (n * k, n * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = n * k / 2
    r = r_mm * S * k
    ink = (70, 72, 76, 255)
    d.arc((c - r, c - r, c + r, c + r), start, end, fill=ink, width=round(1.0 * S * k))
    for i in range(ticks):
        t = np.radians(start + (end - start) * i / (ticks - 1))
        x, y = c + r * np.cos(t), c + r * np.sin(t)
        rr = (1.6 if i in (0, ticks - 1) else 1.0) * S * k
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=ink)
    save(im.resize((n, n), Image.LANCZOS), name)


def inside_words():
    # sizes read off the open-door photo against the part they are on: ICEMAKER about 70 mm long on the 150 mm ice maker,
    # FRESHBOX 107 mm on the 515 mm box (capitals 14 mm), BOTTLEGUARD about 120 mm on its bin
    grey = (92, 96, 102)
    save(pad(words([["ICE", DEMI], ["MAKER", REG]], 9.5, grey, track=0.03, gap=0.05)), "print_icemaker.png")
    fb = words([["FRESH", DEMI], ["BOX", REG]], 14.0, grey, track=0.03, gap=0.05)
    bar = Image.new("RGBA", (round(0.9 * S), round(17 * S)), grey + (255,))
    out = Image.new("RGBA", (fb.width + round(5 * S) + bar.width, max(fb.height, bar.height)), grey + (0,))
    out.alpha_composite(fb, (0, out.height - fb.height - round(1.2 * S)))
    out.alpha_composite(bar, (fb.width + round(5 * S), 0))
    save(pad(out), "print_freshbox.png")
    bg = words([["BOTTLE", DEMI], ["GUARD", REG]], 11.0, grey, track=0.0, gap=0.04)
    out = Image.new("RGBA", (bg.width + round(4 * S) + bar.width, max(bg.height, bar.height)), grey + (0,))
    out.alpha_composite(bg, (0, out.height - bg.height - round(1.2 * S)))
    out.alpha_composite(bar, (bg.width + round(4 * S), 0))
    save(pad(out), "print_bottleguard.png")
    # the top duct's vent: 3 rows of 4 dark dots, 3.5 mm apart
    n = (round(16 * S), round(12 * S))
    im = Image.new("RGBA", n, (40, 42, 46, 0))
    d = ImageDraw.Draw(im)
    for i in range(4):
        for j in range(3):
            x, y = (2.5 + i * 3.6) * S, (2.4 + j * 3.6) * S
            d.ellipse((x - 1.1 * S, y - 1.1 * S, x + 1.1 * S, y + 1.1 * S), fill=(40, 42, 46, 255))
    save(im, "dots.png")


doors()
channel()
logo()
magic()
rear()
dial("MAGIC", "ZONE", "dial_zone.png")
dial("MAGIC", "COOLING", "dial_cooling.png", cap_bot=0.14)
arc("arc_zone.png", 0, 180, 67)            # the freezer's: round the knob's lower half, 67 mm out (open-door photo)
arc("arc_cooling.png", 180, 360, 68)        # the fridge's: round its upper half, 68 mm out
inside_words()
