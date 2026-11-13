import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { MyLeaderboard } from "@/components/campus/my-leaderboard";
import { MyReadiness } from "@/components/campus/my-readiness";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Your readiness", robots: { index: false, follow: false } };

/** A student's own readiness. Not behind the staff gate: it is every joined student's page. */
export default function CampusMePage() {
  requireCampus();
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-display text-ink">Your readiness</h1>
        <MyReadiness />
        <MyLeaderboard />
      </div>
    </AppShell>
  );
}
