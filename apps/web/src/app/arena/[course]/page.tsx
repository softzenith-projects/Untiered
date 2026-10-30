import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ArenaCoursePractice } from "@/components/arena/arena-course-practice";
import { Card } from "@/components/ui/card";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { courses, getCourse } from "@/content/courses";
import { courseEnabled, featureEnabled } from "@/lib/flags";
import { requireArenaCourse } from "@/lib/require-feature";

export function generateStaticParams() {
  if (!featureEnabled("arena")) return [];
  return courses.filter((course) => courseEnabled(course.slug)).map((course) => ({ course: course.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ course: string }> }): Promise<Metadata> {
  const { course: slug } = await params;
  const course = getCourse(slug);
  return course ? { title: `${course.title} — Arena`, description: `Scenario practice for ${course.title}.` } : {};
}

export default async function ArenaCoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  requireArenaCourse(slug);
  const course = getCourse(slug);
  if (!course) notFound();
  return (
    <AppShell breadcrumb={course.title.toLowerCase()} parent={{ label: "arena", href: "/arena" }}>
      <div className="space-y-8"><SurfaceHeader eyebrow="Scenario practice" title={`${course.title} Arena`} description={course.tagline} />
        <Card className="p-6 md:p-8"><ArenaCoursePractice key={slug} courseSlug={slug} /></Card>
      </div>
    </AppShell>
  );
}
