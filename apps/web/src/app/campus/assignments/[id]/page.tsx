import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { AssignmentDetail } from "@/components/campus/assignment-detail";
import { CampusGate } from "@/components/campus/campus-context";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Assignment", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  requireCampus();
  const { id } = await params;
  return (
    <AppShell>
      <Suspense>
        <CampusGate title="Assignment">
          <AssignmentDetail id={id} />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
