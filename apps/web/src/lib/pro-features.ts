import type { ProFeatureKey } from "@/lib/api";

/** What the upgrade page asks about. The keys are the API's; the labels can change freely. */
export const PRO_FEATURES: { key: ProFeatureKey; label: string }[] = [
  { key: "more_practice", label: "More rounds and longer interviews each day" },
  { key: "progress", label: "Longer-term progress views across repeated goals" },
  { key: "recommendations", label: "Deeper practice recommendations from past reports" },
  { key: "prep_plans", label: "More control over saved preparation plans" },
  { key: "new_formats", label: "Priority access to new practice formats" },
];
