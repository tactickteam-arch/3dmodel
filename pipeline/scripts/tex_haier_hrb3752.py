"""Textures for the Haier HRB-3752BNSA-P (325 L bottom mount, Nickel Steel) and its Graphite Black sibling HRB-3752BGKA-P.

usage: python3 tex_haier_hrb3752.py <photos dir> <logos dir> <out dir>
  photos (pipeline/sources/photos/haier_hrb3752/, Haier India's gallery, 1200 x 1200):
    haier_front.jpg     the Nickel Steel model straight on: the body is x 392-805.3 for its 623 mm (0.663 px per mm across)
                        and rows 61.5-1139.5 from the door's top to the floor for its 1640 mm (0.657 px per mm up)
    graphite_front.jpg  the Graphite Black model straight on (x 390.5-804.5, rows 62.5-1133.5: 0.665 / 0.653 px per mm)
    haier_rear.jpg      the back straight on (body x 381.5-802, rows 72-1136)
  logos: haier.png
  writes <out dir>/haier_hrb3752/:
    door_fridge_<f>.jpg, door_freezer_<f>.jpg   the door faces for each finish (<f> ns = Nickel Steel, gb = Graphite Black):
        a flat colour with fine horizontal streaks (both finishes are brushed across, as the photos show) and the photo's
        own fall in light down each door, read row by row off the straight-on photo, held at GAIN_K of its strength (the
        viewer's light adds the rest). The doors' colour is set here: a textured material's colour is ignored.
    channel.jpg         the freezer's recess handle channel, its light read off the Nickel Steel front
    logo.png            the Haier wordmark, white, from Haier's own logo file
    print_magic_<f>.png MAGICCONVERTIBLE at the fridge door's bottom right: MAGIC heavy, CONVERTIBLE light; dark grey and
                        silver on Nickel Steel, white and light grey on Graphite Black (as each photo shows)
    display.png         the control panel's print on its black glass: the inverter fan, INVERTER, Fridge, Freezer, Auto Set,
                        Power Cool, Turbo Icing, 3 Sec. Lock, set again sharp. The tiny second lines under four of the words
                        can't be read on any photo and are left out
    rear.jpg, ctrlbox.jpg   the back: Haier's rear photo cropped to the cabinet with the control box's cable painted out
                        (it is modelled), and the control box's cover (modelled as a raised box)
    print_cooling.png, print_bottle.png, print_bigbox.png, print_freezebox.png, print_icemaker.png, print_led.png
                        the words inside (MAGIC COOLING with TRIPLE INVERTER & DUAL FAN TECH under it, BOTTLEGUARD, 2XBIGBOX,
                        FREEZEBOX, ICEMAKER, LED LIGHT), set again sharp. The small icons after the bars can't be read: left out
Every word is set at 7.2 px per mm in Avenir Next.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SLUG = "haier_hrb3752"
SRC = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
AV = "/System/Library/Fonts/Avenir Next.ttc"
DEMI, REG, BOLD = 2, 7, 0
S = 7.2                                     # px per mm for print
rng = np.random.default_rng(3752)

# ── the finishes: door colour (RGB, before the viewer's light), streak strength, each door's level, and the photo ──
# Haier's straight-on fronts read, as a ratio to the wordmark's white: Nickel Steel fridge door 0.72, freezer 0.68;
# Graphite Black both 0.24 (55, 62, 78). The bases and levels are tuned until the gate's straight-on and 3/4 renders
# give the same ratios (REVIEW.md); the viewer's light makes the freezer door read darker than the fridge door at the
# same colour, hence the levels.
FINISHES = {
    "ns": {"photo": "haier_front.jpg", "base": (134, 134, 136), "grain": 0.5, "field": 1.0,
           "level": {"door_fridge": 1.045, "door_freezer": 1.02},
           "rows": (61.5, 1139.5), "cols": (392, 805.3)},
    "gb": {"photo": "graphite_front.jpg", "base": (36, 40, 51), "grain": 0.5,
           "level": {"door_fridge": 1.0, "door_freezer": 1.045},
           "rows": (62.5, 1133.5), "cols": (390.5, 804.5)},
}
GAIN_K = 0.5
H_MM = 1640.0
# the doors (mm from the floor, measured on both fronts and averaged; tex and builder share these numbers)
FRIDGE = (637.5, 1640.0)                    # the fridge door, its bottom edge to the top
FREEZER_FACE = (24.5, 577.0)                # the freezer door's steel face, under the handle's bar


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def row_profile(photo, rows, cols, mm0, mm1, n):
    """The photo's light down a door from mm1 (top) to mm0 (bottom), n samples, relative to its middle half's mean.
    Columns: the door's left and right thirds, which miss the display, the wordmark and the print."""
    g = np.asarray(Image.open(os.path.join(SRC, photo)).convert("L")).astype(float)
    top, floor = rows
    k = (floor - top) / H_MM
    x0, x1 = cols
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


