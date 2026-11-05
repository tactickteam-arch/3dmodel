// Writes the pages made from other files, and keeps the site's address in step with site-config.js.
// 1. p/<id>.html for every product on show: product.html with that product's title, description and
//    link-preview tags. WhatsApp and other link previews read only the HTML, not what the page's script sets
//    later, so a shared /p/<id> link otherwise showed "Product in 3D and AR" with no picture.
//    Vercel serves /p/<id> from p/<id>.html (cleanUrls); any other id still falls through to product.html
//    (vercel.json), and so does serve.mjs locally.
// 2. Old links, so the store app and old QR codes keep working once their AR address points here. Each is a
//    tiny page that sends the visitor on, keeping the query string (?embed and the rest):
//      id/<Sangeetha Product ID>.html → /p/<id>, for each product on show whose sangeethaUrl ends in its ID
//      ar-experience/<old id>.html    → /p/<id>, from pipeline/integration/old-links.json
//      embed/discovery.html           → /?embed, the page the store app frames
//    Any other address under /id/, /ar-experience/ or /embed/ falls through to the catalogue (vercel.json, and
//    serve.mjs locally), which says kindly that it couldn't find the product.
// 3. index.html's og:url, and vercel.json's frame-ancestors header, which is there only while site-config.js
//    lists frameParents. vercel.json is kept in JSON.stringify's two-space layout.
// Run it after any change to product.html, site-config.js or old-links.json, or to a product's name, summary,
// photo, sangeethaUrl or "hidden" flag.
// --check writes nothing and exits 1 if anything is missing, stale or left over (the test suite runs it).
// SITE_CONFIG=<file> or OLD_LINKS=<file> reads that file in place of the real one. test_store_bridge.mjs calls build().
// usage: node pipeline/scripts/make_pages.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const OWNED = ["p", "id", "ar-experience", "embed"]; // the folders this script owns: a page in them it didn't make is removed
const HEAD = /<title>[^<]*<\/title>\n<meta name="description" content="[^"]*">\n/;
const OG_URL = /<meta property="og:url" content="[^"]*">/;
const FRAME_RULE = (h) => h.source === "/(.*)" && h.headers?.length === 1 && h.headers[0].key === "Content-Security-Policy" && /^frame-ancestors /.test(h.headers[0].value);

// site-config.js, checked here: a mistyped address would otherwise fail quietly in the browser
export function checkSite(site) {
  const origin = (o, where) => {
    let u; try { u = new URL(o); } catch {}
    const local = u && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);
    if (!u || u.origin !== o || !(u.protocol === "https:" || (local && u.protocol === "http:")))
      throw new Error(`site-config.js ${where}: "${o}" should be an address like https://host, with no path and no trailing slash`);
  };
  origin(site.publicOrigin, "publicOrigin");
  for (const k of ["alsoServedAt", "storeAppOrigins", "frameParents"]) {
    if (!Array.isArray(site[k])) throw new Error(`site-config.js ${k}: should be a list, [] when empty`);
    site[k].forEach((o) => origin(o, k));
  }
  return site;
}

// a page that sends an old link on to its page here, with the visitor's query string and #part
const redirect = (to) => `<!doctype html>
<!-- made by pipeline/scripts/make_pages.mjs: an old link, sent on to its page here -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sangeetha 3D and AR</title>
<script>var to = ${JSON.stringify(to).replace(/</g, "\\u003c")}, q = location.search.slice(1); location.replace(to + (q ? (to.indexOf("?") < 0 ? "?" : "&") + q : "") + location.hash);</script>
<noscript><meta http-equiv="refresh" content="0; url=${attr(to)}"></noscript>
</head>
<body><p><a href="${attr(to)}">Open the page</a></p></body>
</html>
`;

