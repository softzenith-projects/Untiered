# SEO audit: untiered.tech

Audit date: 30 October 2026. Production evidence was collected from outside the site with
`curl`, Lighthouse 12 and `apps/web/scripts/check-seo.mjs`. **No Search Console or Bing
Webmaster data was available**, so nothing here states what Google has or has not indexed.

## Summary

**Nothing found blocks crawling or indexing of the public pages.** They return 200, carry no
noindex, are server-rendered with real text, and a missing robots.txt does not stop Google.
The defects below are real and now fixed in code, but none of them proves why the site is not
yet in search.

The reason is not established. The two strongest pieces of context are:

1. **The domain is 16 days old.** RDAP records its registration on 14 October 2026.
2. **Only 7 URLs were indexable, and most of those are legal or support pages.** Every course
   and chapter (201 chapters, about 52 hours of original material) redirected to `/login`, by
   the owner's decision of 21 September 2026. The homepage's course links all ended at the
   sign-in page. The owner has since opened the catalogue and overviews (30 October 2026),
   which makes 13 indexable URLs once released. Chapters stay behind sign-in.

URL Inspection in Search Console is what can settle it. See
[SEO_VERIFICATION.md](SEO_VERIFICATION.md) for the exact evidence to collect.

## Stack, as verified

| Item | Finding | Evidence |
|---|---|---|
| Framework | Next.js 16.4.3, App Router | `apps/web/package.json`, `src/app/` |
| Route guard | `src/proxy.ts` → `lib/supabase/session.ts` | Read in full |
| Web host | **Netlify**, not the Vercel plan in `deploy/README.md` | `Server: Netlify` on every response |
| Netlify config | Not in the repository (no `netlify.toml`) | Lives in the Netlify dashboard |
| Deployed source | Looks like `main`, not `develop` | Live homepage has no `/courses/javascript` link; `origin/main` has no JavaScript course and `develop` does. Inferred, not confirmed |
| DNS | Hostinger nameservers; apex resolves to 75.2.60.5 | RDAP, `nslookup` |
| Rendering | Public pages are prerendered; `x-nextjs-prerender: 1` | Response headers, build output |

## Indexing diagnosis

"Verified" means observed directly. "Needs GSC" means only Search Console can confirm it.

| URL or pattern | Observed before the fix | Evidence | Likely effect | Severity | Fix | Status |
|---|---|---|---|---|---|---|
| `/robots.txt` | 404 | `curl`; `check-seo.mjs` | **Not a blocker.** Google treats a 404 robots.txt as "no restrictions" | Medium | `app/robots.ts` | Verified; fixed in code |
| `/sitemap.xml` | 404 | Same | Slower discovery, no blocker. Nothing to submit in Search Console | High | `app/sitemap.ts` | Verified; fixed in code |
| All public pages | No `<link rel="canonical">` | Per-route probe | `?utm=` URLs return 200 with no consolidation signal | High | `publicPageMetadata` | Verified; fixed in code |
| All public pages | No `metadataBase`, Open Graph or Twitter tags | Same | Poor link previews; no direct ranking effect | Medium | `rootMetadata`, helper, `opengraph-image.tsx` | Verified; fixed in code |
| `/` | Title "Untiered — talent has no tiers": no product words | Live HTML | Weak relevance signal for a new brand nobody searches for yet | High | New title and description | Verified; fixed in code |
| `/` | No structured data | `grep -c ld+json` = 0 | No site-name or logo signal | Medium | Organization and WebSite JSON-LD | Verified; fixed in code |
| `/login`, `/login?next=…` | 200 and indexable | `check-seo.mjs` | The sign-in page could rank, and every gated link leads to it | High | `noindex, follow` | Verified; fixed in code |
| `/upgrade`, `/daily-challenge`, `/auth/update-password` | 200 and indexable | Same | Thin app pages eligible for the index | Medium | `noindex, follow` | Verified; fixed in code |
| `/courses`, `/courses/*`, `/arena`, `/interview/*` and similar | 307 → `/login?next=…` | `curl` | Correct for private pages. For courses it removed all substantive content from search | **High** | Catalogue and overviews opened; chapters, Arena and interviews unchanged. See "Owner's decision" | Verified; fixed in code |
| Gated page titles | "Courses — Untiered · Untiered" | Source: title plus layout template | Doubled brand in tabs | Low | Removed from 5 pages | Verified from source; fixed |
| Public pages | 200, no noindex, no X-Robots-Tag | Per-route probe | **No accidental noindex on public pages** | n/a | None needed | Verified healthy |
| `www`, `http` | 301 to `https://untiered.tech/`; `http://www` takes two hops | `curl` | Fine. Host is consistent | Low | Netlify setting, not worth changing | Verified healthy |
| `/pricing/` | 308 → `/pricing` | `curl` | One hop, consistent | n/a | None needed | Verified healthy |
| Unknown route | 404 with noindex | `curl` | No soft 404s | n/a | None needed | Verified healthy |
| Whole site | Is it indexed? Which pages? Crawled or not? | None available | Unknown | Unknown | Inspect in Search Console | **Needs GSC** |
| Inbound links | Any exist? | None available | A new domain with none is usually found slowly | Unknown | Search Console Links report | **Needs GSC** |
| Preview hosts | Netlify's `*.netlify.app` name and preview behaviour | Site name not known here | Possible duplicate host | Low | Canonicals name the real host; previews disallow all in `robots.ts` | Needs Netlify access |

