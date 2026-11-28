// What a GLB asks of a phone once it is open: the memory its textures take once decoded, its triangles and its
// draw calls. No dependencies, so the browser tests can read it from the served file (test_arphone.mjs).
//   textures: every image in the file, width x height x 4 bytes (RGBA8, as WebGL uploads JPEG and PNG), x 4/3 for
//     the mipmaps three.js makes. Every image counts, also those only a colour not shown yet uses: a phone that has
//     tried each colour has decoded them all, and three.js keeps what it decoded until the page closes.
//   triangles, draw calls: every mesh each node of the default scene draws, with every node shown (a fridge's stock
//     is hidden in the 3D view but shown full in AR). One primitive is one draw call.
// usage: node glb_load.mjs <file.glb> ...   prints one line per file
import fs from "node:fs";

// width and height from a PNG, JPEG or WebP header, or null
export function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const k = b.toString("ascii", 12, 16);
    if (k === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === "VP8L") { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
    if (k === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  }
  return null;
}

export function glbLoad(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  let at = 12, json = null, bin = null;
  while (at < buf.length) {
    const len = buf.readUInt32LE(at), type = buf.readUInt32LE(at + 4), body = buf.subarray(at + 8, at + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString("utf8"));
    else if (type === 0x004e4942) bin = body;
    at += 8 + len;
  }
  const views = json.bufferViews || [];
  const images = (json.images || []).map((im, i) => {
    const v = views[im.bufferView];
    const size = v && bin ? imageSize(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)) : null;
    return { i, name: im.name || `image ${i}`, size };
  });
  const textureBytes = images.reduce((s, im) => s + (im.size ? im.size[0] * im.size[1] * 4 * 4 / 3 : 0), 0);
  const meshes = json.meshes || [], acc = json.accessors || [], nodes = json.nodes || [];
  let triangles = 0, drawCalls = 0;
  const scene = (json.scenes || [])[json.scene || 0] || { nodes: [] };
  const walk = (n) => {
    const node = nodes[n];
    if (node.mesh != null) for (const pr of meshes[node.mesh].primitives) {
      drawCalls++;
      const mode = pr.mode ?? 4, count = pr.indices != null ? acc[pr.indices].count : acc[pr.attributes.POSITION].count;
      triangles += mode === 4 ? count / 3 : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
    }
    for (const c of node.children || []) walk(c);
  };
  for (const n of scene.nodes || []) walk(n);
  return { images, unsized: images.filter((im) => !im.size).map((im) => im.name), textureBytes, triangles: Math.round(triangles), drawCalls, materials: (json.materials || []).length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2)) {
    const r = glbLoad(fs.readFileSync(f));
    const big = r.images.filter((im) => im.size).sort((a, b) => b.size[0] * b.size[1] - a.size[0] * a.size[1])[0];
    console.log(`${f}\t${(r.textureBytes / 2 ** 20).toFixed(1)} MB textures (${r.images.length} images, largest ${big ? big.size.join("x") : "-"})\t${r.triangles} triangles\t${r.drawCalls} draw calls\t${r.materials} materials${r.unsized.length ? `\tunreadable: ${r.unsized.join(", ")}` : ""}`);
  }
}
