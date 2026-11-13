import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { NewAssignment } from "@/components/campus/new-assignment";
import { CampusGate } from "@/components/campus/campus-context";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "New assignment", robots: { index: false, follow: false } };

export default function Page() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="New assignment">
          <NewAssignment />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
