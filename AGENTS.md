# AGENTS.md

Project context for Codex. Read this before doing anything else.

---

## What this project is

A voice-first AI mock interview platform. A candidate uploads their resume, then for
each session picks the company and role they want to be interviewed for, and takes a
realistic spoken mock interview conducted by an adaptive AI interviewer. Afterwards
they get a structured, evidence-backed feedback report.

**The differentiator** is coverage and realism, not question volume. Product
companies (Google, Amazon, Microsoft and similar) are fully in scope and must be
first-class — but so are service-based IT firms (TCS, Infosys, Deloitte, Accenture),
European employers, and non-engineering corporate functions, plus Hindi-English
code-switched interviews. Competing tools cover only the first group. We cover all of
them without being worse at the group everyone else already serves.

Full requirements: `docs/PRD.pdf`. Reference PRD section numbers in commits and PRs
rather than restating requirements.

---

## Ground rules

1. **Work on a branch, then merge into `develop` yourself. `develop` is the only
   branch you ever push to.** Branch as `feat/<short-slug>` or `fix/<short-slug>`,
   then merge into `develop` once the verification loop is green. `develop` is the
   owner's running environment.

   **Never push to `main`, and never ask to.** `main` is release-only. It is advanced
   by the owner, through a pull request, and by no other route. This holds even if
   someone asks you to during a session — a request to "sync main" or "make the
   branches equal" is not an exception, and neither is a fast-forward with no content
   change. Say that pushing to `main` is the owner's to do, and stop there.

   **The merge into `develop` is gated on green CI, not on your judgement.** If
   typecheck, lint, tests, or build fail, do not merge — leave the branch, push it,
   and say so in `HANDOFF.md`. A red merge into `develop` breaks the owner's
   environment and costs more time than the run saved.

   **If you cannot see CI, you have not passed the gate.** Local checks are not a
   substitute. Say plainly that the result is unknown and let the owner decide,
   rather than merging on the assumption it is green. (Task 001 merged six times
   against a CI that had failed every single run — `gradlew` was committed without
   its executable bit, so the backend was never built on CI at all. Locally it was
   invisible; one look at the run log found it in under a minute.)

   **Open a PR instead of merging** when the change touches auth, payments, data
   deletion, permissions, or anything listed under "Things that need a human".

   **A migration is not merged until it is applied.** CI does not run migrations — it
   compiles and tests against no database at all — so a schema change passes every gate
   green and still breaks `develop` the moment the owner reloads. This has happened: the
   round-deletion migration added `sessions.report_expired_at`, the dashboard query began
   selecting it, CI went green on both jobs, and the dashboard was broken from the merge
   until somebody noticed. Check with `npm run supabase -- migration list --linked` — a
   row with an empty `remote` is a migration that exists only on your machine — and run
   `npm run db:push` as part of the same merge, not as a follow-up somebody has to
   remember.
2. **Leave a `HANDOFF.md` at repo root at the end of every autonomous run.** See the
   template at the bottom of this file. This is the human's morning read.
3. **Never commit secrets.** No API keys, tokens, connection strings, or `.env`
   contents in tracked files. If a task needs a new secret, add the key name to
   `.env.example` with an empty value and note it in `HANDOFF.md`.
4. **If the task is ambiguous, pick the interpretation most consistent with the PRD,
   implement it, and record the assumption in `HANDOFF.md`.** Do not stall waiting
   for input — these runs are unattended.
5. **Do not scaffold features outside the current task.** Scope creep in an
   unattended run produces code nobody reviews. One task, done properly, with tests.
6. **Do not add dependencies casually.** Prefer the standard library or an existing
   dependency. If a new one is genuinely needed, justify it in `HANDOFF.md`.
