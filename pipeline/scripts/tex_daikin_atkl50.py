"""Textures for the Daikin ATKL50XV16VKA indoor unit (Sangeetha's ATKLRKL50XV16VKA, 1.5 ton 3 star Premium Series).

Every print is redrawn sharp as a decal, so the gloss white front panel itself needs no texture:
  - the Daikin mark from Daikin's own logo file (logos/daikin.png), tinted the mid grey it is printed in on the panel,
    48 mm wide (Sangeetha's straight-on front photo sg_0.jpg, 0.929 px per mm across: ink cols 149-193);
  - Daikin's INVERTER mark (two swooshes round "INVERTER" in heavy italic), 53 mm wide (ink cols 886-934), its shape
    read off the large white INVERTER mark on Sangeetha's photos sg_1..sg_6;
  - the display lamps under the signal receiver: the OPERATION lamp ("I") and the TIMER lamp (a clock), as Daikin's
    operation manual 3P785322-3 (page 2, items 14 and 15) draws them.
Also the two air filters under the front panel (manual page 29) and the top air inlet (six bays of long slots, as the
photo shows them across the top).
usage: python3 tex_daikin_atkl50.py <photos dir> <logos dir> <out dir>
Writes into <out dir>/daikin_atkl50/.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
PRODUCT = "daikin_atkl50"
AVC = "/System/Library/Fonts/Avenir Next Condensed.ttc"
INK = (92, 94, 98)          # the grey of the Daikin mark and the INVERTER badge (photo: darkest 96-103 on a 233-235 panel)
rng = np.random.default_rng(11)


def save(img, name, quality=88):
    os.makedirs(os.path.join(OUT, PRODUCT), exist_ok=True)
    path = os.path.join(OUT, PRODUCT, name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(path, quality=quality, optimize=True)
    else:
        img.save(path, optimize=True)
    print("wrote", path, img.size)


PAD = 8                     # clear pixels round every print, so no edge of the print's square shows when it is filtered


def decal(rgba, name):
    """an RGBA print as a small palette PNG: one ink colour, the alpha carries the shape, with PAD clear pixels all
    round (the builder sizes each decal for the padding)"""
    padded = Image.new("RGBA", (rgba.width + 2 * PAD, rgba.height + 2 * PAD), rgba.getpixel((0, 0))[:3] + (0,))
    padded.paste(rgba, (PAD, PAD))
    rgba = padded
    a = rgba.getchannel("A")
    q = rgba.convert("RGB").quantize(colors=16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    q.putalpha(a)
    save(q, name)


def daikin_mark():
    """Daikin's flag mark and wordmark in the panel's grey (the unit prints it in grey, not in Daikin blue): the
    wordmark and the flag's dark corner in the ink grey, the flag's band a lighter grey, as the photo shows the flag
    as a lighter wedge beside the darker letters"""
    lg = Image.open(os.path.join(LOGOS, "daikin.png")).convert("RGBA")
    lg = lg.crop(lg.getbbox())
    w = 48 * 16                                         # 16 px per mm
    lg = lg.resize((w, round(w * lg.height / lg.width)), Image.LANCZOS)
    a = np.asarray(lg).astype(float)
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = INK
    # Daikin's file: dark corner #231f20, light band #44c8f5, letters #00a0e4; the band is the one with high red+green
    band = (a[..., 1] > 170) & (a[..., 0] > 40)
    out[band, :3] = (150, 152, 156)
    out[..., 3] = a[..., 3].clip(0, 255).astype(np.uint8)
    decal(Image.fromarray(out), "logo.png")


def inverter_badge():
    """Daikin's INVERTER mark, 53 x 8.6 mm: the word in heavy italic capitals between two thin crescent swooshes (upper
    left and lower right) that together read as an oval, as on the large mark in Sangeetha's photos (sg_5: badge 6.3
    times as wide as tall, capitals 57% of its height, each swoosh about 14% of the height at its thickest, tapering to
    points at the left end and just short of the middle)"""
    S, big = 16, 4
    W, H = 53 * S, round(8.6 * S)
    Wb, Hb = W * big, H * big
    cx, cy, rx, ry = Wb / 2, Hb / 2, Wb / 2 - 2 * big, Hb / 2 - 2 * big
    yy, xx = np.mgrid[0:Hb, 0:Wb].astype(float)
    r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    u = (xx - (cx - rx)) / (0.88 * rx)                    # 0 at the left tip, 1 where the swoosh ends (12% short of the middle)
    g = np.where((u > 0) & (u < 1), np.sin(np.pi * np.clip(u, 0, 1)) ** 0.8 * (1 - 0.35 * np.clip(u, 0, 1)), 0)
    t = 0.30 * g                                          # thickness as a share of the radius (about 14% of the height)
    upper = (r <= 1) & (r >= 1 - t) & (yy <= cy + 0.3 * ry)
    sw = upper | upper[::-1, ::-1]
    im = Image.fromarray((sw * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    HN = "/System/Library/Fonts/HelveticaNeue.ttc"
    px = 0.57 * Hb / 0.72
    for _ in range(30):
        f = ImageFont.truetype(HN, round(px), index=3)    # Helvetica Neue Bold Italic
        b = d.textbbox((0, 0), "INVERTER", font=f)
        if abs((b[3] - b[1]) - 0.57 * Hb) < big:
            break
        px *= 0.57 * Hb / (b[3] - b[1])
    tx, ty = cx - (b[0] + b[2]) / 2, cy - (b[1] + b[3]) / 2
    gap = Image.new("L", im.size, 0)
    ImageDraw.Draw(gap).text((tx, ty), "INVERTER", font=f, fill=255, stroke_width=round(0.3 * S * big), stroke_fill=255)
    im = Image.fromarray(np.minimum(np.asarray(im), 255 - np.asarray(gap)))
    ImageDraw.Draw(im).text((tx, ty), "INVERTER", font=f, fill=255)
    print("INVERTER word", round((b[2] - b[0]) / Wb, 2), "of the badge width,", round((b[3] - b[1]) / Hb, 2), "of its height")
    im = im.resize((W, H), Image.LANCZOS)
    out = Image.new("RGBA", (W, H), INK + (0,))
    out.putalpha(im)
    decal(out, "inverter.png")


def lamps():
    """The two lamp marks under the signal receiver, 18 x 8 mm: the OPERATION lamp's "I" and the TIMER lamp's clock,
    each with its small LED window to the right, as Daikin's manual draws them (page 2, items 14 and 15)."""
    S = 24
    W, H = 18 * S, 8 * S
    im = Image.new("RGBA", (W, H), (120, 122, 126, 0))
    d = ImageDraw.Draw(im)
    ink = (120, 122, 126, 255)
    led = (70, 72, 76, 255)
    # row 1: "I" and its lamp
    y1, y2 = 2.0 * S, 6.0 * S
    d.rectangle((3.4 * S, y1 - 1.0 * S, 3.4 * S + 0.45 * S, y1 + 1.0 * S), fill=ink)
    d.rounded_rectangle((7.0 * S, y1 - 0.75 * S, 11.0 * S, y1 + 0.75 * S), radius=0.3 * S, fill=led)
    # row 2: the clock and its lamp
    r = 1.05 * S
    cx, cy = 3.6 * S, y2
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=ink, width=round(0.32 * S))
    d.line((cx, cy, cx, cy - 0.65 * r), fill=ink, width=round(0.28 * S))
    d.line((cx, cy, cx + 0.55 * r, cy), fill=ink, width=round(0.28 * S))
    d.rounded_rectangle((7.0 * S, y2 - 0.75 * S, 11.0 * S, y2 + 0.75 * S), radius=0.3 * S, fill=led)
    decal(im, "lamps.png")


