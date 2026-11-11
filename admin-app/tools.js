// The store tools: product requests, playlists for a store TV or tablet (/kiosk), what each paired device shows
// (a section of the Devices page), and your profile. Live data goes through the shared Supabase client and the
// s3d_ functions in pipeline/admin/tools.sql; /admin?demo=1 uses the sample data made here, kept in memory.
import { finishSlug, productIdOf } from "/site.js";
import { siteOrigin } from "./config.js";
import { esc, icon, badge, statCard, emptyState, errorBox, toast, modal, confirmBox, copyText, qrModal, downloadCsv, fmtNum, fmtDateTime, fmtDate, fmtAgo, istDay, addDays } from "./ui.js";
import { ACTION_LABEL, ROLE_LABEL, PERMISSIONS, loadProducts } from "./pages.js";

if (!document.querySelector('link[href="/admin-app/tools.css"]')) document.head.insertAdjacentHTML("beforeend", `<link rel="stylesheet" href="/admin-app/tools.css">`);

// the audit log's names for what these pages write
Object.assign(ACTION_LABEL, {
  request_created: "Product requested", request_status: "Request status changed", request_commented: "Request comment",
  playlist_created: "Playlist created", playlist_updated: "Playlist updated", playlist_deleted: "Playlist deleted",
  device_show: "Sent to a device",
});

export const STATUS = { requested: ["Requested", ""], accepted: ["Accepted", "blue"], building: ["Building", "amber"], review: ["In review", "orange"], live: ["Live", "green"], declined: ["Not possible", "red"] };
const OPEN = ["requested", "accepted", "building", "review"];
const PRIORITY = { low: ["Low", ""], normal: ["Normal", ""], high: ["High", "amber"], urgent: ["Urgent", "red"] };
export const SHOW = { turn: "Turn slowly", doors: "Open the doors", features: "Show features", still: "Just the product" };
const SHOW_HELP = { turn: "It turns slowly all the way round.", doors: "Its doors open one by one, then close.", features: "Each feature in turn, with its note.", still: "It stands still; shoppers can touch to turn it." };

