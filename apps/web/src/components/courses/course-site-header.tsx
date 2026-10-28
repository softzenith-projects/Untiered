import { AppHeader } from "@/components/app-chrome";
import { SiteFooter } from "@/components/site-footer";

/**
 * The top bar for the chapter reader: the app's own signed-in bar, at the reader's wider
 * width. It used to be a separate bar (centred links, "New interview", "Sign out"), so
 * opening a chapter swapped the header from under the reader.
 */
export function CourseSiteHeader() {
  return <AppHeader width="layout-reader" />;
}

export function CourseSiteFooter() {
  return <SiteFooter />;
}
