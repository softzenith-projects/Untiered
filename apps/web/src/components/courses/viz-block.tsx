"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";

import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";
import { LESSON_BUTTON, LessonPanel } from "@/components/courses/lesson-box";
import { ArrayViz } from "@/components/courses/viz/array-viz";
import { ListViz } from "@/components/courses/viz/list-viz";
import { SeqViz } from "@/components/courses/viz/seq-viz";
import { TreeViz } from "@/components/courses/viz/tree-viz";
import { GraphViz } from "@/components/courses/viz/graph-viz";
import { GridViz } from "@/components/courses/viz/grid-viz";
import { CallStackViz } from "@/components/courses/viz/callstack-viz";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

type VizBlockData = Extract<Block, { kind: "viz" }>;

const PLAY_INTERVAL_MS = 1600;

/**
 * A step-through visual with previous/next/play/reset controls and a step slider (task
 * 047). Frame 0 is what the server renders — a reader with JS off, or a search engine,
 * still sees the diagram and its note; the controls are the only thing JS adds.
 */
export function VizBlock({ block }: { block: VizBlockData }) {
  const total = frameCount(block.viz);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const sliderId = useId();

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const id = window.setInterval(() => {
      setStep((current) => {
        if (current >= total - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [playing, reducedMotion, total]);

  function goTo(index: number) {
    setStep(Math.max(0, Math.min(total - 1, index)));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(step + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(step - 1);
    }
  }

  const note = noteAt(block.viz, step);

  return (
    <LessonPanel label="Step through" title={<InlineText text={block.title} />}>
      {block.caption ? (
        <p className="text-caption leading-relaxed text-ink-muted">
          <InlineText text={block.caption} />
        </p>
      ) : null}

      <div className={`${block.caption ? "mt-4 " : ""}flex justify-center rounded-lg border border-line bg-surface px-3 py-5`} onKeyDown={handleKeyDown}>
        <ShapeView viz={block.viz} step={step} />
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-caption leading-relaxed text-ink-muted">
        <InlineText text={note} />
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            goTo(step - 1);
          }}
          disabled={step === 0}
          className={LESSON_BUTTON}
        >
          Previous
        </button>
        {!reducedMotion && total > 1 ? (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className={LESSON_BUTTON}
          >
            {playing ? "Pause" : "Play"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            goTo(step + 1);
          }}
          disabled={step === total - 1}
          className={LESSON_BUTTON}
        >
          Next
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            goTo(0);
          }}
          className={LESSON_BUTTON}
        >
          Reset
        </button>

        <div className="ml-auto flex items-center gap-2.5">
          <label htmlFor={sliderId} className="text-micro text-ink-subtle">
            Step {step + 1} of {total}
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={step}
            onChange={(event) => {
              setPlaying(false);
              goTo(Number(event.target.value));
            }}
            aria-valuetext={`Step ${step + 1} of ${total}: ${note}`}
            className="accent-[var(--accent)]"
          />
        </div>
      </div>
    </LessonPanel>
  );
}

function frameCount(viz: VizBlockData["viz"]): number {
  return viz.frames.length;
}

function noteAt(viz: VizBlockData["viz"], step: number): string {
  return viz.frames[Math.min(step, viz.frames.length - 1)]?.note ?? "";
}

function ShapeView({ viz, step }: { viz: VizBlockData["viz"]; step: number }) {
  const index = Math.min(step, viz.frames.length - 1);
  switch (viz.type) {
    case "array":
      return <ArrayViz frame={viz.frames[index]!} />;
    case "list":
      return <ListViz frame={viz.frames[index]!} />;
    case "stack":
    case "queue":
      return <SeqViz frame={viz.frames[index]!} type={viz.type} />;
    case "tree":
      return <TreeViz frame={viz.frames[index]!} />;
    case "graph":
      return <GraphViz frame={viz.frames[index]!} />;
    case "table":
      return <GridViz frame={viz.frames[index]!} />;
    case "callstack":
      return <CallStackViz frame={viz.frames[index]!} />;
  }
}
