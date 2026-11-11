// Checks colours (finishes) in links, on a scratch catalogue: the real products.json is read, never written.
// One product gets a second colour "Gold, Matt White" (slug gold-matt-white) with a variant name, a maker code and
// its own Sangeetha Product ID. The scratch colour points at another product's USDZ, so the AR link can be told
// apart from the first colour's. A second product's first colour repeats that ID, so the clash report is checked too.
// - /p/<id>?finish=<slug>: that swatch pressed, mv.variantName set, Quick Look opens that colour's USDZ with a link
//   back that keeps ?finish=; any case works; an unknown slug, or none, falls back to the first colour; a swatch
//   press puts its slug in the address;
// - /compare?a=<id>&fa=<slug>: that colour, and a swatch press updates fa;
// - make_pages.mjs build(): /id/<the colour's ID> opens /p/<id>?finish=<slug>, keeping the visitor's query string;
//   the product's own ID still opens /p/<id>; the repeated ID is reported and opens the first;
// - pipeline/integration/make_links.mjs: one row per colour, /id/<ID> where that ID opens it, else
//   /p/<id>?finish=<slug>, and a cell with a comma quoted.
// It starts its own server (serve.mjs with PRODUCTS=<scratch catalogue>, the scratch id pages under /__test).
// usage: node test_finish.mjs <out dir>   (SERVE_PORT: the server's port; PORT: the browser's debugging port)
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";
import { build } from "./make_pages.mjs";
import { SITE } from "../../site-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.resolve(process.argv[2] || path.join(root, ".work/test_finish"));
fs.mkdirSync(out, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// ── the scratch catalogue ──
const real = read("products.json");
const cat = JSON.parse(real);
// a product on show, or, when none fits (whole lists can be hidden), a hidden one put on show in the scratch copy
const pick = (fn) => cat.products.find((p) => !p.hidden && fn(p)) || cat.products.find(fn);
const F = pick((p) => /\/\d+$/.test(p.sangeethaUrl || "") && p.finishes.length === 1 && p.parts?.length);
const G = pick((p) => p !== F && p.finishes.length === 1 && p.finishes[0].usdz !== F.finishes[0].usdz);
const W = pick((p) => p !== F && p !== G && p.category !== F.category) || pick((p) => p !== F && p !== G);
for (const p of [F, G, W]) delete p.hidden;
const shown = cat.products.filter((p) => !p.hidden);
const PID = "990001", OWN = F.sangeethaUrl.match(/(\d+)$/)[1];
const gold = { name: "Gold, Matt White", swatchColor: "#d9c9a0", usdz: G.finishes[0].usdz, variant: "test-gold", code: "TEST-GMW", sangeethaUrl: `https://www.sangeetha.com/product-details/test-colour/${PID}` };
F.finishes.push(gold);
G.finishes[0].sangeethaUrl = `https://www.sangeetha.com/product-details/test-clash/${PID}`;
const scratch = path.join(out, "products.json");
fs.writeFileSync(scratch, JSON.stringify(cat, null, 2));
check(read("products.json") === real && scratch !== path.join(root, "products.json"), "the scratch catalogue is a copy; the real products.json is untouched");
const first = F.finishes[0], firstSlug = first.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
console.log(`  (scratch: ${F.id} gets "${gold.name}" with ID ${PID} and ${G.id}'s USDZ; ${G.id}'s colour repeats ${PID})`);

console.log("\n[make_pages.mjs build()]");
const { files, notes } = build({
  site: SITE, products: cat.products, oldLinks: { links: {} }, productHtml: read("product.html"), indexHtml: read("index.html"),
  compareHtml: read("compare.html"), showroomHtml: read("showroom.html"), vercelJson: read("vercel.json"),
});
const target = (f) => files.get(f)?.match(/var to = "([^"]+)"/)?.[1];
check(target(`id/${PID}.html`) === `/p/${F.id}?finish=gold-matt-white`, `id/${PID}.html opens ${target(`id/${PID}.html`)}`);
check(target(`id/${OWN}.html`) === `/p/${F.id}`, `the product's own id/${OWN}.html still opens ${target(`id/${OWN}.html`)}`);
const clash = notes.find((n) => n.includes(PID));
check(clash === `Product ID ${PID} is on both ${F.id} (${gold.name}) and ${G.id} (${G.finishes[0].name}); /id/${PID} opens ${F.id} (${gold.name})`, `the repeated ID is reported: ${clash}`);
// the scratch id pages, served under /__test
const testDir = path.join(out, "site");
for (const f of [`id/${PID}.html`, `id/${OWN}.html`]) { fs.mkdirSync(path.join(testDir, "id"), { recursive: true }); fs.writeFileSync(path.join(testDir, f), files.get(f)); }

