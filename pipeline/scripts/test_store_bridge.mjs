// Tests the store app integration, all switched off today:
// 1. the sign-in check (pipeline/integration/check-token.mjs) with a made-up secret: a good token passes; a wrong
//    secret, another algorithm, an expired or not-yet-valid token, another issuer or audience, missing claims and
//    tampering all fail; it answers 503 until configured, and never writes to the console;
// 2. make_pages.mjs build(): old-links.json's two kinds of value, and the frame-ancestors header appearing in
//    vercel.json only once frameParents is filled; a mistyped address in site-config.js is refused;
// 3. the old paths on the local server: /id/<Product ID>, /embed/discovery and /ar-experience/<id> (unknown ids
//    land on the catalogue with a note), each keeping its query string;
// 4. store-bridge.js with today's empty config, framed by a page standing in for the store app: it posts nothing,
//    listens to nothing and sets no window.storeApp;
// 5. store-bridge.js switched on by a test config, framed on a second local origin: SC_EMBED_READY reaches the
//    exact parent and not a parent on another origin; a token from the parent is taken; tokens from another origin
//    or another frame are ignored; SC_LOGOUT clears it; an expired token brings SC_TOKEN_EXPIRED; a product page
//    opened in the frame asks again; and the token reaches no storage, cookie, address or console.
// It starts its own servers (serve.mjs) on BASE, BASE+1 and BASE+2, and Chrome on BASE+9 (BASE defaults to 9080).
// usage: node test_store_bridge.mjs <out dir>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";
import { verifyToken, default as handler } from "../integration/check-token.mjs";
import { build, checkSite } from "./make_pages.mjs";
import { SITE } from "../../site-config.js";

