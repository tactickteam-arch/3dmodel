"""Textures for the Samsung RS76CG80X0S9HL, 653 L side-by-side, Refined Inox, from Samsung India's own gallery photos of
this model code and its own energy label. Every print is a separate decal with no grain under it; the doors and sides
carry the surface grain in the builder.

usage: python3 -I tex_samsung_rs76.py <photos dir> <logos dir> <out dir> [--compare <dir>]
  photos: <photos dir>/samsung_rs76/ (Samsung India's gallery, 2052 x 1641 each)
    labelprod_554043266.jpg  the straight-on front with the BEE label on the fridge door (cabinet 588 px = 912 mm,
                             0.6447 px per mm; door tops row 239, door bottoms row 1376)
    label_554043260.jpg      this model's BEE label on its own ("Model No.: RS76CG80X0S9HL", 653 L, 590 units/yr)
    g_536089204.jpg          the rear (683 px = 912 mm, 0.749 px per mm across; top row 170, floor row 1467)
    g_536089200.jpg          the display inside the fridge (read for layout and words only; redrawn here)
    g_536089205.jpg          the open-door front (0.718 px per mm; read for the "Twin Cooling Plus" print)
  logos:  samsung.png
  writes <out dir>/samsung_rs76/:
    door_freezer.jpg, door_fridge.jpg  the Refined Inox fronts, no print: each row's colour read off the front photo (the
                                       light-to-dark fall), times GAIN, with fine vertical brushing (the 3/4 photos show
                                       vertical hairlines)
    channel.jpg                        the dark channel down the fridge door's left edge, its fall read off the front photo
    side_paint.jpg                     the dark grey painted sides (3/4 photos: 65 to 96 grey, a little blue)
    label.png                          the BEE label, die-cut, at the photo's own resolution (about 5 px per mm)
    mark.png                           the SAMSUNG wordmark in light silver, as on the fridge door's top right
    rear.jpg, bay.jpg, pcb.jpg         the dimpled back above the compressor cover, the compressor cover with its grilles, and
                                       the raised control-box cover, with the power cord and plug painted out (they are 3D)
    rear_paths.json                    the cord route, the plug, the cover's slots and the control box, in model metres
    display.png                        the inside display redrawn sharp at 7.2 px per mm
    print_twin.png                     "Twin Cooling Plus" as printed on the fridge's back wall, redrawn at 7.2 px per mm
"""
import json
import os
import site
import sys
from collections import deque

sys.path.append(site.getusersitepackages())  # PIL, numpy and cv2 live in the user's site-packages (run with -I)
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = sys.argv[sys.argv.index("--compare") + 1] if "--compare" in sys.argv else None
SRC = os.path.join(PHOTOS, "samsung_rs76")
D = os.path.join(OUT, "samsung_rs76")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(76)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"


def save(img, name, q=88):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size, os.path.getsize(p) // 1024, "KB")


def photo(name):
    return Image.open(os.path.join(SRC, name)).convert("RGB")


# ── the doors ──
# Samsung's straight-on front of this model (labelprod_554043266.jpg): the cabinet spans columns 750-1338 (912 mm), the
# door tops are row 239 and the door bottoms row 1364. The freezer door's face is columns 750-999, the fridge door's
# 1037-1338; between them the dark handle channel. The doors are 1706 mm tall in the model (40 to 1746 mm up).
FRONT = dict(top=239, bottom=1364, fz=(750, 999), fr=(1037, 1338), label_rows=(318, 490))
DOOR_MM = 1706
PX_MM = 0.9                     # texture resolution: a plain panel, the grain map carries the fine detail
# GAIN corrects for the viewer's own light, per door (tuned against straight-on renders at the photo's angle, as ratios of
# the label's white, door top to door bottom): mm from the top
GAIN_FZ = [(0, 0.82), (512, 0.807), (768, 0.81), (1024, 0.82), (1706, 0.83)]
GAIN_FR = [(0, 0.92), (340, 0.917), (512, 0.902), (768, 0.892), (1024, 0.845), (1706, 0.855)]
CH_GAIN = 1.4


