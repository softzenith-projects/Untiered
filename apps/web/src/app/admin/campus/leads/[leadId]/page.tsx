import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AdminLeads } from "@/components/campus/admin-leads";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { requireCampusLeads } from "@/lib/require-feature";

export const metadata: Metadata = { title: "College lead", robots: { index: false, follow: false } };

/** One lead, opened from its notification email, with the rest of the list around it. */
export default async function AdminCampusLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  requireCampusLeads();
  const { leadId } = await params;
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <SurfaceHeader eyebrow="Platform admin" title="College leads" description="Colleges that registered interest." />
        <AdminLeads initialLeadId={leadId} />
      </div>
    </AppShell>
  );
}
