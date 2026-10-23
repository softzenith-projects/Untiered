plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.spring") version "2.4.21"
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
    id("org.jlleitschuh.gradle.ktlint") version "14.2.0"
}

group = "com.interviewos"
version = "0.1.0"
description = "InterviewOS public API"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

// Ktlint embeds the Kotlin compiler version it was built against. Keep the
// formatter's isolated configurations off the application's Kotlin version.
configurations.matching { it.name.startsWith("ktlint") }.configureEach {
    resolutionStrategy.eachDependency {
        if (requested.group == "org.jetbrains.kotlin") {
            useVersion("2.2.21")
            because("ktlint 1.8.0 embeds Kotlin 2.2.21")
        }
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-mail")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("tools.jackson.module:jackson-module-kotlin")
    // The JDK has no MP3 encoder; keep question-audio compression in-process and platform-independent.
    implementation("co.ntbl:lame:1.0.0")
    // Error reporting. Inert until SENTRY_DSN is set, so local runs and CI send nothing.
    implementation("io.sentry:sentry-spring-boot-4-starter:8.60.0")
    implementation("io.sentry:sentry-logback:8.60.0")
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
    testImplementation("org.springframework.boot:spring-boot-starter-jdbc-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
    }
}

// /api/health reports build info, which Boot exposes via BuildProperties.
springBoot {
    buildInfo()
}

ktlint {
    version = "1.8.0"
    filter {
        exclude { it.file.path.contains("${layout.buildDirectory.get()}") }
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
