// Small helpers shared by the admin's pages: escaping, icons, formatting, charts, dialogs, CSV and QR codes.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const P = {
  cube: '<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>',
  store: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  devices: '<rect x="2" y="4" width="13" height="10" rx="2"/><path d="M5 18h7"/><rect x="16" y="8" width="6" height="13" rx="1.5"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  userX: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  door: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 9h14M8 5.5v1.5M8 11.5v3"/>',
};
export const icon = (name, extra = "") => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[name] || P.info}</svg>`;

// ── formatting ──
const nf = new Intl.NumberFormat("en-IN");
export const fmtNum = (n) => (n === null || n === undefined || Number.isNaN(+n) ? "—" : nf.format(Math.round(+n)));
export const fmtPct = (part, whole, digits = 0) => (!whole ? "—" : `${((100 * part) / whole).toFixed(digits)}%`);
export function fmtBytes(b) {
  if (b === null || b === undefined) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
const dtf = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const df = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const fmtDateTime = (t) => (t ? dtf.format(new Date(t)) : "—");
export const fmtDate = (t) => (t ? df.format(new Date(t)) : "—");
export function fmtAgo(t) {
  if (!t) return "Never";
  const s = (Date.now() - new Date(t).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(t);
}
// "YYYY-MM-DD" in the shops' time zone, and back to the instant that day starts there (India has no DST)
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
export const istDay = (t = Date.now()) => ymd.format(new Date(t));
export const istStart = (day) => new Date(`${day}T00:00:00+05:30`);
export const addDays = (day, n) => istDay(istStart(day).getTime() + n * 864e5 + 3600e3);
const shortDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
// series labels from the database: "2026-11-04" or "2026-11-04T14:00" (already in local time)
export const slotLabel = (s) => (s.includes("T") ? s.slice(11, 16) : shortDay.format(new Date(`${s}T00:00:00Z`)));

// ── page pieces ──
export const badge = (text, tone = "", plain = false) => `<span class="badge ${tone}${plain ? " plain" : ""}">${esc(text)}</span>`;
export function statCard({ title, value, ic, tone = "", sub = "" }) {
  return `<div class="stat ${tone}"><div class="t"><span>${esc(title)}</span>${icon(ic)}</div><div class="v">${esc(value)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ""}</div>`;
}
export function barList(rows, tone = "") {
  if (!rows.length) return `<div class="empty"><div><b>Nothing yet</b></div></div>`;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return `<div class="bars">${rows.map((r) => `<div class="bar-row"><div class="l"><span>${esc(r.label)}</span><span>${fmtNum(r.n)}</span></div><div class="track ${tone}"><i style="width:${(100 * r.n) / max}%"></i></div></div>`).join("")}</div>`;
}
export const emptyState = (title, text, good = false) => `<div class="empty${good ? " good" : ""}"><div>${good ? `<div class="ic">${icon("check")}</div>` : ""}<b>${esc(title)}</b>${esc(text)}</div></div>`;
export const errorBox = (e) => `<div class="banner bad">${icon("alert")}<div><b>Couldn’t load this.</b> ${esc(e?.message || e)}</div></div>`;

// ── toast ──
let toastEl = null;
export function toast(text, bad = false) {
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite"); document.body.appendChild(toastEl); }
  toastEl.textContent = text;
  toastEl.classList.toggle("bad", bad);
  toastEl.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

// ── dialogs ──
// modal({ title, sub, body, foot }) shows a <dialog>; buttons with data-close close it. Returns the dialog.
export function modal({ title, sub = "", body = "", foot = `<button class="btn" data-close>Close</button>`, onClose }) {
  const d = document.createElement("dialog");
  d.className = "modal";
  d.innerHTML = `<div class="modal-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div><button class="btn ghost icon" data-close aria-label="Close">${icon("x")}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}`;
  document.body.appendChild(d);
  // closing finishes at once (the dialog's own "close" event can come late), and only once
  let done = false;
  const finish = () => { if (done) return; done = true; d.remove(); onClose?.(); };
  const nativeClose = d.close.bind(d);
  d.close = (v) => { if (d.open) nativeClose(v); finish(); };
  d.addEventListener("close", finish); // Escape
  d.addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target === d) d.close(); });
  d.showModal();
  return d;
}
export function confirmBox({ title, text, ok = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const d = modal({
      title, body: `<p class="muted" style="margin:0">${esc(text)}</p>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? "danger" : "primary"}" data-ok>${esc(ok)}</button>`,
      onClose: () => resolve(answer),
    });
    d.querySelector("[data-ok]").addEventListener("click", () => { answer = true; d.close(); });
  });
}
// a form inside a modal: fields [{ name, label, type, value, options, required, help }]; onSubmit(values) may throw
export function formModal({ title, sub, fields, submit = "Save", onSubmit }) {
  const input = (f) => {
    const v = f.value ?? "";
    if (f.type === "select") return `<select name="${f.name}" ${f.required ? "required" : ""}>${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
    if (f.type === "textarea") return `<textarea name="${f.name}" maxlength="${f.max || 300}">${esc(v)}</textarea>`;
    return `<input name="${f.name}" type="${f.type || "text"}" value="${esc(v)}" ${f.required ? "required" : ""} maxlength="${f.max || 120}" ${f.auto ? `autocomplete="${f.auto}"` : ""}>`;
  };
  const d = modal({
    title, sub,
    body: `<form id="mform" class="modal-form" style="display:grid;gap:14px">${fields.map((f) => `<label class="field">${esc(f.label)}${f.required ? " *" : ""}${input(f)}${f.help ? `<span class="help">${esc(f.help)}</span>` : ""}</label>`).join("")}<div class="msg bad hide" id="mformErr" role="alert"></div><button type="submit" class="hide"></button></form>`,
    foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-submit>${esc(submit)}</button>`,
  });
  const form = d.querySelector("form");
  const go = async (e) => {
    e?.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    const btn = d.querySelector("[data-submit]");
    btn.disabled = true;
    try { await onSubmit(values, d); }
    catch (err) { const m = d.querySelector("#mformErr"); m.textContent = err.message || String(err); m.classList.remove("hide"); }
    finally { btn.disabled = false; }
  };
  form.addEventListener("submit", go);
  d.querySelector("[data-submit]").addEventListener("click", go);
  form.querySelector("input,select,textarea")?.focus();
  return d;
}

