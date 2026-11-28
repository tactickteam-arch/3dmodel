"""What Apple's AR Quick Look (iPhone, iPad, Vision Pro) will do with one of our .usdz files, checked without a device.
The gate runs it on every Apple file (checks ql-scene, ql-textures, ql-taps; STANDARD.md section 5).

usage: tools/usdenv/bin/python -I pipeline/scripts/ql_check.py <file.usdz> <products.json or entry file> <product id>
prints one line of JSON: {"scene": [...problems], "textures": [...], "taps": [...], "info": {...}}

scene     metres, Y up, a default prim, one active scene in the scene library; the floor anchor on a floor product's own
          file (Preliminary_AnchoringAPI, plane, horizontal: Apple's "first detected plane"), and no anchor at all on a
          wall unit's (with "vertical" Quick Look stands the model's base against the wall) or on a -free copy; anchored
          prims only where Apple allows them. The whole model's size as USD reads it (the gate compares it with the GLB).
textures  only JPEG and PNG (the formats a USDZ may hold that every iPhone back to iOS 13 reads; AVIF and EXR need
          newer systems), 8-bit, RGB or grey (no CMYK JPEG), each file's bytes what its name says, every texture the
          scene names inside the file, nothing in it unused; at most 8192 px a side (over 4096 is a warning: the house
          rule splits such prints), and the textures' memory once
          decoded (RGBA, 8 bits, with mipmaps) within TEX_MB. Apple's AR Quick Look guidance (WWDC18 603, confirmed on
          Apple's forums in 2021 for devices down to iPhone 7) is about one 2048 x 2048 set per model, and Quick Look
          shrinks textures itself on a phone short of memory; a 4096 x 4096 texture alone is about 85 MB decoded.
taps      Quick Look's tap-to-open, played out from the file's own behaviours, from the start and through every order of
          taps a shopper can make (a tap lands on any copy that isn't parked: RealityKit gives every tap target a
          collision shape and nothing else, so a ray through the body reaches a part inside it):
            - each part shows exactly one copy at all times (none vanishes, none doubles), shut at PoseClosed or open
              at PoseOpen, the other parked at scale 0.001;
            - a part that `needs` another (trays behind a door, a rack inside a dishwasher) can't be opened, or nudged
              by the start hint, while that one is shut, and goes back in before it closes;
            - every part opens and shuts again, with a swing (not a jump), using only Transform, Group and Wait actions
              (no Show or Hide, which can leave a part invisible).
            - one tap moves one part (and, on closing, the parts inside it, which go back in first).
"""
import hashlib
import json
import math
import re
import struct
import sys
import zipfile

from pxr import Gf, Sdf, Usd, UsdGeom

TEX_MB = 160       # decoded texture memory per file (RGBA8 + mipmaps); see the docstring
TEX_SIDE = 8192    # px, the longest side of any texture (the Metal limit of the oldest iPhones Quick Look ran on)
TEX_SPLIT = 4096   # px, the house rule: prints longer than this are split (a warning here)
PARK = 0.001       # make_usdz.mjs parks the unused copy at this scale
FULL, GONE = 0.5, 0.01

path, products, pid = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(products, encoding="utf-8"))
entry = next(p for p in data["products"] if p["id"] == pid)
free = path.endswith("-free.usdz")
wall = entry.get("placement") == "wall"
safe = lambda s: re.sub(r"^([0-9])", r"_\1", re.sub(r"[^A-Za-z0-9_]", "_", s or "Node"))
out = {"scene": [], "textures": [], "taps": [], "warn": [], "info": {}}


# ── textures: straight from the zip ──
def image_info(b):
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack(">II", b[16:24])
        return "png", w, h, b[24], b[25]
    if b[:2] == b"\xff\xd8":
        i = 2
        while i < len(b) - 9:
            if b[i] != 0xFF:
                i += 1
                continue
            t = b[i + 1]
            if 0xC0 <= t <= 0xCF and t not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack(">HH", b[i + 5:i + 9])
                return "jpg", w, h, b[i + 4], b[i + 9]
            i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
    return "?", 0, 0, 0, 0


