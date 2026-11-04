// Runs schema.sql in PGlite (Postgres 17 in WebAssembly) behind a small stand-in for Supabase's auth schema
// and roles, twice (it must be re-runnable), then walks through the sign-in, invite, pairing, tracking and
// permission cases as anon, admin, manager, viewer and a pending account. Nothing touches Supabase.
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

// grants as listed by Postgres
const g = (await db.query(`select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants
  where table_schema='public' and table_name like 's3d_%' and grantee in ('anon','authenticated') group by 1,2 order by 1,2`)).rows;
console.log("table grants:", g.map((x) => `${x.grantee}:${x.table_name}=${x.p}`).join("  "));
check(!g.some((x) => x.grantee === "anon"), "anon has no table grants");
const rls = (await db.query("select relname, relrowsecurity from pg_class where relname like 's3d_%' and relkind='r'")).rows;
check(rls.length === 6 && rls.every((x) => x.relrowsecurity), "row level security is on for all six tables");
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
