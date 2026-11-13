/**
 * Untiered Campus wire shapes, modules 1-2 (docs/campus-api-contract.md).
 * Change a shape there and here in the same commit.
 */

export type OrgStatus = "active" | "suspended";
export type CampusRole = "college_admin" | "tpo" | "faculty" | "student";
export type StaffRole = Exclude<CampusRole, "student">;

export interface OrgView {
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
  interviewAllowance: number;
  interviewsUsed: number;
  createdAt: string;
}

export interface AdminOrgSummary extends OrgView {
  staffCount: number;
  studentCount: number;
}

export interface CreateOrgRequest {
  name: string;
  slug: string;
  city?: string;
  state?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  interviewAllowance?: number;
}

export interface AdminUpdateOrgRequest {
  name?: string;
  city?: string;
  state?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  interviewAllowance?: number;
  status?: OrgStatus;
}

export interface CollegeUpdateOrgRequest {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
}

export interface DepartmentView {
  id: string;
  code: string;
  name: string;
  batchCount: number;
}

export interface BatchView {
  id: string;
  departmentId: string;
  departmentCode: string;
  graduationYear: number;
  name: string;
  studentCount: number;
}

export interface MemberView {
  id: string;
  name: string | null;
  email: string;
  role: CampusRole;
  batchId: string | null;
  batchName: string | null;
  departmentCode: string | null;
  rollNumber: string | null;
  joinedAt: string;
  active: boolean;
}

export interface FacultyScopesView {
  departmentIds: string[];
  batchIds: string[];
}

export interface AuditEntryView {
  id: number;
  occurredAt: string;
  actorName: string | null;
  actorKind: "member" | "platform_admin" | "system";
  action: string;
  targetType: string | null;
  targetId: string | null;
}

export interface CampusPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface MeCampusView {
  student: {
    orgId: string;
    orgName: string;
    logoUrl: string | null;
    batchId: string;
    batchName: string;
    rollNumber: string | null;
  } | null;
  staff: { orgId: string; orgName: string; logoUrl: string | null; role: StaffRole }[];
}

// ---- Module 3: student onboarding (docs/campus-api-contract.md) ----

export type InviteStatus = "invited" | "joined" | "revoked" | "expired";
export type InviteSendStatus = "pending" | "sending" | "sent" | "failed";

export type ImportProblem =
  | "missing_name"
  | "bad_email"
  | "duplicate_email_in_file"
  | "duplicate_roll_in_file"
  | "unknown_department"
  | "unknown_batch"
  | "batch_department_mismatch"
  | "graduation_year_mismatch"
  | "already_member"
  | "already_invited"
  | "roll_number_taken";

export interface ImportRowView {
  rowNumber: number;
  fullName: string | null;
  email: string | null;
  rollNumber: string | null;
  departmentCode: string | null;
  batchName: string | null;
  graduationYear: number | null;
  problems: ImportProblem[];
}

export interface ImportPreview {
  id: string;
  status: "previewed" | "committed" | "discarded";
  createdAt: string;
  expiresAt: string;
  rows: ImportRowView[];
  summary: { total: number; valid: number; withProblems: number };
}

export interface ImportCommitResult {
  invited: number;
  skipped: number;
}

export interface InviteView {
  id: string;
  email: string;
  fullName: string;
  role: CampusRole;
  batchId: string | null;
  batchName: string | null;
  rollNumber: string | null;
  status: InviteStatus;
  sendStatus: InviteSendStatus;
  sendCount: number;
  lastSentAt: string | null;
  createdAt: string;
  expiresAt: string;
  joinedAt: string | null;
}

export interface InvitePreview {
  orgName: string;
  logoUrl: string | null;
  role: CampusRole;
  batchName: string | null;
  invitedEmailMasked: string;
  signedInEmail: string;
  emailMatches: boolean;
  expiresAt: string;
  consentVersion: string;
  shared: string[];
  notShared: string[];
  aiNotice: string;
}

export interface AcceptInviteRequest {
  consentVersion: string;
  agreeDataSharing: boolean;
  agreeAiEvaluation: boolean;
  confirmDifferentEmail?: boolean;
}

export interface CreateInviteRequest {
  email: string;
  fullName: string;
  role: CampusRole;
  batchId?: string;
  rollNumber?: string;
}

export interface AdminCreateInviteRequest {
  email: string;
  fullName: string;
  role: "college_admin" | "tpo";
}
