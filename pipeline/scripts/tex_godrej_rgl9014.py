"""Textures for the Godrej Eon Regalis WFEON RGL 9014 5.0 IDCRM CHGD, 9 kg front-load washer, Champagne Gold.

usage: python3 tex_godrej_rgl9014.py <photos dir> <logos dir> <out dir>
  photos: godrej_rgl9014/front.png        Godrej's straight-on photo of this model (9.0 kg print), as on Sangeetha's listing
                                            (1080 x 1080, 1.186 px per mm both ways)
          godrej_rgl9014/open_front.png   Godrej's straight-on photo with the door open (the seat, gasket, drum, latch)
          godrej_rgl9014/r34.png          Godrej's 3/4 photo from the right, door shut (the side wall's pressing)
          godrej_rgl9014/rear.png         Godrej's straight-on photo of the back (0.879 px per mm)
          godrej_rgl9014/drawer.png       Godrej's close-up with the drawer out (the drawer face's layout)
          godrej_rgl9014/manual_panel.png the control panel as Godrej's user manual for this model draws it (page 16, 1200 dpi)
  logos:  godrej.png
  writes <out dir>/godrej_rgl9014/*.jpg and layout.json (every position the builder needs, in metres)

Scale. Godrej publishes 596 W x 554 D x 840 H mm (its page for this model and the manual). In the front photo the cabinet
spans columns 187-894 (707 px) and rows 42 (the top) to 1038 (the floor under the feet): 1.186 px per mm both ways, so
the photo's pixels are square and the door rim is round in it. Every position here is measured on that photo.

The panel's print. The manual draws the panel's print (page 16) as vector art: every word, icon and key as Godrej prints
them. It is mapped onto the front photo with a fit on six key and word positions across and eight rows down (under half
a photo pixel off): the drawing is 0.87 as tall for its width as the panel shows in the photo, so it is scaled across and
down separately. The drawing's call-out lines are painted out and the white disc it draws for the knob is left black
(the knob is modelled). The black glass's outline is the photo's own.

The drawer face. Its words are set again where Godrej's drawer close-up (drawer.png, made square-on with a perspective
warp of the glass's corners) and the front photo put them: the Godrej mark from logos/godrej.png, the AI Tech badge, and
"1400 RPM | 9.0 kg" and "Digi Inverter" as the front photo of this model reads (the close-up is the 8 kg model's and reads
"8.0 kg" and "i-Sense | Digi Inverter"). Godrej's type is a geometric sans; it is set in Avenir Next, fitted to the size
and width of each line.
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
SRC = os.path.join(PHOTOS, "godrej_rgl9014")
D = os.path.join(OUT, "godrej_rgl9014")
os.makedirs(D, exist_ok=True)
rng = np.random.default_rng(9014)
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"          # faces: 2 Demi Bold, 5 Medium, 6 Medium Italic

W_MM, H_MM, D_MM = 596.0, 840.0, 554.0           # Godrej: 596 x 554 x 840 mm (W x D x H)

# ── the front photo's scale ──
K1, X0, YB = 1.186, 540.5, 1038.0                # px per mm; the cabinet's centre column; the floor's row


def fX(px):  # front photo column -> mm from the centre
    return (px - X0) / K1


def fY(py):  # front photo row -> mm above the floor
    return (YB - py) / K1


# ── the layout, mm (VERIFIED where Godrej gives it, else measured on Godrej's photos: ESTIMATED to +-2 mm) ──
FEET = fY(1016.5)                      # 18 mm: the feet under the cabinet's front edge (front photo rows 1016.5-1038)
BAND_BOT = fY(180)                     # 723.4: the panel band's lower edge (the drawer's legs and the grip recess end there)
DRAWER = (fX(192), fX(433.5))          # the drawer's face across: from the cabinet's left frame to the seam by the panel
LEGS = (fX(213), fX(418))              # the grip recess between the drawer face's two legs
GRIP_TOP = fY(146)                     # the drawer face's lower edge over the grip recess
DOOR = dict(x=fX(544.15), y=fY(500.66))          # the door's centre: a circle fitted to its chrome rim (4786 px)
RIM_R = 292.5 / K1                     # the rim's outer edge (246.6 mm)
CHROME_IN = 278 / K1                   # the chrome band's inner edge (234.4 mm)
DISH_R = 297.5 / K1                    # the door seat's outer edge (open-door photo: 250.8 mm)
OPEN = dict(x=DOOR["x"], y=DOOR["y"] + 27 / K1)  # the gasket's centre: 27 px (22.8 mm) above the door's (open-door photo)
GASKET_R = 218 / K1                    # the gasket's outer edge (183.8 mm)
LATCH = dict(x=fX(886 - 89), y=fY(471 + 2.7))   # the lock boss right of the opening, 42 x 80 mm (open-door photo, 89 px to the right of the front photo)
FLAP = dict(x=fX(803), y=fY(936), r=65 / K1)     # the round pump-filter flap, bottom right (its outline in the photo)
KNOB = dict(x=fX(536.5), y=fY(86), r=27.8)       # the programme knob: 66 px across in the photo
FEET_X = (fX(220), fX(861))            # the front feet's centres
BODY = np.array([185, 181, 177], np.float32)     # the cabinet's champagne where the front photo is evenly lit (rows 880-960)
GLASS = np.array([35, 31, 32], np.float32)       # the panel's black, as the manual's art prints it
SHADE = {"front.jpg": 0.74, "band": 0.67, "side_l.jpg": 0.82, "side_r.jpg": 0.82, "back.jpg": 0.9, "drum.jpg": 0.6}

S = 4096 / W_MM                       # band texture px per mm (6.87)
BH = round((H_MM - BAND_BOT) * S)     # band texture height


def load(name):
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    return np.asarray(bg.convert("RGB")).astype(np.float32)


def save(a, name, q=88):
    if name in SHADE:                  # lit by the viewer's environment light, a texture renders brighter than its pixels
        a = a * SHADE[name]
    p = os.path.join(D, name)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(p, quality=q, optimize=True)
    print("wrote", p, a.shape[1], a.shape[0])


def band_grid():
    """Front photo coordinates of every band texture pixel."""
    u, v = np.meshgrid(np.arange(4096, dtype=np.float32) + 0.5, np.arange(BH, dtype=np.float32) + 0.5)
    X, Y = u / S - W_MM / 2, H_MM - v / S
    return (X0 + X * K1).astype(np.float32), (YB - Y * K1).astype(np.float32)


def bu(X):  # mm across -> band px
    return (X + W_MM / 2) * S


def bv(Y):  # mm up -> band px
    return (H_MM - Y) * S


def text_ink(s, face, px=400, italic_pad=0.0):
    f = ImageFont.truetype(AVENIR, px, index=face)
    l, t, r, b = f.getbbox(s)
    im = Image.new("L", (r - l + 40, b - t + 40), 0)
    ImageDraw.Draw(im).text((20 - l, 20 - t), s, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    ys, xs = np.where(a > 0.5)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def place(canvas, ink, box, colour):
    """Fit an ink mask to the box (x0, x1, y0, y1 in mm: left, right, bottom, top) and paint it."""
    x0, x1, y0, y1 = box
    u0, u1, v0, v1 = bu(x0), bu(x1), bv(y1), bv(y0)
    w, h = max(1, round(u1 - u0)), max(1, round(v1 - v0))
    m = np.asarray(Image.fromarray((ink * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    m = np.clip((m - 0.5) * 1.6 + 0.5, 0, 1)
    ui, vi = round(u0), round(v0)
    sub = canvas[vi:vi + h, ui:ui + w]
    sub[:] = sub * (1 - m[..., None]) + np.asarray(colour, np.float32) * m[..., None]


def panel_print():
    """The manual's panel art in band texture pixels, its call-out lines painted out and the knob's disc left black."""
    a = cv2.imread(os.path.join(SRC, "manual_panel.png"))[:, :, ::-1].astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lines = ((b - r) > 4).astype(np.uint8)                         # the call-outs are the only blue-grey in the art (103,112,115)
    lines = cv2.dilate(lines, np.ones((5, 5), np.uint8))
    a = cv2.inpaint(np.clip(a, 0, 255).astype(np.uint8), lines, 4, cv2.INPAINT_TELEA).astype(np.float32)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    a[np.hypot(xx - 1488.2, yy - 842.7) < 246] = GLASS             # the knob's white disc (r 232 px)
    # the fit: photo column = 468 + (art x - 605) * 0.07791; photo row = 41.293 + art y * 0.067707 (residuals < 0.45 px)
    ax, ay = 0.07791 / K1 * S, 0.067707 / K1 * S                  # band px per art px, across and down
    bx = ((468 - 605 * 0.07791 - X0) / K1 + W_MM / 2) * S
    by = (H_MM - (YB - 41.293) / K1) * S
    small = cv2.resize(a, (round(a.shape[1] * ax), round(a.shape[0] * ay)), interpolation=cv2.INTER_AREA)
    sx, sy = a.shape[1] * ax / small.shape[1], a.shape[0] * ay / small.shape[0]
    M = np.float32([[sx, 0, bx], [0, sy, by]])
    return cv2.warpAffine(small, M, (4096, BH), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))


def drawer_print(c):
    """The drawer face's print on the black glass (canvas c, band px)."""
    white = (238, 238, 238)
    dx = -1.8                         # the close-up's warp and the front photo agree to this offset across (the photo's)
    logo = np.asarray(Image.open(os.path.join(LOGOS, "godrej.png")).convert("RGBA"))[..., 3].astype(np.float32) / 255
    ys, xs = np.where(logo > 0.3)
    place(c, logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (-277.2 + dx, -234.0 + dx, 806.3, 824.9), white)
    # the AI Tech badge: a white rounded square with AI cut out of it, then Tech
    x0, x1, y0, y1 = -131.5 + dx, -122.7 + dx, 812.7, 819.9
    u0, u1, v0, v1 = round(bu(x0)), round(bu(x1)), round(bv(y1)), round(bv(y0))
    m = Image.new("L", ((u1 - u0) * 4, (v1 - v0) * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, m.width - 1, m.height - 1], radius=round(1.0 * S * 4), fill=255)
    m = np.asarray(m.resize((u1 - u0, v1 - v0), Image.LANCZOS)).astype(np.float32)[..., None] / 255
    sub = c[v0:v1, u0:u1]
    sub[:] = sub * (1 - m) + np.array(white, np.float32) * m
    place(c, text_ink("AI", 2), (x0 + 1.75, x1 - 1.75, y0 + 1.7, y1 - 2.0), GLASS)
    place(c, text_ink("Tech", 5), (-121.7 + dx, -108.5 + dx, 814.8, 818.3), white)
    place(c, text_ink("1400 RPM", 5), (-173.6 + dx, -146.2 + dx, 767.1, 771.2), white)
    place(c, np.ones((40, 4), np.float32), (-140.7 + dx, -140.1 + dx, 766.9, 772.3), white)
    place(c, text_ink("9.0 kg", 5), (-136.2 + dx, -109.3 + dx, 764.6, 772.2), white)
    place(c, text_ink("Digi Inverter", 6), (-139.9 + dx, -109.6 + dx, 759.7, 764.4), white)


