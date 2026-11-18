# Untiered Campus: college partnership features (v1)

Owner: Naman · Written 13 November 2026 · Status: **spec for review, nothing built beyond
the public `/colleges` page**

This is the owner's source document ("Untiered Campus: College Partnership Features (v1)",
13 Nov 2026), adapted to this codebase and to CLAUDE.md. Where the adaptation changes the
source, the change is marked **[Changed]** with the reason. The schema and API plan for
modules 1–4 is in [campus-v1-plan.md](campus-v1-plan.md).

**Context.** This extends the existing Untiered app (Next.js, Kotlin Spring Boot,
Supabase Postgres). Reuse the existing AI interview engine (`InterviewService`, the round
types, `CampusRounds`) and the existing practice content. Do not rebuild or duplicate them.

**Non-negotiables carried over from CLAUDE.md**

- All logic stays on the server; the web app consumes the same versioned `/api/v1` API
  the mobile apps will.
- Every user-data table has an owner column and row-level security.
- Recording consent stays a hard gate per round. The camera is shown, never recorded.
- Account deletion actually deletes.
- No new paid service without the owner's go-ahead.

---

## 1. Organisations and multi-tenancy (P0)

- An organisation has a type. v1 only creates `college`; the type leaves room for
  `employer` later.
- College profile: name, city, state, logo, contact person.
- Departments (CSE, IT, ECE, …), per college.
- Batches: department + graduating year + name, e.g. "CSE 2027".
- Every college-scoped table carries `org_id`, and every college-scoped query is filtered
  by it. College A must never read or write College B's data.
- An internal platform-admin screen creates colleges. Onboarding is manual for now.
- **[Changed]** A college's logo is a URL to an object in our own storage, uploaded by a
  platform admin. Hotlinking a college's website is not allowed, because it leaks the
  student's visit to a third party.

## 2. Roles and access (P0)

- Roles: `COLLEGE_ADMIN`, `TPO`, `FACULTY`, `STUDENT`, `PLATFORM_ADMIN`.
- Faculty can be limited to specific departments or batches.
- A student belongs to at most one college and one batch at a time. Their existing
  personal Untiered account links to it.
- An audit log records admin actions: who viewed or exported what, and who changed what.
- **[Changed]** `PLATFORM_ADMIN` is not a row in the database. It is the existing
  configuration allow-list (`interviewos.admin`, `AdminAccess`), which an account cannot
  grant itself through a bug in an endpoint. College roles are rows, scoped to one college.

## 3. Student onboarding (P0)

- Bulk CSV import with these columns: name, email, roll number, department, batch,
  graduation year.
- A validation preview before import shows duplicates, bad emails, unknown batches, and
  rows already in another college.
- Email invitations with a single-use link to join.
- If the email already has an Untiered account, it is linked, not duplicated.
- Resend invite. Status is tracked as Invited → Joined → Active.
- A consent screen on joining covers what the college will see and that answers are
  evaluated by AI.
- **[Changed] No account is created at import.** The invite link brings the student to the
  normal sign-in (Google or email). Joining links whichever account they sign in with, as
  long as its verified email matches the invite. A student who already has an account
  therefore keeps it, and nobody gets an account they never asked for.
- **[Changed] Linking an existing account always takes the student's own click.** Matching
  an email at import never shares that person's history with a college on its own.
- **[Changed] Recording consent is not part of this screen.** Audio recording is required
  for a spoken round and is already consented per round, with a timestamp. A one-off
  "optional recording consent" on joining would contradict that gate.
- **[Changed]** The status names are Invited → Joined → Active. "Activated" and "Active"
  were too easy to confuse. Joined means the student accepted. Active means they have
  practised in the last 14 days.

## 4. Assignments (P0)

- A TPO or faculty member assigns a task to a batch or to selected students.
- Assignment types:
  - **AI mock interview**, on the existing round types: technical fundamentals, HR, a
    resume-based project deep-dive, aptitude, and the spoken coding round. Each
    assignment sets a duration (30, 45 or 60 minutes, as `RoundLength` allows) and an
    optional company and role.
  - **Arena scenario set**: a chosen set of server-graded Arena scenarios.
  - **MCQ test (core CS, aptitude): deferred to 4b.** See the change note below.
- Each assignment has a deadline, an attempt limit, and a per-student interview cap. The
  server enforces the cap, to control AI cost.
- Students see an "Assigned to you" section on their dashboard with due dates.
- Completion tracking: Not started, In progress, Completed, Overdue.
- **[Changed] Interviews a college assigns are paid for by the college,** from a per-college
  interview allowance that a platform admin sets by hand. They never use a student's own
  free rounds or purchased credits. Billing colleges stays out of scope for v1.
- **[Changed] Difficulty:** an interview round has no difficulty setting. It adapts to the
  candidate, and the closest existing input is the candidate's stage. An assignment can
  set the stage (student or recent graduate); there is no difficulty dial.
