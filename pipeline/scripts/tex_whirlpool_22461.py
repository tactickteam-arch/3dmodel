"""Textures for the Whirlpool 22461 (Luxuriem 654 L four-door French door), Duo Noir, and its glass colours.

Writes pipeline/tex/whirlpool_22461/:
  door_dn_low.jpg                    Duo Noir's lower doors: brushed black steel with the light of Whirlpool's straight
                                     front kept (its fall and the band across the left door), fine horizontal brushing
  door_vc_up.jpg, door_vc_low.jpg    Verde Cristallo's green marble glass, upper and lower pairs
  door_nb_up.jpg                     Nero Bianco's marble glass, light grey at the top falling to black (its lower doors
                                     are plain black glass)
                                     (each from Whirlpool's 3/4 size picture laid on the front at 1 px/mm, the render's
                                     diagonal sheen taken out; the straight fronts carry promotion graphics)
  mark_whirlpool.png                 the Whirlpool mark on the right fridge door: Whirlpool India's own SVG, white with
                                     the gold swoosh as Whirlpool's photos show it
  mark_6th.png, mark_6th_ai.png      the 6th Sense mark at the left fridge door's top left; Verde Cristallo and Nero Bianco
                                     carry it with the "AI" badge (their size pictures)
  ui.jpg                             the Door UI display on the left fridge door's free edge, redrawn at 14.4 px/mm from
                                     Whirlpool's close-up ("100+ customisable modes"), no chroma subsampling
  panel360_white.jpg, panel360_steel.jpg   the 360 Triple Cooling panel on the back wall: white (Duo Noir, Nero Quartz),
                                     brushed steel (Verde Cristallo, Nero Bianco)
  print_crisper.png, print_fzdrawer.png, print_arctic.png  the drawer prints from the open view
usage: python3 -I pipeline/scripts/tex_whirlpool_22461.py
Sources: pipeline/sources/photos/whirlpool_22461/ (NOTES.md lists each one and its scale).
"""
import os
import site
import subprocess

