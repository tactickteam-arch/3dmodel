"""Textures for the Samsung WA70BG4441BYTL 7 kg top-load washing machine (Lavender Gray).

usage: python tex_samsung_wa70.py <photos dir> <logos dir> <out dir>
  photos:  samsung_wa70/1.jpg (energy label), 2.jpg (side view), 6.jpg (drum interior)
  sources: ../sources/samsung-panel/manual_wa70_panel.png  the control-panel diagram of Samsung's user manual
           (DC68-04429A-15, page 28, the Eco Tub Clean variant), a vector drawing rendered at 1200 dpi
  logos:   samsung.png
  writes <out dir>/samsung_wa70/*

The control panel is redrawn crisp from the manual's vector drawing (programme names, icons, scale, key labels), laid out where
Samsung's own overhead photo of the panel has them; the display, power ring, red bars and the wordmark are drawn on top.
The drum is a procedural diamond pattern (pyramid facets lit from four sides), the pitch measured from Samsung's drum photo.
"""
import math
import os
import sys
from collections import deque

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

Image.MAX_IMAGE_PIXELS = None
PHOTOS, LOGOS, OUT = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(OUT, "samsung_wa70")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(70)
FONT = "/System/Library/Fonts/Avenir Next.ttc"


def font(px, face=7):
    return ImageFont.truetype(FONT, px, index=face)


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def paint(w, h, base, grain=1.0, gradient=None):
    """Matte moulded plastic: a flat colour with faint noise and an optional vertical gradient (top, bottom multipliers)."""
    a = rng.normal(0, grain, (h, w, 1))
    img = np.ones((h, w, 3)) * np.array(base, float) + a
    if gradient:
        t = np.linspace(gradient[0], gradient[1], h)[:, None, None]
        img = img * t
    return Image.fromarray(img.clip(0, 255).astype(np.uint8))


# ───────────────────────── control panel ─────────────────────────
PX_PER_CROP = 6.4                      # texture px per px of Samsung's overhead panel photo (1.56 px/mm there -> 10 px/mm here)
CROP_W, CROP_H = 844, 205              # the panel strip in the photo: full deck width, and from its top edge to just above the lid


