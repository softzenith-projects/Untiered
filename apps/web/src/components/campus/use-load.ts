"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiRequestError } from "@/lib/api";

/** What to tell a person when a campus call fails; the API's own message when it has one. */
export function errorText(cause: unknown, fallback = "That did not work. Try again in a moment."): string {
  return cause instanceof ApiRequestError && cause.message ? cause.message : fallback;
}

export interface LoadError {
  status: number | null;
  message: string;
}

export interface Loaded<T> {
  data: T | null;
  error: LoadError | null;
  loading: boolean;
  reload: () => void;
  setData: (next: T | ((current: T | null) => T | null)) => void;
}

/** Loads on mount and whenever `reload` is called. `load` must be stable (wrap in useCallback). */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setData(value);
        setError(null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError({
          status: cause instanceof ApiRequestError ? cause.status : null,
          message: errorText(cause, "This could not be loaded just now. Try again in a moment."),
        });
        setLoading(false);
      });
    return () => controller.abort();
  }, [load, tick]);

  const reload = useCallback(() => {
    setLoading(true);
    setTick((value) => value + 1);
  }, []);
  return { data, error, loading, reload, setData };
}
