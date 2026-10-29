package com.interviewos.api.interview

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import tools.jackson.databind.JsonNode
import java.util.concurrent.atomic.AtomicReference

/**
 * Runs a candidate's code, so a DSA round has a Run button that does something.
 *
 * Execution goes to **Piston**, an open-source sandboxed runner, over its HTTP API.
 *
 * **It is off by default, because there is no free hosted Piston any more.** The public
 * instance went whitelist-only on 15 February 2026 and now answers `/execute` with a 401;
 * Wandbox, the obvious alternative, was returning `Failed to get uid` from its own sandbox
 * when this was checked. So Python runs in the candidate's browser instead, and this stays
 * as the path to real multi-language execution the moment somebody runs
 * `docker run -p 2000:2000 ghcr.io/engineer-man/piston` and sets `base-url` at it.
 *
 * That is the reason it is built against Piston's API rather than something bespoke: a
 * self-hosted instance speaks exactly this, so switching costs a URL and nothing else.
 *
 * **The candidate's code leaves our servers.** That is a real trade and the room says so
 * in as many words rather than burying it here. Nothing else about the round goes with it
 * — no transcript, no name, no session id, just the source and the input it is run on.
 *
 * Failure is never fatal to the round. A runner that is down, rate-limited or slow gives
 * back a result that says so, and the candidate carries on talking through their solution
 * — which is what they are actually assessed on. A real onsite frequently has no compiler
 * at all.
 */
@Component
class CodeRunner(
    private val properties: CodeRunnerProperties,
    restClientBuilder: RestClient.Builder,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val restClient = restClientBuilder.build()

    /**
     * Piston wants an exact version, and the versions on the public instance move. Looked
     * up once and remembered rather than pinned in configuration, so a version bump on
     * their side does not silently break every Run with "runtime not found".
     */
    private val versions = AtomicReference<Map<String, String>>(emptyMap())

    fun run(
        language: CodeLanguage,
        source: String,
        stdin: String,
    ): CodeRunResult {
        if (!properties.enabled) {
            return CodeRunResult.unavailable("Java has to run on a server, and no runner is configured for this deployment.")
        }
        val version =
            resolveVersion(language)
                ?: return CodeRunResult.unavailable("No ${language.pistonName} runtime is available right now.")

        val body =
            mapOf(
                "language" to language.pistonName,
                "version" to version,
                "files" to listOf(mapOf("name" to language.fileName, "content" to source)),
                "stdin" to stdin,
                "run_timeout" to properties.runTimeoutMillis,
                "compile_timeout" to properties.compileTimeoutMillis,
            )

        return try {
            val response =
                restClient
                    .post()
                    .uri("${properties.baseUrl}/execute")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode::class.java)
                    ?: return CodeRunResult.unavailable("The code runner returned nothing.")

            val run = response.path("run")
            val compileError =
                response
                    .path("compile")
                    .path("stderr")
                    .asString()
                    .orEmpty()
            CodeRunResult(
                stdout = run.path("stdout").asString().orEmpty(),
                // A compile failure is the useful message in Java, and Piston reports it
                // in a different place from a runtime error. Both reach the candidate.
                // Piston's Java package renames the file before compiling, so its errors name
                // `Main.java.java` — a file the candidate never wrote.
                stderr =
                    listOf(compileError, run.path("stderr").asString().orEmpty())
                        .filter { it.isNotBlank() }
                        .joinToString("\n")
                        .replace("${language.fileName}.java", language.fileName)
                        .let(::explainMissingMain),
                exitCode = run.path("code").asInt(-1),
                timedOut = run.path("signal").asString() == "SIGKILL",
                available = true,
                message = null,
            )
        } catch (e: RestClientException) {
            // Nearly always the public instance rate-limiting us. Worth a log line, never
            // worth failing the round over.
            log.warn("Code execution failed for {}", language.pistonName, e)
            CodeRunResult.unavailable("The code runner is busy. Your code is saved — talk me through it instead.")
        }
    }

    private fun resolveVersion(language: CodeLanguage): String? {
        versions.get()[language.pistonName]?.let { return it }
        return try {
            val runtimes =
                restClient
                    .get()
                    .uri("${properties.baseUrl}/runtimes")
                    .retrieve()
                    .body(JsonNode::class.java) ?: return null

            val found =
                runtimes
                    .values()
                    .mapNotNull { node ->
                        val name = node.path("language").asString()
                        // `.values()`, not `.map` on the node: in Jackson 3 the latter hands the
                        // whole array to the lambda once, and `asString()` on an array throws.
                        val aliases = node.path("aliases").values().map { it.asString() }
                        val version = node.path("version").asString()
                        if (version.isNullOrBlank()) {
                            null
                        } else {
                            CodeLanguage.entries
                                .firstOrNull { it.pistonName == name || it.pistonName in aliases }
                                ?.let { it.pistonName to version }
                        }
                    }.toMap()

            versions.set(found)
            found[language.pistonName]
        } catch (e: RestClientException) {
            log.warn("Could not list code runtimes", e)
            null
        }
    }

    /**
     * Piston runs Java as a single source file, and the launcher starts whichever class
     * comes first. A helper class above `main`'s class is ordinary Java everywhere else,
     * so the launcher's bare "can't find main" reads like a bug in the candidate's code.
     */
    private fun explainMissingMain(stderr: String): String =
        if ("can't find main(String[]) method in class" in stderr) {
            "$stderr\nJava runs the first class in the file. Move the class that has main to the top."
        } else {
            stderr
        }
}

/** The languages a candidate may write in. Two, deliberately — this is an interview, not an IDE. */
enum class CodeLanguage(
    val wireName: String,
    val pistonName: String,
    val fileName: String,
) {
    PYTHON("python", "python", "main.py"),

    /** Piston compiles a single file, so the class has to be `Main`. The starter says so. */
    JAVA("java", "java", "Main.java"),
    ;

    companion object {
        fun parse(value: String): CodeLanguage? = entries.firstOrNull { it.wireName.equals(value, ignoreCase = true) }
    }
}

data class CodeRunResult(
    val stdout: String,
    val stderr: String,
    val exitCode: Int,
    val timedOut: Boolean,
    /** False when nothing ran. [message] then says why, in words meant for the candidate. */
    val available: Boolean,
    val message: String?,
) {
    companion object {
        fun unavailable(message: String) =
            CodeRunResult(
                stdout = "",
                stderr = "",
                exitCode = -1,
                timedOut = false,
                available = false,
                message = message,
            )
    }
}

@ConfigurationProperties(prefix = "interviewos.code-runner")
data class CodeRunnerProperties(
    /** Off unless a Piston instance is actually reachable. See the note on [CodeRunner]. */
    val enabled: Boolean = false,
    val baseUrl: String = "https://emkc.org/api/v2/piston",
    /** Milliseconds a submission may run for. Generous for an interview, short for a loop. */
    val runTimeoutMillis: Int = 5_000,
    val compileTimeoutMillis: Int = 10_000,
)
