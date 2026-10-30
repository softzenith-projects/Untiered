"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CourseCardProgress } from "@/components/courses/course-progress";
import { CourseArtwork } from "@/components/courses/course-visuals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/feedback";

export type CatalogueCourse = {
  slug: string;
  title: string;
  tagline: string;
  level: string;
  chapterCount: number;
  chapters: { slug: string; title: string }[];
  searchText: string;
};

const CATEGORY: Record<string, string> = {
  java: "Programming",
  javascript: "Programming",
  dsa: "DSA",
  "ai-agents": "AI",
  "system-design": "System Design",
};

export function CourseCatalogue({ courses }: { courses: CatalogueCourse[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filters = ["All", ...new Set(courses.map((course) => CATEGORY[course.slug] ?? "Other"))];
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return courses.filter((course) =>
      (filter === "All" || CATEGORY[course.slug] === filter) &&
      (!term || course.searchText.includes(term)),
    );
  }, [courses, filter, query]);

  return (
    <section aria-labelledby="learning-paths" className="mt-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-accent">Choose your focus</p>
          <h2 id="learning-paths" className="mt-2 text-title font-bold text-ink">Find your next breakthrough</h2>
          <p className="mt-1 text-caption text-ink-muted">Pick up where you left off, or learn something new.</p>
        </div>
        <span className="text-caption text-ink-muted">{courses.length} learning paths</span>
      </div>

      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-md">
          <span className="sr-only">Search courses and concepts</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-subtle"><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 5 5" strokeLinecap="round" /></svg>
          <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses and concepts" className="min-h-12 pl-12" />
        </label>
        <div aria-label="Filter courses" className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:pb-0">
          {filters.map((item) => (
            <Button key={item} variant={filter === item ? "primary" : "secondary"} size="sm" aria-pressed={filter === item} onClick={() => setFilter(item)} className="shrink-0 rounded-full">{item}</Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No courses found" description="Try a concept like arrays, recursion, or agents." action={<Button variant="ghost" onClick={() => { setQuery(""); setFilter("All"); }}>Clear search and filters</Button>} />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <li key={course.slug} className="min-w-0">
              <Link href={`/courses/${course.slug}`} className="card card-interactive group flex h-full flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                <CourseArtwork courseSlug={course.slug} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="eyebrow text-accent">{CATEGORY[course.slug] ?? "Learning"}</p>
                    <span className="shrink-0 text-right text-micro font-semibold text-ink-subtle">{course.level.startsWith("Beginner") ? "Beginner" : course.level}</span>
                  </div>
                  <h3 className="mt-3 text-heading font-bold text-ink transition-colors group-hover:text-accent">{course.title}</h3>
                  <p className="mt-1.5 line-clamp-2 min-h-10 text-caption leading-relaxed text-ink-muted">{course.tagline}</p>
                  <div className="mt-auto pt-5">
                    <div className="flex items-end justify-between gap-3 text-caption">
                      <span className="text-ink-muted">{course.chapterCount} interactive chapters</span>
                      <span className="font-semibold text-accent">Explore <span aria-hidden="true">→</span></span>
                    </div>
                    <div className="mt-3"><CourseCardProgress courseSlug={course.slug} chapters={course.chapters} /></div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
