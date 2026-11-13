"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { buttonStyles } from "@/components/ui/button";
import { fetchMeCampus } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAccessToken } from "@/lib/use-access-token";
import type { MeCampusView, StaffRole } from "@untiered/shared";

export interface CampusOrg {
  orgId: string;
  orgName: string;
  logoUrl: string | null;
  role: StaffRole;
  /** The token every call in the portal uses. */
  accessToken: string;
}

const CampusOrgContext = createContext<CampusOrg | null>(null);

/** The college the portal is showing. Only valid below a `CampusGate`. */
export function useCampusOrg(): CampusOrg {
  const value = useContext(CampusOrgContext);
  if (!value) throw new Error("useCampusOrg needs a CampusGate above it.");
  return value;
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  college_admin: "College admin",
  tpo: "Training and placement",
  faculty: "Faculty",
};

interface PortalLink {
  href: string;
  label: string;
  roles: StaffRole[];
}

/** Convenience only: the API enforces every one of these. */
const PORTAL_LINKS: PortalLink[] = [
  { href: "/campus", label: "Overview", roles: ["college_admin", "tpo", "faculty"] },
  { href: "/campus/structure", label: "Departments and batches", roles: ["college_admin", "tpo"] },
  { href: "/campus/students", label: "Students", roles: ["college_admin", "tpo", "faculty"] },
  { href: "/campus/assignments", label: "Assignments", roles: ["college_admin", "tpo", "faculty"] },
  { href: "/campus/readiness", label: "Readiness", roles: ["college_admin", "tpo", "faculty"] },
  { href: "/campus/staff", label: "Staff", roles: ["college_admin"] },
  { href: "/campus/settings", label: "Settings", roles: ["college_admin"] },
];

export function campusHref(path: string, orgId: string): Route {
  return `${path}?org=${encodeURIComponent(orgId)}` as Route;
}

/**
 * Resolves which college the portal is for, from `GET /me/campus`, and renders its
 * children once that is known. The selected college lives in the `?org=` search param so
 * a reload or a shared link keeps it; with exactly one college it is implied and the
 * param is never needed. `allowedRoles` hides a page's content from a role that cannot
 * use it (the API still answers 403/404 on its own).
 */
export function CampusGate({
  allowedRoles = ["college_admin", "tpo", "faculty"],
  title,
  children,
}: {
  allowedRoles?: StaffRole[];
  title: string;
  children: ReactNode;
}) {
  const accessToken = useAccessToken();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MeCampusView | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchMeCampus({ accessToken })
      .then((view) => active && setMe(view))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (failed) {
    return <Alert tone="error">Your colleges could not be loaded just now. Try again in a moment.</Alert>;
  }
  if (accessToken === null) {
    return <Alert tone="warning">Sign in to open the college portal.</Alert>;
  }
  if (!me || !accessToken) {
    return (
      <div aria-busy="true" aria-label="Loading your college" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (me.staff.length === 0) {
    return (
      <EmptyState
        title="You are not staff at any college on Untiered"
        description="The college portal is for administrators, placement officers and faculty of a college that has partnered with us. If you expected access, ask your college admin to add you."
        action={
          <Link href="/colleges" className={buttonStyles({ variant: "secondary" })}>
            About Untiered Campus
          </Link>
        }
      />
    );
  }

  const requested = params.get("org");
  const selected = me.staff.find((entry) => entry.orgId === requested) ?? (me.staff.length === 1 ? me.staff[0] : undefined);

  if (!selected) {
    return (
      <section aria-labelledby="picker-heading" className="card space-y-4 p-6">
        <h2 id="picker-heading" className="text-heading text-ink">
          Choose a college
        </h2>
        <p className="text-caption text-ink-muted">You are staff at more than one college.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {me.staff.map((entry) => (
            <li key={entry.orgId}>
              <button
                type="button"
                onClick={() => router.push(campusHref(pathname, entry.orgId))}
                className="card card-interactive flex w-full flex-col items-start gap-1 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="text-body font-semibold text-ink">{entry.orgName}</span>
                <span className="text-caption text-ink-muted">{ROLE_LABEL[entry.role]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const org: CampusOrg = { ...selected, accessToken };

  return (
    <CampusOrgContext.Provider value={org}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt="" className="size-12 rounded-lg border border-line object-contain" />
            ) : null}
            <div>
              <p className="text-caption text-ink-muted">
                {org.orgName} · {ROLE_LABEL[org.role]}
                {me.staff.length > 1 ? (
                  <>
                    {" · "}
                    <Link href={pathname as Route} className="underline">
                      Switch college
                    </Link>
                  </>
                ) : null}
              </p>
              <h1 className="text-display text-ink">{title}</h1>
            </div>
          </div>
        </header>
        <nav aria-label="College portal">
          <ul className="flex flex-wrap gap-1">
            {PORTAL_LINKS.filter((link) => link.roles.includes(org.role)).map((link) => {
              const active = pathname === link.href || (link.href !== "/campus" && pathname.startsWith(`${link.href}/`));
              return (
                <li key={link.href}>
                  <Link
                    href={campusHref(link.href, org.orgId)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-full px-4 py-2 text-caption transition-colors",
                      active ? "bg-accent font-bold text-accent-contrast" : "font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {allowedRoles.includes(org.role) ? (
          children
        ) : (
          <Alert tone="info">This page is not available for your role at {org.orgName}.</Alert>
        )}
      </div>
    </CampusOrgContext.Provider>
  );
}
