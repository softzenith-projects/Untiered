import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CodeLanguageProvider } from "@/components/courses/code-language-context";
import { CourseRailProgress } from "@/components/courses/course-progress";
import { CourseSiteFooter, CourseSiteHeader } from "@/components/courses/course-site-header";
import { GuidedLesson } from "@/components/courses/guided-lesson";
import { CourseToc } from "@/components/courses/course-toc";
import { OnThisPage } from "@/components/courses/on-this-page";
import {
  courses,
  flattenChapters,
  getAdjacentChapters,
  getChapter,
  getCourse,
  getModuleForChapter,
} from "@/content/courses";
import { InlineText, plainText } from "@/components/courses/inline-text";
import { highlightChapterBlocks } from "@/lib/highlight-code";
import { toCourseTocData } from "@/lib/course-toc-data";
import { courseEnabled, featureEnabled } from "@/lib/flags";
import { requireCourse } from "@/lib/require-feature";

export function generateStaticParams() {
  if (!featureEnabled("courses")) return [];
  return courses.filter((course) => courseEnabled(course.slug)).flatMap((course) =>
    flattenChapters(course).map((chapter) => ({ course: course.slug, chapter: chapter.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ course: string; chapter: string }>;
}): Promise<Metadata> {
  const { course: courseSlug, chapter: chapterSlug } = await params;
  if (!featureEnabled("courses") || !courseEnabled(courseSlug)) return {};
  const chapter = getChapter(courseSlug, chapterSlug);
  if (!chapter) return {};
  return {
    title: plainText(chapter.title),
    description: plainText(chapter.summary),
  };
}

function InterviewPracticeIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M8 10.5a4 4 0 1 1 8 0v2a4 4 0 1 1-8 0v-2Z" />
      <path d="M5.5 12.5a6.5 6.5 0 0 0 13 0M12 19v3M9 22h6" />
    </svg>
  );
}

function ArenaPracticeIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="m12 3 7 4v5c0 4.5-2.9 7.4-7 9-4.1-1.6-7-4.5-7-9V7l7-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/**
 * The chapter reader: course navigation on the left, a guided five-beat lesson in the
 * main track, and previous/next chapter navigation at the bottom (task 059).
 *
 * The lesson track is fluid (`minmax(0,1fr)`), not a fixed prose width (task 052) —
 * prose blocks (paragraphs, asides, lists) cap themselves at 70ch in `BlockRenderer` so a
 * sentence never gets harder to read, but `viz`/`code`/`table`/`compare`/`steps`/
 * `playground` blocks fill the whole track, so a 1920px screen gives a diagram real room
 * instead of squeezing it into a text column that never wanted it.
 */
