"""Textures for the LG GLD2356Z.. 224 L direct-cool single-door refrigerator with the base stand drawer, in four colours.

usage: python3 -I tex_lg_gld2356.py <photos dir> <logos dir> <out dir>
  photos: lg_gld2356/<suffix>/  LG India's gallery for each code (zapz Shiny Steel, zaws Wine Spring, zars Royal Spring,
          zabw Blue Waterlily): 2010x1334-1-v.jpg the straight-on front, 2010x1334-2-v.jpg the energy label; zapz/DZ-11.jpg
          the rear (the same back on every colour)
          lg_gld2356/manual/control_panel_dial.png  the dial's printed ring, from LG's manual (MFL72035001, its control
          panel figure, rasterised)
  logos:  lg.png
  writes <out dir>/lg_gld2356/:
    door_<finish>.jpg        each colour's door face, from that colour's own front photo (the handle's chrome bar, the
                             lock, the LG mark and the energy label taken out: they are modelled or decals)
    stand_<finish>.jpg       the base stand drawer's front with LG's embossed mark, from the same photo
    lgmark_dark.png, lgmark_light.png, label.png, rear.jpg, stand_rear.jpg, rear_paths.json
    print_fastfreeze.png, print_coolfresh.png, print_lamp.png, dial_ring.png, knob.jpg
    colours.json             colours read off the photos for the builder

On LG's four fronts the fridge stands at a different place and scale on each, so every number below is measured on
each photo: the door's columns (the middle row's run), its top row and its bottom row (where the dark gap over the base
stand starts), and the floor. The door's features sit at the same fraction of the door on all four (checked on the
overlay this script writes to the scratch folder given by GLD_DEBUG). Door: 591 x 1337 mm; the texture 640 x 1448 px.
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
SRC = os.path.join(PHOTOS, "lg_gld2356")
D = os.path.join(OUT, "lg_gld2356")
DBG = os.environ.get("GLD_DEBUG")
os.makedirs(D, exist_ok=True)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FIN = {"shiny_steel": "zapz", "wine_spring": "zaws", "royal_spring": "zars", "blue_waterlily": "zabw"}
# on each front photo: the door's columns at the middle row, its top row, the row where the dark gap under it starts,
# the drawer front's top row (under the gap and the slot) and the floor row
FRONT = {
    "zapz": dict(x0=809, x1=1202, top=162, bot=1065, face=1088, floor=1171),
    "zaws": dict(x0=782, x1=1152, top=192, bot=1041, face=1062, floor=1139),
    "zars": dict(x0=800, x1=1215, top=131, bot=1091, face=1112, floor=1201),
    "zabw": dict(x0=811, x1=1203, top=158, bot=1073, face=1094, floor=1175),
}
# where LG's photo team put the LG mark and the energy label differs a little between the four photos (the mark up to
# 28 mm lower on Wine Spring), so each photo's own are taken out; the model carries one mark and one label, at the
# Shiny Steel's places (the listed colour). The Blue Waterlily front shows no lock (its dimension drawing does).
MARKS = {"zapz": (0.446, 0.069, 0.529, 0.0815), "zaws": (0.460, 0.0905, 0.552, 0.104),
         "zars": (0.441, 0.075, 0.529, 0.089), "zabw": (0.465, 0.0687, 0.557, 0.082)}
LABELS = {"zapz": (0.753, 0.079, 0.898, 0.200), "zaws": (0.716, 0.077, 0.866, 0.203),
          "zars": (0.752, 0.091, 0.887, 0.202), "zabw": (0.741, 0.070, 0.886, 0.188)}
LOCKS = {"zapz": (0.150, 0.5007), "zaws": (0.152, 0.507), "zars": (0.152, 0.503), "zabw": None}
DW, DH = 640, 1448          # the door face, 591 x 1337 mm
# the door's features as fractions of the door (u across from its left edge, v down from its top), on the Shiny Steel
# front (x 809-1202, rows 162-1065) and checked on the other three
BAR = (0.104, 0.090, 0.194, 0.396)      # the Ariana handle's chrome bar (modelled)
POCKET = (0.066, 0.086, 0.232, 0.400)   # the handle's pocket (kept: it is a recess LG draws darker)
LOCK_R = 0.022                          # the key lock's radius in u (modelled)
EDGE_U = 0.125                          # the door's rounded sides: the outer 74 mm each side carry LG's highlight bands
# the viewer's light lifts textures; each colour's door is held at gain * photo - lift, tuned on the
# render as a ratio to the energy label's white (REVIEW.md). The prints' clear coat adds a near-even shine on top, so
# their dark ground needs a lift taken off as well as a gain, or the flowers go dull once the ground matches: fitted from
# two regions (the plain ground and the big flowers) on renders at two settings. The stand's front at STAND_SHADE.
SHADE = {"shiny_steel": (0.86, 0), "wine_spring": (0.80, 13.8), "royal_spring": (0.78, 11.7), "blue_waterlily": (0.84, 17)}
# the steel's light bands at its rounded sides: a share of the photo's band is kept in the texture (a flat pale steel
# reads as paint); the prints' come from their clear coat instead
BANDS_KEPT = {"shiny_steel": 0.7}
STAND_LOGO = (0.39, 0.3, 0.615, 0.79)    # the box the stand's moulded LG mark sits in (u0, v0, u1, v1 of the stand's front)
STAND_SHADE = {"shiny_steel": 0.75, "wine_spring": 0.65, "royal_spring": 0.53, "blue_waterlily": 0.65}
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


def box_mask(shape, b, pad=0.0):
    h, w = shape
    u0, v0, u1, v1 = b
    m = np.zeros((h, w), bool)
    m[max(0, int((v0 - pad) * h)):int((v1 + pad) * h) + 1, max(0, int((u0 - pad) * w)):int((u1 + pad) * w) + 1] = True
    return m


def stadium(shape, b):
    """A rounded slot (the handle's pocket): a box with half-round ends."""
    h, w = shape
    u0, v0, u1, v1 = b
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).rounded_rectangle([u0 * w, v0 * h, u1 * w, v1 * h], radius=(u1 - u0) * w / 2, fill=255)
    return np.asarray(img) > 0


