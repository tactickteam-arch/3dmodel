"""Textures for the Samsung RR21H2H25BR/HL, 189 L direct-cool single door with the Base Stand Drawer, in the eleven
colours Samsung India shows photos for (the listed Begonia Red first).

usage: python3 -I tex_samsung_rr21.py <photos dir> <logos dir> <out dir>
  photos: samsung_rr21/<c>_g_<n>.jpg     each colour's straight-on front from Samsung India's gallery for that code
          samsung_rr21/<c>_lblx_<n>.jpg  each colour's own BEE label (Samsung's picture of it; it names that code)
          samsung_rr21/br_lbl_553945749.jpg  the Begonia Red front with its label on (where the label sits)
          samsung_rr21/cr_g_551075936.jpg    the rear (Camellia Purple; the same back on every colour)
          samsung_rr21/cr_g_551075926.jpg    the open door, empty (the temperature-control panel's print)
          samsung_rr21/s8_g_551076055.jpg, ht_g_551076003.jpg, cr_g_551075928.jpg  3/4 views from the left (side colours)
  logos:  samsung.png (Samsung's own wordmark)
  writes <out dir>/samsung_rr21/:
    door_<slug>.jpg     each colour's door face from its own front: the H-bar handle, the key lock, the SAMSUNG wordmark
                        and (Camellia Purple and Camelia Blue only) the warranty sticker taken out; they are modelled,
                        a sharp decal, or left out (NOTES.md)
    stand_<slug>.jpg    the base stand drawer's front with Samsung's embossed mark, from the same photo
    mark_light.png, mark_dark.png, label.png (the model line's code taken out), model_<slug>.jpg (each label's own code)
    rear.jpg, bay.jpg, panel.jpg, colours.json

On nine of the fronts the fridge stands at x 744-1308, rows 159-1480 (565 x 1321 px: 1.0 px per mm, Samsung's 56.5 cm
x 1.32 m); Camellia Purple and Camelia Blue are older renders at 0.98 px per mm (x 749-1302, rows 170-1468). On every one
the door runs from its top to the dark seam over the stand, 155 mm up (row 1325 on the nine), and its features sit at the
same millimetres (checked on the overlays GLD-style in RR21_DEBUG).
"""
import json
import os
import site
import sys
from collections import deque

site.addsitedir(os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))  # run with -I: only this folder is added
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "samsung_rr21")
D = os.path.join(OUT, "samsung_rr21")
DBG = os.environ.get("RR21_DEBUG")
os.makedirs(D, exist_ok=True)

# slug: (suffix, code, Samsung's colour name, front photo, label photo)
FIN = {
    "begonia_red": ("br", "RR21H2H25BR", "Begonia Red", "551075924", "553945747"),
    "begonia_blue": ("bb", "RR21H2H25BB", "Begonia Blue", "551075921", "553945734"),
    "camellia_purple": ("cr", "RR21H2H25CR", "Camellia Purple", "551075949", "553945754"),
    "camelia_blue": ("cu", "RR21H2H25CU", "Camelia Blue", "551075974", "553945766"),
    "paradise_bloom_blue": ("9u", "RR21H2H259U", "Paradise Bloom Blue", "551075918", "553944608"),
    "midnight_blossom_blue": ("uz", "RR21H2H25UZ", "Midnight Blossom Blue", "551076089", "553945841"),
    "hydrangea_blue": ("hs", "RR21H2H25HS", "Hydrangea Blue", "551075999", "553945784"),
    "hydrangea_plum": ("ht", "RR21H2H25HT", "Hydrangea Plum", "551076024", "553945798"),
    "paradise_bloom_purple": ("9r", "RR21H2H259R", "Paradise Bloom Purple", "551075903", "553945943"),
    "wild_lily_blue": ("wb", "RR21H2H25WB", "Wild Lily Blue", "551076092", "553944515"),
    "elegant_inox": ("s8", "RR21H2H25S8", "Elegant Inox", "551076064", "553945821"),
}
# each front: the body's columns, its top row, the floor row and px per mm (the width over Samsung's 565 mm)
STD = dict(x0=744, x1=1308, top=159, floor=1480, ppm=565 / 565)
OLD = dict(x0=749, x1=1302, top=170, floor=1468, ppm=554 / 565)
FRONT = {s: (OLD if s in ("cr", "cu") else STD) for s, *_ in FIN.values()}

