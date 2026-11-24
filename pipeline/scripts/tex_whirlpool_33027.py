"""Textures for the Whirlpool Xpert Care 9 kg front-load washer, item code 33027 (Volcano Grey): the 33015's band drawing
(tex_whirlpool_33015.py) with the 33027's own colours and its panel's differences, as Whirlpool's 33027 front photo shows them
(More Cycles in place of Drum Clean, an Ozone key in place of the Steam key, 9kg and the RPM printed there).

usage: python3 tex_whirlpool_33027.py      (writes pipeline/tex/whirlpool_33027/)
"""
import tex_whirlpool_33015 as base

if __name__ == "__main__":
    base.main(base.CONFIGS["33027"])
