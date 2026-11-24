"""Textures for the LG DFB532FP dishwasher (Silver), from LG's own photos and owner's manual.

usage: python3 tex_lg_dfb532.py <photos dir> <logos dir> <out dir> [--compare <dir>] [function names]
  photos: lg_dfb532/  DZ-01.jpg (front), DZ-02.jpg (front, door down, racks in), DZ-04.jpg (door half open, from above),
          DZ-13.jpg (left side), DZ-14.jpg (back),
          manual_p26_panel_l.png / manual_p26_panel_r.png (the steam model's control-panel drawing on page 26 of LG's owner's
          manual MFL70282499, which covers DFB424 / DFB532 / DFB512; rendered at 1000 dpi and cut to 1 bit; the manual draws
          the panel in two halves)
  writes <out dir>/lg_dfb532/

LG's photos are not to scale on both axes (DZ-01 is 680.5 px across and 925 px high for LG's 600 x 850 mm), so every
photo is read in millimetres per axis: DZ-01 x (X - 460.5) * 600 / 680.5, height (994.5 - Y) * 850 / 925.

The control panel's print (the strip across the top of the door) is drawn again at 12 px/mm from the manual's drawing: each
half of the drawing is placed with one scale (mm per drawing px) and an offset, fitted to two ink centres in DZ-01 (the power
icon and "Download Cycle"; "Dual Zone" and "START"). What the manual draws but the panel does not print (DZ-01, DZ-04): the
frame and the break lines, the numbered callouts, their leader lines and dots, the display's dashed box and START's grey box.
The display's segments are unlit (DZ-01 shows them only as a faint lighter "8:88"). LG's mark, at the left (DZ-01: a light
mark), is tex_lg_mark.lg_hi with the face cut out. "STEAM CYCLES" and its rule are the panel's one colour, a pinkish red
(DZ-01: the strongest pixels 191 / 138 / 152 on the 210 ground; ink about 180 / 70 / 105 at the coverage of such thin
letters: ESTIMATED).

The door's top edge (seen when the door is down) prints "ThinQ" at the left and, at the right, the Smart Diagnosis mark and
LG's Inverter Direct Drive motor / 10 year warranty badge (DZ-02, DZ-04). "ThinQ" is set again in a bold italic; the badge is
the same LG artwork as the FHB1209's (pipeline/tex/lg_fhb1209/mark.png, the layout matches DZ-04), recoloured dark; the Smart
Diagnosis mark is too small in every LG photo to redraw and stays as the photo.

The rest are LG's photos laid on the faces: the brushed door (DZ-01, with its studio light bands), the panel strip with
its print painted out (so the sharp print sits on the photo's own light), the handle's undercut, the kick plate, the sides
(DZ-13), the back (DZ-14), the door's inside (DZ-02, rectified), the steam nozzle plate, the cutlery basket and the upper
rack's handle bar (DZ-02).
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = sys.argv[5] if len(sys.argv) > 5 and sys.argv[4] == "--compare" else None
SRC = os.path.join(PHOTOS, "lg_dfb532")
DEST = os.path.join(OUT, "lg_dfb532")
os.makedirs(DEST, exist_ok=True)
if COMPARE:
    os.makedirs(COMPARE, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tex_lg_mark  # noqa: E402

FUTURA = "/System/Library/Fonts/Supplemental/Futura.ttc"
HI = 12.0
INK, PINK, DOTS, SEG = (58, 58, 61), (180, 70, 105), (118, 118, 121), (236, 236, 238)
# DZ-01: millimetres per photo px across and up; the panel strip's top and bottom rows
XS, YS, X0, FLOOR = 600 / 680.5, 850 / 925, 460.5, 994.5
BAND0, BAND1 = 111.5, 172.0
BAND_H = (BAND1 - BAND0) * YS


def load(name, mode="RGB"):
    return Image.open(os.path.join(SRC, name)).convert(mode)


def save(img, name, q=88):
    p = os.path.join(DEST, name)
    if name.endswith(".png"):
        img.save(p, optimize=True)
    else:
        img.convert("RGB").save(p, quality=q, optimize=True)
    print("wrote", p, img.size)


def crop_mm(img, box, w_mm, h_mm, ppm):
    """A photo window resampled to w_mm x h_mm at ppm px/mm."""
    return img.crop(box).resize((round(w_mm * ppm), round(h_mm * ppm)), Image.LANCZOS)


def warp(img, quad, w_mm, h_mm, ppm):
    """The photo quad (tl, tr, br, bl) rectified to w_mm x h_mm at ppm px/mm."""
    W, H = round(w_mm * ppm), round(h_mm * ppm)
    M = cv2.getPerspectiveTransform(np.float32(quad), np.float32([[0, 0], [W, 0], [W, H], [0, H]]))
    a = cv2.warpPerspective(np.asarray(img), M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return Image.fromarray(a)


def photo_centroid(V, win):
    """Ink centre (dark on light) inside a DZ-01 window."""
    x0, y0, x1, y1 = win
    sub = V[y0:y1, x0:x1].astype(float)
    bg = np.median(np.concatenate([sub[0], sub[-1], sub[:, 0], sub[:, -1]]))
    w = np.clip(bg - sub - 12, 0, None)
    ys, xs = np.mgrid[y0:y1, x0:x1]
    return (xs * w).sum() / w.sum() + 0.5, (ys * w).sum() / w.sum() + 0.5


def ink_centroid(ink, win):
    x0, y0, x1, y1 = win
    ys, xs = np.where(ink[y0:y1, x0:x1])
    return x0 + xs.mean() + 0.5, y0 + ys.mean() + 0.5


def clean_drawing(ink, dashed=None):
    """The manual's ink without the frame, break lines, callouts, leaders and (in a box) the dashed outline."""
    H, W = ink.shape
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink.astype(np.uint8), 8)
    keep = np.zeros(n, bool)
    discs = [st[i][:4] for i in range(1, n) if 55 <= st[i][2] <= 140 and 55 <= st[i][3] <= 140
             and abs(st[i][2] - st[i][3]) < 18 and st[i][4] > 0.5 * st[i][2] * st[i][3]]
    for i in range(1, n):
        x, y, w, h, area = st[i]
        if any(dx <= x and x + w <= dx + dw and dy <= y and y + h <= dy + dh and (dw, dh) != (w, h) for dx, dy, dw, dh in discs):
            continue                                   # an island inside a callout's digit (the 4's and the 6's counters)
        if x <= 2 or x + w >= W - 2:
            continue                                   # a callout cut by the drawing's edge
        if w >= 300 and area < 0.2 * w * h and y > 0.35 * H:
            continue                                   # START's leader with its dot
        if w > 0.5 * W or h > 0.6 * H:
            continue                                   # the frame with the leaders and dots joined to it, the break lines
        if 55 <= w <= 140 and 55 <= h <= 140 and abs(w - h) < 18 and area > 0.5 * w * h:
            continue                                   # a numbered callout disc (its digit is a hole in it)
        if h >= 150 or (w >= 300 and h <= 8 and y > 0.7 * H):
            continue                                   # a leader line with its dot, or the leaders' joining line at the bottom
                                                       # (the group rules under the headings are near the top and stay)
        if dashed is not None:
            bx0, by0, bx1, by1 = dashed
            near = min(abs(x - bx0), abs(x + w - bx1), abs(y - by0), abs(y + h - by1)) < 22
            inside = bx0 - 25 <= x and x + w <= bx1 + 25 and by0 - 25 <= y and y + h <= by1 + 25
            if inside and near and max(w, h) < 70:
                continue                               # a dash of the display's dashed box
        keep[i] = True
    return keep[lab], lab, st, keep


