// Tests the product review workflow: the admin's Testing pages, the product page's preview mode, live.js, and the
// two scripts that write review flags into products.json. Nothing reaches Supabase: the admin runs on its sample
// data (/admin?demo=1), and live.js's call to s3d_live is answered by a stand-in fetch.
// 1. promote.py --review and sync_reviews.mjs, on scratch copies of products.json (the real one is never written);
// 2. the review queue and one product's review in demo mode, at desktop and phone width: filters, search, the test
//    links (QR, preview link, the iPhone and Android AR links), the checklist, feedback with photos, fixed and
//    open again, approve and decline (a decline needs a reason), the audit log, the dashboard's two numbers, what a
//    viewer sees, and the /review short address; nothing scrolls sideways and there are no console errors;
// 3. /p/<id>?preview=1 opens a product that isn't on show, with the preview bar and noindex, and works as normal
//    (colours, doors, Apple's AR link, Google's AR link match the admin's); a plain /p/<id> of it says not found;
// 4. live.js with the decisions stubbed: an approved hidden product shows on the catalogue, its page, the compare
//    page and the showroom; a declined one comes off; slow answers (cut off at 1.2 s) and errors fall back to
//    products.json; on localhost nothing is asked without ?live=1.
// usage: node test_review.mjs <base url> <out dir>      (PORT: the browser's debugging port)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const js = (o) => JSON.stringify(o);
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const realFile = path.join(root, "products.json");
const realHash = crypto.createHash("sha256").update(fs.readFileSync(realFile)).digest("hex");

// the catalogue the server gives, and the demo's sample reviews worked out the way admin-app/demo.js makes them
const catalogue = (await (await fetch(`${base}/products.json`)).json()).products;
const shown = catalogue.filter((p) => !p.hidden), kept = catalogue.filter((p) => p.hidden);
const WAITING = shown.slice(-3).map((p) => p.id);
const demoShown = shown.filter((p) => !WAITING.includes(p.id));
const DECLINED = demoShown[3].id;
const byId = (id) => catalogue.find((p) => p.id === id);
const w1 = byId(WAITING[0]);
// a product kept off the site with more than one colour and doors, for the preview page
const hiddenP = kept.find((p) => p.finishes.length > 1 && p.parts?.length) || kept[0];

