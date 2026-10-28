"use client";

import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import type { DragEndEvent } from "@dnd-kit/react";
import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { LESSON_BUTTON, LESSON_BUTTON_PRIMARY, LessonLabel } from "@/components/courses/lesson-box";
import type {
  ArchitectureCheck,
  ArchitectureComponent,
  ArchitecturePlacement,
  ArchitectureScenario,
  ArchitectureZone,
} from "@/lib/architecture-lab/types";
import {
  emptyArchitecturePlacement,
  validateArchitecture,
} from "@/lib/architecture-lab/validate";

const BANK_ID = "unplaced";

function DraggableComponent({
  component,
  zones,
  currentZoneId,
  result,
  onMove,
}: {
  component: ArchitectureComponent;
  zones: ArchitectureZone[];
  currentZoneId: string | null;
  result?: ArchitectureCheck["results"][string];
  onMove: (componentId: string, zoneId: string | null) => void;
}) {
  const { ref, handleRef, isDragging } = useDraggable({
    id: `component:${component.id}`,
    data: { componentId: component.id },
  });

  return (
    <article
      ref={ref}
      className={`rounded-lg border bg-surface-raised p-3 transition motion-reduce:transition-none ${
        result ? (result.correct ? "border-positive/50" : "border-danger/50") : "border-line"
      } ${isDragging ? "opacity-50 shadow-lg" : "opacity-100"}`}
      data-component-id={component.id}
    >
      <div className="flex items-start gap-2">
        <button
          ref={handleRef}
          type="button"
          style={{ touchAction: "none" }}
          className="mt-0.5 shrink-0 cursor-grab rounded-md border border-line bg-surface-sunken px-2 py-1 font-mono text-micro text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:cursor-grabbing"
          aria-label={`Drag ${component.label}. Press Space or Enter to pick it up, then use arrow keys and press Space or Enter to drop.`}
        >
          Move
        </button>
        <div className="min-w-0">
          <h4 className="text-caption font-semibold text-ink">{component.label}</h4>
          <p className="mt-1 text-caption leading-relaxed text-ink-muted">{component.description}</p>
        </div>
      </div>

      <label className="mt-3 block text-micro font-medium text-ink-muted">
        Move without dragging
        <select
          className="mt-1 w-full rounded-md border border-line-strong bg-surface-raised px-2 py-2 text-caption text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          value={currentZoneId ?? BANK_ID}
          onChange={(event) => onMove(component.id, event.target.value === BANK_ID ? null : event.target.value)}
          aria-label={`Move ${component.label} to a zone`}
        >
          <option value={BANK_ID}>Component tray</option>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
        </select>
      </label>

      {result ? (
        <p className={`mt-2 text-caption leading-relaxed ${result.correct ? "text-positive" : "text-danger"}`}>
          <span className="font-semibold">{result.correct ? "Works: " : "Try again: "}</span>
          {result.message}
        </p>
      ) : null}
    </article>
  );
}

