"use client";

import { useCallback, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Table, TableScroll } from "@/components/ui/table";
import { fetchMyLeaderboard, setLeaderboardOptIn } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { LeaderboardScope } from "@untiered/shared";

import { errorText, useLoad } from "./use-load";

const NEVER = new Promise<never>(() => {});

/**
 * The student's campus leaderboard. Anonymous by default: the switch below is the only way a
 * name appears. Shown to students only; a visitor who is not one gets nothing here.
 */
export function MyLeaderboard() {
  const accessToken = useAccessToken();
  const headingId = useId();
  const [scope, setScope] = useState<LeaderboardScope>("batch");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const load = useCallback(
    (signal: AbortSignal) => (accessToken ? fetchMyLeaderboard(scope, { accessToken, signal }) : NEVER),
    [accessToken, scope],
  );
  const { data, error, loading, setData } = useLoad(load);

  // Not a joined student: the readiness section above already says so.
  if (error?.status === 404 || accessToken === null) return null;

  async function toggle(next: boolean) {
    if (!accessToken) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await setLeaderboardOptIn(accessToken, next);
      setData((current) => (current ? { ...current, optedIn: saved.optIn } : current));
    } catch (cause) {
      setSaveError(errorText(cause, "That could not be saved just now."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="text-heading text-ink">Leaderboard</h2>
      <div role="group" aria-label="Leaderboard scope" className="flex gap-2">
        {(["batch", "college"] as const).map((option) => (
          <Button key={option} variant={scope === option ? "primary" : "secondary"} size="sm" aria-pressed={scope === option} onClick={() => setScope(option)}>
            {option === "batch" ? "My batch" : "My college"}
          </Button>
        ))}
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {loading && !data ? (
        <Skeleton className="h-32 w-full" />
      ) : data ? (
        <>
          <p className="text-body text-ink">
            {data.myRank === null
              ? "You are not ranked yet. Rankings use the work your college has assigned you, and need enough completed work to place you."
              : `You are #${data.myRank}`}
          </p>
          {data.rows.length > 0 ? (
            <TableScroll>
              <Table>
                <caption className="sr-only">Leaderboard for your {scope}</caption>
                <thead className="bg-surface-sunken text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">Rank</th>
                    <th scope="col" className="px-4 py-3">Student</th>
                    <th scope="col" className="px-4 py-3">Readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={`${row.rank}-${row.displayName}-${row.overall}-${row.isMe}`} className="border-t border-line">
                      <td className="px-4 py-3">{row.rank}</td>
                      <td className="px-4 py-3">
                        {row.displayName}
                        {row.isMe ? <Badge tone="accent" className="ml-2">You</Badge> : null}
                      </td>
                      <td className="px-4 py-3">{row.overall}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          ) : null}
          <label className="flex items-start gap-3 text-body text-ink">
            <input
              type="checkbox"
              role="switch"
              className="mt-1 h-4 w-4"
              checked={data.optedIn}
              disabled={saving}
              onChange={(event) => void toggle(event.target.checked)}
            />
            <span>
              Show my name on the leaderboard
              <span className="block text-caption text-ink-muted">Your name is hidden unless you turn this on.</span>
            </span>
          </label>
          {saveError ? <Alert tone="error">{saveError}</Alert> : null}
        </>
      ) : null}
    </section>
  );
}
