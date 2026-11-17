// Runs schema.sql in PGlite (Postgres 17 in WebAssembly) behind a small stand-in for Supabase's auth schema,
// roles and Storage tables, twice (it must be re-runnable), then walks through the sign-in, invite, pairing,
// tracking, product review (approve, decline, feedback, checklist, s3d_live, the photo bucket), the 3D tracker
// (import, assign, status, comments, found on the site, due dates) and its notifications (who is told, settings,
// each person reads only their own, the Realtime publication), and the permission cases as anon, admin, manager,
// viewer and a pending account. Nothing touches Supabase.
// setup once: cd .work/admin && npm i @electric-sql/pglite      (the work folder is gitignored)
// usage: node pipeline/admin/test_schema.mjs [schema.sql]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lib = path.join(site, ".work/admin/node_modules/@electric-sql/pglite/dist/index.js");
if (!fs.existsSync(lib)) { console.error("PGlite isn't installed: cd .work/admin && npm i @electric-sql/pglite"); process.exit(2); }
const { PGlite } = await import(pathToFileURL(lib).href);
const sql = fs.readFileSync(process.argv[2] || path.join(site, "pipeline/admin/schema.sql"), "utf8");
const db = new PGlite();
let failed = 0, passed = 0;
const check = (ok, msg, extra = "") => { if (ok) passed++; else failed++; console.log(`${ok ? "ok  " : "FAIL"} ${msg}${extra ? " :: " + extra : ""}`); };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email varchar(255), created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- what Supabase used to do for every new table and function: the schema must take these away again
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  -- Supabase Storage's two tables, as far as schema.sql uses them. Supabase grants every role all of
  -- storage.objects and leaves the rest to row level security; another app's bucket is there too.
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
    name text, owner uuid default auth.uid(), created_at timestamptz default now());
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
  insert into storage.buckets (id, name, public) values ('other-app', 'other-app', true);