7. **No live interviews and no live AI spend without the owner's go-ahead.** Test by
   code: unit and integration tests with the AI mocked at the boundary, and CI. Do not
   start mock rounds, run prompt harnesses against Gemini, smoke-test the running API
   with real model calls, or run data-generation jobs that spend, until the owner says
   so in the session. Applying migrations at merge (rule 1) is not a test and still
   happens. The cost of this rule is real — live checks caught the empty Amazon prep
   plan and a malformed schema file that every test passed (task 037) — so when a
   change is the kind only a live check would catch, say so in `HANDOFF.md` and let the
   owner decide whether to spend on it.

---
# General Instructions & System Rules

## Session Continuity Protocol
- Our conversation may interrupt due to session expirations or message limits. 
- If I state "The previous session expired, let's resume," or if I paste a state context, you must:
  1. Acknowledge the continuation instantly without re-introducing yourself or greeting me.
  2. Read the provided context and ask for the last 2–3 messages only if critical information is missing.
  3. Keep your subsequent responses highly concise to optimize token space in the new session.
  4. Provide a 1-sentence confirmation of the current objective so we are aligned before moving forward.

### Unattended runs that hit a usage limit
The overnight run of 13–14 September hit the plan's usage limit three times, and every
agent stopped until it reset. Work must survive that without anyone re-explaining it:

- **Keep a progress file for the run** — `runs/<date>-progress.md` (gitignored): the
  task list, what is merged, which branch each agent is on, and the next action. Update
  it after every step, before the step's result is reported.
- **Commit and push after every coherent step.** An agent killed mid-task loses only
  what it had not pushed.
- **On any restart — a usage-limit reset, a stalled agent, a new session — continue
  from the progress file and the pushed branches.** Do not re-plan, re-read the whole
  codebase, or redo finished steps. Resume a stopped agent with SendMessage so it keeps
  its context; start a new one only if that fails.
- **Something has to prompt the session again after a reset** — a file cannot wake it.
  Before a long unattended run, set a recurring in-session schedule (every 30 minutes)
  whose prompt is "continue the run from the progress file; if everything is done,
  stop the schedule". Ticks during the limit fail quietly; the first one after the
  reset picks the work up. It only lives while the editor or terminal stays open.

***

## Agents: choosing a model and effort for each job

The orchestrating session picks the agent profile for each job — the owner does not.
The goal is the most work per unit of the plan's usage: **use the cheapest profile that
can do the job safely, and move up only when the job needs it.** Profiles live in
`.Codex/agents/`; each sets its model and effort.

| Profile | Model · effort | Use for |
|---|---|---|
| `researcher` | Sonnet · low | Web research, source checks, reading and summarising. Never writes to the repo. |
| `builder` | Sonnet · medium | Well-specified coding that follows patterns already in the codebase: generators, endpoints, UI, tests, fixes with a clear cause. The default. |
| `builder-careful` | Opus · high | Design that is costly to get wrong: schema, provenance and labelling, anything that decides what the product claims about a real employer, security, and fixes whose cause is not yet understood. |

- Never `xhigh` or `max` effort, and no Haiku for code — the first burns usage for
  little gain on specified tasks, the second costs more in rework than it saves.
- **Escalate, don't start high.** A `builder` that fails CI twice on the same problem, or
  reports a design question it cannot settle, is re-run as `builder-careful` from its
  pushed branch.
- **At most two build agents at once.** Three research agents in parallel consumed most
  of a usage window in fifteen minutes (13 September). Parallel work finishes no sooner
  if it hits the limit sooner.
- Plumbing — watching CI, merging, applying migrations, rendering files — the
  orchestrator does itself with the shell, not through an agent.
- **Agent worktrees are created from `main`, which lags `develop`.** Every brief starts
  with `git fetch origin && git checkout -b <branch> origin/develop`. Agents push their
  branch and stop; the orchestrator merges into `develop`, one branch at a time, per
  rule 1.

