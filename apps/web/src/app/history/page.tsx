import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { RoundHistoryPanel } from "@/components/dashboard-panel";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Your rounds" };

/**
 * Every past round. The dashboard lists only the latest few; this is the full history,
 * grouped by nothing — readiness by company and role stays on the dashboard (PRD 05).
 */
export default function HistoryPage() {
  requireFeature("reports");
  return (
    <AppShell breadcrumb="all rounds">
      <div className="flex w-full flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-display text-balance text-ink">Your rounds</h1>
          <p className="max-w-prose text-body text-ink-muted">
            Every interview you have taken, newest first. Open a report, or delete a round and
            everything recorded in it.
          </p>
        </header>
        <RoundHistoryPanel />
      </div>
    </AppShell>
  );
}
