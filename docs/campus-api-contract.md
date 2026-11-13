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
- Errors use the existing shape, `{ "error": string, "message": string }` (`ApiError`; the web
  client's `ApiRequestError.code` is read from `error`). Codes named below are `error` values.
- **Unauthorised access answers `404`, not `403`.** That covers a caller with no
  membership in the org, a platform-admin route called by a non-admin, and a resource id
  that belongs to another org. This matches `AdminAccess`: the response never confirms
  that a college exists.
- A caller who is a member but whose role lacks the permission gets `403` with
  `error: "campus_forbidden"`. Their membership already tells them the college exists. The
  permission is checked before the body is validated, so a refused caller always sees `403`.
- Lists that can grow use `{ "items": [...], "nextCursor": string | null }`, with
  `?cursor=` for the next page and at most 100 items per page. A cursor is opaque; one the
  server did not issue is `400 invalid_cursor`.
- PATCH bodies: an absent or `null` field is left unchanged; an empty string clears an optional
  text field (city, state, contact fields, roll number). Bad values are `400` with a specific
  code (`invalid_slug`, `invalid_department_code`, `invalid_graduation_year`, `invalid_name`,
  `invalid_contact_email`, `invalid_contact_phone`, `invalid_interview_allowance`,
  `invalid_status`, `invalid_role`, …).
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
| `PUT /admin/campus/orgs/{org}/logo` | multipart `file`: png, jpeg or webp, ≤ 512 KB → `OrgView`; `400 logo_too_large`, `400 unsupported_logo_type` (checked by the file's bytes), `400 empty_logo` |

`GET /admin/campus/orgs` is not written to each college's audit log; `GET /admin/campus/orgs/{org}`
is (`org.viewed`). A status change also logs `org.suspended` / `org.reactivated`.

### Caller context

| Method · path | Response |
|---|---|
| `GET /me/campus` | `MeCampusView`. Answers `{ student: null, staff: [] }` for a caller in no college. Only memberships with `status = joined` count, and a suspended college is left out (as if absent) rather than failing the whole call. |

### College

The caller needs a joined staff membership in `{org}` (or must be a platform admin); a
student membership is not enough. A caller on the platform-admin allow-list is treated as a
platform admin on these routes even if they also hold a membership, and every read they make
is audit-logged on the college. Per the plan §3 matrix, a platform admin may not edit or remove
students (`403 campus_forbidden`); that is the college's job.

| Method · path | Permission | Body → response |
|---|---|---|
| `GET /campus/orgs/{org}` | any staff | → `OrgView` |
| `PATCH /campus/orgs/{org}` | college_admin | `{ contactName?, contactEmail?, contactPhone?, city?, state? }` → `OrgView` |
| `GET /campus/orgs/{org}/departments` | any staff (faculty: departments in scope, plus the department of each batch in scope) | → `DepartmentView[]` |
| `POST /campus/orgs/{org}/departments` | college_admin, tpo | `{ code, name }` → `201 DepartmentView`; `409 department_code_taken` |
| `PATCH /campus/orgs/{org}/departments/{id}` | college_admin, tpo | `{ code?, name? }` → `DepartmentView` |
| `DELETE /campus/orgs/{org}/departments/{id}` | college_admin, tpo | → `204`; `409 department_has_batches` |
| `GET /campus/orgs/{org}/batches?departmentId=` | any staff (faculty: scoped) | → `BatchView[]` |
| `POST /campus/orgs/{org}/batches` | college_admin, tpo | `{ departmentId, graduationYear, name }` → `201 BatchView`; `409 batch_name_taken` |
| `PATCH /campus/orgs/{org}/batches/{id}` | college_admin, tpo | `{ graduationYear?, name? }` → `BatchView` |
| `DELETE /campus/orgs/{org}/batches/{id}` | college_admin, tpo | → `204`; `409 batch_has_members` (also when only past, left or removed, students name it) |
| `GET /campus/orgs/{org}/members?role=&batchId=&departmentId=&q=&cursor=` | any staff (faculty: students in scope only) | → `{ items: MemberView[], nextCursor }`. `q` matches name, email or roll number. |
| `PATCH /campus/orgs/{org}/members/{id}` | college_admin, tpo (students only) | `{ batchId?, rollNumber? }` → `MemberView`; `409 roll_number_taken`; `400 not_a_student` for a staff member |
| `DELETE /campus/orgs/{org}/members/{id}` | college_admin (anyone except themselves); tpo (students only) | → `204`. Sets `status = removed`; the account is untouched. `409 cannot_remove_self`; `409 last_admin` for the last college_admin. |
| `PATCH /campus/orgs/{org}/members/{id}/role` | college_admin | `{ role: "college_admin" \| "tpo" \| "faculty" }`, staff only (`400 not_staff` for a student) → `MemberView`. Refused when it would leave the org with no college_admin (`409 last_admin`). Moving off faculty clears that member's faculty scopes. |
| `GET /campus/orgs/{org}/members/{id}/faculty-scopes` | college_admin | → `FacultyScopesView` |
| `PUT /campus/orgs/{org}/members/{id}/faculty-scopes` | college_admin | `FacultyScopesView` → `FacultyScopesView` (replaces the whole set); `400 not_faculty` when the member is not faculty; `404` when any id is not this college's; `400 too_many_scopes` above 200 |
| `GET /campus/orgs/{org}/audit-log?cursor=` | college_admin | → `{ items: AuditEntryView[], nextCursor }`, newest first |
| `POST /me/campus/leave` | student | → `204`. Sets the student's own membership to `left`; `404` with no student membership. Works even while the college is suspended: leaving shares less, and is never blocked. |

A suspended org answers `404` to every college route for its members, and is left out of
`/me/campus`. Platform-admin routes, and college routes called by a platform admin, still answer.

A unique-index race on any write (two people saving the same code at once) is `409 conflict`.

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
| `POST /campus/invites/{token}/accept` | `AcceptInviteRequest` → `MeCampusView & { joinedOrgId: string }`. Errors: `404 invite_not_found`; `400 consent_required`; `409 consent_version_stale`; `409 email_mismatch_unconfirmed`; `409 already_in_college`, when the caller is a joined student in another college; `409 already_member`, when the caller already has a joined membership in this college. |

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
  | "behavioural_competency"   // "Behavioural"
  | "custom_topic";            // "Topic round": 30 minutes only, needs focusTopic

// Which readiness score (module 6) this assignment feeds. Set explicitly by staff and
// defaulted from the round type, never inferred from what the AI wrote:
// coding_practical → coding, aptitude → aptitude, hr_fit_closing and behavioural_competency
// → communication, technical_fundamentals and project_deep_dive → technical_interview,
// custom_topic → core_cs, arena_scenarios → core_cs (or coding when every scenario is DSA).
type ReadinessComponent = "coding" | "core_cs" | "technical_interview" | "communication" | "aptitude";

// An optional topic label for the skill-gap heatmap (module 7). Staff choose it.
type CampusTopic = "dsa" | "dbms" | "os" | "oops" | "cn" | "system_design" | "communication" | "aptitude";

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
  focusTopic?: string | null;          // required for custom_topic, ≤ 120 characters, e.g. "DBMS normalisation"
  language?: "english" | "hindi_english";          // default "english"
  // arena_scenarios
  scenarioIds?: string[];              // 1–20 live scenario ids
  opensAt?: string | null;             // default now
  dueAt: string;
  allowLate: boolean;
  attemptLimit: number;                // 1–10, interviews only
  interviewCap?: number | null;        // 1..attemptLimit; null = attemptLimit
  targets: { batchIds: string[]; memberIds: string[] };  // at least one
  component?: ReadinessComponent;      // default derived as above
  topic?: CampusTopic | null;
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

interface CampusScenarioOption { id: string; courseTitle: string; title: string; tier: string; estimatedMinutes: number }

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
  candidateStage: "student" | "recent_graduate" | null;
  language: "english" | "hindi_english" | null;
  focusTopic: string | null;
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
| `GET /campus/orgs/{org}/arena-scenarios` | any staff | → `CampusScenarioOption[]` (live scenarios only) |
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
| `POST /sessions` (existing) | gains the optional field `assignmentId`. When it is present, the server takes `roundType`, `durationMinutes`, `companyName`, `roleTitle`, `candidateStage`, `language` and `focusTopic` from the assignment and ignores the client's values for those fields, including an empty `companyName` or `roleTitle`. Audio consent is still required. On success the response is unchanged, and the student's free rounds and credits are not touched. New errors: `404 assignment_not_found`; `409 assignment_not_open`; `409 assignment_past_due`; `409 assignment_attempt_limit`; `409 assignment_student_cap`; `402 college_allowance_exhausted`; and the existing `409 session_in_progress`. |

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

---

## Module 6: readiness

Readiness is **derived on read**; no score is stored. It counts only evidence the college
has a right to see: work done for this college's assignments (the plan §7 default). A
student's own practice never enters it.

### How it is computed (server-side only)

- **Evidence items.** There are two kinds:
  - Each completed assignment attempt whose session has a report with at least
    `ReadinessService.MIN_ASSESSABLE_TURNS` assessable turns. The item's score is the
    report's average competency percentage, from the same calculation `ReadinessService`
    uses, scaled 0–100.
  - Each completed `arena_scenarios` assignment. The item's score is `scenarioScore × 100`.

  Every item belongs to its assignment's `component` and, if the assignment has one, its
  `topic`.
- **Component score**: the mean of the latest 3 items for that component. A component
  with no items is `null`, which the UI shows as "Not attempted". It is **never 0**.
- **Weights**: per college, default `coding 30, coreCs 25, technicalInterview 25,
  communication 10, aptitude 10`. They must sum to 100.
- **Overall**: the weighted mean over the components that have a score, with the weights
  rescaled to sum to 100 over those components.
- **Band**: given only when the student has at least 2 evidence items; otherwise
  `"not_enough_evidence"`. `strong` is ≥ 85, `interview_ready` is 70–84,
  `needs_improvement` is 50–69, and `needs_structured_prep` is < 50, on the overall score
  rounded to an integer.

### Shapes

```ts
type ReadinessBand = "strong" | "interview_ready" | "needs_improvement" | "needs_structured_prep" | "not_enough_evidence";

interface ReadinessWeights { coding: number; coreCs: number; technicalInterview: number; communication: number; aptitude: number }

interface ComponentScores {
  coding: number | null; coreCs: number | null; technicalInterview: number | null;
  communication: number | null; aptitude: number | null;
}

interface EvidenceItem {
  assignmentId: string;
  assignmentTitle: string;
  component: ReadinessComponent;
  topic: CampusTopic | null;
  kind: AssignmentKind;
  sessionId: string | null;      // interview items; opens the report
  score: number;                 // 0–100, integer
  completedAt: string;
}

interface StudentReadiness {
  memberId: string;
  name: string | null;
  rollNumber: string | null;
  batchName: string;
  departmentCode: string;
  overall: number | null;        // integer 0–100
  band: ReadinessBand;
  components: ComponentScores;
  weights: ReadinessWeights;
  evidence: EvidenceItem[];      // newest first; this is also the score history
  suggestedTopics: { component: ReadinessComponent; topic: CampusTopic | null; reason: string }[];
}
```

`suggestedTopics` is derived without AI: one entry for each component scoring below 70,
and one for each topic whose items average below 70. Each `reason` is a plain sentence
built from the numbers, e.g. "Average 58 across 2 DBMS assignments." The web maps
components and topics to existing course and Arena links. Topics with no course get no
link.

### Routes

| Method · path | Permission | Response |
|---|---|---|
| `GET /me/campus/readiness` | student, own data only | `StudentReadiness`; `404` when not a joined student |
| `GET /campus/orgs/{org}/students/{memberId}/readiness` | any staff (faculty: scoped) | `StudentReadiness`. Audited as `readiness.viewed`. |
| `GET /campus/orgs/{org}/students/{memberId}/reports/{sessionId}` | any staff (faculty: scoped) | The existing `SessionReportView`, only when that session belongs to an attempt of this member on one of this college's assignments; otherwise `404`. Generating the report on first open is allowed and uses the existing report lease. Audited as `report.viewed`. |
| `GET /campus/orgs/{org}/readiness-weights` | any staff | `ReadinessWeights` |
| `PUT /campus/orgs/{org}/readiness-weights` | college_admin | `ReadinessWeights` → `ReadinessWeights`; `400 weights_invalid` unless every weight is an integer 0–100 and they sum to 100 |

---

## Module 7: placement dashboard

### Shapes

```ts
interface DashboardView {
  filters: { batchId: string | null; departmentId: string | null };
  enrolled: number;              // open or joined student invites + joined students with no invite
  joined: number;                // joined students
  active: number;                // joined students active in the last 14 days
  completionRate: number | null; // completed ÷ (completed + overdue + due-now) recipient-assignments, 0–1
  bands: Record<ReadinessBand, number>;
  heatmap: {
    columns: CampusTopic[];      // topics that have at least one evidence item in scope
    rows: { departmentId: string; departmentCode: string;
            cells: { topic: CampusTopic; average: number | null; students: number }[] }[];
  };
}

type ReadinessSort = "name" | "overall" | "last_active" | "overdue";

interface StudentReadinessRow {
  memberId: string;
  name: string | null;
  rollNumber: string | null;
  batchName: string;
  departmentCode: string;
  overall: number | null;
  band: ReadinessBand;
  components: ComponentScores;
  assignmentsCompleted: number;
  assignmentsOverdue: number;
  lastActiveAt: string | null;
}
```

A heatmap cell averages the latest item per student for that topic, among the students in
that department. Its `average` is `null` when fewer than 3 students have evidence, so a
cell never stands for one identifiable student.

### Routes

| Method · path | Permission | Response |
|---|---|---|
| `GET /campus/orgs/{org}/dashboard?batchId=&departmentId=` | any staff (faculty: scoped) | `DashboardView` |
| `GET /campus/orgs/{org}/students/readiness?batchId=&departmentId=&band=&completion=&sort=&order=asc\|desc&cursor=` | any staff (faculty: scoped) | `{ items: StudentReadinessRow[], nextCursor }`. `completion` takes `all_done`, `has_overdue` or `not_started`. |
| `GET /campus/orgs/{org}/exports/students.csv?<same filters>` | college_admin, tpo, faculty (scoped) | `text/csv` with UTF-8 BOM. Columns: name, roll number, department, batch, overall, band, each component, completed, overdue, last active. Audited as `students.exported` with the filters in `detail`. |

**The PDF batch report** is a print-optimised page, `/campus/reports/batch`, which the TPO
saves as a PDF from the browser's print dialog. It is assembled from `DashboardView` and
the student rows, and needs no PDF library and no new dependency. Opening it is audited by
calling `POST /campus/orgs/{org}/exports/batch-report-viewed` with
`{ batchId?, departmentId? }`, which answers `204`.
