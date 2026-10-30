# SEO verification

Everything under "What was run" actually ran on 30 October 2026, and the results are as observed.

## Where things stand

| Outcome | Status |
|---|---|
| A. Code-level fixes | **Done and tested**, on `develop` |
| B. Production behaviour | **Not verified with the fixes**: they are not live yet. Only the "before" state was measured |
| C. Google and Bing indexing | **Not verified.** No Search Console or Bing access. Unknown |

## What was run

### Crawler check, production before the fixes

`node apps/web/scripts/check-seo.mjs https://untiered.tech`: **24 passed, 13 failed, exit 1.**

```
FAIL  robots.txt returns 200 — got 404
FAIL  robots.txt is plain text — text/html; charset=utf-8
FAIL  robots.txt names the production sitemap
FAIL  sitemap.xml returns 200 — got 404
FAIL  sitemap.xml is served as XML — text/html; charset=utf-8
FAIL  sitemap.xml has an XML declaration and a urlset in the sitemap namespace
FAIL  sitemap.xml is well formed, 0 URLs — 0 open, 0 close, 0 loc
FAIL  /login is reachable and noindex — 200
FAIL  /login?next=%2Fcourses is reachable and noindex — 200
FAIL  /upgrade is reachable and noindex — 200
FAIL  /daily-challenge is reachable and noindex — 200
FAIL  /auth/update-password is reachable and noindex — 200
FAIL  a query-string URL canonicalises to the clean URL
```

The per-page checks did not run here, because the script reads its URL list from the sitemap and
there was none. A separate `curl` probe of each route supplied the page-level evidence in the audit.

### Crawler check, production build with the fixes

Run against `next start` with CI's placeholder environment, locally and on CI:
**140 passed, 0 failed, exit 0.** Local build on Windows, CI build on Ubuntu.

The check found a real bug the unit tests had missed: pages that set their own `openGraph` lost the
share image. Fixed, and the unit test was extended to cover it.

One comparison in the script was also corrected: Next renders the homepage canonical as
`https://untiered.tech` and the sitemap has `https://untiered.tech/`. Those are the same URL, so the
script now compares parsed URLs.

### Coverage against the brief

| # | Requirement | Result | How |
|---|---|---|---|
| 1 | Production build succeeds | Pass | `npm run build`, local and CI |
| 2 | Sitemap is valid XML | Pass, with a limit | `check-seo.mjs` checks declaration, namespace, balanced tags and `loc`. Not run through a schema validator |
| 3 | Sitemap URLs canonical, successful | Pass | Each fetched: 200, no redirect, self-canonical |
| 4 | Robots configuration | Pass | Unit tests and `check-seo.mjs` |
| 5 | Unique titles and descriptions | Pass | Unit tests and rendered HTML |
| 6 | Canonicals on the production host | Pass | Same |
| 7 | No accidental noindex on public pages | Pass | Metadata, rendered tag and header |
| 8 | Private routes protected and excluded | Pass | 10 routes redirect with no session, none in the sitemap |
| 9 | Important content in rendered HTML | Pass | h1 and text length on each page, without running JavaScript |
| 10 | Internal links resolve | Pass | Every internal link on the 7 pages followed to a 200 |
| 11 | Nonexistent routes return an error | Pass | 404 with noindex |
| 12 | Structured data parses and matches | Pass, with a limit | Parsed; name appears on the page; logo resolves. **Not run through Google's Rich Results Test**, which needs a live URL |
| 13 | Authentication, courses and interviews still work | **Partly verified** | 4,012 unit and integration tests pass, including the route guard's. **No real sign-in or interview was run**: no live interviews without your go-ahead, per `CLAUDE.md`, and these changes touch only metadata and links on those pages |
| 14 | No new lint, type or test failures | Pass | See below |

### Verification loop