const head = (title, text, tools = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ""}</div>${tools ? `<div class="tools">${tools}</div>` : ""}</div>`;
const readOnlyNote = (what) => `<div class="note">${icon("eye")}<div><b>Read-only for your role.</b> Only admins and managers can change ${esc(what)}.</div></div>`;
const keep = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
const who = (name, email) => name || (email ? email.split("@")[0] : "—");
const label = (p) => `${p.brand} ${p.shortName}`;
const wide = (d) => { d.classList.add("wide"); return d; };
// a few icons only these pages use (same drawing style as ui.js)
const I = {
  play: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
};

// Sangeetha Product IDs already in the catalogue: from each product's and each colour's sangeetha.com link
function catalogueIds(products) {
  const m = new Map();
  for (const p of products) for (const [url, f] of [[p.sangeethaUrl, null], ...(p.finishes || []).map((f) => [f.sangeethaUrl, f])]) {
    const id = productIdOf(url);
    if (id && !m.has(id)) m.set(id, { p, f });
  }
  return m;
}
// what the form's "Product ID or link" box holds: the same rules as s3d_request_add
export function parseProductInput(value) {
  const s = String(value || "").trim();
  if (!s) return { error: "" };
  if (/^\d{3,12}$/.test(s)) return { id: s, link: null };
  if (/^(https?:\/\/)?(www\.)?sangeetha\.com\//i.test(s)) {
    const link = s.replace(/[?#].*$/, "").replace(/^(https?:\/\/)?(www\.)?/i, "https://www.");
    const id = productIdOf(link);
    return id && /^\d{3,12}$/.test(id) ? { id, link } : { error: "Couldn’t find the Product ID in that link: it is the number at the end of it." };
  }
  if (/^[a-z]+:\/\//i.test(s)) return { error: "That isn’t a sangeetha.com link." };
  return { error: "Give the Product ID (digits only) or the whole sangeetha.com link." };
}

// ════════════════════════════════════════════════════════════════════════════ Data
// The database's "not set up" error names schema.sql; these tables come from tools.sql
const setupHint = (e) => (/isn’t set up yet/.test(e?.message || "") ? new Error("The store tools aren’t set up yet. Paste pipeline/admin/tools.sql into the Supabase SQL editor and run it (after schema.sql).") : e);
const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw setupHint(e); } };

function liveData({ sb, run, rpc }) {
  return {
    requests: {
      list: guard(async () => {
        const [requests, comments] = await Promise.all([
          run(sb.from("s3d_requests").select("*").order("created_at", { ascending: false })),
          run(sb.from("s3d_request_comments").select("*").order("at").order("id")),
        ]);
        return { requests, comments };
      }),
      add: guard((v) => rpc("s3d_request_add", { p_product: v.product, p_brand: v.brand, p_model: v.model || null, p_colours: v.colours || null, p_priority: v.priority || "normal", p_needed_by: v.needed_by || null, p_notes: v.notes || null })),
      status: guard((id, status, reason, product) => rpc("s3d_request_status", { p_id: id, p_status: status, p_reason: reason || null, p_product: product || null })),
      comment: guard((id, body) => rpc("s3d_request_comment", { p_id: id, p_body: body })),
    },
    playlists: {
      list: guard(() => run(sb.from("s3d_playlists").select("*").order("name"))),
      save: guard((p) => rpc("s3d_playlist_save", { p_id: p.id ?? null, p_name: p.name, p_seconds: p.seconds, p_show: p.show, p_items: p.items })),
      remove: guard((id) => rpc("s3d_playlist_delete", { p_id: id })),
    },
    screens: {
      list: guard(() => run(sb.from("s3d_device_screens").select("*"))),
      show: guard((device, w) => rpc("s3d_device_show", { p_device: device, p_kind: w.kind, p_product: w.product || null, p_finish: w.finish || null, p_playlist: w.playlist ?? null })),
    },
    setName: guard((name) => rpc("s3d_my_name", { p_name: name || null })),
  };
}

// Demo mode: made-up requests, playlists and screens, built on the real products and their real Sangeetha
// Product IDs from /products.json, and the sample staff and devices of demo.js. Nothing is saved.
function demoData({ me, users, devices, write, wait }) {
  const H = 3600e3, DAY = 24 * H, now = Date.now();
  const iso = (t) => new Date(t).toISOString();
  const by = (u) => ({ requested_by: u.user_id, requested_by_email: u.email, requested_by_name: u.full_name, store_id: u.store_id });
  const requests = [], comments = [], playlists = [], screens = [];
  let next = 500;
  const fail = (m) => { throw new Error(m); };
  const S = { me };
  const ready = loadProducts().then((all) => {
    const staff = [users.find((u) => u.user_id === "demo-2") || me, users.find((u) => u.user_id === "demo-4") || me, users.find((u) => u.user_id === "demo-3") || me, me];
    const ids = [...catalogueIds(all)].map(([sid, { p, f }]) => ({ sid, p, f, url: f?.sangeethaUrl || p.sangeethaUrl }));
    const shown = ids.filter((x) => !x.p.hidden), hidden = ids.filter((x) => x.p.hidden);
    const plan = [
      [shown[0], "live", "high", 26, 0], [shown[1], "live", "normal", 22, 2], [shown[2], "review", "high", 9, 1],
      [hidden[0], "building", "urgent", 6, 3], [hidden[1], "accepted", "normal", 4, 1], [hidden[2], "requested", "high", 1.3, 0],
      [hidden[3], "requested", "low", 0.4, 1], [hidden[4], "declined", "normal", 12, 2],
    ].filter(([x]) => x);
    const steps = ["requested", "accepted", "building", "review", "live"];
    plan.forEach(([x, status, priority, ago, who_], i) => {
      const u = staff[who_], t = now - ago * DAY;
      const r = {
        id: i + 1, sangeetha_id: x.sid, link: x.url, brand: x.p.brand, model: x.f?.code || x.p.model,
        colours: x.f ? x.f.name : x.p.finishes.map((f) => f.name).join(", "), priority, needed_by: priority === "urgent" || priority === "high" ? addDays(istDay(), 3 + i * 2) : null,
        notes: i === 0 ? "Customers keep asking to see it open. Please show the drawers." : i === 3 ? "For the weekend sale display." : null,
        status, reason: status === "declined" ? "Not sold in our stores any more." : null, product_id: status === "live" || status === "review" ? x.p.id : null,
        ...by(u), created_at: iso(t), updated_at: iso(t), status_at: iso(t),
      };
      requests.push(r);
      // its history: each step up to its status, a few hours or days apart, by a manager or admin
      const path = status === "declined" ? ["requested", "declined"] : steps.slice(0, steps.indexOf(status) + 1);
      path.slice(1).forEach((s, k) => {
        const at = t + (k + 1) * Math.max(0.15, ago / (path.length + 1)) * DAY;
        const actor = k % 2 ? staff[3] : staff[0];
        comments.push({ id: ++next, request_id: r.id, at: iso(at), author: actor.user_id, author_email: actor.email, author_name: actor.full_name, body: s === "declined" ? r.reason : null, status_from: path[k], status_to: s });
        r.status_at = r.updated_at = iso(at);
      });
    });
    const add = (rid, u, hours, body) => { const r = requests.find((x) => x.id === rid); if (r) comments.push({ id: ++next, request_id: rid, at: iso(new Date(r.created_at).getTime() + hours * H), author: u.user_id, author_email: u.email, author_name: u.full_name, body, status_from: null, status_to: null }); };
    add(1, staff[1], 5, "Seen it in the store on the tablet: the drawers look right.");
    add(3, staff[0], 30, "Checked on an iPhone and an Android phone. Waiting for the headset check.");
    add(4, staff[1], 20, "Can we have it before the weekend?");
    add(4, staff[3], 22, "Yes, it’s being built now.");
    comments.sort((a, b) => (a.at < b.at ? -1 : 1));

    // playlists: products on show, each in one of its real colours
    const onShow = all.filter((p) => !p.hidden);
    const pick = (list, colour) => list.map((p, i) => ({ product: p.id, finish: p.finishes.length > 1 && colour(i) ? finishSlug(p.finishes[colour(i) % p.finishes.length].name) : null }));
    const pl = (id, name, seconds, show, items, ago, u) => playlists.push({ id, name, seconds, show, items, created_by: u.user_id, created_by_email: u.email, updated_by_email: u.email, created_at: iso(now - ago * DAY), updated_at: iso(now - ago * DAY * 0.4) });
    pl(1, "Front window fridges", 20, "turn", pick(onShow.slice(0, 6), (i) => i), 18, staff[0]);
    pl(2, "Doors and drawers", 25, "doors", pick(onShow.slice(6, 10), () => 0), 9, staff[3]);
    pl(3, "What’s inside", 30, "features", pick(onShow.slice(10, 13), () => 0), 3, staff[2]);

    // what the paired sample devices show
    const paired = devices.filter((d) => d.paired_at);
    const sc = (d, cmd, showing, sentAgo, picked, u) => screens.push({ device_id: d.id, cmd: cmd ? `demo-${d.id}` : null, ...(cmd || {}), sent_at: cmd ? iso(now - sentAgo * H) : null, sent_by: cmd ? u.user_id : null, sent_by_email: cmd ? u.email : null, picked_at: cmd && picked ? iso(now - sentAgo * H + 6000) : null, showing, showing_at: iso(now - sentAgo * H + 6000), seen_at: d.last_seen_at });
    const base = { kind: null, product_id: null, finish: null, playlist_id: null };
    if (paired[0]) sc(paired[0], { ...base, kind: "playlist", playlist_id: 1 }, "playlist:1", 26, true, staff[0]);
    if (paired[1] && onShow[3]) sc(paired[1], { ...base, kind: "product", product_id: onShow[3].id, finish: finishSlug(onShow[3].finishes[0].name) }, `product:${onShow[3].id}`, 5, true, staff[3]);
    if (paired[2]) sc(paired[2], null, "catalogue", 3, false);
    if (paired[3] && onShow[0]) sc(paired[3], { ...base, kind: "product", product_id: onShow[0].id, finish: null }, `product:${onShow[0].id}`, 7, true, staff[0]);
  });
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const reqLabel = (r) => `${r.brand}${r.model ? ` ${r.model}` : ""} (${r.sangeetha_id})`;
  return {
    requests: {
      async list() { await ready; await wait(); return { requests: copy(requests), comments: copy(comments) }; },
      async add(v) {
        await ready;
        const p = parseProductInput(v.product);
        if (!p.id) fail(p.error || "Give the Sangeetha Product ID (the number at the end of its sangeetha.com link) or the whole link.");
        if (!String(v.brand || "").trim()) fail("Give the brand.");
        const dup = requests.find((r) => r.sangeetha_id === p.id && OPEN.includes(r.status));
        if (dup) fail(`Product ID ${p.id} is already requested (request #${dup.id}). Add a comment there instead.`);
        const r = { id: requests.reduce((n, x) => Math.max(n, x.id), 0) + 1, sangeetha_id: p.id, link: p.link, brand: v.brand.trim(), model: v.model?.trim() || null, colours: v.colours?.trim() || null, priority: v.priority || "normal", needed_by: v.needed_by || null, notes: v.notes?.trim() || null, status: "requested", reason: null, product_id: null, ...by(S.me), created_at: iso(Date.now()), updated_at: iso(Date.now()), status_at: iso(Date.now()) };
        requests.unshift(r);
        await write("request_created", "request", reqLabel(r), { product_id: r.sangeetha_id, priority: r.priority });
        return copy(r);
      },
      async status(id, status, reason, product) {
        await ready;
        if (!["admin", "manager"].includes(S.me.role)) fail("Your role can’t do that.");
        const r = requests.find((x) => x.id === id);
        if (status === "declined" && !String(reason || "").trim()) fail("Say why it isn’t possible.");
        if (OPEN.includes(status) && !OPEN.includes(r.status)) { const dup = requests.find((x) => x.id !== id && x.sangeetha_id === r.sangeetha_id && OPEN.includes(x.status)); if (dup) fail(`Product ID ${r.sangeetha_id} already has an open request (#${dup.id}).`); }
        const from = r.status;
        Object.assign(r, { status, reason: status === "declined" ? reason.trim() : null, product_id: product || r.product_id, updated_at: iso(Date.now()) });
        if (from !== status) {
          r.status_at = r.updated_at;
          comments.push({ id: ++next, request_id: id, at: r.updated_at, author: S.me.user_id, author_email: S.me.email, author_name: S.me.full_name, body: r.reason, status_from: from, status_to: status });
        }
        await write("request_status", "request", reqLabel(r), { status: { from, to: status }, ...(r.reason ? { reason: r.reason } : {}) });
        return copy(r);
      },
      async comment(id, body) {
        await ready;
        const text = String(body || "").trim();
        if (!text) fail("Write a comment first.");
        const r = requests.find((x) => x.id === id);
        const c = { id: ++next, request_id: id, at: iso(Date.now()), author: S.me.user_id, author_email: S.me.email, author_name: S.me.full_name, body: text.slice(0, 1000), status_from: null, status_to: null };
        comments.push(c);
        r.updated_at = c.at;
        await write("request_commented", "request", reqLabel(r), { text: text.slice(0, 120) });
        return copy(c);
      },
    },
    playlists: {
      async list() { await ready; await wait(); return copy(playlists).sort((a, b) => a.name.localeCompare(b.name)); },
      async save(p) {
        await ready;
        if (!["admin", "manager"].includes(S.me.role)) fail("Your role can’t do that.");
        const name = String(p.name || "").trim();
        if (!name) fail("Give the playlist a name.");
        if (!(p.seconds >= 8 && p.seconds <= 600)) fail("Seconds per product: from 8 to 600.");
        if (playlists.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== p.id)) fail(`There is already a playlist called “${name}”.`);
        const items = p.items.map((x) => ({ product: x.product, finish: x.finish || null }));
        let o = playlists.find((x) => x.id === p.id);
        if (!o) {
          o = { id: playlists.reduce((n, x) => Math.max(n, x.id), 0) + 1, created_by: S.me.user_id, created_by_email: S.me.email, created_at: iso(Date.now()) };
          playlists.push(o);
          await write("playlist_created", "playlist", name, { products: items.length, seconds: p.seconds, show: p.show });
        } else await write("playlist_updated", "playlist", name, { products: { from: o.items.length, to: items.length } });
        Object.assign(o, { name, seconds: p.seconds, show: p.show, items, updated_by_email: S.me.email, updated_at: iso(Date.now()) });
        return copy(o);
      },
      async remove(id) {
        await ready;
        const i = playlists.findIndex((x) => x.id === id);
        const [o] = playlists.splice(i, 1);
        for (const s of screens) if (s.playlist_id === id) s.playlist_id = null;
        await write("playlist_deleted", "playlist", o.name, { products: o.items.length });
      },
    },
    screens: {
      async list() { await ready; await wait(); return copy(screens); },
      async show(deviceId, w) {
        await ready;
        if (!["admin", "manager"].includes(S.me.role)) fail("Your role can’t do that.");
        const d = devices.find((x) => x.id === deviceId);
        if (!d?.paired_at) fail("Pair this device first: only a paired device can be sent something.");
        let s = screens.find((x) => x.device_id === deviceId);
        if (!s) { s = { device_id: deviceId, showing: null, showing_at: null, seen_at: d.last_seen_at }; screens.push(s); }
        const cmd = `demo-${++next}`;
        Object.assign(s, { cmd, kind: w.kind, product_id: w.kind === "product" ? w.product : null, finish: w.kind === "product" ? w.finish || null : null, playlist_id: w.kind === "playlist" ? w.playlist : null, sent_at: iso(Date.now()), sent_by: S.me.user_id, sent_by_email: S.me.email, picked_at: null });
        const pl = playlists.find((x) => x.id === w.playlist);
        await write("device_show", "device", d.name, w.kind === "product" ? { product: w.product, ...(w.finish ? { colour: w.finish } : {}) } : w.kind === "playlist" ? { playlist: pl?.name } : { show: "catalogue" });
        // the sample device picks it up on its next poll, a few seconds later
        setTimeout(() => {
          if (s.cmd !== cmd) return;
          const t = iso(Date.now());
          Object.assign(s, { picked_at: t, seen_at: t, showing_at: t, showing: w.kind === "product" ? `product:${w.product}` : w.kind === "playlist" ? `playlist:${w.playlist}` : "catalogue" });
          d.last_seen_at = t;
        }, 4500);
        return copy(s);
      },
    },
    async setName(name) { await wait(); S.me.full_name = String(name || "").trim().slice(0, 120) || null; await write("user_updated", "user", S.me.email, { full_name: S.me.full_name }); return { full_name: S.me.full_name }; },
  };
}

