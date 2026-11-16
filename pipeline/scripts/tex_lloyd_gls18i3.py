"""Textures for the Lloyd 1.5 ton 3 star inverter split AC indoor unit, GLS18I3ASCHC and GLS18I3GWSPC (one body,
two finishes: the same panel and print, Sangeetha's photos of the two codes show the print in two strengths and the
louvre and lower chassis grey on GLS18I3ASCHC, white on GLS18I3GWSPC).

The panel is Lloyd's own straight-on front photo of GLS18I3ASCHC (havells.com, classic_main_image_3.jpg, 1200 x 1200;
the unit is 1078 px across for 856 mm, 1.2593 px per mm, cols 69..1147, top at row 463). The studio light is divided
out, the honeycomb print is kept as a ratio to the panel's white and resampled to 3 px per mm, and every word is erased
and set again sharp: LLOYD from Lloyd's own wordmark (pipeline/sources/logos/lloyd.svg, rendered by rasterize_svg.mjs),
INVERTER drawn stroke by stroke in the panel's thin squared letters, "A HAVELLS Brand" in Avenir Next.
usage: python tex_lloyd_gls18i3.py <photos dir> <logos src dir> <out dir> [--compare]
Writes into <out dir>/lloyd_gls18i3/.
"""
import os
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PHOTOS, LOGOS, OUT = sys.argv[1:4]
COMPARE = "--compare" in sys.argv
PRODUCT = "lloyd_gls18i3"
HERE = os.path.dirname(os.path.abspath(__file__))
AV = "/System/Library/Fonts/Avenir Next.ttc"

S = 3.0                                    # px per mm in the panel texture
HALF, H, YB = 428.0, 0.285, 0.0721         # panel half width (mm), unit height (m), panel's lower edge (m)
PPM, CX, TOP = 1078 / 856.0, 608.0, 463.0  # the photo: px per mm, centre column, row of the unit's top
W_PX, H_PX = round(2 * HALF * S), round((H - YB) * 1000 * S)
BASE = np.array([238.0, 238.0, 240.0])     # the panel's white, with a 1.5 % fall to the bottom (as on the Haier panel)
# the viewer's light lifts and compresses a white panel (renders read 250 of 255): the print is deepened by GAIN so its ratio
# to the panel's white in the render comes back to the photo's (ESTIMATED by rendering, see NOTES.md)
GAIN = 1.6


