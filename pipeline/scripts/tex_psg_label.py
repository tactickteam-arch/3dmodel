"""BEE 'Power Savings Guide' star labels drawn again sharp (12 px per mm on the model) from small pictures of the label.

usage: python tex_psg_label.py <name ...> [--compare <dir>]
  names: the keys of LABELS below (haier_hw70, haier_hwm70, daikin_atkl50); none = all.
  Each reads its source, the label as cut out before from the maker's or Sangeetha's picture of this model's own label
  (pipeline/sources/photos/<name>/bee_cut_bee_label.png, 3 to 4 px per mm), and writes the texture labels.json already
  names (pipeline/tex/<name>/bee_label.png), at the same width and aspect, so the label keeps its size and place.
  --compare writes <dir>/<name>_cmp.png: the source enlarged beside the new label.

Why drawn again: the only pictures of these three labels are small, so enlarged they stay soft. The way tex_lg_label.py
redrew the LG FHP1412 label is used here, one table per label:
  - the die-cut outline, the arch (yellow ring, red or red-and-white star band, the yellow disc), the black band with its
    chevron, the emblem's ring, the energy box with its green bar, the table's rules and the rule over the fine print are
    shapes, at the places and sizes measured on the label's own picture (source pixels; the label's few printed colours
    sampled from it);
  - each star is a five-point star at the centre, size and turn fitted to the picture's star, with its number;
  - every word is set again in Arial and stretched to the ink box the word has in the picture (found by thresholding
    inside a window round it), so sizes and places are the label's; Arial is not the label's own typeface, so letter
    shapes differ slightly;
  - only the art stays the picture, enlarged: the hand-with-notes emblem and the BEE logo, and on the two Haier labels the
    registration code under the logo (too small in the picture to read with certainty, so it is not set as text).
Every word and figure is the label's own, read off its picture; none is taken from another label. Each label keeps its
own layout: the washers' 2024-26 kWh/kg/cycle label and the air conditioner's 2026-27 ISEER label are not mixed.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
SUP = "/System/Library/Fonts/Supplemental/"
FONT = {"black": SUP + "Arial Black.ttf", "bold": SUP + "Arial Bold.ttf", "reg": SUP + "Arial.ttf",
        "narrow": SUP + "Arial Narrow.ttf", "narrowbold": SUP + "Arial Narrow Bold.ttf"}
PXMM = 12
SS = 3                                            # drawn at 3x, then reduced (smooth edges)

INK = (30, 30, 27)
WASHER_FOOT = ["*Under test conditions, when tested in accordance with latest IEC 60456 standards.",
               "Actual energy consumption will depend on how the appliance is being used."]

# Geometry in the source picture's pixels (x right, y down; a pixel's centre is at +0.5). Measured on each picture:
# arches by ellipse fits of their edges, rules by the centre of their rows of ink, stars by fitting a star's outline.
LABELS = {
    # Haier HW70-IM12929BK: Haier's own label graphic (marketplace image of this model's label), 254 x 464 px for 64 mm.
    "haier_hw70": dict(
        src="pipeline/sources/photos/haier_hw70/bee_cut_bee_label.png", out="pipeline/tex/haier_hw70/bee_label.png",
        width_mm=64,
        colours=dict(red=(229, 1, 15), yellow=(252, 247, 179), cream=(254, 250, 214), green=(28, 154, 72),
                     margin=(252, 252, 238)),
        cx=125.8, base=125.5,                     # the arches' centre; the black band starts on the line y = base
        outline=dict(r=122.3, w=1.4, bottom=461.0, margin=2.6),
        red=dict(rx=114.6, ry=115.6, stroke=2.0),     # the red band, with a dark line round its top
        disc=dict(rx=57.0, ry=57.6, stroke=1.6),
        band=dict(side=152.0, apex=224.5),
        emblem=dict(cx=125.8, cy=213.9, r=27.4, ring=2.3, fill="cream"),
        box=dict(x0=43.65, x1=208.2, y0=249.45, y1=300.0, w=1.35, green=(260.7, 276.8), rules=[289.1]),
        rules=dict(ys=[308.5, 320.33, 332.17, 344.0, 354.73, 366.52, 378.33], x0=41.9, x1=209.0, w=1.3),
        foot_rule=dict(y=441.8, x0=42.6, x1=208.9, w=1.3),
        stars=[(44.02, 96.80, 20.94, 10.6, 0.397), (80.78, 51.02, 20.50, 19.0, 0.400), (127.69, 36.70, 20.06, 18.4, 0.420),
               (177.56, 53.77, 21.00, 18.2, 0.390), (207.93, 96.16, 20.50, 18.5, 0.400)],
        star_sectors=None,
        num=dict(h=0.44, font="reg", dy=0.07),
        words=[("MORE STARS", "black", (84, 98, 170, 108.6), "dark"),
               ("MORE SAVINGS", "black", (78, 108.6, 175, 120), "dark"),
               ("POWER SAVINGS", "black", (20, 134, 232, 155), "light"),
               ("GUIDE", "black", (80, 157, 175, 181), "light"),
               ("ENERGY CONSUMPTION", "bold", (48, 251, 205, 260.3), "dark"),
               ("0.0450*", "bold", (50, 261.5, 200, 276.2), "green"),
               ("kWh/kg/cycle", "bold", (48, 277.6, 205, 288.3), "dark"),
               ("Label Period : 1st Jan 2024 - 31st Dec 2026", "bold", (45.5, 290.2, 207, 299.2), "dark")]
              + [(t, "narrow", (40, y0, 214, y1), "faint") for t, (y0, y1) in zip(WASHER_FOOT, [(443, 451.4), (451.4, 459.6)])],
        table=dict(split=120.5, x0=43, x1=214, rows=[("Appliance", ": Washing Machine"), ("Brand", ": Haier"),
                                                     ("Model/Year", ": HW70-IM12929BK/2024"), ("Type", ": Front Load"),
                                                     ("Load Capacity", ": 7.0 kg"), ("Water Consumption", ": 7.43 L/kg/cycle")]),
        pictures=[dict(circle=(125.8, 213.9, 24.2)), dict(circle=(125.2, 413.8, 21.6)),
                  dict(box=(103.5, 435.0, 147.5, 440.4))],
    ),
    # Haier HWM70-306S8: Haier's label image on Sangeetha's listing (the dimensions picture, 1080 x 1080), the whole sticker
    # 204 x 377 px for 64 mm. The earlier cut (bee_cut_bee_label.png) had lost the sticker's right edge and its foot, so the
    # label is taken from that picture again.
    "haier_hwm70": dict(
        src="pipeline/sources/photos/haier_hwm70/sangeetha/690c98292b9f4.jpg", crop=(216, 378, 420, 755),
        out="pipeline/tex/haier_hwm70/bee_label.png", width_mm=64,
        colours=dict(red=(238, 29, 37), yellow=(253, 249, 175), cream=(255, 252, 211), green=(30, 162, 87),
                     margin=(250, 252, 250), ink=(33, 31, 32)),
        cx=102.1, base=104.4,
        outline=dict(r=97.0, ry=98.5, w=1.3, bottom=372.0, margin=3.9),
        red=dict(rx=92.0, ry=92.8, stroke=2.0),
        disc=dict(rx=45.7, ry=46.8, stroke=2.0),
        band=dict(side=125.0, apex=182.9),
        emblem=dict(cx=101.95, cy=174.75, r=22.0, ring=2.0, fill="cream"),
        box=dict(x0=36.1, x1=168.0, y0=203.0, y1=242.9, w=1.3, green=(211.8, 225.5), rules=[234.8]),
        rules=dict(ys=[250.84, 260.0, 269.35, 278.5, 287.9, 297.0, 306.2], x0=34.8, x1=168.7, w=1.2),
        foot_rule=dict(y=356.9, x0=35.0, x1=168.6, w=1.2),
        stars=[(36.63, 81.17, 16.44, 10.9, 0.410), (65.99, 44.52, 15.50, 18.0, 0.430), (103.67, 33.06, 15.62, 18.5, 0.438),
               (143.59, 46.62, 15.88, 18.5, 0.417), (167.96, 80.64, 15.75, 18.4, 0.430)],
        num=dict(h=0.46, font="reg", dy=0.07),
        words=[("MORE STARS", "black", (70, 82.5, 135, 90.3), "dark"),
               ("MORE SAVINGS", "black", (65, 90.3, 140, 99), "dark"),
               ("POWER SAVINGS", "black", (20, 110, 186, 129), "light"),
               ("GUIDE", "black", (65, 130, 140, 149), "light"),
               ("ENERGY CONSUMPTION", "bold", (40, 203.8, 165, 211.3), "dark"),
               ("0.0064*", "bold", (40, 212.5, 165, 225), "green"),
               ("kWh/kg/cycle", "bold", (40, 225.9, 165, 234.1), "dark"),
               ("Label Period : 1st Jan 2024 - 31st Dec 2026", "bold", (37, 235.6, 167, 242.3), "dark")]
              + [(t, "narrow", (33, y0, 171, y1), "faint") for t, (y0, y1) in zip(WASHER_FOOT, [(357.6, 363.8), (363.8, 370.6)])],
        table=dict(split=97.8, x0=35.5, x1=172, rows=[("Appliance", ": Washing Machine"), ("Brand", ": Haier"),
                                                      ("Model/Year", ": HWM70-306S8/2024"), ("Type", ": Top Load"),
                                                      ("Load Capacity", ": 7.0 kg"), ("Water Consumption", ": 20.15 L/kg/cycle")]),
        pictures=[dict(circle=(101.95, 174.75, 19.9)), dict(circle=(101.5, 333.0, 18.4)),
                  dict(box=(84.0, 351.6, 120.0, 356.1))],
    ),
    # Daikin ATKL50XV16VKA + RKL50XV16VKA: the label in Sangeetha's listing picture for this model (sg_1.jpg), as cut out
    # before, 341 x 641 px for the 85.9 mm the builder gives it (9.7% of the front panel's width). The 2026-27 ISEER label:
    # 3 stars won (red), 4 and 5 not (outlined on white); no outline round the sticker.
    "daikin_atkl50": dict(
        src="pipeline/sources/photos/daikin_atkl50/bee_cut_bee_label.png", out="pipeline/tex/daikin_atkl50/bee_label.png",
        width_mm=85.9,
        colours=dict(red=(238, 25, 35), white=(252, 252, 242), yellow=(252, 248, 175), cream=(253, 252, 215),
                     green=(36, 160, 90), margin=(253, 252, 215), ink=(35, 30, 28)),
        cx=170.3, base=169.9,
        outline=dict(r=169.4, ry=169.9, w=0, bottom=640.6, margin=0),
        red=dict(rx=161.5, ry=160.6, stroke=2.45),
        split=dict(line=(-0.4715, 234.40), left="red", right="white"),
        disc=dict(rx=79.6, ry=79.3, stroke=3.0),
        band=dict(side=210.75, apex=303.9),
        emblem=dict(cx=170.1, cy=298.6, r=37.7, ring=2.8, fill="cream"),
        box=dict(x0=55.0, x1=285.4, y0=346.3, y1=411.75, w=2.0, green=(364.9, 392.9), rules=[]),
        rules=dict(ys=[419.85, 434.42, 449.74, 464.13, 478.9, 493.5, 508.12, 522.87, 537.5], x0=41.3, x1=298.5, w=1.6),
        foot_rule=dict(y=614.0, x0=22.3, x1=317.3, w=2.0),
        stars=[(51.85, 134.33, 27.94, 11.2, 0.400), (98.69, 75.78, 28.12, 11.2, 0.395), (169.12, 53.10, 28.12, 11.2, 0.395),
               (242.17, 77.80, 28.44, 10.8, 0.395), (284.54, 134.05, 28.44, 10.8, 0.395)],
        star_fill="white", star_style={4: "outlined", 5: "outlined"}, star_outline=1.4,
        num=dict(h=0.42, font="reg", dy=0.04),
        words=[("MORE STARS", "black", (112, 132.5, 228, 146.3), "dark"),
               ("MORE SAVINGS", "black", (104, 146.3, 238, 161), "dark"),
               ("POWER SAVINGS", "black", (28, 182, 312, 211), "light"),
               ("GUIDE", "black", (110, 214, 232, 244), "light"),
               ("ENERGY EFFICIENCY", "black", (58, 348.5, 282, 363.5), "dark"),
               ("ISEER - 4.40*", "black", (60, 366, 280, 391.8), "green"),
               ("Label Period : 1st Jan 2026 - 31st Dec 2027", "narrowbold", (58, 394, 282, 409.8), "dark"),
               ("*Under test conditions, when tested in accordance with ISO 16358 & based on 1600 operating hours per annum.",
                "narrow", (16, 615.2, 324, 626.5), "faint"),
               ("Actual electricity consumption will depend on how the appliance being used.", "narrow",
                (16, 626.5, 324, 638.8), "faint")],
        table=dict(x0=40, x1=305, colon=(141.9, 147.6), font="narrowbold",
                   rows=[("Appliance/Type", "RAC/Split"), ("Brand", "DAIKIN"),
                         ("Model/Year", "ATKL50XV16VKA+RKL50XV16VKA/2025"), ("Cooling Capacity (100%)", "5000 (W)"),
                         ("Cooling Capacity (50%)", "2500 (W)"), ("Electricity Consumption", "880.10 Units Per Year"),
                         ("Compressor Type", "Variable Speed"), ("Heat Pump", "No")]),
        # the 'Energy is life' BEE logo with its registration code under it (the code too small to read with certainty)
        pictures=[dict(circle=(170.1, 298.6, 34.8)), dict(box=(140.5, 540.8, 200.5, 612.4))],
    ),
}


def text_mask(text, font):
    """The word's ink at a large size, cropped to its ink, as an L image."""
    f = ImageFont.truetype(FONT[font], 240)
    bb = f.getbbox(text)
    im = Image.new("L", (bb[2] - bb[0] + 40, bb[3] - bb[1] + 40), 0)
    ImageDraw.Draw(im).text((20 - bb[0], 20 - bb[1]), text, font=f, fill=255)
    return im.crop(im.getbbox())


