// How each stock item fits its tray (BENCHMARK.md section 13). For every item: what it really rests on and how far
// above it (from the meshes, not bounding boxes), how deep it overlaps anything, whether it rests across its middle
// rather than on one side, and the clearance to the shelf or basket above. Then, with the doors shut, whether anything
// on a door cuts into what is inside the cabinet. An item is BAD past 3 mm of gap or overlap, or under 10 mm of air.
// usage: node qa_fit.mjs <model.glb> [part of a group name, to list only those]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const [file, only] = process.argv.slice(2);
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const mulPt = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
const meshBox = (n) => { const mesh = n.getMesh(); if (!mesh) return null; const m = n.getWorldMatrix(); let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  for (const p of mesh.listPrimitives()) { const a = p.getAttribute("POSITION"); const lo = a.getMin([]), hi = a.getMax([]);
    for (let i = 0; i < 8; i++) { const w = mulPt(m, [i&1?hi[0]:lo[0], i&2?hi[1]:lo[1], i&4?hi[2]:lo[2]]); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); } } }
  return [mn, mx]; };
const nodeBox = (n) => { let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9]; n.traverse((c) => { const b = meshBox(c); if (b) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], b[0][k]); mx[k] = Math.max(mx[k], b[1][k]); } }); return [mn, mx]; };
const nodes = doc.getRoot().listNodes();
// ── the real surfaces: every object's world triangles on a 1 cm grid in x and z, so a vertical line through any
// point finds the faces it crosses (the top and bottom of the object there) ──
const CELL = 0.01, cellKey = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
function surfaces(root) {
  const tris = [], verts = [];
  root.traverse((n) => {
    const mesh = n.getMesh(); if (!mesh) return;
    const m = n.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute("POSITION").getArray(), idx = p.getIndices()?.getArray();
      const w = []; for (let i = 0; i < pos.length; i += 3) { const v = mulPt(m, [pos[i], pos[i + 1], pos[i + 2]]); w.push(v); verts.push(v); }
      const n3 = idx ? idx.length : w.length;
      for (let i = 0; i < n3; i += 3) tris.push([w[idx ? idx[i] : i], w[idx ? idx[i + 1] : i + 1], w[idx ? idx[i + 2] : i + 2]]);
    }
  });
  const grid = new Map();
  for (const t of tris) {
    const x0 = Math.min(t[0][0], t[1][0], t[2][0]), x1 = Math.max(t[0][0], t[1][0], t[2][0]), z0 = Math.min(t[0][2], t[1][2], t[2][2]), z1 = Math.max(t[0][2], t[1][2], t[2][2]);
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let k = Math.floor(z0 / CELL); k <= Math.floor(z1 / CELL); k++) {
      const key = `${i},${k}`; (grid.get(key) || grid.set(key, []).get(key)).push(t);
    }
  }
  return { grid, verts };
}
// the lowest and highest faces of an object on the vertical line through (x, z), or null
function span(S, x, z) {
  const ts = S.grid.get(cellKey(x, z)); if (!ts) return null;
  let lo = Infinity, hi = -Infinity;
  for (const [a, b, c] of ts) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-12) continue;
    const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
    const y = l1 * a[1] + l2 * b[1] + l3 * c[1]; lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return lo <= hi ? [lo, hi] : null;
}
// how item I meets object O: the smallest gap from I down to O (or from O up to I), the deepest overlap, and where they touch
function meet(I, O) {
  let gap = Infinity, deep = 0; const at = [];
  const one = (pts, S, down) => { for (const v of pts) { const s = span(S, v[0], v[2]); if (!s) continue;
    const [lo, hi] = s;
    if (down ? v[1] >= hi - 1e-4 : v[1] <= lo + 1e-4) { const g = down ? v[1] - hi : lo - v[1]; at.push([g, v[0], v[2]]); gap = Math.min(gap, g); }
    else if (v[1] > lo && v[1] < hi) deep = Math.max(deep, Math.min(v[1] - lo, hi - v[1])); } };
  one(I.S.verts, O.S, true);     // I's points onto O's top
  one(O.S.verts.filter((v) => v[0] >= I.b[0][0] && v[0] <= I.b[1][0] && v[2] >= I.b[0][2] && v[2] <= I.b[1][2]), I.S, false); // O's points up to I's underside
  return { gap, deep, at };
}
const parentOf = new Map(); for (const n of nodes) for (const c of n.listChildren()) parentOf.set(c, n);
const ancestors = (n) => { const a = []; for (let p = parentOf.get(n); p; p = parentOf.get(p)) a.push(p); return a; };
const isStock = (n) => !!n.getExtras()?.stock || ancestors(n).some((a) => a.getExtras()?.stock);
const stockSet = new Set(nodes.filter((n) => n.getExtras()?.stock));
const items = [...stockSet].filter((n) => !ancestors(n).some((a) => stockSet.has(a)));
const where = (n) => { const a = ancestors(n).map((x) => x.getName()); return a.find((x) => /Stock$|OnFreezerShelf|FridgeDoor|FreezerDoor/.test(x)) || a[0]; };
// fixed parts (not food) that an item can stand on, hit or sit under
const solids = nodes.filter((n) => n.getMesh() && !isStock(n)).map((n) => ({ n, name: n.getName(), b: meshBox(n), door: ancestors(n).map((a) => a.getName()).find((x) => /Door$/.test(x)) }))
  .filter((s) => !/^(Led|FridgeLed|FreezerLed|Print|Plate)/.test(s.name));
