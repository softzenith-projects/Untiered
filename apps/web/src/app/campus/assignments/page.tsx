import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { AssignmentsPanel } from "@/components/campus/assignments-panel";
import { CampusGate } from "@/components/campus/campus-context";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Assignments", robots: { index: false, follow: false } };

export default function Page() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Assignments">
          <AssignmentsPanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
