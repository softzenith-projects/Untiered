import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { HalfCreditAnnouncement } from "@/components/half-credit-announcement";
import { NewInterviewForm } from "@/components/new-interview-form";
import { ROUND_CATALOGUE } from "@/lib/rounds";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Start an interview" };

/**
 * Session setup. Company and role are named here, per session — there is no stored
 * target list, and no setup step that asks the candidate to declare targets in
 * advance (PRD 05).
 */
export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    round?: string | string[];
    topic?: string | string[];
    from?: string | string[];
    company?: string | string[];
    role?: string | string[];
    assignment?: string | string[];
  }>;
}) {
  requireFeature("mockInterviews");
  const { round: roundParam, topic: topicParam, from: fromParam, company, role, assignment } = await searchParams;
  const topic = Array.isArray(topicParam) ? topicParam[0] : topicParam;
  const from = Array.isArray(fromParam) ? fromParam[0] : fromParam;
  const requestedRound = Array.isArray(roundParam) ? roundParam[0] : roundParam;
  const roundType = ROUND_CATALOGUE.find((round) => round.value === requestedRound)?.value;
  return (
    <AppShell breadcrumb="new interview">
      <div className="flex w-full flex-col gap-6">
        <HalfCreditAnnouncement variant="card" onSetupPage />
        <NewInterviewForm
          initialRoundType={roundType}
          initialTopic={topic}
          roundPreselected={from === "rounds" && roundType !== undefined}
          initialCompany={prefill(company)}
          initialRole={prefill(role)}
          assignmentId={prefill(assignment) || undefined}
        />
      </div>
    </AppShell>
  );
}

/**
 * A dashboard quick start names the company and role in the URL. Only ever a starting
 * value for an editable field, trimmed and capped so a hand-made link cannot fill the form
 * with something unreasonable.
 */
function prefill(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  return (first ?? "").trim().slice(0, 80);
}
