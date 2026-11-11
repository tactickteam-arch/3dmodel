// A store's paired device (a TV, tablet, phone or headset) takes what staff send it from the admin's Devices page:
// a product (in a colour), a playlist, or "back to the catalogue". track.js loads this file only on a browser that
// was paired to a store, only in the top window, and only when tracking is on: on every other browser it never
// loads, so nothing is asked. Like track.js it never throws and never writes to the console.
// Every 4 s, while the page is in view, it asks s3d_device_poll (pipeline/admin/tools.sql) with the device's key,
// the last command it acted on (which tells the admin "Opened") and what this page shows; the answer is the newest
// command. Each command is acted on once: its id is kept in localStorage. A page can't start the room view (AR, or
// a headset's own view) by itself, so after a product opens, a phone, tablet or headset shows a big
// "Tap to view in your room" button.
(() => {
  try {
    const me = document.currentScript;
    const API = me && me.dataset.api, KEY = me && me.dataset.key;
    if (!API || !KEY || window.self !== window.top || window.__s3dScreen) return;
    window.__s3dScreen = true;

    const box = (name) => { try { return window[name]; } catch { return null; } };
    const get = (s, k) => { try { return s ? s.getItem(k) : null; } catch { return null; } };
    const put = (s, k, v) => { try { if (s) s.setItem(k, v); } catch {} };
    const drop = (s, k) => { try { if (s) s.removeItem(k); } catch {} };
    const keep = box("localStorage"), tab = box("sessionStorage");
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ID = /^[a-z0-9][a-z0-9-]{0,79}$/, SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/, NUM = /^[0-9]{1,18}$/;
    const DONE = "s3d-screen-done", TAP = "s3d-screen-tap";
    const EVERY = 4000, SLOWEST = 60000;
    const device = () => { const d = get(keep, "s3d-device"); return d && UUID.test(d) ? d : null; };

    // what this page shows, in the words s3d_device_poll keeps
    function showing() {
      const path = location.pathname.replace(/\/+$/, "") || "/";
      const q = new URLSearchParams(location.search);
      let m = /^\/p\/([^/]+)$/.exec(path);
      const pid = m ? decodeURIComponent(m[1]).toLowerCase() : /^\/product(\.html)?$/.test(path) ? (q.get("id") || "").toLowerCase() : null;
      if (pid !== null) return ID.test(pid) ? `product:${pid}` : "other";
      if (/^\/kiosk(\.html)?$/.test(path)) return NUM.test(q.get("list") || "") ? `playlist:${q.get("list")}` : "kiosk";
      if (path === "/" || /^\/index(\.html)?$/.test(path)) return "catalogue";
      if (/^\/showroom(\.html)?(\/|$)/.test(path)) return "showroom";
      if (/^\/compare(\.html)?(\/|$)/.test(path)) return "compare";
      return "other";
    }

    // ── the big "Tap to view in your room" button, on the product page a command opened ──
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    async function offer(id) {
      // the product page sets window.__demo once the product is on the page (a missing product never does)
      for (let t = 0; t < 600 && !(window.__demo && window.__demo.product); t++) { if (document.querySelector(".missing")) return; await sleep(100); }
      const d = window.__demo;
      if (!d || !d.product || d.product.id !== id || !d.caps || d.caps.platform === "desktop" || document.getElementById("s3dTap")) return;
      const btnAR = document.getElementById("btnAR");
      if (!btnAR) return;
      const wrap = document.createElement("div");
      wrap.id = "s3dTap";
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.setAttribute("aria-labelledby", "s3dTapGo");
      wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:rgba(14,14,15,.86);" +
        "-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);" +
        "font:500 16px/1.4 Outfit,-apple-system,Arial,sans-serif;color:#fff;text-align:center";
      const card = document.createElement("div");
      card.style.cssText = "display:grid;gap:16px;justify-items:center;width:min(520px,100%)";
      const name = document.createElement("p");
      name.style.cssText = "margin:0;font-size:18px;opacity:.9";
      name.textContent = `${d.product.brand || ""} ${d.product.shortName || d.product.name || ""}`.trim();
      const go = document.createElement("button");
      go.id = "s3dTapGo";
      go.type = "button";
      go.textContent = "Tap to view in your room";
      go.style.cssText = "width:100%;min-height:96px;padding:20px 28px;border:0;border-radius:22px;background:#F58A29;color:#0E0E0F;" +
        "font:700 26px/1.2 Outfit,-apple-system,Arial,sans-serif;cursor:pointer;box-shadow:0 18px 50px rgba(0,0,0,.4)";
      const later = document.createElement("button");
      later.type = "button";
      later.textContent = "Not now: just look in 3D";
      later.style.cssText = "min-height:48px;padding:10px 20px;border:1px solid rgba(255,255,255,.4);border-radius:14px;background:transparent;color:#fff;" +
        "font:500 16px/1.2 Outfit,-apple-system,Arial,sans-serif;cursor:pointer";
      card.append(name, go, later);
      wrap.append(card);
      const close = () => { wrap.remove(); removeEventListener("keydown", esc); };
      const esc = (e) => { if (e.key === "Escape") close(); };
      // the tap itself starts the room view, as if the page's own "View in your room" button were pressed
      go.addEventListener("click", () => { close(); btnAR.click(); });
      later.addEventListener("click", close);
      wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
      addEventListener("keydown", esc);
      document.body.appendChild(wrap);
      try { go.focus({ preventScroll: true }); } catch {}
    }

    // ── a command: open what it says, once ──
    function act(r) {
      let to = null;
      if (r.kind === "product" && ID.test(r.product || "")) to = `/p/${r.product}${r.finish && SLUG.test(r.finish) ? `?finish=${r.finish}` : ""}`;
      else if (r.kind === "playlist" && NUM.test(String(r.playlist ?? ""))) to = `/kiosk?list=${r.playlist}`;
      else if (r.kind === "home") to = "/";
      // kept first, and read back: a browser that can't keep it would open the same thing over and over
      put(keep, DONE, r.cmd);
      if (get(keep, DONE) !== r.cmd || !to) return false;
      if (r.kind === "product") put(tab, TAP, r.product);
      const here = location.pathname.replace(/\/+$/, "") + location.search;
      if (here === to || (to === "/" && here === "")) { if (r.kind === "product") { drop(tab, TAP); offer(r.product); } return false; }
      location.assign(to);
      return true;
    }

    let wait = EVERY, timer = 0, busy = false, stopped = false;
    async function poll() {
      timer = 0;
      if (stopped || busy) return;
      if (document.visibilityState === "hidden") return;   // asked again as soon as the page is in view
      const key = device();
      if (!key) { stopped = true; return; }
      busy = true;
      let leaving = false;
      try {
        const stop = new AbortController();
        const cut = setTimeout(() => stop.abort(), 10000);
        const done = get(keep, DONE);
        let r;
        try {
          r = await fetch(API + "s3d_device_poll", {
            method: "POST",
            headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ p_device: key, p_ack: done && UUID.test(done) ? done : null, p_showing: showing() }),
            credentials: "omit",
            signal: stop.signal,
          });
        } finally { clearTimeout(cut); }
        if (!r.ok) throw new Error(String(r.status));
        let j = null;
        try { const text = await r.text(); j = text ? JSON.parse(text) : null; } catch {}
        wait = EVERY;
        if (j && j.ok === false) { stopped = true; return; }   // the device was deleted, or given a new pairing code
        if (j && j.ok && j.cmd && UUID.test(String(j.cmd)) && j.cmd !== get(keep, DONE)) leaving = act(j);
      } catch {
        wait = Math.min(SLOWEST, wait * 2);   // offline or Supabase busy: ask less often until it answers
      } finally {
        busy = false;
        if (!stopped && !leaving) timer = setTimeout(poll, wait);
      }
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !stopped && !busy) { clearTimeout(timer); poll(); }
    });

    // the product page a command just opened: offer the room view
    const asked = get(tab, TAP);
    if (asked) {
      drop(tab, TAP);
      const now = showing();
      if (now === `product:${asked}`) offer(asked);
    }
    poll();
  } catch {}
})();
