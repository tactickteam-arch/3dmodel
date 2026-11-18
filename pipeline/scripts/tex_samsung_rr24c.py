"""Textures for the Samsung RR24C2823.. 223 L direct-cool single-door refrigerator (Stylish Grande design, base stand
drawer), in the four colours Samsung India published for this model: Camellia Blue (RR24C2823CU/NL, Sangeetha's listing,
the default), Camellia Purple (CR), Luxe Brown (DX) and Elegant Inox (S8).

usage: python3 -I tex_samsung_rr24c.py <photos dir> <logos dir> <out dir> [--debug <scratch dir>]
  photos: samsung_rr24c/   Samsung India's gallery for each code (<c>_g_<n>.png, <c>_lbl*_<n>.png; 1920 x 1280 with
          transparency): the straight-on front of each colour (FRONTS below)
  logos:  samsung.png
  writes <out dir>/samsung_rr24c/:
    door_<finish>.jpg   each colour's door face from that colour's own front: the handle and its lock, the SAMSUNG mark,
                        the Digital Inverter badge (and on the Inox front, the expired energy label) taken out (they are
                        modelled or decals); the corners outside the door's arched top filled from the print
    stand_<finish>.jpg  the base stand drawer's front with Samsung's embossed mark, from that colour's front
    mark.png            the SAMSUNG wordmark in the fronts' light ink
    badge.png           the "Digital Inverter Technology, 10 year warranty" badge on the door, its words set again sharp
    print_freeze.png, print_fresh.png, print_temp.png   the inside's printed words, set again sharp
    colours.json        measured numbers the builder reads

The Camellia Blue, Camellia Purple and Luxe Brown fronts are one render: the same outline to the pixel, the door's columns
735-1183, its crown on row 32, its foot on row 1104, the stand's feet on row 1244. Elegant Inox's front (the only one Samsung
shows of it, with its label) is the same render drawn at 0.90 of the size. The render draws the body about 5% short for its
width against the published 1520 mm (as the RR24H's fronts), so the door's features are measured as fractions of the door
(u across from its left edge, v down from the crown) and laid on the published size.
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
DBG = sys.argv[sys.argv.index("--debug") + 1] if "--debug" in sys.argv else None
P = os.path.join(PHOTOS, "samsung_rr24c")
D = os.path.join(OUT, "samsung_rr24c")
os.makedirs(D, exist_ok=True)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
PAD = 10
DW, DH = 600, 1508                   # the door, 534 x 1347 mm from its crown to its foot (1.12 px per mm)

# the render's measured rows and columns (the CU, CR and DX fronts), and its silhouette's box
TPL = dict(x0=735, x1=1183, top=32, bot=1104, box=(727, 32, 1189, 1244))
# what is taken out of the print (template pixels, padded): the handle with its lock and its shadow, the SAMSUNG mark,
# the badge; the stand's face (the drawer front from its lip, row 1119, to above the feet, between its flared sides)
HANDLE = (755, 118, 800, 492)
MARK = (927, 106, 992, 124)          # Camellia Blue and Purple: the mark's ink 932-986 x 112-119
MARK_STEEL = (919, 104, 984, 123)    # Luxe Brown and Elegant Inox print it 8 px further left and 1.5 px higher: 924-978 x 110-118
BADGE = (1093, 54, 1157, 100)
STAND = (729, 1119, 1188, 1233)
# SHADE: the viewer's light lifts the photo, so each door is saved at SHADE of it (as the RR20's and RR24's);
# label: the Inox front carries the expired 2023-25 label (template pixels, padded), filled from the brushed steel
FRONTS = {
    "camellia_blue": dict(file="cu_g_535309599.png", shade=0.92),
    "camellia_purple": dict(file="cr_lbl_551996264.png", shade=0.92),
    "luxe_brown": dict(file="dx_g_535309620.png", shade=0.88, mark=MARK_STEEL),
    "elegant_inox": dict(file="s8_lblp_550750797.png", shade=0.86, mark=MARK_STEEL, label=(1029, 147, 1139, 344)),
}
colours = {"fronts": {}}


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def load_rgba(name):
    return np.asarray(Image.open(os.path.join(P, name)).convert("RGBA"))


def mapper(a):
    """template pixel -> this photo's pixel, from the silhouette's box (the Inox shot is the render drawn smaller)"""
    ys, xs = np.where(a[..., 3] > 128)
    bx = (xs.min(), ys.min(), xs.max(), ys.max())
    t = TPL["box"]
    sx, sy = (bx[2] - bx[0]) / (t[2] - t[0]), (bx[3] - bx[1]) / (t[3] - t[1])
    return lambda x, y: (int(round(bx[0] + (x - t[0]) * sx)), int(round(bx[1] + (y - t[1]) * sy)))


def mbox(m, b):
    x0, y0 = m(b[0], b[1])
    x1, y1 = m(b[2], b[3])
    return x0, y0, x1, y1


def fill_box(img, b, dx):
    """fill the box b column by column from the door just above it to the door just below it (the light falls down
    and across the door), plus the fine brushed detail of the same rows dx px to the side (horizontal hairline steel)"""
    x0, y0, x1, y1 = b
    out = img.astype(float).copy()
    Tp, Bt = img[y0 - 4:y0].astype(float).mean(0), img[y1 + 1:y1 + 5].astype(float).mean(0)
    t = np.linspace(0, 1, y1 - y0 + 1)[:, None, None]
    base = Tp[None, x0:x1 + 1] * (1 - t) + Bt[None, x0:x1 + 1] * t
    if dx:
        src = img[y0:y1 + 1, x0 + dx:x1 + 1 + dx].astype(float)
        base = base + (src - cv2.GaussianBlur(src, (0, 0), 6))
    out[y0:y1 + 1, x0:x1 + 1] = base
    return out.clip(0, 255).astype(np.uint8)


def door(fin, f):
    a = load_rgba(f["file"])
    m = mapper(a)
    # on black where the photo is clear (outside the outline), then those pixels are filled from the print
    rgb = (a[..., :3].astype(float) * (a[..., 3:] / 255.0)).astype(np.uint8)
    mask = np.zeros(a.shape[:2], np.uint8)
    for b in (f.get("mark", MARK), BADGE):
        x0, y0, x1, y1 = mbox(m, b)
        mask[y0:y1 + 1, x0:x1 + 1] = 255
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), mask, 6, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    if "label" in f:     # in the photo's own pixels (the label's die-cut box 1034-1133 x 152-338, padded)
        lb = f["label"]
        clean = fill_box(clean, lb, -(lb[2] - lb[0] + 8))
    # the handle stands over the door's left side fall, whose light runs down the door: each column across the handle's box
    # is filled from the door above the handle to the door below it, so the fall's light carries on; on the steel doors the
    # brushed lines are taken from the same rows just right of the handle (the printed doors keep the smooth fill)
    hb = mbox(m, HANDLE)
    clean = fill_box(clean, hb, (hb[2] - hb[0] + 6) * (0 if fin.startswith("camellia") else 1))
    X0, T0 = m(TPL["x0"], TPL["top"])
    X1, B1 = m(TPL["x1"], TPL["bot"])
    crop = clean[T0:B1 + 1, X0:X1 + 1].copy()
    out = (a[T0:B1 + 1, X0:X1 + 1, 3] < 200).astype(np.uint8) * 255
    out[int(out.shape[0] * 0.1):] = 0
    out = cv2.dilate(out, np.ones((5, 5), np.uint8))
    crop = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(crop, cv2.COLOR_RGB2BGR), out, 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    img = Image.fromarray(crop).resize((DW, DH), Image.LANCZOS)
    arr = np.asarray(img).astype(float) * f["shade"]
    save(Image.fromarray(arr.clip(0, 255).astype(np.uint8)), f"door_{fin}.jpg", q=88)
    # the door's edge colour: the print's ground at the door's left and right edges, mid-height (for the door's sides)
    W, H = crop.shape[1], crop.shape[0]
    edge = np.concatenate([crop[int(H * 0.45):int(H * 0.6), 2:6].reshape(-1, 3), crop[int(H * 0.45):int(H * 0.6), W - 6:W - 2].reshape(-1, 3)])
    colours["fronts"][fin] = {"edge": "#%02x%02x%02x" % tuple(int(v * f["shade"]) for v in np.median(edge, 0))}
    if DBG:
        dbg = Image.fromarray(rgb).convert("RGB")
        d = ImageDraw.Draw(dbg)
        for b in (HANDLE, f.get("mark", MARK), BADGE, STAND):
            d.rectangle(mbox(m, b), outline=(0, 255, 0))
        if "label" in f:
            d.rectangle(f["label"], outline=(255, 0, 0))
        d.rectangle((X0, T0, X1, B1), outline=(255, 255, 0))
        dbg.crop((X0 - 40, T0 - 20, X1 + 40, B1 + 160)).save(os.path.join(DBG, f"rr24c_{fin}_boxes.png"))
        side = Image.new("RGB", (W * 2 + 10, H), "white")
        side.paste(Image.fromarray(rgb).crop((X0, T0, X1 + 1, B1 + 1)), (0, 0))
        side.paste(Image.fromarray(arr.clip(0, 255).astype(np.uint8)).resize((W, H)), (W + 10, 0))
        side.save(os.path.join(DBG, f"rr24c_{fin}_door.png"))
    # the stand's face, its clear corners (outside the flared sides) filled from the face
    sx0, sy0, sx1, sy1 = mbox(m, STAND)
    s = rgb[sy0:sy1, sx0:sx1].copy()
    hole = (a[sy0:sy1, sx0:sx1, 3] < 200).astype(np.uint8) * 255
    if hole.any():
        s = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(s, cv2.COLOR_RGB2BGR), cv2.dilate(hole, np.ones((3, 3), np.uint8)), 4, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    save(Image.fromarray(s).resize((918, 228), Image.LANCZOS), f"stand_{fin}.jpg", q=88)


def mark():
    # Samsung's own wordmark in the light grey ink the fronts show (Camellia Blue's front: its ink pixels at 82% or more of
    # the box's brightest; the other three fronts print it in the same light grey)
    lg = np.asarray(Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")).astype(float)
    inks = {}
    for fin, f in FRONTS.items():
        a = load_rgba(f["file"])
        x0, y0, x1, y1 = mbox(mapper(a), f.get("mark", MARK))
        box = a[y0:y1, x0:x1, :3].reshape(-1, 3).astype(float)
        lum = box.mean(1)
        inks[fin] = [int(round(v)) for v in box[lum >= 0.82 * lum.max()].mean(0)]
    print("mark ink per front", inks)
    col = tuple(inks["camellia_blue"])
    o = np.zeros(lg.shape, np.uint8)
    o[..., :3] = col
    o[..., 3] = (lg[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(o)
    im = im.crop(im.getchannel("A").getbbox())
    pad = Image.new("RGBA", (im.width + 2 * PAD, im.height + 2 * PAD), col + (0,))
    pad.paste(im, (PAD, PAD))
    save(pad, "mark.png")
    # the steel doors print the mark 9.5 mm further left (a second decal, its own material): on the colours that do not
    # carry it, its material takes this clear image, so that decal is not drawn
    Image.new("RGBA", (8, 8), col + (0,)).save(os.path.join(D, "mark_none.png"), optimize=True)
    colours["mark"] = {"ink": col, "inks": inks, "aspect": round(im.width / im.height, 4), "padded": [pad.width, pad.height]}


def font(px, face):
    return ImageFont.truetype(FONT, max(4, int(px)), index=face)


def fit_text(d, s, box, face, fill, spacing=None):
    """set s inside box (x0, y0, x1, y1 in px): its capitals' height fitted to the box's height, letter-spaced (never
    stretched) out to the box's width"""
    x0, y0, x1, y1 = box
    h = y1 - y0
    f = font(h * 1.38, face)
    ink = f.getbbox(s)
    k = h / max(1, ink[3] - ink[1])
    f = font(h * 1.38 * k, face)
    widths = [f.getlength(ch) for ch in s]
    natural = sum(widths)
    if natural > x1 - x0:      # too wide at the box's height: smaller, never squeezed
        f = font(h * 1.38 * k * (x1 - x0) / natural, face)
        widths = [f.getlength(ch) for ch in s]
        natural = sum(widths)
    gap = max(0.0, (x1 - x0 - natural) / max(1, len(s) - 1)) if spacing is None else spacing
    x = x0
    top = f.getbbox(s)[1]
    for ch, w in zip(s, widths):
        d.text((x, y0 - top), ch, font=f, fill=fill)
        x += w + gap


