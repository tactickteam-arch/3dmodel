"""What the gate needs to know about an Apple AR file (STANDARD.md, gate.mjs): USD validation issues, how many
meshes, xforms, triangles, materials and see-through materials it has, and a hash of every texture in it.
usage: tools/usdenv/bin/python pipeline/scripts/usdz_check.py <file.usdz>   (prints one line of JSON)"""
import hashlib
import json
import sys
import zipfile

from pxr import Usd, UsdGeom, UsdShade, UsdValidation

path = sys.argv[1]
stage = Usd.Stage.Open(path)
validators = UsdValidation.ValidationRegistry().GetOrLoadAllValidators()
errors = UsdValidation.ValidationContext(validators).Validate(stage)
issues = sorted({f"{e.GetName()}: {e.GetMessage()[:160]}" for e in errors})

meshes = xforms = tris = 0
materials = set()
for prim in stage.Traverse():
    if prim.IsA(UsdGeom.Xform):
        xforms += 1
    if prim.IsA(UsdGeom.Mesh):
        meshes += 1
        tris += sum(c - 2 for c in (UsdGeom.Mesh(prim).GetFaceVertexCountsAttr().Get() or []))
        bound = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0]
        if bound:
            materials.add(str(bound.GetPath()))
see_through = 0
for m in materials:
    for shader in (c for c in stage.GetPrimAtPath(m).GetChildren() if c.GetTypeName() == "Shader"):
        o = shader.GetAttribute("inputs:opacity")
        if o and ((o.Get() is not None and o.Get() < 1) or o.HasAuthoredConnections()):
            see_through += 1

textures = {}
with zipfile.ZipFile(path) as z:
    for name in z.namelist():
        if name.lower().endswith((".png", ".jpg", ".jpeg")):
            textures[name] = hashlib.sha1(z.read(name)).hexdigest()

print(json.dumps({"issues": len(errors), "issueList": issues[:12], "meshes": meshes, "xforms": xforms, "triangles": tris,
                  "materials": len(materials), "seeThrough": see_through, "textures": textures}))
