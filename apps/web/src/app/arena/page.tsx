import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CourseArtwork } from "@/components/courses/course-visuals";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { courses } from "@/content/courses";
import { courseEnabled } from "@/lib/flags";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = { title: "Arena — Untiered", description: "Course-specific scenario practice." };

export default function ArenaPage() {
  requireFeature("arena");
  const visibleCourses = courses.filter((course) => courseEnabled(course.slug));
  if (visibleCourses.length === 0) notFound();
  return (
    <AppShell breadcrumb="arena"><div className="space-y-8">
      <SurfaceHeader eyebrow="Arena" title="Practise decisions, not flashcards" description="Choose a course and work through a real-world situation with deeper probes at every step." />
      <div className="grid gap-5 md:grid-cols-2">{visibleCourses.map((course) => (
        <Link key={course.slug} href={`/arena/${course.slug}`} className="card card-interactive group overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"><CourseArtwork courseSlug={course.slug} /><div className="p-5"><h2 className="text-heading text-ink group-hover:text-accent">{course.title}</h2><p className="mt-2 text-caption text-ink-muted">{course.tagline}</p><p className="mt-4 font-semibold text-accent">Open Arena →</p></div></Link>
      ))}</div>
    </div></AppShell>
  );
}
