-- Untiered Campus module 9 (campus spec §9): notification emails through the existing outbox.
-- Additive only: four campus categories, and one preference column.
--
-- campus_assignment    a new assignment from the student's college (transactional: no preference turns it off)
-- campus_reminder      the 48-hour deadline reminder
-- campus_report_ready  a college-assigned round has finished and its report can be opened
-- campus_weekly        the Monday summary for a college's admins and placement officers
-- The last three are turned off by email_preferences.campus_reminders.

alter table public.email_deliveries drop constraint email_deliveries_category_check;
alter table public.email_deliveries add constraint email_deliveries_category_check check (
  category in (
    'welcome', 'daily_question', 'announcement', 'informative', 'reengagement',
    'campus_assignment', 'campus_reminder', 'campus_report_ready', 'campus_weekly'
  )
);

-- Not a marketing opt-in: it does not need consented_at, and defaults to on because these are
-- emails about the student's or staff member's own college work.
alter table public.email_preferences
  add column campus_reminders boolean not null default true;
