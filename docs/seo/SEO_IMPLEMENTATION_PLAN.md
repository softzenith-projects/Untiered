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
| Verify the domain in Search Console and submit the sitemap | Release | Sitemap status "Success", 7 URLs discovered |
| Inspect the homepage and request indexing | Above | Live test shows "URL is available to Google" |
| Set up Bing Webmaster Tools | Search Console | Sitemap accepted |

Exact steps are in [SEO_VERIFICATION.md](SEO_VERIFICATION.md).

## P1: decide, then build

### Decide whether courses are public (owner)

The largest remaining lever and the only one that adds substantial content to search. Options and
a recommendation are in the audit. **Risk:** the gate is a deliberate product decision about
conversion, and this plan has no data on what opening it would cost in sign-ups.

If option B or C is chosen, the work is:

| Task | Code location | Acceptance criteria |
|---|---|---|
| Remove `/courses` and chosen paths from the guard | `PROTECTED_PREFIXES` in `src/lib/supabase/session.ts`, `session.test.ts` | Change goes through a **PR, not a merge**, per `CLAUDE.md` (touches auth). Signed-out visitors get the same page as crawlers |
| Add the routes to `INDEXABLE_ROUTES`, generated from `courses` | `src/lib/seo.ts`, `src/app/sitemap.ts` | Respects `courseEnabled`; a disabled course is not listed |
| Canonical, title and description on course pages | `courses/[course]/page.tsx`, `courses/page.tsx` | Descriptions come from course content, as `tagline` already does |
| Check that course pages render signed out | `courses/[course]/page.tsx`, reader components | Progress and sign-in prompts degrade cleanly; content is in the initial HTML |
| BreadcrumbList on course and chapter pages | Same | Matches visible navigation |
| `Course` structured data only if eligible | Same | Validate against Google's current requirements first. No invented ratings or provider claims |

**Dependencies:** owner decision. **Risks:** duplicate or thin overview pages if the syllabus is
all they contain, so each needs real outcome text; a chapter's interactive pieces may need work
to render signed out.

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
