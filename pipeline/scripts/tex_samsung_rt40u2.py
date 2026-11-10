"""Textures for the Samsung RT40H28U2 (236 L double door with Convertible Freezer, 2 star), in the five colours Samsung India
sells this body in, written to <out dir>/samsung_rt40u2/:
  Elegant Inox (RT40H28U2PHL, the client's row, first), Black DOI (RT40H28U2FHL), Hydrangea Blue (RT40H28U2HSHL),
  Paradise Bloom Blue (RT40H28U2PBHL), Paradise Bloom Purple (RT40H28U2PRHL).
It is the RT40H28W1CPNL's body (same 555 x 1545 x 657 mm, same manual family, the same rear photo pixel for pixel, the same
door split on the fronts), so the method is tex_samsung_rt40.py's; what differs is the door finishes, the label, the
freezer's back wall ("Convertible Freezer", no slider control), the fridge's back wall (a plain round cap, no dial) and the
inside display on the fridge's right wall.

usage: python3 -I tex_samsung_rt40u2.py <photos dir> <logos dir> <out dir> [--compare]
  photos (samsung_rt40u2/, from Samsung India's gallery for each code; <c>_ is the colour: phl fhl hs pb pr):
    <c>_labelp_*.jpg   each code's straight-on front with its BEE label (about 0.69-0.71 px per mm)
    <c>_label_*.jpg    each code's own BEE label ("Model No.: RT40H28U2<c>HL", 236 L, 229 units/yr, 2 star)
    phl_g_550622583.jpg the rear (the same picture as the RT40H28W1CPNL's rear)
    phl_g_550622580.jpg the freezer close-up (the RT40H28W1CPNL's close-up set-up: 2.174 px per mm on the back wall)
    phl_g_550622581.jpg the close-up of the display on the fridge's right wall
  logos: samsung.png
  writes:
    door_freezer_<slug>.jpg, door_fridge_<slug>.jpg
        Elegant Inox and Black DOI: brushed steel, horizontal streaks, carrying most of the light-and-dark of that code's
        straight front (a smooth field read off the photo, the label and wordmark painted out first); the hairline map
        adds the fine brushing. Hydrangea Blue and the two Paradise Blooms: the print, Samsung's own front of that code at
        its own resolution (0.7 px per mm is all the detail any source of these doors has), the label and the wordmark
        painted out (they are decals), enlarged 2 x with Lanczos only so it filters smoothly.
    side_<slug>.jpg     the painted sides: grey (Elegant Inox), near-black grey (Black DOI), and for the three prints the
                        teal-navy of the RT40H28W1CPNL (their 3/4 photos read the same numbers, row for row)
    mark.png            the SAMSUNG wordmark in its light ink (all five fronts show it light)
    label.png           the BEE label, die-cut, from the Elegant Inox code's own picture, with its model line painted out
    model_<slug>.png    each code's model line ("Model No.: RT40H28U2...HL"), set again in Arial Bold to that line's ink
                        box, on the label's cream; a decal over label.png (label_layout.json gives its box)
    rear.jpg, bay.jpg, base_rear.jpg, cord_path.json   as the RT40H28W1CPNL's (the same rear photo)
    back_freezer.png    the freezer's raised back panel, redrawn: vents, screw caps, "Convertible Freezer"
    back_fridge.png     the fridge's raised back panel, redrawn: vents, the round cap's ring, the louvres
    display.png         the display on the fridge's right wall, redrawn at 8 px per mm: SAMSUNG, the lit -19 / 2 degrees,
                        the three keys "Freezer Power Freeze (3 sec)", "Freezer Convert (3 sec)", "Fridge Power Cool (3 sec)"
    bigbox_print.png    "Big Box" and its fruit icons, by tex_samsung_fridge.py (the RT34's, run unchanged into a temp folder)
"""
import json
import math
import os
import runpy
import shutil
import site
import sys
import tempfile
from collections import deque

sys.path.append(site.getusersitepackages())  # PIL, numpy and cv2 live in the user's site-packages (run with -I)
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = "--compare" in sys.argv
D = os.path.join(OUT, "samsung_rt40u2")
os.makedirs(D, exist_ok=True)
P = os.path.join(PHOTOS, "samsung_rt40u2")
rng = np.random.default_rng(4028)
PAD = 10                             # clear margin round the decals' textures


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def photo(name):
    return Image.open(os.path.join(P, name)).convert("RGB")


