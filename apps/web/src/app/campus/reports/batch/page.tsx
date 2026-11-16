import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { BatchReport } from "@/components/campus/batch-report";
import { CampusGate } from "@/components/campus/campus-context";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Batch report", robots: { index: false, follow: false } };

export default function CampusBatchReportPage() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Batch report" allowedRoles={["college_admin", "tpo", "faculty"]}>
          <BatchReport />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
