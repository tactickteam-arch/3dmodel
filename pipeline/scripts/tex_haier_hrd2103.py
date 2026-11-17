"""Textures for the Haier HRD-2103PMG-P, 190 L 3 star direct-cool single door with the base drawer, in the two colours of
this body that Sangeetha's item master lists: Mirror Glass (HRD-2103PMG-P, the listed one) and Wave Glass (HRD-2103PWG-P).

usage: python3 tex_haier_hrd2103.py <photos dir> <logos dir> <out dir> [--debug <scratch dir>]
  photos (pipeline/sources/photos/haier_hrd2103/, Haier India's own galleries, 1200 x 1200):
    pmg_g01_front.jpg     Mirror Glass, closed, straight on: the body x 421-775 for its 530 mm (0.670 px per mm), rows
                          159-1037 (1313 mm); the door rows 160-943 (its foot 140 mm up), the drawer's dark slot 943-966,
                          the drawer front 966-1037; the Haier mark x 583-624, rows 211-222
    pmg_g05_rear.jpg      the back straight on: the cabinet x 414-773 (0.679 px per mm), the embossed back rows 157-785,
                          the open compressor bay 785-955, the stand under it to row 1039
    pwg_g03.jpg           Wave Glass from the left: the door's glass face is the quad (488,154) (812,167) (812,922) (488,931)
                          (its front straight on is served only at 350 px, too soft; this view is 2.3 x sharper)
    pwg_g04.jpg           Wave Glass open, empty: FREEZEZONE on the freezer flap x 409-497, rows 254-269
  logos: haier.png (Haier's own wordmark)
  writes <out dir>/haier_hrd2103/:
    door_mirror_glass.jpg   the Mirror Glass door's colour under its glass (530 x 1173 mm): each row's colour read off the
                            front over the 20% darkest of its columns (the studio's diagonal light band is a reflection the
                            viewer's light makes again, so it is left out), smoothed; no print (the mark is a decal)
    door_wave_glass.jpg     the Wave Glass door's print: pwg_g03's glass face warped straight, the photo's reflection
                            veil taken off (a smooth floor under the print's black, subtracted), the Haier mark painted out
    logo.png                the Haier wordmark in the fronts' white ink (its pixels at 90% or more of the box's brightest)
    rear.jpg, bay.jpg       the embossed back and the open bay with the compressor, the evaporation tray and the wiring
    flap.png                FREEZEZONE and its snowflake box, moulded into the frosted flap, set again sharp
    colours.json            each colour's measured colours (sides, stand, drawer front, door edge) for the builder
"""
import json
import os
import site
import sys

site.addsitedir(os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
DBG = sys.argv[sys.argv.index("--debug") + 1] if "--debug" in sys.argv else None
SLUG = "haier_hrd2103"
P = os.path.join(PHOTOS, SLUG)
D = os.path.join(OUT, SLUG)
os.makedirs(D, exist_ok=True)
AV = "/System/Library/Fonts/Avenir Next.ttc"
PAD = 10
info = {}

# door: 530 x 1173 mm at 1.2 px per mm
DW, DH = 636, 1408
# the viewer's light lifts a texture about 25%; each colour's own shade, tuned on the gate's renders against Haier's photos
SHADE = {"mirror_glass": 0.86, "wave_glass": 1.0}


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True, subsampling=0)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def load(name):
    return np.asarray(Image.open(os.path.join(P, name)).convert("RGB")).astype(float)


def door_mirror():
    a = load("pmg_g01_front.jpg")
    rows = []
    for y in range(161, 942):
        r = a[y, 428:768]
        lum = r.mean(1)
        k = lum <= np.percentile(lum, 20)
        rows.append(r[k].mean(0))
    rows = np.array(rows)
    sm = cv2.GaussianBlur(rows[:, None, :].astype(np.float32), (1, 0), 12)[:, 0, :]
    col = np.stack([np.interp(np.linspace(0, len(sm) - 1, DH), np.arange(len(sm)), sm[:, c]) for c in range(3)], 1)
    img = np.repeat(col[:, None, :], DW, axis=1) * SHADE["mirror_glass"]
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "door_mirror_glass.jpg", q=90)
    info["mirror_door_rgb"] = {"top": rows[:20].mean(0).round(1).tolist(), "mid": rows[380:400].mean(0).round(1).tolist(), "foot": rows[-20:].mean(0).round(1).tolist()}