# ── the five colours ──
# body box on each straight front: x0, x1 (the body's columns), top (the doors' top, 1535 mm), floor (the feet's foot).
# Every front puts the doors' gap at 1016-1023 mm, the silver strip at 1004-1011 mm and the fridge door's foot at 51 mm,
# as on the RT40H28W1CPNL (NOTES.md)
COLOURS = [
    dict(slug="elegant_inox", c="phl", kind="steel", front="phl_labelp_553530910.jpg", label="phl_label_553530904.jpg",
         code="RT40H28U2PHL", box=(772, 1150, 115, 1168)),
    dict(slug="black_doi", c="fhl", kind="steel", front="fhl_labelp_553530698.jpg", label="fhl_label_553530692.jpg",
         code="RT40H28U2FHL", box=(771, 1150, 114, 1169)),
    dict(slug="hydrangea_blue", c="hs", kind="print", front="hs_labelp_550972358.jpg", label="hs_label_553530789.jpg",
         code="RT40H28U2HSHL", box=(776, 1156, 110, 1169)),
    dict(slug="paradise_bloom_blue", c="pb", kind="print", front="pb_labelp_553849501.jpg", label="pb_label_553849498.jpg",
         code="RT40H28U2PBHL", box=(764, 1157, 97, 1194)),
    dict(slug="paradise_bloom_purple", c="pr", kind="print", front="pr_labelp_553849507.jpg", label="pr_label_553849505.jpg",
         code="RT40H28U2PRHL", box=(764, 1158, 97, 1194)),
]
# heights on the doors (mm above the floor), the RT40H28W1CPNL's: freezer face 1023-1535, fridge face (below its silver
# strip) 51-1004
FZ_MM, FR_MM = (1023, 1535), (51, 1004)
DOOR_W = 553
# what each front carries that is a decal here: the BEE label (each photo has it hand-placed a little differently) and the
# wordmark, both painted out of the door. Boxes in mm: x from the body's left edge, y down from the doors' top
LABEL_MM = {"phl": (390, 531, 62, 292), "fhl": (386, 521, 66, 294), "hs": (378, 507, 68, 294),
            "pb": (391, 532, 50, 276), "pr": (410, 544, 50, 268)}
MARK_MM = (250, 305, 77, 94)
# the steel: K of the photo's smoothed light kept in the texture (most of it: the viewer's narrow lens sees the whole door
# in one reflection, as on the Whirlpool 22343 and Haier HRF-3782), BASE the mean the texture is held at, TINT the photo's
# colour balance (both steels read a little blue); tuned on renders against each code's front and 3/4 photos (NOTES.md)
STEEL = {"phl": dict(BASE=108, K=0.9, TINT=(0, 1, 5)), "fhl": dict(BASE=60, K=0.9, TINT=(0, 2, 6))}
STREAK = {"phl": 3.0, "fhl": 2.2}
PX_STEEL = 0.8                       # px per mm for the steel doors (the hairline map carries the fine brushing)
# the prints: satin part metal in the builder, as the RT40H28W1CPNL's (that halves the print's own light), so saved at
# SHADE of the photo less HL times its own lightness (tex_samsung_rt40.py; NOTES.md)
SHADE, HL = 1.06, 0.4
UP = 2


def door_rect(col, rows_mm):
    """the door face's pixel box on that colour's front: (x0, x1, y0, y1) for heights rows_mm (low, high)"""
    x0, x1, top, floor = col["box"]
    ppm_y = (floor - top) / 1535.0
    ppm_x = (x1 - x0 + 1) / 555.0
    y0 = top + (1535 - rows_mm[1]) * ppm_y
    y1 = top + (1535 - rows_mm[0]) * ppm_y
    return x0 + 1 * ppm_x, x1 - 1 * ppm_x, y0, y1, ppm_x, ppm_y


def decal_mask(col, shape):
    """a mask of the label and the wordmark on that front"""
    x0, x1, top, floor = col["box"]
    ppm = (floor - top) / 1535.0
    m = np.zeros(shape, np.uint8)
    for bx0, bx1, by0, by1 in (LABEL_MM[col["c"]], MARK_MM):
        m[int(top + by0 * ppm):int(top + by1 * ppm) + 1, int(x0 + bx0 * ppm):int(x0 + bx1 * ppm) + 1] = 255
    return m


