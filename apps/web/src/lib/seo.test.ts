import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import type { Metadata } from "next";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { generateMetadata as courseMetadata } from "@/app/courses/[course]/page";
import { metadata as catalogueMetadata } from "@/app/courses/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { courses } from "@/content/courses";
import { updateSession } from "@/lib/supabase/session";

import {
  courseJsonLd,
  homepageJsonLd,
  INDEXABLE_ROUTES,
  isProductionDeployment,
  NOINDEX_PUBLIC_ROUTES,
  PUBLIC_COURSE_ROUTES,
  rootMetadata,
  serializeJsonLd,
  SITE_URL,
} from "./seo";

const getClaims = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

/** Page modules, so the test reads the metadata each page really exports. */
const PAGE_METADATA: Record<(typeof INDEXABLE_ROUTES)[number], () => Promise<{ metadata: Metadata }>> = {
  "/": () => import("@/app/page"),
  "/pricing": () => import("@/app/pricing/page"),
  "/about": () => import("@/app/about/page"),
  "/contact": () => import("@/app/contact/page"),
  "/privacy": () => import("@/app/privacy/page"),
  "/terms": () => import("@/app/terms/page"),
  "/refund-policy": () => import("@/app/refund-policy/page"),
};

const NOINDEX_METADATA: Record<(typeof NOINDEX_PUBLIC_ROUTES)[number], () => Promise<{ metadata: Metadata }>> = {
  "/login": () => import("@/app/login/page"),
  "/upgrade": () => import("@/app/upgrade/page"),
  "/daily-challenge": () => import("@/app/daily-challenge/page"),
  "/auth/update-password": () => import("@/app/auth/update-password/page"),
  "/unsubscribe": () => import("@/app/unsubscribe/page"),
};

/** Every route that has a page, read from the filesystem so a new page cannot be missed. */
function appRoutes(): string[] {
  const appDirectory = join(process.cwd(), "src", "app");
  return readdirSync(appDirectory, { recursive: true, encoding: "utf8" })
    .filter((file) => file === "page.tsx" || file.endsWith(`${sep}page.tsx`))
    .map((file) => `/${relative(appDirectory, join(appDirectory, file)).split(sep).slice(0, -1).join("/")}`);
}

/** A concrete URL for a route, with a made-up value in place of each dynamic segment. */
function concretePath(route: string): string {
  return route.replace(/\[[^\]]+\]/g, "example");
}

async function redirectsSignedOutVisitorToLogin(route: string): Promise<boolean> {
  getClaims.mockResolvedValue({ data: null, error: null });
  const response = await updateSession(new NextRequest(new URL(concretePath(route), "http://localhost:3000")));
  return response.status === 307 && new URL(response.headers.get("location") ?? "http://x/").pathname === "/login";
}

describe("page classification", () => {
  it("makes every page choose: indexable, deliberately noindex, or behind sign-in", async () => {
    const declared = [...INDEXABLE_ROUTES, ...PUBLIC_COURSE_ROUTES, ...NOINDEX_PUBLIC_ROUTES] as string[];
    const unclassified: string[] = [];
    for (const route of appRoutes()) {
      if (declared.includes(route)) continue;
      if (!(await redirectsSignedOutVisitorToLogin(route))) unclassified.push(route);
    }
    // A page here is publicly reachable with no decision made about search. Add it to
    // INDEXABLE_ROUTES or NOINDEX_PUBLIC_ROUTES in lib/seo.ts, or to the route guard.
    expect(unclassified).toEqual([]);
  });

  it("does not let an indexable route also be behind sign-in", async () => {
    for (const route of [...INDEXABLE_ROUTES, ...PUBLIC_COURSE_ROUTES]) {
      expect(await redirectsSignedOutVisitorToLogin(route), route).toBe(false);
    }
  });

  it.each(["/dashboard", "/profile", "/history", "/rounds", "/report/abc", "/interview/abc", "/questions", "/arena", "/courses/java/variables"])(
    "keeps %s behind sign-in and out of the sitemap",
    async (path) => {
      expect(await redirectsSignedOutVisitorToLogin(path)).toBe(true);
      const urls = sitemap().map((entry) => new URL(entry.url).pathname);
      expect(urls.some((url) => url === path || url.startsWith(`${path}/`))).toBe(false);
    },
  );
});

