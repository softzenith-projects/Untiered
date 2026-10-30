import type { MetadataRoute } from "next";

import { isProductionDeployment, SITE_URL } from "@/lib/seo";

/**
 * Signed-in routes are left crawlable on purpose. They redirect to /login, which is noindex,
 * and that is what keeps them out of results: a URL blocked here can still be indexed from
 * links to it, because the crawler never sees the redirect. The landing page links to several.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