const [out] = process.argv.slice(2);
if (!out) { console.log("usage: node test_store_bridge.mjs <out dir>"); process.exit(2); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = +(process.env.BASE || 9080);
const REAL = `http://localhost:${BASE}`;        // the site with today's site-config.js
const ON = `http://localhost:${BASE + 1}`;       // the site with the bridge switched on (test config)
const APP = `http://127.0.0.1:${BASE + 2}`;      // stands in for the store app: allowed by the test config
const OTHER = `http://localhost:${BASE + 2}`;    // the same pages on an address that isn't allowed
fs.mkdirSync(`${out}/host`, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };

// ── tokens, signed with a made-up secret ──
const SECRET = crypto.randomBytes(32).toString("hex"), ISS = "test-issuer", AUD = "test-audience";
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(claims, { secret = SECRET, header = { alg: "HS256", typ: "JWT" } } = {}) {
  const h = b64u(header), p = b64u(claims);
  return `${h}.${p}.${crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}
const now = () => Math.floor(Date.now() / 1000);
const staff = (extra = {}) => ({ iss: ISS, aud: AUD, sub: "staff-1", email: "staff@example.com", name: "Test Staff", iat: now(), exp: now() + 600, ...extra });

console.log("\n[the sign-in check]");
const opts = { secret: SECRET, issuer: ISS, audience: AUD };
const why = (t, o = opts) => { const r = verifyToken(t, o); return r.ok ? "ok" : r.why; };
const good = verifyToken(sign(staff()), opts);
check(good.ok && good.claims.sub === "staff-1" && good.claims.email === "staff@example.com" && good.claims.name === "Test Staff", "a good token passes, with sub, email and name");
check(why(sign(staff({ aud: ["other", AUD] }))) === "ok", "an audience list that includes ours passes");
check(why(sign(staff(), { secret: "another-secret" })) === "signature", "another secret fails");
check(why(sign(staff(), { header: { alg: "HS512", typ: "JWT" } })) === "algorithm", "another algorithm fails (HS512)");
const [h0, p0] = sign(staff()).split(".");
check(why(`${b64u({ alg: "none" })}.${p0}.`) === "malformed" && why(`${b64u({ alg: "none" })}.${p0}.x`) === "algorithm", "alg none fails");
check(why(sign(staff({ exp: now() - 120 }))) === "expired", "an expired token fails");
check(why(sign(staff({ exp: undefined }))) === "expired", "a token with no expiry fails");
check(why(sign(staff({ nbf: now() + 600 }))) === "not yet valid", "a token not yet valid fails");
check(why(sign(staff({ iss: "someone-else" }))) === "issuer", "another issuer fails");
check(why(sign(staff({ aud: "someone-else" }))) === "audience", "another audience fails");
check(why(sign(staff({ email: "" }))) === "claims" && why(sign(staff({ sub: undefined }))) === "claims", "a token without sub or email fails");
const forged = `${h0}.${b64u(staff({ sub: "boss" }))}.${sign(staff()).split(".")[2]}`;
check(why(forged) === "signature", "a changed payload with the old signature fails");
check(["", "a.b", "a.b.c.d", 42, null, "x".repeat(9000)].every((t) => why(t) === "malformed"), "malformed tokens fail");
check(why(sign(staff()), { ...opts, secret: "" }) === "not configured", "nothing passes without a secret");

// the function itself, as Vercel would call it
const quiet = {};
for (const k of ["log", "info", "warn", "error", "debug"]) { quiet[k] = console[k]; console[k] = (...a) => { quiet.said = (quiet.said || []).concat(a.join(" ")); }; }
async function call(method, body, env) {
  const keep = {};
  for (const k of ["STORE_TOKEN_SECRET", "STORE_TOKEN_ISSUER", "STORE_TOKEN_AUDIENCE"]) { keep[k] = process.env[k]; if (env) process.env[k] = env[k]; else delete process.env[k]; }
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(t) { this.body = JSON.parse(t); } };
  try { await handler({ method, body, headers: {} }, res); } finally { for (const k in keep) { if (keep[k] === undefined) delete process.env[k]; else process.env[k] = keep[k]; } }
  return res;
}
const ENV = { STORE_TOKEN_SECRET: SECRET, STORE_TOKEN_ISSUER: ISS, STORE_TOKEN_AUDIENCE: AUD };
const r503 = await call("POST", { token: sign(staff()) }, null);
const r200 = await call("POST", { token: sign(staff()) }, ENV);
const r401 = await call("POST", { token: sign(staff(), { secret: "nope" }) }, ENV);
const r405 = await call("GET", undefined, ENV);
const rStr = await call("POST", JSON.stringify({ token: sign(staff()) }), ENV);
for (const k of ["log", "info", "warn", "error", "debug"]) console[k] = quiet[k];
check(r503.statusCode === 503 && r503.body.error === "not configured", "answers 503 \"not configured\" until the three settings are set");
check(r200.statusCode === 200 && r200.body.ok && r200.body.email === "staff@example.com" && r200.headers["cache-control"] === "no-store", "200 with the staff member for a good token, not cached");
check(r401.statusCode === 401 && r401.body.ok === false && !("why" in r401.body), "401 for a bad token, without saying which check failed");
check(r405.statusCode === 405 && r405.headers.allow === "POST", "405 for anything but POST");
check(rStr.statusCode === 200, "a body Vercel left as text is read too");
check(!quiet.said, `writes nothing to the console${quiet.said ? `: ${quiet.said[0]}` : ""}`);
check(!JSON.stringify([r200, r401]).includes(sign(staff()).split(".")[2]), "never sends a token back");

console.log("\n[make_pages: old links and the frame rule]");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const products = JSON.parse(read("products.json")).products;
const withPid = products.find((p) => !p.hidden && /\/\d+\/?$/.test(p.sangeethaUrl || ""));
const PID = withPid.sangeethaUrl.match(/(\d+)\/?$/)[1];
const U1 = "11111111-1111-4111-8111-111111111111", U2 = "22222222-2222-4222-8222-222222222222", U3 = "33333333-3333-4333-8333-333333333333";
const inputs = (site, links = {}) => ({ site: checkSite(site), products, oldLinks: { links }, productHtml: read("product.html"), indexHtml: read("index.html"), vercelJson: read("vercel.json") });
const made = build(inputs(structuredClone(SITE), { [U1]: withPid.id, [U2]: PID, [U3]: "no-such-product", "../up": withPid.id }));
check(made.files.get(`ar-experience/${U1}.html`)?.includes(`"/p/${withPid.id}"`), `an old id mapped to our id opens /p/${withPid.id}`);
check(made.files.get(`ar-experience/${U2}.html`)?.includes(`"/p/${withPid.id}"`), `an old id mapped to Product ID ${PID} opens the same page`);
check(!made.files.has(`ar-experience/${U3}.html`) && made.notes.some((n) => n.includes(U3)), "an old id mapped to no product makes no page, and says so");
check(![...made.files.keys()].some((f) => f.includes("..")) && made.notes.some((n) => n.includes("../up")), "an old id that isn't a safe file name is skipped");
check(made.files.get("vercel.json") === read("vercel.json") && !read("vercel.json").includes("frame-ancestors"), "with frameParents empty, vercel.json has no frame rule (framing open, as today)");
const TEST_SITE = { ...structuredClone(SITE), storeAppOrigins: ["https://store.example.invalid", APP], frameParents: [APP, "https://www.example.invalid"] };
const framed = JSON.parse(build(inputs(structuredClone(TEST_SITE))).files.get("vercel.json"));
const csp = framed.headers.filter((h) => h.source === "/(.*)").flatMap((h) => h.headers).find((x) => x.key === "Content-Security-Policy")?.value || "";
check(csp === `frame-ancestors 'self' ${APP} https://www.example.invalid https://store.example.invalid`, `with frameParents filled: ${csp}`);
const back = build({ ...inputs(structuredClone(SITE)), vercelJson: JSON.stringify(framed, null, 2) + "\n" }).files.get("vercel.json");
check(back === read("vercel.json"), "emptying frameParents again takes the rule out");
const moved = build(inputs({ ...structuredClone(SITE), publicOrigin: "https://3d.example.invalid" }));
check(moved.files.get("index.html").includes('<meta property="og:url" content="https://3d.example.invalid/">') && moved.files.get(`p/${withPid.id}.html`).includes(`<link rel="canonical" href="https://3d.example.invalid/p/${withPid.id}">`), "a new publicOrigin reaches index.html and the p/ pages");
const refused = (o) => { try { checkSite({ ...structuredClone(SITE), storeAppOrigins: [o] }); return false; } catch { return true; } };
check(["*", "https://store.example.invalid/", "https://store.example.invalid/app", "http://store.example.invalid", "store.example.invalid"].every(refused), "site-config.js refuses *, paths, trailing slashes, plain http and bare host names");

// ── servers: today's config, the test config, and the stand-in store app ──
fs.writeFileSync(`${out}/site-config.js`, `export const SITE = ${JSON.stringify(TEST_SITE, null, 2)};\n`);
fs.writeFileSync(`${out}/host/parent.html`, `<!doctype html>
<meta charset="utf-8"><title>store app stand-in</title>
<style>body { margin: 0; } iframe { border: 0; display: block; width: 100%; } #site { height: 640px; } #other { height: 40px; }</style>
<iframe id="site" allow="xr-spatial-tracking; camera; fullscreen"></iframe>
<iframe id="other" src="other.html"></iframe>
<script>
  var src = new URLSearchParams(location.search).get("src"), site = document.getElementById("site");
  window.got = [];
  addEventListener("message", function (e) { got.push({ origin: e.origin, type: e.data && e.data.type, fromSite: e.source === site.contentWindow }); });
  window.send = function (m) { site.contentWindow.postMessage(m, new URL(src).origin); };
  site.src = src;
</script>
`);
fs.writeFileSync(`${out}/host/other.html`, `<!doctype html><meta charset="utf-8"><title>another frame</title><p>another frame on the store app's page</p>\n`);
const servers = [
  spawn("node", [`${ROOT}/pipeline/scripts/serve.mjs`, ROOT, String(BASE)], { stdio: "ignore" }),
  spawn("node", [`${ROOT}/pipeline/scripts/serve.mjs`, ROOT, String(BASE + 1)], { stdio: "ignore", env: { ...process.env, SITE_CONFIG: path.resolve(`${out}/site-config.js`) } }),
  spawn("node", [`${ROOT}/pipeline/scripts/serve.mjs`, ROOT, String(BASE + 2), path.resolve(`${out}/host`)], { stdio: "ignore" }),
];
process.on("exit", () => servers.forEach((s) => s.kill()));
for (const u of [REAL, ON, APP]) for (let t = 0; t < 50; t++) { try { if ((await fetch(`${u}/site-config.js`)).ok) break; } catch {} await sleep(200); }

console.log("\n[the old paths]");
const get = async (u) => { const r = await fetch(u); return { status: r.status, text: await r.text() }; };
const idPage = await get(`${REAL}/id/${PID}`), embedPage = await get(`${REAL}/embed/discovery`);
check(idPage.status === 200 && idPage.text.includes(`"/p/${withPid.id}"`), `/id/${PID} is a page that opens /p/${withPid.id}`);
check(embedPage.status === 200 && embedPage.text.includes('"/?embed"'), "/embed/discovery is a page that opens /?embed");
for (const p of [`/ar-experience/${U1}`, "/id/1", "/embed/discovery/category/x"]) {
  const r = await get(`${REAL}${p}`);
  check(r.status === 200 && r.text.includes('id="oldLink"'), `${p} (no page of its own): the catalogue, not a 404`);
}

const b = await launch({ profile: `${out}/prof`, port: BASE + 9 });
const contexts = [];
b.on("Runtime.executionContextCreated", (p) => contexts.push(p.context));
b.on("Runtime.executionContextDestroyed", (p) => { const i = contexts.findIndex((c) => c.id === p.executionContextId); if (i >= 0) contexts.splice(i, 1); });
b.on("Runtime.executionContextsCleared", () => { contexts.length = 0; });
const page = async (expr, ms = 15000) => { for (let t = 0; t < ms; t += 250) { const v = await b.evalJS(expr); if (v && !v.__error) return v; await sleep(250); } return b.evalJS(expr); };
await b.viewport(900, 800, false);

for (const [from, to, embed, note] of [
  [`/id/${PID}?embed&source=qr`, `/p/${withPid.id}?embed&source=qr`, true, false],
  ["/embed/discovery?source=app", "/?embed&source=app", true, false],
  [`/ar-experience/${U1}?source=qr`, `/ar-experience/${U1}?source=qr`, false, true],
  [`/id/1`, `/id/1`, false, true],
]) {
  await b.go(`${REAL}${from}`);
  const loaded = to.startsWith("/p/") ? `document.documentElement.classList.contains("embed")` : `document.querySelectorAll("#grid .card").length > 0`;
  const at = await page(`location.pathname + location.search === ${JSON.stringify(to)} && ${loaded} && location.pathname + location.search`);
  const r = JSON.parse(await b.evalJS(`JSON.stringify({ embed: document.documentElement.classList.contains("embed"), note: !!document.getElementById("oldLink") && !document.getElementById("oldLink").hidden, header: getComputedStyle(document.querySelector("header")).display })`));
  check(at === to, `${from} → ${at || (await b.evalJS("location.pathname + location.search"))}`);
  if (!to.startsWith("/p/")) {
    check(r.embed === embed && (r.header === "none") === embed, `  ${embed ? "embed layout: no header or welcome" : "the full catalogue"}`);
    check(r.note === note, `  ${note ? "with the note that the product wasn't found" : "no note"}`);
  } else check(r.embed, "  the product page in embed mode, as the query string asked");
}
await b.shot(`${out}/old-link-note.png`);

// ── inside a frame: helpers to reach the site's frame and the other frame ──
async function frame(origin) {
  for (let t = 0; t < 60; t++) {
    const tree = (await b.send("Page.getFrameTree")).result.frameTree;
    const f = (tree.childFrames || []).map((c) => c.frame).find((x) => x.url.startsWith(origin));
    const ctx = f && contexts.filter((c) => c.auxData?.frameId === f.id && c.auxData?.isDefault).pop();
    if (ctx) return { frame: f, ctx: ctx.id };
    await sleep(250);
  }
  return null;
}
async function inFrame(origin, expr) {
  const f = await frame(origin);
  if (!f) return { __error: `no frame on ${origin}` };
  const r = await b.send("Runtime.evaluate", { expression: expr, contextId: f.ctx, returnByValue: true, awaitPromise: true });
  return r.result?.exceptionDetails ? { __error: r.result.exceptionDetails.exception?.description } : r.result?.result?.value;
}
async function listeners(origin, type) {
  const f = await frame(origin);
  const w = await b.send("Runtime.evaluate", { expression: "window", contextId: f.ctx });
  const r = await b.send("DOMDebugger.getEventListeners", { objectId: w.result.result.objectId });
  return r.result?.listeners ? r.result.listeners.filter((l) => l.type === type).length : -1; // -1: Chrome didn't say
}
const got = async () => (await b.evalJS("JSON.stringify(window.got || [])").then(JSON.parse));
const count = async (type) => (await got()).filter((m) => m.type === type).length;
const until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 200) { if (await fn()) return true; await sleep(200); } return false; };
const catalogueIn = (origin) => until(async () => (await inFrame(origin, "document.querySelectorAll('#grid .card').length")) > 0, 20000);
const send = (m) => b.evalJS(`send(${JSON.stringify(m)})`);
const state = (origin) => inFrame(origin, "window.storeApp ? JSON.stringify({ signedIn: storeApp.signedIn, name: storeApp.unverifiedName }) : 'none'");

