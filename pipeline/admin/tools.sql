-- 3D Catalogue Admin, the store tools: product requests, playlists for a store TV or tablet (/kiosk), "show this
-- on that device" for paired shop devices, and your own name on the Profile page.
--
-- Run pipeline/admin/schema.sql first, then paste this whole file into the same Supabase SQL editor and run it.
-- It follows schema.sql's rules: safe to run again (tables only if missing, functions replaced, policies dropped
-- and made again, grants reset to exactly what is below); every object is in `public` and starts with s3d_;
-- nothing touches auth.users, auth settings or other apps' tables; each new table is granted here, in the same run.
--
-- Who can do what (enforced here, not by the page):
--   any active staff   read requests, their comments, playlists and what each device shows; ask for a product;
--                      comment on a request; change their own name
--   admin, manager     change a request's status; make, change and delete playlists; send a product, a playlist
--                      or the catalogue to a paired device
--   anon (the site)    s3d_playlist_get (one playlist by id, for /kiosk) and s3d_device_poll (a paired device asks
--                      what to show, with its device key). No table.
-- The tables are read-only from the browser: every write goes through an s3d_ function below, which checks the
-- role and writes the audit row.

begin;

-- schema.sql makes the tables and helpers these build on
do $$
begin
  if to_regclass('public.s3d_devices') is null or to_regprocedure('public.s3d_role()') is null
     or to_regprocedure('public.s3d_audit_write(text, text, text, text, jsonb, uuid, text)') is null then
    raise exception 'Run pipeline/admin/schema.sql first, then this file.';
  end if;
end $$;

-- ── tables ───────────────────────────────────────────────────────────────────────────────────────────────

-- A request to build a product in 3D and AR, by its Sangeetha Product ID (the number at the end of its
-- sangeetha.com link). requested → accepted → building → review → live, or declined with a reason.
create table if not exists public.s3d_requests (
  id bigint generated always as identity primary key,
  sangeetha_id text not null check (sangeetha_id ~ '^[0-9]{3,12}$'),
  link text check (link is null or (char_length(link) <= 500 and link ~ '^https://www\.sangeetha\.com/')),
  brand text not null check (char_length(btrim(brand)) between 1 and 60),
  model text check (model is null or char_length(model) <= 80),
  colours text check (colours is null or char_length(colours) <= 300),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  needed_by date,
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'building', 'review', 'live', 'declined')),
  reason text check (reason is null or char_length(reason) <= 500),
  product_id text check (product_id is null or product_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),   -- in the catalogue, once built
  requested_by uuid,
  requested_by_email text,
  requested_by_name text,
  store_id bigint references public.s3d_stores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_at timestamptz not null default now(),
  constraint s3d_requests_reason check (status <> 'declined' or char_length(btrim(coalesce(reason, ''))) > 0)
);
-- one open request per Product ID (a declined or live one can be asked for again)
create unique index if not exists s3d_requests_open_id on public.s3d_requests (sangeetha_id)
  where status in ('requested', 'accepted', 'building', 'review');
create index if not exists s3d_requests_created on public.s3d_requests (created_at desc);

-- A request's comments, and its status changes (status_from, status_to; body is then the reason, if any).
create table if not exists public.s3d_request_comments (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.s3d_requests (id) on delete cascade,
  at timestamptz not null default now(),
  author uuid,
  author_email text,
  author_name text,
  body text check (body is null or char_length(body) between 1 and 1000),
  status_from text,
  status_to text,
  constraint s3d_request_comments_some check (body is not null or status_to is not null)
);
create index if not exists s3d_request_comments_request on public.s3d_request_comments (request_id, at);

-- Products to play one after another on a store TV or tablet (/kiosk?list=<id>). items: [{product, finish}],
-- in order; finish is the colour's address name (?finish=), or null for the first colour.
create table if not exists public.s3d_playlists (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  seconds int not null default 20 check (seconds between 8 and 600),
  show text not null default 'turn' check (show in ('turn', 'doors', 'features', 'still')),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 60),
  created_by uuid,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists s3d_playlists_name_key on public.s3d_playlists (lower(btrim(name)));

