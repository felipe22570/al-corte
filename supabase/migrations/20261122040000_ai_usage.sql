-- Step 40 (F19, D42): usage log of the AI layer. One row per model call, without prompts, inputs or outputs.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task text not null check (length(task) between 1 and 100),
  prompt_version text not null check (length(prompt_version) between 1 and 50),
  model text not null check (length(model) between 1 and 100),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12,6) not null default 0 check (cost_usd >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  result text not null check (result in ('ok', 'invalid_output', 'api_error', 'timeout', 'budget_exceeded')),
  created_at timestamptz not null default now()
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

-- The log is append-only: owners read and insert their own rows, nobody edits or deletes them.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select, insert on public.ai_usage to authenticated;
create policy owner_select on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.ai_usage for insert to authenticated with check ((select auth.uid()) = user_id);

-- Spent in USD since a moment, as text so the amount keeps its exact decimals. Security invoker: RLS still applies to
-- sessions; the ingest route (service key, D51) filters by its configured owner.
create function public.ai_usage_spent_since(p_user_id uuid, p_since timestamptz)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(cost_usd), 0)::text from public.ai_usage where user_id = p_user_id and created_at >= p_since;
$$;

revoke all on function public.ai_usage_spent_since(uuid, timestamptz) from public, anon;
grant execute on function public.ai_usage_spent_since(uuid, timestamptz) to authenticated, service_role;
