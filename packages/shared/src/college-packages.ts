/**
 * Campus module 14: college packages and payments (docs/campus-api-contract.md "Module 14").
 * Dates are India calendar dates, as YYYY-MM-DD. Money is in paise.
 */

export type PackageStatus = "draft" | "invoiced" | "paid" | "void";
export type PackageReminderKind = "ends_in_30" | "ends_in_7";

/** A package as the platform admin sees it. */
export interface AdminPackageView {
  id: string;
  orgId: string;
  interviews: number;
  interviewsUsed: number;
  interviewsRemaining: number;
  /** Null means no per-student limit. */
  perStudentLimit: number | null;
  startsOn: string;
  endsOn: string;
  graceDays: number;
  /** `endsOn` + `graceDays`: the last day an interview can be started from it. */
  lastUsableOn: string;
  amountPaise: number;
  invoiceNumber: string | null;
  status: PackageStatus;
  invoicedOn: string | null;
  paidOn: string | null;
  paymentReference: string | null;
  /** Private to platform admins. */
  notes: string | null;
  /** It can fund an interview today: a funding status, and today inside its window. */
  inWindow: boolean;
  remindersSent: PackageReminderKind[];
  createdAt: string;
  updatedAt: string;
}

/** POST creates a draft from every field; PATCH changes the fields present. */
export interface PackageRequest {
  interviews?: number;
  /** 0 (or null on create) means no limit. */
  perStudentLimit?: number | null;
  startsOn?: string;
  endsOn?: string;
  graceDays?: number;
  amountPaise?: number;
  invoiceNumber?: string;
  notes?: string;
}

export interface InvoicePackageRequest {
  invoiceNumber?: string;
  invoicedOn?: string;
}

export interface PayPackageRequest {
  paidOn?: string;
  paymentReference?: string;
}

/** A package as a college admin sees it. */
export interface CollegePackageView {
  id: string;
  interviews: number;
  interviewsUsed: number;
  interviewsRemaining: number;
  perStudentLimit: number | null;
  startsOn: string;
  endsOn: string;
  lastUsableOn: string;
  status: Exclude<PackageStatus, "draft">;
  amountPaise: number;
  invoiceNumber: string | null;
  invoicedOn: string | null;
  paidOn: string | null;
}

/** What every staff role sees about the current package: no money. */
export interface PackageBalanceView {
  interviewsRemaining: number;
  perStudentLimit: number | null;
  endsOn: string;
}

export interface CollegePackagesView {
  /** False means the college's interview allowance applies instead. */
  fundedByPackages: boolean;
  current: PackageBalanceView | null;
  /** College admin and platform admin only; null for TPO and faculty. */
  packages: CollegePackageView[] | null;
}

export interface BillingPackageSummary {
  id: string;
  status: PackageStatus;
  interviews: number;
  interviewsUsed: number;
  interviewsRemaining: number;
  perStudentLimit: number | null;
  startsOn: string;
  endsOn: string;
  lastUsableOn: string;
  /** Days from today to `endsOn`; negative while in the grace period. */
  daysLeft: number;
}

/** Platform admin: one college on the billing page. */
export interface CollegeBillingRow {
  orgId: string;
  orgName: string;
  orgStatus: "active" | "suspended";
  fundedByPackages: boolean;
  current: BillingPackageSummary | null;
  outstandingInvoices: number;
  outstandingPaise: number;
  totalPaidPaise: number;
  /** Estimated model cost inside the current package's window, USD; null with no current package. */
  aiCostUsd: number | null;
  nextReminderOn: string | null;
}
