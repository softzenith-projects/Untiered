import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AdminUsage } from "@/components/campus/admin-usage";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Campus usage", robots: { index: false, follow: false } };

/** Platform admin: interviews and estimated AI cost per college. The API answers 404 to anyone else. */
export default function AdminCampusUsagePage() {
  requireCampus();
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <SurfaceHeader eyebrow="Platform admin" title="Campus usage and cost" description="Interviews used and estimated AI cost for each college." />
        <AdminUsage />
      </div>
    </AppShell>
  );
}
