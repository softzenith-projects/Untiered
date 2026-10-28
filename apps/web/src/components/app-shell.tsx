import type { Route } from "next";

/**
 * The body of a signed-in page.
 *
 * The bar, backdrop and footer around it are `AppChrome`, mounted once in the root layout
 * so they survive navigation. This only sets the page's width and padding — which is why a
 * page and its `loading.tsx` can both render it without the frame being rebuilt.
 *
 * Deliberately not applied to the interview room. That page is near-empty by design and
 * a navigation rail beside a live interview would be an invitation to leave it.
 */
export function AppShell({
  wide = false,
  children,
}: {
  /** Retained for route compatibility; page-level breadcrumb strips are intentionally hidden. */
  breadcrumb?: string;
  /** Retained for route compatibility while nested pages move navigation into their own content. */
  parent?: { label: string; href: Route };
  /** Gives document-like tools (such as the chapter reader) room for their own local navigation. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    /*
     * Wide enough to compose in, capped so a line of prose never runs the width of a
     * monitor. The page used to be a 768px column pinned to the left of whatever
     * screen it was on, with the entire right-hand side empty — not restraint, just
     * an unused canvas.
     */
    <main
      className={`page-gutter mx-auto w-full flex-1 py-8 md:py-14 ${
        wide ? "layout-wide" : "layout-content"
      }`}
    >
      {children}
    </main>
  );
}
