// Shared by the product, compare and showroom pages (and xr.js): which moving part a tap
// landed on, which feature hotspots show in the current door state, and the fit check.

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const cm = (s) => parseFloat(s);

export const CATEGORIES = [
  ["Refrigerator", "Refrigerators"],
  ["Washing machine", "Washing machines"],
  ["Air conditioner", "Air conditioners"],
  ["Dishwasher", "Dishwashers"],
];

// A finish's address name, for ?finish=<slug>: "White and gold" -> "white-and-gold". make_pages.mjs and
// pipeline/integration/make_links.mjs use it too, so a link they write opens the colour the page shows.
export const finishSlug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// the finish a ?finish= value names, or the first one when it names none
export const finishIndexOf = (product, slug) => Math.max(0, slug ? product.finishes.findIndex((f) => finishSlug(f.name) === finishSlug(slug)) : 0);
// A colour's address on /p/ (STANDARD.md section 2), not URI-encoded. A colour in Sangeetha's item master has its
// master item code as `itemCode`, exactly as written there, and opens at /p/<item code>. A colour that isn't in the
// master has no code of its own: it opens at the product's master code and its name, /p/<item code>/<colour>.
// A product with no master code at all keeps the maker's code; null means /p/<id>?finish=<colour>.
export function finishPath(product, i) {
  const fins = product.finishes || [], f = fins[i];
  const own = String(f?.itemCode || "").trim();
  if (own) return `/p/${own}`;
  const base = fins.map((x) => String(x.itemCode || "").trim()).find(Boolean);
  if (base && f) return `/p/${base}/${finishSlug(f.name)}`;
  const code = String(f?.code || "").trim();
  return code ? `/p/${code}` : null;
}
// Android without WebXR AR (in-app browsers, Samsung Internet, phones without WebXR) opens Google's Scene Viewer, which
// gets one file and nothing else. Each colour has its own file, in that colour and kept to Google's limits
// (pipeline/scripts/make_android.mjs; the gate's android-sceneviewer check).
export const androidFile = (product, i) => `/models/android/${product.id}/${finishSlug(product.finishes[i].name)}.gltf`;
// The link that opens it (https://developers.google.com/ar/develop/scene-viewer): in AR first (ar_preferred; Google
// says ar_only isn't for the Google app), at real size (resizable=false), on a wall for a wall unit, with the
// product's name and a button back to this page. `file` and `fallback` are absolute; the Google app missing or too
// old sends Chrome to `fallback`.
export function sceneViewerIntent(product, i, { file, page, fallback }) {
  const f = product.finishes[i];
  // Scene Viewer cuts a title at 60 characters: a long name with its colour gives way to the model code, so the colour shows
  let title = `${product.brand} ${product.shortName}${product.finishes.length > 1 ? `, ${f.name}` : ""}`;
  if (title.length > 60 && product.finishes.length > 1) title = `${product.brand} ${product.model}, ${f.name}`;
  const q = new URLSearchParams({ file, mode: "ar_preferred", resizable: "false", disable_occlusion: "true", title: title.slice(0, 60) });
  if (product.placement === "wall") q.set("enable_vertical_placement", "true");
  if (page) q.set("link", page);
  return `intent://arvr.google.com/scene-viewer/1.2?${q}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(fallback)};end;`;
}
// Opens a web page in Chrome from an Android in-app browser that can't open Scene Viewer itself
export const chromeIntent = (url) => {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end;`;
};
// Sangeetha's Product ID at the end of a sangeetha.com address, or null
export const productIdOf = (url) => String(url || "").match(/\/(\d+)\/?$/)?.[1] || null;

// The parts a part sits behind (`needs`): one key, or a list when it needs more than one door open (crispers
// that span both French doors)
export const needsOf = (part) => [].concat(part?.needs || []);

// Each part carries its bounding box closed and open (`zone`, written by the builders).
// A tap inside a box picks that part; where boxes overlap the smallest wins (a flap
// inside a door). A tap just off every box picks the nearest; a tap on the cabinet's
// side picks the part at that height and width, as seen from the front.
export function partAt(product, state, point) {
  const parts = (product.parts || []).filter((x) => x.zone);
  if (!parts.length) return product.parts?.[0]?.key ?? null;
  const p = [point.x, point.y, point.z];
  const box = (x) => x.zone[state[x.key] ? "open" : "closed"];
  const vol = ([a, b]) => (b[0] - a[0]) * (b[1] - a[1]) * (b[2] - a[2]);
  const dist = ([a, b], axes = [0, 1, 2]) => Math.hypot(...axes.map((i) => Math.max(a[i] - p[i], 0, p[i] - b[i])));
  const inside = parts.filter((x) => dist(box(x)) <= 0.01).sort((a, b) => vol(box(a)) - vol(box(b)));
  if (inside.length) return inside[0].key;
  const near = parts.map((x) => [x, dist(box(x))]).sort((a, b) => a[1] - b[1])[0];
  if (near[1] <= 0.06) return near[0].key;
  const front = parts.filter((x) => dist(x.zone.closed, [0, 1]) <= 0.01);
  return front.length ? front.sort((a, b) => vol(a.zone.closed) - vol(b.zone.closed))[0].key : null;
}

// show: "always", "<key>" (only while that part is open), "!<key>" (only while it is closed)
export function hotspotShown(h, state) {
  const s = h.show || "always";
  if (s === "always") return true;
  return s.startsWith("!") ? !state[s.slice(1)] : !!state[s];
}

// Will it fit? `space` is what the shopper measured, in cm: {w, h, d} for a floor unit,
// {w, h} (free wall width and height) for a wall unit. Gaps come from the maker (`fit`).
export function fitCheck(product, space) {
  const f = product.fit || {};
  const sides = f.sides || 0, top = f.top || 0, back = f.back || 0;
  const wall = product.placement === "wall";
  const dims = [
    { key: "w", label: "Width", size: cm(product.size.w), gap: sides * 2, gapText: sides ? `${sides} cm each side` : "" },
    { key: "h", label: "Height", size: cm(product.size.h), gap: top, gapText: top ? `${top} cm ${wall ? "below the ceiling" : "above"}` : "" },
  ];
  if (!wall) dims.push({ key: "d", label: "Depth", size: cm(product.size.d), gap: back, gapText: back ? `${back} cm behind` : "" });
  const rows = dims.map((d) => {
    const need = round(d.size + d.gap), have = +space[d.key];
    return { ...d, need, have, ok: have >= need, margin: round(have - need), given: have > 0 };
  });
  const given = rows.every((r) => r.given);
  return { rows, given, ok: given && rows.every((r) => r.ok), front: f.front || 0, note: f.note || "", gaps: !!(sides || top || back) };
}
const round = (n) => Math.round(n * 10) / 10;
