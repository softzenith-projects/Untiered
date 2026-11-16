import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { ReadinessPanel } from "@/components/campus/readiness-panel";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Student readiness", robots: { index: false, follow: false } };

export default function CampusReadinessPage() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Student readiness">
          <ReadinessPanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
