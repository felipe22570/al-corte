create schema private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Keep the owner check and elevated writes outside the schemas exposed by PostgREST.
alter function public.generate_charges_for_subscription(uuid) set schema private;
revoke all on function private.generate_charges_for_subscription(uuid) from public, anon;
grant execute on function private.generate_charges_for_subscription(uuid) to authenticated;

create function public.generate_charges_for_subscription(p_id uuid)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.generate_charges_for_subscription(p_id);
$$;
revoke all on function public.generate_charges_for_subscription(uuid) from public, anon;
grant execute on function public.generate_charges_for_subscription(uuid) to authenticated;

comment on function public.generate_charges_for_subscription(uuid) is
  'Invoker-only API facade. The private implementation authenticates the caller and checks subscription ownership.';
comment on schema private is
  'Internal functions only. Do not add this schema to the Supabase Data API exposed schemas.';