# the door, in mm: 565 wide, from 155 mm (the seam over the stand) to 1320 mm; texture DW x DH
DOOR_W, DOOR_BOT, DOOR_TOP = 565.0, 155.0, 1320.0
DOOR_H = DOOR_TOP - DOOR_BOT
DW, DH = 512, 1056
# features, in mm from the door's left edge (u) and down from its top (v), measured on the nine fronts at 1.0 px per mm
HANDLE = (0, 222, 565, 287)     # the H-bar: its chrome face rows 388-417 and the dark underside to row 436, with margin
LOCK = (50.0, 488.0, 11.0, 28.0)  # the key lock: centre u, v; half width, half height (17 x 50 mm pill, rows 624-673)
MARK = (240, 88, 326, 110)      # SAMSUNG: ink x 990-1062, rows 251-263 (72 mm wide, middle 98 mm below the top)
BADGE = (425, 30, 548, 135)     # the warranty sticker (Camellia Purple and Camelia Blue fronts only)
EDGE = 30                       # the door's rounded sides: the photo's highlight bands over the outer 30 mm
TOPBAND = 45                    # and the crown's over the top 45 mm
# the viewer's light lifts the print: each door is saved at SHADE of its photo, tuned so the door against
# the label's white is within 0.05 of the photo's ratio both on the web and in the Mac's Apple render
SHADE = {"begonia_red": 0.851, "begonia_blue": 0.877, "camellia_purple": 0.797, "camelia_blue": 0.813,
         "paradise_bloom_blue": 0.793, "midnight_blossom_blue": 0.826, "hydrangea_blue": 0.753, "hydrangea_plum": 0.714,
         "paradise_bloom_purple": 0.832, "wild_lily_blue": 0.856, "elegant_inox": 0.90}
colours = {}


