// Tests the admin's store tools and the pages they drive, in headless Chrome:
// 1. the Requests, Playlists, Profile, Devices ("Show on a device"), Products, Categories and Roles pages in demo
//    mode (/admin?demo=1) at desktop and phone width: they render, nothing scrolls sideways, no console errors;
// 2. the flows on the sample data: ask for a product (Product ID or link, duplicates), comment, change its status,
//    CSV; make, reorder, recolour and delete a playlist; send a product and a playlist to a device and see it
//    picked up; change your name; the product filters and details; the manager and viewer roles; the keyboard;
// 3. /kiosk with a list in the address: one frame at a time, the QR code, a touch pauses it and it carries on,
//    the doors and features modes, the empty screen, and a rough check that memory doesn't climb;
// 4. /kiosk?list=<id> and /device.js against a stubbed Supabase (fetch is replaced, and the browser can't resolve
//    Supabase's address anyway, so nothing leaves the machine): an unpaired browser asks nothing at all; a paired
//    one polls, opens a product (with "Tap to view in your room"), a playlist and the catalogue, each once.
// usage: node test_tools.mjs <base url> <out dir>      (PORT: the browser's debugging port; 9622 if unset)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const js = (o) => JSON.stringify(o);
const products = (await (await fetch(`${base}/products.json`)).json()).products;
const shown = products.filter((p) => !p.hidden);
const slug = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// A: a fridge on show with colours, doors and features; B, C: two more on show; H: a hidden one
const A = shown.find((p) => p.finishes.length > 1 && (p.parts || []).length && (p.hotspots || []).length) || shown[0];
const [B, C] = shown.filter((p) => p !== A);
const H = products.find((p) => p.hidden);
const idOf = (url) => String(url || "").match(/\/(\d+)\/?$/)?.[1] || null;
const inCatalogue = new Set(products.flatMap((p) => [p.sangeethaUrl, ...p.finishes.map((f) => f.sangeethaUrl)]).map(idOf).filter(Boolean));