def door_crop(a, g):
    """The door's face on a front photo, resized to DW x DH (u across the door's full width, v from its top to its foot)."""
    c = a[g["top"]:g["bot"], g["x0"]:g["x1"] + 1]
    return cv2.resize(c, (DW, DH), interpolation=cv2.INTER_AREA)


def inpaint(img, mask, r=6):
    u8 = np.clip(img, 0, 255).astype(np.uint8)
    out = cv2.inpaint(cv2.cvtColor(u8, cv2.COLOR_RGB2BGR), mask.astype(np.uint8) * 255, r, cv2.INPAINT_TELEA)
    return cv2.cvtColor(out, cv2.COLOR_BGR2RGB).astype(np.float32)


def flatten_edges(img, keep, kept=0.0):
    """Take the studio light of the rounded sides out: the model's own curve shades and lights them.
    On every front the door's sides curve away over its outer EDGE_U and LG's lights put a bright band there; that
    highlight is added light, so it is measured as each column's lift over the flat face next to the curve (the
    median over twelve blocks of rows, plain door only, so the print does not count) and taken off. The outline's few
    columns (the photo's cut-out edge) and the top rows' rim are filled from their neighbours."""
    h, w = img.shape[:2]
    img = img.copy()
    e0, t0 = int(0.022 * w), int(0.008 * h)
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
    colours.setdefault("edge_highlight_taken_out", []).append([round(float(hl[:, :z].mean(2).max()), 1), round(float(hl[:, w - z:].mean(2).max()), 1)])
    return np.clip(img - (1 - kept) * hl, 0, 255)


def streaks(w, h, contrast, seed):
    """Fine vertical brush marks (the Shiny Steel door), spread `contrast` grey."""
    r = np.random.default_rng(seed)
    n = r.normal(0, 1, (h, w)).astype(np.float32)
    n = cv2.GaussianBlur(n, (0, 0), sigmaX=0.7, sigmaY=30)
    return n / n.std() * contrast


