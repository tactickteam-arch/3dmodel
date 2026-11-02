// Writes p/<id>.html for every product on show: product.html with that product's title, description and
// link-preview tags. WhatsApp and other link previews read only the HTML, not what the page's script sets
// later, so a shared /p/<id> link otherwise showed "Product in 3D and AR" with no picture.
// Vercel serves /p/<id> from p/<id>.html (cleanUrls); any other id still falls through to product.html
// (vercel.json), and so does serve.mjs locally.
// Run it after any change to product.html, or to a product's name, summary, photo or "hidden" flag.
// --check writes nothing and exits 1 if a page is missing, stale or left over (the test suite runs it).
// usage: node pipeline/scripts/make_pages.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const check = process.argv.includes("--check");
const ORIGIN = "https://3dmodelssangeetha.vercel.app"; // the public address (product.html, PUBLIC_ORIGIN)
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const page = fs.readFileSync(path.join(root, "product.html"), "utf8");
const HEAD = /<title>[^<]*<\/title>\n<meta name="description" content="[^"]*">\n/;
if (!HEAD.test(page)) throw new Error("product.html: the <title> and description lines have changed; update make_pages.mjs");
const shown = JSON.parse(fs.readFileSync(path.join(root, "products.json"), "utf8")).products.filter((p) => !p.hidden);

const want = new Map();
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
  const html = page
    .replace("<!doctype html>\n", "<!doctype html>\n<!-- made from product.html by pipeline/scripts/make_pages.mjs: edit product.html, then run it -->\n")
    .replace(HEAD, tags.join("\n") + "\n");
  want.set(`${p.id}.html`, html);
}

const dir = path.join(root, "p");
const have = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".html")) : [];
const stale = [...want].filter(([f, html]) => !fs.existsSync(path.join(dir, f)) || fs.readFileSync(path.join(dir, f), "utf8") !== html).map(([f]) => f);
const extra = have.filter((f) => !want.has(f));
if (check) {
  if (stale.length || extra.length) { console.log(`p/ is out of date: ${[...stale, ...extra.map((f) => `${f} (not shown)`)].join(", ")}. Run node pipeline/scripts/make_pages.mjs`); process.exit(1); }
  console.log(`p/: ${want.size} pages up to date`);
} else {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of stale) fs.writeFileSync(path.join(dir, f), want.get(f));
  for (const f of extra) fs.unlinkSync(path.join(dir, f));
  console.log(`p/: wrote ${stale.length}, removed ${extra.length}, ${want.size} pages`);
}
