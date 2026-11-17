"""Textures for the LG GL-B211HPZD, 201 L direct-cool single-door refrigerator (Shiny Steel, LG's only colour of it).

usage: python3 -I tex_lg_glb211.py <photos dir> <logos dir> <out dir>
  photos: lg_glb211/lg_pzd/  LG India's gallery for GL-B211HPZD: GL-B211HPZD-2010x1334-1-v.jpg the straight-on front,
          ...-rear-view-MZ-10.jpg the back
          lg_glb211/manual/control_panel_dial.png  the dial's printed ring, from LG's owner's manual for this model
          (MFL72023301, "Control Panel and Functions", type A knob, rasterised)
  logos:  lg.png
  writes <out dir>/lg_glb211/:
    door_shiny_steel.jpg  the door face (the handle's chrome bar with its lock, the LG mark and the old energy label
                          taken out: the first two are modelled or a decal; the label is a 2023-25 one, expired)
    lgmark_dark.png, rear.jpg, rear_paths.json, print_fastfreeze.png, panel.jpg, colours.json

Door: 563 x 1157 mm (565 wide less the 1 mm gaps, from its foot 60 mm over the floor to its top at 1217 mm); on the
front photo the door is x 751-1262 and rows 114 (its top, mid-width) to 1192 (its foot). Texture 640 x 1316 px.
"""
import json
import os
import site
import sys

site.addsitedir(os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))  # run with -I: only this folder is added
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "lg_glb211")
D = os.path.join(OUT, "lg_glb211")
DBG = os.environ.get("GLB211_DEBUG")
os.makedirs(D, exist_ok=True)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FRONT = dict(x0=751, x1=1262, top=114, bot=1192)
DW, DH = 640, 1316
# the door's features as fractions of the door (u across from its left edge, v down from its top), measured on the
# straight-on front (x 751-1262, rows 114-1192)
BAR = (0.103, 0.056, 0.181, 0.462)      # the chrome handle bar with the lock in its foot (modelled)
POCKET = (0.068, 0.109, 0.225, 0.406)   # the handle's pocket (kept: it is a recess LG draws darker)
MARK = (0.447, 0.077, 0.549, 0.101)     # the LG mark (a decal)
LABEL = (0.826, 0.066, 0.958, 0.176)    # the 2023-25 energy label (expired 31 Dec 2025: taken out, no label is put on)
EDGE_U = 0.12                           # the rounded sides: the outer 68 mm each side carry LG's highlight bands
SHADE = 0.86                            # the viewer's light lifts textures (the LG 224 L's steel door, same film, 0.86)
BANDS_KEPT = 0.7
colours = {}


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def photo(name):
    return np.asarray(Image.open(os.path.join(SRC, "lg_pzd", name)).convert("RGB")).astype(np.float32)


def box_mask(shape, b, pad=0.0):
    h, w = shape
    u0, v0, u1, v1 = b
    m = np.zeros((h, w), bool)
    m[max(0, int((v0 - pad) * h)):int((v1 + pad) * h) + 1, max(0, int((u0 - pad) * w)):int((u1 + pad) * w) + 1] = True
    return m


def stadium(shape, b):
    h, w = shape
    u0, v0, u1, v1 = b
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).rounded_rectangle([u0 * w, v0 * h, u1 * w, v1 * h], radius=(u1 - u0) * w / 2, fill=255)
    return np.asarray(img) > 0


def inpaint(img, mask, r=6):
    u8 = np.clip(img, 0, 255).astype(np.uint8)
    out = cv2.inpaint(cv2.cvtColor(u8, cv2.COLOR_RGB2BGR), mask.astype(np.uint8) * 255, r, cv2.INPAINT_TELEA)
    return cv2.cvtColor(out, cv2.COLOR_BGR2RGB).astype(np.float32)