def warp_face(src, rect, w, h):
    x0, x1, y0, y1 = rect[:4]
    M = cv2.getPerspectiveTransform(np.float32([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]),
                                    np.float32([[0, 0], [w, 0], [w, h], [0, h]]))
    return cv2.warpPerspective(src, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def steel_doors(col):
    S = STEEL[col["c"]]
    src = np.asarray(photo(col["front"])).astype(np.float32)
    clean = cv2.inpaint(src.astype(np.uint8), decal_mask(col, src.shape[:2]), 6, cv2.INPAINT_TELEA).astype(np.float32)
    lum = clean.mean(2)
    out = {}
    fields = {}
    for part, rows_mm in (("freezer", FZ_MM), ("fridge", FR_MM)):
        w, h = round(DOOR_W * PX_STEEL), round((rows_mm[1] - rows_mm[0]) * PX_STEEL)
        f = warp_face(lum, door_rect(col, rows_mm), w, h)
        # the smooth light: blurred 20 mm, so the photo's own brushing and noise go
        f = cv2.GaussianBlur(f, (0, 0), 20 * PX_STEEL)
        fields[part] = f
    mean = np.concatenate([fields["freezer"].ravel(), fields["fridge"].ravel()]).mean()
    for part, f in fields.items():
        h, w = f.shape
        shade = 1 + S["K"] * (f / mean - 1)
        # the brushing: each 1.25 mm row its own grey, stretched along x (horizontal streaks, as the fronts show)
        fine = rng.normal(0, 1, (h, w // 40 + 2))
        fine = np.asarray(Image.fromarray(((fine + 4) * 30).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)).astype(np.float32) / 30 - 4
        v = S["BASE"] * shade + STREAK[col["c"]] * fine
        img = np.stack([v + S["TINT"][0], v + S["TINT"][1], v + S["TINT"][2]], axis=2)
        out[part] = Image.fromarray(img.clip(0, 255).astype(np.uint8))
        save(out[part], f"door_{part}_{col['slug']}.jpg", q=86)
        print(f"  {col['slug']} {part}: photo field {f.min():.0f}-{f.max():.0f} (mean of both doors {mean:.0f}), texture {v.min():.0f}-{v.max():.0f}")
    return out


def print_doors(col):
    src = np.asarray(photo(col["front"])).copy()
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(src, cv2.COLOR_RGB2BGR), decal_mask(col, src.shape[:2]), 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    out = {}
    for part, rows_mm in (("freezer", FZ_MM), ("fridge", FR_MM)):
        rect = door_rect(col, rows_mm)
        w, h = round((rect[1] - rect[0])), round((rect[3] - rect[2]))
        a = warp_face(clean.astype(np.float32), rect, w, h)
        a = np.minimum(a * (SHADE * (1 - HL * a.mean(2) / 255))[..., None], 255)
        img = Image.fromarray(a.clip(0, 255).astype(np.uint8))
        img = img.resize((img.width * UP, img.height * UP), Image.LANCZOS)
        save(img, f"door_{part}_{col['slug']}.jpg", q=84)
        out[part] = img
    return out


def compare_doors(col, made):
    ph = photo(col["front"])
    tiles = []
    for part, rows_mm in (("freezer", FZ_MM), ("fridge", FR_MM)):
        x0, x1, y0, y1 = door_rect(col, rows_mm)[:4]
        a = ph.crop((int(x0), int(y0), int(x1), int(y1)))
        tiles += [a, made[part].resize(a.size)]
    W = tiles[0].width
    sheet = Image.new("RGB", (W * 2 + 10, tiles[0].height + tiles[2].height + 10), "white")
    sheet.paste(tiles[0], (0, 0)); sheet.paste(tiles[1], (W + 10, 0))
    sheet.paste(tiles[2], (0, tiles[0].height + 10)); sheet.paste(tiles[3], (W + 10, tiles[0].height + 10))
    sheet.save(os.path.join(D, f"_compare_{col['slug']}.png"))


def mark():
    # Samsung's own wordmark, in the light ink all five fronts show (Elegant Inox 223/224/229 on its 197 steel, Black DOI
    # 207/208/213, Hydrangea Blue 190/190/216 on its 24 navy): one ink for all, their mean
    col = (207, 207, 219)
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = col
    out[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out)
    im = im.crop(im.getchannel("A").getbbox())
    pad = Image.new("RGBA", (im.width + 2 * PAD, im.height + 2 * PAD), col + (0,))
    pad.paste(im, (PAD, PAD))
    save(pad, "mark.png")
    print("mark ink", col, "padded", pad.size)


# ── the BEE label ──
# The five codes' labels are one template (2026-28 series, 229 units/yr, 236 L, 2 star) and differ only in the model line.
# label.png is the Elegant Inox code's own picture, die-cut (as tex_samsung_rt40.py does), with the model line painted out
# in the label's cream; each code's line is set again in Arial Bold, fitted to that line's ink box, as a small decal.
ARIAL_B = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"   # the label's narrow bold face (Arial Bold reads 26 % too wide)
MODEL_SEARCH = (680, 990, 1010, 1045)    # the model line's search box on phl_label_553530904.jpg (x0, y0, x1, y1)


def label():
    col0 = COLOURS[0]
    src = photo(col0["label"])
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.min(2) < 225)
    cx0, cy0 = xs.min() - 2, ys.min() - 2
    lab = src.crop((cx0, cy0, xs.max() + 3, ys.max() + 3)).convert("RGBA")
    # the model line's ink box, in the crop
    sx0, sy0, sx1, sy1 = MODEL_SEARCH
    reg = a[sy0:sy1, sx0:sx1].min(2)
    iy, ix = np.where(reg < 110)
    ink = tuple(int(v) for v in (ix.min() + sx0 - cx0, iy.min() + sy0 - cy0, ix.max() + sx0 - cx0 + 1, iy.max() + sy0 - cy0 + 1))
    # the patch reaches 336 px past the line's start: the longest code set in the narrow bold is 321 px (the label is
    # clear cream there)
    bx0, by0, bx1, by1 = ink[0] - 4, ink[1] - 4, ink[0] + 336, ink[3] + 4
    la = np.asarray(lab).copy()
    border = np.concatenate([la[by0 - 2, bx0:bx1, :3], la[by1 + 2, bx0:bx1, :3]])
    cream = tuple(int(v) for v in np.median(border, 0))
    la[by0:by1, bx0:bx1, :3] = cream
    lab = Image.fromarray(la).copy()
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g, b, _ = px[x, y]
        if min(r, g, b) < 238:
            continue
        seen[y, x] = True
        px[x, y] = (r, g, b, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = np.asarray(lab.getchannel("A").filter(ImageFilter.MinFilter(5)))
    qz = lab.convert("RGB").quantize(colors=63, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(qz).copy()
    idx[alpha < 128] = 63
    out = Image.frombytes("P", qz.size, idx.astype(np.uint8).tobytes())
    out.putpalette(qz.getpalette()[:63 * 3] + [255, 255, 255])
    pad = Image.new("P", (out.width + 2 * PAD, out.height + 2 * PAD), 63)
    pad.putpalette(out.getpalette())
    pad.paste(out, (PAD, PAD))
    p = os.path.join(D, "label.png")
    pad.save(p, optimize=True, transparency=bytes([255] * 63 + [0]))
    print("wrote", p, pad.size, os.path.getsize(p) // 1024, "KB", "ink w", w, "model ink box", ink, "cream", cream)
    # the model line, per code: the patch (the painted-out box) in the label's cream, the line set at 4 x and reduced
    pw, ph = bx1 - bx0, by1 - by0
    ink_h = ink[3] - ink[1]
    layout = {"label_px": [pad.width, pad.height], "ink_w": w, "pad": PAD,
              "patch": [bx0 + PAD, by0 + PAD, bx1 + PAD, by1 + PAD], "models": {}}
    K = 4
    for col in COLOURS:
        s = "Model No.: " + col["code"]
        f = ImageFont.truetype(ARIAL_B, 100)
        tmp = Image.new("L", (3000, 200), 0)
        ImageDraw.Draw(tmp).text((10, 150), s, font=f, fill=255, anchor="ls")
        t = np.asarray(tmp)
        ty, tx = np.where(t > 8)
        tmp = tmp.crop((tx.min(), ty.min(), tx.max() + 1, ty.max() + 1))
        sc = ink_h * K / tmp.height
        tmp = tmp.resize((max(1, round(tmp.width * sc)), ink_h * K), Image.LANCZOS)
        big = Image.new("RGBA", (pw * K, ph * K), cream + (255,))
        inkc = Image.new("RGBA", tmp.size, (20, 20, 22, 255))
        big.paste(inkc, ((ink[0] - bx0) * K, (ink[1] - by0) * K), tmp)
        im = big.resize((pw * 2, ph * 2), Image.LANCZOS)   # 2 x the label's own px, so the line stays crisp up close
        im.convert("RGB").quantize(colors=16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(os.path.join(D, f"model_{col['slug']}.png"), optimize=True)
        layout["models"][col["slug"]] = {"text": s, "w_px": round(tmp.width / K, 1)}
        print(f"  {col['slug']}: '{s}' set {tmp.width / K:.1f} px wide against the photo's line {ink[2] - ink[0]} px (Elegant Inox)")
    json.dump(layout, open(os.path.join(D, "label_layout.json"), "w"), indent=1)
    # each code's own label picture says its own code (checked by eye: NOTES.md)


def side(slug, base, a, b):
    # the painted sides: brightest at mid-height, darker at the foot, from the 3/4 views (tex_samsung_rt40.py's shape)
    h, w = 768, 512
    yy = np.linspace(0, 1, h)[:, None]
    lift = a * np.exp(-((yy - 0.45) / 0.28) ** 2) - b * np.clip((yy - 0.75) / 0.25, 0, 1)
    speck = Image.fromarray(((rng.normal(0, 1, (h, w)) * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    s = (np.asarray(speck).astype(float) / 255 - 0.5) * 2.0
    img = np.stack([base[0] + lift + s, base[1] + lift + s, base[2] + lift + s], axis=2)
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), f"side_{slug}.jpg")


# ── the rear (phl_g_550622583.jpg: the RT40H28W1CPNL's rear photo, pixel for pixel) ──
R_X0, R_X1, R_TOP, R_FLOOR, R_BAY, R_BASE = 735, 1183, 20, 1258, 1037, 1226
PPM = 448 / 555
CORD = [(811, 291), (811, 450), (811, 650), (811, 850), (811, 960), (813, 990), (820, 1006), (834, 1013),
        (860, 1015), (950, 1015), (1040, 1015), (1085, 1016)]
PLUG = (1110, 1016)


def rear():
    src = photo("phl_g_550622583.jpg")
    save(src.crop((R_X0 + 3, R_TOP + 2, R_X1 - 3, R_BAY)), "rear.jpg", q=84)
    bay = src.crop((R_X0 + 8, R_BAY, R_X1 - 8, R_BASE))
    save(bay.resize((bay.width * 2, bay.height * 2), Image.LANCZOS), "bay.jpg", q=84)
    save(src.crop((R_X0 + 3, R_BASE, R_X1 - 3, R_FLOOR)), "base_rear.jpg", q=84)
    xc = (R_X0 + R_X1) / 2
    to_m = lambda x, r: (round(-(x - xc) / PPM / 1000, 4), round((R_FLOOR - r) / PPM / 1000, 4))   # seen from behind
    json.dump({"ppm": PPM, "cord": [to_m(x, r) for x, r in CORD], "plug": to_m(*PLUG),
               "bay_top": round((R_FLOOR - R_BAY) / PPM / 1000, 4), "base": round((R_FLOOR - R_BASE) / PPM / 1000, 4),
               "cord_d": 0.008}, open(os.path.join(D, "cord_path.json"), "w"), indent=1)


# ── back-wall panels and the display, redrawn ──
AV = "/System/Library/Fonts/Avenir Next.ttc"
SS = 2


def font(path, px, face=0):
    return ImageFont.truetype(path, max(1, round(px * SS)), index=face)


def rrect(d, box, r, fill=None, outline=None, w=1):
    x0, y0, x1, y1 = [v * SS for v in box]
    d.rounded_rectangle((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), r * SS, fill=fill, outline=outline, width=max(1, round(w * SS)))


def text(d, xy, s, f, fill, anchor="mm"):
    d.text((xy[0] * SS, xy[1] * SS), s, font=f, fill=fill, anchor=anchor)


def line(d, pts, w, fill):
    d.line([(x * SS, y * SS) for x, y in pts], fill=fill, width=max(1, round(w * SS)), joint="curve")


def back_panel(name, box_m, build, PX=6):
    x0, x1, y0, y1 = box_m
    w, h = round((x1 - x0) * 1000 * PX), round((y1 - y0) * 1000 * PX)
    img = Image.new("RGBA", (w * SS, h * SS), (246, 247, 249, 255))
    d = ImageDraw.Draw(img)
    rrect(d, (3, 3, w - 3, h - 3), 10 * PX / 4, outline=(226, 229, 233, 255), w=3)
    X = lambda xm: (xm - x0) * 1000 * PX
    Y = lambda ym: (y1 - ym) * 1000 * PX
    build(d, X, Y, PX)
    img = img.resize((w, h), Image.LANCZOS).convert("RGB").quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    p = os.path.join(D, name)
    img.save(p, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def slot(d, X, Y, xa, xb, y, th_mm, PX, fill=(204, 207, 211, 255), edge=(176, 180, 186, 255)):
    rrect(d, (X(xa), Y(y) - th_mm * PX / 2, X(xb), Y(y) + th_mm * PX / 2), th_mm * PX * 0.2, fill=fill, outline=edge, w=PX * 0.4)


FZ_PANEL = (-0.21, 0.21, 1.071, 1.489)
FR_PANEL = (-0.13, 0.13, 0.607, 0.945)
FZ_FLOOR = 1.065


def back_freezer():
    yb = lambda row: FZ_FLOOR + (1040 - row) / 2.174 / 1000         # close-up row -> height (RT40H28W1CPNL's set-up)
    xb = lambda col: (col - 935) / 2.174 / 1000
    # "Convertible Freezer" on the close-up phl_g_550622580: its ink box, the bold word and the regular one
    src = np.asarray(photo("phl_g_550622580.jpg").convert("L")).astype(int)
    reg = src[250:350, 600:1300]
    iy, ix = np.where(reg < 120)
    tx0, tx1, ty0, ty1 = ix.min() + 600, ix.max() + 600, iy.min() + 250, iy.max() + 250
    cols = np.where((reg < 120).any(0))[0] + 600
    gaps = [(cols[i], cols[i + 1]) for i in range(len(cols) - 1) if cols[i + 1] - cols[i] > 8]
    split = max(gaps, key=lambda g: g[1] - g[0])           # the space between the two words
    ink = src[ty0:ty1 + 1, tx0:tx1 + 1]
    inkc = int(np.percentile(ink[ink < 120], 30))
    print(f"Convertible Freezer: ink x {tx0}-{tx1}, rows {ty0}-{ty1}, words split at {split}, ink {inkc}")

    def b(d, X, Y, PX):
        ink_rgba = (inkc, inkc + 2, inkc + 6, 255)
        for ca, cb in ((570, 720), (835, 1035), (1150, 1305)):
            slot(d, X, Y, xb(ca), xb(cb), yb(158), 12, PX)
        for c in (538, 1328):
            cx, cy, r = X(xb(c)), Y(yb(255)), 8.3 * PX
            d.ellipse(((cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS), fill=(242, 243, 245, 255), outline=(176, 180, 186, 255), width=round(0.5 * PX * SS))
        line(d, [(X(xb(905)), Y(yb(598))), (X(xb(905)), Y(yb(1036)))], 0.5 * PX, (222, 225, 229, 255))
        line(d, [(X(xb(905)), Y(yb(598))), (X(xb(1395)), Y(yb(598)))], 0.5 * PX, (222, 225, 229, 255))
        slot(d, X, Y, xb(1145), xb(1300), yb(615), 9, PX)
        # the two words, each fitted to its own ink box (cap height to the box's height, width to the box)
        for word, face, xa, xc in (("Convertible", 0, tx0, split[0]), ("Freezer", 5, split[1], tx1)):
            f = font(AV, 40, face)
            tmp = Image.new("L", (1600, 200), 0)
            ImageDraw.Draw(tmp).text((20, 150), word, font=f, fill=255, anchor="ls")
            t = np.asarray(tmp); yy, xx = np.where(t > 8)
            tmp = tmp.crop((xx.min(), yy.min(), xx.max() + 1, yy.max() + 1))
            bw, bh = (X(xb(xc + 1)) - X(xb(xa))) * SS, (Y(yb(ty1 + 1)) - Y(yb(ty0))) * SS
            hh = bh * (1.0 if word == "Freezer" else 1.0)
            tmp = tmp.resize((max(1, round(bw)), max(1, round(hh))), Image.LANCZOS)
            img_ink = Image.new("RGBA", tmp.size, ink_rgba)
            d._image.paste(img_ink, (round(X(xb(xa)) * SS), round(Y(yb(ty0)) * SS)), tmp)
    back_panel("back_freezer.png", FZ_PANEL, b)


def back_fridge():
    xb = lambda col: (col - 826) / 0.614 / 1000
    yb = lambda row: (662 + (748.6 - row) / 0.666) / 1000

    def b(d, X, Y, PX):
        slot(d, X, Y, xb(793), xb(820), yb(581), 7, PX)
        slot(d, X, Y, xb(835), xb(860), yb(581), 7, PX)
        slot(d, X, Y, xb(765), xb(788), yb(641), 7, PX)
        slot(d, X, Y, xb(862), xb(887), yb(641), 7, PX)
        # the round cap where the RT40H28W1CPNL has its dial: a plain ring 42 mm across (open-door photo, ESTIMATED), no scale
        cx, cy, r = X(0.0), Y(0.790), 21 * PX
        d.ellipse(((cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS), outline=(200, 203, 208, 255), width=round(0.6 * PX * SS))
        for ca, cb in ((765, 800), (815, 840), (850, 890)):
            for k in range(3):
                line(d, [(X(xb(ca)), Y(yb(767 + k * 5))), (X(xb(cb)), Y(yb(767 + k * 5)))], 1.2 * PX, (200, 204, 209, 255))
    back_panel("back_fridge.png", FR_PANEL, b, PX=5)


# ── the display on the fridge's right wall (Samsung's close-up phl_g_550622581) ──
# 68 x 120 mm, the RT34's display housing (tex_samsung_fridge.py measured it on Samsung's photos; this code's close-up,
# seen at an angle, reads about 70 x 125 mm, ESTIMATED). Layout as fractions of the panel, read off the close-up: SAMSUNG
# at 0.10; the lit "2 C" at (0.68, 0.41), "-19 C" at (0.31, 0.50) with the drop-and-snowflake mark at (0.50, 0.50); the three
# keys' words at 0.84-0.91, split by two rules; a short dash under each key
DISP_MM = (68, 120)
INK = (78, 82, 90)


def display():
    PX = 8
    w, h = DISP_MM[0] * PX, DISP_MM[1] * PX
    img = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rrect(d, (0, 0, w, h), 0.11 * w, fill=(226, 228, 231, 255), outline=(206, 209, 214, 255), w=4)
    X = lambda f: f * w
    Y = lambda f: f * h
    # SAMSUNG: Samsung's own wordmark (logos/samsung.png), 24 mm wide, in the panel's ink
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    lg = lg.crop(lg.getchannel("A").getbbox())
    mw = round(24 * PX * SS)
    lg = lg.resize((mw, round(lg.height * mw / lg.width)), Image.LANCZOS)
    img.paste(Image.new("RGBA", lg.size, INK + (255,)), (round(X(0.5) * SS - mw / 2), round(Y(0.103) * SS - lg.height / 2)), lg.getchannel("A"))
    # the lit temperatures: white, with a soft grey edge so they read on the pale panel as on the photo
    edge = (186, 190, 197, 255)

    def lit(xy, s, size):
        d.text((xy[0] * SS, xy[1] * SS), s, font=font(AV, size, 5), fill=(255, 255, 255, 255), anchor="rm", stroke_width=round(0.35 * PX * SS / 4), stroke_fill=edge)

    def deg(x, y, size):
        r = size * 0.13
        d.ellipse(((x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS), outline=(255, 255, 255, 255), width=max(1, round(size * 0.07 * SS)))
        text(d, (x + size * 0.38, y + size * 0.26), "C", font(AV, size * 0.62, 5), (255, 255, 255, 255))
    lit((X(0.66), Y(0.41)), "2", 7.5 * PX)
    deg(X(0.69), Y(0.385), 3.4 * PX)
    lit((X(0.36), Y(0.50)), "-19", 7.5 * PX)
    deg(X(0.39), Y(0.475), 3.4 * PX)
    # the drop with a snowflake in it
    cx, cy, r = X(0.53), Y(0.505), 1.9 * PX
    pts = [(cx, cy - r * 2.2)] + [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in range(-40, 221, 10)] + [(cx, cy - r * 2.2)]
    line(d, pts, 0.32 * PX, (255, 255, 255, 255))
    for k in range(3):
        a = math.radians(90 + 60 * k)
        line(d, [(cx - 0.6 * r * math.cos(a), cy - 0.6 * r * math.sin(a)), (cx + 0.6 * r * math.cos(a), cy + 0.6 * r * math.sin(a))], 0.25 * PX, (255, 255, 255, 255))
    # the keys
    for fx in (0.33, 0.665):
        line(d, [(X(fx), Y(0.82)), (X(fx), Y(0.925))], 0.3 * PX, INK)
    f1, f2, f3 = font(AV, 3.6 * PX, 5), font(AV, 2.7 * PX, 5), font(AV, 2.5 * PX, 5)
    for fx, a, b_, c in ((0.17, "Freezer", "Power Freeze", "(3 sec)"), (0.497, "Freezer", "Convert", "(3 sec)"), (0.83, "Fridge", "Power Cool", "(3 sec)")):
        text(d, (X(fx), Y(0.845)), a, f1, INK)
        text(d, (X(fx), Y(0.875)) if b_ != "Convert" else (X(fx), Y(0.877)), b_, f2 if b_ != "Convert" else f1, INK)
        text(d, (X(fx), Y(0.905)), c, f3, INK)
        line(d, [(X(fx) - 2.2 * PX, Y(0.935)), (X(fx) + 2.2 * PX, Y(0.935))], 0.35 * PX, (200, 203, 209, 255))
    img = img.resize((w, h), Image.LANCZOS)
    q = img.convert("RGB").quantize(colors=48, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    p = os.path.join(D, "display.png")
    # the corners outside the rounded panel are clear
    al = np.asarray(img.getchannel("A"))
    idx = np.asarray(q).copy(); idx[al < 128] = 47
    out = Image.frombytes("P", q.size, idx.astype(np.uint8).tobytes()); pal = q.getpalette()[:47 * 3] + [255, 255, 255]
    out.putpalette(pal)
    out.save(p, optimize=True, transparency=bytes([255] * 47 + [0]))
    print("wrote", p, out.size, os.path.getsize(p) // 1024, "KB")


def shared_prints():
    tmp = tempfile.mkdtemp()
    argv = sys.argv
    sys.argv = ["tex_samsung_fridge.py", tmp]
    try:
        runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex_samsung_fridge.py"), run_name="__main__")
    finally:
        sys.argv = argv
    shutil.copy(os.path.join(tmp, "samsung", "bigbox_print.png"), os.path.join(D, "bigbox_print.png"))
    shutil.rmtree(tmp)


if __name__ == "__main__":
    for col in COLOURS:
        made = steel_doors(col) if col["kind"] == "steel" else print_doors(col)
        if COMPARE:
            compare_doors(col, made)
    mark()
    label()
    # sides: Elegant Inox 3/4 views (77,78,83) high, (81,82,87) at mid-height, (57,58,63) at the foot; Black DOI (47,49,53),
    # (55,57,61), (37,39,43); the prints the RT40H28W1CPNL's teal-navy, (15,32,42) base (their photos read the same).
    # About a third of the photos' fall at the foot is kept (the rest is the studio's floor), as tex_samsung_rt40.py does
    # The steels' bases are set so the page's render reads as the photos at 3/4 (side median 85 Elegant Inox, 57 Black DOI):
    # their part-metal paint renders at about 0.85 of the texture (first build: 68 against 85, 40 against 57)
    side("elegant_inox", (95, 96, 101), 9.5, 18)
    side("black_doi", (63, 65, 70), 15, 13)
    side("teal_navy", (15, 32, 42), 7, 9)
    rear()
    back_freezer()
    back_fridge()
    display()
    shared_prints()
