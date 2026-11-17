-- 3D Catalogue Admin: the database for /admin and the usage counts from the catalogue (track.js).
--
-- Paste this whole file into the Supabase SQL editor of the shared project and run it. It is safe to run
-- again: tables are created only if missing, functions are replaced, policies and triggers are dropped and
-- made again, and the grants are reset to exactly what is below.
--
-- The project is shared with other apps, so:
--   * every object here is in `public` and starts with s3d_;
--   * nothing touches auth.users (no triggers, no foreign keys), other tables, auth settings or email templates;
--   * a new table in `public` gets no Data API access by default, so each one is granted here, in the same run.
--
-- Who can do what (enforced by row level security and the functions below, not by the page):
--   admin    everything: users, invites, roles, audit log, stores, devices, analytics
--   manager  stores and devices (create, edit, delete), analytics, dashboard; approves or declines products
--   viewer   read-only: dashboard, analytics, products, stores, devices
-- Every active staff member, viewers too, can test a product: give feedback (with photos) and fill its checklist.
-- The 3D tracker (the Tracker page): every active staff member reads it and comments on an item; admins and managers
-- change an item's status, owner, due date and priority, and import the tracker spreadsheet.
-- Notifications: each person reads only their own, and their own settings; only the triggers and functions write them.
-- A signed-in account counts as staff only while its profile is active and its own password is set.
--
-- The first admin is named by hand, straight after the first run, in the same SQL editor (put your own email in;
-- the account must already exist). Nobody becomes admin by signing in first: the project's sign-ups are open.
--   insert into public.s3d_profiles (user_id, email, role, status, approved_at)
--     select id, lower(email), 'admin', 'active', now() from auth.users where lower(email) = lower('you@example.com')
--     on conflict (user_id) do update set role = 'admin', status = 'active';
--
-- The catalogue (anon key) writes only through three security definer functions that check their inputs:
-- s3d_track (usage events), s3d_pair (link a shop device to a store) and s3d_login_failed (audit a failed login).
-- It reads one thing, the team's product decisions, through s3d_live (live.js). anon has no direct access to any table.
--
-- Feedback photos go in the private Storage bucket s3d-feedback, made near the end of this file. Its two policies on
-- storage.objects apply to that bucket only; other apps' buckets are not touched.
--
-- Two more things outside `public`, both guarded and named for this admin, at the very end: the notifications table
-- joins Supabase Realtime's publication (supabase_realtime), and where pg_cron is switched on, one hourly job
-- (s3d-tracker-due) sends the "past its due date" notices.

begin;

