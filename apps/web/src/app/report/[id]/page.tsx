import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { OwnIntegritySection } from "@/components/integrity-summary";
import { ReportView } from "@/components/report-view";
import { campusEnabled } from "@/lib/flags";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Your report" };

/**
 * In the shell like every other page. It used to be a bare page with no way back except
 * reading to the bottom and finding "practise again" — so the only route out of a report
 * was through all of it, which is the opposite of how anybody reads one.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ detail?: string }>;
}) {
  requireFeature("reports");
  const { id } = await params;
  const { detail } = await searchParams;
  return (
    <AppShell>
      {/*
        * Task 053: `max-w-3xl` forced the whole report into one narrow column, including
        * the side-by-side summary at the top. The sheet now fills the shared page grid, so
        * its edges line up with the header's; every prose paragraph inside still wraps at
        * its own `max-w-prose` — widening the sheet does not widen the line length text is
        * actually read at.
        */}
      <div className="flex w-full flex-col gap-6">
        <ReportView sessionId={id} detailed={detail === "1"} />
        {/* Campus module 5: shown only for a round a college assigned (`recorded`). */}
        {campusEnabled() ? <OwnIntegritySection sessionId={id} /> : null}
      </div>
    </AppShell>
  );
}