def badge():
    # Samsung's "Digital Inverter Technology / 10 year on the compressor warranty" badge at the door's top right (every
    # front of this model): a black plate with a light rim. Measured on Camellia Blue's front at 12x (its box
    # 1096.3-1153.0 x 58.0-96.0 px, 67 mm wide at 0.838 px per mm); the words are set again in Avenir Next at 12 px per mm;
    # the logo (17 x 15 px in the photo) is the photo's own, enlarged
    W_MM = 67.0
    a = load_rgba(FRONTS["camellia_blue"]["file"])
    rgb = a[..., :3]
    bx0, by0, bx1, by1 = 1096.3, 58.0, 1153.0, 96.0
    PX = 12
    Wp = int(W_MM * PX)
    Hp = int(Wp * (by1 - by0) / (bx1 - bx0))
    img = Image.new("RGBA", (Wp + 2 * PAD, Hp + 2 * PAD), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    U = lambda u: PAD + u * Wp
    V = lambda v: PAD + v * Hp
    rim = (196, 198, 204, 255)
    d.rounded_rectangle((U(0), V(0), U(1), V(1)), radius=int(0.03 * Wp), fill=rim)
    d.rounded_rectangle((U(0.012), V(0.02), U(0.988), V(0.98)), radius=int(0.025 * Wp), fill=(4, 6, 12, 255))
    # the logo: the photo's pixels (u 0.055-0.372, v 0.12-0.55), enlarged, its black ground made clear
    lx0, ly0 = bx0 + 0.055 * (bx1 - bx0), by0 + 0.12 * (by1 - by0)
    lx1, ly1 = bx0 + 0.372 * (bx1 - bx0), by0 + 0.55 * (by1 - by0)
    logo = Image.fromarray(rgb).crop((int(lx0), int(ly0), int(np.ceil(lx1)), int(np.ceil(ly1))))
    lw, lh = int(U(0.372) - U(0.055)), int(V(0.55) - V(0.12))
    logo = logo.resize((lw, lh), Image.LANCZOS)
    la = np.asarray(logo).astype(float)
    alpha = ((la.max(2) - 40) / 120).clip(0, 1) * 255
    lg = np.dstack([la, alpha]).clip(0, 255).astype(np.uint8)
    img.alpha_composite(Image.fromarray(lg), (int(U(0.055)), int(V(0.12))))
    light = (214, 220, 222, 255)
    fit_text(d, "DIGITAL", (U(0.398), V(0.175), U(0.80), V(0.285)), 2, light)
    fit_text(d, "INVERTER", (U(0.398), V(0.33), U(0.937), V(0.43)), 2, light)
    fit_text(d, "TECHNOLOGY", (U(0.407), V(0.452), U(0.934), V(0.487)), 5, (180, 186, 188, 255))
    d.rectangle((U(0.057), V(0.612), U(0.937), V(0.627)), fill=(120, 120, 124, 255))
    fit_text(d, "10", (U(0.066), V(0.68), U(0.255), V(0.89)), 2, (240, 228, 196, 255), spacing=0.004 * Wp)
    fit_text(d, "YEAR · ON THE COMPRESSOR", (U(0.273), V(0.70), U(0.937), V(0.735)), 5, (205, 210, 210, 255))
    fit_text(d, "WARRANTY", (U(0.273), V(0.775), U(0.937), V(0.885)), 2, (226, 230, 230, 255))
    save(img, "badge.png")
    colours["badge"] = {"w_mm": W_MM, "aspect": round(Wp / Hp, 4), "padded": [img.width, img.height]}
    if DBG:
        ph = Image.fromarray(rgb).crop((int(bx0) - 2, int(by0) - 2, int(bx1) + 3, int(by1) + 3)).resize((img.width, img.height), Image.NEAREST)
        side = Image.new("RGB", (img.width * 2 + 10, img.height), "white")
        side.paste(ph, (0, 0))
        side.paste(img, (img.width + 10, 0), img)
        side.save(os.path.join(DBG, "rr24c_badge.png"))


def text_png(name, lines, fill, wmm, hmm, PX=8):
    # words set again at PX px per mm on a clear ground, each line fitted to its measured height
    W, H = int(wmm * PX), int(hmm * PX)
    img = Image.new("RGBA", (W + 2 * PAD, H + 2 * PAD), fill[:3] + (0,))
    d = ImageDraw.Draw(img)
    for (s, cy_mm, h_mm, fc) in lines:
        f = font(int(h_mm * PX * 1.35), fc)
        d.text((PAD + W / 2, PAD + cy_mm * PX), s, font=f, fill=fill, anchor="mm")
    save(img, name)
    return img


def prints():
    # The inside is Samsung's same render as the RR24H2823's (its empty open photo cu_g_535309582 matches that one to the
    # pixel inside the cabinet): "Super Freeze Zone" on the freezer box's back (light grey-white italic, 130 mm wide),
    # "BIO Fresh Zone" on the vegetable box's front (white italic, 110 mm), the TEMPERATURE CONTROL panel's heading, the
    # dial's ring with its marks and "Do not use sharp object to remove ice" under it. The panel's small instruction text
    # cannot be read on any photo, so it is left out.
    text_png("print_freeze.png", [("Super Freeze Zone", 8, 11, 4)], (232, 238, 246, 235), 130, 16)
    text_png("print_fresh.png", [("BIO  Fresh Zone", 7, 10, 6)], (246, 249, 252, 220), 110, 14)
    PX = 12
    W, H = 46, 130
    img = Image.new("RGBA", (W * PX, H * PX), (246, 247, 248, 255))
    d = ImageDraw.Draw(img)
    f = font(int(3.0 * PX * 1.35), 5)
    d.text((W * PX / 2, 7 * PX), "TEMPERATURE", font=f, fill=(92, 96, 102, 255), anchor="mm")
    d.text((W * PX / 2, 11 * PX), "CONTROL", font=f, fill=(92, 96, 102, 255), anchor="mm")
    cx, cy, r = W * PX / 2, 27 * PX, 15 * PX
    d.arc((cx - r, cy - r, cx + r, cy + r), 135, 405, fill=(70, 74, 80, 255), width=int(1.2 * PX))
    for k in range(9):
        ang = np.radians(135 + k * 270 / 8)
        d.line([(cx + (r + 1.2 * PX) * np.cos(ang), cy + (r + 1.2 * PX) * np.sin(ang)), (cx + (r + 3 * PX) * np.cos(ang), cy + (r + 3 * PX) * np.sin(ang))], fill=(70, 74, 80, 255), width=int(0.6 * PX))
    f2 = font(int(2.2 * PX * 1.35), 5)
    d.text((W * PX / 2, 100 * PX), "Do not use sharp object", font=f2, fill=(110, 114, 120, 255), anchor="mm")
    d.text((W * PX / 2, 104 * PX), "to remove ice", font=f2, fill=(110, 114, 120, 255), anchor="mm")
    save(img, "print_temp.png")


for fin, f in FRONTS.items():
    door(fin, f)
mark()
badge()
prints()
with open(os.path.join(D, "colours.json"), "w") as fh:
    json.dump(colours, fh, indent=1)
print("wrote colours.json")