with zipfile.ZipFile(path) as z:
    infos = z.infolist()
    names = [i.filename for i in infos]
    if not names or not names[0].endswith((".usda", ".usdc", ".usd")):
        out["scene"].append(f"the first file in the zip is {names[0] if names else 'nothing'}, not the scene")
    if any(i.compress_type != zipfile.ZIP_STORED for i in infos):
        out["scene"].append("the zip is compressed (a USDZ must be stored)")
    scene_text = z.read(names[0]).decode("utf-8", "replace") if names and names[0].endswith(".usda") else ""
    used = set(re.findall(r"@([^@]+)@", scene_text))
    mem = 0
    big, long_ = [], []
    for i in infos[1:]:
        b = z.read(i.filename)
        kind, w, h, depth, ch = image_info(b)
        ext = i.filename.lower().rsplit(".", 1)[-1]
        if kind == "?":
            out["textures"].append(f"{i.filename}: not a JPEG or PNG")
            continue
        if {"jpg": "jpg", "jpeg": "jpg", "png": "png"}.get(ext) != kind:
            out["textures"].append(f"{i.filename}: holds a {kind.upper()} under a .{ext} name")
        if depth != 8 and not (kind == "png" and ch == 3 and depth in (1, 2, 4)):
            out["textures"].append(f"{i.filename}: {depth}-bit")
        if kind == "jpg" and ch not in (1, 3):
            out["textures"].append(f"{i.filename}: a {ch}-channel (CMYK) JPEG")
        if max(w, h) > TEX_SIDE:
            big.append(f"{i.filename} {w}x{h}")
        elif max(w, h) > TEX_SPLIT:
            long_.append(f"{i.filename} {w}x{h}")
        mem += w * h * 4 * 4 / 3
        if i.filename not in used:
            out["textures"].append(f"{i.filename}: in the file but not used by the scene")
    for u in sorted(used - set(names)):
        out["textures"].append(f"{u}: named by the scene but missing from the file (it would draw black or untextured)")
    if big:
        out["textures"].append(f"{len(big)} textures over {TEX_SIDE} px: {', '.join(big[:4])}")
    if long_:
        out["warn"] = [f"{len(long_)} textures over {TEX_SPLIT} px (the house rule splits prints this long): {', '.join(long_[:4])}"]
    out["info"]["textureMB"] = round(mem / 2 ** 20, 1)
    out["info"]["textures"] = len(infos) - 1
    if mem / 2 ** 20 > TEX_MB:
        out["textures"].append(f"textures take {mem / 2 ** 20:.0f} MB once decoded (budget {TEX_MB} MB)")

# ── the scene ──
stage = Usd.Stage.Open(path)
if UsdGeom.GetStageMetersPerUnit(stage) != 1:
    out["scene"].append(f"metersPerUnit {UsdGeom.GetStageMetersPerUnit(stage)} (must be 1: Quick Look shows it at real size in metres)")
if UsdGeom.GetStageUpAxis(stage) != "Y":
    out["scene"].append(f"upAxis {UsdGeom.GetStageUpAxis(stage)} (must be Y)")
dp = stage.GetDefaultPrim()
if not dp:
    out["scene"].append("no defaultPrim")
lib = [p for p in stage.Traverse() if Usd.ModelAPI(p).GetKind() == "sceneLibrary"]
scenes = [c for l in lib for c in l.GetChildren() if c.IsActive() and c.GetSpecifier() == Sdf.SpecifierDef] if lib else []
if len(scenes) != 1:
    out["scene"].append(f"{len(scenes)} active scenes in the scene library (Quick Look shows the first; there must be one)")
anchored = [p for p in stage.Traverse() if "Preliminary_AnchoringAPI" in (p.GetMetadata("apiSchemas").GetAddedOrExplicitItems() if p.GetMetadata("apiSchemas") else [])]
want = not wall and not free
if want:
    a = scenes[0] if scenes else None
    if not a or a not in anchored:
        out["scene"].append("a floor product's file has no floor anchor on its scene (Quick Look would not stand it on the floor)")
    else:
        t, al = a.GetAttribute("preliminary:anchoring:type").Get(), a.GetAttribute("preliminary:planeAnchoring:alignment").Get()
        if (t, al) != ("plane", "horizontal"):
            out["scene"].append(f"anchor {t}/{al}, a floor product needs plane/horizontal")
    extra = [p for p in anchored if p != a]
    if extra:
        out["scene"].append(f"{len(extra)} more anchored prims ({extra[0].GetPath()}): each is placed on its own, away from the product")
