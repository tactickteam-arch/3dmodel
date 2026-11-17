// The 3D tracker (#/tracker, and #/tracker/<item id> for one item): every item from Sangeetha's item master and
// where its 3D model is, for the whole team. Summary cards like the spreadsheet's Dashboard, filters, CSV, and one
// item's details with its history and comments. Admins and managers also set an item's status, owner, due date and
// priority, and import the tracker spreadsheet (.xlsx, read in the browser with SheetJS).
// An item whose code is a colour of a product on show is live: the page shows it so, and an admin or manager opening
// the page records it (s3d_tracker_live), which tells the team like any status change. The database enforces every
// rule (pipeline/admin/schema.sql); the data, live or demo, is in tracker-data.js.
import { CATEGORIES } from "/site.js";
import { siteOrigin, SHEETJS } from "./config.js";
import { esc, icon, badge, statCard, emptyState, errorBox, toast, modal, downloadCsv, fmtNum, fmtPct, fmtDate, fmtDateTime, fmtAgo, istDay } from "./ui.js";
import { ACTION_LABEL } from "./pages.js";
import { trackerData, siteCodes, codeKey, itemName, sheetFields, cleanText, SHEET_KEYS, STATUS, BUILT, NOT_BUILT, PRIORITY } from "./tracker-data.js";

for (const css of ["/admin-app/tools.css", "/admin-app/tracker.css"]) if (!document.querySelector(`link[href="${css}"]`)) document.head.insertAdjacentHTML("beforeend", `<link rel="stylesheet" href="${css}">`);

// the audit log's names for what this page writes
Object.assign(ACTION_LABEL, { tracker_updated: "Tracker item changed", tracker_commented: "Tracker comment", tracker_import: "Tracker imported" });

const head = (title, text, tools = "") => `<div class="page-head"><div><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ""}</div>${tools ? `<div class="tools">${tools}</div>` : ""}</div>`;
const catLabel = (v) => CATEGORIES.find(([c]) => c === v)?.[1] || v;
const day = (d) => (d ? fmtDate(`${d}T12:00:00+05:30`) : "—");
const statusBadge = (s) => badge(STATUS[s]?.[0] || s, STATUS[s]?.[1] || "");
const yes = (v) => (v ? "Yes" : "No");
const PAGE = 100;

// ════════════════════════════════════════════════════════════════════════════ Reading the spreadsheet
let xlsxReq = null;
function loadSheetJs() {
  if (window.XLSX?.read) return Promise.resolve(window.XLSX);
  return (xlsxReq ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SHEETJS.src;
    s.integrity = SHEETJS.integrity;
    s.crossOrigin = "anonymous";
    s.onload = () => (window.XLSX?.read ? resolve(window.XLSX) : reject(new Error("The spreadsheet reader didn’t start. Reload the page.")));
    s.onerror = () => { xlsxReq = null; s.remove(); reject(new Error("The spreadsheet reader couldn’t load. Check the connection and try again.")); };
    document.head.appendChild(s);
  }));
}

