import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const [i, o, pose = ""] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(i);
let n = 0;
for (const node of doc.getRoot().listNodes()) if (node.getExtras()?.stock) { node.setMesh(null); for (const c of node.listChildren()) c.dispose?.(); node.setScale([0,0,0]); n++; }
// pose: apply the last keyframe of each named clip, so several parts can be shown open at once
for (const name of pose.split(",").filter(Boolean)) {
  const a = doc.getRoot().listAnimations().find((x) => x.getName() === name);
  if (!a) { console.log("no clip", name); continue; }
  for (const ch of a.listChannels()) {
    const s = ch.getSampler(), out = s.getOutput(), k = out.getElementSize(), arr = out.getArray();
    const v = Array.from(arr.slice(arr.length - k));
    const node = ch.getTargetNode(), p = ch.getTargetPath();
    if (p === "rotation") node.setRotation(v); else if (p === "translation") node.setTranslation(v); else if (p === "scale") node.setScale(v);
  }
}
await io.write(o, doc);
console.log("hid", n);
