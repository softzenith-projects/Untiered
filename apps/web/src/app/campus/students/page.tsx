import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { StudentsPanel } from "@/components/campus/students-panel";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Students", robots: { index: false, follow: false } };

export default function CampusStudentsPage() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Students">
          <StudentsPanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