console.log("\n[the bridge with today's empty config]");
await b.go(`${APP}/__test/parent.html?src=${encodeURIComponent(`${REAL}/embed/discovery`)}`);
check(await catalogueIn(REAL), "the catalogue loads in the frame");
await sleep(2500);
check((await got()).length === 0, "nothing is posted to the parent");
check(await inFrame(REAL, "window.storeApp === undefined"), "no window.storeApp");
check(await listeners(REAL, "message") === 0, "no message listener on the page");
await send({ type: "SC_TOKEN", payload: { token: sign(staff()) } });
await sleep(800);
check(await inFrame(REAL, "window.storeApp === undefined") && (await got()).length === 0, "a token from the parent changes nothing");
await b.go(`${APP}/__test/parent.html?src=${encodeURIComponent(`${REAL}/p/${withPid.id}`)}`);
check(await until(async () => (await inFrame(REAL, "document.readyState")) === "complete", 20000), "a product page loads in the frame");
await sleep(2500);
check((await got()).length === 0 && await inFrame(REAL, "window.storeApp === undefined"), "the product page is silent too");

console.log("\n[switched on: the frame's parent on an address that isn't allowed]");
await b.go(`${OTHER}/__test/parent.html?src=${encodeURIComponent(`${ON}/embed/discovery`)}`);
check(await catalogueIn(ON), "the catalogue loads in the frame");
await sleep(2500);
check(await count("SC_EMBED_READY") === 0, "SC_EMBED_READY is not posted to it (the bridge never posts to \"*\")");
await send({ type: "SC_TOKEN", payload: { token: sign(staff()) } });
await sleep(800);
check(JSON.parse(await state(ON)).signedIn === false, "a token from that address is ignored");

