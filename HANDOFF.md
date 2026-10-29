# Handoff — 29 October 2026

## Task
Give every Java course chapter a runnable "try it yourself" block (owner, in session: "I don't see a run option in the Java course"). PRD 06. Branch `feat/java-course-playgrounds`.

## What I built
- **A Java playground in all 35 Java chapters**, placed just before each chapter's "common mistakes" box. Each one has:
  - a starter program
  - a short task to try, such as "change `bigValue` to 300 and predict the byte"
  - the output the starter should print

  Files: `apps/web/src/content/courses/java/*.ts`.
- **Most starters are the chapter's own main example.** Where a file has helper classes, the class with `main` moved to the top (see the runner bug below).
- **Four chapters needed a different starter**, because their example cannot run in a single-file playground:
  - **05 input/output:** `Scanner` reads from a string instead of the keyboard. The prompt says why.
  - **13 methods:** the chapter only has snippets, so I joined them into one full program.
  - **22 packages:** the chapter's example is two files in two packages. The playground uses the JDK's own packages (imports, fully-qualified names, `getPackageName()`) and says why.
  - **35 records:** see the Java 15 note below. The playground covers switch expressions and `var` only, and says why.
- **Runner fix, which also affects interview rounds** (`apps/api/.../interview/CodeRunner.kt`):
  - Piston launches Java as a single source file and starts from the *first* class in it.
  - A program written as `class Node {…}` followed by `public class Main {…}` is normal Java. It failed with a bare `can't find main(String[]) method in class: Node`.
  - 16 of the 35 chapter examples had this shape. A candidate in a coding round could hit it too.
  - The error now adds a line saying to move the class that has `main` to the top. The test is in `CodeRunnerTest`.
- **Tests** (`content-integrity.test.ts`):
  - every Java chapter has a Java playground with a prompt and expected output
  - in every Java starter, the first class is the one with `main`
- **Java 15 notice** (follow-up, owner asked): every Java Run button now says it runs Java 15, so records, sealed types and pattern-matching switch won't compile. It shows in the course playground and in the interview round's coding editor, from one constant, `JAVA_VERSION_NOTE` in `apps/web/src/lib/server-code-runner.ts`. Branch `feat/java-15-disclaimer`.
- **Docs:** fixed the out-of-date "only Python can run" comment on the playground block type (`types.ts`).

## Assumptions I made
- One playground per chapter, reusing the chapter's own example, so the expected output is already checked against the text.
- I fixed the class-order problem by improving the error message, not by reordering the candidate's code on the server. Reordering would shift the line numbers in compile errors and change what the candidate wrote.

## What I could NOT verify
- **Pressing Run in a browser while signed in.** I checked the content directly against the local Piston, using the request the API sends:
  - all 35 starters compile and print exactly their `expectedOutput`
  - two prompt claims hold: deleting `hashCode()` makes the set size 3, and removing `synchronized` with 100,000 increments loses updates (124k–130k out of 200k)
- How the prompts read to a class-12 student. That's your judgement.

## Verification status
- web typecheck / lint / test (3,218 passing) / build: pass locally
- api ktlintCheck / test / build: pass locally
- CI run 40822267961 on `f4572f7`: all four jobs green

## Merge status
- Merged `feat/java-course-playgrounds` into `develop` after CI run 40822267961 went green (api, web, images, database). No migrations in this change.

## Suggested next task
- Decide on a newer Java for the runner (below), then give chapter 35 a real records playground.

## Open questions for you
- **The runner is Java 15. Piston's package index has no newer Java.** Records, sealed types and pattern-matching `switch` don't compile on it. That breaks chapter 35's own example, and also any candidate who writes a record in a coding round. A custom Piston package for Java 17 or 21 is possible, but it's build and maintenance work. Your call.
- Unchanged from the last handoff: production hosting for Piston. Until that's decided, production keeps `CODE_RUNNER_ENABLED=false`, and Java's Run button says no runner is configured.