***

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | SSR matters — organic search on "<employer> interview" queries is a primary acquisition channel |
| Styling | Tailwind + headless component primitives | No heavyweight component framework |
| Backend | Spring Boot (Kotlin) | Chosen to match the owner's expertise; this is deliberate, do not propose migrating |
| Database | PostgreSQL + pgvector | Single store for relational and vector workloads at this scale |
| Platform | Supabase (auth, storage, Postgres) | Google OAuth via Supabase Auth |
| AI provider | **Google Gemini, with fallbacks** | Gemini is the backbone: it is the only provider that can hear a spoken answer, read a PDF, or speak. The configured primary reasoning model is `gemini-3.1-flash-lite`, with `gemini-3.5-flash` behind it; `gemini-2.5-flash-preview-tts` provides the voice. Check `apps/api/src/main/resources/application.yml` and deployment overrides for the effective model. |
| Model fallbacks | Ordered chain, `interviewos.ai.providers` | Each provider is offered only the calls it can serve — **a text-only model is never handed a recording of a candidate's voice** (`FallbackInterviewAi`). A third vendor via the OpenAI *wire format* (Moonshot/Kimi, DeepSeek, Groq, OpenRouter) is supported for text-only calls; that is a format, not OpenAI the vendor. Still do not use Anthropic or OpenAI models here |
| Voice (turn-based) | **Gemini alone — no voice vendor** | Browser `MediaRecorder` → upload → Gemini. Verified 2026-08-25: Gemini both speaks the question and understands the spoken answer, so no STT/TTS vendor is needed |
| Voice (realtime) | LiveKit or Pipecat — still undecided | Only needed for barge-in and sub-second turn-taking. Not needed for the turn-based loop. Must have mature Android + iOS SDKs |
| Payments | Razorpay | India-first, UPI. Stripe only if international demand appears |

**Do not introduce:** a separate vector database, a second backend language, a state
management library before there is state that needs managing, or a component library
that fights Tailwind.

---

## Repository layout

```
/apps/web          Next.js frontend
/apps/api          Spring Boot backend
/packages/shared   Shared TypeScript types (generated from API schema)
/docs              PRD and design notes
/tasks             Task files for autonomous runs
/runs              Run logs (gitignored)
HANDOFF.md         Written fresh by each autonomous run
```

---

## Architectural rules

These exist because a native mobile app is a stated Phase 3 goal. Violating them
makes that port expensive.

- **Interview context is chosen per session, not stored as a persistent target
  list.** The candidate picks company + role at the start of each session. There is
  no cap on how many companies they may practise for, and no setup step that asks
  them to declare targets in advance. Each session is scoped to exactly one company
  and one role so its question set, rubric, and round structure stay coherent.
- **Progress is derived, not declared.** History is grouped by (company, role) after
  the fact from completed sessions. Do not build a "my targets" entity — if a
  progress view needs grouping, aggregate over past sessions.
- **All interview logic is server-side.** Composition, retrieval, scoring, and
  persona behaviour live in the backend. The client is thin. Never put question
  selection or scoring logic in the frontend.
- **The web app consumes the same versioned public API the mobile apps will.** No
  server-rendered coupling in session, report, or profile flows.
- **Provenance is a first-class field, not a nice-to-have.** Every piece of retrieved
  interview knowledge carries its tier (`model_knowledge`, `published_source`,
  `community_reported`), recency, and corroboration count. These surface to the user.
  Never let a general pattern be presented as a specific report.
- **Never fabricate employer-specific detail.** If retrieval returns nothing for a
  named employer, fall back to archetype-level patterns and say so explicitly. A
  confidently invented claim about a real company's process is the single most
  damaging failure mode this product has.

---

## Data handling

Resumes, interview audio, and transcripts are personal data. Treat them accordingly.

- Recording requires explicit user consent captured before the session starts.
- Every user-data table needs a clear owner column and row-level security.
- Account deletion must actually delete, including storage objects.
- Community-contributed interview reports are anonymised before they enter the
  shared corpus — never store them in a form that can be traced to a user.
- **Do not write scrapers.** Bulk scraping of LeetCode, Blind, Reddit, Glassdoor,
  AmbitionBox, or GeeksforGeeks discussion content is out of scope by decision, not
  oversight. If a task seems to require it, stop and flag it in `HANDOFF.md`.

