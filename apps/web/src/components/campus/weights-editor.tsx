"use client";

import { useCallback, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { FieldLabel, Input } from "@/components/ui/field";
import { fetchReadinessWeights, updateReadinessWeights } from "@/lib/api";
import type { ReadinessWeights } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import { COMPONENT_KEYS, COMPONENT_LABEL } from "./readiness-model";
import { errorText, useLoad } from "./use-load";

type Draft = Record<(typeof COMPONENT_KEYS)[number], string>;

function toDraft(weights: ReadinessWeights): Draft {
  return Object.fromEntries(COMPONENT_KEYS.map((key) => [key, String(weights[key])])) as Draft;
}

function parse(value: string): number | null {
  return /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : null;
}

/** How much each component counts toward a student's overall readiness. Must add up to 100. */
export function WeightsEditor() {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback((signal: AbortSignal) => fetchReadinessWeights(orgId, { accessToken, signal }), [orgId, accessToken]);
  const { data, error } = useLoad(load);
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (!data) return <Skeleton className="h-40 w-full" />;
  return <WeightsForm initial={data} />;
}

function WeightsForm({ initial }: { initial: ReadinessWeights }) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsed = COMPONENT_KEYS.map((key) => parse(draft[key]));
  const allValid = parsed.every((value) => value !== null && value <= 100);
  const sum = parsed.reduce<number>((total, value) => total + (value ?? 0), 0);
  const valid = allValid && sum === 100;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setPending(true);
    setServerError(null);
    setSaved(false);
    try {
      const weights = Object.fromEntries(COMPONENT_KEYS.map((key) => [key, parse(draft[key]) ?? 0])) as unknown as ReadinessWeights;
      const result = await updateReadinessWeights(accessToken, orgId, weights);
      setDraft(toDraft(result));
      setSaved(true);
    } catch (cause) {
      setServerError(errorText(cause, "The weights could not be saved just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card p-6">
      <h2 id={`${id}-h`} className="text-heading text-ink">
        Readiness weights
      </h2>
      <p className="mt-1 max-w-prose text-caption text-ink-muted">
        How much each component counts toward a student&apos;s overall readiness. Whole numbers that add up to 100.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {COMPONENT_KEYS.map((key) => (
            <div key={key}>
              <FieldLabel htmlFor={`${id}-${key}`}>{COMPONENT_LABEL[key]}</FieldLabel>
              <Input
                id={`${id}-${key}`}
                inputMode="numeric"
                value={draft[key]}
                aria-invalid={parse(draft[key]) === null || (parse(draft[key]) ?? 0) > 100}
                onChange={(event) => {
                  setSaved(false);
                  setDraft({ ...draft, [key]: event.target.value });
                }}
              />
            </div>
          ))}
        </div>
        <p role="status" className={sum === 100 && allValid ? "text-caption text-positive" : "text-caption text-danger"}>
          {allValid ? `Total ${sum} of 100${sum === 100 ? "" : `. ${sum > 100 ? "Remove" : "Add"} ${Math.abs(100 - sum)} to reach 100.`}` : "Each weight must be a whole number from 0 to 100."}
        </p>
        {serverError ? <Alert tone="error">{serverError}</Alert> : null}
        {saved ? <Alert tone="success">Weights saved.</Alert> : null}
        <div>
          <Button type="submit" loading={pending} disabled={!valid}>
            Save weights
          </Button>
        </div>
      </form>
    </section>
  );
}
