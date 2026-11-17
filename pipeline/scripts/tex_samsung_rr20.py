"""Textures for the Samsung RR20C1823.. 183 L direct-cool single-door refrigerator (Stylish Grande design, base stand
drawer), in the eight colours Samsung India published for this model: Camellia Purple (RR20C1823CR, Sangeetha's listing,
the default), Camellia Blue (CU), Camellia Black (CB), Blooming Saffron Red (R8), Blooming Saffron Blue (U8), Elegant
Inox (S8), Urban Tropical Blue (VB) and Urban Tropical Red (VF).

usage: python3 -I tex_samsung_rr20.py <photos dir> <logos dir> <out dir> [--debug <scratch dir>]
  photos: samsung_rr20/   Samsung India's gallery for each code (<c>_g_<n>.png, 1920 x 1280 with transparency):
          the straight-on front of each colour (FRONTS below) and the open door, empty (cr_g_535547596)
  logos:  samsung.png
  writes <out dir>/samsung_rr20/:
    door_<finish>.jpg   each colour's door face from that colour's own front: the handle and its lock, the SAMSUNG mark and
                        the Digital Inverter badge taken out (they are modelled or decals); the corners outside the door's
                        arched top filled from the print
    stand_<finish>.jpg  the base stand drawer's front with Samsung's embossed mark, from that colour's front
    mark_light.png, mark_dark.png   the SAMSUNG wordmark in the fronts' light ink (printed doors) and dark ink (Inox)
    badge.png           the "Digital Inverter Technology, 10 year warranty" badge on the door, its words set again sharp
    print_freeze.png, print_fresh.png, print_temp.png   the inside's printed words, set again sharp
    colours.json        measured numbers the builder reads

Samsung's eight fronts are one render: the same outline to the pixel, the door's columns 738-1180, its crown on row 39,
its foot on row 1092, the stand's feet on row 1234 (Elegant Inox's shot is the same render drawn 3.3% larger). That
render draws the body about 11% taller for its width than the published 549 x 1300 mm, so the door's features are
measured as fractions of the door (u across from its left edge, v down from the crown) and laid on the published size.
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
P = os.path.join(PHOTOS, "samsung_rr20")
D = os.path.join(OUT, "samsung_rr20")
os.makedirs(D, exist_ok=True)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
PAD = 10
DW, DH = 600, 1262                   # the door, 536 x 1128 mm from its crown to its foot (1.12 px per mm)

# the render's measured rows and columns (template: every front but Elegant Inox's), and its silhouette's box
TPL = dict(x0=738, x1=1180, top=39, bot=1092, box=(730, 39, 1186, 1234))
# what is taken out of the print (template pixels, padded): the handle with its lock and its shadow, the SAMSUNG mark,
# the badge; and the stand's face (the drawer front between its flared sides, from the stand's lip to above the feet)
HANDLE = (756, 124, 805, 497)
MARK = (916, 110, 988, 130)
BADGE = (1090, 60, 1154, 105)
STAND = (734, 1097, 1184, 1223)
# SHADE: the viewer's light lifts the photo, so each door is saved at SHADE of it (tuned on the render as a ratio to the
# photo, REVIEW.md); mark: which ink the wordmark is in on that door
FRONTS = {
    "camellia_purple": dict(file="cr_g_535547617.png", shade=0.92, mark="light"),
    "camellia_blue": dict(file="cu_g_535098695.png", shade=0.92, mark="light"),
    "camellia_black": dict(file="cb_g_535098672.png", shade=0.92, mark="light"),
    "blooming_saffron_red": dict(file="r8_g_535098724.png", shade=0.92, mark="light"),
    "blooming_saffron_blue": dict(file="u8_g_535098780.png", shade=0.92, mark="light"),
    "elegant_inox": dict(file="s8_g_535098749.png", shade=0.86, mark="dark"),
    "urban_tropical_blue": dict(file="vb_g_535157964.png", shade=0.92, mark="light"),
    "urban_tropical_red": dict(file="vf_g_535157983.png", shade=0.92, mark="light"),
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
    """template pixel -> this photo's pixel, from the silhouette's box (the Inox shot is the render drawn larger)"""
    ys, xs = np.where(a[..., 3] > 128)
    bx = (xs.min(), ys.min(), xs.max(), ys.max())
    t = TPL["box"]
    sx, sy = (bx[2] - bx[0]) / (t[2] - t[0]), (bx[3] - bx[1]) / (t[3] - t[1])
    return lambda x, y: (int(round(bx[0] + (x - t[0]) * sx)), int(round(bx[1] + (y - t[1]) * sy)))


def mbox(m, b):
    x0, y0 = m(b[0], b[1])
    x1, y1 = m(b[2], b[3])
    return x0, y0, x1, y1


def door(fin, f):
    a = load_rgba(f["file"])
    m = mapper(a)
    # on black where the photo is clear (outside the outline), then those pixels are filled from the print
    rgb = (a[..., :3].astype(float) * (a[..., 3:] / 255.0)).astype(np.uint8)
    mask = np.zeros(a.shape[:2], np.uint8)
    for b in (MARK, BADGE):
        x0, y0, x1, y1 = mbox(m, b)
        mask[y0:y1 + 1, x0:x1 + 1] = 255
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), mask, 6, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    # the handle stands over the door's left side fall, whose light runs down the door: each row across the handle's box
    # is filled down each column from the print above the handle to the print below it, so the fall's light carries on
    # (an inpaint smeared the fall's dark band into the box)
    x0, y0, x1, y1 = mbox(m, HANDLE)
    Tp, Bt = clean[y0 - 3:y0].astype(float).mean(0), clean[y1 + 1:y1 + 4].astype(float).mean(0)
    t = np.linspace(0, 1, y1 - y0 + 1)[:, None, None]
    clean[y0:y1 + 1, x0:x1 + 1] = (Tp[None, x0:x1 + 1] * (1 - t) + Bt[None, x0:x1 + 1] * t).astype(np.uint8)
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
        for b in (HANDLE, MARK, BADGE, STAND):
            d.rectangle(mbox(m, b), outline=(0, 255, 0))
        d.rectangle((X0, T0, X1, B1), outline=(255, 255, 0))
        dbg.crop((X0 - 40, T0 - 20, X1 + 40, B1 + 160)).save(os.path.join(DBG, f"rr20_{fin}_boxes.png"))
    # the stand's face
    s = Image.fromarray(rgb).crop(mbox(m, STAND)).resize((900, 252), Image.LANCZOS)
    save(s, f"stand_{fin}.jpg", q=88)


def mark():
    # Samsung's own wordmark in the inks the fronts show: light grey on the printed doors (Camellia Purple's front, its ink
    # pixels at 82% or more of the box's brightest), dark grey on the Inox door (its darkest 18%)
    lg = np.asarray(Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")).astype(float)
    out = {}
    for kind, fin in (("light", "camellia_purple"), ("dark", "elegant_inox")):
        a = load_rgba(FRONTS[fin]["file"])
        m = mapper(a)
        x0, y0, x1, y1 = mbox(m, MARK)
        box = a[y0:y1, x0:x1, :3].reshape(-1, 3).astype(float)
        lum = box.mean(1)
        sel = box[lum >= 0.82 * lum.max()] if kind == "light" else box[lum <= np.percentile(lum, 18)]
        col = tuple(int(round(v)) for v in sel.mean(0))
        o = np.zeros(lg.shape, np.uint8)
        o[..., :3] = col
        o[..., 3] = (lg[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(o)
        im = im.crop(im.getchannel("A").getbbox())
        pad = Image.new("RGBA", (im.width + 2 * PAD, im.height + 2 * PAD), col + (0,))
        pad.paste(im, (PAD, PAD))
        save(pad, f"mark_{kind}.png")
        out[kind] = col
    colours["mark"] = {"ink": out, "aspect": round(im.width / im.height, 4), "padded": [pad.width, pad.height]}


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
    # front): a black plate with a light rim. Measured on Camellia Purple's front at 10x (its box 1094-1149 x 64-101 px);
    # the words are set again in Avenir Next at 12 px per mm; the logo (17 x 15 px in the photo) is the photo's own, enlarged
    W_MM = 65.0
    a = load_rgba(FRONTS["camellia_purple"]["file"])
    rgb = a[..., :3]
    bx0, by0, bx1, by1 = 1093.8, 63.8, 1149.5, 101.0
    PX = 12
    Wp = int(W_MM * PX)
    Hp = int(Wp * (by1 - by0) / (bx1 - bx0))
    img = Image.new("RGBA", (Wp + 2 * PAD, Hp + 2 * PAD), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    U = lambda u: PAD + u * Wp
    V = lambda v: PAD + v * Hp
    rim = (226, 214, 220, 255)
    d.rounded_rectangle((U(0), V(0), U(1), V(1)), radius=int(0.03 * Wp), fill=rim)
    d.rounded_rectangle((U(0.012), V(0.02), U(0.988), V(0.98)), radius=int(0.025 * Wp), fill=(6, 6, 10, 255))
    # the logo: the photo's pixels (u 0.061-0.366, v 0.134-0.538), enlarged, its black ground made clear
    lx0, ly0 = bx0 + 0.055 * (bx1 - bx0), by0 + 0.12 * (by1 - by0)
    lx1, ly1 = bx0 + 0.372 * (bx1 - bx0), by0 + 0.55 * (by1 - by0)
    logo = Image.fromarray(rgb).crop((int(lx0), int(ly0), int(np.ceil(lx1)), int(np.ceil(ly1))))
    lw, lh = int(U(0.372) - U(0.055)), int(V(0.55) - V(0.12))
    logo = logo.resize((lw, lh), Image.LANCZOS)
    la = np.asarray(logo).astype(float)
    alpha = ((la.max(2) - 40) / 120).clip(0, 1) * 255
    lg = np.dstack([la, alpha]).clip(0, 255).astype(np.uint8)
    img.alpha_composite(Image.fromarray(lg), (int(U(0.055)), int(V(0.12))))
    light = (214, 222, 214, 255)
    fit_text(d, "DIGITAL", (U(0.398), V(0.175), U(0.80), V(0.285)), 2, light)
    fit_text(d, "INVERTER", (U(0.398), V(0.33), U(0.937), V(0.43)), 2, light)
    fit_text(d, "TECHNOLOGY", (U(0.407), V(0.452), U(0.934), V(0.487)), 5, (180, 186, 182, 255))
    d.rectangle((U(0.057), V(0.612), U(0.937), V(0.627)), fill=(120, 120, 124, 255))
    fit_text(d, "10", (U(0.066), V(0.68), U(0.255), V(0.89)), 2, (240, 228, 196, 255), spacing=0.004 * Wp)
    fit_text(d, "YEAR · ON THE COMPRESSOR", (U(0.273), V(0.70), U(0.937), V(0.735)), 5, (205, 210, 206, 255))
    fit_text(d, "WARRANTY", (U(0.273), V(0.775), U(0.937), V(0.885)), 2, (226, 230, 220, 255))
    save(img, "badge.png")
    colours["badge"] = {"w_mm": W_MM, "aspect": round(Wp / Hp, 4), "padded": [img.width, img.height]}


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
    # "Super Freeze Zone" on the freezer box's back (the open photo cr_g_535547596: light italic, about 136 mm wide),
    # "BIO Fresh Zone" on the vegetable box's front (white italic, about 125 mm), the TEMPERATURE CONTROL panel's heading,
    # the dial's ring with its marks and "Do not use sharp object to remove ice" under it. The panel's small instruction
    # text cannot be read on any photo, so it is left out.
    text_png("print_freeze.png", [("Super Freeze Zone", 8, 11, 4)], (232, 238, 246, 235), 136, 16)
    text_png("print_fresh.png", [("BIO  Fresh Zone", 7, 10, 6)], (246, 249, 252, 220), 125, 14)
    PX = 12
    W, H = 46, 150
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
    d.text((W * PX / 2, 128 * PX), "Do not use sharp object", font=f2, fill=(110, 114, 120, 255), anchor="mm")
    d.text((W * PX / 2, 132 * PX), "to remove ice", font=f2, fill=(110, 114, 120, 255), anchor="mm")
    save(img, "print_temp.png")


for fin, f in FRONTS.items():
    door(fin, f)
mark()
badge()
prints()
with open(os.path.join(D, "colours.json"), "w") as fh:
    json.dump(colours, fh, indent=1)
print("wrote colours.json")
