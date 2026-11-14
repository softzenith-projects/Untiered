import { notFound } from "next/navigation";

import { campusEnabled, campusLeadsEnabled, courseEnabled, featureEnabled, type ProductFeature } from "@/lib/flags";

export function requireFeature(feature: ProductFeature): void {
  if (!featureEnabled(feature)) notFound();
}

export function requireCourse(courseSlug: string): void {
  requireFeature("courses");
  if (!courseEnabled(courseSlug)) notFound();
}

export function requireArenaCourse(courseSlug: string): void {
  requireFeature("arena");
  if (!courseEnabled(courseSlug)) notFound();
}

/** Every `/campus` and `/admin/campus` page starts with this. */
export function requireCampus(): void {
  if (!campusEnabled()) notFound();
}

/** The lead review pages have their own switch, like the API's `/admin/campus/leads`. */
export function requireCampusLeads(): void {
  if (!campusLeadsEnabled()) notFound();
}