const cache = new WeakMap();
const data = (api) => { if (!cache.has(api)) cache.set(api, api.mode === "demo" ? demoData(api.raw) : liveData(api.raw)); return cache.get(api); };

// ════════════════════════════════════════════════════════════════════════════ Requests
export async function requestsPage(ctx) {
  const { el, api, profile, can } = ctx;
  const D = data(api);
  let reqs, comments, products = [], stores = [];
  const loadAll = async () => { ({ requests: reqs, comments } = await D.requests.list()); };
  try { [products, stores] = await Promise.all([loadProducts().catch(() => []), api.stores.list().catch(() => []), loadAll()]); }
  catch (e) { el.innerHTML = head("Product requests", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  const inCat = catalogueIds(products);
  const storeName = (id) => stores.find((s) => s.id === id)?.name || "";
  const f = { q: "", status: keep.get("s3d-req-status") || "open", priority: "", mine: (location.hash.split("?")[1] || "").includes("mine=1") };
  el.innerHTML = `
    ${head("Product requests", "Ask for a product to be made in 3D and AR, by its Sangeetha Product ID or link. Follow it here from requested to live; anyone can add a comment.", `<button class="btn" id="csv">${icon("download")}Export CSV</button><button class="btn primary" id="add">${icon("plus")}New request</button>`)}
    <div class="stats" id="stats"></div>
    <div class="toolbar" role="group" aria-label="Filters">
      <input class="input search" type="search" id="q" placeholder="Search brand, model, Product ID or name" aria-label="Search requests">
      <div class="chips" role="group" aria-label="Status">${[["open", "Open"], ["all", "All"], ...Object.entries(STATUS).map(([k, [l]]) => [k, l])].map(([k, l]) => `<button class="btn sm" data-st="${k}" aria-pressed="${k === f.status}">${esc(l)}</button>`).join("")}</div>
      <label><span class="sr">Priority</span><select class="select" id="prio"><option value="">Any priority</option>${Object.entries(PRIORITY).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
      <button class="btn sm" id="mine" aria-pressed="${f.mine}">Only mine</button>
    </div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Product</th><th>Colours</th><th>Priority</th><th>Needed by</th><th>Status</th><th>Asked by</th><th class="n">Comments</th><th class="n">Actions</th></tr></thead><tbody id="rows"></tbody></table></div>
    ${can.write ? "" : `<div class="note">${icon("info")}<div><b>Anyone can ask and comment.</b> Admins and managers accept a request and move it along, or say why it isn’t possible.</div></div>`}`;
  const $ = (id) => el.querySelector(`#${id}`);
  const nComments = (r) => comments.filter((c) => c.request_id === r.id && c.body && !c.status_to).length;
  const shown = () => {
    const n = f.q.toLowerCase().trim();
    return reqs.filter((r) => (f.status === "all" || (f.status === "open" ? OPEN.includes(r.status) : r.status === f.status))
      && (!f.priority || r.priority === f.priority) && (!f.mine || r.requested_by === profile.user_id)
      && (!n || `${r.brand} ${r.model || ""} ${r.sangeetha_id} ${r.requested_by_name || ""} ${r.requested_by_email || ""} #${r.id}`.toLowerCase().includes(n)));
  };
  function render() {
    const count = (s) => reqs.filter((r) => s.includes(r.status)).length;
    $("stats").innerHTML = [
      statCard({ title: "Open", value: fmtNum(count(OPEN)), ic: "clock", sub: "Requested to in review" }),
      statCard({ title: "Waiting", value: fmtNum(count(["requested"])), ic: "alert", tone: "amber", sub: "Not accepted yet" }),
      statCard({ title: "Being built", value: fmtNum(count(["accepted", "building"])), ic: "cube", tone: "blue" }),
      statCard({ title: "In review", value: fmtNum(count(["review"])), ic: "eye", tone: "orange", sub: "Built, being checked" }),
      statCard({ title: "Live", value: fmtNum(count(["live"])), ic: "checkCircle", tone: "green", sub: "In the catalogue" }),
      statCard({ title: "Not possible", value: fmtNum(count(["declined"])), ic: "x", tone: "red" }),
    ].join("");
    const rows = shown();
    $("rows").innerHTML = rows.length ? rows.map((r) => {
      const cat = inCat.get(r.sangeetha_id);
      return `<tr data-id="${r.id}">
        <td><div class="cell-main">${cat ? `<img src="${esc(cat.p.thumb)}" alt="" loading="lazy">` : `<span class="req-ph" aria-hidden="true">${icon("box")}</span>`}<div><b>${esc(r.brand)} ${esc(r.model || "")}</b><span>#${r.id} · ID ${esc(r.sangeetha_id)}${cat && r.status !== "live" ? ` · <i class="flag">in the catalogue</i>` : ""}</span></div></div></td>
        <td class="wrap muted">${esc(r.colours || "—")}</td>
        <td>${badge(PRIORITY[r.priority]?.[0] || r.priority, PRIORITY[r.priority]?.[1] || "", true)}</td>
        <td class="${r.needed_by && r.needed_by < istDay() && OPEN.includes(r.status) ? "err" : "muted"}">${r.needed_by ? esc(fmtDate(`${r.needed_by}T12:00:00+05:30`)) : "—"}</td>
        <td>${badge(STATUS[r.status][0], STATUS[r.status][1])}</td>
        <td><div class="cell-main"><div><b>${esc(who(r.requested_by_name, r.requested_by_email))}</b><span title="${esc(fmtDateTime(r.created_at))}">${esc(fmtAgo(r.created_at))}${storeName(r.store_id) ? ` · ${esc(storeName(r.store_id))}` : ""}</span></div></div></td>
        <td class="n">${nComments(r) || `<span class="dim">0</span>`}</td>
        <td><div class="actions"><button class="btn sm" data-open aria-label="Open request #${r.id}, ${esc(r.brand)} ${esc(r.model || "")}">Open</button></div></td></tr>`;
    }).join("") : `<tr><td colspan="8">${emptyState(reqs.length ? "No request matches" : "No requests yet", reqs.length ? "Try another status or search." : "Ask for the first one with “New request”.")}</td></tr>`;
  }
  const reload = async () => { await loadAll(); if (ctx.alive()) render(); };

  // ── one request: its details, history and comments; admins and managers change its status ──
  function openRequest(id) {
    const d = wide(modal({ title: "Request", body: `<div class="loading">Loading…</div>`, foot: `<button class="btn" data-close>Close</button>` }));
    const fill = () => {
      const r = reqs.find((x) => x.id === id);
      if (!r) { d.querySelector(".modal-body").innerHTML = emptyState("This request is gone", ""); return; }
      const cat = inCat.get(r.sangeetha_id);
      const dup = reqs.find((x) => x.id !== r.id && x.sangeetha_id === r.sangeetha_id && OPEN.includes(x.status));
      const live = r.product_id && products.find((p) => p.id === r.product_id);
      const hist = comments.filter((c) => c.request_id === r.id);
      d.querySelector(".modal-head h2").textContent = `${r.brand} ${r.model || ""}`.trim();
      d.querySelector(".modal-head h2").insertAdjacentHTML("afterend", d.querySelector(".modal-head p") ? "" : "<p></p>");
      d.querySelector(".modal-head p").textContent = `Request #${r.id} · Sangeetha Product ID ${r.sangeetha_id}`;
      d.querySelector(".modal-body").innerHTML = `
        ${cat ? `<div class="msg ${r.status === "live" ? "good" : "warn"}">${r.status === "live" ? "Live in the catalogue:" : "Already in the catalogue:"} <b>${esc(label(cat.p))}</b>${cat.f ? ` (${esc(cat.f.name)})` : ""}, ${cat.p.hidden ? "hidden" : "on show"}.</div>` : ""}
        ${dup ? `<div class="msg warn">Another open request has the same Product ID: <button class="linkbtn" data-goto="${dup.id}">#${dup.id}</button> (${esc(STATUS[dup.status][0])}).</div>` : ""}
        <dl class="facts">
          <div><dt>Status</dt><dd>${badge(STATUS[r.status][0], STATUS[r.status][1])}${r.reason ? `<span class="why">${esc(r.reason)}</span>` : ""}</dd></div>
          <div><dt>Priority</dt><dd>${badge(PRIORITY[r.priority][0], PRIORITY[r.priority][1], true)}</dd></div>
          <div><dt>Needed by</dt><dd>${r.needed_by ? esc(fmtDate(`${r.needed_by}T12:00:00+05:30`)) : "—"}</dd></div>
          <div><dt>Colours wanted</dt><dd>${esc(r.colours || "—")}</dd></div>
          <div><dt>Asked by</dt><dd>${esc(who(r.requested_by_name, r.requested_by_email))}<span class="dim"> ${esc(r.requested_by_email || "")}${storeName(r.store_id) ? ` · ${esc(storeName(r.store_id))}` : ""}</span></dd></div>
          <div><dt>Asked on</dt><dd>${esc(fmtDateTime(r.created_at))}</dd></div>
          <div><dt>On sangeetha.com</dt><dd>${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Open the product page ${icon("external")}</a>` : `<span class="dim">No link given</span>`}</dd></div>
          <div><dt>In the catalogue</dt><dd>${live ? `<a href="/p/${esc(live.id)}" target="_blank" rel="noopener">${esc(label(live))} ${icon("external")}</a>` : r.product_id ? esc(r.product_id) : "—"}</dd></div>
          ${r.notes ? `<div class="full"><dt>Notes</dt><dd class="pre">${esc(r.notes)}</dd></div>` : ""}
        </dl>
        ${can.write ? `<form class="req-status" id="stForm" novalidate>
          <div class="row2">
            <label class="field">Status<select name="status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === r.status ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
            <label class="field">Catalogue product<select name="product"><option value="">—</option>${products.map((p) => `<option value="${esc(p.id)}" ${p.id === (r.product_id || cat?.p.id) ? "selected" : ""}>${esc(label(p))} · ${esc(p.model)}${p.hidden ? " (hidden)" : ""}</option>`).join("")}</select><span class="help">Which catalogue product it became, once built.</span></label>
          </div>
          <label class="field" id="whyRow">Why it isn’t possible *<textarea name="reason" maxlength="500">${esc(r.reason || "")}</textarea></label>
          <div class="msg bad hide" id="stErr" role="alert"></div>
          <div><button class="btn primary" type="submit">${icon("check")}Save status</button></div>
        </form>` : ""}
        <section class="hist" aria-labelledby="h-hist"><h3 id="h-hist">History and comments</h3>
          <ol class="timeline">
            <li><span class="dot"></span><div><b>${esc(who(r.requested_by_name, r.requested_by_email))}</b> asked for it <span class="dim" title="${esc(fmtDateTime(r.created_at))}">${esc(fmtAgo(r.created_at))}</span></div></li>
            ${hist.map((c) => `<li class="${c.status_to ? "st" : "cm"}"><span class="dot"></span><div><b>${esc(who(c.author_name, c.author_email))}</b> ${c.status_to ? `moved it to ${badge(STATUS[c.status_to]?.[0] || c.status_to, STATUS[c.status_to]?.[1] || "")}` : "commented"} <span class="dim" title="${esc(fmtDateTime(c.at))}">${esc(fmtAgo(c.at))}</span>${c.body ? `<p class="pre">${esc(c.body)}</p>` : ""}</div></li>`).join("")}
          </ol>
          <form id="cmForm" class="cm-form" novalidate>
            <label class="field"><span class="sr">Comment</span><textarea name="body" maxlength="1000" placeholder="Add a comment for the team"></textarea></label>
            <div class="msg bad hide" id="cmErr" role="alert"></div>
            <div><button class="btn" type="submit">${icon("plus")}Add comment</button></div>
          </form>
        </section>`;
      const st = d.querySelector("#stForm");
      if (st) {
        const why = () => d.querySelector("#whyRow").classList.toggle("hide", st.status.value !== "declined");
        why();
        st.status.addEventListener("change", why);
        st.addEventListener("submit", async (e) => {
          e.preventDefault();
          const b = st.querySelector("[type=submit]"), err = d.querySelector("#stErr");
          if (st.status.value === "declined" && !st.reason.value.trim()) { err.textContent = "Say why it isn’t possible."; err.classList.remove("hide"); st.reason.focus(); return; }
          b.disabled = true;
          try { await D.requests.status(r.id, st.status.value, st.reason.value, st.product.value); toast("Status saved."); await reload(); if (d.open) fill(); }
          catch (x) { err.textContent = x.message; err.classList.remove("hide"); b.disabled = false; }
        });
      }
      const cm = d.querySelector("#cmForm");
      cm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const b = cm.querySelector("[type=submit]"), err = d.querySelector("#cmErr");
        if (!cm.body.value.trim()) { err.textContent = "Write a comment first."; err.classList.remove("hide"); cm.body.focus(); return; }
        b.disabled = true;
        try { await D.requests.comment(r.id, cm.body.value); toast("Comment added."); await reload(); if (d.open) { fill(); d.querySelector("#cmForm textarea").focus(); } }
        catch (x) { err.textContent = x.message; err.classList.remove("hide"); b.disabled = false; }
      });
      d.querySelector("[data-goto]")?.addEventListener("click", (e) => { d.close(); openRequest(Number(e.target.dataset.goto)); });
    };
    fill();
    d.querySelector("[data-close]")?.focus();
  }

  // ── a new request ──
  function newRequest() {
    const brands = [...new Set(products.map((p) => p.brand))].sort();
    const d = wide(modal({
      title: "New request", sub: "Ask for a product to be made in 3D and AR. The team builds it from Sangeetha’s and the maker’s own pages.",
      body: `<form id="nrForm" class="modal-form" novalidate style="display:grid;gap:14px">
        <label class="field">Sangeetha Product ID or link *<input name="product" required maxlength="500" autocomplete="off" spellcheck="false" placeholder="21330, or https://www.sangeetha.com/…/21330"><span class="help">The number at the end of the product’s sangeetha.com link. You can paste the whole link.</span></label>
        <div id="pid" aria-live="polite"></div>
        <div class="row2">
          <label class="field">Brand *<input name="brand" required maxlength="60" list="brandList" autocomplete="off"><datalist id="brandList">${brands.map((b) => `<option value="${esc(b)}">`).join("")}</datalist></label>
          <label class="field">Model code<input name="model" maxlength="80" autocomplete="off" spellcheck="false"></label>
        </div>
        <label class="field">Colours wanted<input name="colours" maxlength="300" placeholder="For example: Graphite Black, Nickel Steel"></label>
        <div class="row2">
          <label class="field">Priority<select name="priority">${Object.entries(PRIORITY).map(([k, [l]]) => `<option value="${k}" ${k === "normal" ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field">Needed by<input type="date" name="needed_by" min="${istDay()}"></label>
        </div>
        <label class="field">Notes<textarea name="notes" maxlength="1000" placeholder="Anything the team should know: why it’s wanted, what to show"></textarea></label>
        <label class="check hide" id="anyway"><input type="checkbox" name="anyway"> Ask for it anyway (a new colour, or to bring a hidden one back)</label>
        <div class="msg bad hide" id="nrErr" role="alert"></div>
        <button type="submit" class="hide"></button>
      </form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-submit>${icon("check")}Send request</button>`,
    }));
    const form = d.querySelector("#nrForm"), err = d.querySelector("#nrErr");
    let state = {};
    const check = () => {
      const p = parseProductInput(form.product.value);
      const cat = p.id && inCat.get(p.id), dup = p.id && reqs.find((r) => r.sangeetha_id === p.id && OPEN.includes(r.status));
      state = { p, cat, dup };
      d.querySelector("#pid").innerHTML = !form.product.value.trim() ? ""
        : p.error ? `<div class="msg bad">${esc(p.error)}</div>`
        : dup ? `<div class="msg bad"><b>Already requested:</b> #${dup.id} ${esc(dup.brand)} ${esc(dup.model || "")} (${esc(STATUS[dup.status][0])}). Add a comment there instead. <button type="button" class="linkbtn" data-goto="${dup.id}">Open it</button></div>`
        : cat ? `<div class="msg warn"><b>Already in the catalogue:</b> ${esc(label(cat.p))}${cat.f ? ` (${esc(cat.f.name)})` : ""}, ${cat.p.hidden ? "hidden" : "on show"}. Product ID ${esc(p.id)}.</div>`
        : `<div class="msg good">Product ID <b>${esc(p.id)}</b>. Not requested yet, and not in the catalogue.</div>`;
      d.querySelector("#anyway").classList.toggle("hide", !(cat && !dup));
      d.querySelector("[data-submit]").disabled = !!dup;
      if (cat && !form.brand.value) { form.brand.value = cat.p.brand; form.model.value = cat.f?.code || cat.p.model; }
      d.querySelector("[data-goto]")?.addEventListener("click", (e) => { d.close(); openRequest(Number(e.target.dataset.goto)); });
    };
    form.product.addEventListener("input", check);
    const go = async (e) => {
      e?.preventDefault();
      check();
      const bad = (m, field) => { err.textContent = m; err.classList.remove("hide"); field?.focus(); };
      if (!state.p.id) return bad(state.p.error || "Give the Sangeetha Product ID or link.", form.product);
      if (state.dup) return bad(`Product ID ${state.p.id} is already requested (#${state.dup.id}). Add a comment there instead.`, form.product);
      if (state.cat && !form.anyway.checked) return bad("It’s in the catalogue already. Tick “Ask for it anyway” if it’s still needed.", form.anyway);
      if (!form.brand.value.trim()) return bad("Give the brand.", form.brand);
      const btn = d.querySelector("[data-submit]");
      btn.disabled = true;
      try {
        const v = Object.fromEntries(new FormData(form).entries());
        const r = await D.requests.add({ ...v, product: state.p.link || state.p.id });
        d.close();
        toast(`Request #${r.id} sent.`);
        await reload();
      } catch (x) { bad(x.message); btn.disabled = false; }
    };
    form.addEventListener("submit", go);
    d.querySelector("[data-submit]").addEventListener("click", go);
    form.product.focus();
  }

  function exportCsv() {
    const rows = shown();
    const cat = (r) => { const c = inCat.get(r.sangeetha_id); return c ? `${label(c.p)}${c.p.hidden ? " (hidden)" : ""}` : ""; };
    downloadCsv(`product-requests-${istDay()}.csv`, [
      ["id", "Request"], ["sangeetha_id", "Sangeetha Product ID"], ["brand", "Brand"], ["model", "Model"], ["colours", "Colours wanted"],
      [(r) => PRIORITY[r.priority]?.[0], "Priority"], ["needed_by", "Needed by"], [(r) => STATUS[r.status]?.[0], "Status"], ["reason", "Why not possible"],
      ["product_id", "Catalogue product"], [cat, "Already in the catalogue"], [(r) => who(r.requested_by_name, r.requested_by_email), "Asked by"], ["requested_by_email", "Email"],
      [(r) => storeName(r.store_id), "Store"], [(r) => fmtDateTime(r.created_at), "Asked on"], [(r) => fmtDateTime(r.status_at), "Status changed"],
      [nComments, "Comments"], ["link", "Link"], ["notes", "Notes"],
    ], rows);
    toast(`CSV downloaded (${rows.length} ${rows.length === 1 ? "request" : "requests"}).`);
  }

  $("add").addEventListener("click", newRequest);
  $("csv").addEventListener("click", exportCsv);
  $("rows").addEventListener("click", (e) => { const id = Number(e.target.closest("tr[data-id]")?.dataset.id); if (id && e.target.closest("[data-open]")) openRequest(id); });
  $("q").addEventListener("input", (e) => { f.q = e.target.value; render(); });
  $("prio").addEventListener("change", (e) => { f.priority = e.target.value; render(); });
  $("mine").addEventListener("click", (e) => { f.mine = !f.mine; e.currentTarget.setAttribute("aria-pressed", String(f.mine)); render(); });
  el.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", () => { f.status = b.dataset.st; keep.set("s3d-req-status", f.status); el.querySelectorAll("[data-st]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); render(); }));
  render();
}

