"""Textures for the Haier HRD-752KSA, 50 L direct-cool single-door "bedroom" refrigerator (mini bar), Black Steel (the
only colour Haier sells this model in).

usage: python3 -I tex_haier_hrd752.py <photos dir> <logos dir> <out dir> [--debug <scratch dir>]
  photos (pipeline/sources/photos/haier_hrd752/): Haier India's own shop gallery for HRD-752KSA (1200 x 1200)
    g03_front.jpg        the closed front straight on: the door x 201-1004 for its 465 mm (0.579 mm per px across), its
                         face rows 108-1076 (under the top cap, over the bottom strip); the Haier mark x 552-666, rows
                         223-256; the lock x 256-307, rows 403-451. Its energy label is a soft, unreadable picture (its words
                         are garbled, "ROWER RAVINGA CRISE"), and the 3/4 photos show no label: no label is drawn.
    g01_rear.jpg         the back straight on: the cabinet x 129-1081, rows 62-1141 (the galvanised back, CYCLOPENTANE
                         embossed, the wiring label, and the open compressor bay with the coiled cord)
    g02_open_empty.jpg   the door open, empty: the control panel beside the freezer box (x 500-577, rows 332-482), the
                         FREEZER flap's lettering (x 315-435, rows 400-422)
  logos: haier.png (Haier's own wordmark)
  writes <out dir>/haier_hrd752/:
    door.jpg     the Black Steel door face (465 x 492 mm): a near-black ground with fine horizontal streaks (the front's
                 horizontal lines) and the photo's own two soft light bands down the door, read row by row off g03 over
                 the columns clear of the mark, the lock and the label, held at GAIN_K of their strength (the viewer's
                 light adds the rest). The colour is set here: a textured material's colour is ignored.
    logo.png     the Haier wordmark in the front's silver ink (its pixels at 82% or more of the box's brightest, g03)
    rear.jpg     the back, cropped to the cabinet
    panel.jpg    the control panel's face: the photo (its small print is too soft to read and stays as photographed),
                 "Temperature Setting" set again sharp; the knob is modelled
    flap.png     FREEZER, moulded into the clear flap, set again sharp (frosted light grey on clear)
Every word is set at 7.2 px per mm or more in Avenir Next or Arial.
"""
import json
import os
import site
import sys

site.addsitedir(os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))  # run with -I: only this folder is added
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
DBG = sys.argv[sys.argv.index("--debug") + 1] if "--debug" in sys.argv else None
SLUG = "haier_hrd752"
P = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
AV = "/System/Library/Fonts/Avenir Next.ttc"
ARIALB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
PAD = 10
rng = np.random.default_rng(752)
info = {}

# the door's ground (sRGB, before the viewer's light) and how much of the photo's light bands are kept; tuned on the
# gate's renders as a ratio to the mark's silver (REVIEW.md)
DOOR_BASE = (14, 14, 16)
GAIN_K = 0.5
STREAK = 1.6


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def load(name):
    return np.asarray(Image.open(os.path.join(P, name)).convert("RGB")).astype(float)


