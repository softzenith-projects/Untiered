package com.interviewos.api.campus

import org.springframework.boot.context.properties.ConfigurationProperties

/** College self-registration (contract Module 13). */
@ConfigurationProperties(prefix = "interviewos.campus")
data class CampusLeadProperties(
    /** Where a new lead's notification goes (`CAMPUS_LEADS_NOTIFY_EMAIL`). Empty sends none. */
    val leadNotifyEmail: String = "",
    /**
     * Salt for the hashed IP and email in the rate-limit buckets (`CAMPUS_LEADS_HASH_SALT`).
     * Empty draws a random one per process: the limits still hold, but restart with the process.
     */
    val leadHashSalt: String = "",
    val leadsPerIpPerHour: Int = 5,
    val leadsPerEmailPerDay: Int = 3,
)
