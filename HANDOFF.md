# Handoff — 30 October 2026

## Task
Make the course catalogue and the five course overviews public and indexable, with chapters still
behind sign-in. Owner's decision in this session, following the SEO audit in `docs/seo/` (PRD §11).

## What I built
- **The guard:** `isPublicCoursePage` in `apps/web/src/lib/supabase/session.ts` opens `/courses` and
  `/courses/<course>` only. Anything deeper stays protected. Signed-in sessions keep refreshing on them.
- **Search:** the 6 pages are in `app/sitemap.ts` (a switched-off course is left out), with their
  own title, description and canonical. `seoTitle` and `seoDescription` are new required fields on
  `Course`. Overviews have `Course` structured data with no ratings or offers.
- **No gated content on public pages:** the daily Arena banner, whose props include the answer, now
  renders only when signed in (`app/courses/page.tsx`, tested in `page.test.tsx`).
- **The header with no session** (`app-chrome.tsx`, `rail-nav.tsx`, `lib/nav-links.ts`): the logo goes
  home, the nav is Courses and Pricing, and Sign in returns to the current page. This also improves
  `/upgrade` and `/daily-challenge`, which showed the signed-in bar to visitors.
- **Chapter links** (`ChapterLink` in `course-progress.tsx`) do not prefetch while signed out, and the
  overview says "Free. Sign in or create an account to open the chapters."
- `apps/web/scripts/check-seo.mjs` now fails if a public course page sends chapter content or Arena
  answers, or if any chapter link serves anything but a redirect to sign-in.
- `CLAUDE.md` and `AGENTS.md` record the new decision. `docs/seo/` is updated.

## Assumptions I made
- "Catalogue and overviews" means exactly those six URLs. The Arena, interviews and chapters are
  unchanged.
- `/daily-challenge` stays as it is, because you did not answer that question. It is public, noindex,
  and still sends the day's question and answer.
- No BreadcrumbList: page breadcrumbs are hidden in the UI, and the markup should match what is visible.

## What I could NOT verify
- **Signed-in behaviour in a real browser**, because no test account was used. Unit tests cover the
  banner, header and progress in both states. Please click through once while signed in.
- **Whether these pages will be indexed.** They are a syllabus plus a short description, and Google
  may treat them as thin. Search Console will say.
- **The effect on sign-ups**: the site has no analytics to measure it with.
- Production: not live until this PR is merged and `main` is advanced.
- `api.untiered.tech` still timed out from this machine on the last attempt. Please check it.

## Verification status
- typecheck, lint, build: pass. Web tests: 4,031 pass, with the exception below.
- Crawler check on a verified fresh build: 438 of 438. Headless Chrome as a visitor: 21 of 21, and no
  console or hydration errors on 10 pages. That check caught a hydration bug of mine, now fixed.
- **Existing flake, not from this change:** `content-integrity.test.ts`, chapter
  `machine-coding-utilities` in the JavaScript course, failed 2 of 3 local runs (`end d` and `end a`
  swap). It races real timers under `node`, and this machine was busy. CI has been passing it. I did
  not weaken it. It should get wider timer gaps in the sample, and may eventually fail a CI run.
- Local quirk: `next build` does not clear `.next/server/route-cache`, so a stale `/` can refer to CSS
  that no longer exists. Details in `docs/seo/SEO_VERIFICATION.md`.

## Merge status
- PR into `develop`, not merged, because it changes the route guard (rule 1). No migrations.
  `main` is not touched. The earlier SEO work is on `develop` at `d6ddcfc`.

## Suggested next task
- Widen the timer gaps in the `machine-coding-utilities` sample so its test stops racing.

## Open questions for you
- `/daily-challenge` is public but `CLAUDE.md` says the Arena is behind sign-in. Intended?
