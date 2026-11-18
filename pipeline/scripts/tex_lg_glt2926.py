"""Textures for the LG GLT2926PDPZ 288 L double-door frost-free refrigerator (Shiny Steel, convertible).

usage: python3 tex_lg_glt2926.py <photos dir> <logos dir> <out dir>
  photos: lg_glt2926/lg/  LG India's gallery for GLT2926PDPZ: GLT2926PDPZ-2010x1334-1-v.jpg (straight-on front),
          GLT2926PDPZ-DZ-11.jpg (rear)
  logos:  lg.png
  writes <out dir>/lg_glt2926/ (its own folder; the food labels come from the shared stock, as for every LG fridge)

Doors: LG's Shiny Steel is a printed steel look on PET under a clear glossy film. Generated brushed steel, as on the
LG 251 L (vertical streaks blurred (1.2, 40), base grey 157), at about 0.7 px per mm. On this model's front photo
(2010x1334-1-v) the doors hold about 170 of the label's 255 from the top down to 0.6 m and fall to 146 at 0.28 m and 126
at 0.08 m, with edges 150-160 against 177 in the middle: the 251 L's own fall (k 0.32, edge 0.13) matches it, so the
251 L's numbers are used.
The LG mark is a darker grey than the door on this model (128 against the door's 159 round it), set from LG's own logo.
Print, each a separate decal so it stays sharp (LG's words, read off the open-door photos DZ-03, DZ-04, DZ-05):
  - "Convertible" on the freezer's back wall;
  - "Ice Maker" on the white front of the ice maker under the freezer shelf;
  - "Fresh Zone" / "Fruit & Vegetables" on the clear front of the vegetable drawer;
  - the fridge's control display: LG's owner's manual MFL72023402 (Control Panel, Type A, "Identification of Control
    (With Button)") draws it: Cold, five dots, Coldest, then Convertible and its dot, and the button "Freezer /
    Convertible / Hold 3 second."; under it Cold, five dots, Coldest, Super Chill and its dot, and the button "Fridge /
    Super Chill / Hold 3 second.". The photo (DZ-05) shows the same layout; its 1.6 mm a pixel can't resolve the words,
    so they are set again in a font at the photo's places.
  The hinge cover on the top carries no print the photos can read, so none is drawn.
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
SRC = os.path.join(PHOTOS, "lg_glt2926", "lg")
D = os.path.join(OUT, "lg_glt2926")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(2926)
FONT = "/System/Library/Fonts/Avenir Next.ttc"


def font(px, face=7):
    return ImageFont.truetype(FONT, int(px), index=face)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def steel(w, h, y_top, y_bot, base=(157, 157, 158), grain=0.85, k=0.22, edge=0.05, gain=1.0):
    """Vertical-grain brushed silver (as tex_lg_glt2526.py), shaded by height above the floor (metres, top and bottom
    of this panel): flat above 0.5 m, falling by k at the floor; darker by edge at both sides."""
    n = rng.normal(0, 1, (1, w // 2 + 1))
    n = np.repeat(n, h, axis=0)
    n = np.repeat(n, 2, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((1.2, 40)))
    a = (np.asarray(img).astype(float) / 255 - 0.5) * 2 * grain * 2
    a += rng.normal(0, 0.6, (h, w))
    y = np.linspace(y_top, y_bot, h)[:, None]
    xx = np.linspace(-1, 1, w)[None, :]
    shade = gain * (1.02 - k * np.clip((0.5 - y) / 0.45, 0, 1) ** 1.5 - edge * np.abs(xx) ** 2)
    out = np.stack([(np.full((h, w), c) + a) * shade for c in base], axis=2)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def line(img, parts, cx, base, cap, col, width=None, gap=0.28, anchor="c"):
    """Set a line of words on one baseline at 4x and reduce: parts [(text, face)], centred at cx (anchor "l": its left
    ink edge at cx), baseline at `base`, capital height `cap` px; with `width` the line is scaled to that ink width."""
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
    x0 = cx - (bb[0] + bb[2]) / 2 * k if anchor == "c" else cx - bb[0] * k
    img.alpha_composite(layer, (round(x0), round(base - by * k)))


def lgmark():
    """LG's mark, a mid grey darker than the door (the front photo: ink down to 96 on a door of about 170; the first value, 112, rendered far too pale)."""
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    mark = np.zeros(a.shape, np.uint8)
    mark[..., :3] = (62, 64, 68)
    mark[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(mark), "lgmark.png")


