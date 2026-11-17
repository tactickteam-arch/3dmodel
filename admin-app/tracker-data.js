// The 3D tracker's and the notifications' data, for the Tracker page (tracker.js), the bell and the Notifications
// page (notify.js). Live, it reads the s3d_tracker and s3d_notifications tables of pipeline/admin/schema.sql and
// writes only through their s3d_ functions, which check the role (the triggers there write the history and the
// notifications). /admin?demo=1 uses made-up data kept in memory: items for every colour in /products.json plus some
// obviously made-up "SAMPLE-" items, with sample owners, dates, comments and notifications. Nothing there is saved.
import { statusOf } from "./review.js";

// the tracker's statuses (as in the spreadsheet: Live on site, Built - in review, …), in the spreadsheet's order
export const STATUS = {
  live: ["Live on site", "green"], review: ["Built, in review", "orange"], hidden: ["Built, hidden", "blue"],
  in_progress: ["In progress", "amber"], blocked: ["Blocked", "red"], not_started: ["Not started", ""],
};
export const BUILT = ["live", "review", "hidden"];
export const NOT_BUILT = ["not_started", "in_progress", "blocked"];
export const PRIORITY = { low: ["Low", ""], normal: ["Normal", ""], high: ["High", "amber"], urgent: ["Urgent", "red"] };
// the kinds of notification, as the settings list them; lead: only admins and managers get it
export const KINDS = {
  live: ["Went live on the site", "An item went live: you own it, commented on it, or are an admin or manager.", false],
  blocked: ["Blocked", "An item is blocked: you own it, commented on it, or are an admin or manager.", false],
  status: ["Other status changes", "Any other status change on an item you own or commented on.", false],
  assigned: ["Assigned to you", "Someone gave you an item to build.", false],
  comment: ["New comments", "A comment on an item you own or commented on.", false],
  due: ["Past the due date", "An item you own isn’t built and its due date has passed.", false],
  import: ["Tracker imports", "Someone imported the tracker spreadsheet, with what changed.", true],
  feedback: ["Store feedback", "Someone gave feedback on a product on the Testing pages.", true],
};
const STATUSES = Object.keys(STATUS), PRIORITIES = Object.keys(PRIORITY);
// an item code as the product page compares them (product.html codeKey): case and punctuation don't count
export const codeKey = (c) => String(c ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
export const itemName = (t) => `${t.item_code}${t.brand ? ` (${t.brand})` : ""}`;

// A spreadsheet row's own fields as the database keeps them (s3d_tracker_import): trimmed, cut to length, without
// control characters, null when empty. The import's preview and the demo compare with these.
export const SHEET_KEYS = ["model", "brand", "created_on", "status", "colour", "product_id", "link", "prior_list", "ref_list", "in_master", "source", "notes"];
export const cleanText = (v, max, lines = false) => String(v ?? "").replace(lines ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, "").slice(0, max).trim() || null;
export function sheetFields(e) {
  const prod = String(e.product_id ?? "").trim().toLowerCase(), link = cleanText(e.link, 500);
  return {
    model: cleanText(e.model, 400), brand: cleanText(e.brand, 60), created_on: /^\d{4}-\d{2}-\d{2}$/.test(e.created_on || "") ? e.created_on : null,
    status: e.status || "not_started", colour: cleanText(e.colour, 120), product_id: /^[a-z0-9][a-z0-9-]{0,79}$/.test(prod) ? prod : null,
    link: /^https:\/\//.test(link || "") ? link : null, prior_list: e.prior_list === true, ref_list: e.ref_list === true, in_master: e.in_master !== false,
    source: cleanText(e.source, 60), notes: cleanText(e.notes, 1000, true),
  };
}

// Which item codes are on the site now: every code (itemCode, code and altCodes) of each colour of each product on
// show, with the team's decisions from the Testing pages (an approved product is on show, a declined one is off).
// { codeKey: { p, f } }. If the decisions can't be read (the database isn't set up), products.json alone decides.
export async function siteCodes(api) {
  const [products, queue] = await Promise.all([api.reviews.products(), api.reviews.queue().catch(() => [])]);
  const byId = new Map(queue.map((q) => [q.product_id, q]));
  const m = new Map();
  for (const p of products) {
    if (statusOf(p, byId.get(p.id)) !== "live") continue;
    for (const f of p.finishes || []) for (const c of [f.itemCode, f.code, ...(f.altCodes || [])]) if (c && !m.has(codeKey(c))) m.set(codeKey(c), { p, f });
  }
  return m;
}

// ════════════════════════════════════════════════════════════════════════════ Live (Supabase)
function liveData({ sb, run, rpc }) {
  // every row of a table, 1000 at a time (the Data API sends at most 1000 rows per request)
  const all = async (table) => {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = await run(sb.from(table).select("*").order("id").range(from, from + 999));
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  };
  return {
    staff: () => rpc("s3d_staff"),
    tracker: {
      list: () => all("s3d_tracker"),
      log: (id) => run(sb.from("s3d_tracker_log").select("*").eq("item_id", id).order("id")),
      imports: () => run(sb.from("s3d_tracker_imports").select("*").order("id", { ascending: false }).limit(5)),
      update: (id, patch) => rpc("s3d_tracker_update", { p_id: id, p_patch: patch }),
      comment: (id, body) => rpc("s3d_tracker_comment", { p_id: id, p_body: body }),
      import: (rows, file) => rpc("s3d_tracker_import", { p_rows: rows, p_file: file || null }),
      markLive: (items) => rpc("s3d_tracker_live", { p_items: items }),
      dueCheck: () => rpc("s3d_tracker_due"),
    },
    notify: {
      list({ limit = 30, before = null, unread = false } = {}) {
        let q = sb.from("s3d_notifications").select("*").order("id", { ascending: false }).limit(limit);
        if (before) q = q.lt("id", before);
        if (unread) q = q.is("read_at", null);
        return run(q);
      },
      // how many are unread (counted up to 100: the bell then says 99+)
      unread: async () => (await run(sb.from("s3d_notifications").select("id").is("read_at", null).limit(100))).length,
      read: (id) => rpc("s3d_notify_read", { p_id: id ?? null }),
      settings: async () => (await run(sb.from("s3d_notify_settings").select("off").limit(1)))[0]?.off || [],
      saveSettings: (off) => rpc("s3d_notify_settings_set", { p_off: off }),
      // new rows for this person, as they are written (Supabase Realtime applies the table's read policy)
      subscribe(uid, onRow, onState) {
        const ch = sb.channel(`s3d-notify-${uid}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "s3d_notifications", filter: `recipient=eq.${uid}` }, (m) => onRow(m.new))
          .subscribe((state) => onState?.(state));
        return () => { sb.removeChannel(ch).catch(() => {}); };
      },
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════ Demo (in memory)
// The same rules as the database's functions and triggers. Only the signed-in demo user reads notifications here,
// so only theirs are kept.
function demoData(api) {
  const { me, users, write, wait } = api.raw;
  const H = 3600e3, DAY = 24 * H, now = Date.now();
  const iso = (t) => new Date(t).toISOString();
  const ymd = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(t));
  const items = [], log = [], imports = [], notes = [];
  const settings = { off: [] };
  const subs = new Set();
  const replied = new Set();
  let nextItem = 1, nextLog = 1, nextNote = 1;
  const fail = (m) => { throw new Error(m); };
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const user = (id) => users.find((u) => u.user_id === id) || null;
  const nameOf = (u) => (u ? u.full_name || u.email.split("@")[0] : "The system");
  const staff = () => users.filter((u) => u.status === "active" && u.password_set);
  const leads = () => staff().filter((u) => u.role === "admin" || u.role === "manager").map((u) => u.user_id);
  const watchers = (t) => [...new Set([t.assignee, ...log.filter((l) => l.item_id === t.id && l.kind === "comment").map((l) => l.actor)].filter(Boolean))];
  const lead = () => me.role === "admin" || me.role === "manager";
  const label = (s) => STATUS[s]?.[0] || s;
  const dayText = (d) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${d}T12:00:00+05:30`));

  // a notification for the signed-in demo user, if they are among p_to, didn't do it themselves and want this kind
  function notify(to, kind, title, body, link, item, actor, { at = Date.now(), read = false, system = false } = {}) {
    const a = system ? null : actor;
    if (!to.includes(me.user_id) || (a && a.user_id === me.user_id) || settings.off.includes(kind)) return 0;
    const n = { id: nextNote++, recipient: me.user_id, at: iso(at), kind, title, body, link, item_id: item?.id ?? null, actor: a?.user_id ?? null, actor_name: a ? nameOf(a) : null, read_at: read ? iso(at + H) : null };
    notes.push(n);
    if (at >= now) for (const fn of subs) setTimeout(() => fn({ ...n }), 0);
    return 1;
  }
  const entry = (t, actor, kind, extra, at = Date.now()) => {
    const l = { id: nextLog++, item_id: t.id, at: iso(at), actor: actor?.user_id ?? null, actor_email: actor?.email ?? null, actor_name: actor?.full_name ?? null, kind, body: null, from_value: null, to_value: null, how: null, ...extra };
    log.push(l);
    return l;
  };
  // what the database's s3d_tracker_trg does after an update: the history and the notifications
  function changed(t, o, actor, how = null, at = Date.now()) {
    const who = nameOf(actor), link = `#/tracker/${t.id}`;
    if (t.status !== o.status) {
      t.status_at = iso(at);
      entry(t, actor, "status", { from_value: o.status, to_value: t.status, how }, at);
      if (how !== "import") {
        const kind = t.status === "live" ? "live" : t.status === "blocked" ? "blocked" : "status";
        notify(kind === "status" ? watchers(t) : [...watchers(t), ...leads()], kind,
          kind === "live" ? `${itemName(t)} is live on the site` : kind === "blocked" ? `${itemName(t)} is blocked` : `${itemName(t)}: ${label(t.status)}`,
          how === "site" ? `Found on the site. It was “${label(o.status)}”.` : `${who} changed it from “${label(o.status)}” to “${label(t.status)}”.`, link, t, actor, { at });
      }
    }
    if (t.assignee !== o.assignee) {
      entry(t, actor, "assignee", { from_value: o.assignee, to_value: t.assignee, how }, at);
      if (t.assignee) notify([t.assignee], "assigned", `${itemName(t)} is assigned to you`, `${who} assigned it to you.`, link, t, actor, { at });
    }
    if (t.due_on !== o.due_on) { entry(t, actor, "due", { from_value: o.due_on, to_value: t.due_on, how }, at); t.due_told = null; }
    if (t.priority !== o.priority) entry(t, actor, "priority", { from_value: o.priority, to_value: t.priority, how }, at);
    t.updated_at = iso(at);
  }
  function comment(t, actor, body, at = Date.now()) {
    const l = entry(t, actor, "comment", { body }, at);
    t.comments++;
    t.updated_at = iso(at);
    notify(watchers(t), "comment", `New comment on ${itemName(t)}`, `${nameOf(actor)}: ${body.slice(0, 300)}`, `#/tracker/${t.id}`, t, actor, { at });
    return l;
  }
  const blank = (extra) => ({
    id: nextItem++, category: "", item_code: "", model: null, brand: null, created_on: null, status: "not_started", colour: null, product_id: null, link: null,
    prior_list: false, ref_list: false, in_master: true, source: null, notes: null, assignee: null, due_on: null, priority: "normal", comments: 0, due_told: null,
    created_at: iso(now - 30 * DAY), updated_at: iso(now - 30 * DAY), status_at: iso(now - 30 * DAY), ...extra,
  });

  const ready = api.reviews.products().then((catalogue) => {
    const [m1, m2, v1] = ["demo-2", "demo-3", "demo-4"].map((id) => user(id) || me);
    const waiting = catalogue.filter((p) => p.awaitingReview);
    const shown = catalogue.filter((p) => !p.hidden);
    // one item per colour in the catalogue, under its own item code (as the spreadsheet lists them)
    for (const p of catalogue) for (const f of p.finishes || []) {
      const code = f.itemCode || f.code || p.model;
      if (!code || items.some((t) => t.category === p.category && t.item_code === code)) continue;
      items.push(blank({ category: p.category, item_code: code, model: p.name, brand: p.brand, colour: f.name, product_id: p.id,
        link: `https://3d.sangeetha.com/p/${encodeURIComponent(code)}`, status: p.awaitingReview ? "review" : p.hidden ? "hidden" : "live" }));
    }
    // two that are on the site but still say "In progress": the Tracker page marks them live when an admin opens it
    for (const p of [shown[4], shown[7]].filter(Boolean)) { const t = items.find((x) => x.product_id === p.id); if (t) t.status = "in_progress"; }
    // made-up items still to build
    const cats = [["Refrigerator", "RF", "fridge"], ["Air conditioner", "AC", "air conditioner"], ["Washing machine", "WM", "washing machine"]];
    const plan = {
      "SAMPLE-RF-001": { status: "in_progress", assignee: m1.user_id, due: 4, priority: "high" },
      "SAMPLE-RF-002": { status: "not_started", assignee: me.user_id, due: -2, priority: "urgent" },
      "SAMPLE-RF-003": { status: "blocked", assignee: m2.user_id, priority: "high", notes: "Sample note: waiting for the maker’s door measurements." },
      "SAMPLE-AC-001": { status: "in_progress", assignee: me.user_id, due: 6 },
      "SAMPLE-AC-002": { status: "not_started", assignee: v1.user_id, due: 10, priority: "low" },
      "SAMPLE-WM-001": { status: "blocked", assignee: m1.user_id, notes: "Sample note: no photos of the drum yet." },
      "SAMPLE-WM-002": { status: "in_progress", assignee: m2.user_id, due: 2, priority: "high" },
    };
    cats.forEach(([category, short, what], ci) => {
      for (let i = 1; i <= 10; i++) {
        const code = `SAMPLE-${short}-${String(i).padStart(3, "0")}`, x = plan[code] || {};
        items.push(blank({ category, item_code: code, model: `Sample ${what} ${i} (made up)`, brand: `Sample Brand ${"ABC"[(i + ci) % 3]}`,
          created_on: ymd(now - (40 + i * 3) * DAY), status: x.status || "not_started", prior_list: i % 3 === 0, ref_list: i % 4 === 1,
          in_master: !(short === "RF" && i === 10), source: short === "RF" && i === 10 ? "Our build" : null, notes: x.notes || null,
          assignee: x.assignee || null, due_on: x.due !== undefined ? ymd(now + x.due * DAY) : null, priority: x.priority || "normal" }));
      }
    });
    const T = (code) => items.find((t) => t.item_code === code);
    // their sample history
    const rf1 = T("SAMPLE-RF-001"), rf3 = T("SAMPLE-RF-003"), ac1 = T("SAMPLE-AC-001"), wm1 = T("SAMPLE-WM-001");
    entry(rf1, me, "assignee", { to_value: rf1.assignee }, now - 4 * DAY);
    entry(rf1, m1, "status", { from_value: "not_started", to_value: "in_progress" }, now - 3 * DAY);
    entry(rf1, m1, "comment", { body: "Sample comment: started on the doors." }, now - 3 * DAY + H); rf1.comments++;
    entry(rf3, m2, "status", { from_value: "in_progress", to_value: "blocked" }, now - 26 * H);
    entry(rf3, m2, "comment", { body: "Sample comment: waiting for the maker’s door measurements." }, now - 26 * H);
    entry(rf3, me, "comment", { body: "Sample comment: I’ve asked the brand for them." }, now - 20 * H);
    entry(rf3, m2, "comment", { body: "Sample comment: they say by Friday." }, now - 40 * 60e3); rf3.comments += 3;
    entry(ac1, m1, "assignee", { to_value: me.user_id }, now - 5 * H);
    entry(wm1, m1, "status", { from_value: "not_started", to_value: "blocked" }, now - 2 * DAY);
    const firstLive = items.find((t) => t.status === "live");
    if (firstLive) entry(firstLive, m2, "status", { from_value: "review", to_value: "live" }, now - 30 * H);
    imports.push({ id: 1, at: iso(now - 2 * DAY), actor: m1.user_id, actor_email: m1.email, actor_name: m1.full_name, file_name: "Sample tracker.xlsx", total: items.length, added: items.length, changed: 0, unchanged: 0, skipped: 0, missing: 0 });
    // the demo user's notifications so far (as the database would have sent them)
    if (lead()) notify(leads(), "import", `Tracker import: ${items.length} new, 0 changed`, `${nameOf(m1)} imported “Sample tracker.xlsx”: ${items.length} rows, 0 unchanged.`, "#/tracker", null, m1, { at: now - 2 * DAY, read: true });
    if (firstLive && lead()) notify(leads(), "live", `${itemName(firstLive)} is live on the site`, `${nameOf(m2)} changed it from “Built, in review” to “Live on site”.`, `#/tracker/${firstLive.id}`, firstLive, m2, { at: now - 30 * H, read: true });
    notify([...watchers(rf3), ...(lead() ? leads() : [])], "blocked", `${itemName(rf3)} is blocked`, `${nameOf(m2)} changed it from “In progress” to “Blocked”.`, `#/tracker/${rf3.id}`, rf3, m2, { at: now - 26 * H, read: !lead() });
    notify([ac1.assignee], "assigned", `${itemName(ac1)} is assigned to you`, `${nameOf(m1)} assigned it to you.`, `#/tracker/${ac1.id}`, ac1, m1, { at: now - 5 * H });
    if (lead() && waiting[0]) notify(leads(), "feedback", `New feedback on ${waiting[0].id}`, `${nameOf(v1)} (Colours): Sample feedback: the handle looks lighter than the one in the shop.`, `#/review/${waiting[0].id}`, null, v1, { at: now - 5 * H });
    notify(watchers(rf3), "comment", `New comment on ${itemName(rf3)}`, `${nameOf(m2)}: Sample comment: they say by Friday.`, `#/tracker/${rf3.id}`, rf3, m2, { at: now - 40 * 60e3 });
  });

  const need = () => { if (!lead()) fail("Your role can’t do that."); };
  const find = (id) => items.find((t) => t.id === id) || fail("No such item.");
  const clean = (v, max) => cleanText(v, max);
  return {
    staff: async () => { await ready; return staff().map((u) => ({ user_id: u.user_id, name: nameOf(u), email: u.email, role: u.role })).sort((a, b) => a.name.localeCompare(b.name)); },
    tracker: {
      async list() { await ready; await wait(); return copy(items); },
      async log(id) { await ready; return copy(log.filter((l) => l.item_id === id).sort((a, b) => a.id - b.id)); },
      async imports() { await ready; return copy(imports).reverse().slice(0, 5); },
      async update(id, patch) {
        await ready; await wait(); need();
        const t = find(id), o = { ...t };
        const next = { status: patch.status ?? t.status, assignee: "assignee" in patch ? patch.assignee || null : t.assignee, due_on: "due_on" in patch ? patch.due_on || null : t.due_on, priority: patch.priority ?? t.priority };
        if (!STATUSES.includes(next.status)) fail("Unknown status.");
        if (!PRIORITIES.includes(next.priority)) fail("Unknown priority.");
        if (next.assignee && next.assignee !== t.assignee && !staff().some((u) => u.user_id === next.assignee)) fail("Choose someone on the team: an active user.");
        if (next.due_on && next.due_on !== t.due_on && (next.due_on < ymd(Date.now() - DAY) || next.due_on > ymd(Date.now() + 730 * DAY))) fail("The due date has to be from today on, within two years.");
        Object.assign(t, next);
        changed(t, o, me);
        await write("tracker_updated", "tracker", itemName(t), { status: o.status !== t.status ? { from: o.status, to: t.status } : undefined });
        return copy(t);
      },
      async comment(id, body) {
        await ready; await wait();
        const text = cleanText(body, 1000, true);
        if (!text) fail("Write a comment first.");
        const t = find(id), l = comment(t, me, text);
        await write("tracker_commented", "tracker", itemName(t), { text: text.slice(0, 120) });
        // in the demo the item's owner answers a few seconds later, so the bell has something new to show
        const owner = user(t.assignee);
        if (owner && owner.user_id !== me.user_id && !replied.has(t.id)) {
          replied.add(t.id);
          setTimeout(() => comment(t, owner, "Sample reply: thanks, I’ll look at it today."), 6000);
        }
        return copy(l);
      },
      async import(rows, file) {
        await ready; await wait(); need();
        if (!Array.isArray(rows) || !rows.length) fail("The file has no items.");
        const seen = new Set();
        const r = { id: imports.length + 1, at: iso(Date.now()), actor: me.user_id, actor_email: me.email, actor_name: me.full_name, file_name: clean(file, 200), total: rows.length, added: 0, changed: 0, unchanged: 0, skipped: 0, missing: 0 };
        for (const e of rows) {
          const cat = clean(e?.category, 60), code = clean(e?.item_code, 80), k = `${cat}\u0001${code}`;
          if (!cat || !code || !STATUSES.includes(e.status || "not_started") || seen.has(k)) { r.skipped++; continue; }
          seen.add(k);
          const v = sheetFields(e), t = items.find((x) => x.category === cat && x.item_code === code);
          if (!t) { items.push(blank({ category: cat, item_code: code, ...v, created_at: r.at, updated_at: r.at, status_at: r.at })); r.added++; }
          else if (SHEET_KEYS.every((key) => t[key] === v[key])) r.unchanged++;
          else { const o = { ...t }; Object.assign(t, v); changed(t, o, me, "import"); r.changed++; }
        }
        r.missing = items.filter((t) => !seen.has(`${t.category}\u0001${t.item_code}`)).length;
        imports.push(r);
        notify(leads(), "import", `Tracker import: ${r.added} new, ${r.changed} changed`, `${nameOf(me)} imported the spreadsheet.`, "#/tracker", null, me);
        await write("tracker_import", "tracker", r.file_name || "Tracker spreadsheet", { rows: r.total, added: r.added, changed: r.changed, unchanged: r.unchanged, skipped: r.skipped });
        return copy(r);
      },
      async markLive(list) {
        await ready; need();
        let n = 0;
        for (const x of list) {
          const t = items.find((i) => i.id === x.id);
          if (!t || t.status === "live") continue;
          const o = { ...t };
          Object.assign(t, { status: "live", product_id: t.product_id || x.product || null, colour: t.colour || x.colour || null });
          changed(t, o, me, "site");
          n++;
        }
        return n;
      },
      async dueCheck() {
        await ready;
        const today = ymd(Date.now());
        let n = 0;
        for (const t of items.filter((x) => x.due_on && x.due_on < today && NOT_BUILT.includes(x.status) && x.due_told !== x.due_on)) {
          n += notify(t.assignee ? [t.assignee] : leads(), "due", `${itemName(t)} is past its due date`, `It was due on ${dayText(t.due_on)} and is “${label(t.status)}”.`, `#/tracker/${t.id}`, t, null, { system: true });
          t.due_told = t.due_on;
        }
        return n;
      },
    },
    notify: {
      async list({ limit = 30, before = null, unread = false } = {}) {
        await ready;
        return copy(notes.filter((n) => (!before || n.id < before) && (!unread || !n.read_at)).sort((a, b) => b.id - a.id).slice(0, limit));
      },
      async unread() { await ready; return notes.filter((n) => !n.read_at).length; },
      async read(id) {
        await ready;
        let n = 0;
        for (const x of notes) if (!x.read_at && (id === null || id === undefined || x.id === id)) { x.read_at = iso(Date.now()); n++; }
        return n;
      },
      async settings() { await ready; return [...settings.off]; },
      async saveSettings(off) {
        await wait();
        if (off.some((k) => !KINDS[k])) fail("Unknown kind of notification.");
        settings.off = [...new Set(off)].sort();
        return { off: [...settings.off] };
      },
      subscribe(uid, onRow, onState) { subs.add(onRow); setTimeout(() => onState?.("SUBSCRIBED"), 0); return () => subs.delete(onRow); },
    },
  };
}

const cache = new WeakMap();
export const trackerData = (api) => { if (!cache.has(api)) cache.set(api, api.mode === "demo" ? demoData(api) : liveData(api.raw)); return cache.get(api); };
