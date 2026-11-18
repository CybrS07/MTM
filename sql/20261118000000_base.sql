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
