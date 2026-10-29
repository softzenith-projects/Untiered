"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

import type { Block } from "@/content/courses/types";

/**
 * `ssr: false` only works from inside a Client Component (Next's rule, not a choice) —
 * which is the whole point of this file existing separately from `playground.tsx`.
 *
 * `block-renderer.tsx` is a Server Component and can import this wrapper normally, the
 * same way it imports `QuizBlock`/`VizBlock`. But *this* file's own `dynamic()` call is
 * what actually keeps CodeMirror and both language grammars out of the bundle a chapter
 * needs for its first paint and hydration: with `ssr: false`, Next does not need that
 * chunk to render or hydrate the page, so it is never folded into the one shared client
 * bundle every chapter under `/courses/[course]/[chapter]` otherwise loads — confirmed by
 * measuring the built output (see task 049's report): the same static import, without
 * `ssr: false`, measured byte-for-byte identical whether or not a chapter had a
 * playground block at all, because Next's SSR pass still needed the module to render the
 * initial HTML. The starter code and expected output are already real, server-rendered
 * text one level up in `block-renderer.tsx` — this component is purely the interactive
 * enhancement on top of that, so losing its SSR output costs nothing a search engine or a
 * no-JS reader was relying on.
 */
const Playground = dynamic(() => import("@/components/courses/playground").then((mod) => mod.Playground), {
  ssr: false,
  loading: () => <p className="px-4 py-3 text-caption text-ink-subtle">Loading the editor…</p>,
});

type PlaygroundBlockData = Extract<Block, { kind: "playground" }>;

/**
 * `children` is the static copy of the same code: shown until the editor has mounted and
 * then removed, so a reader sees the code once — never a read-only copy stacked above an
 * editable one holding the same program.
 */
export function PlaygroundLazy({
  block,
  title,
  autoFocus,
  children,
}: {
  block: PlaygroundBlockData;
  title?: string;
  autoFocus?: boolean;
  children?: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  return (
    <>
      {ready ? null : children}
      <Playground block={block} title={title} autoFocus={autoFocus} onReady={() => setReady(true)} />
    </>
  );
}