def save(img, name, quality=90):
    os.makedirs(os.path.join(OUT, PRODUCT), exist_ok=True)
    path = os.path.join(OUT, PRODUCT, name)
    if name.endswith(".jpg"):
        img.convert("RGB").save(path, quality=quality, optimize=True, subsampling=0)
    else:
        img.save(path, optimize=True)
    print("wrote", path, img.size, os.path.getsize(path) // 1024, "KB")


def photo_ratio():
    """the print as a ratio to the panel's white (1 = no ink), in the photo's own pixels"""
    im = np.asarray(Image.open(os.path.join(PHOTOS, PRODUCT, "maker_aschc", "classic_main_image_3.jpg")).convert("L")).astype(np.float32)
    x0, x1 = round(CX - HALF * PPM), round(CX + HALF * PPM)
    y0, y1 = round(TOP), round(TOP + (H - YB) * 1000 * PPM)
    crop = im[y0:y1, x0:x1]
    # the light: a closing (max) wipes out the ink, a wide blur keeps only the studio gradient and the fold's shade
    bg = cv2.morphologyEx(crop, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    bg = cv2.GaussianBlur(bg, (0, 0), 6)
    r = np.clip(crop / np.maximum(bg, 1), 0, 1)
    # words are set again below: erase them (boxes measured on the photo, padded 3 px)
    for (a, b, c, d) in [(565, 696, 646, 709), (1017, 701, 1088, 711), (152, 476, 238, 485)]:
        r[b - 6 - y0:d + 6 - y0, a - 6 - x0:c + 6 - x0] = 1
    # the panel's own outline and the fold are geometry: keep only the print (ink darker than 3 % below the white)
    r = np.where(r > 0.97, 1.0, r)
    edge = 6
    r[:edge, :] = 1; r[:, :edge] = 1; r[:, -edge:] = 1
    r[-round(0.012 * 1000 * PPM):, :] = 1   # the lower band carries only LLOYD and INVERTER
    r[:12, :] = 1                           # the top round-over (and the edge of the BEE label standing behind it)
    fold = round(669 - y0)                  # the fold between the face and the lower band is geometry
    r[fold - 6:fold + 6, :] = 1
    return r, (x0, y0)


def to_texture(r):
    """resample the ratio map to the texture's 3 px per mm and firm up the edges the photo blurred"""
    big = cv2.resize(r, (W_PX, H_PX), interpolation=cv2.INTER_LANCZOS4)
    soft = cv2.GaussianBlur(big, (0, 0), 1.6)
    big = np.clip(big + 0.9 * (big - soft), 0, 1)        # unsharp mask
    ink = 1 - big
    ink = np.clip((ink - 0.05) / 0.95, 0, 1)          # drop the faint speckle the resampling leaves
    return 1 - ink


X = lambda mm: W_PX / 2 + mm * S                           # texture px from x in mm (0 = centre)
Ym = lambda m: (H - m) * 1000 * S                          # texture px from height in metres
Yp = lambda row: (row - TOP) / PPM * S                     # texture px from a photo row
Xp = lambda col: X((col - CX) / PPM)                       # texture px from a photo column


def lloyd_mark(box, col):
    """LLOYD from Lloyd's own wordmark, fitted to the photo's box"""
    tmp = os.path.join(OUT, PRODUCT, "_lloyd.png")
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    svg = os.path.join(LOGOS, "lloyd.svg")
    subprocess.run(["node", os.path.join(HERE, "..", "build3d", "rasterize_svg.mjs"), svg, tmp, "2400"], check=True, capture_output=True)
    m = Image.open(tmp).convert("RGBA")
    os.remove(tmp)
    m = m.crop(m.getchannel("A").getbbox())
    a, b, c, d = box
    w, h = round(Xp(c) - Xp(a)), round(Yp(d) - Yp(b))
    alpha = m.getchannel("A").resize((w, h), Image.LANCZOS)
    tile = Image.new("RGBA", (w, h), col + (255,))
    tile.putalpha(alpha)
    return tile, (round(Xp(a)), round(Yp(b)))


def inverter(im, box, col, k=6):
    """INVERTER as on the panel: thin even strokes, square letters with rounded corners, the N drawn as an arch.
    Drawn at k times the texture's resolution on a mask, then reduced, so the strokes are smooth."""
    a, b, c, e = box
    X0, Y0 = Xp(a) - 4, Yp(b) - 4
    mw, mh = round(Xp(c) - Xp(a) + 8), round(Yp(e) - Yp(b) + 8)
    mask = Image.new("L", (mw * k, mh * k), 0)
    d = ImageDraw.Draw(mask)
    x0, y0, x1, y1 = (Xp(a) - X0) * k, (Yp(b) - Y0) * k, (Xp(c) - X0) * k, (Yp(e) - Y0) * k
    col_ = col
    col = 255
    h = y1 - y0
    t = 0.15 * h                                   # stroke, measured about 1.2 mm on 8 mm capitals
    gap = 0.19 * h                                 # letter spacing, as in the photo
    gw = (x1 - x0 - t - 7 * gap) / 7               # glyph width (the photo's letters are about as wide as tall); I is one stroke
    rr = 0.2 * h
    x = x0
    def ln(p, q):
        d.line((p, q), fill=col, width=round(t))
        for (u, v) in (p, q):
            d.ellipse((u - t / 2, v - t / 2, u + t / 2, v + t / 2), fill=col)
    def arc(cx, cy, r, a0, a1):
        # PIL strokes an arc inside its box: grow the box by half a stroke so the stroke is centred on r, like the lines
        d.arc((cx - r - t / 2, cy - r - t / 2, cx + r + t / 2, cy + r + t / 2), a0, a1, fill=col, width=round(t))
    s = t / 2
    for ch in "INVERTER":
        L, R, T, B, M = x + s, x + gw - s, y0 + s, y1 - s, (y0 + y1) / 2
        if ch == "I":
            ln((x + s, T), (x + s, B)); x += t + gap; continue
        if ch == "N":                                # left stem, arch, right stem
            ln((L, B), (L, T + rr)); arc(L + rr, T + rr, rr, 180, 270); ln((L + rr, T), (R - rr, T))
            arc(R - rr, T + rr, rr, 270, 360); ln((R, T + rr), (R, B))
        elif ch == "V":
            ln((L, T), ((L + R) / 2, B)); ln(((L + R) / 2, B), (R, T))
        elif ch == "E":
            ln((R, T), (L + rr, T)); arc(L + rr, T + rr, rr, 180, 270); ln((L, T + rr), (L, B - rr))
            arc(L + rr, B - rr, rr, 90, 180); ln((L + rr, B), (R, B)); ln((L, M), (R - 0.12 * gw, M))
        elif ch == "R":
            ln((L, B), (L, T)); ln((L, T), (R - rr, T)); arc(R - rr, T + rr, rr, 270, 360)
            ln((R, T + rr), (R, M - rr)); arc(R - rr, M - rr, rr, 0, 90); ln((R - rr, M), (L, M)); ln((L + 0.45 * gw, M), (R, B))
        elif ch == "T":
            ln((L, T), (R, T)); ln(((L + R) / 2, T), ((L + R) / 2, B))
        x += gw + gap
    alpha = mask.resize((mw, mh), Image.LANCZOS)
    tile = Image.new("RGBA", (mw, mh), col_)
    tile.putalpha(alpha)
    im.alpha_composite(tile, (round(X0), round(Y0)))


def havells(d, box, col_light, col_bold):
    """"A HAVELLS Brand", HAVELLS heavy, the rest regular, fitted to the photo's box"""
    a, b, c, e = box
    x0, y0, x1, y1 = Xp(a), Yp(b), Xp(c), Yp(e)
    cap = y1 - y0
    px = 40
    for _ in range(30):
        f1, f2 = ImageFont.truetype(AV, round(px), index=7), ImageFont.truetype(AV, round(px), index=8)
        hb = f2.getbbox("H")
        if abs((hb[3] - hb[1]) - cap) < 0.5:
            break
        px *= cap / (hb[3] - hb[1])
    parts = [("A", f1, col_light), ("HAVELLS", f2, col_bold), ("Brand", f1, col_light)]
    sp = 0.35 * cap
    widths = [d.textlength(s, font=f) for s, f, _ in parts]
    total = sum(widths) + 2 * sp
    # the photo's line is wider than the natural set: open the spaces, never stretch the letters
    sp += max(0, (x1 - x0) - total) / 2
    x = x0
    for (s, f, col), w in zip(parts, widths):
        d.text((x, y1), s, font=f, fill=col, anchor="ls")
        x += w + sp


def panel(ink_scale, name):
    r, _ = photo_ratio()
    r = to_texture(r)
    r = np.clip(1 - (1 - r) * ink_scale * GAIN, 0, 1)
    fall = np.linspace(1.0, 0.985, H_PX)[:, None, None]
    img = (BASE[None, None, :] * fall * r[:, :, None]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(img).convert("RGBA")
    d = ImageDraw.Draw(im, "RGBA")
    mark, at = lloyd_mark((565, 696, 646, 709), (40, 42, 46))
    im.alpha_composite(mark, at)
    inverter(im, (1017, 701, 1088, 711), (64, 66, 70, 255))
    havells(d, (152, 476, 238, 485), (96, 98, 102, 255), (84, 86, 90, 255))
    save(im.convert("RGB"), name, 88)
    return im


def top_grille():
    """The air inlet on top: long slots in rows, broken by ribs (ESTIMATED: Sangeetha's photos show the inlet only edge-on)."""
    w, h = 1024, 128                         # spans x = +-418 mm and the top from the wall to the panel (0.006 .. 0.100 m)
    img = Image.new("RGB", (w, h), (243, 244, 245))
    d = ImageDraw.Draw(img)
    px = w / 836.0
    slot = (120, 124, 130)
    rows = [(16, 30), (40, 54), (64, 78), (88, 102)]
    x = 26.0
    while x < 810:
        x2 = min(x + 74, 810)
        for y0, y1 in rows:
            d.rounded_rectangle((round(x * px), y0, round(x2 * px), y1), 4, fill=slot)
        x += 78
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    save(img, "top.jpg", 86)


a = panel(1.0, "panel_aschc.jpg")
# GLS18I3GWSPC: Sangeetha's front photo puts its honeycomb at 0.12 below the panel's white at the 2nd percentile, against
# 0.35 for GLS18I3ASCHC on both Lloyd's and Sangeetha's photos (ESTIMATED from those ratios: print about a third as strong)
panel(0.35, "panel_gwspc.jpg")
top_grille()
if COMPARE:
    src = Image.open(os.path.join(PHOTOS, PRODUCT, "maker_aschc", "classic_main_image_3.jpg")).convert("RGB")
    x0, x1 = round(CX - HALF * PPM), round(CX + HALF * PPM)
    crop = src.crop((x0, round(TOP), x1, round(TOP + (H - YB) * 1000 * PPM))).resize((W_PX, H_PX), Image.LANCZOS)
    st = Image.new("RGB", (W_PX, 2 * H_PX), "white")
    st.paste(crop, (0, 0)); st.paste(a.convert("RGB"), (0, H_PX))
    st.save(os.path.join(OUT, PRODUCT, "_compare.jpg"), quality=90)
    print("wrote compare")
