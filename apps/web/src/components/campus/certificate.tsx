"use client";

import Link from "next/link";
import { useCallback } from "react";

import { BrandWordmark } from "@/components/brand-logo";
import { Button, buttonStyles } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { fetchMyCertificate } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { CertificateView } from "@untiered/shared";

import { formatLongDate } from "./programme-model";
import { useLoad } from "./use-load";

const NEVER = new Promise<never>(() => {});

/**
 * A student's programme certificate as a print page (campus spec §10): the browser's print
 * dialog saves it as a PDF, as the batch report does, so no PDF library is needed. It carries
 * the Untiered and college names and the college logo, and never a score.
 */
export function ProgrammeCertificate({ programmeId }: { programmeId: string }) {
  const accessToken = useAccessToken();
  const load = useCallback(
    (signal: AbortSignal): Promise<CertificateView> => (accessToken ? fetchMyCertificate(programmeId, { accessToken, signal }) : NEVER),
    [programmeId, accessToken],
  );
  const { data, error, loading } = useLoad(load);

  if (accessToken === null) return <Alert tone="warning">Sign in to see your certificate.</Alert>;
  if (error?.status === 404) {
    return (
      <EmptyState
        title="This certificate is not ready yet"
        description="A programme's certificate appears once you have completed every week's assignment."
        action={
          <Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>
            Back to your dashboard
          </Link>
        }
      />
    );
  }
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading || !data) return <Skeleton aria-label="Loading your certificate" className="h-96 w-full" />;

  return (
    <div className="certificate-page flex flex-col gap-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-caption text-ink-muted">
          Use Print, then choose Save as PDF as the destination. The certificate prints on one A4 page in landscape.
        </p>
        <Button type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </Button>
      </div>
      <CertificateSheet certificate={data} />
    </div>
  );
}

export function CertificateSheet({ certificate }: { certificate: CertificateView }) {
  return (
    <article
      aria-label={`Certificate of completion for ${certificate.studentName}`}
      className="certificate-sheet relative mx-auto flex aspect-[297/210] w-full max-w-5xl flex-col justify-between overflow-hidden rounded-xl border-4 border-double border-accent bg-surface p-8 text-center shadow-[var(--shadow-md)] sm:p-12"
    >
      <header className="flex items-center justify-between gap-6">
        <BrandWordmark />
        <div className="flex items-center gap-3 text-right">
          <span className="text-body font-semibold text-ink">{certificate.orgName}</span>
          {certificate.orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={certificate.orgLogoUrl} alt={`${certificate.orgName} logo`} className="size-14 rounded-lg object-contain" />
          ) : null}
        </div>
      </header>

      <div className="flex flex-col items-center gap-3">
        <p className="text-caption font-semibold uppercase tracking-widest text-accent">Certificate of completion</p>
        <p className="text-body text-ink-muted">This is to certify that</p>
        <h1 className="text-display text-ink">{certificate.studentName}</h1>
        <p className="text-body text-ink-muted">has completed every module of</p>
        <p className="text-heading text-ink">{certificate.programmeTitle}</p>
        <p className="text-body text-ink-muted">
          a programme run by {certificate.orgName} on Untiered Campus.
        </p>
      </div>

      <footer className="grid gap-4 text-caption text-ink-muted sm:grid-cols-2">
        <div className="text-left">
          <span className="block font-semibold text-ink">Completed</span>
          {formatLongDate(certificate.completedAt)}
        </div>
        <div className="text-right">
          <span className="block font-semibold text-ink">Certificate ID</span>
          <span className="font-mono">{certificate.certificateId}</span>
        </div>
      </footer>
    </article>
  );
}
