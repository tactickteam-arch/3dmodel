// Usage counts for the 3D Catalogue Admin (/admin): which products are opened, and what people do with them.
// s3dTrack(kind, product, detail) sends one event to the s3d_track function in Supabase and forgets it: it
// never throws, never waits and never writes to the console.
//   kinds: CATALOGUE, VIEW, AR (detail: ios, android, quest or visionos), PART (detail: the part's key), FILL,
//          FIT, FEATURE, ROOM, HEADSET, EMBED
// Each event carries a random id for this browser tab (sessionStorage), a coarse platform, and the shop
// device's id if this browser was paired to a store. No personal data, no cookies, nothing about the IP.
// Off on localhost, 127.0.0.1 and file: (tests, other agents' gates) unless the address has ?track=1.
// /?pair=<CODE> on any page links this browser to a store's device (s3d_pair), then drops the code
// from the address. The anon key below is public by design; the database only lets it call these functions.
// On a paired device it also loads /device.js, which opens what staff send it from the admin's Devices page.
// A showcase's product pages (/kiosk plays them in a frame, with ?kiosk=1) count nothing: a screen that turns
// products over for hours isn't people looking at them.
(() => {
  const API = "https://rjbjlkickdnpsaicynap.supabase.co/rest/v1/rpc/";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqYmpsa2lja2RucHNhaWN5bmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzAxODYsImV4cCI6MjA4OTkwNjE4Nn0.KPwMXyfKSzKoxn5V1jhb4xKA-1uAlIEJgBOSf6P4Udk";
  const KINDS = ["CATALOGUE", "VIEW", "AR", "PART", "FILL", "FIT", "FEATURE", "ROOM", "HEADSET", "EMBED"];

  // storage can be missing or throw (private windows, sandboxed frames): then it just isn't kept
  const box = (name) => { try { return window[name]; } catch { return null; } };
  const get = (s, k) => { try { return s ? s.getItem(k) : null; } catch { return null; } };
  const put = (s, k, v) => { try { if (s) s.setItem(k, v); } catch {} };
  const tab = box("sessionStorage"), keep = box("localStorage");

  let params;
  try { params = new URLSearchParams(location.search); } catch { params = new URLSearchParams(); }
  // false until pipeline/admin/schema.sql has been run in Supabase: until then the live site sends nothing at all
  const READY = false;
  const local = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (params.get("track") === "1") put(tab, "s3d-track", "1"); // stays on for this tab while testing locally
  const kioskFrame = params.get("kiosk") === "1" && window.self !== window.top;
  const on = !kioskFrame && ((READY && !local) || params.get("track") === "1" || get(tab, "s3d-track") === "1");

  const ua = navigator.userAgent || "";
  const platform = /OculusBrowser|Quest|Pico|Wolvic/i.test(ua) ? "quest"
    : /Android/i.test(ua) ? "android"
    : /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios"
    : /Windows|Macintosh|Linux|CrOS/.test(ua) ? "desktop"
    : "other";

  function session() {
    let id = get(tab, "s3d-session");
    if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""));
      put(tab, "s3d-session", id);
    }
    return id;
  }
  const device = () => { const d = get(keep, "s3d-device"); return d && /^[0-9a-f-]{36}$/i.test(d) ? d : null; };

  function call(name, body, keepalive) {
    const init = {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit",
      keepalive,
    };
    // a browser that can't send a keepalive request with these headers sends it plainly instead
    return fetch(API + name, init).catch(() => (keepalive ? fetch(API + name, { ...init, keepalive: false }) : Promise.reject(new Error("offline"))));
  }

  window.s3dTrack = function s3dTrack(kind, product, detail) {
    try {
      const k = String(kind || "").toUpperCase();
      if (!on || !KINDS.includes(k)) return;
      call("s3d_track", {
        p_kind: k,
        p_product: product ? String(product) : null,
        p_detail: detail === undefined || detail === null || detail === "" ? null : String(detail).slice(0, 80),
        p_session: session(),
        p_device: device(),
        p_platform: platform,
      }, true).catch(() => {});
    } catch {}
  };

  // ── a paired device: what staff send it from the admin (/device.js). Never in a frame, never unpaired ──
  function screen() {
    try {
      if (!on || window.self !== window.top || !device() || document.querySelector("script[data-s3d-screen]")) return;
      const s = document.createElement("script");
      s.src = "/device.js";
      s.async = true;
      s.dataset.api = API;
      s.dataset.key = KEY;
      s.dataset.s3dScreen = "";
      document.head.appendChild(s);
    } catch {}
  }

  // ── pairing a shop device: /?pair=<CODE> ──
  const code = params.get("pair");
  if (code === null) screen();   // with a code, once the pairing has worked
  if (code === null || !(READY || on)) return;
  try {
    const u = new URL(location.href);
    u.searchParams.delete("pair");
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  } catch {}
  function note(text, bad) {
    const show = () => {
      const el = document.createElement("div");
      el.setAttribute("role", "status");
      el.textContent = text;
      el.style.cssText = "position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000;" +
        "max-width:min(460px,calc(100vw - 32px));padding:12px 16px;border-radius:12px;background:#0E0E0F;color:#fff;" +
        `border-left:4px solid ${bad ? "#E5484D" : "#F58A29"};font:500 15px/1.4 Outfit,-apple-system,Arial,sans-serif;` +
        "box-shadow:0 12px 36px rgba(0,0,0,.28);cursor:pointer";
      el.addEventListener("click", () => el.remove());
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 7000);
    };
    if (document.body) show(); else addEventListener("DOMContentLoaded", show, { once: true });
  }
  call("s3d_pair", { p_code: code, p_platform: platform }, false)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j && j.ok && j.device) {
        put(keep, "s3d-device", String(j.device));
        put(keep, "s3d-store", String(j.store || ""));
        note(`This device is now linked to ${j.store || "its store"}.`);
        screen();
      } else if (j && j.error === "already_paired") note("This pairing link has already been used. Ask your admin for a new one.", true);
      else note("This pairing link didn’t work. Ask your admin for a new one.", true);
    })
    .catch(() => note("Couldn’t link this device: no connection. Open the pairing link again.", true));
})();
