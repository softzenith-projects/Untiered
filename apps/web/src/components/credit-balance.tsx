"use client";

import type { EntitlementView } from "@untiered/shared";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchEntitlement } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import { formatCreditNumber } from "@/lib/credits";

/**
 * The last allowance this tab read, so the bar does not blink back to nothing on every
 * navigation while it asks again. Memory only, like the account block's profile.
 */
let lastEntitlement: EntitlementView | null = null;

/**
 * Interviews a candidate can still start: the free ones left plus the credits they bought.
 *
 * The server keeps the two apart — the free allowance is spent first, and only then a
 * credit — but to the candidate each is one interview, so the bar shows a single number.
 */
export function interviewsLeft(entitlement: EntitlementView): number {
  return (entitlement.remainingFree ?? 0) + entitlement.creditBalance;
}

const CREDITS_CHANGED = "untiered:credits-changed";

/**
 * Tells the header its balance is out of date. A purchase happens without leaving the
 * page, so the navigation that would otherwise re-read it never comes.
 */
export function announceCreditsChanged(): void {
  window.dispatchEvent(new Event(CREDITS_CHANGED));
}

/**
 * The header's balance and the way to buy more. Read again on each navigation, because
 * starting a round changes it and the bar outlives the page, and again on a purchase.
 */
export function CreditBalance() {
  const accessToken = useAccessToken();
  const pathname = usePathname();
  const [entitlement, setEntitlement] = useState<EntitlementView | null>(() => lastEntitlement);
  const [changes, setChanges] = useState(0);

  useEffect(() => {
    const onChange = () => setChanges((count) => count + 1);
    window.addEventListener(CREDITS_CHANGED, onChange);
    return () => window.removeEventListener(CREDITS_CHANGED, onChange);
  }, []);

  useEffect(() => {
    if (accessToken === null) lastEntitlement = null;
    if (!accessToken) return;
    let active = true;
    fetchEntitlement({ accessToken })
      .then((value) => {
        lastEntitlement = value;
        if (active) setEntitlement(value);
      })
      .catch(() => {
        // The balance is a convenience; the button to buy more works without it.
      });
    return () => {
      active = false;
    };
  }, [accessToken, pathname, changes]);

  const left = entitlement ? interviewsLeft(entitlement) : null;

  return (
    <div className="flex items-center gap-2">
      {left !== null && (
        <span
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 text-caption font-semibold text-ink shadow-[var(--shadow-sm)] ${
            left > 0
              ? "border-highlight/40 bg-gradient-to-r from-warning-wash to-accent-wash"
              : "border-danger/30 bg-danger-wash"
          }`}
          title="Free interviews left plus credits you bought. A free interview is one whole interview; a paid 30-minute one uses half a credit."
        >
          <CreditCoin empty={left === 0} />
          <span className="text-body font-bold tabular-nums">{formatCreditNumber(left)}</span>
          <span className="text-ink-muted">{left === 1 ? "credit" : "credits"}</span>
        </span>
      )}
      <Link
        href={"/upgrade" as Route}
        className="inline-flex min-h-11 items-center rounded-lg bg-accent px-3.5 py-2 text-caption font-semibold text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Buy credits
      </Link>
    </div>
  );
}

/** The balance's badge: warm when there is credit to spend, red when there is none. */
function CreditCoin({ empty }: { empty: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-8 place-items-center rounded-full shadow-[var(--shadow-sm)] ${
        empty ? "bg-danger text-danger-contrast" : "bg-highlight text-navy"
      }`}
    >
      <svg viewBox="0 0 20 20" className="size-4 fill-current">
        <path d="M10 2.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9z" />
      </svg>
    </span>
  );
}
