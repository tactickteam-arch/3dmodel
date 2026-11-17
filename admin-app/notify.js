// Notifications: the bell in the top bar (unread count, the latest ones, "Mark all read") and the Notifications page
// (#/notifications: the full history, and what each person wants to be told). The database writes them (the
// triggers in pipeline/admin/schema.sql: tracker status changes, items assigned to you, comments, due dates, tracker
// imports, store feedback); new ones arrive at once through Supabase Realtime, with a check every two minutes in case
// the connection drops. Browser pop-ups are optional and per browser (the Notification API, while the admin is open).
// Email isn't sent: it needs an email service account first.
import { esc, icon, emptyState, errorBox, toast, fmtAgo, fmtDateTime } from "./ui.js";
import { trackerData, KINDS } from "./tracker-data.js";

for (const css of ["/admin-app/tools.css", "/admin-app/tracker.css"]) if (!document.querySelector(`link[href="${css}"]`)) document.head.insertAdjacentHTML("beforeend", `<link rel="stylesheet" href="${css}">`);

const KIND_IC = { live: "checkCircle", blocked: "alert", status: "tracker", assigned: "userCheck", comment: "message", due: "clock", import: "upload", feedback: "message" };
const KIND_TONE = { live: "green", blocked: "red", status: "blue", assigned: "orange", comment: "blue", due: "red", import: "", feedback: "amber" };
const POPUPS = "s3d-notify-popups";   // localStorage: "1" when this browser should show pop-ups
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
const popupsOn = () => "Notification" in window && Notification.permission === "granted" && store.get(POPUPS) === "1";
const who = (n) => n.actor_name || (n.actor ? "Someone" : "The system");
// a notification as a list item: a link to the page it is about
export const noteItem = (n, tag = "li") => `<${tag} class="nt${n.read_at ? "" : " unread"}" data-n="${n.id}">
  <a href="${esc(n.link || "#/notifications")}" data-nid="${n.id}"><span class="nt-ic ${KIND_TONE[n.kind] || ""}" aria-hidden="true">${icon(KIND_IC[n.kind] || "bell")}</span>
  <span class="nt-text"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ""}<i title="${esc(fmtDateTime(n.at))}">${esc(who(n))} · ${esc(fmtAgo(n.at))}${n.read_at ? "" : ` <span class="sr">(unread)</span>`}</i></span>
  ${n.read_at ? "" : `<span class="nt-dot" aria-hidden="true"></span>`}</a></${tag}>`;
// going to a notification's page; if the address already is that page, it is opened again
export function follow(link) {
  if (!link) return;
  if (location.hash === link) dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = link;
}

// ════════════════════════════════════════════════════════════════════════════ The bell
let bell = null;   // the running bell: { stop() }

