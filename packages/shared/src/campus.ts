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

/** `POST /campus/invites/{token}/accept` also says which college was joined. */
export interface AcceptInviteResponse extends MeCampusView {
  joinedOrgId: string;
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

// ---- Module 4: assignments (docs/campus-api-contract.md) ----

export type AssignmentKind = "interview" | "arena_scenarios";
export type AssignmentStatus = "draft" | "published" | "archived";
export type CompletionStatus = "not_started" | "in_progress" | "completed" | "overdue";

export type AssignableRoundType =
  | "technical_fundamentals"
  | "project_deep_dive"
  | "coding_practical"
  | "aptitude"
  | "hr_fit_closing"
  | "behavioural_competency"
  | "custom_topic";

export type ReadinessComponent = "coding" | "core_cs" | "technical_interview" | "communication" | "aptitude";
export type CampusTopic = "dsa" | "dbms" | "os" | "oops" | "cn" | "system_design" | "communication" | "aptitude";

export interface AssignmentInput {
  kind: AssignmentKind;
  title: string;
  instructions?: string | null;
  roundType?: AssignableRoundType;
  durationMinutes?: 30 | 45 | 60;
  companyName?: string | null;
  roleTitle?: string | null;
  candidateStage?: "student" | "recent_graduate";
  focusTopic?: string | null;
  language?: "english" | "hindi_english";
  scenarioIds?: string[];
  opensAt?: string | null;
  dueAt: string;
  allowLate: boolean;
  attemptLimit: number;
  interviewCap?: number | null;
  targets: { batchIds: string[]; memberIds: string[] };
  component?: ReadinessComponent;
  topic?: CampusTopic | null;
}

export interface AssignmentCounts {
  recipients: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export interface AssignmentView extends AssignmentInput {
  id: string;
  status: AssignmentStatus;
  createdAt: string;
  publishedAt: string | null;
  createdByName: string | null;
  targetBatches: { id: string; name: string }[];
  targetStudents: { id: string; name: string | null; rollNumber: string | null }[];
  counts: AssignmentCounts;
}

/** Published assignments accept only these edits. */
export type AssignmentPublishedPatch = Partial<Pick<AssignmentInput, "dueAt" | "allowLate" | "instructions">>;

export interface RecipientProgress {
  memberId: string;
  name: string | null;
  email: string;
  rollNumber: string | null;
  batchName: string;
  status: CompletionStatus;
  attemptsUsed: number;
  lastActivityAt: string | null;
  sessionIds: string[];
  scenarioScore: number | null;
}

export interface CampusScenarioOption {
  id: string;
  courseTitle: string;
  title: string;
  tier: string;
  estimatedMinutes: number;
}

export type AssignmentBlockedReason = "not_open" | "past_due" | "attempt_limit" | "student_cap" | "college_allowance";

export interface AssignedItem {
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
  blockedReason: AssignmentBlockedReason | null;
  sessionIds: string[];
}

// ---- Module 6: readiness, module 7: placement dashboard (docs/campus-api-contract.md) ----

export type ReadinessBand = "strong" | "interview_ready" | "needs_improvement" | "needs_structured_prep" | "not_enough_evidence";

export interface ReadinessWeights {
  coding: number;
  coreCs: number;
  technicalInterview: number;
  communication: number;
  aptitude: number;
}

/** A `null` score means the component was never attempted; it is not 0. */
export interface ComponentScores {
  coding: number | null;
  coreCs: number | null;
  technicalInterview: number | null;
  communication: number | null;
  aptitude: number | null;
}

export interface EvidenceItem {
  assignmentId: string;
  assignmentTitle: string;
  component: ReadinessComponent;
  topic: CampusTopic | null;
  kind: AssignmentKind;
  sessionId: string | null;
  score: number;
  completedAt: string;
}

export interface SuggestedTopic {
  component: ReadinessComponent;
  topic: CampusTopic | null;
  reason: string;
}

export interface StudentReadiness {
  memberId: string;
  name: string | null;
  rollNumber: string | null;
  batchName: string;
  departmentCode: string;
  overall: number | null;
  band: ReadinessBand;
  components: ComponentScores;
  weights: ReadinessWeights;
  evidence: EvidenceItem[];
  suggestedTopics: SuggestedTopic[];
}

export interface HeatmapCell {
  topic: CampusTopic;
  average: number | null;
  students: number;
}

export interface HeatmapRow {
  departmentId: string;
  departmentCode: string;
  cells: HeatmapCell[];
}

export interface DashboardView {
  filters: { batchId: string | null; departmentId: string | null };
  enrolled: number;
  joined: number;
  active: number;
  completionRate: number | null;
  bands: Record<ReadinessBand, number>;
  heatmap: { columns: CampusTopic[]; rows: HeatmapRow[] };
}

export type ReadinessSort = "name" | "overall" | "last_active" | "overdue";
export type ReadinessCompletionFilter = "all_done" | "has_overdue" | "not_started";

export interface StudentReadinessRow {
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

// ---- Module 8: faculty view (docs/campus-api-contract.md) ----

export type AttentionReason = "low_score" | "inactive" | "overdue";

export interface AttentionRow {
  memberId: string;
  name: string | null;
  rollNumber: string | null;
  batchName: string;
  /** In the order low_score, inactive, overdue. */
  reasons: AttentionReason[];
  overall: number | null;
  band: ReadinessBand;
  overdue: number;
  lastActiveAt: string | null;
}

/** A private staff note about a student. Never returned on a student route. */
export interface StaffComment {
  id: string;
  memberId: string;
  sessionId: string | null;
  authorName: string | null;
  isMine: boolean;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

// ---- Module 5: interview integrity (docs/campus-api-contract.md) ----

export type IntegrityEventType = "tab_hidden" | "window_blur" | "paste";

export interface IntegrityEvent {
  type: IntegrityEventType;
  at: string;
  turnIndex?: number;
  /** Where a paste landed. Only the length is sent, never the text. */
  surface?: "code" | "text";
  chars?: number;
}

/** At most 50 events per request. */
export interface IntegrityEventBatch {
  events: IntegrityEvent[];
}

/** Counts, not conclusions. The student reads exactly what their college reads. */
export interface IntegritySummary {
  /** False for a round that was not assigned: nothing was watched. */
  recorded: boolean;
  tabHidden: number;
  windowBlur: number;
  pastes: number;
  pastedChars: number;
  /** Turns where speech began within 1 s of recording and lasted at least 20 s. */
  fastAnswers: number;
  /** Turns whose longest pause was at least 20 s. */
  longPauses: number;
  /** Plain sentences built from the counts; never a verdict. */
  notes: string[];
}
