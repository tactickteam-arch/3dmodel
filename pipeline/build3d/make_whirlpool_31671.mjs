// Whirlpool 360 Bloomwash Pro 8.5 kg 5 star top-load washing machine with in-built heater, model code 31671, Midnight Grey.
// Built to Whirlpool's size, 540 W x 1025 H x 580 D mm (Whirlpool India's product page for 31671 and Sangeetha's listing 21171),
// and to Whirlpool's own gallery for 31671: front.jpg and three_quarter_dims.jpg give the cabinet, the top cover band and the glass
// lid with its chrome edge; top_open.jpg the control panel and everything inside (the Hexa Bloom impeller, the steel drum and its
// ring, the lint filter); lid_open_34.jpg and lid_open_front.jpg the well, the hinges and the lid's grey inner frame; back.jpg the
// black back with its covers, the inlet, the cord with its 3-pin plug and the drain hose.
// Copied from make_samsung_wa80.mjs (the newer top-load builder; the category's reference is make_samsung_wa70.mjs) and changed
// to this model's shapes. Every size Whirlpool doesn't publish is measured off its photos, scaled to the published size
// (private/research/whirlpool_31671/NOTES.md). make_whirlpool_31688.mjs builds the 10 kg model of the same family the same way.
// usage: node make_whirlpool_31671.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import fs from "node:fs";

