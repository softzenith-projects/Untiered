import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AdminLeads } from "@/components/campus/admin-leads";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { requireCampusLeads } from "@/lib/require-feature";

export const metadata: Metadata = { title: "College leads", robots: { index: false, follow: false } };

/** Platform admin: colleges that registered on /colleges. The API answers 404 to anyone else. */
export default function AdminCampusLeadsPage() {
  requireCampusLeads();
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <SurfaceHeader
          eyebrow="Platform admin"
          title="College leads"
          description="Colleges that registered interest. Review each one, then convert it into a college or mark it not a fit."
        />
        <AdminLeads />
      </div>
    </AppShell>
  );
}
