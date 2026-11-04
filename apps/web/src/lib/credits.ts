/**
 * Credit arithmetic for display only. The server prices every round (`RoundLength` in the
 * API) and charges the ledger; this file only says it back to the candidate.
 *
 * A 30-minute round costs half a credit, a 45- or 60-minute round one (owner, 4 November
 * 2026). A balance can therefore hold a half: 2.5 credits.
 */

/** Rounds up to this long cost half a credit. Mirrors `RoundLength.HALF_CREDIT_UP_TO_MINUTES`. */
export const HALF_CREDIT_UP_TO_MINUTES = 30;

/** What a paid round of this length costs, in credits. */
export function creditCostFor(minutes: number): number {
  return minutes <= HALF_CREDIT_UP_TO_MINUTES ? 0.5 : 1;
}

/** "half a credit", "1 credit", "1.5 credits", "5 credits". */
export function formatCredits(credits: number): string {
  if (credits === 0.5) return "half a credit";
  if (credits === 1) return "1 credit";
  return `${formatCreditNumber(credits)} credits`;
}

/** 2.5 as "2.5" and 3 as "3" — never "3.0", never a long float. */
export function formatCreditNumber(credits: number): string {
  return Number.isInteger(credits) ? String(credits) : credits.toFixed(1);
}