console.log("\n[switched on: framed by the store app stand-in]");
await b.go(`${APP}/__test/parent.html?src=${encodeURIComponent(`${ON}/embed/discovery`)}`);
check(await catalogueIn(ON), "/embed/discovery opens the catalogue in the frame");
check(await until(async () => (await count("SC_EMBED_READY")) === 1), "SC_EMBED_READY reaches the parent");
const ready = (await got()).find((m) => m.type === "SC_EMBED_READY");
check(ready?.origin === ON && ready?.fromSite, `  from the site's frame (${ready?.origin}), to the parent's exact address`);
check(await listeners(ON, "message") === 1, "  one message listener (so the empty-config check above can see one)");
check(JSON.parse(await state(ON)).signedIn === false, "not signed in before a token arrives");
await inFrame(ON, "window.__changes = 0; addEventListener('storeappchange', () => window.__changes++); 1");

const T = sign(staff());
const sib = await frame(`${APP}/__test/other.html`); // the other frame is on the parent's own (allowed) address
await b.send("Runtime.evaluate", { expression: `parent.frames[0].postMessage(${JSON.stringify({ type: "SC_TOKEN", payload: { token: sign(staff({ name: "Sibling" })) } })}, "*")`, contextId: sib.ctx });
await sleep(800);
check(JSON.parse(await state(ON)).signedIn === false, "a token from another frame on the app's own address is ignored (only the parent counts)");

