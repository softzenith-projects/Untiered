import type { Metadata, Route } from "next";
import Link from "next/link";

import { BrandWordmark } from "@/components/brand-logo";
import { LoginOptions } from "@/components/login-options";
import { SiteFooter } from "@/components/site-footer";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <>
    <main className="grid min-h-dvh bg-surface lg:grid-cols-[1.08fr_0.92fr]">
      {/*
        * Pinned to the viewport height, so it never stretches with the form beside it.
        * It used to be as tall as the grid row, and the row is as tall as the form —
        * so switching between "Sign in" and "Create account" (which adds two fields)
        * re-spaced everything on this side.
        */}
      <section className="relative hidden overflow-hidden bg-navy px-12 py-10 text-on-navy lg:sticky lg:top-0 lg:flex lg:h-dvh lg:min-h-[40rem] lg:flex-col lg:justify-between lg:self-start xl:px-20 xl:py-14">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-28 size-96 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -left-24 size-96 rounded-full bg-accent-2/10 blur-3xl"
        />

        <Link href="/" className="relative flex w-fit items-center focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-on-navy" aria-label="Untiered home">
          <BrandWordmark inverse />
        </Link>

        <div className="relative max-w-xl">
          <span className="pill pill-navy mb-6">Your practice room</span>
          <h1 className="text-display text-balance text-on-navy">
            Walk into the real interview having already faced the hard questions.
          </h1>
          <p className="mt-5 max-w-lg text-body text-on-navy-muted">
            Speak your answers, handle follow-ups, and leave with evidence-backed feedback you can
            act on before the next round.
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Voice-first practice"],
              ["02", "Employer-aware rounds"],
              ["03", "Evidence in every report"],
            ].map(([number, label]) => (
              <li key={number} className="rounded-xl bg-on-navy p-4 shadow-[var(--shadow-md)]">
                <span className="font-mono text-micro font-bold text-navy/60">{number}</span>
                <span className="mt-2 block text-caption font-semibold text-navy">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative max-w-lg text-caption text-on-navy-muted">
          Your camera stays in your browser. Answer audio is assessed without being saved;
          your reports stay private to your account and can be deleted by you.
        </p>
      </section>

      {/* Top-aligned at a fixed offset: a taller form grows downward instead of re-centring. */}
      <section className="flex items-start justify-center bg-surface-tint px-6 py-16 sm:px-10 lg:pt-[max(4rem,10dvh)]">
        <div className="card flex w-full max-w-md flex-col gap-9 p-7 shadow-[var(--shadow-lg)] sm:p-10 lg:shadow-[var(--shadow-md)]">
          <Link href="/" className="flex w-fit items-center focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent lg:hidden" aria-label="Untiered home">
            <BrandWordmark />
          </Link>
          <div className="flex flex-col gap-3">
            <span className="pill pill-accent w-fit">Continue your preparation</span>
            <h2 className="text-title font-bold text-ink">Your practice room starts here</h2>
            <p className="text-body text-ink-muted">
              Sign in or create an account to keep your practice and feedback together.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-caption text-danger">
              {error === "link_expired" || error === "missing_code" || error === "exchange_failed"
                ? "That email link could not be verified. Request a new link and try again."
                : "Sign-in could not be completed. Please try again."}
            </p>
          ) : null}

          <LoginOptions next={safeNext(next)} />

          <p className="text-caption text-ink-subtle">
            By continuing you agree to our{" "}
            <Link href={"/terms" as Route} className="font-medium text-accent hover:underline">
              terms of use
            </Link>{" "}
            and{" "}
            <Link href={"/privacy" as Route} className="font-medium text-accent hover:underline">
              privacy policy
            </Link>
            .
          </p>

          <p className="border-t border-line pt-5 text-caption text-ink-subtle">
            Courses, the Arena, mock interviews, and your reports are included while we build.
          </p>
        </div>
      </section>
    </main>
    <SiteFooter />
    </>
  );
}