def flatten_edges(img, keep, kept=0.0):
    """The studio light's bright bands on the door's rounded sides, measured as each column's lift over the flat face
    next to them (median over twelve blocks of rows, plain door only) and taken off but for `kept` of it (as the LG
    224 L's door, tex_lg_gld2356.py)."""
    h, w = img.shape[:2]
    img = img.copy()
    e0, t0 = int(0.022 * w), int(0.012 * h)
    img[:, :e0] = img[:, e0:e0 + 1]
    img[:, w - e0:] = img[:, w - e0 - 1:w - e0]
    img[:t0] = img[t0:t0 + 1]
    z = int(EDGE_U * w)
    nb = 12
    centres = (np.arange(nb) + 0.5) * h / nb
    hl = np.zeros((h, w, 3), np.float32)
    for ch in range(3):
        P = img[..., ch]
        ref = {"l": np.median(P[:, z:z + 16], 1), "r": np.median(P[:, w - z - 16:w - z], 1)}
        for side, cols in (("l", range(0, z)), ("r", range(w - z, w))):
            for c in cols:
                d = P[:, c] - ref[side]
                vals = []
                for k in range(nb):
                    r0, r1 = k * h // nb, (k + 1) * h // nb
                    m = keep[r0:r1, c]
                    vals.append(np.median(d[r0:r1][m]) if m.sum() > 10 else np.nan)
                vals = np.array(vals)
                ok = np.isfinite(vals)
                hl[:, c, ch] = np.interp(np.arange(h), centres[ok], vals[ok]) if ok.any() else 0
        hl[..., ch] = cv2.GaussianBlur(hl[..., ch], (0, 0), sigmaX=1.5, sigmaY=6)
    colours["edge_highlight_taken_out"] = [round(float(hl[:, :z].mean(2).max()), 1), round(float(hl[:, w - z:].mean(2).max()), 1)]
    return np.clip(img - (1 - kept) * hl, 0, 255)


def streaks(w, h, contrast, seed):
    r = np.random.default_rng(seed)
    n = r.normal(0, 1, (h, w)).astype(np.float32)
    n = cv2.GaussianBlur(n, (0, 0), sigmaX=0.7, sigmaY=30)
    return n / n.std() * contrast


