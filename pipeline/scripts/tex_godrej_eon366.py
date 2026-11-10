"""Textures for the Godrej RT EONVIBE 366BN RCIT (Eon Vibe, 330 L), in its three colours, written to pipeline/tex/godrej_eon366/.

usage: python3 -I pipeline/scripts/tex_godrej_eon366.py
Sources (pipeline/sources/photos/godrej_eon366/, all from Godrej's own product pages):
  mtbk_front.webp, mtbk_34.webp   RT EONVIBE 366BN RCIT MT BK (Matt Black): straight front, 3/4 view
  chgd_front.webp, chgd_34.webp   RT EONVIBE 366BN RCIT CH GD (Champagne Gold)
  strh_front.webp, strh_34.webp   RT EONVIBE 366BN RCIT ST RH (Steel Rush)
  open.webp                       the Matt Black, both doors open (shared by all three pages)
  feature_control_panel.webp      Godrej's close-up of the "Advanced control panel"
Writes:
  door_<finish>_fz.jpg, door_<finish>_fr.jpg   the door fronts of each colour: the photo's own fall in light, kept at
                                               half depth (the 3D light adds its own), at the colour measured on that
                                               colour's straight front as a share of the photo's white; brushed
                                               colours get fine vertical hairlines. Godrej's photos carry no energy
                                               label, so the reference white is the photo's own background
  logo_light.png, logo_dark.png                the Godrej script (Godrej's own header SVG), white on the Matt Black and
                                               Steel Rush doors, near-black ink on the Champagne Gold (Godrej's fronts)
  panel.png                                    the control panel on the cabinet's top frame (seen with the freezer
                                               door open), redrawn at 7.2 px per mm from Godrej's close-up
  print_qab.png, print_utility.png, print_icemaker.png   the words Godrej prints inside (open photo, close-up)
  liner_dimples.jpg                            the fridge door's lower liner with its round embossed dimples
Every size is in private/research/godrej_eon366/NOTES.md, with how it was measured.
"""
import os
import site
import sys

sys.path.append(site.getusersitepackages())
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(SITE, "pipeline/sources/photos/godrej_eon366")
OUT = os.path.join(SITE, "pipeline/tex/godrej_eon366")
os.makedirs(OUT, exist_ok=True)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BOLD, DEMI, MED, REG = 0, 2, 5, 7
rng = np.random.default_rng(366)


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


# ── the doors ──
# Door sizes (mm): both 650 wide; the freezer door 486 tall, the fridge door 1218 (NOTES.md). On each straight front the
# body's box is found from the photo's alpha; the doors' gap is the dark band the seam rows give (mtbk 357-371, chgd
# 357-365, strh 358-368). The logo (a decal) is painted out by filling its box from the rows above and below it.
DOOR_MM = {"fz": (650, 486), "fr": (650, 1218)}
PX_MM = 0.8
# Each colour: its straight front, seam rows, the logo's box (x0, x1, y0, y1, photo px), the share of the photo's fall
# kept (FALL), the share of the mid-scale streaks kept (STREAK), fine hairline depth (HAIR, in sRGB levels) and SHADE (the
# viewer's light lifts textures; tuned on renders so the web view's ratio to white matches the photo's, REVIEW.md).
FIN = {
    "mtbk": dict(src="mtbk_front.webp", seam=(357, 371), logo=(439, 481, 168, 197), FALL=0.5, STREAK=0.3, HAIR=0.0,
                 SHADE=float(os.environ.get("G366_SHADE_MTBK", 0.45))),
    # Champagne Gold: no brushing shows on its photos (fine detail under 1 level), so no hairlines. Its soft central
    # sheen (0.2-0.27 of white brighter in the middle than at the edges, in the same place on the front and the 3/4) is
    # kept a little over full strength (FALL 1.3; the viewer's light flattens it); SHADE lowered to match
    "chgd": dict(src="chgd_front.webp", seam=(357, 365), logo=(432, 471, 178, 204), FALL=1.3, STREAK=0.3, HAIR=0.0,
                 SHADE=float(os.environ.get("G366_SHADE_CHGD", 0.88))),
    # Steel Rush: its photos' bright diagonal wedge is a reflection in the glossy film, which the clear coat now makes,
    # so little of the photo's light is kept; the faint printed hairlines under the film stay. The base is a plain print
    # now (metal 0), which the viewer lights more: SHADE 0.74
    "strh": dict(src="strh_front.webp", seam=(358, 368), logo=(441, 479, 171, 194), FALL=0.25, STREAK=0.08, HAIR=0.9,
                 SHADE=float(os.environ.get("G366_SHADE_STRH", 0.74))),
}