- **[Changed] MCQ tests are deferred.** Arena's course-derived multiple-choice questions
  are scored in the browser, and the server takes the client's word for whether an answer
  was right. That is fine for personal practice, but not for a score a placement cell acts
  on. An assessable MCQ test needs the questions and answer keys held on the server. That
  is a content-pipeline task of its own (4b). Arena scenarios are already graded on the
  server, so they can be assigned in v1.
- **[Changed] A separate coding assessment (an editor with test cases) is deferred.** The
  spoken coding round already runs code through `CodeRunner` and is assessable. A timed,
  auto-graded coding test is a new product surface.

## 5. Interview integrity (P0)

- Tab-switch and window-blur counts.
- Paste detection in coding and text answers.
- Answer timing: suspiciously fast answers or long pauses. `answer_timing` already exists.
- Flags appear on the report. They never fail the student automatically.
- **[Changed]** Integrity flags are shown to staff as signals with counts, never as a
  verdict, and the student can see the same flags on their own report.

## 6. Student readiness report (P0)

- Scores: overall, coding, core CS, technical interview, communication, aptitude.
- Default weights are 30 / 25 / 25 / 10 / 10, configurable per college.
- A missing component is left out and shown as "Not attempted". It is never counted as 0.
- Bands: Strong (70+), Interview-ready (60–69), Needs improvement (50–59), Needs
  structured prep (under 50). The same lines as the interview report: 60% would likely
  clear a round, 70% is a clear pass (owner, 18 November 2026).
- Each interview's detail shows the questions, an answer summary, strengths, missing
  concepts and suggested topics. The existing report already holds these.
- Recommended practice links to relevant Arena and course content.
- Score history over time, to show improvement.
- **[Changed] Evidence threshold:** a component's score shows only once there is enough
  evidence for it. One 30-minute round is not a "core CS score". `ReadinessService`
  already applies an evidence threshold, and the college view uses the same one.
- **[Open, owner decision] What a college can see.** Recommendation: the college sees only
  rounds started from one of its assignments, plus any personal round the student chooses
  to share. A student's private practice stays private.

## 7. TPO / placement dashboard (P0)

- Batch overview: enrolled, joined, active, completion rate.
- A readiness distribution chart: counts per band.
- Averages by department and by topic, as a skill-gap heatmap (DSA, DBMS, OS, OOPs, CN,
  communication).
- A student table with filters (department, batch, band, completion status) and sorting.
- Drill into any student's report, within what the student has consented to share.
- Export to CSV and PDF. The PDF batch report is what the TPO shows management.
- **[Changed]** Every export and every report view is written to the audit log.

## 8. Faculty view (P1)

- The same dashboard, limited to the departments or batches assigned to that faculty member.
- A "Students needing attention" list: low scores, inactive, or overdue.
- A private comment on a student's report. The comment is private to staff and never
  shown to the student; the consent screen says such comments exist.

## 9. Notifications (P1)

- Emails: invite, new assignment, deadline reminder (48 hours before), report ready.
- A weekly summary email to the TPO.
- Students can turn off non-essential reminders, through the existing email preferences.
- Sent through the existing SES sender. **[Changed]** Invite emails go to addresses that
  have no user row yet, so they need their own outbox (`campus_invites` with a send
  status). `email_deliveries` is keyed by `user_id`.

## 10. Programmes and bootcamps (P1)

- A programme is a named bundle of weekly assignments, e.g. a "6-week Placement Accelerator".
- Reusable templates are defined once and cloned per college.
- Modules unlock weekly.
- A completion certificate (PDF) carries both Untiered and college branding. It may need a
  PDF library, which has to be justified in HANDOFF.md when it is built.

## 11. Usage and cost tracking (P1, internal)

- The number of AI interviews used per college, against the contracted cap.
- Estimated AI cost per college and per interview. Derived from the existing `ai_calls`
  ledger, joined through session → assignment → org.
- An internal-only admin view.

## 12. Campus leaderboard (P2)

- A batch or college leaderboard from Arena and assessment scores.
- Students opt in to appear. The default is anonymous.

## Out of scope for v1

Employer accounts, job postings, payments and billing, LMS or coursework uploads,
cross-college benchmarking, the mobile app.

## Build order

1 → 2 → 3 → 4 → 6 → 7 → 5 → 9 → 8 → 10 → 11 → 12, one module at a time with a review stop
after each. Modules 1 and 2 ship together: an organisation with no roles cannot be used or
tested.

Ground rules for the build:

- Tenant-isolation tests are blockers. College A must never read or write College B's data.
- The per-student AI interview cap is enforced on the server.
- No new paid services without asking.
- The existing student experience does not change, except for the added "Assigned to you"
  section.