elif anchored:
    out["scene"].append(f"{'a -free copy' if free else 'a wall unit'} has an anchor on {anchored[0].GetPath()} ({'it must have none' if free else 'with vertical anchoring Quick Look stands its base against the wall; with none it goes on a wall upright'})")
bb = UsdGeom.BBoxCache(Usd.TimeCode.Default(), ["default", "render"]).ComputeWorldBound(dp).ComputeAlignedRange() if dp else None
if bb and not bb.IsEmpty():
    mn, mx = bb.GetMin(), bb.GetMax()
    out["info"]["size"] = [round((mx[k] - mn[k]) * 1000, 1) for k in range(3)]
    out["info"]["min"] = [round(mn[k] * 1000, 1) for k in range(3)]
    out["info"]["max"] = [round(mx[k] * 1000, 1) for k in range(3)]
out["info"]["triangles"] = sum(sum(c - 2 for c in (UsdGeom.Mesh(p).GetFaceVertexCountsAttr().Get() or [])) for p in stage.Traverse() if p.IsA(UsdGeom.Mesh))

# ── tap to open, played out ──
taps = out["taps"]


def xf(prim):
    """a prim's local transform as (translate, orient quaternion, scale)"""
    t, q, s = Gf.Vec3d(0), Gf.Quatd(1), Gf.Vec3d(1)
    for op in UsdGeom.Xformable(prim).GetOrderedXformOps():
        v = op.Get()
        if op.GetOpType() == UsdGeom.XformOp.TypeTranslate:
            t = Gf.Vec3d(v)
        elif op.GetOpType() == UsdGeom.XformOp.TypeOrient:
            q = Gf.Quatd(v.GetReal(), Gf.Vec3d(v.GetImaginary()))
        elif op.GetOpType() == UsdGeom.XformOp.TypeScale:
            s = Gf.Vec3d(v)
        elif op.GetOpType() != UsdGeom.XformOp.TypeTransform:
            taps.append(f"{prim.GetPath()}: transform op {op.GetOpName()} (make_usdz writes translate/orient/scale only)")
    return (t, q, s)


def same(a, b):
    (ta, qa, sa), (tb, qb, sb) = a, b
    dq = abs(qa.GetReal() * qb.GetReal() + Gf.Dot(qa.GetImaginary(), qb.GetImaginary()))
    return (ta - tb).GetLength() < 0.0005 and dq > math.cos(math.radians(0.25)) and max(abs(sa[k] - sb[k]) for k in range(3)) < 1e-4 * max(1, max(map(abs, sb)))


by_name = {}
for p in stage.Traverse():
    if p.IsA(UsdGeom.Xform):  # a material may share a part's name
        by_name.setdefault(p.GetName(), []).append(p)
parts = entry.get("parts") or []
movers = []  # (part key, node) for every node a part moves (its own and its `also` companions)
for p in parts:
    movers.append((p["key"], p["node"]))
    movers += [(p["key"], a["node"]) for a in p.get("also") or []]
copies = {}
for key, node in movers:
    n = safe(node)
    got = {lbl: by_name.get(f"{n}{suf}", []) for lbl, suf in [("closed", ""), ("open", "_Open"), ("PoseClosed", "_PoseClosed"), ("PoseOpen", "_PoseOpen"), ("PoseParked", "_PoseParked")]}
    bad = [lbl for lbl, v in got.items() if len(v) != 1]
    if bad:
        taps.append(f"{key}: {node}: {', '.join(f'{len(got[b])} prims for {b}' for b in bad)}")
        continue
    copies[node] = {"key": key, **{k: v[0] for k, v in got.items()}}
if len(copies) != len(movers):
    print(json.dumps(out))
    sys.exit(0)

# every prim the behaviours move, with its pose now
state = {}
def prim_at(p):
    return stage.GetPrimAtPath(p)

behaviours = [p for p in stage.Traverse() if p.GetTypeName() == "Preliminary_Behavior"]
kinds = set()


