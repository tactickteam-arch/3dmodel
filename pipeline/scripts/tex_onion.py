"""The red onion's skin, drawn: deep wine-purple with fine veins running from root to neck, coppery papery patches
where the dry outer skin has lifted, and tan dried ends. It replaces the photo crop (tex_food_photos.py), which
came out as a pink smear on the bulb and made the onions the least real thing in the vegetable drawer.

u runs round the bulb and wraps; v runs from root to neck. Both ends are drawn alike (tan, veins converging),
so it doesn't matter which way up the texture lands.

usage: python tex_onion.py [out dir]      (default pipeline/tex; writes <out dir>/food/onion.jpg)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "tex"), "food")
os.makedirs(OUT, exist_ok=True)
W, H = 512, 256
rng = np.random.default_rng(7)


def wrap_noise(scale_x, scale_y, seed):
    """smooth value noise 0..1 that wraps left to right, features about scale pixels across"""
    r = np.random.default_rng(seed)
    gw, gh = max(2, round(W / scale_x)), max(2, round(H / scale_y) + 1)
    g = r.random((gh, gw)).astype(np.float32)
    g = np.concatenate([g, g[:, :1]], 1)                    # the first column again, so the right edge meets the left
    big = Image.fromarray((g * 255).astype(np.uint8)).resize((W + W // gw, H), Image.BICUBIC)
    return np.asarray(big).astype(np.float32)[:, :W] / 255.0


def fbm(scale_x, scale_y, octaves, seed):
    a, amp, tot = np.zeros((H, W), np.float32), 1.0, 0.0
    for o in range(octaves):
        a += amp * wrap_noise(max(2, scale_x / 2 ** o), max(2, scale_y / 2 ** o), seed + 11 * o)
        tot += amp
        amp *= 0.5
    return a / tot


def mix(a, c, t):
    return a * (1 - t[..., None]) + np.array(c, np.float32) * t[..., None]


v = np.linspace(0, 1, H, dtype=np.float32)[:, None]          # 0 and 1 are the two ends
u = np.linspace(0, 1, W, endpoint=False, dtype=np.float32)[None, :]
end = np.maximum(0, 1 - np.minimum(v, 1 - v) / 0.16) ** 1.6  # 1 at an end, 0 from 16% in

# the body: wine-purple, varying in long streaks along the bulb
streak = fbm(W / 40, H / 1.2, 3, 3)
a = mix(np.zeros((H, W, 3), np.float32) + np.array((92, 26, 40), np.float32), (138, 48, 62), streak)
a = mix(a, (62, 16, 28), np.clip(fbm(W / 6, H / 3, 3, 5) - 0.45, 0, 1) * 1.4)   # darker, richer areas

# veins from root to neck: thin, slightly wandering lines, a few lighter (the rib of each scale), more darker
veins = np.zeros((H, W), np.float32)
xs = np.arange(W, dtype=np.float32)[None, :]
for i in range(84):
    u0 = (i + rng.uniform(-0.3, 0.3)) / 84 * W
    wander = (wrap_noise(W, H / 3, 100 + i)[:, :1] - 0.5) * 9          # a slow wobble along its length
    centre = u0 + wander
    d = np.abs(((xs - centre) + W / 2) % W - W / 2)                    # distance round the wrap
    width = rng.uniform(0.6, 1.3)
    line = np.exp(-(d / width) ** 2) * (0.35 + 0.65 * wrap_noise(W, H / 4, 300 + i)[:, :1])   # stronger in places
    veins += line * (1 if i % 3 == 0 else -0.8) * rng.uniform(0.5, 1.0)
light, dark = np.clip(veins, 0, 1), np.clip(-veins, 0, 1)
a = mix(a, (176, 110, 118), light * 0.35)
a = mix(a, (48, 12, 22), dark * 0.45)

# papery outer skin lifted in places: coppery and see-through, torn along the veins, so long and narrow
paper = fbm(W / 22, H / 2.2, 4, 9)
lift = np.clip((paper - 0.66) * 10, 0, 1)
a = mix(a, (150, 90, 74), lift * 0.45)
a = mix(a, (96, 54, 44), np.clip((paper - 0.66) * 40, 0, 1) * np.clip((0.72 - paper) * 40, 0, 1) * 0.4)   # its torn edge

# the dry ends: tan root plate and neck, the purple fading into them
a = mix(a, (128, 96, 66), end * 0.85)

# fine grain, so it is never flat in a close-up
a *= (0.94 + 0.12 * fbm(6, 6, 2, 21))[..., None]
img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
p = os.path.join(OUT, "onion.jpg")
img.save(p, quality=86, optimize=True)
print("wrote", p, img.size)
