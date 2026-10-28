-- PRD §05, §12: remove older uploads that the profile cannot show. Keep the latest
-- upload (including a failed one the candidate can see) and the newest parsed resume
-- a round may still use. Object cleanup runs through the existing durable outbox.
-- Rows with an invalid legacy storage key are deliberately left for manual review:
-- the service role must never delete a path outside the owner's resume folder.
-- The round-media migration narrowed this list after resume deletion was added.
-- Restore the reason before any backfill or API cleanup can enqueue a resume job.
alter table public.storage_deletion_jobs drop constraint storage_deletion_jobs_reason_check;
alter table public.storage_deletion_jobs add constraint storage_deletion_jobs_reason_check
  check (reason in ('candidate_deleted', 'retention_expired', 'account_deleted', 'round_finished', 'resume_deleted'));

with ranked as (
  select id, user_id, storage_bucket, storage_path, parse_status,
         row_number() over (partition by user_id order by uploaded_at desc, id desc) as upload_rank,
         row_number() over (
           partition by user_id, (parse_status = 'parsed')
           order by parsed_at desc nulls last, uploaded_at desc, id desc
         ) as parsed_rank
    from public.resumes
), removable as (
  select id, user_id, storage_path from ranked
   where parse_status <> 'processing'
     and upload_rank > 1
     and (parse_status <> 'parsed' or parsed_rank > 1)
     and storage_bucket = 'resumes'
     and storage_path like user_id::text || '/%'
     and substring(storage_path from length(user_id::text) + 2) ~ '^[A-Za-z0-9._-]+$'
     and position('..' in substring(storage_path from length(user_id::text) + 2)) = 0
), enqueued as (
  insert into public.storage_deletion_jobs
         (user_id, session_id, bucket, object_prefix, reason)
  select user_id, null, 'resumes', storage_path, 'resume_deleted' from removable
  on conflict (bucket, object_prefix) do update
     set completed_at = null, next_attempt_at = now(),
         settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
         reason = excluded.reason, updated_at = now()
  returning object_prefix
)
delete from public.resumes r using removable old
 where r.id = old.id and exists (select 1 from enqueued where object_prefix = old.storage_path);

-- Earlier avatar replacements overwrote profiles.avatar_path, leaving no application
-- row for the older file. Storage's object index still names those files. Queue only
-- direct-child avatar keys for existing users, older than an active upload could be.
with old_avatars as (
  select o.name, u.id as user_id
    from storage.objects o
    join public.users u on split_part(o.name, '/', 1) = u.id::text
    left join public.profiles p on p.user_id = u.id
   where o.bucket_id = 'resumes'
     and o.name ~ '^[0-9a-f-]{36}/avatar-[A-Za-z0-9._-]+$'
     and position('..' in o.name) = 0
     and o.created_at < now() - interval '1 hour'
     and o.name is distinct from p.avatar_path
)
insert into public.storage_deletion_jobs
       (user_id, session_id, bucket, object_prefix, reason)
select user_id, null, 'resumes', name, 'resume_deleted' from old_avatars
on conflict (bucket, object_prefix) do update
   set completed_at = null, next_attempt_at = now(),
       settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
       reason = excluded.reason, updated_at = now();
