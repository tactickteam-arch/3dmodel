// 3D Catalogue Admin: sign-in, the shell (sidebar and top bar) and the page router (#/dashboard …).
// Real mode talks to Supabase (api.js); /admin?demo=1 shows the same pages from sample data (demo.js).
import { esc, icon, toast, destroyCharts, errorBox } from "./ui.js";
import { COMPANY } from "./config.js";
import * as pages from "./pages.js";

const params = new URLSearchParams(location.search);
const DEMO = params.get("demo") === "1";
const root = document.getElementById("app");
const ROLES = { admin: "Admin", manager: "Manager", viewer: "Viewer" };

const PAGES = [
  { id: "dashboard", group: "Overview", label: "Dashboard", ic: "gauge", run: pages.dashboard },
  { id: "analytics", group: "Overview", label: "Analytics", ic: "chart", run: pages.analytics },
  { id: "stores", group: "Business operations", label: "Stores", ic: "store", run: pages.storesPage },
  { id: "devices", group: "Business operations", label: "Devices", ic: "devices", run: pages.devicesPage },
  { id: "products", group: "Business operations", label: "Products", ic: "box", run: pages.products },
  { id: "categories", group: "Metadata", label: "Categories", ic: "grid", run: pages.categories },
  { id: "users", group: "Access management", label: "Users", ic: "users", run: pages.usersPage, roles: ["admin"] },
  { id: "roles", group: "Access management", label: "Roles", ic: "shield", run: pages.rolesPage },
  { id: "audit", group: "Access management", label: "Audit logs", ic: "history", run: pages.auditPage, roles: ["admin"] },
];

let api = null;
let profile = null;

function fatal(e) {
  root.innerHTML = `<div class="auth"><div class="auth-card">${brand()}<h1>Something went wrong</h1>${errorBox(e)}
    <p style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="reload">${icon("refresh")}Reload</button>${api ? `<button class="btn" id="out">${icon("logout")}Sign out</button>` : ""}</p></div></div>`;
  root.querySelector("#reload").addEventListener("click", () => location.reload());
  root.querySelector("#out")?.addEventListener("click", async () => { try { await api.signOut(); } catch {} location.reload(); });
}
const brand = () => `<div class="auth-brand"><span class="logo">${icon("cube")}</span>3D Catalogue Admin</div>`;
const demoNote = () => (DEMO ? `<div class="msg warn" style="margin-bottom:16px"><b>Demo data.</b> This is the admin with sample data. Any email and password signs in; nothing is saved.</div>` : "");

// ── sign-in screens ──────────────────────────────────────────────────────────────────────────────────
function showLogin(notice) {
  destroyCharts();
  document.title = "Sign in · 3D Catalogue Admin";
  root.innerHTML = `<main class="auth"><div class="auth-card">${brand()}
    <h1>Sign in</h1><p class="lead">For ${COMPANY} staff. Use the email and password your admin set up for you.</p>
    ${demoNote()}
    <div id="authMsg" role="alert" aria-live="polite">${notice ? `<div class="msg ${notice.tone}" style="margin-bottom:14px">${esc(notice.text)}</div>` : ""}</div>
    <form id="login" novalidate>
      <label class="field">Email<input type="email" id="email" autocomplete="username" required maxlength="254"></label>
      <label class="field">Password<input type="password" id="password" autocomplete="current-password" required></label>
      <button class="btn primary block" type="submit" id="go">${icon("login")}Sign in</button>
      <div class="row"><button type="button" class="linkbtn" id="forgot">Forgot password?</button></div>
    </form></div></main>`;
  const msg = (text, tone = "bad") => (root.querySelector("#authMsg").innerHTML = `<div class="msg ${tone}" style="margin-bottom:14px">${esc(text)}</div>`);
  root.querySelector("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = root.querySelector("#email").value.trim(), password = root.querySelector("#password").value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password) return msg("Enter your email and password.");
    const go = root.querySelector("#go");
    go.disabled = true;
    try { profile = await api.signIn(email, password); decide(); }
    catch (err) { msg(err.message); go.disabled = false; }
  });
  root.querySelector("#forgot").addEventListener("click", () => showForgot(root.querySelector("#email").value.trim()));
  root.querySelector("#email").focus();
}

function showForgot(email = "") {
  root.innerHTML = `<main class="auth"><div class="auth-card">${brand()}
    <h1>Forgot password</h1><p class="lead">We’ll email you a link to choose a new password. Open it on this device.</p>
    <div id="authMsg" role="alert" aria-live="polite"></div>
    <form id="forgotForm" novalidate>
      <label class="field">Email<input type="email" id="email" autocomplete="username" required maxlength="254" value="${esc(email)}"></label>
      <button class="btn primary block" type="submit" id="go">${icon("mail")}Send the link</button>
      <div class="row"><button type="button" class="linkbtn" id="back">Back to sign in</button></div>
    </form></div></main>`;
  const msg = (text, tone) => (root.querySelector("#authMsg").innerHTML = `<div class="msg ${tone}" style="margin-bottom:14px">${esc(text)}</div>`);
  root.querySelector("#forgotForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const em = root.querySelector("#email").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return msg("Enter your email.", "bad");
    const go = root.querySelector("#go");
    go.disabled = true;
    try { await api.forgot(em); msg(`If ${em} has an account, a link to set a new password is on its way. It can take a few minutes; check spam too.`, "good"); }
    catch (err) { msg(err.message, "bad"); go.disabled = false; }
  });
  root.querySelector("#back").addEventListener("click", () => showLogin());
  root.querySelector("#email").focus();
}

