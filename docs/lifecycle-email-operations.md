# Lifecycle and authentication email operations

Supabase Auth owns registration confirmation, verification, email change, and password-reset links. Configure its custom SMTP transport with SES Sydney; the Kotlin API does not generate or queue those secrets. The API sends opted-in lifecycle mail through the SES v2 SDK. This preserves current signup and recovery contracts. [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) is required for hosted Auth delivery; API AWS credentials do not configure Supabase.

The API queues a welcome after confirmed sign-up, a complete Question of the Day from 09:00 Asia/Kolkata for opted-in candidates, and one practice reminder after 7 and 21 days of inactivity. Admins can schedule announcement or informative messages. `EMAIL_ENABLED=false` is the safe default; queued welcome messages older than two days and daily questions from earlier dates are cancelled instead of sent late.

## Activate on a deployment

1. Apply `20261023000000_lifecycle_email.sql` to the linked Supabase database before deploying code that reads the new tables. The auth trigger creates the user and queues a welcome after email confirmation. It also captures the email sign-up checkbox from Supabase user metadata. Google sign-up applies an explicit checkbox choice after OAuth returns to the app.
2. Apply `20261026000000_ses_delivery_retries.sql` as well. In Supabase Authentication → SMTP, use `email-smtp.ap-southeast-2.amazonaws.com`, port `587`, sender `noreply@untiered.tech`, sender name `Untiered`, and SES **SMTP credentials** for Sydney. These differ from the API AWS keys. Keep confirmation enabled. Copy the committed `supabase/templates/{confirmation,recovery,email_change}.html` into the corresponding **hosted** Supabase Email Templates dashboard settings; `config.toml` applies the same files locally only. Confirm that hosted messages include a plain-text MIME alternative during the controlled mailbox test; the Supabase dashboard only accepts HTML templates. Check the full callback with an account you control. [SES SMTP credentials](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html).
3. Give the **API only** `AWS_REGION=ap-southeast-2`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL=noreply@untiered.tech`, `SES_REPLY_TO_EMAIL=help@untiered.tech`, `EMAIL_PUBLIC_BASE_URL` (web origin), and `EMAIL_API_BASE_URL` (public API origin). Limit IAM to SES sending from the verified identity. Never put keys in Vercel/Next.js settings.
4. Set the same random `EMAIL_CONTENT_TOKEN` on the API and Web deployments. Give the API `EMAIL_DAILY_QUESTION_URL=https://<web-origin>/api/internal/daily-question`. This private route uses the web app's exact Question of the Day selector and never returns the answer.
5. Set Supabase Auth's hosted email quota below the actual SES quota (start at `30/hour`) and signup/recovery IP rate at most `10 requests / 5 minutes`; retain its per-account `60-second` cooldown. Enable Turnstile in both Supabase Auth and Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`). The frontend already passes solved tokens for signup and reset; Supabase must validate them because callers can bypass the UI. [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).
6. Keep `EMAIL_ENABLED=false` until both migrations, web route, domain, SDK credentials, and SMTP settings are live and consent copy is reviewed. Then enable it on the API. The API process must stay running for scheduled jobs.

Neither local checks nor CI sends an email. The API outbox sends off the HTTP path at one message per two seconds **per API instance**. It retries explicit SES throttling and 5xx responses at most three total attempts with exponential backoff and jitter. Permanent and ambiguous failures stop for review. A crash while `sending` becomes `failed` after five minutes; it is never automatically replayed. `sent` means SES accepted the message, not inbox delivery. Query `public.email_deliveries` by row ID/status; logs contain only ID and exception class, not address, content, or credentials. Check SES before manually replaying an ambiguous failure. Plan API replica count against the actual SES send-rate quota.

The existing `untiered-ses-notifications` SNS topic and confirmed `help@untiered.tech` subscription remain the launch bounce/complaint monitor. The owner reports account-level suppression is enabled; verify this in the **Sydney SES console** before activation. Review the mailbox daily and after spikes. Check notification type, SES message ID and suppression status; do not copy addresses or message bodies into logs/tickets. Never replay a permanent bounce. Add a signed, topic-allow-listed SNS webhook only when manual volume is no longer manageable; do not create another SNS topic or subscription for launch.

Live validation needs the owner's explicit approval. Use SES mailbox-simulator recipients or an account the owner controls; confirm MIME rendering, callbacks, quotas, SNS notifications and suppression. No live AWS call or real-recipient send is part of repository verification.

## Schedule platform news

An account on the existing `ADMIN_EMAILS` / `ADMIN_USER_IDS` allow-list can `POST /api/v1/admin/email-campaigns` with its Supabase bearer token:

```json
{
  "category": "announcement",
  "subject": "New practice courses",
  "body": "We added new preparation material. Visit your account to explore it.",
  "scheduledAt": "2026-11-01T09:00:00Z"
}
```

`category` may also be `informative`. The message is sent only to candidates with the news toggle enabled. The API escapes HTML and adds a visit-account button, preference link, and unsubscribe link. Review the final words and recipient policy before scheduling; the API has no campaign draft UI.

## Consent and cadence

- The three marketing choices start off. The signup checkbox opts into all three; candidates can change them individually in Profile → Account → Email preferences.
- A one-click unsubscribe header and public confirmation page turn all three off. The URL contains a random token; a page view alone never unsubscribes, avoiding mail scanner clicks.
- Inactivity is measured from the last authenticated API use. The reminder sequence is one 7-day email and one 21-day email per account, and a login before dispatch cancels a stale reminder.
- The daily email uses the India calendar date at send time. Candidates in other time zones may see a different live question if they open the account on a different local date; the email itself always contains the exact question selected for its dated send.
