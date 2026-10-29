/**
 * The facts the legal pages state, in one place, so the privacy policy, the terms and the
 * contact page cannot disagree with each other or with the product.
 */
export const LEGAL = {
  productName: "Untiered",
  /** The person or company responsible for the data (the "Data Fiduciary"). */
  operatorName: "Softzenith Softwares Private Limited",
  contactEmail: "help@untiered.tech",
  /** The person designated to handle privacy complaints (owner, 27 October 2026). */
  grievanceOfficer: "Natasha Sharma",
  /** Where the database and stored files live (the linked Supabase project's region). */
  dataRegion: "India (Mumbai, ap-south-1)",
  /** Kept in step with `interviewos.retention.reports-kept-for` on the API. */
  reportRetentionDays: 28,
  /** Kept in step with `EntitlementProperties.freeRounds` on the API (owner, 29 October 2026). */
  freeRounds: 3,
  /** How long after paying an unused pack can be refunded. Needs the owner's sign-off. */
  refundWindowDays: 7,
  lastUpdated: "29 October 2026",
} as const;

export const CONTACT_EMAIL_DISPLAY = LEGAL.contactEmail;

/**
 * The credit packs as the public pricing page states them, for visitors who are not
 * signed in and so cannot read `/api/v1/billing`. Kept in step with
 * `BillingProperties.DEFAULT_PACKS` on the API, which is what is actually charged.
 */
export const CREDIT_PACKS: readonly { credits: number; pricePaise: number }[] = [
  { credits: 1, pricePaise: 19_900 },
  { credits: 5, pricePaise: 89_900 },
  { credits: 10, pricePaise: 1_49_900 },
];

/** "1 mock interview" or "3 mock interviews", so the allowance reads correctly at any setting. */
const freeRounds: number = LEGAL.freeRounds;
export const FREE_ROUNDS_TEXT = `${freeRounds} mock ${freeRounds === 1 ? "interview" : "interviews"}`;

/**
 * The free tier as the terms define it: once per account, for life, never reset (owner,
 * 29 October 2026). Every page that states the allowance says it this way, so "your first
 * 3" cannot be read as 3 a day or 3 a month.
 */
export const FREE_ROUNDS_LIFETIME_TEXT = `${freeRounds} free mock ${freeRounds === 1 ? "interview" : "interviews"} for life`;