def band():
    """The panel band across the top, 596 x 116.6 mm (723.4-840 mm up), 6.87 px per mm: the champagne frame as the front
    photo shows it (enlarged), the black glass of the drawer and of the panel in the photo's outline, and the print sharp."""
    ph = load("front.png")
    mx, my = band_grid()
    a = cv2.remap(ph, mx, my, cv2.INTER_CUBIC)
    a = cv2.GaussianBlur(a, (0, 0), 1.2)
    edge = round(2.5 * S)                                          # the cabinet's outermost edge columns belong to the sides
    a[:, :edge] = a[:, edge:edge + 1]
    a[:, -edge:] = a[:, -edge - 1:-edge]
    # the glass: the photo's dark, closed over the print, its holes filled, then smoothed and enlarged
    g = ph.mean(2)
    dark = ((g < 100) & (np.arange(ph.shape[0])[:, None] >= 47) & (np.arange(ph.shape[0])[:, None] <= 150)).astype(np.uint8)
    dark[:, :195] = 0
    dark[:, 891:] = 0
    dark[:, 431:438] = 0                                           # the champagne seam between the drawer and the panel
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    ff = dark.copy()
    cv2.floodFill(ff, None, (0, 0), 1)
    dark = dark | (1 - ff)
    dark[:, 431:438] = 0
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    dm = cv2.GaussianBlur(dark.astype(np.float32), (0, 0), 0.8)
    m = cv2.remap(dm, mx, my, cv2.INTER_LINEAR)
    alpha = np.clip((m - 0.5) * 8 + 0.5, 0, 1)[..., None]
    a = a * SHADE["band"]
    glass = np.broadcast_to(GLASS, a.shape).copy()
    pp = panel_print()
    right = (np.arange(4096) >= bu(fX(436)))[None, :, None]
    inner = cv2.erode((alpha[..., 0] > 0.5).astype(np.uint8), np.ones((5, 5), np.uint8))[..., None].astype(np.float32)
    glass = np.where(right & (inner > 0), pp, glass)
    drawer_print(glass)
    lum = glass.mean(2, keepdims=True)                             # the glass's black a little deeper: the render's gloss
    glass = glass * (0.68 + 0.32 * np.clip((lum - 35) / 60, 0, 1))  # lifts it (front photo 26, the art 35 before this)
    a = a * (1 - alpha) + glass * alpha
    save(a, "band.jpg", 92)
    return alpha[..., 0]


