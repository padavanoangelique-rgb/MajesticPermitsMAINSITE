-- The Permit Closer — case review leads
-- Paste this into Supabase: Project → SQL Editor → New query → Run

create table if not exists public.permit_closer_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text not null,
  address text not null,
  county text,
  refnum text,
  notes text
);

-- Row Level Security: locked down by default (no policies below means no
-- anon/authenticated access at all). The case-review serverless function
-- writes using the service role key, which bypasses RLS entirely — so
-- this table stays private even though the site is public.
alter table public.permit_closer_leads enable row level security;
