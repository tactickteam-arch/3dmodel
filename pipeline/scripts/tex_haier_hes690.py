"""Textures for the Haier HES-690GK side-by-side refrigerator (596 L), in its two colours: Graphite Black (HES-690GK) and
Shiny Silver (HES-690SS, the same body in Haier's other finish).

usage: python3 -I tex_haier_hes690.py <photos dir> <logos dir> <out dir> [--compare <dir>]
  photos: haier_hes690/haier_front.jpg     Haier's straight-on front of HES-690GK (1200 x 1200; the body is columns
                                           346-899 for its 905 mm, 0.612 px per mm; door tops row 61, floor row 1129)
          haier_hes690/haier_ss_front.jpg  Haier's straight-on front of HES-690SS (columns 338-866, 0.585 px per mm;
                                           door tops row 95)
          haier_hes690/haier_ss_display.jpg Haier's close-up of the display (the same panel on every colour)
          haier_hes690/haier_rear.jpg      Haier's rear photo of HES-690GK (columns 312-902 for 905 mm, 0.653 px per mm)
  logos:  haier.png
  writes <out dir>/haier_hes690/:
    door_freezer_gk.jpg, door_fridge_gk.jpg  the door faces, Graphite Black: Haier's photo with the wordmark painted out
                                           (it is a sharp decal) and half of the studio's fall taken out
    door_freezer_ss.jpg, door_fridge_ss.jpg  the same for Shiny Silver, with its horizontal brushing
    channel_gk.jpg, channel_ss.jpg       the step down the fridge door's left edge, below the display: the photo's own
                                           fall down that strip
    display_print.png                    every word, digit and icon on the display, set again sharp at 7.2 px per mm
    logo.png                             the Haier wordmark in white, from Haier's own logo file
    rear.jpg, rear_paths.json            the rear panel (Haier's rear photo) and the compressor bay's slots, in metres
    print_*.png                          the words Haier prints inside (DEO FRESH, MAGIC COOLING, MAGICZONE, FREEZEBOX,
                                           FRESHBOX, ICEMAKER), set again sharp

Every size here comes from the measurements in private/research/haier_hes690/NOTES.md.
"""
import json
import os
import sys

sys.path.append("/Users/apple/Library/Python/3.9/lib/python/site-packages")
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter, ImageFont  # noqa: E402

PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = sys.argv[sys.argv.index("--compare") + 1] if "--compare" in sys.argv else None
SRC = os.path.join(PHOTOS, "haier_hes690")
D = os.path.join(OUT, "haier_hes690")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(690)
AV = "/System/Library/Fonts/Avenir Next.ttc"      # faces: 0 Bold, 5 Medium, 7 Regular, 10 Ultra Light
PXMM = 7.2                                          # print resolution


def save(img, name, q=86):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", name, img.size, os.path.getsize(p) // 1024, "KB")


def photo(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(float)


# ── the doors ──
# The faces as measured on each front (columns [a, b), rows [top, bottom)); the doors are 1729 mm tall in the model
# (16 to 1745 mm up). The freezer face stops where its bright rounded edge starts; the fridge face starts after its own.
FRONTS = {
    "gk": dict(file="haier_front.jpg", fz=(348, 579), fr=(619, 898), rows=(63, 1117), logo=(823, 93, 871, 115), ch=(590, 612), dtop=372),
    "ss": dict(file="haier_ss_front.jpg", fz=(340, 557), fr=(602, 865), rows=(97, 1090), logo=(793, 125, 840, 147), ch=(576, 593), dtop=400),
}
DOOR_MM = 1729
FZ_MM, FR_MM = 384, 462            # the faces' widths
TPX = 0.9                          # texture px per mm: plain panels (the grain map carries the fine lines)
KEEP = 0.55                        # how much of the studio's fall stays in the texture (the viewer adds its own)
# SHADE per colour: the viewer's light lifts a texture; tuned on renders against Haier's photos as
# ratios to the white backdrop (NOTES.md "Brightness")
SHADE = {"gk": 0.83, "ss": 0.86}


def unlight(a, keep):
    """Divide out a quadratic fit of the log luminance over the panel, then put back `keep` of it."""
    h, w = a.shape[:2]
    lum = np.log(a.mean(2) + 4)
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(u), u, v, u * u, v * v, u * v], -1).reshape(-1, 6)
    sel = np.s_[::7]
    coef, *_ = np.linalg.lstsq(A[sel], lum.reshape(-1)[sel], rcond=None)
    fit = (A @ coef).reshape(h, w)
    m = fit.mean()
    return a * np.exp((m + keep * (fit - m)) - fit)[..., None]


