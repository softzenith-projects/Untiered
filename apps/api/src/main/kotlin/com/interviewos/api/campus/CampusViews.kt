package com.interviewos.api.campus

import java.util.UUID

// Wire shapes for the campus API. The contract is docs/campus-api-contract.md; a change here
// changes that file in the same commit, because the web app is built against it.

data class OrgView(
    val id: UUID,
    val name: String,
    val slug: String,
    val city: String?,
    val state: String?,
    val logoUrl: String?,
    val contactName: String?,
    val contactEmail: String?,
    val contactPhone: String?,
    val status: String,
    val interviewAllowance: Int,
    val interviewsUsed: Int,
    val createdAt: String,
)

data class AdminOrgSummary(
    val id: UUID,
    val name: String,
    val slug: String,
    val city: String?,
    val state: String?,
    val logoUrl: String?,
    val contactName: String?,
    val contactEmail: String?,
    val contactPhone: String?,
    val status: String,
    val interviewAllowance: Int,
    val interviewsUsed: Int,
    val createdAt: String,
    val staffCount: Int,
    val studentCount: Int,
)

data class DepartmentView(
    val id: UUID,
    val code: String,
    val name: String,
    val batchCount: Int,
)

data class BatchView(
    val id: UUID,
    val departmentId: UUID,
    val departmentCode: String,
    val graduationYear: Int,
    val name: String,
    val studentCount: Int,
)

data class MemberView(
    /** The membership id, never the user id. */
    val id: UUID,
    val name: String?,
    val email: String,
    val role: String,
    val batchId: UUID?,
    val batchName: String?,
    val departmentCode: String?,
    val rollNumber: String?,
    val joinedAt: String,
    val active: Boolean,
)

data class FacultyScopesView(
    val departmentIds: List<UUID> = emptyList(),
    val batchIds: List<UUID> = emptyList(),
)

data class AuditEntryView(
    val id: Long,
    val occurredAt: String,
    val actorName: String?,
    val actorKind: String,
    val action: String,
    val targetType: String?,
    val targetId: UUID?,
)

data class Page<T>(
    val items: List<T>,
    val nextCursor: String?,
)

data class MeCampusView(
    val student: MeCampusStudent?,
    val staff: List<MeCampusStaff>,
)

data class MeCampusStudent(
    val orgId: UUID,
    val orgName: String,
    val logoUrl: String?,
    val batchId: UUID,
    val batchName: String,
    val rollNumber: String?,
)

data class MeCampusStaff(
    val orgId: UUID,
    val orgName: String,
    val logoUrl: String?,
    val role: String,
)

// -- requests ----------------------------------------------------------------
// Fields are nullable so that validation runs in the service, after the permission check:
// a caller without the permission gets 403, whatever they sent.

data class CreateOrgRequest(
    val name: String? = null,
    val slug: String? = null,
    val city: String? = null,
    val state: String? = null,
    val contactName: String? = null,
    val contactEmail: String? = null,
    val contactPhone: String? = null,
    val interviewAllowance: Int? = null,
)

data class AdminUpdateOrgRequest(
    val name: String? = null,
    val city: String? = null,
    val state: String? = null,
    val contactName: String? = null,
    val contactEmail: String? = null,
    val contactPhone: String? = null,
    val interviewAllowance: Int? = null,
    val status: String? = null,
)

data class UpdateOrgProfileRequest(
    val contactName: String? = null,
    val contactEmail: String? = null,
    val contactPhone: String? = null,
    val city: String? = null,
    val state: String? = null,
)

data class CreateDepartmentRequest(
    val code: String? = null,
    val name: String? = null,
)

data class UpdateDepartmentRequest(
    val code: String? = null,
    val name: String? = null,
)

data class CreateBatchRequest(
    val departmentId: UUID? = null,
    val graduationYear: Int? = null,
    val name: String? = null,
)

data class UpdateBatchRequest(
    val graduationYear: Int? = null,
    val name: String? = null,
)

data class UpdateMemberRequest(
    val batchId: UUID? = null,
    /** Absent or null leaves it; an empty string clears it. */
    val rollNumber: String? = null,
)

data class ChangeRoleRequest(
    val role: String? = null,
)
