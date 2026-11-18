package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.user.SupabaseIdentity
import org.hamcrest.Matchers.not
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers
import org.mockito.BDDMockito.given
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/**
 * Contract "Module 14" routes through the real [CollegePackageService], with the gate and the
 * repositories mocked at the boundary: 401 with no token, 404 for anyone off the platform-admin
 * allow-list, the admin's writes and their audit entries, and what each college role may see.
 * The SQL and the admission race are in [CollegePackageDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [AdminCollegePackageController::class, AdminCampusBillingController::class, CollegePackageController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CollegePackageService::class,
)
@EnableConfigurationProperties(CollegeBillingProperties::class)
class CollegePackageControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var packages: CollegePackageRepository

    @MockitoBean private lateinit var orgs: OrganisationRepository

    @MockitoBean private lateinit var audit: CampusAudit

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "op@untiered.tech", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val packageId = UUID.fromString("0a000000-0000-0000-0000-0000000000d1")
    private val member = UUID.fromString("0a000000-0000-0000-0000-0000000000c1")
    private val adminScope = OrgScope(orgId, userId, null, null, platformAdmin = true)
    private val today: LocalDate = CollegePackages.today(Instant.now())
    private val base = "/api/v1/admin/campus/orgs/$orgId/packages"

    private fun staff(role: CampusRole) = OrgScope(orgId, userId, role, member, platformAdmin = false)

    private fun asAdmin() {
        given(access.resolveAsPlatformAdmin(identity, orgId)).willReturn(adminScope)
    }

    @Test
    fun `no token is a 401 and nothing is resolved`() {
        mockMvc.perform(get(base)).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/admin/campus/billing")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/packages")).andExpect(status().isUnauthorized)
        verifyNoInteractions(access, packages, audit)
    }

    @Test
    fun `someone off the allow-list gets 404 on every admin route`() {
        given(access.resolveAsPlatformAdmin(identity, orgId)).willThrow(ApiException.notFound())
        given(access.requirePlatformAdmin(identity)).willThrow(ApiException.notFound())

        mockMvc.perform(get(base).with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(post(base).with(signedIn()).json(validBody)).andExpect(status().isNotFound)
        mockMvc.perform(patch("$base/$packageId").with(signedIn()).json("""{"interviews":5}""")).andExpect(status().isNotFound)
        mockMvc.perform(post("$base/$packageId/invoice").with(signedIn()).json("{}")).andExpect(status().isNotFound)
        mockMvc.perform(post("$base/$packageId/paid").with(signedIn()).json("{}")).andExpect(status().isNotFound)
        mockMvc.perform(post("$base/$packageId/void").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(delete("$base/$packageId").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(get("/api/v1/admin/campus/billing").with(signedIn()))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("not_found"))

        verifyNoInteractions(packages, orgs, audit)
    }

    @Test
    fun `a platform admin records a package as a draft, and it is audited`() {
        asAdmin()
        val fields =
            PackageFields(100, 4, LocalDate.parse("2026-08-01"), LocalDate.parse("2027-05-31"), 14, 9_900_000, "UT-2026-014", null)
        given(packages.insert(adminScope, fields)).willReturn(packageId)
        given(packages.find(adminScope, packageId)).willReturn(row())

        mockMvc
            .perform(post(base).with(signedIn()).json(validBody))
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(packageId.toString()))
            .andExpect(jsonPath("$.status").value("draft"))
            .andExpect(jsonPath("$.interviewsRemaining").value(100))
            .andExpect(jsonPath("$.lastUsableOn").value("2027-06-14"))
            .andExpect(jsonPath("$.amountPaise").value(9_900_000))

        verify(orgs).lock(adminScope)
        verify(audit).record(adminScope, "package.created", CollegePackageService.TARGET_PACKAGE, packageId)
    }

    @Test
    fun `a bad package is a 400 with a specific code, and nothing is written`() {
        asAdmin()
        mockMvc
            .perform(post(base).with(signedIn()).json(validBody.replace("2027-05-31", "2026-07-01")))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_term"))
        mockMvc
            .perform(post(base).with(signedIn()).json(validBody.replace("\"interviews\":100", "\"interviews\":0")))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_interviews"))
        mockMvc
            .perform(post(base).with(signedIn()).json(validBody.replace("2026-08-01", "1 August")))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_date"))
        verify(packages, never()).insert(anyScope(), anyFields())
        verifyNoInteractions(audit)
    }

    @Test
    fun `an invoiced package is marked paid with its date and reference`() {
        asAdmin()
        given(packages.find(adminScope, packageId))
            .willReturn(row(status = PackageStatus.INVOICED), row(status = PackageStatus.PAID, paidOn = LocalDate.parse("2026-11-10")))

        mockMvc
            .perform(post("$base/$packageId/paid").with(signedIn()).json("""{"paidOn":"2026-11-10","paymentReference":"NEFT 4471"}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("paid"))
            .andExpect(jsonPath("$.paidOn").value("2026-11-10"))

        verify(packages).markPaid(adminScope, packageId, "UT-2026-014", LocalDate.parse("2026-11-10"), "NEFT 4471")
        verify(audit).record(adminScope, "package.paid", CollegePackageService.TARGET_PACKAGE, packageId)
    }

    @Test
    fun `a package that funded interviews cannot be voided, shrunk below its use, or deleted`() {
        asAdmin()
        given(packages.find(adminScope, packageId)).willReturn(row(status = PackageStatus.PAID, used = 12))

        mockMvc
            .perform(post("$base/$packageId/void").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("package_in_use"))
        mockMvc
            .perform(patch("$base/$packageId").with(signedIn()).json("""{"interviews":10}"""))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("package_below_used"))
        mockMvc
            .perform(delete("$base/$packageId").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("package_not_draft"))

        verify(packages, never()).markVoid(adminScope, packageId)
        verify(packages, never()).deleteDraft(adminScope, packageId)
        verifyNoInteractions(audit)
    }

    @Test
    fun `a draft is invoiced, and only a draft can be`() {
        asAdmin()
        given(packages.find(adminScope, packageId)).willReturn(row(), row(status = PackageStatus.INVOICED))

        mockMvc
            .perform(post("$base/$packageId/invoice").with(signedIn()).json("""{"invoicedOn":"2026-11-01"}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("invoiced"))
        verify(packages).markInvoiced(adminScope, packageId, "UT-2026-014", LocalDate.parse("2026-11-01"))
        verify(audit).record(adminScope, "package.invoiced", CollegePackageService.TARGET_PACKAGE, packageId)

        mockMvc
            .perform(post("$base/$packageId/invoice").with(signedIn()).json("{}"))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("package_status_conflict"))
    }

    @Test
    fun `the billing page lists each college with its current package, money and next reminder`() {
        val admin = PlatformAdmin(userId)
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        given(packages.allOrgs(admin)).willReturn(listOf(BillingOrg(orgId, "Demo College", "active")))
        val current =
            row(status = PackageStatus.PAID, startsOn = today.minusDays(60), endsOn = today.plusDays(45), used = 30, amount = 9_900_000)
        val renewal =
            row(
                id = UUID.randomUUID(),
                status = PackageStatus.INVOICED,
                startsOn = today.plusDays(46),
                endsOn = today.plusDays(200),
                amount = 5_000_000,
            )
        given(packages.allPackages(admin)).willReturn(listOf(current, renewal))
        given(packages.aiCostMicroUsd(anyAdmin(admin), anyUuid(), anyInstant(), anyInstant())).willReturn(4_500_000)

        mockMvc
            .perform(get("/api/v1/admin/campus/billing").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].orgName").value("Demo College"))
            .andExpect(jsonPath("$[0].fundedByPackages").value(true))
            .andExpect(jsonPath("$[0].current.id").value(packageId.toString()))
            .andExpect(jsonPath("$[0].current.interviewsRemaining").value(70))
            .andExpect(jsonPath("$[0].current.perStudentLimit").value(4))
            .andExpect(jsonPath("$[0].current.daysLeft").value(45))
            .andExpect(jsonPath("$[0].outstandingInvoices").value(1))
            .andExpect(jsonPath("$[0].outstandingPaise").value(5_000_000))
            .andExpect(jsonPath("$[0].totalPaidPaise").value(9_900_000))
            .andExpect(jsonPath("$[0].aiCostUsd").value(4.5))
            // The current package is superseded by the invoiced renewal, so only the renewal's
            // 30-day reminder is ahead.
            .andExpect(jsonPath("$[0].nextReminderOn").value(today.plusDays(170).toString()))
        verifyNoInteractions(audit)
    }

    @Test
    fun `a college admin sees every issued package with what was billed`() {
        given(access.resolve(identity, orgId)).willReturn(staff(CampusRole.COLLEGE_ADMIN))
        given(packages.list(anyScope())).willReturn(issuedAndDraft())

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/packages").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.fundedByPackages").value(true))
            .andExpect(jsonPath("$.current.interviewsRemaining").value(70))
            .andExpect(jsonPath("$.current.perStudentLimit").value(4))
            .andExpect(jsonPath("$.current.endsOn").value(today.plusDays(45).toString()))
            // Drafts are the operator's own working; the college sees what it was issued.
            .andExpect(jsonPath("$.packages.length()").value(1))
            .andExpect(jsonPath("$.packages[0].amountPaise").value(9_900_000))
            .andExpect(jsonPath("$.packages[0].invoiceNumber").value("UT-2026-014"))
            .andExpect(jsonPath("$.packages[0].status").value("paid"))
            // The operator's notes and payment reference never reach the college.
            .andExpect(content().string(not(org.hamcrest.Matchers.containsString("notes"))))
            .andExpect(content().string(not(org.hamcrest.Matchers.containsString("NEFT"))))
    }

    @Test
    fun `a TPO and faculty see the interviews remaining, the limit and the end date, and no money`() {
        for (role in listOf(CampusRole.TPO, CampusRole.FACULTY)) {
            given(access.resolve(identity, orgId)).willReturn(staff(role))
            given(packages.list(anyScope())).willReturn(issuedAndDraft())

            mockMvc
                .perform(get("/api/v1/campus/orgs/$orgId/packages").with(signedIn()))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.current.interviewsRemaining").value(70))
                .andExpect(jsonPath("$.current.perStudentLimit").value(4))
                .andExpect(jsonPath("$.current.endsOn").value(today.plusDays(45).toString()))
                .andExpect(jsonPath("$.packages").doesNotExist())
                .andExpect(content().string(not(org.hamcrest.Matchers.containsString("amount"))))
                .andExpect(content().string(not(org.hamcrest.Matchers.containsString("invoice"))))
        }
    }

    @Test
    fun `someone who is not staff of the college gets 404 from the college route`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/packages").with(signedIn())).andExpect(status().isNotFound)
        verifyNoInteractions(packages)
    }

    @Test
    fun `a college with no packages reports the allowance applies`() {
        given(access.resolve(identity, orgId)).willReturn(staff(CampusRole.TPO))
        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/packages").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.fundedByPackages").value(false))
            .andExpect(jsonPath("$.current").doesNotExist())
    }

    // -- fixtures --------------------------------------------------------------------

    private val validBody =
        """
        {"interviews":100,"perStudentLimit":4,"startsOn":"2026-08-01","endsOn":"2027-05-31",
         "amountPaise":9900000,"invoiceNumber":"UT-2026-014"}
        """.trimIndent()

    private fun issuedAndDraft() =
        listOf(
            row(
                status = PackageStatus.PAID,
                startsOn = today.minusDays(60),
                endsOn = today.plusDays(45),
                used = 30,
                amount = 9_900_000,
                notes = "notes: discount agreed",
                reference = "NEFT 4471",
            ),
            row(id = UUID.randomUUID(), status = PackageStatus.DRAFT, startsOn = today.plusDays(46), endsOn = today.plusDays(200)),
        )

    private fun row(
        id: UUID = packageId,
        status: PackageStatus = PackageStatus.DRAFT,
        startsOn: LocalDate = LocalDate.parse("2026-08-01"),
        endsOn: LocalDate = LocalDate.parse("2027-05-31"),
        used: Int = 0,
        amount: Long = 9_900_000,
        paidOn: LocalDate? = null,
        notes: String? = null,
        reference: String? = null,
    ) = PackageRow(
        id = id,
        orgId = orgId,
        interviews = 100,
        perStudentLimit = 4,
        startsOn = startsOn,
        endsOn = endsOn,
        graceDays = 14,
        amountPaise = amount,
        invoiceNumber = "UT-2026-014",
        status = status,
        invoicedOn = null,
        paidOn = paidOn ?: if (status == PackageStatus.PAID) LocalDate.parse("2026-08-05") else null,
        paymentReference = reference,
        notes = notes,
        createdAt = Instant.parse("2026-07-20T10:00:00Z"),
        updatedAt = Instant.parse("2026-07-20T10:00:00Z"),
        used = used,
        remindersSent = emptySet(),
    )

    private fun anyScope(): OrgScope = ArgumentMatchers.any(OrgScope::class.java) ?: adminScope

    private fun anyFields(): PackageFields =
        ArgumentMatchers.any(PackageFields::class.java) ?: PackageFields(1, null, today, today, 14, 0, null, null)

    private fun anyAdmin(fallback: PlatformAdmin): PlatformAdmin = ArgumentMatchers.any(PlatformAdmin::class.java) ?: fallback

    private fun anyUuid(): UUID = ArgumentMatchers.any(UUID::class.java) ?: orgId

    private fun anyInstant(): Instant = ArgumentMatchers.any(Instant::class.java) ?: Instant.EPOCH

    private fun MockHttpServletRequestBuilder.json(body: String) = contentType(MediaType.APPLICATION_JSON).content(body)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
