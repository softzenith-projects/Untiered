import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { StructurePanel } from "@/components/campus/structure-panel";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Departments and batches", robots: { index: false, follow: false } };

export default function CampusStructurePage() {
  requireCampus();
  return (
    <AppShell>
      {/* `CampusGate` reads the `?org=` search param, which needs a Suspense boundary. */}
      <Suspense>
        <CampusGate title="Departments and batches" allowedRoles={["college_admin", "tpo"]}>
          <StructurePanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