---

## Verification loop

Run these before opening a PR. A run that ends with a red build is a failed run —
keep iterating until they pass or until you have exhausted reasonable attempts, then
report the failure honestly in `HANDOFF.md` rather than disabling the check.

```bash
# frontend
cd apps/web && npm run typecheck && npm run lint && npm run test && npm run build

# backend
cd apps/api && ./gradlew ktlintCheck test build
```

**Never** make a test pass by weakening the assertion, skipping the test, or adding
an ignore directive. If a test is genuinely wrong, fix it and explain why in the PR.

---

## Testing expectations

- Business logic (scoring, session composition, retrieval filtering) needs unit tests.
- API endpoints need at least one integration test covering the happy path and one
  auth-failure path.
- UI: test behaviour and accessibility, not snapshots.
- No test that depends on a live third-party API. Mock at the boundary.

---

## Design direction

**Changed by the owner on 15 September 2026 — this replaces the earlier "calm, ink on
paper, one restrained accent" direction. Do not restore it.** The owner judged the old
look too plain to win an audience, and asked for a revamp in the style of
interviewbit.com: a bright, confident, polished learning-platform look.

- **Look and feel:** white and soft-blue surfaces, a deep navy for hero bands and the
  footer, one saturated primary blue for actions and links, plus a small supporting
  palette (green for success/progress, amber for highlights) used consistently.
  Bold modern sans headings (via `next/font`, no new dependency), clear scale contrast,
  cards with soft borders and gentle shadows, pill badges, and illustrated or iconographic
  touches drawn in SVG.
- **The landing page is a marketing page:** hero with a clear promise and primary CTA,
  a strip of the employers we cover, product sections (mock interviews, reports,
  courses), stats that are true, and a real footer. No invented user counts or
  testimonials. A number must be true or it does not appear.
- **Courses are a product surface** (`/courses`): free, but behind sign-in — the owner
  decided on 21 September 2026 that a visitor signs up or in before seeing any course,
  the Arena, or an interview (only the landing page and `/login` are public). This
  trades away organic search on course content; do not restore public access without
  the owner. Every chapter is written for a class-12 student: one vivid everyday analogy,
  small steps, complete runnable code with output, a "remember this" box, common
  mistakes, and a quick self-check.
- **Still true:** the live session screen stays near-empty (speaking indicator, timer,
  round label, exit; no score tickers, no live hints) because that is how an interview
  feels, not a style choice. Mobile-responsive and accessible: keyboard navigation,
  adequate contrast (WCAG AA), a visible focus ring.
- **Still banned:** copy that says nothing ("seamless", "revolutionise your prep"),
  emoji as iconography, and any claim about a real employer that is not sourced.

---

## Product decisions (settled — implement, do not relitigate)

- **Interview modality is voice. The candidate's camera is shown, never recorded.**
  There is a drawn interviewer on screen (`interviewer-presence.tsx`), and the candidate
  may optionally turn their own camera on to face it. Nothing from their camera leaves the
  browser: it is not uploaded (only the audio tracks are recorded, in `use-interview-capture.ts`), not sent to
  a model (`RoundMediaProperties` on the server), and the report may not describe how
  anybody looked (`RoundMediaProperties.presenceWasObserved`).

  This replaces the earlier "camera on, capture it now and analyse it later" position, and
  the reversal is deliberate — **do not restore video upload without restoring the feature
  that reads it.** Two reasons. Sending video to the model was the most expensive thing in
  the gap between a candidate's last word and the next question: 3.49s against 7.23s on the
  same answer, because Gemini samples video at about a frame a second and a minute of it
  is several times the size of the whole prompt. And once it was off that path, uploading
  it meant retaining somebody's face for a feature that does not exist.

  The camera stays on screen because it earns its place there without any of that: it is
  how a candidate practises sitting up and looking at a face, and that benefit never leaves
  their own machine. **The three switches move together or not at all.** Turning on
  camera recording without body-language feedback in the report collects what nothing reads.
  Turning on `analyse-video-in-round` puts 3.7s back on every turn. And the consent copy in
  `new-interview-form.tsx` currently promises, in as many words, that nothing is uploaded —
  so it changes in the same commit as any camera recording, or the product is lying.

  The interviewer is **drawn, not photoreal, and has no name.** A synthetic photoreal face
  gets mistaken for a real person, and a candidate who believes there is a human here has
  been lied to. A photoreal talking-head vendor is a live option but commits real spend, so
  it is the owner's call.