def front():
    """The front below the band, 596 x 705 mm (18-723.4 mm up), 2 px per mm: the photo's own paint with the studio light
    evened out, the door and its seat filled in from round about (the builder cuts the seat and models the door), the
    pump-filter flap's outline kept."""
    ph = load("front.png")
    k = 2.0
    w, h = round(W_MM * k), round((BAND_BOT - FEET) * k)
    xs = X0 + (np.arange(w) / k - W_MM / 2) * K1
    ys = YB - (BAND_BOT - np.arange(h) / k) * K1
    mx, my = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
    a = cv2.remap(ph, mx, my, cv2.INTER_LINEAR)
    a[:, :5] = a[:, 5:6]
    a[:, -5:] = a[:, -6:-5]
    yy, xx = np.mgrid[0:h, 0:w]
    Xmm, Ymm = xx / k - W_MM / 2, BAND_BOT - yy / k
    r = np.hypot(Xmm - DOOR["x"], Ymm - DOOR["y"])
    lum = a.mean(2)
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    use = ((r > DISH_R + 10) & (np.hypot(Xmm - FLAP["x"], Ymm - FLAP["y"]) > FLAP["r"] + 6) & (yy > 12) & (Ymm > 60)).reshape(-1)
    use &= (xx.reshape(-1) > 14) & (xx.reshape(-1) < w - 14)
    cf, *_ = np.linalg.lstsq(A[use], np.log(np.maximum(lum, 1)).reshape(-1)[use], rcond=None)
    n = lum / np.exp(A @ cf).reshape(h, w)
    n = 1 + (n / np.median(n.reshape(-1)[use]) - 1) * 0.8
    a = np.clip(n, 0.3, 2.0)[..., None] * BODY
    # the door and its seat, filled from the paint just outside the seat at the same angle, fading a little toward the median inward
    R0 = DISH_R + 10
    ang = np.arctan2(Ymm - DOOR["y"], Xmm - DOOR["x"])
    ts = np.linspace(-np.pi, np.pi, 721)
    sx = (DOOR["x"] + R0 * np.cos(ts) + W_MM / 2) * k
    sy = (BAND_BOT - (DOOR["y"] + R0 * np.sin(ts))) * k
    ok = (sx >= 0) & (sx < w) & (sy >= 0) & (sy < h)
    ring = np.zeros((len(ts), 3), np.float32)
    ring[ok] = a[sy[ok].astype(int), sx[ok].astype(int)]
    med = np.median(a.reshape(-1, 3), 0)
    iok = np.where(ok)[0]
    for c in range(3):
        ring[~ok, c] = np.interp(np.where(~ok)[0], np.r_[iok - 721, iok, iok + 721], np.tile(ring[iok, c], 3))
    ker = np.exp(-np.linspace(-3, 3, 61) ** 2)
    ker /= ker.sum()
    ring = np.stack([np.convolve(np.r_[ring[-30:, c], ring[:, c], ring[:30, c]], ker, "same")[30:-30] for c in range(3)], 1)
    idx = np.clip(np.round((ang + np.pi) / (2 * np.pi) * 720).astype(int), 0, 720)
    t = np.clip(r / R0, 0, 1)[..., None] ** 2
    fill = ring[idx] * (0.85 + 0.15 * t) + med * 0.15 * (1 - t) + rng.normal(0, 1.0, (h, w))[..., None]
    hole = cv2.GaussianBlur((r < DISH_R + 7).astype(np.float32), (0, 0), 1.5)[..., None]
    a = cv2.GaussianBlur(a, (0, 0), 0.7) * (1 - hole) + fill * hole
    a[:4] = a[4:5]
    save(a, "front.jpg", 88)


