"""A product's own BEE star label redrawn sharp (12 px per mm on the model) from its own label artwork.

usage: python tex_bee_redraw.py <label data .json> [--debug <png>] [--compare <png>]
  The data file (pipeline/scripts/bee_redraw/<name>.json) names the source (the label as tex_bee_label.py or the product's
  tex script cut it out of the maker's or Sangeetha's picture of this model's label, kept in pipeline/sources/photos), the
  texture it writes (the same file the builder or labels.json already reads), the label's width on the model in mm, and
  every word on the label, transcribed off the source. A template (bee_redraw/templates.json) carries what labels of one
  layout share (where each word sits, the sample points of each ink colour, the stars); the data file fills in the words.

How it works (the method of tex_lg_label.py, made generic):
  - Flat colour areas (the arch's red and white sectors, the black band, the cream body, the green boxes, the borders, the
    die-cut outline) are the source's own: each pixel is given the nearest of the label's few ink colours (sampled from
    the source at the template's points), the words and stars are taken out of that map, and the map is enlarged with
    smooth edges. So the outline, the aspect and the colours stay the source's.
  - Every word is set again in Arial (Black, Bold, Narrow ...) and stretched to exactly the ink box it has in the source
    (found inside the word's window), in the colour of its own ink. Arial is not the label's own typeface, so letter
    shapes differ slightly; sizes and places do not.
  - The stars are drawn again as shapes at the place, size and turn they have in the source, each with its number.
  - Pictures that are art (the BEE logo, the hand-with-notes emblem) stay the photograph, enlarged.
  Nothing is read off any other label: words the source does not show are not written.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
SUP = "/System/Library/Fonts/Supplemental/"
FONTS = {"black": SUP + "Arial Black.ttf", "bold": SUP + "Arial Bold.ttf", "reg": SUP + "Arial.ttf",
         "narrow": SUP + "Arial Narrow.ttf", "narrowbold": SUP + "Arial Narrow Bold.ttf",
         "italic": SUP + "Arial Italic.ttf", "bolditalic": SUP + "Arial Bold Italic.ttf"}
PXMM = 12
SS = 3                                   # stars drawn at 3x, then reduced


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def merged(data):
    """The template's fields under the label's own; items and stars merge by key, words fill {name} slots."""
    if "template" not in data:
        return data
    t = load(os.path.join(HERE, "bee_redraw", "templates.json"))[data["template"]]
    d = {**t, **{k: v for k, v in data.items() if k not in ("items", "palette", "pictures", "stars")}}
    d["palette"] = {**t.get("palette", {}), **data.get("palette", {})}
    items = {it["key"]: dict(it) for it in t.get("items", [])}
    for it in data.get("items", []):
        items[it["key"]] = {**items.get(it["key"], {}), **it}
    words = data.get("words", {})
    out = []
    for it in items.values():
        if it.get("drop"):
            continue
        txt = it.get("t", "")
        for k, v in words.items():
            txt = txt.replace("{" + k + "}", v)
        if "{" in txt:
            raise SystemExit(f"item {it['key']}: no word for {txt}")
        out.append({**it, "t": txt})
    d["items"] = out
    d["stars"] = {**t.get("stars", {}), **data.get("stars", {})}
    d["pictures"] = data.get("pictures", t.get("pictures", []))
    d["lines"] = data.get("lines", t.get("lines", []))
    return d


def text_mask(text, font):
    """The word's ink at a large size, cropped to its ink, as an L image."""
    f = ImageFont.truetype(FONTS[font], 240)
    bb = f.getbbox(text)
    im = Image.new("L", (bb[2] - bb[0] + 40, bb[3] - bb[1] + 40), 0)
    ImageDraw.Draw(im).text((20 - bb[0], 20 - bb[1]), text, font=f, fill=255)
    return im.crop(im.getbbox())


def marks(mask):
    """The 8-connected marks of a mask, each as an array of (y, x)."""
    hh, ww = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        comp, stack = [], [(y0, x0)]
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < hh and 0 <= nx < ww and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        out.append(np.array(comp))
    return out


def inside_only(mask):
    """The parts of a mask (8-connected) that do not touch the window's edge."""
    hh, ww = mask.shape
    seen = np.zeros_like(mask)
    keep = np.zeros_like(mask)
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        comp, stack, edge = [], [(y0, x0)], False
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            edge |= y == 0 or x == 0 or y == hh - 1 or x == ww - 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < hh and 0 <= nx < ww and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if not edge:
            for y, x in comp:
                keep[y, x] = True
    return keep