def doors():
    dbg = []
    for fin, suf in FIN.items():
        a = photo(suf)
        g = FRONT[suf]
        c = door_crop(a, g)
        shape = c.shape[:2]
        # the rounded top corners: the photo's white background there is filled from the door next to it
        corner = np.zeros(shape, bool)
        corner[:int(0.05 * DH)] = c[:int(0.05 * DH)].min(2) > 228
        bar = box_mask(shape, BAR, 0.004)
        lock = np.zeros(shape, np.uint8)
        if LOCKS[suf]:
            cv2.circle(lock, (int(LOCKS[suf][0] * DW), int(LOCKS[suf][1] * DH)), int(LOCK_R * DW) + 3, 1, -1)
        MARK, LABEL = MARKS[suf], LABELS[suf]
        decals = box_mask(shape, MARK, 0.008) | box_mask(shape, LABEL, 0.018)
        out = corner | bar | (lock > 0) | decals
        keep = ~(out | stadium(shape, POCKET))
        clean = inpaint(flatten_edges(c, keep, BANDS_KEPT.get(fin, 0)), cv2.dilate(out.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
        if fin == "shiny_steel":
            # the plain steel: the median of every row times the median of every column (LG's light shape, nothing else),
            # fine vertical streaks at the strength measured on the photo, and the photo's own pocket put back in
            L = clean.mean(2)
            rowmed = np.array([np.median(clean[y][keep[y]], axis=0) for y in range(DH)])
            rowmed = cv2.GaussianBlur(rowmed[:, None, :], (1, 0), sigmaX=0.1, sigmaY=8)[:, 0, :]
            colmed = np.array([np.median(L[:, x][keep[:, x]]) for x in range(DW)])
            colmed = cv2.GaussianBlur(colmed[None, :].astype(np.float32), (0, 0), sigmaX=3)[0]
            field = rowmed[:, None, :] * (colmed / np.median(colmed))[None, :, None]
            detail = (L - cv2.GaussianBlur(L, (0, 0), 6))[keep]
            k = float(np.std(detail))
            colours["streak_contrast"] = round(k, 2)
            img = field + streaks(DW, DH, k, 2356)[..., None]
            pk = cv2.GaussianBlur(stadium(shape, (POCKET[0] - 0.006, POCKET[1] - 0.003, POCKET[2] + 0.006, POCKET[3] + 0.003)).astype(np.float32), (0, 0), 1.5)[..., None]
            img = img * (1 - pk) + clean * pk
        else:
            img = clean
        colours.setdefault("door_photo_median", {})[fin] = [round(float(v)) for v in np.median(c[keep], 0)]
        img = img * SHADE[fin][0] - SHADE[fin][1]
        save(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), f"door_{fin}.jpg", 88)
        # the stand's drawer front: from under the slot to the floor
        s = a[g["face"]:g["floor"] - 1, g["x0"]:g["x1"] + 1]
        s = cv2.resize(s, (DW, 128), interpolation=cv2.INTER_AREA)
        colours.setdefault("stand_front_median", {})[fin] = [round(float(v)) for v in np.median(s.reshape(-1, 3), 0)]
        # its moulded LG mark is too soft in the photo for a 4-degree close-up: found as what stands out of the local
        # ground inside STAND_LOGO, measured (colour, centre, height), painted out, and drawn again as a sharp decal
        x0, y0, x1, y1 = [int(round(v)) for v in (STAND_LOGO[0] * DW, STAND_LOGO[1] * 128, STAND_LOGO[2] * DW, STAND_LOGO[3] * 128)]
        sl = s.astype(np.float32)
        gnd = cv2.medianBlur(np.clip(sl, 0, 255).astype(np.uint8), 31).astype(np.float32)
        dev = np.abs(sl - gnd).max(2)
        lm = np.zeros(dev.shape, bool)
        lm[y0:y1, x0:x1] = dev[y0:y1, x0:x1] > 4
        lm = cv2.morphologyEx(lm.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
        ys, xs = np.where(lm)
        colours.setdefault("stand_mark", {})[fin] = dict(col=[round(float(v) * STAND_SHADE[fin]) for v in np.median(sl[lm], 0)],
                                                         cx=round(float((xs.min() + xs.max() + 1) / 2 / DW), 4), cy=round(float((ys.min() + ys.max() + 1) / 2 / 128), 4),
                                                         h=round(float((ys.max() - ys.min() + 1) / 128), 4))
        hole = np.zeros(dev.shape, np.uint8)
        hole[y0:y1, x0:x1] = 1                   # the whole box: the ground under it is a smooth sweep
        s = cv2.inpaint(np.clip(sl, 0, 255).astype(np.uint8), hole, 6, cv2.INPAINT_TELEA).astype(np.float32)
        save(Image.fromarray(np.clip(s * STAND_SHADE[fin], 0, 255).astype(np.uint8)), f"stand_{fin}.jpg", 86)
        # the LG mark's colour on the door: the darkest (steel) or lightest (prints) tenth of its box
        mk = c[box_mask(shape, MARK)].mean(1)
        sel = c[box_mask(shape, MARK)][mk <= np.percentile(mk, 15)] if fin == "shiny_steel" else c[box_mask(shape, MARK)][mk >= np.percentile(mk, 85)]
        colours.setdefault("mark_photo", {})[fin] = [round(float(v)) for v in sel.mean(0)]
        colours.setdefault("label_white_photo", {})[fin] = [round(float(v)) for v in np.percentile(c[box_mask(shape, LABEL)].reshape(-1, 3), 99, axis=0)]
        if DBG:
            o = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).convert("RGB")
            dr = ImageDraw.Draw(o)
            for b, col in ((BAR, "red"), (POCKET, "yellow"), (MARK, "cyan"), (LABEL, "lime")):
                dr.rectangle([b[0] * DW, b[1] * DH, b[2] * DW, b[3] * DH], outline=col, width=2)
            if LOCKS[suf]:
                r = LOCK_R * DW
                dr.ellipse([LOCKS[suf][0] * DW - r, LOCKS[suf][1] * DH - r, LOCKS[suf][0] * DW + r, LOCKS[suf][1] * DH + r], outline="magenta", width=2)
            dr.line([EDGE_U * DW, 0, EDGE_U * DW, DH], fill="orange")
            dr.line([(1 - EDGE_U) * DW, 0, (1 - EDGE_U) * DW, DH], fill="orange")
            dbg.append(o.resize((DW // 2, DH // 2)))
    if DBG:
        sheet = Image.new("RGB", (DW // 2 * len(dbg), DH // 2), "white")
        for i, o in enumerate(dbg):
            sheet.paste(o, (i * DW // 2, 0))
        sheet.save(os.path.join(DBG, "gld_door_overlay.png"))


def lgmarks():
    """The LG mark on the door: dark grey on the steel, light on the printed doors (both read off the fronts)."""
    lg = np.asarray(Image.open(os.path.join(LOGOS, "lg.png")).convert("RGBA")).astype(float)
    # one-colour mark: the logo file's white face lines inside the red circle become cut-outs, as on LG's moulded marks
    lg[..., 3] *= 1 - np.clip((lg[..., :3].min(2) - 150) / 70, 0, 1)
    for name, fin in (("lgmark_dark", "shiny_steel"), ("lgmark_light", "royal_spring")):
        # the dark mark held at 0.72 of the photo's: the viewer's light lifts it (photo mark/ground 0.78, render 0.96 at 1.0)
        col = [v * (0.72 if name == "lgmark_dark" else 1) for v in colours["mark_photo"][fin]]
        mk = np.zeros(lg.shape, np.uint8)
        mk[..., :3] = [int(v) for v in col]
        mk[..., 3] = (lg[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
        save(Image.fromarray(mk), name + ".png")
    # the stand's mark, one image per finish with its ink baked in (colours.json stand_mark): Apple's SceneKit ignores
    # a texture's colour factor, so a white image tinted by the factor drew white there
    for fin, sm in colours["stand_mark"].items():
        mk = np.zeros(lg.shape, np.uint8)
        mk[..., :3] = [int(v) for v in sm["col"]]
        mk[..., 3] = lg[..., 3].clip(0, 255).astype(np.uint8)
        save(Image.fromarray(mk), f"standmark_{fin}.png")


def label():
    """LG's energy label for this model (2026-28 series, Model No. GLD235, 224 L, 118 units/yr), die-cut."""
    src = Image.open(os.path.join(SRC, "zapz", "2010x1334-2-v.jpg")).convert("RGB")
    lab = src.crop((470, 209, 965, 1127)).convert("RGBA")
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g, bl, _ = px[x, y]
        if min(r, g, bl) < 236:
            continue
        seen[y, x] = True
        px[x, y] = (r, g, bl, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = lab.getchannel("A").filter(ImageFilter.MinFilter(3))
    lab.putalpha(alpha)
    lab = lab.crop(alpha.getbbox())
    tw = 360
    lab = lab.resize((tw, round(lab.height * tw / lab.width)), Image.LANCZOS)
    alpha = lab.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    lab = lab.convert("RGB").quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    lab.putalpha(alpha)
    colours["label_aspect"] = round(lab.width / lab.height, 4)
    save(lab, "label.png")


def rear():
    """LG's rear photo (zapz DZ-11): the cabinet's back from its top (1447 mm, row 119) to the stand (151 mm, row 1130),
    x 766-1238, with the grey power cord painted out between the compressor bay and the cabinet's edge (it is modelled;
    its path goes to rear_paths.json); and the stand's back under it (rows 1130-1247)."""
    im = Image.open(os.path.join(SRC, "zapz", "DZ-11.jpg")).convert("RGB")
    x0, y0, x1, y1 = 766, 119, 1238, 1130
    cord = [(836, 1028), (824, 1020), (812, 1013), (800, 1008), (790, 1005), (780, 1004), (768, 1004)]
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    mask = np.zeros(bgr.shape[:2], np.uint8)
    cv2.polylines(mask, [np.array(cord, np.int32)], False, 255, thickness=9)
    bgr = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    clean = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    back = clean.crop((x0, y0, x1 + 1, y1))
    save(back.resize((back.width * 3 // 4, back.height * 3 // 4), Image.LANCZOS), "rear.jpg", 84)
    stand = clean.crop((x0 - 2, y1, x1 + 3, 1247))
    save(stand.resize((stand.width * 3 // 4, stand.height * 3 // 4), Image.LANCZOS), "stand_rear.jpg", 84)
    paths = {"note": "u from the crop's left edge (the fridge's right side, +x, seen from behind), v from the top; the plate spans the crop",
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
    """The words LG prints inside (DZ-04, the empty open-door photo, 0.79 px per mm): "Fast Freezing Zone" across the
    freezer box's back, 126 mm wide; "Cool & Fresh Zone" on the chiller tray's front, 122 mm wide; "Lamp 10W" over the
    lamp, 15 mm wide. Set in Avenir Next Demi Bold, grey as on the photo, 8 px per mm."""
    S = 8
    for name, text, wmm, hmm, col in (("print_fastfreeze", "Fast Freezing Zone", 126, 14, (88, 90, 96, 235)),
                                      ("print_coolfresh", "Cool & Fresh Zone", 122, 14, (96, 98, 104, 235)),
                                      ("print_lamp", "Lamp 10W", 15, 4, (110, 112, 118, 235))):
        img = Image.new("RGBA", (wmm * S, hmm * S), (0, 0, 0, 0))
        word(img, text, wmm * S / 2, hmm * S / 2, hmm * S * 0.62, 2, col, max_w=wmm * S - 2)
        save(img, name + ".png")
    # the dial's printed ring, from LG's manual figure: its lines and numbers in the photo's dark grey, the knob's middle
    # left clear (the knob covers it); and the knob's face, the figure's two grip ridges and push button
    fig = Image.open(os.path.join(SRC, "manual", "control_panel_dial.png")).convert("RGBA")
    a = np.asarray(fig).astype(np.float32)
    ink = (255 - a[..., :3].mean(2)) / 255 * (a[..., 3] / 255)
    h, w = ink.shape
    cx, cy, rk = 0.4983 * w, 0.5275 * h, 0.301 * w     # the knob's circle on the figure (1800 x 1763 units: centre 897, 930; radius 542)
    yy, xx = np.mgrid[0:h, 0:w]
    rr = np.hypot(xx - cx, yy - cy)
    ring = np.zeros((h, w, 4), np.uint8)
    ring[..., :3] = (70, 72, 78)
    ring[..., 3] = np.clip(ink * 255 * (rr > rk * 1.02), 0, 255).astype(np.uint8)
    save(Image.fromarray(ring).resize((384, round(384 * h / w)), Image.LANCZOS), "dial_ring.png")
    face = np.full((h, w, 3), 246, np.float32) - ink[..., None] * 150
    x0, y0 = int(cx - rk), int(cy - rk)
    face[rr > rk * 0.97] = 246
    k = Image.fromarray(np.clip(face[y0:y0 + 2 * int(rk), x0:x0 + 2 * int(rk)], 0, 255).astype(np.uint8)).resize((256, 256), Image.LANCZOS)
    save(k, "knob.jpg", 90)
    colours["dial_fig"] = {"cx": round(cx / w, 4), "cy": round(cy / h, 4), "knob_r": round(rk / w, 4), "aspect": round(w / h, 4)}


def main():
    doors()
    lgmarks()
    label()
    rear()
    prints()
    with open(os.path.join(D, "colours.json"), "w") as f:
        json.dump(colours, f, indent=1)
    print(json.dumps(colours))


main()
