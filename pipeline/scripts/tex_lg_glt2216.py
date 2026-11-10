"""Textures for the LG GLT2216WY.. 225 L double-door refrigerator, in its five colours.

usage: python3 -I tex_lg_glt2216.py <photos dir> <logos dir> <out dir>
  photos: lg_glt2216/<suffix>/  LG India's gallery for each code (wyro Radiant Onyx, wyri Radiant Inox, wyob Onyx Black,
          wypz Shiny Steel, wyds Dazzle Steel): 2010x1334-1-v.jpg the straight-on front, 2010x1334-2-v.jpg the energy label,
          large12.jpg the rear
  logos:  lg.png
  writes <out dir>/lg_glt2216/ (its own folder; the food labels come from the shared stock, as for every LG fridge):
    door_freezer_<finish>.jpg, door_fridge_<finish>.jpg   each colour's door, from that colour's own front photo
    print_freezer.png, print_fridge.png                   the line-art flowers of the Radiant doors (white lines, alpha)
    side_<finish>.jpg, lgmark_light.png, lgmark_dark.png, label.png, rear.jpg, rear_paths.json, knob.jpg, fresh_zone.jpg
    colours.json                                          colours read off the photos for the builder (print lines, gold)

The five front photos are LG's one studio set-up: the fridge stands at the same place in each (x 810-1198, top row 165,
door bottom row 1142.5, floor row 1168.5), 0.697 px per mm across and 0.695 up. On them, measured:
  freezer door rows 165-503 (1445-958 mm), the gap 503-514 (the white mullion seen through the pocket), the gold handle
  514-536.5 (942-909 mm), the fridge door 536.5-1142.5 (909-37 mm).
Doors: each colour's base is its own photo with the print, the LG mark and the label taken out: the median of every row
(LG's fall from top to bottom) times the median of every column (the darker door edges), so the studio's light shape is
kept as LG shows it and nothing else. Shiny Steel adds fine vertical streaks and Dazzle Steel its short horizontal brush
marks, each at the strength measured on its photo (the spread of the fine detail once the light shape is divided out).
Print: the Radiant doors carry gold line-art flowers. The photo has them at 0.7 px per mm, about 1.5 px a line. The lines
are traced from the Radiant Onyx photo (gold on black, the clearest of the two), enlarged to 2.5 px per mm and their edges
set sharp at half each line's own peak, so every line stays where LG drew it, only crisper; no line is added. The same
artwork is on the Radiant Inox photo at the same place (checked: NOTES.md); each colour's line colour is read off its own photo.
Onyx Black: LG's photos of it are cut out flat (0, 0, 0 on every door pixel), so its door takes the Radiant Onyx black
(ESTIMATED, NOTES.md).
"""
import json
import os
import site
import sys
from collections import deque

site.addsitedir(os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))  # run with -I: only this folder is added
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "lg_glt2216")
D = os.path.join(OUT, "lg_glt2216")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(2216)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FIN = {"radiant_onyx": "wyro", "radiant_inox": "wyri", "onyx_black": "wyob", "shiny_steel": "wypz", "dazzle_steel": "wyds"}

# rows on the front photos (see above); columns are found per photo
FZ_ROWS = (165.0, 503.0)
FR_ROWS = (536.5, 1142.5)
# the viewer's light lifts textures; each colour's door is held at SHADE of its photo, tuned on the
# render as a ratio to the energy label's white (REVIEW.md)
SHADE = {"radiant_onyx": 0.8, "radiant_inox": 0.84, "onyx_black": 0.8, "shiny_steel": 0.86, "dazzle_steel": 0.86}
PRINT_PX_MM = 2.5
INK_K = {"radiant_onyx": (0.72, 0.72, 0.72), "radiant_inox": (0.69, 0.71, 0.82)}
PRINT_COVER = 0.044      # share of the door face inked (ESTIMATED from the front photo; see doors())
colours = {}


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def photo(suffix, name="2010x1334-1-v.jpg"):
    return np.asarray(Image.open(os.path.join(SRC, suffix, name)).convert("RGB")).astype(np.float32)


