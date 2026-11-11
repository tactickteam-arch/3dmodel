// Runs schema.sql then tools.sql in PGlite (Postgres 17 in WebAssembly) behind a small stand-in for Supabase's
// auth schema, Storage tables and roles, twice (both must be re-runnable), then walks through product requests,
// playlists, showing a product on a paired device and the profile name, as anon, admin, manager, viewer, an
// account still waiting for approval and one still on its one-time password. Nothing touches Supabase.
// setup once: cd .work/admin && npm i @electric-sql/pglite      (the work folder is gitignored)
// usage: node pipeline/admin/test_tools.mjs [schema.sql] [tools.sql]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lib = path.join(site, ".work/admin/node_modules/@electric-sql/pglite/dist/index.js");
if (!fs.existsSync(lib)) { console.error("PGlite isn't installed: cd .work/admin && npm i @electric-sql/pglite"); process.exit(2); }
const { PGlite } = await import(pathToFileURL(lib).href);
const schema = fs.readFileSync(process.argv[2] || path.join(site, "pipeline/admin/schema.sql"), "utf8");
const tools = fs.readFileSync(process.argv[3] || path.join(site, "pipeline/admin/tools.sql"), "utf8");
const db = new PGlite();
let failed = 0, passed = 0;
const check = (ok, msg, extra = "") => { if (ok) passed++; else failed++; console.log(`${ok ? "ok  " : "FAIL"} ${msg}${ok || !extra ? "" : " :: " + extra}`); };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email varchar(255), created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Storage's own tables, for schema.sql's feedback-photo bucket
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  -- what Supabase used to do for every new table and function: the files must take these away again
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

// tools.sql before schema.sql stops with a clear message and leaves nothing behind
let early = null;
try { await db.exec(tools); } catch (e) { early = e.message; }
await db.exec("rollback").catch(() => {});
check(/Run pipeline\/admin\/schema\.sql first/.test(early || "") && !(await db.query("select to_regclass('public.s3d_requests') t")).rows[0].t, "tools.sql alone stops: run schema.sql first", early);

await db.exec(schema);
await db.exec(tools);
check(true, "schema.sql then tools.sql ran (first time)");
await db.exec(schema);
await db.exec(tools);
check(true, "both ran again (re-runnable)");

const A = "00000000-0000-4000-8000-00000000000a", M = "00000000-0000-4000-8000-00000000000b", V = "00000000-0000-4000-8000-00000000000c";
const P = "00000000-0000-4000-8000-00000000000d", O = "00000000-0000-4000-8000-00000000000e", X = "00000000-0000-4000-8000-00000000000f";
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
const denied = (r) => /permission denied/.test(r.error || "");
const notAllowed = (r) => /Not allowed/.test(r.error || "");

// ── the people: admin, manager, viewer (with a store), one waiting for approval, one on its one-time password,
//    and one turned off ──
for (const [id, email] of [[A, "admin@example.com"], [M, "manager@example.com"], [V, "viewer@example.com"], [P, "pending@example.com"], [O, "onetime@example.com"], [X, "former@example.com"]])
  await db.query("insert into auth.users (id, email, created_at) values ($1, $2, now() - interval '1 day')", [id, email]);
await db.exec(`insert into public.s3d_stores (name, city) values ('Store One', 'Bengaluru')`);
const S1 = (await db.query("select id from public.s3d_stores")).rows[0].id;
await db.query(`insert into public.s3d_profiles (user_id, email, full_name, role, status, password_set, store_id) values
  ($1, 'admin@example.com', 'Ada Admin', 'admin', 'active', true, null),
  ($2, 'manager@example.com', 'Manu Manager', 'manager', 'active', true, $7),
  ($3, 'viewer@example.com', 'Vee Viewer', 'viewer', 'active', true, $7),
  ($4, 'pending@example.com', null, 'viewer', 'pending', true, null),
  ($5, 'onetime@example.com', null, 'manager', 'active', false, $7),
  ($6, 'former@example.com', 'Former', 'admin', 'inactive', true, null)`, [A, M, V, P, O, X, S1]);

