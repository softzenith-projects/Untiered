import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { JoinCollege } from "@/components/campus/join-college";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = {
  title: "Join your college",
  // The URL carries a single-use token; keep it out of indexes and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function CampusJoinPage() {
  requireCampus();
  return (
    <AppShell>
      <Suspense>
        <JoinCollege />
      </Suspense>
    </AppShell>
  );
}
