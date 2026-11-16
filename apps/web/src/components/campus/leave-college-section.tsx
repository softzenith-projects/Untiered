"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { fetchMeCampus, leaveCollege } from "@/lib/api";
import { campusEnabled } from "@/lib/flags";
import { useAccessToken } from "@/lib/use-access-token";
import type { MeCampusView } from "@untiered/shared";

import { errorText } from "./use-load";

type Student = NonNullable<MeCampusView["student"]>;

/**
 * "Your college" on the profile. Renders nothing unless the campus switch is on and the
 * signed-in account is a joined student, so for everyone else the profile is unchanged.
 */
export function LeaveCollegeSection() {
  const accessToken = useAccessToken();
  const [student, setStudent] = useState<Student | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<string | null>(null);
  const enabled = campusEnabled();

  useEffect(() => {
    if (!enabled || !accessToken) return;
    let active = true;
    fetchMeCampus({ accessToken })
      .then((view) => active && setStudent(view.student))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled, accessToken]);

  if (!enabled) return null;
  if (left) return <Alert tone="success">You left {left}. It no longer sees your practice.</Alert>;
  if (!student || !accessToken) return null;

  async function leave() {
    if (!student || !accessToken) return;
    setPending(true);
    setError(null);
    try {
      await leaveCollege(accessToken);
      setLeft(student.orgName);
      setStudent(null);
    } catch (cause) {
      setError(errorText(cause, "You could not leave the college just now. Try again in a moment."));
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <section aria-labelledby="college-heading" className="flex flex-col gap-3 rounded-2xl border border-line p-6">
      <h2 id="college-heading" className="text-heading text-ink">
        Your college
      </h2>
      <p className="max-w-prose text-caption text-ink-muted">
        You are a student of {student.orgName}, in {student.batchName}. Leaving ends what the college can see of your practice from now on.
        Your account, reports and credits stay with you.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {confirming ? (
        <Alert tone="warning" aria-label="Confirm leaving">
          <p className="font-semibold">Leave {student.orgName}?</p>
          <p className="mt-1">You would need a new invite to join again.</p>
          <div className="mt-3 flex gap-3">
            <Button variant="destructive" size="sm" loading={pending} onClick={() => void leave()}>
              Yes, leave
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Leave college
          </Button>
        </div>
      )}
    </section>
  );
}
