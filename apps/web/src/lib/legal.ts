/**
 * The facts the legal pages state, in one place, so the privacy policy, the terms and the
 * contact page cannot disagree with each other or with the product.
 */
export const LEGAL = {
  productName: "Untiered",
  /** The person or company responsible for the data (the "Data Fiduciary"). */
  operatorName: "Softzenith Softwares Private Limited",
  contactEmail: "help@untiered.tech",
  /** Where the database and stored files live (the linked Supabase project's region). */
  dataRegion: "India (Mumbai, ap-south-1)",
  /** Kept in step with `interviewos.retention.reports-kept-for` on the API. */
  reportRetentionDays: 28,
  /** Kept in step with `EntitlementProperties` on the API (owner, 27 October 2026). */
  dailyRounds: 1,
  dailyMinutes: 60,
  lastUpdated: "27 October 2026",
} as const;

export const CONTACT_EMAIL_DISPLAY = LEGAL.contactEmail;

/** "1 round" or "2 rounds", so the allowance reads correctly at any setting. */
export const DAILY_ROUNDS_TEXT = `${LEGAL.dailyRounds} ${LEGAL.dailyRounds === 1 ? "round" : "rounds"}`;
