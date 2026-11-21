"""Textures for the Whirlpool 360 Bloomwash Pro H 10 kg top-load washer, model code 31688 (Graphite).
The 8.5 kg 31671 is the same family; this runs tex_whirlpool_31671.py's code with the 31688's own photos and settings.

usage: python3 tex_whirlpool_31688.py <photos dir> <out dir> [--debug <dir>] [--halves-only]
  photos:  whirlpool_31688/ (Whirlpool India's own gallery for 31688, 1200 x 1200; the label 1500 x 1500):
           top_closed.jpg  the machine from above, lid shut: the control panel (re-set from this photo)
           label.jpg       Whirlpool's energy label published on 31688's page (0.0086 kWh/kg/cycle, 10 kg, VA I 100 5S / 2025)
  writes <out dir>/whirlpool_31688/*

The panel print is the 31671's: Whirlpool's top photos of the two models show the same words, icons, keys and marks in the
same places, only "10.0 kg" for "8.5 kg". This model's own top_closed.jpg is too soft to re-draw the icons from (its icon ink
comes out broken), so the print is re-set from the 31671's top_open.jpg exactly as for the 31671, and PLACED on this panel
by registering the two rectified panels (ink correlation; their overlay lines up word for word):
    x_31688 = 0.9675 x_31671 - 3.07,  y_31688 = 0.995 y_31671 + 2.54   (rectified photo px)
"10.0 kg" is set in the box this model's photo gives it. The panel's size is this model's (538 x 145 mm).

The panel texture (panel.jpg) is drawn at the family's 7.2 px per mm, which keeps it inside the 4096 px a phone or headset
loads. For a shopper who steps up close, the same print is drawn again at 12 px per mm (6456 px across) and cut in two at
the emptiest column of its middle, each half under 4096 px: panel_a.jpg and panel_b.jpg, laid over the panel face as two
decals (decals.json gives each half's u, v rectangle on the face; make_whirlpool_31688.mjs lays them with decal_curved.mjs).

Whirlpool shows no rear photo of the 31688, so there is no back texture (the back is left plain; NOTES.md).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tex_whirlpool_31671 as T  # noqa: E402

CFG = dict(T.CFG)
CFG.update({
    "slug": "whirlpool_31688",
    # the print's source: the 31671's photo and its rectified panel (see tex_whirlpool_31671.py)
    "photo_slug": "whirlpool_31671",
    "photo": "top_open.jpg",
    "quad": [[183, 141], [1025, 141], [1025, 343], [183, 343]],
    "rect": (842, 202),
    "map": None,
    # this model's panel: top_closed.jpg's face quad [[188, 159], [999, 159], [999, 406], [188, 406]] rectified to 811 x 218 px
    # (at 218 px the Whirlpool wordmark measures 3.0 : 1, the official mark's proportions), and the 31671's print placed on it
    "place": {"map": (0.9675, -3.07, 0.995, 2.54), "rect_w": 811},
    # ESTIMATED: 538 mm across (the top cover's width, 570 - 2 x 16 mm shoulders, as on the 8.5 kg), and 145 mm up the slope at
    # the rectified photo's true aspect (811 x 218 px)
    "face_mm": (538, 145),
    "kg": "10.0 kg",
    # "10.0 kg" in top_closed.jpg spans x 575-625 px of this panel (597.5-649.2 in the 31671's px); set on the row's baseline
    "kg_fixed": (597.5, 175, 649.5, 190),
    "body": (54, 54, 56),                  # Graphite, sRGB, the cabinet's 0x363638 (sampled off Whirlpool's 31688 photos)
    "label": "label.jpg",
    # the side relief measured on this model's three_quarter_left_low.jpg (see SIDE in tex_whirlpool_31671.py), in mm from
    # the decal's bottom (36 mm above the floor, up to the seam at 780 mm) and from the pocket's end; the pocket has a bright trim in this model's photos
    "side": {"d": 607, "h": 744, "outer": (68, 99, 519, 665, 50), "inner": (121, 174, 458, 591, 25), "gap": (370, 486),
             "square": (182, 245, 367, 516, 45), "handle": (95, 424, 88, 41), "rim": (150, 152, 156)},
    "back": None,
    # the impeller in lid_open_top.jpg: a dark grey dish (median 77-88), black vanes and hub
    "impeller": {"dish": 86, "holes": (36, 36, 38), "hub": (30, 30, 32)},
})

HI_PX_MM = 12      # the decals' density on the model
TEX_MAX = 4096     # the largest texture a phone or headset loads (showroom.js TEX_MAX)


def panel_halves(cfg, photos, out):
    """the panel drawn again at HI_PX_MM and cut in two at the emptiest column between the two halves' size limits;
    writes panel_a.jpg, panel_b.jpg and decals.json"""
    import numpy as np
    keep = T.PX_MM
    T.PX_MM = HI_PX_MM
    try:
        img = T.Panel(cfg, photos, None).draw()
    finally:
        T.PX_MM = keep
    a = np.asarray(img).astype(np.float32).max(2)
    W = a.shape[1]
    lo, hi = W - TEX_MAX + 16, TEX_MAX - 16          # both halves under TEX_MAX
    ink = (a > 40).sum(0).astype(np.float32)
    ink = np.convolve(ink, np.ones(25), "same")        # an empty strip, not just one empty column
    cut = int(lo + np.argmin(ink[lo:hi]))
    halves = {"panelA": ("panel_a.jpg", 0, cut), "panelB": ("panel_b.jpg", cut, W)}
    rects = {}
    for key, (name, x0, x1) in halves.items():
        img.crop((x0, 0, x1, img.height)).save(os.path.join(out, name), quality=92, subsampling=0, optimize=True)
        rects[key] = {"file": name, "rect": [x0 / W, 0, x1 / W, 1]}
    with open(os.path.join(out, "decals.json"), "w") as f:
        json.dump(rects, f, indent=1)
    print("wrote panel_a.jpg, panel_b.jpg", img.size, "cut at", cut, "px; ink there", float(ink[cut]))


if __name__ == "__main__":
    # --halves-only: only the two panel decals (a full run also rewrites label.png from label.jpg; the redrawn label comes
    # from pipeline/scripts/bee_redraw/whirlpool_31688.json, so re-run that after a full run)
    only = "--halves-only" in sys.argv
    argv = [x for x in sys.argv[1:] if x != "--halves-only"]
    if not only:
        T.main(CFG, argv)
    panel_halves(CFG, argv[0], os.path.join(argv[1], CFG["slug"]))
