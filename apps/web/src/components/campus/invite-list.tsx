"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Table, TableScroll } from "@/components/ui/table";
import { ApiRequestError } from "@/lib/api";
import type { InviteSendStatus, InviteStatus, InviteView } from "@untiered/shared";

import { ROLE_LABEL } from "./campus-context";
import { errorText } from "./use-load";

const STATUS_LABEL: Record<InviteStatus, string> = {
  invited: "Invited",
  joined: "Joined",
  revoked: "Revoked",
  expired: "Expired",
};
const STATUS_TONE: Record<InviteStatus, "info" | "positive" | "danger" | "highlight"> = {
  invited: "info",
  joined: "positive",
  revoked: "danger",
  expired: "highlight",
};

/** Plain-English send state. `pending` is also what an invite shows while email is not configured. */
export const SEND_LABEL: Record<InviteSendStatus, string> = {
  pending: "Waiting to send",
  sending: "Sending",
  sent: "Email sent",
  failed: "Email failed",
};

export const INVITE_STATUSES: InviteStatus[] = ["invited", "joined", "expired", "revoked"];
export const inviteStatusLabel = (status: InviteStatus) => STATUS_LABEL[status];

/** What to tell a staff member when an invite action is refused. */
export function inviteErrorText(cause: unknown): string {
  if (cause instanceof ApiRequestError) {
    switch (cause.code) {
      case "resend_limit":
        return "This invite has already been sent 10 times. Revoke it and invite the person again if they still need it.";
      case "invite_not_open":
        return "This invite is no longer open, so it cannot be changed.";
      case "already_invited":
        return "Someone with that email already has an open invite to this college.";
      case "already_member":
        return "That person has already joined this college.";
      case "batch_required":
        return "Choose a batch for a student invite.";
      case "campus_forbidden":
        return "Your role cannot do that.";
      default:
        return errorText(cause);
    }
  }
  return errorText(cause);
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * A list of invites with resend and revoke. Resend suits an invite that is still open or has
 * lapsed; revoke only one that is still open. The server enforces both.
 */
export function InviteList({
  invites,
  onResend,
  onRevoke,
  onChanged,
  showBatch = false,
  caption,
}: {
  invites: InviteView[];
  onResend: (invite: InviteView) => Promise<InviteView>;
  onRevoke: (invite: InviteView) => Promise<InviteView>;
  onChanged: (updated: InviteView) => void;
  showBatch?: boolean;
  caption: string;
}) {
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [revoking, setRevoking] = useState<InviteView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(invite: InviteView, action: () => Promise<InviteView>, success: string) {
    setMessage(null);
    setBusy(invite.id);
    try {
      onChanged(await action());
      setMessage({ tone: "success", text: success });
    } catch (cause) {
      setMessage({ tone: "error", text: inviteErrorText(cause) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {revoking ? (
        <Alert tone="warning" aria-label="Confirm revoke">
          <p className="font-semibold">Revoke the invite for {revoking.fullName}?</p>
          <p className="mt-1">The link in their email stops working. You can invite them again later.</p>
          <div className="mt-3 flex gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const target = revoking;
                setRevoking(null);
                void act(target, () => onRevoke(target), `Revoked the invite for ${target.fullName}.`);
              }}
            >
              Yes, revoke
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}
      <TableScroll>
        <Table>
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-sunken text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Name</th>
              <th scope="col" className="px-4 py-3">{showBatch ? "Batch" : "Role"}</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => {
              const canResend = invite.status === "invited" || invite.status === "expired";
              const canRevoke = invite.status === "invited";
              return (
                <tr key={invite.id} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    {invite.fullName}
                    <span className="block font-normal text-ink-subtle">{invite.email}</span>
                  </th>
                  <td className="px-4 py-3">
                    {showBatch ? (invite.batchName ?? "No batch") : ROLE_LABEL[invite.role as keyof typeof ROLE_LABEL]}
                    {showBatch && invite.rollNumber ? <span className="block text-ink-subtle">Roll {invite.rollNumber}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[invite.status]}>{STATUS_LABEL[invite.status]}</Badge>
                    <span className="mt-1 block text-ink-subtle">
                      {invite.status === "joined" && invite.joinedAt ? `on ${fmt(invite.joinedAt)}` : `until ${fmt(invite.expiresAt)}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={invite.sendStatus === "failed" ? "font-semibold text-danger" : "text-ink-muted"}>
                      {SEND_LABEL[invite.sendStatus]}
                    </span>
                    <span className="block text-ink-subtle">
                      Sent {invite.sendCount} {invite.sendCount === 1 ? "time" : "times"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canResend ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy === invite.id}
                          aria-label={`Resend invite to ${invite.fullName}`}
                          onClick={() => void act(invite, () => onResend(invite), `Invite sent again to ${invite.email}.`)}
                        >
                          Resend
                        </Button>
                      ) : null}
                      {canRevoke ? (
                        <Button
                          variant="quiet"
                          size="sm"
                          disabled={busy === invite.id}
                          aria-label={`Revoke invite for ${invite.fullName}`}
                          onClick={() => setRevoking(invite)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableScroll>
    </div>
  );
}

/** Replaces an invite in a list by id, adding nothing. */
export function replaceInvite(list: InviteView[], updated: InviteView): InviteView[] {
  return list.map((entry) => (entry.id === updated.id ? updated : entry));
}