def panel():
    man = np.asarray(Image.open(os.path.join(HERE, "..", "sources", "samsung-panel", "manual_wa70_panel.png")).convert("L"))
    ink = (255 - man.astype(np.int32)).clip(0, 255)
    h, w = man.shape
    global man_gray
    man_gray = man
    # callout discs of the manual (01 02 03 06 12 15) and the rounded frame around the whole drawing are not part of the panel
    dark = man < 110
    grey = (man > 150) & (man < 235)
    n, lab, st, _ = cv2.connectedComponentsWithStats(grey.astype(np.uint8))
    discs = []
    for i in range(1, n):
        x, y, bw, bh, ar = st[i]
        if 55 <= bw <= 85 and 55 <= bh <= 85 and ar > 0.6 * bw * bh:
            discs.append((x + bw // 2, y + bh // 2, max(bw, bh) // 2 + 6))
    print("callout discs", len(discs))
    for cx, cy, r in discs:
        cv2.circle(ink, (cx, cy), r + 3, 0, -1)
    # the grey display box: keep the four small icons in it (they become the dim red icons), drop the box itself
    gm = ((man > 100) & (man < 150)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(gm)
    box = None
    for i in range(1, n):
        x, y, bw, bh, ar = st[i]
        if bw > 450 and bh > 200:
            box = (x, y, x + bw, y + bh)
    print("display box", box)
    # the frame: drop everything outside the content area (the rounded border is the outermost dark line)
    ink[:60, :] = 0
    ink[750:, :] = 0                                           # the next drawing of the manual starts below the bottom rule
    ink[:, :95] = 0
    ink[:, 2975:] = 0
    return ink, box


def build_panel():
    ink, box = panel()
    H, W = ink.shape
    # Samsung's overhead photo: ring centre (423,107) crop px, the manual's at about (1550,414) full-res px; crop = a + 0.1667 * manual
    k = 0.30 / 1.8
    ox, oy = 423 - 1548 * k, 107 - 413 * k
    cw, ch = int(round(CROP_W * PX_PER_CROP)), int(round(CROP_H * PX_PER_CROP))
    # a dark glossy panel: near black with a faint top-down sheen
    base = np.zeros((ch, cw, 3), np.float32)
    yy = np.linspace(0, 1, ch)[:, None]
    base[...] = (13 + 5 * (1 - yy))[..., None]
    base += rng.normal(0, 0.8, (ch, cw, 1))
    img = base.copy()

    def scale_to(src, fx):
        return cv2.resize(src, None, fx=fx, fy=fx, interpolation=cv2.INTER_AREA)

    s = k * PX_PER_CROP                                       # manual px -> texture px
    inkS = scale_to(ink.astype(np.float32), s) / 255.0
    tx, ty = int(round(ox * PX_PER_CROP)), int(round(oy * PX_PER_CROP))
    # colour classes: red bars before Wash / Rinse / Spin, dim-red icons inside the display box, white for the rest
    colour = np.ones(inkS.shape + (3,), np.float32) * np.array([236, 236, 240], np.float32)
    if box:
        bx0, by0, bx1, by1 = [int(v * s) for v in box]
        colour[by0:by1, bx0:bx1] = np.array([120, 26, 26], np.float32)
    # red bars: the small solid rectangles left of Wash, Rinse and Spin (full-res x about 2680-2720)
    for yc in (221, 322, 421):
        pass
    def put(dst, src, colr, x0, y0):
        h, w = src.shape[:2]
        xs0, ys0 = max(0, x0), max(0, y0)
        xs1, ys1 = min(dst.shape[1], x0 + w), min(dst.shape[0], y0 + h)
        if xs1 <= xs0 or ys1 <= ys0:
            return
        a = src[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0][..., None]
        c = colr[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0]
        dst[ys0:ys1, xs0:xs1] = dst[ys0:ys1, xs0:xs1] * (1 - a) + c * a
    # red bars: the three solid rectangles left of Wash, Rinse and Spin (found in the manual's drawing at x 2684, 19 x 40 px)
    solid = (man_gray < 80).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid)
    for i in range(1, n):
        x, y, bw, bh, ar = st[i]
        if x == 2684 and 17 <= bw <= 21 and 36 <= bh <= 44 and ar > 0.9 * bw * bh:
            x0, y0, x1, y1 = [int(v * s) for v in (x, y, x + bw, y + bh)]
            colour[y0:y1 + 1, x0:x1 + 1] = np.array([240, 40, 44], np.float32)
    put(img, inkS, colour, tx, ty)
    return Image.fromarray(img.clip(0, 255).astype(np.uint8)), (tx, ty, s)


def seven(d, x, y, w, h, digit, on_col, off_col):
    t = w * 0.2
    def bar(p0, p1):
        p0, p1 = np.array(p0, float), np.array(p1, float)
        dv = (p1 - p0) / np.linalg.norm(p1 - p0)
        n = np.array([-dv[1], dv[0]])
        c = t / 2
        return [tuple(p0 + (0, 0)), tuple(p0 + dv * c + n * c), tuple(p1 - dv * c + n * c), tuple(p1), tuple(p1 - dv * c - n * c), tuple(p0 + dv * c - n * c)]
    xl, xr, yt, ym, yb = x + t / 2, x + w - t / 2, y + t / 2, y + h / 2, y + h - t / 2
    g = t * 0.6
    segs = {"a": bar((xl + g, yt), (xr - g, yt)), "g": bar((xl + g, ym), (xr - g, ym)), "d": bar((xl + g, yb), (xr - g, yb)),
            "f": bar((xl, yt + g), (xl, ym - g * .5)), "e": bar((xl, ym + g * .5), (xl, yb - g)),
            "b": bar((xr, yt + g), (xr, ym - g * .5)), "c": bar((xr, ym + g * .5), (xr, yb - g))}
    lit = {"8": "abcdefg"}[digit]
    for k, pts in segs.items():
        d.polygon(pts, fill=on_col if k in lit else off_col)


def panel_final():
    img, (tx, ty, s) = build_panel()
    P = PX_PER_CROP
    d = ImageDraw.Draw(img)
    # display: a dark window with a lit red "88" (Samsung's photo shows it lit)
    wx0, wy0, wx1, wy1 = 470 * P, 70 * P, 557 * P, 112 * P
    d.rounded_rectangle([wx0, wy0, wx1, wy1], 5 * P, fill=(34, 12, 12))
    d.rounded_rectangle([wx0 + 22 * P, wy0 + 5 * P, wx1 - 22 * P, wy1 - 5 * P], 3 * P, fill=(10, 5, 5))
    for dx in (0, 1):
        seven(d, int((492 + dx * 26) * P), int(77 * P), int(21 * P), int(28 * P), "8", (240, 40, 44), (60, 14, 14))
    # SAMSUNG wordmark (white letters of the logo) and the "Eco Bubble" line, as on Samsung's photo
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(int)
    letters = a[..., 3].astype(np.uint8)                                  # the wordmark is the opaque part of the logo file
    ys, xs = np.where(letters > 0)
    letters = letters[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    wm = Image.fromarray(letters).resize((int(90 * P), int(90 * P * letters.shape[0] / letters.shape[1])), Image.LANCZOS)
    layer = np.asarray(img).astype(np.float32)
    a = np.asarray(wm).astype(np.float32)[..., None] / 255
    x0, y0 = int(55 * P), int(52 * P)
    layer[y0:y0 + a.shape[0], x0:x0 + a.shape[1]] = layer[y0:y0 + a.shape[0], x0:x0 + a.shape[1]] * (1 - a * 0.9) + np.array([200, 200, 206], np.float32) * a * 0.9
    img = Image.fromarray(layer.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    d.text((55 * P, 153 * P), "BubbleStorm™  Digital Inverter", font=font(int(7.2 * P), 5), fill=(124, 125, 132), anchor="lm")
    d.text((803 * P, 150 * P), "7", font=font(int(15 * P), 7), fill=(222, 222, 226), anchor="rm")
    d.text((806 * P, 153 * P), "kg", font=font(int(8 * P), 7), fill=(222, 222, 226), anchor="lm")
    # two halves (each under 4096 px): the model's panel is two planes side by side
    half = img.width // 2
    save(img.crop((0, 0, half, img.height)), "panel_l.jpg", 92)
    save(img.crop((half, 0, img.width, img.height)), "panel_r.jpg", 92)
    return img


# ───────────────────────── everything else ─────────────────────────
def main():
    panel_final()

    # energy label: Samsung's own for WA70BG4441BYTL (0.0089 kWh/kg/cycle, 7.0 kg), die-cut
    src = Image.open(os.path.join(PHOTOS, "samsung_wa70", "1.jpg")).convert("RGB")
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.sum(2) < 735)
    lab = src.crop((xs.min() - 1, ys.min() - 1, xs.max() + 2, ys.max() + 2)).convert("RGBA")
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g, b, _ = px[x, y]
        if min(r, g, b) < 215:
            continue
        seen[y, x] = True
        px[x, y] = (r, g, b, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = lab.getchannel("A")
    lab = lab.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    lab.putalpha(alpha)
    save(lab, "label.png")

    # body: lavender-grey moulded plastic. The studio shading of the photo is not baked in, the lights do that.
    save(paint(256, 512, (178, 180, 186), 1.2, (1.0, 0.97)), "body.jpg", 85)
    top = paint(256, 256, (166, 168, 174), 1.2)
    save(top, "top.jpg", 85)
    front = paint(512, 1024, (178, 180, 186), 1.0, (1.03, 0.94))
    d = ImageDraw.Draw(front)
    d.line([(0, 168), (512, 168)], fill=(142, 144, 150), width=2)       # the seam under the deck, as in the front photo
    save(front, "front.jpg", 85)
    # side: the two recessed panels and the handle pocket, flattened from Samsung's side photo and cut to the grey body only
    # (from 80 mm to 835 mm above the floor, from the front edge to 556 mm back); the left side is the mirror image
    s = Image.open(os.path.join(PHOTOS, "samsung_wa70", "2.jpg")).convert("L")
    sa = np.asarray(s).astype(np.float32)
    ys, xs = np.where(sa < 245)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    kx, ky = (x1 - x0 + 1) / 568.0, (y1 - y0 + 1) / 988.0
    blur = cv2.GaussianBlur(sa, (0, 0), 38)
    detail = sa / np.maximum(blur, 1) - 1.0                                # the relief only
    r0, r1 = int(y1 - 835 * ky), int(y1 - 80 * ky)
    c0, c1 = int(x0 + 0 * kx), int(x0 + 556 * kx)
    crop = cv2.resize(detail[r0:r1, c0:c1], (556, 755), interpolation=cv2.INTER_AREA)
    sidei = (176 + crop * 150).clip(0, 255)
    img = np.stack([sidei, sidei + 1.5, sidei + 5], axis=2).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(img), "side.jpg", 88)
    save(Image.fromarray(img[:, ::-1]), "side_l.jpg", 88)

    # drum: diamond pattern. Each pyramid has four facets lit from different sides; 16 px pyramids, 8 x 8 per tile.
    N, pitch = 8, 64
    size = N * pitch
    yy, xx = np.mgrid[0:size, 0:size]
    u = (xx % pitch) / pitch - 0.5
    v = (yy % pitch) / pitch - 0.5
    du, dv = np.abs(u), np.abs(v)
    # facet normal: the pyramid's height falls off toward the edges; shading by which side the pixel is on
    shade = np.where(du > dv, np.where(u > 0, 0.62, 1.12), np.where(v > 0, 0.82, 0.96))
    edge = np.minimum(0.5 - du, 0.5 - dv)
    tex = 150 * shade * (0.82 + 0.45 * np.clip(edge * 2.2, 0, 1))
    tex += rng.normal(0, 1.2, tex.shape)
    drum = np.stack([tex, tex, tex * 1.02], axis=2)
    # the small drain holes at the pyramid tips (black dots), as in the photo
    cx = (xx % pitch) - pitch / 2
    cy = (yy % pitch) - pitch / 2
    drum[(np.hypot(cx, cy) < 2.4)] = (30, 30, 32)
    save(Image.fromarray(drum.clip(0, 255).astype(np.uint8)), "drum.jpg", 86)
    # pulsator fins and the small water holes: flat grey with a rim
    save(paint(128, 128, (200, 202, 207), 0.8), "pulsator.jpg", 85)
    detergent()
    magic_filter()


# ───────────────────────── the prints inside, sharp (12 px per mm on the model) ─────────────────────────
PRINT_K = 12


def detergent():
    """The detergent box lid (182 x 66 mm in the model): the pouring-cup icon, DETERGENT, and Ecobubble(TM) in a grey box.
    Placed by the ink boxes on Samsung's photo 4.jpg, where the lid spans x 380-698, rows 518-623 (fractions of that box);
    the words as printed there, set in Avenir Next (the print's own face is a similar rounded grotesque)."""
    W, H, ss = round(182 * PRINT_K), round(66 * PRINT_K), 3
    U = lambda x: (x - 380) / 318 * W * ss
    V = lambda y: (y - 518) / 105 * H * ss
    img = Image.new("RGB", (W * ss, H * ss), (176, 178, 184))
    d = ImageDraw.Draw(img)
    ink, boxc = (72, 74, 80), (112, 114, 121)

    def fit(text, face, x0, y0, x1, y1, colour):
        f = font(400, face)
        bb = d.textbbox((0, 0), text, font=f)
        lay = Image.new("L", (bb[2] - bb[0] + 8, bb[3] - bb[1] + 8), 0)
        ImageDraw.Draw(lay).text((4 - bb[0], 4 - bb[1]), text, font=f, fill=255)
        a = np.asarray(lay); ys, xs = np.where(a > 40)
        lay = Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
        w, h = round(U(x1) - U(x0)), round(V(y1) - V(y0))
        lay = lay.resize((w, h), Image.LANCZOS)
        img.paste(Image.new("RGB", lay.size, colour), (round(U(x0)), round(V(y0))), lay)

    # ink boxes read on the photo enlarged 10 x (x 486-600, rows 562-600)
    fit("DETERGENT", 5, 519, 570, 587, 579, ink)
    d.rectangle([U(520), V(586), U(586), V(595.5)], fill=boxc)         # the grey box
    fit("Ecobubble", 5, 531.5, 588.2, 574, 593.2, (236, 236, 240))     # the word inside it
    fit("TM", 5, 574.3, 588.4, 575.9, 589.4, (236, 236, 240))
    # the icon: a cup tipped to the left, its lip line, the level inside, and four drops under the lip (photo x 488-514)
    q = lambda cx, cy: (U(486 + cx / 10), V(562 + cy / 10))
    lw = round(0.75 * PRINT_K * ss * 0.55)
    d.line([q(80, 182), q(162, 198), q(196, 262), q(271, 183), q(181, 86)], fill=ink, width=lw, joint="curve")
    d.line([q(166, 210), q(260, 206)], fill=ink, width=lw)
    for cx, cy in ((86, 237), (86, 290), (119, 322), (160, 322)):
        x, y = q(cx, cy); r = 0.55 * PRINT_K * ss
        d.ellipse([x - r, y - r, x + r, y + r], fill=ink)
    save(img.resize((W, H), Image.LANCZOS), "detergent.jpg", 90)


def magic_filter():
    """The Magic Filter on the drum wall (75 x 300 mm in the model): "Magic Filter" moulded over two columns of 15 mesh
    slots, as Samsung's drum photo 6.jpg shows it (the body rows 324-624; the word's centre at 0.34 of the height, the slots
    from 0.377 to 0.93; the columns at 0.15-0.47 and 0.53-0.85 of the width). The mesh inside the slots is too fine to read
    on the photo: the slots are plain and darker."""
    W, H = round(75 * PRINT_K * 0.85), round(300 * PRINT_K * 0.85)   # 10.2 px per mm
    img = Image.new("RGB", (W, H), (150, 152, 158))
    d = ImageDraw.Draw(img)
    f = font(400, 5)
    text = "Magic Filter"
    bb = d.textbbox((0, 0), text, font=f)
    lay = Image.new("L", (bb[2] - bb[0] + 8, bb[3] - bb[1] + 8), 0)
    ImageDraw.Draw(lay).text((4 - bb[0], 4 - bb[1]), text, font=f, fill=255)
    tw = round(0.57 * W)
    lay = lay.resize((tw, round(lay.height * tw / lay.width)), Image.LANCZOS)
    img.paste(Image.new("RGB", lay.size, (100, 102, 108)), ((W - tw) // 2, round(0.34 * H - lay.height / 2)), lay)
    top, bot, n = 0.377 * H, 0.93 * H, 15
    pitch = (bot - top) / (n - 0.45)
    for c0, c1 in ((0.15, 0.47), (0.53, 0.85)):
        for i in range(n):
            y = top + i * pitch
            d.rounded_rectangle([c0 * W, y, c1 * W, y + 0.45 * pitch], radius=0.12 * pitch, fill=(92, 94, 100))
    save(img, "filter.jpg", 88)


main()
