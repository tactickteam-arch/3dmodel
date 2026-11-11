// Which products are on show: products.json, plus the team's decisions from the admin's Testing pages.
// A product the team approved is on show, one it declined is off, and one it hasn't decided on follows
// products.json ("hidden": true keeps it off). So pressing Approve in /admin puts a product on the catalogue at once,
// with no new deploy; pipeline/scripts/sync_reviews.mjs later writes the decisions into products.json.
// The catalogue, the product page, the compare page and the showroom all read their products through here.
// The decisions come from s3d_live in Supabase (pipeline/admin/schema.sql), which gives the anon key each decided
// product's id and decision and nothing else. They are asked for alongside products.json and waited for at most
// 1.2 s: if they are slow, fail or are switched off, products.json alone decides, so a page never breaks or waits
// longer. Off on localhost, 127.0.0.1 and file: (tests stay the same every run) unless the address has ?live=1,
// which stays on for the tab. The anon key below is public by design, as in track.js.
const API = "https://rjbjlkickdnpsaicynap.supabase.co/rest/v1/rpc/s3d_live";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqYmpsa2lja2RucHNhaWN5bmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzAxODYsImV4cCI6MjA4OTkwNjE4Nn0.KPwMXyfKSzKoxn5V1jhb4xKA-1uAlIEJgBOSf6P4Udk";
const WAIT_MS = 1200;
// false until pipeline/admin/schema.sql has been run in Supabase: until then the live site asks for nothing
const READY = false;

const tab = (() => { try { return window.sessionStorage; } catch { return null; } })();
const flag = (() => {
  try {
    if (new URLSearchParams(location.search).get("live") === "1") tab?.setItem("s3d-live", "1");
    return tab?.getItem("s3d-live") === "1";
  } catch { return false; }
})();
const local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const on = (READY && !local) || flag;

// { product id: "approved" | "declined" }, or null when there are none to be had in time
async function decisions() {
  if (!on) return null;
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), WAIT_MS);
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: "{}",
      credentials: "omit",
      signal: stop.signal,
    });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    const out = Object.create(null);
    for (const x of rows) if (x && typeof x.product_id === "string" && (x.decision === "approved" || x.decision === "declined")) out[x.product_id] = x.decision;
    return out;
  } catch {
    return null;   // slow (aborted), offline, or not set up yet
  } finally {
    clearTimeout(timer);
  }
}

// { products: every product in products.json, isShown(p): whether the catalogue shows it, decision(id) }
export async function loadCatalogue() {
  const [cat, d] = await Promise.all([fetch("/products.json").then((r) => r.json()), decisions()]);
  const decision = (id) => d?.[id] || null;
  const isShown = (p) => { const x = decision(p.id); return x === "approved" || (x !== "declined" && !p.hidden); };
  return { products: cat.products, isShown, decision };
}

// the products on show, in products.json's order
export async function shownProducts() {
  const { products, isShown } = await loadCatalogue();
  return products.filter(isShown);
}