def door():
    a = photo("GL-B211HPZD-2010x1334-1-v.jpg")
    g = FRONT
    c = cv2.resize(a[g["top"]:g["bot"], g["x0"]:g["x1"] + 1], (DW, DH), interpolation=cv2.INTER_AREA)
    shape = c.shape[:2]
    # the arched top and its rounded corners: the photo's white background there is filled from the door under it
    corner = np.zeros(shape, bool)
    corner[:int(0.03 * DH)] = c[:int(0.03 * DH)].min(2) > 200
    bar = box_mask(shape, BAR, 0.004)
    decals = box_mask(shape, MARK, 0.008) | box_mask(shape, LABEL, 0.012)
    out = corner | bar | decals
    keep = ~(out | stadium(shape, POCKET))
    clean = inpaint(flatten_edges(c, keep, BANDS_KEPT), cv2.dilate(out.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
    # the plain steel: each row's median times each column's (LG's light shape, nothing else), fine vertical streaks
    # at the strength measured on the photo, and the photo's own pocket put back in
    L = clean.mean(2)
    rowmed = np.array([np.median(clean[y][keep[y]], axis=0) if keep[y].sum() > 20 else [np.nan] * 3 for y in range(DH)])
    ok = np.isfinite(rowmed[:, 0])
    for ch in range(3):
        rowmed[:, ch] = np.interp(np.arange(DH), np.where(ok)[0], rowmed[ok, ch])
    rowmed = cv2.GaussianBlur(rowmed[:, None, :], (1, 0), sigmaX=0.1, sigmaY=8)[:, 0, :]
    colmed = np.array([np.median(L[:, x][keep[:, x]]) for x in range(DW)])
    colmed = cv2.GaussianBlur(colmed[None, :].astype(np.float32), (0, 0), sigmaX=3)[0]
    field = rowmed[:, None, :] * (colmed / np.median(colmed))[None, :, None]
    detail = (L - cv2.GaussianBlur(L, (0, 0), 6))[keep]
    k = float(np.std(detail))
    colours["streak_contrast"] = round(k, 2)
    img = field + streaks(DW, DH, k, 211)[..., None]
    pk = cv2.GaussianBlur(stadium(shape, (POCKET[0] - 0.006, POCKET[1] - 0.003, POCKET[2] + 0.006, POCKET[3] + 0.003)).astype(np.float32), (0, 0), 1.5)[..., None]
    img = img * (1 - pk) + clean * pk
    colours["door_photo_median"] = [round(float(v)) for v in np.median(c[keep], 0)]
    save(Image.fromarray(np.clip(img * SHADE, 0, 255).astype(np.uint8)), "door_shiny_steel.jpg", 88)
    mk = c[box_mask(shape, MARK)].mean(1)
    colours["mark_photo"] = [round(float(v)) for v in c[box_mask(shape, MARK)][mk >= np.percentile(mk, 85)].mean(0)]
    colours["mark_ground_photo"] = [round(float(v)) for v in np.median(c[box_mask(shape, MARK)], 0)]
    if DBG:
        o = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).convert("RGB")
        dr = ImageDraw.Draw(o)
        for b, col in ((BAR, "red"), (POCKET, "yellow"), (MARK, "cyan"), (LABEL, "lime")):
            dr.rectangle([b[0] * DW, b[1] * DH, b[2] * DW, b[3] * DH], outline=col, width=2)
        dr.line([EDGE_U * DW, 0, EDGE_U * DW, DH], fill="orange")
        dr.line([(1 - EDGE_U) * DW, 0, (1 - EDGE_U) * DW, DH], fill="orange")
        o.save(os.path.join(DBG, "glb211_door_overlay.png"))


def lgmark():
    """The LG mark on the steel door: LG's photo draws it a light grey over the steel (the mark's brightest tenth),
    held at 0.86 like the door (the viewer's light lifts both)."""
    lg = np.asarray(Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")).astype(float)
    lg[..., 3] *= 1 - np.clip((lg[..., :3].min(2) - 150) / 70, 0, 1)
    col = [v * SHADE for v in colours["mark_photo"]]
    mk = np.zeros(lg.shape, np.uint8)
    mk[..., :3] = [int(v) for v in col]
    mk[..., 3] = (lg[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(mk), "lgmark_dark.png")
    colours["lgmark_aspect"] = round(lg.shape[1] / lg.shape[0], 4)


# the rear photo (MZ-10): the cabinet's back from its top (row 89) to its foot (row 1246), x 238-802
REAR = (238, 89, 802, 1246)
# the condenser, measured on it: its tube's horizontal runs (rows), the bends' columns, the three bands of wires, the
# four clips; and the black lead line from its top right down the fridge's left edge into the compressor bay
RUNS = [223, 264, 304, 345, 386, 427, 467, 508, 569, 629, 668, 711, 750, 791, 834, 873, 920]
BEND_X = (318, 745)
WIRE_BANDS = [(356, 436, 12), (470, 572, 15), (614, 692, 12)]
WIRE_Y = (208, 888)
CLIPS = [(372, 270), (678, 312), (402, 770), (672, 808)]
LEAD = [(742, 214), (750, 260), (752, 420), (754, 560), (752, 700), (748, 840), (747, 880), (749, 930), (752, 990)]
PLUG = (752, 1046, 18, 26)   # the dark rounded plug body hanging in the bay's corner: centre, half width, half height (px)


def rear():
    im = photo("GL-B211HPZD-Refrigerators-rear-view-MZ-10.jpg")
    L = im.mean(2)
    mask = np.zeros(L.shape, np.uint8)
    x0, y0, x1, y1 = 300, 195, 770, 900
    # the condenser's tube and wires: the dark lines over the plate inside its box
    sub = (L[y0:y1, x0:x1] < 95).astype(np.uint8)
    mask[y0:y1, x0:x1] = cv2.dilate(sub, np.ones((5, 5), np.uint8))
    for x, y in CLIPS:
        cv2.circle(mask, (x, y), 15, 1, -1)
    cv2.polylines(mask, [np.array(LEAD, np.int32)], False, 1, thickness=11)
    cv2.ellipse(mask, (PLUG[0], PLUG[1]), (PLUG[2] + 6, PLUG[3] + 8), 0, 0, 360, 1, -1)
    # the wires lie 7 px apart, so the mask covers most of the condenser's box: the plate under it is filled by a
    # normalised blur of the plate pixels round it (sigma 9 px) plus the plate's own fine grain, not by TELEA's smears
    m = cv2.dilate(mask, np.ones((3, 3), np.uint8)) > 0
    keep = (~m).astype(np.float32)
    num = cv2.GaussianBlur(im * keep[..., None], (0, 0), 9)
    den = cv2.GaussianBlur(keep, (0, 0), 9)[..., None]
    fill = num / np.maximum(den, 1e-3)
    num2 = cv2.GaussianBlur(im * keep[..., None], (0, 0), 45)
    den2 = cv2.GaussianBlur(keep, (0, 0), 45)[..., None]
    t = np.clip(den / 0.25, 0, 1)            # inside the wide bands of wires, where nothing near is plate: the wider blur
    fill = t * fill + (1 - t) * num2 / np.maximum(den2, 1e-3)
    grain = im - cv2.GaussianBlur(im, (0, 0), 3)
    rng = np.random.default_rng(211)
    noise = rng.normal(0, float(np.std(grain[~m])), im.shape[:2]).astype(np.float32)[..., None]
    clean = np.where(m[..., None], fill + noise * 0.8, im)
    back = clean[REAR[1]:REAR[3], REAR[0]:REAR[2] + 1]
    h, w = back.shape[:2]
    save(Image.fromarray(np.clip(back, 0, 255).astype(np.uint8)).resize((w * 3 // 4, h * 3 // 4), Image.LANCZOS), "rear.jpg", 84)
    u = lambda x: round((x - REAR[0]) / (REAR[2] - REAR[0]), 4)
    v = lambda y: round((y - REAR[1]) / (REAR[3] - REAR[1]), 4)
    paths = {"note": "u from the crop's left edge (the fridge's right side, +x, seen from behind), v from the cabinet's top (0) to its foot (1)",
             "crop_px": list(REAR), "runs_v": [v(y) for y in RUNS], "bend_u": [u(x) for x in BEND_X],
             "wire_bands": [[u(a), u(b), n] for a, b, n in WIRE_BANDS], "wire_v": [v(y) for y in WIRE_Y],
             "clips": [[u(x), v(y)] for x, y in CLIPS], "lead": [[u(x), v(y)] for x, y in LEAD],
             "plug": [u(PLUG[0]), v(PLUG[1])]}
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
    """"Fast Freezing Zone" on the freezer's clear door (LG's open photos MZ-04 and MZ-03: in front of the food, so on
    the door; 137 x 14 mm on MZ-04 at 1.46 mm per px across), set in Avenir Next Demi Bold, dark grey, 8 px per mm.
    The knob panel (65 x 93 mm, MZ-03 and MZ-04): the dial's ring with its numbers and words from LG's manual figure
    for this model (1 Low Cooling to 7 High Cooling, OFF, Winter, Monsoon, Summer), "Defrost Button" under it and
    "Lamp 10W" at its foot, where MZ-03 shows them. The paragraph and two icons between those two lines are too small
    on every photo to read, so they are left off."""
    S = 8
    wmm, hmm = 137, 14
    img = Image.new("RGBA", (wmm * S, hmm * S), (0, 0, 0, 0))
    word(img, "Fast Freezing Zone", wmm * S / 2, hmm * S / 2, hmm * S * 0.62, 2, (74, 78, 88, 240), max_w=wmm * S - 2)
    save(img, "print_fastfreeze.png")
    PW, PH = 65, 93
    P = 8
    pan = Image.new("RGBA", (PW * P, PH * P), (244, 245, 246, 255))
    fig = Image.open(os.path.join(SRC, "manual", "control_panel_dial.png")).convert("RGBA")
    a = np.asarray(fig).astype(np.float32)
    ink = (255 - a[..., :3].mean(2)) / 255 * (a[..., 3] / 255)
    h, w = ink.shape
    cx, cy = 777.5, 707.0                 # the knob's centre on the figure (its two circles: r 401 and 431 units)
    # MZ-03 draws the ring's numbers over about 0.7 of the panel's width, with the small words under them; the
    # manual's figure sets those words larger, so it is scaled to keep them on the panel (0.0345 mm a unit: the
    # numbers 42 mm apart) and the knob is put at the panel's middle (MZ-03 has it a little right of it)
    mm_per_unit = 0.0345
    kx, ky = PW / 2, PH / 2 - 1.4         # the knob's centre on the panel, mm from its left and top (MZ-03)
    scale = mm_per_unit * P
    fw, fh = round(w * scale), round(h * scale)
    inkimg = Image.fromarray(np.clip(ink * 255, 0, 255).astype(np.uint8)).resize((fw, fh), Image.LANCZOS)
    layer = Image.new("RGBA", (fw, fh), (40, 42, 46, 0))
    layer.putalpha(inkimg)
    pan.alpha_composite(layer, (round(kx * P - cx * scale), round(ky * P - cy * scale)))
    word(pan, "Defrost Button", (PW / 2) * P, (PH * 0.77) * P, 3.2 * P, 2, (40, 42, 46, 255), max_w=27 * P)
    word(pan, "Lamp 10W", (PW / 2) * P, (PH - 4.0) * P, 2.6 * P, 2, (40, 42, 46, 255), max_w=13 * P)
    save(pan.convert("RGB"), "panel.jpg", 92)
    colours["panel_mm"] = [PW, PH]
    colours["knob_mm"] = [round(kx, 2), round(ky, 2)]


def main():
    door()
    lgmark()
    rear()
    prints()
    with open(os.path.join(D, "colours.json"), "w") as f:
        json.dump(colours, f, indent=1)
    print(json.dumps(colours))


main()
