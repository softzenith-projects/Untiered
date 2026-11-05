import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ContinueLearning } from "@/components/continue-learning";
import { DashboardPanel } from "@/components/dashboard-panel";
import { DashboardQuestionOfDay } from "@/components/dashboard-question-of-day";
import { HalfCreditAnnouncement } from "@/components/half-credit-announcement";
import { dailyQuestionsByDate } from "@/lib/arena/daily-question";
import { getCourseOutlines } from "@/lib/course-outline";
import { featureEnabled } from "@/lib/flags";

export const metadata: Metadata = { title: "Home" };

// The daily question map covers every local date that exists worldwide at request time.
// Rendering per request keeps it current after midnight without shipping the full Arena
// corpus to the browser or depending on a daily deployment.
export const dynamic = "force-dynamic";

/**
 * The dashboard keeps the next interview as its primary action, then the course in
 * progress, then one bounded daily recall question, collapsed until asked for. Company and role are named at the point of starting a
 * session — there is no target list to configure, by design (PRD 05).
 */
export default function DashboardPage() {
  const arenaEnabled = featureEnabled("arena");
  const mockInterviewsEnabled = featureEnabled("mockInterviews");
  const questionsByDate = arenaEnabled ? dailyQuestionsByDate() : {};

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        {mockInterviewsEnabled ? <HalfCreditAnnouncement variant="card" /> : null}
        <DashboardPanel />
        <ContinueLearning outlines={getCourseOutlines()} />
        {arenaEnabled ? <DashboardQuestionOfDay questionsByDate={questionsByDate} /> : null}
      </div>
    </AppShell>
  );
}
