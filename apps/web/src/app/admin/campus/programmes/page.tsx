import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AdminProgrammes } from "@/components/campus/admin-programmes";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Programme templates", robots: { index: false, follow: false } };

/** Platform admin: the programme templates every college can start. The API answers 404 to anyone else. */
export default function AdminProgrammesPage() {
  requireCampus();
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <SurfaceHeader
          eyebrow="Platform admin"
          title="Programme templates"
          description="Reusable weekly programmes. A college starts one for its batches, and each week becomes a dated assignment."
        />
        <AdminProgrammes />
      </div>
    </AppShell>
  );
}
