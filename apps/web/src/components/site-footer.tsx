import type { Route } from "next";
import Link from "next/link";

import { BrandWordmark } from "@/components/brand-logo";
import { SessionLink } from "@/components/session-link";
import { featureEnabled } from "@/lib/flags";

export const LEGAL_LINKS: { href: Route; label: string }[] = [
  { href: "/privacy" as Route, label: "Privacy policy" },
  { href: "/terms" as Route, label: "Terms of use" },
  { href: "/contact" as Route, label: "Contact" },
];

/** Shared navigation for marketing, learning, dashboard and document pages. */
export function SiteFooter() {
  const product = [
    featureEnabled("courses") ? { href: "/courses" as Route, label: "Courses" } : null,
    featureEnabled("arena") ? { href: "/arena" as Route, label: "Arena" } : null,
    featureEnabled("mockInterviews") ? { href: "/interview/new" as Route, label: "Mock interviews" } : null,
  ].filter((link): link is { href: Route; label: string } => link !== null);

  return (
    <footer className="border-t border-on-navy/10 bg-navy text-on-navy">
      <div className="layout-content page-gutter mx-auto grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-on-navy" aria-label="Untiered home">
            <BrandWordmark inverse />
          </Link>
          <p className="mt-3 max-w-xs text-caption leading-relaxed text-on-navy-muted">Talent has no tiers.</p>
        </div>
        <nav aria-label="Product" className="flex flex-col items-start gap-3">
          <h2 className="text-caption font-semibold text-on-navy">Product</h2>
          {product.map((link) => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-caption text-on-navy-muted transition-colors hover:text-on-navy">{link.label}</Link>)}
        </nav>
        <nav aria-label="Legal" className="flex flex-col items-start gap-3">
          <h2 className="text-caption font-semibold text-on-navy">Legal</h2>
          {LEGAL_LINKS.map((link) => <Link key={link.href} href={link.href} className="inline-flex min-h-11 items-center text-caption text-on-navy-muted transition-colors hover:text-on-navy">{link.label}</Link>)}
        </nav>
        <nav aria-label="Support" className="flex flex-col items-start gap-3">
          <h2 className="text-caption font-semibold text-on-navy">Support</h2>
          <Link href="/contact" className="inline-flex min-h-11 items-center text-caption text-on-navy-muted transition-colors hover:text-on-navy">Contact us</Link>
          <SessionLink
            signedIn={{ href: "/dashboard", label: "Dashboard" }}
            signedOut={{ href: "/login", label: "Sign in" }}
            className="inline-flex min-h-11 items-center text-caption text-on-navy-muted transition-colors hover:text-on-navy"
          />
        </nav>
      </div>
      <div className="layout-content page-gutter mx-auto flex flex-wrap justify-between gap-2 border-t border-on-navy/10 py-5 text-micro text-on-navy-muted">
        <span>© {new Date().getFullYear()} Untiered</span>
        <span>Your voice. Your progress. Your call.</span>
      </div>
    </footer>
  );
}
