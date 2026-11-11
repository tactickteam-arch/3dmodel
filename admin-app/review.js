// The admin's Testing pages: the review queue (#/review) and one product's review (#/review/<id>). Staff test a
// product on their own phones and headsets from the preview link (/p/<id>?preview=1), fill the checklist and give
// feedback with photos; an admin or manager then approves it (it goes on the catalogue at once, through live.js) or
// declines it (it comes off). Every rule is enforced by the database (pipeline/admin/schema.sql), not this page.
import { CATEGORIES, finishSlug } from "/site.js";
import { siteOrigin } from "./config.js";
import { esc, icon, badge, emptyState, errorBox, toast, formModal, copyText, qrSvg, fmtNum, fmtDateTime, fmtAgo } from "./ui.js";

export const DEVICE_LABEL = { iphone: "iPhone / iPad", android: "Android", headset: "Quest / headset", computer: "Computer" };
const DEVICE_SHORT = { iphone: "iPhone", android: "Android", headset: "Headset", computer: "Computer" };
const ALL = Object.keys(DEVICE_LABEL);
// the test checklist: key (kept in the database), what to check, and the device types it applies to
export const CHECKS = [
  ["ar_size", "Real size in iPhone AR", ["iphone"]],
  ["ar_android", "Android AR", ["android"]],
  ["headset", "Quest / headset", ["headset"]],
  ["doors", "Doors and drawers open right", ALL],
  ["colours", "Colours match the real product", ALL],
  ["labels", "Labels and logos readable", ALL],
  ["inside", "Inside: shelves and stock", ALL],
  ["size", "Size numbers right", ALL],
];
const AREAS = ["Doors and drawers", "Colours", "Labels and logos", "Inside", "Size numbers", "AR", "Headset", "Something else"];
const STATUS = { waiting: ["Waiting for review", "amber"], live: ["Live", "green"], declined: ["Declined", "red"], kept: ["Kept off the site", ""] };
const FILTERS = [["waiting", "Waiting for review"], ["live", "Live"], ["declined", "Declined"], ["feedback", "Has open feedback"], ["kept", "Kept off the site"]];
const PHOTO_MAX = 3, PHOTO_BYTES = 5 * 1024 * 1024, PHOTO_EDGE = 1600;
const keep = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
const catLabel = (value) => CATEGORIES.find(([v]) => v === value)?.[1] || value;
const nameOf = (p) => `${p.brand} ${p.shortName}`;
const who = (x) => x.name || x.by || "Someone";
const head = (title, text, tools = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ""}</div>${tools ? `<div class="tools">${tools}</div>` : ""}</div>`;
// two icons the shared set doesn't have
const svg = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  message: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  camera: svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>'),
};

// A product's place: approved is live and declined is off, whatever products.json says (live.js does the same on
// the site); with no decision, "awaitingReview" is waiting, "hidden" is kept off the site, and the rest are live.
export function statusOf(p, q) {
  if (q?.decision === "approved") return "live";
  if (q?.decision === "declined") return "declined";
  if (p.awaitingReview) return "waiting";
  return p.hidden ? "kept" : "live";
}
// the dashboard's two numbers: products waiting for a decision, and feedback not fixed yet (and on how many products)
export function reviewCounts(products, queue) {
  const byId = new Map(queue.map((q) => [q.product_id, q]));
  const ids = new Set(products.map((p) => p.id));
  const open = queue.filter((q) => ids.has(q.product_id) && q.open_feedback > 0);
  return { waiting: products.filter((p) => statusOf(p, byId.get(p.id)) === "waiting").length, open: open.reduce((n, q) => n + q.open_feedback, 0), openProducts: open.length };
}
const statusBadge = (s) => badge(STATUS[s][0], STATUS[s][1]);

export async function reviewPage(ctx) {
  return ctx.sub ? productReview(ctx, decodeURIComponent(ctx.sub)) : queuePage(ctx);
}

// ════════════════════════════════════════════════════════════════════════════ Review queue
async function queuePage(ctx) {
  const { el, api } = ctx;
  let products, queue;
  try { [products, queue] = await Promise.all([api.reviews.products(), api.reviews.queue()]); }
  catch (e) { el.innerHTML = head("Review queue", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  const byId = new Map(queue.map((q) => [q.product_id, q]));
  const rows = products.map((p) => { const q = byId.get(p.id); return { p, status: statusOf(p, q), open: q?.open_feedback || 0, last: q?.last_at || null }; });
  const brands = [...new Set(products.map((p) => p.brand))].sort();
  const asked = new URLSearchParams(location.hash.split("?")[1] || "").get("show");
  let f = FILTERS.some(([k]) => k === asked) ? asked : FILTERS.some(([k]) => k === keep.get("s3d-review-show")) ? keep.get("s3d-review-show") : "waiting";
  let q = "", brand = "";
  el.innerHTML = `
    ${head("Review queue", "New products wait here until the team has tested them. Open one to test it on a phone or headset, then approve it (it goes on the catalogue straight away) or decline it (it stays off, or comes off).")}
    ${api.mode === "demo" ? `<div class="note">${icon("info")}<div><b>In the demo,</b> the last three products on show are treated as new ones waiting for review, and the decisions, feedback and checks are sample data.</div></div>` : ""}
    <div class="toolbar">
      <input class="input search" type="search" id="q" placeholder="Search name or model" aria-label="Search products">
      <label><span class="sr">Brand</span><select class="select" id="brand"><option value="">All brands</option>${brands.map((b) => `<option>${esc(b)}</option>`).join("")}</select></label>
    </div>
    <div class="chips" role="group" aria-label="Show">${FILTERS.map(([k, l]) => `<button class="btn sm" data-f="${k}" aria-pressed="${k === f}">${esc(l)} <span class="dim" data-n="${k}"></span></button>`).join("")}</div>
    <div class="table-wrap rv-wrap"><table class="t"><thead><tr><th>Product</th><th>Status</th><th class="n">Open feedback</th><th>Last activity</th><th class="n">Actions</th></tr></thead><tbody id="rows"></tbody></table></div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  const fits = (r) => {
    const n = q.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (!brand || r.p.brand === brand) && (!n || `${r.p.brand}${r.p.name}${r.p.model}${r.p.id}`.toLowerCase().replace(/[^a-z0-9]/g, "").includes(n));
  };
  const inFilter = (r, k) => (k === "feedback" ? r.open > 0 : r.status === k);
  const EMPTY = {
    waiting: ["Nothing waiting for review", "New products show here when they are added for review.", true],
    live: ["No live product matches", ""], declined: ["Nothing declined", "Products the team declines show here.", true],
    feedback: ["No open feedback", "Feedback that isn’t fixed yet shows here.", true], kept: ["No product matches", ""],
  };
  function render() {
    const seen = rows.filter(fits);
    for (const [k] of FILTERS) el.querySelector(`[data-n="${k}"]`).textContent = fmtNum(seen.filter((r) => inFilter(r, k)).length);
    const list = seen.filter((r) => inFilter(r, f)).sort((a, b) => (b.last || "").localeCompare(a.last || ""));
    $("rows").innerHTML = list.length ? list.map(({ p, status, open, last }) => `<tr data-id="${esc(p.id)}">
        <td><div class="cell-main"><img src="${esc(p.thumb)}" alt="" loading="lazy"><div><b>${esc(nameOf(p))}</b><span>${esc(p.model)}</span></div></div></td>
        <td>${statusBadge(status)}</td>
        <td class="n">${open ? badge(fmtNum(open), "amber", true) : `<span class="dim">0</span>`}</td>
        <td title="${esc(last ? fmtDateTime(last) : "")}">${last ? esc(fmtAgo(last)) : `<span class="dim">—</span>`}</td>
        <td><div class="actions"><a class="btn sm${status === "waiting" ? " primary" : ""}" href="#/review/${esc(p.id)}" aria-label="Review ${esc(nameOf(p))}">${icon("eye")}Review</a></div></td></tr>`).join("")
      : `<tr><td colspan="5">${emptyState(...(q || brand ? ["No product matches", "Try another search or brand."] : EMPTY[f]))}</td></tr>`;
  }
  el.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => {
    f = b.dataset.f;
    keep.set("s3d-review-show", f);
    history.replaceState(history.state, "", `${location.pathname}${location.search}#/review?show=${f}`); // Back from a product returns here
    el.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));
  $("q").addEventListener("input", (e) => { q = e.target.value; render(); });
  $("brand").addEventListener("change", (e) => { brand = e.target.value; render(); });
  render();
}

