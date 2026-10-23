# Lifecycle email operations

The API queues a welcome after confirmed sign-up, a complete Question of the Day from 09:00 Asia/Kolkata for opted-in candidates, and one practice reminder after 7 and 21 days of inactivity. Admins can schedule announcement or informative messages. `EMAIL_ENABLED=false` is the safe default; queued welcome messages older than two days and daily questions from earlier dates are cancelled instead of sent late.

## Activate on a deployment

1. Apply `20261023000000_lifecycle_email.sql` to the linked Supabase database before deploying code that reads the new tables. The auth trigger creates the user and queues a welcome after email confirmation. It also captures the email sign-up checkbox from Supabase user metadata. Google sign-up applies an explicit checkbox choice after OAuth returns to the app.
2. In the chosen [Amazon SES region](https://docs.aws.amazon.com/ses/latest/dg/regions.html), verify the sending domain/address, configure DKIM, obtain [region-specific SMTP credentials](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html), and request [production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html). SMTP credentials are distinct from normal AWS access keys.
3. Give the **API** `MAIL_HOST` for that SES region, `MAIL_PORT=587`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_PUBLIC_BASE_URL` (web origin), and `EMAIL_API_BASE_URL` (public API origin). The API uses STARTTLS.
4. Set the same random `EMAIL_CONTENT_TOKEN` on the API and Web deployments. Give the API `EMAIL_DAILY_QUESTION_URL=https://<web-origin>/api/internal/daily-question`. This private route uses the web app's exact Question of the Day selector and never returns the answer.
5. Keep `EMAIL_ENABLED=false` until the schema, web route, domain and SMTP settings are live and a human has reviewed consent copy and sender identity. Then enable it on the API. The API process must stay running for scheduled jobs.

Neither local checks nor CI sends an email. SMTP outcomes, inbox rendering, SES quotas, bounce handling, and legal copy need a production-owner check before enabling. A failed/ambiguous SMTP attempt is marked `failed` for manual review and is **not** automatically retried, to avoid duplicate sends.

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
