import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { ImportPanel } from "@/components/campus/import-panel";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Import students", robots: { index: false, follow: false } };

export default function CampusImportPage() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Import students" allowedRoles={["college_admin", "tpo"]}>
          <ImportPanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