`);
await db.exec(sql);
check(true, "schema.sql ran (first time, on a database without Supabase Realtime's publication)");
// Supabase makes this publication for Realtime; the second run must add the notifications table to it
await db.exec("create publication supabase_realtime");
await db.exec(sql);
check(true, "schema.sql ran again (re-runnable)");

const A = "00000000-0000-4000-8000-00000000000a", B = "00000000-0000-4000-8000-00000000000b", C = "00000000-0000-4000-8000-00000000000c", D = "00000000-0000-4000-8000-00000000000d";
// run one statement as a role (and user), inside a transaction that keeps its effects
async function as(role, uid, q, params = []) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid || ""]);
    await db.exec(`set local role ${role}`);
    const r = await db.query(q, params);
    await db.exec("commit");
    return { rows: r.rows, affected: r.affectedRows };
  } catch (e) { await db.exec("rollback"); return { error: e.message }; }
}
const one = async (...a) => { const r = await as(...a); return r.error ? { error: r.error } : r.rows[0]; };

// ── anon ──
let r = await as("anon", null, "select * from public.s3d_events");
check(/permission denied/.test(r.error || ""), "anon can't read s3d_events", r.error);
r = await as("anon", null, "insert into public.s3d_events (kind, session_id) values ('VIEW','abcdefgh12')");
check(/permission denied/.test(r.error || ""), "anon can't insert into s3d_events directly", r.error);
r = await as("anon", null, "select * from public.s3d_stores");
check(/permission denied/.test(r.error || ""), "anon can't read s3d_stores", r.error);
r = await as("anon", null, "select public.s3d_snapshot()");
check(/permission denied/.test(r.error || ""), "anon can't call s3d_snapshot", r.error);
r = await as("anon", null, "select public.s3d_login()");
check(/permission denied/.test(r.error || ""), "anon can't call s3d_login", r.error);
r = await as("anon", null, "select public.s3d_audit_write('x', null, null, null, '{}')");
check(/permission denied/.test(r.error || ""), "anon can't call s3d_audit_write", r.error);
r = await as("authenticated", A, "select public.s3d_audit_write('x', null, null, null, '{}')");
check(/permission denied/.test(r.error || ""), "authenticated can't call s3d_audit_write", r.error);
r = await as("anon", null, "select public.s3d_track('VIEW', 'lg-glt3426snpz', null, 'sess-12345678', null, 'android')");
check(!r.error, "anon s3d_track VIEW", r.error);
r = await as("anon", null, "select public.s3d_track('NOPE', 'lg-glt3426snpz', null, 'sess-12345678', null, 'android')");
r = await as("anon", null, "select public.s3d_track('VIEW', 'Bad Id!', null, 'sess-12345678', null, 'android')");
r = await as("anon", null, "select public.s3d_track('VIEW', 'lg-glt3426snpz', null, 'x', null, 'android')");
r = await as("anon", null, "select public.s3d_track('feature', 'lg-glt3426snpz', repeat('ab<c>', 40), 'sess-12345678', null, 'tv')");
let ev = (await db.query("select kind, product_id, detail, platform from public.s3d_events order by id")).rows;
check(ev.length === 2 && ev[1].kind === "FEATURE" && ev[1].platform === "other" && ev[1].detail.length === 80 && !/[<>]/.test(ev[1].detail), "s3d_track keeps only valid events, cleans detail", JSON.stringify(ev));
r = await one("anon", null, "select public.s3d_pair('ZZZZZZZZ') as j");
check(r.j?.error === "not_found", "pair with an unknown code", JSON.stringify(r));
r = await as("anon", null, "select public.s3d_login_failed('Someone@Example.com')");
r = await as("anon", null, "select public.s3d_login_failed('not an email')");
let au = (await db.query("select action, actor_email from public.s3d_audit")).rows;
check(au.length === 1 && au[0].action === "login_failed" && au[0].actor_email === "someone@example.com", "failed login audited once (bad input ignored)", JSON.stringify(au));

// ── signing in first makes nobody admin: the first admin is named by hand in the SQL editor ──
await db.query("insert into auth.users (id, email, created_at) values ($1, 'first@example.com', now() - interval '1 day')", [A]);
r = await one("authenticated", A, "select public.s3d_login(true) as j");
check(r.j?.role === "viewer" && r.j?.status === "pending", "the first account to sign in is only pending", JSON.stringify(r));
r = await as("authenticated", A, "select * from public.s3d_stores");
check(!r.error && r.rows.length === 0, "pending: no staff access", JSON.stringify(r));
// the line from the top of schema.sql, as the SQL editor runs it
await db.exec(`insert into public.s3d_profiles (user_id, email, role, status, approved_at)
  select id, lower(email), 'admin', 'active', now() from auth.users where lower(email) = lower('First@example.com')
  on conflict (user_id) do update set role = 'admin', status = 'active';`);
r = await one("authenticated", A, "select public.s3d_login(false) as j");
check(r.j?.role === "admin" && r.j?.status === "active" && r.j?.password_set === true, "named by hand: an active admin", JSON.stringify(r));
check(r.j?.role === "admin", "s3d_login(false) returns the profile without a login row");
check((await db.query("select count(*)::int n from public.s3d_audit where action='login'")).rows[0].n === 1, "only the fresh sign-in is audited as login");

// ── admin: stores, devices, invites ──
r = await one("authenticated", A, "insert into public.s3d_stores (name, city) values ('Store One', 'Bengaluru') returning id");
const S1 = r.id;
check(!!S1, "admin creates a store", r.error);
r = await one("authenticated", A, "insert into public.s3d_devices (name, store_id) values ('Tablet 1', $1) returning id, pair_code", [S1]);
check(/^[A-HJ-NP-Z2-9]{8}$/.test(r.pair_code || ""), "admin creates a device with an 8-character pairing code", JSON.stringify(r));
const DEV = r.id, CODE = r.pair_code;
r = await as("authenticated", A, "select * from public.s3d_devices");
check(/permission denied/.test(r.error || ""), "device_key can't be read from the browser (select * denied)", r.error);
r = await as("authenticated", A, "update public.s3d_devices set pair_code = 'AAAAAAAA' where id = $1", [DEV]);
check(/permission denied/.test(r.error || ""), "the pairing code can't be set by hand", r.error);
r = await as("authenticated", A, "insert into public.s3d_invites (email, role, store_id) values ('second@example.com', 'manager', $1)", [S1]);
check(!r.error, "admin invites second@example.com as manager", r.error);
r = await as("authenticated", A, "insert into public.s3d_invites (email, role) values ('Bad@Example.com', 'viewer')");
check(!!r.error, "an invite email must be lower case", r.error);

// ── the invited account: active, manager, password pending until it sets its own ──
await db.query("insert into auth.users (id, email, created_at) values ($1, 'second@example.com', now() + interval '1 second')", [B]);
r = await one("authenticated", B, "select public.s3d_login(true) as j");
check(r.j?.role === "manager" && r.j?.status === "active" && r.j?.password_set === false && r.j?.store === "Store One", "invited account: active manager of Store One, password pending", JSON.stringify(r));
r = await as("authenticated", B, "select * from public.s3d_stores");
check(!r.error && r.rows.length === 0, "password pending: no staff access yet", JSON.stringify(r));
await as("authenticated", B, "select public.s3d_password_set()");
r = await as("authenticated", B, "select id, name from public.s3d_stores");
check(r.rows?.length === 1, "after setting the password the manager sees stores", JSON.stringify(r));
r = await as("authenticated", B, "insert into public.s3d_stores (name) values ('Store Two') returning id");
check(!r.error, "manager creates a store", r.error);
r = await as("authenticated", B, "update public.s3d_profiles set role = 'admin' where user_id = $1", [B]);
check(!r.error && r.affected === 0, "manager can't change roles", JSON.stringify(r));
r = await as("authenticated", B, "select * from public.s3d_audit");
check(!r.error && r.rows.length === 0, "manager can't read the audit log", JSON.stringify(r).slice(0, 80));
r = await as("authenticated", B, "select public.s3d_device_reset($1) as j", [DEV]);
check(!r.error && r.rows[0].j.pair_code !== CODE, "manager issues a new pairing code", r.error);
const CODE2 = r.rows[0].j.pair_code;

// ── an account with no invite waits; the admin approves it ──
await db.query("insert into auth.users (id, email) values ($1, 'third@example.com')", [C]);
r = await one("authenticated", C, "select public.s3d_login(true) as j");
check(r.j?.status === "pending" && r.j?.role === "viewer", "account without an invite is pending", JSON.stringify(r));
r = await as("authenticated", C, "select public.s3d_snapshot()");
check(/Not allowed/.test(r.error || ""), "pending account can't read the snapshot", r.error);
r = await as("authenticated", A, "update public.s3d_profiles set status = 'active' where user_id = $1", [C]);
check(r.affected === 1, "admin approves it");
r = await as("authenticated", C, "insert into public.s3d_stores (name) values ('Nope')");
check(/row-level security/.test(r.error || ""), "viewer can't create a store", r.error);
r = await as("authenticated", C, "select id from public.s3d_devices");
check(r.rows?.length === 1, "viewer reads devices");
r = await as("authenticated", A, "update public.s3d_profiles set role = 'manager', store_id = $2 where user_id = $1", [C, S1]);
r = await as("authenticated", A, "update public.s3d_profiles set status = 'inactive' where user_id = $1", [C]);
r = await as("authenticated", A, "update public.s3d_profiles set status = 'inactive' where user_id = $1", [A]);
check(/at least one active admin/.test(r.error || ""), "the last active admin can't be turned off", r.error);
r = await as("authenticated", A, "update public.s3d_profiles set email = 'x@example.com' where user_id = $1", [C]);
check(/permission denied/.test(r.error || ""), "a profile's email can't be edited", r.error);

// ── pairing and tracking with a device ──
r = await one("anon", null, "select public.s3d_pair($1, 'android') as j", [CODE]);
check(r.j?.error === "not_found", "the old code stops working after a reset", JSON.stringify(r));
r = await one("anon", null, "select public.s3d_pair($1, 'android') as j", [CODE2.toLowerCase().replace(/(....)/, "$1-")]);
check(r.j?.ok === true && r.j?.store === "Store One" && /^[0-9a-f-]{36}$/.test(r.j?.device), "pair (lower case, with a dash) links the device to Store One", JSON.stringify(r));
const KEY = r.j.device;
r = await one("anon", null, "select public.s3d_pair($1) as j", [CODE2]);
check(r.j?.error === "already_paired", "a code works once", JSON.stringify(r));
await as("anon", null, "select public.s3d_track('AR', 'lg-glt3426snpz', 'android', 'sess-abcdefgh', $1, 'android')", [KEY]);
await as("anon", null, "select public.s3d_track('VIEW', 'lg-glt3426snpz', null, 'sess-abcdefgh', $1, 'android')", [KEY]);
ev = (await db.query("select kind, store_id, device_id from public.s3d_events where session_id = 'sess-abcdefgh'")).rows;
check(ev.length === 2 && ev.every((e) => e.store_id === S1 && e.device_id === DEV), "events from the paired device count for its store", JSON.stringify(ev));
const dv = (await db.query("select paired_at, last_seen_at, platform from public.s3d_devices where id = $1", [DEV])).rows[0];
check(dv.paired_at && dv.last_seen_at && dv.platform === "android", "device shows paired, last seen and platform");

// ── read-outs ──
r = await one("authenticated", A, "select public.s3d_snapshot('Asia/Kolkata') as j");
const snap = r.j;
check(snap?.users?.total === 3 && snap.users.active === 2 && snap.users.inactive === 1 && snap.devices.paired === 1 && snap.stores === 2, "snapshot counts", JSON.stringify(snap));
r = await one("authenticated", A, "select public.s3d_activity(now() - interval '7 days', now(), 'day', 'Asia/Kolkata') as j");
check(r.j?.series?.length >= 7 && r.j.events_by_kind.VIEW === 2 && r.j.audit_by_action.login >= 2, "activity: 7+ day slots, events by kind, audit by action", JSON.stringify(r.j)?.slice(0, 300));
r = await one("authenticated", A, "select public.s3d_activity(now() - interval '24 hours', now(), 'hour', 'Not/AZone') as j");
check(r.j?.series?.length >= 24 && r.j.bucket === "hour", "activity by the hour, with a bad time zone falling back to UTC", r.error);
r = await one("authenticated", C, "select public.s3d_analytics(now() - interval '30 days', now()) as j");
check(/Not allowed/.test(r.error || ""), "an inactive account can't read analytics", r.error);
r = await one("authenticated", B, "select public.s3d_analytics(now() - interval '30 days', now() + interval '1 minute', null, null, 'Asia/Kolkata') as j");
const an = r.j;
const lg = an?.products?.find((p) => p.product === "lg-glt3426snpz");
check(lg?.views === 2 && lg?.ar === 1 && an.totals.feature === 1 && an.stores.length === 2 && an.platforms.length === 2 && an.ar_by_kind.android === 1 && an.days.length >= 30, "analytics per product, store, platform and day", JSON.stringify(an)?.slice(0, 400));
r = await one("authenticated", B, "select public.s3d_analytics(now() - interval '30 days', now() + interval '1 minute', $1) as j", [S1]);
check(r.j?.totals?.views === 1, "analytics for one store", JSON.stringify(r.j?.totals));
r = await one("authenticated", B, "select public.s3d_analytics(now() - interval '30 days', now() + interval '1 minute', 0) as j");
check(r.j?.totals?.views === 1 && r.j?.totals?.feature === 1, "analytics for events with no store", JSON.stringify(r.j?.totals));
r = await as("authenticated", A, "select public.s3d_analytics(now(), now() - interval '1 day')");
check(/Bad date range/.test(r.error || ""), "a backwards date range is refused", r.error);

// ── the audit log ──
await as("authenticated", A, "update public.s3d_stores set city = 'Mysuru' where id = $1", [S1]);
await as("authenticated", A, "update public.s3d_devices set name = 'Tablet One' where id = $1", [DEV]);
await as("authenticated", A, "delete from public.s3d_devices where id = $1", [DEV]);
await as("authenticated", A, "delete from public.s3d_stores where name = 'Store Two'");
r = await as("authenticated", A, "select action, actor_email, target_label from public.s3d_audit order by id");
const actions = r.rows.map((x) => x.action);
const want = ["login_failed", "profile_created", "login", "store_created", "device_created", "user_invited", "password_set", "device_reset", "user_approved", "role_changed", "user_store_changed", "user_deactivated", "device_paired", "store_updated", "device_updated", "device_deleted", "store_deleted"];
check(want.every((w) => actions.includes(w)), "audit has every action", want.filter((w) => !actions.includes(w)).join(", ") + " | " + actions.join(","));
const devUpd = r.rows.filter((x) => x.action === "device_updated").length;
check(devUpd === 1, "pairing, tracking and resets don't add 'device updated' rows", `${devUpd} rows`);
check(r.rows.find((x) => x.action === "store_created")?.actor_email === "first@example.com", "audit rows carry the actor's email");
const ev2 = (await db.query("select count(*)::int n, count(device_id)::int d from public.s3d_events")).rows[0];
check(ev2.n === 4 && ev2.d === 0, "deleting a device keeps its events (device cleared)", JSON.stringify(ev2));

// rate limit
await db.exec("begin");
for (let i = 0; i < 305; i++) await db.query("select public.s3d_track('VIEW', 'lg-glt3426snpz', null, 'flood-12345678', null, 'desktop')");
await db.exec("commit");
const fl = (await db.query("select count(*)::int n from public.s3d_events where session_id = 'flood-12345678'")).rows[0].n;
check(fl === 300, "one tab is capped at 300 events in 10 minutes", `${fl}`);

// ── product review: decisions, feedback, the checklist, s3d_live and the photo bucket ──
const E = "00000000-0000-4000-8000-00000000000e";
const P1 = "lg-glt3426snpz", P2 = "haier-hes-690gk";
const photo = (p, u = "0f8fad5b-d9cb-469f-a165-70867728950e") => `'${p}/${u}.jpg'`;
r = await as("anon", null, "select * from public.s3d_live()");
check(!r.error && r.rows.length === 0, "anon calls s3d_live (no decisions yet)", r.error);
for (const [q, what] of [
  [`select public.s3d_decide('${P1}', 'approved')`, "approve (s3d_decide)"],
  ["select public.s3d_review_queue()", "read the review queue"],
  [`select public.s3d_review('${P1}')`, "read a product's review"],
  [`select public.s3d_feedback_add('${P1}', 'Looks wrong')`, "give feedback"],
  ["select public.s3d_feedback_set(1, 'fixed')", "mark feedback fixed"],
  [`select public.s3d_check_set('${P1}', 'doors', 'iphone', 'pass')`, "fill the checklist"],
  ["select * from public.s3d_decisions", "read s3d_decisions"],
  ["select * from public.s3d_feedback", "read s3d_feedback"],
  ["select * from public.s3d_checks", "read s3d_checks"],
  [`insert into public.s3d_decisions (product_id, decision) values ('${P1}', 'approved')`, "write s3d_decisions"],
]) {
  r = await as("anon", null, q);
  check(/permission denied/.test(r.error || ""), `anon can't ${what}`, r.error);
}
const FNS = ["s3d_live()", "s3d_decide(text,text,text,text)", "s3d_feedback_add(text,text,text,text,text,text[])", "s3d_feedback_set(bigint,text)",
  "s3d_check_set(text,text,text,text)", "s3d_review_queue()", "s3d_review(text)"];
