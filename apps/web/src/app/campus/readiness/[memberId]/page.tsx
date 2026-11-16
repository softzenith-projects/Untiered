import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { StaffStudentReadiness } from "@/components/campus/staff-student-views";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Student readiness", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  requireCampus();
  const { memberId } = await params;
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Student readiness">
          <StaffStudentReadiness memberId={memberId} />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