def door():
    a = load("g03_front.jpg").mean(2)
    cols = np.r_[330:520, 690:790]               # clear of the mark (552-666), the lock (256-307) and the label (811-989)
    rows = a[108:1077][:, cols].mean(1)
    sm = cv2.GaussianBlur(rows[:, None].astype(np.float32), (1, 0), 25).ravel()
    band = sm / sm.mean()                        # the photo's soft light bands down the door, 0.56-1.68 of its mean
    gain = 1 + GAIN_K * (band - 1)
    W, H = 640, 676                              # 465 x 492 mm, 1.38 px per mm
    g = np.interp(np.linspace(0, len(gain) - 1, H), np.arange(len(gain)), gain)[:, None]
    # fine horizontal streaks: long faint lines across the door
    n = rng.normal(0, 1, (H, 1))
    n = np.repeat(n, W, axis=1)
    img = Image.fromarray(((n * 0.25 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((60, 0.6)))
    s = (np.asarray(img).astype(float) / 255 - 0.5) * 4 * STREAK + rng.normal(0, 0.35, (H, W))
    out = (np.array(DOOR_BASE, float)[None, None, :] + s[:, :, None]) * g[:, :, None]
    save(Image.fromarray(out.clip(0, 255).astype(np.uint8)), "door.jpg", q=90)
    info["door_band"] = [round(float(band.min()), 3), round(float(band.max()), 3)]


def logo():
    a = load("g03_front.jpg")
    box = a[223:257, 552:667].reshape(-1, 3)
    lum = box.mean(1)
    ink = tuple(int(round(v)) for v in box[lum >= 0.82 * lum.max()].mean(0))
    lg = np.asarray(Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")).astype(float)
    out = np.zeros(lg.shape, np.uint8)
    out[..., :3] = ink
    out[..., 3] = (lg[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out)
    im = im.crop(im.getchannel("A").getbbox())
    pad = Image.new("RGBA", (im.width + 2 * PAD, im.height + 2 * PAD), ink + (0,))
    pad.paste(im, (PAD, PAD))
    save(pad, "logo.png")
    info["logo"] = {"ink": ink, "padded": [pad.width, pad.height], "inner": [im.width, im.height]}


def rear():
    im = Image.open(os.path.join(P, "g01_rear.jpg")).convert("RGB").crop((135, 62, 1076, 1142))
    im = im.resize((640, 735), Image.LANCZOS)
    save(im, "rear.jpg", q=86)


def font(path, px, index=0):
    return ImageFont.truetype(path, px, index=index)


def panel():
    # g02: the panel x 500-578, rows 332-483 (64 x 125 mm at 0.79 / 0.83 mm per px). Upscaled 6x (soft as the photo is);
    # "Temperature Setting" (x 516-557, rows 445-451) painted out and set again sharp
    K = 6
    x0, y0, x1, y1 = 500, 332, 578, 483
    src = Image.open(os.path.join(P, "g02_open_empty.jpg")).convert("RGB")
    a = np.asarray(src).astype(np.uint8)
    mask = np.zeros(a.shape[:2], np.uint8)
    mask[444:453, 514:559] = 255
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(a, cv2.COLOR_RGB2BGR), mask, 4, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    crop = Image.fromarray(clean).crop((x0, y0, x1, y1)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS)
    # the panel's white lifted a little (the photo is shot dim inside); its print kept
    arr = np.asarray(crop).astype(float)
    arr = 255 - (255 - arr) * 0.9
    crop = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(crop)
    cx, cy = (536.5 - x0) * K, (448 - y0) * K
    # fitted to the photo's box (41 px across) by the font size
    size = int(3.6 * K * 1.4)
    while True:
        f = font(AV, size, 5)
        bb = d.textbbox((cx, cy), "Temperature Setting", font=f, anchor="mm")
        if bb[2] - bb[0] <= (557 - 516) * K or size < 8:
            break
        size -= 1
    d.text((cx, cy), "Temperature Setting", font=f, fill=(58, 60, 66), anchor="mm")
    info["panel_text_px"] = [bb[2] - bb[0], (557 - 516) * K, size]
    save(crop, "panel.jpg", q=90)
    info["panel"] = {"px": [x0, y0, x1, y1], "size": crop.size}


def flap():
    # FREEZER, 95 mm wide and 18 mm tall on the flap (g02: x 315-435, rows 400-422); bold, frosted: a light grey that
    # reads on the white back wall as the photo's faint letters do, and light over food (g06)
    INK = (176, 184, 194)
    PX = 8
    w, h = 95, 18
    img = Image.new("RGBA", (w * PX + 2 * PAD, h * PX + 2 * PAD), INK + (0,))
    d = ImageDraw.Draw(img)
    size = int(h * PX * 1.3)
    f = font(ARIALB, size)
    bb = d.textbbox((0, 0), "FREEZER", font=f)
    while bb[2] - bb[0] > w * PX and size > 10:
        size -= 2
        f = font(ARIALB, size)
        bb = d.textbbox((0, 0), "FREEZER", font=f)
    tw = bb[2] - bb[0]
    sp = (w * PX - tw) / 6 if tw < w * PX / 1.18 else 0
    x = PAD + (w * PX - tw - 6 * sp) / 2 - bb[0]
    for ch in "FREEZER":
        d.text((x, PAD + h * PX / 2), ch, font=f, fill=INK + (220,), anchor="lm")
        x += d.textlength(ch, font=f) + sp
    save(img, "flap.png")
    info["flap"] = {"mm": [w, h], "padded": [img.width, img.height]}


door()
logo()
rear()
panel()
flap()
with open(os.path.join(D, "info.json"), "w") as fh:
    json.dump(info, fh, indent=1)
print("wrote info.json", info)
if DBG:
    a = Image.open(os.path.join(P, "g03_front.jpg")).convert("RGB").crop((201, 108, 1005, 1077)).resize((640, 676))
    b = Image.open(os.path.join(D, "door.jpg"))
    side = Image.new("RGB", (1290, 676), "white")
    side.paste(a.point(lambda v: min(255, v * 8)), (0, 0))
    side.paste(b.point(lambda v: min(255, v * 8)), (650, 0))
    side.save(os.path.join(DBG, "hrd752_door_x8.png"))