// ════════════════════════════════════════════════════════════════════════════ One product's review
// The links product.html makes, rebuilt here so a tester can open them straight from this page:
const model = (url) => `${url}?v=7`; // the cache key product.html puts on model files
// iPhone, iPad and Vision Pro: Apple's AR view of that colour's USDZ, as product.html's openQuickLook() opens it
function quickLookUrl(p, f, page) {
  const o = siteOrigin();
  return `${o}${model(f.usdz)}#allowsContentScaling=0${o.startsWith("https:") ? `&custom=${o}/banners/${p.id}&customHeight=small` : ""}&canonicalWebPageURL=${encodeURIComponent(page)}`;
}
// Android without WebXR: Google's Scene Viewer, with the link model-viewer 4.0.0 (product.html's viewer) makes. It
// always shows the model's own colour, the first one.
function sceneViewerUrl(p, page) {
  const params = new URLSearchParams({ v: "7", mode: "ar_preferred", disable_occlusion: "true", resizable: "false" });
  if (p.placement === "wall") params.set("enable_vertical_placement", "true");
  return `intent://arvr.google.com/scene-viewer/1.2?${params}&file=${encodeURIComponent(siteOrigin() + model(p.glb))}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(page)};end;`;
}

async function productReview(ctx, id) {
  const { el, api, can } = ctx;
  let products, data;
  try { [products, data] = await Promise.all([api.reviews.products(), api.reviews.get(id)]); }
  catch (e) { el.innerHTML = backLink() + head("Product review", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  const p = products.find((x) => x.id === id);
  if (!p) { el.innerHTML = backLink() + head("Product not found", "") + emptyState("No product with this id", `“${id}” isn’t in /products.json. It may have been renamed.`); return; }
  const name = nameOf(p);
  ctx.crumb?.(`Review: ${p.model}`);
  document.title = `${name} · Review · 3D Catalogue Admin${api.mode === "demo" ? " (demo)" : ""}`;
  const finishes = p.finishes || [];
  let fi = 0;                                               // the colour shown and linked
  let device = ALL.includes(keep.get("s3d-test-device")) ? keep.get("s3d-test-device") : guessDevice();
  const pending = [];                                       // photos picked for the next feedback: { blob, url }

  el.innerHTML = `${backLink()}
    ${head(name, `Model ${p.model} · ${catLabel(p.category)}`, `<span id="statusBadge"></span>${can.write ? `<button class="btn primary" id="approve">${icon("check")}Approve</button><button class="btn danger" id="decline">${icon("x")}Decline</button>` : ""}`)}
    <div id="statusLine"></div>
    ${can.write ? "" : `<div class="note">${icon("eye")}<div><b>Only admins and managers approve or decline.</b> You can test it, fill the checklist and give feedback.</div></div>`}
    <div class="rv-top">
      <section class="card rv-view" aria-labelledby="h-view">
        <div class="card-head"><div><h3 id="h-view">${icon("cube")}3D preview</h3><p>The product page as testers see it. Drag to turn it; the buttons open the doors.</p></div></div>
        ${finishes.length > 1 ? `<div class="chips rv-colours" role="group" aria-label="Colour">${finishes.map((f, i) => `<button class="btn sm" data-fi="${i}" aria-pressed="${i === 0}"><i class="sw" style="background:${esc(f.swatchColor || "#888")}"></i>${esc(f.name)}</button>`).join("")}</div>` : ""}
        <div class="rv-frame"><iframe id="frame" title="3D preview of ${esc(name)}" allow="xr-spatial-tracking; fullscreen" loading="lazy"></iframe></div>
      </section>
      <section class="card" aria-labelledby="h-test">
        <div class="card-head"><div><h3 id="h-test">${icon("devices")}Test on a phone or headset</h3><p>Scan the code with the phone’s camera, or copy the link to a headset’s browser. It opens the product page, even though it isn’t on the catalogue yet.</p></div></div>
        <div id="testLinks"></div>
      </section>
    </div>
    <div class="grid2">
      <section class="card" aria-labelledby="h-facts"><div class="card-head"><div><h3 id="h-facts">${icon("info")}Key facts</h3><p>From /products.json</p></div></div><dl class="rv-facts" id="facts"></dl></section>
      <section class="card" aria-labelledby="h-hist"><div class="card-head"><div><h3 id="h-hist">${icon("history")}Decisions</h3><p>Every approve and decline, newest first</p></div></div><div id="history"></div></section>
    </div>
    <section class="section" aria-labelledby="h-checks">
      <div class="section-head"><div><h2 id="h-checks">Test checklist</h2><p>Mark what you checked on the device in your hand. Everyone’s marks are in the grid below.</p></div></div>
      <div class="rv-device"><span class="muted" id="devLabel">I’m testing on</span><div class="chips" role="group" aria-labelledby="devLabel">${ALL.map((d) => `<button class="btn sm" data-dev="${d}" aria-pressed="${d === device}">${esc(DEVICE_LABEL[d])}</button>`).join("")}</div></div>
      <div class="rv-checks" id="myChecks"></div>
      <h3 class="rv-sub">Everyone’s results</h3>
      <div class="table-wrap rv-wrap"><table class="t rv-grid"><thead><tr><th>Check</th>${ALL.map((d) => `<th class="c" title="${esc(DEVICE_LABEL[d])}">${esc(DEVICE_SHORT[d])}</th>`).join("")}</tr></thead><tbody id="grid"></tbody></table></div>
    </section>
    <section class="section" aria-labelledby="h-fb">
      <div class="section-head"><div><h2 id="h-fb">Feedback</h2><p id="fbSub">What testers saw. Admins and managers mark it fixed.</p></div></div>
      <form id="fbForm" class="rv-form" novalidate>
        <label class="field">What did you see? *<textarea name="body" id="fbBody" maxlength="2000" rows="3" placeholder="For example: the freezer door opens the wrong way on Android"></textarea></label>
        <div class="rv-row">
          <label class="field">Device<select name="device"><option value="">Not said</option>${ALL.map((d) => `<option value="${d}">${esc(DEVICE_LABEL[d])}</option>`).join("")}</select></label>
          <label class="field">Colour<select name="finish"><option value="">Not said</option>${finishes.map((f) => `<option>${esc(f.name)}</option>`).join("")}</select></label>
          <label class="field">Area<select name="area"><option value="">Not said</option>${AREAS.map((a) => `<option>${esc(a)}</option>`).join("")}</select></label>
        </div>
        <div class="rv-photos">
          <label class="btn" id="addPhoto">${IC.camera}Add photos<input type="file" id="fbPhotos" accept="image/*" multiple class="sr"></label>
          <span class="help muted">Up to ${PHOTO_MAX}. Each is made smaller before it is sent.</span>
          <div class="rv-thumbs" id="fbThumbs"></div>
        </div>
        <div class="msg bad hide" id="fbErr" role="alert"></div>
        <div><button class="btn primary" type="submit" id="fbSend">${IC.message}Send feedback</button></div>
      </form>
      <div id="fbList"></div>
    </section>`;
  const $ = (x) => el.querySelector(`#${x}`);

  // the address a tester opens: the product page with ?preview=1, in the chosen colour
  const previewUrl = (i = fi, origin = siteOrigin()) => `${origin}/p/${encodeURIComponent(p.id)}?preview=1${finishes.length > 1 ? `&finish=${finishSlug(finishes[i].name)}` : ""}`;
  const decision = () => data.history[0] || null;
  const status = () => statusOf(p, decision());

  function renderStatus() {
    const s = status(), d = decision();
    $("statusBadge").innerHTML = statusBadge(s);
    const by = d ? ` by ${esc(who(d))}, <span title="${esc(fmtDateTime(d.at))}">${esc(fmtAgo(d.at))}</span>` : "";
    const text = {
      waiting: `<b>Waiting for review.</b> It isn’t on the catalogue. Test it with the links below, then approve or decline it.`,
      live: d ? `<b>Live on the catalogue.</b> Approved${by}.` : `<b>Live on the catalogue.</b> It is on show in /products.json; nobody has approved or declined it here.`,
      declined: `<b>Declined${by}.</b> It isn’t on the catalogue.${d?.note ? ` Reason: “${esc(d.note)}”` : ""}`,
      kept: `<b>Kept off the site.</b> It was taken off the catalogue on purpose. Approving it puts it back on show.`,
    }[s];
    $("statusLine").innerHTML = `<div class="banner rv-status ${s}">${icon(s === "live" ? "checkCircle" : s === "declined" ? "x" : s === "waiting" ? "clock" : "eyeOff")}<div>${text}</div></div>`;
  }

  function renderView() {
    $("frame").src = `/p/${encodeURIComponent(p.id)}?preview=1&embed${finishes.length > 1 ? `&finish=${finishSlug(finishes[fi].name)}` : ""}`;
    el.querySelectorAll("[data-fi]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.fi === fi)));
  }

  function renderLinks() {
    const page = previewUrl();
    const f = finishes[fi];
    $("testLinks").innerHTML = `
      ${finishes.length > 1 ? `<label class="field rv-colour">Colour<select id="linkColour">${finishes.map((x, i) => `<option value="${i}" ${i === fi ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>` : ""}
      <div class="rv-qr"><div class="qr" role="img" aria-label="QR code for the preview link">${qrSvg(page)}</div></div>
      <div class="linkbox"><code title="${esc(page)}">${esc(page)}</code><button class="btn sm" data-copy="${esc(page)}">${icon("copy")}Copy</button></div>
      <div class="rv-links">
        <a class="btn sm" href="${esc(previewUrl(fi, location.origin))}" target="_blank" rel="noopener">${icon("external")}Open the preview here</a>
      </div>
      <h4 class="rv-sub">Straight into AR${finishes.length > 1 ? ` · ${esc(f.name)}` : ""}</h4>
      <ul class="rv-ar">
        <li><div><b>iPhone / iPad</b><span>Apple’s AR view of this colour. Tap it on the iPhone or iPad itself.</span></div>
          <div class="actions"><button class="btn sm" data-ql="${esc(quickLookUrl(p, f, page))}">${icon("cube")}Open</button><button class="btn sm icon" data-copy="${esc(quickLookUrl(p, f, page))}" aria-label="Copy the iPhone AR link">${icon("copy")}</button></div></li>
        <li><div><b>Android (Scene Viewer)</b><span>Google’s AR view. It always shows the first colour${finishes.length > 1 ? ` (${esc(finishes[0].name)})` : ""}; for the others, open the preview link and press the AR button.</span></div>
          <div class="actions"><a class="btn sm" id="svLink" href="${esc(sceneViewerUrl(p, page))}">${icon("cube")}Open</a><button class="btn sm icon" data-copy="${esc(sceneViewerUrl(p, page))}" aria-label="Copy the Android AR link">${icon("copy")}</button></div></li>
        <li><div><b>Meta Quest</b><span>Open the preview link in the headset’s browser, then press the AR button for passthrough.</span></div></li>
      </ul>`;
    $("linkColour")?.addEventListener("change", (e) => { fi = +e.target.value; renderView(); renderLinks(); });
  }

  function renderFacts() {
    const cap = (p.specs || []).find(([k]) => /capacity/i.test(k));
    const link = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}${icon("external")}</a>` : `<span class="dim">—</span>`);
    const rows = [
      ["Size", `${esc(p.size.w)} W × ${esc(p.size.h)} H × ${esc(p.size.d)} D${p.sizeNote ? `<span class="dim rv-small">${esc(p.sizeNote)}</span>` : ""}`],
      cap && [esc(cap[0]), esc(cap[1])],
      [finishes.length === 1 ? "Colour" : `Colours (${finishes.length})`, finishes.map((f) => `<span class="rv-sw"><i class="sw" style="background:${esc(f.swatchColor || "#888")}"></i>${esc(f.name)}${f.code ? ` <span class="dim">${esc(f.code)}</span>` : ""}</span>`).join("")],
      ["Sangeetha page", link(p.sangeethaUrl || finishes.find((f) => f.sangeethaUrl)?.sangeethaUrl, "sangeetha.com")],
      [`${esc(p.brand)} page`, link(p.source, "The maker’s page")],
      ["In /products.json", p.awaitingReview ? "Hidden, waiting for review" : p.hidden ? "Hidden" : "On show"],
    ].filter(Boolean);
    $("facts").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }

  function renderHistory() {
    $("history").innerHTML = data.history.length ? `<ol class="rv-hist">${data.history.map((d) => `<li>
        <div class="rv-hist-top">${d.decision === "approved" ? badge("Approved", "green") : badge("Declined", "red")}<span>${esc(who(d))}</span><span class="dim" title="${esc(fmtDateTime(d.at))}">${esc(fmtDateTime(d.at))}</span></div>
        ${d.note ? `<p>${esc(d.note)}</p>` : ""}</li>`).join("")}</ol>`
      : emptyState("No decision yet", can.write ? "Approve or decline it once it has been tested." : "An admin or manager decides once it has been tested.");
  }

  // ── the checklist ──
  const marks = (item, dev) => data.checks.filter((c) => c.item === item && c.device === dev);
  function renderChecks() {
    el.querySelectorAll("[data-dev]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dev === device)));
    const items = CHECKS.filter(([, , devs]) => devs.includes(device));
    $("myChecks").innerHTML = items.map(([key, label]) => {
      const mine = marks(key, device).find((c) => c.mine)?.result || "untested";
      return `<div class="rv-check" data-item="${key}"><span>${esc(label)}</span><div class="seg" role="group" aria-label="${esc(label)} on ${esc(DEVICE_LABEL[device])}">
        ${[["pass", "Pass", "check"], ["fail", "Fail", "x"], ["untested", "Not tested", ""]].map(([v, l, ic]) => `<button class="btn sm ${v}" data-mark="${v}" aria-pressed="${mine === v}">${ic ? icon(ic) : ""}${l}</button>`).join("")}</div></div>`;
    }).join("");
    $("grid").innerHTML = CHECKS.map(([key, label, devs]) => `<tr><td class="wrap">${esc(label)}</td>${ALL.map((d) => {
      if (!devs.includes(d)) return `<td class="c na" title="Doesn’t apply"><span class="sr">Doesn’t apply</span>·</td>`;
      const m = marks(key, d), pass = m.filter((c) => c.result === "pass"), fail = m.filter((c) => c.result === "fail");
      if (!m.length) return `<td class="c dim" title="Not tested yet">—</td>`;
      const names = m.map((c) => `${who(c)}: ${c.result === "pass" ? "pass" : "fail"}`).join("\n");
      return `<td class="c" title="${esc(names)}">${pass.length ? `<span class="ok">${icon("check")}${pass.length}</span>` : ""}${fail.length ? `<span class="bad">${icon("x")}${fail.length}</span>` : ""}<span class="sr">${esc(names)}</span></td>`;
    }).join("")}</tr>`).join("");
  }
  el.querySelectorAll("[data-dev]").forEach((b) => b.addEventListener("click", () => { device = b.dataset.dev; keep.set("s3d-test-device", device); renderChecks(); }));
  $("myChecks").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-mark]");
    if (!b || b.getAttribute("aria-pressed") === "true") return;
    const item = b.closest("[data-item]").dataset.item;
    b.closest(".seg").querySelectorAll("button").forEach((x) => (x.disabled = true));
    try { await api.reviews.check(p.id, item, device, b.dataset.mark); await reload(); }
    catch (err) { toast(err.message, true); renderChecks(); }
  });

  // ── feedback ──
  const tags = (f) => [f.device && DEVICE_LABEL[f.device], f.finish, f.area].filter(Boolean);
  async function renderFeedback() {
    const open = data.feedback.filter((f) => f.status === "open").length;
    $("fbSub").textContent = data.feedback.length ? `${open} open, ${data.feedback.length - open} fixed. Admins and managers mark it fixed.` : "What testers saw. Admins and managers mark it fixed.";
    $("fbList").innerHTML = data.feedback.length ? `<ol class="rv-fb">${data.feedback.map((f) => `<li data-fb="${f.id}" class="${f.status}">
        <div class="rv-fb-top"><b>${esc(who(f))}</b><span class="dim" title="${esc(fmtDateTime(f.at))}">${esc(fmtAgo(f.at))}</span>${f.status === "open" ? badge("Open", "amber") : badge("Fixed", "green")}
          ${can.write ? `<span class="spacer"></span><button class="btn sm" data-fbset="${f.status === "open" ? "fixed" : "open"}">${f.status === "open" ? `${icon("check")}Mark fixed` : `${icon("refresh")}Open again`}</button>` : ""}</div>
        ${tags(f).length ? `<div class="rv-tags">${tags(f).map((t) => `<span class="badge plain">${esc(t)}</span>`).join("")}</div>` : ""}
        <p>${esc(f.body)}</p>
        ${f.photos?.length ? `<div class="rv-thumbs">${f.photos.map((ph, i) => `<a class="rv-thumb" data-photo="${esc(ph)}" target="_blank" rel="noopener" aria-label="Photo ${i + 1} from ${esc(who(f))}"><span class="dim">…</span></a>`).join("")}</div>` : ""}
        ${f.status === "fixed" && f.status_at ? `<div class="dim rv-small">Marked fixed by ${esc(f.status_by || "someone")}, ${esc(fmtAgo(f.status_at))}</div>` : ""}</li>`).join("")}</ol>`
      : emptyState("No feedback yet", "Anything a tester notices goes here.");
    const paths = data.feedback.flatMap((f) => f.photos || []);
    if (!paths.length) return;
    let urls = {};
    try { urls = await api.reviews.photoUrls(paths); } catch {}
    if (!ctx.alive()) return;
    el.querySelectorAll("[data-photo]").forEach((a) => {
      const u = urls[a.dataset.photo];
      if (u) { a.href = u; a.innerHTML = `<img src="${esc(u)}" alt="" loading="lazy">`; } else a.innerHTML = `<span class="dim rv-small">Photo not available</span>`;
    });
  }
  $("fbList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-fbset]");
    if (!b) return;
    b.disabled = true;
    try { await api.reviews.setFeedback(Number(b.closest("[data-fb]").dataset.fb), b.dataset.fbset); toast(b.dataset.fbset === "fixed" ? "Marked fixed." : "Open again."); await reload(); }
    catch (err) { toast(err.message, true); b.disabled = false; }
  });
  function renderThumbs() {
    $("fbThumbs").innerHTML = pending.map((x, i) => `<div class="rv-thumb"><img src="${x.url}" alt="Photo ${i + 1} to send"><button type="button" class="btn sm icon" data-unpick="${i}" aria-label="Remove photo ${i + 1}">${icon("x")}</button></div>`).join("");
    $("addPhoto").classList.toggle("hide", pending.length >= PHOTO_MAX);
  }
  const fbError = (text) => { $("fbErr").textContent = text || ""; $("fbErr").classList.toggle("hide", !text); };
  $("fbPhotos").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    fbError("");
    if (pending.length + files.length > PHOTO_MAX) fbError(`Up to ${PHOTO_MAX} photos. The first ${PHOTO_MAX - pending.length} are kept.`);
    for (const file of files.slice(0, PHOTO_MAX - pending.length)) {
      try { const blob = await shrinkPhoto(file); pending.push({ blob, url: URL.createObjectURL(blob) }); }
      catch (err) { fbError(err.message); }
    }
    renderThumbs();
  });
  $("fbThumbs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-unpick]");
    if (!b) return;
    const [x] = pending.splice(+b.dataset.unpick, 1);
    URL.revokeObjectURL(x.url);
    renderThumbs();
  });
  $("fbForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target).entries());
    if (!v.body.trim()) { fbError("Write what you saw."); $("fbBody").focus(); return; }
    fbError("");
    $("fbSend").disabled = true;
    try {
      await api.reviews.addFeedback({ product: p.id, body: v.body.trim(), device: v.device, finish: v.finish, area: v.area, photos: pending.map((x) => x.blob) });
      e.target.reset();
      pending.splice(0).forEach((x) => URL.revokeObjectURL(x.url));
      renderThumbs();
      toast("Feedback sent.");
      await reload();
    } catch (err) { fbError(err.message); }
    finally { $("fbSend").disabled = false; }
  });

  // ── approve and decline (the database refuses both for viewers, whatever this page shows) ──
  const label = `${name} (${p.model})`;
  $("approve")?.addEventListener("click", () => formModal({
    title: `Approve ${name}?`,
    sub: status() === "live" ? "It stays on the catalogue. This records that it was tested and approved." : "It goes on the catalogue straight away, for every shopper.",
    fields: [{ name: "note", label: "Note (optional)", type: "textarea", max: 500, help: "For example: checked on iPhone, Android and Quest." }],
    submit: "Approve",
    onSubmit: async (v, d) => { await api.reviews.decide(p.id, "approved", v.note.trim(), label); d.close(); toast(`${name} approved.`); await reload(); },
  }));
  $("decline")?.addEventListener("click", () => formModal({
    title: `Decline ${name}?`,
    sub: status() === "live" ? "It comes off the catalogue straight away. Say what has to change, so it can be fixed." : "It stays off the catalogue. Say what has to change, so it can be fixed.",
    fields: [{ name: "note", label: "Reason", type: "textarea", max: 500, required: true, help: "Required. For example: the handle is the wrong colour." }],
    submit: "Decline",
    onSubmit: async (v, d) => {
      if (v.note.trim().length < 3) throw new Error("Say why it is declined.");
      await api.reviews.decide(p.id, "declined", v.note.trim(), label); d.close(); toast(`${name} declined.`); await reload();
    },
  }));

  el.querySelectorAll("[data-fi]").forEach((b) => b.addEventListener("click", () => { fi = +b.dataset.fi; renderView(); renderLinks(); }));
  $("testLinks").addEventListener("click", (e) => {
    const c = e.target.closest("[data-copy]"), ql = e.target.closest("[data-ql]");
    if (c) copyText(c.dataset.copy);
    if (ql) openQuickLook(ql.dataset.ql);
  });

  async function reload() {
    const next = await api.reviews.get(p.id);
    if (!ctx.alive()) return;
    data = next;
    renderStatus(); renderHistory(); renderChecks(); await renderFeedback();
  }
  renderStatus(); renderView(); renderLinks(); renderFacts(); renderHistory(); renderChecks();
  await renderFeedback();
}

