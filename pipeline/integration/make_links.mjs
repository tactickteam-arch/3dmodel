// The integration map for the store app: one row per colour (finish) of every product on show, with the link to
// put in its "AR link" field. Written to private/integration/LINKS.csv, which stays out of git (private/ is ignored).
// Columns: brand, product name, finish, maker code, Sangeetha Product ID, our link.
// The link is /id/<Product ID> when Sangeetha lists that colour under an ID (make_pages.mjs writes those pages),
// else /p/<id>?finish=<slug>, under SITE.publicOrigin. A product's own sangeethaUrl counts for its first colour,
// unless one of its colours carries that same ID. An ID that /id/ can't open for this colour (it is on another
// product too; make_pages.mjs reports it) gets the /p/ link instead, with a warning.
// Run it after make_pages.mjs whenever products.json changes.
// PRODUCTS=<file> reads another catalogue, OUT=<file> writes elsewhere (test_finish.mjs uses both).
// usage: node pipeline/integration/make_links.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finishSlug, productIdOf } from "../../site.js";
import { productIds } from "../scripts/make_pages.mjs";
import { SITE } from "../../site-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const products = JSON.parse(fs.readFileSync(process.env.PRODUCTS || path.join(root, "products.json"), "utf8")).products;
const out = process.env.OUT || path.join(root, "private/integration/LINKS.csv");
const shown = products.filter((p) => !p.hidden);
const { byPid } = productIds(shown);

const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const rows = [["brand", "product name", "finish", "maker code", "Sangeetha Product ID", "our link"]];
for (const p of shown) {
  const own = productIdOf(p.sangeethaUrl);
  const claimed = own && p.finishes.some((f) => productIdOf(f.sangeethaUrl) === own); // a colour carries the product's ID
  p.finishes.forEach((f, i) => {
    const pid = productIdOf(f.sangeethaUrl) || (i === 0 && !claimed ? own : null);
    const page = byPid.get(pid);
    // /id/<ID> opens this product in this colour (or, for the first colour, the plain product page)
    const opensHere = page && page.p === p && (page.finish ? page.finish === f : i === 0);
    if (pid && !opensHere) console.log(`warning: ${p.id} ${f.name}: /id/${pid} opens ${page ? page.p.id : "nothing"}, so its link is /p/`);
    const link = pid && opensHere ? `/id/${pid}` : `/p/${p.id}?finish=${finishSlug(f.name)}`;
    rows.push([p.brand, p.name, f.name, f.code || "", pid || "", SITE.publicOrigin + link]);
  });
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, rows.map((r) => r.map(cell).join(",")).join("\n") + "\n");
console.log(`wrote ${rows.length - 1} rows (${shown.length} products) to ${path.relative(root, out)}`);
