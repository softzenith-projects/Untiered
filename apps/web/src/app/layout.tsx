import type { Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { AppChrome } from "@/components/app-chrome";
import { SiteAnalytics } from "@/components/site-analytics";
import { rootMetadata } from "@/lib/seo";

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

export const metadata = rootMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <AppChrome>{children}</AppChrome>
        <SiteAnalytics />
      </body>
    </html>
  );
}
