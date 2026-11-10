"""Textures for the LG GLT4416 446 L double-door refrigerator, in its two colours: Ebony Sheen (GLT4416CCES, glossy black
PET doors) and Shiny Steel (GLT4416CCPZ, printed steel-look PET doors).

usage: python3 tex_lg_glt4416.py <photos dir> <logos dir> <out dir>
  photos: lg_glt4416/cces/GLT4416CCES-2010x1334-2-v.jpg (LG's energy label for this model), lg_glt4416/cces/GLT4416CCES-DZ-11.jpg
          (rear)
  logos:  lg.png
  writes <out dir>/lg_glt4416/*.jpg|png|json (its own folder; the food labels come from lg_glt3426 through stock_lg.mjs)

Brightness is matched as a ratio to the energy label's white (255) on LG's own photos of each colour:
- Ebony Sheen front (GLT4416CCES-2010x1334-1-v.jpg): 20 in the middle of both doors, falling smoothly to 8-9 at both edges
  (15 at 0.6 of the half-width), with no fall towards the floor. The sides read 66-126 in the 3/4 views, about 0.75 of the
  Shiny Steel's sides in the same views, so they are a dark charcoal paint, not black. The LG mark reads 89.
- Shiny Steel front (GLT4416CCPZ-2010x1334-1-v.jpg): 177 flat down to 0.5 m, then 165 (0.33 m), 150 (0.18 m), 130 (0.03 m);
  edges 152-165. Generated brushed steel as on the LG 466 L, its level scaled by 177/167 (the 466 L's photo read 167 for the
  same texture recipe), fall k 0.29, edge 0.12. The LG mark reads 112.
Print, each its own decal: the energy label (die-cut from LG's photo), the LG mark (one per colour), the "Convertible" print on
the freezer's back wall, the "Ice Maker" print, the Fresh 0 Zone and Fresh Zone prints and the inner control panel, redrawn
from the manual's "Control Panel 2, Type B" drawing (two rows of five dots, "Cold" to "Coldest", "Convertible" and
"Express Frz" lights, the "Freezer / Convertible / Hold 3 sec." and "Fridge / Express Frz / Hold 3 sec." keys).
Rear: LG's rear photo cropped to the cabinet (rows 100-1238, where it is full width); no cord shows on it, so nothing is
painted out.
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
D = os.path.join(OUT, "lg_glt4416")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(4416)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FONT_C = "/System/Library/Fonts/Avenir Next Condensed.ttc"
SRC = os.path.join(PHOTOS, "lg_glt4416")


def font(px, face=7, path=FONT):
    return ImageFont.truetype(path, int(px), index=face)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p))


def steel(w, h, y_top, y_bot, base=(157, 157, 158), grain=0.85, k=0.22, edge=0.05, gain=1.0):
    """Vertical-grain brushed silver (as tex_lg_glt4626.py), shaded by height above the floor (metres, top and bottom of
    this panel): flat above 0.5 m, falling by k at the floor; darker by edge at both sides."""
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


def gloss_black(w, h, level, edge=0.45, p=1.7):
    """Ebony Sheen: a flat glossy black, its photo's fall towards both edges (1 - edge |x|^p, fitted to the front photo:
    0.75 at 0.6 of the half-width, 0.45 at the edge), nothing by height. No grain in the colour: the gloss is the material's."""
    xx = np.abs(np.linspace(-1, 1, w))[None, :]
    v = level * (1 - edge * xx ** p) * np.ones((h, 1)) + rng.normal(0, 0.25, (h, w))
    return Image.fromarray(np.stack([v, v, v * 1.02], axis=2).clip(0, 255).astype(np.uint8))


def paint(w, h, level, k=0.10):
    """Dark charcoal side paint (Ebony Sheen): smooth, a soft fall towards the floor and the front and back edges."""
    y = np.linspace(1.736, 0.018, h)[:, None]
    xx = np.linspace(-1, 1, w)[None, :]
    shade = 1.02 - k * np.clip((0.5 - y) / 0.45, 0, 1) ** 1.5 - 0.06 * xx ** 2
    v = level * shade + rng.normal(0, 0.5, (h, w))
    return Image.fromarray(np.stack([v, v, v * 1.015], axis=2).clip(0, 255).astype(np.uint8))


def word(img, text, cx, cy, height_px, face, col, max_w=None, path=FONT):
    """Set a word at 4x, crop it to its ink and scale it to height_px of ink, centred at (cx, cy)."""
    S = 4
    f = font(height_px * S * 1.45, face, path)
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
    img.alpha_composite(layer, (round(cx - tmp.width / 2), round(cy - tmp.height / 2)))
    return tmp.width