const fnRights = (await db.query(`select f, has_function_privilege('anon', 'public.' || f, 'execute') a, has_function_privilege('authenticated', 'public.' || f, 'execute') u
  from unnest($1::text[]) f`, [FNS])).rows;
check(fnRights.filter((x) => x.a).map((x) => x.f).join() === "s3d_live()", "of the review functions anon may call only s3d_live", JSON.stringify(fnRights));
check(fnRights.every((x) => x.u), "signed-in users may call every review function (each checks the role itself)");

// a viewer, invited by the admin
await as("authenticated", A, "insert into public.s3d_invites (email, role) values ('viewer@example.com', 'viewer')");
await db.query("insert into auth.users (id, email, created_at) values ($1, 'viewer@example.com', now() + interval '2 seconds')", [E]);
await as("authenticated", E, "select public.s3d_login(true)");
await as("authenticated", E, "select public.s3d_password_set()");
r = await one("authenticated", E, "select public.s3d_login(false) as j");
check(r.j?.role === "viewer" && r.j?.status === "active" && r.j?.password_set === true, "an active viewer for the review tests", JSON.stringify(r));
r = await as("authenticated", E, `select public.s3d_decide('${P1}', 'approved')`);
check(/Not allowed/.test(r.error || ""), "a viewer can't approve", r.error);
r = await as("authenticated", E, `select public.s3d_decide('${P1}', 'declined', 'The handle is the wrong colour')`);
check(/Not allowed/.test(r.error || ""), "a viewer can't decline", r.error);
r = await one("authenticated", E, `select public.s3d_feedback_add('${P1}', '  The handle looks lighter than in the shop  ', 'iphone', 'Shiny Steel', 'Colours', array[${photo(P1)}]) as j`);
check(r.j?.id > 0, "a viewer gives feedback with a device, colour, area and a photo", JSON.stringify(r));
const FB = r.j?.id;
r = await as("authenticated", E, `select public.s3d_feedback_add('${P1}', 'x', null, null, null, array[${photo(P2)}])`);
check(/folder/.test(r.error || ""), "a photo from another product's folder is refused", r.error);
r = await as("authenticated", E, `select public.s3d_feedback_add('${P1}', 'x', null, null, null, array['${P1}/../secret.jpg'])`);
check(/folder/.test(r.error || ""), "a photo path that isn't <product>/<uuid>.jpg is refused", r.error);
r = await as("authenticated", E, `select public.s3d_feedback_add('${P1}', 'x', null, null, null, array[${[1, 2, 3, 4].map((i) => photo(P1, `0f8fad5b-d9cb-469f-a165-7086772895${i}e`)).join(",")}])`);
check(/Up to 3 photos/.test(r.error || ""), "four photos are refused", r.error);
r = await as("authenticated", E, `select public.s3d_feedback_add('${P1}', '   ')`);
check(/Write what you saw/.test(r.error || ""), "empty feedback is refused", r.error);
r = await as("authenticated", E, `select public.s3d_feedback_add('${P1}', 'x', 'tv')`);
check(/Unknown device/.test(r.error || ""), "an unknown device is refused", r.error);
r = await as("authenticated", E, `select public.s3d_feedback_add('Bad Id!', 'x')`);
check(/No such product/.test(r.error || ""), "a bad product id is refused", r.error);
r = await as("authenticated", E, `select public.s3d_check_set('${P1}', 'doors', 'iphone', 'pass')`);
check(!r.error, "a viewer marks a check passed", r.error);
await as("authenticated", E, `select public.s3d_check_set('${P1}', 'colours', 'android', 'fail')`);
await as("authenticated", E, `select public.s3d_check_set('${P1}', 'doors', 'iphone', 'fail')`);
await as("authenticated", E, `select public.s3d_check_set('${P1}', 'doors', 'iphone', 'pass')`);
r = await as("authenticated", E, `select public.s3d_check_set('${P1}', 'colours', 'android', 'maybe')`);
check(/pass, fail or untested/.test(r.error || ""), "a check is pass, fail or untested", r.error);
r = await as("authenticated", E, `select public.s3d_check_set('${P1}', 'colours', 'fridge', 'pass')`);
check(/Unknown device/.test(r.error || ""), "a check's device must be a known type", r.error);
let ck = (await db.query("select item, device, result from public.s3d_checks order by item")).rows;
check(ck.length === 2 && ck.find((x) => x.item === "doors")?.result === "pass", "changing a mark keeps one row per tester, check and device", JSON.stringify(ck));
await as("authenticated", E, `select public.s3d_check_set('${P1}', 'colours', 'android', 'untested')`);
ck = (await db.query("select item, device, result from public.s3d_checks")).rows;
check(ck.length === 1 && ck[0].item === "doors", "untested removes the tester's mark", JSON.stringify(ck));
r = await as("authenticated", E, `select public.s3d_feedback_set(${FB}, 'fixed')`);
check(/Not allowed/.test(r.error || ""), "a viewer can't mark feedback fixed", r.error);
r = await as("authenticated", E, "update public.s3d_feedback set status = 'fixed'");
check(/permission denied/.test(r.error || ""), "nobody changes feedback directly", r.error);
r = await as("authenticated", E, `insert into public.s3d_decisions (product_id, decision) values ('${P1}', 'approved')`);
check(/permission denied/.test(r.error || ""), "nobody writes decisions directly", r.error);
r = await as("authenticated", E, "select body, author_email from public.s3d_feedback");
check(r.rows?.length === 1 && r.rows[0].body === "The handle looks lighter than in the shop" && r.rows[0].author_email === "viewer@example.com", "staff read feedback (trimmed, with its author)", JSON.stringify(r));