def brushed_v(w, h, strength):
    """Vertical hairlines: noise that changes across the door and runs long down it."""
    n = rng.normal(0, 1, (h // 4 + 1, w))
    n = np.repeat(n, 4, axis=0)[:h]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur((0.4, 30)))
    return (np.asarray(img).astype(float) / 255 - 0.5) * 2 * strength


def doors():
    src = np.asarray(photo("labelprod_554043266.jpg")).astype(float)
    top, bottom = FRONT["top"], FRONT["bottom"]

    def rows(x0, x1, f0=0.05, f1=0.95):
        w = x1 - x0
        return src[:, int(x0 + f0 * w):int(x0 + f1 * w)].mean(1)

    fz = rows(*FRONT["fz"])
    # the fridge door: from its top down past the label (the SAMSUNG wordmark, then the label, rows to 490) only its left
    # part is free of print; scale that part by the ratio of the whole row to it just below the label
    whole, left = rows(*FRONT["fr"]), rows(*FRONT["fr"], 0.05, 0.40)
    l0, l1 = FRONT["label_rows"]
    k = (whole[l1 + 5:l1 + 25] / left[l1 + 5:l1 + 25]).mean(0)
    fr = whole.copy()
    fr[:l1 + 5] = left[:l1 + 5] * k
    def door(band, width_mm, name, gain):
        gy, gv = zip(*gain)
        w, h = round(width_mm * PX_MM), round(DOOR_MM * PX_MM)
        mm = np.clip(np.arange(h) / PX_MM, 8, DOOR_MM - 8)              # held flat 8 mm from each edge
        r = top + mm / DOOR_MM * (bottom - top)
        i = np.floor(r).astype(int)
        f = (r - i)[:, None]
        col = band[i] * (1 - f) + band[i + 1] * f
        col *= np.interp(mm, gy, gv)[:, None]
        img = np.repeat(col[:, None, :], w, axis=1) + brushed_v(w, h, 4.0)[:, :, None]
        save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), name)
        return col

    door(fz, 392, "door_freezer.jpg", GAIN_FZ)
    door(fr, 464, "door_fridge.jpg", GAIN_FR)

    # the dark channel down the fridge door's left edge (set back between the faces): its own fall on the photo, columns
    # 1010-1029 between the two dark gaps (46 grey at the top, 74 a third of the way down, 23 at the bottom), divided by
    # CH_GAIN for the viewer's light (tuned against a straight-on render)
    ch = rows(1010, 1029, 0, 1)
    h = 512
    mm = np.clip(np.arange(h) / h * DOOR_MM, 8, DOOR_MM - 8)
    r = top + mm / DOOR_MM * (bottom - top)
    i = np.floor(r).astype(int)
    f = (r - i)[:, None]
    col = (ch[i] * (1 - f) + ch[i + 1] * f) / CH_GAIN
    save(Image.fromarray(np.repeat(col[:, None, :], 16, axis=1).clip(0, 255).astype(np.uint8)), "channel.jpg", 92)