def side_r():
    """The right side wall from Godrej's 3/4 photo, square-on (a perspective warp of the wall's corners: front top, back top,
    back bottom, front bottom), 1.5 px per mm, from under the top plate (828 mm) to the cabinet's bottom (18 mm). The
    studio light evened out, the pressed racetrack's own light and shade kept, tinted to the cabinet's champagne. The left
    wall carries the same pressing (Godrej's open 3/4 photo and the manual's cover show it): it is this one, mirrored."""
    ph = load("r34.png")
    k = 1.5
    w, h = round(D_MM * k), round((H_MM - 12 - FEET) * k)
    quad = [(598, 268), (767, 210), (745, 720), (596, 822)]
    M = cv2.getPerspectiveTransform(np.float32(quad), np.float32([(0, 0), (w, 0), (w, h), (0, h)]))
    a = cv2.warpPerspective(ph, M, (w, h), flags=cv2.INTER_LINEAR)
    lum = a.mean(2)
    yy, xx = np.mgrid[0:h, 0:w]
    x, y = xx / w - 0.5, yy / h - 0.5
    A = np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1).reshape(-1, 6)
    cf, *_ = np.linalg.lstsq(A, np.log(np.maximum(lum, 1)).reshape(-1), rcond=None)
    n = lum / np.exp(A @ cf).reshape(h, w)
    n = 1 + (n / np.median(n) - 1) * 0.8
    n = cv2.GaussianBlur(n, (0, 0), 0.7)
    n[:, :4] = n[:, 4:5]; n[:, -4:] = n[:, -5:-4]; n[:3] = n[3:4]; n[-3:] = n[-4:-3]
    out = np.clip(n, 0.3, 2.0)[..., None] * BODY
    save(out, "side_r.jpg", 88)
    save(out[:, ::-1], "side_l.jpg", 88)


