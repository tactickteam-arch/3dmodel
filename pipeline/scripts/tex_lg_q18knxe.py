"""Textures for the LG AS-Q18KNXE indoor unit (Sangeetha's Q18KNXEAMLG, 1.5 ton 3 star DUAL Inverter split AC).

Every print is redrawn sharp as a decal, so the gloss white front panel itself needs no texture:
  - the LG mark from LG's own logo file (logos/lg.png), printed in one grey on the panel, with the face's lines left clear (they
    show the white panel through them). 30 mm wide: Sangeetha's front photo sg_0.jpg, 1.01 px per mm across (837 mm over cols
    117-962), ink cols 525-555;
  - "Smart Inverter" in light grey at the right, 59.4 mm wide (ink cols 868-928), in a light sans.
Also the air filter that forms the top inlet (manual "Removing and Replacing the Air Filter", Type 1: lifted out from the top by
its knobs) and the heat exchanger's fins seen under it.
usage: python3 tex_lg_q18knxe.py <logos dir> <out dir>
Writes into <out dir>/lg_q18knxe/.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

LOGOS, OUT = sys.argv[1:3]
PRODUCT = "lg_q18knxe"
HN = "/System/Library/Fonts/HelveticaNeue.ttc"
INK = (88, 90, 93)            # the LG mark (photo: darkest 89 on a 232 panel)
INK_LIGHT = (128, 130, 134)   # "Smart Inverter" (photo: darkest 156 on 229, thin strokes blurred lighter)
PAD = 8                       # clear pixels round every print, so no edge of the print's square shows when it is filtered
rng = np.random.default_rng(7)


def save(img, name, quality=88):
    os.makedirs(os.path.join(OUT, PRODUCT), exist_ok=True)
    path = os.path.join(OUT, PRODUCT, name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(path, quality=quality, optimize=True)
    else:
        img.save(path, optimize=True)
    print("wrote", path, img.size)


def decal(rgba, name):
    """an RGBA print as a small palette PNG with PAD clear pixels all round (the builder sizes each decal for the padding)"""
    padded = Image.new("RGBA", (rgba.width + 2 * PAD, rgba.height + 2 * PAD), rgba.getpixel((0, 0))[:3] + (0,))
    padded.paste(rgba, (PAD, PAD))
    a = padded.getchannel("A")
    q = padded.convert("RGB").quantize(colors=16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    q.putalpha(a)
    save(q, name)
    return q.size


def lg_mark():
    """LG's file: the face in red (165,0,52) with white lines, the letters in grey (107,108,107). On the panel the whole mark
    is one grey, the face's lines left clear."""
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    lg = lg.crop(lg.getbbox())
    w = 30 * 16                                          # 16 px per mm
    lg = lg.resize((w, round(w * lg.height / lg.width)), Image.LANCZOS)
    a = np.asarray(lg).astype(float)
    lum = a[..., :3].mean(2)
    alpha = a[..., 3] * np.clip((215 - lum) / 60, 0, 1)  # white (the face's lines and the ground) -> clear
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = INK
    out[..., 3] = alpha.clip(0, 255).astype(np.uint8)
    size = decal(Image.fromarray(out), "logo.png")
    print("LG mark", lg.size, "-> with padding", size)


def smart_inverter():
    """"Smart Inverter" as printed at the panel's lower right, 59.4 mm wide"""
    S, big = 16, 4
    W = round(59.4 * S)
    f = ImageFont.truetype(HN, 100, index=7)              # Helvetica Neue Light
    b = ImageDraw.Draw(Image.new("L", (10, 10))).textbbox((0, 0), "Smart Inverter", font=f)
    px = 100 * W * big / (b[2] - b[0])
    f = ImageFont.truetype(HN, round(px), index=7)
    b = ImageDraw.Draw(Image.new("L", (10, 10))).textbbox((0, 0), "Smart Inverter", font=f)
    im = Image.new("L", (b[2] - b[0] + 4, b[3] - b[1] + 4), 0)
    ImageDraw.Draw(im).text((2 - b[0], 2 - b[1]), "Smart Inverter", font=f, fill=255)
    im = im.resize((W, round(W * im.height / im.width)), Image.LANCZOS)
    out = Image.new("RGBA", im.size, INK_LIGHT + (0,))
    out.putalpha(im)
    size = decal(out, "smartinv.png")
    print("Smart Inverter", im.size, "=", round(im.width / S, 1), "x", round(im.height / S, 1), "mm; with padding", size)


def top_filter():
    """The air filter lying in the top inlet, 819 x 136 mm: a moulded white frame with cross ribs over a fine mesh; the dark
    fins of the coil show through the mesh."""
    w, h = 1024, 256
    a = np.zeros((h, w, 3))
    fins = np.where((np.arange(w) % 3) == 0, 70.0, 104.0)
    a[:] = fins[None, :, None] * np.array([1.0, 1.01, 1.03])[None, None, :]
    a += rng.normal(0, 3, (h, w, 1))
    m = np.zeros((h, w), bool)
    m[::4, :] = True
    m[:, ::4] = True
    a[m] = a[m] * 0.25 + 236 * 0.75
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    frame, edge = (240, 241, 243), (210, 212, 216)
    d.rectangle((0, 0, w - 1, h - 1), outline=frame, width=14)
    for k in range(1, 12):                                  # cross ribs, about every 68 mm
        x = round(k * w / 12)
        d.rectangle((x - 5, 0, x + 5, h), fill=frame)
        d.line((x + 5, 0, x + 5, h), fill=edge, width=1)
    for y in (h // 3, 2 * h // 3):                          # two ribs along
        d.rectangle((14, y - 4, w - 14, y + 4), fill=frame)
    img = img.filter(ImageFilter.GaussianBlur(0.4))
    save(img, "filter.jpg", 86)


def coil():
    """The heat exchanger's aluminium fins under the filter"""
    w, h = 1024, 128
    x = np.arange(w)
    fins = 96 + 44 * (np.cos(x * np.pi / 1.5) > 0.3)
    a = np.repeat(fins[None, :], h, 0)[..., None] * np.array([1.0, 1.0, 1.02])[None, None, :]
    a += rng.normal(0, 4, (h, w, 1))
    for y in (h // 4, 3 * h // 4):                          # the copper tubes' rows seen through the fins
        a[y - 3:y + 3] *= 0.8
    save(Image.fromarray(a.clip(0, 255).astype(np.uint8)), "coil.jpg", 84)


lg_mark()
smart_inverter()
top_filter()
coil()