await send({ type: "SC_TOKEN", payload: { token: T } });
await until(async () => JSON.parse(await state(ON)).signedIn);
const s1 = JSON.parse(await state(ON));
check(s1.signedIn && s1.name === "Test Staff", `a token from the parent is taken: signedIn, unverifiedName "${s1.name}"`);
check(await inFrame(ON, "window.__changes") === 1, "  the page hears storeappchange");
check(await inFrame(ON, "storeApp.signedIn = false; window.storeApp = null; window.storeApp.signedIn === true"), "  window.storeApp is read-only");
check(await inFrame(ON, `JSON.stringify(Object.getOwnPropertyNames(storeApp))`) === '["signedIn","unverifiedName"]', "  and shows only signedIn and unverifiedName");
const sig = T.split(".")[2];
const where = await inFrame(ON, `(async () => JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage), cookie: document.cookie, href: location.href, name: window.name, idb: indexedDB.databases ? await indexedDB.databases() : [], app: JSON.stringify(storeApp) }))()`);
check(typeof where === "string" && !where.includes(sig) && !where.includes(T.split(".")[1]), "the token is in no storage, cookie, address, window.name or window.storeApp");

await send({ type: "SC_LOGOUT" });
await until(async () => !JSON.parse(await state(ON)).signedIn);
const s2 = JSON.parse(await state(ON));
check(!s2.signedIn && s2.name === "", "SC_LOGOUT clears it");
check(await until(async () => (await count("SC_EMBED_READY")) === 2), "  and the page tells the app it is ready again (SC_EMBED_READY)");

