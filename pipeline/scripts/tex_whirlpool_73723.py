"""Textures for the Whirlpool 73723 (Icemagic Pro 207 L 3 star direct-cool single door, Wine Silk - Y).

Writes pipeline/tex/whirlpool_73723/:
  door_print.jpg     the door's flower print, from Whirlpool's straight front of this code (3072 x 3072): the Breathe Arc
                     handle and the Whirlpool mark painted out (both are built in 3D or as a decal), the white over the
                     door's crescent top filled from the print under it
  logo.png           the Whirlpool mark (white with the gold ring), from the brand's SVG, 67 mm wide as on the front
  print_*.png        the inside prints as Whirlpool's photos of this cabinet show them: MAGIC CHILL on the chill tray,
                     VEGGIE FRESH on the crisper, ADVANCED AIR FLOW on the back wall, BIG BOTTLE RACK on the door bin
  honeycomb.png      the crisper cover's honeycomb (Whirlpool: "honey comb crisper cover")
usage: python3 -I pipeline/scripts/tex_whirlpool_73723.py [--compare]
Every size is in private/research/whirlpool_73723/NOTES.md with how it was measured.
"""
import os
import site
import subprocess
import sys

sys.path.append(site.getusersitepackages())
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(SITE, "pipeline/sources/photos/whirlpool_73723")
OUT = os.path.join(SITE, "pipeline/tex/whirlpool_73723")
WORK = os.path.join(SITE, ".work", "whirlpool_73723_tex")
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
DEMI, MED = 2, 5

# the door on front.jpg: columns 1017-2117 (536 mm: 2.052 px per mm across), the crescent's crest at row 101 and the
# door's bottom edge at row 2616 (1333 mm and 43 mm on the published height: 0.5133 mm per px down)
X0, X1, Y0, Y1 = 1017, 2117, 101, 2616
HANDLE = (1112, 298, 1228, 1074)      # the chrome handle and its edge highlights (measured: 1121-1219, 309-1062)
LOGO = (1490, 252, 1646, 316)         # the mark's ink (1499-1636, 261-307) and a margin
PX_MM = 2.2                           # the print's resolution on the door (2-3 px per mm keeps it sharp and in budget)
DOOR_MM = (536, 1290)                 # 43-1333 mm
SHADE = 0.79                          # the viewer's light lifts textures: tuned so the web front reads as the photo (142, 59, 78 mean)


