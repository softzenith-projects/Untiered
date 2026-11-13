package com.interviewos.api.config

import com.interviewos.api.common.ApiException
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration
import org.springframework.web.method.HandlerMethod
import org.springframework.web.servlet.HandlerInterceptor
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@ConfigurationProperties(prefix = "interviewos.features")
data class ProductFeatureProperties(
    val mockInterviews: Boolean = true,
    val courses: Boolean = true,
    val arena: Boolean = true,
    val reports: Boolean = true,
    val questions: Boolean = false,
    /** Untiered Campus (colleges). Off by default so its modules can merge dark. */
    val campus: Boolean = false,
) {
    fun enabled(feature: ProductFeature): Boolean =
        when (feature) {
            ProductFeature.MOCK_INTERVIEWS -> mockInterviews
            ProductFeature.COURSES -> courses
            ProductFeature.ARENA -> arena
            ProductFeature.REPORTS -> reports
            ProductFeature.QUESTIONS -> questions
            ProductFeature.CAMPUS -> campus
        }
}

enum class ProductFeature {
    MOCK_INTERVIEWS,
    COURSES,
    ARENA,
    REPORTS,
    QUESTIONS,
    CAMPUS,
}

/**
 * The web hides disabled surfaces, while this interceptor closes the matching public API
 * paths. A 404 deliberately reveals no deployment configuration to a caller. Account and
 * round deletion are never gated: turning off a product surface cannot trap user data.
 */
class ProductFeatureInterceptor(
    private val features: ProductFeatureProperties,
) : HandlerInterceptor {
    override fun preHandle(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any,
    ): Boolean {
        if (handler !is HandlerMethod) return true
        featureFor(request.method, request.requestURI)?.let { feature ->
            if (!features.enabled(feature)) throw ApiException.notFound()
        }
        return true
    }

    internal fun featureFor(
        method: String,
        path: String,
    ): ProductFeature? {
        if (path.startsWith("/api/v1/campus/") || path.startsWith("/api/v1/admin/campus/") || path == "/api/v1/admin/campus") {
            return ProductFeature.CAMPUS
        }
        // `/me/campus` and everything under it, but not an unrelated `/me/campusfoo`.
        if (path == "/api/v1/me/campus" || path.startsWith("/api/v1/me/campus/")) return ProductFeature.CAMPUS
        if (path.startsWith("/api/v1/me/course-progress")) return ProductFeature.COURSES
        if (path.startsWith("/api/v1/me/arena")) return ProductFeature.ARENA
        if (path == "/api/v1/readiness") return ProductFeature.REPORTS
        if (path == "/api/v1/sessions" && method == "GET") return ProductFeature.REPORTS
        if (REPORT_PATH.matches(path) && method == "GET") return ProductFeature.REPORTS
        if (path == "/api/v1/entitlement" || path == "/api/v1/round-drafts") {
            return ProductFeature.MOCK_INTERVIEWS
        }
        if (path == "/api/v1/sessions" && method == "POST") return ProductFeature.MOCK_INTERVIEWS
        if (path.startsWith("/api/v1/sessions/") && method != "DELETE") {
            return ProductFeature.MOCK_INTERVIEWS
        }
        return null
    }

    private companion object {
        val REPORT_PATH = Regex("/api/v1/sessions/[^/]+/report")
    }
}

@Configuration
@EnableConfigurationProperties(ProductFeatureProperties::class)
class ProductFeatureWebConfig(
    features: ProductFeatureProperties,
) : WebMvcConfigurer {
    private val interceptor = ProductFeatureInterceptor(features)

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(interceptor).addPathPatterns("/api/v1/**")
    }
}
