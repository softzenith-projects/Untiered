-- Keep the database-triggered signup email in step with the API's first-use fallback.
create or replace function public.queue_confirmed_signup_email()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  opted_in boolean;
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;

  opted_in := coalesce(new.raw_user_meta_data ->> 'email_marketing_opt_in', 'false') = 'true';

  insert into public.users (id, email, display_name)
  values (new.id, new.email, nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''))
  on conflict (id) do nothing;

  update public.users set email = new.email
   where id = new.id and email is distinct from new.email;

  insert into public.email_preferences
    (user_id, daily_question, announcements, reengagement, consented_at)
  values
    (new.id, opted_in, opted_in, opted_in, case when opted_in then now() else null end)
  on conflict (user_id) do nothing;

  insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
  values
    (new.id, 'welcome', 'welcome', 'Your seat is saved. No velvet rope required.',
     E'Hey there, welcome to Untiered!\n\nNobody asks which college stamped your degree or which tier someone assigned you. Your skills do the talking. We just hand you the mic.\n\nPick a company and role for a spoken mock interview, or warm up with a course or a round in Arena.\n\nThen the fun begins: learn, practise, build, level up. No tiers attached.')
  on conflict (user_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_confirmed_signup_email() from public, anon, authenticated;