-- ── tables ───────────────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.s3d_stores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text check (code is null or char_length(code) <= 40),
  city text check (city is null or char_length(city) <= 80),
  address text check (address is null or char_length(address) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists s3d_stores_name_key on public.s3d_stores (lower(btrim(name)));

-- One row per staff account. user_id is the auth user's id (deliberately no foreign key into auth).
create table if not exists public.s3d_profiles (
  user_id uuid primary key,
  email text not null,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  role text not null default 'viewer' check (role in ('admin', 'manager', 'viewer')),
  store_id bigint references public.s3d_stores (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  password_set boolean not null default true,   -- false until an invited user replaces the one-time password
  last_login_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists s3d_profiles_email on public.s3d_profiles (lower(email));

-- An admin's invite: the role and store a new account gets on its first sign-in.
create table if not exists public.s3d_invites (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null default 'viewer' check (role in ('admin', 'manager', 'viewer')),
  store_id bigint references public.s3d_stores (id) on delete set null,
  invited_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid
);
create unique index if not exists s3d_invites_open_email on public.s3d_invites (email) where used_at is null;

-- 8 characters from an alphabet without 0/O and 1/I, from the random bytes of a v4 uuid (bytes 6 and 8
-- carry the version and variant bits, so they are skipped). 32^8 is about 10^12 codes.
create or replace function public.s3d_new_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  i int;
  code text := '';
begin
  foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9] loop
    code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return code;
end $$;

-- A shop device (tablet, phone, headset). The pairing link /?pair=<pair_code> works once; pairing hands the
-- device its device_key, which it sends with every usage event so the event counts for its store.
create table if not exists public.s3d_devices (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  store_id bigint references public.s3d_stores (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 300),
  pair_code text not null unique default public.s3d_new_code(),
  device_key uuid not null unique default gen_random_uuid(),
  paired_at timestamptz,
  platform text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usage events from the catalogue. No personal data: a random per-tab session id, a coarse platform,
-- and the shop device's store if the browser was paired. No IP address, no user agent, no cookies.
create table if not exists public.s3d_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('CATALOGUE', 'VIEW', 'AR', 'PART', 'FILL', 'FIT', 'FEATURE', 'ROOM', 'HEADSET', 'EMBED')),
  product_id text check (product_id is null or product_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  detail text check (detail is null or char_length(detail) <= 80),
  session_id text not null check (session_id ~ '^[A-Za-z0-9-]{8,64}$'),
  platform text not null default 'other' check (platform in ('ios', 'android', 'quest', 'visionos', 'desktop', 'other')),
  device_id bigint references public.s3d_devices (id) on delete set null,
  store_id bigint references public.s3d_stores (id) on delete set null
);
create index if not exists s3d_events_at on public.s3d_events (at);
create index if not exists s3d_events_kind_at on public.s3d_events (kind, at);
create index if not exists s3d_events_session_at on public.s3d_events (session_id, at);
create index if not exists s3d_events_device on public.s3d_events (device_id);

-- The audit log. Written only by the triggers and functions below (security definer), read by admins.
create table if not exists public.s3d_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  target_label text,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists s3d_audit_at on public.s3d_audit (at desc);
create index if not exists s3d_audit_action_at on public.s3d_audit (action, at);

-- Product review (the admin's Testing pages). Every approve or decline ever made, oldest first: a product's
-- current decision is its newest row (highest id). Written only by s3d_decide; a decline always has a reason.
create table if not exists public.s3d_decisions (
  id bigint generated always as identity primary key,
  product_id text not null check (product_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  decision text not null check (decision in ('approved', 'declined')),
  note text check (note is null or char_length(note) <= 500),
  label text check (label is null or char_length(label) <= 200),   -- the product's name when it was decided
  actor uuid,
  actor_email text,
  at timestamptz not null default now(),
  check (decision = 'approved' or char_length(btrim(coalesce(note, ''))) >= 3)
);
create index if not exists s3d_decisions_product on public.s3d_decisions (product_id, id desc);

-- What testers saw: text, and optionally the device, colour, area and up to 3 photos (paths in the
-- s3d-feedback bucket). Admins and managers mark it fixed or open again. Written only by the functions below.
create table if not exists public.s3d_feedback (
  id bigint generated always as identity primary key,
  product_id text not null check (product_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  device text check (device is null or device in ('iphone', 'android', 'headset', 'computer')),
  finish text check (finish is null or char_length(finish) <= 80),
  area text check (area is null or char_length(area) <= 80),
  photos text[] not null default '{}' check (cardinality(photos) <= 3),
  author uuid,
  author_email text,
  at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'fixed')),
  status_by uuid,
  status_email text,
  status_at timestamptz
);
create index if not exists s3d_feedback_product on public.s3d_feedback (product_id, id desc);

-- The test checklist: one row per product, check, device type and tester. "Not tested" is no row.
create table if not exists public.s3d_checks (
  product_id text not null check (product_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  item text not null check (item ~ '^[a-z][a-z0-9_]{1,39}$'),
  device text not null check (device in ('iphone', 'android', 'headset', 'computer')),
  tester uuid not null,
  tester_email text,
  result text not null check (result in ('pass', 'fail')),
  at timestamptz not null default now(),
  primary key (product_id, item, device, tester)
);

alter table public.s3d_stores enable row level security;
alter table public.s3d_profiles enable row level security;
alter table public.s3d_invites enable row level security;
alter table public.s3d_devices enable row level security;
alter table public.s3d_events enable row level security;
alter table public.s3d_audit enable row level security;
alter table public.s3d_decisions enable row level security;
alter table public.s3d_feedback enable row level security;
alter table public.s3d_checks enable row level security;

-- ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────

-- The signed-in user's role, or null if they are not active staff (no profile, pending, inactive, or still
-- on the one-time password). Used by every policy and staff function.
create or replace function public.s3d_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.s3d_profiles
  where user_id = auth.uid() and status = 'active' and password_set
$$;

-- Text from a form, trimmed and cut to p_max characters, without control characters (new lines are kept
-- when p_lines); null when nothing is left. (The tracker below and tools.sql use it.)
create or replace function public.s3d_clean(p text, p_max int, p_lines boolean default false) returns text
language sql immutable set search_path = public as $$
  select nullif(btrim(left(regexp_replace(coalesce(p, ''),
    case when p_lines then E'[\\x01-\\x09\\x0B-\\x1F\\x7F]' else '[[:cntrl:]]' end, '', 'g'), p_max)), '')
$$;

-- The calling staff member's role, or an error if they can't do this. p_roles null: any active staff.
create or replace function public.s3d_need(p_roles text[] default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  r text := public.s3d_role();
begin
  if r is null or (p_roles is not null and not r = any (p_roles)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return r;
end $$;

create or replace function public.s3d_audit_write(
  p_action text, p_target_type text, p_target_id text, p_label text, p_detail jsonb,
  p_actor uuid default auth.uid(), p_email text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.s3d_audit (actor, actor_email, action, target_type, target_id, target_label, detail)
  values (
    p_actor,
    coalesce(p_email,
      (select email from public.s3d_profiles where user_id = p_actor),
      (select email::text from auth.users where id = p_actor)),
    p_action, p_target_type, p_target_id, left(p_label, 200), coalesce(p_detail, '{}'::jsonb)
  );
end $$;

create or replace function public.s3d_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Profiles: stamp approvals, and never leave the catalogue without an active admin.
create or replace function public.s3d_profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if old.status = 'pending' and new.status = 'active' then new.approved_at := now(); end if;
  if old.role = 'admin' and old.status = 'active' and (new.role <> 'admin' or new.status <> 'active')
     and not exists (select 1 from public.s3d_profiles
                     where role = 'admin' and status = 'active' and user_id <> old.user_id) then
    raise exception 'Keep at least one active admin' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- One audit trigger for the four tables people edit. Only the fields a person changes count: a device's
-- last-seen time (updated by every event) or a login time never makes an audit row.
create or replace function public.s3d_audit_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  keys text[];
  k text;
  changed jsonb := '{}'::jsonb;
  kind text;
begin
  keys := case tg_table_name
    when 's3d_stores' then array['name', 'code', 'city', 'address']
    when 's3d_devices' then array['name', 'store_id', 'notes']
    when 's3d_profiles' then array['status', 'role', 'store_id', 'full_name']
    else array['email', 'role', 'store_id'] end;
  if tg_op = 'UPDATE' then
    foreach k in array keys loop
      if o -> k is distinct from n -> k then
        changed := changed || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
      end if;
    end loop;
    if changed = '{}'::jsonb then return null; end if;
  end if;

  if tg_table_name = 's3d_profiles' then
    if tg_op <> 'UPDATE' then return null; end if;  -- profiles are made by s3d_login, which logs it
    if changed ? 'status' then
      perform public.s3d_audit_write(
        case when n ->> 'status' = 'inactive' then 'user_deactivated'
             when o ->> 'status' = 'pending' then 'user_approved'
             else 'user_reactivated' end,
        'user', r ->> 'user_id', r ->> 'email', changed -> 'status');
    end if;
    if changed ? 'role' then
      perform public.s3d_audit_write('role_changed', 'user', r ->> 'user_id', r ->> 'email', changed -> 'role');
    end if;
    if changed ? 'store_id' then
      perform public.s3d_audit_write('user_store_changed', 'user', r ->> 'user_id', r ->> 'email', changed -> 'store_id');
    end if;
    if changed ? 'full_name' then
      perform public.s3d_audit_write('user_updated', 'user', r ->> 'user_id', r ->> 'email', changed -> 'full_name');
    end if;
    return null;
  end if;

  if tg_table_name = 's3d_invites' then
    if tg_op = 'INSERT' then
      perform public.s3d_audit_write('user_invited', 'invite', r ->> 'id', r ->> 'email',
        jsonb_build_object('role', r -> 'role', 'store_id', r -> 'store_id'));
    elsif tg_op = 'DELETE' and o ->> 'used_at' is null then
      perform public.s3d_audit_write('invite_cancelled', 'invite', r ->> 'id', r ->> 'email', '{}'::jsonb);
    end if;
    return null;
  end if;

  kind := case tg_table_name when 's3d_stores' then 'store' else 'device' end;
  perform public.s3d_audit_write(
    kind || case tg_op when 'INSERT' then '_created' when 'UPDATE' then '_updated' else '_deleted' end,
    kind, r ->> 'id', r ->> 'name',
    case when tg_op = 'UPDATE' then changed
         else (select coalesce(jsonb_object_agg(x, r -> x), '{}'::jsonb) from unnest(keys) as x) end);
  return null;  -- an after trigger: the value is not used
end $$;

drop trigger if exists s3d_stores_touch on public.s3d_stores;
create trigger s3d_stores_touch before update on public.s3d_stores
  for each row execute function public.s3d_touch();
drop trigger if exists s3d_devices_touch on public.s3d_devices;
create trigger s3d_devices_touch before update on public.s3d_devices
  for each row execute function public.s3d_touch();
drop trigger if exists s3d_profiles_guard on public.s3d_profiles;
create trigger s3d_profiles_guard before update on public.s3d_profiles
  for each row execute function public.s3d_profiles_guard();

drop trigger if exists s3d_stores_audit on public.s3d_stores;
create trigger s3d_stores_audit after insert or update or delete on public.s3d_stores
  for each row execute function public.s3d_audit_trg();
drop trigger if exists s3d_devices_audit on public.s3d_devices;
create trigger s3d_devices_audit after insert or update or delete on public.s3d_devices
  for each row execute function public.s3d_audit_trg();
drop trigger if exists s3d_profiles_audit on public.s3d_profiles;
create trigger s3d_profiles_audit after update on public.s3d_profiles
  for each row execute function public.s3d_audit_trg();
drop trigger if exists s3d_invites_audit on public.s3d_invites;
create trigger s3d_invites_audit after insert or delete on public.s3d_invites
  for each row execute function public.s3d_audit_trg();

-- ── sign-in ──────────────────────────────────────────────────────────────────────────────────────────────

-- Called by /admin after every sign-in (p_fresh = true: stamps the login and audits it) and on every page
-- load with a saved session (p_fresh = false). The first call for an account makes its profile (the first
-- admin is named by hand, see the top of this file):
--   * an account with an open invite gets the invite's role and store, active; if the account was made
--     for the invite (after it), its password is the one-time password, so it is "password pending";
--   * any other account on this shared project is pending until an admin approves it.
create or replace function public.s3d_login(p_fresh boolean default true) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  u_email text;
  u_created timestamptz;
  inv public.s3d_invites;
  prof public.s3d_profiles;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select lower(email::text), created_at into u_email, u_created from auth.users where id = uid;
  if u_email is null then raise exception 'No such account' using errcode = '28000'; end if;

  select * into prof from public.s3d_profiles where user_id = uid;
  if not found then
    perform pg_advisory_xact_lock(hashtext('s3d_profiles_first'));
    select * into prof from public.s3d_profiles where user_id = uid;
    if not found then
      select * into inv from public.s3d_invites
        where email = u_email and used_at is null order by created_at desc limit 1;
      if inv.id is not null then
        insert into public.s3d_profiles (user_id, email, role, store_id, status, password_set, approved_at)
          values (uid, u_email, inv.role, inv.store_id, 'active', u_created < inv.created_at, now())
          returning * into prof;
        update public.s3d_invites set used_at = now(), used_by = uid where id = inv.id;
        perform public.s3d_audit_write('profile_created', 'user', uid::text, u_email,
          jsonb_build_object('role', inv.role, 'status', 'active', 'why', 'invite', 'invite_id', inv.id), uid, u_email);
      else
        insert into public.s3d_profiles (user_id, email, role, status, password_set)
          values (uid, u_email, 'viewer', 'pending', true) returning * into prof;
        perform public.s3d_audit_write('profile_created', 'user', uid::text, u_email,
          jsonb_build_object('role', 'viewer', 'status', 'pending', 'why', 'no invite: waits for approval'), uid, u_email);
      end if;
    end if;
  end if;

  if p_fresh then
    update public.s3d_profiles set last_login_at = now() where user_id = uid returning * into prof;
    perform public.s3d_audit_write('login', 'user', uid::text, prof.email,
      jsonb_build_object('status', prof.status, 'role', prof.role), uid, prof.email);
  end if;

  return json_build_object(
    'user_id', prof.user_id, 'email', prof.email, 'full_name', prof.full_name, 'role', prof.role,
    'status', prof.status, 'password_set', prof.password_set, 'store_id', prof.store_id,
    'store', (select name from public.s3d_stores where id = prof.store_id), 'last_login_at', prof.last_login_at);
end $$;

-- After the signed-in user has replaced their password (supabase.auth.updateUser).
create or replace function public.s3d_password_set() returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e text;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  update public.s3d_profiles set password_set = true where user_id = uid returning email into e;
  if e is not null then perform public.s3d_audit_write('password_set', 'user', uid::text, e, '{}'::jsonb, uid, e); end if;
end $$;

-- A failed sign-in on /admin (called with the anon key, so it checks its input and is capped at 30 a minute).
create or replace function public.s3d_login_failed(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(e) > 254 or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return; end if;
  if (select count(*) from public.s3d_audit where action = 'login_failed' and at > now() - interval '1 minute') >= 30 then
    return;
  end if;
  perform public.s3d_audit_write('login_failed', 'user', null, e, '{}'::jsonb, null, e);
end $$;

-- ── the catalogue: usage events and pairing (anon key) ──────────────────────────────────────────────────

create or replace function public.s3d_track(
  p_kind text, p_product text default null, p_detail text default null,
  p_session text default null, p_device uuid default null, p_platform text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text := upper(btrim(coalesce(p_kind, '')));
  pf text := case when p_platform in ('ios', 'android', 'quest', 'visionos', 'desktop') then p_platform else 'other' end;
  d text := left(nullif(btrim(regexp_replace(coalesce(p_detail, ''), '[[:cntrl:]<>]', '', 'g')), ''), 80);
  dev_id bigint;
  dev_store bigint;
  dev_seen timestamptz;
begin
  if k not in ('CATALOGUE', 'VIEW', 'AR', 'PART', 'FILL', 'FIT', 'FEATURE', 'ROOM', 'HEADSET', 'EMBED') then return; end if;
  if p_session is null or p_session !~ '^[A-Za-z0-9-]{8,64}$' then return; end if;
  if p_product is not null and p_product !~ '^[a-z0-9][a-z0-9-]{0,79}$' then return; end if;
  -- one browser tab can't flood the table: at most 300 events in 10 minutes
  if (select count(*) from public.s3d_events where session_id = p_session and at > now() - interval '10 minutes') >= 300 then
    return;
  end if;
  -- and many tabs can't either: the anon key is public and the database is shared with other apps, so at most
  -- 2000 events a minute in all (real use is a few a minute)
  if (select count(*) from public.s3d_events where at > now() - interval '1 minute') >= 2000 then
    return;
  end if;
  if p_device is not null then
    select id, store_id, last_seen_at into dev_id, dev_store, dev_seen
      from public.s3d_devices where device_key = p_device and paired_at is not null;
    if dev_id is not null and (dev_seen is null or dev_seen < now() - interval '1 minute') then
      update public.s3d_devices set last_seen_at = now(), platform = pf where id = dev_id;
    end if;
  end if;
  insert into public.s3d_events (kind, product_id, detail, session_id, platform, device_id, store_id)
    values (k, p_product, d, p_session, pf, dev_id, dev_store);
end $$;

-- /?pair=<code> on a shop device. A code works once; an admin or manager can issue a new one (s3d_device_reset).
create or replace function public.s3d_pair(p_code text, p_platform text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  pf text := case when p_platform in ('ios', 'android', 'quest', 'visionos', 'desktop') then p_platform else 'other' end;
  v public.s3d_devices;
begin
  if char_length(c) <> 8 then return json_build_object('ok', false, 'error', 'bad_code'); end if;
  select * into v from public.s3d_devices where pair_code = c for update;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v.paired_at is not null then return json_build_object('ok', false, 'error', 'already_paired'); end if;
  update public.s3d_devices set paired_at = now(), last_seen_at = now(), platform = pf where id = v.id;
  perform public.s3d_audit_write('device_paired', 'device', v.id::text, v.name,
    jsonb_build_object('store_id', v.store_id, 'platform', pf), null, null);
  return json_build_object('ok', true, 'device', v.device_key, 'name', v.name,
    'store', (select name from public.s3d_stores where id = v.store_id));
end $$;

-- A new pairing code (and device key) for a device: the old link and the old pairing stop working.
create or replace function public.s3d_device_reset(p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare
  v public.s3d_devices;
begin
  if coalesce(public.s3d_role(), '') not in ('admin', 'manager') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.s3d_devices
    set pair_code = public.s3d_new_code(), device_key = gen_random_uuid(), paired_at = null, platform = null, last_seen_at = null
    where id = p_id returning * into v;
  if not found then raise exception 'No such device' using errcode = 'P0002'; end if;
  perform public.s3d_audit_write('device_reset', 'device', v.id::text, v.name, '{}'::jsonb);
  return json_build_object('pair_code', v.pair_code);
end $$;

-- ── read-outs for the dashboard and analytics (any active staff) ─────────────────────────────────────────

create or replace function public.s3d_snapshot(p_tz text default 'Asia/Kolkata') returns json
language plpgsql security definer set search_path = public as $$
declare
  tz text := coalesce(p_tz, 'UTC');
  today timestamptz;
  r json;
begin
  if public.s3d_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  begin today := date_trunc('day', now() at time zone tz) at time zone tz;
  exception when others then tz := 'UTC'; today := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'; end;
  select json_build_object(
    'users', (select json_build_object(
        'total', count(*),
        'active', count(*) filter (where status = 'active'),
        'inactive', count(*) filter (where status = 'inactive'),
        'pending', count(*) filter (where status = 'pending'),
        'password_pending', count(*) filter (where not password_set and status <> 'inactive'))
      from public.s3d_profiles),
    'last_login', (select json_build_object(
        'today', count(*) filter (where last_login_at >= today),
        'week', count(*) filter (where last_login_at < today and last_login_at >= now() - interval '7 days'),
        'month', count(*) filter (where last_login_at < today and last_login_at < now() - interval '7 days' and last_login_at >= now() - interval '30 days'),
        'older', count(*) filter (where last_login_at < today and last_login_at < now() - interval '30 days'),
        'never', count(*) filter (where last_login_at is null))
      from public.s3d_profiles where status <> 'inactive'),
    'roles', (select json_build_object(
        'admin', count(*) filter (where role = 'admin'),
        'manager', count(*) filter (where role = 'manager'),
        'viewer', count(*) filter (where role = 'viewer'))
      from public.s3d_profiles where status = 'active'),
    'devices', (select json_build_object(
        'total', count(*),
        'paired', count(*) filter (where paired_at is not null),
        'unpaired', count(*) filter (where paired_at is null),
        'seen_today', count(*) filter (where last_seen_at >= today))
      from public.s3d_devices),
    'devices_per_store', coalesce((select json_agg(x) from (
        select coalesce(s.name, 'No store') as store, count(*) as n
        from public.s3d_devices d left join public.s3d_stores s on s.id = d.store_id
        group by s.name order by count(*) desc, s.name limit 5) x), '[]'::json),
    'stores', (select count(*) from public.s3d_stores),
    'events_today', (select count(*) from public.s3d_events where at >= today),
    'server_time', now()
  ) into r;
  return r;
end $$;

-- Activity over a time range: events by kind, admin actions by type, and a series of product views,
-- successful logins and failed logins per day (or per hour), in the given time zone.
create or replace function public.s3d_activity(
  p_from timestamptz, p_to timestamptz, p_bucket text default 'day', p_tz text default 'Asia/Kolkata'
) returns json
language plpgsql security definer set search_path = public as $$
declare
  tz text := coalesce(p_tz, 'UTC');
  b text := case when p_bucket = 'hour' then 'hour' else 'day' end;
  r json;
begin
  if public.s3d_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'Bad date range' using errcode = '22023';
  end if;
  begin perform now() at time zone tz; exception when others then tz := 'UTC'; end;
  with
    slots as (
      select generate_series(date_trunc(b, p_from at time zone tz), date_trunc(b, (p_to - interval '1 microsecond') at time zone tz), ('1 ' || b)::interval) as t),
    v as (select date_trunc(b, at at time zone tz) as t, count(*) as n from public.s3d_events
          where kind = 'VIEW' and at >= p_from and at < p_to group by 1),
    ok as (select date_trunc(b, at at time zone tz) as t, count(*) as n from public.s3d_audit
          where action = 'login' and at >= p_from and at < p_to group by 1),
    bad as (select date_trunc(b, at at time zone tz) as t, count(*) as n from public.s3d_audit
          where action = 'login_failed' and at >= p_from and at < p_to group by 1)
  select json_build_object(
    'bucket', b,
    'events_by_kind', coalesce((select json_object_agg(kind, n) from (
        select kind, count(*) as n from public.s3d_events where at >= p_from and at < p_to group by kind) x), '{}'::json),
    'audit_by_action', coalesce((select json_object_agg(action, n) from (
        select action, count(*) as n from public.s3d_audit where at >= p_from and at < p_to group by action) x), '{}'::json),
    'series', coalesce((select json_agg(json_build_object(
        't', to_char(slots.t, case when b = 'hour' then 'YYYY-MM-DD"T"HH24:00' else 'YYYY-MM-DD' end),
        'views', coalesce(v.n, 0), 'logins', coalesce(ok.n, 0), 'failed', coalesce(bad.n, 0)) order by slots.t)
      from slots left join v on v.t = slots.t left join ok on ok.t = slots.t left join bad on bad.t = slots.t), '[]'::json)
  ) into r;
  return r;
end $$;

-- Per product, per store and per platform counts over a date range, optionally for one store
-- (p_store = 0: events from devices with no store) or one platform.
create or replace function public.s3d_analytics(
  p_from timestamptz, p_to timestamptz, p_store bigint default null, p_platform text default null, p_tz text default 'Asia/Kolkata'
) returns json
language plpgsql security definer set search_path = public as $$
declare
  tz text := coalesce(p_tz, 'UTC');
  r json;
begin
  if public.s3d_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'Bad date range' using errcode = '22023';
  end if;
  begin perform now() at time zone tz; exception when others then tz := 'UTC'; end;
  with e as (
    select * from public.s3d_events
    where at >= p_from and at < p_to
      and (p_store is null or (p_store = 0 and store_id is null) or store_id = p_store)
      and (p_platform is null or platform = p_platform)
  ),
  days as (
    select generate_series(date_trunc('day', p_from at time zone tz), date_trunc('day', (p_to - interval '1 microsecond') at time zone tz), interval '1 day') as t),
  per_day as (
    select date_trunc('day', at at time zone tz) as t,
      count(*) filter (where kind = 'VIEW') as views, count(*) filter (where kind = 'AR') as ar
    from e group by 1)
  select json_build_object(
    'totals', (select json_build_object(
        'events', count(*), 'sessions', count(distinct session_id),
        'catalogue', count(*) filter (where kind = 'CATALOGUE'),
        'views', count(*) filter (where kind = 'VIEW'), 'ar', count(*) filter (where kind = 'AR'),
        'part', count(*) filter (where kind = 'PART'), 'fill', count(*) filter (where kind = 'FILL'),
        'fit', count(*) filter (where kind = 'FIT'), 'feature', count(*) filter (where kind = 'FEATURE'),
        'room', count(*) filter (where kind = 'ROOM'), 'headset', count(*) filter (where kind = 'HEADSET'),
        'embed', count(*) filter (where kind = 'EMBED'))
      from e),
    'products', coalesce((select json_agg(x order by x.views desc, x.product) from (
        select product_id as product,
          count(*) filter (where kind = 'VIEW') as views, count(*) filter (where kind = 'AR') as ar,
          count(*) filter (where kind = 'PART') as part, count(*) filter (where kind = 'FILL') as fill,
          count(*) filter (where kind = 'FIT') as fit, count(*) filter (where kind = 'FEATURE') as feature,
          count(*) filter (where kind = 'ROOM') as room, count(*) filter (where kind = 'HEADSET') as headset,
          count(*) filter (where kind = 'EMBED') as embed, count(distinct session_id) as sessions
        from e where product_id is not null group by product_id) x), '[]'::json),
    'stores', coalesce((select json_agg(x order by x.views desc, x.store) from (
        select e.store_id, coalesce(s.name, 'No store') as store,
          count(*) filter (where kind = 'VIEW') as views, count(*) filter (where kind = 'AR') as ar,
          count(*) filter (where kind = 'PART') as part, count(*) filter (where kind = 'FILL') as fill,
          count(*) filter (where kind = 'FIT') as fit, count(*) filter (where kind = 'FEATURE') as feature,
          count(distinct e.session_id) as sessions
        from e left join public.s3d_stores s on s.id = e.store_id group by e.store_id, s.name) x), '[]'::json),
    'platforms', coalesce((select json_agg(x order by x.views desc, x.platform) from (
        select platform,
          count(*) filter (where kind = 'VIEW') as views, count(*) filter (where kind = 'AR') as ar,
          count(*) filter (where kind = 'PART') as part, count(*) filter (where kind = 'FILL') as fill,
          count(*) filter (where kind = 'FIT') as fit, count(*) filter (where kind = 'FEATURE') as feature,
          count(distinct session_id) as sessions
        from e group by platform) x), '[]'::json),
    'ar_by_kind', coalesce((select json_object_agg(coalesce(detail, 'other'), n) from (
        select detail, count(*) as n from e where kind = 'AR' group by detail) x), '{}'::json),
    'days', coalesce((select json_agg(json_build_object(
        't', to_char(days.t, 'YYYY-MM-DD'), 'views', coalesce(per_day.views, 0), 'ar', coalesce(per_day.ar, 0)) order by days.t)
      from days left join per_day on per_day.t = days.t), '[]'::json)
  ) into r;
  return r;
end $$;

-- ── product review: approve, decline, feedback and the checklist (the admin's Testing pages) ─────────────
-- Until the team decides on a product, products.json says whether it is on show ("hidden": true keeps it off).
-- Once an admin or manager approves or declines it, the decision wins: every catalogue page reads the decisions
-- through s3d_live (live.js), so an approved product is on show at once and a declined one is off at once.
-- pipeline/scripts/sync_reviews.mjs later writes the decisions into products.json.

-- The catalogue's one read (anon key): each decided product's current decision, and nothing else.
create or replace function public.s3d_live() returns table (product_id text, decision text)
language sql stable security definer set search_path = public as $$
  select distinct on (d.product_id) d.product_id, d.decision
  from public.s3d_decisions d
  order by d.product_id, d.id desc
$$;

-- Approve or decline a product (admins and managers). A decline needs a reason; an approval takes an optional
-- note. A decision can be changed any time: each one is a new row, and each goes in the audit log too.
create or replace function public.s3d_decide(p_product text, p_decision text, p_note text default null, p_label text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  n text := nullif(btrim(coalesce(p_note, '')), '');
  prev text;
  r public.s3d_decisions;
begin
  if coalesce(public.s3d_role(), '') not in ('admin', 'manager') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_product is null or p_product !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'No such product' using errcode = '22023'; end if;
  if p_decision is null or p_decision not in ('approved', 'declined') then
    raise exception 'The decision must be approved or declined' using errcode = '22023';
  end if;
  if p_decision = 'declined' and char_length(coalesce(n, '')) < 3 then
    raise exception 'Say why it is declined' using errcode = '22023';
  end if;
  if char_length(coalesce(n, '')) > 500 then raise exception 'The note is too long: 500 characters at most' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('s3d_decide:' || p_product));   -- two people deciding at once: one after the other
  select d.decision into prev from public.s3d_decisions d where d.product_id = p_product order by d.id desc limit 1;
  insert into public.s3d_decisions (product_id, decision, note, label, actor, actor_email)
    values (p_product, p_decision, n, left(nullif(btrim(coalesce(p_label, '')), ''), 200), auth.uid(),
            (select email from public.s3d_profiles where user_id = auth.uid()))
    returning * into r;
  perform public.s3d_audit_write('product_' || p_decision, 'product', p_product, coalesce(r.label, p_product),
    jsonb_build_object('decision', jsonb_build_object('from', prev, 'to', p_decision))
      || case when n is null then '{}'::jsonb else jsonb_build_object('note', n) end);
  return json_build_object('product_id', r.product_id, 'decision', r.decision, 'note', r.note, 'by', r.actor_email, 'at', r.at);
end $$;

-- Feedback from any active staff member. Photos are uploaded to the s3d-feedback bucket first, into the
-- product's own folder (<product id>/<random uuid>.jpg); this takes their paths.
create or replace function public.s3d_feedback_add(
  p_product text, p_body text, p_device text default null, p_finish text default null, p_area text default null, p_photos text[] default '{}'
) returns json
language plpgsql security definer set search_path = public as $$
declare
  b text := btrim(coalesce(p_body, ''));
  ph text[] := coalesce(p_photos, '{}');
  x text;
  r public.s3d_feedback;
begin
  if public.s3d_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_product is null or p_product !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'No such product' using errcode = '22023'; end if;
  if b = '' then raise exception 'Write what you saw' using errcode = '22023'; end if;
  if char_length(b) > 2000 then raise exception 'The feedback is too long: 2000 characters at most' using errcode = '22023'; end if;
  if p_device is not null and p_device not in ('iphone', 'android', 'headset', 'computer') then
    raise exception 'Unknown device' using errcode = '22023';
  end if;
  if cardinality(ph) > 3 then raise exception 'Up to 3 photos' using errcode = '22023'; end if;
  foreach x in array ph loop
    if x is null or x !~ ('^' || p_product || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$') then
      raise exception 'A photo isn''t in this product''s folder' using errcode = '22023';
    end if;
  end loop;
  insert into public.s3d_feedback (product_id, body, device, finish, area, photos, author, author_email)
    values (p_product, b, p_device, left(nullif(btrim(coalesce(p_finish, '')), ''), 80), left(nullif(btrim(coalesce(p_area, '')), ''), 80),
            ph, auth.uid(), (select email from public.s3d_profiles where user_id = auth.uid()))
    returning * into r;
  return json_build_object('id', r.id, 'at', r.at);
end $$;

-- Mark feedback fixed, or open it again (admins and managers).
create or replace function public.s3d_feedback_set(p_id bigint, p_status text) returns json
language plpgsql security definer set search_path = public as $$
declare
  r public.s3d_feedback;
begin
  if coalesce(public.s3d_role(), '') not in ('admin', 'manager') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('open', 'fixed') then raise exception 'The status must be open or fixed' using errcode = '22023'; end if;
  update public.s3d_feedback
    set status = p_status, status_by = auth.uid(), status_at = now(),
        status_email = (select email from public.s3d_profiles where user_id = auth.uid())
    where id = p_id returning * into r;
  if not found then raise exception 'No such feedback' using errcode = 'P0002'; end if;
  return json_build_object('id', r.id, 'status', r.status, 'status_by', r.status_email, 'status_at', r.status_at);
end $$;

-- One check of the test checklist, for the signed-in tester on one device type: pass, fail or untested
-- (untested removes their mark). Any active staff member.
create or replace function public.s3d_check_set(p_product text, p_item text, p_device text, p_result text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if public.s3d_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_product is null or p_product !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'No such product' using errcode = '22023'; end if;
  if p_item is null or p_item !~ '^[a-z][a-z0-9_]{1,39}$' then raise exception 'No such check' using errcode = '22023'; end if;
  if p_device is null or p_device not in ('iphone', 'android', 'headset', 'computer') then raise exception 'Unknown device' using errcode = '22023'; end if;
  if p_result is null or p_result not in ('pass', 'fail', 'untested') then
    raise exception 'The result must be pass, fail or untested' using errcode = '22023';
  end if;
  if p_result = 'untested' then
    delete from public.s3d_checks where product_id = p_product and item = p_item and device = p_device and tester = uid;
  else
    insert into public.s3d_checks (product_id, item, device, tester, tester_email, result)
      values (p_product, p_item, p_device, uid, (select email from public.s3d_profiles where user_id = uid), p_result)
      on conflict (product_id, item, device, tester) do update set result = excluded.result, tester_email = excluded.tester_email, at = now();
  end if;
end $$;

-- The review queue (any active staff): per product that has a decision, feedback or a check, its current
-- decision, open and total feedback, passes and fails, and when anything last happened.
create or replace function public.s3d_review_queue() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  r json;
begin
  if public.s3d_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  with
    d as (select distinct on (x.product_id) x.product_id, x.decision, x.note, x.actor_email, x.at
          from public.s3d_decisions x order by x.product_id, x.id desc),
    f as (select x.product_id, count(*) filter (where x.status = 'open') as open, count(*) as total,
            max(greatest(x.at, x.status_at)) as last
          from public.s3d_feedback x group by x.product_id),
    c as (select x.product_id, count(*) filter (where x.result = 'pass') as pass, count(*) filter (where x.result = 'fail') as fail,
            max(x.at) as last
          from public.s3d_checks x group by x.product_id),
    ids as (select product_id from d union select product_id from f union select product_id from c)
  select coalesce(json_agg(json_build_object(
      'product_id', ids.product_id, 'decision', d.decision, 'note', d.note, 'decided_by', d.actor_email, 'decided_at', d.at,
      'open_feedback', coalesce(f.open, 0), 'feedback', coalesce(f.total, 0),
      'checks_pass', coalesce(c.pass, 0), 'checks_fail', coalesce(c.fail, 0),
      'last_at', greatest(d.at, f.last, c.last)) order by ids.product_id), '[]'::json)
    into r
    from ids left join d on d.product_id = ids.product_id left join f on f.product_id = ids.product_id
      left join c on c.product_id = ids.product_id;
  return r;
end $$;

-- One product's review (any active staff): its decisions newest first, its feedback newest first, and every
-- tester's checklist marks ("mine" marks the signed-in tester's own).
create or replace function public.s3d_review(p_product text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  r json;
begin
  if public.s3d_role() is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  select json_build_object(
    'history', coalesce((select json_agg(json_build_object(
        'id', d.id, 'decision', d.decision, 'note', d.note, 'by', d.actor_email, 'name', p.full_name, 'at', d.at) order by d.id desc)
      from public.s3d_decisions d left join public.s3d_profiles p on p.user_id = d.actor where d.product_id = p_product), '[]'::json),
    'feedback', coalesce((select json_agg(json_build_object(
        'id', f.id, 'body', f.body, 'device', f.device, 'finish', f.finish, 'area', f.area, 'photos', f.photos,
        'by', f.author_email, 'name', p.full_name, 'at', f.at,
        'status', f.status, 'status_by', f.status_email, 'status_at', f.status_at) order by f.id desc)
      from public.s3d_feedback f left join public.s3d_profiles p on p.user_id = f.author where f.product_id = p_product), '[]'::json),
    'checks', coalesce((select json_agg(json_build_object(
        'item', c.item, 'device', c.device, 'result', c.result, 'by', c.tester_email, 'name', p.full_name,
        'mine', c.tester = auth.uid(), 'at', c.at) order by c.at)
      from public.s3d_checks c left join public.s3d_profiles p on p.user_id = c.tester where c.product_id = p_product), '[]'::json)
  ) into r;
  return r;
end $$;

-- ── row level security ───────────────────────────────────────────────────────────────────────────────────

drop policy if exists s3d_stores_read on public.s3d_stores;
create policy s3d_stores_read on public.s3d_stores for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_stores_insert on public.s3d_stores;
create policy s3d_stores_insert on public.s3d_stores for insert to authenticated
  with check ((select public.s3d_role()) in ('admin', 'manager'));
drop policy if exists s3d_stores_update on public.s3d_stores;
create policy s3d_stores_update on public.s3d_stores for update to authenticated
  using ((select public.s3d_role()) in ('admin', 'manager'))
  with check ((select public.s3d_role()) in ('admin', 'manager'));
drop policy if exists s3d_stores_delete on public.s3d_stores;
create policy s3d_stores_delete on public.s3d_stores for delete to authenticated
  using ((select public.s3d_role()) in ('admin', 'manager'));

drop policy if exists s3d_devices_read on public.s3d_devices;
create policy s3d_devices_read on public.s3d_devices for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_devices_insert on public.s3d_devices;
create policy s3d_devices_insert on public.s3d_devices for insert to authenticated
  with check ((select public.s3d_role()) in ('admin', 'manager'));
drop policy if exists s3d_devices_update on public.s3d_devices;
create policy s3d_devices_update on public.s3d_devices for update to authenticated
  using ((select public.s3d_role()) in ('admin', 'manager'))
  with check ((select public.s3d_role()) in ('admin', 'manager'));
drop policy if exists s3d_devices_delete on public.s3d_devices;
create policy s3d_devices_delete on public.s3d_devices for delete to authenticated
  using ((select public.s3d_role()) in ('admin', 'manager'));

drop policy if exists s3d_profiles_read on public.s3d_profiles;
create policy s3d_profiles_read on public.s3d_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.s3d_role()) = 'admin');
drop policy if exists s3d_profiles_update on public.s3d_profiles;
create policy s3d_profiles_update on public.s3d_profiles for update to authenticated
  using ((select public.s3d_role()) = 'admin')
  with check ((select public.s3d_role()) = 'admin');

drop policy if exists s3d_invites_read on public.s3d_invites;
create policy s3d_invites_read on public.s3d_invites for select to authenticated
  using ((select public.s3d_role()) = 'admin');
drop policy if exists s3d_invites_insert on public.s3d_invites;
create policy s3d_invites_insert on public.s3d_invites for insert to authenticated
  with check ((select public.s3d_role()) = 'admin');
drop policy if exists s3d_invites_delete on public.s3d_invites;
create policy s3d_invites_delete on public.s3d_invites for delete to authenticated
  using ((select public.s3d_role()) = 'admin');

drop policy if exists s3d_audit_read on public.s3d_audit;
create policy s3d_audit_read on public.s3d_audit for select to authenticated
  using ((select public.s3d_role()) = 'admin');

-- s3d_events has no policies: nobody reads or writes it directly (s3d_track writes, the read-outs read).

-- the review tables: active staff read them; every write goes through the review functions above
drop policy if exists s3d_decisions_read on public.s3d_decisions;
create policy s3d_decisions_read on public.s3d_decisions for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_feedback_read on public.s3d_feedback;
create policy s3d_feedback_read on public.s3d_feedback for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_checks_read on public.s3d_checks;
create policy s3d_checks_read on public.s3d_checks for select to authenticated
  using ((select public.s3d_role()) is not null);

-- ── grants: exactly these, every run ─────────────────────────────────────────────────────────────────────

revoke all on table public.s3d_stores, public.s3d_profiles, public.s3d_invites,
  public.s3d_devices, public.s3d_events, public.s3d_audit,
  public.s3d_decisions, public.s3d_feedback, public.s3d_checks from public, anon, authenticated;
grant select, insert, update, delete on table public.s3d_stores, public.s3d_profiles, public.s3d_invites,
  public.s3d_devices, public.s3d_events, public.s3d_audit,
  public.s3d_decisions, public.s3d_feedback, public.s3d_checks to service_role;

grant select, insert (name, code, city, address), update (name, code, city, address), delete
  on public.s3d_stores to authenticated;
-- device_key (the secret a paired device sends) is not readable from the browser
grant select (id, name, store_id, notes, pair_code, paired_at, platform, last_seen_at, created_at, updated_at),
  insert (name, store_id, notes), update (name, store_id, notes), delete
  on public.s3d_devices to authenticated;
grant select, update (role, store_id, status, full_name) on public.s3d_profiles to authenticated;
grant select, insert (email, role, store_id), delete on public.s3d_invites to authenticated;
grant select on public.s3d_audit to authenticated;
-- read-only for staff (the policies above); written only by the review functions. Identity ids: no sequence grants.
grant select on public.s3d_decisions, public.s3d_feedback, public.s3d_checks to authenticated;

revoke all on function public.s3d_new_code() from public, anon, authenticated;
revoke all on function public.s3d_role() from public, anon, authenticated;
revoke all on function public.s3d_audit_write(text, text, text, text, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.s3d_touch() from public, anon, authenticated;
revoke all on function public.s3d_profiles_guard() from public, anon, authenticated;
revoke all on function public.s3d_audit_trg() from public, anon, authenticated;
revoke all on function public.s3d_login(boolean) from public, anon, authenticated;
revoke all on function public.s3d_password_set() from public, anon, authenticated;
revoke all on function public.s3d_login_failed(text) from public, anon, authenticated;
revoke all on function public.s3d_track(text, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.s3d_pair(text, text) from public, anon, authenticated;
revoke all on function public.s3d_device_reset(bigint) from public, anon, authenticated;
revoke all on function public.s3d_snapshot(text) from public, anon, authenticated;
revoke all on function public.s3d_activity(timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.s3d_analytics(timestamptz, timestamptz, bigint, text, text) from public, anon, authenticated;
revoke all on function public.s3d_live() from public, anon, authenticated;
revoke all on function public.s3d_decide(text, text, text, text) from public, anon, authenticated;
revoke all on function public.s3d_feedback_add(text, text, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.s3d_feedback_set(bigint, text) from public, anon, authenticated;
revoke all on function public.s3d_check_set(text, text, text, text) from public, anon, authenticated;
revoke all on function public.s3d_review_queue() from public, anon, authenticated;
revoke all on function public.s3d_review(text) from public, anon, authenticated;

-- the catalogue and the sign-in page (anon key)
grant execute on function public.s3d_track(text, text, text, text, uuid, text) to anon, authenticated, service_role;
grant execute on function public.s3d_pair(text, text) to anon, authenticated, service_role;
grant execute on function public.s3d_login_failed(text) to anon, authenticated, service_role;
grant execute on function public.s3d_live() to anon, authenticated, service_role;
-- signed-in staff (each function checks the role itself)
grant execute on function public.s3d_new_code() to authenticated, service_role;   -- the devices.pair_code default
grant execute on function public.s3d_role() to authenticated, service_role;       -- used by the policies
grant execute on function public.s3d_login(boolean) to authenticated, service_role;
grant execute on function public.s3d_password_set() to authenticated, service_role;
grant execute on function public.s3d_device_reset(bigint) to authenticated, service_role;
grant execute on function public.s3d_snapshot(text) to authenticated, service_role;
grant execute on function public.s3d_activity(timestamptz, timestamptz, text, text) to authenticated, service_role;
grant execute on function public.s3d_analytics(timestamptz, timestamptz, bigint, text, text) to authenticated, service_role;
grant execute on function public.s3d_decide(text, text, text, text) to authenticated, service_role;
grant execute on function public.s3d_feedback_add(text, text, text, text, text, text[]) to authenticated, service_role;
grant execute on function public.s3d_feedback_set(bigint, text) to authenticated, service_role;
grant execute on function public.s3d_check_set(text, text, text, text) to authenticated, service_role;
grant execute on function public.s3d_review_queue() to authenticated, service_role;
grant execute on function public.s3d_review(text) to authenticated, service_role;

-- ── feedback photos: the private Storage bucket s3d-feedback ─────────────────────────────────────────────
-- Not public: a photo is read through a short-lived signed link, which only active staff can make. Up to 5 MB,
-- JPEG only (the admin shrinks every photo to a JPEG in the browser before it uploads it). Active staff upload,
-- into a product's folder: <product id>/<random uuid>.jpg. Nobody changes or deletes a photo from the browser.
-- These policies are on Storage's own table, storage.objects, so they name the bucket: other apps' buckets on
-- this shared project are not affected.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('s3d-feedback', 's3d-feedback', false, 5242880, array['image/jpeg'])
  on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];
drop policy if exists s3d_feedback_photos_read on storage.objects;
create policy s3d_feedback_photos_read on storage.objects for select to authenticated
  using (bucket_id = 's3d-feedback' and (select public.s3d_role()) is not null);
drop policy if exists s3d_feedback_photos_add on storage.objects;
create policy s3d_feedback_photos_add on storage.objects for insert to authenticated
  with check (bucket_id = 's3d-feedback' and (select public.s3d_role()) is not null
    and name ~ '^[a-z0-9][a-z0-9-]{0,79}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$');

-- ── the 3D tracker (the admin's Tracker page) ────────────────────────────────────────────────────────────
-- One row per item to build: Sangeetha's item master, one sheet per category, plus colours built that aren't in
-- it. The sheet's own fields come from the tracker spreadsheet, uploaded on the Tracker page (s3d_tracker_import);
-- the team's fields (who it is assigned to, the due date, the priority) are set on the page, and an import never
-- changes them. An item whose code is a product on show is live: the page marks it so by itself (s3d_tracker_live).
-- Every change of status, owner, due date or priority is a row in s3d_tracker_log (who, when, from and to), made by
-- a trigger, and so is every comment. Nobody writes these tables directly: only the s3d_tracker_ functions do.

create table if not exists public.s3d_tracker (
  id bigint generated always as identity primary key,
  category text not null check (char_length(btrim(category)) between 1 and 60),
  item_code text not null check (char_length(btrim(item_code)) between 1 and 80),   -- exactly as the sheet writes it
  model text check (model is null or char_length(model) <= 400),
  brand text check (brand is null or char_length(brand) <= 60),
  created_on date,
  status text not null default 'not_started' check (status in ('live', 'review', 'hidden', 'in_progress', 'blocked', 'not_started')),
  colour text check (colour is null or char_length(colour) <= 120),
  product_id text check (product_id is null or product_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  link text check (link is null or (char_length(link) <= 500 and link ~ '^https://')),
  prior_list boolean not null default false,   -- on the earlier vendor's list
  ref_list boolean not null default false,     -- on the CD Ref list
  in_master boolean not null default true,     -- false: built or listed, but not in the item master
  source text check (source is null or char_length(source) <= 60),
  notes text check (notes is null or char_length(notes) <= 1000),
  assignee uuid,
  due_on date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  comments int not null default 0,
  due_told date,   -- the due date whose "past its due date" notice has been sent
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_at timestamptz not null default now()
);
create unique index if not exists s3d_tracker_code on public.s3d_tracker (category, item_code);
create index if not exists s3d_tracker_assignee on public.s3d_tracker (assignee) where assignee is not null;

-- An item's history and comments. kind 'comment' has a body; the others have from_value and to_value (the status
-- key, the user id, the date or the priority). how: the import or the site made the change, not a person.
create table if not exists public.s3d_tracker_log (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.s3d_tracker (id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  actor_name text,
  kind text not null check (kind in ('comment', 'status', 'assignee', 'due', 'priority')),
  body text check (body is null or char_length(body) <= 1000),
  from_value text,
  to_value text,
  how text check (how is null or how in ('import', 'site')),
  constraint s3d_tracker_log_body check (kind <> 'comment' or char_length(btrim(coalesce(body, ''))) > 0)
);
create index if not exists s3d_tracker_log_item on public.s3d_tracker_log (item_id, id);

-- Each import of the spreadsheet, with what it did.
create table if not exists public.s3d_tracker_imports (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  actor_name text,
  file_name text check (file_name is null or char_length(file_name) <= 200),
  total int not null default 0,
  added int not null default 0,
  changed int not null default 0,
  unchanged int not null default 0,
  skipped int not null default 0,
  missing int not null default 0   -- items in the tracker that the file doesn't have (they are kept)
);

-- ── notifications ────────────────────────────────────────────────────────────────────────────────────────
-- One row per person told (so each reads only their own: recipient = auth.uid()), written only by the triggers and
-- functions here. What each kind is for, and who gets it:
--   live, blocked  an item went live on the site, or is blocked: admins and managers, its owner and its commenters
--   status         any other status change: the item's owner and its commenters
--   assigned       an item was assigned to you
--   comment        a new comment on an item you own or commented on
--   due            an item you own is past its due date and not built (nobody owns it: admins and managers)
--   import         a tracker import finished, with its counts: admins and managers
--   feedback       new store feedback on a product (the Testing pages): admins and managers
-- Nobody is told about their own action, and nobody gets a kind they turned off (s3d_notify_settings).
-- The admin hears about new rows at once through Supabase Realtime (the publication at the end of this file).
create table if not exists public.s3d_notifications (
  id bigint generated always as identity primary key,
  recipient uuid not null,
  at timestamptz not null default now(),
  kind text not null check (kind in ('live', 'blocked', 'status', 'assigned', 'comment', 'due', 'import', 'feedback')),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or (char_length(link) <= 300 and link ~ '^#/')),   -- a page of the admin
  item_id bigint references public.s3d_tracker (id) on delete cascade,
  actor uuid,
  actor_name text,
  read_at timestamptz
);
create index if not exists s3d_notifications_recipient on public.s3d_notifications (recipient, id desc);
create index if not exists s3d_notifications_unread on public.s3d_notifications (recipient) where read_at is null;

-- The kinds a person turned off (no row: everything on).
create table if not exists public.s3d_notify_settings (
  user_id uuid primary key,
  off text[] not null default '{}' check (off <@ array['live', 'blocked', 'status', 'assigned', 'comment', 'due', 'import', 'feedback']),
  updated_at timestamptz not null default now()
);

alter table public.s3d_tracker enable row level security;
alter table public.s3d_tracker_log enable row level security;
alter table public.s3d_tracker_imports enable row level security;
alter table public.s3d_notifications enable row level security;
alter table public.s3d_notify_settings enable row level security;

-- ── tracker and notification helpers ─────────────────────────────────────────────────────────────────────

create or replace function public.s3d_tracker_label(p_status text) returns text
language sql immutable set search_path = public as $$
  select case p_status when 'live' then 'Live on site' when 'review' then 'Built, in review' when 'hidden' then 'Built, hidden'
    when 'in_progress' then 'In progress' when 'blocked' then 'Blocked' when 'not_started' then 'Not started' else p_status end
$$;

-- Active admins and managers.
create or replace function public.s3d_leads() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}') from public.s3d_profiles
  where status = 'active' and password_set and role in ('admin', 'manager')
$$;

-- An item's owner and everyone who commented on it.
create or replace function public.s3d_watchers(p_item bigint) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct u), '{}') from (
    select assignee as u from public.s3d_tracker where id = p_item
    union select actor from public.s3d_tracker_log where item_id = p_item and kind = 'comment'
  ) x where u is not null
$$;

-- One notification for each of p_to who is active staff and hasn't turned p_kind off; never to the person acting
-- (auth.uid()), unless p_system (a notice from the system itself, as "past its due date"). Returns how many.
create or replace function public.s3d_notify(
  p_to uuid[], p_kind text, p_title text, p_body text default null, p_link text default null, p_item bigint default null,
  p_system boolean default false
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := case when p_system then null else auth.uid() end;
  v_name text;
  n int;
begin
  select coalesce(full_name, split_part(email, '@', 1)) into v_name from public.s3d_profiles where user_id = v_actor;
  insert into public.s3d_notifications (recipient, kind, title, body, link, item_id, actor, actor_name)
    select p.user_id, p_kind, left(p_title, 200), left(p_body, 500), p_link, p_item, v_actor, v_name
    from public.s3d_profiles p
    where p.user_id = any (coalesce(p_to, '{}')) and p.user_id is distinct from v_actor
      and p.status = 'active' and p.password_set
      and not exists (select 1 from public.s3d_notify_settings s where s.user_id = p.user_id and p_kind = any (s.off));
  get diagnostics n = row_count;
  return n;
end $$;

-- An item's name in a notification: its code, and the brand when there is one.
create or replace function public.s3d_tracker_name(t public.s3d_tracker) returns text
language sql immutable set search_path = public as $$
  select t.item_code || coalesce(' (' || t.brand || ')', '')
$$;

-- Before an update: the times. updated_at moves when anything but the due notice changed; status_at with the status.
create or replace function public.s3d_tracker_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - array['due_told', 'updated_at']) is distinct from (to_jsonb(old) - array['due_told', 'updated_at']) then
    new.updated_at := now();
  end if;
  if new.status is distinct from old.status then new.status_at := now(); end if;
  if new.due_on is distinct from old.due_on then new.due_told := null; end if;
  return new;
end $$;

-- After an update: a history row for each change of status, owner, due date or priority, and its notifications.
-- s3d.how ('import' or 'site') is set by the import and by s3d_tracker_live for their own changes; an import's
-- status changes notify nobody one by one (the import's summary does).
create or replace function public.s3d_tracker_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_how text := nullif(current_setting('s3d.how', true), '');
  v_kind text;
  v_who text;
begin
  select email, full_name into v_email, v_name from public.s3d_profiles where user_id = v_uid;
  v_who := coalesce(v_name, split_part(v_email, '@', 1), 'The system');
  if new.status is distinct from old.status then
    insert into public.s3d_tracker_log (item_id, actor, actor_email, actor_name, kind, from_value, to_value, how)
      values (new.id, v_uid, v_email, v_name, 'status', old.status, new.status, v_how);
    if v_how is distinct from 'import' then
      v_kind := case new.status when 'live' then 'live' when 'blocked' then 'blocked' else 'status' end;
      perform public.s3d_notify(
        case when v_kind = 'status' then public.s3d_watchers(new.id) else public.s3d_watchers(new.id) || public.s3d_leads() end,
        v_kind,
        case v_kind when 'live' then public.s3d_tracker_name(new) || ' is live on the site'
                    when 'blocked' then public.s3d_tracker_name(new) || ' is blocked'
                    else public.s3d_tracker_name(new) || ': ' || public.s3d_tracker_label(new.status) end,
        case when v_how = 'site' then 'Found on the site. It was “' || public.s3d_tracker_label(old.status) || '”.'
             else v_who || ' changed it from “' || public.s3d_tracker_label(old.status) || '” to “' || public.s3d_tracker_label(new.status) || '”.' end,
        '#/tracker/' || new.id, new.id);
    end if;
  end if;
  if new.assignee is distinct from old.assignee then
    insert into public.s3d_tracker_log (item_id, actor, actor_email, actor_name, kind, from_value, to_value, how)
      values (new.id, v_uid, v_email, v_name, 'assignee', old.assignee::text, new.assignee::text, v_how);
    if new.assignee is not null then
      perform public.s3d_notify(array[new.assignee], 'assigned', public.s3d_tracker_name(new) || ' is assigned to you',
        v_who || ' assigned it to you.' || coalesce(' Due ' || to_char(new.due_on, 'FMDD Mon YYYY') || '.', ''),
        '#/tracker/' || new.id, new.id);
    end if;
  end if;
  if new.due_on is distinct from old.due_on then
    insert into public.s3d_tracker_log (item_id, actor, actor_email, actor_name, kind, from_value, to_value, how)
      values (new.id, v_uid, v_email, v_name, 'due', old.due_on::text, new.due_on::text, v_how);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.s3d_tracker_log (item_id, actor, actor_email, actor_name, kind, from_value, to_value, how)
      values (new.id, v_uid, v_email, v_name, 'priority', old.priority, new.priority, v_how);
  end if;
  return null;
end $$;

-- After a comment: its notifications (the item's owner and everyone who commented on it, not the author).
create or replace function public.s3d_tracker_comment_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t public.s3d_tracker;
begin
  if new.kind <> 'comment' then return null; end if;
  select * into t from public.s3d_tracker where id = new.item_id;
  perform public.s3d_notify(public.s3d_watchers(t.id), 'comment', 'New comment on ' || public.s3d_tracker_name(t),
    coalesce(new.actor_name, split_part(new.actor_email, '@', 1), 'Someone') || ': ' || left(new.body, 300),
    '#/tracker/' || t.id, t.id);
  return null;
end $$;

-- After an import: its summary, to admins and managers.
create or replace function public.s3d_tracker_import_trg() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.s3d_notify(public.s3d_leads(), 'import',
    'Tracker import: ' || new.added || ' new, ' || new.changed || ' changed',
    coalesce(new.actor_name, split_part(new.actor_email, '@', 1), 'Someone') || ' imported ' || coalesce('“' || new.file_name || '”', 'the spreadsheet')
      || ': ' || new.total || ' rows, ' || new.unchanged || ' unchanged' || case when new.skipped > 0 then ', ' || new.skipped || ' skipped' else '' end || '.',
    '#/tracker', null);
  return null;
end $$;

-- After new store feedback (s3d_feedback_add): admins and managers hear about it.
create or replace function public.s3d_feedback_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.s3d_notify(public.s3d_leads(), 'feedback', 'New feedback on ' || new.product_id,
    coalesce((select coalesce(full_name, split_part(email, '@', 1)) from public.s3d_profiles where user_id = new.author), 'Someone')
      || coalesce(' (' || new.area || ')', '') || ': ' || left(new.body, 300),
    '#/review/' || new.product_id, null);
  return null;
end $$;

drop trigger if exists s3d_tracker_touch on public.s3d_tracker;
create trigger s3d_tracker_touch before update on public.s3d_tracker
  for each row execute function public.s3d_tracker_touch();
drop trigger if exists s3d_tracker_changes on public.s3d_tracker;
create trigger s3d_tracker_changes after update on public.s3d_tracker
  for each row execute function public.s3d_tracker_trg();
drop trigger if exists s3d_tracker_comment on public.s3d_tracker_log;
create trigger s3d_tracker_comment after insert on public.s3d_tracker_log
  for each row execute function public.s3d_tracker_comment_trg();
drop trigger if exists s3d_tracker_import on public.s3d_tracker_imports;
create trigger s3d_tracker_import after insert on public.s3d_tracker_imports
  for each row execute function public.s3d_tracker_import_trg();
drop trigger if exists s3d_feedback_notify on public.s3d_feedback;
create trigger s3d_feedback_notify after insert on public.s3d_feedback
  for each row execute function public.s3d_feedback_notify();

-- ── the tracker's functions ──────────────────────────────────────────────────────────────────────────────

-- Active staff, for "assigned to" and for names on the page (any active staff; nobody else gets a row).
create or replace function public.s3d_staff() returns table (user_id uuid, name text, email text, role text)
language sql stable security definer set search_path = public as $$
  select p.user_id, coalesce(p.full_name, split_part(p.email, '@', 1)), p.email, p.role
  from public.s3d_profiles p
  where public.s3d_role() is not null and p.status = 'active' and p.password_set
  order by 2
$$;

-- Change an item's team fields (admins and managers). p_patch has any of: status, assignee (a user id, or null for
-- nobody), due_on ('YYYY-MM-DD', or null), priority. The triggers above write the history and the notifications.
create or replace function public.s3d_tracker_update(p_id bigint, p_patch jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  o public.s3d_tracker;
  n public.s3d_tracker;
  v_status text;
  v_assignee uuid;
  v_due date;
  v_prio text;
  v_raw text;
  v_changed jsonb := '{}'::jsonb;
begin
  perform public.s3d_need(array['admin', 'manager']);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'Nothing to change.' using errcode = 'P0001'; end if;
  select * into o from public.s3d_tracker where id = p_id for update;
  if not found then raise exception 'No such item.' using errcode = 'P0002'; end if;
  v_status := case when p_patch ? 'status' then p_patch ->> 'status' else o.status end;
  if v_status is null or v_status not in ('live', 'review', 'hidden', 'in_progress', 'blocked', 'not_started') then
    raise exception 'Unknown status.' using errcode = 'P0001';
  end if;
  v_assignee := o.assignee;
  if p_patch ? 'assignee' then
    v_raw := nullif(btrim(coalesce(p_patch ->> 'assignee', '')), '');
    if v_raw is not null and v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Choose someone on the team.' using errcode = 'P0001';
    end if;
    v_assignee := v_raw::uuid;
    if v_assignee is not null and v_assignee is distinct from o.assignee
       and not exists (select 1 from public.s3d_profiles where user_id = v_assignee and status = 'active' and password_set) then
      raise exception 'Choose someone on the team: an active user.' using errcode = 'P0001';
    end if;
  end if;
  v_due := o.due_on;
  if p_patch ? 'due_on' then
    v_raw := nullif(btrim(coalesce(p_patch ->> 'due_on', '')), '');
    if v_raw is not null and v_raw !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'That due date isn’t a date.' using errcode = 'P0001'; end if;
    v_due := v_raw::date;
    if v_due is distinct from o.due_on and v_due is not null and (v_due < current_date - 1 or v_due > current_date + 730) then
      raise exception 'The due date has to be from today on, within two years.' using errcode = 'P0001';
    end if;
  end if;
  v_prio := case when p_patch ? 'priority' then p_patch ->> 'priority' else o.priority end;
  if v_prio is null or v_prio not in ('low', 'normal', 'high', 'urgent') then raise exception 'Unknown priority.' using errcode = 'P0001'; end if;
  if v_status = o.status and v_assignee is not distinct from o.assignee and v_due is not distinct from o.due_on and v_prio = o.priority then
    return row_to_json(o);   -- nothing changed
  end if;
  update public.s3d_tracker set status = v_status, assignee = v_assignee, due_on = v_due, priority = v_prio
    where id = o.id returning * into n;
  if n.status <> o.status then v_changed := v_changed || jsonb_build_object('status', jsonb_build_object('from', o.status, 'to', n.status)); end if;
  if n.assignee is distinct from o.assignee then
    v_changed := v_changed || jsonb_build_object('assignee', jsonb_build_object(
      'from', (select email from public.s3d_profiles where user_id = o.assignee), 'to', (select email from public.s3d_profiles where user_id = n.assignee)));
  end if;
  if n.due_on is distinct from o.due_on then v_changed := v_changed || jsonb_build_object('due_on', jsonb_build_object('from', o.due_on, 'to', n.due_on)); end if;
  if n.priority <> o.priority then v_changed := v_changed || jsonb_build_object('priority', jsonb_build_object('from', o.priority, 'to', n.priority)); end if;
  perform public.s3d_audit_write('tracker_updated', 'tracker', n.id::text, public.s3d_tracker_name(n), v_changed);
  return row_to_json(n);
end $$;

-- A comment on an item (any active staff).
create or replace function public.s3d_tracker_comment(p_id bigint, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_body text := public.s3d_clean(p_body, 1000, true);
  v_me public.s3d_profiles;
  t public.s3d_tracker;
  c public.s3d_tracker_log;
begin
  perform public.s3d_need();
  if v_body is null then raise exception 'Write a comment first.' using errcode = 'P0001'; end if;
  select * into t from public.s3d_tracker where id = p_id for update;
  if not found then raise exception 'No such item.' using errcode = 'P0002'; end if;
  select * into v_me from public.s3d_profiles where user_id = auth.uid();
  insert into public.s3d_tracker_log (item_id, actor, actor_email, actor_name, kind, body)
    values (t.id, auth.uid(), v_me.email, v_me.full_name, 'comment', v_body) returning * into c;
  update public.s3d_tracker set comments = comments + 1 where id = t.id;
  perform public.s3d_audit_write('tracker_commented', 'tracker', t.id::text, public.s3d_tracker_name(t), jsonb_build_object('text', left(v_body, 120)));
  return row_to_json(c);
end $$;

-- Import the tracker spreadsheet (admins and managers): p_rows is every item row the page read from the file,
-- [{category, item_code, model, brand, created_on, status, colour, product_id, link, prior_list, ref_list, in_master,
-- source, notes}], at most 5000. Matched on category and item code (exactly as written). A new item is added, a
-- known one gets the sheet's fields, and its owner, due date, priority and comments stay as they are. Items the
-- file doesn't have are kept. A row with no category or code, an unknown status, or a code already in the file
-- is skipped. Its status changes go in each item's history; one summary notification goes to admins and managers.
create or replace function public.s3d_tracker_import(p_rows jsonb, p_file text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  o public.s3d_tracker;
  v_cat text;
  v_code text;
  v_status text;
  v_created date;
  v_prod text;
  v_link text;
  v_seen text[] := '{}';
  v_me public.s3d_profiles;
  v_added int := 0;
  v_changed int := 0;
  v_same int := 0;
  v_skipped int := 0;
  v_missing int;
  v_total int;
  r public.s3d_tracker_imports;
begin
  perform public.s3d_need(array['admin', 'manager']);
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'The rows are missing.' using errcode = 'P0001'; end if;
  v_total := jsonb_array_length(p_rows);
  if v_total = 0 then raise exception 'The file has no items.' using errcode = 'P0001'; end if;
  if v_total > 5000 then raise exception 'At most 5000 rows at a time.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('s3d_tracker_import'));   -- two imports at once: one after the other
  perform set_config('s3d.how', 'import', true);
  for e in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(e) <> 'object' then v_skipped := v_skipped + 1; continue; end if;
    v_cat := public.s3d_clean(e ->> 'category', 60);
    v_code := public.s3d_clean(e ->> 'item_code', 80);
    v_status := coalesce(nullif(e ->> 'status', ''), 'not_started');
    if v_cat is null or v_code is null or v_status not in ('live', 'review', 'hidden', 'in_progress', 'blocked', 'not_started')
       or (v_cat || chr(1) || v_code) = any (v_seen) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_seen := v_seen || (v_cat || chr(1) || v_code);
    v_created := case when e ->> 'created_on' ~ '^\d{4}-\d{2}-\d{2}$' then (e ->> 'created_on')::date end;
    v_prod := nullif(lower(btrim(coalesce(e ->> 'product_id', ''))), '');
    if v_prod !~ '^[a-z0-9][a-z0-9-]{0,79}$' then v_prod := null; end if;
    v_link := public.s3d_clean(e ->> 'link', 500);
    if v_link !~ '^https://' then v_link := null; end if;
    select * into o from public.s3d_tracker where category = v_cat and item_code = v_code for update;
    if not found then
      insert into public.s3d_tracker (category, item_code, model, brand, created_on, status, colour, product_id, link, prior_list, ref_list, in_master, source, notes)
        values (v_cat, v_code, public.s3d_clean(e ->> 'model', 400), public.s3d_clean(e ->> 'brand', 60), v_created, v_status,
                public.s3d_clean(e ->> 'colour', 120), v_prod, v_link, coalesce(e -> 'prior_list' = 'true'::jsonb, false),
                coalesce(e -> 'ref_list' = 'true'::jsonb, false), coalesce(e -> 'in_master' <> 'false'::jsonb, true),
                public.s3d_clean(e ->> 'source', 60), public.s3d_clean(e ->> 'notes', 1000, true));
      v_added := v_added + 1;
    elsif (o.model, o.brand, o.created_on, o.status, o.colour, o.product_id, o.link, o.prior_list, o.ref_list, o.in_master, o.source, o.notes)
          is not distinct from
          (public.s3d_clean(e ->> 'model', 400), public.s3d_clean(e ->> 'brand', 60), v_created, v_status, public.s3d_clean(e ->> 'colour', 120),
           v_prod, v_link, coalesce(e -> 'prior_list' = 'true'::jsonb, false), coalesce(e -> 'ref_list' = 'true'::jsonb, false),
           coalesce(e -> 'in_master' <> 'false'::jsonb, true), public.s3d_clean(e ->> 'source', 60), public.s3d_clean(e ->> 'notes', 1000, true)) then
      v_same := v_same + 1;
    else
      update public.s3d_tracker set model = public.s3d_clean(e ->> 'model', 400), brand = public.s3d_clean(e ->> 'brand', 60), created_on = v_created,
        status = v_status, colour = public.s3d_clean(e ->> 'colour', 120), product_id = v_prod, link = v_link,
        prior_list = coalesce(e -> 'prior_list' = 'true'::jsonb, false), ref_list = coalesce(e -> 'ref_list' = 'true'::jsonb, false),
        in_master = coalesce(e -> 'in_master' <> 'false'::jsonb, true), source = public.s3d_clean(e ->> 'source', 60),
        notes = public.s3d_clean(e ->> 'notes', 1000, true)
        where id = o.id;
      v_changed := v_changed + 1;
    end if;
  end loop;
  perform set_config('s3d.how', '', true);
  select count(*) into v_missing from public.s3d_tracker where not ((category || chr(1) || item_code) = any (v_seen));
  select * into v_me from public.s3d_profiles where user_id = auth.uid();
  insert into public.s3d_tracker_imports (actor, actor_email, actor_name, file_name, total, added, changed, unchanged, skipped, missing)
    values (auth.uid(), v_me.email, v_me.full_name, public.s3d_clean(p_file, 200), v_total, v_added, v_changed, v_same, v_skipped, v_missing)
    returning * into r;
  perform public.s3d_audit_write('tracker_import', 'tracker', r.id::text, coalesce(r.file_name, 'Tracker spreadsheet'),
    jsonb_build_object('rows', v_total, 'added', v_added, 'changed', v_changed, 'unchanged', v_same, 'skipped', v_skipped));
  return row_to_json(r);
end $$;

-- Items the Tracker page found on the site (their code is a colour of a product on show): live (admins and managers,
-- every time one of them opens the page; an item already live is left alone). p_items: [{id, product, colour}];
-- the product id and colour fill in only where the item has none. Each change notifies as any status change does.
create or replace function public.s3d_tracker_live(p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  v_prod text;
  n int := 0;
begin
  perform public.s3d_need(array['admin', 'manager']);
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 5000 then
    raise exception 'The list of items is missing.' using errcode = 'P0001';
  end if;
  perform set_config('s3d.how', 'site', true);
  for e in select value from jsonb_array_elements(p_items) loop
    continue when jsonb_typeof(e) <> 'object' or coalesce(e ->> 'id', '') !~ '^[0-9]{1,18}$';
    v_prod := nullif(lower(btrim(coalesce(e ->> 'product', ''))), '');
    if v_prod !~ '^[a-z0-9][a-z0-9-]{0,79}$' then v_prod := null; end if;
    update public.s3d_tracker set status = 'live', product_id = coalesce(product_id, v_prod),
      colour = coalesce(colour, public.s3d_clean(e ->> 'colour', 120))
      where id = (e ->> 'id')::bigint and status <> 'live';
    if found then n := n + 1; end if;
  end loop;
  perform set_config('s3d.how', '', true);
  return n;
end $$;

-- "Past its due date" notices: each item not built yet (not started, in progress or blocked) whose due date has
-- passed, once per due date, to its owner (nobody owns it: admins and managers). The admin calls it when someone
-- opens it; pg_cron calls it every hour too where the project has pg_cron (the end of this file).
create or replace function public.s3d_tracker_due() returns int
language plpgsql security definer set search_path = public as $$
declare
  t public.s3d_tracker;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  n int := 0;
begin
  if auth.uid() is not null then perform public.s3d_need(); end if;   -- signed-in staff, or the database itself
  for t in select * from public.s3d_tracker
    where due_on < v_today and status in ('not_started', 'in_progress', 'blocked') and due_told is distinct from due_on
    order by id for update skip locked
  loop
    n := n + public.s3d_notify(case when t.assignee is not null then array[t.assignee] else public.s3d_leads() end, 'due',
      public.s3d_tracker_name(t) || ' is past its due date',
      'It was due on ' || to_char(t.due_on, 'FMDD Mon YYYY') || ' and is “' || public.s3d_tracker_label(t.status) || '”.',
      '#/tracker/' || t.id, t.id, true);
    update public.s3d_tracker set due_told = t.due_on where id = t.id;
  end loop;
  return n;
end $$;

-- Mark the signed-in person's notifications read: one (p_id), or all of them (null). Returns how many.
create or replace function public.s3d_notify_read(p_id bigint default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  update public.s3d_notifications set read_at = now()
    where recipient = auth.uid() and read_at is null and (p_id is null or id = p_id);
  get diagnostics n = row_count;
  return n;
end $$;

-- The kinds the signed-in staff member turns off (the others stay on).
create or replace function public.s3d_notify_settings_set(p_off text[]) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_off text[] := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_off, '{}')) x), '{}');
  r public.s3d_notify_settings;
begin
  perform public.s3d_need();
  if not v_off <@ array['live', 'blocked', 'status', 'assigned', 'comment', 'due', 'import', 'feedback'] then
    raise exception 'Unknown kind of notification.' using errcode = 'P0001';
  end if;
  insert into public.s3d_notify_settings (user_id, off) values (auth.uid(), v_off)
    on conflict (user_id) do update set off = excluded.off, updated_at = now()
    returning * into r;
  return row_to_json(r);
end $$;

-- ── the tracker and notifications: row level security and grants ───────────────────────────────────────

drop policy if exists s3d_tracker_read on public.s3d_tracker;
create policy s3d_tracker_read on public.s3d_tracker for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_tracker_log_read on public.s3d_tracker_log;
create policy s3d_tracker_log_read on public.s3d_tracker_log for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_tracker_imports_read on public.s3d_tracker_imports;
create policy s3d_tracker_imports_read on public.s3d_tracker_imports for select to authenticated
  using ((select public.s3d_role()) is not null);
-- each person reads only their own notifications and settings
drop policy if exists s3d_notifications_read on public.s3d_notifications;
create policy s3d_notifications_read on public.s3d_notifications for select to authenticated
  using (recipient = (select auth.uid()));
drop policy if exists s3d_notify_settings_read on public.s3d_notify_settings;
create policy s3d_notify_settings_read on public.s3d_notify_settings for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.s3d_tracker, public.s3d_tracker_log, public.s3d_tracker_imports, public.s3d_notifications,
  public.s3d_notify_settings from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.s3d_tracker, public.s3d_tracker_log, public.s3d_tracker_imports,
  public.s3d_notifications, public.s3d_notify_settings to service_role;
-- the browser reads (row level security above); every write goes through the functions. Identity ids: no sequence grants.
grant select on table public.s3d_tracker, public.s3d_tracker_log, public.s3d_tracker_imports, public.s3d_notifications,
  public.s3d_notify_settings to authenticated;

revoke all on function public.s3d_clean(text, int, boolean) from public, anon, authenticated;
revoke all on function public.s3d_need(text[]) from public, anon, authenticated;
revoke all on function public.s3d_tracker_label(text) from public, anon, authenticated;
revoke all on function public.s3d_leads() from public, anon, authenticated;
revoke all on function public.s3d_watchers(bigint) from public, anon, authenticated;
revoke all on function public.s3d_notify(uuid[], text, text, text, text, bigint, boolean) from public, anon, authenticated;
revoke all on function public.s3d_tracker_name(public.s3d_tracker) from public, anon, authenticated;
revoke all on function public.s3d_tracker_touch() from public, anon, authenticated;
revoke all on function public.s3d_tracker_trg() from public, anon, authenticated;
revoke all on function public.s3d_tracker_comment_trg() from public, anon, authenticated;
revoke all on function public.s3d_tracker_import_trg() from public, anon, authenticated;
revoke all on function public.s3d_feedback_notify() from public, anon, authenticated;
revoke all on function public.s3d_staff() from public, anon, authenticated;
revoke all on function public.s3d_tracker_update(bigint, jsonb) from public, anon, authenticated;
revoke all on function public.s3d_tracker_comment(bigint, text) from public, anon, authenticated;
revoke all on function public.s3d_tracker_import(jsonb, text) from public, anon, authenticated;
revoke all on function public.s3d_tracker_live(jsonb) from public, anon, authenticated;
revoke all on function public.s3d_tracker_due() from public, anon, authenticated;
revoke all on function public.s3d_notify_read(bigint) from public, anon, authenticated;
revoke all on function public.s3d_notify_settings_set(text[]) from public, anon, authenticated;
-- signed-in staff (each function checks the role itself)
grant execute on function public.s3d_staff() to authenticated, service_role;
grant execute on function public.s3d_tracker_update(bigint, jsonb) to authenticated, service_role;
grant execute on function public.s3d_tracker_comment(bigint, text) to authenticated, service_role;
grant execute on function public.s3d_tracker_import(jsonb, text) to authenticated, service_role;
grant execute on function public.s3d_tracker_live(jsonb) to authenticated, service_role;
grant execute on function public.s3d_tracker_due() to authenticated, service_role;
grant execute on function public.s3d_notify_read(bigint) to authenticated, service_role;
grant execute on function public.s3d_notify_settings_set(text[]) to authenticated, service_role;
-- the helpers run only inside the functions and triggers above (their owner calls them)
grant execute on function public.s3d_clean(text, int, boolean) to service_role;
grant execute on function public.s3d_need(text[]) to service_role;
grant execute on function public.s3d_tracker_label(text) to service_role;
grant execute on function public.s3d_leads() to service_role;
grant execute on function public.s3d_watchers(bigint) to service_role;
grant execute on function public.s3d_notify(uuid[], text, text, text, text, bigint, boolean) to service_role;
grant execute on function public.s3d_tracker_name(public.s3d_tracker) to service_role;

-- Live notifications: Supabase Realtime sends each new row to its recipient's open admin (it applies the read policy
-- above). Supabase makes the publication supabase_realtime; the table is added to it once, so a re-run doesn't fail,
-- and a database without it (not Supabase) is left alone.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 's3d_notifications') then
    execute 'alter publication supabase_realtime add table public.s3d_notifications';
  end if;
end $$;

-- "Past its due date" every hour, where the project has the pg_cron extension switched on (Database → Extensions).
-- One job, named s3d-tracker-due; scheduling it again replaces it. Without pg_cron the admin checks when it is opened.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $c$select cron.schedule('s3d-tracker-due', '20 * * * *', 'select public.s3d_tracker_due()')$c$;
  end if;
end $$;

commit;

-- the Data API picks up the new tables and functions now rather than on its next schema reload
notify pgrst, 'reload schema';