def action_tree(prim):
    aid = prim.GetAttribute("info:id").Get()
    kinds.add(aid)
    if aid == "Group":
        kids = [prim_at(t) for t in prim.GetRelationship("actions").GetTargets()]
        return {"kind": "group", "type": prim.GetAttribute("type").Get(), "kids": [action_tree(k) for k in kids], "name": str(prim.GetPath())}
    if aid == "Transform":
        tgt = prim.GetRelationship("affectedObjects").GetTargets()
        pose = prim.GetRelationship("xformTarget").GetTargets()
        typ = prim.GetAttribute("type").Get()
        if len(tgt) != 1 or len(pose) != 1 or typ != "absolute":
            taps.append(f"{prim.GetPath()}: a Transform needs one object, one target pose and type absolute")
            return {"kind": "noop"}
        for t in (tgt[0], pose[0]):
            if t not in state:
                state[t] = xf(prim_at(t))
        if prim_at(tgt[0]).GetParent().GetPath() != prim_at(pose[0]).GetParent().GetPath():
            taps.append(f"{prim.GetPath()}: moves {tgt[0].name} to a pose that isn't its sibling")
        return {"kind": "move", "obj": tgt[0], "pose": pose[0], "dur": prim.GetAttribute("duration").Get() or 0}
    if aid == "Wait":
        return {"kind": "noop"}
    taps.append(f"{prim.GetPath()}: a {aid} action (only Transform, Group and Wait are used: Show/Hide can leave a part invisible)")
    return {"kind": "noop"}


tap_behaviours, start = [], []
for b in behaviours:
    trig = [prim_at(t) for t in b.GetRelationship("triggers").GetTargets()]
    acts = [action_tree(prim_at(t)) for t in b.GetRelationship("actions").GetTargets()]
    for tr in trig:
        tid = tr.GetAttribute("info:id").Get()
        if tid == "TapGesture":
            objs = tr.GetRelationship("affectedObjects").GetTargets()
            tap_behaviours.append({"name": b.GetName(), "on": objs, "acts": acts})
            for o in objs:
                state.setdefault(o, xf(prim_at(o)))
        elif tid == "SceneTransition":
            start.append({"name": b.GetName(), "acts": acts})
        else:
            taps.append(f"{b.GetName()}: a {tid} trigger")
for c in copies.values():
    for k in ("closed", "open", "PoseClosed", "PoseOpen", "PoseParked"):
        state.setdefault(c[k].GetPath(), xf(c[k]))

# scale of a prim in the scene: its own and its ancestors' (only those the behaviours move change)
fixed_scale = {}
def scale_of(st, p):
    s = 1.0
    for a in p.GetPrefixes():
        if a in st:
            s *= max(abs(v) for v in st[a][2])
        else:
            if a not in fixed_scale:
                pr = prim_at(a)
                fixed_scale[a] = max(abs(v) for v in xf(pr)[2]) if pr and pr.IsA(UsdGeom.Xformable) else 1.0
            s *= fixed_scale[a]
    return s


def part_view(st):
    """per node: 'closed', 'open', or a problem"""
    v = {}
    for node, c in copies.items():
        full = [k for k in ("closed", "open") if scale_of(st, c[k].GetPath()) >= FULL * scale_of(st, c["PoseClosed"].GetPath())]
        if len(full) == 0:
            v[node] = "vanished (both copies parked)"
        elif len(full) == 2:
            v[node] = "doubled (both copies showing)"
        else:
            k = full[0]
            pose = c["PoseClosed" if k == "closed" else "PoseOpen"].GetPath()
            v[node] = k if same(st[c[k].GetPath()], st[pose]) else f"{k} copy at the wrong pose"
    return v


needs = {p["key"]: [n for n in ([p["needs"]] if isinstance(p.get("needs"), str) else p.get("needs") or [])] for p in parts}
node_of = {p["key"]: p["node"] for p in parts}
problems = []


def run(act, st, trail, log):
    if act["kind"] == "group":
        if act["type"] == "serial":
            for k in act["kids"]:
                run(k, st, trail, log)
                check_transient(st, trail)
        else:
            for k in act["kids"]:
                run(k, st, trail, log)
    elif act["kind"] == "move":
        log.append(act)
        st[act["obj"]] = st[act["pose"]]


def check_transient(st, trail):
    for node, s in part_view(st).items():
        if s.startswith("vanished") or s.startswith("doubled"):
            problems.append(f"{copies[node]['key']}: {s} part-way through {' then '.join(trail) or 'the start'}")


def key_state(st):
    return tuple((str(k), tuple(round(x, 4) for x in v[0]), round(v[1].GetReal(), 4), tuple(round(x, 4) for x in v[1].GetImaginary()), tuple(round(x, 5) for x in v[2])) for k, v in sorted(st.items(), key=lambda kv: str(kv[0])))


