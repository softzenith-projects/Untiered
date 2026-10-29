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

/** "1 mock interview" or "3 mock interviews", so the allowance reads correctly at any setting. */
const freeRounds: number = LEGAL.freeRounds;
export const FREE_ROUNDS_TEXT = `${freeRounds} mock ${freeRounds === 1 ? "interview" : "interviews"}`;
