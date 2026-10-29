"use client";

import type { Route } from "next";
import Link from "next/link";

import { AccountSummary } from "@/components/account-summary";
import { ActionLink } from "@/components/ui/action-link";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * The right end of the landing page's bar. A signed-in visitor sees who they are signed in
 * as, and the same account menu as the app bar, instead of an offer to start free; a
 * visitor who is not signed in sees the way in.
 */
export function HeaderActions({ cta }: { cta: { href: Route; label: string } }) {
  const token = useAccessToken();

  // Wait for the browser's session check so neither state flashes at the wrong visitor.
  if (token === undefined) return null;

  if (token) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-caption font-semibold text-ink transition-colors hover:bg-surface-sunken sm:inline-flex"
        >
          Dashboard
        </Link>
        <AccountSummary />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken sm:inline-flex"
      >
        Sign in
      </Link>
      <ActionLink href={cta.href} size="sm">
        {cta.label}
      </ActionLink>
    </div>
  );
}
