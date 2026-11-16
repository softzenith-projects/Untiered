import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AdminCollegeDetail } from "@/components/campus/admin-college-detail";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "College", robots: { index: false, follow: false } };

export default async function AdminCampusOrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  requireCampus();
  const { orgId } = await params;
  return (
    <AppShell>
      <AdminCollegeDetail orgId={orgId} />
    </AppShell>
  );
}
