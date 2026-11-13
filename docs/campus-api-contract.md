# Untiered Campus — API contract

The wire shapes for the campus API. **The backend and the web app are built against this
file at the same time**, so a change to a shape changes this file in the same commit.
Design reasoning lives in [campus-v1-plan.md](campus-v1-plan.md); this file is only the contract.

## Conventions

- All paths start with `/api/v1`. A bearer token is required on every route.
- The whole surface is behind `interviewos.features.campus` on the API
  (`NEXT_PUBLIC_FEATURE_CAMPUS`, default `false`). While it is off, every route below
  answers `404`, and the web app hides every campus page.
- JSON uses camelCase. Timestamps are ISO-8601 strings. Ids are UUID strings.
- Errors use the existing shape, `{ "code": string, "message": string }`.
- **Unauthorised access answers `404`, not `403`.** That covers a caller with no
  membership in the org, a platform-admin route called by a non-admin, and a resource id
  that belongs to another org. This matches `AdminAccess`: the response never confirms
  that a college exists.
- A caller who is a member but whose role lacks the permission gets `403` with
  `code: "campus_forbidden"`. Their membership already tells them the college exists.
- Lists that can grow use `{ "items": [...], "nextCursor": string | null }`, with
  `?cursor=` for the next page and at most 100 items per page.
- `{org}` in a path is the organisation id.
- Role values: `"college_admin" | "tpo" | "faculty" | "student"`.

---

## Module 1–2: organisations, structure, roles

### Shapes

```ts
type OrgStatus = "active" | "suspended";
type CampusRole = "college_admin" | "tpo" | "faculty" | "student";

interface OrgView {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: OrgStatus;
  interviewAllowance: number;   // org-funded interviews contracted (module 4 spends it)
  interviewsUsed: number;       // 0 until module 4
  createdAt: string;
}

interface AdminOrgSummary extends OrgView {
  staffCount: number;
  studentCount: number;
}

interface DepartmentView {
  id: string;
  code: string;          // ^[A-Z0-9&-]{1,16}$, e.g. "CSE"
  name: string;
  batchCount: number;
}

interface BatchView {
  id: string;
  departmentId: string;
  departmentCode: string;
  graduationYear: number;
  name: string;          // "CSE 2027"
  studentCount: number;
}

interface MemberView {
  id: string;            // membership id, never the user id
  name: string | null;   // users.display_name
  email: string;
  role: CampusRole;
  batchId: string | null;
  batchName: string | null;
  departmentCode: string | null;
  rollNumber: string | null;
  joinedAt: string;
  active: boolean;       // derived: a session or Arena answer in the last 14 days
}

interface FacultyScopesView {
  departmentIds: string[];
  batchIds: string[];
}

interface AuditEntryView {
  id: number;
  occurredAt: string;
  actorName: string | null;   // null once the actor's account is deleted
  actorKind: "member" | "platform_admin" | "system";
  action: string;             // "batch.created", "member.removed", "report.viewed", …
  targetType: string | null;
  targetId: string | null;
}

interface MeCampusView {
  student: {
    orgId: string;
    orgName: string;
    logoUrl: string | null;
    batchId: string;
    batchName: string;
    rollNumber: string | null;
  } | null;
  staff: { orgId: string; orgName: string; logoUrl: string | null; role: Exclude<CampusRole, "student"> }[];
}
```

### Platform admin

Allowed for callers on the `interviewos.admin` allow-list, checked through `AdminAccess`.
Everyone else gets `404`. Each write is audit-logged on the org with
`actorKind: "platform_admin"`.

| Method · path | Body → response |
|---|---|
| `GET /admin/campus/orgs` | → `AdminOrgSummary[]` |
| `POST /admin/campus/orgs` | `{ name, slug, city?, state?, contactName?, contactEmail?, contactPhone?, interviewAllowance? }` → `201 OrgView`; `409 slug_taken` |
| `GET /admin/campus/orgs/{org}` | → `AdminOrgSummary` |
| `PATCH /admin/campus/orgs/{org}` | any of `{ name, city, state, contactName, contactEmail, contactPhone, interviewAllowance, status }` → `OrgView` |
| `PUT /admin/campus/orgs/{org}/logo` | multipart `file`: png, jpeg or webp, ≤ 512 KB → `OrgView` |