def door_wave():
    src = cv2.cvtColor(cv2.imread(os.path.join(P, "pwg_g03.jpg")), cv2.COLOR_BGR2RGB)
    # the photo has a faint horizontal stitch line across the whole picture: find it on the plain cabinet side and paint it
    # out before warping (a row much brighter or darker than the rows round it, over the side at x 400-470)
    side = src[:, 400:470].astype(float).mean((1, 2))
    loc = cv2.GaussianBlur(side[:, None].astype(np.float32), (1, 0), 6).ravel()
    bad = [y for y in range(300, 900) if abs(side[y] - loc[y]) > 6]
    info["wave_stitch_rows"] = bad
    if bad:
        m = np.zeros(src.shape[:2], np.uint8)
        for y in bad:
            m[y - 1:y + 2, 480:820] = 255
        src = cv2.inpaint(src, m, 3, cv2.INPAINT_TELEA)
    q = np.float32([[488, 154], [812, 167], [812, 922], [488, 931]])
    k = 2  # warp at twice the size, then reduce (INTER_AREA)
    dst = np.float32([[0, 0], [DW * k, 0], [DW * k, DH * k], [0, DH * k]])
    M = cv2.getPerspectiveTransform(q, dst)
    w = cv2.warpPerspective(src, M, (DW * k, DH * k), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    w = cv2.resize(w, (DW, DH), interpolation=cv2.INTER_AREA).astype(float)
    # the reflection veil: the studio's diagonal band laid over the print. Its sharp left edge runs straight up the door,
    # fitted to the rows where it crosses black: (560, 120), (490, 280), (262, 800), (87, 1200) px; from it the veil fades out over 180 px to
    # the right. How strong it is changes along its length, so each row's strength is read where the print is black: the
    # 30th percentile of (darkest channel - the print's black) / the fade, smoothed down the door and held to 70.
    mn = w.min(2)
    black = float(np.percentile(mn, 10))
    xe = lambda y: 612.5 - 0.4375 * y  # noqa: E731
    WD = 180.0
    yy, xx = np.mgrid[0:DH, 0:DW]
    t = (xx - np.vectorize(xe)(yy)) / WD
    g = np.where((t >= 0) & (t <= 1), (1 - t) ** 1.5, 0.0)
    A = np.zeros(DH)
    for y in range(DH):
        k = g[y] > 0.25
        if k.sum() > 8:
            A[y] = np.percentile((mn[y, k] - black) / g[y, k], 30)
    A = np.clip(cv2.GaussianBlur(A[:, None].astype(np.float32), (1, 0), 25).ravel(), 0, 70)
    v = (A[:, None] * g)[..., None]
    out = (w - v) / np.clip(1 - v / 255, 0.6, 1)
    # the band's edge itself is a thin bright line: the 9 px along it are painted in from either side
    edge = (np.abs(xx - np.vectorize(xe)(yy)) <= 4.5).astype(np.uint8) * 255
    out = cv2.inpaint(out.clip(0, 255).astype(np.uint8), edge, 4, cv2.INPAINT_TELEA).astype(float)
    info["wave_band"] = {"edge": "x = 612.5 - 0.4375 y", "fade_px": WD, "strength": [round(float(A.min()), 1), round(float(np.median(A)), 1), round(float(A.max()), 1)]}
    # the glass's bright left edge (the bevel the 3D edge draws again): its first 10 px take the 11th's colour
    out[:, :10] = out[:, 10:11]
    # the Haier mark painted out (it is a decal): its white ink in the band 70-95 mm under the top
    y0, y1, x0, x1 = int(0.060 / 1.173 * DH), int(0.105 / 1.173 * DH), int(0.3 * DW), int(0.7 * DW)
    band = out[y0:y1, x0:x1]
    mk = (band.min(2) > 120).astype(np.uint8) * 255
    mk = cv2.dilate(mk, np.ones((5, 5), np.uint8))
    full = np.zeros(out.shape[:2], np.uint8)
    full[y0:y1, x0:x1] = mk
    ys, xs = np.where(mk > 0)
    if len(ys):
        info["wave_mark_box_mm"] = [round((x0 + xs.min()) / DW * 530 - 265, 1), round((x0 + xs.max()) / DW * 530 - 265, 1),
                                    round((y0 + ys.min()) / DH * 1173, 1), round((y0 + ys.max()) / DH * 1173, 1)]
    info["wave_mark_px"] = int((mk > 0).sum())
    out = cv2.inpaint(out.clip(0, 255).astype(np.uint8), full, 5, cv2.INPAINT_TELEA).astype(float)
    # the glass's rounded top corners and its edge: the photo's white ground round them filled with the print's black
    out = out * SHADE["wave_glass"]
    save(Image.fromarray(out.clip(0, 255).astype(np.uint8)), "door_wave_glass.jpg", q=90)
    info["wave_veil"] = [round(float(v.min()), 1), round(float(v.max()), 1)]
    if DBG:
        Image.fromarray(w.clip(0, 255).astype(np.uint8)).save(os.path.join(DBG, "wave_warp_raw.jpg"))


def logo():
    a = load("pmg_g01_front.jpg")
    box = a[208:225, 580:628].reshape(-1, 3)
    lum = box.mean(1)
    ink = tuple(int(round(v)) for v in box[lum >= 0.9 * lum.max()].mean(0))
    lg = np.asarray(Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")).astype(float)
    out = np.zeros(lg.shape, np.uint8)
    out[..., :3] = ink
    out[..., 3] = (lg[..., 3] * 0.97).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out)
    im = im.crop(im.getchannel("A").getbbox())
    pad = Image.new("RGBA", (im.width + 2 * PAD, im.height + 2 * PAD), ink + (0,))
    pad.paste(im, (PAD, PAD))
    save(pad, "logo.png")
    info["logo"] = {"ink": ink, "padded": [pad.width, pad.height], "inner": [im.width, im.height]}


def rear():
    src = Image.open(os.path.join(P, "pmg_g05_rear.jpg")).convert("RGB")
    save(src.crop((414, 157, 774, 786)).resize((540, 944), Image.LANCZOS), "rear.jpg", q=86)
    save(src.crop((414, 786, 774, 956)).resize((720, 340), Image.LANCZOS), "bay.jpg", q=86)


def flap():
    # pwg_g04 (0.65 px per mm on the flap, 0.97 of the opening's scale): the box x 409-427, rows 254-269 (27 x 23 mm); FREEZE
    # x 431-468 and ZONE x 468-497, caps rows 255-264 (14 mm tall); FREEZE darker than ZONE (two greys on the frosted flap)
    PX = 8
    mmpx = 1 / (0.67 * 0.97)
    W_mm, H_mm = (497 - 409) * mmpx, (269 - 254) * mmpx
    img = Image.new("RGBA", (int(W_mm * PX) + 2 * PAD, int(H_mm * PX) + 2 * PAD), (150, 156, 164, 0))
    d = ImageDraw.Draw(img)
    X = lambda px: PAD + (px - 409) * mmpx * PX  # noqa: E731
    Y = lambda py: PAD + (py - 254) * mmpx * PX  # noqa: E731
    dark, light = (120, 126, 134, 235), (150, 156, 164, 200)
    lw = max(2, int(1.2 * PX))
    d.rounded_rectangle([X(409), Y(254), X(427), Y(269)], radius=int(4 * PX), outline=dark, width=lw)
    cx, cy, r = (X(409) + X(427)) / 2, (Y(254) + Y(269)) / 2, (X(427) - X(409)) * 0.28
    for i in range(6):  # the snowflake: six arms of dots round a middle dot
        ang = np.pi / 2 + i * np.pi / 3
        for t in (0.45, 0.85):
            px, py = cx + r * t * np.cos(ang), cy - r * t * np.sin(ang)
            rr = 0.9 * PX
            d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=dark)
    d.ellipse([cx - 1.2 * PX, cy - 1.2 * PX, cx + 1.2 * PX, cy + 1.2 * PX], fill=dark)
    cap = (264 - 255) * mmpx * PX

    def word(t, x0, x1, fill):
        size = int(cap * 1.4)
        while True:
            f = ImageFont.truetype(AV, size, index=5)
            bb = d.textbbox((0, 0), t, font=f)
            if (bb[3] - bb[1] <= cap * 1.02 and bb[2] - bb[0] <= X(x1) - X(x0)) or size < 8:
                break
            size -= 1
        tw = bb[2] - bb[0]
        sp = ((X(x1) - X(x0)) - tw) / (len(t) - 1) if (X(x1) - X(x0)) > tw * 1.02 else 0
        x = X(x0) - bb[0]
        for ch in t:
            d.text((x, Y(255) - bb[1]), ch, font=f, fill=fill)
            x += d.textlength(ch, font=f) + sp
        return size, tw
    info["flap_words"] = [word("FREEZE", 431, 468, dark), word("ZONE", 468.5, 497, light)]
    save(img, "flap.png")
    info["flap"] = {"mm": [round(W_mm, 1), round(H_mm, 1)], "padded": [img.width, img.height], "pad": PAD, "px_per_mm": PX}


def colours():
    a = load("pmg_g01_front.jpg")
    b = load("pmg_g03_34left.jpg")
    c = load("pwg_g03.jpg")
    med = lambda arr: [int(v) for v in np.median(arr.reshape(-1, 3), 0)]  # noqa: E731
    C = {
        "mirror_glass": {"side": med(b[300:800, 380:470]), "stand": med(b[960:1010, 410:470]), "drawer": med(a[970:1000, 430:765]),
                          "edge": med(b[300:800, 492:512])},
        "wave_glass": {"side": med(c[300:800, 400:470]), "stand": med(c[960:1000, 420:470]), "drawer": med(c[960:1010, 520:780]),
                        "edge": med(c[300:800, 470:484])},
    }
    info["colours"] = C


door_mirror()
door_wave()
logo()
rear()
flap()
colours()
json.dump(info, open(os.path.join(D, "colours.json"), "w"), indent=1)
print(json.dumps(info, indent=1)[:1500])
