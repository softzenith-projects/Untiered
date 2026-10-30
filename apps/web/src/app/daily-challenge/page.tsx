import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DashboardQuestionOfDay } from "@/components/dashboard-question-of-day";
import { dailyQuestionsByDate } from "@/lib/arena/daily-question";
import { requireFeature } from "@/lib/require-feature";
import { NOINDEX_FOLLOW } from "@/lib/seo";

export const metadata: Metadata = { title: "Today's challenge", robots: NOINDEX_FOLLOW };
export const dynamic = "force-dynamic";

export default function DailyChallengePage() {
  requireFeature("arena");
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <Link href="/courses" className="inline-flex min-h-11 items-center text-caption font-semibold text-ink-muted transition-colors hover:text-accent">← Back to courses</Link>
        <div className="mt-5">
          <DashboardQuestionOfDay questionsByDate={dailyQuestionsByDate()} focused />
        </div>
      </div>
    </AppShell>
  );
}
