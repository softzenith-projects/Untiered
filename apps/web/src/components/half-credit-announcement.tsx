"use client";

import type { Route } from "next";
import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * "A 30-minute round now costs half a credit" (owner, 4 November 2026).
 *
 * One announcement, two shapes: a slim bar above the public home page, and a card on the
 * dashboard and the interview setup page. Dismissing it anywhere dismisses it everywhere,
 * and it stops showing on its own after [SHOW_UNTIL], so news does not turn into furniture.
 *
 * The server renders it as not dismissed, so a crawler and a first-time visitor see the
 * same page; the browser then hides it if this visitor already closed it.
 */
const DISMISSED_KEY = "untiered:announcement:half-credit-30min";
const SHOW_UNTIL = new Date("2027-01-01T00:00:00+05:30");

const CHANGED = "untiered:announcement-changed";
/** Remembers a dismissal for this page view even when storage is blocked. */
let dismissedThisView = false;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function hiddenInBrowser(): boolean {
  return readDismissed() || Date.now() >= SHOW_UNTIL.getTime();
}

export function HalfCreditAnnouncement({
  variant,
  onSetupPage = false,
}: {
  variant: "bar" | "card";
  /** On the interview setup page itself, where a link to that page would go nowhere. */
  onSetupPage?: boolean;
}) {
  const hidden = useSyncExternalStore(subscribe, hiddenInBrowser, () => false);

  if (hidden) return null;

  function dismiss() {
    dismissedThisView = true;
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private mode: it comes back next visit, which is harmless.
    }
    // Every copy on the page (and in other tabs, via `storage`) closes together.
    window.dispatchEvent(new Event(CHANGED));
  }

  if (variant === "bar") {
    return (
      <aside
        aria-label="What's new"
        className="relative bg-[linear-gradient(90deg,var(--highlight),color-mix(in_srgb,var(--highlight)_70%,var(--accent)))] text-navy"
      >
        <div className="mx-auto flex layout-content items-center justify-center gap-x-3 gap-y-1 px-12 py-2 text-center text-caption sm:px-14">
          <p>
            <span className="mr-2 rounded-full bg-navy px-2 py-0.5 text-micro font-bold tracking-wider text-on-navy uppercase">
              New
            </span>
            <strong className="font-bold">Short on time? So is your credit.</strong>{" "}
            A 30-minute mock interview now costs just half a credit.{" "}
            <Link href={"/pricing" as Route} className="font-bold whitespace-nowrap underline underline-offset-2">
              See pricing <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
        <DismissButton onClick={dismiss} className="text-navy hover:bg-navy/10" />
      </aside>
    );
  }

  return (
    <aside
      aria-label="What's new"
      className="rise-in relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-highlight/40 bg-[linear-gradient(110deg,var(--warning-wash),var(--accent-wash))] py-5 pr-14 pl-5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:gap-5 sm:pl-6"
    >
      <HalfCoin />
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-warning">New · half-price practice</p>
        <h2 className="mt-1 text-heading font-bold text-balance text-ink">
          Half the credit. All of the follow-up questions.
        </h2>
        <p className="mt-1 text-caption text-ink-muted">
          A 30-minute interview now uses just 0.5 credits: same probing interviewer, same full report, sized for a
          lunch break. 45 and 60-minute rounds still use one.{onSetupPage ? " Pick 30 minutes under Length below." : ""}
        </p>
      </div>
      {onSetupPage ? null : (
      <Link
        href={"/interview/new" as Route}
        className="action-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start sm:self-auto"
      >
        Try a 30-minute round <span aria-hidden="true">→</span>
      </Link>
      )}
      <DismissButton onClick={dismiss} className="text-ink-subtle hover:bg-ink/5 hover:text-ink" />
    </aside>
  );
}

function readDismissed(): boolean {
  if (dismissedThisView) return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function DismissButton({ onClick, className }: { onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss this announcement"
      className={`absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:right-3 ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current" strokeWidth={2}>
        <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** A coin cut in half: the price change, drawn. */
function HalfCoin() {
  return (
    <svg aria-hidden="true" viewBox="0 0 56 56" className="size-14 shrink-0">
      <circle cx="28" cy="28" r="24" className="fill-highlight/25" />
      <path d="M28 4a24 24 0 0 0 0 48z" className="fill-highlight" />
      <circle cx="28" cy="28" r="24" className="fill-none stroke-highlight" strokeWidth={2} />
      <path d="M28 4v48" className="stroke-navy" strokeWidth={2} strokeDasharray="3 3" />
      <text x="16" y="33" textAnchor="middle" fontSize={13} fontWeight={800} className="fill-navy">½</text>
    </svg>
  );
}
