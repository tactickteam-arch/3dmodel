"""Textures for the Godrej RT EONCRYSTAL 280BN RI OB (Eon Crystal, 244 L, Onyx Black toughened-glass doors), written to
pipeline/tex/godrej_eon280/.

usage: python3 -I pipeline/scripts/tex_godrej_eon280.py
Sources (pipeline/sources/photos/godrej_eon280/, all from Godrej's own product page for this code):
  front.webp               straight front (Godrej's gallery image 1; it shows the taller 310BN body, NOTES.md)
  34.webp                  3/4 from the left (image 2)
  open.webp                both doors open (image 3)
  stocked.webp             Godrej's stocked render (image 4): only the grip pockets in the doors' free edge
  feature_glass_door.webp  Godrej's "Toughened glass door" close-up: the glass's fine sparkle
Writes:
  door_ob_fz.jpg, door_ob_fr.jpg   the glass fronts: the glass's own near-black (the front photo's darkest, least
                                   reflecting rows), a little of the photo's fall from top to bottom, and the sparkle
                                   redrawn sharp at the density and strength measured on Godrej's close-up. The photo's
                                   diagonal wedge is a reflection, which the 3D glass makes itself, so it is not copied
  logo_light.png                   the Godrej script (logos/godrej.png, Godrej's own header SVG), white
  back_freezer.png                 the freezer's back wall: vent slots and the COOL AIR CONTROL plate (open photo)
  duct_fridge.png                  the Cool Shower duct down the fridge's back wall: grille, slot pairs, Deodorizer
  print_icemaker.png               "Movable Ice Maker" across the ice box (open photo)
  cover_grid.png                   the vegetable tray's clear cover with its grid (open photo)
Every size is in private/research/godrej_eon280/NOTES.md, with how it was measured.
"""
import os
import site
import sys

sys.path.append(site.getusersitepackages())
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(SITE, "pipeline/sources/photos/godrej_eon280")
OUT = os.environ.get("G280_OUT") or os.path.join(SITE, "pipeline/tex/godrej_eon280")
os.makedirs(OUT, exist_ok=True)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BOLD, DEMI, MED, REG = 0, 2, 5, 7
rng = np.random.default_rng(280)
SS = 3


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


# ── the glass fronts ──
# The glass panel inside each door's 11 mm rim (front photo: the rim is 5 px at 0.451 px per mm on every side):
# freezer 585 x 447 mm, fridge 585 x 1023 mm (door sizes in NOTES.md). 1.6 px per mm, so the sparkle stays sharp.
GLASS_MM = {"fz": (585, 447), "fr": (585, 1023)}
PX_MM = 1.6
# The glass's own colour: the front photo's least reflecting rows (fridge door, rows 750-880, off the wedge) read a
# neutral 12.4 of 255; the freezer door's left part, off the wedge, 27.5 (the studio's light from above). FALL keeps a
# share of that fall; SHADE scales for the viewer's light. Under metal 1 / roughness 0.45 the glass is a dark mirror, so
# BASE is its reflectance, not the photo's 12.4. Under the clear coat (the builder) 16 keeps the black deep: straight
# on 0.036 of white, the 3/4 off the coat's reflection 0.03-0.05 (photo 0.025-0.05). Variants in REVIEW.md.
BASE = float(os.environ.get("G280_BASE", 16))
FALL = float(os.environ.get("G280_FALL", 0.35))
SHADE = float(os.environ.get("G280_SHADE", 1.0))
# The sparkle (feature_glass_door.webp, ~1.5 px per mm from the 44 mm logo): 16 specks per 100 px2 off the reflection,
# ~0.36 per mm2, single pixels (~0.7 mm), 35-48 levels over the glass. Drawn that dense, the 3D door read as grey
# sandpaper at viewer distance, so 0.06 per mm2, 25-40 levels up (ESTIMATED, tuned on renders).
SPECK_PER_MM2 = float(os.environ.get("G280_SPECKS", 0.06))
SPECK_UP = (float(os.environ.get("G280_SPECK_LO", 25)), float(os.environ.get("G280_SPECK_HI", 40)))


def sparkle(W, H):
    n = int(SPECK_PER_MM2 * (W / PX_MM) * (H / PX_MM))
    a = np.zeros((H * 2, W * 2), np.float32)
    xs = rng.integers(0, W * 2, n)
    ys = rng.integers(0, H * 2, n)
    up = rng.uniform(*SPECK_UP, n).astype(np.float32)
    np.maximum.at(a, (ys, xs), up)
    a = cv2.GaussianBlur(a, (0, 0), 0.7)
    a = cv2.resize(a, (W, H), interpolation=cv2.INTER_AREA) * 4.0   # keep each speck's light when halving
    return a


