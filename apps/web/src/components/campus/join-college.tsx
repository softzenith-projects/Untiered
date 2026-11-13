"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import { Button, buttonStyles } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Checkbox } from "@/components/ui/field";
import { acceptInvite, ApiRequestError, fetchInvitePreview } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { InvitePreview, MeCampusView } from "@untiered/shared";

import { ROLE_LABEL } from "./campus-context";

/** One clear message for each error the join endpoints can answer with. */
export function joinErrorText(cause: unknown): string {
  if (cause instanceof ApiRequestError) {
    switch (cause.code) {
      case "invite_not_found":
        return "This invite link is not valid any more. It may have expired, been replaced by a newer email, been withdrawn, or already been used. Ask your college to send it again.";
      case "consent_required":
        return "Both agreements are needed to join as a student. Tick both and try again.";
      case "consent_version_stale":
        return "The terms were updated while you had this page open. The page has been reloaded: read them again, then confirm.";
      case "email_mismatch_unconfirmed":
        return "This invite was sent to a different email address. Confirm that you want to join with the account you are signed in to.";
      case "already_in_college":
        return "You are already a student at another college on Untiered, and an account can belong to only one. Leave that college from your profile first, then open this link again.";
      case "already_member":
        return "You have already joined this college with this account.";
      default:
        return cause.message || "That did not work. Try again in a moment.";
    }
  }
  return "That did not work. Try again in a moment.";
}

const NEVER = new Promise<never>(() => {});

/** Where a person lands after joining: students on their dashboard, staff in the portal. */
export function destinationAfterJoin(preview: InvitePreview, me: MeCampusView & { joinedOrgId?: string }): string {
  if (preview.role === "student") return "/dashboard";
  const entry = me.staff.find((staff) => staff.orgId === me.joinedOrgId) ?? me.staff[me.staff.length - 1];
  return entry ? `/campus?org=${encodeURIComponent(entry.orgId)}` : "/campus";
}

export function JoinCollege() {
  const token = useSearchParams().get("token");
  const accessToken = useAccessToken();
  const router = useRouter();
  const id = useId();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreeData, setAgreeData] = useState(false);
  const [agreeAi, setAgreeAi] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!token || !accessToken) return NEVER;
      return fetchInvitePreview(token, { accessToken, ...(signal ? { signal } : {}) });
    },
    [token, accessToken],
  );

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    load(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setPreview(value);
        setLoadError(null);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadError(joinErrorText(cause));
      });
    return () => controller.abort();
  }, [load, token]);

  if (!token) {
    return <Alert tone="error">This page needs the link from your invite email. Open the link in the email again.</Alert>;
  }
  if (loadError) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <Alert tone="error">{loadError}</Alert>
        <div>
          <Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>
            Go to your dashboard
          </Link>
        </div>
      </div>
    );
  }
  if (!preview || !accessToken) return <Skeleton className="mx-auto h-72 w-full max-w-2xl" />;

  const isStudent = preview.role === "student";
  const mismatch = !preview.emailMatches;
  const ready = (!isStudent || (agreeData && agreeAi)) && (!mismatch || confirmEmail);
  const roleName = isStudent ? "Student" : ROLE_LABEL[preview.role as keyof typeof ROLE_LABEL];

  async function accept() {
    if (!preview || !token || !accessToken) return;
    setPending(true);
    setError(null);
    try {
      const me = await acceptInvite(accessToken, token, {
        consentVersion: preview.consentVersion,
        agreeDataSharing: isStudent ? agreeData : false,
        agreeAiEvaluation: isStudent ? agreeAi : false,
        ...(mismatch ? { confirmDifferentEmail: confirmEmail } : {}),
      });
      router.replace(destinationAfterJoin(preview, me) as Route);
    } catch (cause) {
      setError(joinErrorText(cause));
      if (cause instanceof ApiRequestError && cause.code === "consent_version_stale") {
        // The server's terms moved on: fetch them again and make the person agree afresh.
        setAgreeData(false);
        setAgreeAi(false);
        fetchInvitePreview(token, { accessToken }).then(setPreview, () => {});
      }
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 sm:p-8">
      <header className="flex items-center gap-4">
        {preview.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.logoUrl} alt="" className="size-14 rounded-lg border border-line object-contain" />
        ) : null}
        <div>
          <p className="text-caption text-ink-muted">You are invited to join</p>
          <h1 id={`${id}-h`} className="text-display text-ink">
            {preview.orgName}
          </h1>
        </div>
      </header>

      <dl className="grid gap-4 text-caption sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">College</dt>
          <dd className="font-semibold text-ink">{preview.orgName}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Role</dt>
          <dd className="font-semibold text-ink">{roleName}</dd>
        </div>
        {preview.batchName ? (
          <div>
            <dt className="text-ink-muted">Batch</dt>
            <dd className="font-semibold text-ink">{preview.batchName}</dd>
          </div>
        ) : null}
      </dl>

      {isStudent ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h2 className="text-body font-semibold text-ink">What your college will see</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-caption text-ink-muted">
                {preview.shared.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-body font-semibold text-ink">What stays private</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-caption text-ink-muted">
                {preview.notShared.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="rounded-lg bg-surface-sunken p-4 text-caption text-ink-muted">{preview.aiNotice}</p>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-body font-semibold text-ink">Before you join</legend>
            <label className="flex items-start gap-3 text-caption text-ink">
              <Checkbox checked={agreeData} onChange={(event) => setAgreeData(event.target.checked)} className="mt-0.5" />
              <span>I agree that {preview.orgName} can see the information listed above.</span>
            </label>
            <label className="flex items-start gap-3 text-caption text-ink">
              <Checkbox checked={agreeAi} onChange={(event) => setAgreeAi(event.target.checked)} className="mt-0.5" />
              <span>I understand that an AI interviewer evaluates my practice and writes my reports.</span>
            </label>
          </fieldset>
        </>
      ) : (
        <p className="text-caption text-ink-muted">
          You are joining as {roleName}. You will be able to see and manage the parts of the college portal your role allows.
        </p>
      )}

      {mismatch ? (
        <div className="flex flex-col gap-3">
          <Alert tone="warning">
            This invite was sent to {preview.invitedEmailMasked}, but you are signed in as {preview.signedInEmail}.
          </Alert>
          <label className="flex items-start gap-3 text-caption text-ink">
            <Checkbox checked={confirmEmail} onChange={(event) => setConfirmEmail(event.target.checked)} className="mt-0.5" />
            <span>
              You&apos;re joining as {preview.signedInEmail}; this invite was sent to {preview.invitedEmailMasked}. I confirm this is the account I
              want to use.
            </span>
          </label>
        </div>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      <div>
        <Button onClick={() => void accept()} loading={pending} disabled={!ready}>
          Join {preview.orgName}
        </Button>
      </div>
    </section>
  );
}
