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

Modules 3 and 4 add their sections below when they are built.
