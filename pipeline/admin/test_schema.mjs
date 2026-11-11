// Runs schema.sql in PGlite (Postgres 17 in WebAssembly) behind a small stand-in for Supabase's auth schema,
// roles and Storage tables, twice (it must be re-runnable), then walks through the sign-in, invite, pairing,
// tracking, product review (approve, decline, feedback, checklist, s3d_live, the photo bucket) and permission
// cases as anon, admin, manager, viewer and a pending account. Nothing touches Supabase.
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
check(true, "schema.sql ran (first time)");
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

// and once more with all this data in it
await db.exec(sql);
r = await as("anon", null, "select * from public.s3d_live()");
check(r.rows?.length === 2, "schema.sql runs again with reviews in it, and keeps them", JSON.stringify(r));

// grants as listed by Postgres
const g = (await db.query(`select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants
  where table_schema='public' and table_name like 's3d_%' and grantee in ('anon','authenticated') group by 1,2 order by 1,2`)).rows;
console.log("table grants:", g.map((x) => `${x.grantee}:${x.table_name}=${x.p}`).join("  "));
check(!g.some((x) => x.grantee === "anon"), "anon has no table grants");
const rls = (await db.query("select relname, relrowsecurity from pg_class where relname like 's3d_%' and relkind='r'")).rows;
check(rls.length === 9 && rls.every((x) => x.relrowsecurity), "row level security is on for all nine tables", rls.map((x) => x.relname).join());
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