def main():
    args = sys.argv[1:]
    data = merged(load(args[0]))
    dbg = args[args.index("--debug") + 1] if "--debug" in args else None
    cmp_ = args[args.index("--compare") + 1] if "--compare" in args else None

    src = Image.open(os.path.join(SITE, data["src"])).convert("RGBA")
    S = np.asarray(src).astype(np.float32)
    h, w = S.shape[:2]
    rgb, alpha = S[..., :3], S[..., 3]
    W = round(data["width_mm"] * PXMM)
    H = round(W * h / w)
    k = W / w                                         # source px -> output px
    N = lambda x, y: (x * w, y * h)                   # normalised -> source px

    # ── the label's ink colours, sampled at the template's points (median of a small box) ──
    names, cols = [], []
    for name, pts in data["palette"].items():
        if isinstance(pts, dict):                     # an ink given outright (the paper's white)
            names.append(name)
            cols.append(np.array(pts["rgb"], float))
            continue
        samp = []
        for x, y in (pts if isinstance(pts[0], list) else [pts]):
            px, py = N(x, y)
            box = rgb[max(0, int(py) - 2):int(py) + 3, max(0, int(px) - 2):int(px) + 3].reshape(-1, 3)
            samp.append(box)
        names.append(name)
        cols.append(np.median(np.concatenate(samp), axis=0))
    cols = np.array(cols)
    d2 = ((rgb[:, :, None, :] - cols[None, None]) ** 2).sum(-1)
    cls = d2.argmin(-1)
    CLEAR = len(names)
    # white print (on the green footer): light and neutral, unlike the cream paper (which is yellower)
    light_print = (rgb.min(-1) > 150) & ((rgb[..., 0] - rgb[..., 2]) < 35) & (alpha >= 128)
    # a pixel between two inks (the soft edge of a line) is uncertain: it takes the class of a sure neighbour whose ink is
    # nearest its colour, so a grey edge between black and cream never becomes a third ink (green) as a thin fringe
    srt = np.sort(d2, -1)
    unsure = np.sqrt(srt[..., 0]) > data.get("unsure", 0.55) * np.sqrt(srt[..., 1])
    unsure &= alpha >= 128
    for _ in range(8):
        if not unsure.any():
            break
        best_d = np.full((h, w), np.inf, np.float32)
        best_c = cls.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nc = np.roll(np.roll(cls, dy, 0), dx, 1)
                nu = np.roll(np.roll(unsure, dy, 0), dx, 1)
                dd = np.take_along_axis(d2, nc[..., None], -1)[..., 0]
                ok = ~nu & (dd < best_d)
                best_d[ok] = dd[ok]
                best_c[ok] = nc[ok]
        fix = unsure & np.isfinite(best_d)
        cls[fix] = best_c[fix]
        unsure &= ~fix
    def despeckle():
        # specks: a pixel with fewer than two neighbours of its own ink takes the ink most of its neighbours have
        for _ in range(2):
            same = np.zeros((h, w), np.int32)
            votes = np.zeros((h, w, CLEAR + 1), np.int16)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nc = np.roll(np.roll(cls, dy, 0), dx, 1)
                    same += nc == cls
                    np.put_along_axis(votes, nc[..., None], np.take_along_axis(votes, nc[..., None], -1) + 1, -1)
            lone = (same < data.get("speck", 2)) & (alpha >= 128)
            cls[lone] = votes.argmax(-1)[lone]

    despeckle()
    cls[alpha < 128] = CLEAR
    for pt in data.get("patches", []):               # a mark that is not the label's (what is left of a callout drawn
        (px0_, py0_), (px1_, py1_) = N(*pt["box"][:2]), N(*pt["box"][2:])   # over the maker's picture): its paper
        sub_ = cls[int(py0_):int(math.ceil(py1_)), int(px0_):int(math.ceil(px1_))]
        hit = sub_ != CLEAR
        for k_ in pt.get("only", []):
            hit &= sub_ == names.index(k_)
        sub_[hit] = names.index(pt["to"])
    if "rim" in data:                                 # a cut line printed along the die-cut edge (a thin tint): the
        r_ = data["rim"]                              # margin's own ink, up to the black outline
        g = alpha < 128
        for _ in range(r_["px"]):
            g2 = g.copy()
            g2[1:] |= g[:-1]; g2[:-1] |= g[1:]; g2[:, 1:] |= g[:, :-1]; g2[:, :-1] |= g[:, 1:]
            g = g2
        rim = g & (cls != CLEAR) & ~np.isin(cls, [names.index(n) for n in r_.get("keep", ["black"])])
        cls[rim] = names.index(r_["to"])
    allcols = np.vstack([cols, [[255, 255, 255]]])

    def dist_to(c):
        return np.sqrt(((rgb - c) ** 2).sum(-1))

    erase = np.zeros((h, w), bool)
    fills = []                                        # (mask, class) applied after every word is found

    # ── words: each one's ink box inside its window ──
    found = []
    foot = {}                                         # the bands of small print: rows and the columns their lines span
    for it in data["items"]:
        x0, y0 = N(*it["win"][:2])
        x1, y1 = N(*it["win"][2:])
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(math.ceil(x1)), int(math.ceil(y1))
        if "line" in it:                               # the n-th line of small print inside the band (its rows of ink)
            if it["band"] == "footer":                 # the green footer: the lowest run of rows mostly green
                gi = names.index("green")
                mid = cls[:, int(0.15 * w):int(0.95 * w)]
                lp = light_print[:, int(0.15 * w):int(0.95 * w)]
                frac = ((mid == gi) | lp).mean(1)    # green, or its white print
                rows_ = [y for y in range(int(0.8 * h), h) if frac[y] > 0.6]
                runs_ = []
                for y in rows_:
                    if runs_ and y - runs_[-1][1] <= 4:
                        runs_[-1][1] = y
                    else:
                        runs_.append([y, y])
                start, end = max(runs_, key=lambda r: r[1] - r[0])
                band = [0.3, start / h, 0.8, (end + 1) / h]
                if os.environ.get("BEE_RUNS"): print("green", start, end, h)
            else:
                band = it["band"]
            (bx0_, by0_), (bx1_, by1_) = N(*band[:2]), N(*band[2:])
            bx0_, by0_, bx1_, by1_ = int(bx0_), int(by0_), int(math.ceil(bx1_)), int(math.ceil(by1_))
            band_cls = cls[by0_:by1_, bx0_:bx1_]
            bgb = np.bincount(band_cls.ravel(), minlength=CLEAR + 1)[:CLEAR].argmax()
            dd_ = dist_to(cols[bgb])[by0_:by1_, bx0_:bx1_]
            inkm = light_print[by0_:by1_, bx0_:bx1_]   # the print's own (white) ink
            rows = list(inkm.sum(1) > 0) + [False]
            runs, r0_ = [], None
            for i_, v in enumerate(rows):
                if v and r0_ is None:
                    r0_ = i_
                if not v and r0_ is not None:
                    runs.append((r0_, i_)); r0_ = None
            runs = [r for r in runs if r[0] > 0 and r[1] < by1_ - by0_]   # not the band's own edges
            if runs:                                                        # nor a sliver of its border
                med = np.median([b - a for a, b in runs])
                runs = [r for r in runs if r[1] - r[0] >= 0.5 * med]
            while 0 < len(runs) < it["of"]:            # two lines touching (a tail on a cap): the tallest run split at its
                inkrows = inkm.sum(1)                  # thinnest row near its middle
                ra, rb = max(runs, key=lambda r: r[1] - r[0])
                if rb - ra < 6:
                    break
                lo, hi = ra + (rb - ra) * 3 // 10, ra + (rb - ra) * 7 // 10
                cut = lo + int(np.argmin(inkrows[lo:hi + 1]))
                runs = sorted([r for r in runs if r != (ra, rb)] + [(ra, cut), (cut + 1, rb)])
            if len(runs) > it["of"]:                   # more than the print's lines: keep those with the most ink
                inkrows = inkm.sum(1)
                runs = sorted(sorted(runs, key=lambda r: -inkrows[r[0]:r[1]].sum())[:it["of"]])
            if len(runs) != it["of"]:
                raise SystemExit(f"item {it['key']}: {len(runs)} lines of print in its band, not {it['of']}: {runs}")
            if os.environ.get("BEE_RUNS"): print(it["key"], by0_, runs)
            a_, b_ = runs[it["line"]]
            y0, y1 = by0_ + a_ - 1, by0_ + b_ + 1
            fb = foot.setdefault(it["band"] if isinstance(it["band"], str) else tuple(it["band"]), [by0_, by1_, x0, x1])
            fb[2], fb[3] = min(fb[2], x0), max(fb[3], x1)
            it = dict(it, win=[x0 / w, y0 / h, x1 / w, y1 / h])
        sub_cls = cls[y0:y1, x0:x1]
        if "bg" in it:
            bgc = names.index(it["bg"])
        else:
            bgc = np.bincount(sub_cls.ravel(), minlength=CLEAR + 1)[:CLEAR].argmax()
        full = dist_to(cols[bgc])
        full[alpha < 128] = 0
        top = np.percentile(full[y0:y1, x0:x1], 99.5)
        thr = max(it.get("thr", 0.45) * top, 45)
        # the word's marks: every mark (8-connected) whose middle lies in the window, whole even where it runs past it;
        # with "inside", only marks wholly inside the window (not a border line crossing it)
        PAD = 0 if it.get("inside") or it.get("clip") else max(4, round(0.03 * w))
        wy0, wy1, wx0, wx1 = y0, y1, x0, x1
        y0, y1, x0, x1 = max(0, y0 - PAD), min(h, y1 + PAD), max(0, x0 - PAD), min(w, x1 + PAD)
        dist = full[y0:y1, x0:x1]
        ink = np.zeros(dist.shape, bool)
        for comp in marks(dist > thr):
            cy_, cx_ = comp.mean(0)
            edge = (comp[:, 0] == 0).any() or (comp[:, 1] == 0).any() or (comp[:, 0] == y1 - y0 - 1).any() or (comp[:, 1] == x1 - x0 - 1).any()
            span_y, span_x = np.ptp(comp[:, 0]) + 1, np.ptp(comp[:, 1]) + 1
            too_big = span_y > 1.3 * (wy1 - wy0) or span_x > 1.3 * (wx1 - wx0)      # a border or rule, not a letter
            if it.get("clip"):                         # small print: all of it in the window, less a rule crossing the line
                take = not ("line" in it and (comp[:, 0] == 0).any() and (comp[:, 0] == y1 - y0 - 1).any())
            else:
                take = wy0 <= cy_ + y0 < wy1 and wx0 <= cx_ + x0 < wx1 and not (it.get("inside") and edge) and not too_big
            if take:
                ink[comp[:, 0], comp[:, 1]] = True
        if it.get("clip") and "line" in it:           # a line of the footer's white print: all of that print in its rows
            ink = light_print[y0:y1, x0:x1].copy()
        ys, xs = np.nonzero(ink)
        if len(xs) == 0:
            raise SystemExit(f"item {it['key']}: no ink in its window")
        bx0, by0, bx1, by1 = x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1
        if "box" in it:                                # a box given outright (normalised), for words the photo blurs together
            bx0, by0 = N(*it["box"][:2])
            bx1, by1 = N(*it["box"][2:])
        core = rgb[y0:y1, x0:x1][ink & (dist > 0.8 * dist[ink].max())]   # the word's own solid ink
        inkc = it.get("color") or np.median(core, axis=0).tolist()
        if "edge" in it:                               # the ink box's sub-pixel edges: where the coverage passes half
            pass
        m = np.zeros((h, w), bool)
        P = 8                                          # the word's soft edges: up to 3 px round its ink, also past the window
        py0, py1, px0, px1 = max(0, y0 - P), min(h, y1 + P), max(0, x0 - P), min(w, x1 + P)
        near = np.zeros((py1 - py0, px1 - px0), bool)
        near[y0 - py0:y1 - py0, x0 - px0:x1 - px0] = ink
        for i in range(it.get("grow", 3)):
            g = near.copy()
            g[1:] |= near[:-1]; g[:-1] |= near[1:]; g[:, 1:] |= near[:, :-1]; g[:, :-1] |= near[:, 1:]
            near = g
            if i == 0:
                near1 = near.copy()
            if i == 1:
                near2 = near.copy()                    # everything within 2 px of the ink goes, whatever its class
        # lines that run on past the word (a box's border, a band's edge) are kept: any other-coloured mark that reaches
        # the edge of the area round the word, except within 1 px of the word's own ink
        region = cls[py0:py1, px0:px1]
        keep = np.zeros(region.shape, bool)
        for comp in marks((region != bgc) & (region != CLEAR) & ~near1):
            if (comp[:, 0] == 0).any() or (comp[:, 1] == 0).any() or (comp[:, 0] == region.shape[0] - 1).any() or (comp[:, 1] == region.shape[1] - 1).any():
                keep[comp[:, 0], comp[:, 1]] = True
        m = np.zeros((h, w), bool)
        m[py0:py1, px0:px1] = (near2 | (near & (full[py0:py1, px0:px1] > 0.1 * top))) & ~keep
        if os.environ.get("BEE_BOX"): print(it["key"], f"x {bx0 / w:.3f}-{bx1 / w:.3f} y {by0 / h:.4f}-{by1 / h:.4f}")
        found.append(dict(it, box=(bx0, by0, bx1, by1), ink=inkc, bgc=bgc))
        fills.append((m, bgc))

    # every bit of white print left in a band of small print (a letter's tail between two lines' rows) goes too, all
    # but the art: the band's own ink class fills it
    for (fy0, fy1, fx0, fx1) in foot.values():
        fy0, fy1 = fy0 + 2, fy1 - 2                   # clear of the band's own edges (the paper above, the border below)
        for p in data.get("pictures", []):
            if "circle" in p:
                pcx, pcy = N(p["circle"][0], p["circle"][1])
                if fy0 - p["circle"][2] * w < pcy < fy1 + p["circle"][2] * w:
                    fx0 = max(fx0, int(pcx + p["circle"][2] * w) + 2)
        lp_ = light_print[fy0:fy1, fx0:fx1]
        g = lp_.copy()
        for _ in range(2):
            g2 = g.copy()
            g2[1:] |= g[:-1]; g2[:-1] |= g[1:]; g2[:, 1:] |= g[:, :-1]; g2[:, :-1] |= g[:, 1:]
            g = g2
        bgf = np.bincount(cls[fy0:fy1, fx0:fx1][~g].ravel(), minlength=CLEAR + 1)[:CLEAR].argmax()
        m = np.zeros((h, w), bool)
        m[fy0:fy1, fx0:fx1] = g & (cls[fy0:fy1, fx0:fx1] != CLEAR)
        fills.append((m, bgf))

    # ── stars: each refined from its rough place in the template ──
    stars = []
    st = data.get("stars") or {}
    inner = alpha > 128                               # the label less a margin along its die-cut edge (its outline)
    for _ in range(round(st.get("edge", 2.2) * w / 100)):
        g = inner.copy()
        g[1:] &= inner[:-1]; g[:-1] &= inner[1:]; g[:, 1:] &= inner[:, :-1]; g[:, :-1] &= inner[:, 1:]
        inner = g
    for i, (sx, sy, sr) in enumerate(st.get("at", [])):
        cx, cy = N(sx, sy)
        r0 = sr * w
        yy, xx = np.mgrid[0:h, 0:w]
        rr = np.hypot(xx - cx, yy - cy)
        ring = (rr > r0 * 1.2) & (rr < r0 * 1.45) & (alpha > 128)
        ring_cls = np.bincount(cls[ring].ravel(), minlength=CLEAR + 1)[:CLEAR]
        for skip in st.get("not_sector", []):
            ring_cls[names.index(skip)] = 0
        sec = ring_cls.argmax()
        near = (rr < r0 * st.get("reach", 1.3)) & inner
        other = near & (dist_to(cols[sec]) > 70)
        for skip in st.get("not_star", []):          # inks no star has (the yellow disc, the black band)
            other &= cls != names.index(skip)
        ys, xs = np.nonzero(other)
        mx, my = xs.mean(), ys.mean()
        for _ in range(3):                              # recentre on the star's own pixels
            rr2 = np.hypot(xs - mx, ys - my)
            keep = rr2 < r0 * st.get("reach", 1.3)
            mx, my = xs[keep].mean(), ys[keep].mean()
        rr2 = np.hypot(xs - mx, ys - my)
        R = np.percentile(rr2[rr2 < r0 * st.get("reach", 1.3)], 99.5) + 0.3
        ang = np.degrees(np.arctan2(ys - my, xs - mx))
        best, rot = -1, 0
        for a in np.arange(0, 72, 0.5):
            sc = 0
            for q in range(5):
                dd = np.abs((ang - (a + q * 72) + 180) % 360 - 180) < 5
                if dd.any():
                    sc += np.percentile(rr2[dd], 90)
            if sc > best:
                best, rot = sc, a
        # the star's own ink: its outline (the pixels near its edge that are neither the sector nor the fill) and its number
        rr3 = np.hypot(xx - mx, yy - my)
        lum = rgb.mean(-1)
        notsec = dist_to(cols[sec]) > 80
        edge = (rr3 > R * 0.55) & (rr3 < R + 0.5) & notsec & (lum < 200) & (alpha > 128)
        numpx = (rr3 < R * 0.32) & notsec & (lum < 150)
        oc = np.median(rgb[edge][lum[edge] <= np.percentile(lum[edge], 40)], axis=0) if edge.sum() > R * 2 else None
        nc = np.median(rgb[numpx][lum[numpx] <= np.percentile(lum[numpx], 50)], axis=0) if numpx.sum() > 3 else np.array([30, 30, 30])
        stars.append(dict(cx=mx, cy=my, R=R, rot=rot, sec=sec, n=str(i + 1), oc=oc, nc=nc))
        # taken out of the map: the star's own shape, 2 px larger, inside the margin
        pim = Image.new("L", (w, h), 0)
        Rb = R + 3
        ImageDraw.Draw(pim).polygon([(mx + (Rb if q % 2 == 0 else Rb * 0.42 + 2) * math.cos(math.radians(rot + q * 36)),
                                      my + (Rb if q % 2 == 0 else Rb * 0.42 + 2) * math.sin(math.radians(rot + q * 36)))
                                     for q in range(10)], fill=255)
        m = (np.asarray(pim) > 0) & inner
        for skip in st.get("keep", ["yellow"]):     # never eats into the yellow disc
            m &= cls != names.index(skip)
        fills.append((m, sec))
        # a sliver of the photo's star left past the drawn one's points (its tips a degree or two apart): small bits of
        # white just outside the erased shape go to the sector too (not a white sector next to it: that is large)
        if "white" in names and sec != names.index("white"):
            light = np.isin(cls, [names.index(n) for n in ("white", "cream") if n in names])
            ring = (rr3 < R * 1.3) & light & inner & ~(np.asarray(pim) > 0)
            sl = np.zeros((h, w), bool)
            for comp in marks(ring):
                if len(comp) < max(6, (0.35 * R) ** 2) and rr3[comp[:, 0], comp[:, 1]].max() < R * 1.22:
                    sl[comp[:, 0], comp[:, 1]] = True
            fills.append((sl, sec))
    if os.environ.get("BEE_DUMP"):
        np.save(os.environ["BEE_DUMP"] + "_pre.npy", cls)
    erased = np.zeros((h, w), bool)
    for m, c in fills:
        cls[m & (cls != CLEAR)] = c
        erased |= m
    if os.environ.get("BEE_DUMP"):
        np.save(os.environ["BEE_DUMP"] + "_fill.npy", cls)
    despeckle()

    # ── thin rules drawn as shapes (table lines on the older label): taken out of the map, drawn after ──
    rules = []
    for ln in data.get("lines", []):
        (ax, ay), (bx, by) = N(*ln["a"]), N(*ln["b"])
        rules.append(dict(ln, a=(ax, ay), b=(bx, by)))
        lw = ln.get("width", 1.5) * w / 100           # width in % of the label's width
        mx0, mx1 = int(min(ax, bx) - lw), int(max(ax, bx) + lw + 1)
        my0, my1 = int(min(ay, by) - lw - 1), int(max(ay, by) + lw + 2)
        sub = cls[my0:my1, mx0:mx1]
        bg = names.index(ln["bg"])
        sub[(sub != CLEAR)] = bg

    # ── the flat colour map enlarged with smooth edges ──
    def up(mask):
        im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(data.get("soft", 0.7)))
        return np.asarray(im.resize((W, H), Image.BICUBIC)).astype(np.float32) / 255

    # each edge pixel shared between its own ink and the neighbouring one, by where its colour lies between the two, so
    # the enlarged edge falls where the source's edge really is (not on the pixel grid)
    soft = np.zeros((CLEAR + 1, h, w), np.float32)
    t = np.zeros((h, w), np.float32)
    other = np.full((h, w), -1)
    A = allcols[cls]
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nb = np.roll(np.roll(cls, -dy, 0), -dx, 1)
        cand = (other < 0) & (nb != cls) & (nb != CLEAR) & (cls != CLEAR) & ~erased
        other[cand] = nb[cand]
    has = other >= 0
    B = allcols[np.where(has, other, 0)]
    d = B - A
    t = ((rgb - A) * d).sum(-1) / np.maximum((d * d).sum(-1), 1)
    t = np.where(has, np.clip(t, 0, 0.5), 0).astype(np.float32)   # never past half: the pixel keeps its own class
    yy_, xx_ = np.nonzero(np.ones((h, w), bool))
    soft[cls.ravel(), yy_, xx_] = 1 - t.ravel()
    ok = has.ravel()
    soft[other.ravel()[ok], yy_[ok], xx_[ok]] += t.ravel()[ok]

    layers = []
    for c in range(CLEAR + 1):
        if not (cls == c).any():
            continue
        layers.append((c, up(soft[c])))
    # each pixel: the strongest class wins, the edge between the two strongest blended over about one output pixel
    stack = np.stack([m for _, m in layers])
    order = np.argsort(-stack, axis=0)
    i1, i2 = order[0], order[1]
    m1 = np.take_along_axis(stack, i1[None], 0)[0]
    m2 = np.take_along_axis(stack, i2[None], 0)[0]
    t = np.clip((m1 - m2) * k * 0.9 + 0.5, 0, 1)      # 1: all first class; 0.5 on the edge
    lc = np.array([allcols[c] for c, _ in layers], np.float32)
    la = np.array([0.0 if c == CLEAR else 1.0 for c, _ in layers], np.float32)
    c1, c2 = lc[i1], lc[i2]
    a1, a2 = la[i1], la[i2]
    A = a1 * t + a2 * (1 - t)
    C = (c1 * (a1 * t)[..., None] + c2 * (a2 * (1 - t))[..., None]) / np.maximum(A, 1e-4)[..., None]
    base = Image.fromarray(np.dstack([C.clip(0, 255), A * 255]).astype(np.uint8), "RGBA")

    if "--base" in args:                              # the flat colours alone (to check the words came out cleanly)
        base.save(args[args.index("--base") + 1])
    # ── shapes and words on top, drawn at SS x and reduced ──
    over = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    od = ImageDraw.Draw(over)
    K = k * SS
    for ln in rules:
        col = tuple(int(v) for v in allcols[names.index(ln["color"])]) + (255,)
        od.line((ln["a"][0] * K, ln["a"][1] * K, ln["b"][0] * K, ln["b"][1] * K), fill=col,
                width=max(1, round(ln.get("width", 1.5) * w / 100 * K)))
    sfill = tuple(int(v) for v in allcols[names.index(st["fill"])]) if st.get("fill") else (255, 255, 255)
    for s in stars:
        pts = []
        inner = st.get("inner", 0.42)
        for q in range(10):
            r = s["R"] if q % 2 == 0 else s["R"] * inner
            a = math.radians(s["rot"] + q * 36)
            pts.append(((s["cx"] + r * math.cos(a)) * K, (s["cy"] + r * math.sin(a)) * K))
        line_col = st.get("outline", {}).get(names[s["sec"]])
        if line_col:
            lw = st.get("outline_w", 0.35) * w / 100 * K
            oc = tuple(int(v) for v in (s["oc"] if line_col == "auto" and s["oc"] is not None else
                                        line_col if isinstance(line_col, list) else allcols[names.index(line_col)])) + (255,)
            od.polygon(pts, fill=oc)
            # the fill inset by the outline's width (each vertex pulled towards the centre)
            ins = []
            for q, (px, py) in enumerate(pts):
                dx, dy = px - s["cx"] * K, py - s["cy"] * K
                L = math.hypot(dx, dy)
                f = (L - lw * (1.9 if q % 2 == 0 else 1.0)) / L
                ins.append((s["cx"] * K + dx * f, s["cy"] * K + dy * f))
            od.polygon(ins, fill=sfill + (255,))
        else:
            od.polygon(pts, fill=sfill + (255,))
    over_small = over.resize((W, H), Image.LANCZOS)
    base.alpha_composite(over_small)

    # star numbers and words
    for s in stars:
        nh = st.get("num_h", 0.45) * s["R"] * k
        nm = text_mask(s["n"], st.get("num_font", "reg"))
        nw = nm.width * nh / nm.height
        nm = nm.resize((max(1, round(nw)), max(1, round(nh))), Image.LANCZOS)
        nc = tuple(int(v) for v in s["nc"])
        ox, oy = st.get("num_off", [0, 0.06])
        base.alpha_composite(Image.merge("RGBA", (*[Image.new("L", nm.size, v) for v in nc], nm)),
                             (round(s["cx"] * k - nm.width / 2 + ox * s["R"] * k), round(s["cy"] * k - nm.height / 2 + oy * s["R"] * k)))
    for it in found:
        bx0, by0, bx1, by1 = it["box"]
        tw, th = (bx1 - bx0) * k, (by1 - by0) * k
        tm = text_mask(it["t"], it.get("font", "bold"))
        if it.get("keep_aspect"):                     # fit inside the box without stretching (very small print)
            sc = min(tw / tm.width, th / tm.height)
            tw2, th2 = tm.width * sc, tm.height * sc
            ox, oy = bx0 * k + (tw - tw2) / 2, by0 * k + (th - th2) / 2
            tw, th = tw2, th2
        else:
            ox, oy = bx0 * k, by0 * k
        tm = tm.resize((max(1, round(tw)), max(1, round(th))), Image.LANCZOS)
        ic = tuple(int(v) for v in it["ink"][:3])
        base.alpha_composite(Image.merge("RGBA", (*[Image.new("L", tm.size, v) for v in ic], tm)), (round(ox), round(oy)))

    # pictures that are art: the photograph, enlarged, inside a circle or a box
    for p in data.get("pictures", []):
        if "circle" in p:
            cx, cy = N(p["circle"][0], p["circle"][1])
            r = p["circle"][2] * w
            box = (cx - r, cy - r, cx + r, cy + r)
        else:
            (ax, ay), (bx, by) = N(*p["box"][:2]), N(*p["box"][2:])
            box = (ax, ay, bx, by)
        crop = src.crop(tuple(round(v) for v in box))
        size = (round((box[2] - box[0]) * k), round((box[3] - box[1]) * k))
        crop = crop.resize(size, Image.LANCZOS)
        mask = Image.new("L", (size[0] * SS, size[1] * SS), 0)
        if "circle" in p:
            ImageDraw.Draw(mask).ellipse((0, 0, size[0] * SS - 1, size[1] * SS - 1), fill=255)
        else:
            mask.paste(255, (0, 0, size[0] * SS, size[1] * SS))
        mask = mask.resize(size, Image.LANCZOS)
        crop.putalpha(Image.fromarray(np.minimum(np.asarray(mask), np.asarray(crop.getchannel("A")))))
        base.alpha_composite(crop, (round(box[0] * k), round(box[1] * k)))

    # a builder that reads the label's pixel sizes from a data file (to place a strip over it): those sizes follow the new
    # texture. The first path is the label's [width, height]; the factor is taken from it, so a second run changes nothing.
    rj = data.get("rescale_json")
    if rj:
        jp = os.path.join(SITE, rj["file"])
        J = load(jp)

        def walk(obj, keys, fn):
            k0, rest = keys[0], keys[1:]
            subs = obj.values() if k0 == "*" else [obj] if False else None
            targets = list(obj.keys()) if k0 == "*" else [k0]
            for kk in targets:
                if rest:
                    walk(obj[kk], rest, fn)
                else:
                    obj[kk] = fn(obj[kk])

        first = J
        for kk in rj["paths"][0].split("."):
            first = first[kk]
        f = W / first[0]
        sc = lambda v: [round(x * f, 2) if isinstance(x, float) or not isinstance(v, list) else round(x * f) for x in v] if isinstance(v, list) else (round(v * f) if isinstance(v, int) else round(v * f, 2))
        if abs(f - 1) > 1e-6:
            for pth in rj["paths"]:
                walk(J, pth.split("."), sc)
            with open(jp, "w", encoding="utf-8") as fh:
                json.dump(J, fh, indent=1, ensure_ascii=False)
            print(f"{rj['file']}: pixel sizes x {f:.4f}")

    out = os.path.join(SITE, data["out"])
    colours = data.get("colours", 128)
    base.quantize(colors=colours, method=Image.Quantize.FASTOCTREE).save(out, optimize=True)
    print(f"{data['out']}: {W} x {H} px ({PXMM} px/mm over {data['width_mm']} mm), {os.path.getsize(out) // 1024} KB, "
          f"aspect {W / H:.4f} (source {w / h:.4f}), {len(found)} words, {len(stars)} stars")

    if dbg:
        im = src.convert("RGB").resize((w * 3, h * 3), Image.NEAREST)
        dd = ImageDraw.Draw(im)
        for it in data["items"]:
            x0, y0 = N(*it["win"][:2])
            x1, y1 = N(*it["win"][2:])
            dd.rectangle((x0 * 3, y0 * 3, x1 * 3, y1 * 3), outline=(0, 120, 255))
        for it in found:
            b = it["box"]
            dd.rectangle((b[0] * 3, b[1] * 3, b[2] * 3 - 1, b[3] * 3 - 1), outline=(255, 0, 200))
            dd.text((b[0] * 3, b[3] * 3), it["key"], fill=(255, 0, 200))
        for s in stars:
            dd.ellipse(((s["cx"] - s["R"]) * 3, (s["cy"] - s["R"]) * 3, (s["cx"] + s["R"]) * 3, (s["cy"] + s["R"]) * 3), outline=(0, 200, 0))
        for name, pts in data["palette"].items():
            if isinstance(pts, dict):
                continue
            for x, y in (pts if isinstance(pts[0], list) else [pts]):
                px, py = N(x, y)
                dd.rectangle((px * 3 - 4, py * 3 - 4, px * 3 + 4, py * 3 + 4), outline=(255, 128, 0))
                dd.text((px * 3 + 6, py * 3 - 6), name, fill=(255, 128, 0))
        im.save(dbg)
    if cmp_:
        old = src.resize((W, H), Image.BICUBIC)
        new = Image.open(out).convert("RGBA")
        sheet = Image.new("RGBA", (W * 2 + 20, H), (128, 128, 128, 255))
        sheet.alpha_composite(old, (0, 0))
        sheet.alpha_composite(new, (W + 20, 0))
        sheet.convert("RGB").save(cmp_)


main()
