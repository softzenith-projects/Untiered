import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { SettingsPanel } from "@/components/campus/settings-panel";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default function CampusSettingsPage() {
  requireCampus();
  return (
    <AppShell>
      {/* `CampusGate` reads the `?org=` search param, which needs a Suspense boundary. */}
      <Suspense>
        <CampusGate title="Settings" allowedRoles={["college_admin", "tpo", "faculty"]}>
          <SettingsPanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
