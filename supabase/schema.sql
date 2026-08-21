-- Run this once in the Supabase SQL Editor.
create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  query text not null default '',
  report_type text not null,
  period text not null,
  sources text[] not null default '{}',
  template_file_name text,
  openai jsonb,
  gemini jsonb,
  references_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.saved_reports enable row level security;

-- Temporary public policies for the current unauthenticated prototype.
-- Replace these with authenticated-user policies when Supabase Auth is added.
create policy "prototype can read saved reports" on public.saved_reports for select using (true);
create policy "prototype can create saved reports" on public.saved_reports for insert with check (true);
create policy "prototype can delete saved reports" on public.saved_reports for delete using (true);
