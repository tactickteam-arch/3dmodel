// Tests the 3D Catalogue Admin (/admin) and the catalogue's usage tracking (/track.js) in headless Chrome:
// 1. every admin page in demo mode (/admin?demo=1) at desktop and phone width: it renders, the demo banner
//    shows, nothing scrolls sideways, no console errors; plus the add/edit/delete, invite, approve, QR, CSV
//    and audit-filter flows on the sample data, and what the manager and viewer roles see;
// 2. real mode shows the sign-in screen (no sample numbers) without touching the database;
// 3. track.js: off on localhost; with ?track=1 it sends the right body to s3d_track (fetch is stubbed, so
//    nothing reaches Supabase); the product page's hooks; pairing with ?pair=CODE.
// usage: node test_admin.mjs <base url> <out dir> [product id]      (PORT: the browser's debugging port)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, pid] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const products = (await (await fetch(`${base}/products.json`)).json()).products;
const id = pid || products.find((p) => !p.hidden && p.category === "Refrigerator")?.id || products.find((p) => !p.hidden).id;
const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9066) });
const errors = () => b.logs.filter((l) => /EXCEPTION|LOG |\[error\]/.test(l));
const PAGES = ["dashboard", "analytics", "stores", "devices", "products", "categories", "users", "roles", "audit"];
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const js = (o) => JSON.stringify(o);