const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9622), flags: ["--host-resolver-rules=MAP *.supabase.co 127.0.0.1"] });
const errors = (from = 0) => b.logs.slice(from).filter((l) => /EXCEPTION|LOG |\[error\]/.test(l) && !/ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED/.test(l));
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const noSideScroll = () => b.evalJS("document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1");
const dialogFits = () => b.evalJS("(() => { const d = document.querySelector('dialog[open]'); return !d || (d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= innerWidth + 1); })()");
async function open(page, query = "?demo=1", sub = "") {
  const url = `${base}/admin${query}#/${page}${sub}`;
  if (await b.evalJS(`!!window.__admin && location.search === ${js(query)}`)) await b.evalJS(`location.hash = ${js(`#/${page}${sub}`)}`);
  else await b.go(url);
  return b.waitFor(`window.__admin?.page === ${js(page)} && !document.querySelector('#page .loading')`, 20000);
}
const key = async (k, code, vk, text) => {
  await b.send("Input.dispatchKeyEvent", { type: text ? "keyDown" : "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk, text });
  await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
};
// Tab from the top of the page until the focus is on what the selector names
async function tabTo(sel, max = 160) {
  await b.evalJS("document.activeElement?.blur(); window.scrollTo(0, 0)");
  for (let i = 0; i < max; i++) { await key("Tab", "Tab", 9); if (await b.evalJS(`!!document.activeElement?.matches(${js(sel)})`)) return true; }
  return false;
}
const closeDialogs = () => b.evalJS("document.querySelectorAll('dialog[open]').forEach(d => d.close())");

// ── 1. every new page, desktop then phone ──
const PAGES = ["requests", "playlists", "profile", "devices", "products", "categories", "roles"];
for (const [w, h, mobile, label] of [[1440, 900, false, "desktop"], [390, 844, true, "phone"]]) {
  console.log(`\n[demo mode, ${label} ${w}×${h}]`);
  await b.viewport(w, h, mobile, mobile ? IPHONE : DESKTOP);
  await b.go(`${base}/admin?demo=1#/dashboard`);
  await b.waitFor("window.__admin?.page === 'dashboard'", 20000);
  for (const page of PAGES) {
    const ready = await open(page);
    await sleep(page === "devices" ? 900 : 400);
    const r = JSON.parse(await b.evalJS(`JSON.stringify({
      banner: !!document.querySelector('.banner.demo'), err: !!document.querySelector('#page .banner.bad, #page .msg.bad:not(.hide)'),
      text: document.getElementById('page').innerText.length, h1: document.querySelector('#page h1')?.textContent,
      nav: !!document.querySelector('.nav a[data-page=${page}]') || ${js(page)} === 'profile' })`));
    check(ready && r.banner && !r.err && r.text > 120 && r.nav, `${page}: renders (${r.h1})`);
    check(await noSideScroll(), `${page}: no sideways scroll at ${w} px`);
    await b.shot(`${out}/${label}-${page}.png`);
  }
  // the dialogs fit the screen too
  await open("requests");
  await b.evalJS("document.querySelector('#rows [data-open]').click()");
  await b.waitFor("!!document.querySelector('dialog[open] .timeline')", 5000);
  check(await dialogFits(), `a request's details fit at ${w} px`);
  await b.shot(`${out}/${label}-request.png`);
  await closeDialogs();
  await open("playlists");
  await b.evalJS("document.querySelector('[data-edit]').click()");
  await b.waitFor("!!document.querySelector('dialog[open] #plItems li[data-i]')", 5000);
  check(await dialogFits(), `the playlist editor fits at ${w} px`);
  await b.shot(`${out}/${label}-playlist-editor.png`);
  await closeDialogs();
  await open("products");
  await b.evalJS("document.querySelector('#rows [data-detail]').click()");
  await b.waitFor("!!document.querySelector('dialog[open] [data-size]')", 5000);
  check(await dialogFits(), `a product's details fit at ${w} px`);
  await b.shot(`${out}/${label}-product-detail.png`);
  await closeDialogs();
}

// ── 2. the flows (desktop, admin) ──
console.log("\n[requests]");
await b.viewport(1440, 900, false, DESKTOP);
await b.go(`${base}/admin?demo=1#/requests`);
await open("requests");
await b.evalJS("sessionStorage.removeItem('s3d-req-status')");
const openOnly = await b.evalJS("[...document.querySelectorAll('#rows tr[data-id]')].every(tr => /Requested|Accepted|Building|In review/.test(tr.children[4].textContent))");
const nOpen = await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length");
check(openOnly && nOpen >= 3 && (await b.evalJS("document.querySelectorAll('#stats .stat').length")) === 6, `the list starts on the ${nOpen} open requests, with 6 counts above`);
await b.evalJS("document.querySelector('[data-st=all]').click()");
const nAll = await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length");
check(nAll > nOpen && (await b.evalJS("[...document.querySelectorAll('#rows tr')].some(tr => /Not possible/.test(tr.textContent)) && [...document.querySelectorAll('#rows tr')].some(tr => /Live/.test(tr.textContent))")), `All shows ${nAll}, live and not possible among them`);
// the sample requests use the catalogue's real Product IDs
const sampleIds = JSON.parse(await b.evalJS("JSON.stringify([...document.querySelectorAll('#rows tr[data-id]')].map(tr => tr.querySelector('.cell-main span').textContent.match(/ID (\\d+)/)?.[1]))"));
check(sampleIds.length && sampleIds.every((x) => inCatalogue.has(x)), `the sample requests carry real Product IDs from products.json (${sampleIds.slice(0, 3).join(", ")}…)`);
const openId = await b.evalJS("[...document.querySelectorAll('#rows tr[data-id]')].find(tr => /Requested|Building/.test(tr.children[4].textContent)).querySelector('.cell-main span').textContent.match(/ID (\\d+)/)[1]");
const freeCat = [...inCatalogue].find((x) => !sampleIds.includes(x));

await b.evalJS("document.getElementById('add').click()");
await b.waitFor("!!document.querySelector('#nrForm')", 5000);
const typeId = async (v) => { await b.evalJS(`(()=>{const i=document.querySelector('#nrForm [name=product]'); i.value=${js(v)}; i.dispatchEvent(new Event('input'));})()`); await sleep(80); return b.evalJS("document.getElementById('pid').textContent"); };
let pid = await typeId("https://www.sangeetha.com/refrigerators/voltas-test/987654");
check(/Product ID 987654\. Not requested yet/.test(pid), `a pasted link gives its Product ID (“${pid.trim()}”)`);
pid = await typeId("abc");
check(/number|Product ID/i.test(pid) && (await b.evalJS("!!document.querySelector('#pid .msg.bad')")), `a wrong ID says so (“${pid.trim()}”)`);
pid = await typeId(openId);
check(/Already requested/.test(pid) && (await b.evalJS("document.querySelector('dialog[open] [data-submit]').disabled")), `an ID already asked for is flagged and can't be sent (“${pid.trim().slice(0, 60)}…”)`);
if (freeCat) {
  pid = await typeId(freeCat);
  check(/Already in the catalogue/.test(pid) && (await b.evalJS("!document.getElementById('anyway').classList.contains('hide') && !!document.querySelector('#nrForm [name=brand]').value")), `an ID in products.json is flagged, the brand filled in, and “Ask for it anyway” offered`);
  await b.evalJS("document.querySelector('dialog[open] [data-submit]').click()");
  await sleep(100);
  check(/Ask for it anyway/.test(await b.evalJS("document.getElementById('nrErr').textContent")), "it isn't sent until “Ask for it anyway” is ticked");
}
await typeId("987654");
await b.evalJS(`(()=>{const f=document.getElementById('nrForm'); f.brand.value='Voltas'; f.model.value='183V CZTT'; f.colours.value='Steel Grey'; f.priority.value='high'; f.notes.value='Asked for by three customers this week.'; document.querySelector('dialog[open] [data-submit]').click();})()`);
await b.waitFor("!document.querySelector('dialog[open]') && [...document.querySelectorAll('#rows tr')].some(tr => tr.textContent.includes('987654'))", 5000);
const newRow = JSON.parse(await b.evalJS("JSON.stringify((() => { const tr = [...document.querySelectorAll('#rows tr[data-id]')].find(tr => tr.textContent.includes('987654')); return tr && { id: +tr.dataset.id, text: tr.textContent }; })())"));
check(newRow && /Voltas 183V CZTT/.test(newRow.text) && /High/.test(newRow.text) && /Requested/.test(newRow.text), `a new request is listed: #${newRow?.id}, Voltas 183V CZTT, high, requested`);
await b.evalJS("document.getElementById('add').click()");
await b.waitFor("!!document.querySelector('#nrForm')", 5000);
pid = await typeId("987654");
check(/Already requested: #/.test(pid), "asking again for the same ID is stopped: it points to the open request");
await closeDialogs();
// search and Only mine
await b.evalJS("(()=>{const q=document.getElementById('q'); q.value='987654'; q.dispatchEvent(new Event('input'));})()");
check((await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length")) === 1, "search finds it by Product ID");
await b.evalJS("(()=>{const q=document.getElementById('q'); q.value=''; q.dispatchEvent(new Event('input'));})()");
await b.evalJS("document.getElementById('mine').click()");
check(await b.evalJS("[...document.querySelectorAll('#rows tr[data-id]')].length >= 1 && [...document.querySelectorAll('#rows tr[data-id]')].every(tr => tr.children[5].textContent.includes(window.__admin.profile.full_name || window.__admin.profile.email.split('@')[0]))"), "Only mine shows only your requests");
await b.evalJS("document.getElementById('mine').click()");
// comment, then status
await b.evalJS(`document.querySelector('#rows tr[data-id="${newRow.id}"] [data-open]').click()`);
await b.waitFor("!!document.querySelector('dialog[open] #cmForm')", 5000);
await b.evalJS("(()=>{const f=document.getElementById('cmForm'); f.body.value='Please add the white one too.'; f.requestSubmit();})()");
await b.waitFor("[...document.querySelectorAll('dialog[open] .timeline li')].some(li => li.textContent.includes('Please add the white one too.'))", 5000);
check(true, "a comment is added to the request's history");
await b.evalJS("(()=>{const f=document.getElementById('stForm'); f.status.value='declined'; f.status.dispatchEvent(new Event('change')); f.reason.value=''; f.requestSubmit();})()");
await sleep(100);
check(/Say why/.test(await b.evalJS("document.getElementById('stErr').textContent")), "“Not possible” needs a reason");
await b.evalJS("(()=>{const f=document.getElementById('stForm'); f.status.value='accepted'; f.status.dispatchEvent(new Event('change')); f.requestSubmit();})()");
await b.waitFor("[...document.querySelectorAll('dialog[open] .timeline li.st')].some(li => li.textContent.includes('Accepted'))", 5000);
check(await b.evalJS(`/Accepted/.test(document.querySelector('#rows tr[data-id="${newRow.id}"]').textContent)`), "an admin accepts it: the history and the list say Accepted");
await closeDialogs();
// CSV: catch the download link instead of saving a file
await b.evalJS(`window.__csv = []; const realClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__csv.push({ name: this.download, href: this.href }); else realClick.call(this); };`);
await b.evalJS("document.querySelector('[data-st=all]').click(); document.getElementById('csv').click()");
await sleep(200);
const csv = await b.evalJS("(async()=>{const c=window.__csv.at(-1); return c ? c.name + '\\n' + await (await fetch(c.href)).text() : ''})()");
check(/^product-requests-\d{4}-\d{2}-\d{2}\.csv\n/.test(csv) && /Sangeetha Product ID/.test(csv) && /987654/.test(csv) && csv.trim().split("\n").length === nAll + 3, `CSV export: ${csv.split("\n")[0]}, ${csv.trim().split("\n").length - 2} requests`);

console.log("\n[playlists]");
await open("playlists");
const nLists = await b.evalJS("document.querySelectorAll('.pl-card').length");
check(nLists === 3 && (await b.evalJS("[...document.querySelectorAll('.pl-card a.primary')].every(a => a.href.startsWith(location.origin + '/kiosk?items='))")), `${nLists} sample playlists, each with a Play link to /kiosk`);
await b.evalJS("document.getElementById('add').click()");
await b.waitFor("!!document.getElementById('plForm')", 5000);
const addItem = (id) => b.evalJS(`(()=>{const s=document.getElementById('plPick'); s.value=${js(id)}; document.getElementById('plAdd').click();})()`);
for (const p of [A, B, C]) await addItem(p.id);
const items = () => b.evalJS("[...document.querySelectorAll('#plItems li[data-i] .pl-name b')].map(b => b.textContent).join(' | ')");
check((await b.evalJS("document.querySelectorAll('#plItems li[data-i]').length")) === 3, `three products added: ${await items()}`);
await b.evalJS(`document.querySelector('#plItems li[data-i="2"] [data-mv="-1"]').click()`);
check((await b.evalJS("document.querySelector('#plItems li[data-i=\"1\"] .pl-name b').textContent")) === `${C.brand} ${C.shortName}`, "the third one moves up");
await b.evalJS(`document.querySelector('#plItems li[data-i="0"] [data-rm]').click()`);
const fin = slug(A.finishes[1].name);
check((await b.evalJS("document.querySelectorAll('#plItems li[data-i]').length")) === 2, "the first one is removed");
await addItem(A.id);
await b.evalJS(`(()=>{const s=document.querySelector('#plItems li[data-i="2"] [data-colour]'); s.value=${js(fin)}; s.dispatchEvent(new Event('change', { bubbles: true }));})()`);
await b.evalJS("(()=>{const f=document.getElementById('plForm'); f.name.value='Front window fridges'; f.seconds.value='12'; f.querySelector('[name=show][value=doors]').checked=true; f.querySelector('[name=show][value=doors]').dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('dialog[open] [data-submit]').click();})()");
await sleep(200);
check(/already a playlist called/.test(await b.evalJS("document.getElementById('plErr').textContent")), "a second playlist with the same name is refused");
await b.evalJS("(()=>{const f=document.getElementById('plForm'); f.name.value='Test window'; document.querySelector('dialog[open] [data-submit]').click();})()");
await b.waitFor("!document.querySelector('dialog[open]') && [...document.querySelectorAll('.pl-card h3')].some(h => h.textContent === 'Test window')", 5000);
const card = JSON.parse(await b.evalJS("JSON.stringify((() => { const c = [...document.querySelectorAll('.pl-card')].find(c => c.querySelector('h3').textContent === 'Test window'); return { text: c.textContent, href: c.querySelector('a.primary').href }; })())"));
const playUrl = new URL(card.href);
check(/3 products · 12 s each/.test(card.text) && /Open the doors/.test(card.text), `the new playlist: ${card.text.match(/\d+ products · \d+ s each/)?.[0]}, Open the doors`);
check(playUrl.searchParams.get("items") === `${C.id},${B.id},${A.id}~${fin}` && playUrl.searchParams.get("show") === "doors" && playUrl.searchParams.get("seconds") === "12", `its Play link carries the order and the colour (${playUrl.searchParams.get("items")})`);
await b.evalJS("[...document.querySelectorAll('.pl-card')].find(c => c.querySelector('h3').textContent === 'Test window').querySelector('[data-link]').click()");
await b.waitFor("!!document.querySelector('dialog[open] .qr svg')", 5000);
check(await b.evalJS("document.querySelector('dialog[open] .linkbox code').textContent.includes('/kiosk?')"), "Link shows the showcase link and its QR code");
await closeDialogs();
await b.evalJS("[...document.querySelectorAll('.pl-card')].find(c => c.querySelector('h3').textContent === 'Test window').querySelector('[data-del]').click()");
await sleep(200);
await b.evalJS("document.querySelector('dialog[open] [data-ok]').click()");
await b.waitFor(`document.querySelectorAll('.pl-card').length === ${nLists}`, 5000);
check(await b.evalJS(`document.querySelectorAll('.pl-card').length === ${nLists}`), "the playlist is deleted");

console.log("\n[show on a device]");
await open("devices");
await b.waitFor("!!document.querySelector('#screens tr[data-dev]')", 8000);
const nPaired = await b.evalJS("document.querySelectorAll('#screens tr[data-dev]').length");
check(nPaired >= 2 && (await b.evalJS("[...document.querySelectorAll('#screens tr[data-dev]')].some(tr => /Opened/.test(tr.textContent)) && [...document.querySelectorAll('#screens tr[data-dev]')].some(tr => /Playlist:/.test(tr.textContent))")), `${nPaired} paired devices, with what each shows and was last sent`);
const dev = await b.evalJS("document.querySelector('#screens tr[data-dev]').dataset.dev");
await b.evalJS(`document.querySelector('#screens tr[data-dev="${dev}"] [data-show=product]').click()`);
await b.waitFor("!!document.getElementById('spForm')", 5000);
await b.evalJS(`(()=>{const f=document.getElementById('spForm'); f.product.value=${js(A.id)}; f.product.dispatchEvent(new Event('change')); f.finish.value=${js(fin)}; document.querySelector('dialog[open] [data-submit]').click();})()`);
await b.waitFor(`!document.querySelector('dialog[open]') && /Waiting for the device/.test(document.querySelector('#screens tr[data-dev="${dev}"]')?.textContent)`, 5000);
check(await b.evalJS(`document.querySelector('#screens tr[data-dev="${dev}"]').textContent.includes(${js(A.finishes[1].name)})`), `a product in a colour is sent: “Waiting for the device” (${A.brand} ${A.shortName}, ${A.finishes[1].name})`);
await sleep(5200);
await b.evalJS("document.getElementById('scrRefresh').click()");
await b.waitFor(`/Opened/.test(document.querySelector('#screens tr[data-dev="${dev}"]')?.textContent)`, 5000);
check(await b.evalJS(`(() => { const tr = document.querySelector('#screens tr[data-dev="${dev}"]'); return /Opened/.test(tr.textContent) && tr.children[2].textContent.includes(${js(`${A.brand} ${A.shortName}`)}) && /Just now/.test(tr.children[1].textContent); })()`), "the device picks it up: Opened, showing it now, seen just now");
await b.evalJS(`document.querySelector('#screens tr[data-dev="${dev}"] [data-show=playlist]').click()`);
await b.waitFor("!!document.querySelector('dialog[open] [name=pl]')", 5000);
const plName = await b.evalJS("document.querySelector('dialog[open] [name=pl]:checked').closest('label').querySelector('b').textContent");
await b.evalJS("document.querySelector('dialog[open] [data-submit]').click()");
await b.waitFor(`!document.querySelector('dialog[open]') && document.querySelector('#screens tr[data-dev="${dev}"]').textContent.includes(${js(`Playlist: ${plName}`)})`, 5000);
check(true, `a playlist is sent (${plName})`);
await b.evalJS(`document.querySelector('#screens tr[data-dev="${dev}"] [data-show=home]').click()`);
await b.waitFor(`/The catalogue/.test(document.querySelector('#screens tr[data-dev="${dev}"]').children[3].textContent)`, 5000);
check(true, "“Back to the catalogue” is sent");
await open("audit");
await sleep(400);
const audit = await b.evalJS("document.getElementById('page').innerText");
check(["Product requested", "Request status changed", "Request comment", "Playlist created", "Playlist deleted", "Sent to a device"].every((t) => audit.includes(t)), "the audit log names each of these in plain words");

console.log("\n[profile]");
await b.evalJS("document.getElementById('userBtn').click()");
await sleep(150);
await b.evalJS("document.querySelector('#userMenu a[href=\"#/profile\"]').click()");
await b.waitFor("window.__admin?.page === 'profile'", 5000);
check(await b.evalJS("document.getElementById('userMenu').classList.contains('hide')"), "the account menu's “Your profile” opens the page and closes the menu");
const prof = JSON.parse(await b.evalJS(`JSON.stringify({ text: document.getElementById('page').innerText, can: document.querySelectorAll('.can-list li').length, email: window.__admin.profile.email })`));
check(prof.text.includes(prof.email) && /Admin/.test(prof.text) && /Store/.test(prof.text) && prof.can >= 10, `name, email, role and store, and what an admin can do (${prof.can} lines)`);
await b.evalJS("(()=>{const f=document.getElementById('nameForm'); f.name.value='Asha Demo'; f.requestSubmit();})()");
await b.waitFor("document.querySelector('.side-foot .who b')?.textContent === 'Asha Demo'", 5000);
check(await b.evalJS("document.getElementById('meName').textContent === 'Asha Demo'"), "changing your name shows at once, here and in the sidebar");
await b.evalJS("document.getElementById('mePw').click()");
await b.waitFor("!!document.getElementById('p1')", 5000);
check(true, "Change password opens the password form");
await b.evalJS("document.getElementById('out').click()");   // its Cancel
await b.waitFor("!!window.__admin?.page", 8000);

console.log("\n[products, categories, roles]");
await open("products");
const total = await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length");
await b.evalJS(`(()=>{const s=document.getElementById('fbrand'); s.value=${js(A.brand)}; s.dispatchEvent(new Event('change'));})()`);
const byBrand = products.filter((p) => p.brand === A.brand).length;
check((await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length")) === byBrand && (await b.evalJS(`location.hash === ${js(`#/products?brand=${encodeURIComponent(A.brand).replace(/%20/g, "+")}`)}`)), `brand filter: ${byBrand} ${A.brand}, kept in the address`);
await b.evalJS("(()=>{const s=document.getElementById('fcol'); s.value='4'; s.dispatchEvent(new Event('change'));})()");
const four = products.filter((p) => p.brand === A.brand && p.finishes.length >= 4).length;
check((await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length")) === four || (four === 0 && (await b.evalJS("!document.querySelector('#rows tr[data-id]')"))), `and 4 or more colours: ${four}`);
await b.evalJS("(()=>{for (const id of ['fbrand','fcol']) { const s=document.getElementById(id); s.value=''; s.dispatchEvent(new Event('change')); } const q=document.getElementById('q'); q.value=" + js(A.model) + "; q.dispatchEvent(new Event('input'));})()");
check((await b.evalJS("document.querySelectorAll('#rows tr[data-id]').length")) >= 1 && (await b.evalJS(`!!document.querySelector('#rows tr[data-id="${A.id}"]')`)), `search by model ${A.model}`);
await b.evalJS(`document.querySelector('#rows tr[data-id="${A.id}"] [data-detail]').click()`);
await b.waitFor("[...document.querySelectorAll('dialog[open] [data-size]')].every(c => c.textContent !== '…')", 15000);
const det = JSON.parse(await b.evalJS("JSON.stringify({ text: document.querySelector('dialog[open]').innerText, rows: document.querySelectorAll('dialog[open] tbody tr').length })"));
const aIds = [...new Set([A.sangeethaUrl, ...A.finishes.map((f) => f.sangeethaUrl)].map(idOf).filter(Boolean))];
// a file's size comes from its HEAD request: "—" here, where the test server sends no Content-Length
check(/Size/.test(det.text) && /Specifications/.test(det.text) && A.finishes.every((f) => det.text.includes(f.name) && det.text.includes(f.usdz.split("/").pop())) && det.text.includes(A.glb.split("/").pop()) && aIds.every((x) => det.text.includes(x)), `details: size, specs, ${A.finishes.length} colours with their AR files and sizes, Sangeetha IDs ${aIds.join(", ") || "(none)"}`);
await closeDialogs();
await b.evalJS(`location.hash = '#/categories'`);
await b.waitFor("window.__admin?.page === 'categories' && !document.querySelector('#page .loading')", 8000);
check(/read-only|can’t be|change the site/i.test(await b.evalJS("document.getElementById('page').innerText")), "categories say why they are read-only here");
await b.evalJS(`document.querySelector('#page a[href="#/products?cat=${encodeURIComponent(A.category)}"]').click()`);
await b.waitFor("window.__admin?.page === 'products' && !document.querySelector('#page .loading')", 8000);
const browsed = JSON.parse(await b.evalJS(`(async () => JSON.stringify({ cat: document.getElementById('fcat').value, rows: document.querySelectorAll('#rows tr[data-id]').length, want: (await (await fetch('/products.json')).json()).products.filter((p) => p.category === ${js(A.category)}).length }))()`));
check(browsed.cat === A.category && browsed.rows === browsed.want, `Browse ${A.category} opens Products filtered to it (${browsed.rows} of ${browsed.want})`);
await open("roles");
check((await b.evalJS("document.querySelectorAll('table.matrix tr.group').length")) >= 4 && /Requests|Playlists|show a product/i.test(await b.evalJS("document.querySelector('table.matrix').innerText")), "the roles table has the new tools, in groups");
await b.evalJS("document.querySelector('[data-role=manager]').click()");
await b.waitFor("!!document.querySelector('dialog[open] .can-list')", 5000);
check(/approve or decline/i.test(await b.evalJS("document.querySelector('dialog[open]').innerText")), "What a manager can do: includes approving or declining products");
await closeDialogs();
void total;

console.log("\n[roles: manager and viewer]");
for (const as of ["manager", "viewer"]) {
  const q = `?demo=1&as=${as}`;
  await b.go(`${base}/admin${q}#/requests`);
  await open("requests", q);
  await b.evalJS("document.querySelector('[data-st=all]').click(); document.querySelector('#rows [data-open]').click()");
  await b.waitFor("!!document.querySelector('dialog[open] #cmForm')", 5000);
  const req = JSON.parse(await b.evalJS("JSON.stringify({ add: !!document.getElementById('add'), status: !!document.getElementById('stForm'), comment: !!document.getElementById('cmForm') })"));
  check(req.add && req.comment && req.status === (as === "manager"), `${as}: can ask for products and comment; ${as === "manager" ? "can" : "can't"} change a request's status`);
  await closeDialogs();
  await open("playlists", q);
  const pl = JSON.parse(await b.evalJS("JSON.stringify({ add: !!document.getElementById('add'), edit: !!document.querySelector('[data-edit]'), play: !!document.querySelector('.pl-card a.primary'), ro: /Read-only/.test(document.getElementById('page').textContent) })"));
  check(pl.play && pl.add === (as === "manager") && pl.edit === (as === "manager") && pl.ro === (as === "viewer"), `${as}: ${as === "manager" ? "makes and edits playlists" : "plays playlists, read-only"}`);
  await open("devices", q);
  await b.waitFor("!!document.querySelector('#screens tr[data-dev]')", 8000);
  check((await b.evalJS("!!document.querySelector('#screens [data-show]')")) === (as === "manager"), `${as}: ${as === "manager" ? "can" : "can't"} send something to a device`);
  await open("profile", q);
  check(new RegExp(as === "manager" ? "Manager" : "Viewer").test(await b.evalJS("document.getElementById('page').innerText")), `${as}: the profile shows the role`);
}

console.log("\n[keyboard]");
await b.go(`${base}/admin?demo=1#/requests`);
await open("requests");
check(await tabTo("#add"), "Tab reaches “New request”");
await key("Enter", "Enter", 13, "\r");
await b.waitFor("!!document.querySelector('dialog[open] #nrForm')", 3000);
check(await b.evalJS("document.activeElement?.name === 'product'"), "Enter opens it, with the focus in the Product ID box");
await key("Escape", "Escape", 27);
await sleep(200);
check(await b.evalJS("!document.querySelector('dialog[open]')"), "Escape closes it");
check(await tabTo("#rows [data-open]"), "Tab reaches a request's Open button");
await open("playlists");
check(await tabTo(".pl-card [data-edit]"), "Tab reaches a playlist's Edit button");
await key("Enter", "Enter", 13, "\r");
await b.waitFor("!!document.querySelector('dialog[open] #plItems')", 3000);
check(await tabTo("dialog[open] #plItems [data-mv]:not([disabled])", 40), "in the editor, Tab reaches the move buttons");
await key("Escape", "Escape", 27);
await open("devices");
await b.waitFor("!!document.querySelector('#screens [data-show]')", 8000);
check(await tabTo("#screens [data-show=product]", 200), "Tab reaches a device's “Product” button");
await open("profile");
check(await tabTo("#nameForm [name=name]"), "Tab reaches your name");
const adminErrs = errors();
check(adminErrs.length === 0, `admin: no console errors${adminErrs.length ? ":\n    " + adminErrs.slice(0, 8).join("\n    ") : ""}`);

// ── 3. /kiosk with a list in the address ──
console.log("\n[kiosk]");
await b.viewport(1280, 720, false, DESKTOP);
const kioskLogs = b.logs.length;
const kstate = async () => JSON.parse(await b.evalJS("JSON.stringify(window.__kiosk?.state() || null)"));
const watchFrames = "window.__maxFrames = 0; setInterval(() => (window.__maxFrames = Math.max(window.__maxFrames, document.querySelectorAll('#stage iframe').length)), 50)";
await b.go(`${base}/kiosk?items=${A.id}~${fin},${H ? `${H.id},` : ""}nope-not-real,${B.id},${C.id}&seconds=8&show=turn&idle=20&name=Test`);
await b.evalJS(watchFrames);
await b.waitFor(`window.__kiosk?.state().playing === ${js(A.id)} && document.getElementById('card').classList.contains('gone')`, 45000);
let k = await kstate();
const frameInfo = JSON.parse(await b.evalJS(`JSON.stringify((() => { const f = document.querySelector('#stage iframe'); const d = f.contentDocument; return { embed: d.documentElement.classList.contains('embed'), hint: getComputedStyle(d.querySelector('.hint') || d.body).display, open: d.getElementById('embedOpen') ? getComputedStyle(d.getElementById('embedOpen')).display : 'none', turning: d.getElementById('viewer').autoRotate === true }; })())`));
check(k.count === 3 && k.frames === 1, `plays the 3 products on show, skipping the hidden one and the unknown id (${k.count} of ${H ? 5 : 4})`);
check(k.src === `/p/${A.id}?embed&kiosk=1&finish=${fin}` && frameInfo.embed && frameInfo.hint === "none" && frameInfo.open === "none", `the product page in a frame, viewer only, in its colour (${k.src})`);
check(frameInfo.turning, "Turn slowly: the product turns");
check(k.qr === `https://3dmodel-chi-nine.vercel.app/p/${A.id}?finish=${fin}` || k.qr === `${base}/p/${A.id}?finish=${fin}`, `the corner QR code opens it on a phone (${k.qr})`);
check(/See it in your room/.test(await b.evalJS("document.getElementById('qr').innerText")) && (await b.evalJS(`document.getElementById('name').innerText.includes(${js(A.finishes[1].name)})`)), "the name, model and colour beside it");
check(await noSideScroll(), "kiosk: no sideways scroll at 1280 px");
await b.shot(`${out}/kiosk-desktop.png`);
await b.waitFor(`window.__kiosk.state().playing === ${js(B.id)}`, 40000);
k = await kstate();
check(k.frames === 1 && k.src.startsWith(`/p/${B.id}`) && (await b.evalJS("window.__maxFrames")) === 1, `the next product replaces the frame: never more than one (${k.src})`);
// a touch pauses it; it carries on after the idle time (20 s here)
await b.waitFor("document.getElementById('card').classList.contains('gone')", 30000);
const touchedAt = Date.now();
await b.click(760, 360);
await sleep(300);
k = await kstate();
const pausedAt = k.src;
check(k.paused && (await b.evalJS("!document.getElementById('paused').classList.contains('hide')")), "a touch on the product pauses the showcase, and says so");
await b.shot(`${out}/kiosk-paused.png`);
// sampled until 15 s after the touch (a slow screenshot on a busy machine mustn't eat into the 20 s)
let stayed = true;
do { if ((await kstate()).src !== pausedAt) stayed = false; await sleep(500); } while (Date.now() - touchedAt < 15000);
check(stayed, "while paused it stays on the same product");
await b.waitFor(`!window.__kiosk.state().paused && window.__kiosk.state().src !== ${js(pausedAt)}`, 25000);
check(!(await kstate()).paused, "after the idle time it carries on with the next product");
// memory: a few more products, with the garbage collected before each reading
const heap = async () => { await b.send("HeapProfiler.collectGarbage"); await sleep(300); return (await b.send("Runtime.getHeapUsage")).result.usedSize / 1048576; };
const h0 = await heap();
let seen = 0, last = (await kstate()).src;
for (let t = 0; t < 120 && seen < 5; t++) { await sleep(1000); const s = (await kstate()).src; if (s !== last) { seen++; last = s; } }
const h1 = await heap();
check(seen >= 5 && (await b.evalJS("window.__maxFrames")) === 1, `${seen} more products, still one frame at a time`);
check(h1 - h0 < 40, `memory stays level: ${h0.toFixed(0)} MB → ${h1.toFixed(0)} MB`);
// the doors
await b.go(`${base}/kiosk?items=${A.id}&seconds=14&show=doors`);
await b.waitFor(`window.__kiosk?.state().playing === ${js(A.id)}`, 45000);
const doors = await b.waitFor("(() => { const d = document.querySelector('#stage iframe')?.contentWindow?.__demo; return d && Object.values(d.state).some(Boolean); })()", 20000);
check(doors, "Open the doors: its doors open");
await b.shot(`${out}/kiosk-doors.png`);
check(await b.waitFor("(() => { const d = document.querySelector('#stage iframe')?.contentWindow?.__demo; return d && !Object.values(d.state).some(Boolean); })()", 25000), "and close again before the next product");
// the features
await b.go(`${base}/kiosk?items=${A.id}&seconds=12&show=features`);
await b.waitFor(`window.__kiosk?.state().playing === ${js(A.id)}`, 45000);
check(await b.waitFor("(() => { const d = document.querySelector('#stage iframe')?.contentDocument; return d && d.getElementById('fcard') && !d.getElementById('fcard').classList.contains('gone'); })()", 15000), "Show features: each feature's card comes up in turn");
await b.shot(`${out}/kiosk-features.png`);
// phone width, and nothing to play
await b.viewport(390, 844, true, IPHONE);
await b.go(`${base}/kiosk?items=${C.id}&seconds=10&show=still`);
await b.waitFor(`window.__kiosk?.state().playing === ${js(C.id)} && document.getElementById('card').classList.contains('gone')`, 45000);
check(await noSideScroll(), "kiosk: no sideways scroll at 390 px");
await b.shot(`${out}/kiosk-phone.png`);
await b.viewport(1280, 720, false, DESKTOP);
await b.go(`${base}/kiosk?items=nope-not-real${H ? `,${H.id}` : ""}`);
await b.waitFor("window.__kiosk?.state().empty", 15000);
check(/Nothing to play yet/.test(await b.evalJS("document.getElementById('empty').innerText")) && (await kstate()).frames === 0, "a list with nothing on show: a calm “Nothing to play yet” screen, no frame");
await b.shot(`${out}/kiosk-empty.png`);
const kErrs = errors(kioskLogs);
check(kErrs.length === 0, `kiosk: no console errors${kErrs.length ? ":\n    " + kErrs.slice(0, 8).join("\n    ") : ""}`);

// ── 4. /kiosk?list= and /device.js, against a stubbed Supabase ──
console.log("\n[kiosk?list= and device.js]");
const stubLogs = b.logs.length;
// every call to Supabase is answered from localStorage.__reply ({ rpc name: reply }) and recorded in localStorage.__calls
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, init = {}) => {
    const u = String(url && url.url || url);
    if (!u.includes('.supabase.co/')) return realFetch(url, init);
    const name = u.split('/rpc/')[1] || u;
    let body = null; try { body = init.body ? JSON.parse(init.body) : null; } catch {}
    try { const all = JSON.parse(localStorage.getItem('__calls') || '[]'); all.push({ name, body, apikey: !!(init.headers || {}).apikey, top: window.top === window, path: location.pathname + location.search, t: Date.now() }); localStorage.setItem('__calls', JSON.stringify(all)); } catch {}
    let reply; try { reply = JSON.parse(localStorage.getItem('__reply') || '{}')[name]; } catch {}
    if (reply && reply.__by) reply = reply.__by[String(body && body[reply.__key])];
    return Promise.resolve(reply == null ? new Response(null, { status: 204 }) : new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };` });
const calls = async (name) => JSON.parse(await b.evalJS(`JSON.stringify(JSON.parse(localStorage.getItem('__calls') || '[]').filter(c => c.name === ${js(name)}))`));
const setReply = (o) => b.evalJS(`localStorage.setItem('__reply', ${js(JSON.stringify(o))})`);
const playlist5 = { id: 5, name: "Window", seconds: 8, show: "still", items: [{ product: B.id, finish: null }, { product: C.id, finish: null }], updated_at: new Date().toISOString() };
const PL = { __key: "p_id", __by: { 5: playlist5 } };
const DEV = "11111111-2222-4333-8444-555555555555";

await b.go(`${base}/kiosk?list=5`);
await b.evalJS(`localStorage.clear(); localStorage.setItem('__reply', ${js(JSON.stringify({ s3d_playlist_get: PL }))})`);
await b.go(`${base}/kiosk?list=5`);
await b.waitFor(`window.__kiosk?.state().playing === ${js(B.id)}`, 45000);
let pc = await calls("s3d_playlist_get");
check(pc.length === 1 && pc[0].body?.p_id === 5 && pc[0].apikey, `/kiosk?list=5 reads the playlist with s3d_playlist_get ${js(pc[0]?.body)} and plays it`);
check((await b.evalJS("document.title")).startsWith("Window"), "the page is titled with the playlist's name");
await b.go(`${base}/kiosk?list=8`);
await b.waitFor("window.__kiosk?.state().empty", 15000);
check(/isn’t there/.test(await b.evalJS("document.getElementById('empty').innerText")), "a deleted playlist: “This showcase isn’t there”");

// unpaired: nothing at all
await b.viewport(390, 844, true, IPHONE);
await b.evalJS("localStorage.removeItem('__calls'); localStorage.removeItem('s3d-device')");
await b.go(`${base}/?track=1`);
await sleep(6000);
check((await calls("s3d_device_poll")).length === 0 && (await b.evalJS("!document.querySelector('script[data-s3d-screen]') && !performance.getEntriesByType('resource').some(e => e.name.endsWith('/device.js'))")), "an unpaired browser doesn't load device.js or ask anything");
// paired, and an empty reply (204): it keeps asking, quietly
await b.evalJS(`localStorage.setItem('s3d-device', ${js(DEV)}); localStorage.setItem('__reply', '{}')`);
await b.go(`${base}/?track=1`);
await sleep(9500);
let pp = await calls("s3d_device_poll");
check(pp.length >= 2 && pp.length <= 4 && pp.every((c) => c.top), `a paired device asks every 4 s (${pp.length} in 9.5 s), from the top window only`);
check(pp[0]?.body?.p_device === DEV && pp[0]?.body?.p_showing === "catalogue" && pp[0]?.body?.p_ack === null && pp[0]?.apikey, `with its key and what it shows ${js(pp[0]?.body)}`);
// a product, in a colour
const C1 = "aaaaaaaa-0000-4000-8000-000000000001";
await setReply({ s3d_device_poll: { ok: true, cmd: C1, kind: "product", product: A.id, finish: fin, playlist: null } });
await b.waitFor(`location.pathname === ${js(`/p/${A.id}`)}`, 10000);
check((await b.evalJS("location.search")) === `?finish=${fin}`, `a product sent to it opens, in its colour (/p/${A.id}?finish=${fin})`);
await b.waitFor("!!document.getElementById('s3dTapGo')", 30000);
check((await b.evalJS("document.getElementById('s3dTapGo').textContent")) === "Tap to view in your room" && (await b.evalJS("document.activeElement?.id === 's3dTapGo'")), "a big “Tap to view in your room” button comes up, focused");
await b.shot(`${out}/device-tap.png`);
await b.waitFor(`JSON.parse(localStorage.getItem('__calls')).some(c => c.name === 's3d_device_poll' && c.body.p_ack === ${js(C1)} && c.body.p_showing === ${js(`product:${A.id}`)})`, 10000);
check(true, "the next poll reports it opened (the command's id) and what it shows");
await b.evalJS("window.__same = 1");
await sleep(9000);
check(await b.evalJS(`window.__same === 1 && location.pathname === ${js(`/p/${A.id}`)}`), "the same command isn't acted on twice");
await b.evalJS("document.getElementById('s3dTapGo').click()");
await sleep(400);
check(await b.evalJS("!document.getElementById('s3dTap') && !document.getElementById('sheet').classList.contains('hide')"), "the tap starts the page's own “View in your room” (here, its guide)");
// the same product in another colour, then "Not now"
const C1b = "aaaaaaaa-0000-4000-8000-00000000001b";
await setReply({ s3d_device_poll: { ok: true, cmd: C1b, kind: "product", product: A.id, finish: null, playlist: null } });
await b.waitFor(`location.search === ''`, 10000);
await b.waitFor("!!document.getElementById('s3dTapGo')", 30000);
await b.evalJS("[...document.querySelectorAll('#s3dTap button')].find(x => /Not now/.test(x.textContent)).click()");
check(await b.evalJS("!document.getElementById('s3dTap')"), "“Not now” leaves the product in 3D");
// a playlist
const C2 = "aaaaaaaa-0000-4000-8000-000000000002";
await b.evalJS(`localStorage.setItem('__reply', ${js(JSON.stringify({ s3d_device_poll: { ok: true, cmd: C2, kind: "playlist", product: null, finish: null, playlist: 5 }, s3d_playlist_get: PL }))})`);
await b.waitFor("location.pathname === '/kiosk' && location.search === '?list=5'", 10000);
await b.waitFor(`window.__kiosk?.state().playing === ${js(B.id)}`, 45000);
check(true, "a playlist sent to it plays (/kiosk?list=5)");
await b.waitFor(`JSON.parse(localStorage.getItem('__calls')).some(c => c.name === 's3d_device_poll' && c.body.p_ack === ${js(C2)} && c.body.p_showing === 'playlist:5')`, 10000);
check(await b.evalJS("document.querySelector('#stage iframe').contentWindow.__s3dScreen === undefined && !document.querySelector('#stage iframe').contentDocument.querySelector('script[data-s3d-screen]')"), "the kiosk polls as “playlist:5”; its product frames don't");
check(!(await calls("s3d_track")).some((c) => !c.top), "the kiosk's product frames count nothing");
// back to the catalogue
const C3 = "aaaaaaaa-0000-4000-8000-000000000003";
await setReply({ s3d_device_poll: { ok: true, cmd: C3, kind: "home", product: null, finish: null, playlist: null } });
await b.waitFor("location.pathname === '/'", 10000);
check(true, "“Back to the catalogue” opens the catalogue");
// a device that was deleted or given a new code: it stops asking
await setReply({ s3d_device_poll: { ok: false } });
await sleep(5000);
const before = (await calls("s3d_device_poll")).length;
await sleep(9000);
check((await calls("s3d_device_poll")).length === before, "a device the admin deleted stops asking");
const dLogs = b.logs.slice(stubLogs).filter((l) => /s3d|device|track/i.test(l) && !/LOG Failed to load resource/.test(l));
check(dLogs.length === 0, `device.js and the kiosk write nothing to the console${dLogs.length ? ": " + dLogs.join(" | ") : ""}`);
const sErrs = errors(stubLogs);
check(sErrs.length === 0, `no console errors${sErrs.length ? ":\n    " + sErrs.slice(0, 8).join("\n    ") : ""}`);

b.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
