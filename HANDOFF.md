# Handoff — 30 October 2026

## Task
Audit and fix technical SEO on untiered.tech so public pages can be crawled and indexed. Owner's
brief, pasted into the session; no task file (PRD §11).

## What I built
- `apps/web/src/app/robots.ts`, `sitemap.ts`, `opengraph-image.tsx`: all three were missing. The
  sitemap lists 7 public pages and nothing that redirects.
- `apps/web/src/lib/seo.ts`: the canonical host, which routes are indexable or noindex, the page
  metadata helper, and the homepage's Organization and WebSite JSON-LD.
- Canonical, description and share tags on the 7 public pages, and a homepage title that says what
  the product is.
- `noindex` on `/login`, `/upgrade`, `/daily-challenge`, `/auth/update-password`, and an
  `X-Robots-Tag` on private routes in `next.config.ts`.
- Removed the doubled brand from titles ("Courses — Untiered · Untiered") on 5 gated pages. Added
  Pricing to the landing header, and links back to `/` from `/about` and `/pricing`.
- `apps/web/src/lib/seo.test.ts`: a new page fails until it is classified as indexable, noindex, or
  behind sign-in.
- `apps/web/scripts/check-seo.mjs`: checks what a crawler receives from a running site. CI now runs
  it against the production build; it also works against production.
- `docs/seo/`: `SEO_AUDIT.md`, `SEO_IMPLEMENTATION_PLAN.md`, `SEO_KEYWORD_MAP.md`,
  `SEO_VERIFICATION.md` (includes the Search Console and Bing steps).

## Assumptions I made
- **Courses stay behind sign-in.** The brief mentions course pages, but also says to preserve
  authentication and product behaviour, and `CLAUDE.md` says public access is not restored without
  the owner. So the sitemap has 7 URLs, and the decision is written up in the audit.
- Signed-in routes are left out of robots.txt deliberately: a blocked URL can still be indexed from
  links, and the crawler would never see the redirect. They redirect to a noindex page instead.
- The canonical host is a constant, not an environment variable, so a misconfigured deployment
  cannot point Google at a preview.
- Metadata and links on auth pages are not "touching auth", so this merged rather than going through
  a PR. `session.ts` and `proxy.ts` are unchanged. The same goes for `/upgrade` and payments: only
  its metadata changed.
- No `lastModified` in the sitemap, since nothing tracks real page changes.

## What I could NOT verify
- **Whether Google or Bing have indexed anything, and why not if they have not.** No Search Console
  access. The audit found no technical blocker on the public pages, and the domain is only 16 days
  old (registered 14 October 2026), but the cause is not established.
- Production behaviour with these fixes: they are not live. Production looks like it builds from
  `main` (inferred: it lacks the JavaScript course), and Netlify's settings are not in the repo.
- Real sign-in, course and interview flows in a browser. Unit and integration tests only, with no
  live interviews per rule 7.
- The JSON-LD in Google's Rich Results Test, which needs a live URL.
- Performance improvement: none was attempted or claimed. Baseline Lighthouse numbers are in the
  audit. No field data.
- **`api.untiered.tech` timed out from this machine** on five attempts over ports 443 and 80. It may be
  this network, or the API may be down. Please check it.

## Verification status
- typecheck / lint / tests / build: all pass locally and on CI. 4,012 web tests in 103 files.
- Crawler check on the production build: 140 of 140, locally and on CI. Production before the fix:
  24 passed, 13 failed.
- CI on the code commit, all four jobs green:
  https://github.com/softzenith-projects/Untiered/actions/runs/41017259089
- About 1,200 changed lines including about 500 of documents; the code is about 670. It did not
  split naturally, since the tests and docs describe one change.

## Merge status
- Merged into `develop`; see the commit that follows this handoff for the merge SHA and its CI result.
  No migrations. `main` is not touched: **nothing here is live until the owner advances `main`.**

## Suggested next task
- Once the owner has decided: open the course catalogue and overviews to signed-out visitors, through
  a PR because it changes the route guard (P1 in the plan).

## Open questions for you
- Should some course content be public? It is the largest remaining SEO lever and is your call.
  Options and a recommendation are in `docs/seo/SEO_AUDIT.md`.
- `/daily-challenge` is not behind sign-in, though `CLAUDE.md` says the Arena is. Intended?