await send({ type: "SC_TOKEN", payload: { token: sign(staff({ exp: now() - 60 })) } });
check(await until(async () => (await count("SC_TOKEN_EXPIRED")) === 1), "a token that has already run out brings SC_TOKEN_EXPIRED");
check(JSON.parse(await state(ON)).signedIn === false, "  and isn't taken");
await send({ type: "SC_TOKEN", payload: { token: sign(staff({ exp: now() + 3 })) } });
await until(async () => JSON.parse(await state(ON)).signedIn);
check(JSON.parse(await state(ON)).signedIn, "a token with 3 seconds left is taken");
check(await until(async () => (await count("SC_TOKEN_EXPIRED")) === 2, 8000), "  and SC_TOKEN_EXPIRED is posted when it runs out");
check(JSON.parse(await state(ON)).signedIn === false, "  signed out from then on");
await send({ type: "SC_TOKEN", payload: { token: "not-a-token" } });
await sleep(500);
check(JSON.parse(await state(ON)).signedIn === false, "something that isn't a token doesn't sign in");
check((await got()).every((m) => m.origin === ON && m.fromSite), "every message the parent got came from the site's frame");

console.log("\n[switched on: a product opened inside the frame]");
await send({ type: "SC_TOKEN", payload: { token: T } });
await until(async () => JSON.parse(await state(ON)).signedIn);
const readyBefore = await count("SC_EMBED_READY");
await inFrame(ON, `location.href = "/p/${withPid.id}"; 1`);
check(await until(async () => (await count("SC_EMBED_READY")) === readyBefore + 1, 20000), "the product page asks for the sign-in again (SC_EMBED_READY)");
check(JSON.parse(await state(ON)).signedIn === false, "  it starts signed out: the token was kept in the last page's memory only");
await send({ type: "SC_TOKEN", payload: { token: T } });
check(await until(async () => JSON.parse(await state(ON)).signedIn), "  and takes the token the app sends back");
const where2 = await inFrame(ON, `JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage), cookie: document.cookie, href: location.href })`);
check(typeof where2 === "string" && !where2.includes(sig), "  the token is in no storage there either");
await sleep(1500);
await b.shot(`${out}/framed-product.png`);
const said = b.logs.filter((l) => l.includes(sig) || l.includes(T.split(".")[1]));
check(said.length === 0, "the token never reached the console");
const errs = b.logs.filter((l) => /EXCEPTION|Uncaught/.test(l));
check(errs.length === 0, errs.length ? `errors: ${errs.slice(0, 2).join(" | ")}` : "no page errors");

b.close();
console.log(`\n${passed} passed, ${failed} failed checks`);
process.exit(failed ? 1 : 0);
