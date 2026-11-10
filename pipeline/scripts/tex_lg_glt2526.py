"""Textures for the LG GLT2526XWPZ 251 L double-door refrigerator (Shiny Steel).

usage: python3 tex_lg_glt2526.py <photos dir> <logos dir> <out dir>
  photos: lg_glt2526/2010x1334-2-v.jpg (LG's energy label for this model), lg_glt2526/DZ-12.jpg (rear)
  logos:  lg.png
  writes <out dir>/lg_glt2526/*.jpg|png|json (its own folder: nothing is borrowed from another product's textures,
  except the food labels, which stock_lg.mjs reads from lg_glt3426 for every LG fridge)

Doors: LG's Shiny Steel is a printed steel look on PET under a clear glossy film. Generated brushed steel, as on the
LG 343 L (streaks vertical, blurred (1.2, 40), base grey 157), at 0.7 px per mm. The brightness fall is LG's own: on this
model's front photo the doors hold 165-169 grey from the top down to about 0.45 m above the floor, then fall to 114 at
5 cm (0.69), and the edges sit at 0.85 of the middle (measured on 2010x1334-1-v.jpg). So the fall is baked in by height
above the floor: the freezer door is flat, the fridge door falls over its lowest 45 cm.
Print, each a separate decal so it stays sharp: the energy label (die-cut from LG's own label photo for this model), the
LG mark, the dial's scale and the word Convertible on the freezer's back wall, and Fresh Zone on the vegetable drawer's
white front (LG's words, read off the open-door photos DZ-06, DZ-07 and DZ-11).
Rear: LG's rear photo, cropped to the cabinet, with the power cord painted out (it is modelled in 3D; its traced path is
written to rear_paths.json for the builder).
"""
import json
import os
import sys
from collections import deque

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
D = os.path.join(OUT, "lg_glt2526")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(26)
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
    """Vertical-grain brushed silver (as tex_lg_glt3426.py), shaded by height above the floor (metres, top and bottom
    of this panel): flat above 0.5 m, falling by k at the floor; darker by edge at both sides; gain scales it all.
    Doors use k 0.32 and edge 0.13, matched to LG's front photo as ratios to the energy label's white; gain stays 1, which
    puts the web render 0.04 over the photo and RealityKit 0.04 under it. The sides keep k 0.22, edge 0.05."""
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


def word(img, text, cx, cy, height_px, face, col, max_w=None):
    """Set a word at 4x, crop it to its ink and scale it to height_px (ink height), centred at (cx, cy)."""
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
    img.alpha_composite(layer, (round(cx - tmp.width / 2), round(cy - tmp.height / 2)))


def label():
    """LG's energy label for this model (2026-28 series, 251 L, 233 units/yr; it prints LG's family name GLT252), die-cut."""
    src = Image.open(os.path.join(PHOTOS, "lg_glt2526", "2010x1334-2-v.jpg")).convert("RGB")
    lab = src.crop((459 + 6, 238 + 6, 938 - 4, 1116 - 4)).convert("RGBA")
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


def lgmark():
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    mark = np.zeros(a.shape, np.uint8)
    mark[..., :3] = (84, 86, 90)
    mark[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(mark), "lgmark.png")