def blur(a, s):
    """gaussian blur of a float array (sigma s px)"""
    return cv2.GaussianBlur(a.astype(np.float32), (0, 0), s, borderType=cv2.BORDER_REFLECT)


def hairlines(w, h, depth):
    """fine vertical brushing: column noise stretched along the door"""
    if depth <= 0:
        return np.zeros((h, w), np.float32)
    n = rng.normal(0, 1, (h // 60 + 2, w)).astype(np.float32)   # each line runs ~75 mm before it changes
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
    n = blur(n, 0.6)
    return n / (n.std() + 1e-6) * depth


def door_textures(key, f):
    rgb, a = photo(f["src"])
    ys, xs = np.where(a > 200)
    X0, X1, Y0, Y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # paint the logo out: each column of its box blends the rows just above and below it
    x0, x1, y0, y1 = f["logo"]
    top, bot = rgb[y0 - 3:y0].mean(0), rgb[y1 + 1:y1 + 4].mean(0)
    for i, y in enumerate(range(y0, y1 + 1)):
        t = i / max(1, y1 - y0)
        rgb[y, x0:x1 + 1] = (top * (1 - t) + bot * t)[x0:x1 + 1]
    s0, s1 = f["seam"]
    # the doors' bottom edge: the last row the body still spans its full width (below it, only the feet)
    full = [y for y in range(Y0, Y1 + 1) if (a[y] > 200).sum() >= 0.97 * (X1 - X0 + 1)]
    Yd = max(full)
    regions = {"fz": rgb[Y0 + 4:s0 - 2, X0 + 4:X1 - 3], "fr": rgb[s1 + 3:Yd - 4, X0 + 4:X1 - 3]}
    for part, reg in regions.items():
        wmm, hmm = DOOR_MM[part]
        W, H = int(wmm * PX_MM), int(hmm * PX_MM)
        r = cv2.resize(reg, (W, H), interpolation=cv2.INTER_CUBIC).clip(1, 255)
        mean = r.reshape(-1, 3).mean(0)
        lum = r.mean(2)
        low = blur(lum, max(W, H) * 0.12)                     # the studio's broad fall of light
        mid = lum / np.maximum(1, low)                        # streaks and bands in between
        k = (low / low.mean()) ** f["FALL"] * mid ** f["STREAK"]
        out = mean[None, None, :] * k[:, :, None] * f["SHADE"] + hairlines(W, H, f["HAIR"])[:, :, None]
        save(Image.fromarray(out.clip(0, 255).astype(np.uint8)), f"door_{key}_{part}.jpg")
        print(f"   {key} {part}: door rows to {Yd}; photo mean {mean.round(1)} of 255 (ratio {mean.mean() / 255:.3f}); written x{f['SHADE']}")


for key, f in FIN.items():
    door_textures(key, f)

# ── the Godrej script: Godrej's header SVG, rendered by rasterize_svg.mjs into logos/godrej.png (650 px wide) ──
logo = Image.open(os.path.join(SITE, "logos/godrej.png")).convert("RGBA")
alpha = logo.getchannel("A")
for name, col in [("logo_light.png", (236, 236, 238)), ("logo_dark.png", (58, 58, 62))]:
    im = Image.new("RGBA", logo.size, col + (0,))
    im.putalpha(alpha.point(lambda v: int(v * 0.95)))
    save(im.resize((512, int(512 * logo.size[1] / logo.size[0])), Image.LANCZOS), name)

# ── the control panel, redrawn ──
# Godrej's close-up (feature_control_panel.webp, 1216 x 790): the black glass runs x 13-1201, y 283-545 (1188 x 262 px).
# On the cabinet it is 188 x 41.5 mm (open photo, NOTES.md). Every box below is in the close-up's own pixels, measured on
# it; the finger in the close-up covers only empty glass. Drawn at 3x and reduced to 7.2 px per mm.
PW, PH = 1188, 262
OX, OY = 13, 283 - 270                                    # the measurements were taken on the crop from y 270
SS = 3
PX = 7.2
pw, ph = int(round(188 * PX)), int(round(41.5 * PX))
img = Image.new("RGB", (PW * SS, PH * SS), (24, 24, 27))
d = ImageDraw.Draw(img)
S = lambda v: int(round(v * SS))
X = lambda x: S(x - OX)
Y = lambda y: S(y - OY)
WHITE, LINE, BAR, ICON = (232, 232, 236), (150, 150, 156), (112, 112, 118), (150, 150, 156)


def rbox(x0, y0, x1, y1, r=8, w=2.2, col=LINE):
    d.rounded_rectangle([X(x0), Y(y0), X(x1), Y(y1)], radius=S(r), outline=col, width=S(w))


def text(t, cx, cy, size, face=DEMI, col=WHITE, fit=None):
    f = font(S(size), face)
    b = d.textbbox((0, 0), t, font=f)
    w, h = b[2] - b[0], b[3] - b[1]
    if fit and w > S(fit):                                   # never wider than the box the close-up shows
        f = font(int(S(size) * S(fit) / w), face)
        b = d.textbbox((0, 0), t, font=f); w, h = b[2] - b[0], b[3] - b[1]
    d.text((X(cx) - w / 2 - b[0], Y(cy) - h / 2 - b[1]), t, font=f, fill=col)


def drop(cx, cy, r, col=ICON):
    # a water drop: a circle with a point on top
    d.ellipse([X(cx - r), Y(cy - r * 0.55), X(cx + r), Y(cy + r * 1.45)], fill=col)
    d.polygon([(X(cx - r * 0.93), Y(cy + 0.25 * r)), (X(cx + r * 0.93), Y(cy + 0.25 * r)), (X(cx), Y(cy - r * 1.5))], fill=col)


def flake(cx, cy, r, col=ICON, w=1.6):
    import math
    for k in range(6):
        a = math.pi / 3 * k + math.pi / 2
        ex, ey = cx + r * math.cos(a), cy - r * math.sin(a)
        d.line([X(cx), Y(cy), X(ex), Y(ey)], fill=col, width=S(w))
        for side in (-1, 1):                                # the little branches
            bx, by = cx + 0.55 * r * math.cos(a), cy - 0.55 * r * math.sin(a)
            b2 = a + side * 0.75
            d.line([X(bx), Y(by), X(bx + 0.38 * r * math.cos(b2)), Y(by - 0.38 * r * math.sin(b2))], fill=col, width=S(w * 0.8))


# left: the FREEZER and FRIDGE keys and SET TEMP
rbox(50, 45, 137, 131); text("FREEZER", 93, 88, 13, fit=72)
rbox(50, 137, 137, 224); text("FRIDGE", 93, 181, 13, fit=72)
text("SET TEMP", 93, 243, 12.5, fit=80)
# the two temperature scales: grey bars joined by thin lines, with their values
BARS = [179, 243, 307, 372, 436]
for y in (88, 187):
    d.line([X(165), Y(y), X(452), Y(y)], fill=BAR, width=S(1.2))
    for cx in BARS:
        d.rounded_rectangle([X(cx - 14), Y(y - 4.5), X(cx + 14), Y(y + 4.5)], radius=S(3), fill=BAR)
for cx, t in zip(BARS, ["-14°C", "-16°C", "-18°C", "-20°C", "-21°C"]):
    text(t, cx, 116, 15, MED, fit=56)
for cx, t in zip(BARS, ["6°C", "5°C", "3°C", "2°C", "1°C"]):
    text(t, cx, 209, 15, MED, fit=40)
flake(535, 88, 12)
text("QUICK FREEZE", 542, 116, 15, DEMI, fit=130)
# CONVERT: one key with the two curved arrows, FREEZER above and FRIDGE with "Hold for 3 seconds" below
text("FREEZER", 738, 45, 12.5, fit=66)
rbox(668, 62, 812, 207, r=14)
d.arc([X(693), Y(88), X(783), Y(178)], 200, 330, fill=(120, 120, 126), width=S(9))
d.arc([X(693), Y(88), X(783), Y(178)], 20, 150, fill=(120, 120, 126), width=S(9))
for (ax, ay, dx) in [(769, 95, 1), (707, 171, -1)]:
    d.polygon([(X(ax), Y(ay - 10 * dx)), (X(ax + 14 * dx), Y(ay + 4 * dx)), (X(ax - 4 * dx), Y(ay + 9 * dx))], fill=(120, 120, 126))
text("CONVERT", 738, 134, 16.5, DEMI, fit=95)
text("FRIDGE", 738, 224, 12.5, fit=58)
text("Hold for 3 seconds", 738, 245, 11, MED, fit=136)
# the four modes: a small top key and a tall bottom key in each column, numbered 1-4
COLS = [(836, 907), (921, 992), (1006, 1077), (1092, 1163)]
TOP = ["flake", "drop", "drop", "flake"]
BOT = ["drop", "drop", "OFF", "OFF"]
for i, (x0, x1) in enumerate(COLS):
    cx = (x0 + x1) / 2
    rbox(x0, 62, x1, 113, r=7)
    rbox(x0, 120, x1, 208, r=7)
    (flake if TOP[i] == "flake" else drop)(cx, 87.5, 10 if TOP[i] == "flake" else 7.5)
    if BOT[i] == "OFF":
        text("OFF", cx, 164, 15, DEMI, fit=34)
    else:
        drop(cx, 164, 7.5)
    text(str(i + 1), cx, 238, 17, DEMI, fit=14)
# a soft glassy sheen across the top quarter (the photo's glass), kept faint
sheen = Image.new("L", img.size, 0)
ImageDraw.Draw(sheen).rectangle([0, 0, img.size[0], int(img.size[1] * 0.18)], fill=14)
img = Image.composite(Image.new("RGB", img.size, (60, 60, 66)), img, sheen.filter(ImageFilter.GaussianBlur(S(10))))
save(img.resize((pw, ph), Image.LANCZOS), "panel.png")

# ── the words printed inside ──
def print_png(name, words, w_mm, h_mm, col, face=MED, px=10):
    W, H = int(w_mm * px * SS), int(h_mm * px * SS)
    im = Image.new("RGBA", (W, H), col + (0,))
    dd = ImageDraw.Draw(im)
    f = ImageFont.truetype(AVENIR, int(H * 0.72), index=face)
    b = dd.textbbox((0, 0), words, font=f)
    k = min(1.0, W * 0.98 / (b[2] - b[0]))
    f = ImageFont.truetype(AVENIR, int(H * 0.72 * k), index=face)
    b = dd.textbbox((0, 0), words, font=f)
    dd.text(((W - (b[2] - b[0])) / 2 - b[0], (H - (b[3] - b[1])) / 2 - b[1]), words, font=f, fill=col + (255,))
    save(im.resize((W // SS, H // SS), Image.LANCZOS), name)


# "Quick Access Box" on the box's frosted top (close-up quick_access_box.webp): dark grey, about 110 mm long
print_png("print_qab.png", "Quick Access Box", 110, 14, (96, 98, 104))
# "Utility Shelf" at the right end of each of the fridge door's two utility shelves (open photo): about 45 mm long
print_png("print_utility.png", "Utility Shelf", 46, 9, (110, 112, 118))
# "Movable Ice Maker" across the ice box's front (open photo): light on the blue-tinted box, about 70 mm long
print_png("print_icemaker.png", "Movable Ice Maker", 72, 10, (238, 240, 244), DEMI)

# ── the fridge door's lower liner: round embossed dimples, five rows of four (open photo) ──
W, H = 256, 384
lin = np.full((H, W), 236.0, np.float32)
yy, xx = np.mgrid[0:H, 0:W]
for r in range(5):
    for c in range(4):
        cx, cy = (c + 0.5 + (0.5 if r % 2 else 0) - 0.25) * W / 4, (r + 0.5) * H / 5
        dd2 = np.hypot(xx - cx, yy - cy) / 22.0
        ring = np.exp(-((dd2 - 1.0) ** 2) / 0.02)
        lin += np.where(yy < cy, -10, 8) * ring              # lit from above: dark rim on top, light below
save(Image.fromarray(np.stack([lin, lin + 2, lin + 5], 2).clip(0, 255).astype(np.uint8)), "liner_dimples.jpg")


# ── the back walls (open photo): the freezer's raised panel with its rows of vent slots, and the Cool Shower duct ──
# Measured on the open photo as fractions of each panel (NOTES.md); the slots are drawn as recesses lit from above.
def slots(a, boxes, px):
    for (x0, y0, x1, y1) in boxes:
        X0, Y0, X1, Y1 = int(x0 * px), int(y0 * px), int(x1 * px), int(y1 * px)
        a[Y0:Y1, X0:X1] = 92
        a[Y0:Y0 + 2, X0:X1] = 70                       # the upper lip's shadow
        a[Y1 - 1:Y1 + 1, X0:X1] = 246                  # the lit lower lip


# freezer panel: 460 x 250 mm at 2 px per mm. Slot rows at 24%, 57% and 77% down; the left group of two runs 14-26%
# across, the right group of five 49-83% (the top row has only the right group: the ice maker hides its left end)
px = 2.0
FW, FH = 460, 250
a = np.full((int(FH * px), int(FW * px)), 236.0, np.float32)
a += np.linspace(6, -6, a.shape[0])[:, None]
b = []
for fy, groups in [(0.24, [(0.49, 0.83, 5)]), (0.57, [(0.14, 0.26, 2), (0.49, 0.83, 5)]), (0.77, [(0.14, 0.26, 2), (0.49, 0.83, 5)])]:
    for g0, g1, n in groups:
        sw = (g1 - g0) * FW / n
        for i in range(n):
            x0 = g0 * FW + i * sw + sw * 0.12
            b.append((x0, fy * FH - 3.5, x0 + sw * 0.76, fy * FH + 3.5))
slots(a, b, px)
im = Image.fromarray(np.stack([a - 2, a, a + 4], 2).clip(0, 255).astype(np.uint8))
dd = ImageDraw.Draw(im)
# the badge of four small squares at the top middle (45-54% across, 3-7% down) and the round button at the top right
for i in range(4):
    x0 = (0.447 + i * 0.025) * FW * px
    dd.rectangle([x0, 0.035 * FH * px, x0 + 0.02 * FW * px, 0.072 * FH * px], outline=(120, 122, 128), width=2)
cx, cy, r = 0.877 * FW * px, 0.118 * FH * px, 0.018 * FW * px
dd.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(170, 172, 178), width=2)
save(im, "back_freezer.png")

# the Cool Shower duct down the middle of the fridge's back wall: 200 x 670 mm at 1.5 px per mm, a pair of slots under
# the hanging light unit (22% down) and another behind the third shelf (57% down)
px = 1.5
DW, DH = 200, 670
a = np.full((int(DH * px), int(DW * px)), 238.0, np.float32)
a[:, :3] -= 22; a[:, -3:] -= 22                     # the duct's side edges
b = []
for fy in (0.22, 0.57):
    for x0 in (0.18, 0.62):
        b.append((x0 * DW, fy * DH - 3, (x0 + 0.2) * DW, fy * DH + 3))
slots(a, b, px)
save(Image.fromarray(np.stack([a - 2, a, a + 4], 2).clip(0, 255).astype(np.uint8)), "duct_fridge.png")
