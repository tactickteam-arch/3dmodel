// The fridge's clear parts, made to read against a white liner (Sangeetha, 17 Nov 2026: "shelves are not visible
// as the same colour"). The true near-white tints vanished on screen and in AR, so each clear material is pulled
// towards a cool glass tint and made a little more solid. One table for every builder: exportGLB applies it, and
// `node clear_look.mjs <glb>...` applies it to a model already built.
// Shelves and door bins only; washer door glass, ice cubes, bottles and drinks keep their own colour.
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

// name: [linear RGB multiplier, lowest opacity]
const LOOK = {
  Glass: [[0.55, 0.78, 0.88], 0.55], TemperedGlass: [[0.55, 0.78, 0.88], 0.6],
  Bin: [[0.68, 0.81, 0.92], 0.64], ClearPlastic: [[0.68, 0.81, 0.92], 0.56],
  ClearLight: [[0.72, 0.84, 0.94], 0.4], ClearPlasticLight: [[0.72, 0.84, 0.94], 0.38],
  Frosted: [[0.82, 0.88, 0.94], 0.84], FrostedPlastic: [[0.82, 0.88, 0.94], 0.86],
};
const MARK = "clearLook";   // set in the material's extras, so a model is never tinted twice

export function clearLook(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMaterials()) {
    const look = LOOK[m.getName()];
    if (!look || m.getExtras()?.[MARK]) continue;
    const [k, floor] = look, c = m.getBaseColorFactor();
    m.setBaseColorFactor([c[0] * k[0], c[1] * k[1], c[2] * k[2], Math.max(c[3], floor)]);
    m.setExtras({ ...m.getExtras(), [MARK]: true });
    n++;
  }
  return n;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  for (const f of process.argv.slice(2)) {
    const doc = await io.read(f);
    const n = clearLook(doc);
    if (n) fs.writeFileSync(f, await io.writeBinary(doc));
    console.log(f, n, "clear materials tinted");
  }
}