def streaks(w, h, strength):
    """Horizontal brushing: noise that changes down the door and runs long across it."""
    n = rng.normal(0, 1, (h, w // 3 + 1))
    n = np.repeat(n, 3, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((25, 0.35)))
    return (np.asarray(img).astype(float) / 255 - 0.5) * 2 * strength


def doors():
    for key, F in FRONTS.items():
        src = photo(F["file"])
        # the wordmark is a sharp decal: paint it out of the photo first
        x0, y0, x1, y1 = F["logo"]
        mask = np.zeros(src.shape[:2], np.uint8)
        mask[y0:y1, x0:x1] = 255
        clean = cv2.inpaint(src.clip(0, 255).astype(np.uint8), mask, 5, cv2.INPAINT_TELEA).astype(float)
        r0, r1 = F["rows"]
        for part, (c0, c1), mm, name in (("fz", F["fz"], FZ_MM, "freezer"), ("fr", F["fr"], FR_MM, "fridge")):
            a = clean[r0:r1, c0:c1].copy()
            a[:, :2] = a[:, 2:3]; a[:, -2:] = a[:, -3:-2]          # the edge columns carry the edges' light
            a = unlight(a, KEEP) * SHADE[key]
            w, h = round(mm * TPX), round(DOOR_MM * TPX)
            img = cv2.resize(a, (w, h), interpolation=cv2.INTER_CUBIC)
            img = cv2.GaussianBlur(img, (0, 0), 1.2)                  # the photo's JPEG blocks, enlarged, would show
            img += streaks(w, h, 5.0 if key == "ss" else 1.6)[..., None]
            save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), f"door_{name}_{key}.jpg", 85)
        # the step down the fridge door's left edge, below the display: the photo's own fall down that strip
        c0, c1 = F["ch"]
        col = clean[F["dtop"]:r1, c0:c1].mean(1) * SHADE[key]
        col = cv2.GaussianBlur(col[:, None, :], (0, 0), 2)[:, 0]
        h = 512
        r = np.linspace(0, len(col) - 1, h)
        col = np.stack([np.interp(r, np.arange(len(col)), col[:, k]) for k in range(3)], 1)
        save(Image.fromarray(np.repeat(col[:, None, :], 8, axis=1).clip(0, 255).astype(np.uint8)), f"channel_{key}.jpg", 90)
        if COMPARE:
            ph = Image.open(os.path.join(SRC, F["file"])).convert("RGB")
            fz = Image.open(os.path.join(D, f"door_freezer_{key}.jpg")); fr = Image.open(os.path.join(D, f"door_fridge_{key}.jpg"))
            hh = 600
            row = [ph.crop((F["fz"][0], r0, F["fz"][1], r1)), ph.crop((F["fr"][0], r0, F["fr"][1], r1)), fz, fr]
            row = [im.resize((round(im.width * hh / im.height), hh)) for im in row]
            sheet = Image.new("RGB", (sum(im.width for im in row) + 30, hh), "white")
            x = 0
            for im in row:
                sheet.paste(im, (x, 0)); x += im.width + 10
            sheet.save(os.path.join(COMPARE, f"doors_{key}.png"))