### Caller context

| Method · path | Response |
|---|---|
| `GET /me/campus` | `MeCampusView`. Answers `{ student: null, staff: [] }` for a caller in no college. Only memberships with `status = joined` count. |

### College

The caller needs a joined staff membership in `{org}` (or must be a platform admin); a
student membership is not enough.

| Method · path | Permission | Body → response |
|---|---|---|
| `GET /campus/orgs/{org}` | any staff | → `OrgView` |
| `PATCH /campus/orgs/{org}` | college_admin | `{ contactName?, contactEmail?, contactPhone?, city?, state? }` → `OrgView` |
| `GET /campus/orgs/{org}/departments` | any staff (faculty: only departments in scope) | → `DepartmentView[]` |
| `POST /campus/orgs/{org}/departments` | college_admin, tpo | `{ code, name }` → `201 DepartmentView`; `409 department_code_taken` |
| `PATCH /campus/orgs/{org}/departments/{id}` | college_admin, tpo | `{ code?, name? }` → `DepartmentView` |
| `DELETE /campus/orgs/{org}/departments/{id}` | college_admin, tpo | → `204`; `409 department_has_batches` |
| `GET /campus/orgs/{org}/batches?departmentId=` | any staff (faculty: scoped) | → `BatchView[]` |
| `POST /campus/orgs/{org}/batches` | college_admin, tpo | `{ departmentId, graduationYear, name }` → `201 BatchView`; `409 batch_name_taken` |
| `PATCH /campus/orgs/{org}/batches/{id}` | college_admin, tpo | `{ graduationYear?, name? }` → `BatchView` |
| `DELETE /campus/orgs/{org}/batches/{id}` | college_admin, tpo | → `204`; `409 batch_has_members` |
| `GET /campus/orgs/{org}/members?role=&batchId=&departmentId=&q=&cursor=` | any staff (faculty: students in scope only) | → `{ items: MemberView[], nextCursor }`. `q` matches name, email or roll number. |
| `PATCH /campus/orgs/{org}/members/{id}` | college_admin, tpo (students only) | `{ batchId?, rollNumber? }` → `MemberView`; `409 roll_number_taken` |
| `DELETE /campus/orgs/{org}/members/{id}` | college_admin (anyone except themselves); tpo (students only) | → `204`. Sets `status = removed`; the account is untouched. |
| `PATCH /campus/orgs/{org}/members/{id}/role` | college_admin | `{ role: "college_admin" \| "tpo" \| "faculty" }`, staff only → `MemberView`. Refused when it would leave the org with no college_admin (`409 last_admin`). |
| `GET /campus/orgs/{org}/members/{id}/faculty-scopes` | college_admin | → `FacultyScopesView` |
| `PUT /campus/orgs/{org}/members/{id}/faculty-scopes` | college_admin | `FacultyScopesView` → `FacultyScopesView`; `400` when the member is not faculty |
| `GET /campus/orgs/{org}/audit-log?cursor=` | college_admin | → `{ items: AuditEntryView[], nextCursor }`, newest first |
| `POST /me/campus/leave` | student | → `204`. Sets the student's own membership to `left`. |

A suspended org answers `404` to every college route and to `/me/campus`. Platform-admin
routes still answer.

---

## Module 3: student onboarding

There are no accounts at import. An invite is an email address plus a single-use token.
Accepting the invite links whichever account is signed in. See plan §5.

### Shapes