describe("page metadata", () => {
  it("gives each indexable page its own title and description, of a length search can show", async () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const route of INDEXABLE_ROUTES) {
      const { metadata } = await PAGE_METADATA[route]();
      const title = String(metadata.title);
      const description = String(metadata.description);
      expect(titles.has(title), `duplicate title on ${route}`).toBe(false);
      expect(descriptions.has(description), `duplicate description on ${route}`).toBe(false);
      titles.add(title);
      descriptions.add(description);
      expect(description.length, route).toBeGreaterThanOrEqual(50);
      expect(description.length, route).toBeLessThanOrEqual(210);
    }
  });

  it("points each indexable page's canonical at itself, and leaves it indexable", async () => {
    for (const route of INDEXABLE_ROUTES) {
      const { metadata } = await PAGE_METADATA[route]();
      expect(metadata.alternates?.canonical, route).toBe(route);
      expect(metadata.openGraph?.url, route).toBe(route);
      expect(metadata.robots, route).toBeUndefined();
      expect(metadata.openGraph?.images, route).toBeDefined();
      expect(metadata.twitter?.images, route).toBeDefined();
    }
  });

  it("does not set a canonical or a noindex in the root layout, which every page would inherit", () => {
    expect(rootMetadata.alternates).toBeUndefined();
    expect(rootMetadata.robots).toBeUndefined();
    expect(String(rootMetadata.metadataBase)).toBe(`${SITE_URL}/`);
  });

  it.each(NOINDEX_PUBLIC_ROUTES)("keeps %s out of the index", async (route) => {
    const { metadata } = await NOINDEX_METADATA[route]();
    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.alternates).toBeUndefined();
  });
});

describe("course page metadata", () => {
  async function overview(slug: string): Promise<Metadata> {
    return courseMetadata({ params: Promise.resolve({ course: slug }) });
  }

  it("gives the catalogue and every overview its own title, description and self-canonical", async () => {
    const pages = [catalogueMetadata, ...(await Promise.all(courses.map((course) => overview(course.slug))))];
    expect(new Set(pages.map((page) => String(page.title))).size).toBe(pages.length);
    expect(new Set(pages.map((page) => String(page.description))).size).toBe(pages.length);
    expect(pages.map((page) => page.alternates?.canonical)).toEqual(["/courses", ...courses.map((course) => `/courses/${course.slug}`)]);
    for (const page of pages) {
      expect(String(page.description).length, String(page.title)).toBeGreaterThanOrEqual(50);
      expect(String(page.description).length, String(page.title)).toBeLessThanOrEqual(210);
      expect(page.robots, String(page.title)).toBeUndefined();
    }
  });

  it("states each course's real chapter count", async () => {
    const java = courses.find((course) => course.slug === "java")!;
    const chapters = java.modules.reduce((sum, module) => sum + module.chapters.length, 0);
    expect(String((await overview("java")).description)).toContain(`${chapters} chapters.`);
  });

  it("has nothing to say about a course that does not exist", async () => {
    expect((await overview("no-such-course")).alternates).toBeUndefined();
  });

  it("states only what the overview shows in its structured data", () => {
    const java = courses.find((course) => course.slug === "java")!;
    const data = courseJsonLd(java);
    expect(data).toMatchObject({ "@type": "Course", name: java.title, description: java.tagline, url: `${SITE_URL}/courses/java` });
    const text = JSON.stringify(data);
    for (const field of ["aggregateRating", "review", "offers", "hasCourseInstance"]) expect(text).not.toContain(field);
  });
});