export default async function ChapterPage({
  params,
}: {
  params: Promise<{ course: string; chapter: string }>;
}) {
  const { course: courseSlug, chapter: chapterSlug } = await params;
  requireCourse(courseSlug);
  const course = getCourse(courseSlug);
  if (!course) notFound();
  const chapter = getChapter(courseSlug, chapterSlug);
  if (!chapter) notFound();

  const chapterModule = getModuleForChapter(course, chapterSlug);
  const { prev, next } = getAdjacentChapters(course, chapterSlug);
  const mockInterviewsEnabled = featureEnabled("mockInterviews");
  const arenaEnabled = featureEnabled("arena");
  const courseToc = toCourseTocData(course);
  const interviewTopic = `${plainText(course.title)}: ${plainText(chapter.title)}`;
  const topicInterviewHref = `/interview/new?topic=${encodeURIComponent(interviewTopic)}` as Route;
  const chapterRefs = flattenChapters(course).map((item) => ({ slug: item.slug, title: item.title }));
  // Shiki runs here, at build time (this page is statically generated via
  // generateStaticParams), so the highlighted HTML ships with the page and zero
  // highlighting JS reaches the browser (task 049).
  const highlightedCode = await highlightChapterBlocks(chapter.blocks, course.codeLanguage ?? "java");

  return (
    <div className="chapter-page-bg min-h-dvh">
      <CourseSiteHeader />
      <main className="layout-reader mx-auto w-full px-4 py-6 sm:px-7 lg:px-8 lg:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-2 font-mono text-micro tracking-widest text-ink-subtle uppercase">
          <Link href="/courses" className="transition-colors hover:text-accent">Courses</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/courses/${course.slug}`} className="transition-colors hover:text-accent">{course.title}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-ink-muted">{chapterModule?.title ?? "Chapter"}</span>
        </div>

        <div className="chapter-layout-grid">
          <CourseToc course={courseToc} currentSlug={chapter.slug} />

          <article className="min-w-0">
            <header className="relative overflow-hidden rounded-3xl border border-line bg-surface-raised px-6 py-7 shadow-[var(--shadow-sm)] sm:px-8 sm:py-9">
              <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent via-accent to-positive" />
              <div className="relative max-w-[72ch]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill pill-accent">{chapterModule?.title ?? course.title}</span>
                  <span className="pill bg-surface-sunken text-ink-muted">{chapter.minutes} min lesson</span>
                </div>
                <h1 className="mt-5 text-display text-balance text-ink"><InlineText text={chapter.title} /></h1>
                <p className="mt-4 max-w-[65ch] text-body leading-relaxed text-ink-muted">{chapter.summary}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {mockInterviewsEnabled ? (
                    <Link href={topicInterviewHref} className="action-primary">
                      <InterviewPracticeIcon />
                      Practise in an interview
                    </Link>
                  ) : null}
                  {arenaEnabled ? (
                    <Link href={`/arena/${course.slug}`} className="action-secondary">
                      <ArenaPracticeIcon />
                      Open course Arena
                    </Link>
                  ) : null}
                </div>
              </div>
            </header>

            <div className="mt-7">
              <CodeLanguageProvider>
                <GuidedLesson
                  blocks={chapter.blocks}
                  chapterSlug={chapter.slug}
                  courseSlug={course.slug}
                  highlightedCode={highlightedCode}
                />
              </CodeLanguageProvider>
            </div>

            <nav aria-label="Chapter navigation" className="mt-8 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
              {prev ? (
                <Link href={`/courses/${course.slug}/${prev.slug}`} className="group flex min-h-24 flex-col justify-center rounded-2xl border border-line bg-surface-raised px-5 py-4 text-caption shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[var(--shadow-md)]">
                  <span className="font-mono text-micro text-ink-subtle uppercase">← Previous chapter</span>
                  <span className="mt-1 font-semibold text-ink group-hover:text-accent"><InlineText text={prev.title} /></span>
                </Link>
              ) : <span />}
              {next ? (
                <Link href={`/courses/${course.slug}/${next.slug}`} className="group flex min-h-24 items-center justify-between gap-5 overflow-hidden rounded-2xl border border-accent bg-[linear-gradient(120deg,var(--accent),var(--accent-strong))] px-5 py-5 text-accent-contrast shadow-[var(--shadow-md)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] sm:px-6">
                  <span className="min-w-0">
                  <span className="block text-micro font-bold tracking-widest text-accent-contrast/80 uppercase">Up next · keep your momentum</span>
                    <span className="mt-2 block text-heading font-semibold leading-snug"><InlineText text={next.title} /></span>
                  </span>
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border border-on-navy/25 bg-on-navy/15 text-heading transition-transform group-hover:translate-x-1">→</span>
                </Link>
              ) : <span />}
            </nav>
          </article>

          <aside aria-label="Lesson tools" className="hidden space-y-5 xl:sticky xl:top-24 xl:block xl:self-start">
            <section className="rounded-2xl border border-accent/25 bg-[linear-gradient(145deg,var(--accent-wash),var(--surface-raised))] p-5 shadow-[var(--shadow-sm)]">
              <p className="text-micro font-bold tracking-widest text-accent uppercase">Learning progress</p>
              <div className="mt-3"><CourseRailProgress courseSlug={course.slug} chapters={chapterRefs} /></div>
            </section>
            {arenaEnabled ? (
              <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)]">
                <span className="grid size-9 place-items-center rounded-xl bg-warning-wash text-warning"><ArenaPracticeIcon className="size-5" /></span>
              <h2 className="font-editorial mt-3 text-heading leading-tight text-ink">Make it stick</h2>
                <p className="mt-1 text-caption leading-relaxed text-ink-muted">Work through a course scenario and its follow-up decisions.</p>
                <Link href={`/arena/${course.slug}`} className="mt-4 inline-flex text-caption font-semibold text-accent hover:underline">Open course Arena →</Link>
              </section>
            ) : null}
            <section className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)]">
              <OnThisPage blocks={chapter.blocks} />
            </section>
          </aside>
        </div>
      </main>
      <CourseSiteFooter />
    </div>
  );
}
