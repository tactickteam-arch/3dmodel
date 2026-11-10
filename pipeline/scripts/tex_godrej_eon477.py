"""Textures for the Godrej RT EONREGALIS 477AN RCI (Eon Regalis, 436 L), in its two colours, written to pipeline/tex/godrej_eon477/.

usage: python3 -I pipeline/scripts/tex_godrej_eon477.py
Sources (pipeline/sources/photos/godrej_eon477/, all from Godrej's own product pages for the two codes):
  mtbk_front.webp, mtbk_iso_left.webp   RT EONREGALIS 477AN RCI MT BK (Matt Black): straight front, 3/4 view
  chgd_front.webp, chgd_iso_right.webp  RT EONREGALIS 477AN RCI CH GD (Champagne Gold)
  open.webp                             the Matt Black, both doors open (on both pages)
Writes:
  door_<finish>_fz.jpg, door_<finish>_fr.jpg   the door fronts of each colour, from that colour's straight front with the
                                               logo and the display painted out (both are their own decals): the
                                               photo's own fall in light at half depth, at the colour measured as a
                                               share of the photo's white background (no energy label in Godrej's
                                               photos), times SHADE (tuned on renders, REVIEW.md)
  logo_light.png                               the Godrej script (Godrej's own header SVG), white on both colours
  display_<finish>.png                         the display on the freezer door, redrawn from both fronts: black glass
                                               with its four lit dots, slider and keys over the grey Nano Shield badge,
                                               in a dark frame (Matt Black) or a bright silver one (Champagne Gold).
                                               Its small words are not readable in any photo, so they are drawn as
                                               short grey strokes; only the badge's two lines are written out
  print_easyslide.png, print_farmfresh.png, print_icemaker.png   the words Godrej prints inside (open photo)
  back_freezer.png, duct_fridge.png            the freezer's back panel and the fridge's Cool Shower duct (open photo)
  cover_grid.png                               the vegetable tray's cover: a grid of small holes (open photo)
  side_grille.png                              the slatted vent on the lower back of each side (3/4 photos)
Every size is in private/research/godrej_eon477/NOTES.md, with how it was measured.
"""
import math
import os
import site
import sys

sys.path.append(site.getusersitepackages())
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(SITE, "pipeline/sources/photos/godrej_eon477")
OUT = os.path.join(SITE, "pipeline/tex/godrej_eon477")
os.makedirs(OUT, exist_ok=True)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BOLD, DEMI, MED, REG = 0, 2, 5, 7
rng = np.random.default_rng(477)