def rear():
    """LG's rear photo, cropped to the cabinet (the rows where it is full width), the cord painted out (TELEA)."""
    im = Image.open(os.path.join(PHOTOS, "lg_glt2526", "DZ-12.jpg")).convert("RGB")
    a = np.asarray(im).astype(int)
    m = a.sum(2) < 735
    widths = m.sum(1)
    rows = np.where(widths > 0.97 * widths.max())[0]
    y0, y1 = rows.min(), rows.max()
    cols = np.where(m[(y0 + y1) // 2])[0]
    x0, x1 = cols.min(), cols.max()
    # the light grey cord, traced on the photo (px): out of the clip under the service cover, then across to the
    # cabinet's edge (the photo's left, which is the fridge's right-hand side seen from behind)
    cord = [(977.5, 942.5), (972.5, 946.25), (960, 947.5), (920, 945.5), (845, 941.25), (776, 938.75)]
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    mask = np.zeros(bgr.shape[:2], np.uint8)
    cv2.polylines(mask, [np.array(cord, np.int32)], False, 255, thickness=7)
    bgr = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    clean = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).crop((x0, y0, x1 + 1, y1 + 1))
    r = clean.resize((clean.width * 3 // 4, clean.height * 3 // 4), Image.LANCZOS)
    save(r, "rear.jpg", 84)
    paths = {"note": "u from the photo's left edge (the fridge's right side, +x), v from the top; the plate spans the cabinet's width and height",
             "crop_px": [int(x0), int(y0), int(x1), int(y1)],
             "cord": [[round((x - x0) / (x1 - x0), 4), round((y - y0) / (y1 - y0), 4)] for x, y in cord]}
    with open(os.path.join(D, "rear_paths.json"), "w") as f:
        json.dump(paths, f, indent=1)
    print("rear crop", x0, y0, x1, y1, "->", r.size)


def prints():
    """The freezer's back wall carries a printed scale round the dial and the word Convertible (DZ-06, DZ-11). Measured
    on DZ-11 and scaled by the back wall's width on DZ-06 (483 mm inside): the decal is 283 x 70 mm, at 5 px per mm.
    Positions in mm from the decal's top left: dial centre (61.5, 42); three ticks over it at 20 mm radius, at -33, 0
    and +33 degrees; Min (33, 29) and Max (91, 29); two outlined pills to the left, the upper one (24, 42) with an arrow
    to the dial, the lower one (23, 56) reading Convertible; the
    word Convertible, 102 mm wide, centred at (225, 27)."""
    S = 5
    W_, H_ = 283 * S, 70 * S
    img = Image.new("RGBA", (W_, H_), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ink, ink2 = (52, 54, 58, 255), (92, 94, 98, 255)
    kx, ky = 61.5 * S, 42 * S
    for deg in (-33, 0, 33):
        a = np.radians(deg)
        x0, y0 = kx + 19 * S * np.sin(a), ky - 19 * S * np.cos(a)
        x1, y1 = kx + 23 * S * np.sin(a), ky - 23 * S * np.cos(a)
        d.line([(x0, y0), (x1, y1)], fill=ink2, width=int(0.9 * S))
    word(img, "Min", 33 * S, 29 * S, 3.0 * S, 5, ink2)
    word(img, "Max", 91 * S, 29 * S, 3.0 * S, 5, ink2)
    for cx, cy, w, h in ((24, 42, 22.6, 7.9), (23, 56, 31, 8.5)):
        d.rounded_rectangle([(cx - w / 2) * S, (cy - h / 2) * S, (cx + w / 2) * S, (cy + h / 2) * S], h / 2 * S, outline=ink2, width=int(0.7 * S))
    # the upper pill's word is too small to read on any photo; LG's manual names the dial's two modes, Convertible and
    # Dairy, and the lower pill reads Convertible, so the upper one is Dairy
    word(img, "Dairy", 24 * S, 42 * S, 3.4 * S, 5, ink2, max_w=17 * S)
    d.line([(35.5 * S, 42 * S), (39.5 * S, 42 * S)], fill=ink2, width=int(0.7 * S))
    d.polygon([(39.5 * S, 40.6 * S), (41.5 * S, 42 * S), (39.5 * S, 43.4 * S)], fill=ink2)
    word(img, "Convertible", 23 * S, 56 * S, 3.4 * S, 5, ink2, max_w=26 * S)
    word(img, "Convertible", 225 * S, 27 * S, 18 * S, 5, ink, max_w=102 * S)
    save(img, "print_convertible.png")
    # the dial's face: plain white with a soft rim (DZ-11 shows no mark on it that the photo resolves)
    k = Image.new("RGB", (256, 256), (238, 239, 241))
    d = ImageDraw.Draw(k)
    d.ellipse([6, 6, 250, 250], outline=(200, 202, 206), width=8)
    save(k, "knob.jpg")
    # the vegetable drawer's white front, 463 x 135 mm, with "Fresh Zone" 45 mm wide in light grey, 4 px per mm
    S = 4
    img = Image.new("RGBA", (463 * S, 135 * S), (246, 247, 249, 255))
    word(img, "Fresh Zone", 463 * S / 2 + 8 * S, 70 * S, 7.5 * S, 5, (128, 130, 136, 255), max_w=45 * S)
    save(img.convert("RGB"), "fresh_zone.jpg", 90)


def main():
    # doors and sides at about 0.7 px per mm; heights in metres from the builder (freezer door 1.089-1.573 m,
    # fridge door panel 0.032-1.043 m)
    save(steel(386, 339, 1.573, 1.089, k=0.32, edge=0.13), "door_freezer.jpg", 86)
    save(steel(386, 708, 1.043, 0.032, k=0.32, edge=0.13), "door_fridge.jpg", 86)
    save(steel(414, 1086, 1.573, 0.022, base=(150, 150, 151)), "side.jpg", 86)
    save(steel(414, 1086, 1.573, 0.022, base=(150, 150, 151)), "side_l.jpg", 86)
    label()
    lgmark()
    rear()
    prints()


main()
