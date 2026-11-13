import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { AttentionPanel } from "@/components/campus/attention-panel";
import { CampusGate } from "@/components/campus/campus-context";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Students needing attention", robots: { index: false, follow: false } };

export default function CampusAttentionPage() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Students needing attention">
          <AttentionPanel />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
