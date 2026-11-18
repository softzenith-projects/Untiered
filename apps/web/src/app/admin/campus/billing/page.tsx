import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { AdminBilling } from "@/components/campus/admin-packages";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Campus billing", robots: { index: false, follow: false } };

/** Platform admin: every college's package, payments and cost (contract Module 14). The API answers 404 to anyone else. */
export default function AdminCampusBillingPage() {
  requireCampus();
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <SurfaceHeader
          eyebrow="Platform admin"
          title="Campus packages and payments"
          description="Each college's current package, what is outstanding and paid, and when its next renewal reminder goes out."
        />
        <AdminBilling />
      </div>
    </AppShell>
  );
}
