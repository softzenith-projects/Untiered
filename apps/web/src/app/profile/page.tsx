import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { EmailPreferencesSection } from "@/components/email-preferences-section";
import { ProfilePanel } from "@/components/profile-panel";
import { SignOutButton } from "@/components/sign-out-button";
import { getCourseOutlines } from "@/lib/course-outline";

export const metadata: Metadata = { title: "Your profile" };

/**
 * Profile and resume (PRD 05).
 *
 * The resume leads the page because it is the thing that changes the interview: without
 * one, a project deep-dive has a job title to work from and has to invent the rest.
 */
export default function ProfilePage() {
  const courseOutlines = getCourseOutlines();

  return (
    <AppShell>
      <div className="flex w-full flex-col gap-8">
        <ProfilePanel outlines={courseOutlines} />

        {/*
          * Signing out and deleting the account share one place: both are about the
          * account rather than the profile, and both are rare. The rail's account menu
          * links straight here.
          */}
        <section
          id="account"
          aria-labelledby="account-heading"
          className="flex scroll-mt-24 flex-col gap-6 rounded-2xl border border-line bg-surface-sunken p-6"
        >
          <h2 id="account-heading" className="text-heading text-ink">
            Account
          </h2>
          <div className="flex flex-col gap-3">
            <p className="max-w-prose text-caption text-ink-subtle">
              Signing out clears your session on this device only. Your resume, rounds and
              reports are untouched and are here when you come back.
            </p>
            <div className="flex">
              <SignOutButton />
            </div>
          </div>
          <EmailPreferencesSection />
          <DeleteAccountSection />
        </section>
      </div>
    </AppShell>
  );
}
