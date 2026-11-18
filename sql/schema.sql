-- Paste into Supabase → SQL Editor → Run
create extension if not exists pgcrypto;

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('full','update')),
  input_text text not null,
  facts jsonb,
  plan jsonb,
  checks jsonb,
  steps jsonb,
  valid boolean not null default false,
  total_tokens integer not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.trace_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  n integer not null,
  model text not null,
  area text not null check (area in ('reading','venue','schedule','food','judging','budget')),
  input text not null,
  output text not null,
  prompt_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.rejected_messages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.runs(id) on delete cascade,
  message text not null,
  reason text not null,
  source text not null check (source in ('model','validator','skipped')),
  created_at timestamptz not null default now()
);

create index if not exists trace_calls_run_idx on public.trace_calls(run_id);
create index if not exists rejected_run_idx on public.rejected_messages(run_id);

-- Only the server (secret key) touches these tables. No public policies = no browser access.
alter table public.runs enable row level security;
alter table public.trace_calls enable row level security;
alter table public.rejected_messages enable row level security;
