"use client";

import { useSyncExternalStore } from "react";

import { type AnalyticsConsent, readConsent, subscribeToConsent } from "@/lib/analytics";

/** The visitor's analytics choice, or null on the server and during hydration. */
export function useAnalyticsConsent(): AnalyticsConsent | null {
  return useSyncExternalStore<AnalyticsConsent | null>(subscribeToConsent, readConsent, () => null);
}
