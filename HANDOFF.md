# Handoff — 28 October 2026

## Task

Make the four courses uniform in text, format and interactive boxes. Improve course content, and use fanout.sh to improve system design. This was the owner's request in session, with no task file (PRD §07).

Earlier the same day, all merged: landing page revamp, fast in-app navigation, landing loop rounds, sign-in layout, and the logo chip.

## What I built

- **One box system.** `components/courses/lesson-box.tsx` provides `LessonNote` and `LessonPanel`, plus shared buttons.
  - Every block kind, in every course, now uses one radius, border, padding and label style: picture, remember, mistakes, interview, concept, trace, comparison, steps, visualiser, code, playground, quiz, agent lab and architecture lab.
  - Colour only marks meaning: blue for ideas, green for concepts, red for mistakes.
  - "Never forget" is now "Remember this", the name in the course brief.
  - Code blocks always show a header.
  - `lesson-box.test.tsx` checks every box kind uses the shared frame.
- **Quiz answer position.** The correct option was second in about 78% of Java, DSA and AI Agents quizzes, and first in every system design quiz.
  - `lib/quiz-order.ts` shows options in a fixed shuffled order seeded from the question. The course and the Arena (`lib/arena/derive.ts`) both use it.
  - Tests check that no position holds more than 40% of answers and that no quiz repeats an option.
- **Quiz answer length.** The correct option was the longest in 64% of Java, 96% of DSA and 93% of AI Agents quizzes.
  - Two `builder` agents rewrote the wrong options, bringing this to 32%, 33% and 10% respectively.
  - I checked every correct option they reworded and fixed the two problems I found:
    - The smolagents quiz's correct answer had been replaced by a false statement.
    - The heap quiz never said the array starts at index 0, so it had two defensible answers.
- **System design rewritten.** The course was generated from a fill-in template: about eight short strings stitched into identical sentences, with the second quiz word-for-word the same in every chapter.
  - It is now split into one file per module, with every chapter a full `LessonSpec` (`system-design/lesson.ts`) in the same shape as the other courses.
  - I wrote `caching-layers` as the model chapter. Two `builder` agents wrote the other 55, and I read all 165 of their quizzes.
  - The old template and the details file are deleted.
- **New module "Inside the data layer"** (`data-internals.ts`), original writing: unique IDs, storage engines (WAL, B-tree, LSM), and Bloom filters and sketches. The course is now 5 modules and 59 chapters.
- **One chapter shape for all four courses**, enforced by `content/courses/course-uniformity.test.ts`:
  - Each chapter opens with prose, then a heading, then the picture.
  - It closes with mistakes, remember this, the interview angle and three quizzes, then any practice section.
  - DSA's "Practice problems" blocks were moved after the quizzes, by script, as a pure reorder of 586 identical lines.

## Assumptions I made

- **fanout.sh** is a paid course with no reuse licence, and our `THIRD_PARTY_NOTICES.md` already excludes proprietary material.
  - I compared only its public module headings against our chapter list, which identified the three gap topics.
  - No lesson material was opened, copied or paraphrased. The notices file records this.
- "Uniform content" means the same chapter shape and box vocabulary across courses. I kept each course's own voice and its heading wording ("The tiffin box analogy" against "The picture: …").
- The system design integrity tests pinned the old template's literal strings. I restated them by intent: a real glossary before the walkthrough, a unique worked example of at least 80 characters, a two-sided trade-off, and one walkthrough.
- One commit (20533d1) also contains the template deletion. Its message describes only the reorder, because the separate cleanup commit failed on a pathspec.

## What I could NOT verify

- **The real chapter page.** The auth guard blocks it, and the permission system refused a local bypass.
  - I rendered four real chapters through `BlockRenderer` with the built CSS and checked screenshots.
  - The full page, with its header and guided-lesson mode, still needs a look.
- **The system design content** needs a domain read. Every quiz key was checked, but 59 chapters of prose were not proofread line by line. The writers flagged these illustrative figures:
  - 5% canary traffic
  - 2 s index lag
  - 30 s leases and circuit-breaker timings
- **Leftover agent worktrees.** `C:/tmp/uquiz` and `C:/tmp/uquizai` would not delete. Remove them with `git worktree remove --force <path>`.

## Verification status

- typecheck, lint, tests (3,181) and build: all pass locally.
- CI run on 20533d1 passed all four jobs.

## Merge status

- `feat/course-uniformity` merged into `develop` at 5a620b8 after green CI. No migrations.
- 125 files changed (+7,842 / −2,341). This is far over the 800-line guide, but nearly all of it is course prose. A split by course would have been reviewable separately.

## Suggested next task

- Proofread the system design chapters with someone who interviews for these roles, then add "build it yourself" playgrounds (Python) to the data-layer chapters.

## Open questions for you

- None blocking.
