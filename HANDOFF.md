# Handoff — 29 October 2026

## Task
Make Java code run on the server, in the interview's coding round and in the course playgrounds (owner, in session). PRD 06. Branch `feat/java-code-runner`.

## What I built
- **Interview round:** Java's Run button now calls the existing `POST /api/v1/sessions/{id}/run`. It used to show a hard-coded "not configured" message. The output is checked against the selected test case, the same way Python's is.
  - `apps/web/src/components/dsa-workspace.tsx`
  - `apps/web/src/components/interview-room.tsx`
- **Courses:** a new `POST /api/v1/code/run` for signed-in readers (`apps/api/.../courses/CourseCodeController.kt`). The playground gets a Java runner through the existing `getRunner` seam (`apps/web/src/lib/course-code-runner.ts`, `playground.tsx`).
- **Shared client helper:** `apps/web/src/lib/server-code-runner.ts` turns timeouts, a missing runner, rate limits and network failures into messages. It never throws.
- **Rate limit:** both run routes share an hourly cap per account, `code_runs`, set by `interviewos.rate-limit.code-runs-per-hour` (default 200). See `AiRateLimit.kt`.
- **Bug fix in `CodeRunner.kt`:** the runtime lookup called `.map` on a Jackson 3 `JsonNode`. That passed the whole `aliases` array to `asString()`, which threw `JsonNodeException`. The exception isn't caught, so the **first real Run would have returned a 500**. It now uses `.values()`, the pattern used in `GroundedAnswer.kt`.
- **Compile errors** now name `Main.java` instead of Piston's renamed `Main.java.java`.
- **Docs:** Piston setup is in `.env.example` and `deploy/api.env.example`. Both default to off.
- **Tests:**
  - `CodeRunnerTest` (Piston mocked with its real response shapes)
  - `CourseCodeControllerTest` (happy path, missing token, bad input, 429)
  - `dsa-workspace.test.tsx`
  - `server-code-runner.test.ts`
  - updated playground, course-code-runner and block-renderer tests

## Assumptions I made
- The runner is **self-hosted Piston**, which `CodeRunner` was already built for. Judge0 (GPL), CheerpJ (commercial licence) and in-browser JVMs were all ruled out in earlier tasks.
- The course endpoint accepts Python or Java, matching the round's endpoint. In practice only Java reaches it, because Python still runs in the browser.
- **No Java chapter has a playground block yet.** Their code samples are static `code` blocks. The playground is ready for Java, but adding "try it yourself" blocks to the Java course is content work I did not do.

## What I could NOT verify
- **End to end through the API with a real sign-in.** I ran Java directly against a local Piston, using the exact request shape the API sends:
  - normal output, including a class not named `Main`
  - a compile error
  - an infinite loop, which Piston killed with `SIGKILL`

  I did not call the API with a real Supabase token or press Run in a live round, because a live round spends Gemini (rule 7).
- Piston's latency and memory under real use.

## Verification status
- web typecheck / lint / test (3,216 passing) / build: pass locally
- api ktlintCheck / test / build: pass locally
- CI run 40816699844 on `89944f2`: api, web, images, database all green

## Merge status
- Merged `feat/java-code-runner` into `develop`. No migrations in this change.

## Suggested next task
- Add Java "try it yourself" playground blocks to the Java course chapters.

## Open questions for you
- **Production hosting for Piston.** It must run `--privileged`, so a sandbox escape gives root on its host. Don't put it on the API's VM, which holds the Supabase, Gemini and Razorpay keys. The 2 GB VM also lacks the memory. A second small VM is new monthly spend, so it's your call. Until then, production keeps `CODE_RUNNER_ENABLED=false` and Java's Run button says no runner is configured.
- **Piston's limits.** It must be started with `PISTON_RUN_TIMEOUT=5000`. Its default limit is 3000 ms, and the API asks for 5000, so every run would be refused.
