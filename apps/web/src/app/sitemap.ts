import type { MetadataRoute } from "next";

import { courses } from "@/content/courses";
import { courseEnabled, featureEnabled } from "@/lib/flags";
import { INDEXABLE_ROUTES, SITE_URL } from "@/lib/seo";

/** A switched-off course 404s, so it must not be submitted, and nor must an empty catalogue. */
function courseRoutes(): string[] {
  if (!featureEnabled("courses")) return [];
  const visible = courses.filter((course) => courseEnabled(course.slug));
  return visible.length === 0 ? [] : ["/courses", ...visible.map((course) => `/courses/${course.slug}`)];
}

/**
 * No `lastModified`: nothing here tracks when a page last changed, and a build timestamp would
 * claim every page changed on every deploy, which teaches search engines to ignore the field.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [...INDEXABLE_ROUTES, ...courseRoutes()].map((path) => ({ url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}` }));
}