f, alpha = photo("front.webp")
L = f.mean(2)
# the photo's fall down each door, off the wedge (x 360-450 on the freezer, 360-460 on the fridge: left of the wedge)
fall = {"fz": L[160:356, 360:450].mean(1), "fr": L[372:888, 360:460].mean(1)}
for part, (wmm, hmm) in GLASS_MM.items():
    W, H = int(wmm * PX_MM), int(hmm * PX_MM)
    prof = cv2.resize(fall[part][:, None], (1, H), interpolation=cv2.INTER_LINEAR)[:, 0]
    prof = prof / prof.min()                                   # 1 at the darkest row
    k = prof ** FALL
    lum = BASE * k[:, None] * np.ones((1, W), np.float32)
    lum = lum + sparkle(W, H)
    out = np.repeat((lum * SHADE)[:, :, None], 3, 2)
    out[:, :, :] += float(os.environ.get("G280_LIFT", 0))      # the reflectance level the glass needs under metal 1
    out[:, :, 2] += 0.6                                        # the faintest cool cast of black glass
    save(Image.fromarray(out.clip(0, 255).astype(np.uint8)), f"door_ob_{part}.jpg", q=86)
    print(f"   {part}: base {BASE} x fall^{FALL} ({k.min():.2f}-{k.max():.2f}), sparkle {SPECK_PER_MM2}/mm2, x{SHADE}")

# ── the Godrej script, white (as Godrej's front) ──
logo = Image.open(os.path.join(SITE, "logos/godrej.png")).convert("RGBA")
la = logo.getchannel("A")
im = Image.new("RGBA", logo.size, (236, 236, 238, 0))
im.putalpha(la.point(lambda v: int(v * 0.95)))
save(im.resize((512, int(512 * logo.size[1] / logo.size[0])), Image.LANCZOS), "logo_light.png")


def font(size, face=DEMI):
    return ImageFont.truetype(AVENIR, size, index=face)


def slot(dd, x0, y0, x1, y1, px, deep=(96, 98, 104), lip=(70, 72, 76), lit=(246, 247, 249)):
    """a vent slot lit from above: the dark opening, its upper lip's shadow and the lit lower lip"""
    X0, Y0, X1, Y1 = x0 * px, y0 * px, x1 * px, y1 * px
    dd.rounded_rectangle([X0, Y0, X1, Y1], radius=min(Y1 - Y0, X1 - X0) / 2, fill=deep)
    dd.line([X0 + 2, Y0 + 1, X1 - 2, Y0 + 1], fill=lip, width=max(1, int(px)))
    dd.line([X0 + 2, Y1, X1 - 2, Y1], fill=lit, width=max(1, int(px)))


def words(dd, t, cx, cy, h, px, col, face=DEMI, fit=None):
    fo = font(int(h * px * 1.3), face)
    b = dd.textbbox((0, 0), t, font=fo)
    if fit and (b[2] - b[0]) > fit * px:
        fo = font(int(h * px * 1.3 * fit * px / (b[2] - b[0])), face)
        b = dd.textbbox((0, 0), t, font=fo)
    dd.text((cx * px - (b[2] - b[0]) / 2 - b[0], cy * px - (b[3] - b[1]) / 2 - b[1]), t, font=fo, fill=col)


LINER = (236, 238, 241)

# ── the freezer's back wall (open photo, NOTES.md): 507 mm wide (the inside), from the freezer floor to its ceiling,
# 353 mm, at 3 px per mm, drawn at 3x. Positions are mm from the left and from the top (the ceiling) ──
px = 3 * SS
FW, FH = 507, 353
img = Image.new("RGB", (FW * px, FH * px), LINER)
dd = ImageDraw.Draw(img)
# a faint shade down the wall (the light comes from the front)
sh = np.linspace(4, -6, FH * px)[:, None, None]
img = Image.fromarray((np.asarray(img).astype(np.float32) + sh).clip(0, 255).astype(np.uint8))
dd = ImageDraw.Draw(img)
# two slots at the upper left, 142 and 159 mm under the ceiling (the ice maker stands at the right)
for y in (142, 159):
    slot(dd, 96, y - 2.5, 172, y + 2.5, px)
# under the glass shelf (194 mm under the ceiling): two rows of slots each side of the control plate, 229 and 260 mm
for y in (229, 260):
    for (x0, x1) in ((96, 172), (340, 400)):
        slot(dd, x0, y - 2.5, x1, y + 2.5, px)