// mode: "first" (still on the one-time password), "recovery" (from a reset email) or "change" (from the menu)
function showSetPassword(mode) {
  destroyCharts();
  document.title = "Set your password · 3D Catalogue Admin";
  const lead = {
    first: "You signed in with a one-time password. Choose your own for",
    recovery: "You’re signed in from the email link. Choose a new password for",
    change: "Choose a new password for",
  }[mode];
  root.innerHTML = `<main class="auth"><div class="auth-card">${brand()}
    <h1>${mode === "first" ? "Set your own password" : "Choose a new password"}</h1>
    <p class="lead">${lead} <b>${esc(profile.email)}</b>.${mode === "first" ? " Until then your account counts as “Password pending”." : ""}</p>
    <div id="authMsg" role="alert" aria-live="polite"></div>
    <form id="pw" novalidate>
      <label class="field">New password<input type="password" id="p1" autocomplete="new-password" required minlength="8"><span class="help">At least 8 characters, with letters and numbers.</span></label>
      <label class="field">Type it again<input type="password" id="p2" autocomplete="new-password" required></label>
      <button class="btn primary block" type="submit" id="go">${icon("key")}Save password</button>
      <div class="row"><button type="button" class="linkbtn" id="out">${mode === "change" ? "Cancel" : "Sign out"}</button></div>
    </form></div></main>`;
  const msg = (text) => (root.querySelector("#authMsg").innerHTML = `<div class="msg bad" style="margin-bottom:14px">${esc(text)}</div>`);
  root.querySelector("#pw").addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = root.querySelector("#p1").value, b = root.querySelector("#p2").value;
    if (a.length < 8 || !/[A-Za-z]/.test(a) || !/[0-9]/.test(a)) return msg("Use at least 8 characters, with letters and numbers.");
    if (a !== b) return msg("The two passwords are different.");
    const go = root.querySelector("#go");
    go.disabled = true;
    try { profile = await api.setPassword(a); toast("Password saved."); decide(); }
    catch (err) { msg(err.message); go.disabled = false; }
  });
  root.querySelector("#out").addEventListener("click", mode === "change" ? decide : signOut);
  root.querySelector("#p1").focus();
}

function showBlocked() {
  destroyCharts();
  const pending = profile.status === "pending";
  root.innerHTML = `<main class="auth"><div class="auth-card">${brand()}
    <h1>${pending ? "Waiting for approval" : "Your access is turned off"}</h1>
    <p class="lead">${pending ? `You’re signed in as <b>${esc(profile.email)}</b>, but an admin has to approve this account first. Ask them to open Users and approve it.` : `<b>${esc(profile.email)}</b> can’t use this admin any more. Ask an admin if this is a mistake.`}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">${pending ? `<button class="btn primary" id="again">${icon("refresh")}Check again</button>` : ""}<button class="btn" id="out">${icon("logout")}Sign out</button></div>
    </div></main>`;
  root.querySelector("#again")?.addEventListener("click", async () => { try { profile = await api.refreshProfile(); decide(); } catch (e) { toast(e.message, true); } });
  root.querySelector("#out").addEventListener("click", signOut);
}

async function signOut() {
  try { await api.signOut(); } catch {}
  profile = null;
  shellBuilt = false;
  showLogin({ tone: "good", text: "You’re signed out." });
}

let recoveryMode = false;
function decide() {
  if (!profile) return showLogin();
  if (profile.status !== "active") return showBlocked();
  if (recoveryMode || !profile.password_set) { const mode = profile.password_set ? "recovery" : "first"; recoveryMode = false; return showSetPassword(mode); }
  buildShell();
  route();
}