// ════════════════════════════════════════════════════════════════════════════ Playlists
// the showcase's address: a saved playlist by its id; in demo mode (nothing saved) the list itself
export function showcaseUrl(pl, demo) {
  if (!demo) return `${siteOrigin()}/kiosk?list=${pl.id}`;
  const q = new URLSearchParams({ items: pl.items.map((x) => (x.finish ? `${x.product}~${x.finish}` : x.product)).join(","), seconds: pl.seconds, show: pl.show, name: pl.name });
  return `${location.origin}/kiosk?${q}`;
}
const roundTime = (pl) => { const s = pl.items.length * pl.seconds; return s < 60 ? `${s} s` : `${Math.round(s / 6) / 10} min`; };

export async function playlistsPage(ctx) {
  const { el, api, can } = ctx;
  const D = data(api);
  const demo = api.mode === "demo";
  let lists, products;
  const loadAll = async () => { lists = await D.playlists.list(); };
  try { [products] = await Promise.all([loadProducts(), loadAll()]); } catch (e) { el.innerHTML = head("Playlists", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  const byId = (id) => products.find((p) => p.id === id);
  el.innerHTML = `
    ${head("Playlists", "Products that play one after another, full screen, on a store TV or tablet. Open a playlist’s showcase link on the screen, or send it to a paired device from Devices.", can.write ? `<button class="btn primary" id="add">${icon("plus")}New playlist</button>` : "")}
    ${can.write ? "" : readOnlyNote("playlists")}
    <div class="note">${icon("info")}<div><b>On the screen:</b> each product shows for its seconds, with a small QR code in the corner so a shopper can open it on their phone. A touch pauses the playlist; it carries on by itself after a minute without one.${demo ? " In demo mode the showcase link carries the list itself, since nothing is saved." : ""}</div></div>
    <div class="pl-grid" id="grid"></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  function render() {
    $("grid").innerHTML = lists.length ? lists.map((pl) => {
      const missing = pl.items.filter((x) => !byId(x.product) || byId(x.product).hidden).length;
      return `<article class="card pl-card" data-id="${pl.id}" aria-labelledby="pl-${pl.id}">
        <div class="pl-top"><h3 id="pl-${pl.id}">${esc(pl.name)}</h3>${badge(SHOW[pl.show] || pl.show, "blue", true)}</div>
        <p class="muted pl-meta">${pl.items.length} ${pl.items.length === 1 ? "product" : "products"} · ${pl.seconds} s each · ${roundTime(pl)} a round</p>
        <div class="pl-thumbs">${pl.items.slice(0, 8).map((x) => { const p = byId(x.product); return p ? `<img src="${esc(p.thumb)}" alt="${esc(label(p))}" title="${esc(label(p))}" loading="lazy">` : ""; }).join("")}${pl.items.length > 8 ? `<span class="more">+${pl.items.length - 8}</span>` : ""}${pl.items.length ? "" : `<span class="dim">No products yet</span>`}</div>
        ${missing ? `<p class="flag-line">${icon("alert")}${missing} not on show: the screen skips ${missing === 1 ? "it" : "them"}.</p>` : ""}
        <p class="dim pl-by">Updated ${esc(fmtAgo(pl.updated_at))}${pl.updated_by_email ? ` by ${esc(pl.updated_by_email)}` : ""}</p>
        <div class="actions pl-actions">
          <a class="btn sm primary" href="${esc(showcaseUrl(pl, demo))}" target="_blank" rel="noopener">${I.play}Play</a>
          <button class="btn sm" data-link aria-label="Showcase link and QR code for ${esc(pl.name)}">${icon("qr")}Link</button>
          ${can.write ? `<button class="btn sm" data-edit>${icon("edit")}Edit</button><button class="btn sm danger icon" data-del aria-label="Delete ${esc(pl.name)}">${icon("trash")}</button>` : ""}
        </div></article>`;
    }).join("") : `<div class="card">${emptyState("No playlists yet", can.write ? "Make the first one with “New playlist”." : "An admin or manager makes them.")}</div>`;
  }
  const reload = async () => { await loadAll(); if (ctx.alive()) render(); };

  function editor(pl) {
    const onShow = products.filter((p) => !p.hidden).sort((a, b) => label(a).localeCompare(label(b)));
    let items = (pl?.items || []).map((x) => ({ ...x }));
    const d = wide(modal({
      title: pl ? `Edit ${pl.name}` : "New playlist", sub: "Pick the products in the order they play, and a colour for each.",
      body: `<form id="plForm" class="modal-form" novalidate style="display:grid;gap:14px">
        <label class="field">Name *<input name="name" required maxlength="80" value="${esc(pl?.name || "")}" placeholder="For example: Front window fridges"></label>
        <div class="row2">
          <label class="field">Seconds per product<input name="seconds" type="number" min="8" max="600" step="1" value="${pl?.seconds || 20}" required><span class="help">From 8 to 600.</span></label>
          <fieldset class="seg"><legend>What to show</legend>${Object.entries(SHOW).map(([k, l]) => `<label><input type="radio" name="show" value="${k}" ${k === (pl?.show || "turn") ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}<span class="help" id="showHelp"></span></fieldset>
        </div>
        <div class="pl-edit"><div class="pl-edit-head"><b>Products</b><span class="dim" id="plCount"></span></div><ol id="plItems" class="pl-items"></ol>
          <div class="pl-add"><label class="field"><span class="sr">Product to add</span><select id="plPick"><option value="">Choose a product to add…</option>${onShow.map((p) => `<option value="${esc(p.id)}">${esc(label(p))} · ${esc(p.model)}</option>`).join("")}</select></label><button type="button" class="btn" id="plAdd">${icon("plus")}Add</button></div></div>
        <div class="msg bad hide" id="plErr" role="alert"></div>
        <button type="submit" class="hide"></button>
      </form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-submit>${icon("check")}Save playlist</button>`,
    }));
    const form = d.querySelector("#plForm"), list = d.querySelector("#plItems");
    const showHelp = () => (d.querySelector("#showHelp").textContent = SHOW_HELP[form.show.value] || "");
    function draw(focus) {
      list.innerHTML = items.length ? items.map((x, i) => {
        const p = byId(x.product);
        const fins = p?.finishes || [];
        return `<li data-i="${i}"><span class="n">${i + 1}</span>${p ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : ""}
          <div class="pl-name"><b>${esc(p ? label(p) : x.product)}</b><span>${p ? esc(p.model) : "Not in the catalogue"}${p?.hidden ? " · not on show, skipped" : ""}</span></div>
          ${fins.length > 1 ? `<label class="pl-colour"><span class="sr">Colour for ${esc(p ? label(p) : x.product)}</span><select data-colour>${fins.map((f) => `<option value="${esc(finishSlug(f.name))}" ${finishSlug(f.name) === (x.finish || finishSlug(fins[0].name)) ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></label>` : `<span class="dim pl-colour">${esc(fins[0]?.name || "")}</span>`}
          <div class="actions"><button type="button" class="btn sm icon" data-mv="-1" aria-label="Move ${esc(p ? label(p) : x.product)} up" ${i === 0 ? "disabled" : ""}>${I.up}</button><button type="button" class="btn sm icon" data-mv="1" aria-label="Move ${esc(p ? label(p) : x.product)} down" ${i === items.length - 1 ? "disabled" : ""}>${I.down}</button><button type="button" class="btn sm danger icon" data-rm aria-label="Remove ${esc(p ? label(p) : x.product)}">${icon("x")}</button></div></li>`;
      }).join("") : `<li class="empty-li dim">No products yet. Choose one below and press Add.</li>`;
      const secs = Number(form.seconds.value) || 20;
      d.querySelector("#plCount").textContent = items.length ? `${items.length} · about ${roundTime({ items, seconds: secs })} a round` : "";
      if (focus) list.querySelector(focus)?.focus();
    }
    list.addEventListener("change", (e) => { const li = e.target.closest("li[data-i]"); if (li && e.target.matches("[data-colour]")) { const p = byId(items[+li.dataset.i].product); items[+li.dataset.i].finish = e.target.value === finishSlug(p.finishes[0].name) ? null : e.target.value; } });
    list.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-i]");
      if (!li) return;
      const i = +li.dataset.i, mv = e.target.closest("[data-mv]");
      if (mv) { const j = i + Number(mv.dataset.mv); if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; draw(`li[data-i="${j}"] [data-mv="${mv.dataset.mv}"]:not([disabled])`) ; if (!list.contains(document.activeElement)) list.querySelector(`li[data-i="${j}"] [data-rm]`)?.focus(); }
      if (e.target.closest("[data-rm]")) { items.splice(i, 1); draw(); (list.querySelector(`li[data-i="${Math.min(i, items.length - 1)}"] [data-rm]`) || d.querySelector("#plPick")).focus(); }
    });
    d.querySelector("#plAdd").addEventListener("click", () => {
      const sel = d.querySelector("#plPick");
      if (!sel.value) { sel.focus(); return; }
      if (items.length >= 60) { toast("At most 60 products in a playlist.", true); return; }
      items.push({ product: sel.value, finish: null });
      sel.value = "";
      draw();
      sel.focus();
    });
    form.addEventListener("change", (e) => { if (e.target.name === "show") showHelp(); if (e.target.name === "seconds") draw(); });
    const go = async (e) => {
      e?.preventDefault();
      const err = d.querySelector("#plErr"), bad = (m, f) => { err.textContent = m; err.classList.remove("hide"); f?.focus(); };
      const secs = Number(form.seconds.value);
      if (!form.name.value.trim()) return bad("Give the playlist a name.", form.name);
      if (!(secs >= 8 && secs <= 600)) return bad("Seconds per product: from 8 to 600.", form.seconds);
      if (!items.length) return bad("Add at least one product.", d.querySelector("#plPick"));
      const btn = d.querySelector("[data-submit]");
      btn.disabled = true;
      try { await D.playlists.save({ id: pl?.id ?? null, name: form.name.value, seconds: Math.round(secs), show: form.show.value, items }); d.close(); toast(pl ? "Playlist saved." : "Playlist made."); await reload(); }
      catch (x) { bad(x.message); btn.disabled = false; }
    };
    form.addEventListener("submit", go);
    d.querySelector("[data-submit]").addEventListener("click", go);
    showHelp();
    draw();
    form.name.focus();
  }

  $("add")?.addEventListener("click", () => editor(null));
  $("grid").addEventListener("click", async (e) => {
    const pl = lists.find((x) => x.id === Number(e.target.closest("[data-id]")?.dataset.id));
    if (!pl) return;
    if (e.target.closest("[data-link]")) qrModal({ title: `Showcase: ${pl.name}`, sub: "Open this on the store TV or tablet (scan the code with its camera), or send the playlist to a paired device from Devices.", url: showcaseUrl(pl, demo), file: `showcase-${pl.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}` });
    if (e.target.closest("[data-edit]")) editor(pl);
    if (e.target.closest("[data-del]")) {
      if (!(await confirmBox({ title: `Delete ${pl.name}?`, text: "A screen playing it stops at its next check and shows nothing until it gets another playlist.", ok: "Delete playlist", danger: true }))) return;
      try { await D.playlists.remove(pl.id); toast("Playlist deleted."); await reload(); } catch (err) { toast(err.message, true); }
    }
  });
  render();
}

// ════════════════════════════════════════════════════════════════════════════ Devices: what each one shows
// A section under the Devices page's table (pages.js devicesPage calls this): every paired device, what it is
// showing, what it was last sent, and for admins and managers "show a product", "play a playlist" and "catalogue".
export async function deviceScreens(ctx) {
  const { el, api, can } = ctx;
  const D = data(api);
  const box = document.createElement("section");
  box.className = "section";
  box.id = "screens";
  box.setAttribute("aria-labelledby", "h-screens");
  box.innerHTML = `<div class="section-head"><div><h2 id="h-screens">Show on a device</h2><p>Send a product or a playlist to a paired device: it opens there within a few seconds. A phone or headset then shows a big “Tap to view in your room” button, as only a tap can start the room view.</p></div><button class="btn sm" id="scrRefresh">${icon("refresh")}Refresh</button></div><div id="scrBody"><div class="loading">Loading…</div></div>`;
  el.appendChild(box);
  const body = box.querySelector("#scrBody");
  let devices = [], stores = [], screens = [], lists = [], products = [];
  const load = async () => { [devices, stores, screens, lists, products] = await Promise.all([api.devices.list(), api.stores.list(), D.screens.list(), D.playlists.list().catch(() => []), loadProducts().catch(() => [])]); };
  const prod = (id) => products.find((p) => p.id === id);
  const plName = (id) => lists.find((l) => l.id === id)?.name;
  const latest = (...t) => t.filter(Boolean).sort().at(-1) || null;
  function what(s) {
    if (!s) return "—";
    const m = /^(product|playlist):(.+)$/.exec(s);
    if (m?.[1] === "product") { const p = prod(m[2]); return p ? esc(label(p)) : esc(m[2]); }
    if (m?.[1] === "playlist") return `Playlist: ${esc(plName(Number(m[2])) || `#${m[2]}`)}`;
    return esc({ kiosk: "A showcase", catalogue: "The catalogue", showroom: "The 3D showroom", compare: "Compare", other: "Another page" }[s] || s);
  }
  function sent(s) {
    if (!s?.cmd) return `<span class="dim">Nothing sent yet</span>`;
    const p = s.kind === "product" && prod(s.product_id);
    const fin = p && s.finish ? p.finishes.find((f) => finishSlug(f.name) === s.finish)?.name : null;
    const thing = s.kind === "product" ? `${esc(p ? label(p) : s.product_id || "")}${fin ? ` <span class="dim">(${esc(fin)})</span>` : ""}` : s.kind === "playlist" ? `Playlist: ${esc(plName(s.playlist_id) || "deleted")}` : "The catalogue";
    const state = s.picked_at && s.picked_at >= s.sent_at ? badge("Opened", "green") : Date.now() - new Date(s.sent_at).getTime() < 10 * 60e3 ? badge("Waiting for the device", "amber") : badge("Not picked up", "red");
    return `<div class="cell-main"><div><b>${thing}</b><span title="${esc(fmtDateTime(s.sent_at))}">${esc(fmtAgo(s.sent_at))}${s.sent_by_email ? ` by ${esc(s.sent_by_email)}` : ""}</span></div></div><div style="margin-top:4px">${state}</div>`;
  }
  function render() {
    const paired = devices.filter((d) => d.paired_at);
    if (!paired.length) { body.innerHTML = emptyState("No paired devices", "Pair a device first with its pairing link, above. Then you can send it a product or a playlist."); return; }
    body.innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>Device</th><th>Last seen</th><th>Showing now</th><th>Last sent</th>${can.write ? `<th class="n">Show on it</th>` : ""}</tr></thead><tbody>
      ${paired.map((d) => {
        const s = screens.find((x) => x.device_id === d.id);
        const seen = latest(d.last_seen_at, s?.seen_at);
        const stale = !seen || Date.now() - new Date(seen).getTime() > 3 * 60e3;
        return `<tr data-dev="${d.id}">
          <td><div class="cell-main"><div><b>${esc(d.name)}</b><span>${esc(stores.find((x) => x.id === d.store_id)?.name || "No store")}</span></div></div></td>
          <td title="${esc(fmtDateTime(seen))}"><span class="seen ${stale ? "off" : "on"}" aria-hidden="true"></span>${esc(fmtAgo(seen))}</td>
          <td>${s?.showing ? `${stale ? `<span class="dim">Last: </span>` : ""}${what(s.showing)}` : `<span class="dim">—</span>`}</td>
          <td>${sent(s)}</td>
          ${can.write ? `<td><div class="actions"><button class="btn sm" data-show="product">${icon("box")}Product</button><button class="btn sm" data-show="playlist">${I.play}Playlist</button><button class="btn sm icon" data-show="home" aria-label="Send ${esc(d.name)} back to the catalogue" title="Back to the catalogue">${I.home}</button></div></td>` : ""}</tr>`;
      }).join("")}</tbody></table></div>
      ${can.write ? "" : `<div class="note" style="margin-top:14px">${icon("eye")}<div><b>Read-only for your role.</b> Only admins and managers can send something to a device.</div></div>`}`;
  }
  const refresh = async () => { try { await load(); if (ctx.alive()) render(); } catch (e) { if (ctx.alive()) body.innerHTML = errorBox(e); } };
  const send = async (d, w, done) => { await D.screens.show(d.id, w); toast(done); await refresh(); };

  function pickProduct(d) {
    const onShow = products.filter((p) => !p.hidden).sort((a, b) => label(a).localeCompare(label(b)));
    const m = modal({
      title: `Show a product on ${d.name}`, sub: "It opens on the device within a few seconds.",
      body: `<form id="spForm" class="modal-form" novalidate style="display:grid;gap:14px">
        <label class="field">Product *<select name="product" required><option value="">Choose a product…</option>${onShow.map((p) => `<option value="${esc(p.id)}">${esc(label(p))} · ${esc(p.model)}</option>`).join("")}</select></label>
        <label class="field">Colour<select name="finish" disabled><option value="">—</option></select></label>
        <div class="msg">On a phone or headset a big “Tap to view in your room” button comes up: someone at the device taps it to see the product at real size.</div>
        <div class="msg bad hide" id="spErr" role="alert"></div><button type="submit" class="hide"></button></form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-submit>${icon("check")}Show it</button>`,
    });
    const form = m.querySelector("form");
    form.product.addEventListener("change", () => {
      const p = prod(form.product.value);
      form.finish.innerHTML = p ? p.finishes.map((f) => `<option value="${esc(finishSlug(f.name))}">${esc(f.name)}</option>`).join("") : `<option value="">—</option>`;
      form.finish.disabled = !p || p.finishes.length < 2;
    });
    const go = async (e) => {
      e?.preventDefault();
      const err = m.querySelector("#spErr");
      if (!form.product.value) { err.textContent = "Choose a product."; err.classList.remove("hide"); form.product.focus(); return; }
      const p = prod(form.product.value), btn = m.querySelector("[data-submit]");
      btn.disabled = true;
      try { await send(d, { kind: "product", product: p.id, finish: form.finish.value && form.finish.value !== finishSlug(p.finishes[0].name) ? form.finish.value : null }, `${label(p)} sent to ${d.name}.`); m.close(); }
      catch (x) { err.textContent = x.message; err.classList.remove("hide"); btn.disabled = false; }
    };
    form.addEventListener("submit", go);
    m.querySelector("[data-submit]").addEventListener("click", go);
    form.product.focus();
  }
  function pickPlaylist(d) {
    if (!lists.length) { modal({ title: `Play a playlist on ${d.name}`, body: emptyState("No playlists yet", "Make one on the Playlists page first."), foot: `<a class="btn primary" href="#/playlists">Open Playlists</a><button class="btn" data-close>Close</button>` }).querySelector("a").addEventListener("click", (e) => e.target.closest("dialog").close()); return; }
    const m = modal({
      title: `Play a playlist on ${d.name}`, sub: "It plays full screen on the device until you send something else.",
      body: `<form class="modal-form" novalidate style="display:grid;gap:14px"><fieldset class="seg list"><legend class="sr">Playlist</legend>${lists.map((l, i) => `<label><input type="radio" name="pl" value="${l.id}" ${i === 0 ? "checked" : ""}><span><b>${esc(l.name)}</b> <i class="dim">${l.items.length} products · ${esc(SHOW[l.show] || l.show)}</i></span></label>`).join("")}</fieldset><div class="msg bad hide" id="ppErr" role="alert"></div><button type="submit" class="hide"></button></form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-submit>${I.play}Play it</button>`,
    });
    const form = m.querySelector("form");
    const go = async (e) => {
      e?.preventDefault();
      const l = lists.find((x) => x.id === Number(form.pl.value)), btn = m.querySelector("[data-submit]");
      btn.disabled = true;
      try { await send(d, { kind: "playlist", playlist: l.id }, `${l.name} sent to ${d.name}.`); m.close(); }
      catch (x) { const err = m.querySelector("#ppErr"); err.textContent = x.message; err.classList.remove("hide"); btn.disabled = false; }
    };
    form.addEventListener("submit", go);
    m.querySelector("[data-submit]").addEventListener("click", go);
    form.querySelector("input")?.focus();
  }

  box.querySelector("#scrRefresh").addEventListener("click", refresh);
  body.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-show]"), d = b && devices.find((x) => x.id === Number(b.closest("tr").dataset.dev));
    if (!d) return;
    if (b.dataset.show === "product") pickProduct(d);
    if (b.dataset.show === "playlist") pickPlaylist(d);
    if (b.dataset.show === "home") { b.disabled = true; try { await send(d, { kind: "home" }, `${d.name} goes back to the catalogue.`); } catch (x) { toast(x.message, true); b.disabled = false; } }
  });
  await refresh();
  // keep "last seen" and "opened" current while the page is open
  const tick = () => setTimeout(async () => { if (!ctx.alive() || !box.isConnected) return; if (!document.querySelector("dialog.modal")) await refresh(); tick(); }, 8000);
  tick();
}

// ════════════════════════════════════════════════════════════════════════════ Profile
export async function profilePage(ctx) {
  const { el, api, profile } = ctx;
  const D = data(api);
  // the account menu that links here stays open after the click: close it
  document.getElementById("userMenu")?.classList.add("hide");
  document.getElementById("userBtn")?.setAttribute("aria-expanded", "false");
  let reqs = [];
  try { reqs = (await D.requests.list()).requests.filter((r) => r.requested_by === profile.user_id); } catch {}
  if (!ctx.alive()) return;
  const perms = PERMISSIONS.filter((p) => p.cells[profile.role] !== "no");
  el.innerHTML = `
    ${head("Your profile", "Your account in this admin. An admin sets your role and store on the Users page.")}
    <div class="grid2">
      <section class="card" aria-labelledby="h-acct"><div class="card-head"><div><h3 id="h-acct">${icon("userCheck")}Account</h3><p>How you sign in and what you can see</p></div></div>
        <div class="me"><div class="avatar big" id="meAvatar" aria-hidden="true"></div><div><b id="meName"></b><span>${esc(profile.email)}</span></div></div>
        <dl class="facts one">
          <div><dt>Role</dt><dd>${badge(ROLE_LABEL[profile.role] || profile.role, profile.role === "admin" ? "orange" : profile.role === "manager" ? "blue" : "", true)}</dd></div>
          <div><dt>Store</dt><dd>${esc(profile.store || "No store")}</dd></div>
          <div><dt>Status</dt><dd>${badge("Active", "green")}</dd></div>
          <div><dt>Last sign-in</dt><dd title="${esc(fmtDateTime(profile.last_login_at))}">${esc(fmtAgo(profile.last_login_at))}</dd></div>
        </dl></section>
      <section class="card" aria-labelledby="h-name"><div class="card-head"><div><h3 id="h-name">${icon("edit")}Your name</h3><p>Shown to the team on requests, comments and in the audit log</p></div></div>
        <form id="nameForm" novalidate style="display:grid;gap:14px">
          <label class="field">Name<input name="name" maxlength="120" autocomplete="name" value="${esc(profile.full_name || "")}" placeholder="${esc(profile.email.split("@")[0])}"></label>
          <div class="msg bad hide" id="nameErr" role="alert"></div>
          <div><button class="btn primary" type="submit">${icon("check")}Save name</button></div>
        </form>
        <div class="card-head" style="margin:22px 0 12px"><div><h3>${icon("key")}Password and signing out</h3><p>Change your password, or sign out of this browser</p></div></div>
        <div class="tools"><button class="btn" id="mePw">${icon("key")}Change password</button><button class="btn" id="meOut">${icon("logout")}Sign out</button></div></section>
    </div>
    <section class="card" aria-labelledby="h-can"><div class="card-head"><div><h3 id="h-can">${icon("shield")}What your role can do</h3><p>${esc(ROLE_LABEL[profile.role] || profile.role)}. The database enforces it. <a href="#/roles">All roles</a></p></div></div>
      <ul class="can-list">${perms.map((p) => `<li class="${p.cells[profile.role]}">${p.cells[profile.role] === "yes" ? icon("check") : icon("eye")}<span>${esc(p.what)}${p.cells[profile.role] === "view" ? ` <i class="dim">(view only)</i>` : ""}</span></li>`).join("")}</ul></section>
    <section class="card" aria-labelledby="h-mine"><div class="card-head"><div><h3 id="h-mine">${icon("plus")}Your product requests</h3><p>${reqs.length ? `${reqs.filter((r) => OPEN.includes(r.status)).length} open · ${reqs.filter((r) => r.status === "live").length} live · ${reqs.length} in all` : "You haven’t asked for a product yet."}</p></div><a class="btn sm" href="#/requests?mine=1">Open requests</a></div></section>`;
  const $ = (id) => el.querySelector(`#${id}`);
  const paint = () => {
    const name = profile.full_name || profile.email.split("@")[0];
    $("meName").textContent = name;
    $("meAvatar").textContent = name[0].toUpperCase();
    // the sidebar's name and initial
    const side = document.querySelector(".side-foot");
    if (side) { side.querySelector(".who b").textContent = name; side.querySelector(".avatar").textContent = name[0].toUpperCase(); }
  };
  $("nameForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = e.target.querySelector("[type=submit]"), err = $("nameErr");
    b.disabled = true;
    try { const r = await D.setName(e.target.name.value.trim()); profile.full_name = r.full_name; paint(); err.classList.add("hide"); toast("Name saved."); }
    catch (x) { err.textContent = x.message; err.classList.remove("hide"); }
    finally { b.disabled = false; }
  });
  // the account menu's own buttons (app.js), so both work exactly as they do there
  $("mePw").addEventListener("click", () => document.getElementById("pwBtn")?.click());
  $("meOut").addEventListener("click", () => document.getElementById("outBtn")?.click());
  paint();
}
