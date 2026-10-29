package com.interviewos.api.interview

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.test.json.JsonCompareMode
import org.springframework.test.web.client.ExpectedCount.once
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient

/**
 * The Piston boundary, with Piston replaced by its recorded answers. The shapes below are
 * what a self-hosted `ghcr.io/engineer-man/piston` with `java 15.0.2` returned.
 */
class CodeRunnerTest {
    private val base = "http://piston:2000/api/v2"
    private val runtimes = """[{"language":"java","version":"15.0.2","aliases":[]}]"""

    @Test
    fun `runs Java and returns what it printed`() {
        val (runner, server) = runner()
        expectRuntimes(server)
        server
            .expect(once(), requestTo("$base/execute"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(
                content().json(
                    """{"language":"java","version":"15.0.2","files":[{"name":"Main.java"}],"stdin":"21"}""",
                    JsonCompareMode.LENIENT,
                ),
            ).andRespond(
                withSuccess(
                    """{"language":"java","version":"15.0.2","run":{"stdout":"42\n","stderr":"","code":0,"signal":null}}""",
                    MediaType.APPLICATION_JSON,
                ),
            )

        val result = runner.run(CodeLanguage.JAVA, "public class Main {}", "21")

        assertThat(result.available).isTrue()
        assertThat(result.stdout).isEqualTo("42\n")
        assertThat(result.exitCode).isZero()
        assertThat(result.timedOut).isFalse()
        server.verify()
    }

    @Test
    fun `names the file the candidate wrote in a compile error, not Piston's renamed copy`() {
        val (runner, server) = runner()
        expectRuntimes(server)
        server
            .expect(once(), requestTo("$base/execute"))
            .andRespond(
                withSuccess(
                    """{"run":{"stdout":"","stderr":"Main.java.java:1: error: incompatible types\n1 error\n","code":1,"signal":null}}""",
                    MediaType.APPLICATION_JSON,
                ),
            )

        val result = runner.run(CodeLanguage.JAVA, "public class Main {}", "")

        assertThat(result.stderr).startsWith("Main.java:1: error: incompatible types")
        assertThat(result.exitCode).isEqualTo(1)
    }

    @Test
    fun `a helper class above main's class gets told to move main's class to the top`() {
        val (runner, server) = runner()
        expectRuntimes(server)
        server
            .expect(once(), requestTo("$base/execute"))
            .andRespond(
                withSuccess(
                    """{"run":{"stdout":"","stderr":"error: can't find main(String[]) method in class: Node\n","code":1,"signal":null}}""",
                    MediaType.APPLICATION_JSON,
                ),
            )

        val result = runner.run(CodeLanguage.JAVA, "class Node {}\npublic class Main {}", "")

        assertThat(result.stderr).startsWith("error: can't find main(String[]) method in class: Node")
        assertThat(result.stderr).contains("Move the class that has main to the top.")
    }

    @Test
    fun `a program killed at the deadline is reported as timed out`() {
        val (runner, server) = runner()
        expectRuntimes(server)
        server
            .expect(once(), requestTo("$base/execute"))
            .andRespond(
                withSuccess(
                    """{"run":{"stdout":"","stderr":"","code":null,"signal":"SIGKILL"}}""",
                    MediaType.APPLICATION_JSON,
                ),
            )

        val result = runner.run(CodeLanguage.JAVA, "public class Main {}", "")

        assertThat(result.timedOut).isTrue()
        assertThat(result.available).isTrue()
    }

    @Test
    fun `switched off, it says so without calling anything`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val runner = CodeRunner(CodeRunnerProperties(enabled = false, baseUrl = base), builder)

        val result = runner.run(CodeLanguage.JAVA, "public class Main {}", "")

        assertThat(result.available).isFalse()
        assertThat(result.message).isNotBlank()
        server.verify()
    }

    private fun runner(): Pair<CodeRunner, MockRestServiceServer> {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        return CodeRunner(CodeRunnerProperties(enabled = true, baseUrl = base), builder) to server
    }

    private fun expectRuntimes(server: MockRestServiceServer) {
        server
            .expect(once(), requestTo("$base/runtimes"))
            .andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess(runtimes, MediaType.APPLICATION_JSON))
    }
}