```ts
type InviteStatus = "invited" | "joined" | "revoked" | "expired";
type InviteSendStatus = "pending" | "sending" | "sent" | "failed";

type ImportProblem =
  | "missing_name" | "bad_email" | "duplicate_email_in_file" | "duplicate_roll_in_file"
  | "unknown_department" | "unknown_batch" | "batch_department_mismatch" | "graduation_year_mismatch"
  | "already_member"        // a joined member of THIS college has this email
  | "already_invited"       // an open invite in THIS college has this email
  | "roll_number_taken";    // a joined member of THIS college has this roll number
// Never a problem code that reveals whether an email has an Untiered account.

interface ImportRowView {
  rowNumber: number;            // 1-based, the header row excluded
  fullName: string | null;
  email: string | null;         // lower-cased and trimmed
  rollNumber: string | null;
  departmentCode: string | null;
  batchName: string | null;
  graduationYear: number | null;
  problems: ImportProblem[];    // empty = will be invited
}

interface ImportPreview {
  id: string;
  status: "previewed" | "committed" | "discarded";
  createdAt: string;
  expiresAt: string;            // 24 hours after creation
  rows: ImportRowView[];
  summary: { total: number; valid: number; withProblems: number };
}

interface ImportCommitResult { invited: number; skipped: number }

interface InviteView {
  id: string;
  email: string;
  fullName: string;
  role: CampusRole;
  batchId: string | null;
  batchName: string | null;
  rollNumber: string | null;
  status: InviteStatus;         // "expired" when expiresAt has passed and the invite was not joined
  sendStatus: InviteSendStatus;
  sendCount: number;
  lastSentAt: string | null;
  createdAt: string;
  expiresAt: string;
  joinedAt: string | null;
}

interface InvitePreview {
  orgName: string;
  logoUrl: string | null;
  role: CampusRole;
  batchName: string | null;
  invitedEmailMasked: string;   // "r***@college.edu"
  signedInEmail: string;
  emailMatches: boolean;
  expiresAt: string;
  consentVersion: string;       // "campus-2026-11-13"
  shared: string[];             // what the college will see, in plain sentences (server-owned copy)
  notShared: string[];          // what stays private
  aiNotice: string;
}

interface AcceptInviteRequest {
  consentVersion: string;
  agreeDataSharing: boolean;    // must be true for a student invite
  agreeAiEvaluation: boolean;   // must be true for a student invite
  confirmDifferentEmail?: boolean; // required when emailMatches is false
}
```

**CSV format.** UTF-8, with or without a BOM. Comma-separated, or semicolon-separated as
Excel writes it in some locales. RFC 4180 quoting. The first row is the header and
matching is case-insensitive:
`name, email, roll_number, department, batch, graduation_year`. `department` is a
department code and `batch` is a batch name. Limits: 1 MB and 5,000 data rows; above
either, the upload is refused with `400 csv_invalid`.

### Joining (any signed-in user)

| Method · path | Body → response |
|---|---|
| `GET /campus/invites/{token}` | → `InvitePreview`. `404 invite_not_found` when the token is unknown, expired, revoked or already used. |
| `POST /campus/invites/{token}/accept` | `AcceptInviteRequest` → `MeCampusView`. Errors: `404 invite_not_found`; `400 consent_required`; `409 consent_version_stale`; `409 email_mismatch_unconfirmed`; `409 already_in_college`, when the caller is a joined student in another college; `409 already_member`, when the caller already has a joined membership in this college. |

The two `agree*` fields apply only to student invites. A staff invite accepts with any
values.

### Platform admin

| Method · path | Body → response |
|---|---|
| `POST /admin/campus/orgs/{org}/invites` | `{ email, fullName, role: "college_admin" \| "tpo" }` → `201 InviteView` |
| `GET /admin/campus/orgs/{org}/invites` | → `{ items: InviteView[], nextCursor }` (staff invites) |

### College

