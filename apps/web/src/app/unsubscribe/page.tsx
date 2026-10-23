import { Suspense } from "react";

import { UnsubscribeForm } from "@/components/unsubscribe-form";

export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default function UnsubscribePage() {
  return <Suspense fallback={<main className="mx-auto max-w-xl px-6 py-16">Loading email preferences…</main>}><UnsubscribeForm /></Suspense>;
}