// the manager decides
r = await as("authenticated", B, `select public.s3d_decide('${P1}', 'declined')`);
check(/Say why/.test(r.error || ""), "a decline without a reason is refused", r.error);
r = await as("authenticated", B, `select public.s3d_decide('${P1}', 'declined', ' no ')`);
check(/Say why/.test(r.error || ""), "a two-letter reason is not a reason", r.error);
r = await as("authenticated", B, `select public.s3d_decide('${P1}', 'maybe', 'Not sure')`);
check(/approved or declined/.test(r.error || ""), "the decision must be approved or declined", r.error);
r = await as("authenticated", B, `select public.s3d_decide('${P1}', 'approved', repeat('a', 501))`);
check(/too long/.test(r.error || ""), "a note over 500 characters is refused", r.error);
r = await one("authenticated", B, `select public.s3d_decide('${P1}', 'declined', 'The freezer handle is the wrong colour', 'LG 655 L fridge') as j`);
check(r.j?.decision === "declined" && r.j?.by === "second@example.com", "a manager declines, with a reason", JSON.stringify(r));
r = await as("anon", null, "select * from public.s3d_live()");
check(r.rows?.length === 1 && r.rows[0].product_id === P1 && r.rows[0].decision === "declined" && Object.keys(r.rows[0]).join() === "product_id,decision",
  "s3d_live gives anon the decline, and only the id and decision", JSON.stringify(r));
r = await one("authenticated", B, `select public.s3d_decide('${P1}', 'approved', null, 'LG 655 L fridge') as j`);
check(r.j?.decision === "approved" && r.j?.note === null, "the decision changes to approved, with no note", JSON.stringify(r));
r = await one("authenticated", A, `select public.s3d_decide('${P2}', 'declined', 'The doors open the wrong way') as j`);
check(r.j?.decision === "declined", "an admin declines another product", JSON.stringify(r));
r = await as("anon", null, "select * from public.s3d_live() order by product_id");
check(r.rows?.length === 2 && r.rows.find((x) => x.product_id === P1)?.decision === "approved" && r.rows.find((x) => x.product_id === P2)?.decision === "declined",
  "s3d_live: one row per product, its newest decision", JSON.stringify(r.rows));
r = await one("authenticated", E, `select public.s3d_review('${P1}') as j`);
const rv = r.j || {};
check(rv.history?.length === 2 && rv.history[0].decision === "approved" && rv.history[1].decision === "declined" && rv.history[1].note === "The freezer handle is the wrong colour" && rv.history[1].by === "second@example.com",
  "history: every decision, newest first, with who and why", JSON.stringify(rv.history));
check(rv.feedback?.length === 1 && rv.feedback[0].photos?.length === 1 && rv.feedback[0].device === "iphone" && rv.feedback[0].finish === "Shiny Steel" && rv.feedback[0].status === "open",
  "a viewer reads the product's feedback", JSON.stringify(rv.feedback));
check(rv.checks?.length === 1 && rv.checks[0].mine === true && rv.checks[0].by === "viewer@example.com", "the checklist marks the viewer's own", JSON.stringify(rv.checks));
r = await one("authenticated", B, `select public.s3d_review('${P1}') as j`);
check(r.j?.checks?.[0]?.mine === false, "…and not the manager's");
r = await one("authenticated", E, "select public.s3d_review_queue() as j");
let qq = r.j || [];
const q1 = qq.find((x) => x.product_id === P1), q2 = qq.find((x) => x.product_id === P2);
check(qq.length === 2 && q1?.decision === "approved" && q1.open_feedback === 1 && q1.feedback === 1 && q1.checks_pass === 1 && q1.checks_fail === 0 && !!q1.last_at && q2?.decision === "declined" && q2.open_feedback === 0,
  "the review queue: decision, open feedback, checks and last activity per product", JSON.stringify(qq));
