// Demo mode (/admin?demo=1): the same pages, from made-up sample data kept in memory, so the admin can be
// shown before the database exists. Nothing here is real and nothing is saved. Only the product list is
// real: it is the catalogue's own /products.json. ?demo=1&as=manager or &as=viewer shows the other roles.
import { istDay, istStart, addDays } from "./ui.js";

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KINDS = ["CATALOGUE", "VIEW", "AR", "PART", "FILL", "FIT", "FEATURE", "ROOM", "HEADSET", "EMBED"];
const H = 3600e3, D = 24 * H;

export async function createDemoApi({ as } = {}) {
  const catalogue = (await fetch("/products.json", { cache: "no-store" }).then((r) => r.json())).products;
  // the Testing pages' sample: the last three products on show stand in for new ones waiting for review
  const WAITING = catalogue.filter((p) => !p.hidden).slice(-3).map((p) => p.id);
  const products = catalogue.filter((p) => !p.hidden && !WAITING.includes(p.id));
  const r = rng(20261104);
  const now = Date.now();
  const iso = (t) => new Date(t).toISOString();
  const code = () => Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(r() * 32)]).join("");
  const role = ["admin", "manager", "viewer"].includes(as) ? as : "admin";

  let nextId = 100;
  const stores = [
    { id: 1, name: "Sample store 1", code: "S-01", city: "Bengaluru", address: "Sample address 1" },
    { id: 2, name: "Sample store 2", code: "S-02", city: "Chennai", address: "Sample address 2" },
    { id: 3, name: "Sample store 3", code: "S-03", city: "Hyderabad", address: "Sample address 3" },
    { id: 4, name: "Sample store 4", code: "S-04", city: "Mysuru", address: "" },
  ].map((s, i) => ({ ...s, created_at: iso(now - (80 - i * 6) * D), updated_at: iso(now - (40 - i * 3) * D) }));
  const me = { user_id: "demo-me", email: `demo.${role}@example.com`, full_name: `Demo ${role[0].toUpperCase()}${role.slice(1)}`, role, store_id: role === "admin" ? null : 1, status: "active", password_set: true, last_login_at: iso(now - 0.2 * H), approved_at: iso(now - 85 * D), created_at: iso(now - 85 * D) };
  const users = [
    me,
    { user_id: "demo-2", email: "sample.manager1@example.com", full_name: "Sample Manager 1", role: "manager", store_id: 1, status: "active", password_set: true, last_login_at: iso(now - 3 * H), created_at: iso(now - 70 * D) },
    { user_id: "demo-3", email: "sample.manager2@example.com", full_name: "Sample Manager 2", role: "manager", store_id: 3, status: "active", password_set: true, last_login_at: iso(now - 4 * D), created_at: iso(now - 60 * D) },
    { user_id: "demo-4", email: "sample.viewer1@example.com", full_name: "Sample Viewer 1", role: "viewer", store_id: 2, status: "active", password_set: true, last_login_at: iso(now - 12 * D), created_at: iso(now - 50 * D) },
    { user_id: "demo-5", email: "sample.viewer2@example.com", full_name: "Sample Viewer 2", role: "viewer", store_id: 4, status: "active", password_set: false, last_login_at: iso(now - 1 * H), created_at: iso(now - 1 * D) },
    { user_id: "demo-6", email: "sample.newcomer@example.com", full_name: null, role: "viewer", store_id: null, status: "pending", password_set: true, last_login_at: iso(now - 26 * H), created_at: iso(now - 26 * H) },
    { user_id: "demo-7", email: "sample.former@example.com", full_name: "Sample Former Staff", role: "viewer", store_id: 2, status: "inactive", password_set: true, last_login_at: iso(now - 62 * D), created_at: iso(now - 75 * D) },
  ];
  const PLAT = ["android", "ios", "desktop", "quest"];
  const devices = [
    ["Demo tablet 1", 1, true, "android"], ["Demo tablet 2", 1, true, "ios"], ["Demo phone 1", 2, true, "android"],
    ["Demo headset 1", 3, true, "quest"], ["Demo tablet 3", 3, false], ["Demo kiosk 1", 4, false],
  ].map(([name, store_id, paired, platform], i) => ({
    id: i + 1, name, store_id, notes: "", pair_code: code(),
    paired_at: paired ? iso(now - (50 - i * 5) * D) : null, platform: paired ? platform : null,
    last_seen_at: paired ? iso(now - (i + 1) * 2.3 * H) : null, created_at: iso(now - (55 - i * 5) * D), updated_at: iso(now - (20 - i) * D),
  }));
  const invites = [{ id: 1, email: "sample.invitee@example.com", role: "viewer", store_id: 2, created_at: iso(now - 2 * D) }];

  // ── made-up usage: views per product per day for 90 days, split by store and platform with fixed shares ──
  const pop = products.map((p, i) => ({ id: p.id, fridge: p.category === "Refrigerator", base: 34 / (1 + i * 0.45) }));
  const storeShare = { 0: 0.34, 1: 0.24, 2: 0.18, 3: 0.15, 4: 0.09 };          // 0: no store (shoppers at home)
  const platShare = { android: 0.47, ios: 0.30, desktop: 0.18, quest: 0.03, other: 0.02 };
  const arShare = { android: 0.42, ios: 0.47, desktop: 0, quest: 0.85, other: 0.1 };
  const per = { PART: 1.7, FIT: 0.13, FEATURE: 0.58, ROOM: 0.045, EMBED: 0.09 };
  const days = {};
  for (let d = 0; d <= 92; d++) {
    const day = istDay(now - d * D);
    const wd = istStart(day).getUTCDay();
    const f = (wd === 0 || wd === 6 ? 1.45 : 1) * (0.55 + 0.45 * (1 - d / 92)) * (d === 0 ? 0.6 : 1);
    days[day] = Object.fromEntries(pop.map((p) => [p.id, Math.max(0, p.base * f * (0.7 + r() * 0.6))]));
  }
  const hourShare = Array.from({ length: 24 }, (_, h) => (h >= 10 && h <= 21 ? 1 + Math.sin(((h - 10) / 11) * Math.PI) : 0.12));
  const hourSum = hourShare.reduce((a, b) => a + b, 0);

  // ── made-up audit log ──
  const audit = [];
  const log = (t, action, actor, target_type, target_label, detail = {}) => audit.push({ id: audit.length + 1, at: iso(t), actor: actor?.user_id || null, actor_email: actor?.email || target_label, action, target_type, target_id: null, target_label, detail });
  for (const s of stores) log(new Date(s.created_at).getTime(), "store_created", me, "store", s.name, { city: s.city });
  for (const d of devices) { log(new Date(d.created_at).getTime(), "device_created", me, "device", d.name, { store_id: d.store_id }); if (d.paired_at) log(new Date(d.paired_at).getTime(), "device_paired", null, "device", d.name, { platform: d.platform }); }
  for (const u of users.slice(1)) log(new Date(u.created_at).getTime() - H, "user_invited", me, "invite", u.email, { role: u.role });
  log(now - 26 * H, "profile_created", users[5], "user", users[5].email, { status: "pending" });
  log(now - 61 * D, "user_deactivated", me, "user", users[6].email, { from: "active", to: "inactive" });
  log(now - 30 * D, "role_changed", me, "user", users[2].email, { from: "viewer", to: "manager" });
  log(now - 20 * D, "store_updated", users[1], "store", "Sample store 1", { city: { from: "Bangalore", to: "Bengaluru" } });
  log(now - 9 * D, "device_reset", users[1], "device", "Demo tablet 3", {});
  log(now - 1 * D + 2 * H, "password_set", users[4], "user", users[4].email, {});
  for (let d = 90; d >= 0; d--) {
    for (const u of users.filter((x) => x.status === "active")) {
      const p = u === me ? 0.95 : u.role === "manager" ? 0.7 : 0.35;
      for (let k = 0; k < 3; k++) if (r() < p / (k + 1)) {
        const t = now - d * D - r() * 10 * H;
        if (t < now) log(t, "login", u, "user", u.email, { status: "active" });
      }
    }
    if (r() < 0.22) { const t = now - d * D - r() * 8 * H; log(t, "login_failed", null, "user", r() < 0.5 ? users[3].email : "unknown.person@example.com"); }
  }

  // ── made-up product reviews (the Testing pages): decisions, feedback and checklist marks, on real product ids ──
  const labelOf = (id) => { const p = catalogue.find((x) => x.id === id); return p ? `${p.brand} ${p.shortName} (${p.model})` : id; };
  const decisions = [], feedback = [], checks = [];
  const latest = (pid) => decisions.filter((d) => d.product_id === pid).at(-1) || null;
  const decide = (t, pid, decision, note, u) => {
    const from = latest(pid)?.decision || null;
    decisions.push({ id: decisions.length + 1, product_id: pid, decision, note: note || null, by: u.email, name: u.full_name, at: iso(t) });
    log(t, `product_${decision}`, u, "product", labelOf(pid), { decision: { from, to: decision }, ...(note ? { note } : {}) });
  };
  const say = (t, pid, u, body, extra = {}) => feedback.push({ id: feedback.length + 1, product_id: pid, body, device: null, finish: null, area: null, photos: [], by: u.email, name: u.full_name, at: iso(t), status: "open", status_by: null, status_at: null, ...extra });
  const mark = (t, pid, u, item, device, result) => checks.push({ product_id: pid, item, device, result, user_id: u.user_id, by: u.email, name: u.full_name, at: iso(t) });
  const photoOf = (pid) => { const p = catalogue.find((x) => x.id === pid); return p.photos?.[1] || p.thumb; };
  const firstColour = (pid) => catalogue.find((x) => x.id === pid).finishes[0].name;
  const [m1, m2, v1] = [users[1], users[2], users[3]];
  const [w1, w2] = WAITING;
  decide(now - 12 * D, products[0].id, "declined", "Sample reason: a door opened the wrong way in AR.", m1);
  decide(now - 11 * D, products[0].id, "approved", "Sample note: fixed, and checked again on iPhone and Android.", m1);
  say(now - 12 * D - 2 * H, products[0].id, v1, "Sample feedback: the door opens the wrong way in AR on Android.", { device: "android", area: "Doors and drawers", status: "fixed", status_by: m1.email, status_at: iso(now - 11 * D) });
  decide(now - 9 * D, products[1].id, "approved", null, me);
  decide(now - 2 * D, products[3].id, "declined", "Sample reason: the colour looks lighter than the model in the shop.", m2);
  say(now - 2 * D - 3 * H, products[3].id, v1, "Sample feedback: the colour looks lighter than the model in the shop.", { device: "iphone", finish: firstColour(products[3].id), area: "Colours", photos: [photoOf(products[3].id)] });
  say(now - 5 * H, w1, v1, "Sample feedback: the handle looks lighter than the one in the shop.", { device: "iphone", finish: firstColour(w1), area: "Colours", photos: [photoOf(w1)] });
  say(now - 3 * H, w1, m1, "Sample feedback: the freezer drawer stopped halfway on Android. It opened on the second try.", { device: "android", area: "Doors and drawers" });
  mark(now - 5 * H, w1, v1, "ar_size", "iphone", "pass"); mark(now - 5 * H, w1, v1, "doors", "iphone", "pass"); mark(now - 5 * H, w1, v1, "colours", "iphone", "fail");
  mark(now - 3 * H, w1, m1, "ar_android", "android", "pass"); mark(now - 3 * H, w1, m1, "doors", "android", "fail");
  mark(now - 2 * H, w1, me, "doors", "computer", "pass"); mark(now - 2 * H, w1, me, "size", "computer", "pass");
  say(now - 30 * H, w2, m2, "Sample feedback: the labels are hard to read in the headset.", { device: "headset", area: "Labels and logos" });
  say(now - 28 * H, w2, v1, "Sample feedback: one shelf seemed to be missing.", { area: "Inside", status: "fixed", status_by: m1.email, status_at: iso(now - 20 * H) });
  mark(now - 30 * H, w2, m2, "headset", "headset", "pass"); mark(now - 30 * H, w2, m2, "labels", "headset", "fail");
  audit.sort((a, b) => (a.at < b.at ? 1 : -1));

  const daysIn = (from, to) => { const out = []; for (let day = istDay(from); istStart(day) < new Date(to); day = addDays(day, 1)) out.push(day); return out; };
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const inRange = (t, from, to) => t >= from && t < to;
  const wait = () => new Promise((res) => setTimeout(res, 120));
  const write = async (action, target_type, label, detail) => { await wait(); audit.unshift({ id: audit.length + 1000, at: iso(Date.now()), actor: me.user_id, actor_email: me.email, action, target_type, target_id: null, target_label: label, detail }); };

  return {
    mode: "demo",
    raw: { me, users, stores, devices, write, wait },   // the sample data, for the store tools (tools.js)
    async start() { await wait(); return { profile: { ...me, store: stores.find((s) => s.id === me.store_id)?.name || null } }; },
    async signIn() { await wait(); return { ...me }; },
    async signOut() {},
    async forgot() { await wait(); },
    async setPassword() { await wait(); return { ...me }; },
    async refreshProfile() { return { ...me }; },

    async snapshot() {
      await wait();
      const today = istStart(istDay()).getTime();
      const seen = users.filter((u) => u.status !== "inactive");
      const at = (u) => (u.last_login_at ? new Date(u.last_login_at).getTime() : null);
      const perStore = {};
      for (const d of devices) { const n = stores.find((s) => s.id === d.store_id)?.name || "No store"; perStore[n] = (perStore[n] || 0) + 1; }
      return {
        users: { total: users.length, active: users.filter((u) => u.status === "active").length, inactive: users.filter((u) => u.status === "inactive").length, pending: users.filter((u) => u.status === "pending").length, password_pending: users.filter((u) => !u.password_set && u.status !== "inactive").length },
        last_login: {
          today: seen.filter((u) => at(u) >= today).length,
          week: seen.filter((u) => at(u) && at(u) < today && at(u) >= now - 7 * D).length,
          month: seen.filter((u) => at(u) && at(u) < today && at(u) < now - 7 * D && at(u) >= now - 30 * D).length,
          older: seen.filter((u) => at(u) && at(u) < today && at(u) < now - 30 * D).length,
          never: seen.filter((u) => !at(u)).length,
        },
        roles: Object.fromEntries(["admin", "manager", "viewer"].map((k) => [k, users.filter((u) => u.status === "active" && u.role === k).length])),
        devices: { total: devices.length, paired: devices.filter((d) => d.paired_at).length, unpaired: devices.filter((d) => !d.paired_at).length },
        devices_per_store: Object.entries(perStore).map(([store, n]) => ({ store, n })).sort((a, b) => b.n - a.n).slice(0, 5),
        stores: stores.length,
      };
    },

    async activity(from, to, bucket) {
      await wait();
      const f = new Date(from).getTime(), t = new Date(to).getTime();
      const span = daysIn(f, t);
      const views = span.reduce((a, day) => a + sum(days[day] || {}), 0);
      const share = (kind) => ({ CATALOGUE: 0.62, VIEW: 1, AR: 0.33, PART: per.PART, FILL: 0.1, FIT: per.FIT, FEATURE: per.FEATURE, ROOM: per.ROOM, HEADSET: 0.03, EMBED: per.EMBED })[kind];
      const events_by_kind = Object.fromEntries(KINDS.map((k) => [k, Math.round(views * share(k))]));
      const audit_by_action = {};
      for (const a of audit) if (inRange(new Date(a.at).getTime(), f, t)) audit_by_action[a.action] = (audit_by_action[a.action] || 0) + 1;
      const series = [];
      if (bucket === "hour") {
        for (let s = Math.floor(f / H) * H; s < t; s += H) {
          const day = istDay(s), hour = +new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date(s));
          const lab = `${day}T${String(hour).padStart(2, "0")}:00`;
          const cnt = (act) => audit.filter((a) => a.action === act && istDay(a.at) === day && +new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date(a.at)) === hour && inRange(new Date(a.at).getTime(), f, t)).length;
          series.push({ t: lab, views: Math.round(sum(days[day] || {}) * (hourShare[hour] / hourSum)), logins: cnt("login"), failed: cnt("login_failed") });
        }
      } else {
        for (const day of span) {
          const cnt = (act) => audit.filter((a) => a.action === act && istDay(a.at) === day && inRange(new Date(a.at).getTime(), f, t)).length;
          series.push({ t: day, views: Math.round(sum(days[day] || {})), logins: cnt("login"), failed: cnt("login_failed") });
        }
      }
      return { bucket: bucket === "hour" ? "hour" : "day", events_by_kind, audit_by_action, series };
    },

    async analytics(from, to, store, platform) {
      await wait();
      const span = daysIn(new Date(from).getTime(), new Date(to).getTime());
      const sShare = store === "" || store === undefined || store === null ? 1 : storeShare[Number(store)] || 0;
      const plats = platform ? [platform] : Object.keys(platShare);
      const pShare = plats.reduce((a, k) => a + (platShare[k] || 0), 0);
      const arRate = plats.reduce((a, k) => a + (platShare[k] || 0) * arShare[k], 0) / (pShare || 1);
      const k = sShare * pShare;
      const row = (views, fridge = true, headsetShare = plats.includes("quest") ? platShare.quest / (pShare || 1) : 0) => ({
        views: Math.round(views), ar: Math.round(views * arRate), part: Math.round(views * per.PART), fill: fridge ? Math.round(views * 0.42) : 0,
        fit: Math.round(views * per.FIT), feature: Math.round(views * per.FEATURE), room: Math.round(views * per.ROOM),
        headset: Math.round(views * headsetShare * 0.8), embed: Math.round(views * per.EMBED), sessions: Math.round(views * 0.74),
      });
      const productRows = pop.map((p) => ({ product: p.id, ...row(span.reduce((a, day) => a + (days[day]?.[p.id] || 0), 0) * k, p.fridge) })).sort((a, b) => b.views - a.views);
      const total = productRows.reduce((a, x) => a + x.views, 0) / (k || 1);
      const totals = Object.fromEntries(["views", "ar", "part", "fill", "fit", "feature", "room", "headset", "embed", "sessions"].map((key) => [key, productRows.reduce((a, x) => a + x[key], 0)]));
      totals.catalogue = Math.round(totals.views * 0.62);
      totals.events = totals.catalogue + ["views", "ar", "part", "fill", "fit", "feature", "room", "headset", "embed"].reduce((a, key) => a + totals[key], 0);
      const fridgeShare = productRows.reduce((a, x) => a + x.fill, 0) / Math.max(1, totals.views);
      const storeIds = store === "" || store === undefined || store === null ? Object.keys(storeShare).map(Number) : [Number(store)];
      const stores_ = storeIds.map((id) => ({ store_id: id || null, store: stores.find((s) => s.id === id)?.name || "No store", ...row(total * storeShare[id] * pShare, false) })).map((x) => ({ ...x, fill: Math.round(x.views * fridgeShare) })).sort((a, b) => b.views - a.views);
      const platforms = plats.map((pf) => {
        const v = total * sShare * platShare[pf];
        return { platform: pf, views: Math.round(v), ar: Math.round(v * arShare[pf]), part: Math.round(v * per.PART), fill: Math.round(v * fridgeShare), fit: Math.round(v * per.FIT), feature: Math.round(v * per.FEATURE), sessions: Math.round(v * 0.74) };
      }).sort((a, b) => b.views - a.views);
      const ar_by_kind = {};
      for (const pf of plats) if (arShare[pf] && pf !== "desktop") ar_by_kind[pf === "other" ? "visionos" : pf] = Math.round(total * sShare * platShare[pf] * arShare[pf]);
      const daysOut = span.map((day) => { const v = sum(days[day] || {}) * k; return { t: day, views: Math.round(v), ar: Math.round(v * arRate) }; });
      return { totals, products: productRows, stores: stores_, platforms, ar_by_kind, days: daysOut };
    },

    stores: {
      async list() { await wait(); return stores.map((s) => ({ ...s })).sort((a, b) => a.name.localeCompare(b.name)); },
      async create(rec) { const s = { id: ++nextId, name: rec.name, code: rec.code || null, city: rec.city || null, address: rec.address || null, created_at: iso(Date.now()), updated_at: iso(Date.now()) }; stores.push(s); await write("store_created", "store", s.name, {}); return { id: s.id }; },
      async update(id, rec) { const s = stores.find((x) => x.id === id); Object.assign(s, { name: rec.name, code: rec.code || null, city: rec.city || null, address: rec.address || null, updated_at: iso(Date.now()) }); await write("store_updated", "store", s.name, {}); return { id }; },
      async remove(id) { const i = stores.findIndex((x) => x.id === id); const [s] = stores.splice(i, 1); for (const d of devices) if (d.store_id === id) d.store_id = null; for (const u of users) if (u.store_id === id) u.store_id = null; await write("store_deleted", "store", s.name, {}); return { id }; },
    },
    devices: {
      async list() { await wait(); return devices.map((d) => ({ ...d })).sort((a, b) => a.name.localeCompare(b.name)); },
      async create(rec) { const d = { id: ++nextId, name: rec.name, store_id: rec.store_id ? Number(rec.store_id) : null, notes: rec.notes || null, pair_code: code(), paired_at: null, platform: null, last_seen_at: null, created_at: iso(Date.now()), updated_at: iso(Date.now()) }; devices.push(d); await write("device_created", "device", d.name, {}); return { ...d }; },
      async update(id, rec) { const d = devices.find((x) => x.id === id); Object.assign(d, { name: rec.name, store_id: rec.store_id ? Number(rec.store_id) : null, notes: rec.notes || null, updated_at: iso(Date.now()) }); await write("device_updated", "device", d.name, {}); return { id }; },
      async remove(id) { const i = devices.findIndex((x) => x.id === id); const [d] = devices.splice(i, 1); await write("device_deleted", "device", d.name, {}); return { id }; },
      async reset(id) { const d = devices.find((x) => x.id === id); Object.assign(d, { pair_code: code(), paired_at: null, platform: null, last_seen_at: null }); await write("device_reset", "device", d.name, {}); return { pair_code: d.pair_code }; },
    },
    users: {
      async list() { await wait(); return users.map((u) => ({ ...u })); },
      async update(userId, patch) {
        const u = users.find((x) => x.user_id === userId);
        const admins = users.filter((x) => x.role === "admin" && x.status === "active" && x.user_id !== userId);
        if (u.role === "admin" && u.status === "active" && ((patch.role && patch.role !== "admin") || (patch.status && patch.status !== "active")) && !admins.length) throw new Error("Keep at least one active admin");
        const before = { ...u };
        Object.assign(u, patch);
        if (patch.status && patch.status !== before.status) await write(patch.status === "inactive" ? "user_deactivated" : before.status === "pending" ? "user_approved" : "user_reactivated", "user", u.email, { from: before.status, to: patch.status });
        if (patch.role && patch.role !== before.role) await write("role_changed", "user", u.email, { from: before.role, to: patch.role });
        if ("store_id" in patch && String(patch.store_id) !== String(before.store_id)) await write("user_store_changed", "user", u.email, { from: before.store_id, to: patch.store_id });
        return { user_id: userId };
      },
    },
    invites: {
      async list() { await wait(); return invites.map((i) => ({ ...i })); },
      async create({ email, role: r2, store_id }) {
        email = String(email).trim().toLowerCase();
        if (users.some((u) => u.email === email)) throw new Error("That email is already a user here. Change their role on this page instead.");
        if (invites.some((i) => i.email === email)) throw new Error("There is already an open invite for that email.");
        invites.unshift({ id: ++nextId, email, role: r2, store_id: store_id ? Number(store_id) : null, created_at: iso(Date.now()) });
        await write("user_invited", "invite", email, { role: r2 });
        return { password: "Demo-Only-Pass", existing: false };
      },
      async remove(id) { const i = invites.findIndex((x) => x.id === id); const [inv] = invites.splice(i, 1); await write("invite_cancelled", "invite", inv.email, {}); return { id }; },
    },
    audit: {
      async list({ action, user, from, to, offset = 0, limit = 25 }) {
        await wait();
        const who = String(user || "").toLowerCase();
        const rows = audit.filter((a) => (!action || a.action === action) && (!who || (a.actor_email || "").includes(who)) && (!from || a.at >= new Date(from).toISOString()) && (!to || a.at < new Date(to).toISOString()));
        return { rows: rows.slice(offset, offset + limit), total: rows.length };
      },
    },
    // the Testing pages, with the same rules as the database's review functions
    reviews: {
      async products() { await wait(); return catalogue.map((p) => (WAITING.includes(p.id) ? { ...p, hidden: true, awaitingReview: true } : { ...p })); },
      async queue() {
        await wait();
        const ids = [...new Set([...decisions, ...feedback, ...checks].map((x) => x.product_id))];
        return ids.map((pid) => {
          const d = latest(pid), f = feedback.filter((x) => x.product_id === pid), c = checks.filter((x) => x.product_id === pid);
          const times = [d?.at, ...f.flatMap((x) => [x.at, x.status_at]), ...c.map((x) => x.at)].filter(Boolean).sort();
          return { product_id: pid, decision: d?.decision || null, note: d?.note || null, decided_by: d?.by || null, decided_at: d?.at || null,
            open_feedback: f.filter((x) => x.status === "open").length, feedback: f.length,
            checks_pass: c.filter((x) => x.result === "pass").length, checks_fail: c.filter((x) => x.result === "fail").length, last_at: times.at(-1) || null };
        });
      },
      async get(pid) {
        await wait();
        return {
          history: decisions.filter((d) => d.product_id === pid).reverse().map((d) => ({ ...d })),
          feedback: feedback.filter((f) => f.product_id === pid).reverse().map((f) => ({ ...f, photos: [...f.photos] })),
          checks: checks.filter((c) => c.product_id === pid).map(({ user_id, ...c }) => ({ ...c, mine: user_id === me.user_id })),
        };
      },
      async decide(pid, decision, note, label) {
        await wait();
        if (role === "viewer") throw new Error("Your role can’t do that.");
        const n = String(note || "").trim();
        if (decision === "declined" && n.length < 3) throw new Error("Say why it is declined");
        const from = latest(pid)?.decision || null;
        const d = { id: decisions.length + 1, product_id: pid, decision, note: n || null, by: me.email, name: me.full_name, at: iso(Date.now()) };
        decisions.push(d);
        await write(`product_${decision}`, "product", label || pid, { decision: { from, to: decision }, ...(n ? { note: n } : {}) });
        return { ...d };
      },
      async addFeedback({ product, body, device, finish, area, photos = [] }) {
        await wait();
        if (!String(body || "").trim()) throw new Error("Write what you saw");
        if (photos.length > 3) throw new Error("Up to 3 photos");
        if (photos.some((b) => b.size > 5 * 1024 * 1024)) throw new Error("A photo is too big: 5 MB at most.");
        const f = { id: feedback.length + 1, product_id: product, body: String(body).trim(), device: device || null, finish: finish || null, area: area || null,
          photos: photos.map((b) => URL.createObjectURL(b)), by: me.email, name: me.full_name, at: iso(Date.now()), status: "open", status_by: null, status_at: null };
        feedback.push(f);
        return { id: f.id, at: f.at };
      },
      async setFeedback(id, status) {
        await wait();
        if (role === "viewer") throw new Error("Your role can’t do that.");
        const f = feedback.find((x) => x.id === id);
        if (!f) throw new Error("No such feedback");
        Object.assign(f, { status, status_by: me.email, status_at: iso(Date.now()) });
        return { id, status };
      },
      async check(pid, item, device, result) {
        await wait();
        const i = checks.findIndex((c) => c.product_id === pid && c.item === item && c.device === device && c.user_id === me.user_id);
        if (i >= 0) checks.splice(i, 1);
        if (result !== "untested") checks.push({ product_id: pid, item, device, result, user_id: me.user_id, by: me.email, name: me.full_name, at: iso(Date.now()) });
      },
      // the sample photos are the products' own photos, and new ones stay in this tab
      async photoUrls(paths) { return Object.fromEntries(paths.map((x) => [x, x])); },
    },
  };
}