def door():
    a = np.asarray(Image.open(os.path.join(SRC, "front.jpg")).convert("RGB")).copy()
    mask = np.zeros(a.shape[:2], np.uint8)
    for (x0, y0, x1, y1) in (HANDLE, LOGO):
        mask[y0:y1, x0:x1] = 255
    clean = cv2.cvtColor(cv2.inpaint(cv2.cvtColor(a, cv2.COLOR_RGB2BGR), mask, 6, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    d = clean[Y0:Y1, X0:X1].astype(np.float32)
    # the crescent: over the arc the photo is white; fill each column from the first rows of print under its edge
    g = d.mean(2)
    for x in range(d.shape[1]):
        col = np.where(g[:, x] < 235)[0]
        top = col.min() if len(col) else 0
        top = min(top + 4, d.shape[0] - 1)             # skip the edge's own highlight
        if top > 0:
            n = top
            d[:top, x] = d[top:top + n, x][::-1]
    # the outermost columns carry the rounded edge's shading: repeat their neighbours
    d[:, :6] = d[:, 6:7]
    d[:, -6:] = d[:, -7:-6]
    d *= SHADE
    img = Image.fromarray(d.clip(0, 255).astype(np.uint8))
    out = img.resize((int(DOOR_MM[0] * PX_MM), int(DOOR_MM[1] * PX_MM)), Image.LANCZOS)
    out.save(os.path.join(OUT, "door_print.jpg"), quality=84, optimize=True)
    # the door's edges: the print's mean along its two sides (they wrap round the rounded edges on the 3/4 views)
    edge = np.concatenate([d[:, 6:30], d[:, -30:-6]], 1).reshape(-1, 3).mean(0)
    print("door print", out.size, os.path.getsize(os.path.join(OUT, "door_print.jpg")) // 1024, "KB; edge colour", edge.round())
    return out


def logo():
    os.makedirs(WORK, exist_ok=True)
    png = os.path.join(WORK, "logo_3000.png")
    if not os.path.exists(png):
        subprocess.run(["node", os.path.join(SITE, "pipeline/build3d/rasterize_svg.mjs"),
                        os.path.join(SITE, "pipeline/sources/logos/whirlpool.svg"), png, "3000"], check=True, capture_output=True)
    lg = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
    a, rgb = lg[..., 3] / 255, lg[..., :3]
    gold = (rgb[..., 0] - rgb[..., 2]) > 60
    cols = np.where((a > 0.1).any(0))[0]
    gaps = np.where(np.diff(cols) > 8)[0]                # drop the registered mark (the door's print has none)
    right = cols[gaps[-1]] + 1 if len(gaps) else cols[-1] + 1
    ys = np.where((a[:, :right] > 0.1).any(1))[0]
    a, gold = a[ys.min():ys.max() + 1, cols[0]:right], gold[ys.min():ys.max() + 1, cols[0]:right]
    w = int(66.7 * 12)
    h = int(a.shape[0] * w / a.shape[1])
    al = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    gm = np.asarray(Image.fromarray((gold * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    rgbo = np.zeros((h, w, 3), np.float32)
    white, goldc = np.array([244, 244, 246]), np.array([214, 165, 52])
    rgbo[:] = white
    rgbo = rgbo * (1 - gm[..., None]) + goldc * gm[..., None]
    out = np.dstack([rgbo, al * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(os.path.join(OUT, "logo.png"), optimize=True)
    print("logo", (w, h), "aspect", round(w / h, 3))


def spaced(text, cap_px, colour, track=0.35, face=DEMI):
    """capitals with letter spacing (a fraction of their height), on transparent, cropped to the ink"""
    f = ImageFont.truetype(AVENIR, int(cap_px / 0.7), index=face)
    widths = [f.getlength(ch) for ch in text]
    W = int(sum(widths) + track * cap_px * len(text) + cap_px * 2)
    img = Image.new("L", (W, int(cap_px * 3)), 0)
    d = ImageDraw.Draw(img)
    x = cap_px
    for ch, w in zip(text, widths):
        d.text((x, cap_px * 2), ch, font=f, fill=255, anchor="ls")
        x += w + track * cap_px
    bb = img.getbbox()
    al = img.crop(bb)
    out = Image.new("RGBA", al.size, colour + (0,))
    out.putalpha(al)
    return out


def honeycomb(w_mm=420, h_mm=330, cell=11.0, k=3):
    """the cover's hexagons: thin light lines on clear, 3 px per mm"""
    W, H = int(w_mm * k), int(h_mm * k)
    img = Image.new("LA", (W, H), (255, 0))
    d = ImageDraw.Draw(img)
    r = cell / 2 * k
    dx, dy = np.sqrt(3) * r, 1.5 * r
    for j in range(int(H / dy) + 2):
        for i in range(int(W / dx) + 2):
            cx = i * dx + (dx / 2 if j % 2 else 0)
            cy = j * dy
            pts = [(cx + r * np.cos(np.pi / 6 + t * np.pi / 3), cy + r * np.sin(np.pi / 6 + t * np.pi / 3)) for t in range(7)]
            d.line(pts, fill=(250, 150), width=max(1, int(0.5 * k)))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    pr = door()
    logo()
    prints = {
        "print_magic": spaced("MAGIC CHILL", 60, (70, 74, 82)),
        "print_veggie": spaced("VEGGIE FRESH", 60, (40, 112, 172)),
        "print_airflow": spaced("ADVANCED AIR FLOW", 60, (176, 182, 188), track=0.3),
        "print_bigbottle": spaced("BIG BOTTLE RACK", 60, (150, 156, 164), track=0.3),
    }
    for n, im in prints.items():
        im.save(os.path.join(OUT, n + ".png"), optimize=True)
        print(n, im.size, "aspect", round(im.width / im.height, 2))
    honeycomb().save(os.path.join(OUT, "honeycomb.png"), optimize=True)
    if "--compare" in sys.argv:
        ph = Image.open(os.path.join(SRC, "front.jpg")).convert("RGB").crop((X0, Y0, X1, Y1)).resize(pr.size, Image.LANCZOS)
        c = Image.new("RGB", (pr.width * 2 + 20, pr.height), "white")
        c.paste(ph, (0, 0))
        c.paste(pr, (pr.width + 20, 0))
        os.makedirs(os.path.join(SITE, "private/research/whirlpool_73723/lookpass"), exist_ok=True)
        c.resize((c.width // 2, c.height // 2)).save(os.path.join(SITE, "private/research/whirlpool_73723/lookpass/print_compare.jpg"), quality=85)


if __name__ == "__main__":
    main()