def ink_box(a, win, kind):
    """The word's ink box (source px, sub-pixel) inside a window: the extent where the ink's coverage passes one half."""
    x0, y0, x1, y1 = win
    X0, Y0, X1, Y1 = int(math.floor(x0)), int(math.floor(y0)), int(math.ceil(x1)), int(math.ceil(y1))
    sub = a[Y0:Y1, X0:X1].astype(float)
    if kind == "dark":                            # dark print on the cream: coverage from the brightness
        cov = np.clip((235 - sub.mean(2)) / (235 - 40), 0, 1)
    elif kind == "faint":                         # the fine print, so small that its ink never comes out dark
        cov = np.clip((235 - sub.mean(2)) / (235 - 140), 0, 1)
    elif kind == "light":                         # white print on the black band
        cov = np.clip((sub.min(2) - 40) / (240 - 40), 0, 1)
    else:                                         # white print on the green bar: the red and blue rise from the green's
        cov = np.clip((sub[..., [0, 2]].min(2) - 75) / (245 - 75), 0, 1)
    # windows given as fractions of a pixel: the rows and columns outside them do not count
    wy = np.clip(np.minimum(np.arange(Y0, Y1) + 1 - y0, y1 - np.arange(Y0, Y1)), 0, 1)
    wx = np.clip(np.minimum(np.arange(X0, X1) + 1 - x0, x1 - np.arange(X0, X1)), 0, 1)
    cov = cov * wy[:, None] * wx[None, :]
    col, row = cov.max(0), cov.max(1)

    def span(p, base):
        idx = np.nonzero(p > 0.5)[0]
        i0, i1 = idx[0], idx[-1]
        lo = i0 + 0.5 - (p[i0] - 0.5) / max(p[i0] - (p[i0 - 1] if i0 > 0 else 0), 1e-6)
        hi = i1 + 0.5 + (p[i1] - 0.5) / max(p[i1] - (p[i1 + 1] if i1 + 1 < len(p) else 0), 1e-6)
        return base + max(lo, i0 - 0.5), base + min(hi, i1 + 1.5)

    bx0, bx1 = span(col, X0)
    by0, by1 = span(row, Y0)
    return bx0, by0, bx1, by1