# ── the Haier wordmark (logos/haier.png, Haier's own logo file), white as on the doors ──
def logo():
    lg = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")
    al = lg.getchannel("A")
    al = al.crop(al.getbbox())
    w = round(78 * PXMM)                     # 78 mm wide on Haier's front (48 px at 0.612 px per mm)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    out = Image.new("RGBA", al.size, (240, 242, 246, 0))
    out.putalpha(al)
    save(out, "logo.png")
    print("logo aspect", round(al.width / al.height, 3))


# ── the display: words, digits and icons set again sharp ──
# Measured on Haier's close-up (haier_ss_display.jpg): the panel's left edge is column 572 and its top row 123, at 1.68 px
# per mm. Every box below is (x0, y0, x1, y1) in mm from the panel's top left corner; the panel is 43 mm wide.
DW = 43.0


def font(px, face=7):
    return ImageFont.truetype(AV, max(6, round(px)), index=face)


def word(dr, box, s, face, fill, S):
    """Set s so its ink is as tall as the box (scaled by S px per mm), centred across the box; never stretched."""
    x0, y0, x1, y1 = [v * S for v in box]
    f = font(200, face)
    l, t, r, b = dr.textbbox((0, 0), s, font=f)
    k = (y1 - y0) / (b - t)
    if (r - l) * k > (x1 - x0):                    # too wide for its box: fit the width instead
        k = (x1 - x0) / (r - l)
    f = font(200 * k, face)
    l, t, r, b = dr.textbbox((0, 0), s, font=f)
    dr.text(((x0 + x1) / 2 - (l + r) / 2, (y0 + y1) / 2 - (t + b) / 2), s, font=f, fill=fill)


SEG = {"0": "abcdef", "1": "bc", "5": "afgcd", "8": "abcdefg", "-": "g"}


def seven(dr, x, y, w, h, ch, fill, t):
    """A seven-segment digit, box (x, y, w, h), bar width t, small gaps where the bars meet."""
    hh = h / 2
    g = t * 0.25
    seg = {"a": (x + g, y, x + w - g, y + t), "g": (x + g, y + hh - t / 2, x + w - g, y + hh + t / 2), "d": (x + g, y + h - t, x + w - g, y + h),
           "f": (x, y + g, x + t, y + hh - g), "b": (x + w - t, y + g, x + w, y + hh - g),
           "e": (x, y + hh + g, x + t, y + h - g), "c": (x + w - t, y + hh + g, x + w, y + h - g)}
    for s in SEG[ch]:
        dr.rounded_rectangle(seg[s], radius=t * 0.35, fill=fill)




# the printed part of the display, mm from the panel's top: rows 140 to 356 (the panel is 426 mm tall at its left edge)
PY0, PY1 = 140.0, 356.0