// ── clipboard, QR, CSV ──
export async function copyText(text, done = "Link copied.") {
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch { toast(text); }
}
export function qrSvg(text) {
  if (!window.qrcode) return `<p class="muted">The QR code library didn’t load.</p>`;
  const q = window.qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}
export function qrModal({ title, sub, url, file }) {
  const svg = qrSvg(url);
  const href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const d = modal({
    title, sub, onClose: () => URL.revokeObjectURL(href),
    body: `<div class="qr" role="img" aria-label="QR code for ${esc(url)}">${svg}</div>
      <div class="linkbox"><code title="${esc(url)}">${esc(url)}</code><button class="btn sm" data-copy>${icon("copy")}Copy</button></div>`,
    foot: `<a class="btn" data-dl download="${esc(file)}.svg">${icon("download")}Download QR</a><button class="btn primary" data-close>Done</button>`,
  });
  d.querySelector("[data-copy]").addEventListener("click", () => copyText(url));
  d.querySelector("[data-dl]").href = href;
  return d;
}
const csvCell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheets would run these as formulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function downloadCsv(file, columns, rows) {
  const text = [columns.map(([, label]) => csvCell(label)).join(","), ...rows.map((r) => columns.map(([key]) => csvCell(typeof key === "function" ? key(r) : r[key])).join(","))].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  a.download = file;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ── charts (Chart.js 4, loaded by admin.html) ──
export const COLORS = { orange: "#F58A29", green: "#4ADE80", red: "#F87171", amber: "#FBBF24", blue: "#60A5FA", purple: "#A78BFA", grey: "#71717A" };
const live = new Set();
let themed = false;
function theme() {
  const C = window.Chart;
  if (!C || themed) return;
  themed = true;
  C.defaults.color = "#A1A1AA";
  C.defaults.borderColor = "#26262B";
  C.defaults.font.family = "Outfit, -apple-system, Arial, sans-serif";
  C.defaults.font.size = 12.5;
  C.defaults.maintainAspectRatio = false;
  C.defaults.plugins.legend.labels.boxWidth = 10;
  C.defaults.plugins.legend.labels.boxHeight = 10;
  Object.assign(C.defaults.plugins.tooltip, { backgroundColor: "#0B0B0C", borderColor: "#34343A", borderWidth: 1, padding: 10, titleColor: "#F4F4F5", bodyColor: "#D4D4D8", cornerRadius: 10, displayColors: true });
}
const axis = (extra = {}) => ({ grid: { color: "#2A2A30" }, border: { display: false, dash: [4, 4] }, ticks: { precision: 0 }, beginAtZero: true, ...extra });
// put a chart in a .chart box; returns the Chart, or writes a note if Chart.js isn't there
export function makeChart(box, config) {
  if (!box) return null;
  if (!window.Chart) { box.innerHTML = `<div class="empty">The chart library didn’t load. Check the connection and refresh.</div>`; return null; }
  theme();
  box.innerHTML = "<canvas></canvas>";
  const c = new window.Chart(box.firstChild, config);
  live.add(c);
  return c;
}
export function destroyCharts() { for (const c of live) c.destroy(); live.clear(); }
export function hbar(box, labels, values, colors, label = "Count") {
  return makeChart(box, {
    type: "bar",
    data: { labels, datasets: [{ label, data: values, backgroundColor: colors, borderRadius: 6, maxBarThickness: 44 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: axis(), y: axis({ grid: { display: false } }) } },
  });
}
export function vbar(box, labels, values, color = COLORS.orange, label = "Events") {
  return makeChart(box, {
    type: "bar",
    data: { labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 6, maxBarThickness: 64 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: axis({ grid: { display: false } }), y: axis() } },
  });
}
export function lines(box, labels, sets) {
  return makeChart(box, {
    type: "line",
    data: { labels, datasets: sets.map((s) => ({ label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color, pointRadius: labels.length > 40 ? 0 : 3, pointHoverRadius: 5, cubicInterpolationMode: "monotone", borderWidth: 2 })) },
    options: { interaction: { mode: "index", intersect: false }, plugins: { legend: { display: sets.length > 1, position: "bottom" } }, scales: { x: axis({ grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 14 } }), y: axis() } },
  });
}
