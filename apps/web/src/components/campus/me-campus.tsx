"use client";

import { useEffect, useState } from "react";

import { fetchMeCampus } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { MeCampusView } from "@untiered/shared";

import { AssignedToYou } from "./assigned-to-you";
import { LeaveCollegeSection } from "./leave-college-section";
import { MyLeaderboard } from "./my-leaderboard";
import { MyReadiness } from "./my-readiness";

type Student = NonNullable<MeCampusView["student"]>;

/**
 * A joined student's campus page, in one place: what the college assigned (and the programme
 * they are on), their readiness, the batch leaderboard and the way to leave. Everything here is
 * read from the same routes the dashboard and the profile use, so the page adds no rules of its
 * own. A visitor who is not a student sees the readiness section's own "not in a college" state.
 */
export function MeCampus() {
  const accessToken = useAccessToken();
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    fetchMeCampus({ accessToken, signal: controller.signal })
      .then((view) => {
        if (!controller.signal.aborted) setStudent(view.student);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [accessToken]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        {student ? (
          <p className="text-caption font-semibold text-accent">
            {student.orgName} · {student.batchName}
          </p>
        ) : null}
        <h1 className="text-display text-ink">Your campus</h1>
        <p className="max-w-prose text-body text-ink-muted">
          Your college&rsquo;s assignments sit above your own practice. Assigned interviews are paid for by your college and do not use
          your free rounds or credits.
        </p>
      </header>
      <AssignedToYou hideReadinessLink />
      <section aria-labelledby="my-readiness-heading" className="flex flex-col gap-3">
        <h2 id="my-readiness-heading" className="text-heading text-ink">
          My readiness
        </h2>
        <MyReadiness />
      </section>
      <MyLeaderboard />
      <LeaveCollegeSection />
    </div>
  );
}