// Puts the bell in the top bar (#bellSlot) for the signed-in staff member. Called by app.js when it builds the shell.
export function startBell({ api, profile }) {
  stopBell();
  const slot = document.getElementById("bellSlot");
  if (!slot) return;
  const D = trackerData(api);
  let list = [], unread = 0, failed = null, open = false, stopped = false, unsub = null, timer = null;
  slot.innerHTML = `<button class="btn ghost icon bell" id="bellBtn" aria-haspopup="dialog" aria-expanded="false" aria-controls="bellPanel" aria-label="Notifications">${icon("bell")}<span class="bell-n hide" id="bellN" aria-hidden="true"></span></button>
    <div class="bell-panel hide" id="bellPanel" role="dialog" aria-label="Notifications">
      <div class="bell-head"><b>Notifications</b><button class="linkbtn" id="bellAll">Mark all read</button></div>
      <ol class="bell-list" id="bellList"></ol>
      <div class="bell-foot"><a href="#/notifications" id="bellMore">All notifications and settings</a><button class="linkbtn hide" id="bellPop">Turn on pop-ups</button></div>
    </div>`;
  const $ = (id) => document.getElementById(id);
  const btn = $("bellBtn"), panel = $("bellPanel");
  function paint() {
    const n = $("bellN");
    n.textContent = unread > 99 ? "99+" : String(unread);
    n.classList.toggle("hide", !unread);
    btn.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications");
    $("bellAll").disabled = !unread;
    $("bellList").innerHTML = failed ? `<li class="bell-empty">${esc(failed)}</li>` : list.length ? list.slice(0, 12).map((x) => noteItem(x)).join("") : `<li class="bell-empty">${emptyState("No notifications yet", "You’ll hear here when an item you follow changes.")}</li>`;
    $("bellPop").classList.toggle("hide", !("Notification" in window) || popupsOn() || Notification.permission === "denied");
  }
  async function refresh() {
    try { [list, unread] = await Promise.all([D.notify.list({ limit: 12 }), D.notify.unread()]); failed = null; }
    catch (e) { failed = e.message; }
    if (!stopped) paint();
  }
  function arrived(n) {
    if (stopped || list.some((x) => x.id === n.id)) return;
    list.unshift(n);
    list = list.slice(0, 30);
    if (!n.read_at) unread++;
    paint();
    dispatchEvent(new CustomEvent("s3d-notification", { detail: n }));
    if (document.visibilityState === "visible") toast(n.title);
    if (popupsOn() && document.visibilityState !== "visible") {
      try {
        const p = new Notification(n.title, { body: n.body || "", tag: `s3d-${n.id}` });
        p.onclick = () => { focus(); follow(n.link); p.close(); };
      } catch {}
    }
  }
  const show = (on) => {
    open = on;
    panel.classList.toggle("hide", !on);
    btn.setAttribute("aria-expanded", String(on));
    if (on) refresh();
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); show(!open); });
  const outside = (e) => { if (open && !e.target.closest("#bellPanel") && !e.target.closest("#bellBtn")) show(false); };
  const esc_ = (e) => { if (open && e.key === "Escape") { show(false); btn.focus(); } };
  document.addEventListener("click", outside);
  document.addEventListener("keydown", esc_);
  $("bellAll").addEventListener("click", async () => {
    try { await D.notify.read(null); list.forEach((x) => (x.read_at ||= new Date().toISOString())); unread = 0; paint(); dispatchEvent(new CustomEvent("s3d-notification-read")); }
    catch (e) { toast(e.message, true); }
  });
  $("bellList").addEventListener("click", async (e) => {
    const a = e.target.closest("a[data-nid]");
    if (!a) return;
    e.preventDefault();
    const n = list.find((x) => x.id === Number(a.dataset.nid));
    show(false);
    if (n && !n.read_at) { n.read_at = new Date().toISOString(); unread = Math.max(0, unread - 1); paint(); D.notify.read(n.id).catch(() => {}); }
    follow(n?.link || a.getAttribute("href"));
  });
  $("bellMore").addEventListener("click", () => show(false));
  $("bellPop").addEventListener("click", async () => { await askPopups(); paint(); });
  // the Notifications page marks things read too: keep the count in step
  const synced = () => refresh();
  addEventListener("s3d-notification-read", synced);

  refresh();
  // new rows as they are written, and a check every two minutes in case the live connection drops
  try { unsub = D.notify.subscribe(profile.user_id, arrived); } catch {}
  timer = setInterval(async () => {
    const before = new Set(list.map((x) => x.id));
    await refresh();
    for (const n of list.filter((x) => !before.has(x.id) && !x.read_at)) dispatchEvent(new CustomEvent("s3d-notification", { detail: n }));
  }, 120000);
  // "past its due date" notices are made when someone opens the admin (and hourly where pg_cron is on)
  D.tracker.dueCheck().catch(() => {});
  bell = {
    stop() {
      stopped = true;
      clearInterval(timer);
      try { unsub?.(); } catch {}
      document.removeEventListener("click", outside);
      document.removeEventListener("keydown", esc_);
      removeEventListener("s3d-notification-read", synced);
    },
  };
}
export function stopBell() { bell?.stop(); bell = null; }

// Asks this browser for permission to show pop-ups, and remembers the choice here only.
async function askPopups() {
  if (!("Notification" in window)) { toast("This browser can’t show pop-ups.", true); return false; }
  let p = Notification.permission;
  if (p === "default") { try { p = await Notification.requestPermission(); } catch { p = "denied"; } }
  if (p !== "granted") { toast("Pop-ups are blocked for this site. Allow notifications in the browser’s site settings.", true); return false; }
  store.set(POPUPS, "1");
  toast("Pop-ups are on in this browser.");
  return true;
}

