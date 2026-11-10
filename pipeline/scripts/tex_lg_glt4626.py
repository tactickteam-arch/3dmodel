"""Textures for the LG GLT4626TMPZ 466 L double-door refrigerator (Shiny Steel, VCM doors).

usage: python3 tex_lg_glt4626.py <photos dir> <logos dir> <out dir>
  photos: lg_glt4626/GLT4626TMPZ-2010x1334-2-v.jpg (LG's energy label for this model), GLT4626TMPZ-DZ-12.jpg (rear)
  logos:  lg.png
  writes <out dir>/lg_glt4626/*.jpg|png|json (its own folder: nothing is borrowed from another product's textures,
  except the food labels, which stock_lg.mjs reads from lg_glt3426 for every LG fridge)

Doors: LG's Shiny Steel is a printed steel look under a clear glossy film. Generated brushed steel, as on the LG 343 L
(streaks vertical, blurred (1.2, 40), base grey 157), at 0.7 px per mm. The brightness fall is LG's own: on this model's
front photo the doors hold 167 grey from the top down to about 0.45 m above the floor, then fall to 114 at 5 cm
(0.69), and the edges sit at 0.85 of the middle (measured on GLT4626TMPZ-2010x1334-1-v.jpg; the 343 L and 251 L photos
give the same numbers). So the fall is baked in by height above the floor: the freezer door is flat, the fridge door
falls over its lowest 45 cm.
Print, each a separate decal so it stays sharp: the energy label (die-cut from LG's own label photo for this model), the
LG mark, the LED display (every word re-set at 8 px per mm from LG's photos DZ-08/09/10), the Convertible and Hygiene Fresh
plates and the Fresh 0 Zone and Fresh Zone prints (LG's words, read off the open-door photo DZ-04).
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
D = os.path.join(OUT, "lg_glt4626")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(46)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
H_MM, W_MM = 1845, 700


def font(px, face=7):
    return ImageFont.truetype(FONT, int(px), index=face)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def steel(w, h, y_top, y_bot, base=(157, 157, 158), grain=0.85, fall=True, k=0.22, edge=0.05, gain=1.0):
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
    shade = gain * (1.02 - (k * np.clip((0.5 - y) / 0.45, 0, 1) ** 1.5 if fall else 0) - edge * np.abs(xx) ** 2)
    out = np.stack([(np.full((h, w), c) + a) * shade for c in base], axis=2)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def seven(d, x, y, w, h, ch, col):
    """One hexagonal seven-segment digit (bar t = 0.21 w, gap 0.62 t) in a box w x h."""
    t = 0.21 * w
    g = 0.62 * t / 2
    segs = {"0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g"}[ch]
    hh = h / 2

    def hbar(cx0, cx1, cy):
        return [(cx0 + g, cy), (cx0 + g + t / 2, cy - t / 2), (cx1 - g - t / 2, cy - t / 2), (cx1 - g, cy), (cx1 - g - t / 2, cy + t / 2), (cx0 + g + t / 2, cy + t / 2)]

    def vbar(cx, cy0, cy1):
        return [(cx, cy0 + g), (cx + t / 2, cy0 + g + t / 2), (cx + t / 2, cy1 - g - t / 2), (cx, cy1 - g), (cx - t / 2, cy1 - g - t / 2), (cx - t / 2, cy0 + g + t / 2)]
    P = {"a": hbar(x + t / 2, x + w - t / 2, y + t / 2), "g": hbar(x + t / 2, x + w - t / 2, y + hh), "d": hbar(x + t / 2, x + w - t / 2, y + h - t / 2),
         "f": vbar(x + t / 2, y + t / 2, y + hh), "b": vbar(x + w - t / 2, y + t / 2, y + hh), "e": vbar(x + t / 2, y + hh, y + h - t / 2), "c": vbar(x + w - t / 2, y + hh, y + h - t / 2)}
    for k in segs:
        d.polygon(P[k], fill=col)


def word(img, text, cx, cy, height_px, face, col, max_w=None):
    """Set a word at 4x, crop it to its ink and scale it to height_px of cap/x height box, centred at (cx, cy)."""
    S = 4
    f = font(height_px * S * 1.45, face)
    tmp = Image.new("L", (int(len(text) * height_px * S * 1.6) + 40, int(height_px * S * 3)), 0)
    ImageDraw.Draw(tmp).text((20, height_px * S * 0.4), text, font=f, fill=255)
    bb = tmp.getbbox()
    tmp = tmp.crop(bb)
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
    """LG's energy label for this model (2026-28 series, 466 L, 261 units/yr; it prints LG's family name GLT462), die-cut."""
    src = Image.open(os.path.join(PHOTOS, "lg_glt4626", "GLT4626TMPZ-2010x1334-2-v.jpg")).convert("RGB")
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


def lgmark():
    lg = Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    mark = np.zeros(a.shape, np.uint8)
    mark[..., :3] = (84, 86, 90)
    mark[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(mark), "lgmark.png")


def rear():
    """LG's rear photo, cropped to the cabinet (the rows where it is full width), the cord painted out (TELEA)."""
    im = Image.open(os.path.join(PHOTOS, "lg_glt4626", "GLT4626TMPZ-DZ-12.jpg")).convert("RGB")
    a = np.asarray(im).astype(int)
    m = a.sum(2) < 735
    widths = m.sum(1)
    rows = np.where(widths > 0.97 * widths.max())[0]
    y0, y1 = rows.min(), rows.max()
    cols = np.where(m[(y0 + y1) // 2])[0]
    x0, x1 = cols.min(), cols.max()
    # the cord, traced on the photo (px): out of the clip at the foot of the service cover, down, then across to the
    # cabinet's edge (on the photo's left, which is the fridge's right-hand side seen from behind)
    cord = [(905, 1022.5), (903.75, 1028.75), (897.5, 1033.75), (880, 1036), (855, 1035), (830, 1032.5), (800, 1029.5), (767.5, 1025.5)]
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


def plates():
    def brushed_plate(w, h, text, k=3):
        """A spun-steel plate (LG's Convertible and Hygiene Fresh plates, DZ-04 and DZ-06): fine concentric turning
        lines, and the sunburst sheen that makes a dark X from corner to corner. Drawn at k times 2 px per mm."""
        w, h = w * k, h * k
        yy, xx = np.mgrid[0:h, 0:w]
        cx, cy = w / 2, h / 2
        r = np.hypot(xx - cx, yy - cy)
        th = np.arctan2((yy - cy) / h, (xx - cx) / w)
        v = 160 + 24 * np.cos(4 * th) + 5 * np.sin(r * 2.3 / k) + rng.normal(0, 1.6, r.shape)
        v = np.asarray(Image.fromarray(v.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6 * k))).astype(float)
        im = Image.fromarray(np.stack([v, v, v + 2], axis=2).clip(0, 255).astype(np.uint8)).convert("RGBA")
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([k, k, w - 2 * k, h - 2 * k], 6 * k, outline=(120, 122, 126), width=3 * k)
        word(im, text, cx, cy, h * 0.19, 0, (30, 32, 36, 255), max_w=w * 0.62)
        return im
    # plates are 163 x 74 mm (measured on DZ-04 at 1.24 px per mm): drawn at 6 px per mm so the word stays sharp at the 4 degree close-up
    save(brushed_plate(326, 148, "Convertible"), "plate_convertible.jpg", 90)
    save(brushed_plate(326, 150, "Hygiene Fresh"), "plate_hygiene.jpg", 90)
    # printed words on the clear trays (transparent decals): "Fresh 0 Zone / Fish & Meat" and "Fresh Zone / Fruit & Vegetables"
    img = Image.new("RGBA", (900, 200), (0, 0, 0, 0))
    word(img, "Fresh 0 Zone", 450, 72, 50, 5, (60, 62, 66, 255))
    word(img, "Fish & Meat", 450, 145, 24, 7, (90, 92, 98, 255))
    save(img, "print_fresh0.png")
    img = Image.new("RGBA", (900, 220), (0, 0, 0, 0))
    word(img, "Fresh Zone", 450, 82, 52, 5, (60, 62, 66, 255))
    word(img, "Fruit & Vegetables", 450, 158, 26, 7, (90, 92, 98, 255))
    save(img, "print_freshzone.png")


def display():
    """The external LED display on the freezer door: 58 x 166 mm (front photo: 56 x 165 mm), 8 px per mm. Read off
    LG's photos DZ-08, DZ-09 and DZ-10 (the display is about 30 x 90 px in each): ThinQ; -18 and 3, each with its degree
    C, lit; "Freezer / Convertible", "Fridge / Express Freeze", "Wi-Fi"; one small line that no photo resolves (left
    soft, not written); the Smart Inverter mark at the foot. Positions are fractions of the window, measured on DZ-09."""
    S = 8
    W_, H_ = 58 * S, 166 * S
    img = Image.new("RGBA", (W_, H_), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, W_ - 1, H_ - 1], 4 * S, fill=(8, 8, 9, 255))
    on, lbl, dim = (246, 246, 250, 255), (206, 208, 212, 255), (120, 122, 126, 255)
    y = lambda f: f * H_
    word(img, "ThinQ", W_ * 0.5, y(0.094), 5.6 * S, 5, on)
    # -18 deg C: a short bar for the minus, then two digits 9 x 15.5 mm, degree C as a superscript
    dw, dh = 8.6 * S, 15.0 * S
    d.rounded_rectangle([W_ * 0.22, y(0.219) - 0.8 * S, W_ * 0.22 + 3.2 * S, y(0.219) + 0.8 * S], 0.6 * S, fill=on)
    seven(d, W_ * 0.38 - dw / 2, y(0.219) - dh / 2, dw, dh, "1", on)
    seven(d, W_ * 0.58 - dw / 2, y(0.219) - dh / 2, dw, dh, "8", on)
    word(img, "°C", W_ * 0.77, y(0.188), 2.6 * S, 5, on)
    seven(d, W_ * 0.58 - dw / 2, y(0.333) - dh / 2, dw, dh, "3", on)
    word(img, "°C", W_ * 0.77, y(0.302), 2.6 * S, 5, on)
    word(img, "Freezer", W_ * 0.5, y(0.465), 2.3 * S, 5, lbl)
    word(img, "Convertible", W_ * 0.5, y(0.505), 2.3 * S, 5, lbl)
    word(img, "Fridge", W_ * 0.5, y(0.595), 2.3 * S, 5, lbl)
    word(img, "Express Freeze", W_ * 0.5, y(0.635), 2.3 * S, 5, lbl)
    word(img, "Wi-Fi", W_ * 0.5, y(0.765), 2.3 * S, 5, lbl)
    # the small line no photo can read: a soft grey smudge of its size, not letters
    soft = Image.new("RGBA", (W_, H_), (0, 0, 0, 0))
    ImageDraw.Draw(soft).rounded_rectangle([W_ * 0.5 - 11 * S, y(0.87) - 0.8 * S, W_ * 0.5 + 11 * S, y(0.87) + 0.8 * S], S, fill=dim)
    img.alpha_composite(soft.filter(ImageFilter.GaussianBlur(S * 0.7)))
    # the Smart Inverter mark: a small square outline (all the photos resolve of the icon) and the words
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([W_ * 0.14, y(0.935) - 3.2 * S, W_ * 0.14 + 6.4 * S, y(0.935) + 3.2 * S], S, outline=lbl, width=max(2, int(0.6 * S)))
    word(img, "Smart Inverter", W_ * 0.60, y(0.935), 2.4 * S, 5, lbl, max_w=33 * S)
    save(img, "display.png")


def main():
    # doors and sides at about 0.7 px per mm; heights in metres from the builder (freezer door 1.308-1.845 m,
    # fridge door panel 0.027-1.248 m)
    save(steel(490, 376, 1.845, 1.308, k=0.32, edge=0.13), "door_freezer.jpg", 86)
    save(steel(490, 855, 1.248, 0.027, k=0.32, edge=0.13), "door_fridge.jpg", 86)
    save(steel(470, 1270, 1.845, 0.022, base=(150, 150, 151)), "side.jpg", 86)
    save(steel(470, 1270, 1.845, 0.022, base=(150, 150, 151)), "side_l.jpg", 86)
    label()
    lgmark()
    rear()
    plates()
    display()


main()
