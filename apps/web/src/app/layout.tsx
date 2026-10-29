import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { AppChrome } from "@/components/app-chrome";

import "./globals.css";

/*
 * The interface uses this sans for body copy, controls, and card headings. The larger
 * editorial headlines use a system serif, so no extra font download is needed.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Untiered",
    template: "%s · Untiered",
  },
  description:
    "Voice-first AI mock interviews grounded in how interviews at real employers actually run — " +
    "product companies, service-based IT, consulting, European employers and beyond.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