def display():
    S = PXMM * 3                                   # drawn 3 x over, then reduced
    W, H = DW, PY1 - PY0
    im = Image.new("RGBA", (round(W * S), round(H * S)), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    # digits, icons and rules lit white; the words a soft grey and the small print greyer (Haier's close-up)
    lit, word_c, small_c, dim = (248, 249, 252, 255), (204, 206, 210, 255), (168, 171, 176, 255), (120, 124, 130, 255)
    P = lambda x, y: (x * S, (y - PY0) * S)       # mm on the panel -> px
    B = lambda x0, y0, x1, y1: (x0, y0 - PY0, x1, y1 - PY0)
    st = 0.75 * S                                  # icon stroke, 0.75 mm
    # the Inverter mark (centre 24.1 x 153.0 mm, ring radius 9.6 mm): the ring solid on its left half and dotted on its
    # right, an arrow head at its top and at its bottom, a four-blade fan inside
    cx, cy, R = 24.1, 153.0, 9.6
    (px, py), r = P(cx, cy), R * S
    dr.arc((px - r, py - r, px + r, py + r), 95, 265, fill=lit, width=round(st))
    for k in range(12):
        a = np.radians(-80 + k * 14.5)
        qx, qy = px + r * np.cos(a), py + r * np.sin(a)
        d = 0.42 * S
        dr.ellipse((qx - d, qy - d, qx + d, qy + d), fill=lit)
    for ang, dirn in ((-90, 1), (90, -1)):         # arrow heads at the top (pointing right) and the bottom (pointing left)
        a = np.radians(ang)
        tx, ty = px + r * np.cos(a), py + r * np.sin(a)
        s = 1.6 * S
        dr.polygon([(tx + dirn * s, ty), (tx - dirn * s * 0.3, ty - s * 0.9), (tx - dirn * s * 0.3, ty + s * 0.9)], fill=lit)
    for k in range(4):                             # the fan: four teardrop blades round a hub
        a = np.radians(45 + 90 * k)
        pts = []
        for t in np.linspace(0, 1, 14):
            rr = 5.6 * S * t
            sw = np.radians(70) * np.sin(np.pi * t) * (1 - 0.35 * t)
            pts.append((px + rr * np.cos(a + sw * 0.5), py + rr * np.sin(a + sw * 0.5)))
        for t in np.linspace(1, 0, 14):
            rr = 5.6 * S * t
            pts.append((px + rr * np.cos(a - 0.12 * np.sin(np.pi * t)), py + rr * np.sin(a - 0.12 * np.sin(np.pi * t))))
        dr.line(pts + [pts[0]], fill=lit, width=round(st * 0.9), joint="curve")
    d = 0.9 * S
    dr.ellipse((px - d, py - d, px + d, py + d), fill=lit)
    word(dr, B(11.9, 166.9, 36.3, 171.6), "INVERTER", 2, word_c, S)
    # the fridge setting: 0 5 and the degree-C mark; its name and a rule under it
    dgw, dgh, t = 7.6, 13.0, 1.55
    seven(dr, *P(15.6, 185.8), dgw * S, dgh * S, "0", lit, t * S)
    seven(dr, *P(24.6, 185.8), dgw * S, dgh * S, "5", lit, t * S)
    for y in (191.9, 223.5):
        (dx, dy) = P(33.2, y)
        r = 0.55 * S
        dr.ellipse((dx - r, dy - r, dx + r, dy + r), outline=lit, width=round(0.3 * S))
        word(dr, B(33.6, y + 2.6, 36.2, y + 6.6), "c", 0, lit, S)
    word(dr, B(16.1, 203.2, 32.7, 207.9), "Fridge", 5, word_c, S)
    dr.rectangle((*P(14.3, 209.8), *P(34.5, 210.5)), fill=lit)
    # the freezer setting: - 1 8, its name, "3 Sec. Convert" and a rule
    seven(dr, *P(6.6, 217.3), dgw * S, dgh * S, "-", lit, t * S)
    seven(dr, *P(16.3, 217.3), dgw * S, dgh * S, "1", lit, t * S)
    seven(dr, *P(24.6, 217.3), dgw * S, dgh * S, "8", lit, t * S)
    word(dr, B(14.3, 233.4, 34.5, 238.2), "Freezer", 5, word_c, S)
    word(dr, B(15.5, 238.9, 33.3, 241.0), "3 Sec. Convert", 7, small_c, S)
    dr.rectangle((*P(14.3, 243.2), *P(34.5, 243.9)), fill=lit)
    # the holiday umbrella: a scalloped canopy, a stem with a hook (12 x 11 mm, centre 24.4 mm across)
    ux, uy = 24.4, 250.4
    (ax, ay) = P(ux, uy + 5.2)
    rr = 6.0 * S
    dr.arc((ax - rr, ay - rr, ax + rr, ay + rr), 180, 360, fill=lit, width=round(st))
    for k in range(3):
        sx = ux - 6.0 + 2.0 + k * 4.0
        (bx, by) = P(sx, uy + 5.2)
        q = 2.0 * S
        dr.arc((bx - q, by - q * 0.55, bx + q, by + q * 0.55), 180, 360, fill=lit, width=round(st * 0.8))
    dr.line([P(ux, uy + 5.2), P(ux, uy + 10.2)], fill=lit, width=round(st))
    (hx, hy) = P(ux - 0.9, uy + 10.2)
    q = 0.9 * S
    dr.arc((hx - q, hy - q, hx + q, hy + q), 0, 180, fill=lit, width=round(st))
    word(dr, B(14.9, 284.0, 32.7, 288.0), "Auto Set", 5, word_c, S)
    word(dr, B(15.5, 288.9, 33.3, 291.0), "3 Sec. Holiday", 7, small_c, S)
    dr.rectangle((*P(14.3, 294.9), *P(34.5, 295.6)), fill=lit)
    word(dr, B(13.1, 303.1, 35.1, 306.6), "Power Cool", 5, word_c, S)
    dr.rectangle((*P(14.3, 312.2), *P(34.5, 312.9)), fill=lit)
    word(dr, B(13.1, 320.3, 35.1, 324.4), "Turbo Icing", 5, word_c, S)
    dr.rectangle((*P(14.3, 329.5), *P(34.5, 330.2)), fill=lit)
    # the lock: a shackle over a body with a keyhole, 5.4 x 6 mm
    lx, ly = 24.1, 333.4
    dr.rounded_rectangle((*P(lx - 2.7, ly + 2.6), *P(lx + 2.7, ly + 6.0)), radius=0.6 * S, outline=lit, width=round(st * 0.85))
    dr.arc((*P(lx - 1.7, ly), *P(lx + 1.7, ly + 5.2)), 180, 360, fill=lit, width=round(st * 0.85))
    dr.ellipse((*P(lx - 0.45, ly + 3.8), *P(lx + 0.45, ly + 4.7)), fill=lit)
    word(dr, B(13.1, 347.1, 35.1, 351.2), "3Sec. Lock", 5, word_c, S)
    dr.rectangle((*P(14.3, 352.8), *P(34.5, 353.3)), fill=dim)
    save(im.resize((round(W * PXMM), round(H * PXMM)), Image.LANCZOS), "display_print.png")


# ── the back: Haier's rear photo of this model on the rear panel; the compressor bay's slots found on the photo ──
RX0, RX1, RTOP, RBOT = 312, 902, 50, 1166          # the body (905 mm; the cabinet's top, 1735 mm, to its bottom, 30 mm)
RPPM = (RX1 - RX0) / 905
RXC = (RX0 + RX1) / 2
BAY = 992                                          # the bay cover's top edge
Y_TOP, Y_BOT = 1.735, 0.030


def to_m(x, y):
    """rear-photo pixel -> model metres (the photo is from behind, so x flips)."""
    return [round(-(x - RXC) / RPPM / 1000, 4), round(Y_BOT + (RBOT - y) / (RBOT - RTOP) * (Y_TOP - Y_BOT), 4)]


def rear():
    src = Image.open(os.path.join(SRC, "haier_rear.jpg")).convert("RGB")
    a = np.asarray(src)
    save(src.crop((RX0, RTOP, RX1, BAY)), "rear.jpg", 84)
    save(src.crop((RX0, BAY, RX1, RBOT)), "bay.jpg", 88)
    # the slots: dark connected runs in the bay cover, elongated, at least 10 px
    L = a[BAY + 6:RBOT - 16, RX0 + 6:RX1 - 6].mean(2)          # the body's own bottom edge is dark: left out
    n, lab, stats, _ = cv2.connectedComponentsWithStats((L < 75).astype(np.uint8), 8)
    slots = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 10 or max(w, h) < 8 or min(w, h) > 6:
            continue
        x += RX0 + 6; y += BAY + 6
        (ax, ay), (bx, by) = to_m(x - 0.5, y + h - 0.5), to_m(x + w - 0.5, y - 0.5)
        slots.append([min(ax, bx), ay, max(ax, bx), by])
    data = {"ppm": RPPM, "bay": [to_m(0, RBOT)[1], to_m(0, BAY)[1]], "slots": slots,
            "topbox": [to_m(654, 0)[0], to_m(412, 0)[0]], "cord_exit": to_m(592, 0)[0], "cord_far": to_m(557, 0)[0]}
    json.dump(data, open(os.path.join(D, "rear_paths.json"), "w"), indent=1)
    print("rear_paths.json:", len(slots), "slots")
    if COMPARE:
        dbg = src.copy()
        dr = ImageDraw.Draw(dbg)
        for i in range(1, n):
            x, y, w, h, area = stats[i]
            if area < 10 or max(w, h) < 8 or min(w, h) > 6:
                continue
            dr.rectangle((x + RX0 + 6, y + BAY + 6, x + RX0 + 6 + w - 1, y + BAY + 6 + h - 1), outline=(255, 0, 0))
        dbg.crop((RX0 - 10, BAY - 10, RX1 + 10, RBOT + 10)).save(os.path.join(COMPARE, "rear_slots.png"))


# ── the words Haier prints inside, set again sharp (Avenir Next, the closest face on this Mac to Haier's geometric sans) ──
def two_weight(parts, cap_mm, name, pad=0.6, bar=None):
    """Words in two weights on one line; parts = [(text, face, rgba)], cap height cap_mm. bar = rgba draws a black bar."""
    S = PXMM * 3
    f0 = font(200, 0)
    probe = ImageDraw.Draw(Image.new("L", (10, 10)))
    l, t, r, b = probe.textbbox((0, 0), "H", font=f0)
    k = cap_mm * S / (b - t)
    fonts = [font(200 * k, face) for _, face, _ in parts]
    widths = [probe.textlength(s, font=f) for (s, _, _), f in zip(parts, fonts)]
    tw = sum(widths)
    ph = round((cap_mm * (bar and 2.2 or 1.6)) * S)
    pw = round(tw + (bar and 8 * S or pad * 2 * S))
    im = Image.new("RGBA", (pw, ph), bar or (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    x = (pw - tw) / 2
    for (s, face, col), f, w in zip(parts, fonts, widths):
        l, t, r, b = dr.textbbox((0, 0), "H", font=f)
        dr.text((x, ph / 2 - (t + b) / 2), s, font=f, fill=col)
        x += w
    out = im.resize((max(1, round(pw / 3)), max(1, round(ph / 3))), Image.LANCZOS)
    save(out, name)
    print(name, "mm", round(out.width / PXMM, 1), "x", round(out.height / PXMM, 1))


def prints():
    W, G1, G2 = (250, 251, 253, 255), (104, 108, 114, 255), (170, 174, 180, 255)
    # the lit bars at the top of each back wall: white words on black (Haier's close-ups of the fridge and the freezer)
    two_weight([("DEO ", 0, W), ("FRESH", 7, W)], 6.0, "print_deofresh.png", bar=(14, 14, 16, 255))
    two_weight([("MAGIC ", 0, W), ("COOLING", 7, W)], 6.0, "print_magiccooling_bar.png", bar=(14, 14, 16, 255))
    # grey words on the back walls and the drawers (open-door photo); the small print after them can't be read: left out
    two_weight([("MAGIC", 0, G1), ("ZONE", 10, G2)], 9.0, "print_magiczone.png")
    two_weight([("MAGIC ", 0, G1), ("COOLING", 10, G2)], 9.0, "print_magiccooling.png")
    two_weight([("FREEZE", 0, G1), ("BOX", 10, G2)], 9.0, "print_freezebox.png")
    two_weight([("FRESH", 0, G1), ("BOX", 10, G2)], 9.0, "print_freshbox.png")
    two_weight([("ICEMAKER", 2, (120, 124, 130, 255))], 3.2, "print_icemaker.png")


doors()
logo()
display()
rear()
prints()
