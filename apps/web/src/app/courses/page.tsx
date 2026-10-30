import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CourseCatalogue } from "@/components/courses/course-catalogue";
import { DailyChallengeBanner } from "@/components/courses/daily-challenge-banner";
import { ImportBrowserProgress } from "@/components/courses/import-browser-progress";
import { courses, totalChapters } from "@/content/courses";
import { dailyQuestionsByDate } from "@/lib/arena/daily-question";
import { courseEnabled, featureEnabled } from "@/lib/flags";
import { requireFeature } from "@/lib/require-feature";
import { publicPageMetadata } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = publicPageMetadata({
  title: "Free Courses for Software Engineering Interviews",
  description: "Free interactive courses in Java, JavaScript, data structures, AI agents and system design: short chapters with runnable examples and quick checks.",
  path: "/courses",
});
export const dynamic = "force-dynamic";

async function isSignedIn(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims.sub);
}

export default async function CoursesPage() {
  requireFeature("courses");
  const visibleCourses = courses.filter((course) => courseEnabled(course.slug));
  if (visibleCourses.length === 0) notFound();
  const lessonCount = visibleCourses.reduce((total, course) => total + totalChapters(course), 0);
  const catalogue = visibleCourses.map((course) => ({
    slug: course.slug,
    title: course.title,
    tagline: course.tagline,
    level: course.level,
    chapterCount: totalChapters(course),
    chapters: course.modules.flatMap((module) => module.chapters.map((chapter) => ({ slug: chapter.slug, title: chapter.title }))),
    searchText: [course.title, course.tagline, ...course.modules.flatMap((module) => [module.title, ...module.chapters.map((chapter) => chapter.title)])].join(" ").toLocaleLowerCase(),
  }));

  // The banner's props hold the day's Arena question and its answer. This page is public and
  // the Arena is not, so a signed-out visitor must not be sent them at all, even unrendered.
  const showDailyChallenge = featureEnabled("arena") && (await isSignedIn());

  return (
    <AppShell breadcrumb="courses">
      <ImportBrowserProgress />
      <header className="hero-band relative overflow-hidden px-7 py-10 md:px-10 md:py-12">
        <div className="courses-hero-grid relative">
          <div className="max-w-3xl">
            <p className="eyebrow text-accent-on-navy">Free interview preparation courses</p>
            <h1 className="mt-4 text-display text-balance text-on-navy">Build skills that stick.</h1>
            <p className="mt-3 max-w-2xl text-body leading-relaxed text-on-navy-muted">Short, interactive chapters with runnable examples, visual explanations and quick checks. No passive video queue.</p>
          </div>
          <div className="border-on-navy/15 lg:border-l lg:pl-10">
            <p className="text-display text-on-navy">{lessonCount}</p>
            <p className="mt-1 text-caption text-on-navy-muted">free interactive chapters</p>
          </div>
        </div>
      </header>
      {showDailyChallenge ? <DailyChallengeBanner questionsByDate={dailyQuestionsByDate()} levelsByCourse={Object.fromEntries(visibleCourses.map((course) => [course.slug, course.level.startsWith("Beginner") ? "Beginner" : (course.level.split(" — ")[0] ?? course.level)]))} /> : null}
      <CourseCatalogue courses={catalogue} />
    </AppShell>
  );
}
