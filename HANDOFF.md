# Handoff — 29 October 2026

## Task
Paid mock interviews through Razorpay (owner, PRD §10). Branch `feat/razorpay-credit-packs`, PR #130.

Owner decisions:
- **28 Oct:** packs of 1 for ₹199, 5 for ₹899 and 10 for ₹1,499. A paid interview is used
  the moment it starts.
- **29 Oct:**
  - 3 free interviews for life, then paid ones.
  - Payment history is kept when an account is deleted.
  - The per-user AI daily cap is raised.

## What I built
- **Credit ledger** (`supabase/migrations/20261028200000_interview_credits.sql`):
  - Append-only; the balance is `sum(delta)`.
  - Each payment grants once, and each session is charged once and refunded once.
  - `payments.user_id` is now `on delete set null`, so payment rows outlive the account,
    detached from it. Unused credits are still deleted with the account.
- **Free tier** (`EntitlementProperties`):
  - 3 free rounds for life, counted when each one starts (one `practice_usage` row each),
    exactly as a paid credit is spent.
  - A round that fails on our side is handed back.
  - The daily allowance (1 round / 60 min) is switched off but kept as a config switch.
- **Entitlement:** free rounds are used first, then one credit. The admit transaction
  locks the candidate's row, so two starts cannot spend the same last credit.
- **Billing API** (`billing/`):
  - The server prices every order.
  - Confirm checks the HMAC signature, then fetches the payment from Razorpay and checks
    it matches the order's id and exact amount (capturing it if it was only authorised).
  - The signed webhook is the fallback when the browser never comes back.
  - Orders carry `notes.product = "untiered"`, so they can be told apart in a Razorpay
    account shared with another product.
- **Per-user AI cap:** raised from $2 to $5 a day.
  - At about $0.085 a round, $5 is about 58 rounds a day.
  - At about $0.34 a round when it falls back to the dearer model, it is about 15.
- **Web:**
  - Pack picker with Razorpay Checkout, shown on the limit notice and on `/upgrade`.
  - The setup form says when a paid interview will be used.
  - The dashboard shows "You have N free interviews left".
  - Landing, terms, privacy, upgrade and account-deletion copy now say "3 mock interviews
    free" and that payment records are kept.

## Assumptions I made
- **"3 free for life" counts rounds started, not completed.** Counting only completed
  rounds would make start-and-leave unlimited free practice now that no daily cap exists.
  It also matches your rule for paid interviews.
- **Rounds from before 8 October 2026 are not counted.** That is when the
  `practice_usage` ledger began, so those older rounds do not use up the 3. Rounds since
  then do: an active candidate may already have none left on deploy.
- **The lifetime gate applies even while buying is switched off.** In that state the
  refusal says "Paid interviews are coming soon". So configure the Razorpay keys (test
  keys on `develop`) when this merges, or candidates past three rounds have no way forward.
- **Kept payment rows hold** the amount, the pack, the dates and the Razorpay
  order/payment ids, and no name or email.
- **A payment that lands after its account was deleted** is marked paid and grants
  nothing. Refund it by hand from the Razorpay dashboard.
- Credits never expire.
- Refund window in the terms: 7 days, unused packs only.

## What I could NOT verify
- **No real or test-mode payment has been made.** Razorpay is mocked at the boundary.
  Do one `rzp_test_` purchase end to end before going live.
- **Whether you need to keep more than this** (for example a customer's name or GSTIN on
  an invoice) is a question for your CA.
- **The live per-user cap is the VM's setting, not the code default.** The VM's
  `deploy/api.env` was copied from an example that sets
  `AI_PER_USER_DAILY_CAP_MICRO_USD=2000000` explicitly, so it very likely still says $2.
  Change it there to `5000000`.
- Visual design of the pack cards and `/upgrade`.

## Verification status
- API `./gradlew ktlintCheck test build`: see the latest commit's CI.
- Web typecheck / lint / test (3,204) / build: pass.

## Merge status
- **PR #130 is open and not merged**, because it touches payments.
- **The migration is not applied.** Run `npm run db:push` as part of the merge.

## Suggested next task
- A test-mode Razorpay purchase end to end, then a purchase-history list on `/profile`.

## Open questions for you
1. Is Clarify run by the same legal entity (Softzenith Softwares Private Limited)? A
   shared Razorpay account only works if it is.
2. GST: are you registered? If so, tax invoices are needed, and Razorpay does not issue
   them for you.
