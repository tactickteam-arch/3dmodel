// The store app bridge. Sangeetha's store app shows our pages in a frame and hands them the signed-in staff
// member with four messages. The messages belong to their app; this file only answers them:
//   page → app   { type: "SC_EMBED_READY" }     the page has loaded and is ready for a sign-in
//                { type: "SC_TOKEN_EXPIRED" }   the sign-in it was given has run out (the app answers with a new SC_TOKEN)
//   app → page   { type: "SC_TOKEN", payload: { token: "<signed JWT>" } }
//                { type: "SC_LOGOUT" }          the staff member signed out
// It does nothing at all until site-config.js lists the app's addresses in storeAppOrigins, and nothing on a page
// that isn't in a frame. It posts only to the app's exact address, never "*", and reads only messages from those
// addresses that the window framing us sent.
// The token stays in this file's memory: never in storage, cookies, the address or the console, and it is gone
// when the page closes, so each page in the frame asks again with SC_EMBED_READY. Nothing here checks its
// signature, so nothing on the page may treat it as proof of who is signed in. Only the server check
// (pipeline/integration/check-token.mjs) can, and nothing sends the token there yet.
// For later use, window.storeApp has signedIn (a hint, not proof) and unverifiedName (for a greeting only; show
// it with textContent). window hears "storeappchange" when either changes.
// Loaded by index.html and product.html; tested by pipeline/scripts/test_store_bridge.mjs.
import { SITE } from "/site-config.js";

const originOf = (u) => { try { return new URL(u).origin; } catch { return ""; } };
const APP = (SITE.storeAppOrigins || []).filter((o) => typeof o === "string" && originOf(o) === o);
const MAX_TOKEN = 8192;  // a sign-in token is a few hundred characters; anything far longer isn't one
const RETRY_MS = 10000;  // a token that arrives already run out is asked again at most this often, so it can't loop

if (APP.length && window.parent !== window) start();

function start() {
  let token = null, exp = 0, name = "", timer = 0, lastRetry = -Infinity;

  // The app's exact address. Chrome, Safari and the web views inside phone apps say which site framed us. Other
  // browsers give only the page that opened the frame, which is our own page once the frame moves on. With one
  // address configured, that one: the browser drops the message if the frame's parent is another site.
  function target() {
    const seen = location.ancestorOrigins?.[0];
    if (seen && seen !== "null") return APP.includes(seen) ? seen : null;
    const ref = originOf(document.referrer);
    return APP.includes(ref) ? ref : APP.length === 1 ? APP[0] : null;
  }
  const post = (type) => { const to = target(); if (to) window.parent.postMessage({ type }, to); };
  const changed = () => window.dispatchEvent(new Event("storeappchange"));
  const live = () => token !== null && Date.now() < exp;

  // the token's own claims, read but not checked: only its expiry and the name are used
  function claims(t) {
    try {
      const b = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(b + "===".slice((b.length + 3) % 4));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    } catch { return null; }
  }

  function forget() {
    const had = token !== null;
    token = null; exp = 0; name = "";
    clearTimeout(timer);
    if (had) changed();
  }

  // a sign-in from the app: kept until its expiry, then the app is asked for a new one
  function take(t) {
    const c = t.length <= MAX_TOKEN && t.split(".").length === 3 ? claims(t) : null;
    const left = c && Number.isFinite(c.exp) ? c.exp * 1000 - Date.now() : 0;
    if (left <= 0) { // unreadable, or already run out
      forget();
      if (Date.now() - lastRetry >= RETRY_MS) { lastRetry = Date.now(); post("SC_TOKEN_EXPIRED"); }
      return;
    }
    token = t; exp = c.exp * 1000;
    name = typeof c.name === "string" ? c.name.trim().slice(0, 80) : "";
    wait();
    changed();
  }
  // setTimeout can't wait longer than about 24 days, so a longer token is checked again then
  function wait() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (Date.now() < exp) return wait();
      forget();
      post("SC_TOKEN_EXPIRED");
    }, Math.min(exp - Date.now(), 2 ** 31 - 1));
  }

  addEventListener("message", (e) => {
    if (e.source !== window.parent || !APP.includes(e.origin)) return;
    const m = e.data;
    if (!m || typeof m !== "object") return;
    if (m.type === "SC_TOKEN" && typeof m.payload?.token === "string") take(m.payload.token);
    else if (m.type === "SC_LOGOUT") { forget(); post("SC_EMBED_READY"); } // as their app expects: ready for the next sign-in
  });

  Object.defineProperty(window, "storeApp", {
    enumerable: true,
    value: Object.freeze({
      get signedIn() { return live(); },
      get unverifiedName() { return live() ? name : ""; },
    }),
  });
  post("SC_EMBED_READY");
}