// ── anon: no table, only the two site functions ──
const TABLES = ["s3d_requests", "s3d_request_comments", "s3d_playlists", "s3d_device_screens"];
for (const t of TABLES) {
  check(denied(await as("anon", null, `select * from public.${t}`)), `anon can't read ${t}`);
  check(denied(await as("anon", null, `delete from public.${t}`)), `anon can't delete from ${t}`);
}
check(denied(await as("anon", null, "insert into public.s3d_requests (sangeetha_id, brand) values ('21330', 'X')")), "anon can't insert a request directly");
for (const [fn, q] of [
  ["s3d_request_add", "select public.s3d_request_add('21330', 'Haier')"],
  ["s3d_request_status", "select public.s3d_request_status(1, 'accepted')"],
  ["s3d_request_comment", "select public.s3d_request_comment(1, 'hi')"],
  ["s3d_playlist_save", "select public.s3d_playlist_save(null, 'x', 20, 'turn', '[]')"],
  ["s3d_playlist_delete", "select public.s3d_playlist_delete(1)"],
  ["s3d_device_show", "select public.s3d_device_show(1, 'home')"],
  ["s3d_my_name", "select public.s3d_my_name('x')"],
  ["s3d_clean", "select public.s3d_clean('x', 3)"],
  ["s3d_need", "select public.s3d_need()"],
]) check(denied(await as("anon", null, q)), `anon can't call ${fn}`);
check(denied(await as("authenticated", A, "select public.s3d_need()")) && denied(await as("authenticated", A, "select public.s3d_clean('x', 3)")), "staff can't call the helpers s3d_need and s3d_clean");

// ── product requests ──
let r = await one("authenticated", V, "select public.s3d_request_add('https://sangeetha.com/product-details/haier-596l-side-by-side/21330?utm=x#top', ' Haier ', 'HES-690GK', 'Graphite Black', 'high', current_date + 7, E'Line one\\nline two\\u0007') as j");
const R1 = r.j?.id;
check(r.j?.sangeetha_id === "21330" && r.j?.link === "https://www.sangeetha.com/product-details/haier-596l-side-by-side/21330" && r.j?.brand === "Haier" && r.j?.status === "requested",
  "viewer asks for a product by its sangeetha.com link: the Product ID is the number at the end, the link is cleaned", JSON.stringify(r));
check(r.j?.notes === "Line one\nline two" && r.j?.requested_by === V && r.j?.requested_by_email === "viewer@example.com" && r.j?.requested_by_name === "Vee Viewer" && r.j?.store_id === S1,
  "the request carries who asked, their store, and the notes without control characters", JSON.stringify(r.j));
