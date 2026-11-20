// Curved decals: a sharp print laid on a curved, textured surface (an AC's front panel, a drum, a moulded front).
//
// The surface's own texture is drawn at a few px per mm (the whole panel has to fit the model's budget). Its print can be
// made sharp without growing that texture: draw the same panel again at 12+ px per mm, cut out only the rectangle round
// each print, and lay each cut-out on a small mesh that follows the surface exactly over that rectangle, lifted a hair
// off it. The decal's texture is the same drawing as the panel's, so its edges (panel ground on both sides) don't show.
//
//   import { uvDecal, uvDecals } from "./decal_curved.mjs";
//   uvDecal(srcMesh, [u0, v0, u1, v1], material, { name, nu, nv, cell, lift })
//     -> a Mesh, added beside srcMesh (same parent, same transform), covering the rectangle [u0..u1] x [v0..v1] of
//        srcMesh's own UVs; its UVs run 0..1 across that rectangle in the same sense as srcMesh's, so a texture cut from
//        the same rectangle of the panel's drawing (rows v0..v1 of the image, columns u0..u1) lands on the print.
//   uvDecals(srcMesh, decalsJson, mat, textures)
//     -> one decal per entry of a decals.json written by the texture script ({ name: { file, rect: [u0, v0, u1, v1] } });
//        mat(name) makes each decal's material, textures[materialName] = path is filled in for exportGLB.
//
// How it works: every grid point (u, v) of the rectangle is found in srcMesh's UV layout (the triangle that holds it),
// and its position and normal are interpolated there (barycentric), so the decal follows the surface whatever its
// shape, as long as the surface's UVs are one-to-one over the rectangle (true for any textured face). The decal is lifted
// `lift` metres along the surface normal (0.9 mm: just over defight.mjs's 0.8 mm gap, so it leaves the decal alone), its triangles wound to face the way
// srcMesh faces.
import * as THREE from "three";
import fs from "node:fs";

function triangles(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  if (!uv) throw new Error("uvDecal: the source mesh has no UVs");
  if (!n) g.computeVertexNormals();
  const N = g.attributes.normal;
  const idx = g.index ? g.index.array : [...Array(p.count).keys()];
  const tris = [];
  for (let i = 0; i < idx.length; i += 3) {
    const t = [idx[i], idx[i + 1], idx[i + 2]];
    const u = t.map((k) => [uv.getX(k), uv.getY(k)]);
    tris.push({
      t, u,
      umin: Math.min(u[0][0], u[1][0], u[2][0]), umax: Math.max(u[0][0], u[1][0], u[2][0]),
      vmin: Math.min(u[0][1], u[1][1], u[2][1]), vmax: Math.max(u[0][1], u[1][1], u[2][1]),
      P: t.map((k) => new THREE.Vector3(p.getX(k), p.getY(k), p.getZ(k))),
      Nn: t.map((k) => new THREE.Vector3(N.getX(k), N.getY(k), N.getZ(k))),
    });
  }
  return tris;
}

function locate(tris, u, v) {
  const eps = 1e-7;
  let best = null, bestErr = Infinity;
  for (const tr of tris) {
    if (u < tr.umin - 1e-4 || u > tr.umax + 1e-4 || v < tr.vmin - 1e-4 || v > tr.vmax + 1e-4) continue;
    const [[x0, y0], [x1, y1], [x2, y2]] = tr.u;
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(d) < 1e-14) continue;
    const a = ((y1 - y2) * (u - x2) + (x2 - x1) * (v - y2)) / d;
    const b = ((y2 - y0) * (u - x2) + (x0 - x2) * (v - y2)) / d;
    const c = 1 - a - b;
    const err = Math.max(0, -a, -b, -c);
    if (err <= eps) return { tr, w: [a, b, c] };
    if (err < bestErr) { bestErr = err; best = { tr, w: [a, b, c] }; }
  }
  if (best && bestErr < 1e-3) return best;           // on a seam between two triangles: the nearest one
  return null;
}

export function uvDecal(src, rect, material, { name = "Decal", nu = 0, nv = 0, cell = [0.003, 0.004], lift = 0.0009 } = {}) {
  const [u0, v0, u1, v1] = rect;
  const tris = triangles(src.geometry);
  // the grid: cells of about `cell` metres (3 mm across, 4 mm down: as fine as the panels' own rounded ends), so the decal
  // bends with the surface; finer costs file size (Apple's file most)
  const at = (u, v) => { const h = locate(tris, u, v); const P = new THREE.Vector3(); if (h) for (let k = 0; k < 3; k++) P.addScaledVector(h.tr.P[k], h.w[k]); return P; };
  const pA = at(u0, v0), pB = at(u1, v0), pC = at(u0, v1);
  nu = nu || Math.max(4, Math.ceil(pA.distanceTo(pB) / cell[0]));
  nv = nv || Math.max(4, Math.ceil(pA.distanceTo(pC) / cell[1]));
  const pos = [], nor = [], uvs = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const s = i / nu, t = j / nv;
      const u = u0 + (u1 - u0) * s, v = v0 + (v1 - v0) * t;
      const hit = locate(tris, u, v);
      if (!hit) throw new Error(`uvDecal ${name}: (${u.toFixed(4)}, ${v.toFixed(4)}) is not on ${src.name}`);
      const { tr, w } = hit;
      const P = new THREE.Vector3(), Nn = new THREE.Vector3();
      for (let k = 0; k < 3; k++) { P.addScaledVector(tr.P[k], w[k]); Nn.addScaledVector(tr.Nn[k], w[k]); }
      Nn.normalize();
      P.addScaledVector(Nn, lift);
      pos.push(P.x, P.y, P.z); nor.push(Nn.x, Nn.y, Nn.z); uvs.push(s, t);
    }
  }
  const idx = [];
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // wind the triangles to face the way the surface's normals do
  const A = new THREE.Vector3(...pos.slice(0, 3)), B = new THREE.Vector3(...pos.slice(3, 6)), C = new THREE.Vector3(...pos.slice(3 * W, 3 * W + 3));
  const face = new THREE.Vector3().subVectors(C, A).cross(new THREE.Vector3().subVectors(B, A));
  if (face.dot(new THREE.Vector3(...nor.slice(0, 3))) < 0) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
  src.parent.add(m);
  return m;
}

// every decal listed in a texture script's decals.json; returns { materialName: texturePath } for exportGLB
export function uvDecals(src, jsonPath, mat, opts = {}) {
  const dir = jsonPath.replace(/\/[^/]+$/, "");
  const list = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const textures = {};
  for (const [key, d] of Object.entries(list)) {
    const matName = `Print_${key}`;
    uvDecal(src, d.rect, mat(matName), { name: `PrintDecal_${key}`, ...opts });
    textures[matName] = `${dir}/${d.file}`;
  }
  return textures;
}
