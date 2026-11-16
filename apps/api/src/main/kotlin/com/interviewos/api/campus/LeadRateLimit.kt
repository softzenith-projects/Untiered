package com.interviewos.api.campus

import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.UnknownHostException
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.HexFormat

/**
 * The caller's address, for rate limiting the public lead form only.
 *
 * The API runs behind Caddy (deploy/Caddyfile), which connects from a private address and
 * appends the address it accepted the connection from to `X-Forwarded-For`. So the last entry
 * of that header is trusted only when the direct peer is itself private or loopback; anything
 * earlier in the header was written by the client and is ignored. Exposed directly, the
 * socket's address is used and the header is ignored entirely.
 *
 * IPv6 addresses are cut to their /64: one subscriber is handed a whole /64, and limiting per
 * full address would give each of them 2^64 tries.
 */
object ClientIp {
    private val IPV4 = Regex("^((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)$")
    private val IPV6_CHARS = Regex("^[0-9a-fA-F:][0-9a-fA-F:.]{1,44}$")

    /** The address a bucket is keyed on, or null when none can be read. */
    fun of(request: HttpServletRequest): String? = resolve(request.remoteAddr, request.getHeader("X-Forwarded-For"))

    fun resolve(
        remoteAddr: String?,
        forwardedFor: String?,
    ): String? {
        val peer = parse(remoteAddr) ?: return null
        val forwarded =
            forwardedFor
                ?.split(',')
                ?.lastOrNull()
                ?.trim()
                ?.let(::parse)
        val behindProxy = peer.isLoopbackAddress || peer.isSiteLocalAddress || peer.isLinkLocalAddress || isUniqueLocal(peer)
        return bucket(if (behindProxy && forwarded != null) forwarded else peer)
    }

    /** Literal addresses only: never a name, so nothing here can start a DNS lookup. */
    private fun parse(value: String?): InetAddress? {
        val clean =
            value
                ?.trim()
                ?.removePrefix("[")
                ?.removeSuffix("]")
                .orEmpty()
        return when {
            IPV4.matches(clean) -> {
                InetAddress.getByName(clean)
            }

            // With a colon, the JDK parses an IPv6 literal or throws; it does not resolve.
            clean.contains(':') && IPV6_CHARS.matches(clean) -> {
                try {
                    InetAddress.getByName(clean)
                } catch (e: UnknownHostException) {
                    null
                }
            }

            else -> {
                null
            }
        }
    }

    private fun bucket(address: InetAddress): String =
        when (address) {
            is Inet4Address -> address.hostAddress
            is Inet6Address -> HexFormat.of().formatHex(address.address.copyOfRange(0, 8)) + "::/64"
            else -> address.hostAddress
        }

    private fun isUniqueLocal(address: InetAddress): Boolean = address is Inet6Address && (address.address[0].toInt() and 0xfe) == 0xfc
}

/**
 * The lead form's limits (contract Module 13): five submissions per IP per hour and three per
 * email per UTC day, counted in Postgres so they hold across API instances and restarts.
 *
 * Only a salted SHA-256 of the IP or email is stored, never the value itself. Each count is
 * its own auto-committed statement, so a submission that fails later (a bad field, a failed
 * captcha) still counts: the limit bounds attempts, not successes.
 */
@Component
class LeadRateLimiter(
    private val jdbc: JdbcClient,
    properties: CampusLeadProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val perIpPerHour = properties.leadsPerIpPerHour
    private val perEmailPerDay = properties.leadsPerEmailPerDay
    private val salt: ByteArray =
        properties.leadHashSalt.takeIf { it.isNotBlank() }?.toByteArray(Charsets.UTF_8)
            ?: ByteArray(32).also {
                SecureRandom().nextBytes(it)
                log.warn("CAMPUS_LEADS_HASH_SALT is not set: lead rate limits use a per-process salt and reset on restart")
            }

    /** True when this IP is still under its hourly limit; counts the attempt either way. */
    fun allowIp(ip: String): Boolean = hit(KIND_IP, ip, "date_trunc('hour', now())") <= perIpPerHour

    /** True when this email is still under its daily limit; counts the attempt either way. */
    fun allowEmail(email: String): Boolean =
        hit(KIND_EMAIL, email, "date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'") <= perEmailPerDay

    fun hash(
        kind: String,
        value: String,
    ): ByteArray =
        MessageDigest.getInstance("SHA-256").run {
            update(salt)
            update(0)
            update(kind.toByteArray(Charsets.UTF_8))
            update(0)
            update(value.toByteArray(Charsets.UTF_8))
            digest()
        }

    private fun hit(
        kind: String,
        value: String,
        window: String,
    ): Int =
        jdbc
            .sql(
                """
                insert into public.campus_lead_rate_limits (kind, key_hash, window_start)
                values (:kind, :hash, $window)
                on conflict (kind, key_hash, window_start)
                do update set hits = public.campus_lead_rate_limits.hits + 1
                returning hits
                """.trimIndent(),
            ).param("kind", kind)
            .param("hash", hash(kind, value))
            .query(Int::class.java)
            .single()

    /** Buckets past both windows. */
    fun purgeStale(): Int =
        jdbc
            .sql("delete from public.campus_lead_rate_limits where window_start < now() - interval '2 days'")
            .update()

    companion object {
        const val KIND_IP = "ip"
        const val KIND_EMAIL = "email"
    }
}
