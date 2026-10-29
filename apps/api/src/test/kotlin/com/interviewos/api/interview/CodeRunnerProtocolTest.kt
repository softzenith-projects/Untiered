package com.interviewos.api.interview

import com.sun.net.httpserver.HttpServer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.web.client.RestClient
import java.net.InetSocketAddress

/**
 * Over a real socket, because a mocked request factory cannot see the protocol. The
 * stand-in answers like Piston does: a 400 to any request asking to upgrade to h2c, which
 * is how the JDK client's default HTTP/2 opens a plain-http connection.
 */
class CodeRunnerProtocolTest {
    private val server =
        HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/api/v2/") { exchange ->
                val upgrade = exchange.requestHeaders.containsKey("Upgrade")
                val body =
                    when {
                        upgrade -> {
                            "Bad Request"
                        }

                        exchange.requestURI.path.endsWith("/runtimes") -> {
                            """[{"language":"java","version":"15.0.2","aliases":[]}]"""
                        }

                        else -> {
                            """{"run":{"stdout":"42\n","stderr":"","code":0,"signal":null}}"""
                        }
                    }.toByteArray()
                exchange.responseHeaders.add("Content-Type", if (upgrade) "text/plain" else "application/json")
                exchange.sendResponseHeaders(if (upgrade) 400 else 200, body.size.toLong())
                exchange.responseBody.use { it.write(body) }
            }
            start()
        }

    @AfterEach
    fun stop() = server.stop(0)

    @Test
    fun `the runner Spring builds reaches a Piston that refuses h2c upgrades`() {
        val properties = CodeRunnerProperties(enabled = true, baseUrl = "http://127.0.0.1:${server.address.port}/api/v2")
        val runner = CodeRunner(properties, RestClient.builder())

        val result = runner.run(CodeLanguage.JAVA, "public class Main {}", "")

        assertThat(result.message).isNull()
        assertThat(result.available).isTrue()
        assertThat(result.stdout).isEqualTo("42\n")
    }
}
