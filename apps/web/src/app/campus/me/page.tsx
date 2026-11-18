import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { MeCampus } from "@/components/campus/me-campus";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Your campus", robots: { index: false, follow: false } };

/** A student's campus page. Not behind the staff gate: it is every joined student's page. */
export default function CampusMePage() {
  requireCampus();
  return (
    <AppShell>
      <MeCampus />
    </AppShell>
  );
}