## Things that look like problems but are not

- **The noindex on the 404 page** is Next.js doing the right thing. An early read of the
  `/robots.txt` body looked like a noindexed homepage. It was the 404 page.
- **Lighthouse SEO scored 100 on production before any of these fixes.** That score does not
  check for a sitemap or look at site-level coverage, so it should not be read as "SEO is fine".
- **Signed-in routes are not in robots.txt on purpose.** A blocked URL can still be indexed
  from links to it, because the crawler never sees where it redirects. The homepage links to
  several, so they stay crawlable and reach a noindex page.

## Private content

Verified on the production build with no session: `/dashboard`, `/profile`, `/history`,
`/rounds`, `/report/*`, `/interview/*`, `/questions`, `/arena` and all 201 chapter URLs redirect to
`/login`, and none is in the sitemap. The public course pages send chapter titles only, no chapter
content and no Arena answers; `check-seo.mjs` checks this on every run.

The guard itself is a redirect, not the security boundary. The API authorises every call
(per the comment in `session.ts`). This audit did not test the API's authorisation.

## Rendering and internal linking

- Headings and body text are in the initial HTML on all 7 pages (927 to 6,228 characters of
  text outside scripts, measured by `check-seo.mjs` on the local production build).
- `LoopPicker` renders only its first archetype on the server. The other four are absent from
  the initial HTML, including the product-company examples.
- All navigation uses real `<a href>` anchors. Every internal link on a public page resolves.
- Before the fix `/pricing` was linked only from the footer. It is now in the landing header,
  and `/about` and `/pricing` link back to the product explanation.

## Performance (production, before these changes)

Lighthouse 12 run once per row from this machine in headless Chrome. This is lab data from a
single run on one machine, not field data. **No Chrome UX Report or INP data was available**:
the anonymous PageSpeed API returned 429 and the site is likely too new to have field data.

| Page | Form factor | Perf | LCP | FCP | CLS | TBT | Weight |
|---|---|---|---|---|---|---|---|
| `/` | Mobile | 71 | 3.3 s | 1.6 s | 0 | 760 ms | 352 KiB |
| `/` | Desktop | 93 | 1.1 s | 0.8 s | 0.003 | 90 ms | 358 KiB |
| `/pricing` | Mobile | 93 | 2.9 s | 1.3 s | 0 | 140 ms | 369 KiB |
| `/pricing` | Desktop | 98 | 0.8 s | 0.7 s | 0 | 40 ms | 376 KiB |

Findings: CLS is clean. Script is about 280 KiB on every page, and Lighthouse estimates 72 to
95 KiB of it unused. Document response took 610 to 1,180 ms. There are no third-party scripts
of any weight. **No performance change was made**, because no fix here is both clear and low
risk, so no improvement is claimed. See P2 in the plan.

## Fixed and unresolved

**Fixed in code, on `develop`, not yet live:** robots, sitemap, canonicals, metadata base, titles
and descriptions, Open Graph and Twitter tags, share image, JSON-LD, noindex on low-value pages,
doubled titles, header pricing link, automated checks.

**Unresolved:**

- Actual index status and the reason for it: needs Search Console.
- Going live: production appears to build from `main`, which only the owner advances.
- **`/daily-challenge` is not behind sign-in**, though `CLAUDE.md` says the Arena is. It shows
  daily Arena questions to anyone. It is now noindex, but the guard was not changed because that
  belongs in a reviewed PR.
- **`api.untiered.tech` did not answer from this machine** (five attempts over ports 443 and 80,
  all timed out; it resolves to 130.210.55.83). The production bundle points to it. This may be a
  firewall or this network, or the API may be down. It is not an SEO issue, but if it is down,
  signed-in features and conversions are affected. Check it from your side.

## Owner's decision (30 October 2026)

**The catalogue and the five course overviews are public; chapters stay behind sign-in.** This
replaces the 21 September decision for those six pages and is recorded in `CLAUDE.md`.

| Option considered | Indexable pages gained | Trade-off |
|---|---|---|
| A. Keep the gate | 0 | 7 pages compete for search. Growth depends on other channels |
| **B. Public catalogue and course overviews; chapters gated (chosen)** | 6 | Shows syllabus and depth, keeps the sign-up moment at reading |
| C. B, plus the first chapters of each course | About 6 + 5–15 | Real teaching content can rank; visitors sample before signing up |
| D. All chapters public | About 200 | Largest search surface; gives up the gate |

What to watch: overview pages are a syllabus plus a short description, so Google may treat them as
thin ("Crawled, currently not indexed"). If so, option C or fuller overview text is the next step.
The effect on sign-ups is not measured, because the site has no analytics to measure it with.

Crawlers must never be served content that signed-out visitors cannot see. That is cloaking and a
Google spam-policy risk. The pages opened here serve everyone the same HTML.
