import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { ProgrammesPanel } from "@/components/campus/programmes-panel";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Programmes", robots: { index: false, follow: false } };

export default function CampusProgrammesPage() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Programmes">
          <ProgrammesPanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