console.log("\n[pipeline/integration/make_links.mjs]");
const csv = path.join(out, "LINKS.csv");
const said = execFileSync("node", [path.join(root, "pipeline/integration/make_links.mjs")], { env: { ...process.env, PRODUCTS: scratch, OUT: csv }, encoding: "utf8" });
const parse = (t) => t.trim().split("\n").map((line) => { const cells = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { cells.push(cur); cur = ""; } else cur += ch; }
  cells.push(cur); return cells; });
const rows = parse(fs.readFileSync(csv, "utf8"));
const O = SITE.publicOrigin;
check(rows[0].join("|") === "brand|product name|finish|maker code|Sangeetha Product ID|our link", `columns: ${rows[0].join(", ")}`);
check(rows.length - 1 === shown.reduce((n, p) => n + p.finishes.length, 0), `one row per colour (${rows.length - 1})`);
const row = (id, fin) => rows.find((r) => r[1] === shown.find((p) => p.id === id).name && r[2] === fin);
check(JSON.stringify(row(F.id, first.name)) === JSON.stringify([F.brand, F.name, first.name, first.code || "", OWN, `${O}/id/${OWN}`]), `${F.id} ${first.name}: ${row(F.id, first.name)?.slice(2).join(" | ")}`);
check(JSON.stringify(row(F.id, gold.name)) === JSON.stringify([F.brand, F.name, gold.name, gold.code, PID, `${O}/id/${PID}`]), `${F.id} ${gold.name}: ${row(F.id, gold.name)?.slice(2).join(" | ")}`);
check(JSON.stringify(row(G.id, G.finishes[0].name)) === JSON.stringify([G.brand, G.name, G.finishes[0].name, G.finishes[0].code || "", PID, `${O}/p/${G.id}?finish=${G.finishes[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`]) && /warning: .*\/id\/990001 opens/.test(said),
  `${G.id}, whose ID opens ${F.id}: ${row(G.id, G.finishes[0].name)?.slice(4).join(" | ")}, with a warning`);
const noId = shown.find((p) => !p.sangeethaUrl && !p.finishes.some((f) => f.sangeethaUrl));
if (noId) check(JSON.stringify(row(noId.id, noId.finishes[0].name)?.slice(4)) === JSON.stringify(["", `${O}/p/${noId.id}?finish=${noId.finishes[0].name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`]), `${noId.id}, with no ID: ${row(noId.id, noId.finishes[0].name)?.slice(4).join(" | ")}`);
check(fs.readFileSync(csv, "utf8").includes(`,"${gold.name}",`), "a cell with a comma is quoted");

// ── the pages, on the scratch catalogue ──
const SERVE = +(process.env.SERVE_PORT || 9478), base = `http://127.0.0.1:${SERVE}`;
const server = spawn("node", [path.join(root, "pipeline/scripts/serve.mjs"), root, String(SERVE), testDir], { env: { ...process.env, PRODUCTS: scratch }, stdio: "ignore" });
process.on("exit", () => server.kill());
let up = false;
for (let i = 0; i < 40 && !up; i++) { try { up = (await (await fetch(`${base}/products.json`)).json()).products.some((p) => p.finishes.some((f) => f.name === gold.name)); } catch {} if (!up) await sleep(250); }
if (!up) { check(false, `the scratch server answers on port ${SERVE} (is something else on it?)`); server.kill(); process.exit(1); }
const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9479) });
await b.viewport(390, 844, true, IPHONE);
// fake an iPhone's Quick Look (as test_site.mjs): the AR button's link is kept instead of followed
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `
  const orig = DOMTokenList.prototype.supports;
  DOMTokenList.prototype.supports = function (t) { return t === 'ar' ? true : orig.call(this, t); };
  HTMLAnchorElement.prototype.click = function () { window.__quickLook = { href: this.href, rel: this.rel }; };` });
const open = async (url) => { await b.go(base + url); return b.waitFor("document.querySelector('model-viewer')?.loaded === true", 90000).then(async (r) => { await sleep(1200); return r; }); };
const page = () => b.evalJS(`({ pressed: [...document.querySelectorAll("#swatches .swatch")].map((x) => x.getAttribute("aria-pressed") === "true"), variant: document.querySelector("model-viewer").variantName, search: location.search, path: location.pathname })`);
const quickLook = async () => {
  await b.evalJS("window.__quickLook = null; document.getElementById('btnAR').click()");
  await sleep(500);
  await b.evalJS("document.getElementById('sheetGo')?.click()");
  await sleep(400);
  const h = await b.evalJS("window.__quickLook && window.__quickLook.href");
  return h ? { file: new URL(h).pathname, back: decodeURIComponent(h.match(/canonicalWebPageURL=([^&]+)/)?.[1] || "") } : null;
};