def back():
    """The back from Godrej's rear photo, square-on already (0.879 px per mm), from under the top plate (828 mm) to the
    cabinet's bottom (18 mm): the pressed panel, the four transit bolts, the inlet valve, the drain outlet and the cord as
    the photo shows them, enlarged to 1.5 px per mm. The builder models the cord, the plug, the bolts' heads and the valve
    over their places."""
    ph = load("rear.png")
    kx, ky = 521 / W_MM, (876 - 138) / H_MM
    k = 1.5
    w, h = round(W_MM * k), round((H_MM - 12 - FEET) * k)
    xs = 202.5 + np.arange(w) / k * kx
    ys = 876 - (H_MM - 12 - np.arange(h) / k) * ky
    mx, my = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
    a = cv2.remap(ph, mx, my, cv2.INTER_LINEAR)
    a[:, :3] = a[:, 3:4]; a[:, -3:] = a[:, -4:-3]
    lum = a.mean(2)
    med = np.median(lum)
    a = a / med * BODY * 0.92                                      # the photo is darker than the front: the same paint, unlit
    save(a, "back.jpg", 86)


def drum():
    """The drum wall, front (top of the image) to back, one 100 mm strip of its circumference (tiled round it): Godrej's
    FabriSafe drum as its drum close-up shows it, staggered rows of raised round pads with small holes between them, then
    plain polished steel to the back. 4 px per mm, 100 x 300 mm. Pad size and pitch ESTIMATED from the close-up."""
    k = 4.0
    w, h = round(100 * k), round(300 * k)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ymm, xmm = yy / k, xx / k
    a = 150 + 22 * np.cos(xmm / 100 * 2 * np.pi) + cv2.GaussianBlur(rng.normal(0, 14, (h, w)).astype(np.float32), (0, 0), sigmaX=0.6, sigmaY=30)
    im = Image.fromarray(np.repeat(a[..., None], 3, 2).clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    pitch, pr = 25.0, 8.5
    for i, y in enumerate(np.arange(20, 230, pitch * 0.866)):
        off = pitch / 2 if i % 2 else 0
        for x in np.arange(off - pitch, 100 + pitch, pitch):
            X, Y = x * k, y * k
            d.ellipse([X - pr * k, Y - pr * k, X + pr * k, Y + pr * k], fill=(178, 180, 184))
            d.arc([X - pr * k, Y - pr * k, X + pr * k, Y + pr * k], 180, 360, fill=(222, 224, 228), width=5)
            d.arc([X - pr * k, Y - pr * k, X + pr * k, Y + pr * k], 0, 180, fill=(92, 94, 98), width=5)
            for hx, hy in ((x + pitch / 2, y), (x + pitch / 4, y + pitch * 0.433), (x + pitch * 0.75, y + pitch * 0.433)):
                d.ellipse([hx * k - 4, hy * k - 4, hx * k + 4, hy * k + 4], fill=(24, 25, 27))
    a = np.asarray(im).astype(np.float32) * np.array([1.0, 1.01, 1.03])
    save(a, "drum.jpg", 86)


band()
front()
side_r()
back()
drum()

m = lambda v: round(v / 1000, 5)
layout = {
    "feet": m(FEET), "band_bot": m(BAND_BOT), "drawer": [m(v) for v in DRAWER], "legs": [m(v) for v in LEGS], "grip_top": m(GRIP_TOP),
    "door": {"x": m(DOOR["x"]), "y": m(DOOR["y"]), "rim": m(RIM_R), "chrome_in": m(CHROME_IN), "dish": m(DISH_R)},
    "open": {"x": m(OPEN["x"]), "y": m(OPEN["y"]), "gasket": m(GASKET_R)},
    "latch": {"x": m(LATCH["x"]), "y": m(LATCH["y"])},
    "flap": {"x": m(FLAP["x"]), "y": m(FLAP["y"]), "r": m(FLAP["r"])},
    "knob": {"x": m(KNOB["x"]), "y": m(KNOB["y"]), "r": m(KNOB["r"])},
    "feet_x": [m(v) for v in FEET_X],
}
with open(os.path.join(D, "layout.json"), "w") as f:
    json.dump(layout, f, indent=1)
print(json.dumps(layout))
