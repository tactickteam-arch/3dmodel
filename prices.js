// MOP (market operating price) for every product colour, shared by the catalogue, the product pages, compare and the
// showroom. Prices are NOT in this repo (it is public): the site reads /prices.json when the server has one, and until
// then every product shows the placeholder. The file, when Sangeetha's prices arrive:
//   { "updated": "2026-11-23", "items": { "<colour's itemCode, or the product id>": 24990, ... } }
// A colour's own item code wins; the product id is the fallback for every colour of that product.

let loading = null;

// Resolves to a Map of key -> price in INR (empty when the server has no prices file yet). Fetched once per page.
export function loadPrices() {
  if (!loading) {
    loading = fetch("/prices.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : { items: {} }))
      .catch(() => ({ items: {} }))
      .then((d) => {
        const m = new Map();
        for (const [k, v] of Object.entries((d && d.items) || {})) {
          const n = Number(v);
          if (k && Number.isFinite(n) && n > 0) m.set(String(k).trim().toUpperCase(), Math.round(n));
        }
        return m;
      });
  }
  return loading;
}

// The MOP of a product's colour (finishIndex, default its first), or null when there is none yet.
export function mopOf(prices, product, finishIndex = 0) {
  if (!prices || !product) return null;
  const fin = (product.finishes || [])[finishIndex] || {};
  for (const k of [fin.itemCode, fin.code, product.id]) {
    const v = k && prices.get(String(k).trim().toUpperCase());
    if (v) return v;
  }
  return null;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// The text to show: "MOP" and the price in Indian grouping, or the placeholder.
export function mopText(n) {
  return n ? `MOP ${inr.format(n)}` : "MOP: price coming soon";
}