// ── the shell ────────────────────────────────────────────────────────────────────────────────────────
let shellBuilt = false;
const allowed = (p) => !p.roles || p.roles.includes(profile.role);
function buildShell() {
  if (shellBuilt) return;
  shellBuilt = true;
  const groups = [...new Set(PAGES.map((p) => p.group))];
  const name = profile.full_name || profile.email.split("@")[0];
  const collapsed = (() => { try { return localStorage.getItem("s3d-admin-side") === "closed"; } catch { return false; } })();
  root.innerHTML = `<div class="shell${collapsed && innerWidth > 900 ? " collapsed" : ""}" id="shell">
    <aside class="side" id="side" aria-label="Sections">
      <div class="brand"><span class="logo">${icon("cube")}</span>3D Catalogue Admin</div>
      ${groups.map((g) => { const items = PAGES.filter((p) => p.group === g && allowed(p)); return items.length ? `<nav class="nav-group nav" aria-label="${esc(g)}"><div class="nav-label">${esc(g)}</div>${items.map((p) => `<a href="#/${p.id}" data-page="${p.id}">${icon(p.ic)}${esc(p.label)}</a>`).join("")}</nav>` : ""; }).join("")}
      <div class="side-foot">
        <div class="avatar" aria-hidden="true">${esc(name[0].toUpperCase())}</div>
        <div class="who"><b>${esc(name)}</b><span>${esc(profile.email)}</span></div>
        <button class="btn ghost icon" id="userBtn" aria-label="Account menu" aria-haspopup="menu" aria-expanded="false">${icon("more")}</button>
        <div class="menu hide" id="userMenu" role="menu">
          <div class="role">${esc(ROLES[profile.role] || profile.role)}${profile.store ? ` · ${esc(profile.store)}` : ""}</div>
          <a href="/" target="_blank" rel="noopener" role="menuitem">${icon("external")}Open the catalogue</a>
          <button id="pwBtn" role="menuitem">${icon("key")}Change password</button>
          <button id="outBtn" role="menuitem">${icon("logout")}Sign out</button>
        </div>
      </div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <div class="main">
      <header class="top">
        <button class="btn ghost icon" id="sideBtn" aria-label="Show or hide the sections" aria-controls="side">${icon("panel")}</button>
        <nav class="crumbs" aria-label="Breadcrumb"><span>${COMPANY}</span>${icon("chevron")}<b id="crumb">Dashboard</b></nav>
        <span class="spacer"></span>
        ${DEMO ? `<span class="demo-pill">DEMO DATA</span>` : ""}
      </header>
      <div class="content">
        ${DEMO ? `<div class="banner demo" role="note">${icon("alert")}<div><b>Demo data.</b> Every number on these pages is made-up sample data, not from the database. Only the product list is real (from /products.json). Changes here are not saved.</div></div>` : ""}
        <div id="page" style="display:grid;gap:24px;min-width:0"></div>
      </div>
    </div>
  </div>`;
  const shell = root.querySelector("#shell");
  root.querySelector("#sideBtn").addEventListener("click", () => {
    if (innerWidth <= 900) shell.classList.toggle("open");
    else { shell.classList.toggle("collapsed"); try { localStorage.setItem("s3d-admin-side", shell.classList.contains("collapsed") ? "closed" : "open"); } catch {} }
  });
  root.querySelector("#scrim").addEventListener("click", () => shell.classList.remove("open"));
  const menu = root.querySelector("#userMenu"), ub = root.querySelector("#userBtn");
  ub.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("hide"); ub.setAttribute("aria-expanded", String(!menu.classList.contains("hide"))); });
  document.addEventListener("click", (e) => { if (!e.target.closest("#userMenu")) { menu.classList.add("hide"); ub.setAttribute("aria-expanded", "false"); } });
  root.querySelector("#outBtn").addEventListener("click", signOut);
  root.querySelector("#pwBtn").addEventListener("click", () => { shellBuilt = false; showSetPassword("change"); });
}

let token = 0;
async function route() {
  if (!profile || !shellBuilt) return;
  const want = (location.hash.match(/^#\/([a-z]+)/) || [])[1];
  const page = PAGES.find((p) => p.id === want && allowed(p)) || PAGES[0];
  if (want !== page.id) history.replaceState(history.state, "", `${location.pathname}${location.search}#/${page.id}`);
  const my = ++token;
  destroyCharts();
  document.querySelectorAll("dialog.modal").forEach((d) => d.close());
  root.querySelectorAll(".nav a").forEach((a) => (a.dataset.page === page.id ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  root.querySelector("#crumb").textContent = page.label;
  root.querySelector("#shell").classList.remove("open");
  document.title = `${page.label} · 3D Catalogue Admin${DEMO ? " (demo)" : ""}`;
  const el = root.querySelector("#page");
  el.innerHTML = `<div class="loading">Loading…</div>`;
  scrollTo(0, 0);
  const role = profile.role;
  const ctx = { el, api, profile, alive: () => my === token, can: { write: role === "admin" || role === "manager", admin: role === "admin" } };
  try { await page.run(ctx); }
  catch (e) { if (my === token) el.innerHTML = errorBox(e); }
  if (my === token) el.dataset.ready = page.id;   // for the tests
}
addEventListener("hashchange", route);

// ── start ────────────────────────────────────────────────────────────────────────────────────────────
try {
  api = DEMO ? await (await import("./demo.js")).createDemoApi({ as: params.get("as") }) : await (await import("./api.js")).createApi();
  const start = await api.start();
  profile = start.profile;
  recoveryMode = !!start.recovery;
  if (!profile) showLogin(start.notice);
  else { decide(); if (start.notice) toast(start.notice.text, start.notice.tone === "bad"); }
} catch (e) {
  fatal(e);
}
window.__admin = { demo: DEMO, get profile() { return profile; }, get page() { return document.getElementById("page")?.dataset.ready || null; } };
