package com.interviewos.api.campus

import java.util.UUID

// Wire shapes for campus module 14 (docs/campus-api-contract.md "Module 14"); change both together.
// Dates are India calendar dates, as YYYY-MM-DD.

/** A package as the platform admin sees it: everything, including the private notes. */
data class AdminPackageView(
    val id: UUID,
    val orgId: UUID,
    val interviews: Int,
    val interviewsUsed: Int,
    val interviewsRemaining: Int,
    val perStudentLimit: Int?,
    val startsOn: String,
    val endsOn: String,
    val graceDays: Int,
    /** `endsOn` + `graceDays`: the last day an interview can be started from it. */
    val lastUsableOn: String,
    val amountPaise: Long,
    val invoiceNumber: String?,
    val status: String,
    val invoicedOn: String?,
    val paidOn: String?,
    val paymentReference: String?,
    val notes: String?,
    /** True when it can fund an interview today: a funding status and today inside its window. */
    val inWindow: Boolean,
    val remindersSent: List<String>,
    val createdAt: String,
    val updatedAt: String,
)

/** `POST` creates a draft from every field; `PATCH` changes the fields that are present. */
data class PackageRequest(
    val interviews: Int? = null,
    /** Null on create, or 0 on either, means no per-student limit. */
    val perStudentLimit: Int? = null,
    val startsOn: String? = null,
    val endsOn: String? = null,
    val graceDays: Int? = null,
    val amountPaise: Long? = null,
    val invoiceNumber: String? = null,
    val notes: String? = null,
)

data class InvoicePackageRequest(
    val invoiceNumber: String? = null,
    /** Defaults to today in India. */
    val invoicedOn: String? = null,
)

data class PayPackageRequest(
    /** Defaults to today in India. */
    val paidOn: String? = null,
    val paymentReference: String? = null,
)

/** A package as the college's admin sees it: what was bought, what is left, what was billed. */
data class CollegePackageView(
    val id: UUID,
    val interviews: Int,
    val interviewsUsed: Int,
    val interviewsRemaining: Int,
    val perStudentLimit: Int?,
    val startsOn: String,
    val endsOn: String,
    val lastUsableOn: String,
    val status: String,
    val amountPaise: Long,
    val invoiceNumber: String?,
    val invoicedOn: String?,
    val paidOn: String?,
)

/** What every staff role sees about the current package: no money. */
data class PackageBalanceView(
    val interviewsRemaining: Int,
    val perStudentLimit: Int?,
    val endsOn: String,
)

/** `GET /campus/orgs/{org}/packages`. */
data class CollegePackagesView(
    /** True once the college has an issued package; false means the interview allowance applies. */
    val fundedByPackages: Boolean,
    val current: PackageBalanceView?,
    /** Every issued or voided package for a college admin or a platform admin; null for TPO and faculty. */
    val packages: List<CollegePackageView>?,
)

/** The current package on the operator's billing page. */
data class BillingPackageSummary(
    val id: UUID,
    val status: String,
    val interviews: Int,
    val interviewsUsed: Int,
    val interviewsRemaining: Int,
    val perStudentLimit: Int?,
    val startsOn: String,
    val endsOn: String,
    val lastUsableOn: String,
    /** Days from today to `endsOn`; negative while in the grace period. */
    val daysLeft: Long,
)

/** `GET /admin/campus/billing`: one row per college. */
data class CollegeBillingRow(
    val orgId: UUID,
    val orgName: String,
    val orgStatus: String,
    val fundedByPackages: Boolean,
    val current: BillingPackageSummary?,
    /** Invoiced and not yet paid. */
    val outstandingInvoices: Int,
    val outstandingPaise: Long,
    val totalPaidPaise: Long,
    /** Estimated model cost of the college's assigned rounds inside the current package's window; null with no current package. */
    val aiCostUsd: Double?,
    /** The next renewal reminder for any of its packages; null when none is due. */
    val nextReminderOn: String?,
)
