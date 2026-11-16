import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { ProgrammeCertificate } from "@/components/campus/certificate";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Certificate", robots: { index: false, follow: false } };

/** A student's own programme certificate, printed to PDF from the browser. Not behind the staff gate. */
export default async function CertificatePage({ params }: { params: Promise<{ programmeId: string }> }) {
  requireCampus();
  const { programmeId } = await params;
  return (
    <AppShell>
      <ProgrammeCertificate programmeId={programmeId} />
    </AppShell>
  );
}