// What every made file should hold, as a map of path (from the site's root) → text, plus notes for the person
// running it. It reads and writes nothing, so the tests can call it with a made-up config or old links.
export function build({ site, products, oldLinks, productHtml, indexHtml, vercelJson }) {
  const ORIGIN = site.publicOrigin;
  const files = new Map(), notes = [];
  const shown = products.filter((p) => !p.hidden);

  // 1. a page per product on show
  if (!HEAD.test(productHtml)) throw new Error("product.html: the <title> and description lines have changed; update make_pages.mjs");
  for (const p of shown) {
    const title = `${p.brand} ${p.model} in 3D and AR`, url = `${ORIGIN}/p/${p.id}`;
    const tags = [
      `<title>${attr(title)}</title>`,
      `<meta name="description" content="${attr(p.summary)}">`,
      `<link rel="canonical" href="${url}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="Sangeetha 3D and AR">`,
      `<meta property="og:title" content="${attr(`${p.brand} ${p.shortName} in 3D and AR`)}">`,
      `<meta property="og:description" content="${attr(p.summary)}">`,
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:image" content="${ORIGIN}${p.thumb}">`,
      `<meta property="og:image:alt" content="${attr(p.name)}">`,
      `<meta name="twitter:card" content="summary">`, // the photos are square
    ];
    files.set(`p/${p.id}.html`, productHtml
      .replace("<!doctype html>\n", "<!doctype html>\n<!-- made from product.html by pipeline/scripts/make_pages.mjs: edit product.html, then run it -->\n")
      .replace(HEAD, tags.join("\n") + "\n"));
  }

  // 2. old links: Sangeetha's Product IDs, the store app's old AR links, and the page it frames
  const byPid = new Map();
  for (const p of shown) {
    const pid = (p.sangeethaUrl || "").match(/\/(\d+)\/?$/)?.[1];
    if (!pid) continue;
    if (byPid.has(pid)) { notes.push(`Product ID ${pid} is on both ${byPid.get(pid).id} and ${p.id}; /id/${pid} opens ${byPid.get(pid).id}`); continue; }
    byPid.set(pid, p);
    files.set(`id/${pid}.html`, redirect(`/p/${p.id}`));
  }
  for (const [old, to] of Object.entries(oldLinks.links || {})) {
    const p = shown.find((x) => x.id === String(to)) || byPid.get(String(to));
    if (!/^[A-Za-z0-9_-][A-Za-z0-9._~-]{0,199}$/.test(old)) notes.push(`old-links.json: "${old}" can't be a file name, so it was skipped`);
    else if (!p) notes.push(`old-links.json: ${old} → ${to} is not a product on show, so that link opens the catalogue`);
    else files.set(`ar-experience/${old}.html`, redirect(`/p/${p.id}`));
  }
  files.set("embed/discovery.html", redirect("/?embed"));

  // 3. the address in index.html's link preview, and who may frame us
  if (!OG_URL.test(indexHtml)) throw new Error("index.html: the og:url line has changed; update make_pages.mjs");
  files.set("index.html", indexHtml.replace(OG_URL, `<meta property="og:url" content="${attr(ORIGIN)}/">`));
  const v = JSON.parse(vercelJson);
  const headers = (v.headers || []).filter((h) => !FRAME_RULE(h));
  if (site.frameParents.length) {
    const allow = [...new Set([...site.frameParents, ...site.storeAppOrigins])];
    headers.push({ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${allow.join(" ")}` }] });
  }
  if (headers.length || v.headers) v.headers = headers;
  files.set("vercel.json", JSON.stringify(v, null, 2) + "\n");
  return { files, notes };
}

async function main() {
  const check = process.argv.includes("--check");
  const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
  const { SITE } = await import(pathToFileURL(process.env.SITE_CONFIG || path.join(root, "site-config.js")).href);
  const { files, notes } = build({
    site: checkSite(SITE),
    products: JSON.parse(read("products.json")).products,
    oldLinks: JSON.parse(fs.readFileSync(process.env.OLD_LINKS || path.join(root, "pipeline/integration/old-links.json"), "utf8")),
    productHtml: read("product.html"),
    indexHtml: read("index.html"),
    vercelJson: read("vercel.json"),
  });
  const stale = [...files].filter(([f, text]) => !fs.existsSync(path.join(root, f)) || read(f) !== text).map(([f]) => f);
  const extra = OWNED.flatMap((d) => (fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)) : [])
    .filter((f) => f.endsWith(".html")).map((f) => `${d}/${f}`)).filter((f) => !files.has(f));
  const count = OWNED.map((d) => `${d}/ ${[...files.keys()].filter((f) => f.startsWith(`${d}/`)).length}`).join(", ");
  for (const n of notes) console.log(`note: ${n}`);
  if (check) {
    if (stale.length || extra.length) {
      console.log(`out of date: ${[...stale, ...extra.map((f) => `${f} (no longer made)`)].join(", ")}. Run node pipeline/scripts/make_pages.mjs`);
      process.exit(1);
    }
    console.log(`pages up to date (${count}); index.html and vercel.json match site-config.js`);
  } else {
    for (const f of stale) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), files.get(f)); }
    for (const f of extra) fs.unlinkSync(path.join(root, f));
    console.log(`wrote ${stale.length}, removed ${extra.length} (${count})`);
  }
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
