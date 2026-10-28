# Handoff — 28 October 2026

## Task
Paid mock interviews through Razorpay: interview credits sold as 1 for ₹199, 5 for ₹899,
10 for ₹1,499; a credit is used up the moment a round starts (owner request, PRD §10).
Branch `feat/razorpay-credit-packs`.

## What I built
- **Credit ledger**: `supabase/migrations/20261028200000_interview_credits.sql`. It is
  append-only, the balance is `sum(delta)`, and partial unique indexes make sure each
  payment grants once and each session is charged once and refunded once. It also adds
  `credits` and `paid_at` to the existing `payments` table.
- **Entitlement** (`interview/Entitlement.kt`): free allowance first, then one credit
  (`Funding.FREE | CREDIT`). The admit transaction locks the candidate's row
  (`for no key update`), so two starts cannot spend the same last credit.
- **Refunds**: `failSessionAndRefundUsage` now also returns the credit when a paid round
  ends `failed` (our fault), in the same SQL statement as the status change. Abandoning a
  round keeps the charge.
- **Billing API** (`billing/`), with all prices set on the server:
  - `GET /api/v1/billing` returns the packs and the caller's balance.
  - `POST /api/v1/billing/orders` creates the Razorpay order.
  - `POST /api/v1/billing/orders/{id}/confirm` checks the HMAC signature, then fetches the
    payment from Razorpay, checks it matches the order id and exact amount, and captures
    it if it is only authorised. Only then does it grant the credits.
  - `POST /api/v1/billing/razorpay/webhook` is unauthenticated and signature-checked. It
    grants on `payment.captured` / `order.paid` when the browser never came back.
- **Web**:
  - `credit-packs.tsx` loads Razorpay Checkout lazily (`lib/razorpay-checkout.ts`).
  - The free-practice notice shows the packs when buying is open. After a purchase the
    page re-reads the allowance and the setup form unlocks.
  - Holding a credit lifts the free-minutes cap on round length, and the Begin button
    says when a paid interview will be used.
  - `/upgrade` shows the packs and the balance (`premium-offer.tsx`).
- **Legal copy**: terms have a new "Paid interviews and refunds" section, the privacy
  policy lists Razorpay as a processor, and account deletion warns that unused paid
  interviews are lost.
- **Off by default**: buying stays off until `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
  are set. Until then the product behaves exactly as it does today ("Pro · coming soon").

## Assumptions I made
- **"Pay ₹199 per interview" and "1-interview pack" are the same product.** Buying one
  credit unlocks the start screen right away, and the credit is spent when the round
  starts. I did not build a separate entitlement type for it.
- **Free practice is spent before credits.** A buyer never pays for a round the free
  allowance would have covered. The daily free allowance (1 round / 60 min) is unchanged.
- **A credit comes back automatically only on `failed`** (our fault: AI unavailable or
  setup crash). Leaving a round does not refund it.
- **Credits never expire.** Deleting the account deletes them.
- **Paid rounds do not write `practice_usage`.** A paid round leaves today's free
  allowance untouched.
- Refund window in the terms: 7 days, unused packs only (`LEGAL.refundWindowDays`).

## What I could NOT verify
- **No real payment has been made.** Rule 7: no live spend, and there are no Razorpay
  keys. Order creation, capture and the webhook are tested with Razorpay mocked at the
  boundary. A test-mode purchase (`rzp_test_` keys, card 4111 1111 1111 1111) end to end
  is needed before live keys.
- Visual design of the pack cards and the reworked `/upgrade` layout.

## Verification status
- API `./gradlew ktlintCheck test build`: pass.
- Web typecheck / lint / test (3,203) / build: pass.
- CI on PR #130: every job green, including `database`, which ran
  `CreditLedgerDatabaseIntegrationTest` against every migration applied.

## Merge status
- **PR opened, not merged**, because it touches payments, which CLAUDE.md lists as a
  human-review area.
- **The migration is not applied.** Run `npm run db:push` as part of the merge, or the
  entitlement query will fail on the missing table.
- Size is about 2,300 lines, of which about 800 are tests. It is over the 800-line
  guideline, but the API, ledger and UI only make sense together.

## Suggested next task
- A test-mode Razorpay purchase end to end, then a purchase-history list on `/profile`.

## Open questions for you
1. **Is the free tier too generous to sell packs?** One free 60-minute round every day
   leaves little reason to pay ₹199 unless someone practises more than once a day. To make
   the packs sell, consider either of these (one config value each, no code change):
   - `interviewos.entitlement.free-rounds: 1`: one free interview for life.
   - `daily-minutes: 20`: a short free round each day, with paid full-length rounds.
2. **The per-user AI spend cap ($2/day) also applies to paying users.** It returns
   "Try again tomorrow" before the credit is touched, so nobody loses money. But a heavy
   buyer could hit it. Should paid rounds raise or bypass it?
3. **GST and invoices.** Prices are shown as tax-inclusive. If you are GST-registered you
   need tax invoices, which Razorpay does not issue for you.
4. **Account deletion cascade-deletes `payments`.** Tax law may require keeping payment
   records. Decide whether to keep an anonymised payment row instead.
5. **Razorpay dashboard settings:**
   - Webhook URL `<api>/api/v1/billing/razorpay/webhook`, with events `payment.captured`,
     `order.paid` and `payment.failed`.
   - Confirm the terms and refund wording, which Razorpay checks during KYC.
