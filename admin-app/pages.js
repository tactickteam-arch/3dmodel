// The admin's pages. Each gets ctx = { el, api, profile, can, alive } and fills ctx.el.
import { CATEGORIES } from "/site.js";
import { siteOrigin } from "./config.js";
import {
  esc, icon, badge, statCard, barList, emptyState, errorBox, toast, modal, confirmBox, formModal, copyText, qrModal,
  downloadCsv, fmtNum, fmtPct, fmtBytes, fmtDateTime, fmtDate, fmtAgo, istDay, istStart, addDays, slotLabel,
  hbar, vbar, lines, COLORS,
} from "./ui.js";

export const KIND_LABEL = { CATALOGUE: "Catalogue visits", VIEW: "Product views", AR: "AR opens", PART: "Part opens", FILL: "Fill", FIT: "Will it fit", FEATURE: "Feature opens", ROOM: "Room photo", HEADSET: "Headset", EMBED: "Embedded views" };
export const PLATFORM_LABEL = { ios: "iPhone / iPad", android: "Android", quest: "Meta Quest", visionos: "Vision Pro", desktop: "Desktop", other: "Other" };
export const ROLE_LABEL = { admin: "Admin", manager: "Manager", viewer: "Viewer" };
export const ACTION_LABEL = {
  login: "Signed in", login_failed: "Sign-in failed", password_set: "Password set", profile_created: "Account added",
  user_invited: "User invited", invite_cancelled: "Invite cancelled", user_approved: "User approved", user_deactivated: "User deactivated",
  user_reactivated: "User reactivated", role_changed: "Role changed", user_store_changed: "User’s store changed", user_updated: "User updated",
  store_created: "Store created", store_updated: "Store updated", store_deleted: "Store deleted",
  device_created: "Device created", device_updated: "Device updated", device_deleted: "Device deleted", device_paired: "Device paired", device_reset: "New pairing code",
};
const actionTone = (a) => (/failed|deleted|deactivated|cancelled/.test(a) ? "red" : /created|approved|reactivated|paired|invited|password_set/.test(a) ? "green" : a === "login" ? "blue" : "amber");
const catLabel = (value) => CATEGORIES.find(([v]) => v === value)?.[1] || value;
const storeName = (stores, id) => (id === null || id === undefined ? "—" : stores.find((s) => s.id === id)?.name || "—");
const keep = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };

// the catalogue itself: /products.json (on show and hidden)
let productsReq = null;
export async function loadProducts(force = false) {
  if (!productsReq || force) productsReq = fetch("/products.json", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(`products.json answered ${r.status}`); return r.json(); }).then((j) => j.products);
  try { return await productsReq; } catch (e) { productsReq = null; throw e; }
}
const productLabel = (products, id) => { const p = products?.find((x) => x.id === id); return p ? `${p.brand} ${p.shortName}` : id; };
const head = (title, text, tools = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ""}</div>${tools ? `<div class="tools">${tools}</div>` : ""}</div>`;
const readOnlyNote = (what) => `<div class="note">${icon("eye")}<div><b>Read-only for your role.</b> Only admins and managers can change ${esc(what)}.</div></div>`;

// ════════════════════════════════════════════════════════════════════════════ Dashboard
const RANGES = { "24h": ["Last 24 hours", 1, "hour"], "7d": ["Last 7 days", 7, "day"], "30d": ["Last 30 days", 30, "day"], "90d": ["Last 90 days", 90, "day"] };

export async function dashboard(ctx) {
  const { el, api, profile } = ctx;
  let range = RANGES[keep.get("s3d-dash-range")] ? keep.get("s3d-dash-range") : "7d";
  const first = (profile.full_name || profile.email || "").split(/[ @.]/)[0];
  el.innerHTML = `
    <div class="banner">${icon("shieldCheck")}<div><b>Welcome back${first ? `, ${esc(first[0].toUpperCase() + first.slice(1))}` : ""}!</b> Here’s how the 3D catalogue is being used, and the system’s health.</div></div>
    ${head("Dashboard", "", `<span class="stamp" id="stamp"></span><button class="btn" id="refresh">${icon("refresh")}Refresh</button>`)}
    <section class="section" aria-labelledby="h-snap"><div class="section-head"><div><h2 id="h-snap">System snapshot</h2><p>Current state</p></div></div><div class="stats" id="snap"><div class="loading">Loading…</div></div></section>
    <section class="section" aria-labelledby="h-dist"><div class="section-head"><div><h2 id="h-dist">Status distributions</h2><p>Current state breakdowns</p></div></div>
      <div class="grid3">
        <div class="card"><div class="card-head"><div><h3>${icon("clock")}Last sign-in</h3><p>When staff last signed in</p></div></div><div class="chart" id="cLogin"></div></div>
        <div class="card"><div class="card-head"><div><h3>${icon("shield")}Roles</h3><p id="roleSub">Active users by role</p></div></div><div class="chart" id="cRoles"></div></div>
        <div class="card"><div class="card-head"><div><h3>${icon("store")}Devices per store</h3><p>Top 5 stores by device count</p></div></div><div id="perStore"></div></div>
        <div class="card"><div class="card-head"><div><h3>${icon("box")}Products by category</h3><p>Products in the catalogue</p></div></div><div id="perCat"></div></div>
      </div></section>
    <section class="section" aria-labelledby="h-act"><div class="section-head"><div><h2 id="h-act">Activity trends</h2><p>Time-filtered activity</p></div>
        <label><span class="sr">Time range</span><select class="select" id="range">${Object.entries(RANGES).map(([k, [l]]) => `<option value="${k}" ${k === range ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <div class="card"><div class="card-head"><div><h3>${icon("activity")}Events by type</h3><p>What people did in the catalogue</p></div></div><div class="chart" id="cKinds"></div></div>
      <div class="grid3" style="margin-top:16px">
        <div class="card"><div class="card-head"><div><h3>${icon("eye")}Product views</h3><p id="viewsSub">Product pages opened</p></div></div><div class="chart" id="cViews"></div></div>
        <div class="card"><div class="card-head"><div><h3>${icon("login")}Successful sign-ins</h3><p>Staff sign-ins to this admin</p></div></div><div class="chart" id="cOk"></div></div>
        <div class="card"><div class="card-head"><div><h3>${icon("shield")}Failed sign-in attempts</h3><p>Wrong passwords and unknown emails</p></div></div><div class="chart" id="cBad"></div></div>
      </div></section>`;
  const $ = (id) => el.querySelector(`#${id}`);

  async function loadState() {
    const [snapR, prodR] = await Promise.allSettled([api.snapshot(), loadProducts(true)]);
    if (!ctx.alive()) return;
    const snap = snapR.status === "fulfilled" ? snapR.value : null;
    const prods = prodR.status === "fulfilled" ? prodR.value : null;
    const u = snap?.users, d = snap?.devices;
    const shown = prods?.filter((p) => !p.hidden).length, hidden = prods?.filter((p) => p.hidden).length;
    const healthy = !!snap && !!prods;
    const problems = [!snap && "database", !prods && "catalogue"].filter(Boolean);
    $("snap").innerHTML = [
      statCard({ title: "Total users", value: fmtNum(u?.total), ic: "users" }),
      statCard({ title: "Active users", value: fmtNum(u?.active), ic: "userCheck", tone: "green" }),
      statCard({ title: "Inactive users", value: fmtNum(u?.inactive), ic: "userX", tone: "red" }),
      statCard({ title: "Password pending", value: fmtNum(u?.password_pending), ic: "alert", tone: "amber", sub: "Still on the one-time password" }),
      statCard({ title: "Waiting approval", value: fmtNum(u?.pending), ic: "clock", tone: "amber", sub: "Signed in, not approved yet" }),
      statCard({ title: "Total devices", value: fmtNum(d?.total), ic: "devices" }),
      statCard({ title: "Paired devices", value: fmtNum(d?.paired), ic: "devices", tone: "green" }),
      statCard({ title: "Unpaired devices", value: fmtNum(d?.unpaired), ic: "devices", tone: "amber" }),
      statCard({ title: "Total products", value: fmtNum(prods?.length), ic: "box" }),
      statCard({ title: "On show", value: fmtNum(shown), ic: "box", tone: "green", sub: prods ? `${fmtPct(shown, prods.length)} of total` : "" }),
      statCard({ title: "Hidden", value: fmtNum(hidden), ic: "eyeOff", tone: "amber", sub: prods ? `${fmtPct(hidden, prods.length)} of total` : "" }),
      statCard({ title: "System health", value: healthy ? "Online" : "Degraded", ic: "shieldCheck", tone: healthy ? "green" : "red", sub: healthy ? "Database and catalogue reachable" : `Can’t reach the ${problems.join(" or the ")}` }),
    ].join("");
    if (!snap) $("snap").insertAdjacentHTML("afterbegin", `<div style="grid-column:1/-1">${errorBox(snapR.reason)}</div>`);
    // distributions
    const ll = snap?.last_login;
    if (ll) hbar($("cLogin"), ["Today", "This week", "This month", "Older", "Never"], [ll.today, ll.week, ll.month, ll.older, ll.never], [COLORS.green, COLORS.blue, COLORS.amber, COLORS.red, COLORS.grey], "Users");
    else $("cLogin").innerHTML = emptyState("No data", "The database didn’t answer.");
    const roles = snap?.roles;
    if (roles) {
      const total = (roles.admin || 0) + (roles.manager || 0) + (roles.viewer || 0);
      $("roleSub").textContent = `${total} active ${total === 1 ? "user" : "users"} across ${["admin", "manager", "viewer"].filter((k) => roles[k]).length} roles`;
      hbar($("cRoles"), ["Admin", "Manager", "Viewer"], [roles.admin || 0, roles.manager || 0, roles.viewer || 0], COLORS.orange, "Users");
    } else $("cRoles").innerHTML = emptyState("No data", "The database didn’t answer.");
    $("perStore").innerHTML = snap ? (snap.devices_per_store?.length ? barList(snap.devices_per_store.map((x) => ({ label: x.store, n: x.n })), "blue") : emptyState("No devices yet", "Add one on the Devices page.")) : emptyState("No data", "The database didn’t answer.");
    if (prods) {
      const cats = [...new Set([...CATEGORIES.map(([v]) => v), ...prods.map((p) => p.category)])];
      $("perCat").innerHTML = barList(cats.map((c) => ({ label: catLabel(c), n: prods.filter((p) => p.category === c).length })).sort((a, b) => b.n - a.n).slice(0, 5), "purple");
    } else $("perCat").innerHTML = errorBox(prodR.reason);
  }

  async function loadActivity() {
    const [, days, bucket] = RANGES[range];
    const to = new Date(), from = new Date(to.getTime() - days * 864e5);
    let a;
    try { a = await api.activity(from.toISOString(), to.toISOString(), bucket); }
    catch (e) { if (ctx.alive()) for (const id of ["cKinds", "cViews", "cOk", "cBad"]) $(id).innerHTML = errorBox(e); return; }
    if (!ctx.alive()) return;
    const kinds = Object.keys(KIND_LABEL);
    const counts = kinds.map((k) => a.events_by_kind?.[k] || 0);
    if (counts.some(Boolean)) vbar($("cKinds"), kinds.map((k) => KIND_LABEL[k]), counts, COLORS.orange, "Events");
    else $("cKinds").innerHTML = emptyState("No catalogue activity yet", "Events appear here as people use the catalogue.");
    const labels = a.series.map((s) => slotLabel(s.t));
    $("viewsSub").textContent = `Product pages opened, per ${bucket}`;
    const sumOf = (k) => a.series.reduce((n, s) => n + s[k], 0);
    if (sumOf("views")) lines($("cViews"), labels, [{ label: "Views", data: a.series.map((s) => s.views), color: COLORS.orange }]);
    else $("cViews").innerHTML = emptyState("No product views", "No product pages were opened in this period.");
    if (sumOf("logins")) lines($("cOk"), labels, [{ label: "Sign-ins", data: a.series.map((s) => s.logins), color: COLORS.green }]);
    else $("cOk").innerHTML = emptyState("No sign-ins", "No one signed in during this period.");
    if (sumOf("failed")) lines($("cBad"), labels, [{ label: "Failed", data: a.series.map((s) => s.failed), color: COLORS.red }]);
    else $("cBad").innerHTML = emptyState("No failed sign-ins", "No failed sign-in attempts in this period.", true);
  }

  async function refresh() {
    $("refresh").disabled = true;
    await Promise.all([loadState(), loadActivity()]);
    if (!ctx.alive()) return;
    $("refresh").disabled = false;
    $("stamp").textContent = `Updated ${new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())}`;
  }
  $("refresh").addEventListener("click", refresh);
  $("range").addEventListener("change", (e) => { range = e.target.value; keep.set("s3d-dash-range", range); loadActivity(); });
  await refresh();
}

// ════════════════════════════════════════════════════════════════════════════ Analytics
export async function analytics(ctx) {
  const { el, api } = ctx;
  const today = istDay();
  const f = { from: addDays(today, -29), to: today, store: "", platform: "" };
  let stores = [];
  try { stores = await api.stores.list(); } catch {}
  if (!ctx.alive()) return;
  el.innerHTML = `
    ${head("Analytics", "What shoppers and staff do with each product: views, AR, doors, Fill, Will it fit and features. Counted by the catalogue itself; no personal data.", `<button class="btn" id="csv">${icon("download")}Export CSV</button>`)}
    <div class="toolbar" role="group" aria-label="Filters">
      <label class="inline">From <input class="input" type="date" id="from" value="${f.from}" max="${today}"></label>
      <label class="inline">To <input class="input" type="date" id="to" value="${f.to}" max="${today}"></label>
      <div class="chips">${[[7, "7 days"], [30, "30 days"], [90, "90 days"]].map(([n, l]) => `<button class="btn sm" data-days="${n}" aria-pressed="${n === 30}">${l}</button>`).join("")}</div>
      <label><span class="sr">Store</span><select class="select" id="store"><option value="">All stores</option><option value="0">No store (not paired)</option>${stores.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></label>
      <label><span class="sr">Platform</span><select class="select" id="platform"><option value="">All platforms</option>${Object.entries(PLATFORM_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
    </div>
    <div id="out"><div class="loading">Loading…</div></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  let data = null, products = [];

  const num = (v) => `<td class="n">${fmtNum(v)}</td>`;
  const rate = (r) => `<td class="n">${r.views ? fmtPct(r.ar, r.views, 1) : "—"}</td>`;

  function table(id, title, sub, firstCol, rows, extra = []) {
    const headCells = `<th>${esc(firstCol)}</th><th class="n">Views</th><th class="n">AR opens</th><th class="n">AR rate</th><th class="n">Part opens</th><th class="n">Fill</th><th class="n">Will it fit</th><th class="n">Feature opens</th>${extra.map(([, l]) => `<th class="n">${esc(l)}</th>`).join("")}`;
    const body = rows.length ? rows.map((r) => `<tr><td>${r.__label}</td>${num(r.views)}${num(r.ar)}${rate(r)}${num(r.part)}${num(r.fill)}${num(r.fit)}${num(r.feature)}${extra.map(([k]) => num(r[k])).join("")}</tr>`).join("") : `<tr><td colspan="${8 + extra.length}" class="muted">No events in this period.</td></tr>`;
    return `<section class="section" aria-labelledby="h-${id}"><div class="section-head"><div><h2 id="h-${id}">${esc(title)}</h2><p>${esc(sub)}</p></div><button class="btn sm" data-csv="${id}">${icon("download")}CSV</button></div>
      <div class="table-wrap"><table class="t"><thead><tr>${headCells}</tr></thead><tbody>${body}</tbody></table></div></section>`;
  }

  async function load() {
    $("out").innerHTML = `<div class="loading">Loading…</div>`;
    if (f.from > f.to) { $("out").innerHTML = errorBox(new Error("The start date is after the end date.")); return; }
    try {
      [data, products] = await Promise.all([api.analytics(istStart(f.from).toISOString(), istStart(addDays(f.to, 1)).toISOString(), f.store, f.platform), loadProducts().catch(() => [])]);
    } catch (e) { if (ctx.alive()) $("out").innerHTML = errorBox(e); return; }
    if (!ctx.alive()) return;
    const t = data.totals || {};
    data.products.forEach((r) => { const p = products.find((x) => x.id === r.product); r.__label = p ? `<div class="cell-main"><img src="${esc(p.thumb)}" alt="" loading="lazy"><div><b>${esc(p.brand)} ${esc(p.shortName)}</b><span>${esc(p.model)}</span></div></div>` : esc(r.product); r.__name = productLabel(products, r.product); r.__model = p?.model || ""; });
    data.stores.forEach((r) => { r.__label = esc(r.store); });
    data.platforms.forEach((r) => { r.__label = esc(PLATFORM_LABEL[r.platform] || r.platform); });
    const arKinds = Object.entries(data.ar_by_kind || {}).sort((a, b) => b[1] - a[1]);
    $("out").innerHTML = `
      <div class="stats">
        ${statCard({ title: "Catalogue visits", value: fmtNum(t.catalogue), ic: "grid" })}
        ${statCard({ title: "Product views", value: fmtNum(t.views), ic: "eye", tone: "orange" })}
        ${statCard({ title: "AR opens", value: fmtNum(t.ar), ic: "cube", tone: "blue", sub: t.views ? `${fmtPct(t.ar, t.views, 1)} of views` : "" })}
        ${statCard({ title: "Part opens", value: fmtNum(t.part), ic: "door" })}
        ${statCard({ title: "Fill", value: fmtNum(t.fill), ic: "box" })}
        ${statCard({ title: "Will it fit", value: fmtNum(t.fit), ic: "check" })}
        ${statCard({ title: "Feature opens", value: fmtNum(t.feature), ic: "info" })}
        ${statCard({ title: "Sessions", value: fmtNum(t.sessions), ic: "users", sub: "Browser tabs that sent an event" })}
      </div>
      <div class="grid2" style="margin-top:16px">
        <div class="card"><div class="card-head"><div><h3>${icon("activity")}Views and AR opens per day</h3><p>${esc(fmtDate(istStart(f.from)))} to ${esc(fmtDate(istStart(f.to)))}</p></div></div><div class="chart" id="cDays"></div></div>
        <div class="card"><div class="card-head"><div><h3>${icon("cube")}AR opens by device</h3><p>Which AR each tap opened</p></div></div><div id="arKinds"></div></div>
      </div>
      <div style="display:grid;gap:16px;margin-top:16px">
        ${table("products", "By product", "Every product that had at least one event", "Product", data.products, [["room", "Room photo"], ["headset", "Headset"], ["embed", "Embedded"]])}
        ${table("stores", "By store", "Events from paired shop devices count for their store", "Store", data.stores)}
        ${table("platforms", "By platform", "From the browser’s own description; no personal data", "Platform", data.platforms)}
      </div>`;
    if (data.days.some((d) => d.views || d.ar)) lines($("cDays"), data.days.map((d) => slotLabel(d.t)), [{ label: "Views", data: data.days.map((d) => d.views), color: COLORS.orange }, { label: "AR opens", data: data.days.map((d) => d.ar), color: COLORS.blue }]);
    else $("cDays").innerHTML = emptyState("No views in this period", "Try a longer date range.");
    $("arKinds").innerHTML = arKinds.length ? barList(arKinds.map(([k, n]) => ({ label: { ios: "iPhone / iPad (Quick Look)", android: "Android (Scene Viewer / WebXR)", quest: "Meta Quest (passthrough)", visionos: "Vision Pro (Quick Look)" }[k] || k, n })), "blue") : emptyState("No AR opens", "No one opened AR in this period.");
    el.querySelectorAll("[data-csv]").forEach((b) => b.addEventListener("click", () => exportCsv(b.dataset.csv)));
  }

  function exportCsv(which) {
    if (!data) return;
    const base = [["views", "Views"], ["ar", "AR opens"], [(r) => (r.views ? ((100 * r.ar) / r.views).toFixed(1) : ""), "AR rate (%)"], ["part", "Part opens"], ["fill", "Fill"], ["fit", "Will it fit"], ["feature", "Feature opens"]];
    const name = `catalogue-${which}-${f.from}-to-${f.to}.csv`;
    if (which === "products") downloadCsv(name, [["product", "Product id"], ["__name", "Product"], ["__model", "Model"], ...base, ["room", "Room photo"], ["headset", "Headset"], ["embed", "Embedded"], ["sessions", "Sessions"]], data.products);
    if (which === "stores") downloadCsv(name, [["store", "Store"], ...base, ["sessions", "Sessions"]], data.stores);
    if (which === "platforms") downloadCsv(name, [[(r) => PLATFORM_LABEL[r.platform] || r.platform, "Platform"], ...base, ["sessions", "Sessions"]], data.platforms);
    toast("CSV downloaded.");
  }
  $("csv").addEventListener("click", () => exportCsv("products"));
  const set = () => { f.from = $("from").value || f.from; f.to = $("to").value || f.to; f.store = $("store").value; f.platform = $("platform").value; el.querySelectorAll("[data-days]").forEach((b) => b.setAttribute("aria-pressed", String(f.to === today && addDays(today, 1 - +b.dataset.days) === f.from))); load(); };
  for (const id of ["from", "to", "store", "platform"]) $(id).addEventListener("change", set);
  el.querySelectorAll("[data-days]").forEach((b) => b.addEventListener("click", () => { $("to").value = today; $("from").value = addDays(today, 1 - +b.dataset.days); set(); }));
  await load();
}

// ════════════════════════════════════════════════════════════════════════════ Products
const sizes = new Map();
function headSize(url) {
  if (!sizes.has(url)) sizes.set(url, fetch(url, { method: "HEAD", cache: "no-store" }).then((r) => (r.ok ? Number(r.headers.get("content-length")) || null : "missing")).catch(() => "missing"));
  return sizes.get(url);
}
const sizeText = (v) => (v === "missing" ? `<span class="err">Missing</span>` : fmtBytes(v));

export async function products(ctx) {
  const { el } = ctx;
  let list;
  try { list = await loadProducts(true); } catch (e) { el.innerHTML = head("Products", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  let filter = "all", q = "";
  el.innerHTML = `
    ${head("Products", "Every product in the catalogue (/products.json), with its files and the link to give the store app.")}
    <div class="note">${icon("info")}<div><b>Status is read-only here.</b> A product goes on show or is hidden through the build check (the product gate), which tests its 3D and AR files before it is published.</div></div>
    <div class="toolbar">
      <input class="input search" type="search" id="q" placeholder="Search name or model" aria-label="Search products">
      <div class="chips" role="group" aria-label="Status">${[["all", "All"], ["shown", "On show"], ["hidden", "Hidden"]].map(([k, l]) => `<button class="btn sm" data-f="${k}" aria-pressed="${k === "all"}">${l} <span class="dim">${k === "all" ? list.length : list.filter((p) => !p.hidden === (k === "shown")).length}</span></button>`).join("")}</div>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Product</th><th>Category</th><th>Status</th><th class="n">3D model</th><th>iPhone AR files</th><th class="n">Actions</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  const link = (p) => `${siteOrigin()}/p/${p.id}`;
  function render() {
    const n = q.toLowerCase().replace(/[^a-z0-9]/g, "");
    const rows = list.filter((p) => (filter === "all" || !p.hidden === (filter === "shown")) && (!n || `${p.brand}${p.name}${p.model}${p.id}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(n)));
    $("rows").innerHTML = rows.length ? rows.map((p) => `<tr data-id="${esc(p.id)}">
        <td><div class="cell-main"><img src="${esc(p.thumb)}" alt="" loading="lazy"><div><b>${esc(p.brand)} ${esc(p.shortName)}</b><span>${esc(p.model)}</span></div></div></td>
        <td>${esc(catLabel(p.category))}</td>
        <td>${p.hidden ? badge("Hidden", "amber") : badge("On show", "green")}</td>
        <td class="n" data-size="${esc(p.glb)}">…</td>
        <td>${(p.finishes || []).map((f) => `<div><span class="muted">${esc(f.name)}:</span> <span data-size="${esc(f.usdz)}">…</span></div>`).join("")}</td>
        <td><div class="actions">
          <a class="btn sm" href="/p/${esc(p.id)}" target="_blank" rel="noopener" ${p.hidden ? `aria-disabled="true" tabindex="-1" style="pointer-events:none;opacity:.45" title="Hidden products aren’t on the site"` : ""}>${icon("external")}Open</a>
          <button class="btn sm" data-copy ${p.hidden ? "disabled title=\"Hidden products aren’t on the site\"" : ""}>${icon("link")}Copy store-app link</button>
          <button class="btn sm icon" data-qr aria-label="QR code for ${esc(p.brand)} ${esc(p.shortName)}" ${p.hidden ? "disabled" : ""}>${icon("qr")}</button>
        </div></td></tr>`).join("") : `<tr><td colspan="6" class="muted">No product matches.</td></tr>`;
    $("rows").querySelectorAll("[data-size]").forEach(async (c) => { const v = await headSize(c.dataset.size); c.innerHTML = sizeText(v); });
  }
  $("rows").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    const p = tr && list.find((x) => x.id === tr.dataset.id);
    if (!p) return;
    if (e.target.closest("[data-copy]")) copyText(link(p), "Store-app link copied.");
    if (e.target.closest("[data-qr]")) qrModal({ title: `${p.brand} ${p.shortName}`, sub: `Model ${p.model}. Scan to open it in 3D and AR.`, url: link(p), file: `qr-${p.id}` });
  });
  $("q").addEventListener("input", (e) => { q = e.target.value; render(); });
  el.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.f; el.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render(); }));
  render();
}

// ════════════════════════════════════════════════════════════════════════════ Categories
export async function categories(ctx) {
  const { el } = ctx;
  let list;
  try { list = await loadProducts(); } catch (e) { el.innerHTML = head("Categories", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  const cats = [...new Set([...CATEGORIES.map(([v]) => v), ...list.map((p) => p.category)])].map((c) => {
    const ps = list.filter((p) => p.category === c);
    return { c, label: catLabel(c), total: ps.length, shown: ps.filter((p) => !p.hidden).length, hidden: ps.filter((p) => p.hidden).length };
  });
  el.innerHTML = `
    ${head("Categories", "The catalogue’s categories, from site.js and /products.json. The catalogue’s filter chips use the same list.")}
    <div class="stats">${cats.map((x) => statCard({ title: x.label, value: fmtNum(x.total), ic: "grid", sub: `${x.shown} on show · ${x.hidden} hidden` })).join("")}</div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Category</th><th class="n">Products</th><th class="n">On show</th><th class="n">Hidden</th><th>Share on show</th></tr></thead><tbody>
      ${cats.map((x) => `<tr><td>${esc(x.label)}</td><td class="n">${x.total}</td><td class="n">${x.shown}</td><td class="n">${x.hidden}</td><td style="min-width:180px"><div class="track green"><i style="width:${x.total ? (100 * x.shown) / x.total : 0}%"></i></div></td></tr>`).join("")}
    </tbody><tfoot><tr><td>All</td><td class="n">${list.length}</td><td class="n">${list.filter((p) => !p.hidden).length}</td><td class="n">${list.filter((p) => p.hidden).length}</td><td></td></tr></tfoot></table></div>
    <div class="note">${icon("info")}<div><b>Adding a category</b> is a change to site.js and the product pipeline (pipeline/entries/STANDARD.md), so it is made there, not here.</div></div>`;
}

// ════════════════════════════════════════════════════════════════════════════ Stores
export async function storesPage(ctx) {
  const { el, api, can } = ctx;
  let stores, devices;
  const loadAll = async () => { [stores, devices] = await Promise.all([api.stores.list(), api.devices.list()]); };
  try { await loadAll(); } catch (e) { el.innerHTML = head("Stores", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  el.innerHTML = `
    ${head("Stores", "Sangeetha’s stores. Devices are linked to a store, and their usage counts for it.", can.write ? `<button class="btn primary" id="add">${icon("plus")}Add store</button>` : "")}
    ${can.write ? "" : readOnlyNote("stores")}
    <div class="toolbar"><input class="input search" type="search" id="q" placeholder="Search stores" aria-label="Search stores"></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Store</th><th>Code</th><th>City</th><th>Address</th><th class="n">Devices</th><th>Updated</th>${can.write ? `<th class="n">Actions</th>` : ""}</tr></thead><tbody id="rows"></tbody></table></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  let q = "";
  function render() {
    const rows = stores.filter((s) => !q || `${s.name} ${s.code || ""} ${s.city || ""}`.toLowerCase().includes(q.toLowerCase()));
    $("rows").innerHTML = rows.length ? rows.map((s) => `<tr data-id="${s.id}">
      <td><b style="font-weight:500">${esc(s.name)}</b></td><td class="mono">${esc(s.code || "—")}</td><td>${esc(s.city || "—")}</td><td class="wrap muted">${esc(s.address || "—")}</td>
      <td class="n">${devices.filter((d) => d.store_id === s.id).length}</td><td class="muted">${fmtDate(s.updated_at)}</td>
      ${can.write ? `<td><div class="actions"><button class="btn sm" data-edit>${icon("edit")}Edit</button><button class="btn sm danger icon" data-del aria-label="Delete ${esc(s.name)}">${icon("trash")}</button></div></td>` : ""}</tr>`).join("")
      : `<tr><td colspan="7">${emptyState(stores.length ? "No store matches" : "No stores yet", stores.length ? "" : can.write ? "Add the first one with “Add store”." : "An admin or manager adds them.")}</td></tr>`;
  }
  const fields = (s = {}) => [
    { name: "name", label: "Store name", value: s.name, required: true },
    { name: "code", label: "Store code", value: s.code, max: 40, help: "Optional: the store’s own code" },
    { name: "city", label: "City", value: s.city, max: 80 },
    { name: "address", label: "Address", value: s.address, type: "textarea", max: 300 },
  ];
  const reload = async () => { await loadAll(); if (ctx.alive()) render(); };
  $("add")?.addEventListener("click", () => formModal({ title: "Add store", fields: fields(), submit: "Add store", onSubmit: async (v, d) => { await api.stores.create(v); d.close(); toast("Store added."); await reload(); } }));
  $("rows").addEventListener("click", async (e) => {
    const s = stores.find((x) => x.id === Number(e.target.closest("tr[data-id]")?.dataset.id));
    if (!s) return;
    if (e.target.closest("[data-edit]")) formModal({ title: "Edit store", fields: fields(s), onSubmit: async (v, d) => { await api.stores.update(s.id, v); d.close(); toast("Store saved."); await reload(); } });
    if (e.target.closest("[data-del]")) {
      const n = devices.filter((d) => d.store_id === s.id).length;
      if (!(await confirmBox({ title: `Delete ${s.name}?`, text: n ? `Its ${n} ${n === 1 ? "device stays but has" : "devices stay but have"} no store, and staff linked to it lose their store. Past usage stays in the analytics, without a store.` : "Past usage stays in the analytics, without a store.", ok: "Delete store", danger: true }))) return;
      try { await api.stores.remove(s.id); toast("Store deleted."); await reload(); } catch (err) { toast(err.message, true); }
    }
  });
  $("q").addEventListener("input", (e) => { q = e.target.value; render(); });
  render();
}

// ════════════════════════════════════════════════════════════════════════════ Devices
export async function devicesPage(ctx) {
  const { el, api, can } = ctx;
  let stores, devices;
  const loadAll = async () => { [stores, devices] = await Promise.all([api.stores.list(), api.devices.list()]); };
  try { await loadAll(); } catch (e) { el.innerHTML = head("Devices", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  el.innerHTML = `
    ${head("Devices", "The phones, tablets and headsets in the stores. Pair one by opening its pairing link on it, once; after that its usage counts for its store.", can.write ? `<button class="btn primary" id="add">${icon("plus")}Add device</button>` : "")}
    ${can.write ? "" : readOnlyNote("devices")}
    <div class="toolbar">
      <input class="input search" type="search" id="q" placeholder="Search devices" aria-label="Search devices">
      <label><span class="sr">Store</span><select class="select" id="fs"><option value="">All stores</option>${stores.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}<option value="none">No store</option></select></label>
      <div class="chips" role="group" aria-label="Status">${[["all", "All"], ["paired", "Paired"], ["unpaired", "Unpaired"]].map(([k, l]) => `<button class="btn sm" data-f="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("")}</div>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Device</th><th>Store</th><th>Status</th><th>Platform</th><th>Last seen</th><th>Pairing code</th><th class="n">Actions</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  let q = "", fstore = "", fstatus = "all";
  const pairUrl = (d) => `${siteOrigin()}/?pair=${d.pair_code}`;
  function render() {
    const rows = devices.filter((d) => (!q || `${d.name} ${d.notes || ""}`.toLowerCase().includes(q.toLowerCase())) && (!fstore || (fstore === "none" ? !d.store_id : d.store_id === Number(fstore))) && (fstatus === "all" || !!d.paired_at === (fstatus === "paired")));
    $("rows").innerHTML = rows.length ? rows.map((d) => `<tr data-id="${d.id}">
      <td><div class="cell-main"><div><b>${esc(d.name)}</b>${d.notes ? `<span>${esc(d.notes)}</span>` : ""}</div></div></td>
      <td>${esc(storeName(stores, d.store_id))}</td>
      <td>${d.paired_at ? badge("Paired", "green") : badge("Unpaired", "amber")}${d.paired_at ? `<div class="dim" style="font-size:12.5px;margin-top:3px">${fmtDate(d.paired_at)}</div>` : ""}</td>
      <td>${d.platform ? esc(PLATFORM_LABEL[d.platform] || d.platform) : "—"}</td>
      <td title="${esc(fmtDateTime(d.last_seen_at))}">${esc(fmtAgo(d.last_seen_at))}</td>
      <td class="mono">${d.paired_at ? `<span class="dim">Used</span>` : can.write ? esc(d.pair_code) : "••••••••"}</td>
      <td><div class="actions">
        ${can.write ? `${d.paired_at ? "" : `<button class="btn sm" data-pair>${icon("qr")}Pairing link</button>`}
        <button class="btn sm" data-reset title="A new code; the old link and pairing stop working">${icon("refresh")}New code</button>
        <button class="btn sm icon" data-edit aria-label="Edit ${esc(d.name)}">${icon("edit")}</button>
        <button class="btn sm danger icon" data-del aria-label="Delete ${esc(d.name)}">${icon("trash")}</button>` : `<span class="dim">—</span>`}
      </div></td></tr>`).join("")
      : `<tr><td colspan="7">${emptyState(devices.length ? "No device matches" : "No devices yet", devices.length ? "" : can.write ? "Add one, then open its pairing link on it." : "An admin or manager adds them.")}</td></tr>`;
  }
  const showPair = (d) => qrModal({ title: `Pair ${d.name}`, sub: `Open this link once on the device itself (scan the code with its camera). It then counts for ${storeName(stores, d.store_id) === "—" ? "no store" : storeName(stores, d.store_id)}.`, url: pairUrl(d), file: `pair-${d.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}` });
  const fields = (d = {}) => [
    { name: "name", label: "Device name", value: d.name, required: true, help: "For example: Front counter tablet" },
    { name: "store_id", label: "Store", type: "select", value: d.store_id ?? "", options: [["", "No store"], ...stores.map((s) => [s.id, s.name])] },
    { name: "notes", label: "Notes", value: d.notes, type: "textarea", max: 300 },
  ];
  const reload = async () => { await loadAll(); if (ctx.alive()) render(); };
  $("add")?.addEventListener("click", () => formModal({ title: "Add device", fields: fields(), submit: "Add device", onSubmit: async (v, dlg) => { const d = await api.devices.create({ ...v, store_id: v.store_id ? Number(v.store_id) : null }); dlg.close(); toast("Device added."); await reload(); showPair(d); } }));
  $("rows").addEventListener("click", async (e) => {
    const d = devices.find((x) => x.id === Number(e.target.closest("tr[data-id]")?.dataset.id));
    if (!d) return;
    if (e.target.closest("[data-pair]")) showPair(d);
    if (e.target.closest("[data-edit]")) formModal({ title: "Edit device", fields: fields(d), onSubmit: async (v, dlg) => { await api.devices.update(d.id, { ...v, store_id: v.store_id ? Number(v.store_id) : null }); dlg.close(); toast("Device saved."); await reload(); } });
    if (e.target.closest("[data-reset]")) {
      if (!(await confirmBox({ title: `New pairing code for ${d.name}?`, text: d.paired_at ? "The device is unpaired: its usage stops counting for the store until it opens the new pairing link." : "The old pairing link stops working.", ok: "Make a new code" }))) return;
      try { const r = await api.devices.reset(d.id); await reload(); const nd = devices.find((x) => x.id === d.id) || { ...d, pair_code: r.pair_code, paired_at: null }; showPair(nd); } catch (err) { toast(err.message, true); }
    }
    if (e.target.closest("[data-del]")) {
      if (!(await confirmBox({ title: `Delete ${d.name}?`, text: "Its usage stays in the analytics, still counted for its store.", ok: "Delete device", danger: true }))) return;
      try { await api.devices.remove(d.id); toast("Device deleted."); await reload(); } catch (err) { toast(err.message, true); }
    }
  });
  $("q").addEventListener("input", (e) => { q = e.target.value; render(); });
  $("fs").addEventListener("change", (e) => { fstore = e.target.value; render(); });
  el.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { fstatus = b.dataset.f; el.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render(); }));
  render();
}

// ════════════════════════════════════════════════════════════════════════════ Users
export async function usersPage(ctx) {
  const { el, api, profile } = ctx;
  let users, invites, stores;
  const loadAll = async () => { [users, invites, stores] = await Promise.all([api.users.list(), api.invites.list(), api.stores.list()]); };
  try { await loadAll(); } catch (e) { el.innerHTML = head("Users", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  el.innerHTML = `
    ${head("Users", "Staff who can sign in to this admin. Invite someone with a role and store; anyone else who signs in waits for approval.", `<button class="btn primary" id="invite">${icon("userPlus")}Invite user</button>`)}
    <div class="toolbar">
      <input class="input search" type="search" id="q" placeholder="Search email or name" aria-label="Search users">
      <div class="chips" role="group" aria-label="Status">${[["all", "All"], ["active", "Active"], ["pending", "Waiting approval"], ["inactive", "Inactive"]].map(([k, l]) => `<button class="btn sm" data-f="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("")}</div>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>User</th><th>Role</th><th>Store</th><th>Status</th><th>Password</th><th>Last sign-in</th><th class="n">Actions</th></tr></thead><tbody id="rows"></tbody></table></div>
    <section class="section" aria-labelledby="h-inv"><div class="section-head"><div><h2 id="h-inv">Open invites</h2><p>Invited, not signed in yet</p></div></div><div id="inv"></div></section>`;
  const $ = (id) => el.querySelector(`#${id}`);
  let q = "", f = "all";
  const statusBadge = (u) => (u.status === "active" ? badge("Active", "green") : u.status === "pending" ? badge("Waiting approval", "amber") : badge("Inactive", "red"));
  function render() {
    const rows = users.filter((u) => (f === "all" || u.status === f) && (!q || `${u.email} ${u.full_name || ""}`.toLowerCase().includes(q.toLowerCase())));
    $("rows").innerHTML = rows.length ? rows.map((u) => {
      const me = u.user_id === profile.user_id;
      return `<tr data-id="${esc(u.user_id)}">
        <td><div class="cell-main"><div class="avatar">${esc((u.full_name || u.email)[0].toUpperCase())}</div><div><b>${esc(u.full_name || u.email.split("@")[0])}${me ? ` <i class="dim" style="font-style:normal;font-weight:400">(you)</i>` : ""}</b><span>${esc(u.email)}</span></div></div></td>
        <td>${badge(ROLE_LABEL[u.role] || u.role, u.role === "admin" ? "orange" : u.role === "manager" ? "blue" : "", true)}</td>
        <td>${esc(storeName(stores, u.store_id))}</td>
        <td>${statusBadge(u)}</td>
        <td>${u.password_set ? `<span class="muted">Set</span>` : `<span title="Still on the one-time password">${badge("Pending", "amber")}</span>`}</td>
        <td title="${esc(fmtDateTime(u.last_login_at))}">${esc(fmtAgo(u.last_login_at))}</td>
        <td><div class="actions">
          ${u.status === "pending" ? `<button class="btn sm primary" data-act="approve">${icon("check")}Approve</button><button class="btn sm danger" data-act="reject">Reject</button>` : ""}
          ${u.status === "inactive" ? `<button class="btn sm" data-act="reactivate">Reactivate</button>` : ""}
          ${u.status === "active" && !me ? `<button class="btn sm danger" data-act="deactivate">Deactivate</button>` : ""}
          <button class="btn sm icon" data-act="edit" aria-label="Edit ${esc(u.email)}">${icon("edit")}</button>
        </div></td></tr>`;
    }).join("") : `<tr><td colspan="7" class="muted">No user matches.</td></tr>`;
    $("inv").innerHTML = invites.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Email</th><th>Role</th><th>Store</th><th>Invited</th><th class="n">Actions</th></tr></thead><tbody>
      ${invites.map((i) => `<tr data-inv="${i.id}"><td>${esc(i.email)}</td><td>${esc(ROLE_LABEL[i.role] || i.role)}</td><td>${esc(storeName(stores, i.store_id))}</td><td class="muted">${fmtDate(i.created_at)}</td><td><div class="actions"><button class="btn sm danger" data-cancel>Cancel invite</button></div></td></tr>`).join("")}
      </tbody></table></div>` : emptyState("No open invites", "Everyone invited has signed in.");
  }
  const reload = async () => { await loadAll(); if (ctx.alive()) render(); };
  const update = async (u, patch, done) => { try { await api.users.update(u.user_id, patch); toast(done); await reload(); } catch (err) { toast(err.message, true); } };
  const roleOpts = Object.entries(ROLE_LABEL);
  const storeOpts = () => [["", "No store"], ...stores.map((s) => [s.id, s.name])];
  $("rows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    const u = b && users.find((x) => x.user_id === b.closest("tr").dataset.id);
    if (!u) return;
    const act = b.dataset.act;
    if (act === "approve") update(u, { status: "active" }, `${u.email} approved.`);
    if (act === "reactivate") update(u, { status: "active" }, `${u.email} can sign in again.`);
    if (act === "reject" || act === "deactivate") {
      if (await confirmBox({ title: `${act === "reject" ? "Reject" : "Deactivate"} ${u.email}?`, text: "They can still sign in to Supabase, but this admin shows them nothing until an admin reactivates them.", ok: act === "reject" ? "Reject" : "Deactivate", danger: true })) update(u, { status: "inactive" }, `${u.email} deactivated.`);
    }
    if (act === "edit") formModal({
      title: `Edit ${u.email}`,
      fields: [
        { name: "full_name", label: "Name", value: u.full_name },
        { name: "role", label: "Role", type: "select", value: u.role, options: roleOpts, help: "Admin: everything. Manager: stores, devices and analytics. Viewer: read-only." },
        { name: "store_id", label: "Store", type: "select", value: u.store_id ?? "", options: storeOpts() },
      ],
      onSubmit: async (v, d) => { await api.users.update(u.user_id, { full_name: v.full_name || null, role: v.role, store_id: v.store_id ? Number(v.store_id) : null }); d.close(); toast("User saved."); await reload(); },
    });
  });
  $("inv").addEventListener("click", async (e) => {
    const id = Number(e.target.closest("[data-inv]")?.dataset.inv);
    const inv = invites.find((i) => i.id === id);
    if (!inv || !e.target.closest("[data-cancel]")) return;
    if (!(await confirmBox({ title: `Cancel the invite for ${inv.email}?`, text: "If they sign in later, they wait for approval instead.", ok: "Cancel invite", danger: true }))) return;
    try { await api.invites.remove(id); toast("Invite cancelled."); await reload(); } catch (err) { toast(err.message, true); }
  });
  $("invite").addEventListener("click", () => formModal({
    title: "Invite user", sub: "They get an email from Supabase to confirm the address, then sign in at /admin and set their own password.",
    fields: [
      { name: "email", label: "Email", type: "email", required: true, max: 254, auto: "off" },
      { name: "role", label: "Role", type: "select", value: "viewer", options: roleOpts },
      { name: "store_id", label: "Store", type: "select", value: "", options: storeOpts() },
    ],
    submit: "Send invite",
    onSubmit: async (v, d) => {
      const r = await api.invites.create(v);
      d.close();
      await reload();
      const where = `${siteOrigin()}/admin`;
      modal({
        title: r.existing ? "Invite saved" : "Invite sent",
        body: r.existing
          ? `<div class="msg warn">${esc(v.email)} already has an account on this Supabase project (another app may use it). No new password was made: they sign in at <b>${esc(where)}</b> with their own password (or “Forgot password?”), and get the ${esc(ROLE_LABEL[v.role])} role then.</div>`
          : `<p class="muted" style="margin:0">Give this one-time password to ${esc(v.email)}. It is shown only now.</p>
             <div class="secret" id="otp">${esc(r.password)}</div>
             <button class="btn" id="copyOtp">${icon("copy")}Copy password</button>
             <div class="msg">Tell them: 1. open the confirmation email from Supabase and tap its link; 2. sign in at <b>${esc(where)}</b> with this password; 3. choose their own password. Until then they count as “Password pending”.</div>`,
        foot: `<button class="btn primary" data-close>Done</button>`,
      }).querySelector("#copyOtp")?.addEventListener("click", () => copyText(r.password, "Password copied."));
    },
  }));
  $("q").addEventListener("input", (e) => { q = e.target.value; render(); });
  el.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { f = b.dataset.f; el.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render(); }));
  render();
}

// ════════════════════════════════════════════════════════════════════════════ Roles
export async function rolesPage(ctx) {
  const { el, api } = ctx;
  let counts = null;
  try { counts = (await api.snapshot()).roles; } catch {}
  if (!ctx.alive()) return;
  const roles = [
    ["admin", "orange", "Everything: users, invites, roles, the audit log, stores, devices and analytics."],
    ["manager", "blue", "Runs the stores: adds, edits and deletes stores and devices, pairs devices, and reads the analytics."],
    ["viewer", "", "Read-only: the dashboard, analytics, products, categories, stores and devices."],
  ];
  const Y = `<td class="yes">${icon("check")}</td>`, N = `<td class="no">—</td>`, R = `<td class="part">View</td>`;
  const rows = [
    ["Dashboard and analytics", Y, Y, Y], ["Products and categories (read-only for everyone)", R, R, R],
    ["Stores: add, edit, delete", Y, Y, R], ["Devices: add, edit, delete, pair", Y, Y, R],
    ["Users: invite, approve, deactivate, change role or store", Y, N, N], ["Roles", R, R, R], ["Audit log", Y, N, N],
  ];
  el.innerHTML = `
    ${head("Roles", "Three fixed roles. Change someone’s role on the Users page. The database enforces them, not just this page.")}
    <div class="roles">${roles.map(([k, tone, text]) => `<div class="card role-card"><h3>${badge(ROLE_LABEL[k], tone, true)}<span class="count">${counts ? `${counts[k] || 0} active` : ""}</span></h3><p>${esc(text)}</p></div>`).join("")}</div>
    <div class="table-wrap"><table class="t matrix"><thead><tr><th>What</th><th>Admin</th><th>Manager</th><th>Viewer</th></tr></thead><tbody>
      ${rows.map(([what, ...cells]) => `<tr><td>${esc(what)}</td>${cells.join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="note">${icon("key")}<div><b>Who counts as staff:</b> an account whose profile is active and which has set its own password. The first admin was named in the database setup; anyone signing in without an invite waits for an admin’s approval.</div></div>`;
}

// ════════════════════════════════════════════════════════════════════════════ Audit logs
export async function auditPage(ctx) {
  const { el, api } = ctx;
  let stores = [];
  try { stores = await api.stores.list(); } catch {}
  if (!ctx.alive()) return;
  const SIZE = 25;
  const f = { action: "", user: "", from: "", to: "", offset: 0 };
  el.innerHTML = `
    ${head("Audit logs", "Every sign-in, failed sign-in, password change, invite, approval, role change, and every store and device change. Written by the database itself.", `<button class="btn" id="reload">${icon("refresh")}Refresh</button>`)}
    <div class="toolbar" role="group" aria-label="Filters">
      <label><span class="sr">Action</span><select class="select" id="action"><option value="">All actions</option>${Object.entries(ACTION_LABEL).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label>
      <input class="input search" type="search" id="user" placeholder="User email contains" aria-label="User email contains">
      <label class="inline">From <input class="input" type="date" id="from"></label>
      <label class="inline">To <input class="input" type="date" id="to"></label>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Time</th><th>Action</th><th>User</th><th>Target</th><th>Details</th></tr></thead><tbody id="rows"><tr><td colspan="5" class="muted">Loading…</td></tr></tbody></table></div>
    <div class="table-foot"><span id="count"></span><div class="tools"><button class="btn sm" id="prev">Previous</button><button class="btn sm" id="next">Next</button></div></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  const val = (k, v) => (k === "store_id" ? storeName(stores, v === null ? null : Number(v)) : v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  function details(a) {
    const d = a.detail || {};
    if ("from" in d && "to" in d && Object.keys(d).length === 2) return `${val(a.action === "user_store_changed" ? "store_id" : "", d.from)} → ${val(a.action === "user_store_changed" ? "store_id" : "", d.to)}`;
    return Object.entries(d).filter(([k]) => k !== "invite_id").map(([k, v]) => (v && typeof v === "object" && "from" in v ? `${k.replace("_id", "")}: ${val(k, v.from)} → ${val(k, v.to)}` : `${k.replace("_id", "")}: ${val(k, v)}`)).join(" · ");
  }
  async function load() {
    $("rows").innerHTML = `<tr><td colspan="5" class="muted">Loading…</td></tr>`;
    let r;
    try { r = await api.audit.list({ ...f, from: f.from ? istStart(f.from).toISOString() : "", to: f.to ? istStart(addDays(f.to, 1)).toISOString() : "", limit: SIZE }); }
    catch (e) { if (ctx.alive()) $("rows").innerHTML = `<tr><td colspan="5">${errorBox(e)}</td></tr>`; return; }
    if (!ctx.alive()) return;
    $("rows").innerHTML = r.rows.length ? r.rows.map((a) => `<tr>
      <td class="muted">${esc(fmtDateTime(a.at))}</td>
      <td>${badge(ACTION_LABEL[a.action] || a.action, actionTone(a.action))}</td>
      <td>${esc(a.actor_email || (a.action === "device_paired" ? "The device" : "—"))}</td>
      <td>${a.target_type ? `<span class="dim">${esc(a.target_type)}</span> ${esc(a.target_label || "")}` : "—"}</td>
      <td class="wrap muted">${esc(details(a))}</td></tr>`).join("") : `<tr><td colspan="5" class="muted">No entries match.</td></tr>`;
    $("count").textContent = r.total ? `Showing ${f.offset + 1}–${Math.min(f.offset + SIZE, r.total)} of ${fmtNum(r.total)}` : "";
    $("prev").disabled = f.offset === 0;
    $("next").disabled = f.offset + SIZE >= r.total;
  }
  const set = () => { f.action = $("action").value; f.user = $("user").value.trim(); f.from = $("from").value; f.to = $("to").value; f.offset = 0; load(); };
  for (const id of ["action", "from", "to"]) $(id).addEventListener("change", set);
  let t;
  $("user").addEventListener("input", () => { clearTimeout(t); t = setTimeout(set, 350); });
  $("prev").addEventListener("click", () => { f.offset = Math.max(0, f.offset - SIZE); load(); });
  $("next").addEventListener("click", () => { f.offset += SIZE; load(); });
  $("reload").addEventListener("click", load);
  await load();
}
