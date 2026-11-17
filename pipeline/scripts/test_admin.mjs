// Tests the 3D Catalogue Admin (/admin) and the catalogue's usage tracking (/track.js) in headless Chrome:
// 1. every admin page in demo mode (/admin?demo=1) at desktop and phone width: it renders, the demo banner
//    shows, nothing scrolls sideways, no console errors; plus the add/edit/delete, invite, approve, QR, CSV
//    and audit-filter flows on the sample data, and what the manager and viewer roles see; the 3D tracker (list,
//    filters, an item's details, status change, comment, the auto "Live on site", CSV, a spreadsheet import built
//    here from made-up rows) and the notification bell (count, mark all read, click-through, a new one arriving);
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
const PAGES = ["dashboard", "analytics", "stores", "devices", "products", "tracker", "categories", "users", "roles", "audit", "notifications"];
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

// ── the 3D tracker and the notifications (demo: the catalogue's colours plus made-up SAMPLE- items) ──
console.log("\n[demo mode: tracker and notifications]");
const shownColours = products.filter((p) => !p.hidden).reduce((n, p) => n + (p.finishes?.length || 1), 0);
await b.go("about:blank");   // a fresh load: nothing marked live yet in this demo
await b.go(`${base}/admin?demo=1#/tracker`);
await open("tracker");
await sleep(400);
await b.evalJS(`window.__csv = []; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__csv.push({ name: this.download, href: this.href }); };`);
const trk = JSON.parse(await b.evalJS(`JSON.stringify({
  rows: document.querySelectorAll('#rows tr[data-id]').length,
  count: document.getElementById('count').textContent,
  cards: document.querySelectorAll('#stats .stat').length,
  live: [...document.querySelectorAll('#stats .stat')].find(s => /Live on site/.test(s.textContent))?.querySelector('.v').textContent,
  built: [...document.querySelectorAll('#stats .stat')].find(s => /3D built/.test(s.textContent))?.querySelector('.v').textContent,
  synced: document.getElementById('synced')?.textContent || '',
  bars: document.querySelectorAll('#byStatus .bar-row, #byCat .bar-row, #byBrand .bar-row').length,
  last: document.getElementById('last').textContent })`));