def filters():
    """The two air filters under the front panel, side by side, each a moulded frame with a grid of ribs over a fine
    mesh (manual page 29), with the aluminium fins of the coil showing through."""
    w, h = 1024, 512
    a = np.zeros((h, w, 3))
    fins = np.where((np.arange(w) % 4) < 2, 150.0, 176.0)
    a[:] = np.array([1.0, 1.01, 1.03])[None, None, :] * fins[None, :, None]
    a += rng.normal(0, 3, (h, w, 1))
    m = np.zeros((h, w), bool)
    m[::5, :] = True
    m[:, ::5] = True
    a[m] = a[m] * 0.35 + 232 * 0.65
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    frame, edge = (236, 238, 240), (205, 208, 212)
    d.rectangle((0, 0, w - 1, h - 1), outline=frame, width=16)
    d.rectangle((w // 2 - 10, 0, w // 2 + 10, h), fill=frame)
    d.line((w // 2, 0, w // 2, h), fill=edge, width=2)
    for x0 in (0, w // 2):
        for k in (1, 2, 3):                                  # three cross ribs: four cells across each filter
            x = x0 + k * (w // 2) // 4
            d.rectangle((x - 4, 0, x + 4, h), fill=frame)
        for k in (1, 2):                                     # two ribs along: three cells down
            y = k * h // 3
            d.rectangle((x0 + 8, y - 4, x0 + w // 2 - 8, y + 4), fill=frame)
        cx = x0 + w // 4
        d.rounded_rectangle((cx - 34, h - 60, cx + 34, h - 8), 8, fill=(244, 245, 246), outline=edge, width=3)
    save(img, "filter.jpg", 86)


def top_grille():
    """The air inlet on top, 888 mm across (the end caps excluded) by 160 mm deep: six bays of long slots between
    cross ribs at the places the photo shows them (-409, -279, -164, -47, 74, 188, 304 mm from the centre); the right
    end, over the control box, is closed."""
    W_MM, D_MM = 882.0, 160.0
    s = 1024 / W_MM
    w, h = 1024, 192
    img = Image.new("RGB", (w, h), (243, 244, 245))
    d = ImageDraw.Draw(img)
    X = lambda mm: (mm + W_MM / 2) * s
    ribs = [-409, -279, -164, -47, 74, 188, 304]
    slot = (96, 100, 106)
    rows = 6
    for a, b in zip(ribs[:-1], ribs[1:]):
        for k in range(rows):
            y0 = 14 + k * (h - 28) / rows
            d.rounded_rectangle((X(a) + 5, y0 + 4, X(b) - 5, y0 + (h - 28) / rows - 6), 3, fill=slot)
    img = img.filter(ImageFilter.GaussianBlur(0.5))
    save(img, "top.jpg", 86)


daikin_mark()
inverter_badge()
lamps()
filters()
top_grille()