r = await one("authenticated", B, `select public.s3d_feedback_set(${FB}, 'fixed') as j`);
check(r.j?.status === "fixed" && r.j?.status_by === "second@example.com", "a manager marks feedback fixed", JSON.stringify(r));
r = await one("authenticated", E, "select public.s3d_review_queue() as j");
check(r.j?.find((x) => x.product_id === P1)?.open_feedback === 0, "fixed feedback no longer counts as open");
r = await one("authenticated", A, `select public.s3d_feedback_set(${FB}, 'open') as j`);
check(r.j?.status === "open", "an admin opens it again", JSON.stringify(r));
r = await as("authenticated", A, "select public.s3d_feedback_set(999999, 'fixed')");
check(/No such feedback/.test(r.error || ""), "unknown feedback says so", r.error);
r = await as("authenticated", C, "select public.s3d_review_queue()");
check(/Not allowed/.test(r.error || ""), "an inactive account can't read the review queue", r.error);
r = await as("authenticated", C, `select public.s3d_feedback_add('${P1}', 'Looks wrong')`);
check(/Not allowed/.test(r.error || ""), "an inactive account can't give feedback", r.error);
r = await as("authenticated", C, "select * from public.s3d_decisions");
check(!r.error && r.rows.length === 0, "an inactive account reads no decisions", JSON.stringify(r));
r = await as("authenticated", A, "select action, actor_email, target_id, target_label, detail from public.s3d_audit where action like 'product_%' order by id");
const pa = r.rows || [];
check(pa.length === 3 && pa[0].action === "product_declined" && pa[0].detail.note === "The freezer handle is the wrong colour" && pa[0].detail.decision.from === null
  && pa[1].action === "product_approved" && pa[1].detail.decision.from === "declined" && pa[1].detail.decision.to === "approved" && pa[1].actor_email === "second@example.com" && pa[1].target_label === "LG 655 L fridge"
  && pa[2].action === "product_declined" && pa[2].actor_email === "first@example.com" && pa[2].target_id === P2,
  "every decision is in the audit log, with who, the change and the reason", JSON.stringify(pa));
r = await as("service_role", null, `insert into public.s3d_decisions (product_id, decision) values ('${P1}', 'declined')`);
check(/check constraint/.test(r.error || ""), "the table itself refuses a decline with no reason", r.error);

// the photo bucket: private, staff upload into a product's folder, staff read; nothing else
const bk = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 's3d-feedback'")).rows[0];
check(bk?.public === false && Number(bk.file_size_limit) === 5242880 && bk.allowed_mime_types?.join() === "image/jpeg", "bucket s3d-feedback: private, 5 MB, JPEG only", JSON.stringify(bk));
const obj = `${P1}/7c9e6679-7425-40de-944b-e07fc1f90ae7.jpg`;
r = await as("authenticated", E, "insert into storage.objects (bucket_id, name) values ('s3d-feedback', $1)", [obj]);
check(!r.error, "a viewer uploads a photo into the product's folder", r.error);
for (const [who, uid, bucket, name, what] of [
  ["authenticated", E, "s3d-feedback", "notes.txt", "a file outside a product folder"],
  ["authenticated", E, "s3d-feedback", `${P1}/photo.png`, "a name that isn't <uuid>.jpg"],
  ["anon", null, "s3d-feedback", `${P1}/1c9e6679-7425-40de-944b-e07fc1f90ae7.jpg`, "anon"],
  ["authenticated", C, "s3d-feedback", `${P1}/2c9e6679-7425-40de-944b-e07fc1f90ae7.jpg`, "an inactive account"],
  ["authenticated", E, "other-app", `${P1}/3c9e6679-7425-40de-944b-e07fc1f90ae7.jpg`, "another app's bucket (no policy from this file)"],
]) {
  r = await as(who, uid, "insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, name]);
  check(/row-level security/.test(r.error || ""), `upload refused: ${what}`, r.error);
}
r = await as("authenticated", E, "select name from storage.objects where bucket_id = 's3d-feedback'");
check(r.rows?.length === 1 && r.rows[0].name === obj, "staff see the bucket's photos (to make signed links)", JSON.stringify(r));
r = await as("anon", null, "select name from storage.objects");
check(!r.error && r.rows.length === 0, "anon sees no photos", JSON.stringify(r));
r = await as("authenticated", C, "select name from storage.objects");
check(!r.error && r.rows.length === 0, "an inactive account sees no photos", JSON.stringify(r));
r = await as("authenticated", B, "update storage.objects set name = 'x' where bucket_id = 's3d-feedback'");
check(!r.error && r.affected === 0, "nobody renames a photo", JSON.stringify(r));
r = await as("authenticated", A, "delete from storage.objects where bucket_id = 's3d-feedback'");
check(!r.error && r.affected === 0, "nobody deletes a photo from the browser", JSON.stringify(r));
const sp = (await db.query("select policyname, roles::text, cmd, coalesce(qual, '') || coalesce(with_check, '') t from pg_policies where schemaname = 'storage' order by 1")).rows;
check(sp.length === 2 && sp.every((x) => /s3d-feedback/.test(x.t) && x.roles === "{authenticated}"), "the only storage policies are this bucket's two, for signed-in users", JSON.stringify(sp));

// ── the 3D tracker and notifications ──
// A admin, B manager, C inactive, E viewer (all from above). The item codes are made up.
// a person's notifications, oldest first; the store-feedback ones (from the review tests above) only when asked for
const notes = async (uid, feedback = false) => (await db.query(`select id, kind, title, body, link, item_id, actor, read_at from public.s3d_notifications
  where recipient = $1 and ($2 or kind <> 'feedback') order by id`, [uid, feedback])).rows;
const kinds = async (uid) => (await notes(uid)).map((x) => x.kind);
for (const [q, what] of [
  ["select * from public.s3d_tracker", "read s3d_tracker"],
  ["select * from public.s3d_tracker_log", "read s3d_tracker_log"],
  ["select * from public.s3d_notifications", "read s3d_notifications"],
  ["select * from public.s3d_notify_settings", "read s3d_notify_settings"],
  ["select public.s3d_tracker_import('[]'::jsonb)", "import the tracker"],
  ["select * from public.s3d_staff()", "list the staff"],
  ["select public.s3d_notify_read()", "mark notifications read"],
  ["select public.s3d_tracker_due()", "send the due-date notices"],
]) {
  r = await as("anon", null, q);
  check(/permission denied/.test(r.error || ""), `anon can't ${what}`, r.error);
}
// the made-up spreadsheet: three good rows, then a repeat, a row without a category and an unknown status
const SHEET = [
  { category: "Refrigerator", item_code: "TEST-FR-001", model: "Test fridge one", brand: "TestBrand", created_on: "2026-08-19", status: "not_started", prior_list: true, notes: "Sample note" },
  { category: "Refrigerator", item_code: "TEST-FR-002", model: "Test fridge two", brand: "TestBrand", status: "live", colour: "Test Black", product_id: P1, link: "https://3d.sangeetha.com/p/TEST-FR-002" },
  { category: "Air conditioner", item_code: "TEST-AC-001", model: "Test AC one", brand: "OtherBrand", status: "blocked", ref_list: true },
  { category: "Refrigerator", item_code: "TEST-FR-001", model: "A repeat", status: "live" },
  { category: "", item_code: "TEST-XX-001", status: "live" },
  { category: "Refrigerator", item_code: "TEST-FR-009", status: "maybe" },
];
r = await as("authenticated", E, "select public.s3d_tracker_import($1::jsonb, 'tracker.xlsx')", [JSON.stringify(SHEET)]);
check(/Not allowed/.test(r.error || ""), "a viewer can't import the tracker", r.error);
r = await as("authenticated", C, "select public.s3d_tracker_import($1::jsonb, 'tracker.xlsx')", [JSON.stringify(SHEET)]);
check(/Not allowed/.test(r.error || ""), "an inactive account can't import the tracker", r.error);
r = await one("authenticated", B, "select public.s3d_tracker_import($1::jsonb, 'tracker.xlsx') as j", [JSON.stringify(SHEET)]);
check(r.j?.added === 3 && r.j?.skipped === 3 && r.j?.total === 6 && r.j?.changed === 0 && r.j?.file_name === "tracker.xlsx", "a manager imports: 3 added, a repeat, a row without a category and an unknown status skipped", JSON.stringify(r));
const item = async (code) => (await db.query("select * from public.s3d_tracker where item_code = $1", [code])).rows[0];
const FR1 = (await item("TEST-FR-001")).id, FR2 = (await item("TEST-FR-002")).id, AC1 = (await item("TEST-AC-001")).id;
let it = await item("TEST-FR-001");
check(it.prior_list === true && it.ref_list === false && it.in_master === true && it.notes === "Sample note" && it.status === "not_started" && it.priority === "normal" && it.model === "Test fridge one",
  "the first row of a repeated code wins, with the sheet's fields", JSON.stringify(it));
check((await item("TEST-AC-001")).ref_list === true && (await item("TEST-FR-002")).link === "https://3d.sangeetha.com/p/TEST-FR-002", "flags and the 3D link are kept");
let na = await notes(A), nb = await notes(B), ne = await notes(E);
check(na.length === 1 && na[0].kind === "import" && /3 new, 0 changed/.test(na[0].title) && na[0].link === "#/tracker" && nb.length === 0 && ne.length === 0,
  "the import's summary goes to the other admins and managers (not the importer, not viewers)", JSON.stringify({ na, nb, ne }));
r = await as("authenticated", E, "select item_code, status from public.s3d_tracker order by id");
check(r.rows?.length === 3, "a viewer reads the tracker", JSON.stringify(r));
r = await as("authenticated", C, "select * from public.s3d_tracker");
check(!r.error && r.rows.length === 0, "an inactive account reads nothing of the tracker", JSON.stringify(r));
r = await as("authenticated", E, "select * from public.s3d_staff()");
check(r.rows?.map((x) => x.email).sort().join() === "first@example.com,second@example.com,viewer@example.com", "the staff list: active staff only", JSON.stringify(r.rows));
r = await as("authenticated", C, "select * from public.s3d_staff()");
check(!r.error && r.rows.length === 0, "an inactive account gets no staff list", JSON.stringify(r));

// direct writes are refused: everything goes through the functions
for (const [uid, q, what] of [
  [A, "insert into public.s3d_tracker (category, item_code) values ('Refrigerator', 'X')", "an admin can't insert an item directly"],
  [B, `update public.s3d_tracker set status = 'live' where id = ${FR1}`, "a manager can't change an item directly"],
  [A, "insert into public.s3d_notifications (recipient, kind, title) values ('" + E + "', 'live', 'x')", "nobody writes a notification directly"],
  [E, "update public.s3d_notifications set read_at = now()", "nobody changes a notification directly"],
  [E, `insert into public.s3d_tracker_log (item_id, kind, body) values (${FR1}, 'comment', 'x')`, "nobody writes the history directly"],
]) {
  r = await as("authenticated", uid, q);
  check(/permission denied/.test(r.error || ""), what, r.error);
}
r = await as("authenticated", E, `select public.s3d_tracker_update(${FR1}, '{"status":"in_progress"}')`);
check(/Not allowed/.test(r.error || ""), "a viewer can't change an item's status", r.error);

// assign, due date, priority, status
r = await one("authenticated", B, `select public.s3d_tracker_update(${FR1}, $1::jsonb) as j`, [JSON.stringify({ assignee: E, due_on: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), priority: "high" })]);
check(r.j?.assignee === E && r.j?.priority === "high" && !!r.j?.due_on, "a manager assigns an item to the viewer, with a due date and high priority", JSON.stringify(r));
ne = await notes(E);
check(ne.length === 1 && ne[0].kind === "assigned" && ne[0].title === "TEST-FR-001 (TestBrand) is assigned to you" && ne[0].link === `#/tracker/${FR1}` && ne[0].actor === B && ne[0].item_id === FR1,
  "the viewer is told it is assigned to them, with a link to the item", JSON.stringify(ne));