export function buildBloomwash(K) {
  const { W, H, D } = K;
  const zF = D / 2, zB = -D / 2;
  const xz = (xf) => zF - xf;
  const lerp = (a, b, t) => a + (b - a) * t;
  // the side profile: the seam between cabinet and top cover, the lid seat (the top cover's top), the lid's upper surface
  const seam = (xf) => lerp(K.seam[0], K.seam[1], xf / D);
  const seat = (xf) => K.seat0 + K.lidSlope * xf;
  const lidTop = (xf) => seat(xf) + K.lidThick;
  const hw = (t) => W / 2 - K.shoulder * (1 - Math.sqrt(Math.max(0, 1 - t * t)));   // the top cover's half-width, seam (t 0) to top (t 1)
  const TOPW = hw(1);

  // ── materials ──
  const bodyM = mat("Body", K.bodyHex, { rough: 0.45 });
  const coverM = mat("TopCover", K.bodyHex, { rough: 0.45 });
  const sideL = mat("SideL", 0xffffff, { rough: 0.45 });
  const sideR = mat("SideR", 0xffffff, { rough: 0.45 });
  const plinthM = mat("Plinth", K.plinthHex, { rough: 0.6 });
  const footM = mat("Foot", 0x1d1f22, { rough: 0.8 });
  const backM = mat("BackPanel", 0xffffff, { rough: 0.7 });
  const backBlack = mat("BackPlastic", 0x18181a, { rough: 0.7 });
  const gloss = mat("BlackGloss", 0x0b0b0d, { rough: 0.12 });
  const glassM = mat("LidGlass", 0x050607, { rough: 0.04, opacity: K.lidOpacity ?? 0.9 });
  const lidFrameM = mat("LidFrame", K.innerHex, { rough: 0.5 });
  const chrome = mat("Chrome", 0xd9dbde, { metal: 1, rough: 0.18 });
  const panelM = mat("PanelFace", 0xffffff, { rough: 0.38 });   // satin enough that a studio light does not wash the print out from above (top_open.jpg: black)
  const labelM = mat("LabelBEE", 0xffffff, { rough: 0.5, opacity: 0.999 });
  const tubCover = mat("TubCover", K.innerHex, { rough: 0.4, side: THREE.DoubleSide });
  const ringM = mat("BalanceRing", 0xc9ccd0, { metal: 0.85, rough: 0.22, side: THREE.DoubleSide });
  const drumM = mat("SteelDrum", 0xffffff, { rough: 0.32, metal: 0.3, side: THREE.DoubleSide });
  const floorM = mat("DrumFloor", 0x9da1a6, { rough: 0.4, metal: 0.3 });
  const impM = mat("Impeller", 0xffffff, { rough: 0.35 });
  // 31671: dark grey vanes and a chrome hub, as top_open.jpg shows (vanes median 64,66,67 under studio light); the 31688 passes its own
  const vaneM = mat("ImpellerVane", K.vaneHex ?? 0x494b4e, { rough: 0.4 });
  const hubM = K.hubHex !== undefined ? mat("ImpellerHub", K.hubHex, { rough: 0.4 }) : mat("ImpellerHub", 0xc4c7cb, { metal: 0.8, rough: 0.25 });
  const filterM = mat("LintFilter", 0x2a2d31, { rough: 0.55 });
  const hingeM = mat("Hinge", 0x232528, { rough: 0.5 });
  const grooveM = mat("Groove", 0x16181b, { rough: 0.8 });
  const white = mat("WhitePlastic", 0xe9e9e6, { rough: 0.45 });
  const hoseM = mat("DrainHose", 0xd8dadb, { rough: 0.4 });
  const pinM = mat("Pin", 0xb7bbc0, { metal: 0.9, rough: 0.3 });

  const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

  // a side profile (points [xf, y]) extruded across a width w, centred on x = 0
  function sideSlab(name, pts, w, material) {
    const s = new THREE.Shape();
    pts.forEach(([xf, y], i) => (i ? s.lineTo(xf, y) : s.moveTo(xf, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 6 });
    g.rotateY(Math.PI / 2);
    g.translate(-w / 2, 0, zF);
    return mesh(name, g, material);
  }

  // a rounded rectangle seen from above, in shape coordinates (x, xf - zF)
  function roundRect(p, x0, x1, f0, f1, rf, rb) {
    const Y0 = f0 - zF, Y1 = f1 - zF;
    p.moveTo(x0 + rf, Y0);
    p.lineTo(x1 - rf, Y0); p.absarc(x1 - rf, Y0 + rf, rf, -Math.PI / 2, 0, false);
    p.lineTo(x1, Y1 - rb); p.absarc(x1 - rb, Y1 - rb, rb, 0, Math.PI / 2, false);
    p.lineTo(x0 + rb, Y1); p.absarc(x0 + rb, Y1 - rb, rb, Math.PI / 2, Math.PI, false);
    p.lineTo(x0, Y0 + rf); p.absarc(x0 + rf, Y0 + rf, rf, Math.PI, 1.5 * Math.PI, false);
    return p;
  }
  // the same outline as a list of n points per corner (for lofts), counter-clockwise seen from above
  function ringPts(x0, x1, f0, f1, r, n = 6) {
    const pts = [];
    // front-right, back-right, back-left, front-left corners, walking front edge -> right -> back -> left (xf grows to the back)
    const arc = (cx, cf, from) => { for (let i = 0; i <= n; i++) { const a = from + (i / n) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cf + r * Math.sin(a)]); } };
    arc(x1 - r, f0 + r, -Math.PI / 2);   // front right: from pointing to the front (-xf) round to +x
    arc(x1 - r, f1 - r, 0);              // back right
    arc(x0 + r, f1 - r, Math.PI / 2);    // back left
    arc(x0 + r, f0 + r, Math.PI);        // front left
    return pts;   // [x, xf]
  }

  // A plan shape stood up between two heights that follow the side profile: bot(xf), top(xf). The bevel is kept inside the
  // outline (bevelOffset = -bevel), so a bevelled part is exactly as big as its outline (the WA70 lid had grown by its bevel).
  function prism(name, shape, bot, top, material, { bev = 0, caps = ["top", "bottom"], curve = 8 } = {}) {
    const t0 = 0.02;
    const g0 = new THREE.ExtrudeGeometry(shape, { depth: t0, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: 2, curveSegments: curve });
    const pos = g0.attributes.position, nor = g0.attributes.normal, uv = g0.attributes.uv;
    const P = [], N = [], U = [];
    const slope = (f, xf) => (f(xf + 1e-4) - f(xf - 1e-4)) / 2e-4;
    for (const gr of g0.groups) for (let i = gr.start; i < gr.start + gr.count; i += 3) {
      if (gr.materialIndex === 0) {
        const zc = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        if (!caps.includes(zc > t0 / 2 ? "top" : "bottom")) continue;
      }
      for (let k = i; k < i + 3; k++) {
        const X = pos.getX(k), Y = pos.getY(k), Z = pos.getZ(k);
        const xf = zF + Y, f = (Z + bev) / (t0 + 2 * bev);
        const yb = bot(xf), yt = top(xf);
        P.push(X, yb + f * (yt - yb), -Y);
        let n = [nor.getX(k), nor.getZ(k), -nor.getY(k)];
        if (Math.abs(n[1]) > 0.98) {
          const b = n[1] > 0 ? slope(top, xf) : slope(bot, xf);
          const s = Math.sign(n[1]), l = Math.hypot(1, b);
          n = [0, s / l, (s * b) / l];
        }
        N.push(...n);
        U.push(uv.getX(k), uv.getY(k));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    return mesh(name, mergeVertices(g, 1e-6), material);
  }

  // A loft: rings of the same number of points [x, y, z], joined into a wall. Faces whose normal points to the back (-z) take
  // the second material, so a wall can be grey at the sides and black at the back as on the real top cover.
  function loft(name, rings, mats, closed = true) {
    const n = rings[0].length;
    const P = [], groups = [[], []];
    for (let r = 0; r < rings.length - 1; r++) {
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const j = (i + 1) % n;
        const a = rings[r][i], b = rings[r][j], c = rings[r + 1][j], d = rings[r + 1][i];
        for (const tri of [[a, b, c], [a, c, d]]) {
          const e1 = new THREE.Vector3().subVectors(new THREE.Vector3(...tri[1]), new THREE.Vector3(...tri[0]));
          const e2 = new THREE.Vector3().subVectors(new THREE.Vector3(...tri[2]), new THREE.Vector3(...tri[0]));
          const nz = new THREE.Vector3().crossVectors(e1, e2).normalize().z;
          groups[mats.length > 1 && nz < -0.7 ? 1 : 0].push(...tri.flat());
        }
      }
    }
    const g = new THREE.BufferGeometry();
    const all = [...groups[0], ...groups[1]];
    g.setAttribute("position", new THREE.Float32BufferAttribute(all, 3));
    g.addGroup(0, groups[0].length / 3, 0);
    if (groups[1].length) g.addGroup(groups[0].length / 3, groups[1].length / 3, 1);
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((all.length / 3) * 2).fill(0), 2));
    // merge first, then the normals: mergeVertices compares every attribute, so face normals made before it kept each
    // triangle apart and the bowl showed its facets as a patchwork of reflections
    const m = mergeVertices(g, 1e-6);
    m.computeVertexNormals();
    return mesh(name, m, mats.length > 1 ? mats : mats[0]);
  }

  // a flat ribbon of rectangular section swept along a path of [x, y, z] points (the lid's chrome edge)
  function ribbon(name, pts, h, t, material) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    const N = 64, P = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const p = curve.getPointAt(i / N), tg = curve.getTangentAt(i / N);
      const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize();          // horizontal, across the path, outward
      const up = new THREE.Vector3(0, 1, 0);
      for (const [s, u] of [[0, -0.5], [1, -0.5], [1, 0.5], [0, 0.5]]) P.push(...p.clone().addScaledVector(side, s * t).addScaledVector(up, u * h).toArray());
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, b = i * 4 + ((k + 1) % 4), c = (i + 1) * 4 + ((k + 1) % 4), d = (i + 1) * 4 + k;
      idx.push(a, c, b, a, d, c);
    }
    idx.push(0, 1, 2, 0, 2, 3);
    const e = N * 4; idx.push(e, e + 2, e + 1, e, e + 3, e + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return mesh(name, g, material);
  }

  const root = group(K.rootName);
  const cab = group("Cabinet");
  root.add(cab);

  // ── base: the plinth (a band round the bottom, cut away at the front between the feet) and four round levelling feet ──
  {
    const pi = 0.004, r = 0.012;
    const up = roundRect(new THREE.Shape(), -W / 2 + pi, W / 2 - pi, pi, D - pi, r, r);
    cab.add(prism("Plinth", up, () => K.notchTop, () => K.plinthTop, plinthM, { caps: [] }));
    // below the notch's top: the same band with the front opening between the front feet
    const s = new THREE.Shape();
    const X = W / 2 - pi, Y0 = pi - zF, Y1 = D - pi - zF, n = K.notch, nd = 0.03;
    s.moveTo(-X + r, Y0); s.lineTo(-n, Y0); s.lineTo(-n, Y0 + nd); s.lineTo(n, Y0 + nd); s.lineTo(n, Y0); s.lineTo(X - r, Y0);
    s.absarc(X - r, Y0 + r, r, -Math.PI / 2, 0, false); s.lineTo(X, Y1 - r); s.absarc(X - r, Y1 - r, r, 0, Math.PI / 2, false);
    s.lineTo(-X + r, Y1); s.absarc(-X + r, Y1 - r, r, Math.PI / 2, Math.PI, false); s.lineTo(-X, Y0 + r); s.absarc(-X + r, Y0 + r, r, Math.PI, 1.5 * Math.PI, false);
    cab.add(prism("PlinthLow", s, () => K.footH, () => K.notchTop, plinthM, { caps: [] }));
    cab.add(box("BasePlate", W - 0.03, 0.003, D - 0.03, footM, 0, K.footH + 0.006, 0));
    for (const sx of [-1, 1]) for (const xf of K.feetXf) cab.add(cyl("Foot", K.footR, K.footR, K.footH, footM, sx * K.feetX, K.footH / 2, xz(xf), 20));
  }

  // ── cabinet: painted steel, rounded vertical corners, from the plinth up to the seam with the top cover ──
  {
    const s = roundRect(new THREE.Shape(), -W / 2, W / 2, 0, D, K.cornerR, K.cornerR);
    cab.add(prism("Cabinet", s, () => K.plinthTop, (xf) => seam(xf) - 0.0015, bodyM, { caps: [] }));
    // the joint between the cabinet and the top cover: a dark groove 1.5 mm tall, 2 mm deep
    const gr = (y) => ringPts(-W / 2 + 0.002, W / 2 - 0.002, 0.002, D - 0.002, K.cornerR - 0.002, 5).map(([px, xf]) => [px, seam(xf) + y, xz(xf)]);
    cab.add(loft("SeamGroove", [gr(-0.0015), gr(0)], [grooveM]));
    // the side panels' relief (the G-shaped raised panel and the handle pocket), drawn from Whirlpool's 3/4 photos, on each side
    const R = K.cornerR, d = D - 2 * R, h = K.sideH;
    for (const [sx, m] of [[-1, sideL], [1, sideR]]) {
      const g = flipV(new THREE.PlaneGeometry(d, h));
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, R / D + uv.getX(i) * (d / D));
      const p = mesh("SideDecal", g, m, sx * (W / 2 + 0.0006), K.plinthTop + 0.001 + h / 2, 0);
      p.rotation.y = sx * Math.PI / 2;
      cab.add(p);
    }
    // the black back: Whirlpool's rear photo itself (back.jpg, with the hose, pipe, cord and plug painted out: they are modelled
    // below), on a plate cut to the back's flat face from the plinth's foot up to the panel housing's top edge, and kept inside
    // the machine's outline in the photo (K.rear.silhouette). Only for a model whose back Whirlpool shows (K.back); without a
    // rear photo the back stays the plain cabinet
    if (K.back) {
      const RP = K.rear, y0 = RP.bottom, y1 = RP.top, topBack = seat(D);
      const silAt = (y) => { const s = RP.silhouette; let i = 0; while (i < s.length - 2 && s[i + 1][0] < y) i++; const [ya, a] = s[i], [yb, b] = s[i + 1]; return a + (b - a) * Math.min(1, Math.max(0, (y - ya) / (yb - ya))); };
      const flat = (y) => y < K.plinthTop ? W / 2 - 0.004 - R : y < K.seam[1] ? W / 2 - R : y <= topBack ? hw((y - K.seam[1]) / (topBack - K.seam[1])) - R : TOPW;
      const half = (y) => Math.min(silAt(y) - 0.001, flat(y) - 0.0005);
      const ys = [];
      for (let y = y0; y < y1 - 1e-6; y += 0.005) ys.push(y);
      ys.push(y1);
      for (const y of [K.plinthTop, K.seam[1], topBack]) { ys.push(y - 1e-4, y + 1e-4); }
      ys.sort((a, b) => a - b);
      const sh = new THREE.Shape();
      ys.forEach((y, i) => (i ? sh.lineTo(half(y), y) : sh.moveTo(half(y), y)));
      for (let i = ys.length - 1; i >= 0; i--) sh.lineTo(-half(ys[i]), ys[i]);
      const g = new THREE.ShapeGeometry(sh);
      const pos = g.attributes.position, uv = g.attributes.uv;
      // the plate is turned to face the back, so its local x is the machine's -x: the photo's left (+x) is u = 0
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (0.27 + pos.getX(i)) / 0.54, (y1 - pos.getY(i)) / (y1 - y0));
      const bp = mesh("BackDecal", g, backM, 0, 0, zB - 0.0006);
      bp.rotation.y = Math.PI;
      cab.add(bp);
    }
    // Whirlpool's energy label for this model, on the front at the upper right (where the category's reference carries it)
    if (K.label) cab.add(mesh("LabelBEE", flipV(new THREE.PlaneGeometry(K.label.w, K.label.h)), labelM, K.label.x, K.label.y, zF + 0.0007));
  }

  // ── top cover: from the seam up to the lid seat, its sides rounding in to the lid's width; black at the back ──
  {
    const rings = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, x = hw(t);
      rings.push(ringPts(-x, x, 0, D, K.cornerR, 5).map(([px, xf]) => [px, seam(xf) + t * (seat(xf) - seam(xf)), xz(xf)]));
    }
    cab.add(loft("TopCoverWall", rings, K.back ? [coverM, backBlack] : [coverM]));
    // the top, up to the panel housing, open over the well
    const top = roundRect(new THREE.Shape(), -TOPW, TOPW, 0, K.housing0, K.cornerR, 0.001);
    const well = roundRect(new THREE.Path(), -K.well.x, K.well.x, K.well.f0, K.well.f1, K.well.r, K.well.r);
    top.holes.push(well);
    cab.add(prism("TopCoverTop", top, (xf) => seat(xf) - 0.004, seat, coverM, { caps: ["top"], curve: 10 }));
  }

  // ── the well: a rounded-square bowl from the top cover down to the steel drum's ring; the drum, the impeller, the filter ──
  const dz = xz(K.drumXf);
  {
    const ringN = 40;
    const rim = ringPts(-K.well.x, K.well.x, K.well.f0, K.well.f1, K.well.r, 9);
    // resample the rim by angle round the drum's axis, so each rim point meets the circle point at its own angle
    const byAngle = [];
    const cxf = K.drumXf;
    const rimAt = (a) => {
      // the rim point in direction a (from the centre): where that ray crosses the outline (so neighbouring angles never
      // land on the same outline point and the wall has no steps)
      const dx = Math.cos(a), df = Math.sin(a);
      let best = null, bt = 1e9;
      for (let i = 0; i < rim.length; i++) {
        const [x1, f1] = rim[i], [x2, f2] = rim[(i + 1) % rim.length];
        const ex = x2 - x1, ef = f2 - f1, px = x1, pf = f1 - cxf;
        const den = dx * ef - df * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = (px * ef - pf * ex) / den, s = (px * df - pf * dx) / den;
        if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < bt) { bt = t; best = [t * dx, cxf + t * df]; }
      }
      return best;
    };
    for (let i = 0; i < ringN * 2; i++) byAngle.push(rimAt((i / (ringN * 2)) * Math.PI * 2));
    const rings = [];
    const steps = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1];
    for (const t of steps) {
      const s = 1 - Math.pow(1 - t, 1.8);           // the wall curls round toward the ring
      rings.push(byAngle.map(([x, xf], i) => {
        const a = (i / (ringN * 2)) * Math.PI * 2;
        const cx = K.ringR * Math.cos(a), cf = cxf + K.ringR * Math.sin(a);
        const yT = seat(xf) - 0.004, yB = K.ringY;
        return [lerp(x, cx, s), lerp(yT, yB, t), xz(lerp(xf, cf, s))];
      }));
    }
    cab.add(loft("Bowl", rings, [tubCover]));
    // the balancing ring at the top of the drum: chrome, rounded
    const ring = new THREE.LatheGeometry([[K.ringR + 0.002, 0.0], [K.ringR - 0.004, 0.008], [K.ringR - 0.014, 0.006], [K.drumR, -0.012], [K.drumR, -0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
    cab.add(mesh("BalanceRing", ring, ringM, 0, K.ringY - 0.006, dz));
    // the stainless drum, its bloom pattern a texture, eight tiles round
    const g = new THREE.CylinderGeometry(K.drumR, K.drumR, K.drumDepth, 72, 1, true);
    const uv = g.attributes.uv;
    const uRep = 8, vRep = K.drumDepth / ((2 * Math.PI * K.drumR) / uRep);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uRep, 1 - uv.getY(i) * vRep);
    inward(g);
    const drumTop = K.ringY - 0.036, drumFloor = drumTop - K.drumDepth;
    cab.add(mesh("SteelDrum", g, drumM, 0, drumTop - K.drumDepth / 2, dz));
    const fl = new THREE.CircleGeometry(K.drumR, 64); fl.rotateX(-Math.PI / 2);
    cab.add(mesh("DrumFloor", fl, floorM, 0, drumFloor, dz));
    // the Hexa Bloom impeller: a white dish (its holes are the texture), three long swept vanes from a chrome tri-star hub and
    // three short vanes between them, grey, as in top_open.jpg
    const PR = K.impR;
    const dish = new THREE.LatheGeometry([[PR, 0.0], [PR - 0.012, 0.006], [0.1, 0.02], [0.04, 0.029], [0.0, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 64);   // rim to centre: faces up
    { const p = dish.attributes.position, u = dish.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, 0.5 + p.getX(i) / (2 * PR), 0.5 + p.getZ(i) / (2 * PR)); }
    cab.add(mesh("Impeller", dish, impM, 0, drumFloor + 0.002, dz));
    const vanes = [];
    for (let i = 0; i < 3; i++) {
      const a0 = (i * 2 * Math.PI) / 3 + 0.3;
      // a long vane: a blade from the hub out to the rim, narrow at the hub and flaring out, swept a little (top_open.jpg)
      const s = new THREE.Shape();
      const pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10, r = lerp(0.028, PR * 0.86, t), a = a0 + 0.32 * t * t, w = lerp(0.009, 0.034, Math.pow(t, 1.4)); pts.push([r, a, w]); }
      pts.forEach(([r, a, w], k) => { const x = r * Math.cos(a) - Math.sin(a) * w, y = r * Math.sin(a) + Math.cos(a) * w; k ? s.lineTo(x, y) : s.moveTo(x, y); });
      [...pts].reverse().forEach(([r, a, w]) => s.lineTo(r * Math.cos(a) + Math.sin(a) * w, r * Math.sin(a) - Math.cos(a) * w));
      const vg = new THREE.ExtrudeGeometry(s, { depth: 0.034, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelOffset: -0.004, bevelSegments: 1, curveSegments: 4 });
      vg.rotateX(-Math.PI / 2);
      vanes.push(vg);
      // a short vane between two long ones near the rim: a wedge, narrow end to the centre
      const b = a0 + Math.PI / 3 + 0.12;
      const ws = new THREE.Shape();
      const wp = [[PR * 0.5, -0.006], [PR * 0.84, -0.019], [PR * 0.84, 0.019], [PR * 0.5, 0.006]];
      wp.forEach(([r, w], k) => { const x = r * Math.cos(b) - Math.sin(b) * w, y = r * Math.sin(b) + Math.cos(b) * w; k ? ws.lineTo(x, y) : ws.moveTo(x, y); });
      const sv = new THREE.ExtrudeGeometry(ws, { depth: 0.022, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelOffset: -0.003, bevelSegments: 1 });
      sv.rotateX(-Math.PI / 2);
      vanes.push(sv);
    }
    {
      const merged = vanes.map((v) => v.toNonIndexed());
      const P = [], Nn = [];
      for (const v of merged) { P.push(...v.attributes.position.array); Nn.push(...v.attributes.normal.array); }
      const vg = new THREE.BufferGeometry();
      vg.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      vg.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3));
      vg.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((P.length / 3) * 2).fill(0), 2));
      cab.add(mesh("ImpellerVane", mergeVertices(vg, 1e-6), vaneM, 0, drumFloor + 0.004, dz));
    }
    const hub = new THREE.CylinderGeometry(0.03, 0.036, 0.03, 3);
    cab.add(mesh("ImpellerHub", hub, hubM, 0, drumFloor + 0.004 + 0.032, dz));
    // the lint filter on the drum wall (left in top_open.jpg)
    const lf = box("LintFilter", 0.014, 0.17, 0.07, filterM, -K.drumR + 0.009, drumTop - 0.13, dz);
    cab.add(lf);
    // the plain cover on the bowl's back wall, under the hinge line (lid_open_front.jpg)
    const bpz = xz(K.well.f1 - 0.012), bpy = seat(K.well.f1) - 0.05;
    const cover = box("BowlCover", 0.15, 0.045, 0.012, tubCover, 0, bpy, bpz);
    cover.rotation.x = -0.35;
    cab.add(cover);
    // the hinges at the back corners of the well
    for (const sx of [-1, 1]) cab.add(box("Hinge", 0.03, 0.026, 0.03, hingeM, sx * K.hingeX, seat(K.housing0) - 0.006, xz(K.housing0 - 0.008)));
  }

  // ── lid: hinged at its back edge; one tinted glass over the whole top, a grey frame under it, a chrome edge at the front ──
  const PIV = [seat(K.lid1), K.lid1];
  const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
  {
    const off = (m) => { m.geometry.translate(0, -PIV[0], -xz(PIV[1])); return m; };
    const s = roundRect(new THREE.Shape(), -TOPW, TOPW, K.lid0, K.lid1, 0.02, 0.004);
    s.holes.push(roundRect(new THREE.Path(), -TOPW + K.lidBorder[1], TOPW - K.lidBorder[1], K.lid0 + K.lidBorder[0], K.lid1 - K.lidBorder[2], 0.03, 0.03));
    lid.add(off(prism("LidFrame", s, (xf) => seat(xf) + 0.002, (xf) => lidTop(xf) - 0.0065, lidFrameM, { curve: 6 })));
    const gs = roundRect(new THREE.Shape(), -TOPW, TOPW, K.lid0, K.lid1, 0.02, 0.004);
    lid.add(off(prism("LidGlass", gs, (xf) => lidTop(xf) - 0.006, lidTop, glassM, { bev: 0.0015, curve: 6 })));
    // the chrome edge along the front and round the front corners
    const y0 = (xf) => lidTop(xf) - 0.008;
    const e = K.lid0 + 0.0005;
    const path = [[-TOPW + 0.0015, y0(0.07), xz(0.07)], [-TOPW + 0.0015, y0(0.03), xz(0.03)], [-TOPW + 0.012, y0(e + 0.002), xz(e + 0.002)], [-0.12, y0(e), xz(e)], [0, y0(e), xz(e)],
      [0.12, y0(e), xz(e)], [TOPW - 0.012, y0(e + 0.002), xz(e + 0.002)], [TOPW - 0.0015, y0(0.03), xz(0.03)], [TOPW - 0.0015, y0(0.07), xz(0.07)]];
    lid.add(off(ribbon("LidTrim", path, 0.013, 0.003, chrome)));
  }
  root.add(lid);

  // ── control panel: the black housing behind the lid, its glass face on the slope with Whirlpool's print ──
  {
    const [f0, f1] = K.face;     // [xf, y] of the face's lower and upper edges
    const prof = [[K.housing0, seat(K.housing0) + 0.001], [K.housing0, f0[1]], [f0[0], f0[1]], [f1[0], f1[1]], ...K.housingBack, [D, seat(D) + 0.001]];
    cab.add(sideSlab("PanelHousing", prof, 2 * TOPW, gloss));
    const dx = f1[0] - f0[0], dy = f1[1] - f0[1], len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const pg = group("PanelPlane", 0, (f0[1] + f1[1]) / 2, xz((f0[0] + f1[0]) / 2));
    pg.rotation.x = ang;
    pg.position.y += 0.0012 * Math.cos(ang); pg.position.z += 0.0012 * Math.sin(ang);
    const face = mesh("PanelFace", flipV(new THREE.PlaneGeometry(K.faceW, len)), panelM, 0, 0, 0);
    face.rotation.x = -Math.PI / 2;
    pg.add(face);
    root.add(pg);
    // the round hinge covers on the housing's ends
    for (const sx of [-1, 1]) {
      const c = cyl("HingeCap", 0.024, 0.024, 0.004, chrome, sx * (TOPW + 0.0015), K.capY, xz(K.capXf), 28);
      c.rotation.z = Math.PI / 2; cab.add(c);
    }
  }

  // ── the back (back.jpg, on the paths the texture script measured, K.rear): the inlet pipe hanging from its valve, the cord
  // coiled in a figure-of-eight below its slot with the Indian 3-pin plug lying pins out, and the corrugated drain hose ──
  if (K.back) {
    const RP = K.rear, zb = zB;
    // a cylinder standing between two heights, ribbed round its side when ribs > 0
    const post = (name, d, ya, yb, m, x, z, seg = 20, ribs = 0) => {
      const g = new THREE.CylinderGeometry(d / 2, d / 2, Math.abs(ya - yb), ribs ? ribs * 2 : seg, 1);
      if (ribs) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), r = Math.hypot(p.getX(i), p.getZ(i)); if (r < 1e-6) continue; const k = Math.round(((a + Math.PI) / (2 * Math.PI)) * ribs * 2) % 2 ? 1 : (d / 2 - 0.0009) / (d / 2); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); }
      return mesh(name, g, m, x, (ya + yb) / 2, z);
    };
    // the inlet: the 4-lobed nut on the valve, the pipe bending out of it and down, its collar, sleeve and tap coupling
    {
      const I = RP.inlet, zp = zb - 0.025;
      const nut = new THREE.Shape(), tips = [[I.nut_w / 2, 0], [0, I.nut_h / 2], [-I.nut_w / 2, 0], [0, -I.nut_h / 2]], tr = 0.0055;
      tips.forEach(([tx, ty], k) => {
        const a = (k * Math.PI) / 2, cx = tx - tr * Math.cos(a), cy = ty - tr * Math.sin(a);
        const s0 = [cx + tr * Math.cos(a - 1.2), cy + tr * Math.sin(a - 1.2)];
        if (k === 0) nut.moveTo(...s0); else nut.quadraticCurveTo(0.0125 * Math.cos(a - Math.PI / 4), 0.0125 * Math.sin(a - Math.PI / 4), ...s0);
        nut.absarc(cx, cy, tr, a - 1.2, a + 1.2, false);
      });
      const [fx, fy] = [tips[0][0] - tr + tr * Math.cos(-1.2), tr * Math.sin(-1.2)];
      nut.quadraticCurveTo(0.0125 * Math.cos(-Math.PI / 4), 0.0125 * Math.sin(-Math.PI / 4), fx, fy);
      const ng = new THREE.ExtrudeGeometry(nut, { depth: 0.009, bevelEnabled: true, bevelSize: 0.0012, bevelThickness: 0.0012, bevelSegments: 1, curveSegments: 3 });
      cab.add(mesh("InletNut", ng, white, I.x, I.nut, zb - 0.0114));
      const el = new THREE.CatmullRomCurve3([[I.x, I.nut, zb - 0.006], [I.x, I.nut, zb - 0.016], [I.x, I.nut - 0.006, zp + 0.001], [I.x, I.nut - 0.014, zp], [I.x, I.collar[0], zp]].map((p) => new THREE.Vector3(...p)), false, "centripetal");
      cab.add(mesh("InletElbow", new THREE.TubeGeometry(el, 24, I.pipe_d / 2, 16, false), white));
      cab.add(post("InletCollar", I.collar_d, I.collar[0], I.collar[1], white, I.x, zp));
      cab.add(post("InletPipe", I.pipe_d, I.pipe[0], I.pipe[1], white, I.x, zp));
      cab.add(post("InletSleeve", I.sleeve_d, I.sleeve[0], I.sleeve[1], white, I.x, zp));
      cab.add(post("InletRing", I.ring_d, I.ring[0], I.ring[1], white, I.x, zp, 0, 18));
      cab.add(post("InletNeck", I.neck_d, I.neck[0], I.neck[1], white, I.x, zp));
      cab.add(post("InletBody", I.body_d, I.body[0], I.body[1], white, I.x, zp, 28));
      // the coupling's wire clip, on its +x side
      cab.add(box("InletClip", 0.0025, I.clip[0] - I.clip[1], 0.0025, white, I.x + I.ring_d / 2 + 0.004, (I.clip[0] + I.clip[1]) / 2, zp));
      cab.add(box("InletClipArm", 0.005, 0.0025, 0.0025, white, I.x + I.ring_d / 2 + 0.0015, I.clip[0] - 0.001, zp));
    }
    // the cord, laid on the back as the texture script stacked it where its strands cross, out of its slot at the top
    const cd = RP.cord_d, C = RP.cord;
    {
      const [gx, gy] = RP.grommet;
      const g = cyl("CordGrommet", 0.0045, 0.0045, 0.004, backBlack, gx, gy, zb - 0.0018, 16);
      g.rotation.x = Math.PI / 2; cab.add(g);
      const pts = [new THREE.Vector3(C[0][0], C[0][1] + 0.002, zb + 0.004), ...C.map(([x, y, l]) => new THREE.Vector3(x, y, zb - l))];
      cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), Math.round(pts.length * 1.4), cd / 2, 6, false), white));
    }
    // the plug: a rounded triangle lying on the back, its three pins out, the ribbed sleeve the cord leaves it by
    {
      const P = RP.plug, t = P.t, bt = 0.0015, cr = 0.006;
      const c = P.body.reduce((a, [x, y]) => [a[0] + x / 3, a[1] + y / 3], [0, 0]);
      // inradius of the photo's triangle, shrunk so the rounded outline (shrunk triangle + a disc of cr) keeps its size
      const [A, B, Cc] = P.body, ar = Math.abs((B[0] - A[0]) * (Cc[1] - A[1]) - (Cc[0] - A[0]) * (B[1] - A[1])) / 2;
      const per = [[A, B], [B, Cc], [Cc, A]].reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
      const rho = (2 * ar) / per, k = (rho - cr) / rho;
      const V = P.body.map(([x, y]) => [c[0] + (x - c[0]) * k - c[0], c[1] + (y - c[1]) * k - c[1]]);
      const sh = new THREE.Shape();
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * 2 * Math.PI, n = [Math.cos(a), Math.sin(a)];
        const v = V.reduce((b, p) => (p[0] * n[0] + p[1] * n[1] > b[0] * n[0] + b[1] * n[1] ? p : b));
        i ? sh.lineTo(v[0] + cr * n[0], v[1] + cr * n[1]) : sh.moveTo(v[0] + cr * n[0], v[1] + cr * n[1]);
      }
      const pg = new THREE.ExtrudeGeometry(sh, { depth: t - 2 * bt, bevelEnabled: true, bevelSize: bt, bevelThickness: bt, bevelSegments: 1, curveSegments: 4 });
      cab.add(mesh("Plug", pg, white, c[0], c[1], zb - 0.0006 - t + bt));
      for (const [x, y] of P.pins) {
        const pin = cyl("PlugPin", P.pin_d / 2, P.pin_d / 2, 0.019, pinM, x, y, zb - 0.0006 - t - 0.0095, 12);
        pin.rotation.x = Math.PI / 2; cab.add(pin);
      }
      const [[sx0, sy0], [sx1, sy1]] = P.sleeve, za = zb - 0.0006 - t / 2, zc = zb - C[C.length - 1][2];
      const a0 = new THREE.Vector3(sx0, sy0, za), a1 = new THREE.Vector3(sx1, sy1, zc), len = a0.distanceTo(a1);
      const sg = new THREE.CylinderGeometry(0.0062, cd / 2 + 0.0008, len, 14, 12, true);
      { const p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const ring = Math.round(((p.getY(i) + len / 2) / len) * 12); if (ring % 2 && ring < 11) { p.setX(i, p.getX(i) * 1.18); p.setZ(i, p.getZ(i) * 1.18); } } sg.computeVertexNormals(); }
      const sl = mesh("CordSleeve", sg, white, (sx0 + sx1) / 2, (sy0 + sy1) / 2, (za + zc) / 2);
      sl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a0.clone().sub(a1).normalize());
      cab.add(sl);
    }
    // the drain hose: its smooth end piece at the top, then corrugated, down the machine's right and into the plinth
    {
      const r = RP.hose_d / 2, H0 = RP.hose, zh = zb - r - 0.0025;
      const last = H0[H0.length - 1];
      const hp = [...H0.map(([x, y]) => new THREE.Vector3(x, y, zh)), new THREE.Vector3(last[0], last[1] - 0.008, zb + 0.006)];
      const curve = new THREE.CatmullRomCurve3(hp, false, "centripetal");
      const N = 170, tg = new THREE.TubeGeometry(curve, N, r, 10, false);
      const cuffRings = Math.ceil((N * RP.hose_cuff) / curve.getLength());
      const p = tg.attributes.position, n = tg.attributes.normal, perRing = 11;
      for (let i = 0; i < p.count; i++) {
        const ringI = Math.floor(i / perRing);
        if (ringI <= cuffRings) continue;                     // the smooth end piece
        const s = ringI % 2 ? 0.0022 : -0.0009;
        p.setXYZ(i, p.getX(i) + n.getX(i) * s, p.getY(i) + n.getY(i) * s, p.getZ(i) + n.getZ(i) * s);
      }
      tg.computeVertexNormals();
      cab.add(mesh("DrainHose", tg, hoseM));
      // the open top end: dark inside
      const e = cyl("HoseEnd", r - 0.0012, r - 0.0012, 0.001, grooveM, H0[0][0], H0[0][1] - 0.004, zh, 20);
      cab.add(e);
    }
  }
  return root;
}

