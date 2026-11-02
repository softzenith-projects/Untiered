# Handoff — 2 November 2026

## Task
Add Google Analytics to the site, at the owner's request in this session (PRD §11).

## What I built
- **The tag** (`apps/web/src/lib/analytics.ts`, `components/site-analytics.tsx`, mounted in
  `app/layout.tsx`): GA4 through `next/script`, so no new dependency. With
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset, nothing renders and nothing loads.
- **Consent banner:** Google's script does not load until the visitor clicks Allow. Allow and Decline
  have equal weight, and the answer is kept in `localStorage`.
- **Public pages only:** `/`, `/about`, `/contact`, `/pricing`, `/privacy`, `/terms`, `/refund-policy`,
  `/login`, `/courses`, `/courses/<course>`. It is an allowlist, so a new page is untracked by default.
  Elsewhere there is no banner, and Google's `ga-disable` switch is set.
- **What is sent:** page views without query strings, and no user id. Google signals and ad
  personalisation are off.
- **Privacy policy** (`app/privacy/page.tsx`, `lib/legal.ts`): collection, use, processors and cookies
  now describe GA, and the Cookies section has a control to change the answer, which also deletes the
  `_ga` cookies. Last-updated date is 2 November 2026.
- `.env.example`, `apps/web/Dockerfile` and `deploy/README.md` carry the new variable. `CLAUDE.md` and
  `AGENTS.md` record the rule.

## Assumptions I made
- **Opt-in for every visitor, worldwide.** You said to get it done without answering the banner
  question, so I took the stricter option: the site serves people applying to European employers, and
  it keeps the policy honest. GA will undercount, because people who decline or ignore the banner are
  not counted. Showing the banner only in some regions, or loading before consent, is your decision.
- `/upgrade` and `/daily-challenge` are untracked. `/pricing` is the page a visitor sees.
- Page views only. No sign-up or purchase events.

## What I could NOT verify
- **A real hit reaching GA.** There is no measurement id yet. Tests check what is queued for Google,
  not what Google receives. After setting the id, click Allow and check GA's Realtime report.
- **Legal sufficiency.** The policy wording and the consent approach need your judgement.
- **The banner at phone width.** Headless Chrome will not render below 500px. Desktop looks right.
- **Clicking Allow in a real browser.** Covered by unit tests only, because no browser driver is
  installed.

## Verification status
- typecheck, lint, build: pass. Web tests: 4,068 pass, including 37 new ones.
- Headless Chrome against a production build with a dummy id: banner present and no Google script on
  `/`, `/courses/java`, `/privacy` and the sign-in page.
- CI: see the PR.

## Merge status
- PR into `develop`, not merged, because it changes the privacy policy and data-protection posture
  (rule 1). No migrations. `main` is not touched.
- `docs/guides/` was already untracked and is not part of this change.

## Suggested next task
- Add sign-up and purchase events, so GA can answer whether the public course pages bring sign-ups.

## Open questions for you
- To switch it on: create a GA4 property, set `NEXT_PUBLIC_GA_MEASUREMENT_ID` on the production web
  build and redeploy, and in the data stream turn off Enhanced measurement → "Page changes based on
  browser history events". Left on, in-app navigation is counted twice.