| Method · path | Permission | Body → response |
|---|---|---|
| `POST /campus/orgs/{org}/imports` | college_admin, tpo | multipart `file` → `201 ImportPreview`; `400 csv_invalid` |
| `GET /campus/orgs/{org}/imports/{id}` | college_admin, tpo | → `ImportPreview` |
| `DELETE /campus/orgs/{org}/imports/{id}` | college_admin, tpo | → `204` |
| `POST /campus/orgs/{org}/imports/{id}/commit` | college_admin, tpo | → `ImportCommitResult`. Rows with problems are skipped. `409 import_not_open` when the import is already committed, discarded or expired. |
| `GET /campus/orgs/{org}/invites?status=&role=&batchId=&q=&cursor=` | college_admin, tpo | → `{ items: InviteView[], nextCursor }` |
| `POST /campus/orgs/{org}/invites` | college_admin (any role); tpo (students only) | `{ email, fullName, role, batchId?, rollNumber? }` → `201 InviteView`. Errors: `409 already_invited`, `409 already_member`, `400 batch_required`. |
| `POST /campus/orgs/{org}/invites/{id}/resend` | college_admin, tpo | → `InviteView`. Rotates the token and resets the expiry to 14 days. `409 invite_not_open`; `429 resend_limit` after 10 sends. |
| `POST /campus/orgs/{org}/invites/{id}/revoke` | college_admin, tpo | → `InviteView` |

**Invite email.** A background job sends it through the existing SES sender with the
link `{EMAIL_PUBLIC_BASE_URL}/campus/join?token=<token>`. The token is 32 random bytes,
base64url-encoded, and only its SHA-256 is stored. Invites expire after 14 days. When SES
is not configured, invites stay `pending`.

---

## Module 4: assignments

### Shapes

```ts
type AssignmentKind = "interview" | "arena_scenarios";
type AssignmentStatus = "draft" | "published" | "archived";
type CompletionStatus = "not_started" | "in_progress" | "completed" | "overdue";

// Round types a college may assign. Values are RoundType.dbValue.
type AssignableRoundType =
  | "technical_fundamentals"   // "Technical interview"
  | "project_deep_dive"        // "Resume and projects"
  | "coding_practical"         // "Coding round"
  | "aptitude"                 // "Aptitude"
  | "hr_fit_closing"           // "HR interview"
  | "behavioural_competency";  // "Behavioural"

interface AssignmentInput {
  kind: AssignmentKind;
  title: string;                       // 1–140 characters
  instructions?: string | null;        // ≤ 2000 characters
  // interview
  roundType?: AssignableRoundType;
  durationMinutes?: 30 | 45 | 60;
  companyName?: string | null;         // empty = general practice
  roleTitle?: string | null;
  candidateStage?: "student" | "recent_graduate";  // default "student"
  language?: "english" | "hindi_english";          // default "english"
  // arena_scenarios
  scenarioIds?: string[];              // 1–20 live scenario ids
  opensAt?: string | null;             // default now
  dueAt: string;
  allowLate: boolean;
  attemptLimit: number;                // 1–10, interviews only
  interviewCap?: number | null;        // 1..attemptLimit; null = attemptLimit
  targets: { batchIds: string[]; memberIds: string[] };  // at least one
}

interface AssignmentView extends AssignmentInput {
  id: string;
  status: AssignmentStatus;
  createdAt: string;
  publishedAt: string | null;
  createdByName: string | null;
  targetBatches: { id: string; name: string }[];
  targetStudents: { id: string; name: string | null; rollNumber: string | null }[];
  counts: { recipients: number; notStarted: number; inProgress: number; completed: number; overdue: number };
}

interface RecipientProgress {
  memberId: string;
  name: string | null;
  email: string;
  rollNumber: string | null;
  batchName: string;
  status: CompletionStatus;
  attemptsUsed: number;                // interviews: attempts not handed back; scenarios: 0
  lastActivityAt: string | null;
  sessionIds: string[];                // interview kind: sessions started from this assignment
  scenarioScore: number | null;        // scenario kind: correct / total steps answered, 0–1
}

interface ScenarioOption { id: string; courseTitle: string; title: string; tier: string; estimatedMinutes: number }

interface AssignedItem {
  id: string;
  orgName: string;
  title: string;
  instructions: string | null;
  kind: AssignmentKind;
  roundType: AssignableRoundType | null;
  durationMinutes: number | null;
  companyName: string | null;
  roleTitle: string | null;
  scenarios: { id: string; title: string; courseSlug: string; completed: boolean }[];
  opensAt: string;
  dueAt: string;
  allowLate: boolean;
  status: CompletionStatus;
  attemptsUsed: number;
  attemptLimit: number;
  canStart: boolean;
  blockedReason: null | "not_open" | "past_due" | "attempt_limit" | "student_cap" | "college_allowance";
  sessionIds: string[];
}
```

