import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ChapterDoneMark, ChapterLink, CourseHeroProgress, ModuleProgress } from "@/components/courses/course-progress";
import { CourseMotif, getCoursePresentation } from "@/components/courses/course-visuals";
import { courses, getCourse, totalChapters, totalMinutes } from "@/content/courses";
import { InlineText } from "@/components/courses/inline-text";
import { courseEnabled, featureEnabled } from "@/lib/flags";
import { requireCourse } from "@/lib/require-feature";
import { courseJsonLd, publicPageMetadata, serializeJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  if (!featureEnabled("courses")) return [];
  return courses.filter((course) => courseEnabled(course.slug)).map((course) => ({ course: course.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string }>;
}): Promise<Metadata> {
  const { course: slug } = await params;
  if (!featureEnabled("courses") || !courseEnabled(slug)) return {};
  const course = getCourse(slug);
  if (!course) return {};
  return publicPageMetadata({
    title: course.seoTitle,
    description: `${course.seoDescription} ${totalChapters(course)} chapters.`,
    path: `/courses/${course.slug}`,
  });
}

/** A course's home page: hero band, module-by-module chapter list, start CTA. */
export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  requireCourse(slug);
  const course = getCourse(slug);
  if (!course) notFound();
  const presentation = getCoursePresentation(course.slug);

  return (
    <AppShell breadcrumb={course.title.toLowerCase()} parent={{ label: "courses", href: "/courses" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(courseJsonLd(course)) }} />
      <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-surface-raised p-7 shadow-[var(--shadow-md)] md:p-10">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent via-positive to-warning" />
        <div className="course-hero-grid">
          <div>
            <div className="flex items-center gap-4">
              <CourseMotif courseSlug={course.slug} large />
              <div>
                <p className="font-mono text-micro tracking-widest text-accent uppercase">{presentation.shortLabel} learning path</p>
                <p className="mt-1 text-caption text-ink-muted">{course.level}</p>
              </div>
            </div>
            <h1 className="mt-7 text-hero text-balance text-ink">{course.title}</h1>
            <p className="mt-4 max-w-2xl text-body leading-relaxed text-ink-muted">{course.tagline}</p>
            <p className="mt-5 max-w-xl text-caption font-medium text-ink">Outcome: {presentation.outcome}</p>
            <div className="mt-7">
              <CourseHeroProgress
                courseSlug={course.slug}
                chapters={course.modules.flatMap((m) => m.chapters.map((c) => ({ slug: c.slug, title: c.title })))}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-surface-sunken p-6" aria-label="Course journey overview">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Your route</p>
                <p className="mt-1 text-heading text-ink">{course.modules.length} milestones</p>
              </div>
              <p className="font-mono text-micro text-ink-subtle">{totalChapters(course)} chapters · {totalMinutes(course)} min</p>
            </div>
            <ol className="relative mt-6 space-y-0 before:absolute before:bottom-5 before:left-4 before:top-5 before:w-px before:bg-line-strong">
              {course.modules.map((module, index) => (
                <li key={module.title} className="relative flex items-center gap-4 py-2.5">
                  <span className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border border-accent/25 bg-surface-raised font-mono text-micro font-semibold text-accent shadow-[var(--shadow-sm)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-caption font-medium text-ink">{module.title}</p>
                    <p className="font-mono text-micro text-ink-subtle">{module.chapters.length} chapters</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="curriculum" className="mt-12">
        <div className="mb-6">
          <p className="font-mono text-micro tracking-widest text-accent uppercase">Course roadmap</p>
          <h2 id="curriculum" className="mt-2 text-heading text-ink">Build skill one milestone at a time</h2>
        </div>
        <ol className="relative space-y-5 before:absolute before:bottom-8 before:left-6 before:top-8 before:w-px before:bg-line-strong md:before:left-8">
          {course.modules.map((module, mi) => (
            <li key={module.title} className="relative pl-14 md:pl-20">
              <span className="absolute left-0 top-6 z-10 grid size-12 place-items-center rounded-2xl border border-accent/25 bg-accent-wash font-mono text-caption font-semibold text-accent shadow-[var(--shadow-sm)] md:left-2">
                {String(mi + 1).padStart(2, "0")}
              </span>
              <article className="overflow-hidden rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] md:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div>
                    <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Milestone {mi + 1}</p>
                    <h3 className="mt-1 text-heading text-ink">{module.title}</h3>
                  </div>
                  <ModuleProgress courseSlug={course.slug} chapterSlugs={module.chapters.map((c) => c.slug)} />
                </div>
                <ol className="mt-5 grid gap-1 border-t border-line pt-3 lg:grid-cols-2 lg:gap-x-8">
                  {module.chapters.map((chapter, ci) => (
                    <li key={chapter.slug}>
                      <ChapterLink
                        href={`/courses/${course.slug}/${chapter.slug}`}
                        className="flex items-center justify-between gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <ChapterDoneMark courseSlug={course.slug} chapterSlug={chapter.slug} />
                          <span className="font-mono text-micro text-ink-subtle">{mi + 1}.{ci + 1}</span>
                          <span className="truncate text-caption text-ink"><InlineText text={chapter.title} /></span>
                        </span>
                        <span className="shrink-0 font-mono text-micro text-ink-subtle">{chapter.minutes} min</span>
                      </ChapterLink>
                    </li>
                  ))}
                </ol>
              </article>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