// ── the 31671's measurements (metres). VERIFIED: W, H, D. Everything else ESTIMATED off Whirlpool's photos (NOTES.md). ──
export const K31671 = {
  rootName: "Whirlpool31671",
  W: 0.54, H: 1.025, D: 0.58,
  bodyHex: 0x464d56, plinthHex: 0x41474f, innerHex: 0x2c323b,
  lidOpacity: 0.97,                // near black from above as in front.jpg and three_quarter_dims.jpg; at 0.9 the drum showed through
  footR: 0.017, footH: 0.02, feetX: 0.232, feetXf: [0.045, 0.535],
  plinthTop: 0.067, notchTop: 0.041, notch: 0.17,
  cornerR: 0.012,
  seam: [0.76, 0.83],              // the cabinet's top edge at the front and at the back
  seat0: 0.83, lidSlope: 0.2126,   // the lid seat: 830 mm at the front, rising 12 degrees
  lidThick: 0.022, shoulder: 0.016,
  lid0: 0.012, lid1: 0.462, lidBorder: [0.05, 0.035, 0.03],
  housing0: 0.462,
  face: [[0.4655, 0.9505], [0.5615, 1.0245]], faceW: 0.508,
  housingBack: [[0.568, 1.025], [0.576, 1.0215], [0.58, 1.012]],
  capY: 0.975, capXf: 0.52,
  well: { x: 0.226, f0: 0.04, f1: 0.452, r: 0.085 },
  drumXf: 0.246, ringR: 0.203, ringY: 0.775, drumR: 0.198, drumDepth: 0.43, impR: 0.168,
  hingeX: 0.232,
  sideH: 0.69,
  label: { w: 0.09, h: 0.1663, x: 0.17, y: 0.6 },
  back: true,                      // Whirlpool shows this model's back (back.jpg)
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
  const ID = "whirlpool-31671";
  const T = `${TEX}/whirlpool_31671`;
  // the back's paths, measured on back.jpg by tex_whirlpool_31671.py
  const root = buildBloomwash({ ...K31671, rear: JSON.parse(fs.readFileSync(`${T}/rear_paths.json`, "utf8")) });
  const parts = productParts(PRODUCTS, ID);
  const clips = stateClips(root, parts);
  saveZones(PRODUCTS, ID, root, parts);
  await exportGLB(root, clips, OUT, {
    SideL: `${T}/side.jpg`, SideR: `${T}/side.jpg`, PanelFace: `${T}/panel.jpg`, LabelBEE: `${T}/label.png`, BackPanel: `${T}/back.jpg`,
    SteelDrum: `${T}/drum.jpg`, Impeller: `${T}/impeller.jpg`,
  }, { dir: `${TEX}/grain`, materials: {
    // Grain (BENCHMARK.md section 10). Whirlpool names the finish Midnight Grey, finish type "Solid": painted steel, so the
    // cabinet, its sides and the top cover get the soft peel; the moulded plinth, the black back and the lid's grey inner frame
    // the strong peel; nothing on the glass lid, the panel glass or the label, which carry print or are glass.
    Body: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, TopCover: { type: "peel_soft" },
    Plinth: { type: "peel_strong" }, BackPanel: { type: "peel_strong" }, BackPlastic: { type: "peel_strong" }, LidFrame: { type: "peel_strong" },
  } });
}