def rear():
    """LG's rear photo DZ-11, cropped to the cabinet (the rows where it is full width), the cord painted out (TELEA)."""
    im = Image.open(os.path.join(SRC, "GLT2926PDPZ-DZ-11.jpg")).convert("RGB")
    a = np.asarray(im).astype(int)
    m = a.sum(2) < 720
    widths = m.sum(1)
    rows = np.where(widths > 0.97 * widths.max())[0]
    y0, y1 = rows.min(), rows.max()
    cols = np.where(m[(y0 + y1) // 2])[0]
    x0, x1 = cols.min(), cols.max()
    # the light grey cord, traced on the photo (px, from a 6x close-up): out of the compressor cover's lower edge, down
    # and across to the cabinet's edge (the photo's left, which is the fridge's right-hand side seen from behind)
    cord = [(914.2, 1004.2), (906.7, 1010), (890, 1018.3), (873.3, 1024.2), (856.7, 1028.3), (840, 1030.8), (823.3, 1032.2),
            (806.7, 1032.8), (796.7, 1033.3)]
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


def prints():
    ink = (52, 58, 70, 255)          # LG's dark slate print inside the cabinet (DZ-03, DZ-04)
    S = 5                            # 5 px per mm
    # "Convertible" on the freezer's back wall: 81 px wide on DZ-04 where the back wall reads about 1.55 mm a pixel,
    # so about 125 mm, medium weight
    img = Image.new("RGBA", (132 * S, 28 * S), (0, 0, 0, 0))
    line(img, [("Convertible", 5)], 66 * S, 21 * S, 16 * S, ink, width=125 * S)
    save(img, "print_convertible.png")
    # "Ice Maker" on the ice maker's white front: 43 mm wide (DZ-04), "Ice" medium, "Maker" regular
    img = Image.new("RGBA", (48 * S, 12 * S), (0, 0, 0, 0))
    line(img, [("Ice", 5), ("Maker", 7)], 24 * S, 9 * S, 6 * S, (40, 42, 46, 255), width=43 * S, gap=0.2)
    save(img, "print_icemaker.png")
    # the vegetable drawer's clear front: "Fresh Zone" 78 mm wide, "Fruit & Vegetables" under it (DZ-03, DZ-05)
    img = Image.new("RGBA", (84 * S, 32 * S), (0, 0, 0, 0))
    line(img, [("Fresh", 5), ("Zone", 7)], 42 * S, 14 * S, 10 * S, ink, width=78 * S)
    line(img, [("Fruit & Vegetables", 7)], 42 * S, 26 * S, 6 * S, ink, width=72 * S)
    save(img, "print_freshzone.png")


def display():
    """The fridge's control display on the back wall's duct: 114 x 64 mm (DZ-05), at 8 px per mm, light grey, with LG's
    Type A layout from the manual (two rows of five dots and one, each with its button box on the right)."""
    S = 8
    W_, H_ = 114 * S, 64 * S
    im = Image.new("RGBA", (W_, H_), (224, 226, 229, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([1, 1, W_ - 2, H_ - 2], 2 * S, outline=(205, 207, 211, 255), width=int(0.8 * S))
    ink = (62, 64, 68, 255)
    dots = [15.0, 22.3, 29.6, 36.9, 44.2]
    for (yw, yd, word, b1, b2) in ((19.2, 25.6, "Convertible", "Freezer", "Convertible"), (41.9, 48.0, "Super Chill", "Fridge", "Super Chill")):
        line(im, [("Cold", 5)], dots[0] * S, (yw + 1) * S, 1.9 * S, ink)
        line(im, [("Coldest", 5)], (dots[3] + dots[4]) / 2 * S, (yw + 1) * S, 1.9 * S, ink)
        line(im, [(word, 5)], 63 * S, (yw + 1) * S, 1.9 * S, ink)
        for x in dots + [63]:
            r = 2.2 * S
            d.ellipse([x * S - r, yd * S - r, x * S + r, yd * S + r], outline=ink, width=int(0.45 * S))
        # the button box
        bx0, bx1 = 75 * S, 104.5 * S
        by0 = (yw - 3.2) * S
        by1 = by0 + 18.4 * S
        d.rectangle([bx0, by0, bx1, by1], outline=ink, width=int(0.4 * S))
        cxb = (bx0 + bx1) / 2
        line(im, [(b1, 5)], cxb, by0 + 4.6 * S, 2.1 * S, ink)
        for k in range(int((bx1 - bx0 - 4 * S) / (1.2 * S))):    # the dotted rule under the first word
            x = bx0 + 2 * S + k * 1.2 * S
            d.rectangle([x, by0 + 6.0 * S, x + 0.5 * S, by0 + 6.3 * S], fill=ink)
        line(im, [(b2, 5)], cxb, by0 + 11.6 * S, 2.6 * S, ink, width=24 * S)
        line(im, [("Hold 3 second.", 7)], cxb, by0 + 16.0 * S, 1.4 * S, ink)
    save(im.convert("RGB"), "display.jpg", 90)


def main():
    # doors and sides at about 0.7 px per mm (freezer door 1.201-1.675 m, fridge door panel 0.027-1.188 m)
    save(steel(400, 330, 1.675, 1.201, k=0.32, edge=0.13), "door_freezer.jpg", 86)
    save(steel(400, 812, 1.188, 0.027, k=0.32, edge=0.13), "door_fridge.jpg", 86)
    save(steel(436, 1160, 1.675, 0.022, base=(150, 150, 151)), "side.jpg", 86)
    save(steel(436, 1160, 1.675, 0.022, base=(150, 150, 151)), "side_l.jpg", 86)
    lgmark()
    rear()
    prints()
    display()


main()