def light_field(f, mm0, mm1, w, h):
    """Polished steel's soft light and dark patches as Haier's straight front shows them on this door (on Nickel Steel
    they run on the diagonal, so they are read in two dimensions): the photo's door from mm0 to mm1, its rounded edges
    (12 mm round) left out, the wordmark, the panel and the print masked off, blurred over 10 mm and returned at w x h
    as a share of its mean."""
    g = np.asarray(Image.open(os.path.join(SRC, f["photo"])).convert("L")).astype(np.float32)
    top, floor = f["rows"]
    k = (floor - top) / H_MM
    x0, x1 = f["cols"]
    e = 12 * (x1 - x0) / 623
    # the bottom 25 mm too: the freezer door's lower edge and the feet sit there on the photo
    a = g[int(round(floor - (mm1 - 12) * k)):int(round(floor - (mm0 + 25) * k)), int(round(x0 + e)):int(round(x1 - e))]
    ok = (np.abs(a - np.median(a)) < 40).astype(np.float32)
    ok = cv2.erode(ok, np.ones((7, 7), np.uint8))
    sig = 10 * k
    den = cv2.GaussianBlur(ok, (0, 0), sig)
    fld = cv2.GaussianBlur(a * ok, (0, 0), sig) / np.maximum(den, 1e-3)
    fld[den < 0.3] = np.nan                  # too little door round a pixel: take its row's mean, else the door's
    rows = np.nanmean(np.where(np.isnan(fld), np.nan, fld), 1, keepdims=True) if np.isnan(fld).any() else None
    if rows is not None:
        rows = np.where(np.isnan(rows), np.nanmean(fld), rows)
        fld = np.where(np.isnan(fld), np.broadcast_to(rows, fld.shape), fld)
    fld = cv2.resize(fld.astype(np.float32), (w, h), interpolation=cv2.INTER_AREA if fld.shape[1] > w else cv2.INTER_CUBIC)
    return fld / fld.mean()