# the COOL AIR CONTROL plate: 90 x 132 mm, its centre 15 mm right of the middle, from 211 to 343 mm under the ceiling;
# its words at 289 mm (the knob, a 3D part, sits at 315 mm)
cx = FW / 2 + 15
dd.rounded_rectangle([(cx - 45) * px, 211 * px, (cx + 45) * px, 343 * px], radius=6 * px, fill=(226, 228, 232),
                     outline=(198, 200, 205), width=int(1.2 * px))
for k in range(3):                                         # the plate's own three slots near its top
    slot(dd, cx - 30, 222 + k * 11 - 2, cx + 30, 222 + k * 11 + 2, px)
words(dd, "COOL AIR CONTROL", cx, 289, 4.2, px, (96, 98, 104), DEMI, fit=74)
dd.ellipse([(cx - 17) * px, (315 - 17) * px, (cx + 17) * px, (315 + 17) * px], outline=(178, 180, 186), width=int(1.5 * px))
save(img.resize((FW * 3, FH * 3), Image.LANCZOS), "back_freezer.png")

# ── the Cool Shower duct down the fridge's back wall: 187 mm wide, from the top shelf (917 mm) down to 400 mm, 517 mm,
# at 3 px per mm. Positions mm from its top ──
DW, DH = 187, 517
img = Image.new("RGB", (DW * px, DH * px), LINER)
dd = ImageDraw.Draw(img)
dd.rectangle([0, 0, 2 * px, DH * px], fill=(214, 216, 220))
dd.rectangle([(DW - 2) * px, 0, DW * px, DH * px], fill=(214, 216, 220))
for k in range(3):                                         # the three-line grille under the top shelf (54 mm down)
    dd.rounded_rectangle([(DW / 2 - 18) * px, (48 + k * 5) * px, (DW / 2 + 18) * px, (50 + k * 5) * px], radius=px,
                         fill=(120, 122, 128))
for y in (111, 413):                                       # the two slot pairs (806 and 504 mm up)
    for (x0, x1) in ((24, 50), (137, 163)):
        slot(dd, x0, y - 2.5, x1, y + 2.5, px, deep=(70, 74, 82))
# the Deodorizer tag (471 mm up): a 74 x 16 mm rounded plate with the word
dd.rounded_rectangle([(DW / 2 - 37) * px, (446 - 8) * px, (DW / 2 + 37) * px, (446 + 8) * px], radius=4 * px,
                     fill=(244, 245, 247), outline=(176, 178, 184), width=int(1.2 * px))
words(dd, "Deodorizer", DW / 2, 446, 5.5, px, (86, 88, 94), MED, fit=62)
# the dial's printed ring (the dial is a 3D part, 156 mm down) and its arc of marks
dd.ellipse([(DW / 2 - 15) * px, (156 - 15) * px, (DW / 2 + 15) * px, (156 + 15) * px], outline=(150, 152, 158), width=int(1.4 * px))
save(img.resize((DW * 3, DH * 3), Image.LANCZOS), "duct_fridge.png")


# ── the words printed inside ──
def print_png(name, t, w_mm, h_mm, col, face=MED, ppm=10):
    W, H = int(w_mm * ppm * SS), int(h_mm * ppm * SS)
    im = Image.new("RGBA", (W, H), col + (0,))
    d = ImageDraw.Draw(im)
    fo = ImageFont.truetype(AVENIR, int(H * 0.72), index=face)
    b = d.textbbox((0, 0), t, font=fo)
    k = min(1.0, W * 0.98 / (b[2] - b[0]))
    fo = ImageFont.truetype(AVENIR, int(H * 0.72 * k), index=face)
    b = d.textbbox((0, 0), t, font=fo)
    d.text(((W - (b[2] - b[0])) / 2 - b[0], (H - (b[3] - b[1])) / 2 - b[1]), t, font=fo, fill=col + (255,))
    save(im.resize((W // SS, H // SS), Image.LANCZOS), name)


# "Movable Ice Maker" across the ice box's blue-tinted front (open photo): light, about 80 mm long
print_png("print_icemaker.png", "Movable Ice Maker", 80, 10, (238, 240, 244), DEMI)

# ── the vegetable tray's cover: clear, with a fine grid of ribs (open photo), 4 px per mm over a 128 mm tile ──
G = 128 * 4
a = np.full((G, G), 226.0, np.float32)
for k in range(0, G, 32):                                  # ribs every 8 mm
    a[:, k:k + 3] = 200
    a[k:k + 3, :] = 200
save(Image.fromarray(np.stack([a - 2, a, a + 3], 2).clip(0, 255).astype(np.uint8)), "cover_grid.png")
