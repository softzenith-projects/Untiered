# Handoff — 29 October 2026

## Task
Runnable Java in the Java course, plus the follow-ups the owner raised in the same session (PRD 06, PRD §10):
1. A Run button in every Java chapter.
2. A notice that the runner is Java 15.
3. Java's Run said "No java runtime is available right now".
4. Remove the "1 free interview per day" wording, and guard against it.
5. Stop showing the same Java program twice.

## What I built
- **Runnable Java in every chapter** (`apps/web/src/content/courses/java/*.ts`). Each chapter has a task to try and the output to expect.
  - **31 chapters:** the chapter's own main example is runnable where it stands. A new `tryIt` field on the `code` block adds an **Edit and run** button, which swaps the block for the editor in place (`components/courses/code-block.tsx`).
  - **4 chapters** have a separate playground, because their example can't run as one file: 05 input/output, 13 methods, 22 packages and 35 records. Each playground's task says why.
- **No program on screen twice** (owner's screenshots).
  - **The duplicate:** chapters showed the example, then a playground with the same code. The playground itself also showed a static "Starter code" copy above its editor, so up to three copies in all.
  - **Fix for the example:** it is now runnable in place (above). The duplicate playgrounds are gone.
  - **Fix for the playground:** its static copy shows only until the editor mounts (`playground-lazy.tsx`). The editor then shows the expected output before any run.
- **Class order.** Piston runs the *first* class in a file, so a helper class above `main`'s class fails.
  - The examples now put `main`'s class first.
  - The runner's error says to do the same (`CodeRunner.kt`). This also helps candidates in coding rounds.
- **Java 15 notice** beside every Java Run button, in the course and in the coding round. The text lives in `JAVA_VERSION_NOTE` (`lib/server-code-runner.ts`).
- **Fixed: "No java runtime is available right now"** (`CodeRunner.kt`).
  - **Cause:** the JDK HTTP client's default HTTP/2 opens a plain-http connection with an `h2c` upgrade. Piston answers that with a 400.
  - **Why nothing caught it:** curl and Node never send the upgrade, so Piston looked healthy from the shell. The unit tests mock the HTTP layer.
  - **Fix:** the runner now uses HTTP/1.1.
  - **Guard:** `CodeRunnerProtocolTest` runs over a real socket against a stand-in that refuses upgrades. I confirmed it fails on HTTP/2.
- **Free tier wording: 3 interviews for life.**
  - `develop` already enforced 3 for life (API default, terms, privacy, upgrade page). The "1 round … a day" wording is still on **`main`**, which is about 100 commits behind `develop`.
  - On `develop` I removed what was left: "Sit one round today" on the landing page, "More rounds and longer interviews each day" on the Pro list, "no daily limit" on the used-up notice, and an out-of-date comment in the shared types.
  - **Guards:**
    - `lib/free-allowance-copy.test.ts` fails on any daily-allowance wording in user-facing source, and pins `LEGAL.freeRounds` to 3. I confirmed it catches the old lines.
    - `EntitlementTest` fails if `application.yml` overrides `free-rounds`, `daily-rounds` or `daily-minutes`.
- **Content tests** (`content-integrity.test.ts`):
  - every Java chapter has runnable Java with a task and expected output
  - no playground repeats a code example's program
  - `main`'s class comes first in every runnable program

## Assumptions I made
- Edit and run starts with the read-only example, not the editor. That keeps the output visible without running anything. It also matters in production, where the runner is off and Run only explains that.
- Reordering the classes in 15 examples changes none of their text. I checked the prose for references to class order and found none.
- Prompt text wrapped onto two source lines sometimes splits inside a backtick span. It joins back together at build time, so readers see it correctly.

## What I could NOT verify
- **Edit and run and Run in a signed-in browser.** I verified on the local Piston directly, with the request the API sends: every runnable program prints exactly its expected output, and the 15 reordered programs still match the chapter's output.
- **How Edit and run looks and feels.** That's your judgement: the button and the swap into the editor.

## Verification status
- web typecheck / lint / test (3,224 passing) / build: pass locally
- api ktlintCheck / test / build: pass locally
- CI green and merged: `feat/java-15-disclaimer`, `fix/piston-http1`, `fix/free-interviews-lifetime-copy`
- `feat/runnable-code-blocks`: see merge status

## Merge status
- Merged into `develop`: `feat/java-course-playgrounds`, `feat/java-15-disclaimer`, `fix/piston-http1`, `fix/free-interviews-lifetime-copy`. No migrations.
- `feat/runnable-code-blocks`: merged only once its CI is green.

## Suggested next task
- Decide on a newer Java for the runner (below), then give chapter 35 a real records example.

## Open questions for you
- **`main` still says 1 free interview a day.** Merging `develop` into `main` is yours to do. It is what puts the 3-for-life wording live.
- **The runner is Java 15. Piston's package index has no newer Java.** A custom Piston package for Java 17 or 21 is possible, but it's build and maintenance work. Your call.
- **Production hosting for Piston** is unchanged. Production keeps `CODE_RUNNER_ENABLED=false` until you decide.
