// #/orders: the orders the 3D models were made in (orders-data.js) and where each item stands, read from
// /products.json. Read-only, and open without signing in (app.js shows it on its own page), because it needs nothing
// from the database: a product counts as live when it is in products.json and not hidden.
import { esc, icon, badge, statCard } from "./ui.js";
import { finishPath } from "/site.js";
import { siteOrigin } from "./config.js";
import { ORDERS } from "./orders-data.js";

const STATE = {
  live: ["Live", "green"], hidden: ["Built, not on show", "blue"], building: ["Being built", "amber"], waiting: ["Waiting", "red"],
};
const codeOf = (p) => { const f = (p.finishes || [])[0] || {}; return f.itemCode || f.code || p.model || ""; };
const df = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function orderRows(products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const used = new Set();
  const orders = ORDERS.map((o) => {
    const items = o.items.map((it) => {
      const p = it.id ? byId.get(it.id) : null;
      if (p) used.add(p.id);
      const st = p ? (p.hidden ? "hidden" : "live") : it.waiting ? "waiting" : "building";
      return { ...it, p, st };
    });
    const n = (s) => items.filter((i) => i.st === s).length;
    return { ...o, items, live: n("live"), building: n("building") + n("hidden"), waiting: n("waiting") };
  });
  const loose = products.filter((p) => !p.hidden && !used.has(p.id)).map((p) => ({ id: p.id, p, st: "live" }));
  return { orders, loose };
}

function table(items) {
  const rows = items.map((it, i) => {
    const p = it.p, [label, tone] = STATE[it.st];
    const name = p ? `${p.shortName || p.name}` : it.name;
    const link = p && it.st === "live" ? finishPath(p, 0) : null;
    return `<tr><td class="n">${i + 1}</td><td>${esc(p ? p.brand : it.brand)}</td><td class="wrap">${esc(name)}</td>
      <td>${esc(p ? codeOf(p) : it.code)}</td><td class="n">${p ? (p.finishes || []).length || 1 : "—"}</td>
      <td>${badge(label, tone)}${it.waiting ? ` <span class="muted" style="font-size:12.5px">${esc(it.waiting)}</span>` : ""}</td>
      <td>${link ? `<a class="btn sm" href="${esc(siteOrigin() + encodeURI(link))}" target="_blank" rel="noopener">${icon("external")}Open</a>` : ""}</td></tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="t"><thead><tr><th class="n">#</th><th>Brand</th><th>Product</th><th>Item code</th><th class="n">Colours</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export async function ordersPage(ctx) {
  const { el } = ctx;
  const r = await fetch("/products.json", { cache: "no-store" });
  if (!r.ok) throw new Error(`products.json answered ${r.status}`);
  const { orders, loose } = orderRows((await r.json()).products);
  if (ctx.alive && !ctx.alive()) return;
  const all = orders.reduce((a, o) => a + o.items.length, 0), live = orders.reduce((a, o) => a + o.live, 0);
  el.innerHTML = `<div class="page-head"><div><h1>Orders</h1><p>Every product in each order and where it stands. Read-only; it updates by itself as products go live.</p></div></div>
    <div class="stats">
      ${statCard({ title: "Orders", value: String(orders.length), ic: "box" })}
      ${statCard({ title: "Products live", value: `${live} of ${all}`, ic: "checkCircle", tone: "green" })}
      ${statCard({ title: "Being built", value: String(orders.reduce((a, o) => a + o.building, 0)), ic: "clock", tone: "amber" })}
      ${statCard({ title: "Waiting", value: String(orders.reduce((a, o) => a + o.waiting, 0)), ic: "alert", tone: "red", sub: "Waiting on photos or facts" })}
    </div>
    ${orders.map((o) => `<section class="section" aria-labelledby="h-${o.id}" id="order-${o.id}">
      <div class="section-head"><div><h2 id="h-${o.id}">${esc(o.name)} <span class="muted" style="font-size:14px;font-weight:400">· ${esc(df.format(new Date(o.date)))}</span></h2><p>${esc(o.note)}</p></div>
        <div style="min-width:220px;display:grid;gap:6px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${o.live} of ${o.items.length} live</span><b>${Math.round((100 * o.live) / (o.items.length || 1))}%</b></div>
        <div class="track green"><i style="width:${(100 * o.live) / (o.items.length || 1)}%"></i></div></div></div>
      ${table(o.items)}</section>`).join("")}
    ${loose.length ? `<section class="section" aria-labelledby="h-loose"><div class="section-head"><div><h2 id="h-loose">Not in an order yet</h2><p>Live on the site but not listed in any order.</p></div></div>${table(loose)}</section>` : ""}`;
}