r = await as("authenticated", B, `select public.s3d_tracker_update(${FR1}, '{"assignee":"${C}"}')`);
check(/active user/.test(r.error || ""), "an item can't be assigned to an inactive account", r.error);
r = await as("authenticated", B, `select public.s3d_tracker_update(${FR1}, '{"due_on":"2020-01-01"}')`);
check(/from today on/.test(r.error || ""), "a due date in the past is refused", r.error);
r = await as("authenticated", B, `select public.s3d_tracker_update(${FR1}, '{"status":"done"}')`);
check(/Unknown status/.test(r.error || ""), "an unknown status is refused", r.error);
r = await one("authenticated", A, `select public.s3d_tracker_update(${FR1}, '{"status":"in_progress"}') as j`);
check(r.j?.status === "in_progress" && r.j?.assignee === E && r.j?.priority === "high", "an admin moves it to In progress; the owner and priority stay", JSON.stringify(r));
ne = await notes(E);
check(ne.length === 2 && ne[1].kind === "status" && ne[1].title === "TEST-FR-001 (TestBrand): In progress" && /from “Not started” to “In progress”/.test(ne[1].body),
  "its owner is told about the status change, from and to", JSON.stringify(ne[1]));
check((await kinds(B)).length === 0, "a manager who isn't its owner or a commenter isn't told about an ordinary status change");
let log = (await db.query("select kind, actor_email, from_value, to_value, how from public.s3d_tracker_log where item_id = $1 order by id", [FR1])).rows;
check(log.map((x) => x.kind).join() === "assignee,due,priority,status" && log[3].from_value === "not_started" && log[3].to_value === "in_progress" && log[3].actor_email === "first@example.com" && log[0].actor_email === "second@example.com" && log[0].to_value === E,
  "every change is in the item's history: who, from and to", JSON.stringify(log));
r = await one("authenticated", A, `select public.s3d_tracker_update(${FR1}, '{"status":"in_progress"}') as j`);
check((await notes(E)).length === 2 && (await db.query("select count(*)::int n from public.s3d_tracker_log where item_id = $1", [FR1])).rows[0].n === 4, "saving with no change writes no history and tells nobody");

// comments: the owner and everyone who commented hear about a new one, never its author
r = await one("authenticated", E, `select public.s3d_tracker_comment(${FR1}, '  Started on the doors.  ') as j`);
check(r.j?.body === "Started on the doors." && r.j?.kind === "comment", "a viewer comments on an item", JSON.stringify(r));
check((await notes(E)).length === 2 && (await kinds(A)).length === 1 && (await kinds(B)).length === 0, "the author of a comment isn't told about it (and nobody else follows it yet)");
await as("authenticated", B, `select public.s3d_tracker_comment(${FR1}, 'Thanks. The handle photo is in the shared folder.')`);
ne = await notes(E);
check(ne.length === 3 && ne[2].kind === "comment" && ne[2].title === "New comment on TEST-FR-001 (TestBrand)" && ne[2].body === "second: Thanks. The handle photo is in the shared folder.",
  "the owner hears about a manager's comment", JSON.stringify(ne[2]));
