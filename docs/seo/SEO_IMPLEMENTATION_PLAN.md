# SEO implementation plan

Status as of 30 October 2026. Findings and evidence are in [SEO_AUDIT.md](SEO_AUDIT.md).

## P0: foundation

### Done in code

Merged into `develop`, not yet in `main`. Each is checked by `apps/web/src/lib/seo.test.ts`,
`apps/web/scripts/check-seo.mjs`, or both.

| Task | Code location | Acceptance criteria |
|---|---|---|
| robots.txt | `src/app/robots.ts` | 200, plain text, names the production sitemap, blocks only `/api/` and `/auth/`; previews disallow everything |
| Sitemap | `src/app/sitemap.ts`, `INDEXABLE_ROUTES` in `src/lib/seo.ts` | Valid XML; every URL returns 200 with no redirect and canonicalises to itself |
| Canonical host | `SITE_URL`, `rootMetadata` in `src/lib/seo.ts` | A constant; `metadataBase` set; no canonical in the root layout |
| Per-page metadata | `publicPageMetadata`, used by the 7 public pages | Unique title and description; one self-canonical; no noindex |
| Share tags | `src/app/opengraph-image.tsx`, helper | `og:image` and `twitter:image` on all 7 pages, and the image resolves |
| Low-value pages out of index | `NOINDEX_FOLLOW` on `/login`, `/upgrade`, `/daily-challenge`, `/auth/update-password` | noindex in the rendered HTML, no canonical |
| Second layer for private routes | `NOINDEX_ROUTES` in `next.config.ts` | `X-Robots-Tag: noindex` on served pages |
| Structured data | `homepageJsonLd` in `src/lib/seo.ts`, rendered in `src/app/page.tsx` | Parses; Organization and WebSite only; no ratings, offers or `sameAs` |
| Doubled titles | `courses/*`, `arena/*` pages | No "— Untiered" inside a templated title |
| Guard against drift | `seo.test.ts` | A new page fails the test until classified as indexable, noindex, or behind sign-in |
| CI check | `.github/workflows/ci.yml` | Web job fails if a crawler check fails on the production build |

### Owner actions, in order

| Task | Depends on | Acceptance criteria |
|---|---|---|
| Open a PR from `develop` to `main` and merge it | CI green on `develop` | The PR also carries everything else on `develop`, including the JavaScript course. Review it as a release |
| Confirm which branch Netlify builds for production | Netlify access | Written down; `deploy/README.md` still describes Vercel |
| Run `node apps/web/scripts/check-seo.mjs https://untiered.tech` after deploy | Release | Exits 0 |
| Verify the domain in Search Console and submit the sitemap | Release | Sitemap status "Success", 13 URLs discovered |
| Inspect the homepage and request indexing | Above | Live test shows "URL is available to Google" |
| Set up Bing Webmaster Tools | Search Console | Sitemap accepted |

Exact steps are in [SEO_VERIFICATION.md](SEO_VERIFICATION.md).

## P1: decide, then build

### Public catalogue and course overviews (decided by the owner, built in a PR)

Goes through a **PR, not a merge**, per `CLAUDE.md`, because it changes the route guard.

| Task | Code location | Acceptance criteria |
|---|---|---|
| Open `/courses` and `/courses/<course>` only | `isPublicCoursePage` in `src/lib/supabase/session.ts` | Anything deeper stays protected; signed-in sessions keep refreshing |
| List them in the sitemap | `src/app/sitemap.ts` | Respects `courseEnabled`; a disabled course is not listed |
| Title, description, canonical | `courses/page.tsx`, `courses/[course]/page.tsx`, `seoTitle` and `seoDescription` on `Course` | Unique; chapter count computed |
| No gated content on public pages | `courses/page.tsx` (daily banner only when signed in) | `check-seo.mjs`: no chapter blocks, no `correctIndex` |
| Header works with no session | `app-chrome.tsx`, `rail-nav.tsx` | Logo goes home; Courses, Pricing, Sign in with a return path |
| No prefetching of chapters signed out | `ChapterLink` in `course-progress.tsx` | Browser check: no chapter requests |
| `Course` structured data | `courseJsonLd` in `src/lib/seo.ts` | Name and description appear on the page; no ratings or offers |

Not added: **BreadcrumbList**, because page-level breadcrumbs are intentionally hidden in the UI
and the markup should match visible navigation.

### After release, if overviews are not indexed

If Search Console reports them as "Crawled, currently not indexed", add real outcome text to each
overview, or open the first chapters of each course (option C in the audit; owner's decision).

### Measure sign-ups from organic search (owner, then code)

`apps/web/package.json` has no analytics dependency beyond Sentry, and Lighthouse saw no other
third party on production. Search Console gives clicks, impressions,
CTR and position, but not sign-ups. Adding one is a product and privacy-policy decision, because
`/privacy` lists who processes data.

## P2: only once there is evidence

| Task | Code location | Acceptance criteria | Note |
|---|---|---|---|
| Render all loop archetypes in the initial HTML | `src/components/landing/loop-picker.tsx` | All five visible to crawlers; same interaction | Check `SegmentedTabs` accessibility is preserved |
| Reduce JavaScript on the landing page | `src/app/layout.tsx` (`AppChrome`), Sentry client config | Re-measure with Lighthouse on the same setup before claiming a gain | Mobile TBT 760 ms is the weakest number measured. Find the cause first |
| Document response time | Netlify caching | Re-measure | 610 to 1,180 ms measured for prerendered pages. Needs Netlify cache investigation |
| Add `sameAs` to Organization | `homepageJsonLd` | Only real, owned profiles | None found today |
| `<employer> interview` pages | New route | Sourced content only, provenance shown, unique per employer | See [SEO_KEYWORD_MAP.md](SEO_KEYWORD_MAP.md). Highest risk of becoming doorway pages or inventing employer detail |

## Not planned

- Mass-produced articles, or pages made to raise a URL count.
- `SoftwareApplication`, `Product`, `Review` or `FAQPage` markup: nothing here would qualify honestly.
- A `lastmod` based on build time, which would claim every page changes on every deploy.
- A new SEO dependency. The framework's conventions covered everything.