-- What a paired device was last sent (cmd changes with every send; picked_at: when the device opened it), and
-- what it says it is showing now. One row per device, made by the first send or the device's first poll.
create table if not exists public.s3d_device_screens (
  device_id bigint primary key references public.s3d_devices (id) on delete cascade,
  cmd uuid,
  kind text check (kind is null or kind in ('product', 'playlist', 'home')),
  product_id text check (product_id is null or product_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  finish text check (finish is null or (char_length(finish) <= 60 and finish ~ '^[a-z0-9]+(-[a-z0-9]+)*$')),
  playlist_id bigint references public.s3d_playlists (id) on delete set null,
  sent_at timestamptz,
  sent_by uuid,
  sent_by_email text,
  picked_at timestamptz,
  showing text,
  showing_at timestamptz,
  seen_at timestamptz
);

alter table public.s3d_requests enable row level security;
alter table public.s3d_request_comments enable row level security;
alter table public.s3d_playlists enable row level security;
alter table public.s3d_device_screens enable row level security;

-- ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────

-- Text from a form, trimmed and cut to p_max characters, without control characters (new lines are kept
-- when p_lines); null when nothing is left.
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

-- ── product requests (any active staff asks and comments; admins and managers change the status) ─────────

-- p_product: the Sangeetha Product ID, or the product's whole sangeetha.com link (its ID is the number at the end)
create or replace function public.s3d_request_add(
  p_product text, p_brand text, p_model text default null, p_colours text default null,
  p_priority text default 'normal', p_needed_by date default null, p_notes text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_raw text := btrim(coalesce(p_product, ''));
  v_link text;
  v_sid text;
  v_brand text := public.s3d_clean(p_brand, 60);
  v_dup bigint;
  v_me public.s3d_profiles;
  r public.s3d_requests;
begin
  perform public.s3d_need();
  if v_raw ~ '^[0-9]{3,12}$' then
    v_sid := v_raw;
  elsif v_raw ~* '^(https?://)?(www\.)?sangeetha\.com/' then
    v_link := regexp_replace(regexp_replace(v_raw, '[?#].*$', ''), '^(https?://)?(www\.)?', 'https://www.', 'i');
    v_sid := substring(v_link from '/([0-9]{3,12})/?$');
    if v_sid is null or char_length(v_link) > 500 then
      raise exception 'Couldn’t find the Product ID in that link: it is the number at the end of it.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Give the Sangeetha Product ID (the number at the end of its sangeetha.com link) or the whole link.' using errcode = 'P0001';
  end if;
  if v_brand is null then raise exception 'Give the brand.' using errcode = 'P0001'; end if;
  if coalesce(p_priority, 'normal') not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Unknown priority.' using errcode = 'P0001';
  end if;
  if p_needed_by is not null and (p_needed_by < current_date - 1 or p_needed_by > current_date + 730) then
    raise exception 'The needed-by date has to be from today on, within two years.' using errcode = 'P0001';
  end if;
  select id into v_dup from public.s3d_requests
    where sangeetha_id = v_sid and status in ('requested', 'accepted', 'building', 'review') limit 1;
  if v_dup is not null then
    raise exception 'Product ID % is already requested (request #%). Add a comment there instead.', v_sid, v_dup using errcode = 'P0001';
  end if;
  select * into v_me from public.s3d_profiles where user_id = auth.uid();
  insert into public.s3d_requests (sangeetha_id, link, brand, model, colours, priority, needed_by, notes,
                                   requested_by, requested_by_email, requested_by_name, store_id)
    values (v_sid, v_link, v_brand, public.s3d_clean(p_model, 80), public.s3d_clean(p_colours, 300),
            coalesce(p_priority, 'normal'), p_needed_by, public.s3d_clean(p_notes, 1000, true),
            auth.uid(), v_me.email, v_me.full_name, v_me.store_id)
    returning * into r;
  perform public.s3d_audit_write('request_created', 'request', r.id::text,
    r.brand || coalesce(' ' || r.model, '') || ' (' || r.sangeetha_id || ')',
    jsonb_strip_nulls(jsonb_build_object('product_id', r.sangeetha_id, 'priority', r.priority, 'needed_by', r.needed_by)));
  return row_to_json(r);
end $$;

create or replace function public.s3d_request_status(
  p_id bigint, p_status text, p_reason text default null, p_product text default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  open_ constant text[] := array['requested', 'accepted', 'building', 'review'];
  v_why text := public.s3d_clean(p_reason, 500, true);
  v_prod text := nullif(lower(btrim(coalesce(p_product, ''))), '');
  v_dup bigint;
  v_me public.s3d_profiles;
  r public.s3d_requests;
  n public.s3d_requests;
begin
  perform public.s3d_need(array['admin', 'manager']);
  if p_status is null or p_status not in ('requested', 'accepted', 'building', 'review', 'live', 'declined') then
    raise exception 'Unknown status.' using errcode = 'P0001';
  end if;
  select * into r from public.s3d_requests where id = p_id for update;
  if not found then raise exception 'No such request.' using errcode = 'P0002'; end if;
  if p_status = 'declined' and v_why is null then
    raise exception 'Say why it isn’t possible.' using errcode = 'P0001';
  end if;
  if v_prod is not null and v_prod !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception 'That isn’t a catalogue product id (lower-case letters, digits and dashes).' using errcode = 'P0001';
  end if;
  if p_status = r.status and v_prod is not distinct from r.product_id and (p_status <> 'declined' or v_why = r.reason) then
    return row_to_json(r);   -- nothing changed
  end if;
  if p_status = any (open_) and not r.status = any (open_) then
    select id into v_dup from public.s3d_requests
      where sangeetha_id = r.sangeetha_id and id <> r.id and status = any (open_) limit 1;
    if v_dup is not null then
      raise exception 'Product ID % already has an open request (#%).', r.sangeetha_id, v_dup using errcode = 'P0001';
    end if;
  end if;
  update public.s3d_requests set
    status = p_status,
    reason = case when p_status = 'declined' then v_why end,
    product_id = coalesce(v_prod, product_id),
    status_at = case when p_status <> r.status then now() else status_at end,
    updated_at = now()
    where id = r.id returning * into n;
  select * into v_me from public.s3d_profiles where user_id = auth.uid();
  if n.status <> r.status or (n.status = 'declined' and v_why is distinct from r.reason) then
    insert into public.s3d_request_comments (request_id, author, author_email, author_name, body, status_from, status_to)
      values (r.id, auth.uid(), v_me.email, v_me.full_name, v_why, r.status, n.status);
  end if;
  perform public.s3d_audit_write('request_status', 'request', r.id::text,
    r.brand || coalesce(' ' || r.model, '') || ' (' || r.sangeetha_id || ')',
    jsonb_strip_nulls(jsonb_build_object(
      'status', case when n.status <> r.status then jsonb_build_object('from', r.status, 'to', n.status) end,
      'reason', case when n.status = 'declined' then v_why end,
      'product', case when n.product_id is distinct from r.product_id then n.product_id end)));
  return row_to_json(n);
end $$;

create or replace function public.s3d_request_comment(p_id bigint, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_body text := public.s3d_clean(p_body, 1000, true);
  v_me public.s3d_profiles;
  r public.s3d_requests;
  c public.s3d_request_comments;
begin
  perform public.s3d_need();
  if v_body is null then raise exception 'Write a comment first.' using errcode = 'P0001'; end if;
  select * into r from public.s3d_requests where id = p_id;
  if not found then raise exception 'No such request.' using errcode = 'P0002'; end if;
  select * into v_me from public.s3d_profiles where user_id = auth.uid();
  insert into public.s3d_request_comments (request_id, author, author_email, author_name, body)
    values (r.id, auth.uid(), v_me.email, v_me.full_name, v_body) returning * into c;
  update public.s3d_requests set updated_at = now() where id = r.id;
  perform public.s3d_audit_write('request_commented', 'request', r.id::text,
    r.brand || coalesce(' ' || r.model, '') || ' (' || r.sangeetha_id || ')',
    jsonb_build_object('text', left(v_body, 120)));
  return row_to_json(c);
end $$;

-- ── playlists (admins and managers; the site reads one by id) ──────────────────────────────────────────

-- p_id null makes a new playlist. p_items: [{product, finish}] in order, at most 60.
create or replace function public.s3d_playlist_save(
  p_id bigint, p_name text, p_seconds int, p_show text, p_items jsonb
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_name text := public.s3d_clean(p_name, 80);
  v_secs int := coalesce(p_seconds, 20);
  v_show text := coalesce(p_show, 'turn');
  v_items jsonb;
  v_bad bigint;
  v_me public.s3d_profiles;
  o public.s3d_playlists;
  n public.s3d_playlists;
  v_changed jsonb := '{}'::jsonb;
begin
  perform public.s3d_need(array['admin', 'manager']);
  if v_name is null then raise exception 'Give the playlist a name.' using errcode = 'P0001'; end if;
  if v_secs not between 8 and 600 then raise exception 'Seconds per product: from 8 to 600.' using errcode = 'P0001'; end if;
  if v_show not in ('turn', 'doors', 'features', 'still') then raise exception 'Unknown way to show it.' using errcode = 'P0001'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'The product list is missing.' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'At most 60 products in a playlist.' using errcode = 'P0001'; end if;
  select i into v_bad from jsonb_array_elements(p_items) with ordinality as t (e, i)
    where jsonb_typeof(e) <> 'object' or coalesce(e ->> 'product', '') !~ '^[a-z0-9][a-z0-9-]{0,79}$'
       or (nullif(e ->> 'finish', '') is not null and (char_length(e ->> 'finish') > 60 or (e ->> 'finish') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'))
    limit 1;
  if v_bad is not null then raise exception 'Product % in the list isn’t right.', v_bad using errcode = 'P0001'; end if;
  v_items := coalesce((select jsonb_agg(jsonb_build_object('product', e ->> 'product', 'finish', nullif(e ->> 'finish', '')) order by i)
                       from jsonb_array_elements(p_items) with ordinality as t (e, i)), '[]'::jsonb);
  if exists (select 1 from public.s3d_playlists where lower(btrim(name)) = lower(v_name) and id is distinct from p_id) then
    raise exception 'There is already a playlist called “%”.', v_name using errcode = 'P0001';
  end if;
  select * into v_me from public.s3d_profiles where user_id = auth.uid();
  if p_id is null then
    insert into public.s3d_playlists (name, seconds, show, items, created_by, created_by_email, updated_by_email)
      values (v_name, v_secs, v_show, v_items, auth.uid(), v_me.email, v_me.email) returning * into n;
    perform public.s3d_audit_write('playlist_created', 'playlist', n.id::text, n.name,
      jsonb_build_object('products', jsonb_array_length(n.items), 'seconds', n.seconds, 'show', n.show));
    return row_to_json(n);
  end if;
  select * into o from public.s3d_playlists where id = p_id for update;
  if not found then raise exception 'No such playlist.' using errcode = 'P0002'; end if;
  update public.s3d_playlists set name = v_name, seconds = v_secs, show = v_show, items = v_items,
    updated_by_email = v_me.email, updated_at = now() where id = p_id returning * into n;
  if n.name <> o.name then v_changed := v_changed || jsonb_build_object('name', jsonb_build_object('from', o.name, 'to', n.name)); end if;
  if n.seconds <> o.seconds then v_changed := v_changed || jsonb_build_object('seconds', jsonb_build_object('from', o.seconds, 'to', n.seconds)); end if;
  if n.show <> o.show then v_changed := v_changed || jsonb_build_object('show', jsonb_build_object('from', o.show, 'to', n.show)); end if;
  if n.items <> o.items then v_changed := v_changed || jsonb_build_object('products', jsonb_build_object('from', jsonb_array_length(o.items), 'to', jsonb_array_length(n.items))); end if;
  if v_changed <> '{}'::jsonb then
    perform public.s3d_audit_write('playlist_updated', 'playlist', n.id::text, n.name, v_changed);
  end if;
  return row_to_json(n);
end $$;

create or replace function public.s3d_playlist_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.s3d_playlists;
begin
  perform public.s3d_need(array['admin', 'manager']);
  delete from public.s3d_playlists where id = p_id returning * into o;
  if not found then raise exception 'No such playlist.' using errcode = 'P0002'; end if;
  perform public.s3d_audit_write('playlist_deleted', 'playlist', o.id::text, o.name,
    jsonb_build_object('products', jsonb_array_length(o.items)));
end $$;

-- /kiosk?list=<id> on a store screen (anon key). Playlists aren't secret: a name and product ids.
create or replace function public.s3d_playlist_get(p_id bigint) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'name', name, 'seconds', seconds, 'show', show, 'items', items, 'updated_at', updated_at)
  from public.s3d_playlists where id = p_id
$$;

-- ── showing a product or playlist on a paired device ──────────────────────────────────────────────────

-- An admin or manager sends a product (p_kind 'product', with p_product and optionally the colour p_finish),
-- a playlist ('playlist', p_playlist) or the catalogue's front page ('home') to a paired device.
create or replace function public.s3d_device_show(
  p_device bigint, p_kind text, p_product text default null, p_finish text default null, p_playlist bigint default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v public.s3d_devices;
  v_prod text;
  v_fin text;
  v_list public.s3d_playlists;
  v_me public.s3d_profiles;
  s public.s3d_device_screens;
begin
  perform public.s3d_need(array['admin', 'manager']);
  select * into v from public.s3d_devices where id = p_device;
  if not found then raise exception 'No such device.' using errcode = 'P0002'; end if;
  if v.paired_at is null then
    raise exception 'Pair this device first: only a paired device can be sent something.' using errcode = 'P0001';
  end if;
  if p_kind = 'product' then
    v_prod := lower(btrim(coalesce(p_product, '')));
    v_fin := nullif(lower(btrim(coalesce(p_finish, ''))), '');
    if v_prod !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'Choose a product.' using errcode = 'P0001'; end if;
    if v_fin is not null and (char_length(v_fin) > 60 or v_fin !~ '^[a-z0-9]+(-[a-z0-9]+)*$') then
      raise exception 'Unknown colour.' using errcode = 'P0001';
    end if;
  elsif p_kind = 'playlist' then
    select * into v_list from public.s3d_playlists where id = p_playlist;
    if not found then raise exception 'Choose a playlist.' using errcode = 'P0001'; end if;
  elsif p_kind is distinct from 'home' then
    raise exception 'Unknown thing to show.' using errcode = 'P0001';
  end if;
  select * into v_me from public.s3d_profiles where user_id = auth.uid();
  insert into public.s3d_device_screens as d (device_id, cmd, kind, product_id, finish, playlist_id, sent_at, sent_by, sent_by_email, picked_at)
    values (v.id, gen_random_uuid(), p_kind, v_prod, v_fin, v_list.id, now(), auth.uid(), v_me.email, null)
    on conflict (device_id) do update set cmd = excluded.cmd, kind = excluded.kind, product_id = excluded.product_id,
      finish = excluded.finish, playlist_id = excluded.playlist_id, sent_at = excluded.sent_at, sent_by = excluded.sent_by,
      sent_by_email = excluded.sent_by_email, picked_at = null
    returning * into s;
  perform public.s3d_audit_write('device_show', 'device', v.id::text, v.name,
    case p_kind when 'product' then jsonb_strip_nulls(jsonb_build_object('product', v_prod, 'colour', v_fin))
                when 'playlist' then jsonb_build_object('playlist', v_list.name)
                else jsonb_build_object('show', 'catalogue') end);
  return row_to_json(s);
end $$;

-- A paired device asks what to show, every few seconds (device.js, anon key), with its device key, the command
-- it has just opened (p_ack) and what it is showing (p_showing). Unknown or reset keys get { ok: false }.
-- Writes at most every 30 seconds per device, unless something changed.
create or replace function public.s3d_device_poll(p_device uuid, p_ack uuid default null, p_showing text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_paired timestamptz;
  v_seen timestamptz;
  v_sh text := case when p_showing ~ '^(product:[a-z0-9][a-z0-9-]{0,79}|playlist:[0-9]{1,18}|kiosk|catalogue|showroom|compare|other)$' then p_showing end;
  s public.s3d_device_screens;
begin
  if p_device is null then return json_build_object('ok', false); end if;
  select id, paired_at, last_seen_at into v_id, v_paired, v_seen
    from public.s3d_devices where device_key = p_device and paired_at is not null;
  if v_id is null then return json_build_object('ok', false); end if;
  select * into s from public.s3d_device_screens where device_id = v_id;
  if not found then
    insert into public.s3d_device_screens (device_id, seen_at, showing, showing_at) values (v_id, now(), v_sh, now())
      on conflict (device_id) do nothing;
    select * into s from public.s3d_device_screens where device_id = v_id;
  elsif s.seen_at is null or s.seen_at < now() - interval '30 seconds' or s.showing is distinct from v_sh
        or (p_ack is not null and p_ack = s.cmd and s.picked_at is null) then
    update public.s3d_device_screens set
      seen_at = now(),
      picked_at = case when p_ack is not null and p_ack = cmd and picked_at is null then now() else picked_at end,
      showing_at = case when showing is distinct from v_sh then now() else showing_at end,
      showing = v_sh
      where device_id = v_id returning * into s;
  end if;
  if v_seen is null or v_seen < now() - interval '1 minute' then
    update public.s3d_devices set last_seen_at = now() where id = v_id;
  end if;
  -- a command sent before the device was last paired (a new pairing code since) is not for it
  if s.cmd is null or s.sent_at < v_paired or (s.kind = 'playlist' and s.playlist_id is null) then
    return json_build_object('ok', true, 'cmd', null);
  end if;
  return json_build_object('ok', true, 'cmd', s.cmd, 'kind', s.kind, 'product', s.product_id, 'finish', s.finish, 'playlist', s.playlist_id);
end $$;

-- ── profile ────────────────────────────────────────────────────────────────────────────────────────────

-- Your own name (only an admin edits other people's profiles). The profiles trigger audits it as user_updated.
create or replace function public.s3d_my_name(p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_name text := public.s3d_clean(p_name, 120);
begin
  perform public.s3d_need();
  update public.s3d_profiles set full_name = v_name where user_id = auth.uid();
  return json_build_object('full_name', v_name);
end $$;

-- ── row level security: active staff read; nobody writes directly ───────────────────────────────────────

drop policy if exists s3d_requests_read on public.s3d_requests;
create policy s3d_requests_read on public.s3d_requests for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_request_comments_read on public.s3d_request_comments;
create policy s3d_request_comments_read on public.s3d_request_comments for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_playlists_read on public.s3d_playlists;
create policy s3d_playlists_read on public.s3d_playlists for select to authenticated
  using ((select public.s3d_role()) is not null);
drop policy if exists s3d_device_screens_read on public.s3d_device_screens;
create policy s3d_device_screens_read on public.s3d_device_screens for select to authenticated
  using ((select public.s3d_role()) is not null);

-- ── grants: exactly these, every run ─────────────────────────────────────────────────────────────────────

revoke all on table public.s3d_requests, public.s3d_request_comments, public.s3d_playlists, public.s3d_device_screens
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.s3d_requests, public.s3d_request_comments, public.s3d_playlists,
  public.s3d_device_screens to service_role;
-- the browser reads (row level security: active staff only); writes go through the functions below
grant select on table public.s3d_requests, public.s3d_request_comments, public.s3d_playlists, public.s3d_device_screens
  to authenticated;
-- the ids are identity columns, so no sequence grants are needed

revoke all on function public.s3d_clean(text, int, boolean) from public, anon, authenticated;
revoke all on function public.s3d_need(text[]) from public, anon, authenticated;
revoke all on function public.s3d_request_add(text, text, text, text, text, date, text) from public, anon, authenticated;
revoke all on function public.s3d_request_status(bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.s3d_request_comment(bigint, text) from public, anon, authenticated;
revoke all on function public.s3d_playlist_save(bigint, text, int, text, jsonb) from public, anon, authenticated;
revoke all on function public.s3d_playlist_delete(bigint) from public, anon, authenticated;
revoke all on function public.s3d_playlist_get(bigint) from public, anon, authenticated;
revoke all on function public.s3d_device_show(bigint, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.s3d_device_poll(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.s3d_my_name(text) from public, anon, authenticated;

-- the site (anon key): one playlist for /kiosk, and a paired device asking what to show
grant execute on function public.s3d_playlist_get(bigint) to anon, authenticated, service_role;
grant execute on function public.s3d_device_poll(uuid, uuid, text) to anon, authenticated, service_role;
-- signed-in staff (each function checks the role itself)
grant execute on function public.s3d_request_add(text, text, text, text, text, date, text) to authenticated, service_role;
grant execute on function public.s3d_request_status(bigint, text, text, text) to authenticated, service_role;
grant execute on function public.s3d_request_comment(bigint, text) to authenticated, service_role;
grant execute on function public.s3d_playlist_save(bigint, text, int, text, jsonb) to authenticated, service_role;
grant execute on function public.s3d_playlist_delete(bigint) to authenticated, service_role;
grant execute on function public.s3d_device_show(bigint, text, text, text, bigint) to authenticated, service_role;
grant execute on function public.s3d_my_name(text) to authenticated, service_role;
-- s3d_clean and s3d_need run only inside the functions above (their owner calls them)
grant execute on function public.s3d_clean(text, int, boolean) to service_role;
grant execute on function public.s3d_need(text[]) to service_role;

commit;

-- the Data API picks up the new tables and functions now rather than on its next schema reload
notify pgrst, 'reload schema';