| Check | Result |
|---|---|
| `npm run typecheck` (web) | Pass |
| `npm run lint` (web) | Pass |
| `npm run test` (web) | Pass: 103 files, 4,012 tests, of which about 60 are new SEO tests |
| `npm run build` (web) | Pass |
| [CI run 41017259089](https://github.com/softzenith-projects/Untiered/actions/runs/41017259089) on the code commit | Pass: web, api, database, images |

### Other measurements

- Lighthouse on production before the fixes: see the [audit](SEO_AUDIT.md). Lab data from single runs.
- PageSpeed Insights API: **failed**, 429 on the anonymous quota, so no field data was gathered.
- `site:untiered.tech` via this environment's search tool: **inconclusive**. The tool ignored the
  operator, so this says nothing about Google's index.

### Not tested

- Anything on production after the release.
- Preview deployments: the `CONTEXT` branch in `robots.ts` is unit-tested, not seen on Netlify.
- `X-Robots-Tag` on signed-in pages when actually signed in. The header is confirmed locally on the
  redirect response. On Netlify, `next.config.ts` headers reach served pages, as the security headers
  already do, but not the proxy's redirects. That is fine: those redirects lead to a noindex page.
- How the share image looks in real link previews. The PNG was viewed and looks right.

## After the release

Run this first. It should exit 0:

```
node apps/web/scripts/check-seo.mjs https://untiered.tech
```

## Google Search Console

Button names can change. These are correct as far as is known, but were not clicked during this work.

### Verify the domain

1. Go to <https://search.google.com/search-console> and sign in with the account that should own this.
2. Add property → **Domain** → enter `untiered.tech`. Domain covers `www` and `http` too.
3. Copy the TXT record Google shows.
4. Add it in **Hostinger's DNS** (the nameservers are `dns-parking.com`, which are Hostinger's) as
   type TXT, host `@`.
5. Click Verify. DNS can take a while; retry if it fails at first.

### Submit the sitemap

1. Sitemaps → enter `sitemap.xml` → Submit.
2. Expect status **Success** and **7** discovered pages. It may start as "Couldn't fetch" and clear
   on a later attempt.

### Inspect and request indexing

Paste each URL into the top search bar: `https://untiered.tech/`, then `/pricing`, then `/about`.
Then click **Test Live URL**, and if it says the URL is available to Google, **Request Indexing**.

There is a daily limit, and these requests do not guarantee indexing. Do not repeat them daily.

### Find out why the site is not indexed yet

This is what can establish the actual cause. Record for `https://untiered.tech/`:

| Where | What to note | What it tells you |
|---|---|---|
| URL Inspection, indexed result | "URL is on Google" or not, and the exact reason | The answer itself |
| URL Inspection | Last crawl date | Blank means Google has not fetched it yet |
| URL Inspection | Discovery: sitemaps and referring pages | Whether Google knows about the site, and how |
| URL Inspection, live test | Crawl allowed? Page fetch? Indexing allowed? | Confirms nothing technical is blocking |
| URL Inspection, live test → View tested page | Screenshot and HTML | Whether Googlebot sees the content |
| URL Inspection | User-declared and Google-selected canonical | Whether Google agrees |
| Indexing → Pages | Counts by reason | The reasons below |
| Links | External links | Whether anything points at the site |
| Settings → Crawl stats | Requests per day and host status | Whether Google is visiting, and any server trouble |

How to read the most likely Pages reasons:

- **Discovered, currently not indexed:** Google knows the URL but has not crawled it. Common on a new
  domain. Time and real inbound links help; resubmitting does not.
- **Crawled, currently not indexed:** Google read it and chose not to index it. Points at content
  value, which makes the course decision matter more.
- **Page with redirect:** expected for `/courses` and other gated URLs.
- **Excluded by 'noindex' tag:** expected for `/login`, `/upgrade`, `/daily-challenge`. Not expected
  for any of the 7 sitemap URLs.
- **Blocked by robots.txt:** expected only for `/api/` and `/auth/`.

### Monitor

Weekly at first, in Search Console:

- **Indexing → Pages:** do the 7 URLs move to Indexed? Any new error reasons?
- **Performance → Search results:** clicks, impressions, CTR, average position. Filter by page and
  query. These replace the hypotheses in the keyword map.
- **Experience → Core Web Vitals:** LCP, INP, CLS from real Chrome users. It stays empty until there is
  enough traffic, and an empty report is not a pass.

**Sign-ups cannot be measured here.** Search Console stops at the click, and the site has no analytics
beyond Sentry. See P1 in the [plan](SEO_IMPLEMENTATION_PLAN.md).

## Bing Webmaster Tools

1. Go to <https://www.bing.com/webmasters> and sign in.
2. Choose **Import from Google Search Console** once Google is verified. That is the shortest route.
   Otherwise add the site and verify by DNS at Hostinger.
3. Sitemaps → Submit → `https://untiered.tech/sitemap.xml`.
4. URL Inspection → `https://untiered.tech/`, and Request Indexing if offered.
5. Review the Search Performance and Site Explorer reports weekly.

## Validate the structured data

After release, enter `https://untiered.tech/` at <https://search.google.com/test/rich-results> and
<https://validator.schema.org/>.

**What the markup may do, without promises:** Organization can inform the logo and details Google
shows for the company. WebSite can inform the site name in results. Neither guarantees either
feature. Neither is a ranking boost.
