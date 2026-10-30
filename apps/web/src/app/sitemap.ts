import type { MetadataRoute } from "next";

import { INDEXABLE_ROUTES, SITE_URL } from "@/lib/seo";

/**
 * No `lastModified`: nothing here tracks when a page last changed, and a build timestamp would
 * claim every page changed on every deploy, which teaches search engines to ignore the field.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_ROUTES.map((path) => ({ url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}` }));
}