describe("sitemap.xml", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists the catalogue and every enabled course's overview, and no chapter", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/courses");
    for (const course of courses) expect(paths).toContain(`/courses/${course.slug}`);
    expect(paths.filter((path) => path.split("/").length > 3)).toEqual([]);
  });

  it("leaves out a course that is switched off, which would 404", () => {
    vi.stubEnv("NEXT_PUBLIC_COURSE_JAVA_ENABLED", "false");
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).not.toContain("/courses/java");
    expect(paths).toContain("/courses/dsa");
  });

  it("leaves out every course page when courses are switched off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_COURSES", "false");
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths.filter((path) => path.startsWith("/courses"))).toEqual([]);
  });

  it("lists exactly the indexable routes, as canonical production URLs", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(new Set(urls).size).toBe(INDEXABLE_ROUTES.length + 1 + courses.length);
    expect(urls).toContain(`${SITE_URL}/`);
    for (const url of urls.filter((value) => value !== `${SITE_URL}/`)) {
      expect(url.startsWith(`${SITE_URL}/`), url).toBe(true);
      expect(url.endsWith("/"), url).toBe(false);
      expect(url.includes("?"), url).toBe(false);
    }
  });

  it("does not list a route that is noindex", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const route of NOINDEX_PUBLIC_ROUTES) expect(paths).not.toContain(route);
  });
});

describe("robots.txt", () => {
  function disallowed(): string[] {
    const { rules } = robots();
    const rule = Array.isArray(rules) ? rules[0]! : rules;
    return [rule.disallow ?? []].flat();
  }

  it("references the production sitemap", () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("does not block a public page, or the assets a crawler needs to render one", () => {
    const blocked = disallowed();
    expect(blocked).not.toContain("/");
    expect(blocked.some((path) => path.startsWith("/_next"))).toBe(false);
    for (const route of INDEXABLE_ROUTES.filter((value) => value !== "/")) {
      expect(blocked.some((path) => route.startsWith(path)), route).toBe(false);
    }
  });

  it("does not block a redirecting route, or the crawler could never see it leads to a noindex page", () => {
    const blocked = disallowed();
    for (const route of ["/courses", "/interview/new", "/dashboard", "/login"]) {
      expect(blocked.some((path) => route.startsWith(path)), route).toBe(false);
    }
  });

  it("blocks everything on a preview deployment", () => {
    vi.stubEnv("CONTEXT", "deploy-preview");
    try {
      expect(disallowed()).toEqual(["/"]);
      expect(robots().sitemap).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("isProductionDeployment", () => {
  it.each([
    [{}, true],
    [{ CONTEXT: "production" }, true],
    [{ CONTEXT: "deploy-preview" }, false],
    [{ CONTEXT: "branch-deploy" }, false],
    [{ VERCEL_ENV: "production" }, true],
    [{ VERCEL_ENV: "preview" }, false],
  ])("given %j returns %s", (env, expected) => {
    expect(isProductionDeployment(env as unknown as NodeJS.ProcessEnv)).toBe(expected);
  });
});

describe("structured data", () => {
  const nodes = homepageJsonLd()["@graph"] as Record<string, unknown>[];

  it("is valid JSON and states the types it means to", () => {
    const parsed = JSON.parse(serializeJsonLd(homepageJsonLd())) as { "@context": string; "@graph": { "@type": string }[] };
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"].map((node) => node["@type"])).toEqual(["Organization", "WebSite"]);
  });

  it("claims no ratings, reviews, prices or search box the site does not have", () => {
    const text = JSON.stringify(homepageJsonLd());
    for (const field of ["aggregateRating", "review", "offers", "potentialAction", "sameAs"]) {
      expect(text).not.toContain(field);
    }
  });

  it("uses production URLs throughout", () => {
    for (const node of nodes) expect(String(node.url)).toBe(`${SITE_URL}/`);
    expect(String(nodes[0]!.logo).startsWith(`${SITE_URL}/`)).toBe(true);
  });

  it("cannot close its own script tag", () => {
    const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("<");
    expect((JSON.parse(serialized) as { name: string }).name).toBe("</script><script>alert(1)</script>");
  });
});
