package com.interviewos.api.config

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean
import org.springframework.core.io.FileSystemResource
import org.springframework.core.task.TaskExecutor
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFalse

/**
 * The API froze for seven hours on 17 November 2026 when virtual threads pinned the JVM's
 * few carrier threads (Java 21, `synchronized` around database calls). Every thread the API
 * creates for itself is a platform thread now; these tests keep it that way.
 */
class PlatformThreadsTest {
    @Test
    fun `request handling does not run on virtual threads`() {
        val yaml = YamlPropertiesFactoryBean().apply { setResources(MAIN_CONFIG) }.getObject()!!
        assertEquals("false", yaml.getProperty("spring.threads.virtual.enabled"))
    }

    @Test
    fun `scheduled jobs get more than one thread without virtual threads`() {
        val yaml = YamlPropertiesFactoryBean().apply { setResources(MAIN_CONFIG) }.getObject()!!
        val size = yaml.getProperty("spring.task.scheduling.pool.size")?.toInt() ?: 1
        assert(size > 1) { "spring.task.scheduling.pool.size is $size; @Scheduled jobs would queue behind one another" }
    }

    @Test
    fun `background and speech executors run tasks on platform threads`() {
        val config = BackgroundWorkConfig()
        assertFalse(runsVirtual(config.interviewBackgroundExecutor()))
        assertFalse(runsVirtual(config.interviewSpeechExecutor()))
    }

    private companion object {
        // The production file itself: src/test/resources has its own application.yml,
        // which shadows this one on the test classpath.
        val MAIN_CONFIG = FileSystemResource("src/main/resources/application.yml")
    }

    private fun runsVirtual(executor: TaskExecutor): Boolean {
        val virtual = CompletableFuture<Boolean>()
        executor.execute { virtual.complete(Thread.currentThread().isVirtual) }
        return virtual.get(5, TimeUnit.SECONDS)
    }
}