function DropZone({
  zone,
  children,
}: {
  zone: ArchitectureZone | null;
  children: ReactNode;
}) {
  const zoneId = zone?.id ?? BANK_ID;
  const { ref, isDropTarget } = useDroppable({ id: `zone:${zoneId}`, data: { zoneId } });
  return (
    <section
      ref={ref}
      className={`min-h-40 rounded-lg border-2 border-dashed p-4 transition motion-reduce:transition-none ${
        isDropTarget ? "border-accent bg-accent-wash" : "border-line bg-surface-sunken/70"
      }`}
      aria-label={zone ? `${zone.label} drop zone` : "Unplaced components"}
    >
      <h3 className="text-caption font-semibold text-ink">{zone?.label ?? "Component tray"}</h3>
      <p className="mt-1 min-h-10 text-micro leading-relaxed text-ink-muted">
        {zone?.description ?? "Start here. Move every component into the architecture."}
      </p>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function ArchitectureLab({ scenario }: { scenario: ArchitectureScenario }) {
  const headingId = useId();
  const [placement, setPlacement] = useState<ArchitecturePlacement>(() => emptyArchitecturePlacement(scenario));
  const [check, setCheck] = useState<ArchitectureCheck | null>(null);
  const [announcement, setAnnouncement] = useState("Architecture lab ready.");

  const componentsByZone = useMemo(() => {
    const grouped: Record<string, ArchitectureComponent[]> = { [BANK_ID]: [] };
    for (const zone of scenario.zones) grouped[zone.id] = [];
    for (const component of scenario.components) {
      grouped[placement[component.id] ?? BANK_ID]?.push(component);
    }
    return grouped;
  }, [placement, scenario]);

  function moveComponent(componentId: string, zoneId: string | null) {
    const component = scenario.components.find(({ id }) => id === componentId);
    const zone = scenario.zones.find(({ id }) => id === zoneId);
    if (!component || (zoneId !== null && !zone)) return;
    setPlacement((current) => ({ ...current, [componentId]: zoneId }));
    setCheck(null);
    setAnnouncement(`${component.label} moved to ${zone?.label ?? "the component tray"}.`);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled || !event.operation.source || !event.operation.target) return;
    const componentId = String(event.operation.source.id).replace(/^component:/, "");
    const targetId = String(event.operation.target.id).replace(/^zone:/, "");
    moveComponent(componentId, targetId === BANK_ID ? null : targetId);
  }

  function checkDesign() {
    const result = validateArchitecture(scenario, placement);
    setCheck(result);
    setAnnouncement(result.correct
      ? `${scenario.successMessage} All ${result.totalCount} components work.`
      : `${result.placedCount} of ${result.totalCount} components placed. Review the marked components.`);
  }

  function resetDesign() {
    setPlacement(emptyArchitecturePlacement(scenario));
    setCheck(null);
    setAnnouncement("Design reset. All components returned to the tray.");
  }

  const tile = (component: ArchitectureComponent) => (
    <DraggableComponent
      key={component.id}
      component={component}
      zones={scenario.zones}
      currentZoneId={placement[component.id] ?? null}
      result={check?.results[component.id]}
      onMove={moveComponent}
    />
  );

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface-raised" aria-labelledby={headingId}>
      <div className="border-b border-line bg-surface-sunken px-5 py-4 sm:px-6">
        <LessonLabel>Architecture lab</LessonLabel>
        <h3 id={headingId} className="mt-1 text-heading font-semibold text-ink">{scenario.title}</h3>
        <p className="mt-2 max-w-3xl text-body leading-relaxed text-ink-muted">{scenario.brief}</p>
        <p className="mt-3 text-caption text-ink-muted">
          Drag the cards, use the keyboard on each <strong>Move</strong> button, or use the always-visible selects.
          More than one placement can be valid.
        </p>
      </div>

      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,2fr)]">
          <DropZone zone={null}>{componentsByZone[BANK_ID]?.map(tile)}</DropZone>
          <div className="grid gap-4 sm:grid-cols-2">
            {scenario.zones.map((zone) => (
              <DropZone key={zone.id} zone={zone}>{componentsByZone[zone.id]?.map(tile)}</DropZone>
            ))}
          </div>
        </div>
      </DragDropProvider>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={checkDesign}
          className={LESSON_BUTTON_PRIMARY}
        >
          Check architecture
        </button>
        <button
          type="button"
          onClick={resetDesign}
          className={LESSON_BUTTON}
        >
          Reset
        </button>
        {check ? (
          <p role="status" className={`text-caption font-medium ${check.correct ? "text-positive" : "text-danger"}`}>
            {check.correct ? scenario.successMessage : `${check.placedCount}/${check.totalCount} placed — review the marked cards.`}
          </p>
        ) : null}
      </div>

      <details className="border-t border-line px-5 py-4 text-caption text-ink-muted sm:px-6">
        <summary className="cursor-pointer font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">Open-source references</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {scenario.sources.map((source) => (
            <li key={source.url}>
              <a className="text-accent underline underline-offset-2" href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>{" "}({source.license}) — the exercise and wording here are original.
            </li>
          ))}
        </ul>
      </details>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </section>
  );
}