// ════════════════════════════════════════════════════════════════════════════ The Notifications page
export async function notificationsPage(ctx) {
  const { el, api, profile } = ctx;
  const D = trackerData(api);
  let list = [], off = [], more = true, only = "all", settingsError = null;
  const load = async (reset = true) => {
    const page = await D.notify.list({ limit: 50, before: reset ? null : list.at(-1)?.id, unread: only === "unread" });
    list = reset ? page : [...list, ...page];
    more = page.length === 50;
  };
  let listError = null;
  try { await load(); } catch (e) { listError = e; }
  try { off = await D.notify.settings(); } catch (e) { settingsError = e; }
  if (!ctx.alive()) return;
  const lead = profile.role === "admin" || profile.role === "manager";
  el.innerHTML = `
    <div class="page-head"><div><h1>Notifications</h1><p>What happened on the items you follow, newest first. The bell at the top shows new ones as they come.</p></div>
      <div class="tools"><button class="btn" id="allRead">${icon("check")}Mark all read</button></div></div>
    <div class="chips" role="group" aria-label="Show">${[["all", "All"], ["unread", "Unread"]].map(([k, l]) => `<button class="btn sm" data-only="${k}" aria-pressed="${k === only}">${l}</button>`).join("")}</div>
    <section class="card nt-card" aria-label="Notifications"><ol class="nt-list" id="list"></ol><div class="table-foot"><span id="ntCount"></span><button class="btn sm" id="older">Show older</button></div></section>
    <div class="grid2">
      <section class="card" aria-labelledby="h-want"><div class="card-head"><div><h3 id="h-want">${icon("bell")}What to tell you</h3><p>For your account, on every device</p></div></div>
        ${settingsError ? errorBox(settingsError) : `<form id="want" novalidate class="nt-want">
          ${Object.entries(KINDS).map(([k, [label, help, leadOnly]]) => `<label class="check"><input type="checkbox" name="${k}" ${off.includes(k) ? "" : "checked"} ${leadOnly && !lead ? "disabled" : ""}><span><b>${esc(label)}</b><span class="dim">${esc(help)}${leadOnly && !lead ? " Only admins and managers get these." : ""}</span></span></label>`).join("")}
          <div class="msg bad hide" id="wantErr" role="alert"></div>
          <div><button class="btn primary" type="submit">${icon("check")}Save</button></div>
        </form>`}
      </section>
      <section class="card" aria-labelledby="h-pop"><div class="card-head"><div><h3 id="h-pop">${icon("devices")}Pop-ups in this browser</h3><p>Optional, and only for this browser</p></div></div>
        <p class="muted" style="margin:0 0 12px">A pop-up shows each new notification while this admin is open in a tab, even when you are in another tab or app. Nothing reaches a phone or computer when the admin is closed.</p>
        <p id="popState" style="margin:0 0 12px"></p>
        <div class="tools"><button class="btn" id="popOn">${icon("bell")}Turn on pop-ups</button><button class="btn hide" id="popOff">${icon("x")}Turn off pop-ups</button></div>
        <div class="note" style="margin-top:16px">${icon("mail")}<div><b>Email:</b> not yet. Notifications by email can be added later; they need an email sending service set up first.</div></div>
      </section>
    </div>`;
  const $ = (id) => el.querySelector(`#${id}`);
  function render() {
    $("list").innerHTML = listError ? `<li>${errorBox(listError)}</li>` : list.length ? list.map((n) => noteItem(n)).join("") : `<li>${emptyState(only === "unread" ? "Nothing unread" : "No notifications yet", only === "unread" ? "You’re up to date." : "You’ll hear here when an item you follow changes.", only === "unread")}</li>`;
    $("older").classList.toggle("hide", !more || !!listError);
    $("ntCount").textContent = list.length ? `${list.length} shown` : "";
    $("allRead").disabled = !!listError || !list.some((n) => !n.read_at);
  }
  function popups() {
    const has = "Notification" in window, perm = has ? Notification.permission : "unsupported";
    $("popState").innerHTML = !has ? "This browser can’t show pop-ups." : popupsOn() ? `<b class="ok-text">On</b> in this browser.` : perm === "denied" ? "Blocked: allow notifications for this site in the browser’s settings, then turn them on here." : "Off in this browser.";
    $("popOn").classList.toggle("hide", !has || popupsOn() || perm === "denied");
    $("popOff").classList.toggle("hide", !popupsOn());
  }
  const markRead = async (id) => { await D.notify.read(id); dispatchEvent(new CustomEvent("s3d-notification-read")); };
  $("list").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nid]");
    if (!a) return;
    e.preventDefault();
    const n = list.find((x) => x.id === Number(a.dataset.nid));
    if (n && !n.read_at) markRead(n.id).catch(() => {});
    follow(n?.link || a.getAttribute("href"));
  });
  $("allRead").addEventListener("click", async () => {
    try { await markRead(null); list.forEach((n) => (n.read_at ||= new Date().toISOString())); if (only === "unread") list = []; render(); toast("All marked read."); }
    catch (x) { toast(x.message, true); }
  });
  el.querySelectorAll("[data-only]").forEach((b) => b.addEventListener("click", async () => {
    only = b.dataset.only;
    el.querySelectorAll("[data-only]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    try { await load(); listError = null; } catch (x) { listError = x; }
    if (ctx.alive()) render();
  }));
  $("older").addEventListener("click", async (e) => { e.currentTarget.disabled = true; try { await load(false); } catch (x) { toast(x.message, true); } e.currentTarget.disabled = false; if (ctx.alive()) render(); });
  $("want")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget, b = form.querySelector("[type=submit]"), err = $("wantErr");
    // a kind someone can't get (disabled) keeps what it was
    const next = Object.keys(KINDS).filter((k) => (form[k].disabled ? off.includes(k) : !form[k].checked));
    b.disabled = true;
    try { off = (await D.notify.saveSettings(next)).off || next; err.classList.add("hide"); toast("Saved."); }
    catch (x) { err.textContent = x.message; err.classList.remove("hide"); }
    finally { b.disabled = false; }
  });
  $("popOn").addEventListener("click", async () => { await askPopups(); popups(); });
  $("popOff").addEventListener("click", () => { store.set(POPUPS, null); popups(); toast("Pop-ups are off in this browser."); });
  // a new one while the page is open goes on top
  const onNew = (e) => { if (!ctx.alive() || !el.isConnected) { removeEventListener("s3d-notification", onNew); return; } if (!list.some((n) => n.id === e.detail.id)) { list.unshift(e.detail); render(); } };
  addEventListener("s3d-notification", onNew);
  render();
  popups();
}