def side():
    # the sides: dark grey paint, lighter at mid-height as in the 3/4 photos (65 to 96 grey, blue a little higher)
    h, w = 768, 512
    yy = np.linspace(0, 1, h)[:, None]
    base = 74 + 18 * np.exp(-((yy - 0.5) / 0.3) ** 2) - 4 * yy
    speck = Image.fromarray(((rng.normal(0, 1, (h, w)) * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    s = (np.asarray(speck).astype(float) / 255 - 0.5) * 3.0
    img = np.stack([base + s, base + s + 1, base + s + 5], axis=2) * np.ones((1, w, 1))
    save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), "side_paint.jpg")


def label():
    # this model's own BEE label (Samsung's label image), die-cut: flood the white page from the border, stop at the
    # label's edge, trim 2 px off the edge, and keep 95 colours plus one clear index (palette PNG with tRNS)
    src = photo("label_554043260.jpg")
    a = np.asarray(src).astype(int)
    ys, xs = np.where(a.min(2) < 235)
    lab = src.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3)).convert("RGBA")
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
    qz = lab.convert("RGB").quantize(colors=95, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(qz).copy()
    idx[alpha < 128] = 95
    out = Image.frombytes("P", qz.size, idx.astype(np.uint8).tobytes())
    out.putpalette(qz.getpalette()[:95 * 3] + [255, 255, 255])
    p = os.path.join(D, "label.png")
    out.save(p, optimize=True, transparency=bytes([255] * 95 + [0]))
    print("wrote", p, out.size, os.path.getsize(p) // 1024, "KB")
    return out.size


def mark():
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    a = np.asarray(lg).astype(float)
    ys, xs = np.where(a[..., 3] > 8)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    out = np.zeros(a.shape, np.uint8)
    out[..., :3] = (226, 228, 232)          # the wordmark reads light silver on the dark door (3/4 photos)
    out[..., 3] = (a[..., 3] * 0.95).clip(0, 255).astype(np.uint8)
    save(Image.fromarray(out), "mark.png")
    return out.shape[1] / out.shape[0]


# ── the rear (g_536089204.jpg): 683 px across for 912 mm, the top row 170 at 1746 mm and the floor row 1467 ──
RX0, RX1, RTOP, RFLOOR = 684, 1367, 170, 1467
RPPM_X, RPPM_Y = (RX1 - RX0) / 912, (RFLOOR - RTOP) / 1746
RXC = (RX0 + RX1) / 2
COVER = (1275, 1455)            # the compressor cover's top and bottom rows
PCB = (1067, 200, 1334, 595)    # the raised control-box cover (left, top, right, bottom)
# the cord: out of the control box's connector, along under it, down the right edge (as seen from behind), along the
# bottom of the compressor cover to the plug parked in its clip
CORD = [(1108, 586), (1111, 597), (1130, 600), (1220, 600), (1300, 601), (1333, 607), (1347, 625), (1349, 700), (1349, 900),
        (1349, 1100), (1349, 1300), (1349, 1405), (1343, 1421), (1330, 1426), (1200, 1426), (1000, 1426), (905, 1427)]
PLUG = (877, 1437)
LEFT_SLOTS = [751, 765, 780, 794, 808, 822, 837, 851, 865, 880, 894, 909, 924, 938]   # left grille: 14 slots, 5 px wide
RIGHT_SLOTS = list(range(1095, 1311, 7))                                              # right grille: 2 px slots, 7.15 px apart
SLOT_ROWS_L = [(1305, 1340), (1345, 1380), (1385, 1420)]
SLOT_ROWS_R = [(1307, 1340), (1350, 1382), (1390, 1422)]


def to_m(x, y):
    """rear-photo pixel -> model metres (the photo is from behind, so x flips)."""
    return [round(-(x - RXC) / RPPM_X / 1000, 4), round((RFLOOR - y) / RPPM_Y / 1000, 4)]


def rear():
    src = photo("g_536089204.jpg")
    a = np.asarray(src).copy()
    mask = np.zeros(a.shape[:2], np.uint8)
    cv2.polylines(mask, [np.array(CORD, np.int32)], False, 255, 9, cv2.LINE_AA)
    cv2.rectangle(mask, (1100, 576), (1118, 600), 255, -1)                      # the connector at the control box
    cv2.rectangle(mask, (852, 1418), (902, 1468), 255, -1)                      # the plug and its pin
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    clean = cv2.inpaint(a, mask, 4, cv2.INPAINT_TELEA)
    im = Image.fromarray(clean)
    save(im.crop((RX0, RTOP, RX1, COVER[0])), "rear.jpg", 86)
    save(im.crop((RX0, COVER[0], RX1, COVER[1])).resize((RX1 - RX0, (COVER[1] - COVER[0]))), "bay.jpg", 88)
    save(im.crop(PCB).resize(((PCB[2] - PCB[0]), (PCB[3] - PCB[1]))), "pcb.jpg", 88)
    slots = []
    for xs, w, rows in [(LEFT_SLOTS, 5, SLOT_ROWS_L), (RIGHT_SLOTS, 2, SLOT_ROWS_R)]:
        for y0, y1 in rows:
            for x in xs:
                (ax, ay), (bx, by) = to_m(x - 0.5, y1), to_m(x + w - 0.5, y0)
                slots.append([min(ax, bx), ay, max(ax, bx), by])
    data = {
        "ppm": [RPPM_X, RPPM_Y],
        "cord": [to_m(*p) for p in CORD], "plug": to_m(*PLUG), "cord_d": 0.008,
        "cover": [to_m(0, COVER[1])[1], to_m(0, COVER[0])[1]],
        "pcb": [to_m(PCB[2], 0)[0], to_m(0, PCB[3])[1], to_m(PCB[0], 0)[0], to_m(0, PCB[1])[1]],
        "slots": slots,
    }
    json.dump(data, open(os.path.join(D, "rear_paths.json"), "w"), indent=1)
    print("wrote rear_paths.json:", len(slots), "slots")
    if COMPARE:
        dbg = src.copy()
        dr = ImageDraw.Draw(dbg)
        dr.line(CORD, fill=(255, 0, 0), width=2)
        dr.rectangle(PCB, outline=(0, 160, 255), width=2)
        for xs, w, rows in [(LEFT_SLOTS, 5, SLOT_ROWS_L), (RIGHT_SLOTS, 2, SLOT_ROWS_R)]:
            for y0, y1 in rows:
                for x in xs:
                    dr.rectangle((x, y0, x + w - 1, y1), outline=(0, 200, 0))
        dbg.crop((RX0 - 20, RTOP - 20, RX1 + 20, RFLOOR + 20)).save(os.path.join(COMPARE, "rear_trace.png"))
        im.crop((RX0, RTOP, RX1, RFLOOR)).save(os.path.join(COMPARE, "rear_clean.png"))


# ── sharp print: words set again in Avenir Next, fitted to the boxes measured on the photo ──
def font(px, face=7):
    return ImageFont.truetype(AVENIR, px, index=face)


def text_fit(dr, box, s, face, fill, k=1.0):
    """Set s so its ink fills box (x0, y0, x1, y1) in height, centred across it."""
    x0, y0, x1, y1 = box
    f = font(200, face)
    l, t, r, b = dr.textbbox((0, 0), s, font=f)
    sc = (y1 - y0) / (b - t) * k
    f = font(max(8, round(200 * sc)), face)
    l, t, r, b = dr.textbbox((0, 0), s, font=f)
    dr.text(((x0 + x1) / 2 - (l + r) / 2, y0 - t), s, font=f, fill=fill)
    return r - l


SEG = {"0": "abcdef", "1": "bc", "3": "abcdg", "9": "abcdfg", "-": "g"}


def seven(dr, x, y, w, h, ch, fill):
    """A seven-segment digit in its box (x, y, w, h)."""
    t = 0.17 * w
    hh = h / 2
    seg = {"a": (x + t, y, x + w - t, y + t), "g": (x + t, y + hh - t / 2, x + w - t, y + hh + t / 2), "d": (x + t, y + h - t, x + w - t, y + h),
           "f": (x, y + t, x + t, y + hh - t / 2), "b": (x + w - t, y + t, x + w, y + hh - t / 2),
           "e": (x, y + hh + t / 2, x + t, y + h - t), "c": (x + w - t, y + hh + t / 2, x + w, y + h - t)}
    for s in SEG[ch]:
        x0, y0, x1, y1 = seg[s]
        g = t * 0.12
        dr.rectangle((x0 + (g if s in "agd" else 0), y0 + (g if s in "fbec" else 0), x1 - (g if s in "agd" else 0), y1 - (g if s in "fbec" else 0)), fill=fill)


def display():
    # The display inside the fridge (Samsung's close-up g_536089200.jpg): a frosted white panel with a thin grey frame,
    # "SAMSUNG", "Freezer", -19 in ice-blue segments, "Fridge", 3, the deg C marks, a small icon, a rule and the three
    # touch keys. Boxes are fractions of the panel measured on that photo (panel 210 x 533 px there). The panel's real
    # size is ESTIMATED at 80 x 203 mm (NOTES.md); drawn at 7.2 px per mm.
    W, H = 576, 1462
    S = 3
    im = Image.new("RGBA", (W * S, H * S), (244, 246, 248, 255))
    dr = ImageDraw.Draw(im)
    fx = lambda f: f * W * S
    fy = lambda f: f * H * S
    dr.rounded_rectangle((2 * S, 2 * S, W * S - 2 * S, H * S - 2 * S), radius=10 * S * 3, outline=(206, 209, 214, 255), width=3 * S)
    ink, blue = (58, 60, 64, 255), (120, 196, 226, 255)
    # the SAMSUNG wordmark (the brand's own logotype, as on the panel), dark ink, 0.26-0.74 across, 0.032-0.052 down
    lg = Image.open(os.path.join(LOGOS, "samsung.png")).convert("RGBA")
    la = np.asarray(lg)[..., 3]
    ys, xs = np.where(la > 8)
    lg = lg.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    lw = round(fx(0.74) - fx(0.26))
    lg = lg.resize((lw, round(lw * lg.size[1] / lg.size[0])), Image.LANCZOS)
    ink_im = Image.new("RGBA", lg.size, ink)
    ink_im.putalpha(lg.getchannel("A"))
    im.alpha_composite(ink_im, (round(fx(0.26)), round(fy(0.032))))
    text_fit(dr, (fx(0.36), fy(0.090), fx(0.64), fy(0.115)), "Freezer", 5, ink)
    text_fit(dr, (fx(0.37), fy(0.297), fx(0.63), fy(0.322)), "Fridge", 5, ink)
    # -19: the minus, then two digits; deg C small to their right
    dw, dh = fx(0.10), fy(0.094)
    seven(dr, fx(0.24), fy(0.140), fx(0.095), dh, "-", blue)
    seven(dr, fx(0.445), fy(0.140), dw, dh, "1", blue)
    seven(dr, fx(0.565), fy(0.140), dw, dh, "9", blue)
    seven(dr, fx(0.565), fy(0.348), dw, dh, "3", blue)
    for yy in (0.140, 0.348):
        r = fx(0.012)
        dr.ellipse((fx(0.705) - r, fy(yy + 0.006) - r, fx(0.705) + r, fy(yy + 0.006) + r), outline=blue, width=max(2, S * 2))
        text_fit(dr, (fx(0.72), fy(yy), fx(0.80), fy(yy + 0.022)), "C", 5, blue)
    # the small icon under the fridge reading (a door with a lock, as photographed): drawn as its outline only
    ix, iy = fx(0.705), fy(0.495)
    dr.rounded_rectangle((ix, iy, ix + fx(0.055), iy + fy(0.032)), radius=S * 3, outline=blue, width=S * 2)
    dr.ellipse((ix + fx(0.03), iy + fy(0.015), ix + fx(0.07), iy + fy(0.038)), outline=blue, width=S * 2)
    # the rule and the three touch keys
    dr.rectangle((fx(0.18), fy(0.629), fx(0.82), fy(0.629) + S * 3), fill=(120, 124, 130, 255))
    ky, kh = fy(0.835), fy(0.016)
    for cx, kind in ((0.21, "<"), (0.50, "o"), (0.79, ">")):
        x = fx(cx)
        if kind == "o":
            r = kh
            dr.ellipse((x - r, ky - r, x + r, ky + r), outline=ink, width=S * 3)
        else:
            s = -1 if kind == "<" else 1
            dr.line([(x - s * kh * 0.5, ky - kh), (x + s * kh * 0.5, ky), (x - s * kh * 0.5, ky + kh)], fill=ink, width=S * 3, joint="curve")
    save(im.resize((W, H), Image.LANCZOS), "display.png")


def twin():
    # "Twin Cooling Plus" on the fridge's back wall (open-door photo g_536089205.jpg, columns 1055-1170 at row 375-392):
    # "Twin" bold, "Cooling" regular, "Plus" small and raised. Drawn at 7.2 px per mm for a print 165 mm wide (ESTIMATED,
    # the photo's 160 mm at the cabinet's front scale grown for the back wall's distance)
    S = 3
    W, H = round(165 * 7.2), round(26 * 7.2)
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    ink = (52, 54, 58, 255)
    cap = H * S * 0.62
    fb, fr = font(round(cap / 0.72), 0), font(round(cap / 0.72), 7)
    fp = font(round(cap * 0.5 / 0.72), 5)
    x, base = 0, H * S * 0.85
    for s, f, dy in (("Twin", fb, 0), (" Cooling", fr, 0), (" Plus", fp, -cap * 0.55)):
        l, t, r, b = dr.textbbox((0, 0), s, font=f, anchor="ls")
        dr.text((x, base + dy), s, font=f, fill=ink, anchor="ls")
        x += r
    a = np.asarray(im)
    xs = np.where(a[..., 3].max(0) > 0)[0]
    im = im.crop((xs.min(), 0, xs.max() + 1, H * S)).resize((W, H), Image.LANCZOS)
    save(im, "print_twin.png")


doors()
side()
lab = label()
ar = mark()
rear()
display()
twin()
json.dump({"label_px": lab, "mark_aspect": ar}, open(os.path.join(D, "sizes.json"), "w"))
