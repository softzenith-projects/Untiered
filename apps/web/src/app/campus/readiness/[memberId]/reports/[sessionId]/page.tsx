import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { StaffStudentReport } from "@/components/campus/staff-student-views";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Student report", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ memberId: string; sessionId: string }> }) {
  requireCampus();
  const { memberId, sessionId } = await params;
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Student report">
          <StaffStudentReport memberId={memberId} sessionId={sessionId} />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