site.addsitedir(os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"))  # run with -I: only this folder is added
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(SITE, "pipeline/sources/photos/whirlpool_22461")
OUT = os.path.join(SITE, "pipeline/tex/whirlpool_22461")
WORK = os.path.join(SITE, ".work", "whirlpool_22461_tex")
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BOLD, BOLDI, DEMI, MED, REG, ULTRA = 0, 1, 2, 5, 7, 10
PX_MM = 7.2

# ── the front, at 1 px/mm: 909 x 1830.5 mm from the doors' top (1862.5 mm) to their foot (32 mm) ──
FW, FH = 909, 1831
TOP = 1862.5
# Whirlpool's straight front (1200 x 1200): the body spans 372.5-885.5 px across and 75.5 (top) to 1106.5 (the doors'
# foot) down, 0.564 px/mm. The 3/4 size picture: the front's corners at (453, 188), (845, 161.7), (845, 1023.3),
# (453, 998.6), the same for every colour (one camera; checked on all four)
FRONT_PX = [[372.5, 75.5], [885.5, 75.5], [885.5, 1106.5], [372.5, 1106.5]]
QUART_PX = [[453, 188], [845, 161.7], [845, 1023.3], [453, 998.6]]
UP = (0, int(round(TOP - 844.7)))           # rows of the upper doors on the front: 0 to 1018
LOW = (int(round(TOP - 802.0)), FH)         # rows of the lower doors: 1060 to 1831


def warp(name, corners):
    a = np.asarray(Image.open(os.path.join(SRC, name)).convert("RGB")).astype(np.float32)
    H = cv2.getPerspectiveTransform(np.float32(corners), np.float32([[0, 0], [FW, 0], [FW, FH - 0.5], [0, FH - 0.5]]))
    return cv2.warpPerspective(a, H, (FW, FH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def lum(a):
    return a @ np.float32([0.299, 0.587, 0.114])


def doors_only(a, rows):
    """one pair of doors, the seam filled from the doors beside it (it is never seen: each door's front stops 5 mm short of
    the middle; the 3/4 view's door-edge highlights either side of it go too), and the outer columns and rows from their
    neighbours (the photo's door edges, the bar's shadow)"""
    a = a[rows[0]:rows[1]].copy()
    l, r = 437, 465                  # the 3/4 view's seam with both doors' edge highlights
    w = np.linspace(0, 1, r - l)[None, :, None]
    a[:, l:r] = a[:, l - 1:l] * (1 - w) + a[:, r:r + 1] * w
    a[:, :3] = a[:, 3:4]
    a[:, -3:] = a[:, -4:-3]
    a[:5] = a[5:6]                   # the bar's shadow over the lower doors' top
    a[-3:] = a[-4:-3]
    return a


def save_jpg(a, name, q=88):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=q, optimize=True)
    print(name, a.shape[1], "x", a.shape[0])


# ── the renders' glass sheen, taken out ──
# Whirlpool's 3/4 size pictures are one render per colour with the same fake reflection: one straight diagonal edge from
# the right fridge door's top right down across the left freezer door, light above-left of it, none below-right. Nero
# Quartz (black glass on all four doors) shows it alone: 5 of 255 below the edge, rising from 5 to 35 across the width
# above it. The straight fronts carry promotion graphics over the print, so every door texture comes from the 3/4 view
# with this sheen taken out: S(x, y) is Nero Quartz's light above its edge, laid on each colour's own edge (fitted per
# colour and per pair of doors: the renders differ by a few px), removed as print = (seen - k1 S) / (1 + k2 S), with k1
# and k2 fitted so that the two sides of the edge match.
PAIRS = {"up": (UP, (485, 880, 280, 1012)), "low": (LOW, (30, 425, 1130, 1600))}


def edge_points(L, span):
    x0, x1, y0, y1 = span
    s = cv2.GaussianBlur(L, (0, 0), 2.5)
    k = np.ones(11, np.float32) / 11
    pts = []
    for y in range(y0, y1, 3):
        m = np.convolve(s[y, x0 - 20:x1 + 20], k, "same")
        st = np.zeros_like(m)
        st[9:-9] = m[:-18] - m[18:]
        st[:20] = 0
        st[-20:] = 0
        i = int(np.argmax(st))
        if st[i] > 3 and st[i] / max(1.0, m[min(len(m) - 1, i + 9)]) > 0.15:
            pts.append((y, x0 - 20 + i))
    return np.float32(pts)


def fit_edge(L, span, name):
    """the sheen edge as x = p(y), a gentle quadratic through the steps (light left, dark right) found row by row that
    lie on a RANSAC line"""
    pts = edge_points(L, span)
    rng = np.random.default_rng(1)
    inl = None
    for _ in range(500):
        i, j = rng.choice(len(pts), 2, replace=False)
        if abs(pts[i, 0] - pts[j, 0]) < 150:
            continue
        b = (pts[j, 1] - pts[i, 1]) / (pts[j, 0] - pts[i, 0])
        a = pts[i, 1] - b * pts[i, 0]
        n = np.abs(pts[:, 1] - (a + b * pts[:, 0])) < 3.5
        if inl is None or n.sum() > inl.sum():
            inl = n
    line = np.polyfit(pts[inl, 0], pts[inl, 1], 1)
    near = np.abs(pts[:, 1] - np.polyval(line, pts[:, 0])) < 6
    p = np.polyfit(pts[near, 0], pts[near, 1], 2)
    res = np.abs(pts[near, 1] - np.polyval(p, pts[near, 0]))
    print(f"  {name}: sheen edge from x {np.polyval(p, span[2]):.0f} at y {span[2]} to x {np.polyval(p, span[3]):.0f} at y {span[3]}"
          f" ({near.sum()} of {len(pts)} row steps on it, within {np.percentile(res, 90):.1f} px)")
    return p


_YY, _XX = np.mgrid[0:FH, 0:FW].astype(np.float32)


def lit_mask(edge, soft=1.5):
    return np.clip((np.polyval(edge, _YY) - _XX) / (2 * soft) + 0.5, 0, 1)


_SHEEN = {}


def sheen(pair):
    """Nero Quartz's sheen over one pair of doors (its light above its black glass's 5), and its edge"""
    if pair not in _SHEEN:
        rows, span = PAIRS[pair]
        L = lum(warp("nq_34.jpg", QUART_PX))
        edge = fit_edge(L, span, f"nero quartz {pair}")
        dark = lit_mask(edge, 0.5) < 0.01
        dark[:rows[0] + 6] = False
        dark[rows[1] - 6:] = False
        base = float(np.median(L[dark]))
        S = np.maximum(0, L - base)
        # the seam, the doors' outer edges and the two marks are the render's, not the sheen: bridged row by row
        bad = np.zeros((FH, FW), bool)
        bad[:, 436:475] = True
        bad[:, :8] = True
        bad[:, FW - 8:] = True
        bad[46:96, 18:70] = True
        bad[48:92, 772:866] = True
        xs = np.arange(FW)
        for y in range(rows[0], rows[1]):
            ok = ~bad[y]
            S[y, bad[y]] = np.interp(xs[bad[y]], xs[ok], S[y, ok])
            xe = np.polyval(edge, y)
            if 430 < xe < 481:   # the edge crosses the seam here: light up to the edge, none after it
                S[y, 436:475] = np.where(xs[436:475] < xe, S[y, 435], 0)
        _SHEEN[pair] = (S, edge)
        print(f"  nero quartz {pair}: black glass reads {base:.1f}")
    return _SHEEN[pair]


def unsheen(code, pair, a=None):
    """one colour's 3/4 view over one pair of doors with the sheen taken out (the whole 909 x 1831 front): Nero Quartz's
    sheen, rim and fall included, slid along each row onto this colour's own edge"""
    rows, span = PAIRS[pair]
    if a is None:
        a = warp(f"{code}_34.jpg", QUART_PX)
    L = lum(a)
    edge = fit_edge(L, span, f"{code} {pair}")
    S0, nq_edge = sheen(pair)
    yy, xx = _YY, _XX
    xe = lambda y: float(np.polyval(edge, y))
    mapx = (xx - (np.polyval(edge, yy) - np.polyval(nq_edge, yy))).astype(np.float32)
    S = cv2.remap(S0.astype(np.float32), mapx, yy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    lit, dark, s = [], [], []
    for y in range(span[2], span[3], 2):
        xi = int(round(xe(y)))
        if xi - 26 < 8 or xi + 26 > FW - 8 or abs(xi - 455) < 34:
            continue
        lit.append(L[y - 2:y + 3, xi - 24:xi - 7].mean())
        dark.append(L[y - 2:y + 3, xi + 7:xi + 24].mean())
        s.append(S[y - 2:y + 3, xi - 24:xi - 7].mean() - S[y - 2:y + 3, xi + 7:xi + 24].mean())
    lit, dark, s = map(np.float32, (lit, dark, s))
    k1, k2 = np.linalg.lstsq(np.stack([s, s * dark], 1), lit - dark, rcond=None)[0]
    k2 = max(0.0, k2)
    out = (a - k1 * S[..., None]) / (1 + k2 * S[..., None])
    Lo = lum(out)
    ys = [y for y in range(span[2], span[3], 20) if 34 < xe(y) < FW - 34 and abs(xe(y) - 455) > 34]
    after = [Lo[y - 2:y + 3, int(xe(y)) - 24:int(xe(y)) - 7].mean() - Lo[y - 2:y + 3, int(xe(y)) + 7:int(xe(y)) + 24].mean() for y in ys]
    print(f"  {code} {pair}: k1 {k1:.3f}, k2 {k2:.4f}; step across the edge {np.mean(lit - dark):.1f} before, "
          f"{np.mean(after):.1f} after")
    # what is left of the edge's own rims (light just before it, a dark line 2 to 6 px after it: the coloured renders
    # have it, Nero Quartz's black does not show it) is filled from the print either side
    d = xx - np.polyval(edge, yy)
    m = ((d >= -4) & (d <= 8) & (yy >= rows[0]) & (yy < rows[1])).astype(np.uint8)
    return cv2.inpaint(np.clip(out, 0, 255).astype(np.uint8), m, 5, cv2.INPAINT_TELEA).astype(np.float32)


def marks_out(a):
    """the 6th Sense and Whirlpool marks of the 3/4 view filled from the marble around them (the model has its own)"""
    m = np.zeros((FH, FW), np.uint8)
    m[50:92, 22:66] = 1
    m[52:88, 776:862] = 1
    u8 = np.clip(a, 0, 255).astype(np.uint8)
    return cv2.inpaint(u8, m, 6, cv2.INPAINT_TELEA).astype(np.float32)


# the print's level as a share of the 3/4 view's, tuned on the gate's renders against the photos (NOTES.md)
MARBLE_SHADE = {"vc": 1.0, "nb": 1.0}


def marble(code, pair):
    rows = PAIRS[pair][0]
    a = unsheen(code, pair)
    if pair == "up":
        a = marks_out(a)
    return doors_only(a, rows) * MARBLE_SHADE[code]


# ── Duo Noir's brushed black steel (lower doors) ──
# The straight front's left freezer door (45 of 255, a soft light band falling across it from its top right) and the 3/4
# view's right door (the front's is under the "fastest convertible" graphic; both views read 37 falling to 34 there),
# kept as the photo has them (the photo's light bands baked in). The photo's brushing (horizontal, 0.56 px/mm)
# is replaced by fine generated streaks at 1 px/mm of the same depth.
DN_SHADE = 1.0


def duo_noir_low():
    f = warp("dn_front.jpg", FRONT_PX)
    q = warp("dn_34.jpg", QUART_PX)
    # the right freezer door from the 3/4 view, matched to the straight front's right door above and below the graphic
    bare = np.r_[LOW[0] + 10:LOW[0] + 120, FH - 130:FH - 10]
    for c in range(3):
        q[..., c] *= f[bare, 480:890, c].mean() / max(1, q[bare, 480:890, c].mean())
    a = f.copy()
    a[:, 455:] = q[:, 455:]
    a = doors_only(a, LOW)
    hp = lum(a) - lum(cv2.GaussianBlur(a, (0, 0), sigmaX=9, sigmaY=1.2))
    amp = float(np.std(hp[30:-30, 20:430]))
    base = cv2.GaussianBlur(a, (0, 0), sigmaX=9, sigmaY=1.2)
    rng = np.random.default_rng(20261110)
    h, w = base.shape[:2]
    fine = cv2.resize(rng.normal(0, 1, (h, w // 30 + 2)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    fine += 0.5 * cv2.resize(rng.normal(0, 1, (h, w // 6 + 2)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    fine = fine / fine.std() * max(1.2, amp)
    print("duo noir lower: front streak depth", round(amp, 2), "left door", np.round(base[:, 20:430].reshape(-1, 3).mean(0), 1),
          "right door", np.round(base[:, 480:890].reshape(-1, 3).mean(0), 1))
    return (base + fine[..., None]) * DN_SHADE


# ── marks ──
def logo_alpha():
    os.makedirs(WORK, exist_ok=True)
    png = os.path.join(WORK, "logo_3000.png")
    if not os.path.exists(png):
        subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"),
                        os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"), png, "3000"], check=True, capture_output=True)
    lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
    a = lg[..., 3] / 255
    gold = (lg[..., 0] > 150) & (lg[..., 2] < 120) & (a > 0.05)
    cols = np.where((a > 0.1).any(0))[0]
    gaps = np.where(np.diff(cols) > 8)[0]            # drop the registered mark (too small to see on the door)
    right = cols[gaps[-1]] + 1 if len(gaps) else cols[-1] + 1
    ys = np.where((a[:, :right] > 0.1).any(1))[0]
    sl = (slice(ys.min(), ys.max() + 1), slice(cols[0], right))
    return a[sl], gold[sl]


def mark_whirlpool():
    """69 x 21.5 mm (the straight front: 815-854 x 109-121 px), at 12 px/mm: white letters, the swoosh gold (the 3/4
    pictures show it gold on every colour)"""
    a, gold = logo_alpha()
    k = 12
    W, Hh = int(69 * k), int(21.5 * k)
    sc = min(W / a.shape[1], Hh / a.shape[0])
    size = (int(a.shape[1] * sc), int(a.shape[0] * sc))
    A = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize(size, Image.LANCZOS)).astype(np.float32) / 255
    G = np.asarray(Image.fromarray((gold * 255).astype(np.uint8)).resize(size, Image.LANCZOS)).astype(np.float32) / 255
    out = np.zeros((Hh, W, 4), np.float32)
    y0, x0 = (Hh - size[1]) // 2, (W - size[0]) // 2
    col = np.float32([236, 236, 238]) * (1 - G[..., None]) + np.float32([226, 172, 40]) * G[..., None]
    out[y0:y0 + size[1], x0:x0 + size[0], :3] = col
    out[y0:y0 + size[1], x0:x0 + size[0], 3] = A * 255
    Image.fromarray(out.astype(np.uint8)).save(os.path.join(OUT, "mark_whirlpool.png"), optimize=True)
    print("mark_whirlpool.png", W, "x", Hh)


def font(face, px):
    return ImageFont.truetype(AVENIR, int(px), index=face)


def mark_6th(ai):
    """40 x 34 mm at 12 px/mm: a "6" 18 mm wide and 24 mm tall at the left (the size pictures: 28-46 mm in from the
    door's left edge, 59-83 mm down), "th" over its right shoulder, "sense" under it, and on the AI colours the small
    square "AI" badge beside it (to 59 mm). Light grey as on the photos"""
    k = 12
    W, Hh = 40 * k, 34 * k
    img = Image.new("L", (W, Hh), 0)
    d = ImageDraw.Draw(img)
    six = font(6, 30 * k)          # Medium Italic: the photos' "6" leans
    bb = d.textbbox((0, 0), "6", font=six)
    sx = 18 * k / (bb[2] - bb[0])
    g6 = Image.new("L", (bb[2] + 10, bb[3] + 10), 0)
    ImageDraw.Draw(g6).text((0, 0), "6", font=six, fill=255)
    g6 = g6.crop(g6.getbbox()).resize((18 * k, 24 * k), Image.LANCZOS)
    img.paste(g6, (int(2 * k), int(2 * k)), g6)
    d.text((int(20 * k), int(1.2 * k)), "th", font=font(DEMI, 5.5 * k), fill=255)
    d.text((int(2.5 * k), int(27.5 * k)), "sense", font=font(MED, 5 * k), fill=255)
    if ai:
        x0, y0 = int(21 * k), int(13 * k)
        d.rectangle([x0, y0, x0 + int(10 * k), y0 + int(10 * k)], fill=255)
        f = font(BOLD, 6 * k)
        tb = d.textbbox((0, 0), "AI", font=f)
        d.text((x0 + int(5 * k) - (tb[2] - tb[0]) // 2 - tb[0], y0 + int(5 * k) - (tb[3] - tb[1]) // 2 - tb[1]), "AI", font=f, fill=0)
    out = np.zeros((Hh, W, 4), np.uint8)
    out[..., :3] = 214
    out[..., 3] = np.asarray(img)
    name = "mark_6th_ai.png" if ai else "mark_6th.png"
    Image.fromarray(out).save(os.path.join(OUT, name), optimize=True)
    print(name, W, "x", Hh)


# ── the Door UI display: 60 x 248 mm on the left fridge door's free edge (NOTES.md: Whirlpool's open view puts it at
# 1385 to 1633 mm; the close-up gives its layout). Positions in mm from the display's top left. Every word is legible
# on the close-up; the item at the display's foot in the open view (about 224 mm down) cannot be read and is left out ──
UI_W, UI_H = 60, 248
UI_PX_MM = 14.4     # twice the other prints: the mode words are 2.1 mm capitals, 30 px tall here (7.2 px/mm left them soft close up)
WHITE = (236, 236, 240)
DIM = (150, 150, 156)
BG = (9, 9, 10)


class Canvas:
    def __init__(self, w_mm, h_mm, k=PX_MM * 3, bg=BG):
        self.k = k
        self.img = Image.new("RGB", (int(w_mm * k), int(h_mm * k)), bg)
        self.d = ImageDraw.Draw(self.img)

    def text(self, s, face, cap_mm, x, base, align="l", colour=WHITE, spacing=0):
        f = font(face, cap_mm * self.k / 0.72)
        if spacing:
            xs = x * self.k
            widths = [f.getlength(c) for c in s]
            total = sum(widths) + spacing * self.k * (len(s) - 1)
            xs = {"l": xs, "r": xs - total, "c": xs - total / 2}[align]
            for c, wpx in zip(s, widths):
                self.d.text((xs, base * self.k), c, font=f, fill=colour, anchor="ls")
                xs += wpx + spacing * self.k
            return
        anchor = {"l": "ls", "r": "rs", "c": "ms"}[align]
        self.d.text((x * self.k, base * self.k), s, font=f, fill=colour, anchor=anchor)

    def rect(self, box, width=0.35, colour=WHITE, fill=None, r=0):
        x0, y0, x1, y1 = (v * self.k for v in box)
        if r:
            self.d.rounded_rectangle([x0, y0, x1, y1], radius=r * self.k, outline=None if fill else colour, fill=fill, width=int(width * self.k))
        else:
            self.d.rectangle([x0, y0, x1, y1], outline=None if fill else colour, fill=fill, width=int(width * self.k))

    def line(self, pts, width=0.35, colour=WHITE):
        self.d.line([(x * self.k, y * self.k) for x, y in pts], fill=colour, width=max(1, int(width * self.k)))

    def save(self, name, final_k=PX_MM, q=90, sub=-1):
        im = self.img.resize((int(self.img.width * final_k / self.k), int(self.img.height * final_k / self.k)), Image.LANCZOS)
        if name.endswith(".png"):
            im.save(os.path.join(OUT, name), optimize=True)
        else:
            im.save(os.path.join(OUT, name), quality=q, optimize=True, subsampling=sub)
        print(name, im.width, "x", im.height)


def seg7(c, x, y, w, h, digits):
    """seven-segment digits (bar 0.21 of the width, segment gaps 0.62 of the bar) at (x, y) top left, each w x h mm"""
    t = 0.21 * w
    segs = {"a": (0, 0, 1, 0), "b": (1, 0, 1, 0.5), "c": (1, 0.5, 1, 1), "d": (0, 1, 1, 1), "e": (0, 0.5, 0, 1), "f": (0, 0, 0, 0.5), "g": (0, 0.5, 1, 0.5)}
    lit = {"2": "abged", "-": "g"}
    for i, ch in enumerate(digits):
        ox = x + i * (w + 0.5 * w)
        for s in lit[ch]:
            x0, y0, x1, y1 = segs[s]
            if x0 == x1:
                c.rect((ox + x0 * w - t / 2, y + y0 * h + t * 0.62, ox + x0 * w + t / 2, y + y1 * h - t * 0.62), fill=WHITE)
            else:
                c.rect((ox + x0 * w + t * 0.62, y + y0 * h - t / 2, ox + x1 * w - t * 0.62, y + y0 * h + t / 2), fill=WHITE)


def door_ui():
    # the close-up's layout (its print is 235 px across for the display's width and 440 px from "Auto Mode" to the foot of
    # "-22", which the open view gives as 123 mm): 0.255 mm per px across, 0.28 down, "Auto Mode" 31 mm from the top
    c = Canvas(UI_W, UI_H, k=UI_PX_MM * 3)
    sx, sy = 60 / 235, 0.28
    X = lambda px: (px - 215) * sx
    Y = lambda py: 31 + (py - 211) * sy
    for i, w in enumerate(["Auto Mode", "Quick Chill", "Fast Ice", "Eco Mode", "Vacation"]):
        c.text(w, MED, 2.1, X(283), Y(214 + i * 17.8), "r")
        c.rect((X(290), Y(211 + i * 17.8), X(301), Y(214 + i * 17.8)), fill=DIM)
    for i, w in enumerate(["Groceries", "Beverages", "Soft Freeze"]):
        c.text(w, MED, 2.1, X(283), Y(326 + i * 17.5), "r")
        c.rect((X(290), Y(323 + i * 17.5), X(301), Y(326 + i * 17.5)), fill=DIM)
    # EXPERT: a square with three lines and dots; CONVERT: a square with a fridge; ZONE: a square with up/down arrows
    for (y0, y1), word, sub in (((233, 278), "EXPERT", None), ((325, 370), "CONVERT", None), ((415, 460), "ZONE", "2 sec")):
        c.rect((X(338), Y(y0), X(378), Y(y1)), width=0.3)
        c.text(word, DEMI, 2.3, X(384), Y((y0 + y1) / 2 + 8))
        if sub:
            c.text(sub, MED, 2.0, X(395), Y((y0 + y1) / 2 + 24))
            c.rect((X(384), Y((y0 + y1) / 2 + 16), X(391), Y((y0 + y1) / 2 + 24)), width=0.25)
    cx = (X(338) + X(378)) / 2
    for k in range(3):   # EXPERT: three short lines with a dot each
        yy = Y(245 + k * 11)
        c.rect((cx - 3.2, yy - 0.4, cx - 2.2, yy + 0.4), fill=WHITE)
        c.line([(cx - 1.2, yy), (cx + 3.4, yy)], 0.3)
    c.rect((cx - 3.2, Y(332), cx + 3.2, Y(363)), width=0.3)             # CONVERT: the fridge's outline and its doors
    c.line([(cx - 3.2, Y(352)), (cx + 3.2, Y(352))], 0.3)
    c.line([(cx, Y(332)), (cx, Y(352))], 0.3)
    c.rect((cx + 0.6, Y(354), cx + 2.6, Y(361)), fill=WHITE)
    for d_, y in ((-1, Y(430)), (1, Y(447))):                             # ZONE: up and down arrows
        c.line([(cx - 2.5, y + d_ * -1.6), (cx, y + d_ * 1.6), (cx + 2.5, y + d_ * -1.6)], 0.3)
    # the zones icon on the left: a tall square over two small ones, the top one lit
    c.rect((X(270), Y(403), X(308), Y(437)), width=0.3)
    c.rect((X(274), Y(407), X(304), Y(433)), fill=DIM)
    c.rect((X(270), Y(441), X(287), Y(462)), width=0.3)
    c.rect((X(291), Y(441), X(308), Y(462)), width=0.3)
    c.rect((X(274), Y(445), X(283), Y(458)), fill=DIM)
    # lock, M, degree C
    lx = X(293)
    c.rect((lx - 1.4, Y(505), lx + 1.4, Y(513)), fill=WHITE, r=0.3)
    c.d.arc([(lx - 1.0) * c.k, Y(499) * c.k, (lx + 1.0) * c.k, Y(507) * c.k], 180, 360, fill=WHITE, width=int(0.3 * c.k))
    c.text("M", DEMI, 2.3, lx, Y(540), "c")
    c.text("°C", DEMI, 2.3, lx, Y(565), "c")
    # TEMP. CONTROL: a tall key with + and -
    c.rect((X(338), Y(513), X(378), Y(655)), width=0.3)
    c.line([(cx - 2, Y(535)), (cx + 2, Y(535))], 0.35)
    c.line([(cx, Y(535) - 2), (cx, Y(535) + 2)], 0.35)
    c.line([(cx - 2, Y(632)), (cx + 2, Y(632))], 0.35)
    c.text("TEMP.", DEMI, 2.1, X(384), Y(578))
    c.text("CONTROL", DEMI, 2.1, X(384), Y(593))
    seg7(c, X(246), Y(598), 5.2, 13.0, "-22")
    c.save("ui.jpg", final_k=UI_PX_MM, q=92, sub=0)


# ── the 360 Triple Cooling panel: 351 x 619 mm; "360°" 62 x 32 mm, 63 mm down; "TRIPLE COOLING" 179 mm wide, 5 mm
# capitals, 261 mm down (open view at the back wall's 441 px/m) ──
PAN_W, PAN_H = 351, 619


def panel360(steel):
    k = 3
    if steel:
        rng = np.random.default_rng(3)
        h, w = PAN_H * k, PAN_W * k
        fine = cv2.resize(rng.normal(0, 1, (h // 2, w // 40 + 2)).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
        x = np.linspace(-1, 1, w)[None, :]
        # Verde Cristallo's open view: bright steel, a soft vertical band of light down the middle
        v = 196 + 18 * np.exp(-(x / 0.45) ** 2) - 10 * np.abs(x) + 3 * np.repeat(cv2.resize(rng.normal(0, 1, (1, w // 3)).astype(np.float32), (w, 1)), h, 0)
        base = np.repeat((v + 1.5 * fine)[..., None], 3, 2) + np.float32([0, 1, 3])
        img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
        ink = (70, 72, 76)
    else:
        img = Image.new("RGB", (PAN_W * k, PAN_H * k), (243, 244, 246))
        ink = (120, 122, 128)
    d = ImageDraw.Draw(img)
    f = font(ULTRA, 34 * k / 0.72)
    d.text((PAN_W / 2 * k, (63 + 16) * k), "360", font=f, fill=ink, anchor="mm")
    tb = d.textbbox((PAN_W / 2 * k, (63 + 16) * k), "360", font=f, anchor="mm")
    r = 3.5 * k
    d.ellipse([tb[2] + 1 * k, tb[1], tb[2] + 1 * k + 2 * r, tb[1] + 2 * r], outline=ink, width=max(1, int(0.9 * k)))
    fc = font(MED, 5 * k / 0.72)
    s = "TRIPLE COOLING"
    widths = [fc.getlength(ch) for ch in s]
    sp = (179 * k - sum(widths)) / (len(s) - 1)
    x = (PAN_W - 179) / 2 * k
    for ch, wpx in zip(s, widths):
        d.text((x, (261 + 2.5) * k), ch, font=fc, fill=ink, anchor="ls")
        x += wpx + sp
    img = img.resize((PAN_W * 2, PAN_H * 2), Image.LANCZOS)
    name = "panel360_steel.jpg" if steel else "panel360_white.jpg"
    img.save(os.path.join(OUT, name), quality=88, optimize=True)
    print(name, img.width, "x", img.height)


# ── the drawer prints (white line icons on the clear fronts, open view) ──
def icons(kind):
    k = 24
    W, Hh = 58, 16
    img = Image.new("L", (W * k, Hh * k), 0)
    d = ImageDraw.Draw(img)
    lw = int(0.9 * k)
    cs = [W / 6 * k, W / 2 * k, W * 5 / 6 * k]
    cy = Hh / 2 * k
    r = 5.5 * k
    if kind == "crisper":
        x = cs[0]   # an apple: a heart-shaped round with its stem
        d.ellipse([x - r, cy - r * 0.8, x + r, cy + r], outline=255, width=lw)
        d.line([x, cy - r * 0.8, x + r * 0.3, cy - r * 1.3], fill=255, width=lw)
        x = cs[1]   # a pear
        d.ellipse([x - r * 0.85, cy - r * 0.1, x + r * 0.85, cy + r], outline=255, width=lw)
        d.ellipse([x - r * 0.5, cy - r * 1.0, x + r * 0.5, cy + r * 0.2], outline=255, width=lw)
        x = cs[2]   # a carrot, lying from lower left to upper right, its leaves at the top
        d.polygon([(x - r * 1.1, cy + r * 0.9), (x + r * 0.5, cy - r * 0.6), (x + r * 0.8, cy - r * 0.2)], outline=255, width=lw)
        d.line([x + r * 0.65, cy - r * 0.45, x + r * 1.2, cy - r * 1.1], fill=255, width=lw)
        d.line([x + r * 0.65, cy - r * 0.45, x + r * 1.3, cy - r * 0.6], fill=255, width=lw)
    else:
        x = cs[0]   # a fish
        d.ellipse([x - r * 1.0, cy - r * 0.5, x + r * 0.6, cy + r * 0.5], outline=255, width=lw)
        d.polygon([(x + r * 0.55, cy), (x + r * 1.2, cy - r * 0.5), (x + r * 1.2, cy + r * 0.5)], outline=255, width=lw)
        x = cs[1]   # a drumstick
        d.ellipse([x - r * 0.8, cy - r * 0.9, x + r * 0.4, cy + r * 0.3], outline=255, width=lw)
        d.line([x + r * 0.1, cy + r * 0.1, x + r * 0.8, cy + r * 0.8], fill=255, width=lw)
        d.ellipse([x + r * 0.7, cy + r * 0.6, x + r * 1.1, cy + r * 1.0], outline=255, width=lw)
        x = cs[2]   # a tub with its lid
        d.polygon([(x - r * 0.8, cy - r * 0.4), (x + r * 0.8, cy - r * 0.4), (x + r * 0.6, cy + r * 0.8), (x - r * 0.6, cy + r * 0.8)], outline=255, width=lw)
        d.line([x - r * 1.0, cy - r * 0.6, x + r * 1.0, cy - r * 0.6], fill=255, width=lw)
    a = np.asarray(img.resize((W * 12, Hh * 12), Image.LANCZOS))
    out = np.zeros(a.shape + (4,), np.uint8)
    out[..., :3] = 246
    out[..., 3] = (a * 0.85).astype(np.uint8)
    name = f"print_{kind}.png"
    Image.fromarray(out).save(os.path.join(OUT, name), optimize=True)
    print(name, out.shape[1], "x", out.shape[0])


def arctic():
    """"ARCTIC FREEZE" in spaced capitals across the deep drawer (open view: 120 mm wide, about 4 mm tall)"""
    k = 24
    W, Hh = 120, 8
    img = Image.new("L", (W * k, Hh * k), 0)
    d = ImageDraw.Draw(img)
    f = font(DEMI, 4 * k / 0.72)
    s = "ARCTIC FREEZE"
    widths = [f.getlength(ch) for ch in s]
    sp = (W * k - sum(widths)) / (len(s) - 1)
    x = 0
    for ch, wpx in zip(s, widths):
        d.text((x, 6 * k), ch, font=f, fill=255, anchor="ls")
        x += wpx + sp
    a = np.asarray(img.resize((W * 12, Hh * 12), Image.LANCZOS))
    out = np.zeros(a.shape + (4,), np.uint8)
    out[..., :3] = 246
    out[..., 3] = (a * 0.9).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(OUT, "print_arctic.png"), optimize=True)
    print("print_arctic.png", out.shape[1], "x", out.shape[0])


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save_jpg(duo_noir_low(), "door_dn_low.jpg")
    save_jpg(marble("vc", "up"), "door_vc_up.jpg")
    save_jpg(marble("vc", "low"), "door_vc_low.jpg")
    save_jpg(marble("nb", "up"), "door_nb_up.jpg")
    mark_whirlpool()
    mark_6th(False)
    mark_6th(True)
    door_ui()
    panel360(False)
    panel360(True)
    icons("crisper")
    icons("fzdrawer")
    arctic()