def panel():
    """The panel strip's print at 12 px/mm as two transparent halves (print_l.png, print_r.png) and panel_print.json."""
    V = np.asarray(load("DZ-01.jpg", "L")).astype(float)
    Wpx, Hpx = round(600 * HI), round(BAND_H * HI)
    canvas = np.zeros((Hpx, Wpx, 4), np.float32)

    def stamp(mask, colour, ox, oy, k):
        """Paint a drawing mask (manual px) at k mm per px with its (0, 0) at (ox, oy) mm on the strip."""
        h, w = mask.shape
        s = k * HI
        M = np.float32([[s, 0, ox * HI], [0, s, oy * HI]])
        a = cv2.warpAffine(mask.astype(np.float32), M, (Wpx, Hpx), flags=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
        a = np.clip(a, 0, 1)
        for c in range(3):
            canvas[..., c] = canvas[..., c] * (1 - a) + colour[c] * a
        canvas[..., 3] = canvas[..., 3] * (1 - a) + 255 * a

    def place(name, anchors, dashed, pink_box, seg_box):
        ink = np.asarray(load(name, "L")) < 128
        keep, lab, st, kept = clean_drawing(ink, dashed)
        (m0, p0), (m1, p1) = anchors
        c0, c1 = ink_centroid(ink, m0), ink_centroid(ink, m1)
        q0, q1 = photo_centroid(V, p0), photo_centroid(V, p1)
        k = (q1[0] - q0[0]) * XS / (c1[0] - c0[0])                       # mm per drawing px
        ox = (q0[0] - X0) * XS - c0[0] * k
        oy = (q0[1] - BAND0) * YS - c0[1] * k
        print(name, "mm/px %.5f" % k, "anchor 2 off by %.2f mm across" % ((q1[0] - X0) * XS - (ox + c1[0] * k)),
              "%.2f mm down" % ((q1[1] - BAND0) * YS - (oy + c1[1] * k)))
        pink = np.zeros_like(keep)
        seg = np.zeros_like(keep)
        if pink_box:
            x0, y0, x1, y1 = pink_box
            pink[y0:y1, x0:x1] = keep[y0:y1, x0:x1]
        if seg_box:
            x0, y0, x1, y1 = seg_box
            seg[y0:y1, x0:x1] = keep[y0:y1, x0:x1]
        # the LED dots over the buttons: small round specks
        dots = np.zeros_like(keep)
        for i in np.where(kept)[0]:
            x, y, w, h, area = st[i]
            if w <= 16 and h <= 16:
                dots[lab == i] = True
        dots &= ~seg
        if seg_box:
            dots[267:339, 3071:3173] = False           # the rinse-aid icon's rays are print, not LED dots
        rest = keep & ~pink & ~seg & ~dots
        stamp(rest, INK, ox, oy, k)
        stamp(pink, PINK, ox, oy, k)
        stamp(dots, DOTS, ox, oy, k)
        if seg.any():
            stamp(seg * 0.55, SEG, ox, oy, k)
        return k

    # left half: power icon and "Download Cycle"; the display's dashed box; STEAM CYCLES and its rule; the 8:88
    place("manual_p26_panel_l.png",
          [((362, 290, 464, 420), (545, 133, 561, 152)), ((2550, 275, 2883, 449), (718, 135, 747, 153))],
          (3274, 191, 3946, 522), (1029, 120, 1898, 212), (3300, 215, 3920, 500))
    # right half: "Dual Zone" and "START"
    place("manual_p26_panel_r.png",
          [((368, 263, 536, 420), (860, 133, 883, 152)), ((2639, 290, 2870, 378), (1035, 135, 1064, 151))],
          None, None, None)

    # LG's mark at the left: the disc filled, the face cut out, one light colour (DZ-01 x 485-535, y 129-154)
    lg = tex_lg_mark.lg_hi(LOGOS, 2400)
    c = np.asarray(lg).astype(float)
    A = c[..., 3] / 255.0
    ys, xs = np.where(A > 0.08)
    c, A = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1], A[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    red = (c[..., 0] > 110) & (c[..., 1] < 90) & (A > 0.5)
    ys, xs = np.where(red)
    dcx, dcy, dr = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2, (xs.max() - xs.min() + ys.max() - ys.min()) / 4
    yy, xx = np.mgrid[0:c.shape[0], 0:c.shape[1]]
    inside = np.clip(dr + 0.5 - np.hypot(xx - dcx, yy - dcy), 0, 1)
    white = np.clip((c[..., :3].min(2) - 150) / 70, 0, 1)
    al = np.maximum(A * (1 - inside), inside * (1 - white))
    bx0, by0, bx1, by1 = 485.5, 131.0, 535.5, 153.5                     # the mark's ink box in DZ-01 (ESTIMATED to 0.5 px)
    w, h = round((bx1 - bx0) * XS * HI), round((by1 - by0) * YS * HI)
    a = cv2.resize(al.astype(np.float32), (w, h), interpolation=cv2.INTER_AREA)
    x, y = round((bx0 - X0) * XS * HI), round((by0 - BAND0) * YS * HI)
    for ch, v in enumerate((236, 236, 238)):
        canvas[y:y + h, x:x + w, ch] = canvas[y:y + h, x:x + w, ch] * (1 - a) + v * a
    canvas[y:y + h, x:x + w, 3] = np.maximum(canvas[y:y + h, x:x + w, 3], 255 * a)
    # a thin darker rim round the light mark, as the photo shows it against the steel
    rim = cv2.dilate((a > 0.5).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(np.float32) - (a > 0.5)
    rim = cv2.GaussianBlur(rim, (3, 3), 0) * 0.5
    for ch, v in enumerate((120, 120, 123)):
        canvas[y:y + h, x:x + w, ch] = canvas[y:y + h, x:x + w, ch] * (1 - rim) + v * rim
    canvas[y:y + h, x:x + w, 3] = np.maximum(canvas[y:y + h, x:x + w, 3], 255 * rim)

    out = np.zeros_like(canvas)
    nz = canvas[..., 3] > 0
    out[..., :3] = np.where(nz[..., None], canvas[..., :3] / np.maximum(canvas[..., 3:4] / 255, 1e-3), 0)
    out[..., 3] = canvas[..., 3]
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    # two halves at the empty gap between the display's icons and "Dual Zone" (DZ-01 x 845-860)
    cut = round((850 - X0) * XS * HI)
    meta = {}
    for key, (u0, u1) in {"l": (0, cut), "r": (cut, Wpx)}.items():
        piece = img.crop((u0, 0, u1, Hpx))
        al_ = np.asarray(piece)[..., 3]
        ys, xs = np.where(al_ > 0)
        pad = 12
        bx = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(piece.width, xs.max() + 1 + pad), min(Hpx, ys.max() + 1 + pad))
        piece = piece.crop(bx)
        save(piece, f"print_{key}.png")
        meta[key] = {"file": f"print_{key}.png", "x_mm": (u0 + bx[0]) / HI, "y_mm": bx[1] / HI, "w_mm": piece.width / HI,
                     "h_mm": piece.height / HI}
    meta["band"] = {"top_mm": (FLOOR - BAND0) * YS, "h_mm": BAND_H}
    json.dump(meta, open(os.path.join(DEST, "panel_print.json"), "w"), indent=1)
    if COMPARE:
        ph = load("DZ-01.jpg").crop((round(X0), round(BAND0), round(X0 + 680.5), round(BAND1)))
        ph = ph.resize((Wpx // 2, Hpx // 2), Image.LANCZOS)
        bg = Image.new("RGB", (Wpx, Hpx), (200, 200, 202))
        bg.paste(img, (0, 0), img)
        both = Image.new("RGB", (Wpx // 2, Hpx), "white")
        both.paste(ph, (0, 0))
        both.paste(bg.resize((Wpx // 2, Hpx // 2), Image.LANCZOS), (0, Hpx // 2))
        both.save(os.path.join(COMPARE, "panel_compare.png"))


def painted_out(img, thr=10, grow=2, k=15):
    """The photo with its dark and coloured print painted out (inpainted from the steel round it)."""
    a = np.asarray(img).astype(np.uint8)
    g = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float32)
    med = cv2.medianBlur(g.astype(np.uint8), k).astype(np.float32)
    sat = a.max(2).astype(np.float32) - a.min(2)
    m = ((med - g) > thr) | ((g - med) > thr + 8) | (sat > 12)
    m = cv2.dilate(m.astype(np.uint8), np.ones((2 * grow + 1, 2 * grow + 1), np.uint8))
    return Image.fromarray(cv2.inpaint(a, m, 5, cv2.INPAINT_TELEA))


def front():
    """The door's face, the panel strip (print painted out), the handle's undercut, the kick plate, the top cover's edge."""
    im = load("DZ-01.jpg")
    xa, xb = X0, X0 + 680.5
    save(crop_mm(im, (xa, 222.5, xb, 907.5), 600, (907.5 - 222.5) * YS, 1.2), "door_front.jpg")
    band = im.crop((round(xa), round(BAND0), round(xb), round(BAND1)))
    big = band.resize((band.width * 3, band.height * 3), Image.BICUBIC)
    clean = np.asarray(painted_out(big, thr=5, grow=4, k=45)).astype(np.float32)
    # the steel's light runs smoothly across the strip: smoothed along it (keeping its rows) so no ghost of a word stays
    clean = cv2.GaussianBlur(clean, (0, 0), sigmaX=40, sigmaY=1.2, borderType=cv2.BORDER_REFLECT)
    save(Image.fromarray(np.clip(clean, 0, 255).astype(np.uint8)).resize((round(600 * 2), round(BAND_H * 2)), Image.LANCZOS), "band.jpg")
    save(crop_mm(im, (xa, BAND1, xb, 222.5), 600, (222.5 - BAND1) * YS, 2), "recess.jpg")
    save(crop_mm(im, (xa, 916.5, xb, FLOOR), 600, (FLOOR - 916.5) * YS, 1.2), "kick.jpg")
    save(crop_mm(im, (xa, 70.0, xb, 107.0), 600, 37 * YS, 1.2), "cover_front.jpg")


def sides_and_back():
    """The left side (DZ-13, also mirrored onto the right) and the back (DZ-14)."""
    im = load("DZ-13.jpg")
    zs, hs = 600 / 670.5, 850 / 927                                     # DZ-13: mm per px along the depth and up
    # the cabinet's side from the door's back (x 538) to its back (x 1116), from under the top cover (y 106) to the floor
    save(crop_mm(im, (538, 106, 1116, 993.5), (1116 - 538) * zs, (993.5 - 106) * hs, 1.2), "side.jpg")
    save(crop_mm(im, (484, 66.5, 1154, 106), (1154 - 484) * zs, (106 - 66.5) * hs, 1.2), "cover_side.jpg")
    im = load("DZ-14.jpg")
    xs_, hs_ = 600 / 668, 850 / 922
    save(crop_mm(im, (464, 106, 1132, 991), 600, (991 - 106) * hs_, 1.2), "back.jpg")
    save(crop_mm(im, (464, 69, 1132, 106), 600, (106 - 69) * hs_, 1.2), "cover_back.jpg")


def inside():
    """The door's inside (DZ-02 rectified), the steam nozzle plate, the cutlery basket, the upper rack's handle bar."""
    im = load("DZ-02.jpg")
    # the door's inner face from its hinge end (y 770) to its top edge (y 945): the edges read off DZ-02 (ESTIMATED)
    save(warp(im, [(520, 770), (1075, 770), (1126, 945), (472, 945)], 600, 640, 1.0), "door_inner.jpg")
    # the door's top edge, straight on in DZ-02 (y 945-991): ThinQ and the badge are drawn again over it in topedge()
    save(crop_mm(im, (472, 945, 1126, 991), 600, 47, 3), "door_top_photo.jpg")
    save(crop_mm(im, (585, 712, 985, 768), 431, 60, 1.6), "nozzles.jpg")
    save(crop_mm(im, (733, 583, 868, 722), 145, 150, 2.5), "basket.jpg")
    save(crop_mm(im, (572, 290, 1012, 334), 474, 47, 2.5), "rack_bar.jpg")


def topedge():
    """The door's top edge at 3 px/mm from DZ-04 (rectified; ThinQ and the badge painted out) and the sharp print over it."""
    im = load("DZ-04.jpg")
    base = warp(im, [(293, 621), (1304, 621), (1318, 690), (282, 690)], 600, 47, 3)
    save(painted_out(base, thr=14, grow=3), "door_top.jpg")
    # the print: "ThinQ" at x 9.5-34 mm, 20-29 mm from the back edge; the badge at the right (DZ-04, rectified)
    def mm(x, y):
        u = (x - 293 + (y - 621) * (11 / 69)) / (1011 + (y - 621) * (25 / 69)) * 600
        return u, (y - 621) / 69 * 47
    W, H = round(600 * HI), round(47 * HI)
    can = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    f = ImageFont.truetype(FUTURA, 300, index=4)                       # Futura Condensed ExtraBold
    lay = Image.new("L", (1400, 420), 0)
    d = ImageDraw.Draw(lay)
    d.text((40, 20), "ThinQ", font=f, fill=255)
    a = np.asarray(lay)
    ys, xs = np.where(a > 0)
    lay = lay.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    lay = lay.transform(lay.size, Image.AFFINE, (1, 0.2, -0.2 * lay.height, 0, 1, 0), Image.BICUBIC)   # the logo leans 11 deg
    lay = lay.crop((0, 0, lay.width, lay.height))
    (u0, v0), (u1, v1) = mm(308, 650), mm(350, 663.5)
    lay = lay.resize((round((u1 - u0) * HI), round((v1 - v0) * HI)), Image.LANCZOS)
    can.paste(Image.new("RGBA", lay.size, (40, 40, 42, 255)), (round(u0 * HI), round(v0 * HI)), lay)
    mark = Image.open(os.path.join(OUT, "lg_fhb1209", "mark.png")).convert("RGBA")
    ma = np.asarray(mark)[..., 3]
    ys, xs = np.where(ma > 0)
    mark = mark.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    (u0, v0), (u1, v1) = mm(1221.5, 649.5), mm(1293.5, 668.5)
    al = mark.split()[3].resize((round((u1 - u0) * HI), round((v1 - v0) * HI)), Image.LANCZOS)
    can.paste(Image.new("RGBA", al.size, (34, 34, 36, 255)), (round(u0 * HI), round(v0 * HI)), al)
    al_ = np.asarray(can)[..., 3]
    ys, xs = np.where(al_ > 0)
    meta = {}
    for key, (x0, x1) in {"thinq": (0, W // 2), "badge": (W // 2, W)}.items():
        sub = al_[:, x0:x1]
        ys, xs = np.where(sub > 0)
        bx = (x0 + xs.min() - 12, ys.min() - 12, x0 + xs.max() + 13, ys.max() + 13)
        save(can.crop(bx), f"top_{key}.png")
        meta[key] = {"file": f"top_{key}.png", "x_mm": bx[0] / HI, "y_mm": bx[1] / HI, "w_mm": (bx[2] - bx[0]) / HI,
                     "h_mm": (bx[3] - bx[1]) / HI}
    json.dump(meta, open(os.path.join(DEST, "top_print.json"), "w"), indent=1)


if __name__ == "__main__":
    only = [a for a in sys.argv[4:] if not a.startswith("--") and a != COMPARE]
    for fn in (panel, front, sides_and_back, inside, topedge):
        if not only or fn.__name__ in only:
            fn()