def draw_label(name, L, compare_dir=None):
    src = Image.open(os.path.join(SITE, L["src"])).convert("RGBA")
    if "crop" in L:                               # the label inside a larger picture
        src = src.crop(L["crop"])
    a = np.asarray(src.convert("RGB")).astype(int)
    w, h = src.size
    W = round(L["width_mm"] * PXMM)
    H = round(W * h / w)
    k = W / w * SS                                # source px -> supersampled canvas px
    C = dict(L["colours"])
    C.setdefault("ink", INK)
    col = lambda c: tuple(C[c]) if isinstance(c, str) else tuple(c)
    P = lambda x, y: (x * k, y * k)
    canvas = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    cx, base = L["cx"], L["base"]

    def ell(rx, ry, fill, c=None):
        c = c or (cx, base)
        d.ellipse((*P(c[0] - rx, c[1] - ry), *P(c[0] + rx, c[1] + ry)), fill=fill)

    def arch(rx, ry, fill):
        """The upper half of an ellipse standing on the base line."""
        d.pieslice((*P(cx - rx, base - ry), *P(cx + rx, base + ry)), 180, 360, fill=fill)

    def rect(x0, y0, x1, y1, fill):
        d.rectangle((*P(x0, y0), *P(x1, y1)), fill=fill)

    # ── the die-cut sticker: a white margin, the dark outline, the yellow ring in the arch and the cream body ──
    o = L["outline"]
    orx, ory = o["r"], o.get("ry", o["r"])        # the outline's middle: half the label's width, the arch's height
    R_out = orx + o["w"] / 2
    R_in = orx - o["w"] / 2
    m = o["margin"]
    arch(R_out + m, ory + o["w"] / 2 + m, col("margin"))
    rect(cx - R_out - m, base, cx + R_out + m, o["bottom"] + o["w"] / 2 + m, col("margin"))
    if o["w"] > 0:                                # (the air conditioner's label has no outline: cream to its edge)
        arch(R_out, ory + o["w"] / 2, col("ink"))
        rect(cx - R_out, base, cx + R_out, o["bottom"] + o["w"] / 2, col("ink"))
    arch(R_in, ory - o["w"] / 2, col("ring" if "ring" in C else "yellow"))
    rect(cx - R_in, base, cx + R_in, o["bottom"] - o["w"] / 2, col("cream"))

    # ── the star band: a dark line round it, red (or red and white sectors), then the yellow disc with its outline ──
    r = L["red"]
    arch(r["rx"] + r["stroke"], r["ry"] + r["stroke"], col("ink"))
    split = L.get("split")
    if not split:
        arch(r["rx"], r["ry"], col("red"))
    else:                                         # stars won and stars not won: red left of a straight line, white right
        arch(r["rx"], r["ry"], col(split["right"]))
        sk, sb = split["line"]                    # the line x = sk * y + sb
        y_top, y_bot = base - r["ry"] - 5, base
        left = Image.new("L", canvas.size, 0)
        ImageDraw.Draw(left).polygon([P(cx - r["rx"] - 5, y_top), P(sk * y_top + sb, y_top), P(sk * y_bot + sb, y_bot),
                                      P(cx - r["rx"] - 5, y_bot)], fill=255)
        redl = Image.new("L", canvas.size, 0)
        ImageDraw.Draw(redl).pieslice((*P(cx - r["rx"], base - r["ry"]), *P(cx + r["rx"], base + r["ry"])), 180, 360, fill=255)
        mask = Image.fromarray(np.minimum(np.asarray(left), np.asarray(redl)))
        canvas.paste(Image.new("RGBA", canvas.size, col(split["left"]) + (255,)), (0, 0), mask)
    dc = L["disc"]
    arch(dc["rx"], dc["ry"], col("ink"))
    arch(dc["rx"] - dc["stroke"], dc["ry"] - dc["stroke"], col("yellow"))

    # ── the black band and its chevron down to the emblem ──
    b = L["band"]
    d.polygon([P(cx - R_in - 0.2, base), P(cx + R_in + 0.2, base), P(cx + R_in + 0.2, b["side"]), P(cx, b["apex"]),
               P(cx - R_in - 0.2, b["side"])], fill=col("ink"))
    # the band covers the arch's lower edge down to the base line exactly: nothing of the arch below it
    rect(cx - R_out, base, cx + R_out, base + 0.01, col("ink"))
    e = L["emblem"]
    ell(e["r"], e["r"], col("ink"), (e["cx"], e["cy"]))
    ell(e["r"] - e["ring"], e["r"] - e["ring"], col(e["fill"]), (e["cx"], e["cy"]))

    # ── the energy box, the table's rules and the rule over the fine print ──
    bx = L["box"]
    hw = bx["w"] / 2
    rect(bx["x0"] - hw, bx["y0"] - hw, bx["x1"] + hw, bx["y1"] + hw, col("ink"))
    rect(bx["x0"] + hw, bx["y0"] + hw, bx["x1"] - hw, bx["y1"] - hw, col(bx.get("fill", "cream")))
    if bx.get("green"):
        g0, g1 = bx["green"]
        rect(bx["x0"] + hw, g0, bx["x1"] - hw, g1, col("green"))
    for y in bx.get("rules", []):
        rect(bx["x0"], y - hw, bx["x1"], y + hw, col("ink"))
    rl = L["rules"]
    for y in rl["ys"]:
        rect(rl["x0"], y - rl["w"] / 2, rl["x1"], y + rl["w"] / 2, col("ink"))
    fr = L["foot_rule"]
    rect(fr["x0"], fr["y"] - fr["w"] / 2, fr["x1"], fr["y"] + fr["w"] / 2, col("ink"))

    # ── the stars and their numbers ──
    nm = L["num"]
    for i, (sx, sy, R, rot, inner) in enumerate(L["stars"]):
        pts = [P(sx + (R if q % 2 == 0 else R * inner) * math.cos(math.radians(rot + q * 36)),
                 sy + (R if q % 2 == 0 else R * inner) * math.sin(math.radians(rot + q * 36))) for q in range(10)]
        style = (L.get("star_style") or {}).get(i + 1, "white")
        if style == "outlined":                   # a star on the white sector: white with a dark outline
            lw = L["star_outline"] * k
            d.polygon(pts, fill=col("ink"))
            ins = []
            for q, (px, py) in enumerate(pts):
                dx, dy = px - sx * k, py - sy * k
                Lq = math.hypot(dx, dy)
                f = (Lq - lw * (1 / math.sin(math.radians(18)) if q % 2 == 0 else 1 / math.sin(math.radians(54)))) / Lq
                ins.append((sx * k + dx * f, sy * k + dy * f))
            d.polygon(ins, fill=col(L.get("star_fill", "margin")))
        else:
            d.polygon(pts, fill=col(L.get("star_fill", "margin")))
        tm = text_mask(str(i + 1), nm["font"])
        th = nm["h"] * R * k                      # the number's height: a share of the star's size
        tw = tm.width * th / tm.height
        tm = tm.resize((max(1, round(tw)), max(1, round(th))), Image.LANCZOS)
        canvas.alpha_composite(Image.merge("RGBA", (*[Image.new("L", tm.size, v) for v in col("ink")], tm)),
                               (round(sx * k - tw / 2), round((sy + nm["dy"] * R) * k - th / 2)))

    # ── the words, each stretched to its ink box in the source ──
    def put(text, font, box, colour):
        x0, y0, x1, y1 = box
        tm = text_mask(text, font).resize((max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))), Image.LANCZOS)
        canvas.alpha_composite(Image.merge("RGBA", (*[Image.new("L", tm.size, v) for v in colour], tm)),
                               (round(x0 * k), round(y0 * k)))

    boxes = []
    for text, font, win, kind in L["words"]:
        box = ink_box(a, win, kind)
        boxes.append((text, box))
        put(text, font, box, col("ink") if kind in ("dark", "faint") else (255, 255, 255))
    t = L["table"]
    edges = [L["rules"]["ys"][i] for i in range(len(L["rules"]["ys"]))]
    for (label, value), top, bottom in zip(t["rows"], edges[:-1], edges[1:]):
        y0, y1 = top + L["rules"]["w"] / 2 + 0.2, bottom - L["rules"]["w"] / 2 - 0.2
        if "colon" in t:                          # the colon in a column of its own
            parts = ((label, (t["x0"], y0, t["colon"][0], y1)), (":", (t["colon"][0], y0, t["colon"][1], y1)),
                     (value, (t["colon"][1], y0, t["x1"], y1)))
        else:
            parts = ((label, (t["x0"], y0, t["split"], y1)), (value, (t["split"], y0, t["x1"], y1)))
        for text, win in parts:
            box = ink_box(a, win, "dark")
            boxes.append((text, box))
            put(text, t.get("font", "bold"), box, col("ink"))

    # ── the art: the source picture enlarged, inside a circle or a box ──
    for p in L["pictures"]:
        if "circle" in p:
            pcx, pcy, pr = p["circle"]
            bb = (pcx - pr, pcy - pr, pcx + pr, pcy + pr)
        else:
            bb = p["box"]
        size = (round((bb[2] - bb[0]) * k), round((bb[3] - bb[1]) * k))
        crop = src.transform(size, Image.EXTENT, bb, Image.BICUBIC)
        mask = Image.new("L", size, 0)
        if "circle" in p:
            ImageDraw.Draw(mask).ellipse((0, 0, size[0] - 1, size[1] - 1), fill=255)
        else:
            mask.paste(255, (0, 0, *size))
        crop.putalpha(Image.fromarray(np.minimum(np.asarray(mask), np.asarray(crop.getchannel("A")))))
        canvas.alpha_composite(crop, (round(bb[0] * k), round(bb[1] * k)))

    lab = canvas.resize((W, H), Image.LANCZOS)
    out = os.path.join(SITE, L["out"])
    lab.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out, optimize=True)
    print(f"{L['out']}: {W} x {H} px ({PXMM} px/mm over {L['width_mm']} mm), aspect {W / H:.4f} (source {w / h:.4f}), "
          f"{os.path.getsize(out) // 1024} KB")
    if os.environ.get("PSG_BOXES"):
        for text, bb in boxes:
            print(f"  {text[:40]:40s} x {bb[0]:.2f}-{bb[2]:.2f} y {bb[1]:.2f}-{bb[3]:.2f}")
    if compare_dir:
        old = Image.new("RGBA", (w, h), (128, 128, 128, 255))
        old.alpha_composite(src)
        old = old.resize((W, H), Image.BICUBIC)
        new = Image.new("RGBA", (W, H), (128, 128, 128, 255))
        new.alpha_composite(Image.open(out).convert("RGBA"))
        sheet = Image.new("RGB", (W * 2 + 20, H), (90, 90, 90))
        sheet.paste(old.convert("RGB"), (0, 0))
        sheet.paste(new.convert("RGB"), (W + 20, 0))
        sheet.save(os.path.join(compare_dir, f"{name}_cmp.png"))


def main():
    args = sys.argv[1:]
    cmp_dir = None
    if "--compare" in args:
        i = args.index("--compare")
        cmp_dir = args[i + 1]
        del args[i:i + 2]
    for name in args or list(LABELS):
        draw_label(name, LABELS[name], cmp_dir)


main()
