"""Textures for the LG GL-S312SPZY 272 L double-door frost-free refrigerator (Shiny Steel, convertible).

usage: python3 tex_lg_gls312.py <photos dir> <logos dir> <out dir> [<label template> <label redraw out>]
  photos: lg_gls312/spzy/  LG India's gallery for GL-S312SPZY: GL-S312SPZY-2010x1334-1.jpg (straight-on front),
          GL-S312SPZY-Refrigerators-Back-View-DZ-11.jpg (rear)
  logos:  lg.png
  writes <out dir>/lg_gls312/ (its own folder; the food labels come from the shared stock, as for every LG fridge)
  with the two label arguments it also redraws the energy label (see label_redraw below); tex_bee_label.py then cuts
  it out into <out dir>/lg_gls312/bee_label.png for add_label.mjs.

Doors: LG's Shiny Steel is a printed steel look on PET under a clear glossy film. Generated brushed steel, as on the
LG 251 L and 343 L (vertical streaks blurred (1.2, 40), base grey 157), at 0.7 px per mm. On this model's front photo
(2010x1334-1) the doors hold an even grey from top to floor (no fall towards the floor, unlike the 251 L): 148-157 on
the freezer, 157-164 on the fridge at mid width, and a left-to-right sweep (128 left, 198 right) that is the studio's
light, not the panel. So the doors get no vertical fall, a soft darkening at both edges, and the 251 L's base grey.
The LG mark is light silver on this model (brighter than the door on every LG photo), set from LG's own logo file.
Print, each a separate decal so it stays sharp (LG's words, read off the open-door photos DZ-3, DZ-5, DZ-6):
  - "Convertible" on the freezer's back wall (no dial in this freezer);
  - "Pull-out Tray" on the clear front of the tray under the fridge's ceiling;
  - "Fresh Zone" / "Fruit & Vegetables" on the clear front of the vegetable drawer;
  - the fridge's control plate: LG's internal controller (owner's manual MFL71853701, p.17, "INTERNAL CONTROLLER"):
    a ring with Freezer, *Convertible, Fridge, *Express Freeze inside, Cold and Coldest outside, and
    "* Extra Function : Hold 3 seconds" at the foot; the words are set again in a font from the manual's drawing (the
    photo's 2 mm a pixel can't resolve them), the plate's circular brushing generated;
  - Smart Diagnosis(TM) on the top hinge cover (DZ-3: the icon and the two words).
Rear: LG's rear photo, cropped to the cabinet, with the power cord painted out (it is modelled in 3D; its traced path is
written to rear_paths.json for the builder).
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "lg_gls312", "spzy")
D = os.path.join(OUT, "lg_gls312")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(312)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
SUP = "/System/Library/Fonts/Supplemental/"


def font(px, face=7):
    return ImageFont.truetype(FONT, int(px), index=face)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def steel(w, h, base=(157, 157, 158), grain=0.85, edge=0.10, gain=1.0):
    """Vertical-grain brushed silver (as tex_lg_glt2526.py), with no fall towards the floor (this model's front photo
    has none) and darker by `edge` at both sides."""
    n = rng.normal(0, 1, (1, w // 2 + 1))
    n = np.repeat(n, h, axis=0)
    n = np.repeat(n, 2, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((1.2, 40)))
    a = (np.asarray(img).astype(float) / 255 - 0.5) * 2 * grain * 2
    a += rng.normal(0, 0.6, (h, w))
    xx = np.linspace(-1, 1, w)[None, :]
    shade = gain * (1.02 - edge * np.abs(xx) ** 2) * np.ones((h, 1))
    out = np.stack([(np.full((h, w), c) + a) * shade for c in base], axis=2)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def word(img, text, cx, cy, height_px, face, col, max_w=None, anchor="c"):
    """Set a word at 4x, crop it to its ink and scale it to height_px (ink height), centred at (cx, cy) (anchor "l": its
    left edge at cx)."""
    S = 4
    f = font(height_px * S * 1.45, face)
    tmp = Image.new("L", (int(len(text) * height_px * S * 1.6) + 40, int(height_px * S * 3)), 0)
    ImageDraw.Draw(tmp).text((20, height_px * S * 0.4), text, font=f, fill=255)
    tmp = tmp.crop(tmp.getbbox())
    k = height_px / tmp.height
    w = tmp.width * k
    if max_w and w > max_w:
        k *= max_w / w
        w = max_w
    tmp = tmp.resize((max(1, round(w)), max(1, round(tmp.height * k))), Image.LANCZOS)
    layer = Image.new("RGBA", tmp.size, col[:3] + (0,))
    layer.putalpha(tmp.point(lambda v: v * col[3] // 255))
    x = round(cx - tmp.width / 2) if anchor == "c" else round(cx)
    img.alpha_composite(layer, (x, round(cy - tmp.height / 2)))
    return tmp.width


def lgmark():
    # drawn sharp from LG's vector mark (tex_lg_mark.py) in the layout of logos/lg.png, 680 px across the 54 mm decal:
    # 12.6 px per mm (logos/lg.png's 349 px gave 6.5)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import tex_lg_mark
    lg = tex_lg_mark.lg_hi(LOGOS, 680)
    a = np.asarray(lg).astype(float)
    mark = np.zeros(a.shape, np.uint8)
    mark[..., :3] = (210, 211, 214)
    mark[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(mark), "lgmark.png")


def rear():
    """LG's rear photo, cropped to the cabinet (the rows where it is full width), the cord painted out (TELEA)."""
    im = Image.open(os.path.join(SRC, "GL-S312SPZY-Refrigerators-Back-View-DZ-11.jpg")).convert("RGB")
    a = np.asarray(im).astype(int)
    m = a.sum(2) < 735
    widths = m.sum(1)
    rows = np.where(widths > 0.97 * widths.max())[0]
    y0, y1 = rows.min(), rows.max()
    cols = np.where(m[(y0 + y1) // 2])[0]
    x0, x1 = cols.min(), cols.max()
    # the light grey cord, traced on the photo (px, 6x close-up): out of the service cover's lower left corner, down
    # and across to the cabinet's edge (the photo's left, which is the fridge's right-hand side seen from behind)
    cord = [(765, 806), (757, 812), (742, 815.5), (720, 816.5), (690, 816), (668, 815.5), (657, 815)]
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    mask = np.zeros(bgr.shape[:2], np.uint8)
    cv2.polylines(mask, [np.array(cord, np.int32)], False, 255, thickness=6)
    bgr = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    clean = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).crop((x0, y0, x1 + 1, y1 + 1))
    save(clean, "rear.jpg", 84)
    paths = {"note": "u from the photo's left edge (the fridge's right side, +x), v from the top; the plate spans the cabinet's width and height",
             "crop_px": [int(x0), int(y0), int(x1), int(y1)],
             "cord": [[round((x - x0) / (x1 - x0), 4), round((y - y0) / (y1 - y0), 4)] for x, y in cord]}
    with open(os.path.join(D, "rear_paths.json"), "w") as f:
        json.dump(paths, f, indent=1)
    print("rear crop", x0, y0, x1, y1, "->", clean.size)


def line(img, parts, cx, base, cap, col, width=None, gap=0.28):
    """Set a line of words on one baseline at 4x and reduce: parts [(text, face)], centred at cx, baseline at `base`,
    capital height `cap` px; with `width` the whole line is scaled to that ink width (never stretched one way)."""
    S = 4
    size = cap * S / 0.7                                # Avenir Next's capitals are 0.7 of its em
    fs = [font(size, f) for _, f in parts]
    sp = gap * size
    ws = [f.getlength(t) for (t, _), f in zip(parts, fs)]
    W_ = int(sum(ws) + sp * (len(parts) - 1) + 8 * S)
    H_ = int(size * 1.6)
    tmp = Image.new("L", (W_, H_), 0)
    d = ImageDraw.Draw(tmp)
    x, by = 4 * S, int(size * 1.15)
    for (t, _), f, w in zip(parts, fs, ws):
        d.text((x, by), t, font=f, fill=255, anchor="ls")
        x += w + sp
    bb = tmp.getbbox()
    k = 1 / S if width is None else width / (bb[2] - bb[0])
    tmp = tmp.resize((max(1, round(W_ * k)), max(1, round(H_ * k))), Image.LANCZOS)
    layer = Image.new("RGBA", tmp.size, col[:3] + (0,))
    layer.putalpha(tmp.point(lambda v: v * col[3] // 255))
    ink_cx = (bb[0] + bb[2]) / 2 * k
    img.alpha_composite(layer, (round(cx - ink_cx), round(base - by * k)))


def prints():
    ink = (52, 58, 70, 255)          # LG's dark slate print inside the cabinet (DZ-3, DZ-6)
    S = 12                           # 12 px per mm
    # "Convertible" on the freezer's back wall: 93 mm wide (DZ-6 at 1.86 mm a pixel), medium weight
    img = Image.new("RGBA", (100 * S, 24 * S), (0, 0, 0, 0))
    line(img, [("Convertible", 5)], 50 * S, 18 * S, 13 * S, ink, width=93 * S)
    save(img, "print_convertible.png")
    # "Pull-out Tray" on the tray's clear front: 85 mm wide, "Pull-out" medium, "Tray" regular (DZ-3)
    img = Image.new("RGBA", (92 * S, 18 * S), (0, 0, 0, 0))
    line(img, [("Pull-out", 5), ("Tray", 7)], 46 * S, 12 * S, 9 * S, ink, width=85 * S)
    save(img, "print_pullout.png")
    # the vegetable drawer's clear front: "Fresh Zone" 74 mm wide, "Fruit & Vegetables" under it, as wide (DZ-6)
    img = Image.new("RGBA", (80 * S, 32 * S), (0, 0, 0, 0))
    line(img, [("Fresh", 5), ("Zone", 7)], 40 * S, 14 * S, 10 * S, ink, width=74 * S)
    line(img, [("Fruit & Vegetables", 7)], 40 * S, 26 * S, 6 * S, ink, width=70 * S)
    save(img, "print_freshzone.png")


def plate():
    """The fridge's control plate, 170 x 80 mm (DZ-6), at 6 px per mm: circular brushing round the ring (DZ-5), the ring
    56 mm across, and the manual's internal-controller words re-set (manual p.17: Freezer and Fridge with a dotted line
    under each, *Convertible and *Express Freeze with an LED bar before each, Cold and Coldest outside the ring)."""
    S = 6
    W_, H_ = 170 * S, 80 * S
    cx, cy = 87 * S, 40 * S
    yy, xx = np.mgrid[0:H_, 0:W_]
    r = np.hypot(xx - cx, yy - cy)
    # concentric brushing: noise along the radius, smooth round it
    rad = rng.normal(0, 1, 4000)
    rad = np.convolve(rad, np.ones(3) / 3, mode="same")
    tex = rad[(r * 1.0).astype(int).clip(0, 3999)] * 7 + rng.normal(0, 2.0, r.shape)
    base = 170 - 10 * (xx / W_ - 0.5) ** 2
    img = np.stack([base + tex, base + tex + 1, base + tex + 3], 2).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(img).convert("RGBA")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([1, 1, W_ - 2, H_ - 2], 3 * S, outline=(196, 198, 202, 255), width=int(1.2 * S))
    R = 28 * S
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(38, 40, 44, 255), width=int(1.6 * S))
    ink = (40, 42, 46, 255)
    cap = 3.3 * S
    line(im, [("Freezer", 5)], cx, cy - 12.5 * S, cap, ink)
    line(im, [("*Convertible", 5)], cx + 1.5 * S, cy - 3.5 * S, cap, ink)
    line(im, [("Fridge", 5)], cx, cy + 6.5 * S, cap, ink)
    line(im, [("*Express Freeze", 5)], cx + 1.5 * S, cy + 15.5 * S, cap, ink)
    for k in range(-7, 8, 2):                       # the dotted line under each button word (manual p.17)
        for yd in (-10.3, 8.7):
            d.ellipse([cx + k * 1.5 * S - 0.3 * S, cy + yd * S - 0.3 * S, cx + k * 1.5 * S + 0.3 * S, cy + yd * S + 0.3 * S], fill=ink)
    # the LED bars left of the two hold-to-use words, and the indicator at the top of the ring
    for y in (cy - 5.2 * S, cy + 13.8 * S):
        d.rectangle([cx - 20 * S, y - 2.0 * S, cx - 19.2 * S, y + 2.0 * S], fill=(120, 122, 126, 255))
    d.rectangle([cx - 2 * S, cy - R - 0.4 * S, cx + 2 * S, cy - R + 0.6 * S], fill=(120, 122, 126, 255))
    for sx, w_ in ((-1, "Cold"), (1, "Coldest")):
        for sy in (-1, 1):
            x = cx + sx * (R + 4 * S)
            line(im, [(w_, 5)], x + sx * (6 if sx < 0 else 9) * S, cy + sy * 19 * S + 1.2 * S, 2.6 * S, ink)
            d.ellipse([x - 0.6 * S, cy + sy * 19 * S - 0.6 * S, x + 0.6 * S, cy + sy * 19 * S + 0.6 * S], fill=ink)
    line(im, [("* Extra Function : Hold 3 seconds", 5)], W_ - 26 * S, H_ - 4 * S, 1.8 * S, ink)
    save(im.convert("RGB"), "plate_control.jpg", 90)


def topcover():
    """The top hinge cover's print (DZ-3, about 1 mm a pixel): the Smart Diagnosis icon, simplified to what that photo
    resolves (a ring with a phone overlapping its right side), and Smart Diagnosis(TM) under it in two lines, light grey
    on the dark cover; 50 x 22 mm at 8 px per mm."""
    S = 8
    im = Image.new("RGBA", (50 * S, 22 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ink = (190, 192, 196, 255)
    cx, cy = 25 * S, 6 * S
    d.ellipse([cx - 5.5 * S, cy - 4.5 * S, cx + 1.5 * S, cy + 4.5 * S], outline=ink, width=int(0.6 * S))
    d.rounded_rectangle([cx + 0.5 * S, cy - 3.4 * S, cx + 4.5 * S, cy + 3.4 * S], 0.8 * S, outline=ink, width=int(0.6 * S))
    line(im, [("Smart", 5)], cx, 15 * S, 2.2 * S, ink)
    line(im, [("Diagnosis\u2122", 5)], cx, 19 * S, 2.2 * S, ink)
    save(im, "print_topcover.png")


def label_redraw(template, out):
    """GL-S312SPZY's energy label in the current series, redrawn from BEE's register (read 18 Nov 2026: GL-S312SPZY,
    frost free, 1 star, 271 units a year, 272 L, valid to 31 Dec 2028, so the 2026-28 series). LG's own gallery label
    for this model is the 2023-25 series (2 star), which has ended, so it is not used.
    Template: LG's 2026-28 frost-free 1-star label for the GLT2216 (LG's gallery image 2010x1334-2-v.jpg for
    GLT2216WYRO): the same maker, series, star count and layout; only the units, the volume and the model line differ, so
    each is painted out in the label's cream and set again at the old word's ink height (Godrej's redraw method)."""
    im = Image.open(template).convert("RGB")
    a = np.asarray(im).astype(int)
    cream = tuple(int(v) for v in np.median(a[880:900, 700:800].reshape(-1, 3), axis=0))

    def put(box, text, fnt, size, centre=False):
        x0, y0, x1, y1 = box
        win = a[y0:y1, x0:x1].reshape(-1, 3)
        fill_bg = tuple(int(v) for v in np.median(win[win.mean(axis=1) > 200], axis=0))   # the paper round the word
        m = a[y0:y1, x0:x1].mean(axis=2) < 110
        ys, xs = np.nonzero(m)
        ix0, iy0, ix1, iy1 = x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1
        sub = a[iy0:iy1, ix0:ix1]
        ink_rgb = tuple(int(v) for v in np.median(sub[sub.mean(axis=2) < 80], axis=0))
        ImageDraw.Draw(im).rectangle((ix0 - 3, iy0 - 3, ix1 + 2, iy1 + 2), fill=fill_bg)   # only the old word
        f = ImageFont.truetype(SUP + fnt, size)
        l, t, r, b = f.getbbox(text)
        wd = Image.new("L", (r - l, b - t), 0)
        ImageDraw.Draw(wd).text((-l, -t), text, font=f, fill=255)
        wd = wd.crop(wd.getbbox())
        h = iy1 - iy0
        wd = wd.resize((round(wd.width * h / wd.height), h), Image.LANCZOS)
        px0 = ix0 + ((ix1 - ix0) - wd.width) // 2 if centre else ix0   # the units sit centred in their box
        im.paste(Image.new("RGB", wd.size, ink_rgb), (px0, iy0), wd)
        return (ix0, iy0, ix1, iy1), wd.size

    print("units", put((575, 712, 746, 792), "271", "Arial Black.ttf", 160, centre=True))  # 264 -> 271 units/yr
    print("volume", put((642, 920, 680, 948), "272", "Arial Narrow Bold.ttf", 60))                    # 225 -> 272 (Ltr)
    print("model", put((612, 962, 760, 995), "GL-S312SPZY", "Arial Narrow Bold.ttf", 60))              # GLT221 -> GL-S312SPZY
    im.save(out, quality=95)
    print("wrote", out, "cream", cream)


def main():
    # doors and sides at about 0.7 px per mm (freezer door 1.194-1.680 m, fridge door panel 0.032-1.133 m)
    save(steel(386, 340), "door_freezer.jpg", 86)
    save(steel(386, 770), "door_fridge.jpg", 86)
    save(steel(414, 1160, base=(150, 150, 151), edge=0.05), "side.jpg", 86)
    save(steel(414, 1160, base=(150, 150, 151), edge=0.05), "side_l.jpg", 86)
    lgmark()
    rear()
    prints()
    plate()
    topcover()
    if len(sys.argv) > 5:
        label_redraw(sys.argv[4], sys.argv[5])


main()
