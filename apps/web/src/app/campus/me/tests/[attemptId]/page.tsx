import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { McqTestPage } from "@/components/campus/mcq-test";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Test", robots: { index: false, follow: false } };

/** A student's own MCQ test attempt: answer it, or review its result. Not behind the staff gate. */
export default async function McqAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  requireCampus();
  const { attemptId } = await params;
  return (
    <AppShell>
      <McqTestPage attemptId={attemptId} />
    </AppShell>
  );
}
