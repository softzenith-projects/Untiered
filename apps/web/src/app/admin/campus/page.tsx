import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { AdminColleges } from "@/components/campus/admin-colleges";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Colleges", robots: { index: false, follow: false } };

/** Platform admin: every college, and a form to add one. The API answers 404 to anyone else. */
export default function AdminCampusPage() {
  requireCampus();
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <SurfaceHeader eyebrow="Platform admin" title="Untiered Campus colleges" description="Set up a college, its interview allowance and its status." />
        <p className="text-body">
          <Link href="/admin/campus/usage" className="text-accent underline-offset-2 hover:underline">
            Usage and AI cost per college
          </Link>
        </p>
        <AdminColleges />
      </div>
    </AppShell>
  );
}