// Apple's AR view opens from a link marked rel="ar" whose only child is an image, as product.html opens it
function openQuickLook(url) {
  const a = document.createElement("a");
  a.rel = "ar";
  a.href = url;
  a.appendChild(document.createElement("img"));
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}
const backLink = () => `<div><a class="btn sm ghost rv-back" href="#/review">${icon("chevron")}Review queue</a></div>`;
// the device in the tester's hand, as a first guess for the checklist
function guessDevice() {
  const ua = navigator.userAgent;
  if (/OculusBrowser|Quest|Pico|Wolvic/i.test(ua)) return "headset";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iphone";
  return "computer";
}

// A photo made smaller in the browser before it is sent: a JPEG at most 1600 px on its long side and under 5 MB.
async function shrinkPhoto(file) {
  if (!/^image\//.test(file.type || "image/")) throw new Error(`${file.name} isn’t a photo.`);
  if (file.size > 40 * 1024 * 1024) throw new Error(`${file.name} is too big to read (over 40 MB).`);
  let img;
  try { img = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch {
    try { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
    catch { throw new Error(`${file.name} can’t be read here. Use a JPG or PNG photo.`); }
  }
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
  const k = Math.min(1, PHOTO_EDGE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  img.close?.();
  if (img.src) URL.revokeObjectURL(img.src);
  for (const q of [0.82, 0.7, 0.55]) {
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= PHOTO_BYTES) return blob;
  }
  throw new Error(`${file.name} is still over 5 MB after making it smaller.`);
}
