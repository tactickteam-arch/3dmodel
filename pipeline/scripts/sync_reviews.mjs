// Writes the team's decisions from the admin's Testing pages into products.json, so the file says what the site
// already shows (live.js follows the decisions as soon as they are made) and make_pages.mjs's link-preview pages
// catch up at the next commit:
//   approved → on show: "hidden" and "awaitingReview" are removed;
//   declined → off the site: "hidden": true ("awaitingReview" is left as it is).
// A product with no decision is never touched, so the products deliberately kept off the site stay as they are
// until someone approves one. A decision for an id products.json doesn't have is reported and skipped.
// The decisions come from s3d_live, the same anon-key function the site calls (pipeline/admin/schema.sql);
// DECISIONS=<file> reads them from a JSON file instead ([{ "product_id", "decision" }], as s3d_live answers),
// and PRODUCTS=<file> works on another catalogue (test_review.mjs uses both). The file is written back the way it
// is kept (two-space JSON, a newline at the end), so nothing else changes.
// usage: node pipeline/scripts/sync_reviews.mjs [--dry-run]
//        then: node pipeline/scripts/make_pages.mjs, and the site suite, before committing
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dry = process.argv.includes("--dry-run");
const file = process.env.PRODUCTS || path.join(root, "products.json");

async function decisions() {
  if (process.env.DECISIONS) return JSON.parse(fs.readFileSync(process.env.DECISIONS, "utf8"));
  // the project's address and anon key, from the admin's settings (the key is public by design)
  const config = fs.readFileSync(path.join(root, "admin-app/config.js"), "utf8");
  const url = config.match(/SUPABASE_URL = "([^"]+)"/)?.[1], key = config.match(/SUPABASE_ANON_KEY = "([^"]+)"/)?.[1];
  if (!url || !key) throw new Error("admin-app/config.js has no SUPABASE_URL or SUPABASE_ANON_KEY");
  const r = await fetch(`${url}/rest/v1/rpc/s3d_live`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`s3d_live answered ${r.status}: ${(await r.text()).slice(0, 200)}${r.status === 404 ? " (has pipeline/admin/schema.sql been run?)" : ""}`);
  return r.json();
}

const text = fs.readFileSync(file, "utf8");
const cat = JSON.parse(text);
const rows = await decisions();
if (!Array.isArray(rows)) throw new Error("the decisions should be a list");
const changes = [];
for (const { product_id: id, decision } of rows) {
  const p = cat.products.find((x) => x.id === id);
  if (!p) { console.log(`skipped ${id}: ${decision}, but it isn't in ${path.basename(file)}`); continue; }
  const before = JSON.stringify(p);
  if (decision === "approved") { delete p.hidden; delete p.awaitingReview; }
  else if (decision === "declined") p.hidden = true;
  else { console.log(`skipped ${id}: unknown decision "${decision}"`); continue; }
  if (JSON.stringify(p) !== before) changes.push(`${id}: ${decision} → ${decision === "approved" ? "on show" : "hidden"}`);
}
console.log(`${rows.length} ${rows.length === 1 ? "decision" : "decisions"}; ${changes.length ? `${changes.length} to write:\n  ${changes.join("\n  ")}` : "products.json already matches"}`);
if (changes.length && !dry) {
  fs.writeFileSync(file, JSON.stringify(cat, null, 2) + "\n");
  console.log(`${path.relative(root, file) || file} written; now run node pipeline/scripts/make_pages.mjs and the site suite (STANDARD.md section 6)`);
} else if (changes.length) console.log("dry run: nothing written");
