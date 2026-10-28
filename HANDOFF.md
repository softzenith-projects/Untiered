# Handoff — 28 October 2026

## Task

Make in-app navigation between tabs feel instant (owner's request in session; PRD §13; no task file). Earlier today: the landing page revamp (`feat/landing-revamp`, merged at 48b2837).

## What I built

- `components/app-chrome.tsx`: the signed-in bar, backdrop and footer, mounted once in `app/layout.tsx` and shown on shell routes (`isShellPath`). It used to be rendered by every page and every `loading.tsx`, so each click rebuilt it twice.
- `components/app-shell.tsx`: now only the page body (`<main>` width and padding). Pages are unchanged.
- `components/rail-nav.tsx`: top-bar links use `prefetch` (full page, not just the skeleton).
- `next.config.ts`: `experimental.staleTimes.dynamic = 60`, so a page visited in the last minute is served from the router cache.
- `components/dashboard-panel.tsx`: remembers the last dashboard (keyed to the token, memory only) and paints it on return visits while refetching. `forgetDashboard()` runs with `forgetAccount()` on sign-out.
- Tests: `app-chrome.test.tsx` (route matching, the same bar element survives a page change, interview room stays bare) and three return-visit tests in `dashboard-panel.identity.test.tsx`.

## Assumptions I made

- Ruled out auth latency: the Supabase project signs JWTs with ES256 (JWKS checked), so the proxy's `getClaims` verifies locally with no network call.
- A 60-second router cache is safe because personal data is fetched client-side, not baked into server payloads, and sign-out calls `router.refresh()`.
- On a return visit the dashboard can show the previous allowance or round list for the moment before the refetch lands, for example right after finishing a round. I judged that better than a blank skeleton on every visit.

## What I could NOT verify

- Felt latency in a real signed-in browser. **Next does not prefetch in `next dev`, and dev compiles each route on first visit, so judge speed on a production build (`npm run build && npm run start`) or a deployment.**
- Each page body still fetches its own data (dashboard, courses progress) from the API on first visit. That depends on API latency from where it is hosted.

## Verification status

- typecheck / lint / tests (3,120) / build: pass locally. CI run 40646873741 passed all four jobs.
- `next build` again stopped once on the Next.js security-advisory notice and passed on retry.

## Merge status

- Merged `fix/fast-navigation` into `develop` at 0360c49. No migrations.

## Follow-up: landing-page round lists (also 28 October)

- Owner's correction applied in `components/landing/loop-picker.tsx`: Big Four technical hiring shares the service-IT tab (no case discussion); "Europe & abroad" and GCC lead with technical rounds; every panel says the rounds are typical, not a fixed list. The hero demo's Big Four turn is now techno-managerial (`sample-turn.tsx`).
- The round names are product knowledge from the owner and the earlier page, not sourced per employer; worth a domain check.
- Merged `fix/landing-loop-rounds` into `develop` at 1105ff2 after CI passed all four jobs.

## Follow-up: sign-in layout and logo contrast (also 28 October)

- `app/login/page.tsx`: navy panel pinned to viewport height, form card top-aligned, so switching Sign in / Create account moves nothing (measured in headless Edge at 1440x860: identical positions in both modes).
- `public/brand/wordmark-on-navy.png` (new): the U lifted from 1.2:1 to 3:1 against navy, hue kept; used by `BrandWordmark inverse` (sign-in panel, footer) and dark mode. Supplied brand files unchanged; the owner may prefer a designer-made light variant.
- Merged `fix/login-layout-logo` into `develop` at 129205f after CI passed all four jobs.

## Suggested next task

- Act on the Next.js security advisory: run `next upgrade` on its own branch.

## Open questions for you

- None blocking.
