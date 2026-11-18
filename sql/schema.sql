-- Paste into Supabase → SQL Editor → Run. Safe to run again.
create extension if not exists pgcrypto;

-- ============ TABLES ============
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('full','update')),
  input_text text not null check (char_length(input_text) <= 20000),
  facts jsonb,
  plan jsonb,
  checks jsonb,
  steps jsonb,
  valid boolean not null default false,
  total_tokens integer not null default 0 check (total_tokens >= 0),
  duration_ms integer check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.trace_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  n integer not null check (n > 0),
  model text not null check (char_length(model) <= 100),
  area text not null check (area in ('reading','venue','schedule','food','judging','budget')),
  input text not null check (char_length(input) <= 60000),
  output text not null check (char_length(output) <= 60000),
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  ms integer check (ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.rejected_messages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.runs(id) on delete cascade,
  message text not null check (char_length(message) <= 5000),
  reason text not null check (char_length(reason) <= 2000),
  source text not null check (source in ('model','validator','skipped')),
  created_at timestamptz not null default now()
);

create index if not exists runs_created_idx on public.runs(created_at desc);
create index if not exists trace_calls_run_idx on public.trace_calls(run_id);
create index if not exists rejected_run_idx on public.rejected_messages(run_id);

-- ============ ACCESS: only the server (secret key) can touch the data ============
alter table public.runs enable row level security;
alter table public.trace_calls enable row level security;
alter table public.rejected_messages enable row level security;
alter table public.runs force row level security;
alter table public.trace_calls force row level security;
alter table public.rejected_messages force row level security;

revoke all on public.runs, public.trace_calls, public.rejected_messages from anon, authenticated;

drop policy if exists deny_all on public.runs;
drop policy if exists deny_all on public.trace_calls;
drop policy if exists deny_all on public.rejected_messages;
create policy deny_all on public.runs for all to anon, authenticated using (false) with check (false);
create policy deny_all on public.trace_calls for all to anon, authenticated using (false) with check (false);
create policy deny_all on public.rejected_messages for all to anon, authenticated using (false) with check (false);

-- ============ RATE LIMIT inside the database ============
-- Rejects an insert when too many rows landed in the last minute (even if the API is bypassed).
create or replace function public.limit_runs() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.runs where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate limit: too many runs per minute' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.limit_trace_calls() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.trace_calls where created_at > now() - interval '1 minute') >= 200 then
    raise exception 'rate limit: too many trace rows per minute' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists runs_rate_limit on public.runs;
create trigger runs_rate_limit before insert on public.runs for each row execute function public.limit_runs();
drop trigger if exists trace_calls_rate_limit on public.trace_calls;
create trigger trace_calls_rate_limit before insert on public.trace_calls for each row execute function public.limit_trace_calls();

revoke all on function public.limit_runs(), public.limit_trace_calls() from public, anon, authenticated;

-- ====================================================================================================
-- LOGIN, ROLES AND RECEIPTS (used by the Edge Functions and the web app)
-- ====================================================================================================

-- ============ EMAIL PINS (6-digit sign-in codes). Only the Edge Functions (service role) touch this table ============
create table if not exists public.email_pins (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  pin_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists email_pins_email_idx on public.email_pins(email, created_at desc);
alter table public.email_pins enable row level security;
alter table public.email_pins force row level security;
revoke all on public.email_pins from anon, authenticated;
drop policy if exists deny_all on public.email_pins;
create policy deny_all on public.email_pins for all to anon, authenticated using (false) with check (false);

-- ============ PROFILES: one row per user with a role. Nobody can change their own role from the browser ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student','organizer')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;           -- read only: no insert, update or delete from the browser
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));

-- every new user gets a 'student' profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- users that signed in before this script existed
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

create or replace function public.is_organizer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'organizer');
$$;
revoke all on function public.is_organizer() from public, anon;
grant execute on function public.is_organizer() to authenticated;

-- To make yourself an organizer, sign in once, then run this in the SQL Editor (change the email):
--   update public.profiles set role = 'organizer' where id = (select id from auth.users where email = 'you@example.com');

-- ============ RECEIPTS ============
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null check (char_length(path) <= 200),
  amount_rs integer not null check (amount_rs >= 0 and amount_rs <= 100000000),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists receipts_user_idx on public.receipts(user_id, created_at desc);
alter table public.receipts enable row level security;
revoke all on public.receipts from anon, authenticated;
grant select, insert, delete on public.receipts to authenticated;

drop policy if exists receipts_read on public.receipts;
drop policy if exists receipts_insert on public.receipts;
drop policy if exists receipts_delete on public.receipts;
create policy receipts_read   on public.receipts for select to authenticated using (user_id = (select auth.uid()) or (select public.is_organizer()));
create policy receipts_insert on public.receipts for insert to authenticated with check (user_id = (select auth.uid()) and path like (select auth.uid())::text || '/%');
create policy receipts_delete on public.receipts for delete to authenticated using (user_id = (select auth.uid()));

-- private storage bucket: 5 MB, images and PDF only, each user writes only inside their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists receipts_obj_insert on storage.objects;
drop policy if exists receipts_obj_read on storage.objects;
drop policy if exists receipts_obj_delete on storage.objects;
create policy receipts_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy receipts_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_organizer())));
create policy receipts_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
