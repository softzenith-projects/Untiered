import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { ProgrammeDetail } from "@/components/campus/programme-detail";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Programme", robots: { index: false, follow: false } };

export default async function CampusProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  requireCampus();
  const { id } = await params;
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Programme">
          <ProgrammeDetail programmeId={id} />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
