"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { analyticsId, chooseConsent, isTrackedPath, sendPageView, setAnalyticsActive } from "@/lib/analytics";
import { useAnalyticsConsent } from "@/lib/use-analytics-consent";

/** Mounted once in the root layout. Renders nothing until a measurement id is configured. */
export function SiteAnalytics() {
  const id = analyticsId();
  return id ? <Tracker id={id} /> : null;
}

function Tracker({ id }: { id: string }) {
  const pathname = usePathname();
  const consent = useAnalyticsConsent();
  const tracked = isTrackedPath(pathname);
  const active = consent === "granted" && tracked;

  useEffect(() => {
    if (consent === null) return;
    setAnalyticsActive(id, active);
    if (active) sendPageView(pathname);
  }, [id, consent, active, pathname]);

  return (
    <>
      {active ? <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" /> : null}
      {consent === "unset" && tracked ? <ConsentBanner /> : null}
    </>
  );
}

function ConsentBanner() {
  return (
    <section
      aria-label="Analytics choice"
      className="z-overlay fixed inset-x-3 bottom-3 mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-caption text-ink-muted">
        May we use Google Analytics to count visits to our public pages? It sets cookies, and it
        stays off on your interviews and reports.{" "}
        <Link href={"/privacy#cookies" as Route} className="font-medium text-accent hover:underline">
          Privacy policy
        </Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={() => chooseConsent("denied")}>Decline</Button>
        <Button variant="secondary" size="sm" onClick={() => chooseConsent("granted")}>Allow</Button>
      </div>
    </section>
  );
}

/** Lets a visitor change their answer later, as the privacy policy promises. */
export function AnalyticsChoice() {
  const consent = useAnalyticsConsent();
  if (!analyticsId() || consent === null) return null;

  const allowed = consent === "granted";
  return (
    <p className="flex flex-wrap items-center gap-3">
      <span>Google Analytics is {allowed ? "allowed" : "off"} in this browser.</span>
      <Button variant="secondary" size="sm" onClick={() => chooseConsent(allowed ? "denied" : "granted")}>
        {allowed ? "Turn it off" : "Allow it"}
      </Button>
    </p>
  );
}