await as("authenticated", A, `select public.s3d_tracker_comment(${FR1}, 'Due on Friday, please.')`);
check((await kinds(E)).filter((k) => k === "comment").length === 2 && (await kinds(B)).filter((k) => k === "comment").length === 1 && (await kinds(A)).filter((k) => k === "comment").length === 0,
  "an admin's comment reaches the owner and the earlier commenter, not the admin");
r = await as("authenticated", E, `select public.s3d_tracker_comment(${FR1}, '   ')`);
check(/Write a comment/.test(r.error || ""), "an empty comment is refused", r.error);
r = await as("authenticated", C, `select public.s3d_tracker_comment(${FR1}, 'Hello')`);
check(/Not allowed/.test(r.error || ""), "an inactive account can't comment", r.error);
check((await item("TEST-FR-001")).comments === 3, "the item counts its comments");

// settings: a kind turned off isn't sent; live and blocked go to admins and managers too
r = await one("authenticated", E, "select public.s3d_notify_settings_set(array['status', 'status']) as j");
check(r.j?.off?.join() === "status", "the viewer turns off ordinary status changes", JSON.stringify(r));
r = await as("authenticated", E, "select public.s3d_notify_settings_set(array['nope'])");
check(/Unknown kind/.test(r.error || ""), "an unknown kind of notification is refused", r.error);
r = await as("authenticated", E, "select user_id, off from public.s3d_notify_settings");
check(r.rows?.length === 1 && r.rows[0].user_id === E, "each person reads only their own settings", JSON.stringify(r));
let before = (await notes(E)).length;
await as("authenticated", A, `select public.s3d_tracker_update(${FR1}, '{"status":"review"}')`);
check((await notes(E)).length === before, "settings respected: no status notice for the viewer who turned it off");
await as("authenticated", A, `select public.s3d_tracker_update(${FR1}, '{"status":"blocked"}')`);
ne = await notes(E); nb = await notes(B);
check(ne.at(-1).kind === "blocked" && ne.at(-1).title === "TEST-FR-001 (TestBrand) is blocked" && nb.at(-1).kind === "blocked" && !(await kinds(A)).includes("blocked"),
  "Blocked goes to the owner and the managers (not to the admin who did it)", JSON.stringify({ e: ne.at(-1), b: nb.at(-1) }));

// found on the site: s3d_tracker_live (admins and managers), once
r = await as("authenticated", E, `select public.s3d_tracker_live('[{"id":${FR1}}]')`);
check(/Not allowed/.test(r.error || ""), "a viewer can't mark items live", r.error);
r = await one("authenticated", B, `select public.s3d_tracker_live($1::jsonb) as n`, [JSON.stringify([{ id: FR1, product: P1, colour: "Shiny Steel" }, { id: FR2, product: P2 }, { id: "x" }])]);
check(r.n === 1, "items found on the site go live; one already live is left alone", JSON.stringify(r));
it = await item("TEST-FR-001");
check(it.status === "live" && it.product_id === P1 && it.colour === "Shiny Steel" && (await item("TEST-FR-002")).product_id === P1, "the product id and colour fill in only where empty", JSON.stringify(it));
r = await one("authenticated", B, `select public.s3d_tracker_live($1::jsonb) as n`, [JSON.stringify([{ id: FR1, product: P1 }])]);
check(r.n === 0, "doing it again changes nothing (idempotent)", JSON.stringify(r));
ne = await notes(E); na = await notes(A);
check(ne.at(-1).kind === "live" && ne.at(-1).title === "TEST-FR-001 (TestBrand) is live on the site" && /Found on the site/.test(ne.at(-1).body) && na.at(-1).kind === "live",
  "Live on site goes to the owner and the admins", JSON.stringify({ e: ne.at(-1), a: na.at(-1) }));
log = (await db.query("select how, from_value, to_value from public.s3d_tracker_log where item_id = $1 and kind = 'status' order by id desc limit 1", [FR1])).rows[0];
check(log?.how === "site" && log.from_value === "blocked" && log.to_value === "live", "the history says the site made it live", JSON.stringify(log));

// importing again: sheet fields change, team fields and comments stay, status changes notify nobody one by one
const SHEET2 = [
  { ...SHEET[0], status: "review", notes: "Sample note, changed" },
  SHEET[1],
  { category: "Washing machine", item_code: "TEST-WM-001", model: "Test washer", brand: "TestBrand", status: "not_started" },
];
const eBefore = (await notes(E)).length, bBefore = (await notes(B)).length;
r = await one("authenticated", A, "select public.s3d_tracker_import($1::jsonb, 'tracker 2.xlsx') as j", [JSON.stringify(SHEET2)]);
check(r.j?.added === 1 && r.j?.changed === 1 && r.j?.unchanged === 1 && r.j?.missing === 1 && r.j?.skipped === 0, "the second import: 1 new, 1 changed, 1 unchanged, 1 in the tracker but not the file", JSON.stringify(r));
it = await item("TEST-FR-001");
check(it.status === "review" && it.notes === "Sample note, changed" && it.assignee === E && it.priority === "high" && !!it.due_on && it.comments === 3,
  "the import changes the sheet's fields and keeps the owner, due date, priority and comments", JSON.stringify(it));
check(!!(await item("TEST-AC-001")), "an item the file doesn't have is kept");
check((await notes(E)).length === eBefore && (await notes(B)).length === bBefore + 1 && (await notes(B)).at(-1).kind === "import",
  "the import's status changes don't notify one by one; the manager gets its summary", JSON.stringify((await notes(B)).at(-1)));
log = (await db.query("select how, actor_email from public.s3d_tracker_log where item_id = $1 and kind = 'status' order by id desc limit 1", [FR1])).rows[0];
check(log?.how === "import" && log.actor_email === "first@example.com", "the history says the import changed the status, and who imported", JSON.stringify(log));
r = await as("authenticated", A, "select file_name, added, changed, unchanged, missing from public.s3d_tracker_imports order by id");
check(r.rows?.length === 2 && r.rows[1].file_name === "tracker 2.xlsx", "each import is listed", JSON.stringify(r.rows));

// past the due date: once per due date, to the owner (system notice: even when the owner opens the admin), or to the leads
const AC = (await item("TEST-AC-001")).id, WM = (await item("TEST-WM-001")).id;
await db.query("update public.s3d_tracker set due_on = current_date - 2 where id = $1", [AC]);
await db.query("update public.s3d_tracker set due_on = current_date - 1, assignee = $2 where id = $1", [WM, E]);
await db.query("update public.s3d_tracker set due_on = current_date - 5 where id = $1", [FR2]);   // live: built, so not overdue
const dueOf = async (uid) => (await notes(uid)).filter((x) => x.kind === "due");
r = await one("authenticated", E, "select public.s3d_tracker_due() as n");
check(r.n === 3, "the due check sends 3 notices: the unowned item to the admin and the manager, the owned one to its owner", JSON.stringify(r));
check((await dueOf(E)).length === 1 && (await dueOf(E))[0].title === "TEST-WM-001 (TestBrand) is past its due date" && (await dueOf(E))[0].actor === null && (await dueOf(A)).length === 1 && (await dueOf(B)).length === 1,
  "…each to the right people, from the system itself", JSON.stringify(await dueOf(E)));
