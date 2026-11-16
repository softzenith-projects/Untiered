import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { StaffPanel } from "@/components/campus/staff-panel";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };

export default function CampusStaffPage() {
  requireCampus();
  return (
    <AppShell>
      {/* `CampusGate` reads the `?org=` search param, which needs a Suspense boundary. */}
      <Suspense>
        <CampusGate title="Staff" allowedRoles={["college_admin"]}>
          <StaffPanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