def text(img, s, cx, cy, cap_px, face, col, path=FONT):
    """Set text by its cap height (the ink of "H"), so words with and without descenders match; centred on the cap band."""
    S = 4
    f = font(cap_px * S * 1.45, face, path)
    hb = f.getbbox("H")
    k = cap_px / (hb[3] - hb[1])
    bb = f.getbbox(s)
    tmp = Image.new("L", (bb[2] - bb[0] + 8, bb[3] - min(bb[1], hb[1]) + 8), 0)
    ImageDraw.Draw(tmp).text((4 - bb[0], 4 - min(bb[1], hb[1])), s, font=f, fill=255)
    tmp = tmp.resize((max(1, round(tmp.width * k)), max(1, round(tmp.height * k))), Image.LANCZOS)
    layer = Image.new("RGBA", tmp.size, col[:3] + (0,))
    layer.putalpha(tmp.point(lambda v: v * col[3] // 255))
    top = (4 + hb[1] - min(bb[1], hb[1])) * k
    img.alpha_composite(layer, (round(cx - tmp.width / 2), round(cy - cap_px / 2 - top)))
    return tmp.width


def label():
    """LG's energy label for this model (2026-28 series, 1 star, 297 units/yr, 446 L; it prints LG's family name GLT441),
    die-cut from LG's label photo (as tex_lg_glt4626.py)."""
    src = Image.open(os.path.join(SRC, "cces", "GLT4416CCES-2010x1334-2-v.jpg")).convert("RGB")
    sa = np.asarray(src).astype(int)
    ys_, xs_ = np.where((sa.sum(2) < 735) & (np.arange(sa.shape[1])[None, :] < 1040))
    lab = src.crop((xs_.min() + 3, ys_.min() + 3, xs_.max() - 2, ys_.max() - 2)).convert("RGBA")
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g, bl, _ = px[x, y]
        if min(r, g, bl) < 205 and not (r > 235 and g < 215):
            continue
        seen[y, x] = True
        px[x, y] = (r, g, bl, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = lab.getchannel("A").filter(ImageFilter.MinFilter(3))
    lab = lab.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    lab.putalpha(alpha)
    save(lab, "label.png")
    print("label aspect (w/h)", round(lab.width / lab.height, 4))


def lgmark(name, rgb):
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    mark = np.zeros(a.shape, np.uint8)
    mark[..., :3] = rgb
    face = np.clip((a[..., 1] - 110) / 100, 0, 1)  # the white face in the red circle (green high); red and grey letters stay
    mark[..., 3] = (a[..., 3] * 0.95 * (1 - face)).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(mark), name)


def rear():
    """LG's rear photo of the Ebony Sheen (DZ-11), cropped to the cabinet: x 771-1243, rows 100-1238 (where it is full
    width; the top cover above and the rounded base rail below are cut off). Scaled to 3/4."""
    im = Image.open(os.path.join(SRC, "cces", "GLT4416CCES-DZ-11.jpg")).convert("RGB")
    a = np.asarray(im).astype(int)
    m = a.sum(2) < 735
    widths = m.sum(1)
    rows = np.where(widths > 0.97 * widths.max())[0]
    y0, y1 = rows.min(), rows.max()
    cols = np.where(m[(y0 + y1) // 2])[0]
    x0, x1 = cols.min(), cols.max()
    clean = im.crop((x0, y0, x1 + 1, y1 + 1))
    r = clean.resize((clean.width * 3 // 4, clean.height * 3 // 4), Image.LANCZOS)
    save(r, "rear.jpg", 84)
    with open(os.path.join(D, "rear_paths.json"), "w") as f:
        json.dump({"note": "u from the photo's left edge (the fridge's right side, +x), v from the top; the plate spans the cabinet's"
                   " width and its back from the rollers to the cabinet top. No cord is visible on LG's rear photos.",
                   "crop_px": [int(x0), int(y0), int(x1), int(y1)]}, f, indent=1)
    print("rear crop", x0, y0, x1, y1, "->", r.size)


def prints():
    # "Convertible" in black on the freezer's raised back panel (DZ-06: about 130 mm wide), drawn at 6 px per mm
    img = Image.new("RGBA", (840, 150), (0, 0, 0, 0))
    word(img, "Convertible", 420, 75, 92, 2, (24, 25, 28, 255), max_w=780)
    save(img, "print_convertible.png")
    # "Ice Maker" on the ice maker's top band (DZ-06: about 42 mm wide, cap height about 6 mm): "Ice" bold, "Maker" regular
    scratch = Image.new("RGBA", (600, 200), (0, 0, 0, 0))
    wi, wm, gap = text(scratch, "Ice", 300, 100, 36, 2, (0, 0, 0, 255)), text(scratch, "Maker", 300, 100, 36, 7, (0, 0, 0, 255)), 12
    img = Image.new("RGBA", (300, 64), (0, 0, 0, 0))
    x0 = 150 - (wi + gap + wm) / 2
    text(img, "Ice", x0 + wi / 2, 32, 36, 2, (60, 62, 66, 255))
    text(img, "Maker", x0 + wi + gap + wm / 2, 32, 36, 7, (80, 82, 86, 255))
    save(img, "print_icemaker.png")
    # the trays' words, as LG prints them (DZ-07): "Fresh 0 Zone / Fish & Meat" and "Fresh Zone / Fruit & Vegetables"
    img = Image.new("RGBA", (900, 200), (0, 0, 0, 0))
    text(img, "Fresh 0 Zone", 450, 72, 48, 2, (60, 62, 66, 255))
    text(img, "Fish & Meat", 450, 145, 24, 5, (90, 92, 98, 255))
    save(img, "print_fresh0.png")
    img = Image.new("RGBA", (900, 220), (0, 0, 0, 0))
    text(img, "Fresh Zone", 450, 82, 50, 2, (60, 62, 66, 255))
    text(img, "Fruit & Vegetables", 450, 158, 25, 5, (90, 92, 98, 255))
    save(img, "print_freshzone.png")


def panel():
    """The inner control panel (manual: Control Panel 2, Type B), 118 x 57 mm at 7.2 px per mm, as printed on the fridge's
    back wall: a pale grey label, grey words, ten unlit dots and the two key outlines. Positions are fractions of the manual's
    drawing (its frame runs 160-1445 x 68-683 units)."""
    S = 7.2
    W_, H_ = round(118 * S), round(57 * S)
    img = Image.new("RGBA", (W_, H_), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, W_ - 1, H_ - 1], 3 * S, fill=(226, 228, 231, 255), outline=(178, 181, 186, 255), width=2)
    ink, dot = (70, 72, 78, 255), (120, 123, 129, 255)
    fx = lambda u: (u - 160) / 1285 * W_
    fy = lambda v: (v - 68) / 615 * H_
    cap = 0.030 * H_ * 615 / 615 * 1.0
    for row, (lab, mid) in enumerate([("Convertible", "Freezer"), ("Express Frz", "Fridge")]):
        ty, dy = fy(196 + row * 287), fy(254 + row * 287)
        text(img, "Cold", fx(250), ty, 25 / 615 * H_, 0, ink)
        text(img, "Coldest", fx(672), ty, 25 / 615 * H_, 0, ink)
        text(img, lab, fx(925), ty, 25 / 615 * H_, 0, ink)
        r = 34 / 615 * H_
        for cx in [250, 355, 460, 565, 670, 925]:
            d.ellipse([fx(cx) - r, dy - r, fx(cx) + r, dy + r], outline=dot, width=max(2, int(0.4 * S)), fill=(206, 208, 212, 255))
        # the key: a rounded outline with its two words and "Hold 3 sec."
        x0, x1 = fx(1085), fx(1403)
        y0, y1 = fy(100 + row * 287), fy(362 + row * 287)
        d.rounded_rectangle([x0, y0, x1, y1], 2.4 * S, outline=ink, width=max(2, int(0.5 * S)))
        cx = (x0 + x1) / 2
        text(img, mid, cx, fy(155 + row * 287), 38 / 615 * H_, 0, ink, path=FONT_C)
        for k in range(26):
            xx = fx(1118) + (fx(1370) - fx(1118)) * k / 25
            d.ellipse([xx - 0.15 * S, fy(199 + row * 287) - 0.15 * S, xx + 0.15 * S, fy(199 + row * 287) + 0.15 * S], fill=ink)
        text(img, lab, cx, fy(250 + row * 287), 38 / 615 * H_, 0, ink, path=FONT_C)
        text(img, "Hold 3 sec.", cx, fy(326 + row * 287), 28 / 615 * H_, 7, ink, path=FONT_C)
    save(img, "panel.png")


def main():
    # Shiny Steel doors at about 0.7 px per mm (heights in metres from the builder: freezer door 1.2207-1.780 m, fridge door
    # face 0.031-1.2043 m). Look pass 10 Nov: at 166 (the LG 466 L's level scaled to this photo) the web render read 0.80 of
    # the label's white against the photo's 0.71, its edges 0.90 of the middle against 0.86: so 155 and edge 0.16
    save(steel(490, 392, 1.780, 1.2207, base=(155, 155, 156), k=0.29, edge=0.16), "door_freezer_pz.jpg", 86)
    save(steel(490, 822, 1.2043, 0.031, base=(155, 155, 156), k=0.29, edge=0.16), "door_fridge_pz.jpg", 86)
    save(steel(470, 1200, 1.736, 0.018, base=(150, 150, 151)), "side_pz.jpg", 86)
    # Ebony Sheen doors and sides: small, as they carry no print or brushing. The doors' level 45 is set with the material
    # (m 1, r 0.5, no film, see the builder): straight on 0.07 of the label's white (photo 0.08), black in the 3/4 views
    save(gloss_black(256, 64, 45), "door_freezer_es.jpg", 90)
    save(gloss_black(256, 128, 45), "door_fridge_es.jpg", 90)
    save(paint(120, 300, 112), "side_es.jpg", 90)
    # the LG mark: lighter grey on the black door (photo 89 on 20), darker grey on the steel (112 on 177)
    lgmark("lgmark_es.png", (74, 75, 79))
    lgmark("lgmark_pz.png", (84, 86, 90))
    label()
    rear()
    prints()
    panel()


main()
