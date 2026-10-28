"use client";

import { useRef } from "react";

/**
 * A row of pill tabs with the keyboard behaviour the ARIA tabs pattern expects: one tab
 * in the tab order, arrow keys move between them, Home/End jump to the ends. Shared by
 * the landing page's interactive pieces so they behave identically.
 */
export function SegmentedTabs<T extends string>({
  label,
  options,
  value,
  onChange,
  idPrefix,
  tone = "light",
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  idPrefix: string;
  tone?: "light" | "navy";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const last = options.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    const target = options[next];
    if (!target) return;
    onChange(target.id);
    refs.current[next]?.focus();
  }

  const idle = tone === "navy" ? "text-on-navy-muted hover:text-on-navy" : "text-ink-muted hover:text-ink";
  const active = tone === "navy" ? "bg-on-navy text-navy shadow-[var(--shadow-sm)]" : "bg-surface-raised text-ink shadow-[var(--shadow-sm)]";
  const track = tone === "navy" ? "bg-navy-raised" : "bg-surface-sunken";

  return (
    <div role="tablist" aria-label={label} className={`flex w-full gap-1 overflow-x-auto rounded-full p-1 ${track}`}>
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${option.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`min-h-9 shrink-0 grow rounded-full px-3.5 text-caption font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${selected ? active : idle}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