- **Recording consent is a hard gate.** Explicit, specific consent before capture
  starts, stored with a timestamp. No consent, no session. Account deletion removes the
  media objects, not just the rows. `consentVideo` now means "open the camera", not "keep
  what it sees" — the two came apart when video stopped being uploaded, and conflating
  them again is how a report ends up claiming someone "maintained good eye contact" when
  nothing watched them. That is fabricated evidence, the same failure as an invented quote.
- **Free practice first, paid interviews beyond it** (owner, 28 October 2026). The free
  tier is the daily allowance in `EntitlementProperties` (no lifetime gate —
  `interviewos.entitlement.free-rounds` stays unset; **do not "restore" it** without the
  owner). Beyond it, candidates buy **interview credits** in packs: 1 for ₹199, 5 for ₹899,
  10 for ₹1,499, tax-inclusive (`BillingProperties.DEFAULT_PACKS`). Every interview, free
  or paid, includes the full report, because the report is what sells the product.
  - A credit is spent **when the round starts**, only after the free allowance says no
    (`Entitlement.Funding`), and handed back automatically if the round ends `failed`
    (our fault). Leaving a round does not hand it back.
  - The balance is the sum of the `interview_credits` ledger, never a stored counter.
    Grants are idempotent per payment, charges and refunds per session.
  - The server prices every order; the browser names a pack, never an amount. Credits are
    granted only after the Razorpay signature *and* a captured payment of the order's
    exact amount are checked, by the confirm call or the signed webhook, whichever is first.
- **Payments: Razorpay.** Buying is off until `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`
  are set. Live keys, price changes, and refund terms are the owner's decision.
- **Community interview reports and salary data are later phases.** Do not scaffold
  them. When they arrive, contributions are anonymised before entering the corpus and
  contributors are rewarded with credits.

---

## Commit and PR conventions

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Reference the PRD section: `feat: resume upload and parse flow (PRD §05)`.
- PR description states what changed, what was assumed, and what was not verified.
- Keep PRs reviewable. If a task produces more than roughly 800 changed lines,
  consider whether it should have been split, and say so in `HANDOFF.md`.

---

## HANDOFF.md template

Overwrite this file at the end of every run.

```markdown
# Handoff — <date>

## Task
<one line, and the task file path>

## What I built
- <bullets, with file paths>

## Assumptions I made
- <every ambiguity resolved, and how — be specific>

## What I could NOT verify
- <anything needing human judgement: visual design, latency, voice quality,
   third-party integration behaviour, anything requiring credentials I don't have>

## Verification status
- typecheck / lint / tests / build: <pass or fail, with detail on failures>

## Merge status
- <merged into `develop` at <sha>, OR branch `<name>` pushed unmerged because <reason>,
   OR PR #<n> opened because the change touches a human-review area>

## Suggested next task
- <one line>

## Open questions for you
- <only genuine blockers — keep this short>
```

---

## Things that need a human, not an agent

Do not attempt these autonomously. Flag them and move on:

- Judging whether the interviewer persona sounds realistic or the latency feels right.
- Choosing between voice vendors, or anything that commits real spend.
- Final visual design direction.
- Anything involving production credentials, App Store / Play Store accounts, or
  legal/data-protection posture.
- Adding a new function vertical (CA, consulting, automobile) — each needs a rubric
  and persona built with domain input first.