const nItems = parseInt(trk.count.replace(/,/g, ""), 10);
check(trk.rows === Math.min(100, nItems) && nItems >= 100 && trk.cards === 9, `tracker: ${trk.count}, ${trk.rows} rows on the first page, ${trk.cards} summary cards`);
check(+trk.built.replace(/,/g, "") >= shownColours && +trk.live.replace(/,/g, "") > 0 && trk.bars >= 9, `tracker: ${trk.built} built, ${trk.live} live on site (the catalogue has ${shownColours} colours), ${trk.bars} bars by status, category and brand`);
check(/items? (is|are) on the site, so (it is|they are) now marked Live on site/.test(trk.synced), `tracker: items on the site are marked live by themselves (“${trk.synced}”)`);
check(/^Last import: .*new, .*changed/.test(trk.last), `tracker: the last import is shown (${trk.last.slice(0, 60)}…)`);
// a second visit records nothing again
await b.go(`${base}/admin?demo=1#/dashboard`); await open("dashboard"); await open("tracker"); await sleep(300);
check(!(await b.evalJS("!!document.getElementById('synced')")), "tracker: marking live is done once (no note on the next visit)");
// filters
const setSel = (id, v) => b.evalJS(`(()=>{const s=document.getElementById(${js(id)}); s.value=${js(v)}; s.dispatchEvent(new Event('change'));})()`);
await setSel("fcat", "Air conditioner");
await sleep(150);
check(await b.evalJS("[...document.querySelectorAll('#rows tr[data-id]')].every(tr => tr.children[1].textContent === 'Air conditioners') && document.querySelectorAll('#rows tr[data-id]').length > 0 && location.hash.includes('cat=Air')"), `tracker: the category filter (${await b.evalJS("document.getElementById('count').textContent")}), kept in the address`);
await setSel("fcat", "");
await setSel("fstatus", "blocked");
await sleep(150);
check(await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length > 0 && [...document.querySelectorAll('#rows tr[data-id]')].every(tr => tr.children[3].textContent.startsWith('Blocked'))"), "tracker: the status filter");
await setSel("fstatus", "");
await setSel("fbrand", "Sample Brand A");
await sleep(150);
check(await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length > 0 && [...document.querySelectorAll('#rows tr[data-id]')].every(tr => tr.children[2].textContent === 'Sample Brand A')"), "tracker: the brand filter");
await setSel("fbrand", "");
await setSel("fwho", "me");
await sleep(150);
check(await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length >= 1 && [...document.querySelectorAll('#rows tr[data-id]')].every(tr => tr.children[5].textContent === 'Demo Admin')"), "tracker: Assigned to me");
await setSel("fwho", "");
await b.evalJS("document.getElementById('flate').click()");
await sleep(150);
check(await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length >= 1 && [...document.querySelectorAll('#rows tr[data-id]')].every(tr => tr.classList.contains('late'))"), "tracker: Past due");
await b.evalJS("document.getElementById('flate').click()");
await b.evalJS("(()=>{const q=document.getElementById('q'); q.value='sample rf 00'; q.dispatchEvent(new Event('input'));})()");
await sleep(150);
check(await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length === 9 && [...document.querySelectorAll('#rows tr[data-id]')].every(tr => tr.textContent.includes('SAMPLE-RF-00'))"), "tracker: the search ignores case, spaces and dashes (sample rf 00 → 9 items)");
// CSV of the filtered view
await b.evalJS("document.getElementById('csv').click()");
await sleep(200);
const tcsv = await b.evalJS("(async()=>{const c=window.__csv.at(-1); return c ? c.name + '\\n' + await (await fetch(c.href)).text() : ''})()");
check(/^3d-tracker-\d{4}-\d{2}-\d{2}\.csv\n/.test(tcsv) && /Category,Item code,Item \/ Model,Brand/.test(tcsv) && tcsv.trim().split("\n").length === 11 && /On the earlier vendor list/.test(tcsv), `tracker: CSV of the filtered view (${tcsv.split("\n")[0]}, 9 rows)`);
// one item: details, a status change, a comment
await b.evalJS("(()=>{const q=document.getElementById('q'); q.value='SAMPLE-RF-004'; q.dispatchEvent(new Event('input'));})()");
await sleep(150);
await b.evalJS("document.querySelector('#rows tr[data-id] [data-open]').click()");
await b.waitFor("document.querySelector('dialog[open] #tmForm')", 5000);
const item = JSON.parse(await b.evalJS(`JSON.stringify({ code: document.querySelector('dialog[open] .modal-head h2').textContent, facts: document.querySelectorAll('dialog[open] .facts > div').length, hash: location.hash, from: document.querySelector('dialog[open] #tmForm').status.value })`));
check(item.code === "SAMPLE-RF-004" && item.facts >= 14 && /^#\/tracker\/\d+/.test(item.hash), `tracker: an item opens with its details (${item.facts} facts) and its own address ${item.hash.split("?")[0]}`);
const toStatus = item.from === "blocked" ? "in_progress" : "blocked";
await b.evalJS(`(()=>{const f=document.querySelector('dialog[open] #tmForm'); f.status.value=${js(toStatus)}; f.priority.value='urgent'; f.querySelector('[type=submit]').click();})()`);
await b.waitFor(`document.querySelector('dialog[open] #tmForm')?.status.value === ${js(toStatus)} && /moved it/.test(document.querySelector('dialog[open] .timeline')?.textContent || '')`, 5000);
const hist = await b.evalJS("document.querySelector('dialog[open] .timeline').textContent");
check(/Demo Admin moved it/.test(hist) && /set the priority to Urgent/.test(hist), "tracker: a status change is saved and recorded: who, when, from → to");
await b.evalJS(`(()=>{const f=document.querySelector('dialog[open] #tcForm'); f.querySelector('[type=submit]').click();})()`);
await sleep(150);
check(/Write a comment first/.test(await b.evalJS("document.querySelector('dialog[open] #tcErr').textContent")), "tracker: an empty comment is refused");
await b.evalJS(`(()=>{const f=document.querySelector('dialog[open] #tcForm'); f.body.value='Test comment <b>not bold</b>'; f.querySelector('[type=submit]').click();})()`);
await b.waitFor("/Test comment <b>not bold<\\/b>/.test(document.querySelector('dialog[open] .timeline')?.textContent || '')", 5000);
check(await b.evalJS("!document.querySelector('dialog[open] .timeline b b') && [...document.querySelectorAll('dialog[open] .timeline li.cm')].some(li => li.textContent.includes('Test comment <b>not bold</b>'))"), "tracker: a comment is added to the item's history (as text, not HTML)");
await b.shot(`${out}/tracker-item.png`);
await b.evalJS("document.querySelector('dialog[open] [data-close]').click()");
await sleep(200);
check(await b.evalJS(`!location.hash.match(/tracker\\/\\d/) && [...document.querySelectorAll('#rows tr[data-id]')][0].children[3].textContent.startsWith(${js(toStatus === "blocked" ? "Blocked" : "In progress")}) && [...document.querySelectorAll('#rows tr[data-id]')][0].children[8].textContent !== '0'`), "tracker: closing the item updates its row (status, comments) and the address");

// the import: a workbook built in the page from made-up rows (SheetJS from cdnjs, checked against its SRI hash)
await b.evalJS("(()=>{const q=document.getElementById('q'); q.value=''; q.dispatchEvent(new Event('input'));})()");
const before01 = await b.evalJS("(()=>{const q=document.getElementById('q'); q.value='SAMPLE-RF-001'; q.dispatchEvent(new Event('input')); const tr=document.querySelector('#rows tr[data-id]'); return [tr.children[5].textContent, tr.children[6].textContent, tr.children[3].textContent].join('|');})()");
await b.evalJS("document.getElementById('import').click()");
await sleep(200);
const dropFile = (make) => b.evalJS(`(async()=>{ const [name, bytes] = await (${make})(); const dt = new DataTransfer(); dt.items.add(new File([bytes], name)); const i = document.querySelector('dialog[open] #file'); i.files = dt.files; i.dispatchEvent(new Event('change')); })()`);
await dropFile(`async () => ["not-a-sheet.xlsx", new Uint8Array([1, 2, 3, 4])]`);
const xlsxOk = await b.waitFor("!!window.XLSX?.read && !document.querySelector('dialog[open] #preview .loading')", 30000);
check(xlsxOk && (await b.evalJS("!document.querySelector('dialog[open] #imErr').classList.contains('hide') && document.querySelector('dialog[open] [data-go]').disabled")), `import: SheetJS loads when asked (${await b.evalJS("document.querySelector('script[src*=xlsx]')?.integrity ? 'with SRI' : 'no SRI'")}); a file that isn't the tracker is refused (“${await b.evalJS("document.querySelector('dialog[open] #imErr').textContent")}”)`);
if (xlsxOk) {
  await dropFile(`async () => {
    const X = window.XLSX, wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["Made-up test sheet"], ["Every row here is invented"], ["Dashboard only"]]), "Dashboard");
    const ws = X.utils.aoa_to_sheet([
      ["Test tracker, refrigerators"], [],
      ["#", "Item Code", "Item / Model", "Brand", "Created On", "3D Status", "Colour Built", "Our Product ID", "3D Link", "On the earlier vendor list", "Notes"],
      [1, "TEST-IMPORT-001", "Test fridge one", "Test Brand", new Date(Date.UTC(2026, 9, 1)), "Not started", null, null, "Open 3D", "Yes", "made up"],
      [2, "TEST-IMPORT-002", "Test fridge two", "Test Brand", null, "In progress", null, null, null, "", null],
      [3, "SAMPLE-RF-001", "Changed model text", "Sample Brand A", null, "Blocked", null, null, null, "", "changed by the test import"],
      [4, "TEST-IMPORT-003", "Bad status", "Test Brand", null, "Maybe", null, null, null, "", null],
      [5, "TEST-IMPORT-001", "Again", "Test Brand", null, "Not started", null, null, null, "", null],
    ]);
    ws["I4"].l = { Target: "https://example.com/test-3d" };
    X.utils.book_append_sheet(wb, ws, "Refrigerators");
    return ["test-tracker.xlsx", X.write(wb, { type: "array", bookType: "xlsx" })];
  }`);
  await b.waitFor("!!document.querySelector('dialog[open] .tr-preview') || !document.querySelector('dialog[open] #imErr').classList.contains('hide')", 15000);
  const pv = JSON.parse(await b.evalJS(`JSON.stringify({ stats: [...document.querySelectorAll('dialog[open] .tr-preview .stat')].map(s => s.querySelector('.v').textContent), text: document.querySelector('dialog[open] #preview').textContent, err: document.querySelector('dialog[open] #imErr:not(.hide)')?.textContent || '', go: document.querySelector('dialog[open] [data-go]').textContent })`));
  check(pv.stats.join(",") === "2,1,0,2" && /Read 3 items from Refrigerators \(3\)/.test(pv.text) && /Unknown status “Maybe”/.test(pv.text) && /earlier row/.test(pv.text), `import: the preview shows new ${pv.stats[0]}, changed ${pv.stats[1]}, unchanged ${pv.stats[2]}, skipped ${pv.stats[3]} ${pv.err}`);
  await b.shot(`${out}/tracker-import.png`);
  await b.evalJS("document.querySelector('dialog[open] [data-go]').click()");
  await b.waitFor("!document.querySelector('dialog[open]')", 8000);
  await sleep(300);
  const after = JSON.parse(await b.evalJS(`JSON.stringify({ count: document.getElementById('count').textContent, last: document.getElementById('last').textContent, toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') })`));
  check(/Imported: 2 new, 1 changed/.test(after.toast) && /test-tracker\.xlsx.*2 new, 1 changed/.test(after.last), `import: done (“${after.toast}”), the last import line updated`);
  const after01 = await b.evalJS("(()=>{const q=document.getElementById('q'); q.value='SAMPLE-RF-001'; q.dispatchEvent(new Event('input')); const tr=document.querySelector('#rows tr[data-id]'); return [tr.children[5].textContent, tr.children[6].textContent, tr.children[3].textContent].join('|');})()");
  check(after01.split("|").slice(0, 2).join("|") === before01.split("|").slice(0, 2).join("|") && /^Blocked/.test(after01.split("|")[2]), `import: the sheet's status is taken (${before01.split("|")[2]} → ${after01.split("|")[2]}), the owner and due date are kept (${after01.split("|").slice(0, 2).join(", ")})`);
  await b.evalJS("document.querySelector('#rows tr[data-id]').click()");
  await b.waitFor("/imported a change/.test(document.querySelector('dialog[open] .timeline')?.textContent || '')", 5000);
  check(true, "import: the change is in the item's history (“imported a change”)");
  await b.evalJS("document.querySelector('dialog[open] [data-close]').click()");
  await b.evalJS("(()=>{const q=document.getElementById('q'); q.value='TEST-IMPORT-001'; q.dispatchEvent(new Event('input'));})()");
  await b.evalJS("document.querySelector('#rows tr[data-id]').click()");
  await b.waitFor("document.querySelector('dialog[open] .modal-head h2')?.textContent === 'TEST-IMPORT-001'", 5000);
  check(await b.evalJS("!!document.querySelector('dialog[open] a[href=\"https://example.com/test-3d\"]') && /On the earlier vendor list\\s*Yes/.test(document.querySelector('dialog[open] .facts').innerText)"), "import: a new item keeps the cell's 3D link and the earlier vendor list flag");
  await b.evalJS("document.querySelector('dialog[open] [data-close]').click()");
}
await b.evalJS("(()=>{const q=document.getElementById('q'); q.value=''; q.dispatchEvent(new Event('input'));})()");

// the bell
const bellN = () => b.evalJS("document.getElementById('bellN').classList.contains('hide') ? 0 : parseInt(document.getElementById('bellN').textContent, 10)");
const n0 = await bellN();
check(n0 >= 3, `bell: ${n0} unread`);
await b.evalJS("document.getElementById('bellBtn').click()");
await sleep(300);
const bp = JSON.parse(await b.evalJS(`JSON.stringify({ open: !document.getElementById('bellPanel').classList.contains('hide'), items: document.querySelectorAll('#bellList a[data-nid]').length, unread: document.querySelectorAll('#bellList .nt.unread').length, exp: document.getElementById('bellBtn').getAttribute('aria-expanded') })`));
check(bp.open && bp.items >= n0 && bp.unread === n0 && bp.exp === "true", `bell: the panel opens with ${bp.items} notifications, ${bp.unread} unread`);
await b.shot(`${out}/bell.png`);
const target = await b.evalJS("[...document.querySelectorAll('#bellList .nt.unread a[data-nid]')].find(a => /^#\\/tracker\\/\\d+$/.test(a.getAttribute('href')))?.getAttribute('href') || ''");
// (a dispatched click: this tab's link .click() is caught for the CSV checks)
await b.evalJS(`[...document.querySelectorAll('#bellList a[data-nid]')].find(a => a.getAttribute('href') === ${js(target)}).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))`);
const opened = await b.waitFor(`/^tracker\\/\\d+$/.test(window.__admin?.page) && !!document.querySelector('dialog[open] .facts')`, 10000);
const n1 = await bellN();
check(!!target && opened && (await b.evalJS("document.getElementById('bellPanel').classList.contains('hide')")) && n1 === n0 - 1, `bell: a notification opens its item (${target}, ${await b.evalJS("window.__admin.page")}) and is marked read (${n0} → ${n1} unread)`);
await b.evalJS("document.querySelector('dialog[open] [data-close]').click()");
await b.evalJS("document.getElementById('bellBtn').click()");
await sleep(200);
await b.evalJS("document.getElementById('bellAll').click()");
await sleep(400);
check((await bellN()) === 0 && (await b.evalJS("document.querySelectorAll('#bellList .nt.unread').length === 0")), "bell: Mark all read clears the count");
await b.evalJS("document.addEventListener('keydown', ()=>{}); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
await sleep(150);
check(await b.evalJS("document.getElementById('bellPanel').classList.contains('hide')"), "bell: Escape closes the panel");
// a comment on an item someone else owns: in the demo, its owner answers a few seconds later
await b.evalJS("(()=>{const s=document.getElementById('fwho'); s.value='demo-3'; s.dispatchEvent(new Event('change'));})()");
await sleep(150);
await b.evalJS("document.querySelector('#rows tr[data-id]').click()");
await b.waitFor("document.querySelector('dialog[open] #tcForm')", 5000);
await b.evalJS(`(()=>{const f=document.querySelector('dialog[open] #tcForm'); f.body.value='Test question for the owner'; f.querySelector('[type=submit]').click();})()`);
await b.waitFor("/Test question for the owner/.test(document.querySelector('dialog[open] .timeline')?.textContent || '')", 5000);
await b.evalJS("document.querySelector('dialog[open] [data-close]').click()");
const got = await b.waitFor("!document.getElementById('bellN').classList.contains('hide') && document.getElementById('bellN').textContent === '1'", 12000);
check(got && (await b.evalJS("[...document.querySelectorAll('.toast')].some(t => /New comment/.test(t.textContent))")), "bell: a new notification arrives by itself (the owner's reply), with a toast");

// the Notifications page: the list, unread only, the settings
await open("notifications");
await sleep(300);
const np = JSON.parse(await b.evalJS(`JSON.stringify({ n: document.querySelectorAll('#list a[data-nid]').length, kinds: document.querySelectorAll('#want input[type=checkbox]').length, email: /Email: not yet/.test(document.getElementById('page').textContent) })`));
check(np.n >= n0 + 1 && np.kinds === 8 && np.email, `notifications: ${np.n} in the history, ${np.kinds} kinds to choose, the email note`);
await b.evalJS("document.querySelector('[data-only=unread]').click()");
await sleep(300);
check(await b.evalJS("document.querySelectorAll('#list a[data-nid]').length === 1"), "notifications: Unread shows only the new one");
await b.evalJS("(()=>{const f=document.getElementById('want'); f.comment.checked=false; f.querySelector('[type=submit]').click();})()");
await b.waitFor("[...document.querySelectorAll('.toast')].some(t => t.textContent === 'Saved.')", 5000);
await open("tracker");
await open("notifications");
check(await b.evalJS("!document.getElementById('want').comment.checked && document.getElementById('want').live.checked"), "notifications: a kind can be turned off, and it stays off");
await b.evalJS("(()=>{const f=document.getElementById('want'); f.comment.checked=true; f.querySelector('[type=submit]').click();})()");
await sleep(300);

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

// a viewer on the tracker: reads and comments, changes nothing
await b.go(`${base}/admin?demo=1&as=viewer#/tracker`);
await b.waitFor("window.__admin?.page === 'tracker' && !document.querySelector('#page .loading')", 15000);
await sleep(300);
check(await b.evalJS("!document.getElementById('import') && !document.getElementById('synced') && document.querySelectorAll('#rows tr[data-id]').length > 0"), "viewer: the tracker is read-only (no import, nothing marked live)");
await b.evalJS("document.querySelector('#rows tr[data-id]').click()");
await b.waitFor("!!document.querySelector('dialog[open] #tcForm')", 5000);
check(await b.evalJS("!document.querySelector('dialog[open] #tmForm') && !!document.querySelector('dialog[open] #tcForm')"), "viewer: an item can be commented on but not changed");
await b.evalJS("document.querySelector('dialog[open] [data-close]').click()");
await b.evalJS("location.hash = '#/notifications'");
await b.waitFor("window.__admin?.page === 'notifications' && !document.querySelector('#page .loading')", 10000);
check(await b.evalJS("document.getElementById('want').feedback.disabled && !document.getElementById('want').comment.disabled"), "viewer: the admins-only notifications can't be chosen");

// ── 2. real mode: the sign-in screen, no sample data ──
console.log("\n[real mode]");
for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
  await b.viewport(w, h, mobile, mobile ? IPHONE : DESKTOP);
  await b.go(`${base}/admin`);
  const ok = await b.waitFor("!!document.getElementById('login')", 20000);
  check(ok && (await b.evalJS("!document.querySelector('.banner.demo') && !/Sample|Demo data/.test(document.body.innerText) && !document.getElementById('bellBtn')")), `${w} px: /admin shows the sign-in form, no sample data and no bell`);
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