def open_keys(st):
    v = part_view(st)
    return {copies[n]["key"] for n, s in v.items() if s == "open"}


def check_rest(st, trail):
    v = part_view(st)
    for node, s in v.items():
        if s not in ("closed", "open"):
            problems.append(f"{copies[node]['key']}: {s} after {' then '.join(trail) or 'the start'}")
    keys = {}
    for node, s in v.items():
        keys.setdefault(copies[node]["key"], set()).add(s)
    for k, ss in keys.items():
        if len(ss) > 1:
            problems.append(f"{k}: its nodes disagree ({', '.join(sorted(ss))}) after {' then '.join(trail)}")
    op = open_keys(st)
    for k in op:
        shut = [n for n in needs.get(k, []) if n not in op]
        if shut:
            problems.append(f"{k}: open while the {', '.join(shut)} it sits inside is shut, after {' then '.join(trail) or 'the start'}")


st0 = dict(state)
for c in copies.values():
    if not same(st0[c["closed"].GetPath()], st0[c["PoseClosed"].GetPath()]):
        problems.append(f"{c['key']}: the shut copy doesn't start at PoseClosed")
    if scale_of(st0, c["open"].GetPath()) > GONE * scale_of(st0, c["PoseClosed"].GetPath()):
        problems.append(f"{c['key']}: the open copy isn't parked at the start (it would show as a second part)")
    if max(map(abs, st0[c["PoseParked"].GetPath()][2])) > PARK * 1.5 * max(map(abs, st0[c["PoseClosed"].GetPath()][2])):
        problems.append(f"{c['key']}: PoseParked isn't a speck")
# the start: the hint nudge plays out; at every step nothing may move that sits inside a shut part
for s in start:
    log = []
    for a in s["acts"]:
        run(a, st0, ["the start"], log)
    for m in log:
        for node, c in copies.items():
            if m["obj"] in (c["closed"].GetPath(), c["open"].GetPath()) and needs.get(c["key"]):
                problems.append(f"{c['key']}: the start hint moves it while the {', '.join(needs[c['key']])} it sits inside is shut")
check_rest(st0, ["the start"])


def tappable(st):
    out_ = []
    for b in tap_behaviours:
        if any(scale_of(st, o) >= FULL for o in b["on"]):
            out_.append(b)
    return out_


seen = {key_state(st0): []}
queue = [(st0, [])]
reached = set()
moves_ok = {}
while queue and len(seen) < 4000:
    st, trail = queue.pop(0)
    for b in tappable(st):
        nst, log = dict(st), []
        before = open_keys(st)
        t = trail + [f"tap {b['name'].split('_', 1)[-1]}"]
        for a in b["acts"]:
            run(a, nst, t, log)
        check_rest(nst, t)
        after = open_keys(nst)
        # one tap moves one part: its own (and, when it shuts, whatever sits inside it goes back in). French doors open
        # one at a time; a part with `also` takes its companion nodes, which are the same part
        changed = after ^ before
        opened = after - before
        inside = {k for k in before - after if any(n in changed for n in needs.get(k, []))}
        if len(opened) > 1 or (opened and before - after) or len(changed - inside) > 1:
            problems.append(f"one tap moved {', '.join(sorted(changed))}, after {' then '.join(t)}")
        for k in after ^ before:
            reached.add((k, k in after))
            swung = any(m["dur"] > 0.1 for m in log)
            moves_ok[k] = moves_ok.get(k, True) and swung
        ks = key_state(nst)
        if ks not in seen:
            seen[ks] = t
            queue.append((nst, t))
for p in parts:
    if (p["key"], True) not in reached:
        problems.append(f"{p['key']}: no order of taps opens it")
    elif (p["key"], False) not in reached:
        problems.append(f"{p['key']}: once open, no tap shuts it")
    elif not moves_ok.get(p["key"], True):
        problems.append(f"{p['key']}: jumps open or shut with no swing")
# one line per kind of fault, with the shortest taps that show it
first = {}
for m in problems:
    first.setdefault(re.sub(r",? (after|part-way through) .*$", "", m), m)
taps += list(first.values())
out["info"]["states"] = len(seen)
out["info"]["actions"] = sorted(k for k in kinds if k)
print(json.dumps(out))
