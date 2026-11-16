import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { StaffMcqAttempt } from "@/components/campus/mcq-test";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Student test", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ memberId: string; attemptId: string }> }) {
  requireCampus();
  const { memberId, attemptId } = await params;
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Student test">
          <StaffMcqAttempt memberId={memberId} attemptId={attemptId} />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
