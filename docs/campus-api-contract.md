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

Modules 3 and 4 add their sections below when they are built.