// ── 1. promote.py --review and sync_reviews.mjs, on scratch copies ──
console.log("\n[promote.py --review and sync_reviews.mjs, on scratch copies]");
{
  const tree = path.join(out, "scratch");
  fs.rmSync(tree, { recursive: true, force: true });
  fs.mkdirSync(path.join(tree, "pipeline/scripts"), { recursive: true });
  fs.mkdirSync(path.join(tree, "pipeline/entries"), { recursive: true });
  fs.copyFileSync(path.join(root, "pipeline/scripts/promote.py"), path.join(tree, "pipeline/scripts/promote.py"));
  const file = path.join(tree, "products.json");
  const text = fs.readFileSync(realFile, "utf8");
  fs.writeFileSync(file, text);
  const read = () => JSON.parse(fs.readFileSync(file, "utf8")).products;
  const NEW = "test-review-new";
  const entry = { ...structuredClone(shown[0]), id: NEW, hidden: true, awaitingReview: true };   // both flags are dropped from an entry
  fs.writeFileSync(path.join(tree, "pipeline/entries", `${NEW}.json`), JSON.stringify({ products: [entry] }, null, 2) + "\n");
  const promote = (...a) => execFileSync("python3", [path.join(tree, "pipeline/scripts/promote.py"), NEW, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  let said = promote("--review");
  let list = read(), at = list.findIndex((p) => p.id === NEW), lastOfCat = list.map((p) => p.category).lastIndexOf(entry.category);
  check(list[at]?.hidden === true && list[at]?.awaitingReview === true && /waiting for review/.test(said), `--review adds it hidden and waiting for review ("${said.split("\n")[0]}")`);
  check(at === lastOfCat && list.length === catalogue.length + 1, "--review: it goes after the last product of its category");
  check(JSON.stringify(list.filter((p) => p.id !== NEW)) === JSON.stringify(JSON.parse(text).products), "--review: no other product changes");
  promote();
  check(read().find((p) => p.id === NEW).awaitingReview === true, "promoting again with no flag keeps it waiting for review");
  promote("--show");
  let p = read().find((x) => x.id === NEW);
  check(!("hidden" in p) && !("awaitingReview" in p), "--show takes both flags off");
  promote("--hide");
  p = read().find((x) => x.id === NEW);
  check(p.hidden === true && !("awaitingReview" in p), "--hide keeps it off without waiting for review");
  let refused = false;
  try { promote("--review", "--show"); } catch { refused = true; }
  check(refused, "--review with --show is refused");
  promote("--review");
  execFileSync("python3", [path.join(tree, "pipeline/scripts/promote.py"), NEW, "--pull"], { stdio: "ignore" });
  const pulled = JSON.parse(fs.readFileSync(path.join(tree, "pipeline/entries", `${NEW}.json`), "utf8")).products[0];
  check(!("hidden" in pulled) && !("awaitingReview" in pulled), "--pull leaves both flags out of the entry");

  // sync_reviews.mjs: the scratch catalogue now has NEW waiting; decisions for it, a product on show, one kept off
  // the site, an id that isn't there; the other kept-off products have none
  const keptA = kept[0].id, keptB = kept[1].id, onShow = shown[0].id;
  const decisions = [
    { product_id: NEW, decision: "approved" }, { product_id: onShow, decision: "declined" },
    { product_id: keptA, decision: "approved" }, { product_id: "no-such-product", decision: "approved" },
  ];
  const dfile = path.join(tree, "decisions.json");
  fs.writeFileSync(dfile, JSON.stringify(decisions));
  const sync = (...a) => execFileSync("node", [path.join(root, "pipeline/scripts/sync_reviews.mjs"), ...a], { encoding: "utf8", env: { ...process.env, PRODUCTS: file, DECISIONS: dfile } });
  const before = fs.readFileSync(file, "utf8");
  check(JSON.stringify(JSON.parse(before), null, 2) + "\n" === before, "products.json is kept the way sync_reviews.mjs writes it (nothing else would change)");
  said = sync("--dry-run");
  check(fs.readFileSync(file, "utf8") === before && /3 to write/.test(said) && /dry run/.test(said), "--dry-run lists 3 changes and writes nothing");
  said = sync();
  list = read();
  const n = list.find((x) => x.id === NEW), s = list.find((x) => x.id === onShow), a = list.find((x) => x.id === keptA);
  check(!("hidden" in n) && !("awaitingReview" in n), "approved and waiting: on show, no longer waiting");
  check(s.hidden === true, "declined while on show: hidden");
  check(!("hidden" in a), "approved while kept off the site: on show");
  check(/skipped no-such-product/.test(said), "a decision for an id products.json doesn't have is reported and skipped");
  const untouched = kept.filter((x) => x.id !== keptA).every((x) => JSON.stringify(list.find((y) => y.id === x.id)) === JSON.stringify(x));
  check(untouched && list.find((x) => x.id === keptB).hidden === true, `the ${kept.length - 1} kept-off products with no decision are untouched`);
  const want = JSON.parse(before);
  for (const x of want.products) {
    if (x.id === NEW || x.id === keptA) { delete x.hidden; delete x.awaitingReview; }
    if (x.id === onShow) x.hidden = true;
  }
  check(fs.readFileSync(file, "utf8") === JSON.stringify(want, null, 2) + "\n", "the file changes in those 3 flags and nowhere else");
  check(/already matches/.test(sync()), "a second run finds nothing to write");
  // declined while waiting: hidden, and still marked as waiting (it's fixed and reviewed again)
  promote("--review");
  fs.writeFileSync(dfile, JSON.stringify([{ product_id: NEW, decision: "declined" }]));
  sync();
  p = read().find((x) => x.id === NEW);
  check(p.hidden === true && p.awaitingReview === true, "declined while waiting: stays hidden and waiting");
}

// ── the browser: stand-ins for Apple's and Google's AR links, and for s3d_live ──
const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9602) });
const errors = () => b.logs.filter((l) => /EXCEPTION|LOG |\[error\]/.test(l));
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `
  if (navigator.userAgent.includes('iPhone')) {
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (t) { return t === 'ar' ? true : supports.call(this, t); };
  }
  // an AR link (rel="ar", or Google's intent://) is recorded instead of opened; every other link works as normal
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const raw = this.getAttribute('href') || '';
    if (this.rel === 'ar' || raw.startsWith('intent:')) { window.__arLink = { href: this.href, raw, rel: this.rel, img: !!this.querySelector('img') }; return; }
    return click.call(this);
  };
  // s3d_live, answered from localStorage "__live": { mode: "ok" | "slow" | "error" | "offline", rows }
  const fetch0 = window.fetch;
  window.fetch = function (url, opts) {
    if (!String(url).includes('/rest/v1/rpc/s3d_live')) return fetch0.apply(this, arguments);
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem('__live') || '{}'); } catch {}
    localStorage.setItem('__liveCalls', String(+(localStorage.getItem('__liveCalls') || 0) + 1));
    const at = performance.now();
    window.__liveCall = { url: String(url), method: opts?.method, body: opts?.body, credentials: opts?.credentials, apikey: !!opts?.headers?.apikey };
    return new Promise((res, rej) => {
      const answer = () => cfg.mode === 'offline' ? rej(new TypeError('Failed to fetch'))
        : res(new Response(cfg.mode === 'error' ? '{"message":"sample"}' : JSON.stringify(cfg.rows || []), { status: cfg.mode === 'error' ? 500 : 200, headers: { 'content-type': 'application/json' } }));
      const t = setTimeout(answer, cfg.mode === 'slow' ? 5000 : 30);
      opts?.signal?.addEventListener('abort', () => { clearTimeout(t); window.__liveAbort = Math.round(performance.now() - at); rej(new DOMException('aborted', 'AbortError')); });
    });
  };` });

