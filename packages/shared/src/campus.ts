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