r = await one("authenticated", A, "select public.s3d_tracker_due() as n");
check(r.n === 0, "the due check sends each notice once");
r = await one("service_role", null, "select public.s3d_tracker_due() as n");
check(r.n === 0 && !r.error, "the database itself (pg_cron, no user) may run the due check", JSON.stringify(r));
r = await as("authenticated", C, "select public.s3d_tracker_due()");
check(/Not allowed/.test(r.error || ""), "an inactive account can't run the due check", r.error);

// store feedback: admins and managers hear about it, as their settings allow
const fbA = (await notes(A, true)).filter((x) => x.kind === "feedback").length, fbB = (await notes(B, true)).filter((x) => x.kind === "feedback").length;
check(fbA >= 1 && fbB >= 1 && (await notes(A, true)).find((x) => x.kind === "feedback").link === `#/review/${P1}`, "the earlier store feedback reached the admin and the manager, with a link to its review", `${fbA} ${fbB}`);
check(!(await kinds(E)).includes("feedback"), "…and not the viewer who wrote it");
await as("authenticated", A, "select public.s3d_notify_settings_set(array['feedback'])");
await as("authenticated", E, `select public.s3d_feedback_add('${P2}', 'Sample: the label is blurry in the headset.', 'headset', null, 'Labels and logos')`);
check((await notes(A, true)).filter((x) => x.kind === "feedback").length === fbA && (await notes(B, true)).filter((x) => x.kind === "feedback").length === fbB + 1
  && /Labels and logos/.test((await notes(B, true)).at(-1).body), "new feedback: the manager is told; the admin who turned feedback off isn't");

// reading: each person sees and marks only their own
const eAll = await notes(E, true);
r = await as("authenticated", E, "select id, recipient from public.s3d_notifications");
check(r.rows?.length === eAll.length && r.rows.every((x) => x.recipient === E), "a user only sees their own notifications", `${r.rows?.length} of ${eAll.length}`);
r = await as("authenticated", A, "select id from public.s3d_notifications where recipient = $1", [E]);
check(!r.error && r.rows.length === 0, "an admin can't read someone else's notifications", JSON.stringify(r));
r = await one("authenticated", A, `select public.s3d_notify_read(${eAll[0].id}) as n`);
check(r.n === 0 && (await notes(E, true))[0].read_at === null, "nobody marks someone else's notification read");
r = await one("authenticated", E, `select public.s3d_notify_read(${eAll[0].id}) as n`);
check(r.n === 1 && (await notes(E, true))[0].read_at !== null, "a user marks one of theirs read");
r = await one("authenticated", E, "select public.s3d_notify_read() as n");
check(r.n === eAll.length - 1 && (await notes(E, true)).every((x) => x.read_at), "…and then all the rest", JSON.stringify(r));
r = await as("authenticated", C, "select id from public.s3d_notifications");
check(!r.error && r.rows.length === 0 && !(await kinds(C)).length, "the inactive account was never told anything", JSON.stringify(r));

// the audit log has the tracker's actions too
r = await as("authenticated", A, "select action from public.s3d_audit where target_type = 'tracker'");
const ta = new Set(r.rows.map((x) => x.action));
check(["tracker_import", "tracker_updated", "tracker_commented"].every((a) => ta.has(a)), "audit: tracker imports, changes and comments", [...ta].join());

// who may call what
const TFNS = ["s3d_staff()", "s3d_tracker_update(bigint,jsonb)", "s3d_tracker_comment(bigint,text)", "s3d_tracker_import(jsonb,text)", "s3d_tracker_live(jsonb)",
  "s3d_tracker_due()", "s3d_notify_read(bigint)", "s3d_notify_settings_set(text[])"];
const HELPERS = ["s3d_clean(text,int,boolean)", "s3d_need(text[])", "s3d_notify(uuid[],text,text,text,text,bigint,boolean)", "s3d_leads()", "s3d_watchers(bigint)", "s3d_tracker_label(text)"];
const tr = (await db.query(`select f, has_function_privilege('anon', 'public.' || f, 'execute') a, has_function_privilege('authenticated', 'public.' || f, 'execute') u
  from unnest($1::text[]) f`, [[...TFNS, ...HELPERS]])).rows;
check(!tr.some((x) => x.a), "anon may call none of the tracker and notification functions", JSON.stringify(tr.filter((x) => x.a)));
check(tr.filter((x) => x.u).map((x) => x.f).join() === TFNS.join(), "signed-in users may call the eight tracker functions, not the helpers", JSON.stringify(tr));
const pub = (await db.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime'")).rows;
check(pub.length === 1 && pub[0].tablename === "s3d_notifications", "Realtime: the notifications table is in supabase_realtime's publication", JSON.stringify(pub));

// and once more with all this data in it
await db.exec(sql);
r = await as("anon", null, "select * from public.s3d_live()");
check(r.rows?.length === 2, "schema.sql runs again with reviews in it, and keeps them", JSON.stringify(r));
check((await db.query("select count(*)::int n from public.s3d_tracker")).rows[0].n === 4 && (await notes(E, true)).length === eAll.length && (await item("TEST-FR-001")).assignee === E,
  "…and keeps the tracker, its owners and the notifications");
check((await db.query("select count(*)::int n from pg_publication_tables where pubname = 'supabase_realtime'")).rows[0].n === 1, "…and adds the notifications table to the publication only once");

// grants as listed by Postgres
const g = (await db.query(`select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants
  where table_schema='public' and table_name like 's3d_%' and grantee in ('anon','authenticated') group by 1,2 order by 1,2`)).rows;
console.log("table grants:", g.map((x) => `${x.grantee}:${x.table_name}=${x.p}`).join("  "));
check(!g.some((x) => x.grantee === "anon"), "anon has no table grants");
const NEW = ["s3d_tracker", "s3d_tracker_log", "s3d_tracker_imports", "s3d_notifications", "s3d_notify_settings"];
check(NEW.every((t) => g.find((x) => x.grantee === "authenticated" && x.table_name === t)?.p === "SELECT"), "authenticated may only read the five tracker and notification tables");
const sr = (await db.query(`select table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'service_role' and table_name = any($1) group by 1`, [NEW])).rows;
check(sr.length === 5 && sr.every((x) => x.p === "DELETE,INSERT,SELECT,UPDATE"), "service_role has exactly select, insert, update and delete on them", JSON.stringify(sr));
const rls = (await db.query("select relname, relrowsecurity from pg_class where relname like 's3d_%' and relkind='r'")).rows;
check(rls.length === 14 && rls.every((x) => x.relrowsecurity), "row level security is on for all fourteen tables", rls.map((x) => x.relname).join());
const tp = (await db.query("select tablename, cmd, roles::text r from pg_policies where tablename = any($1) order by 1", [NEW])).rows;
check(tp.length === 5 && tp.every((x) => x.cmd === "SELECT" && x.r === "{authenticated}"), "one read policy per new table, for signed-in users only", JSON.stringify(tp));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