def save(img, name, q=88):
    p = os.path.join(OUT, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", name, img.size, os.path.getsize(p) // 1024, "KB")


def photo(name):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    return np.asarray(bg.convert("RGB")).astype(np.float32), np.asarray(im)[:, :, 3]


def font(size, face=DEMI):
    return ImageFont.truetype(AVENIR, size, index=face)


def blur(a, s):
    """gaussian blur of a float array (sigma s px)"""
    return cv2.GaussianBlur(a.astype(np.float32), (0, 0), s, borderType=cv2.BORDER_REFLECT)


# ── the doors ──
# Door sizes (mm): both 735.5 wide; the freezer door 510 tall, the fridge door 1171 (NOTES.md). On each straight front the
# body's box comes from the photo's alpha; the doors' gap is the dark band at the seam rows (mtbk 349-355, chgd 352-361).
# Godrej's fronts show a taller fridge door than the 436 L's (the photos are of the 1.85 m body): the fridge door's photo is
# fitted to the 436 L's door. The logo and the display (decals) are painted out from the rows above and below them.
DOOR_MM = {"fz": (735.5, 510), "fr": (735.5, 1171)}
PX_MM = 0.7
FIN = {
    "mtbk": dict(src="mtbk_front.webp", seam=(349, 355), cut=[(440, 478, 168, 192), (439, 478, 203, 269)], mx=(4, 3),
                 FALL=0.8, STREAK=0.3, HAIR=0.0, SHADE=float(os.environ.get("G477_SHADE_MTBK", 0.7))),
    "chgd": dict(src="chgd_front.webp", seam=(352, 361), cut=[(433, 474, 171, 192), (432, 475, 207, 275)], mx=(10, 5),
                 FALL=0.8, STREAK=0.2, HAIR=0.5, SHADE=float(os.environ.get("G477_SHADE_CHGD", 0.86))),
}


def hairlines(w, h, depth):
    """fine vertical brushing: column noise stretched along the door"""
    if depth <= 0:
        return np.zeros((h, w), np.float32)
    n = rng.normal(0, 1, (h // 60 + 2, w)).astype(np.float32)
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
    n = blur(n, 0.6)
    return n / (n.std() + 1e-6) * depth


def door_textures(key, f):
    rgb, a = photo(f["src"])
    ys, xs = np.where(a > 200)
    X0, X1, Y0, Y1 = xs.min(), xs.max(), ys.min(), ys.max()
    for (x0, x1, y0, y1) in f["cut"]:
        top, bot = rgb[y0 - 3:y0].mean(0), rgb[y1 + 1:y1 + 4].mean(0)
        for i, y in enumerate(range(y0, y1 + 1)):
            t = i / max(1, y1 - y0)
            rgb[y, x0:x1 + 1] = (top * (1 - t) + bot * t)[x0:x1 + 1]
    s0, s1 = f["seam"]
    full = [y for y in range(Y0, Y1 + 1) if (a[y] > 200).sum() >= 0.97 * (X1 - X0 + 1)]
    Yd = max(full)
    # the body's edges lean a few px over its height on the Champagne Gold's front: mx keeps the edge band out
    l, r = f["mx"]
    regions = {"fz": rgb[Y0 + 4:s0 - 2, X0 + l:X1 - r], "fr": rgb[s1 + 3:Yd - 4, X0 + l:X1 - r]}
    for part, reg in regions.items():
        wmm, hmm = DOOR_MM[part]
        W, H = int(wmm * PX_MM), int(hmm * PX_MM)
        r = cv2.resize(reg, (W, H), interpolation=cv2.INTER_CUBIC).clip(1, 255)
        mean = r.reshape(-1, 3).mean(0)
        lum = r.mean(2)
        low = blur(lum, max(W, H) * 0.12)
        mid = lum / np.maximum(1, low)
        k = (low / low.mean()) ** f["FALL"] * mid ** f["STREAK"]
        out = mean[None, None, :] * k[:, :, None] * f["SHADE"] + hairlines(W, H, f["HAIR"])[:, :, None]
        save(Image.fromarray(out.clip(0, 255).astype(np.uint8)), f"door_{key}_{part}.jpg")
        print(f"   {key} {part}: rows {Y0}-{Yd}; photo mean {mean.round(1)} (ratio {mean.mean() / 255:.3f}); written x{f['SHADE']}")


for key, f in FIN.items():
    door_textures(key, f)

# ── the Godrej script: Godrej's header SVG (logos/godrej.png), white on both colours (both fronts) ──
logo = Image.open(os.path.join(SITE, "logos/godrej.png")).convert("RGBA")
alpha = logo.getchannel("A")
im = Image.new("RGBA", logo.size, (236, 236, 238, 0))
im.putalpha(alpha.point(lambda v: int(v * 0.95)))
save(im.resize((512, int(512 * logo.size[1] / logo.size[0])), Image.LANCZOS), "logo_light.png")

# ── the display on the freezer door, redrawn ──
# 78 x 148 mm (both fronts: 31 x 58 px at 0.401 px per mm). In fractions of its width and height (measured on the Matt
# Black front, the same on the Champagne Gold): the black glass down to 0.66, four lit dots at 0.22 across and 0.14, 0.23,
# 0.33, 0.43 down with their words to the right; at the right three strokes at 0.21, 0.285 (brighter) and 0.37 down; the
# slider at 0.49 from 0.15 to 0.78 with its dot at 0.82; the bottom keys at 0.6 (a figure at 0.19, two lit squares at 0.37
# and 0.5, a two-line word block at 0.68-0.87); under it the grey badge with the shield ring at 0.15-0.35 and two lines.
DW, DH, DPX, SS = 78, 148, 6, 3


def display(frame, name):
    W, H = DW * DPX * SS, DH * DPX * SS
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    X = lambda f: int(f * W)
    Y = lambda f: int(f * H)
    r = int(4 * DPX * SS)
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=r, fill=frame)
    m = int(1.6 * DPX * SS)
    d.rounded_rectangle([m, m, W - 1 - m, H - 1 - m], radius=r - m, fill=(36, 37, 40))           # the badge's charcoal
    d.rounded_rectangle([m, m, W - 1 - m, Y(0.66)], radius=r - m, fill=(10, 10, 12))            # the black glass
    d.rectangle([m, Y(0.66) - r, W - 1 - m, Y(0.66)], fill=(10, 10, 12))
    WH, GR, DIM = (236, 236, 240), (128, 128, 134), (78, 78, 84)
    for fy in (0.14, 0.23, 0.33, 0.43):
        s = 0.022 * H
        d.rounded_rectangle([X(0.22) - s / 2, Y(fy) - s / 2, X(0.22) + s / 2, Y(fy) + s / 2], radius=s * 0.25, fill=WH)
        d.rectangle([X(0.31), Y(fy) - 0.004 * H, X(0.31) + 0.15 * W, Y(fy) + 0.004 * H], fill=GR)
    for fy, col, w in ((0.21, DIM, 0.16), (0.285, GR, 0.16), (0.37, DIM, 0.16)):
        d.rectangle([X(0.68), Y(fy) - 0.0035 * H, X(0.68 + w), Y(fy) + 0.0035 * H], fill=col)
    d.rectangle([X(0.15), Y(0.49) - 0.002 * H, X(0.78), Y(0.49) + 0.002 * H], fill=DIM)
    s = 0.02 * H
    d.ellipse([X(0.82) - s / 2, Y(0.49) - s / 2, X(0.82) + s / 2, Y(0.49) + s / 2], fill=WH)
    # the figure key (a standing figure), two lit squares, the word block, each with a small stroke under it
    cx, cy = X(0.19), Y(0.585)
    d.ellipse([cx - 0.012 * H, cy - 0.03 * H, cx + 0.012 * H, cy - 0.008 * H], outline=GR, width=int(0.004 * H))
    d.line([cx, cy - 0.008 * H, cx, cy + 0.02 * H], fill=GR, width=int(0.004 * H))
    for fx in (0.37, 0.5):
        d.rounded_rectangle([X(fx) - s / 2, Y(0.585) - s / 2, X(fx) + s / 2, Y(0.585) + s / 2], radius=s * 0.25, fill=WH)
    for fx in (0.19, 0.37, 0.5):
        d.rectangle([X(fx) - 0.04 * W, Y(0.625) - 0.003 * H, X(fx) + 0.04 * W, Y(0.625) + 0.003 * H], fill=DIM)
    d.rectangle([X(0.7), Y(0.578) - 0.004 * H, X(0.84), Y(0.578) + 0.004 * H], fill=GR)
    d.rectangle([X(0.68), Y(0.618) - 0.003 * H, X(0.87), Y(0.618) + 0.003 * H], fill=DIM)
    # the badge: the shield in a ring, NANO SHIELD and TECHNOLOGY (Godrej's feature, "Nano shield technology")
    cx, cy, rr = X(0.25), Y(0.83), 0.1 * W
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=(206, 206, 212), width=int(0.012 * W))
    d.polygon([(cx - rr * 0.5, cy - rr * 0.45), (cx + rr * 0.5, cy - rr * 0.45), (cx + rr * 0.45, cy + rr * 0.1), (cx, cy + rr * 0.6),
               (cx - rr * 0.45, cy + rr * 0.1)], fill=(220, 220, 226))
    for t, fy, size, face, col in (("NANO SHIELD", 0.815, 0.055, BOLD, (236, 236, 240)), ("TECHNOLOGY", 0.865, 0.032, MED, (170, 170, 176))):
        ft = font(int(size * W * 1.0), face)
        b = d.textbbox((0, 0), t, font=ft)
        k = min(1.0, 0.48 * W / (b[2] - b[0]))
        ft = font(int(size * W * k), face)
        b = d.textbbox((0, 0), t, font=ft)
        d.text((X(0.38) - b[0], Y(fy) - (b[3] - b[1]) / 2 - b[1]), t, font=ft, fill=col)
    save(img.resize((W // SS, H // SS), Image.LANCZOS), name)


display((44, 45, 49, 255), "display_mtbk.png")       # the Matt Black's frame: dark grey (mtbk_front)
display((206, 205, 203, 255), "display_chgd.png")    # the Champagne Gold's frame: bright silver (chgd_front)


# ── the words printed inside ──
def print_png(name, parts, w_mm, h_mm, col, px=10):
    """parts: [(words, face)], written on one line"""
    W, H = int(w_mm * px * SS), int(h_mm * px * SS)
    im = Image.new("RGBA", (W, H), col + (0,))
    dd = ImageDraw.Draw(im)
    size = int(H * 0.72)
    for _ in range(2):
        fs = [ImageFont.truetype(AVENIR, size, index=face) for _, face in parts]
        widths = [dd.textbbox((0, 0), t, font=f)[2] - dd.textbbox((0, 0), t, font=f)[0] for (t, _), f in zip(parts, fs)]
        sp = dd.textlength(" ", font=fs[0])
        total = sum(widths) + sp * (len(parts) - 1)
        if total <= W * 0.98:
            break
        size = int(size * W * 0.98 / total)
    x = (W - total) / 2
    for (t, _), f, w in zip(parts, fs, widths):
        b = dd.textbbox((0, 0), t, font=f)
        dd.text((x - b[0], (H - (b[3] - b[1])) / 2 - b[1]), t, font=f, fill=col + (255,))
        x += w + sp
    save(im.resize((W // SS, H // SS), Image.LANCZOS), name)


# "Easy Slide Shelf" on the shelf's frosted front rail (open photo; Godrej's close-up): grey, about 120 mm long
print_png("print_easyslide.png", [("Easy Slide Shelf", MED)], 120, 13, (92, 94, 100))
# "Farm Fresh" across the vegetable tray's front (open photo): "Farm" light, "Fresh" heavier, about 130 mm long
print_png("print_farmfresh.png", [("Farm", REG), ("Fresh", DEMI)], 132, 22, (70, 72, 78))
# "Movable Ice Maker" across the ice box's front (open photo): dark on the clear box, about 110 mm long
print_png("print_icemaker.png", [("Movable Ice Maker", MED)], 110, 12, (88, 90, 96))


def slots(a, boxes, px, depth=92):
    for (x0, y0, x1, y1) in boxes:
        X0, Y0, X1, Y1 = int(x0 * px), int(y0 * px), int(x1 * px), int(y1 * px)
        a[Y0:Y1, X0:X1] = depth
        a[Y0:Y0 + 2, X0:X1] = depth - 22                 # the upper lip's shadow
        a[Y1 - 1:Y1 + 1, X0:X1] = 246                    # the lit lower lip


# ── the freezer's back panel: 500 x 341 mm at 2 px per mm (open photo, in fractions of the panel) ──
# above the glass shelf (at 0.47 down): a wide slot at 0.053 (0.175-0.775 across), a slot each side at 0.176 (0.175-0.30
# and 0.65-0.775), a small square sign at the top left and a round button at the top right, a small oval at 0.366
# (0.80-0.85); under the shelf two slots at 0.57; at the bottom left the floor's return grille (0.05-0.35, 0.95-1.0)
px, FW, FH = 2.0, 500, 341
a = np.full((int(FH * px), int(FW * px)), 236.0, np.float32)
a += np.linspace(5, -5, a.shape[0])[:, None]
b = [(0.175 * FW, 0.053 * FH - 3, 0.775 * FW, 0.053 * FH + 3)]
for fy in (0.176, 0.57):
    b += [(0.175 * FW, fy * FH - 3, 0.30 * FW, fy * FH + 3), (0.65 * FW, fy * FH - 3, 0.775 * FW, fy * FH + 3)]
for i in range(9):
    x0 = (0.05 + i * 0.033) * FW
    b.append((x0, 0.952 * FH, x0 + 0.02 * FW, 0.995 * FH))
slots(a, b, px)
im = Image.fromarray(np.stack([a - 2, a, a + 4], 2).clip(0, 255).astype(np.uint8))
dd = ImageDraw.Draw(im)
dd.rectangle([0.04 * FW * px, 0.06 * FH * px, 0.075 * FW * px, 0.095 * FH * px], outline=(150, 152, 158), width=2)
cx, cy, r = 0.88 * FW * px, 0.08 * FH * px, 0.016 * FW * px
dd.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(150, 152, 158), width=3)
dd.ellipse([0.80 * FW * px, 0.355 * FH * px, 0.85 * FW * px, 0.377 * FH * px], outline=(170, 172, 178), width=2)
save(im, "back_freezer.png")

# ── the Cool Shower duct down the fridge's back wall: 254 x 632 mm at 1.5 px per mm (open photo) ──
# from the top tray (1050 mm) to the vegetable cover (418 mm). Heights in mm above the floor: slot pairs at 1024, 867 and
# 592 (each 45 mm long, 49-95 mm either side of the middle), the three-line grille at 982-1009, the Nano Shield sign at
# 788-845 (40 mm wide), a small dark square at 454
px, DW2, DH2, TOP = 1.5, 254, 632, 1050
yy = lambda mm: TOP - mm
a = np.full((int(DH2 * px), int(DW2 * px)), 238.0, np.float32)
a[:, :3] -= 22; a[:, -3:] -= 22
b = []
for mm in (1024, 867, 592):
    b += [(DW2 / 2 - 95, yy(mm) - 3, DW2 / 2 - 50, yy(mm) + 3), (DW2 / 2 + 50, yy(mm) - 3, DW2 / 2 + 95, yy(mm) + 3)]
for mm in (1006, 995.5, 985):
    b.append((DW2 / 2 - 28, yy(mm) - 1.6, DW2 / 2 + 28, yy(mm) + 1.6))
slots(a, b, px)
im = Image.fromarray(np.stack([a - 2, a, a + 4], 2).clip(0, 255).astype(np.uint8))
dd = ImageDraw.Draw(im)
x0, x1, y0, y1 = (DW2 / 2 - 20) * px, (DW2 / 2 + 20) * px, yy(845) * px, yy(788) * px
dd.rounded_rectangle([x0, y0, x1, y1], radius=6, fill=(226, 228, 232), outline=(170, 172, 178), width=2)
cx, cy, r = (x0 + x1) / 2, y0 + (y1 - y0) * 0.4, 0.3 * (x1 - x0)
dd.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(120, 124, 132), width=3)
dd.polygon([(cx - r * 0.5, cy - r * 0.45), (cx + r * 0.5, cy - r * 0.45), (cx + r * 0.45, cy + r * 0.1), (cx, cy + r * 0.6), (cx - r * 0.45, cy + r * 0.1)], fill=(120, 124, 132))
for k in range(2):
    dd.rectangle([x0 + 0.18 * (x1 - x0), y0 + (0.74 + 0.1 * k) * (y1 - y0), x1 - 0.18 * (x1 - x0), y0 + (0.77 + 0.1 * k) * (y1 - y0)], fill=(150, 152, 158))
s = 6 * px
dd.rectangle([DW2 / 2 * px - s / 2, yy(454) * px - s / 2, DW2 / 2 * px + s / 2, yy(454) * px + s / 2], fill=(40, 40, 44))
save(im, "duct_fridge.png")

# ── the vegetable tray's cover: white with a fine grid of small holes (open photo), 2 px per mm, tiled 100 mm ──
px, T = 4, 100
a = np.full((T * px, T * px), 238.0, np.float32)
for i in range(20):
    for j in range(20):
        cx, cy = (i + 0.5) * 5 * px, (j + 0.5) * 5 * px
        a[int(cy - 3):int(cy + 3), int(cx - 3):int(cx + 3)] = 168
save(Image.fromarray(np.stack([a - 2, a, a + 3], 2).clip(0, 255).astype(np.uint8)), "cover_grid.png")

# ── the vent on the lower back of each side: a rounded panel, 120 x 135 mm, with 14 slats (3/4 photos) ──
px, GW, GH = 4, 120, 135
im = Image.new("RGB", (GW * px, GH * px), (58, 58, 62))
dd = ImageDraw.Draw(im)
dd.rounded_rectangle([2, 2, GW * px - 3, GH * px - 3], radius=8 * px, outline=(96, 96, 100), width=2 * px)
for k in range(14):
    y = (12 + k * 8) * px
    dd.rectangle([14 * px, y, (GW - 14) * px, y + 4 * px], fill=(22, 22, 24))
    dd.rectangle([14 * px, y + 4 * px, (GW - 14) * px, y + 5 * px], fill=(104, 104, 108))
dd.ellipse([(GW / 2 - 3) * px, (GH - 9) * px, (GW / 2 + 3) * px, (GH - 3) * px], fill=(120, 120, 124))
save(im, "side_grille.png")
