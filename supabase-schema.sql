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

-- UPDATE (Aug 2026): the serverless function now writes with the PUBLIC anon
-- key instead of the service role key, so no secret is needed in Vercel. The
-- policy below allows INSERT only — the anon key can add a lead but cannot
-- read, update, or delete any. Reading leads requires the Supabase dashboard
-- or the service role key.
alter table public.permit_closer_leads add column if not exists notified_at timestamptz;

drop policy if exists "anon can insert leads" on public.permit_closer_leads;
create policy "anon can insert leads"
  on public.permit_closer_leads
  for insert
  to anon
  with check (true);