def brushed(w, h, base, grain, gain, mult=None):
    """Horizontal brushed metal: long faint streaks across the panel, the row gain (top to bottom) multiplied in."""
    n = rng.normal(0, 1, (h // 2 + 1, 1))
    n = np.repeat(np.repeat(n, w, axis=1), 2, axis=0)[:h, :]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((40, 1.2)))
    a = (np.asarray(img).astype(float) / 255 - 0.5) * 4 * grain + rng.normal(0, 0.5 * grain, (h, w))
    g = np.interp(np.arange(h), np.linspace(0, h - 1, len(gain)), gain)[:, None]
    out = (np.array(base, float)[None, None, :] + a[:, :, None]) * g[:, :, None]
    if mult is not None:
        out = out * mult[:, :, None]
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def doors():
    for key, f in FINISHES.items():
        for name, (mm0, mm1), size in (("door_fridge", FRIDGE, (512, 820)), ("door_freezer", FREEZER_FACE, (512, 452))):
            p = row_profile(f["photo"], f["rows"], f["cols"], mm0, mm1, 48)
            # the photo's top and bottom 15 mm are the doors' rounded edges and the gaps: hold the next rows' light there
            edge = max(1, int(round(48 * 15 / (mm1 - mm0))))
            p[:edge] = p[edge]
            p[-edge:] = p[-edge - 1]
            gain = 1 + GAIN_K * (p - 1)
            mult = None
            if f.get("field"):
                # the photo's light in two dimensions takes the place of the row fall
                gain = np.ones_like(gain)
                mult = 1 + f["field"] * (light_field(f, mm0, mm1, size[0], size[1]) - 1)
                print(key, name, "light field p10/p90", np.percentile(mult, 10).round(3), np.percentile(mult, 90).round(3))
            print(key, name, "gain top/mid/bottom", gain[0].round(3), gain[len(gain) // 2].round(3), gain[-1].round(3))
            save(brushed(size[0], size[1], f["base"], f["grain"], gain * f["level"][name], mult), f"{name}_{key}.jpg", 86)


def channel():
    # the channel's face from the fridge door's bottom edge (row 721.5) to the handle's bar (row 749), the photo's mean
    # over x 470-730: black under the fridge door, then the light rising towards the bar. Held at 0.85 like the doors
    ph = np.asarray(Image.open(os.path.join(SRC, "haier_front.jpg")).convert("L")).astype(float)
    prof = ph[721:749, 470:730].mean(1)
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
    # Haier's wordmark (logos/haier.png), white on both finishes: 59 mm wide on both fronts (39 px at 0.664 px per mm),
    # its middle 1550 mm up, centred
    al = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA").getchannel("A")
    al = al.crop(al.getbbox())
    w = round(59 * S)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    out = Image.new("RGBA", al.size, (244, 246, 250, 0))
    out.putalpha(al)
    save(out, "logo.png")


def magic():
    # MAGICCONVERTIBLE: 122 mm long (81 px), its right end 19 mm in from the hinge edge, its foot 20 mm above the fridge
    # door's bottom edge (Graphite front x 709-790, rows 696-702.5). Colours read off each front at 8x
    for key, cols in (("ns", ((74, 76, 80), (150, 152, 157))), ("gb", ((240, 242, 246), (196, 200, 210)))):
        im = words([["MAGIC", BOLD], ["CONVERTIBLE", REG]], 9.0, cols, track=0.04, gap=0.02)
        save(pad(fitw(im, 122 * S)), f"print_magic_{key}.png")


def fan_icon(d_mm, ink):
    """The inverter mark: a ring round a four-bladed fan (display, both fronts)."""
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
    # the control panel: 44 x 230 mm of black glass (Graphite front: x 586-612, rows 161-311; Nickel front the same size),
    # the fan mark and seven words on it, each placed at its share of the panel's height as measured on the Graphite front
    # (5x crop): fan 0.08, INVERTER 0.153, Fridge 0.307, Freezer 0.436, Auto Set 0.657, Power Cool 0.74, Turbo Icing 0.813,
    # 3 Sec. Lock 0.933 (8-16x crops of the Graphite front: "3 Sec." then "Lock", with a small second line under it, as on
    # the HRB-4052's fronts; the Nickel front is too soft to read, its word the same 22 mm long). The words are white,
    # about 3 mm tall; 3 Sec. Lock at its natural 19 mm
    Wmm, Hmm = 44.0, 230.0
    w, h = round(Wmm * S), round(Hmm * S)
    im = Image.new("RGBA", (w, h), (10, 10, 12, 255))
    ink = (236, 238, 242)
    def put(t, frac):
        im.alpha_composite(t, ((w - t.width) // 2, round(frac * h - t.height / 2)))
    put(fan_icon(14.0, ink), 0.08)
    put(words([["INVERTER", BOLD]], 1.9, ink, track=0.03), 0.153)
    for text, frac in (("Fridge", 0.307), ("Freezer", 0.436), ("Auto Set", 0.657), ("Power Cool", 0.74), ("Turbo Icing", 0.813), ("3 Sec. Lock", 0.933)):
        put(words([[text, DEMI]], 2.6, ink, track=0.01), frac)
    save(im.convert("RGB"), "display.jpg", 92)


def rear():
    # the cabinet's back from its underside (24.5 mm) to its top (1628 mm): rows 1136 - (mm - 24.5) * 0.664, so rows
    # 71-1136; columns 381.5-802. The cable from the control box to the compressor bay (traced: x 711 at the box's foot,
    # row 745, drifting to x 706 at the bay's top, row 1000) is painted out, as it is modelled
    src = cv2.imread(os.path.join(SRC, "haier_rear.jpg"))
    g = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY)
    mask = np.zeros(g.shape, np.uint8)
    pts = [(711, 745), (711, 790), (709, 835), (707, 880), (706, 940), (706, 1000)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        cv2.line(mask, (x0, y0), (x1, y1), 255, 11)
    mask &= ((g < 100) * 255).astype(np.uint8)
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    clean = cv2.inpaint(src, mask, 5, cv2.INPAINT_TELEA)
    crop = cv2.cvtColor(clean[72:1136, 382:802], cv2.COLOR_BGR2RGB)
    save(Image.fromarray((crop.astype(float) * 0.9).clip(0, 255).astype(np.uint8)), "rear.jpg", 86)
    # the control box's cover: its flange x 648-770, rows 500-760 (its foot, with the cable's grommet)
    box = cv2.cvtColor(src[500:761, 648:771], cv2.COLOR_BGR2RGB)
    save(Image.fromarray((box.astype(float) * 0.9).clip(0, 255).astype(np.uint8)), "ctrlbox.jpg", 88)


def bar_after(im, grey, gap_mm, h_mm):
    bar = Image.new("RGBA", (max(1, round(0.7 * S)), round(h_mm * S)), grey + (255,))
    out = Image.new("RGBA", (im.width + round(gap_mm * S) + bar.width, max(im.height, bar.height)), grey + (0,))
    out.alpha_composite(im, (0, out.height - im.height - round(0.15 * h_mm * S)))
    out.alpha_composite(bar, (im.width + round(gap_mm * S), 0))
    return out


def inside_words():
    # sizes read off Haier's open-door photos against the part they are on (0.57 px per mm on the cabinet's front)
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
