# Handoff — 13 November 2026

## Task
Introduce Untiered Campus (B2B college partnerships): a "for colleges" CTA on the site,
the owner's spec adapted to this codebase, and a schema/API plan for modules 1–4 for review.
Source: owner's PDF "Untiered Campus: College Partnership Features (v1)" (13 Nov 2026).

## What I built
- **Spec, adapted:** [docs/campus-v1-spec.md](docs/campus-v1-spec.md). This is the PDF with
  every change marked **[Changed]** and a reason given. Main changes: MCQ tests deferred;
  no accounts created at import; no "optional recording consent" at join; platform admin
  stays the config allow-list; interviews a college assigns are paid from a per-college
  allowance.
- **Plan for modules 1–4 (no backend code):** [docs/campus-v1-plan.md](docs/campus-v1-plan.md)
  covers what can be reused and what conflicts, three migrations in full SQL, the
  tenant-isolation approach, the permission matrix, the REST API, the account-linking flow,
  the frontend routes, and risks with open questions.
- **Public `/colleges` page:** [apps/web/src/app/colleges/page.tsx](apps/web/src/app/colleges/page.tsx).
  It separates what students can use today from what is still in development, and its
  call to action is "Talk to us about a pilot". That is a mailto to the support address
  with the subject and the questions filled in ([lib/campus.ts](apps/web/src/lib/campus.ts)).
- **Landing page CTA:** a "For colleges" band above the testimonials
  ([components/landing/colleges-band.tsx](apps/web/src/components/landing/colleges-band.tsx)),
  a "For colleges" link in the header nav, and one in the footer.
- `/colleges` is added to `INDEXABLE_ROUTES` (sitemap and canonical) and to the SEO
  metadata test. There are new tests in `app/colleges/colleges-page.test.tsx`.

## Assumptions I made
- **Contact goes by mailto, not a form.** A form would need a backend to store college
  contact details. A mailto adds no new service and keeps no data.
- **The page claims nothing that isn't built.** Batch invites, assignments, readiness and
  integrity flags sit under an "In development" label. The landing band says "Batch tools
  are in development with partner colleges".
- **One sentence is a commitment the plan makes, not a feature that exists yet:** "A
  student joins their college's space themselves, and is shown what the college will see
  before anything is shared." If you disagree with that design, change the sentence.
- **`/colleges` is not in the Google Analytics allowlist.** Adding it widens tracking, and
  CLAUDE.md says the privacy policy then has to change in the same commit. I left it
  untracked; adding it is your call.
- The plan recommends **service-layer enforcement with a typed `OrgScope`, composite
  `(org_id, id)` foreign keys, a source-guard test and a real-Postgres isolation suite**,
  not Postgres RLS. The reason: the API connects as the table owner and bypasses RLS, so
  RLS would mean changing the connection model for the whole product. Full reasoning is in
  plan §2.

## What I could NOT verify
- **Visual design of `/colleges` and the band.** I did not render them in a browser. They
  only use existing tokens and classes (`card`, `pill-*`, `bg-navy`, `buttonStyles`).
- Whether the mailto opens sensibly on mobile mail clients.
- **Everything in the plan is untested design.** It needs your review before any
  migration or endpoint is written.

## Verification status
- Web: typecheck, lint, tests (109 files, 4,103 tests) and build all pass locally, with
  `node_modules` matching the lockfile.
- Backend: not touched. It passed in CI anyway.
- CI: see merge status.

## Merge status
- **Campus branch:** `feat/campus-colleges-cta` merges into `develop` only after its CI
  run is green. No migrations in this change.
- **Also fixed and merged today, because it blocked the gate:** `develop` was already red
  at `c984459` on four Shiki tests in `highlight-code.test.ts`. The cause had two parts:
  - Under jsdom, Shiki 4.6's WASM loader calls `Blob.stream()`, which jsdom does not provide.
  - Yesterday's `fix/highlighter-vitest-node-env` moved that test file to Vitest's Node
    environment, which was right. But `vitest.setup.ts` patched `Range` unconditionally,
    Node has no `Range`, so the setup crashed and CI stayed red.

  I added a guard in `vitest.setup.ts`. CI was green on every job (run 43385303787), and
  the branch merged into `develop` at `cfedb51`.
- Production is not affected: a Next build runs in Node, and in plain Node 24 Shiki 4.6.0
  highlights correctly.
- Local tests passed at first only because local `node_modules` had Shiki 4.5.0. I ran
  `npm ci` to match the lockfile.

## Suggested next task
- After you review the plan: modules 1 and 2 (Migration A, the `campus` package, the
  platform-admin and organisation endpoints, the isolation suite, `/admin/campus`), as a
  PR, because it touches permissions.

## Open questions for you
Plan §7 has the full list. These decide module 3:
1. What can a college see: only assigned rounds (my recommendation), or a student's
   personal practice too?
2. A student invited at their college address signs in with Gmail. Allow joining after an
   explicit confirmation (my recommendation), or require the exact invited address?
3. Do the privacy policy and terms get updated for colleges before the first real invite?
   That is a legal and data-protection call.
4. Do MCQ tests have to be in v1? If so, they need a server-held question and answer bank
   (plan 4b).
