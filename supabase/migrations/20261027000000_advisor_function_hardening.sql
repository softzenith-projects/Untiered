-- Two Supabase security-advisor warnings on the production project, 27 October 2026.

-- function_search_path_mutable: a trigger function that resolves names through the
-- caller's search_path can be redirected by anyone who can create objects earlier on it.
-- now() lives in pg_catalog, which is searched even when the path is empty.
alter function public.set_updated_at() set search_path = '';

-- anon/authenticated_security_definer_function_executable: rls_auto_enable() is the
-- dashboard's "enable RLS on new tables" event trigger. It is not created by these
-- migrations, so it exists only where that setting was switched on, and the guard keeps
-- a fresh local stack applying cleanly. Being an event-trigger function it cannot be run
-- through /rest/v1/rpc anyway; revoking the grant closes the endpoint outright. The event
-- trigger itself does not need the API roles to hold EXECUTE.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
