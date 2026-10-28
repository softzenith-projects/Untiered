import type { BillingOverview, EntitlementView } from "@untiered/shared";

import { CreditPacks } from "@/components/credit-packs";

/**
 * True when the refusal is the free allowance running out, which is what this notice is
 * for. A paid interview in hand never gets here: the server admits the round on it.
 */
export function isDailyLimitReached(entitlement: EntitlementView | null | undefined): boolean {
  return (
    !!entitlement &&
    !entitlement.allowed &&
    (entitlement.reason === "daily_rounds_reached" ||
      entitlement.reason === "daily_minutes_reached" ||
      entitlement.reason === "free_tier_exhausted")
  );
}

/**
 * Shown in place of a start button once the free practice is used.
 *
 * Where interviews can be bought, the packs are right here, and buying one unlocks the
 * start without leaving the page. Where they cannot yet, it says Pro is coming rather than
 * offering a checkout that does not exist. The server's message carries the actual
 * numbers either way, so the page never states an allowance the API did not.
 */
export function DailyLimitNotice({
  entitlement,
  onPurchased,
}: {
  entitlement: EntitlementView;
  onPurchased?: (overview: BillingOverview) => void;
}) {
  const heading =
    entitlement.reason === "free_tier_exhausted" ? "Your free interviews are used" : "Today’s free practice is used";
  return (
    <section
      aria-labelledby="daily-limit-heading"
      className="flex flex-col gap-3 rounded-2xl border border-highlight/40 bg-highlight/10 p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="daily-limit-heading" className="text-heading text-ink">
          {heading}
        </h2>
        {entitlement.purchasable ? null : (
          <span className="pill w-fit rounded-full border border-accent/25 bg-accent-wash px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase">
            Pro · coming soon
          </span>
        )}
      </div>
      <p className="max-w-prose text-body text-ink-muted">{entitlement.message}</p>
      {entitlement.purchasable ? (
        <CreditPacks compact onPurchased={onPurchased} />
      ) : (
        <p className="max-w-prose text-caption text-ink-subtle">
          Until then, the courses and the Arena are open with no daily limit.
        </p>
      )}
    </section>
  );
}
