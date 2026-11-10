"""Textures for the Haier HRB-4052BUSA-P (355 L bottom mount, Ultramarine Steel) and the same fridge in Haier's two other
steel colours, HRB-4052BGKA-P (Graphite Black) and HRB-4052BISA-P (Inox Steel).

usage: python3 tex_haier_hrb4052.py <photos dir> <logos dir> <out dir>
  photos (pipeline/sources/photos/haier_hrb4052/):
    inox_front.jpg      Haier India's gallery on the HRB-4052BISA-P page (1200 x 1200), the Inox Steel fridge straight on.
                        It is the only photo of this 1730 mm body: x 398.5-797 for its 623 mm (0.640 px per mm across),
                        rows 50.5-1146.5 from the door's top to the floor under the front right foot for its 1730 mm
                        (0.634 px per mm up). Every height on the front is measured here
    gk_front.jpg        the photo Haier India shows on both the HRB-4052BUSA-P and the HRB-4052BGKA-P pages (byte for byte the
                        same file; named HRB-4053BGK-P). It is of the shorter 1640 mm body (its width against its height says
                        so), so it gives the dark steel's colour and its fall in light down each door only, read over that
                        body's own door heights (fridge 637.5-1640, freezer face 24.5-577, rows 59.5-1141.5)
    rear_4053.jpg       the back straight on (Sangeetha's listing of the HRB-4053BGK-P, 2085 x 2085): also the shorter body,
                        1.0 px per mm; the plain embossed plate above the control box is stretched to this body's height
  logos: haier.png
  writes <out dir>/haier_hrb4052/:
    door_fridge_<f>.jpg, door_freezer_<f>.jpg   the door faces for each photo set (<f> gk = the dark steel of the
        Ultramarine Steel / Graphite Black photos, ix = Inox Steel): a flat colour with fine horizontal streaks (both are
        brushed across, as the photos show) and the photo's own fall in light down each door, read row by row off the
        straight-on photo, held at GAIN_K of its strength (the viewer's light adds the rest). The doors' colour is set here:
        a textured material's colour is ignored.
    channel.jpg         the freezer's recess handle channel, its light read off the Inox front (rows 744-771)
    logo.png            the Haier wordmark, white, from Haier's own logo file
    print_magic_<f>.png MAGICCONVERTIBLE at the fridge door's bottom right: MAGIC heavy, CONVERTIBLE light; white and light
                        grey on the dark steel, dark grey on Inox (as each photo shows)
    display.jpg         the control panel's print on its black glass, unlit (as the dark steel photos show it): the inverter
                        fan, INVERTER, Fridge, Freezer, Auto Set, Power Cool, Turbo Icing, 3 Sec. Lock, set again sharp. The
                        tiny second lines under four of the words can't be read on any photo and are left out; so are the
                        temperature digits and the icon the Inox photo shows lit (they show only when it is on)
    rear.jpg, ctrlbox.jpg   the back: the rear photo cropped to the cabinet, its plain upper plate stretched by 72 mm, and
                        the control box's cover (modelled as a raised box)
    print_cooling.png, print_bottle.png, print_bigbox.png, print_freezebox.png, print_icemaker.png, print_led.png
                        the words inside (MAGIC COOLING with TRIPLE INVERTER & DUAL FAN TECH under it, BOTTLEGUARD, 2XBIGBOX,
                        FREEZEBOX, ICEMAKER, LED LIGHT), set again sharp, as on the HRB-3752 (the same parts, Haier's feature
                        images and the open-door photos). The small icons after the bars can't be read: left out
Every word is set at 7.2 px per mm in Avenir Next.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "haier_hrb4052"
SRC = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
AV = "/System/Library/Fonts/Avenir Next.ttc"
DEMI, REG, BOLD = 2, 7, 0
S = 7.2                                     # px per mm for print
rng = np.random.default_rng(4052)

# ── the photo sets: door colour (RGB, before the viewer's light), streak strength, each door's level, and the photo ──
# Straight-on fronts, as a ratio to the wordmark's white: the dark steel fridge door 0.25-0.28, freezer 0.31 (55-69,
# 62-76, 77-94); Inox fridge door 0.67 / 0.63 (left / right third), freezer 0.55, neutral grey. The bases and levels are
# tuned until the gate's straight-on and 3/4 renders give the same ratios (REVIEW.md). Each photo's door heights are its
# own body's: the dark steel photos show the 1640 mm body, the Inox photo this 1730 mm one.
FINISHES = {
    "gk": {"photo": "gk_front.jpg", "base": (35, 40, 54), "grain": 0.25,
           "level": {"door_fridge": 1.0, "door_freezer": 1.15},
           "rows": (59.5, 1141.5), "cols": (392.5, 809.5), "h_mm": 1640.0,
           "fridge": (637.5, 1640.0), "freezer": (24.5, 577.0)},
    "ix": {"photo": "inox_front.jpg", "base": (121, 121, 122), "grain": 0.5, "bands": 1.1,
           "level": {"door_fridge": 1.01, "door_freezer": 0.92},
           "rows": (50.5, 1146.5), "cols": (398.5, 797.0), "h_mm": 1730.0,
           "fridge": (636.0, 1730.0), "freezer": (28.0, 576.0)},
}
GAIN_K = 0.5
# this fridge's doors (mm from the floor, on the Inox front; the builder uses the same numbers)
FRIDGE = (636.0, 1730.0)                    # the fridge door, its bottom edge to the top
FREEZER_FACE = (28.0, 576.0)                # the freezer door's steel face, under the handle's bar


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def row_profile(f, mm0, mm1, n):
    """The photo's light down a door from mm1 (top) to mm0 (bottom), n samples, relative to its middle half's mean.
    Columns: the door's left and right thirds, which miss the display, the wordmark and the print."""
    g = np.asarray(Image.open(os.path.join(SRC, f["photo"])).convert("L")).astype(float)
    top, floor = f["rows"]
    k = (floor - top) / f["h_mm"]
    x0, x1 = f["cols"]
    w = x1 - x0
    xs = np.r_[int(x0 + 0.06 * w):int(x0 + 0.3 * w), int(x0 + 0.7 * w):int(x1 - 0.06 * w)]
    out = []
    for mm in np.linspace(mm1, mm0, n):
        r = int(round(floor - mm * k))
        out.append(g[max(r - 2, 0):r + 3, xs].mean())
    p = np.array(out)
    p = cv2.GaussianBlur(p[:, None], (1, 0), 3).ravel() if n > 12 else p
    mid = p[n // 4:3 * n // 4].mean()
    return p / mid


def col_profile(f, mm0, mm1, w):
    """The photo's light across a door (left to right), w samples, as a share of its mean: the soft vertical light and
    dark bands of polished steel in Haier's straight front (every row between mm0 and mm1 shows the same bands; rows
    clear of the wordmark, the panel and the print). The outer 12 mm are the doors' rounded edges: held."""
    g = np.asarray(Image.open(os.path.join(SRC, f["photo"])).convert("L")).astype(np.float32)
    top, floor = f["rows"]
    k = (floor - top) / f["h_mm"]
    x0, x1 = f["cols"]
    r0, r1 = int(round(floor - mm1 * k)), int(round(floor - mm0 * k))
    p = g[r0:r1, int(round(x0)):int(round(x1)) + 1].mean(0)
    e = int(round(12 * (x1 - x0) / 623))
    p[:e], p[-e:] = p[e], p[-e - 1]
    kk = np.exp(-0.5 * (np.arange(-30, 31) / 9.0) ** 2); kk /= kk.sum()
    p = np.convolve(np.pad(p, 30, mode="edge"), kk, "same")[30:-30]
    p = np.interp(np.linspace(0, len(p) - 1, w), np.arange(len(p)), p)
    return p / p.mean()


def brushed(w, h, base, grain, gain, across=None):
    """Horizontal brushed metal: long faint streaks across the panel, the row gain (top to bottom) multiplied in."""
    n = rng.normal(0, 1, (h // 2 + 1, 1))
    n = np.repeat(np.repeat(n, w, axis=1), 2, axis=0)[:h, :]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((40, 1.2)))
    a = (np.asarray(img).astype(float) / 255 - 0.5) * 4 * grain + rng.normal(0, 0.5 * grain, (h, w))
    g = np.interp(np.arange(h), np.linspace(0, h - 1, len(gain)), gain)[:, None]
    out = (np.array(base, float)[None, None, :] + a[:, :, None]) * g[:, :, None]
    if across is not None:
        out = out * across[None, :, None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def doors():
    # the fridge door is 1094 mm: 512 x 896 keeps the 3752's 0.82 px per mm up
    for key, f in FINISHES.items():
        for name, part, size in (("door_fridge", "fridge", (512, 896)), ("door_freezer", "freezer", (512, 452))):
            mm0, mm1 = f[part]
            p = row_profile(f, mm0, mm1, 48)
            # the photo's top and bottom 15 mm are the doors' rounded edges and the gaps: hold the next rows' light there
            edge = max(1, int(round(48 * 15 / (mm1 - mm0))))
            p[:edge] = p[edge]
            p[-edge:] = p[-edge - 1]
            gain = 1 + GAIN_K * (p - 1)
            print(key, name, "gain top/mid/bottom", gain[0].round(3), gain[len(gain) // 2].round(3), gain[-1].round(3))
            across = None
            if f.get("bands"):
                # the band rows: the fridge door below the panel (700-1250 mm), the freezer's face clear of its edges
                lo, hi = (700.0, 1250.0) if part == "fridge" else (mm0 + 30, mm1 - 15)
                across = 1 + f["bands"] * (col_profile(f, lo, hi, size[0]) - 1)
                print(key, name, "bands min/max", across.min().round(3), across.max().round(3))
            save(brushed(size[0], size[1], f["base"], f["grain"], gain * f["level"][name], across), f"{name}_{key}.jpg", 86)


def channel():
    # the channel's face from the fridge door's bottom edge (row 743.5) to the handle's bar (row 771.5) on the Inox front,
    # the mean over x 440-760: dark under the fridge door, then its grey face (89-96). Held at 0.85 like the doors
    ph = np.asarray(Image.open(os.path.join(SRC, "inox_front.jpg")).convert("L")).astype(float)
    prof = ph[744:772, 440:760].mean(1)
    col = np.interp(np.linspace(0, len(prof) - 1, 64), np.arange(len(prof)), prof) * 0.85
    img = np.repeat(np.repeat(col[:, None], 8, axis=1)[:, :, None], 3, axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "channel.jpg", 90)


def font(face, px):
    return ImageFont.truetype(AV, px, index=face)


def words(parts, cap_mm, fill, track=0.0, gap=0.0):
    """Words in a row, each [text, face], set large and cropped to the ink; cap height cap_mm at S px per mm.
    fill is one colour or one per part."""
    px = 300
    fills = fill if isinstance(fill[0], tuple) else [fill] * len(parts)
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
    out = Image.new("RGBA", (W, H), fills[0] + (0,))
    x = 0
    for i, fl in zip(ims, fills):
        layer = Image.new("RGBA", i.size, fl + (255,))
        layer.putalpha(i)
        out.alpha_composite(layer, (x, H - i.height))     # baseline: these capitals have no descenders
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
    # Haier's wordmark (logos/haier.png), white on every colour: 58 mm wide on the Inox front (x 578-614.5), its middle
    # 1594 mm up
    al = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA").getchannel("A")
    al = al.crop(al.getbbox())
    w = round(58 * S)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    out = Image.new("RGBA", al.size, (244, 246, 250, 0))
    out.putalpha(al)
    save(out, "logo.png")


def magic():
    # MAGICCONVERTIBLE: 121 mm long (Inox front x 701-778.5), its right end 29 mm in from the hinge edge, its foot 14 mm
    # above the fridge door's bottom edge (rows 727-734.5). On the dark steel MAGIC is white and CONVERTIBLE light grey;
    # on Inox both are dark grey on the steel (about 120 against 155 at the photo's resolution), MAGIC the heavier
    for key, cols in (("gk", ((240, 242, 246), (196, 200, 210))), ("ix", ((62, 64, 68), (90, 92, 96)))):
        im = words([["MAGIC", BOLD], ["CONVERTIBLE", REG]], 9.0, cols, track=0.04, gap=0.02)
        save(pad(fitw(im, 121 * S)), f"print_magic_{key}.png")


def fan_icon(d_mm, ink):
    """The inverter mark: a ring round a four-bladed fan (display, every front)."""
    k = 4
    n = round(d_mm * S * k)
    im = Image.new("L", (n, n), 0)
    dr = ImageDraw.Draw(im)
    c = n / 2
    r = n / 2 - 1
    dr.ellipse((c - r, c - r, c + r, c + r), outline=255, width=round(0.75 * S * k))
    blade = r * 0.62
    for a in range(4):
        t = np.radians(a * 90 + 20)
        pts = []
        for s in np.linspace(0, 1, 18):          # a curved petal from the hub out and back
            ang = t + 0.9 * s
            rad = blade * np.sin(np.pi * s) ** 0.6
            pts.append((c + rad * np.cos(ang), c + rad * np.sin(ang)))
        dr.polygon(pts, fill=255)
    hub = r * 0.13
    dr.ellipse((c - hub, c - hub, c + hub, c + hub), fill=0)
    im = im.resize((n // k, n // k), Image.LANCZOS)
    out = Image.new("RGBA", im.size, ink + (0,))
    out.putalpha(im)
    return out


def display():
    # the control panel: 44 x 249 mm of black glass on the Inox front (x 582-609.5, rows 158-315.5), the fan mark and seven
    # words on it, each at its share of the panel's height, the same on the dark steel and the Inox fronts (8x crops): fan
    # 0.085, INVERTER 0.156, Fridge 0.311, Freezer 0.442, Auto Set 0.661, Power Cool 0.74, Turbo Icing 0.812,
    # 3 Sec. Lock 0.93. The words are white, about 3 mm tall (3 Sec. Lock 22-23 mm long on both fronts)
    Wmm, Hmm = 44.0, 249.0
    w, h = round(Wmm * S), round(Hmm * S)
    im = Image.new("RGBA", (w, h), (10, 10, 12, 255))
    ink = (236, 238, 242)
    def put(t, frac):
        im.alpha_composite(t, ((w - t.width) // 2, round(frac * h - t.height / 2)))
    put(fan_icon(14.0, ink), 0.085)
    put(words([["INVERTER", BOLD]], 1.9, ink, track=0.03), 0.156)
    for text, frac in (("Fridge", 0.311), ("Freezer", 0.442), ("Auto Set", 0.661), ("Power Cool", 0.74), ("Turbo Icing", 0.812), ("3 Sec. Lock", 0.93)):
        put(words([[text, DEMI]], 2.6, ink, track=0.01), frac)
    save(im.convert("RGB"), "display.jpg", 92)


# the back (rear_4053.jpg, 1.0 px per mm): the cabinet x 740-1363.5, its top edge row 231, its underside row 1849.
# The plain plate between rows 245 and 860 (above the control box) is stretched by REAR_ADD rows so the cabinet is this
# body's 1690 mm from its underside (28 mm) to its top (1718 mm); everything below row 860 (the control box at rows
# 880-1278, x 1137-1318, and the compressor bay) keeps its size and its height above the floor
REAR_ROWS = (231, 1849)
REAR_STRETCH = (245, 860)
REAR_ADD = 1690 - (REAR_ROWS[1] - REAR_ROWS[0])


def rear():
    src = cv2.imread(os.path.join(SRC, "rear_4053.jpg"))
    crop = src[REAR_ROWS[0]:REAR_ROWS[1], 740:1364]
    a0, a1 = REAR_STRETCH[0] - REAR_ROWS[0], REAR_STRETCH[1] - REAR_ROWS[0]
    mid = cv2.resize(crop[a0:a1], (crop.shape[1], a1 - a0 + REAR_ADD), interpolation=cv2.INTER_CUBIC)
    full = np.vstack([crop[:a0], mid, crop[a1:]])
    print("rear", full.shape, "added", REAR_ADD, "rows")
    out = cv2.cvtColor(full, cv2.COLOR_BGR2RGB)
    # 1 px per mm is more than the back needs: 0.5 px per mm, as the HRB-3752's rear photo
    im = Image.fromarray((out.astype(float) * 0.9).clip(0, 255).astype(np.uint8)).resize((312, 845), Image.LANCZOS)
    save(im, "rear.jpg", 86)
    # the control box's cover: its flange x 1137-1318, rows 880-1278 (its foot, with the cable's grommet)
    box = cv2.cvtColor(src[880:1279, 1137:1319], cv2.COLOR_BGR2RGB)
    save(Image.fromarray((box.astype(float) * 0.9).clip(0, 255).astype(np.uint8)).resize((128, 280), Image.LANCZOS), "ctrlbox.jpg", 88)


def bar_after(im, grey, gap_mm, h_mm):
    bar = Image.new("RGBA", (max(1, round(0.7 * S)), round(h_mm * S)), grey + (255,))
    out = Image.new("RGBA", (im.width + round(gap_mm * S) + bar.width, max(im.height, bar.height)), grey + (0,))
    out.alpha_composite(im, (0, out.height - im.height - round(0.15 * h_mm * S)))
    out.alpha_composite(bar, (im.width + round(gap_mm * S), 0))
    return out


def inside_words():
    # the same words and sizes as on the HRB-3752 (the same inside parts; open-door photos of this series)
    grey = (92, 96, 102)
    # MAGIC COOLING on the fridge's back wall: 145 mm long, capitals 11 mm; under it TRIPLE INVERTER & DUAL FAN TECH,
    # capitals 2.6 mm, between two short rules
    mc = words([["MAGIC", DEMI], ["COOLING", REG]], 11.0, (78, 82, 88), track=0.03, gap=0.06)
    mc = fitw(mc, 145 * S)
    sub = words([["TRIPLE INVERTER & DUAL FAN TECH", REG]], 2.6, (110, 114, 120), track=0.08)
    rule = round(10 * S)
    out = Image.new("RGBA", (mc.width, mc.height + round(4 * S) + sub.height), grey + (0,))
    out.alpha_composite(mc, (0, 0))
    ys = mc.height + round(4 * S)
    xs = (mc.width - sub.width) // 2
    out.alpha_composite(sub, (xs, ys))
    d = ImageDraw.Draw(out)
    yl = ys + sub.height // 2
    d.line((xs - round(2 * S) - rule, yl, xs - round(2 * S), yl), fill=(150, 154, 160, 255), width=max(1, round(0.3 * S)))
    d.line((xs + sub.width + round(2 * S), yl, xs + sub.width + round(2 * S) + rule, yl), fill=(150, 154, 160, 255), width=max(1, round(0.3 * S)))
    save(pad(out), "print_cooling.png")
    save(pad(bar_after(words([["BOTTLE", DEMI], ["GUARD", REG]], 9.0, grey, gap=0.02), grey, 4, 12)), "print_bottle.png")
    save(pad(bar_after(words([["2XBIG", DEMI], ["BOX", REG]], 10.0, grey, gap=0.02), grey, 4, 13)), "print_bigbox.png")
    save(pad(bar_after(words([["FREEZE", DEMI], ["BOX", REG]], 11.0, grey, gap=0.02), grey, 4, 14)), "print_freezebox.png")
    save(pad(words([["ICE", DEMI], ["MAKER", REG]], 6.5, grey, track=0.03, gap=0.02)), "print_icemaker.png")
    save(pad(words([["LED LIGHT", DEMI]], 4.0, (236, 238, 242), track=0.05)), "print_led.png")


doors()
channel()
logo()
magic()
display()
rear()
inside_words()
