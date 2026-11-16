"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonStyles } from "@/components/ui/button";
import { fetchMeCampus } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { MeCampusView } from "@untiered/shared";

import { campusHref } from "./campus-context";

/**
 * "You're staff at {college}": the way back into the college portal from the student
 * dashboard. Renders nothing unless the person has a staff membership, and a failed read is
 * silent, so the dashboard stays exactly as it was for everyone else. The caller mounts it
 * only when the campus switch is on.
 */
export function StaffPortalCard() {
  const accessToken = useAccessToken();
  const [staff, setStaff] = useState<MeCampusView["staff"]>([]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchMeCampus({ accessToken })
      .then((view) => {
        if (active) setStaff(view.staff ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (staff.length === 0) return null;

  return (
    <aside aria-label="College portal" className="card flex flex-col gap-3 p-5">
      {staff.map((entry) => (
        <div key={entry.orgId} className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body text-ink">
            You&rsquo;re staff at <span className="font-semibold">{entry.orgName}</span>
          </p>
          <Link href={campusHref("/campus", entry.orgId)} className={buttonStyles({ variant: "secondary", size: "sm" })}>
            Open the college portal{" "}
            <span className="sr-only">for {entry.orgName}</span>
          </Link>
        </div>
      ))}
    </aside>
  );
}
