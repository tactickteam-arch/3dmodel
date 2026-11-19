import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) { const d = await io.read(f); console.log(f, d.getRoot().listAnimations().map((a) => a.getName()).filter((n) => /^S0000_|^S000_|^S1000_/.test(n)).join(" ")); }