console.log(`\n[/p/${F.id}?finish=, on an iPhone]`);
check(await open(`/p/${F.id}?finish=gold-matt-white`), "the page loads");
let s = await page();
let ql = await quickLook();
check(s.pressed.join() === "false,true" && s.variant === gold.variant, `?finish=gold-matt-white: its swatch pressed, variantName "${s.variant}"`);
check(ql?.file === gold.usdz && new URL(ql.back).searchParams.get("finish") === "gold-matt-white", `the AR button opens ${ql?.file}, linking back to ${ql?.back}`);
await open(`/p/${F.id}?finish=Gold-Matt-White`);
s = await page();
check(s.pressed.join() === "false,true" && s.variant === gold.variant, "?finish=Gold-Matt-White works too");
for (const q of ["?finish=no-such-colour", ""]) {
  await open(`/p/${F.id}${q}`);
  s = await page();
  ql = await quickLook();
  check(s.pressed.join() === "true,false" && s.variant === null && ql?.file === first.usdz, `${q || "no ?finish="}: the first colour (${first.name}), variantName ${s.variant}, AR opens ${ql?.file}`);
}
await b.evalJS(`document.querySelectorAll("#swatches .swatch")[1].click()`);
await sleep(500);
s = await page();
ql = await quickLook();
check(s.search === "?finish=gold-matt-white" && s.variant === gold.variant && ql?.file === gold.usdz && ql.back.includes("finish=gold-matt-white"), `pressing "${gold.name}": address ${s.search}, AR opens ${ql?.file}`);
check(await b.evalJS(`decodeURIComponent(document.getElementById("btnWhatsApp").href).includes("finish=gold-matt-white")`), "the WhatsApp link shares that colour");
await b.evalJS(`document.querySelectorAll("#swatches .swatch")[0].click()`);
await sleep(400);
s = await page();
check(s.search === `?finish=${firstSlug}` && s.variant === null, `pressing "${first.name}": address ${s.search}`);
await b.shot(`${out}/product-finish.png`);

console.log("\n[/id/ pages]");
await b.go(`${base}/__test/id/${PID}.html?embed=1`);
await b.waitFor("location.pathname.startsWith('/p/')", 10000);
check(await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 90000), "the colour's id page lands on the product");
await sleep(1000);
s = await page();
check(s.path === `/p/${F.id}` && s.search === "?finish=gold-matt-white&embed=1" && s.pressed.join() === "false,true" && s.variant === gold.variant, `/id/${PID}?embed=1 opens ${s.path}${s.search} in ${gold.name}`);
await b.go(`${base}/__test/id/${OWN}.html`);
await b.waitFor("location.pathname.startsWith('/p/')", 10000);
await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 90000);
await sleep(800);
s = await page();
check(s.path === `/p/${F.id}` && s.search === "" && s.pressed.join() === "true,false", `/id/${OWN} opens ${s.path} in ${first.name}`);

console.log("\n[/compare?fa=]");
await b.viewport(1440, 900);
await b.go(`${base}/compare?a=${F.id}&b=${W.id}&fa=gold-matt-white`);
check(await b.waitFor("window.__compare && window.__compare.sides.every((s) => s.mv.loaded)", 90000), "both load");
await sleep(800);
const cmp = () => b.evalJS(`({ i: window.__compare.sides[0].finishIndex, variant: window.__compare.sides[0].mv.variantName, pressed: [...document.querySelectorAll('.col[data-side="a"] .swatch')].map((x) => x.getAttribute("aria-pressed") === "true"), search: location.search, other: document.querySelectorAll('.col[data-side="b"] .swatch').length })`);
let c = await cmp();
check(c.i === 1 && c.variant === gold.variant && c.pressed.join() === "false,true" && c.other === 0, `fa=gold-matt-white: the left one in ${gold.name}; the right one (one colour) has no swatches`);
await b.evalJS(`document.querySelectorAll('.col[data-side="a"] .swatch')[0].click()`);
await sleep(400);
c = await cmp();
check(c.i === 0 && c.variant === null && c.search === `?a=${F.id}&b=${W.id}&fa=${firstSlug}`, `pressing ${first.name}: address ${c.search}`);
await b.shot(`${out}/compare-finish.png`);

const errs = b.logs.filter((l) => /EXCEPTION|\[error\]|Uncaught/.test(l));
check(errs.length === 0, errs.length ? `console errors: ${errs.slice(0, 3).join(" | ")}` : "no console errors");
b.close();
server.kill();
console.log(`\n${passed} passed, ${failed} failed checks`);
process.exit(failed ? 1 : 0);