def body_cols(a):
    """The cabinet's left and right columns on a front photo (the middle row's non-white run)."""
    row = a[655].sum(1) < 720
    xs = np.where(row)[0]
    return float(xs.min()), float(xs.max() + 1)


def keepout(shape, x0, rows):
    """Pixels of a door crop that are not plain door: the LG mark and the energy label (decals), 4 px padded."""
    m = np.zeros(shape, bool)
    y0 = rows[0]
    for (a, b, c, d) in ((828, 178, 872, 202), (1124, 180, 1186, 292)):   # LG mark, label (all five photos)
        m[max(0, int(b - y0)):max(0, int(d - y0)), max(0, int(a - x0)):max(0, int(c - x0))] = True
    return m


def door_crop(a, rows, cols):
    x0, x1 = cols
    y0, y1 = rows
    return a[int(round(y0)) + 2:int(round(y1)) - 1, int(x0) + 2:int(x1) - 2]


def line_mask(a, rows, cols):
    """The print's lines on a crop: brighter than the local background (for gold on black)."""
    L = door_crop(a, rows, cols).mean(2)
    bg = cv2.medianBlur(np.clip(L, 0, 255).astype(np.uint8), 9).astype(np.float32)
    return np.clip(L - bg, 0, None)


def base_from_photo(a, rows, cols, exclude):
    """Median of each row and each column of the plain door (print, mark and label left out), as a smooth field."""
    c = door_crop(a, rows, cols)
    ok = ~exclude
    rowmed = np.array([np.median(c[y][ok[y]], axis=0) if ok[y].sum() > 20 else np.full(3, np.nan) for y in range(c.shape[0])])
    for k in range(3):   # fill rows with no plain pixels
        v = rowmed[:, k]
        bad = np.isnan(v)
        if bad.any():
            v[bad] = np.interp(np.where(bad)[0], np.where(~bad)[0], v[~bad])
    rowmed = cv2.GaussianBlur(rowmed[:, None, :], (1, 0), sigmaX=0.1, sigmaY=6)[:, 0, :] if len(rowmed) > 12 else rowmed
    L = c.mean(2)
    colmed = np.array([np.median(L[:, x][ok[:, x]]) if ok[:, x].sum() > 20 else np.nan for x in range(c.shape[1])])
    bad = np.isnan(colmed)
    colmed[bad] = np.interp(np.where(bad)[0], np.where(~bad)[0], colmed[~bad])
    colmed = cv2.GaussianBlur(colmed[None, :], (0, 0), sigmaX=3)[0]
    colk = colmed / np.median(colmed)
    return rowmed[:, None, :] * colk[None, :, None]


def resize_field(f, w, h):
    return cv2.resize(f.astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)


def streaks(w, h, direction, contrast, seed):
    """Brush marks: noise stretched along the brush direction ("v" up the door, "h" across), spread `contrast` grey."""
    r = np.random.default_rng(seed)
    n = r.normal(0, 1, (h, w)).astype(np.float32)
    if direction == "v":
        n = cv2.GaussianBlur(n, (0, 0), sigmaX=0.7, sigmaY=30)
    else:
        n = cv2.GaussianBlur(n, (0, 0), sigmaX=9, sigmaY=0.8)
        n += 0.5 * cv2.GaussianBlur(r.normal(0, 1, (h, w)).astype(np.float32), (0, 0), sigmaX=3, sigmaY=2)
    return n / n.std() * contrast


def fine_contrast(a, rows, cols, exclude, direction):
    """How strong the brush marks are on the photo: the spread of the detail left after the light shape is divided out,
    measured across the brush direction (grey levels)."""
    c = door_crop(a, rows, cols).mean(2)
    smooth = cv2.GaussianBlur(c, (0, 0), 6)
    d = (c - smooth)[~exclude]
    return float(np.std(d))


