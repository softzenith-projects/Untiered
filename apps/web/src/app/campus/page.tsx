import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { CampusGate } from "@/components/campus/campus-context";
import { CampusHome } from "@/components/campus/campus-home";
import { requireCampus } from "@/lib/require-feature";

export const metadata: Metadata = { title: "College portal", robots: { index: false, follow: false } };

export default function CampusHomePage() {
  requireCampus();
  return (
    <AppShell>
      {/* `CampusGate` reads the `?org=` search param, which needs a Suspense boundary. */}
      <Suspense>
        <CampusGate title="College portal">
          <CampusHome />
        </CampusGate>
      </Suspense>
    </AppShell>
  );
}