def save(img, name, q=86):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def photo(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(np.float32)


def rows_mm(g, y_mm):
    """photo row of a height in mm above the floor"""
    return g["floor"] - y_mm * g["ppm"]


def cols_mm(g, u_mm):
    return g["x0"] + u_mm * g["ppm"]


def inpaint(img, mask, r=5):
    u8 = np.clip(img, 0, 255).astype(np.uint8)
    out = cv2.inpaint(cv2.cvtColor(u8, cv2.COLOR_RGB2BGR), mask.astype(np.uint8) * 255, r, cv2.INPAINT_TELEA)
    return cv2.cvtColor(out, cv2.COLOR_BGR2RGB).astype(np.float32)


def mm_box(b):
    u0, v0, u1, v1 = b
    m = np.zeros((DH, DW), bool)
    m[max(0, int(v0 / DOOR_H * DH)):int(v1 / DOOR_H * DH) + 1, max(0, int(u0 / DOOR_W * DW)):int(u1 / DOOR_W * DW) + 1] = True
    return m


def lock_mask():
    m = np.zeros((DH, DW), np.uint8)
    cu, cv, hw, hh = LOCK
    sx, sy = DW / DOOR_W, DH / DOOR_H
    cv2.ellipse(m, (int(cu * sx), int((cv - hh + hw) * sy)), (int((hw + 3) * sx), int((hw + 3) * sy)), 0, 0, 360, 1, -1)
    cv2.ellipse(m, (int(cu * sx), int((cv + hh - hw) * sy)), (int((hw + 3) * sx), int((hw + 3) * sy)), 0, 0, 360, 1, -1)
    cv2.rectangle(m, (int((cu - hw - 3) * sx), int((cv - hh + hw) * sy)), (int((cu + hw + 3) * sx), int((cv + hh - hw) * sy)), 1, -1)
    return m > 0


def flatten_light(img, keep):
    """Take the studio light of the curved sides and crown out (the model's own curve lights them): each
    edge column's lift over the face just inside it, as the median over the whole height (plain print only, so a flower
    at the edge doesn't count), and each crown row's lift over the row under the band, as the median across."""
    h, w = img.shape[:2]
    img = img.copy()
    # the outline's few columns are the photo's cut-out edge (dark rim and white fringe): filled from the column inside
    e0 = 6
    img[:, :e0] = img[:, e0:e0 + 1]
    img[:, w - e0:] = img[:, w - e0 - 1:w - e0]
    z = int(EDGE / DOOR_W * w)
    hl = np.zeros_like(img)
    for side, cols, refc in (("l", range(0, z), slice(z, z + 12)), ("r", range(w - z, w), slice(w - z - 12, w - z))):
        ref = np.median(img[:, refc], 1)
        for c in cols:
            d = img[:, c] - ref
            m = keep[:, c]
            hl[:, c] = np.median(d[m], 0) if m.sum() > 50 else 0
    hl = cv2.GaussianBlur(np.maximum(hl, 0), (0, 0), sigmaX=1.2, sigmaY=4)   # light only ever taken off
    img = img - hl
    t = int(TOPBAND / DOOR_H * h)
    ref = np.median(img[t:t + 10], 0)
    hr = np.zeros_like(img)
    for r in range(t):
        d = img[r] - ref
        m = keep[r]
        hr[r] = np.median(d[m], 0) if m.sum() > 50 else 0
    hr = cv2.GaussianBlur(np.maximum(hr, 0), (0, 0), sigmaX=4, sigmaY=1.2)
    colours.setdefault("light_taken_out", {})
    return np.clip(img - hr, 0, 255), float(np.abs(hl).max()), float(np.abs(hr).max())


def corner_light(img):
    """The studio light on the crown's two rounded corners (a bright patch on every photo) and the photo's dark outline
    along the top: the model's own crown lights the corners, so each corner's light over the face below it is taken off,
    fading out 90 mm across and 80 mm down from the corner; the top 5 rows take the row under them."""
    h, w = img.shape[:2]
    img = img.copy()
    img[:5] = img[5:6]
    cw, ch = int(90 / DOOR_W * w), int(80 / DOOR_H * h)
    L = img.mean(2)
    yy, xx = np.mgrid[0:ch, 0:cw].astype(np.float32)
    wgt = np.clip(1 - np.hypot(xx / cw, yy / ch), 0, 1) ** 0.7
    for flip in (False, True):
        cols = slice(w - cw, w) if flip else slice(0, cw)
        band = L[ch:ch + int(40 / DOOR_H * h), cols]
        ref = np.percentile(band, 60)
        wg = wgt[:, ::-1] if flip else wgt
        Lc = L[:ch, cols]
        lift = np.maximum(Lc - ref, 0) * wg
        k = 1 - lift / np.maximum(Lc, 1)
        img[:ch, cols] = img[:ch, cols] * k[..., None]
    return img


def doors():
    sheet = []
    for slug, (suf, code, name, front, _) in FIN.items():
        a = photo(f"{suf}_g_{front}.jpg")
        g = FRONT[suf]
        r0, r1 = int(round(rows_mm(g, DOOR_TOP))), int(round(rows_mm(g, DOOR_BOT)))
        c = a[r0:r1, g["x0"]:g["x1"] + 1]
        c = cv2.resize(c, (DW, DH), interpolation=cv2.INTER_AREA)
        # the rounded top corners: the photo's white there is filled from the door beside it
        corner = np.zeros((DH, DW), bool)
        k = int(70 / DOOR_H * DH)
        corner[:k] = c[:k].min(2) > 200
        out = corner | mm_box(HANDLE) | lock_mask() | mm_box((MARK[0] - 4, MARK[1] - 4, MARK[2] + 4, MARK[3] + 4))
        if suf in ("cr", "cu"):
            out |= mm_box(BADGE)
        keep = ~cv2.dilate(out.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
        flat, le, lt = flatten_light(c, keep)
        clean = inpaint(flat, cv2.dilate(out.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0, 6)
        clean = corner_light(clean)
        colours.setdefault("light_taken_out", {})[slug] = [round(le, 1), round(lt, 1)]
        med = np.median(c[keep], 0)
        colours.setdefault("door_photo_median", {})[slug] = [round(float(v)) for v in med]
        # the door's sides (the band round it): the print's ground, the colour of its darker half
        px = clean[keep]
        lum = px.mean(1)
        edge = np.median(px[lum <= np.percentile(lum, 50)], 0) * SHADE[slug]
        colours.setdefault("edge", {})[slug] = "#%02x%02x%02x" % tuple(int(v) for v in edge)
        img = clean * SHADE[slug]
        save(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), f"door_{slug}.jpg", 84 if slug != "elegant_inox" else 88)
        # the stand's front: 13 mm (its foot) to 150 mm (its top under the door)
        s0, s1 = int(round(rows_mm(g, 150))), int(round(rows_mm(g, 13)))
        s = cv2.resize(a[s0:s1, g["x0"]:g["x1"] + 1], (DW, 128), interpolation=cv2.INTER_AREA)
        sm = np.median(s[80:120].reshape(-1, 3), 0)
        colours.setdefault("stand", {})[slug] = "#%02x%02x%02x" % tuple(int(v) for v in sm)
        save(Image.fromarray(np.clip(s, 0, 255).astype(np.uint8)), f"stand_{slug}.jpg", 84)
        # the SAMSUNG mark's ink: the brightest (prints) or darkest (steel) tenth of its box on the photo
        mb = a[int(rows_mm(g, DOOR_TOP - MARK[1])):int(rows_mm(g, DOOR_TOP - MARK[3])), int(cols_mm(g, MARK[0])):int(cols_mm(g, MARK[2]))].reshape(-1, 3)
        L = mb.mean(1)
        light = slug != "elegant_inox"
        ink = mb[L >= np.percentile(L, 92)] if light else mb[L <= np.percentile(L, 8)]
        colours.setdefault("mark_ink", {})[slug] = [round(float(v)) for v in ink.mean(0)]
        if DBG:
            sheet.append(np.clip(np.concatenate([c, img], 1), 0, 255).astype(np.uint8))
    if DBG:
        os.makedirs(DBG, exist_ok=True)
        for i, s in enumerate(sheet):
            Image.fromarray(s).resize((s.shape[1] // 2, s.shape[0] // 2)).save(os.path.join(DBG, f"door_{i}.png"))


def mark():
    # Samsung's own wordmark, in the inks the fronts show (a light grey on the prints, a dark grey on the steel)
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    inks = colours["mark_ink"]
    light = np.mean([v for k, v in inks.items() if k != "elegant_inox"], 0)
    for name, col in (("light", light), ("dark", inks["elegant_inox"])):
        col = tuple(int(round(v)) for v in col)
        out = np.zeros(a.shape, np.uint8)
        out[..., :3] = col
        out[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(out)
        im = im.crop(im.getchannel("A").getbbox())
        im = im.resize((480, round(480 * im.height / im.width)), Image.LANCZOS)
        pad = Image.new("RGBA", (im.width + 20, im.height + 20), col + (0,))
        pad.paste(im, (10, 10))
        save(pad, f"mark_{name}.png")
        colours.setdefault("mark", {})[name] = {"ink": col, "size": pad.size, "ink_w": im.width}


def label():
    # each colour's own label (Samsung's picture of it, 676 x 1234 px for 93 x 169 mm): the shared sticker is the Begonia
    # Red's with the code after "Model No.:" painted out in the label's cream, and each colour's code is its own label's
    # crop there, laid over it as a strip (so every colour carries the label that names it)
    src = Image.open(os.path.join(SRC, "br_lblx_553945747.jpg")).convert("RGB")
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.min(2) < 225)
    box = (xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3)
    lab = src.crop(box).convert("RGBA")
    px = lab.load()
    w, h = lab.size
    seen = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y, x]:
            continue
        r, g_, b, _ = px[x, y]
        if min(r, g_, b) < 238:
            continue
        seen[y, x] = True
        px[x, y] = (r, g_, b, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    alpha = np.asarray(lab.getchannel("A").filter(ImageFilter.MinFilter(5)))
    rgb = np.asarray(lab.convert("RGB")).astype(np.float32)
    # the code: right of "Model No.:" on the model line (label rows 1012-1048, columns 200-420 of the 676 px label)
    CODE = (196, 1008, 430, 1052)
    cream = np.median(rgb[960:1000, 120:600].reshape(-1, 3), 0)
    rgb[CODE[1]:CODE[3], CODE[0]:CODE[2]] = cream
    # at 4.5 px per mm (93 mm wide: 420 px) as a 63-colour palette with a clear margin
    out_w = 420
    out_h = round(out_w * h / w)
    rgb_s = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).resize((out_w, out_h), Image.LANCZOS)
    al = Image.fromarray(alpha).resize((out_w, out_h), Image.LANCZOS)
    qz = rgb_s.quantize(colors=63, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(qz).copy()
    idx[np.asarray(al) < 128] = 63
    outp = Image.frombytes("P", qz.size, idx.astype(np.uint8).tobytes())
    outp.putpalette(qz.getpalette()[:63 * 3] + [255, 255, 255])
    pad = Image.new("P", (outp.width + 20, outp.height + 20), 63)
    pad.putpalette(outp.getpalette())
    pad.paste(outp, (10, 10))
    p = os.path.join(D, "label.png")
    pad.save(p, optimize=True, transparency=bytes([255] * 63 + [0]))
    print("wrote", p, pad.size, os.path.getsize(p) // 1024, "KB")
    sc = out_w / w
    colours["label"] = {"size": pad.size, "ink": [out_w, out_h], "mm": [93, round(93 * h / w, 1)],
                        "code_box": [round((CODE[0] * sc + 10) / pad.size[0], 4), round((CODE[1] * sc + 10) / pad.size[1], 4),
                                     round((CODE[2] * sc + 10) / pad.size[0], 4), round((CODE[3] * sc + 10) / pad.size[1], 4)]}
    # each colour's code strip from its own label photo (the same crop box, shifted to that photo's label)
    for slug, (suf, code, name, _, lab_id) in FIN.items():
        s = Image.open(os.path.join(SRC, f"{suf}_lblx_{lab_id}.jpg")).convert("RGB")
        b = np.asarray(s).astype(int)
        ys, xs = np.where(b.min(2) < 225)
        ox, oy = xs.min() - 2, ys.min() - 2
        strip = s.crop((ox + CODE[0], oy + CODE[1], ox + CODE[2], oy + CODE[3]))
        sw = round((CODE[2] - CODE[0]) * sc * 2)
        strip = strip.resize((sw, round(sw * strip.height / strip.width)), Image.LANCZOS)
        save(strip, f"model_{slug}.jpg", q=88)


def side_colours():
    # the cabinet's painted sides on the 3/4 views (the median of a band 30-90 px in from the side's outline, rows
    # 500-1100): Camellia Purple (52, 40, 54), Hydrangea Plum (95, 15, 28), Elegant Inox (96, 95, 101; from the left, as the other two); on the 3/4 views
    # of Camelia Blue, Paradise Bloom Blue, Hydrangea Blue and Paradise Bloom Purple the side is the stand's colour within
    # 4 levels, so the colours with no 3/4 view (Begonia Red and Blue, Wild Lily Blue, Midnight Blossom Blue) take their
    # stand's colour (ESTIMATED)
    out = {}
    for suf, f in (("cr", "cr_g_551075928.jpg"), ("ht", "ht_g_551076003.jpg"), ("s8", "s8_g_551076055.jpg")):
        b = photo(f)
        vals = []
        for y in range(500, 1100, 20):
            xs = np.where(b[y].min(1) < 235)[0]
            vals.append(np.median(b[y - 3:y + 3, xs.min() + 30:xs.min() + 90].reshape(-1, 3), 0))
        out[suf] = "#%02x%02x%02x" % tuple(int(v) for v in np.median(vals, 0))
    colours["side_measured"] = out


def rear():
    # the rear photo (1.0 px per mm: x 741-1307, the back's top row 170 = 1258 mm, the floor row 1428): the embossed
    # galvanised back down to row 1016 (412 mm), the open compressor bay to row 1310 (118 mm, the stand's back)
    src = Image.open(os.path.join(SRC, "cr_g_551075936.jpg")).convert("RGB")
    save(src.crop((745, 172, 1303, 1016)).resize((420, 636), Image.LANCZOS), "rear.jpg", 84)
    save(src.crop((748, 1016, 1300, 1310)), "bay.jpg", 84)
    colours["rear"] = {"top_mm": 1258, "bay_top_mm": 412, "stand_back_mm": 118}


def panel():
    # the temperature-control panel right of the freezer box, on the empty open photo (x 974-1021, rows 352-512; about
    # 0.94 px per mm, so its small print stays soft and is not re-set: NOTES.md)
    src = Image.open(os.path.join(SRC, "cr_g_551075926.jpg")).convert("RGB")
    p = src.crop((975, 352, 1021, 512))
    save(p.resize((p.width * 3, p.height * 3), Image.LANCZOS), "panel.jpg", 86)


doors()
mark()
label()
side_colours()
rear()
panel()
json.dump(colours, open(os.path.join(D, "colours.json"), "w"), indent=1)
print(json.dumps(colours, indent=None)[:1500])