def doors():
    ro = photo("wyro")
    cols_ro = body_cols(ro)
    # the print, traced on the Radiant Onyx photo
    masks = {}
    for part, rows in (("freezer", FZ_ROWS), ("fridge", FR_ROWS)):
        d = line_mask(ro, rows, cols_ro)
        ex = keepout(d.shape, cols_ro[0] + 2, (rows[0] + 2,))
        d[cv2.dilate(ex.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 0
        masks[part] = d
    # line colours: on the front photos a line is about 1.5 px, so no pixel shows its full ink; LG's 3/4 view (large03)
    # draws the freezer door's flower larger, so the ink is read there: the 0.5% of pixels that differ most from the local
    # background, in the print's area (x 950-1250, rows 150-500)
    # the ink: one gold print on both Radiant colours. Its hue is read on LG's 3/4 view of the Onyx (large03, where the
    # flower is drawn larger, so the JPEG's halved colour resolution does not wash it out as on the fronts): the top 0.5%
    # of yellowness in the print's area (x 950-1250, rows 150-500), less the black. Its strength is read on the front photo,
    # where the ink's total is kept even though no pixel is pure ink: the freezer door's mean lift over its black (print
    # only; mark and label left out) is coverage x (ink - black). With the ink's width read off the sharpest pixels (peak
    # lift 0.75 of a 1.43 mm pixel, so about 1.1 mm), the coverage is PRINT_COVER. The Inox photos agree: the same ink at
    # 0.6 coverage on their silver gives the lines' measured shift on large03 (-4, -14, -45 against -7, -19, -41).
    q = photo("wyro", "large03.jpg")[150:500, 950:1250].reshape(-1, 3)
    yb = (q[:, 0] + q[:, 1]) / 2 - q[:, 2]
    diff = q[yb >= np.percentile(yb, 99.5)].mean(0) - np.median(q, 0)
    hue = diff / diff.mean()
    L = ro.mean(2)
    reg = np.zeros(L.shape, bool)
    reg[172:497, 818:1192] = True
    reg[175:298, 1118:1192] = False
    reg[172:206, 822:876] = False
    v, rgb = L[reg], ro[reg]
    blk, blk_rgb = np.median(v), np.median(rgb, 0)
    lift = np.clip(v - blk - 4, 0, None).mean()
    ink = np.clip(blk_rgb + hue * lift / PRINT_COVER, 0, 255)
    colours["print_hue"] = [round(float(x), 3) for x in hue]
    colours["radiant_onyx_print_lift"] = round(float(lift), 2)
    colours["radiant_onyx_line"] = colours["radiant_inox_line"] = [round(float(x)) for x in ink]
    # the alignment check: on the Inox photo the traced lines must sit on its own lines (yellower than its silver)
    ri = photo("wyri")
    cri = door_crop(ri, FR_ROWS, body_cols(ri))
    yb = (cri[..., 0] + cri[..., 1]) / 2 - cri[..., 2]
    m = masks["fridge"]
    h, w = min(yb.shape[0], m.shape[0]), min(yb.shape[1], m.shape[1])
    on = yb[:h, :w][m[:h, :w] > np.percentile(m[m > 0], 92)].mean()
    off = yb[:h, :w][m[:h, :w] == 0].mean()
    best = max(((dx, dy) for dx in range(-3, 4) for dy in range(-3, 4)),
               key=lambda s: yb[3 + s[1]:h - 3 + s[1], 3 + s[0]:w - 3 + s[0]][m[3:h - 3, 3:w - 3] > np.percentile(m[m > 0], 92)].mean())
    print(f"Inox photo: yellowness on the traced lines {on:.1f}, off them {off:.1f}; best shift {best} px")
    colours["inox_trace_shift_px"] = list(best)

    # print decals: white lines with alpha, 2.5 px per mm, sharp edges at half each line's own peak
    for part, rows in (("freezer", FZ_ROWS), ("fridge", FR_ROWS)):
        d = masks[part]
        hmm = (rows[1] - rows[0]) * 1445 / (1168.5 - 165.0)
        wmm = 551.0
        W_, H_ = round(wmm * PRINT_PX_MM), round(hmm * PRINT_PX_MM)
        up = cv2.resize(d, (W_, H_), interpolation=cv2.INTER_CUBIC)
        up = cv2.GaussianBlur(np.clip(up, 0, None), (0, 0), 1.6)
        loc = np.maximum(cv2.dilate(up, np.ones((9, 9), np.uint8)), 25)
        r = up / loc

        def alpha(t):
            a = np.clip((r - t) / 0.25, 0, 1)
            return a * a * (3 - 2 * a) * np.clip((loc - 18) / 20, 0, 1)
        if part == "freezer":     # the cut that leaves PRINT_COVER of the freezer door inked; the fridge door uses the same
            lo, hi = 0.3, 0.95
            for _ in range(30):
                t = (lo + hi) / 2
                lo, hi = (t, hi) if alpha(t).mean() > PRINT_COVER else (lo, t)
            cut = (lo + hi) / 2
            colours["print_cut"] = round(cut, 3)
        a = alpha(cut)
        colours.setdefault("print_cover", {})[part] = round(float(a.mean()), 4)
        a = (np.round(a * 15) / 15 * 255).astype(np.uint8)      # 16 levels: a small palette PNG
        # the ink is baked into each Radiant colour's decal (Apple's SceneKit ignores a texture's colour scale and drew the
        # lines white): the photo's ink held at INK_K, tuned by render. Onyx: the viewer's light lifts it (render's mean
        # lift over the black door 8.2 of the label's 250 white against the photo's 5.7 of 255, so 0.72). Inox: the same ink
        # on silver, per channel, to the photo's line contrast (top 1% of yellowness less the door's median at the same
        # scale: -9, -16, -30 on LG's front; the render gives -9, -18, -29)
        for fin in ("radiant_onyx", "radiant_inox"):
            rgba = np.zeros((H_, W_, 4), np.uint8)
            rgba[..., :3] = np.clip(np.round(ink * np.array(INK_K[fin])), 0, 255).astype(np.uint8)
            rgba[..., 3] = a
            im = Image.fromarray(rgba).quantize(colors=16, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
            save(im, f"print_{part}_{fin}.png")
        colours.setdefault("ink_baked", {})[part] = {fin: [int(v) for v in np.clip(np.round(ink * np.array(INK_K[fin])), 0, 255)] for fin in INK_K}

    # each colour's door, from its own photo
    for fin, suf in FIN.items():
        a = photo(suf if fin != "onyx_black" else "wyro")
        cols = body_cols(a)
        for part, rows, hmm in (("freezer", FZ_ROWS, 487.0), ("fridge", FR_ROWS, 872.0)):
            c = door_crop(a, rows, cols)
            ex = keepout(c.shape[:2], cols[0] + 2, (rows[0] + 2,))
            if fin in ("radiant_onyx", "radiant_inox", "onyx_black"):
                m = masks[part]
                h, w = min(c.shape[0], m.shape[0]), min(c.shape[1], m.shape[1])
                lines = np.zeros(c.shape[:2], bool)
                lines[:h, :w] = cv2.dilate((m[:h, :w] > 6).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
                ex = ex | lines
            field = base_from_photo(a, rows, cols, ex)
            px_mm = 1.0 if fin == "dazzle_steel" else 0.7
            W_, H_ = round(551 * px_mm), round(hmm * px_mm)
            img = resize_field(field, W_, H_)
            if fin == "shiny_steel":
                k = fine_contrast(a, rows, cols, ex, "v")
                img = img + streaks(W_, H_, "v", k, 1)[..., None]
                colours.setdefault("streak_contrast", {})[fin + "_" + part] = round(k, 2)
            if fin == "dazzle_steel":
                k = fine_contrast(a, rows, cols, ex, "h")
                img = img + streaks(W_, H_, "h", k, 2)[..., None]
                colours.setdefault("streak_contrast", {})[fin + "_" + part] = round(k, 2)
            img = img * SHADE[fin]
            if fin == "onyx_black":      # plain black: the Onyx photo's light without its blue
                img = np.repeat(img.mean(2, keepdims=True), 3, 2)
            save(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), f"door_{part}_{fin}.jpg", 88)
            colours.setdefault("door_photo_mean", {})[fin + "_" + part] = [round(float(v)) for v in field.reshape(-1, 3).mean(0)]
    # the gold handle and the label's white on the same photos
    for fin, suf in FIN.items():
        a = photo(suf)
        colours.setdefault("gold_photo", {})[fin] = [round(float(v)) for v in np.median(a[517:533, 850:1150].reshape(-1, 3), 0)]
        colours.setdefault("label_white_photo", {})[fin] = [round(float(v)) for v in np.percentile(a[196:215, 1140:1165].reshape(-1, 3), 95, axis=0)]


def sides():
    """Painted sides: plain colour with a soft fall towards the floor (the sides carry no print). Colours are set here
    and tuned against LG's 3/4 photos (REVIEW.md)."""
    # Radiant Inox: LG's 3/4 view (large03) has its side at 0.54 of its door's brightness, the render had 0.77 at 150, so 135
    SIDE = {"radiant_onyx": (30, 30, 32), "onyx_black": (30, 30, 32), "radiant_inox": (135, 136, 138),
            "shiny_steel": (150, 150, 151), "dazzle_steel": (146, 146, 147)}
    for fin, c in SIDE.items():
        h, w = 256, 64
        y = np.linspace(1.445, 0.022, h)[:, None]
        shade = 1.02 - 0.18 * np.clip((0.5 - y) / 0.45, 0, 1) ** 1.5
        img = np.stack([np.full((h, w), v) * shade for v in c], 2)
        save(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), f"side_{fin}.jpg", 90)


def lgmarks():
    """The LG mark: light grey on the dark doors, dark grey on the light ones (both read off the front photos)."""
    lg = np.asarray(Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")).astype(float)
    for name, col in (("lgmark_light", (150, 151, 154)), ("lgmark_dark", (84, 86, 90))):
        mk = np.zeros(lg.shape, np.uint8)
        mk[..., :3] = col
        mk[..., 3] = (lg[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
        save(Image.fromarray(mk), name + ".png")


def label():
    """LG's energy label for this model (2026-28 series, GLT221, 225 L, 264 units/yr), die-cut, 5 px per mm."""
    src = Image.open(os.path.join(SRC, "wyro", "2010x1334-2-v.jpg")).convert("RGB")
    lab = src.crop((478, 209, 962, 1127)).convert("RGBA")
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
    lab.putalpha(alpha)
    tw = 360
    lab = lab.resize((tw, round(h * tw / w)), Image.LANCZOS)
    alpha = lab.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    lab = lab.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    lab.putalpha(alpha)
    save(lab, "label.png")


def rear():
    """LG's rear photo (large12, the same for every colour), cropped to the galvanised back between the side panels'
    flanges (x 789-1222, rows 98-1228), with the power cord painted out (it is modelled; its path goes to rear_paths.json)."""
    im = Image.open(os.path.join(SRC, "wyro", "large12.jpg")).convert("RGB")
    x0, y0, x1, y1 = 789, 98, 1222, 1228
    # the grey cord, traced on the photo (px, 4x close-up): out of the clip at the service cover's lower right, left under
    # the cover's foot, then across the back to the cabinet's edge (the photo's left, the fridge's right-hand side seen from behind)
    cord = [(1002, 900), (999, 908), (990, 911), (950, 912), (900, 911), (850, 908), (812, 904), (790, 901)]
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    mask = np.zeros(bgr.shape[:2], np.uint8)
    cv2.polylines(mask, [np.array(cord, np.int32)], False, 255, thickness=7)
    bgr = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    clean = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).crop((x0, y0, x1 + 1, y1 + 1))
    r = clean.resize((clean.width * 3 // 4, clean.height * 3 // 4), Image.LANCZOS)
    save(r, "rear.jpg", 84)
    paths = {"note": "u from the crop's left edge (the fridge's right side, +x), v from the top; the plate spans the crop",
             "crop_px": [x0, y0, x1, y1],
             "cord": [[round((x - x0) / (x1 - x0), 4), round((y - y0) / (y1 - y0), 4)] for x, y in cord]}
    with open(os.path.join(D, "rear_paths.json"), "w") as f:
        json.dump(paths, f, indent=1)


def font(px, face=5):
    return ImageFont.truetype(FONT, int(px), index=face)


def word(img, text, cx, cy, height_px, face, col, max_w=None):
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


def prints():
    # the freezer dial's face: plain white with a soft rim (the photos resolve no mark on it)
    k = Image.new("RGB", (256, 256), (238, 239, 241))
    d = ImageDraw.Draw(k)
    d.ellipse([6, 6, 250, 250], outline=(200, 202, 206), width=8)
    save(k, "knob.jpg")
    # the vegetable drawer's white front, 463 x 140 mm, "Fresh Zone" 46 mm wide, its middle 15 mm right of the drawer's
    # and 70 mm up from its foot (LG's open-door photo large06), 4 px per mm
    S = 4
    img = Image.new("RGBA", (463 * S, 140 * S), (246, 247, 249, 255))
    word(img, "Fresh Zone", 463 * S / 2 + 15 * S, (140 - 70) * S, 7.5 * S, 5, (128, 130, 136, 255), max_w=46 * S)
    save(img.convert("RGB"), "fresh_zone.jpg", 90)


def grain_h():
    """Dazzle Steel is brushed across the door (its photo: short horizontal brush marks). The shared hairline maps run up
    a panel on the door's grain UVs, so the soft hairline normal map and the roughness map are turned a quarter turn here
    (lines across, still 100 mm a tile; the normal's x and y turned with them). Saved without chroma subsampling."""
    G = os.path.join(OUT, "grain")
    n = np.asarray(Image.open(os.path.join(G, "hairline_soft_n.jpg")).convert("RGB"))
    r = np.rot90(n, 1).copy()
    out = r.copy()
    out[..., 0] = r[..., 1]
    out[..., 1] = 255 - r[..., 0]
    Image.fromarray(out).save(os.path.join(D, "grain_hairline_soft_h_n.jpg"), quality=94, subsampling=0)
    rr = np.rot90(np.asarray(Image.open(os.path.join(G, "hairline_r.jpg")).convert("RGB")), 1).copy()
    Image.fromarray(rr).save(os.path.join(D, "grain_hairline_h_r.jpg"), quality=94, subsampling=0)
    print("wrote the turned hairline maps", out.shape)


def print_none():
    """The print decal on the colours with no print: a clear 4 x 4 image. Apple's viewers take a decal's see-through from
    its image only (a clear colour factor still shows the white lines there), so the colours with no print swap the
    print's image for this one."""
    save(Image.fromarray(np.zeros((4, 4, 4), np.uint8)), "print_none.png")


def main():
    grain_h()
    print_none()
    doors()
    sides()
    lgmarks()
    label()
    rear()
    prints()
    with open(os.path.join(D, "colours.json"), "w") as f:
        json.dump(colours, f, indent=1)
    print(json.dumps(colours))


main()
