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
-- Feedback photos go in the private Storage bucket s3d-feedback, made at the end of this file. Its two policies on
-- storage.objects apply to that bucket only; other apps' buckets are not touched.

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

commit;

-- the Data API picks up the new tables and functions now rather than on its next schema reload
notify pgrst, 'reload schema';