**How completion is derived.** Nothing is stored as "completed"; it is worked out on read.

- `interview`: the assignment is completed once any attempt's session is `completed`, and
  in progress while an attempt is under way.
- `arena_scenarios`: the assignment is completed once every step of every scenario in the
  set has an answer in `user_step_answers`, and in progress when some do. The answer is
  graded on the server.
- Either kind is overdue when it is not completed, `dueAt` has passed, and `allowLate` is
  false. Otherwise it is not started.
- A scenario the student finished before the assignment counts, because each step can
  only be answered once.

**Recipients** are also derived: every joined student in a targeted batch, plus every
targeted student. A student who joins a targeted batch later receives the open
assignment.

### College

| Method · path | Permission | Body → response |
|---|---|---|
| `GET /campus/orgs/{org}/arena-scenarios` | any staff | → `ScenarioOption[]` (live scenarios only) |
| `GET /campus/orgs/{org}/assignments?status=` | any staff (faculty: only assignments that target their scope) | → `AssignmentView[]` |
| `POST /campus/orgs/{org}/assignments` | college_admin, tpo, faculty (targets must sit inside their scope) | `AssignmentInput` → `201 AssignmentView` (draft). `400 assignment_invalid` carries a message naming the field. |
| `GET /campus/orgs/{org}/assignments/{id}` | any staff (faculty: scoped) | → `AssignmentView` |
| `PATCH /campus/orgs/{org}/assignments/{id}` | creator, college_admin, tpo | draft: any `AssignmentInput` field; published: only `dueAt`, `allowLate`, `instructions` → `AssignmentView` |
| `POST /campus/orgs/{org}/assignments/{id}/publish` | creator, college_admin, tpo | → `AssignmentView` |
| `POST /campus/orgs/{org}/assignments/{id}/archive` | creator, college_admin, tpo | → `AssignmentView` |
| `GET /campus/orgs/{org}/assignments/{id}/progress?batchId=&status=` | any staff (faculty: scoped students only) | → `RecipientProgress[]` |

### Student

| Method · path | Body → response |
|---|---|
| `GET /me/assignments` | → `AssignedItem[]` for published assignments, ordered by `dueAt`. A caller with no joined student membership gets `[]`. This route is **not** behind the `campus` switch's 404, so the dashboard can call it unconditionally; with the switch off it answers `[]`. |
| `POST /sessions` (existing) | gains the optional field `assignmentId`. When it is present, the server takes `roundType`, `durationMinutes`, `companyName`, `roleTitle`, `candidateStage` and `language` from the assignment and ignores the client's values. Audio consent is still required. On success the response is unchanged, and the student's free rounds and credits are not touched. New errors: `404 assignment_not_found`; `409 assignment_not_open`; `409 assignment_past_due`; `409 assignment_attempt_limit`; `409 assignment_student_cap`; `402 college_allowance_exhausted`; and the existing `409 session_in_progress`. |

A scenario assignment needs no new student route. The student plays the scenarios through
the existing Arena (`/arena`), and completion is derived as described above.

### Admission (server-side, in the existing admission transaction)

1. Load the assignment and its joined student membership, scoped to the student's org. If
   either is missing → `404`.
2. Lock the organisation row with `select … for update`.
3. Check, in this order: `opensAt`; `dueAt` / `allowLate`; the student's attempts against
   `attemptLimit`; the student's org-funded attempts against `interviewCap`; the college's
   org-funded attempts that are not `failed` against `interview_allowance`.
4. Insert the session, then `assignment_attempts` with `org_funded = true`. Write no
   `practice_usage` row and make no credit charge.
5. A session that ends `failed` marks its attempt `failed`, which hands back the
   allowance. An `abandoned` session still counts.
