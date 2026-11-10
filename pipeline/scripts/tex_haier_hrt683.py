"""Textures for the Haier HRT-683GKU1, a 598 L three-door side-by-side refrigerator (the convertible Magic Zone at the top
left, the freezer under it, the fridge on the right), in the five colours Haier India sells this body in:
  gk   HRT-683GKU1  Graphite Black (PCM)      the listed colour
  is   HRT-683ISU1  Inox Steel
  kg   HRT-683KGU1  Black Glass
  gog  HRT-683GOGU1 Grey Onyx Glass (Vogue)   the Magic Zone door a grey blue, the other two a dark navy
  pwg  HRT-683PWGU1 Pearl White Glass (Vogue)

usage: python3 -I tex_haier_hrt683.py <photos dir> <logos dir> <out dir> [--compare <dir>]
  photos: haier_hrt683/<colour>_front.jpg  Haier's straight-on front of each colour (Haier India's galleries)
          haier_hrt683/gk_rear.jpg         Haier's rear photo (HRT-683GKU1)
  logos:  haier.png
  writes <out dir>/haier_hrt683/:
    door_zone_<c>.jpg, door_freezer_<c>.jpg, door_fridge_<c>.jpg   the door faces of the photo finishes (gk, is): Haier's
                                     photo with the wordmark and badge painted out, part of the studio's light taken out
    channel_<c>.jpg                  the step down the fridge door's left edge (the black strip and the chrome recess
                                     handle under the display), Haier's own photo of each colour
    finishes.json                    each colour's measured door, side and edge colours (as a ratio of the backdrop)
    display_print.png                every word on the display, set again sharp at 7.2 px per mm
    logo.png, logo_grey.png          the Haier wordmark (white; light grey on Pearl White), from Haier's own logo file
    badge_light.png, badge_dark.png, badge_plate.png   MAGICCONVERTIBLE: white print, grey print, the Inox Steel plate
    rear.jpg, bay.jpg, rear_paths.json   the rear panel and compressor bay (Haier's rear photo) and the bay's slots
    print_*.png                      the words Haier prints inside (MAGIC COOLING, DEO FRESH, MAGICZONE, FRESHBOX,
                                     FREEZEBOX, ICEPLUS), set again sharp

Every size here is measured in private/research/haier_hrt683/NOTES.md.
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
SRC = os.path.join(PHOTOS, "haier_hrt683")
D = os.path.join(OUT, "haier_hrt683")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(683)
AV = "/System/Library/Fonts/Avenir Next.ttc"      # faces: 0 Bold, 2 Demi Bold, 5 Medium, 7 Regular, 10 Ultra Light
PXMM = 7.2

# ── the body on the fronts, in mm: x from the middle, y from the floor (gk_front.jpg at 0.611 px per mm) ──
W_MM, Y0, Y1 = 905.0, 29.0, 1766.0        # the doors run 29 to 1766 mm up
SPLIT = (812.0, 822.0)                     # the freezer door's top, the Magic Zone door's bottom
LFACE = -80.0                              # the left doors' faces end here; a bright edge from here to -71
STEP = (-69.5, -10.0)                      # the fridge door's step: a black strip, the display and the chrome channel
FRFACE = 1.5                               # the fridge door's face starts here (a bright strip from -10)
LOGO = (332.0, 391.0, 1687.5, 1707.0)      # the wordmark on the fridge door (x0, x1, y0, y1)
BADGE = (-436.0, -296.0, 826.0, 856.0)     # where MAGICCONVERTIBLE sits on the Magic Zone door (painted out)
FRONTS = {
    "gk": "gk_front.jpg", "is": "is_front.jpg", "kg": "kg_front.jpg", "gog": "gog_front.jpg", "pwg": "pwg_front.jpg",
}
PHOTO_FACES = {"gk", "is"}                 # textured from the photo; the glass colours are flat (their gloss is a clear coat)
TPX = 0.9                                  # texture px per mm on the plain faces (the grain map carries the fine lines)
# how much of the studio's light stays in the texture (the viewer adds its own); Inox keeps its polished bands
KEEP = {"gk": 0.55, "is": 0.85}
# SHADE: the viewer's light lifts a texture (BENCHMARK 10, 12); tuned on renders as ratios to the backdrop (NOTES.md)
SHADE = {"gk": 0.90, "is": 0.76}
# Inox Steel: the three faces' means differ by the studio (upper left 200, the others 112-118 on is_front.jpg): each face is
# levelled to the steel's own grey (the 3/4 photo's door, 131) before its bands go back in
LEVEL = {"is": 128.0}


def save(img, name, q=86):
    p = os.path.join(D, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", name, img.size, os.path.getsize(p) // 1024, "KB")


def frame(a):
    """The body's columns and the doors' top and bottom rows on a straight front (white backdrop)."""
    L = a.mean(2)[3:-3, 3:-3]
    h, w = L.shape
    thr = 252 if L[h // 2].min() > 200 else 245
    c = np.where(L[int(h * 0.45)] < thr)[0]
    c0, c1 = c.min() + 3, c.max() + 3
    r = np.where(L[:, int(c.min() + (c.max() - c.min()) * 0.8)] < thr)[0]
    return c0, c1 + 1, r.min() + 3, r.max() + 3


class Map:
    """mm on the front <-> px on one photo."""
    def __init__(self, a):
        self.c0, self.c1, self.t, self.b = frame(a)
        self.kx = (self.c1 - self.c0) / W_MM
        self.ky = (self.b - self.t) / (Y1 - Y0)

    def x(self, mm):
        return self.c0 + (mm + W_MM / 2) * self.kx

    def y(self, mm):
        return self.t + (Y1 - mm) * self.ky

    def box(self, x0, x1, y0, y1):
        return int(round(self.x(x0))), int(round(self.y(y1))), int(round(self.x(x1))), int(round(self.y(y0)))


def unlight(a, keep):
    """Divide out a quadratic fit of the log luminance over the panel, then put back `keep` of it."""
    h, w = a.shape[:2]
    lum = np.log(a.mean(2) + 4)
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(u), u, v, u * u, v * v, u * v], -1).reshape(-1, 6)
    coef, *_ = np.linalg.lstsq(A[::7], lum.reshape(-1)[::7], rcond=None)
    fit = (A @ coef).reshape(h, w)
    m = fit.mean()
    return a * np.exp((m + keep * (fit - m)) - fit)[..., None]


def streaks(w, h, strength):
    """Horizontal brushing: noise that changes down the door and runs long across it."""
    n = rng.normal(0, 1, (h, w // 3 + 1))
    n = np.repeat(n, 3, axis=1)[:, :w]
    img = Image.fromarray(((n * 0.5 + 0.5).clip(0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur((25, 0.35)))
    return (np.asarray(img).astype(float) / 255 - 0.5) * 2 * strength


def stat(a, box):
    x0, y0, x1, y1 = box
    px = a[y0:y1, x0:x1].reshape(-1, 3)
    return [round(float(v), 1) for v in np.median(px, 0)], [round(float(v), 1) for v in np.percentile(px.mean(1), [10, 50, 90])]


def fronts():
    info = {}
    for key, f in FRONTS.items():
        a = np.asarray(Image.open(os.path.join(SRC, f)).convert("RGB")).astype(float)
        M = Map(a)
        print(key, "body cols", M.c0, M.c1, "door rows", M.t, M.b, "px/mm", round(M.kx, 4), round(M.ky, 4))
        # paint out the wordmark (a sharp decal) and MAGICCONVERTIBLE (its own decal) before anything is taken off the photo
        mask = np.zeros(a.shape[:2], np.uint8)
        for (x0, x1, y0, y1), pad in ((LOGO, 7), (BADGE, 3)):
            bx0, by0, bx1, by1 = M.box(x0 - pad, x1 + pad, y0 - pad, y1 + pad)
            mask[by0:by1, bx0:bx1] = 255
        clean = cv2.inpaint(a.clip(0, 255).astype(np.uint8), mask, 9, cv2.INPAINT_TELEA).astype(float)
        faces = {"zone": (-W_MM / 2, LFACE, SPLIT[1], Y1), "freezer": (-W_MM / 2, LFACE, Y0, SPLIT[0]), "fridge": (FRFACE, W_MM / 2, Y0, Y1)}
        rec = {}
        for name, (x0, x1, y0, y1) in faces.items():
            bx0, by0, bx1, by1 = M.box(x0, x1, y0, y1)
            # the inner 12 mm of each side carry the doors' rounded edges and the gaps: kept out of the colour measurement
            ix, iy = int(12 * M.kx), int(12 * M.ky)
            rec[name] = stat(clean, (bx0 + ix, by0 + iy, bx1 - ix, by1 - iy))
            if key in PHOTO_FACES:
                p = clean[by0:by1, bx0:bx1].copy()
                p[:, :2] = p[:, 2:3]; p[:, -2:] = p[:, -3:-2]; p[:2] = p[2:3]; p[-2:] = p[-3:-2]
                p = unlight(p, KEEP[key])
                if key in LEVEL:
                    p *= LEVEL[key] / p.mean()
                p *= SHADE[key]
                w, h = round((x1 - x0) * TPX), round((y1 - y0) * TPX)
                img = cv2.resize(p, (w, h), interpolation=cv2.INTER_CUBIC)
                img = cv2.GaussianBlur(img, (0, 0), 1.0)
                img += streaks(w, h, 4.0 if key == "is" else 1.2)[..., None]
                save(Image.fromarray(img.clip(0, 255).astype(np.uint8)), f"door_{name}_{key}.jpg", 85)
        # the step: its own photo strip, the display's dark glass at its top included (the display mesh covers that part)
        bx0, by0, bx1, by1 = M.box(STEP[0], STEP[1], Y0, Y1)
        st = cv2.resize(a[by0:by1, bx0:bx1], (64, 1024), interpolation=cv2.INTER_AREA if (by1 - by0) > 1024 else cv2.INTER_CUBIC)
        # the photo's white backdrop shows in the notch at the step's top left (Haier's photos: the backdrop seen past the
        # doors' top); on the model the cabinet is there, so each such column takes the strip's colour just below it
        top = st[:48].mean(2)
        for x in range(st.shape[1]):
            white = np.where(top[:, x] > 150)[0]
            if len(white) and white[0] < 4:
                y1 = white[-1] + 1
                st[:y1 + 2, x] = np.median(st[y1 + 3:y1 + 15, x], axis=0)
        st = cv2.GaussianBlur(st, (0, 0), 0.6)
        save(Image.fromarray(st.clip(0, 255).astype(np.uint8)), f"channel_{key}.jpg", 90)
        # the left doors' bright edge, the strip on the fridge face's corner
        rec["edge"] = stat(a, M.box(LFACE + 1.5, -72.5, 300, 700))
        rec["strip"] = stat(a, M.box(-8.0, -1.0, 300, 700))
        info[key] = {"faces": rec, "px_per_mm": [round(M.kx, 4), round(M.ky, 4)]}
        if COMPARE and key in PHOTO_FACES:
            ph = Image.open(os.path.join(SRC, f)).convert("RGB")
            row = [ph.crop(M.box(*faces["zone"])), Image.open(os.path.join(D, f"door_zone_{key}.jpg")),
                   ph.crop(M.box(*faces["fridge"])), Image.open(os.path.join(D, f"door_fridge_{key}.jpg"))]
            hh = 600
            row = [im.resize((max(1, round(im.width * hh / im.height)), hh)) for im in row]
            sheet = Image.new("RGB", (sum(im.width for im in row) + 40, hh), "white")
            x = 0
            for im in row:
                sheet.paste(im, (x, 0)); x += im.width + 10
            sheet.save(os.path.join(COMPARE, f"doors_{key}.png"))
    return info


def sides(info):
    """The cabinet's sides on Haier's three-quarter photos (the panel facing the camera, clear of its edges)."""
    for key, f, box in (("gk", "gk_34right.jpg", (860, 400, 900, 900)), ("is", "is_34right.jpg", (335, 150, 360, 350)),
                        ("kg", "kg_34right.jpg", (335, 150, 360, 350)), ("gog", "gog_34right.jpg", (830, 400, 880, 900)),
                        ("pwg", "pwg_34right.jpg", (860, 400, 900, 900))):
        a = np.asarray(Image.open(os.path.join(SRC, f)).convert("RGB")).astype(float)
        info[key]["side"] = stat(a, box)


# ── the Haier wordmark (logos/haier.png, Haier's own logo file) ──
def logo():
    lg = Image.open(os.path.join(LOGOS, "haier.png")).convert("RGBA")
    al = lg.getchannel("A")
    al = al.crop(al.getbbox())
    w = round((LOGO[1] - LOGO[0]) * PXMM)
    al = al.resize((w, round(al.height * w / al.width)), Image.LANCZOS)
    for name, col in (("logo.png", (240, 242, 246, 0)), ("logo_grey.png", (160, 163, 168, 0))):
        out = Image.new("RGBA", al.size, col)
        out.putalpha(al)
        save(out, name)
    print("logo aspect", round(al.width / al.height, 3))


def font(px, face=7):
    return ImageFont.truetype(AV, max(6, round(px)), index=face)


def word(dr, box, s, face, fill, S):
    """Set s so its ink is as tall as the box (scaled by S px per mm), centred across the box; never stretched."""
    x0, y0, x1, y1 = [v * S for v in box]
    f = font(200, face)
    l, t, r, b = dr.textbbox((0, 0), s, font=f)
    k = (y1 - y0) / (b - t)
    if (r - l) * k > (x1 - x0):
        k = (x1 - x0) / (r - l)
    f = font(200 * k, face)
    l, t, r, b = dr.textbbox((0, 0), s, font=f)
    dr.text(((x0 + x1) / 2 - (l + r) / 2, (y0 + y1) / 2 - (t + b) / 2), s, font=f, fill=fill)


# ── the display: the words and rules on HRT-683GKU1's black glass (gk_front.jpg, the display off) ──
# mm across from the display's left edge (-56 mm) and down from the door's top (1766 mm). Rows on the photo (0.611 px per
# mm, door top row 60): Fridge 133, Freezer 154, Magic Zone 174, Auto Set 205, Power Cool 220, Turbo Icing 232, 3Sec. Lock
# 248; each word centred 34 mm left of the middle (column 579), a thin rule under each group. The tiny second lines under
# Magic Zone and Auto Set can't be read on any of Haier's photos of this model: left out (NOTES.md).
DW, DH = 46.0, 330.0


def display():
    S = PXMM * 3
    im = Image.new("RGBA", (round(DW * S), round(DH * S)), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    word_c, rule_c = (214, 216, 220, 255), (150, 154, 160, 255)
    cx = 22.0                                       # the words' middle, mm from the display's left edge
    rows = {"Fridge": 133, "Freezer": 154, "Magic Zone": 174, "Auto Set": 205, "Power Cool": 220, "Turbo Icing": 232, "3Sec. Lock": 248}
    for s, r in rows.items():
        y = (r - 60) / 0.6114                       # mm down from the door's top
        w = 4.2 * len(s) * 0.62 + 4
        word(dr, (cx - w / 2, y - 2.0, cx + w / 2, y + 2.0), s, 5, word_c, S)
        # a thin rule under each word (the photo shows one under each; their exact lengths can't be read: 20 mm)
        dr.rectangle((round((cx - 10) * S), round((y + 4.6) * S), round((cx + 10) * S), round((y + 5.0) * S)), fill=rule_c)
    save(im.resize((round(DW * PXMM), round(DH * PXMM)), Image.LANCZOS), "display_print.png")


# ── MAGICCONVERTIBLE: MAGIC in a heavy face, CONVERTIBLE light, at the Magic Zone door's bottom left. Its size differs by
# colour on Haier's fronts: about 115 mm long on Graphite Black (gk_34right.jpg), Grey Onyx and Pearl White, 66 mm on Black
# Glass, and a 74 x 15 mm plate with a bright rim on Inox Steel (is_badge.jpg). One decal 118 x 16 mm carries each, from
# its left end (NOTES.md) ──
BW, BH = 118.0, 16.0


def badge():
    S = PXMM * 3
    for name, col, length, plate in (("badge_wide_light.png", (238, 240, 244, 255), 115.0, False),
                                     ("badge_wide_dark.png", (70, 73, 78, 255), 115.0, False),
                                     ("badge_small_light.png", (226, 228, 232, 255), 66.0, False),
                                     ("badge_plate.png", (232, 234, 238, 255), 66.0, True)):
        im = Image.new("RGBA", (round(BW * S), round(BH * S)), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        x = 0.0
        if plate:
            pw, ph = 74.0, 15.0
            y0 = (BH - ph) / 2
            dr.rounded_rectangle((0, round(y0 * S), round(pw * S), round((y0 + ph) * S)), radius=round(1.2 * S), fill=(176, 180, 186, 255))
            dr.rounded_rectangle((round(0.7 * S), round((y0 + 0.7) * S), round((pw - 0.7) * S), round((y0 + ph - 0.7) * S)), radius=round(0.8 * S), fill=(34, 35, 38, 255))
            x = (pw - length) / 2
        probe = ImageDraw.Draw(Image.new("L", (10, 10)))
        f0, f1 = font(200, 0), font(200, 7)
        w0, w1 = probe.textlength("MAGIC", font=f0), probe.textlength("CONVERTIBLE", font=f1)
        k = length * S / (w0 + w1)
        f0, f1 = font(200 * k, 0), font(200 * k, 7)
        w0 = probe.textlength("MAGIC", font=f0)
        l, t, r, b = dr.textbbox((0, 0), "M", font=f0)
        y = im.height / 2 - (t + b) / 2
        dr.text((x * S, y), "MAGIC", font=f0, fill=col)
        dr.text((x * S + w0, y), "CONVERTIBLE", font=f1, fill=col)
        save(im.resize((round(BW * PXMM), round(BH * PXMM)), Image.LANCZOS), name)


# ── the back: Haier's rear photo of this model on the rear panel; the bay's slots found on the photo ──
RX0, RX1, RTOP, RBOT = 331, 890, 79, 1137      # the body (905 mm); the cabinet's top (1747 mm) to the panel's bottom
RPPM = (RX1 - RX0) / 905
RXC = (RX0 + RX1) / 2
BAY = 987                                      # the bay cover's top edge
Y_TOP = 1.747
Y_BOT = Y_TOP - (RBOT - RTOP) / RPPM / 1000


def to_m(x, y):
    """rear-photo pixel -> model metres (the photo is from behind, so x flips)."""
    return [round(-(x - RXC) / RPPM / 1000, 4), round(Y_TOP - (y - RTOP) / RPPM / 1000, 4)]


def rear():
    src = Image.open(os.path.join(SRC, "gk_rear.jpg")).convert("RGB")
    a = np.asarray(src)
    save(src.crop((RX0, RTOP + 4, RX1, BAY)), "rear.jpg", 84)
    save(src.crop((RX0, BAY, RX1, RBOT)), "bay.jpg", 88)
    L = a[BAY + 6:RBOT - 16, RX0 + 6:RX1 - 6].mean(2)
    n, lab, stats, _ = cv2.connectedComponentsWithStats((L < 75).astype(np.uint8), 8)
    slots = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 10 or max(w, h) < 8 or min(w, h) > 6:
            continue
        x += RX0 + 6; y += BAY + 6
        (ax, ay), (bx, by) = to_m(x - 0.5, y + h - 0.5), to_m(x + w - 0.5, y - 0.5)
        slots.append([min(ax, bx), ay, max(ax, bx), by])
    # the box on top at the back: columns 428-659, 17 px (28 mm) over the cabinet; the cord leaves its white grommet
    # (column 597) and lies along the box's top back edge to column 452 (gk_rear.jpg)
    data = {"ppm": RPPM, "y_top": Y_TOP, "y_bot": round(Y_BOT, 4), "bay": [round(Y_BOT, 4), to_m(0, BAY)[1]], "slots": slots,
            "topbox": [to_m(659, 0)[0], to_m(428, 0)[0]], "box_h": round(17 / RPPM / 1000, 4),
            "cord_exit": to_m(597, 0)[0], "cord_far": to_m(452, 0)[0]}
    json.dump(data, open(os.path.join(D, "rear_paths.json"), "w"), indent=1)
    print("rear_paths.json:", len(slots), "slots", data["topbox"], data["cord_exit"], data["cord_far"], data["bay"])


# ── the words Haier prints inside, set again sharp (Avenir Next) ──
def two_weight(parts, cap_mm, name, pad=0.6, bar=None, bar_w=None):
    S = PXMM * 3
    probe = ImageDraw.Draw(Image.new("L", (10, 10)))
    l, t, r, b = probe.textbbox((0, 0), "H", font=font(200, 0))
    k = cap_mm * S / (b - t)
    fonts = [font(200 * k, face) for _, face, _ in parts]
    widths = [probe.textlength(s, font=f) for (s, _, _), f in zip(parts, fonts)]
    tw = sum(widths)
    ph = round((cap_mm * (bar and 2.2 or 1.6)) * S)
    pw = round(bar_w * S) if bar_w else round(tw + (bar and 8 * S or pad * 2 * S))
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
    # the black bars at the top of the Magic Zone's and the fridge's back walls (gk_open.jpg: 147 and 260 mm wide, 23 mm tall)
    two_weight([("MAGIC ", 0, W), ("COOLING", 7, W)], 5.0, "print_magiccooling_bar.png", bar=(14, 14, 16, 255), bar_w=147)
    two_weight([("DEO ", 0, W), ("FRESH", 7, W)], 5.0, "print_deofresh.png", bar=(14, 14, 16, 255), bar_w=260)
    # grey words on the back walls and the drawers (gk_open.jpg, gk_freezer.jpg); the icons after FRESHBOX, FREEZEBOX and
    # ICEPLUS and the small print under MAGIC COOLING can't be read at the photos' resolution: left out
    two_weight([("MAGIC", 0, G1), ("ZONE", 10, G2)], 8.0, "print_magiczone.png")
    two_weight([("MAGIC ", 0, G1), ("COOLING", 10, G2)], 8.0, "print_magiccooling.png")
    two_weight([("FREEZE", 0, G1), ("BOX", 10, G2)], 8.0, "print_freezebox.png")
    two_weight([("FRESH", 0, G1), ("BOX", 10, G2)], 8.0, "print_freshbox.png")
    two_weight([("ICE", 0, G1), ("PLUS", 10, G1)], 8.0, "print_iceplus.png")


info = fronts()
sides(info)
json.dump(info, open(os.path.join(D, "finishes.json"), "w"), indent=1)
for k, v in info.items():
    print(k, json.dumps(v))
logo()
display()
badge()
rear()
prints()