r = await as("authenticated", M, "select public.s3d_request_add('21330', 'Haier')");
check(/already requested \(request #\d+\)/.test(r.error || ""), "the same Product ID can't be requested twice while open", r.error);
r = await one("authenticated", M, "select public.s3d_request_add('20623', 'Haier', null, null, 'urgent') as j");
const R2 = r.j?.id;
check(!!R2 && r.j.priority === "urgent" && r.j.link === null, "manager asks by the Product ID alone", JSON.stringify(r));
for (const [what, args, want] of [
  ["a link with no number at the end", "'https://www.sangeetha.com/product-details/haier', 'Haier'", /Couldn’t find the Product ID/],
  ["another shop's link", "'https://example.com/product/12345', 'Haier'", /Give the Sangeetha Product ID/],
  ["no brand", "'12345', '   '", /Give the brand/],
  ["an unknown priority", "'12345', 'LG', null, null, 'whenever'", /Unknown priority/],
  ["a needed-by date in the past", "'12345', 'LG', null, null, 'normal', current_date - 10", /needed-by date/],
  ["a too-short Product ID", "'12', 'LG'", /Give the Sangeetha Product ID/],
]) { r = await as("authenticated", V, `select public.s3d_request_add(${args})`); check(want.test(r.error || ""), `a request with ${what} is refused`, r.error); }
check(notAllowed(await as("authenticated", P, "select public.s3d_request_add('12345', 'LG')")), "an account waiting for approval can't ask");
check(notAllowed(await as("authenticated", O, "select public.s3d_request_add('12345', 'LG')")), "an account still on its one-time password can't ask");
check(notAllowed(await as("authenticated", X, "select public.s3d_request_add('12345', 'LG')")), "a turned-off account can't ask");
r = await as("authenticated", P, "select id from public.s3d_requests");
check(!r.error && r.rows.length === 0, "an account waiting for approval sees no requests", JSON.stringify(r));
r = await as("authenticated", V, "select id, requested_by_email from public.s3d_requests order by id");
check(r.rows?.length === 2, "a viewer reads every request", JSON.stringify(r));
check(denied(await as("authenticated", V, "update public.s3d_requests set status = 'live'")), "nobody changes a request directly (viewer)");
check(denied(await as("authenticated", A, "update public.s3d_requests set status = 'live'")), "nobody changes a request directly (admin)");
check(denied(await as("authenticated", A, "insert into public.s3d_requests (sangeetha_id, brand) values ('55555', 'X')")), "nobody inserts a request directly (admin)");
check(denied(await as("authenticated", A, `delete from public.s3d_requests where id = ${R1}`)), "nobody deletes a request directly");

// comments: anyone active; status: admins and managers
r = await one("authenticated", V, `select public.s3d_request_comment(${R1}, ' Customers ask for the black one. ') as j`);
check(r.j?.body === "Customers ask for the black one." && r.j?.author_name === "Vee Viewer", "a viewer comments on a request", JSON.stringify(r));
check(/Write a comment first/.test((await as("authenticated", V, `select public.s3d_request_comment(${R1}, '   ')`)).error || ""), "an empty comment is refused");
check(/No such request/.test((await as("authenticated", V, "select public.s3d_request_comment(99999, 'x')")).error || ""), "a comment on a missing request is refused");
check(notAllowed(await as("authenticated", P, `select public.s3d_request_comment(${R1}, 'x')`)), "an account waiting for approval can't comment");
check(notAllowed(await as("authenticated", V, `select public.s3d_request_status(${R1}, 'accepted')`)), "a viewer can't change a request's status");
check(notAllowed(await as("authenticated", O, `select public.s3d_request_status(${R1}, 'accepted')`)), "a manager still on the one-time password can't change a status");
r = await one("authenticated", M, `select public.s3d_request_status(${R1}, 'accepted') as j`);
check(r.j?.status === "accepted", "a manager accepts a request", JSON.stringify(r));
r = await one("authenticated", A, `select public.s3d_request_status(${R1}, 'building') as j`);
check(r.j?.status === "building", "an admin moves it to building", JSON.stringify(r));
check(/Say why/.test((await as("authenticated", A, `select public.s3d_request_status(${R2}, 'declined', '  ')`)).error || ""), "declining needs a reason");
check(/Unknown status/.test((await as("authenticated", A, `select public.s3d_request_status(${R2}, 'done')`)).error || ""), "an unknown status is refused");
r = await one("authenticated", A, `select public.s3d_request_status(${R2}, 'declined', 'Not sold any more') as j`);
check(r.j?.status === "declined" && r.j?.reason === "Not sold any more", "an admin declines a request with a reason", JSON.stringify(r));
r = await one("authenticated", V, "select public.s3d_request_add('20623', 'Haier') as j");
const R3 = r.j?.id;
check(!!R3, "a declined Product ID can be asked for again", JSON.stringify(r));
check(/already has an open request/.test((await as("authenticated", A, `select public.s3d_request_status(${R2}, 'requested')`)).error || ""), "re-opening a declined request is refused while another is open for it");
check(/isn’t a catalogue product id/.test((await as("authenticated", A, `select public.s3d_request_status(${R1}, 'live', null, 'Bad Id!')`)).error || ""), "a bad catalogue product id is refused");
r = await one("authenticated", A, `select public.s3d_request_status(${R1}, 'live', null, 'haier-hes-690gk') as j`);
check(r.j?.status === "live" && r.j?.product_id === "haier-hes-690gk", "an admin marks it live, with its catalogue product", JSON.stringify(r));
r = await as("authenticated", V, `select status_from, status_to, body, author_email from public.s3d_request_comments where request_id = ${R1} order by id`);
const hist = r.rows?.map((x) => x.status_to ? `${x.status_from}>${x.status_to}` : "comment").join(",");
check(hist === "comment,requested>accepted,accepted>building,building>live", "the request's history: the comment and each status change, in order", hist);
r = await as("authenticated", V, `select body from public.s3d_request_comments where request_id = ${R2} and status_to = 'declined'`);
check(r.rows?.[0]?.body === "Not sold any more", "a decline's reason is in the history");
check(denied(await as("authenticated", V, `insert into public.s3d_request_comments (request_id, body) values (${R1}, 'x')`)), "nobody writes a comment directly");

// ── playlists ──
const items = JSON.stringify([{ product: "haier-hes-690gk", finish: "graphite-black" }, { product: "lg-glt2216wyro" }, { product: "whirlpool-22461", finish: "" }]);
check(notAllowed(await as("authenticated", V, "select public.s3d_playlist_save(null, 'Viewer list', 20, 'turn', $1::jsonb)", [items])), "a viewer can't make a playlist");
r = await one("authenticated", M, "select public.s3d_playlist_save(null, ' Weekend fridges ', 15, 'doors', $1::jsonb) as j", [items]);
const L1 = r.j?.id;
check(r.j?.name === "Weekend fridges" && r.j?.seconds === 15 && r.j?.show === "doors" && r.j?.items?.length === 3 && r.j.items[1].finish === null && r.j.items[2].finish === null && r.j?.created_by_email === "manager@example.com",
  "a manager makes a playlist (colours kept, blank ones cleared)", JSON.stringify(r));
for (const [what, args, want] of [
  ["no name", "null, '  ', 20, 'turn', '[]'", /Give the playlist a name/],
  ["5 seconds a product", "null, 'x', 5, 'turn', '[]'", /from 8 to 600/],
  ["an unknown way to show it", "null, 'x', 20, 'dance', '[]'", /Unknown way/],
  ["a bad product id", `null, 'x', 20, 'turn', '[{"product":"OK"},{"product":"Bad Id"}]'`, /Product 1 in the list/],
  ["a bad colour", `null, 'x', 20, 'turn', '[{"product":"ok-1","finish":"Graphite Black"}]'`, /Product 1 in the list/],
  ["a list that isn't a list", `null, 'x', 20, 'turn', '{"product":"ok"}'`, /product list is missing/],
  ["61 products", `null, 'x', 20, 'turn', '${JSON.stringify(Array.from({ length: 61 }, () => ({ product: "a" })))}'`, /At most 60/],
  ["a name already used", "null, 'weekend FRIDGES', 20, 'turn', '[]'", /already a playlist called/],
]) { r = await as("authenticated", A, `select public.s3d_playlist_save(${args})`); check(want.test(r.error || ""), `a playlist with ${what} is refused`, r.error); }
r = await one("authenticated", A, `select public.s3d_playlist_save(${L1}, 'Weekend fridges', 20, 'features', $1::jsonb) as j`, [JSON.stringify([{ product: "lg-glt2216wyro" }])]);
check(r.j?.seconds === 20 && r.j?.show === "features" && r.j?.items?.length === 1 && r.j?.updated_by_email === "admin@example.com", "an admin changes the playlist", JSON.stringify(r));
r = await one("authenticated", A, "select public.s3d_playlist_save(null, 'Spare', 30, 'still', '[]') as j");
const L2 = r.j?.id;
check(/No such playlist/.test((await as("authenticated", A, "select public.s3d_playlist_save(99999, 'x', 20, 'turn', '[]')")).error || ""), "saving a missing playlist is refused");
check(denied(await as("authenticated", A, `update public.s3d_playlists set name = 'x' where id = ${L1}`)), "nobody changes a playlist directly");
r = await as("authenticated", V, "select id, name from public.s3d_playlists order by id");
check(r.rows?.length === 2, "a viewer reads the playlists", JSON.stringify(r));
r = await one("anon", null, `select public.s3d_playlist_get(${L1}) as j`);
check(r.j?.name === "Weekend fridges" && r.j?.items?.[0]?.product === "lg-glt2216wyro" && r.j?.seconds === 20 && r.j?.show === "features" && !("created_by_email" in (r.j || {})),
  "anon reads one playlist by id (no staff emails in it)", JSON.stringify(r));
r = await one("anon", null, "select public.s3d_playlist_get(99999) as j");
check(r.j === null && !r.error, "anon: a missing playlist is null", JSON.stringify(r));

// ── showing something on a paired device ──
const dev = (await one("authenticated", A, "insert into public.s3d_devices (name, store_id) values ('Headset 1', $1) returning id, pair_code", [S1]));
const D1 = dev.id;
check(/Pair this device first/.test((await as("authenticated", A, `select public.s3d_device_show(${D1}, 'home')`)).error || ""), "an unpaired device can't be sent anything");
const KEY = (await one("anon", null, "select public.s3d_pair($1, 'quest') as j", [dev.pair_code])).j?.device;
check(/^[0-9a-f-]{36}$/.test(KEY || ""), "the device pairs");
r = await one("anon", null, "select public.s3d_device_poll($1, null, 'catalogue') as j", [KEY]);
check(r.j?.ok === true && r.j?.cmd === null, "the device's first poll: nothing to show", JSON.stringify(r));
r = await one("authenticated", A, `select device_id, showing, seen_at from public.s3d_device_screens where device_id = ${D1}`);
check(r.showing === "catalogue" && !!r.seen_at, "its poll records what it shows and when it was seen", JSON.stringify(r));
r = await one("anon", null, "select public.s3d_device_poll($1, null, 'catalogue') as j", ["11111111-2222-4333-8444-555555555555"]);
check(r.j?.ok === false, "an unknown device key gets ok: false", JSON.stringify(r));
r = await one("anon", null, "select public.s3d_device_poll(null) as j");
check(r.j?.ok === false, "no device key gets ok: false");
check(notAllowed(await as("authenticated", V, `select public.s3d_device_show(${D1}, 'product', 'haier-hes-690gk')`)), "a viewer can't send a product to a device");
check(notAllowed(await as("authenticated", P, `select public.s3d_device_show(${D1}, 'home')`)), "an account waiting for approval can't send");
for (const [what, args, want] of [
  ["no product", `${D1}, 'product', null`, /Choose a product/],
  ["a bad colour", `${D1}, 'product', 'haier-hes-690gk', 'Graphite Black!'`, /Unknown colour/],
  ["a missing playlist", `${D1}, 'playlist', null, null, 99999`, /Choose a playlist/],
  ["an unknown kind", `${D1}, 'movie'`, /Unknown thing to show/],
  ["a missing device", "99999, 'home'", /No such device/],
]) { r = await as("authenticated", M, `select public.s3d_device_show(${args})`); check(want.test(r.error || ""), `sending ${what} is refused`, r.error); }
r = await one("authenticated", M, `select public.s3d_device_show(${D1}, 'product', 'Haier-HES-690GK', 'graphite-black') as j`);
const CMD1 = r.j?.cmd;
check(r.j?.kind === "product" && r.j?.product_id === "haier-hes-690gk" && r.j?.finish === "graphite-black" && r.j?.sent_by_email === "manager@example.com" && r.j?.picked_at === null && !!CMD1,
  "a manager sends a product and colour to the paired device", JSON.stringify(r));
r = await one("anon", null, "select public.s3d_device_poll($1, null, 'catalogue') as j", [KEY]);
check(r.j?.cmd === CMD1 && r.j?.kind === "product" && r.j?.product === "haier-hes-690gk" && r.j?.finish === "graphite-black", "the device's next poll gets it", JSON.stringify(r));
r = await one("anon", null, "select public.s3d_device_poll($1, $2, 'product:haier-hes-690gk') as j", [KEY, CMD1]);
r = await one("authenticated", V, `select picked_at, showing from public.s3d_device_screens where device_id = ${D1}`);
check(!!r.picked_at && r.showing === "product:haier-hes-690gk", "the device says it opened it; a viewer sees that and what it shows", JSON.stringify(r));
await one("anon", null, "select public.s3d_device_poll($1, null, '<script>') as j", [KEY]);
r = await one("authenticated", A, `select showing from public.s3d_device_screens where device_id = ${D1}`);
check(r.showing === null, "a nonsense 'showing' is not stored", JSON.stringify(r));
r = await one("authenticated", A, `select public.s3d_device_show(${D1}, 'playlist', null, null, ${L1}) as j`);
check(r.j?.kind === "playlist" && r.j?.playlist_id === L1 && r.j?.cmd !== CMD1 && r.j?.picked_at === null && r.j?.product_id === null, "an admin sends a playlist: a new command, not picked up yet", JSON.stringify(r));
r = await one("anon", null, "select public.s3d_device_poll($1) as j", [KEY]);
check(r.j?.kind === "playlist" && r.j?.playlist === L1, "the device gets the playlist", JSON.stringify(r));
check(denied(await as("authenticated", A, `update public.s3d_device_screens set kind = 'home' where device_id = ${D1}`)), "nobody changes a device's screen directly");
r = await as("authenticated", M, `select public.s3d_playlist_delete(${L1})`);
check(!r.error, "a manager deletes the playlist the device is playing", r.error);
r = await one("anon", null, "select public.s3d_device_poll($1) as j", [KEY]);
check(r.j?.ok === true && r.j?.cmd === null, "a deleted playlist is no longer sent to the device", JSON.stringify(r));
check(notAllowed(await as("authenticated", V, `select public.s3d_playlist_delete(${L2})`)), "a viewer can't delete a playlist");
check(/No such playlist/.test((await as("authenticated", A, `select public.s3d_playlist_delete(${L1})`)).error || ""), "deleting it twice says so");
r = await one("authenticated", A, `select public.s3d_device_show(${D1}, 'home') as j`);
check(r.j?.kind === "home", "an admin sends the device back to the catalogue");
// a new pairing code: the old key stops working, and what was sent before isn't for the newly paired device
const code2 = (await one("authenticated", A, `select public.s3d_device_reset(${D1}) as j`)).j?.pair_code;
r = await one("anon", null, "select public.s3d_device_poll($1) as j", [KEY]);
check(r.j?.ok === false, "after a new pairing code the old device key gets ok: false", JSON.stringify(r));
await db.exec("select pg_sleep(0.01)");
const KEY2 = (await one("anon", null, "select public.s3d_pair($1, 'quest') as j", [code2])).j?.device;
r = await one("anon", null, "select public.s3d_device_poll($1) as j", [KEY2]);
check(r.j?.ok === true && r.j?.cmd === null, "the newly paired device doesn't get what was sent before it paired", JSON.stringify(r));
const seen = (await db.query(`select last_seen_at from public.s3d_devices where id = ${D1}`)).rows[0].last_seen_at;
check(!!seen, "polling keeps the device's last-seen time");
// deleting the device removes its screen row
await as("authenticated", A, `delete from public.s3d_devices where id = ${D1}`);
check((await db.query(`select count(*)::int n from public.s3d_device_screens where device_id = ${D1}`)).rows[0].n === 0, "deleting a device removes its screen row");

// ── your own name ──
r = await one("authenticated", V, "select public.s3d_my_name('  Veena V.  ') as j");
check(r.j?.full_name === "Veena V.", "a viewer changes their own name", JSON.stringify(r));
r = await one("authenticated", M, "select public.s3d_my_name(null) as j");
check(r.j?.full_name === null && (await db.query("select full_name from public.s3d_profiles where user_id = $1", [M])).rows[0].full_name === null, "clearing your name is allowed");
check(notAllowed(await as("authenticated", P, "select public.s3d_my_name('Sneaky')")), "an account waiting for approval can't set a name");
check((await db.query("select full_name from public.s3d_profiles where user_id = $1", [P])).rows[0].full_name === null, "…and its name is unchanged");
check((await db.query("select full_name from public.s3d_profiles where user_id = $1", [A])).rows[0].full_name === "Ada Admin", "setting your name changes nobody else's");

// ── the audit log has every staff action, with who did it ──
const au = (await db.query("select action, actor_email, target_type, target_label, detail from public.s3d_audit order by id")).rows;
const has = (action) => au.filter((a) => a.action === action);
for (const [action, n] of [["request_created", 3], ["request_status", 4], ["request_commented", 1], ["playlist_created", 2], ["playlist_updated", 1], ["playlist_deleted", 1], ["device_show", 3], ["user_updated", 2]])
  check(has(action).length === n, `audit: ${n} × ${action}`, `${has(action).length}: ${JSON.stringify(has(action).map((a) => a.detail))}`);
check(has("request_created")[0]?.actor_email === "viewer@example.com" && has("request_created")[0]?.target_label === "Haier HES-690GK (21330)", "audit: who asked, and the request's label", JSON.stringify(has("request_created")[0]));
check(has("request_status").some((a) => a.detail?.status?.to === "declined" && a.detail?.reason === "Not sold any more"), "audit: a decline carries its reason");
check(has("request_status").some((a) => a.detail?.product === "haier-hes-690gk"), "audit: going live carries the catalogue product");
check(has("device_show")[0]?.actor_email === "manager@example.com" && has("device_show")[0]?.detail?.product === "haier-hes-690gk" && has("device_show")[1]?.detail?.playlist === "Weekend fridges", "audit: what was sent to which device, by whom");
check(has("playlist_updated")[0]?.detail?.show?.to === "features" && has("playlist_updated")[0]?.detail?.products?.to === 1, "audit: a playlist change lists what changed", JSON.stringify(has("playlist_updated")[0]?.detail));
check(has("user_updated").some((a) => a.actor_email === "viewer@example.com" && a.detail?.to === "Veena V."), "audit: a name change, by the person themself");
check(!au.some((a) => /poll|picked/.test(a.action)), "a device's polls write no audit rows");

// ── grants and row level security, as Postgres lists them ──
const g = (await db.query(`select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants
  where table_schema = 'public' and table_name = any($1) and grantee in ('anon', 'authenticated', 'service_role') group by 1, 2 order by 1, 2`, [TABLES])).rows;
console.log("  table grants:", g.map((x) => `${x.grantee}:${x.table_name}=${x.p}`).join("  "));
check(!g.some((x) => x.grantee === "anon"), "anon has no grant on the tools tables");
check(TABLES.every((t) => g.find((x) => x.grantee === "authenticated" && x.table_name === t)?.p === "SELECT"), "authenticated may only read the tools tables");
check(TABLES.every((t) => g.find((x) => x.grantee === "service_role" && x.table_name === t)?.p === "DELETE,INSERT,SELECT,UPDATE"), "service_role has exactly select, insert, update and delete");
const rls = (await db.query("select relname, relrowsecurity from pg_class where relname = any($1) and relkind = 'r'", [TABLES])).rows;
check(rls.length === 4 && rls.every((x) => x.relrowsecurity), "row level security is on for all four tables");
const pol = (await db.query("select tablename, cmd, roles::text r from pg_policies where tablename = any($1) order by 1", [TABLES])).rows;
check(pol.length === 4 && pol.every((x) => x.cmd === "SELECT" && x.r === "{authenticated}"), "one read policy per table, for signed-in staff only", JSON.stringify(pol));
const fx = (await db.query(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') auth
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1) order by 1`,
  [["s3d_clean", "s3d_need", "s3d_request_add", "s3d_request_status", "s3d_request_comment", "s3d_playlist_save", "s3d_playlist_delete", "s3d_playlist_get", "s3d_device_show", "s3d_device_poll", "s3d_my_name"]])).rows;
console.log("  functions:", fx.map((f) => `${f.proname}=${f.anon ? "anon," : ""}${f.auth ? "auth" : ""}`).join("  "));
check(fx.filter((f) => f.anon).map((f) => f.proname).join(",") === "s3d_device_poll,s3d_playlist_get", "anon may call only s3d_playlist_get and s3d_device_poll");
check(fx.filter((f) => !f.auth).map((f) => f.proname).join(",") === "s3d_clean,s3d_need", "staff may call every tools function except the two helpers");
check(fx.length === 11, "all eleven tools functions exist");
const defs = (await db.query(`select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') cfg from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 's3d_%' and p.proname <> 's3d_clean'`)).rows;
check(defs.filter((d) => ["s3d_request_add", "s3d_device_poll", "s3d_playlist_get", "s3d_my_name"].includes(d.proname)).every((d) => d.prosecdef && /search_path=public/.test(d.cfg)), "the functions are security definer with a fixed search_path");
// only s3d_ objects were made in public
const stray = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname not like 's3d_%'`)).rows;
check(stray.length === 0, "nothing outside s3d_ in public", stray.map((x) => x.relname).join(","));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
