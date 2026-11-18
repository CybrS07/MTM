-- Accounts (6-digit email PIN), organizer role, receipts bucket, organizer read access.

create table if not exists public.organizers (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'student' check (role in ('student','organizer')),
  created_at timestamptz not null default now()
);

create table if not exists public.email_pins (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  pin_hash text not null,
  attempts integer not null default 0,
  used boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists email_pins_email_idx on public.email_pins(email, created_at desc);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path text not null unique check (char_length(path) <= 300),
  amount_rs integer not null check (amount_rs between 0 and 100000000),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists receipts_user_idx on public.receipts(user_id, created_at desc);

-- helpers
create or replace function public.is_organizer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'organizer')
$$;
revoke all on function public.is_organizer() from public, anon;
grant execute on function public.is_organizer() to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, lower(new.email),
    case when exists (select 1 from public.organizers o where o.email = lower(new.email)) then 'organizer' else 'student' end)
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- access: browser never writes profiles, pins or organizers
alter table public.organizers enable row level security;
alter table public.profiles enable row level security;
alter table public.email_pins enable row level security;
alter table public.receipts enable row level security;

revoke all on public.organizers, public.profiles, public.email_pins, public.receipts from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.receipts to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_organizer());

drop policy if exists receipts_select on public.receipts;
drop policy if exists receipts_insert on public.receipts;
drop policy if exists receipts_delete on public.receipts;
create policy receipts_select on public.receipts for select to authenticated
  using (user_id = auth.uid() or public.is_organizer());
create policy receipts_insert on public.receipts for insert to authenticated
  with check (user_id = auth.uid() and path like auth.uid()::text || '/%');
create policy receipts_delete on public.receipts for delete to authenticated
  using (user_id = auth.uid());

-- organizers can read the plan history
grant select on public.runs, public.trace_calls, public.rejected_messages to authenticated;
drop policy if exists organizer_read on public.runs;
drop policy if exists organizer_read on public.trace_calls;
drop policy if exists organizer_read on public.rejected_messages;
create policy organizer_read on public.runs for select to authenticated using (public.is_organizer());
create policy organizer_read on public.trace_calls for select to authenticated using (public.is_organizer());
create policy organizer_read on public.rejected_messages for select to authenticated using (public.is_organizer());

-- private receipts bucket: 5 MB, images and PDF only, one folder per user
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists receipts_obj_insert on storage.objects;
drop policy if exists receipts_obj_select on storage.objects;
drop policy if exists receipts_obj_delete on storage.objects;
create policy receipts_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy receipts_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_organizer()));
create policy receipts_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- Make someone an organizer BEFORE they first sign in (or update profiles.role afterwards):
-- insert into public.organizers (email) values ('organizer@example.com');
