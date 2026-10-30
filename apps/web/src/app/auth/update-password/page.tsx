import type { Metadata } from "next";

import { PasswordUpdateForm } from "@/components/password-update-form";
import { NOINDEX_FOLLOW } from "@/lib/seo";

export const metadata: Metadata = { title: "Set a new password", robots: NOINDEX_FOLLOW };

export default function UpdatePasswordPage() {
  return <PasswordUpdateForm />;
}