// the sheet's words for a status ("Built - in review", "Live on site" …), or null if it isn't one
const STATUS_WORDS = { liveonsite: "live", live: "live", builtinreview: "review", inreview: "review", builthidden: "hidden", hidden: "hidden", inprogress: "in_progress", blocked: "blocked", notstarted: "not_started", "": "not_started" };
const statusOfText = (v) => STATUS_WORDS[String(v ?? "").toLowerCase().replace(/[^a-z]/g, "")] ?? null;
// a sheet's name ("Refrigerators") or a Category cell ("Refrigerator") as the catalogue's category
function categoryOf(v) {
  const s = String(v ?? "").trim(), k = s.toLowerCase();
  if (/refrig|fridge/.test(k)) return "Refrigerator";
  if (/air ?condition|^acs?$/.test(k)) return "Air conditioner";
  if (/wash/.test(k)) return "Washing machine";
  return s;
}
const flag = (v) => { const s = String(v ?? "").trim().toLowerCase(); return !!s && !["no", "n", "false", "0", "-", "—"].includes(s); };
function dateOf(v) {
  if (v instanceof Date && !Number.isNaN(+v)) { const d = new Date(v.getTime() + 12 * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  const m = String(v ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// Every item row of the workbook: each sheet with a header row naming "Item Code" (or "Code") and "3D Status"; its
// columns are found by their headings, so a sheet may leave some out. Sheets without one (Dashboard, How to read)
// are passed over. { rows, sheets: [{ name, n }], skipped: [{ sheet, line, code, why }] }
export function readTracker(XLSX, wb) {
  const rows = [], sheets = [], skipped = [], seen = new Set();
  const norm = (v) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws?.["!ref"]) continue;
    const start = XLSX.utils.decode_range(ws["!ref"]).s;
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const h = aoa.slice(0, 40).findIndex((r) => r.some((c) => /^(item )?code$/.test(norm(c))) && r.some((c) => norm(c) === "3d status"));
    if (h < 0) continue;
    const hdr = aoa[h].map(norm);
    const col = (re) => hdr.findIndex((x) => re.test(x));
    const C = {
      code: col(/^(item )?code$/), model: col(/^item ?\/ ?model$|^model$/), brand: col(/^brand$/), created: col(/^created on$/), status: col(/^3d status$/),
      colour: col(/^colou?r( built)?$/), product: col(/^our product id$/), link: col(/^3d link$/), prior: col(/^in .*sheet$|earlier vendor/), ref: col(/ref list/),
      notes: col(/^notes?$/), category: col(/^category$/), source: col(/^source$/),
    };
    const at = (r, k) => (C[k] >= 0 ? r[C[k]] : null);
    const inMaster = !/not in (the )?master/i.test(name);
    let n = 0;
    aoa.slice(h + 1).forEach((r, i) => {
      const code = cleanText(at(r, "code"), 80), line = start.r + h + 2 + i;
      if (!code) return;
      const category = cleanText(categoryOf(C.category >= 0 ? at(r, "category") : name), 60);
      const status = statusOfText(at(r, "status"));
      const k = `${category}\u0001${code}`;
      if (status === null) { skipped.push({ sheet: name, line, code, why: `Unknown status “${String(at(r, "status")).slice(0, 40)}”` }); return; }
      if (!category) { skipped.push({ sheet: name, line, code, why: "No category" }); return; }
      if (seen.has(k)) { skipped.push({ sheet: name, line, code, why: "The same code is on an earlier row" }); return; }
      seen.add(k);
      // the 3D link is the cell's hyperlink ("Open 3D"), or a link written out in it
      const cell = C.link >= 0 ? ws[XLSX.utils.encode_cell({ r: start.r + h + 1 + i, c: start.c + C.link })] : null;
      const text = String(at(r, "link") ?? "").trim();
      rows.push({
        category, item_code: code, model: at(r, "model"), brand: at(r, "brand"), created_on: dateOf(at(r, "created")), status,
        colour: at(r, "colour"), product_id: at(r, "product"), link: cell?.l?.Target || (/^https:\/\//.test(text) ? text : null),
        prior_list: flag(at(r, "prior")), ref_list: flag(at(r, "ref")), in_master: inMaster, source: inMaster ? null : at(r, "source"),
        notes: at(r, "notes") === null ? null : String(at(r, "notes")),
      });
      n++;
    });
    sheets.push({ name, n });
  }
  // only what the database takes, as text, numbers and true/false
  return { rows: rows.map((e) => ({ category: e.category, item_code: e.item_code, ...sheetFields({ ...e, model: e.model ?? null, brand: e.brand ?? null, colour: e.colour ?? null, source: e.source ?? null }) })), sheets, skipped };
}

// ════════════════════════════════════════════════════════════════════════════ The page
export async function trackerPage(ctx) {
  const { el, api, profile, can } = ctx;
  const D = trackerData(api);
  let rows = [], staff = [], site = new Map(), imports = [], synced = 0;
  const load = async () => {
    [rows, staff, site, imports] = await Promise.all([D.tracker.list(), D.staff().catch(() => []), siteCodes(api).catch(() => new Map()), D.tracker.imports().catch(() => [])]);
  };
  try { await load(); } catch (e) { el.innerHTML = head("Tracker", "") + errorBox(e); return; }
  if (!ctx.alive()) return;
  const onSite = (t) => site.get(codeKey(t.item_code)) || null;
  const stale = () => rows.filter((t) => t.status !== "live" && onSite(t));
  // On the site but not "Live on site" in the tracker yet: an admin or manager records it (once: an item already
  // live is left alone), and the team is told as for any status change.
  if (can.write && stale().length) {
    try {
      synced = await D.tracker.markLive(stale().map((t) => ({ id: t.id, product: onSite(t).p.id, colour: onSite(t).f.name })));
      rows = await D.tracker.list();
    } catch (e) { toast(`Couldn’t mark the items on the site live: ${e.message}`, true); }
    if (!ctx.alive()) return;
  }
  const shown = (t) => (onSite(t) ? "live" : t.status);   // what the page shows: the site wins
  const late = (t) => !!t.due_on && t.due_on < istDay() && NOT_BUILT.includes(shown(t));
  const person = (id) => staff.find((s) => s.user_id === id) || null;
  const personName = (id) => (id ? person(id)?.name || "A former user" : "Nobody");
  const qs = new URLSearchParams(location.hash.split("?")[1] || "");
  const f = { q: qs.get("q") || "", cat: qs.get("cat") || "", brand: qs.get("brand") || "", status: qs.get("status") || "", who: qs.get("who") || "", late: qs.get("late") === "1" };
  let limit = PAGE;
  const cats = [...new Set([...CATEGORIES.map(([v]) => v).filter((c) => rows.some((t) => t.category === c)), ...rows.map((t) => t.category)])];
  const brands = [...new Set(rows.map((t) => t.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
  const waiting = stale().length;
  el.innerHTML = `
    ${head("Tracker", "Every item from Sangeetha’s item master and where its 3D model is. Items on the site show as Live on site by themselves. Open an item to see its history and comment on it.",
      `<button class="btn" id="csv">${icon("download")}Export CSV</button>${can.write ? `<button class="btn primary" id="import">${icon("upload")}Import spreadsheet</button>` : ""}`)}
    ${api.mode === "demo" ? `<div class="note">${icon("info")}<div><b>In the demo,</b> the items are every colour in the catalogue (/products.json) plus made-up “SAMPLE-” items. Owners, dates, comments and notifications are sample data. The real tracker comes from importing the tracker spreadsheet.</div></div>` : ""}
    ${synced ? `<div class="msg good" id="synced">${fmtNum(synced)} ${synced === 1 ? "item is" : "items are"} on the site, so ${synced === 1 ? "it is" : "they are"} now marked Live on site. The team has been told.</div>` : ""}
    ${!can.write && waiting ? `<div class="note">${icon("info")}<div><b>${fmtNum(waiting)} ${waiting === 1 ? "item is" : "items are"} on the site</b> but not marked live in the tracker yet. ${waiting === 1 ? "It shows" : "They show"} as Live on site here; the next admin or manager to open this page records it.</div></div>` : ""}
    <div class="stats" id="stats"></div>
    <div class="grid3">
      <div class="card"><div class="card-head"><div><h3>${icon("chart")}By status</h3><p>Every item in the tracker</p></div></div><div id="byStatus"></div></div>
      <div class="card"><div class="card-head"><div><h3>${icon("grid")}By category</h3><p>Built of all items</p></div></div><div id="byCat"></div></div>
      <div class="card"><div class="card-head"><div><h3>${icon("box")}By brand</h3><p>Built of all items, the 8 biggest brands</p></div></div><div id="byBrand"></div></div>
    </div>
    <div class="toolbar" role="group" aria-label="Filters">
      <input class="input search" type="search" id="q" placeholder="Search item code or model" aria-label="Search item code or model" value="${esc(f.q)}">
      <label><span class="sr">Category</span><select class="select" id="fcat">${opt("", "All categories", f.cat)}${cats.map((c) => opt(c, catLabel(c), f.cat)).join("")}</select></label>
      <label><span class="sr">Brand</span><select class="select" id="fbrand">${opt("", "All brands", f.brand)}${brands.map((b) => opt(b, b, f.brand)).join("")}</select></label>
      <label><span class="sr">Status</span><select class="select" id="fstatus">${opt("", "Any status", f.status)}${opt("built", "Built (any)", f.status)}${Object.entries(STATUS).map(([k, [l]]) => opt(k, l, f.status)).join("")}</select></label>
      <label><span class="sr">Assigned to</span><select class="select" id="fwho">${opt("", "Anyone or nobody", f.who)}${opt("me", "Assigned to me", f.who)}${opt("none", "Nobody yet", f.who)}${staff.map((s) => opt(s.user_id, s.name, f.who)).join("")}</select></label>
      <button class="btn sm" id="flate" aria-pressed="${f.late}">${icon("clock")}Past due</button>
    </div>
    <p class="muted" id="count" aria-live="polite" style="margin:-8px 0 0"></p>
    <div class="table-wrap"><table class="t tr-table"><thead><tr><th>Item</th><th>Category</th><th>Brand</th><th>3D status</th><th>Colour built</th><th>Assigned to</th><th>Due</th><th>Priority</th><th class="n">Comments</th><th class="n"><span class="sr">Open</span></th></tr></thead><tbody id="rows"></tbody></table></div>
    <div class="table-foot"><span id="foot"></span><button class="btn sm" id="more">Show ${PAGE} more</button></div>
    <p class="dim tr-last" id="last"></p>`;
  const $ = (id) => el.querySelector(`#${id}`);

  function summary() {
    const n = rows.length, count = (s) => rows.filter((t) => shown(t) === s).length, built = rows.filter((t) => BUILT.includes(shown(t))).length;
    const mine = rows.filter((t) => t.assignee === profile.user_id && NOT_BUILT.includes(shown(t))).length, overdue = rows.filter(late).length;
    $("stats").innerHTML = [
      statCard({ title: "Items tracked", value: fmtNum(n), ic: "tracker", sub: `${cats.length} ${cats.length === 1 ? "category" : "categories"}` }),
      statCard({ title: "3D built", value: fmtNum(built), ic: "cube", tone: "blue", sub: "Live, in review or hidden" }),
      statCard({ title: "Live on site", value: fmtNum(count("live")), ic: "checkCircle", tone: "green" }),
      statCard({ title: "Share built", value: fmtPct(built, n, 1), ic: "chart", tone: "orange", sub: `${fmtNum(n - built)} still to build` }),
      statCard({ title: "In progress", value: fmtNum(count("in_progress")), ic: "activity", tone: "amber" }),
      statCard({ title: "Blocked", value: fmtNum(count("blocked")), ic: "alert", tone: count("blocked") ? "red" : "" }),
      statCard({ title: "Not started", value: fmtNum(count("not_started")), ic: "clock" }),
      statCard({ title: "Past due", value: fmtNum(overdue), ic: "clock", tone: overdue ? "red" : "", sub: "Not built, due date passed" }),
      statCard({ title: "Yours to build", value: fmtNum(mine), ic: "userCheck", sub: "Assigned to you, not built" }),
    ].join("");
    const max = Math.max(1, ...Object.keys(STATUS).map(count));
    $("byStatus").innerHTML = `<div class="bars">${Object.entries(STATUS).map(([k, [l, tone]]) => `<div class="bar-row"><div class="l"><span>${esc(l)}</span><span>${fmtNum(count(k))}</span></div><div class="track tr-${tone || "grey"}"><i style="width:${(100 * count(k)) / max}%"></i></div></div>`).join("")}</div>`;
    const share = (list) => list.length ? `<div class="bars">${list.map((x) => `<div class="bar-row"><div class="l"><span>${esc(x.label)}</span><span>${fmtNum(x.built)} of ${fmtNum(x.total)} · ${fmtPct(x.built, x.total)}</span></div><div class="track green"><i style="width:${x.total ? (100 * x.built) / x.total : 0}%"></i></div></div>`).join("")}</div>` : emptyState("Nothing yet", "Import the tracker spreadsheet.");
    const group = (key, label) => [...new Set(rows.map((t) => t[key]).filter(Boolean))].map((v) => { const ts = rows.filter((t) => t[key] === v); return { label: label(v), total: ts.length, built: ts.filter((t) => BUILT.includes(shown(t))).length }; });
    $("byCat").innerHTML = share(group("category", catLabel).sort((a, b) => b.total - a.total));
    $("byBrand").innerHTML = share(group("brand", (v) => v).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)).slice(0, 8));
    const li = imports[0];
    $("last").textContent = li ? `Last import: ${fmtDateTime(li.at)}${li.actor_name || li.actor_email ? ` by ${li.actor_name || li.actor_email.split("@")[0]}` : ""}${li.file_name ? ` (${li.file_name})` : ""}: ${li.added} new, ${li.changed} changed, ${li.unchanged} unchanged.` : "The tracker spreadsheet hasn’t been imported yet.";
  }

  const matches = (t) => {
    const n = f.q.toUpperCase().replace(/[^A-Z0-9]+/g, ""), s = shown(t);
    return (!f.cat || t.category === f.cat) && (!f.brand || t.brand === f.brand)
      && (!f.status || (f.status === "built" ? BUILT.includes(s) : s === f.status))
      && (!f.who || (f.who === "me" ? t.assignee === profile.user_id : f.who === "none" ? !t.assignee : t.assignee === f.who))
      && (!f.late || late(t))
      && (!n || codeKey(`${t.item_code} ${t.model || ""}`).includes(n));
  };
  const filtered = () => rows.filter(matches);
  function render() {
    const list = filtered(), part = list.slice(0, limit);
    $("count").textContent = list.length === rows.length ? `${fmtNum(rows.length)} items` : `${fmtNum(list.length)} of ${fmtNum(rows.length)} items`;
    $("rows").innerHTML = part.length ? part.map((t) => {
      const s = shown(t), lt = late(t);
      return `<tr data-id="${t.id}" tabindex="0" class="tr-row${lt ? " late" : ""}" aria-label="${esc(t.item_code)}, ${esc(STATUS[s]?.[0] || s)}">
        <td class="wrap"><div class="tr-item"><b class="mono">${esc(t.item_code)}</b><span>${esc(t.model || "")}</span></div></td>
        <td>${esc(catLabel(t.category))}</td>
        <td>${esc(t.brand || "—")}</td>
        <td>${statusBadge(s)}${s === "live" && t.status !== "live" ? `<span class="tr-small">On the site</span>` : ""}</td>
        <td class="muted">${esc(t.colour || "—")}</td>
        <td>${t.assignee ? esc(personName(t.assignee)) : `<span class="dim">Nobody</span>`}</td>
        <td class="${lt ? "err" : "muted"}">${day(t.due_on)}</td>
        <td>${t.priority === "normal" ? `<span class="dim">Normal</span>` : badge(PRIORITY[t.priority]?.[0] || t.priority, PRIORITY[t.priority]?.[1] || "", true)}</td>
        <td class="n">${t.comments || `<span class="dim">0</span>`}</td>
        <td><div class="actions"><button class="btn sm" data-open aria-label="Open ${esc(t.item_code)}">Open</button></div></td></tr>`;
    }).join("") : `<tr><td colspan="10">${emptyState(rows.length ? "No item matches" : "No items yet", rows.length ? "Try another category, brand, status or search." : can.write ? "Import the tracker spreadsheet with “Import spreadsheet”." : "An admin or manager imports the tracker spreadsheet.")}</td></tr>`;
    $("foot").textContent = list.length > part.length ? `Showing 1–${fmtNum(part.length)} of ${fmtNum(list.length)}` : "";
    $("more").classList.toggle("hide", list.length <= part.length);
  }
  // the filters stay in the address (without a reload), so Back and a copied link keep them
  const query = () => { const q = new URLSearchParams(Object.entries({ cat: f.cat, brand: f.brand, status: f.status, who: f.who, late: f.late ? "1" : "", q: f.q }).filter(([, v]) => v)); return q.size ? `?${q}` : ""; };
  const address = (id) => history.replaceState(history.state, "", `${location.pathname}${location.search}#/tracker${id ? `/${id}` : ""}${query()}`);
  const reload = async () => { [rows, imports] = await Promise.all([D.tracker.list(), D.tracker.imports().catch(() => imports)]); if (ctx.alive()) { summary(); render(); } };

  // ── one item: everything about it, its history and comments; admins and managers change the team's fields ──
  async function openItem(id) {
    const d = modal({ title: "Item", body: `<div class="loading">Loading…</div>`, foot: `<button class="btn" data-close>Close</button>`, onClose: () => { if (ctx.alive()) { address(null); ctx.crumb?.("Tracker"); } } });
    d.classList.add("wide");
    address(id);
    let hist = [];
    const fill = async () => {
      const t = rows.find((x) => x.id === id);
      if (!t) { d.querySelector(".modal-body").innerHTML = emptyState("No such item", "It may have been removed from the tracker."); return; }
      try { hist = await D.tracker.log(id); } catch (e) { hist = null; }
      if (!d.open) return;
      ctx.crumb?.(t.item_code);
      const s = shown(t), site_ = onSite(t);
      const link3d = t.link || (site_ ? `${siteOrigin()}/p/${encodeURIComponent(t.item_code)}` : null);
      d.querySelector(".modal-head h2").textContent = t.item_code;
      if (!d.querySelector(".modal-head p")) d.querySelector(".modal-head h2").insertAdjacentHTML("afterend", "<p></p>");
      d.querySelector(".modal-head p").textContent = [t.brand, catLabel(t.category)].filter(Boolean).join(" · ");
      d.querySelector(".modal-body").innerHTML = `
        ${site_ ? `<div class="msg good">On the site: <b>${esc(site_.p.brand)} ${esc(site_.p.shortName)}</b>, ${esc(site_.f.name)}.${t.status !== "live" ? " It shows as Live on site; an admin or manager opening the tracker records it." : ""}</div>` : t.status === "live" ? `<div class="msg warn">The tracker says Live on site, but no product on show has this code now.</div>` : ""}
        ${late(t) ? `<div class="msg bad">Past its due date (${esc(day(t.due_on))}) and not built yet.</div>` : ""}
        <dl class="facts">
          <div><dt>3D status</dt><dd>${statusBadge(s)}</dd></div>
          <div><dt>Assigned to</dt><dd>${esc(personName(t.assignee))}</dd></div>
          <div class="full"><dt>Item / Model</dt><dd>${esc(t.model || "—")}</dd></div>
          <div><dt>Brand</dt><dd>${esc(t.brand || "—")}</dd></div>
          <div><dt>Category</dt><dd>${esc(catLabel(t.category))}</dd></div>
          <div><dt>Created on</dt><dd>${day(t.created_on)}</dd></div>
          <div><dt>Colour built</dt><dd>${esc(t.colour || "—")}</dd></div>
          <div><dt>Our product id</dt><dd>${t.product_id ? `<a href="#/review/${esc(t.product_id)}">${esc(t.product_id)}</a>` : "—"}</dd></div>
          <div><dt>3D link</dt><dd>${link3d ? `<a href="${esc(link3d)}" target="_blank" rel="noopener">Open 3D ${icon("external")}</a>` : "—"}</dd></div>
          <div><dt>Due</dt><dd class="${late(t) ? "err" : ""}">${day(t.due_on)}</dd></div>
          <div><dt>Priority</dt><dd>${badge(PRIORITY[t.priority]?.[0] || t.priority, PRIORITY[t.priority]?.[1] || "", true)}</dd></div>
          <div><dt>On the earlier vendor list</dt><dd>${yes(t.prior_list)}</dd></div>
          <div><dt>On the CD Ref list</dt><dd>${yes(t.ref_list)}</dd></div>
          <div><dt>In the item master</dt><dd>${t.in_master ? "Yes" : `No${t.source ? ` (${esc(t.source)})` : ""}`}</dd></div>
          <div><dt>Status changed</dt><dd title="${esc(fmtDateTime(t.status_at))}">${esc(fmtAgo(t.status_at))}</dd></div>
          ${t.notes ? `<div class="full"><dt>Notes</dt><dd class="pre">${esc(t.notes)}</dd></div>` : ""}
        </dl>
        ${can.write ? `<form class="req-status" id="tmForm" novalidate>
          <div class="row2">
            <label class="field">3D status<select name="status">${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === t.status ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
            <label class="field">Assigned to<select name="assignee"><option value="">Nobody</option>${staff.map((p) => `<option value="${esc(p.user_id)}" ${p.user_id === t.assignee ? "selected" : ""}>${esc(p.name)}${p.user_id === profile.user_id ? " (you)" : ""}</option>`).join("")}${t.assignee && !person(t.assignee) ? `<option value="${esc(t.assignee)}" selected>A former user</option>` : ""}</select></label>
          </div>
          <div class="row2">
            <label class="field">Due date<input type="date" name="due_on" value="${esc(t.due_on || "")}"></label>
            <label class="field">Priority<select name="priority">${Object.entries(PRIORITY).map(([k, [l]]) => `<option value="${k}" ${k === t.priority ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          </div>
          <div class="msg bad hide" id="tmErr" role="alert"></div>
          <div><button class="btn primary" type="submit">${icon("check")}Save changes</button></div>
        </form>` : `<div class="note">${icon("eye")}<div><b>Anyone can comment.</b> Only admins and managers change the status, who it is assigned to, the due date and the priority.</div></div>`}
        <section class="hist" aria-labelledby="h-thist"><h3 id="h-thist">History and comments</h3>
          ${hist === null ? errorBox(new Error("The history couldn’t be loaded.")) : hist.length ? `<ol class="timeline">${hist.map(line).join("")}</ol>` : `<p class="muted" style="margin:0 0 14px">Nothing yet.</p>`}
          <form id="tcForm" class="cm-form" novalidate>
            <label class="field"><span class="sr">Comment</span><textarea name="body" maxlength="1000" placeholder="Add a comment for the team"></textarea></label>
            <div class="msg bad hide" id="tcErr" role="alert"></div>
            <div><button class="btn" type="submit">${icon("plus")}Add comment</button></div>
          </form>
        </section>`;
      const tm = d.querySelector("#tmForm");
      tm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = d.querySelector("#tmErr"), b = tm.querySelector("[type=submit]");
        const want = { status: tm.status.value, assignee: tm.assignee.value || null, due_on: tm.due_on.value || null, priority: tm.priority.value };
        const patch = Object.fromEntries(Object.entries(want).filter(([k, v]) => v !== (t[k] ?? null)));
        if (!Object.keys(patch).length) { toast("Nothing changed."); return; }
        b.disabled = true;
        try { await D.tracker.update(t.id, patch); toast("Saved."); await reload(); if (d.open) await fill(); }
        catch (x) { err.textContent = x.message; err.classList.remove("hide"); b.disabled = false; }
      });
      const tc = d.querySelector("#tcForm");
      tc.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = d.querySelector("#tcErr"), b = tc.querySelector("[type=submit]");
        if (!tc.body.value.trim()) { err.textContent = "Write a comment first."; err.classList.remove("hide"); tc.body.focus(); return; }
        b.disabled = true;
        try { await D.tracker.comment(t.id, tc.body.value); toast("Comment added."); await reload(); if (d.open) { await fill(); d.querySelector("#tcForm textarea")?.focus(); } }
        catch (x) { err.textContent = x.message; err.classList.remove("hide"); b.disabled = false; }
      });
    };
    // one line of the history
    function line(l) {
      const who = l.actor ? esc(l.actor_name || person(l.actor)?.name || String(l.actor_email || "").split("@")[0] || "Someone") : "The system";
      const when = `<span class="dim" title="${esc(fmtDateTime(l.at))}">${esc(fmtAgo(l.at))}</span>`;
      const st = (k) => statusBadge(k);
      if (l.kind === "comment") return `<li class="cm"><span class="dot"></span><div><b>${who}</b> commented ${when}<p class="pre">${esc(l.body)}</p></div></li>`;
      if (l.kind === "status") {
        const what = l.how === "site" ? `<b>Found on the site</b>: ${st(l.from_value)} → ${st(l.to_value)}${l.actor ? ` <span class="dim">(recorded when ${who} opened the tracker)</span>` : ""}`
          : `<b>${who}</b> ${l.how === "import" ? "imported a change" : "moved it"}: ${st(l.from_value)} → ${st(l.to_value)}`;
        return `<li class="st"><span class="dot"></span><div>${what} ${when}</div></li>`;
      }
      const text = l.kind === "assignee" ? (l.to_value ? `assigned it to <b>${esc(personName(l.to_value))}</b>` : `took it off ${esc(personName(l.from_value))}`)
        : l.kind === "due" ? (l.to_value ? `set the due date to ${esc(day(l.to_value))}` : "removed the due date")
        : `set the priority to ${esc(PRIORITY[l.to_value]?.[0] || l.to_value)}`;
      return `<li><span class="dot"></span><div><b>${who}</b> ${text} ${when}</div></li>`;
    }
    await fill();
    d.querySelector("[data-close]")?.focus();
  }

  // ── importing the tracker spreadsheet (admins and managers) ──
  function importer() {
    let parsed = null, file = null;
    const d = modal({
      title: "Import the tracker spreadsheet",
      sub: "The 3D Model Progress Tracker (.xlsx). Every category sheet is read from its header row, and the “Not in Master List” sheet too.",
      body: `<div class="note">${icon("info")}<div><b>An import never changes</b> who an item is assigned to, its due date, its priority or its comments. New items are added; known ones (the same category and item code) get the sheet’s status, colour, notes and links. Items the file doesn’t have are kept.</div></div>
        <label class="btn tr-file">${icon("upload")}<span id="fileName">Choose the .xlsx file</span><input type="file" id="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr"></label>
        <div id="preview" aria-live="polite"></div>
        <div class="msg bad hide" id="imErr" role="alert"></div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-go disabled>${icon("upload")}Import</button>`,
    });
    d.classList.add("wide");
    const go = d.querySelector("[data-go]"), err = d.querySelector("#imErr"), out = d.querySelector("#preview");
    const bad = (m) => { err.textContent = m; err.classList.remove("hide"); };
    d.querySelector("#file").addEventListener("change", async (e) => {
      file = e.target.files[0];
      parsed = null; go.disabled = true; err.classList.add("hide");
      if (!file) return;
      d.querySelector("#fileName").textContent = file.name;
      if (file.size > 15 * 1024 * 1024) { out.innerHTML = ""; bad("That file is too big: 15 MB at most."); return; }
      out.innerHTML = `<div class="loading">Reading the file…</div>`;
      try {
        const XLSX = await loadSheetJs();
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
        parsed = readTracker(XLSX, wb);
      } catch (x) { out.innerHTML = ""; bad(/couldn’t load|didn’t start/.test(x.message) ? x.message : "That file couldn’t be read as a spreadsheet. Choose the tracker’s .xlsx file."); return; }
      if (!d.open) return;
      if (!parsed.rows.length) { out.innerHTML = ""; bad("No item rows found. Each category sheet needs a header row with “Item Code” and “3D Status”."); return; }
      // what the import will do, compared with the tracker as it is now
      const now = new Map(rows.map((t) => [`${t.category}\u0001${t.item_code}`, t]));
      const keys = new Set(parsed.rows.map((r) => `${r.category}\u0001${r.item_code}`));
      const changes = [];
      let added = 0, same = 0;
      for (const r of parsed.rows) {
        const t = now.get(`${r.category}\u0001${r.item_code}`);
        if (!t) { added++; continue; }
        const diff = SHEET_KEYS.filter((k) => (t[k] ?? null) !== (r[k] ?? null));
        if (!diff.length) same++;
        else changes.push({ r, t, diff });
      }
      const missing = rows.filter((t) => !keys.has(`${t.category}\u0001${t.item_code}`)).length;
      const field = { model: "Item / Model", brand: "Brand", created_on: "Created on", status: "Status", colour: "Colour", product_id: "Product id", link: "3D link", prior_list: "Earlier vendor list", ref_list: "CD Ref list", in_master: "In the item master", source: "Source", notes: "Notes" };
      out.innerHTML = `
        <p class="muted" style="margin:0">Read ${fmtNum(parsed.rows.length)} items from ${parsed.sheets.map((s) => `${esc(s.name)} (${fmtNum(s.n)})`).join(", ")}.</p>
        <div class="stats tr-preview">
          ${statCard({ title: "New", value: fmtNum(added), ic: "plus", tone: added ? "green" : "" })}
          ${statCard({ title: "Changed", value: fmtNum(changes.length), ic: "edit", tone: changes.length ? "amber" : "" })}
          ${statCard({ title: "Unchanged", value: fmtNum(same), ic: "check" })}
          ${statCard({ title: "Skipped", value: fmtNum(parsed.skipped.length), ic: "alert", tone: parsed.skipped.length ? "red" : "" })}
        </div>
        ${changes.length ? `<h3 class="pd-h">What changes</h3><ul class="tr-changes">${changes.slice(0, 12).map(({ r, t, diff }) => `<li><b class="mono">${esc(r.item_code)}</b> ${diff.map((k) => k === "status" ? `${statusBadge(t.status)} → ${statusBadge(r.status)}` : `<span class="dim">${esc(field[k])}</span>`).join(" · ")}</li>`).join("")}${changes.length > 12 ? `<li class="dim">and ${fmtNum(changes.length - 12)} more</li>` : ""}</ul>` : ""}
        ${parsed.skipped.length ? `<h3 class="pd-h">Skipped rows</h3><ul class="tr-changes">${parsed.skipped.slice(0, 8).map((x) => `<li><span class="dim">${esc(x.sheet)}, row ${x.line}:</span> <b class="mono">${esc(x.code)}</b> ${esc(x.why)}</li>`).join("")}${parsed.skipped.length > 8 ? `<li class="dim">and ${fmtNum(parsed.skipped.length - 8)} more</li>` : ""}</ul>` : ""}
        ${missing ? `<p class="muted" style="margin:0">${fmtNum(missing)} ${missing === 1 ? "item in the tracker isn’t" : "items in the tracker aren’t"} in this file. ${missing === 1 ? "It is" : "They are"} kept as ${missing === 1 ? "it is" : "they are"}.</p>` : ""}`;
      go.innerHTML = `${icon("upload")}Import ${fmtNum(parsed.rows.length)} items`;
      go.disabled = !added && !changes.length;
      if (go.disabled) out.insertAdjacentHTML("beforeend", `<div class="msg good">The tracker already matches this file. Nothing to import.</div>`);
    });
    go.addEventListener("click", async () => {
      if (!parsed?.rows.length) return;
      go.disabled = true;
      try {
        const r = await D.tracker.import(parsed.rows, file?.name);
        d.close();
        toast(`Imported: ${fmtNum(r.added)} new, ${fmtNum(r.changed)} changed, ${fmtNum(r.unchanged)} unchanged.`);
        site = await siteCodes(api).catch(() => site);
        await reload();
        // what the file says may be behind the site: record what is on it now
        if (can.write && stale().length) { try { await D.tracker.markLive(stale().map((t) => ({ id: t.id, product: onSite(t).p.id, colour: onSite(t).f.name }))); await reload(); } catch {} }
      } catch (x) { bad(x.message); go.disabled = false; }
    });
  }

  function exportCsv() {
    const list = filtered();
    downloadCsv(`3d-tracker-${istDay()}.csv`, [
      [(t) => catLabel(t.category), "Category"], ["item_code", "Item code"], ["model", "Item / Model"], ["brand", "Brand"], ["created_on", "Created on"],
      [(t) => STATUS[shown(t)]?.[0], "3D status"], ["colour", "Colour built"], ["product_id", "Our product id"], ["link", "3D link"],
      [(t) => (t.prior_list ? "Yes" : ""), "On the earlier vendor list"], [(t) => (t.ref_list ? "Yes" : ""), "On the CD Ref list"], [(t) => (t.in_master ? "" : t.source || "Not in master"), "Not in the item master"],
      ["notes", "Notes"], [(t) => (t.assignee ? personName(t.assignee) : ""), "Assigned to"], ["due_on", "Due date"], [(t) => PRIORITY[t.priority]?.[0], "Priority"],
      ["comments", "Comments"], [(t) => fmtDateTime(t.status_at), "Status changed"],
    ], list);
    toast(`CSV downloaded (${fmtNum(list.length)} ${list.length === 1 ? "item" : "items"}).`);
  }

  const refilter = () => { limit = PAGE; address(null); render(); };
  $("q").addEventListener("input", (e) => { f.q = e.target.value; refilter(); });
  for (const [id, k] of [["fcat", "cat"], ["fbrand", "brand"], ["fstatus", "status"], ["fwho", "who"]]) $(id).addEventListener("change", (e) => { f[k] = e.target.value; refilter(); });
  $("flate").addEventListener("click", (e) => { f.late = !f.late; e.currentTarget.setAttribute("aria-pressed", String(f.late)); refilter(); });
  $("more").addEventListener("click", () => { limit += PAGE; render(); });
  $("csv").addEventListener("click", exportCsv);
  $("import")?.addEventListener("click", importer);
  $("rows").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openItem(Number(tr.dataset.id)); });
  $("rows").addEventListener("keydown", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr && e.target === tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openItem(Number(tr.dataset.id)); } });
  summary();
  render();
  // #/tracker/<id>: a link from a notification opens that item
  if (ctx.sub) {
    const id = Number(ctx.sub);
    if (rows.some((t) => t.id === id)) await openItem(id);
    else toast("That item isn’t in the tracker any more.", true);
  }
}