const noSideScroll = () => b.evalJS("document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1");
// an admin page by its address after the #: waits for it to be drawn
async function route(hash, want = hash.replace(/^#\//, "").split("?")[0]) {
  await b.evalJS(`delete document.getElementById('page')?.dataset.ready; location.hash = ${js(hash)}`);
  return b.waitFor(`window.__admin?.page === ${js(want)} && !document.querySelector('#page .loading')`, 20000);
}
async function openAdmin(query, hash) {
  await b.go(`${base}/admin${query}${hash}`);
  return b.waitFor(`window.__admin?.page === ${js(hash.replace(/^#\//, "").split("?")[0])} && !document.querySelector('#page .loading')`, 20000);
}
const rowIds = () => b.evalJS("JSON.stringify([...document.querySelectorAll('#rows tr[data-id]')].map((r) => r.dataset.id))").then(JSON.parse);
const counts = () => b.evalJS("JSON.stringify(Object.fromEntries([...document.querySelectorAll('[data-n]')].map((x) => [x.dataset.n, +x.textContent.replace(/\\D/g, '')])))").then(JSON.parse);
const same = (a, b2) => a.length === b2.length && [...a].sort().join() === [...b2].sort().join();

// ── 2. the admin's Testing pages, in demo mode ──
console.log("\n[review queue, desktop 1440×900]");
await b.viewport(1440, 900, false, DESKTOP);
await b.go(`${base}/admin?demo=1#/dashboard`);
await b.evalJS("sessionStorage.clear()");
check(await openAdmin("?demo=1", "#/review"), "the queue opens at /admin#/review");
check(await b.evalJS("document.querySelector('.nav a[data-page=review]') === document.querySelector('.nav a[data-page]')"), "Review queue is the first page in the sidebar");
const c0 = await counts();
const expectOpen = 3;   // demo.js: open feedback on the declined sample and on two of the three waiting products
check(c0.waiting === 3 && c0.declined === 1 && c0.live === shown.length - 4 && c0.kept === kept.length && c0.feedback === expectOpen,
  `counts: waiting ${c0.waiting}, live ${c0.live}, declined ${c0.declined}, open feedback ${c0.feedback}, kept off ${c0.kept}`);
check(await b.evalJS("document.querySelector('[data-f=waiting]').getAttribute('aria-pressed') === 'true'") && same(await rowIds(), WAITING), "Waiting for review is the default, with the 3 waiting products");
await b.evalJS(`(() => { const q = document.getElementById('q'); q.value = ${js(w1.model)}; q.dispatchEvent(new Event('input')); })()`);
check(same(await rowIds(), [w1.id]), `search by model finds ${w1.id}`);
await b.evalJS("(() => { const q = document.getElementById('q'); q.value = 'zzzz'; q.dispatchEvent(new Event('input')); })()");
check(await b.evalJS("!document.querySelector('#rows tr[data-id]') && /No product matches/.test(document.getElementById('rows').innerText)"), "a search with no match says so");
await b.evalJS("(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input')); })()");
const brand = byId(WAITING[1]).brand;
await b.evalJS(`(() => { const s = document.getElementById('brand'); s.value = ${js(brand)}; s.dispatchEvent(new Event('change')); })()`);
check(same(await rowIds(), WAITING.filter((id) => byId(id).brand === brand)), `the brand filter (${brand})`);
await b.evalJS("(() => { const s = document.getElementById('brand'); s.value = ''; s.dispatchEvent(new Event('change')); })()");
await b.evalJS("document.querySelector('[data-f=declined]').click()");
check(same(await rowIds(), [DECLINED]) && (await b.evalJS("location.hash")) === "#/review?show=declined", "Declined lists the declined sample, and the address keeps the filter");
await b.evalJS("document.querySelector('[data-f=kept]').click()");
check((await rowIds()).length === kept.length, `Kept off the site lists the ${kept.length} hidden products`);
check(await route("#/review?show=feedback") && (await rowIds()).length === expectOpen, "?show=feedback opens on Has open feedback");
check(await b.evalJS("document.querySelector('[data-f=feedback]').getAttribute('aria-pressed') === 'true'"), "the chosen filter is marked pressed");
await route("#/review?show=waiting");
check(await noSideScroll(), "queue: no sideways scroll at 1440 px");
await b.shot(`${out}/queue-desktop.png`);

console.log("\n[one product's review, desktop]");
await b.evalJS(`document.querySelector('#rows tr[data-id=${js(w1.id)}] a').click()`);
check(await b.waitFor(`window.__admin.page === ${js(`review/${w1.id}`)}`, 20000), `Review opens #/review/${w1.id}`);
const head = JSON.parse(await b.evalJS(`JSON.stringify({ badge: document.getElementById('statusBadge').innerText, crumb: document.getElementById('crumb').textContent,
  approve: !!document.getElementById('approve'), decline: !!document.getElementById('decline'), src: document.getElementById('frame').getAttribute('src'),
  qr: !!document.querySelector('#testLinks .qr svg'), link: document.querySelector('#testLinks .linkbox code').textContent,
  facts: document.getElementById('facts').innerText, title: document.title })`));
check(/Waiting for review/.test(head.badge) && head.approve && head.decline, `status "${head.badge}", with Approve and Decline for an admin`);
check(head.crumb === `Review: ${w1.model}`, `breadcrumb "${head.crumb}"`);
check(head.src.startsWith(`/p/${w1.id}?preview=1&embed`) && /&finish=[a-z0-9-]+$/.test(head.src), `the 3D preview is the product page in preview mode (${head.src})`);
check(head.qr && new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/p/${w1.id}\\?preview=1&finish=[a-z0-9-]+$`).test(head.link), `QR code and preview link ${head.link}`);
check(head.facts.includes(w1.size.w) && head.facts.includes(w1.finishes[0].name) && /Hidden, waiting for review/.test(head.facts), "key facts: size, colours, and its state");
check(await b.waitFor("document.getElementById('frame').contentDocument?.querySelector('model-viewer')?.loaded === true", 60000), "the 3D preview loads the model");
check(await b.evalJS("(() => { const d = document.getElementById('frame').contentDocument; return d.documentElement.classList.contains('embed') && getComputedStyle(d.querySelector('.preview-bar')).display === 'none'; })()"), "the embedded preview shows no preview bar");
const qr0 = await b.evalJS("document.querySelector('#testLinks .qr').innerHTML");
await b.evalJS("document.querySelector('[data-fi=\"1\"]').click()");
await sleep(200);
const c1 = JSON.parse(await b.evalJS(`JSON.stringify({ src: document.getElementById('frame').getAttribute('src'), sel: document.getElementById('linkColour').value,
  qr: document.querySelector('#testLinks .qr').innerHTML, link: document.querySelector('#testLinks .linkbox code').textContent,
  ql: document.querySelector('[data-ql]').dataset.ql, pressed: document.querySelector('[data-fi="1"]').getAttribute('aria-pressed') })`));
check(c1.src !== head.src && c1.sel === "1" && c1.qr !== qr0 && c1.link !== head.link && c1.pressed === "true", "a colour chip changes the preview, the colour list, the QR code and the link");
check(c1.ql.startsWith(`${base}${w1.finishes[1].usdz}?v=7#allowsContentScaling=0&canonicalWebPageURL=${encodeURIComponent(c1.link)}`), "the iPhone AR link is that colour's USDZ, as product.html opens it");
await b.evalJS("(() => { const s = document.getElementById('linkColour'); s.value = '2'; s.dispatchEvent(new Event('change')); })()");
check(await b.evalJS(`document.querySelector('[data-fi="2"]').getAttribute('aria-pressed') === 'true' && document.querySelector('[data-ql]').dataset.ql.includes(${js(w1.finishes[2].usdz)})`), "the colour list beside the QR code changes the colour too");
await b.evalJS("window.__arLink = null; document.querySelector('[data-ql]').click()");
check(await b.evalJS("window.__arLink?.rel === 'ar' && window.__arLink.img === true"), "Open (iPhone) opens Apple's AR view the way Safari needs it (rel=ar, one image)");
const sv = await b.evalJS("document.getElementById('svLink').getAttribute('href')");
check(sv.startsWith(`intent://arvr.google.com/scene-viewer/1.2?v=7&mode=ar_preferred&disable_occlusion=true&resizable=false&file=${encodeURIComponent(`${base}${w1.glb}?v=7`)}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=`), "the Android AR link is Google's Scene Viewer for the model");
await b.evalJS("navigator.clipboard.writeText = async (t) => { window.__copied = t; }; document.querySelector('#testLinks .linkbox [data-copy]').click()");
await sleep(100);
check((await b.evalJS("window.__copied")) === (await b.evalJS("document.querySelector('#testLinks .linkbox code').textContent")), "Copy copies the preview link");

// the checklist
await b.evalJS("document.querySelector('[data-dev=android]').click()");
const items = await b.evalJS("JSON.stringify([...document.querySelectorAll('#myChecks [data-item]')].map((x) => x.dataset.item))").then(JSON.parse);
check(same(items, ["ar_android", "doors", "colours", "labels", "inside", "size"]), "on Android, the checklist has Android AR and the 5 checks for every device");
const cell = (row, col) => b.evalJS(`document.querySelectorAll('#grid tr')[${row}].children[${col}].innerText.replace(/\\s+/g, ' ').trim()`);
const doorsRow = 3, androidCol = 2;   // CHECKS order in review.js; columns: the check, iPhone, Android, headset, computer
const before = await cell(doorsRow, androidCol);
await b.evalJS("document.querySelector('#myChecks [data-item=doors] [data-mark=pass]').click()");
await b.waitFor("document.querySelector('#myChecks [data-item=doors] [data-mark=pass]')?.getAttribute('aria-pressed') === 'true'", 5000);
const afterPass = await cell(doorsRow, androidCol);
check(afterPass !== before && /1.*1/.test(afterPass), `Pass on Doors (Android) adds my mark to the grid ("${before}" → "${afterPass}")`);
await b.evalJS("document.querySelector('#myChecks [data-item=doors] [data-mark=untested]').click()");
await b.waitFor("document.querySelector('#myChecks [data-item=doors] [data-mark=untested]')?.getAttribute('aria-pressed') === 'true'", 5000);
check((await cell(doorsRow, androidCol)) === before, "Not tested takes it back off");
check(await b.evalJS("sessionStorage.getItem('s3d-test-device') === 'android'"), "the device chosen is remembered for the tab");

// feedback with photos
const pick = (files) => b.evalJS(`(async () => {
  const make = async ([w, h, type]) => {
    if (type === 'text/plain') return new File(['not a photo'], 'notes.txt', { type });
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(w / 4, h / 4, w / 2, h / 2);
    return new File([await new Promise((r) => c.toBlob(r, type))], 'photo-' + w + '.png', { type });
  };
  const dt = new DataTransfer();
  for (const f of ${js(files)}) dt.items.add(await make(f));
  const input = document.getElementById('fbPhotos');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
})()`);
const thumbs = () => b.evalJS("document.querySelectorAll('#fbThumbs img').length");
await b.evalJS("document.getElementById('fbForm').requestSubmit()");
await sleep(100);
check(/Write what you saw/.test(await b.evalJS("document.getElementById('fbErr').textContent")), "feedback with no text is refused: Write what you saw.");
await pick([[1, 1, "text/plain"]]);
await b.waitFor("document.getElementById('fbErr').textContent.length > 0", 5000);
check(/isn’t a photo/.test(await b.evalJS("document.getElementById('fbErr').textContent")) && (await thumbs()) === 0, "a file that isn't a photo is refused");
await pick([[3200, 2400, "image/png"]]);
await b.waitFor("document.querySelectorAll('#fbThumbs img').length === 1 && document.querySelector('#fbThumbs img').complete", 10000);
const shrunk = JSON.parse(await b.evalJS(`(async () => { const i = document.querySelector('#fbThumbs img'); const bl = await (await fetch(i.src)).blob(); return JSON.stringify({ w: i.naturalWidth, h: i.naturalHeight, type: bl.type, size: bl.size }); })()`));
check(shrunk.w === 1600 && shrunk.h === 1200 && shrunk.type === "image/jpeg" && shrunk.size < 5 * 1024 * 1024, `a 3200×2400 PNG is made a ${shrunk.w}×${shrunk.h} JPEG (${Math.round(shrunk.size / 1024)} KB)`);
await pick([[800, 600, "image/png"], [600, 800, "image/png"], [500, 500, "image/png"]]);
await b.waitFor("document.querySelectorAll('#fbThumbs img').length === 3", 10000);
check(/Up to 3 photos/.test(await b.evalJS("document.getElementById('fbErr').textContent")) && (await thumbs()) === 3, "a 4th photo is refused: up to 3");
check(await b.evalJS("document.getElementById('addPhoto').classList.contains('hide')"), "Add photos goes away at 3");
await b.evalJS("document.querySelector('[data-unpick=\"2\"]').click()");
check((await thumbs()) === 2 && (await b.evalJS("!document.getElementById('addPhoto').classList.contains('hide')")), "a picked photo can be taken off again");
const fbBefore = await b.evalJS("document.querySelectorAll('#fbList li[data-fb]').length");
await b.evalJS(`(() => { const f = document.getElementById('fbForm'); f.body.value = 'Test feedback: the shelf edge looks too thick on Android.'; f.device.value = 'android'; f.finish.value = ${js(w1.finishes[0].name)}; f.area.value = 'Inside'; f.requestSubmit(); })()`);
await b.waitFor(`document.querySelectorAll('#fbList li[data-fb]').length === ${fbBefore + 1}`, 10000);
const fb = JSON.parse(await b.evalJS(`JSON.stringify((() => { const li = document.querySelector('#fbList li[data-fb]'); return { text: li.innerText, imgs: li.querySelectorAll('.rv-thumb img').length, open: li.classList.contains('open'),
  sub: document.getElementById('fbSub').textContent, cleared: document.getElementById('fbBody').value === '' && !document.querySelector('#fbThumbs img') }; })())`));
check(/shelf edge/.test(fb.text) && /Android/.test(fb.text) && fb.text.includes(w1.finishes[0].name) && /Inside/.test(fb.text) && fb.imgs === 2 && fb.open, "sent feedback is listed first, open, with its device, colour, area and 2 photos");
check(fb.cleared && /^3 open, 0 fixed/.test(fb.sub), `the form is cleared, and the count updates ("${fb.sub}")`);
await b.evalJS("document.querySelector('#fbList li[data-fb] [data-fbset=fixed]').click()");
await b.waitFor("document.querySelector('#fbList li[data-fb]')?.classList.contains('fixed')", 5000);
check(await b.evalJS("/Marked fixed by/.test(document.querySelector('#fbList li[data-fb]').innerText) && /^2 open, 1 fixed/.test(document.getElementById('fbSub').textContent)"), "Mark fixed marks it fixed, with who did it");
await b.evalJS("document.querySelector('#fbList li[data-fb] [data-fbset=open]').click()");
check(await b.waitFor("document.querySelector('#fbList li[data-fb]')?.classList.contains('open')", 5000), "Open again reopens it");

// approve, then decline (a reason is needed)
await b.evalJS("document.getElementById('approve').click()");
await b.waitFor("document.querySelector('dialog form')", 5000);
check(/goes on the catalogue straight away/.test(await b.evalJS("document.querySelector('dialog').innerText")), "Approve asks first, and says it goes on the catalogue straight away");
await b.evalJS("(() => { const f = document.querySelector('dialog form'); f.note.value = 'Test note: checked on iPhone and Android.'; document.querySelector('dialog [data-submit]').click(); })()");
await b.waitFor("!document.querySelector('dialog[open]') && /Live/.test(document.getElementById('statusBadge').innerText)", 5000);
check(await b.evalJS("/Live/.test(document.getElementById('statusBadge').innerText) && /Approved by/.test(document.getElementById('statusLine').innerText)"), "approved: the status is Live, approved by me");
check(await b.evalJS("/Approved/.test(document.querySelector('#history li').innerText) && /Test note/.test(document.querySelector('#history li').innerText)"), "the decision is in the history with its note");
await b.evalJS("document.getElementById('decline').click()");
await b.waitFor("document.querySelector('dialog form')", 5000);
check(/comes off the catalogue straight away/.test(await b.evalJS("document.querySelector('dialog').innerText")), "Decline asks first, and says it comes off the catalogue");
await b.evalJS("document.querySelector('dialog [data-submit]').click()");
await sleep(300);
check(await b.evalJS("!!document.querySelector('dialog[open]') && /Say why it is declined/.test(document.getElementById('mformErr').textContent)"), "a decline with no reason is refused");
await b.evalJS("(() => { const f = document.querySelector('dialog form'); f.note.value = 'ok'; document.querySelector('dialog [data-submit]').click(); })()");
await sleep(300);
check(await b.evalJS("!!document.querySelector('dialog[open]')"), "a 2-letter reason is refused too");
await b.evalJS("(() => { const f = document.querySelector('dialog form'); f.note.value = 'Test reason: the handle is the wrong colour.'; document.querySelector('dialog [data-submit]').click(); })()");
await b.waitFor("!document.querySelector('dialog[open]') && /Declined/.test(document.getElementById('statusBadge').innerText)", 5000);
check(await b.evalJS("/Declined/.test(document.getElementById('statusBadge').innerText) && /Test reason/.test(document.getElementById('statusLine').innerText)"), "declined: the status says so, with the reason");
check(await b.evalJS("document.querySelectorAll('#history li').length === 2 && /Declined/.test(document.querySelector('#history li').innerText)"), "the history has both, newest first");
check(await noSideScroll(), "review page: no sideways scroll at 1440 px");
await b.evalJS("scrollTo(0, 0)");
await b.shot(`${out}/review-desktop.png`);
await route("#/review?show=waiting");
check(same(await rowIds(), WAITING.slice(1)) && (await counts()).declined === 2, "back in the queue: it has left Waiting and joined Declined");
await route("#/audit");
await b.waitFor("!/Loading…/.test(document.getElementById('rows').innerText)", 10000);
const audit = await b.evalJS("JSON.stringify([...document.querySelectorAll('#page tbody tr')].slice(0, 2).map((r) => r.innerText.replace(/\\s+/g, ' ')))").then(JSON.parse);
check(/Product declined/.test(audit[0]) && audit[0].includes(w1.model) && /Product approved/.test(audit[1]) && audit[1].includes(w1.model), "both are in the audit log, newest first");
await route("#/dashboard");
await b.waitFor("document.querySelector('a.stat-link')", 10000);
const dash = JSON.parse(await b.evalJS(`JSON.stringify([...document.querySelectorAll('a.stat-link')].map((a) => ({ href: a.getAttribute('href'), title: a.querySelector('.t').innerText.trim(), value: a.querySelector('.v').textContent, sub: a.querySelector('.s')?.textContent })))`));
// open feedback now: the 4 samples still open, plus this test's (fixed, then opened again), on 3 products
check(dash.length === 2 && dash[0].href === "#/review?show=waiting" && dash[0].title === "Waiting for review" && dash[0].value === "2",
  `dashboard: Waiting for review ${dash[0]?.value} (3 less this test's decline), linking to the queue`);
check(dash[1]?.href === "#/review?show=feedback" && dash[1].title === "Open feedback" && dash[1].value === "5" && /on 3 products/.test(dash[1].sub), `dashboard: Open feedback ${dash[1]?.value}, "${dash[1]?.sub}", linking to the queue`);
await b.evalJS("document.querySelector('a.stat-link[href$=feedback]').click()");
check(await b.waitFor("window.__admin.page === 'review' && document.querySelector('[data-f=feedback]')?.getAttribute('aria-pressed') === 'true'", 10000), "the Open feedback card opens the queue on Has open feedback");
check(errors().length === 0, `no console errors${errors().length ? `: ${errors().join(" | ")}` : ""}`);

console.log("\n[what a viewer sees]");
b.logs.length = 0;
check(await openAdmin("?demo=1&as=viewer", `#/review/${w1.id}`), "a viewer can open a product's review");
check(await b.evalJS("!document.getElementById('approve') && !document.getElementById('decline') && !document.querySelector('[data-fbset]')"), "no Approve, Decline or Mark fixed for a viewer");
await b.evalJS("(() => { const f = document.getElementById('fbForm'); f.body.value = 'Test feedback from a viewer.'; f.requestSubmit(); })()");
check(await b.waitFor("/Test feedback from a viewer/.test(document.querySelector('#fbList li[data-fb]')?.innerText || '')", 10000), "a viewer can give feedback");
await b.evalJS("document.querySelector('#myChecks [data-mark=pass]').click()");
check(await b.waitFor("document.querySelector('#myChecks [data-mark=pass]')?.getAttribute('aria-pressed') === 'true'", 5000), "and fill the checklist");
check(errors().length === 0, "no console errors");

console.log("\n[the /review short address]");
await b.go(`${base}/review?demo=1`);
check(await b.waitFor("location.pathname === '/admin' && location.search === '?demo=1' && location.hash === '#/review' && window.__admin?.page === 'review'", 15000), "/review?demo=1 opens /admin?demo=1#/review");
await b.go(`${base}/review?demo=1&id=${w1.id}`);
check(await b.waitFor(`location.hash === ${js(`#/review/${w1.id}`)} && window.__admin?.page === ${js(`review/${w1.id}`)}`, 15000), "/review?id=<id> opens that product's review");

console.log("\n[phone 390×844]");
b.logs.length = 0;
await b.viewport(390, 844, true, IPHONE);
await b.evalJS("sessionStorage.clear()");
check(await openAdmin("?demo=1", "#/review"), "the queue opens on a phone");
check(same(await rowIds(), WAITING) && (await noSideScroll()), "the 3 waiting products, and no sideways scroll at 390 px");
await b.shot(`${out}/queue-phone.png`);
await b.evalJS("document.querySelector('[data-f=kept]').click()");
check(await noSideScroll(), "no sideways scroll with the long list either");
check(await route(`#/review/${w1.id}`, `review/${w1.id}`), "a product's review opens on a phone");
check(await b.evalJS("(() => { const r = document.getElementById('frame').getBoundingClientRect(); return r.width > 300 && r.width <= innerWidth && r.height > 250; })()"), "the 3D preview fills the width");
check(await b.evalJS("document.querySelector('[data-dev=iphone]').getAttribute('aria-pressed') === 'true'"), "on an iPhone, the checklist starts on iPhone / iPad");
check(await noSideScroll(), "review page: no sideways scroll at 390 px");
await b.waitFor("document.getElementById('frame').contentDocument?.querySelector('model-viewer')?.loaded === true", 60000);
await b.shot(`${out}/review-phone.png`);
// the whole page, for a look at every section (half scale keeps the picture small)
const tall = await b.evalJS("Math.min(document.documentElement.scrollHeight, 6000)");
await b.send("Emulation.setDeviceMetricsOverride", { width: 390, height: tall, deviceScaleFactor: 1, mobile: true });
await sleep(600);
await b.shot(`${out}/review-phone-full.jpg`);
await b.viewport(390, 844, true, IPHONE);
check(await b.evalJS("(() => { const i = document.getElementById('fbPhotos'); return i.tabIndex >= 0 && getComputedStyle(i).display !== 'none' && getComputedStyle(i).visibility !== 'hidden'; })()"), "Add photos can be reached with the keyboard");
check(errors().length === 0, `no console errors${errors().length ? `: ${errors().join(" | ")}` : ""}`);

// ── 3. preview mode on the product page ──
console.log(`\n[preview mode: ${hiddenP.id}, kept off the site]`);
b.logs.length = 0;
await b.viewport(1440, 900, false, DESKTOP);
await b.evalJS("sessionStorage.clear()");
await b.go(`${base}/p/${hiddenP.id}`);
await b.waitFor("document.querySelector('.missing') || document.querySelector('model-viewer')?.loaded", 20000);
check(await b.evalJS("!!document.querySelector('.missing') && /couldn’t find/.test(document.body.innerText)"), "a plain /p/<id> of a hidden product says it couldn't be found");
await b.go(`${base}/p/${hiddenP.id}?preview=1`);
check(await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 60000), "/p/<id>?preview=1 opens it, and the model loads");
const pv = JSON.parse(await b.evalJS(`JSON.stringify({ cls: document.documentElement.classList.contains('preview'), bar: getComputedStyle(document.querySelector('.preview-bar')).display, text: document.querySelector('.preview-bar').innerText,
  robots: document.querySelector('meta[name=robots]')?.content, h1: document.querySelector('h1')?.textContent, id: window.__demo?.product.id })`));
check(pv.cls && pv.bar !== "none" && /Preview: not on the catalogue yet/.test(pv.text), `the preview bar shows ("${pv.text.replace(/\s+/g, " ")}")`);
check(/noindex/.test(pv.robots || ""), `search engines are told not to list it (robots: ${pv.robots})`);
check(pv.id === hiddenP.id, `it is ${hiddenP.id}`);
if (hiddenP.finishes.length > 1) {
  await b.evalJS("document.querySelectorAll('#swatches .swatch')[1].click()");
  await sleep(800);
  const v = await b.evalJS("document.querySelector('model-viewer').variantName");
  check(v === (hiddenP.finishes[1].variant || hiddenP.finishes[1].name) || v === hiddenP.finishes[1].variant, `the colours work (${v})`);
}
const key = hiddenP.parts[0].key;
await b.evalJS(`window.__demo.togglePart(${js(key)})`);
await b.waitFor("window.__demo.idle()", 15000);
check(await b.evalJS(`!!window.__demo.state[${js(key)}]`), `the doors work (${key} opened)`);
check(await noSideScroll(), "no sideways scroll at 1440 px");
await b.shot(`${out}/preview-desktop.png`);
// Google's AR link, as model-viewer itself makes it, against the admin's
const mvIntent = await b.evalJS(`(async () => {
  const mv = document.querySelector('model-viewer');
  const sym = (o, n) => { for (; o; o = Object.getPrototypeOf(o)) { const s = Object.getOwnPropertySymbols(o).find((x) => x.description === n); if (s) return s; } };
  const s = sym(mv, 'openSceneViewer');
  if (!s) return 'model-viewer has no openSceneViewer';
  window.__arLink = null;
  await mv[s]();
  return window.__arLink?.raw || 'nothing opened';
})()`);
await b.go(`${base}/p/${hiddenP.id}?preview=1&embed`);
await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 60000);
check(await b.evalJS("document.documentElement.classList.contains('preview') && getComputedStyle(document.querySelector('.preview-bar')).display === 'none'"), "embedded (as in the admin), the bar is hidden");
check(errors().length === 0, `no console errors${errors().length ? `: ${errors().join(" | ")}` : ""}`);

console.log("\n[preview mode on an iPhone, and the admin's AR links for the same product]");
b.logs.length = 0;
await b.viewport(390, 844, true, IPHONE);
await b.go(`${base}/p/${hiddenP.id}?preview=1`);
await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 60000);
await sleep(800);
check(await b.evalJS("getComputedStyle(document.querySelector('.preview-bar')).display !== 'none'") && (await noSideScroll()), "the bar shows on a phone, with no sideways scroll");
await b.shot(`${out}/preview-phone.png`);
const fi = hiddenP.finishes.length > 1 ? 1 : 0;
if (fi) await b.evalJS("document.querySelectorAll('#swatches .swatch')[1].click()");
await b.evalJS("window.__arLink = null; document.getElementById('btnAR').click()");
await sleep(500);
await b.evalJS("document.getElementById('sheetGo')?.click()");
await sleep(300);
const pageQL = await b.evalJS("window.__arLink?.href || ''");
check(pageQL.includes(hiddenP.finishes[fi].usdz), `the AR button opens Apple's AR view of that colour (${pageQL.split("#")[0].replace(base, "")})`);
check(await openAdmin("?demo=1", `#/review/${hiddenP.id}`), "its review opens in the admin");
check(/Kept off the site/.test(await b.evalJS("document.getElementById('statusBadge').innerText")), "status: Kept off the site");
if (fi) await b.evalJS("document.querySelector('[data-fi=\"1\"]').click()");
const adminQL = await b.evalJS("document.querySelector('[data-ql]').dataset.ql");
const cut = (u) => new URL(u).href.split("&canonicalWebPageURL=")[0];
check(pageQL && cut(adminQL) === cut(pageQL), "the admin's iPhone AR link is the one the product page opens");
const adminSV = await b.evalJS("document.getElementById('svLink').getAttribute('href')");
const fallback = (u) => u.split(";S.browser_fallback_url=")[0];
check(mvIntent.startsWith("intent://") && fallback(adminSV) === fallback(mvIntent), `the admin's Android AR link is the one model-viewer makes${mvIntent.startsWith("intent://") ? "" : ` (${mvIntent})`}`);
check(errors().length === 0, `no console errors${errors().length ? `: ${errors().join(" | ")}` : ""}`);

// ── 4. live.js with the decisions stubbed ──
console.log("\n[live.js]");
b.logs.length = 0;
await b.viewport(1440, 900, false, DESKTOP);
const APPROVED = hiddenP.id, GONE = shown[0].id;
const setLive = (cfg) => b.evalJS(`localStorage.setItem('__live', ${js(JSON.stringify(cfg))}); localStorage.setItem('__liveCalls', '0'); window.__liveAbort = undefined;`);
const calls = () => b.evalJS("+localStorage.getItem('__liveCalls')");
const cards = () => b.evalJS("JSON.stringify([...document.querySelectorAll('a.card[href^=\"/p/\"]')].map((a) => a.getAttribute('href').slice(3)))").then(JSON.parse);
const rows = [{ product_id: APPROVED, decision: "approved" }, { product_id: GONE, decision: "declined" }, { product_id: "no-such-product", decision: "approved" }, { product_id: 7, decision: "approved" }];
await b.go(`${base}/`);
await b.evalJS("sessionStorage.clear()");
await setLive({ mode: "ok", rows });
await b.go(`${base}/`);
await b.waitFor("document.querySelectorAll('a.card').length > 0", 20000);
await sleep(300);
let ids = await cards();
check((await calls()) === 0 && !ids.includes(APPROVED) && ids.includes(GONE) && ids.length === shown.length, `on localhost, nothing is asked without ?live=1 (${ids.length} cards, from products.json)`);
await b.go(`${base}/?live=1`);
await b.waitFor("document.querySelectorAll('a.card').length > 0", 20000);
await sleep(300);
ids = await cards();
check((await calls()) === 1 && ids.includes(APPROVED) && !ids.includes(GONE) && ids.length === shown.length, "with ?live=1: the approved hidden product is on the catalogue and the declined one is gone");
const call = JSON.parse(await b.evalJS("JSON.stringify(window.__liveCall)"));
check(call.method === "POST" && call.body === "{}" && call.credentials === "omit" && call.apikey && /\/rest\/v1\/rpc\/s3d_live$/.test(call.url), "it asks s3d_live once, with the anon key and no cookies");
await b.shot(`${out}/live-catalogue.png`);
await b.go(`${base}/p/${APPROVED}`);
check(await b.waitFor("document.querySelector('model-viewer')?.loaded === true || !!document.querySelector('.missing')", 60000) && (await b.evalJS("!document.querySelector('.missing') && !document.documentElement.classList.contains('preview')")),
  "the approved product's own page opens, with no preview bar (?live=1 stays on for the tab)");
await b.go(`${base}/p/${GONE}`);
await b.waitFor("!!document.querySelector('.missing') || document.querySelector('model-viewer')?.loaded === true", 30000);
check(await b.evalJS("!!document.querySelector('.missing')"), "the declined product's page says it couldn't be found");
await b.go(`${base}/compare?a=${APPROVED}`);
await b.waitFor("!!window.__compare", 30000);
check((await b.evalJS("new URLSearchParams(location.search).get('a')")) === APPROVED, "the compare page takes the approved product");
await b.go(`${base}/compare?a=${GONE}`);
await b.waitFor("!!window.__compare", 30000);
check((await b.evalJS("new URLSearchParams(location.search).get('a')")) !== GONE, "and not the declined one");
await b.go(`${base}/showroom`);
await b.waitFor("!!window.__showroom?.slots", 60000);
const slotIds = JSON.parse(await b.evalJS("JSON.stringify(window.__showroom.slots().map((s) => s.id))"));
check(slotIds.includes(APPROVED) && !slotIds.includes(GONE), `the showroom stands the approved product and not the declined one (${slotIds.length} stands)`);
await b.go("about:blank");   // the showroom's models are big; let them go
check(errors().length === 0, `no console errors${errors().length ? `: ${errors().join(" | ")}` : ""}`);

for (const mode of ["slow", "error", "offline"]) {
  await b.go(`${base}/`);
  await setLive({ mode, rows });
  const t0 = Date.now();
  await b.go(`${base}/`);
  await b.waitFor("document.querySelectorAll('a.card').length > 0", 20000);
  const took = Date.now() - t0;
  await sleep(200);
  ids = await cards();
  const abort = await b.evalJS("window.__liveAbort");
  const fellBack = (await calls()) === 1 && !ids.includes(APPROVED) && ids.includes(GONE) && ids.length === shown.length;
  if (mode === "slow") check(fellBack && abort >= 1150 && abort < 2500 && took < 4500, `slow answer: cut off after ${abort} ms, and products.json alone decides (cards after ${took} ms)`);
  else check(fellBack, `${mode === "error" ? "an error from Supabase" : "no network"}: products.json alone decides`);
}
await b.go(`${base}/p/${APPROVED}`);
await b.waitFor("!!document.querySelector('.missing') || document.querySelector('model-viewer')?.loaded === true", 30000);
check(await b.evalJS("!!document.querySelector('.missing')"), "with no answer, the approved product's page follows products.json (hidden)");
await b.evalJS("localStorage.removeItem('__live'); localStorage.removeItem('__liveCalls'); sessionStorage.clear()");

b.close();
const after = crypto.createHash("sha256").update(fs.readFileSync(realFile)).digest("hex");
check(after === realHash, "the real products.json is unchanged");
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