const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
const ib = items.map((it) => ({ it, name: it.getName(), b: nodeBox(it), at: where(it), door: ancestors(it).map((a) => a.getName()).find((x) => /Door$/.test(x)) }));
const rows = [];
for (const I of ib) {
  if (only && !I.at.includes(only)) continue;
  const [mn, mx] = I.b, sx = mx[0] - mn[0], sz = mx[2] - mn[2];
  // the footprint's middle half: what lies under or over it
  const fx0 = mn[0] + sx * 0.25, fx1 = mx[0] - sx * 0.25, fz0 = mn[2] + sz * 0.25, fz1 = mx[2] - sz * 0.25;
  const pool = [...solids.filter((s) => s.door === I.door), ...ib.filter((o) => o !== I && o.door === I.door).map((o) => ({ name: "(" + o.name + ")", b: o.b, food: true }))];
  const under = pool.filter((s) => ov(fx0, fx1, s.b[0][0], s.b[1][0]) > 0 && ov(fz0, fz1, s.b[0][2], s.b[1][2]) > 0 && s.b[1][1] <= mn[1] + 0.012 && s.b[1][1] > mn[1] - 0.3);
  const sup = under.sort((a, b) => b.b[1][1] - a.b[1][1])[0];
  const over = solids.filter((s) => s.door === I.door && ov(mn[0], mx[0], s.b[0][0], s.b[1][0]) > 0.002 && ov(mn[2], mx[2], s.b[0][2], s.b[1][2]) > 0.002 && s.b[0][1] >= mn[1] + (mx[1] - mn[1]) * 0.5);
  const ceil = over.sort((a, b) => a.b[0][1] - b.b[0][1])[0];
  // fixed parts it cuts into (more than 1.5 mm on every axis), apart from what it stands on
  const hits = solids.filter((s) => s.door === I.door && s !== sup && [0, 1, 2].every((k) => ov(mn[k], mx[k], s.b[0][k], s.b[1][k]) > 0.0015) && !(s.b[1][1] - s.b[0][1] < 0.012 && s.b[1][1] <= mn[1] + 0.004));
  // the mesh check: what it really rests on, how far it really overlaps food or fixed parts, and whether it rests across its middle
  I.S ||= surfaces(I.it);
  let rest = { gap: Infinity, on: "NOTHING", deep: 0, into: null, at: [] };
  for (const O of [...solids.filter((s) => s.door === I.door), ...ib.filter((o) => o !== I && o.door === I.door)]) {
    const ob = O.b; if (ov(mn[0], mx[0], ob[0][0], ob[1][0]) <= 0 || ov(mn[2], mx[2], ob[0][2], ob[1][2]) <= 0 || ob[0][1] > mx[1] || ob[1][1] < mn[1] - 0.3) continue;
    O.S ||= surfaces(O.n || O.it);
    const r = meet(I, O);
    if (r.deep > rest.deep) { rest.deep = r.deep; rest.into = O.name; }
    if (r.gap < rest.gap - 1e-4) { rest.gap = r.gap; rest.on = O.name; }
    rest.at.push(...r.at.map((h) => [...h, !!O.n]));
  }
  const touch = rest.at.filter((h) => h[0] - rest.gap < 0.004), cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
  const xs = touch.map((h) => h[1]), zs = touch.map((h) => h[2]);
  // lying on a fixed floor or shelf is steady; on food, the points it touches must surround its middle
  rest.steady = touch.some((h) => h[3]) || touch.length > 0 && Math.min(...xs) - 0.15 * sx <= cx && cx <= Math.max(...xs) + 0.15 * sx && Math.min(...zs) - 0.15 * sz <= cz && cz <= Math.max(...zs) + 0.15 * sz;
  rows.push({ rest, door: I.door, at: I.at, name: I.name, size: [sx, mx[1] - mn[1], sz].map((v) => Math.round(v * 1000)), on: sup ? sup.name : "NOTHING", gap: sup ? Math.round((mn[1] - sup.b[1][1]) * 1000) : null,
    under: ceil ? ceil.name : "-", clear: ceil ? Math.round((ceil.b[0][1] - mx[1]) * 1000) : null, hits: hits.map((h) => h.name) });
}
let bad = 0;
for (const r of rows) {
  const issues = [];
  const R = r.rest, mm = (v) => Math.round(v * 1000);
  if (R.on === "NOTHING") issues.push("stands on nothing");
  else if (R.gap > 0.003) issues.push(`floats ${mm(R.gap)} mm over ${R.on}`);
  if (R.deep > 0.003 && !/EggCups/.test(R.into)) issues.push(`${mm(R.deep)} mm into ${R.into}`); // eggs sit in the cup tray on purpose
  if (R.on !== "NOTHING" && !R.steady && !r.door) issues.push(`rests on one side (tips off ${R.on})`);
  if (r.clear != null && r.clear < 10) issues.push(r.clear < 0 ? `THROUGH ${r.under} by ${-r.clear} mm` : `only ${r.clear} mm under ${r.under}`);
  if (r.hits.length) issues.push("cuts into " + [...new Set(r.hits)].join(","));
  if (issues.length) bad++;
  console.log(`${issues.length ? "BAD " : "ok  "}${r.at.padEnd(16)} ${r.name.padEnd(24)} ${String(r.size).padEnd(14)} on ${R.on} (${mm(R.gap)}) | under ${r.under} (${r.clear}) ${issues.length ? "<- " + issues.join("; ") : ""}`);
}
console.log(`${rows.length} items, ${bad} with problems`);
// with the doors shut: does anything on a door (baskets, liner, food) cut into what is inside the cabinet?
{
  const all = nodes.filter((n) => n.getMesh()).map((n) => ({ name: n.getName(), b: meshBox(n), door: ancestors(n).map((a) => a.getName()).find((x) => /Door$/.test(x)), food: isStock(n) }));
  const onDoor = all.filter((a) => a.door), inside = all.filter((a) => !a.door && !/^(Side|Top|Base|Divider|Back|Rear|Kick|Hinge|Foot|Roller|Power|Plug)/.test(a.name));
  const clash = new Map();
  for (const d of onDoor) for (const c of inside) {
    const o = [0, 1, 2].map((k) => ov(d.b[0][k], d.b[1][k], c.b[0][k], c.b[1][k]));
    if (o.every((v) => v > 0.002)) { const k = `${d.food ? "food" : d.name.replace(/\d+$/, "")} x ${c.food ? "food" : c.name}`; clash.set(k, Math.max(clash.get(k) || 0, Math.round(o[2] * 1000))); }
  }
  console.log(`\ndoors shut: ${clash.size} clashes` + [...clash].map(([k, v]) => `\n  ${k}: ${v} mm deep`).join(""));
}
