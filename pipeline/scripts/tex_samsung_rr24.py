"""Textures for the Samsung RR24H2823.. 223 L direct-cool single-door refrigerator (Stylish Grande design, base stand
drawer), in Samsung India's three colours of this body: Hydrangea Plum (RR24H2823HT/NL, the listed one), Hydrangea Blue
(RR24H2823HS/NL) and Midnight Blossom Blue (RR24H2823UZ/NL).

usage: python3 -I tex_samsung_rr24.py <photos dir> <logos dir> <out dir> [--debug <scratch dir>]
  photos: samsung_rr24/   Samsung India's gallery for each code (ht_*, hs_*, uz_*):
          ht_labelp_553849416.jpg, hs_labelp_553849335.jpg  the straight-on front with the BEE label (HT, HS)
          uz_g_551095715.jpg                                 the straight-on front (UZ), sharper than its label picture
          <c>_label_*.jpg                                     each code's own BEE label (it names that code)
          ht_g_551226905.jpg                                  the open door, empty (the inside's prints)
  logos:  samsung.png
  writes <out dir>/samsung_rr24/:
    door_<finish>.jpg   each colour's door face from that colour's own front: the handle and its lock, the SAMSUNG mark and
                        the energy label taken out (they are modelled or decals); the corners outside the door's arched top
                        filled from the print
    stand.jpg           the base stand drawer's front with Samsung's embossed mark (the same black stand on all three)
    label_<finish>.png  each code's own BEE label, die-cut
    mark.png            the SAMSUNG wordmark in the front's light ink
    print_freeze.png, print_fresh.png, print_temp.png   the inside's printed words, set again sharp
    colours.json        measured numbers the builder reads

Every front is measured on its own photo: the door's columns at mid-height, its crown (the top of the arch) and its foot.
Samsung's fronts draw the door about 5% short for its width against the published 536 x 1520 mm, so the door's features
are placed as fractions of the door (u across from its left edge, v down from the crown) and laid on the published size.
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
DBG = sys.argv[sys.argv.index("--debug") + 1] if "--debug" in sys.argv else None
P = os.path.join(PHOTOS, "samsung_rr24")
D = os.path.join(OUT, "samsung_rr24")
os.makedirs(D, exist_ok=True)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
PAD = 10
DW, DH = 600, 1508                   # the door, 536 x 1347 mm from its crown to its foot (1.12 px per mm)
# x0, x1: the door's columns at mid-height; top: the crown's row; bot: the door's last row over the dark gap above the
# stand. SHADE: the photo is lifted by the viewer's light, so each door is saved at SHADE of it (tuned on the render as a
# ratio to the energy label's white, REVIEW.md)
FRONTS = {
    "hydrangea_plum": dict(file="ht_labelp_553849416.jpg", label="ht_label_553849413.jpg", x0=754, x1=1162, top=96, bot=1069, shade=0.92,
                           labelbox=(1032, 155, 1113, 308), handle=(772, 170, 826, 515)),
    "hydrangea_blue": dict(file="hs_labelp_553849335.jpg", label="hs_label_553849331.jpg", x0=752, x1=1160, top=95, bot=1067, shade=0.92,
                           labelbox=(1032, 155, 1113, 308), handle=(772, 170, 826, 515)),
    "midnight_blossom_blue": dict(file="uz_g_551095715.jpg", label="uz_label_553849481.jpg", x0=729, x1=1192, top=19, bot=1117, shade=0.92,
                                  handle=(749, 102, 811, 492)),
}
# the label's and the handle's boxes (with the handle's shadow and its lock) are measured on each photo by eye on a
# 2x crop (the label is composited flat on Samsung's render, so its box is exact); the mark is found by its ink
# search boxes (u0, v0, u1, v1) for what is taken out of the print
MARK_S = (0.38, 0.05, 0.62, 0.10)
colours = {"fronts": {}}


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def load(name):
    return np.asarray(Image.open(os.path.join(P, name)).convert("RGB")).astype(np.uint8)


def sub(f, box):
    u0, v0, u1, v1 = box
    X = lambda u: int(round(f["x0"] + u * (f["x1"] - f["x0"])))
    Y = lambda v: int(round(f["top"] + v * (f["bot"] - f["top"])))
    return X(u0), Y(v0), X(u1), Y(v1)


def door(fin, f):
    src = load(f["file"])
    a = src.astype(int)
    sat = a.max(2) - a.min(2)
    mask = np.zeros(src.shape[:2], np.uint8)
    found = {}
    # the SAMSUNG mark: light, grey ink in its box
    x0, y0, x1, y1 = sub(f, MARK_S)
    m = (a[y0:y1, x0:x1].min(2) > 110) & (sat[y0:y1, x0:x1] < 60)
    ys, xs = np.where(m)
    mb = (x0 + xs.min(), y0 + ys.min(), x0 + xs.max(), y0 + ys.max())
    mask[mb[1] - 3:mb[3] + 4, mb[0] - 3:mb[2] + 4] = 255
    found["mark"] = mb
    # the energy label (the HT and HS fronts carry it): its white body, found as the biggest light blob in its box
    if "labelbox" in f:
        lb = f["labelbox"]
        mask[lb[1] - 3:lb[3] + 4, lb[0] - 3:lb[2] + 4] = 255
        found["label"] = lb
    # the handle: chrome (light, grey) and its dark top mount, the tallest grey blob in its box; with its shadow to the
    # right
    hb = f["handle"]
    mask[hb[1]:hb[3] + 1, hb[0]:hb[2] + 1] = 255
    found["handle"] = hb
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(src, cv2.COLOR_RGB2BGR), mask, 6, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    crop = clean[f["top"]:f["bot"] + 1, f["x0"]:f["x1"] + 1].copy()
    # the corners outside the arched top and the photo's black round the door's rounded edges: filled from the print
    bg = (crop.max(2) < 10).astype(np.uint8) * 255
    bg[int(crop.shape[0] * 0.08):] = 0
    bg = cv2.dilate(bg, np.ones((3, 3), np.uint8))
    crop = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(crop, cv2.COLOR_RGB2BGR), bg, 5, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    img = Image.fromarray(crop).resize((DW, DH), Image.LANCZOS)
    arr = np.asarray(img).astype(float) * f["shade"]
    save(Image.fromarray(arr.clip(0, 255).astype(np.uint8)), f"door_{fin}.jpg", q=88)
    W, H = f["x1"] - f["x0"], f["bot"] - f["top"]
    uv = lambda b: [round((b[0] - f["x0"]) / W, 4), round((b[1] - f["top"]) / H, 4), round((b[2] - f["x0"]) / W, 4), round((b[3] - f["top"]) / H, 4)]
    colours["fronts"][fin] = {k: uv(v) for k, v in found.items()}
    print(fin, {k: uv(v) for k, v in found.items()})
    if DBG:
        dbg = Image.fromarray(src).convert("RGB")
        d = ImageDraw.Draw(dbg)
        for k, v in found.items():
            d.rectangle(v, outline=(0, 255, 0))
        d.rectangle((f["x0"], f["top"], f["x1"], f["bot"]), outline=(255, 255, 0))
        dbg.crop((f["x0"] - 40, f["top"] - 20, f["x1"] + 40, f["bot"] + 150)).save(os.path.join(DBG, f"rr24_{fin}_boxes.png"))
        side = Image.new("RGB", (W * 2 + 10, H), "white")
        side.paste(Image.fromarray(src).crop((f["x0"], f["top"], f["x1"], f["bot"])), (0, 0))
        side.paste(Image.fromarray(arr.clip(0, 255).astype(np.uint8)).resize((W, H)), (W + 10, 0))
        side.save(os.path.join(DBG, f"rr24_{fin}_door.png"))


def stand():
    # the HT front: the stand's face rows 1082-1187, columns 748-1165 (its flared sides trimmed); the same black stand
    # under all three colours
    src = Image.open(os.path.join(P, "ht_labelp_553849416.jpg")).convert("RGB").crop((748, 1082, 1166, 1187))
    a = np.asarray(src).astype(float) * 1.0
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8)).resize((836, 210), Image.LANCZOS)
    save(img, "stand.jpg", q=88)


def label(fin, name):
    # on black, with a thin pink cut line round its white margin: keep what is not black, trim the cut line
    src = Image.open(os.path.join(P, name)).convert("RGB")
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.max(2) > 30)
    lab = src.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3))
    # kept at Samsung's own resolution (about 650 px across its 101 mm), as the RT40 and RT45: the label's small print
    # must read at the page's 4 degree close-up
    b = np.asarray(lab).astype(int)
    # the label's outline: what is not black, with the holes filled (its black print is inside the outline, so it is
    # kept), then trimmed 6 px to lose the cut line
    m = ((b.max(2) > 30) * 255).astype(np.uint8)
    ff = m.copy()
    cv2.floodFill(ff, np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8), (0, 0), 255)
    alpha = Image.fromarray(m | cv2.bitwise_not(ff)).filter(ImageFilter.MinFilter(13))
    al = np.asarray(alpha)
    q = lab.quantize(colors=63, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(q).copy()
    idx[al < 128] = 63
    out = Image.frombytes("P", q.size, idx.astype(np.uint8).tobytes())
    out.putpalette(q.getpalette()[:63 * 3] + [255, 255, 255])
    pad = Image.new("P", (out.width + 2 * PAD, out.height + 2 * PAD), 63)
    pad.putpalette(out.getpalette())
    pad.paste(out, (PAD, PAD))
    p = os.path.join(D, f"label_{fin}.png")
    pad.save(p, optimize=True, transparency=bytes([255] * 63 + [0]))
    print("wrote", p, pad.size, os.path.getsize(p) // 1024, "KB")
    colours["label_aspect"] = round(pad.width / pad.height, 4)
    colours["label_pad"] = round(PAD / (pad.width), 4)


def mark():
    # Samsung's own wordmark in the light grey ink the HT front shows (its ink pixels at 82% or more of the box's
    # brightest)
    f = FRONTS["hydrangea_plum"]
    src = load(f["file"]).astype(float)
    x0, y0, x1, y1 = sub(f, MARK_S)
    box = src[y0:y1, x0:x1].reshape(-1, 3)
    lum = box.mean(1)
    col = tuple(int(round(v)) for v in box[lum >= 0.82 * lum.max()].mean(0))
    lg = np.asarray(Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")).astype(float)
    out = np.zeros(lg.shape, np.uint8)
    out[..., :3] = col
    out[..., 3] = (lg[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out)
    im = im.crop(im.getchannel("A").getbbox())
    pad = Image.new("RGBA", (im.width + 2 * PAD, im.height + 2 * PAD), col + (0,))
    pad.paste(im, (PAD, PAD))
    save(pad, "mark.png")
    colours["mark"] = {"ink": col, "aspect": round(im.width / im.height, 4), "padded": [pad.width, pad.height]}


def font(px, face):
    return ImageFont.truetype(FONT, px, index=face)


def text_png(name, lines, px_h, fill, face, wmm, hmm, PX=8, italic_shift=0):
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
    # "Super Freeze Zone" on the freezer box's back (Samsung's open photo: light grey-white italic, 130 mm wide), "BIO
    # Fresh Zone" on the vegetable box's front (white italic), the TEMPERATURE CONTROL panel's heading and the dial's ring
    # with its marks. The panel's small instruction text cannot be read on any photo, so it is left out.
    text_png("print_freeze.png", [("Super Freeze Zone", 8, 11, 4)], 11, (232, 238, 246, 235), 4, 130, 16)
    text_png("print_fresh.png", [("BIO  Fresh Zone", 7, 10, 6)], 10, (246, 249, 252, 220), 6, 110, 14)
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
    label(fin, f["label"])
stand()
mark()
prints()
with open(os.path.join(D, "colours.json"), "w") as fh:
    json.dump(colours, fh, indent=1)
print("wrote colours.json")