async function open(page, query = "?demo=1") {
  await b.evalJS(`location.hash = ${js(`#/${page}`)}`);
  const url = `${base}/admin${query}#/${page}`;
  if (!(await b.evalJS(`location.href === ${js(url)} && !!window.__admin`))) await b.go(url);
  return b.waitFor(`window.__admin?.page === ${js(page)} && !document.querySelector('#page .loading')`, 20000);
}
const noSideScroll = () => b.evalJS("document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1");

// ── 1. demo mode, every page, desktop then phone ──
for (const [w, h, mobile, label] of [[1440, 900, false, "desktop"], [390, 844, true, "phone"]]) {
  console.log(`\n[demo mode, ${label} ${w}×${h}]`);
  await b.viewport(w, h, mobile, mobile ? IPHONE : DESKTOP);
  await b.go(`${base}/admin?demo=1#/dashboard`);
  for (const page of PAGES) {
    const ready = await open(page);
    await sleep(page === "dashboard" || page === "analytics" ? 900 : 300);
    const r = JSON.parse(await b.evalJS(`JSON.stringify({
      banner: !!document.querySelector('.banner.demo') && getComputedStyle(document.querySelector('.banner.demo')).display !== 'none',
      pill: !!document.querySelector('.demo-pill'),
      crumb: document.getElementById('crumb')?.textContent,
      err: !!document.querySelector('#page .banner.bad'),
      text: document.getElementById('page').innerText.length })`));
    check(ready && r.banner && r.pill && !r.err && r.text > 80, `${page}: renders with the "Demo data" banner (${r.crumb})`);
    check(await noSideScroll(), `${page}: no sideways scroll at ${w} px`);
    await b.shot(`${out}/${label}-${page}.png`);
  }
  // the sidebar: beside the page on a desktop, a drawer on a phone
  const side = JSON.parse(await b.evalJS(`JSON.stringify((()=>{const r=document.getElementById('side').getBoundingClientRect();return {x:r.x,w:r.width,vis:getComputedStyle(document.getElementById('side')).visibility}})())`));
  if (mobile) {
    check(side.x + side.w <= 1 || side.vis === "hidden", "phone: the sidebar is closed");
    await b.evalJS("document.getElementById('sideBtn').click()");
    await sleep(400);
    check(await b.evalJS("document.getElementById('shell').classList.contains('open') && document.getElementById('side').getBoundingClientRect().x >= 0"), "phone: the menu button opens the sidebar");
    await b.shot(`${out}/phone-menu.png`);
    await b.evalJS("document.querySelector('.nav a[data-page=devices]').click()");
    await b.waitFor("window.__admin.page === 'devices'");
    check(await b.evalJS("!document.getElementById('shell').classList.contains('open')"), "phone: choosing a page closes the sidebar");
  } else check(side.x === 0 && side.w > 200 && side.vis === "visible", "desktop: the sidebar is beside the page");
}

// ── the flows, on the sample data (desktop) ──
console.log("\n[demo mode: flows]");
await b.viewport(1440, 900, false, DESKTOP);
await b.go(`${base}/admin?demo=1#/dashboard`);
await open("dashboard");
await sleep(1200);
const dash = JSON.parse(await b.evalJS(`JSON.stringify({
  cards: document.querySelectorAll('#snap .stat').length,
  health: [...document.querySelectorAll('#snap .stat')].find(s => s.textContent.includes('System health'))?.querySelector('.v').textContent,
  charts: document.querySelectorAll('#page canvas').length,
  products: [...document.querySelectorAll('#snap .stat')].find(s => s.textContent.includes('Total products'))?.querySelector('.v').textContent })`));
check(dash.cards >= 12 && dash.health === "Online", `dashboard: ${dash.cards} snapshot cards, health ${dash.health}`);
check(+dash.products === products.length, `dashboard: total products ${dash.products} = products.json (${products.length})`);
check(dash.charts >= 5, `dashboard: ${dash.charts} charts drawn`);
await b.evalJS("(()=>{const s=document.getElementById('range'); s.value='24h'; s.dispatchEvent(new Event('change'));})()");
await sleep(900);
check(await b.evalJS("Chart.getChart(document.querySelector('#cViews canvas'))?.data.labels.length >= 24"), "dashboard: Last 24 hours shows hourly points");
await b.evalJS("document.getElementById('refresh').click()");
await sleep(900);
check(await b.evalJS("/Updated/.test(document.getElementById('stamp').textContent)"), "dashboard: Refresh reloads it");

// CSV: catch the download link instead of saving a file
await b.evalJS(`window.__csv = []; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__csv.push({ name: this.download, href: this.href }); };`);
await open("analytics");
await sleep(900);
const an = JSON.parse(await b.evalJS(`JSON.stringify({ rows: document.querySelectorAll('#h-products ~ * tbody tr, [aria-labelledby=h-products] tbody tr').length, rate: [...document.querySelectorAll('[aria-labelledby=h-products] tbody tr')][0]?.children[3]?.textContent })`));
check(an.rows >= 1 && /%$/.test(an.rate || ""), `analytics: ${an.rows} product rows, AR rate ${an.rate}`);
await b.evalJS("document.getElementById('csv').click()");
await sleep(200);
const csv = await b.evalJS("(async()=>{const c=window.__csv.at(-1); return c ? c.name + '\\n' + await (await fetch(c.href)).text() : ''})()");
check(/catalogue-products-.*\.csv/.test(csv) && /Product id,Product,Model,Views,AR opens,AR rate/.test(csv), `analytics: CSV export (${csv.split("\n")[0]})`);
await b.evalJS("(()=>{const s=document.getElementById('platform'); s.value='ios'; s.dispatchEvent(new Event('change'));})()");
await sleep(700);
check(await b.evalJS("[...document.querySelectorAll('[aria-labelledby=h-platforms] tbody tr')].length === 1 && /iPhone/.test(document.querySelector('[aria-labelledby=h-platforms] tbody tr').textContent)"), "analytics: the platform filter narrows it to iPhone / iPad");
await b.evalJS("document.querySelector('[data-days=\"7\"]').click()");
await sleep(700);
check(await b.evalJS("Chart.getChart(document.querySelector('#cDays canvas'))?.data.labels.length === 7"), "analytics: 7 days shows 7 days");

await open("stores");
const nStores = await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length");
await b.evalJS("document.getElementById('add').click()");
await sleep(200);
await b.evalJS(`(()=>{const f=document.querySelector('dialog form'); f.name.value='Test store'; f.city.value='Mysuru'; document.querySelector('dialog [data-submit]').click();})()`);
await b.waitFor(`document.querySelectorAll('#rows tr[data-id]').length === ${nStores + 1}`, 5000);
check(await b.evalJS("[...document.querySelectorAll('#rows td')].some(td => td.textContent === 'Test store')"), "stores: add a store");
await b.evalJS(`[...document.querySelectorAll('#rows tr')].find(tr => tr.textContent.includes('Test store')).querySelector('[data-edit]').click()`);
await sleep(200);
await b.evalJS(`(()=>{const f=document.querySelector('dialog form'); f.name.value='Test store 2'; document.querySelector('dialog [data-submit]').click();})()`);
await b.waitFor("[...document.querySelectorAll('#rows td')].some(td => td.textContent === 'Test store 2')", 5000);
check(true, "stores: edit a store");
await b.evalJS(`[...document.querySelectorAll('#rows tr')].find(tr => tr.textContent.includes('Test store 2')).querySelector('[data-del]').click()`);
await sleep(200);
await b.evalJS("document.querySelector('dialog [data-ok]').click()");
await b.waitFor(`document.querySelectorAll('#rows tr[data-id]').length === ${nStores}`, 5000);
check(await b.evalJS(`document.querySelectorAll('#rows tr[data-id]').length === ${nStores}`), "stores: delete a store");

await open("devices");
await b.evalJS("document.getElementById('add').click()");
await sleep(200);
await b.evalJS(`(()=>{const f=document.querySelector('dialog form'); f.name.value='Test tablet'; f.store_id.value=f.store_id.options[1].value; document.querySelector('dialog [data-submit]').click();})()`);
await b.waitFor("document.querySelector('dialog .qr svg')", 5000);
const pair = await b.evalJS("document.querySelector('dialog .linkbox code').textContent");
check(/\/\?pair=[A-HJ-NP-Z2-9]{8}$/.test(pair) && (await b.evalJS("!!document.querySelector('dialog .qr svg')")), `devices: a new device gets a pairing link and QR code (${pair})`);
await b.shot(`${out}/device-qr.png`);
await b.evalJS("document.querySelector('dialog [data-close]').click()");
await sleep(200);
const before = await b.evalJS(`[...document.querySelectorAll('#rows tr')].find(tr => tr.textContent.includes('Test tablet')).querySelector('td.mono').textContent`);
await b.evalJS(`[...document.querySelectorAll('#rows tr')].find(tr => tr.textContent.includes('Test tablet')).querySelector('[data-reset]').click()`);
await sleep(200);
await b.evalJS("document.querySelector('dialog [data-ok]').click()");
await b.waitFor("document.querySelector('dialog .qr svg')", 5000);
check(!(await b.evalJS(`document.querySelector('dialog .linkbox code').textContent.endsWith(${js(before)})`)), "devices: New code makes a different pairing code");
await b.evalJS("document.querySelector('dialog [data-close]').click()");
check(await b.evalJS("[...document.querySelectorAll('#rows tr')].some(tr => /Paired/.test(tr.textContent) && /Android|iPhone|Quest/.test(tr.textContent))"), "devices: paired status and platform shown");

await open("users");
await b.evalJS(`[...document.querySelectorAll('#rows tr')].find(tr => tr.textContent.includes('Waiting approval')).querySelector('[data-act=approve]').click()`);
await b.waitFor("![...document.querySelectorAll('#rows tr')].some(tr => tr.querySelector('[data-act=approve]'))", 5000);
check(await b.evalJS("![...document.querySelectorAll('#rows tr')].some(tr => tr.querySelector('[data-act=approve]'))"), "users: approve a pending user");
await b.evalJS("document.getElementById('invite').click()");
await sleep(200);
await b.evalJS(`(()=>{const f=document.querySelector('dialog form'); f.email.value='new.person@example.com'; f.role.value='manager'; document.querySelector('dialog [data-submit]').click();})()`);
await b.waitFor("document.querySelector('dialog .secret')", 5000);
check(await b.evalJS("document.querySelector('dialog .secret').textContent.length >= 8"), "users: invite shows a one-time password once");
await b.evalJS("document.querySelector('dialog [data-close]').click()");
await sleep(200);
check(await b.evalJS("document.getElementById('inv').textContent.includes('new.person@example.com')"), "users: the invite is listed under Open invites");
await b.evalJS(`[...document.querySelectorAll('#rows tr')].find(tr => tr.textContent.includes('sample.manager2')).querySelector('[data-act=edit]').click()`);
await sleep(200);
await b.evalJS(`(()=>{const f=document.querySelector('dialog form'); f.role.value='viewer'; document.querySelector('dialog [data-submit]').click();})()`);
await b.waitFor(`[...document.querySelectorAll('#rows tr')].find(tr => tr.textContent.includes('sample.manager2'))?.textContent.includes('Viewer')`, 5000);
check(true, "users: change a user's role");
await b.evalJS(`[...document.querySelectorAll('#rows tr')].find(tr => tr.textContent.includes('(you)')).querySelector('[data-act=edit]').click()`);
await sleep(200);
await b.evalJS(`(()=>{const f=document.querySelector('dialog form'); f.role.value='viewer'; document.querySelector('dialog [data-submit]').click();})()`);
await b.waitFor("!document.querySelector('#mformErr')?.classList.contains('hide')", 5000);
check(/at least one active admin/.test(await b.evalJS("document.getElementById('mformErr')?.textContent || ''")), "users: the last admin can't demote themselves");
await b.evalJS("document.querySelector('dialog [data-close]').click()");

await open("audit");
await b.evalJS("(()=>{const s=document.getElementById('action'); s.value='login_failed'; s.dispatchEvent(new Event('change'));})()");
await sleep(500);
const au = JSON.parse(await b.evalJS(`JSON.stringify({ n: document.querySelectorAll('#rows tr').length, all: [...document.querySelectorAll('#rows tr')].every(tr => tr.textContent.includes('Sign-in failed')) })`));
check(au.n >= 1 && au.all, `audit: filter by action (${au.n} failed sign-ins)`);
await b.evalJS("(()=>{const s=document.getElementById('action'); s.value=''; s.dispatchEvent(new Event('change'));})()");
await sleep(500);
const page1 = await b.evalJS("document.getElementById('count').textContent");
await b.evalJS("document.getElementById('next').click()");
await sleep(500);
const page2 = await b.evalJS("document.getElementById('count').textContent");
check(/^Showing 1–25 of/.test(page1) && /^Showing 26–50 of/.test(page2), `audit: paging (${page1} → ${page2})`);
check(await b.evalJS("[...document.querySelectorAll('#rows tr')].length === 25"), "audit: 25 rows a page");
await b.evalJS("(()=>{const u=document.getElementById('user'); u.value='manager1'; u.dispatchEvent(new Event('input'));})()");
await sleep(900);
check(await b.evalJS("[...document.querySelectorAll('#rows tr')].every(tr => tr.children[2]?.textContent.includes('manager1'))"), "audit: filter by user");

await open("products");
await sleep(500);
const pr = JSON.parse(await b.evalJS(`JSON.stringify({ rows: document.querySelectorAll('#rows tr[data-id]').length, hidden: [...document.querySelectorAll('#rows tr')].filter(tr => tr.textContent.includes('Hidden')).length, open: document.querySelector('#rows a[href^="/p/"]')?.getAttribute('href') })`));
check(pr.rows === products.length && pr.hidden === products.filter((p) => p.hidden).length, `products: ${pr.rows} rows, ${pr.hidden} hidden`);
await b.evalJS("document.querySelector('#rows tr:not([data-hidden]) [data-qr]:not([disabled])').click()");
await sleep(300);
check(await b.evalJS("/\\/p\\/[a-z0-9-]+$/.test(document.querySelector('dialog .linkbox code').textContent) && !!document.querySelector('dialog .qr svg')"), "products: QR code for the store-app link /p/<id>");
await b.evalJS("document.querySelector('dialog [data-close]').click()");
await sleep(1500);
check(await b.evalJS("[...document.querySelectorAll('#rows [data-size]')].every(c => c.textContent !== '…' && !/Missing/.test(c.textContent))"), "products: every file answers its HEAD request");

// roles
for (const [as, users, add] of [["manager", false, true], ["viewer", false, false]]) {
  await b.go(`${base}/admin?demo=1&as=${as}#/stores`);
  await b.waitFor("window.__admin?.page === 'stores'", 10000);
  const r = JSON.parse(await b.evalJS(`JSON.stringify({ users: !!document.querySelector('.nav a[data-page=users]'), audit: !!document.querySelector('.nav a[data-page=audit]'), add: !!document.getElementById('add'), ro: /Read-only/.test(document.getElementById('page').textContent) })`));
  check(r.users === users && r.audit === false && r.add === add && r.ro === !add, `${as}: ${add ? "can add stores" : "read-only stores"}, no Users or Audit logs`);
  await b.evalJS("location.hash = '#/users'");
  await sleep(500);
  check(await b.evalJS("window.__admin.page === 'dashboard'"), `${as}: #/users falls back to the dashboard`);
}

// ── 2. real mode: the sign-in screen, no sample data ──
console.log("\n[real mode]");
for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  await b.viewport(w, h, mobile, mobile ? IPHONE : DESKTOP);
  await b.go(`${base}/admin`);
  const ok = await b.waitFor("!!document.getElementById('login')", 20000);
  check(ok && (await b.evalJS("!document.querySelector('.banner.demo') && !/Sample|Demo data/.test(document.body.innerText)")), `${w} px: /admin shows the sign-in form and no sample data`);
  check(await noSideScroll(), `${w} px: sign-in has no sideways scroll`);
  await b.shot(`${out}/signin-${w}.png`);
}
await b.evalJS("document.getElementById('forgot').click()");
check(await b.evalJS("!!document.getElementById('forgotForm')"), "Forgot password? opens the reset form");
await b.go("about:blank");
await b.go(`${base}/admin#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
await b.waitFor("!!document.getElementById('login')", 20000);
check(await b.evalJS("/expired/.test(document.getElementById('authMsg').textContent) && !location.hash.includes('error')"), "an expired email link says so, and is cleared from the address");

// ── 3. track.js ──
console.log("\n[track.js]");
await b.viewport(1280, 860, false, DESKTOP);
// every call to Supabase's REST API is answered here, and recorded; nothing leaves the machine
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `
  window.__calls = [];
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, init = {}) => {
    const u = String(url && url.url || url);
    if (!u.includes('.supabase.co/')) return realFetch(url, init);
    window.__calls.push({ url: u, body: init.body ? JSON.parse(init.body) : null, keepalive: !!init.keepalive, headers: init.headers || {}, credentials: init.credentials });
    if (window.__failFetch) return Promise.reject(new TypeError('Failed to fetch'));
    const reply = u.endsWith('/s3d_pair') ? JSON.stringify({ ok: true, device: '11111111-2222-4333-8444-555555555555', store: 'Test store <b>1</b>', name: 'Test tablet' }) : '';
    return Promise.resolve(new Response(reply || null, { status: reply ? 200 : 204, headers: { 'Content-Type': 'application/json' } }));
  };` });
const calls = async (name) => JSON.parse(await b.evalJS(`JSON.stringify((window.__calls || []).filter(c => c.url.endsWith('/rpc/${name}')))`));
const logsBefore = b.logs.length;

await b.go(`${base}/`);
await b.waitFor("document.querySelectorAll('.card').length > 0");
await sleep(600);
check((await b.evalJS("typeof window.s3dTrack")) === "function" && (await calls("s3d_track")).length === 0, "off on localhost: the catalogue sends nothing");
await b.evalJS("s3dTrack('VIEW', 'x')");
await sleep(100);
check((await calls("s3d_track")).length === 0, "off on localhost: s3dTrack() sends nothing");

await b.go(`${base}/?track=1`);
await b.waitFor("document.querySelectorAll('.card').length > 0");
await sleep(600);
let c = await calls("s3d_track");
const body = c[0]?.body || {};
check(c.length === 1 && body.p_kind === "CATALOGUE" && body.p_product === null && body.p_detail === null && body.p_device === null && body.p_platform === "desktop" && /^[A-Za-z0-9-]{8,64}$/.test(body.p_session || ""), `?track=1: CATALOGUE sent with ${js(body)}`);
check(c[0]?.keepalive === true && c[0]?.credentials === "omit" && /^eyJ/.test(c[0]?.headers?.apikey || "") && c[0]?.headers?.Authorization === `Bearer ${c[0]?.headers?.apikey}` && c[0]?.url === "https://rjbjlkickdnpsaicynap.supabase.co/rest/v1/rpc/s3d_track", "the request: keepalive, no cookies, the anon key, the s3d_track RPC");
const session = body.p_session;
await b.evalJS(`try { s3dTrack('AR', ${js(id)}, 'ios'); s3dTrack('nope', 'x'); window.__failFetch = true; s3dTrack('VIEW', ${js(id)}); s3dTrack(); s3dTrack({}, {}, {}); } catch { window.__trackThrew = true; } setTimeout(() => (window.__failFetch = false), 200);`);
await sleep(300);
c = await calls("s3d_track");
check(c.some((x) => x.body.p_kind === "AR" && x.body.p_product === id && x.body.p_detail === "ios") && !c.some((x) => x.body.p_kind === "NOPE"), "s3dTrack('AR', id, 'ios') is sent; an unknown kind is not");
check(!(await b.evalJS("window.__trackThrew === true")), "s3dTrack never throws (failing network, bad arguments)");

// the product page, in the same tab (?track=1 stays on for the tab)
await b.go(`${base}/p/${id}`);
await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 60000);
await sleep(1500);
c = await calls("s3d_track");
check(c.length === 1 && c[0].body.p_kind === "VIEW" && c[0].body.p_product === id && c[0].body.p_session === session, `product page: VIEW for ${id}, same tab session`);
await b.evalJS("document.querySelector('#parts button[id^=part-]:not(#part-organise)')?.click()");
await sleep(400);
await b.evalJS("window.__demo.showFeature(0)");
await sleep(300);
await b.evalJS(`(()=>{ for (const [k, v] of [['w', 200], ['h', 250], ['d', 100]]) { const i = document.getElementById('fit-' + k); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } } })()`);
await sleep(2600);
await b.evalJS("document.getElementById('part-organise')?.click()");
await sleep(300);
await b.evalJS("document.getElementById('btnRoom')?.click()");
await sleep(300);
c = await calls("s3d_track");
const kinds = c.map((x) => `${x.body.p_kind}${x.body.p_detail ? `:${x.body.p_detail}` : ""}`);
const isFridge = products.find((p) => p.id === id)?.category === "Refrigerator";
check(kinds.some((k) => k.startsWith("PART:")), `product page: a part press sends PART with its key (${kinds.find((k) => k.startsWith("PART")) || "none"})`);
check(kinds.some((k) => k.startsWith("FEATURE:")), "product page: opening a feature sends FEATURE with its title");
check(kinds.some((k) => k.startsWith("FIT:")), `product page: Will it fit sends FIT once typing stops (${kinds.find((k) => k.startsWith("FIT")) || "none"})`);
if (isFridge) check(kinds.includes("FILL"), "product page: Fill the fridge sends FILL");
check(kinds.includes("ROOM"), "product page: Try it in a photo of your room sends ROOM");
check(c.every((x) => x.body.p_product === id), "product page: every event names the product");
await b.go(`${base}/p/${id}?embed`);
await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 60000);
await sleep(800);
c = await calls("s3d_track");
check(c.some((x) => x.body.p_kind === "VIEW") && c.some((x) => x.body.p_kind === "EMBED"), "embed: VIEW and EMBED");

// pairing
await b.go(`${base}/p/${id}?pair=abcd-2345&x=1`);
await b.waitFor("[...document.querySelectorAll('[role=status]')].some(e => /linked/.test(e.textContent))", 15000);
const pr2 = await calls("s3d_pair");
check(pr2.length === 1 && pr2[0].body.p_code === "abcd-2345" && pr2[0].body.p_platform === "desktop", `?pair=CODE calls s3d_pair with ${js(pr2[0]?.body)}`);
check(await b.evalJS("localStorage.getItem('s3d-device') === '11111111-2222-4333-8444-555555555555'"), "pairing stores the device id");
const note = await b.evalJS("[...document.querySelectorAll('[role=status]')].map(e => e.textContent).find(t => /linked/.test(t)) || ''");
check(note === "This device is now linked to Test store <b>1</b>.", `pairing shows “${note}” (the store's name as text, not HTML)`);
check(await b.evalJS("location.search === '?x=1'"), "pairing removes ?pair from the address and keeps the rest");
check(await b.evalJS("!document.getElementById('btnWhatsApp').href.includes('pair')"), "the page's share links don't carry the pairing code");
await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 60000);
await sleep(500);
c = await calls("s3d_track");
check(c.some((x) => x.body.p_kind === "VIEW" && x.body.p_device === "11111111-2222-4333-8444-555555555555"), "after pairing, events carry the device id");
const trackLogs = b.logs.slice(logsBefore).filter((l) => /s3d|track/i.test(l));
check(trackLogs.length === 0, `track.js writes nothing to the console${trackLogs.length ? ": " + trackLogs.join(" | ") : ""}`);

// xr.js still loads
check((await b.evalJS("import('/xr.js').then(m => typeof m.runXR)")) === "function", "xr.js loads (runXR exported)");

const errs = errors();
check(errs.length === 0, `no console errors${errs.length ? ":\n    " + errs.slice(0, 8).join("\n    ") : ""}`);
b.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
