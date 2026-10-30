import type { Chapter } from "@/content/courses/types";

export const chapterNextjsProduction: Chapter = {
  "slug": "nextjs-production",
  "title": "Next.js in Production: Route Handlers, proxy, Metadata, Errors and Env Vars",
  "summary": "The pieces that turn a demo into a product: HTTP endpoints with route handlers, the request gatekeeper `proxy.ts` (formerly `middleware.ts`), SEO metadata, images and fonts, error and loading UI, and environment variables. Facts are as of Next.js 16.",
  "minutes": 22,
  "blocks": [
    {
      "kind": "p",
      "text": "A page that renders is the start. A product also needs endpoints other programs can call, a gate at the door, tags search engines can read, a plan for when something throws, and a way to keep secrets out of the browser. Next.js has a file convention for each. This chapter is a tour of them, with the version noted wherever it matters (**as of Next.js 16**)."
    },
    {
      "kind": "h",
      "text": "The apartment security guard"
    },
    {
      "kind": "analogy",
      "title": "Gate, reception and flat door",
      "text": "A residential society has several checks. The guard at the gate looks at everyone arriving and can wave them in, turn them away, or send them to the visitor desk, before anyone reaches a building. That is **proxy.ts**. Each flat has its own door and its own rules for what it hands out, like a **route handler** that answers a knock with data. The nameplate outside the building tells couriers and guests what is inside; **metadata** is that nameplate for search engines. Where the analogy stops: the gate guard only gets a quick look at the visitor and must not do slow work. Real authorisation checks belong at the flat door, next to the data."
    },
    {
      "kind": "h",
      "text": "Route Handlers: endpoints in the app folder"
    },
    {
      "kind": "p",
      "text": "A **route handler** is a `route.ts` file that exports functions named after HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`). It uses the standard Web `Request` and `Response` objects, and it cannot sit beside a `page` at the same segment. Other methods return 405. Route handlers do not take part in layouts. GET handlers are not cached by default (Next.js 15 and later); with Cache Components on, they follow the same prerender rules as pages. Always validate the body: it is untrusted input, as with any API."
    },
    {
      "kind": "code",
      "caption": "A GET and POST route handler with input validation, the async-params form, and a proxy.ts. Runs inside a Next.js 16 project, so no output is shown.",
      "code": "// A Route Handler and proxy.ts, as of Next.js 16. Runs inside a Next.js project.\n\n// ---- app/api/health/route.ts ----\n// Web Request/Response APIs. Exported names are HTTP methods. Next.js 15 and later do not\n// cache GET handlers by default; with Cache Components they follow the page prerender rules.\nexport async function GET(request: Request) {\n  const { searchParams } = new URL(request.url);\n  return Response.json({ ok: true, echo: searchParams.get(\"q\") });\n}\n\nexport async function POST(request: Request) {\n  const body = await request.json();\n  if (typeof body.title !== \"string\") {\n    return Response.json({ error: \"title must be a string\" }, { status: 400 }); // validate input\n  }\n  return Response.json({ created: body.title }, { status: 201 });\n}\n\n// ---- app/users/[id]/route.ts ---- params is a Promise\n// export async function GET(_req: Request, ctx: RouteContext<\"/users/[id]\">) {\n//   const { id } = await ctx.params;\n//   return Response.json({ id });\n// }\n\n// ---- proxy.ts (was middleware.ts before Next.js 16), at the project root ----\n// import { NextResponse } from \"next/server\";\n// import type { NextRequest } from \"next/server\";\n//\n// export function proxy(request: NextRequest) {\n//   return NextResponse.redirect(new URL(\"/home\", request.url));\n// }\n// export const config = { matcher: \"/about/:path*\" };\n"
    },
    {
      "kind": "h",
      "text": "proxy.ts: the gate (formerly middleware.ts)"
    },
    {
      "kind": "concept",
      "title": "What proxy is for (nextjs.org, \"Proxy\" and the Next.js 16 release post)",
      "text": "In Next.js 16 `middleware.ts` is renamed `proxy.ts` and the exported function is `proxy`; the logic stays the same, and it runs on the Node.js runtime. A single file at the project root runs before a request completes and can redirect, rewrite, change headers, or respond directly. A `matcher` in its `config` limits the paths it runs on. It is not meant for slow data fetching or as your only authorisation layer: use it for optimistic checks and redirects, and verify permissions again where data is read. The old `middleware.ts` remains for Edge-runtime cases but is deprecated."
    },
    {
      "kind": "p",
      "text": "The model below runs a tiny gatekeeper. It decides, for each request path, whether the proxy runs at all (the matcher), and if so whether to redirect or allow it. At the end it also shows how the browser sees only the environment variables whose names start with `NEXT_PUBLIC_`. It is a model of the decisions, not Next.js's code."
    },
    {
      "kind": "code",
      "caption": "A MODEL of a proxy with a matcher, a redirect decision and a session check, plus the NEXT_PUBLIC_ filter. Not Next.js's implementation. Runs in the course editor and under node.",
      "code": "// A MODEL of a request-interception layer (what proxy.ts does) and of how\n// NEXT_PUBLIC_ variables are chosen for the browser. Not Next.js's code.\nconst config = { matcher: [\"/account/:path*\", \"/old-blog/:path*\"] };\n\nfunction matches(pathname, pattern) {\n  const base = pattern.replace(\"/:path*\", \"\");\n  return pathname === base || pathname.startsWith(base + \"/\");\n}\n\n// The proxy sees the request BEFORE any page renders and returns a decision.\nfunction proxy(request) {\n  if (matches(request.path, \"/old-blog/:path*\")) {\n    return { type: \"redirect\", to: request.path.replace(\"/old-blog\", \"/blog\"), status: 308 };\n  }\n  if (matches(request.path, \"/account/:path*\") && !request.cookies.session) {\n    return { type: \"redirect\", to: \"/login\", status: 307 }; // an optimistic check only\n  }\n  return { type: \"next\", headers: { \"x-checked\": \"yes\" } };\n}\n\nfunction handle(request) {\n  const inScope = config.matcher.some((m) => matches(request.path, m));\n  if (!inScope) return `${request.path} -> proxy skipped, page renders`;\n  const d = proxy(request);\n  if (d.type === \"redirect\") return `${request.path} -> ${d.status} redirect to ${d.to}`;\n  return `${request.path} -> allowed, header x-checked=${d.headers[\"x-checked\"]}`;\n}\n\nconsole.log(handle({ path: \"/\", cookies: {} }));\nconsole.log(handle({ path: \"/account/orders\", cookies: {} }));\nconsole.log(handle({ path: \"/account/orders\", cookies: { session: \"abc\" } }));\nconsole.log(handle({ path: \"/old-blog/hooks\", cookies: {} }));\n\n// Environment variables: only NEXT_PUBLIC_ names are inlined into browser code at build time.\nconst env = { DATABASE_URL: \"postgres://secret\", NEXT_PUBLIC_SITE_NAME: \"Aarav Notes\" };\nconst browserBundle = Object.fromEntries(Object.entries(env).filter(([name]) => name.startsWith(\"NEXT_PUBLIC_\")));\nconsole.log(\"server sees :\", Object.keys(env).join(\", \"));\nconsole.log(\"browser sees:\", Object.keys(browserBundle).join(\", \"));\n",
      "output": "/ -> proxy skipped, page renders\n/account/orders -> 307 redirect to /login\n/account/orders -> allowed, header x-checked=yes\n/old-blog/hooks -> 308 redirect to /blog/hooks\nserver sees : DATABASE_URL, NEXT_PUBLIC_SITE_NAME\nbrowser sees: NEXT_PUBLIC_SITE_NAME",
      "tryIt": {
        "language": "javascript",
        "prompt": "Add `\"/admin/:path*\"` to the matcher but no rule for it, then request `/admin/users` and predict the line. What does that tell you about why a matcher is not a security check?"
      }
    },
    {
      "kind": "h",
      "text": "Metadata, images and fonts"
    },
    {
      "kind": "p",
      "text": "In a layout or page (Server Components only), export a `metadata` object for fixed values, or an async `generateMetadata` function when they depend on data. Next.js turns them into the `<head>` tags. Special files such as `sitemap.ts`, `robots.ts` and `opengraph-image` generate those assets. If the page and its metadata fetch the same data, wrap the fetch in React's `cache` so it runs once. For dynamically rendered pages, metadata streams after the first content, except for bots that need it in `<head>`, which are detected from the user agent."
    },
    {
      "kind": "p",
      "text": "`next/image`'s `<Image>` resizes and converts pictures for each device and loads them lazily. It needs a `width` and `height` (or `fill`) so the space is reserved and the page does not jump. Remote images must be allowed in `images.remotePatterns` in the config, which stops strangers using your server to resize anything. `next/font` downloads fonts at build time and serves them from your own domain."
    },
    {
      "kind": "code",
      "caption": "generateMetadata, next/image, next/font and error.tsx. Runs inside a Next.js 16 project, so no output is shown.",
      "code": "// Metadata, images, fonts and error UI, as of Next.js 16. Runs inside a Next.js project.\n\n// ---- app/blog/[slug]/page.tsx ----\nimport type { Metadata } from \"next\";\nimport Image from \"next/image\";\n\nexport async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {\n  const { slug } = await params;\n  const post = await getPost(slug);\n  return { title: post.title, description: post.summary }; // becomes <title> and <meta> tags\n}\n\nexport default async function Page({ params }: { params: Promise<{ slug: string }> }) {\n  const { slug } = await params;\n  const post = await getPost(slug);\n  return (\n    <article>\n      <h1>{post.title}</h1>\n      {/* width and height reserve space, which prevents layout shift */}\n      <Image src=\"/cover.png\" alt=\"Cover illustration\" width={800} height={400} />\n    </article>\n  );\n}\n\n// ---- app/layout.tsx : fonts with next/font are self-hosted at build time ----\n// import { Inter } from \"next/font/google\";\n// const inter = Inter({ subsets: [\"latin\"] });\n// <html lang=\"en\" className={inter.className}>\n\n// ---- app/blog/error.tsx : must be a Client Component ----\n// \"use client\";\n// export default function Error({ error, retry }: { error: unknown; retry: () => void }) {\n//   return (\n//     <div>\n//       <h2>Something went wrong</h2>\n//       <button onClick={() => retry()}>Try again</button>\n//     </div>\n//   );\n// }\n// In current docs `retry` is stable from v16.3.0 (unstable_retry in 16.2.0); `reset` clears the\n// error without re-fetching. A root layout error needs app/global-error.tsx with its own <html>.\n\n// ---- .env ----\n// DATABASE_URL=...                 server only\n// NEXT_PUBLIC_SITE_NAME=Aarav Notes   inlined into browser JavaScript at `next build`\n"
    },
    {
      "kind": "h",
      "text": "Loading, errors and environment variables"
    },
    {
      "kind": "compare",
      "title": "Segment-level UI files",
      "columns": [
        {
          "label": "loading and not-found",
          "items": [
            "`loading.tsx` is shown (as a Suspense fallback) while the segment's page is pending.",
            "`not-found.tsx` renders when you call `notFound()` or no route matches."
          ]
        },
        {
          "label": "error and global-error",
          "items": [
            "`error.tsx` must be a Client Component and wraps its segment's page and children in an error boundary.",
            "It does not wrap the layout above it in the same segment; a root layout error needs `global-error.tsx` with its own `<html>` and `<body>`."
          ]
        }
      ]
    },
    {
      "kind": "p",
      "text": "Environment variables load from `.env*` files into `process.env` on the server. Only names that start with `NEXT_PUBLIC_` are inlined into the browser bundle, and they are replaced with their values when you run `next build`, so changing them later has no effect on an already built app. Everything else stays on the server. Never commit `.env` files, and never put a secret in a `NEXT_PUBLIC_` variable. To ship, run `next build` then `next start` on a Node server (or use a platform that does it for you), with the build-time variables set when you build."
    },
    {
      "kind": "pitfall",
      "items": [
        "Putting an API key in a `NEXT_PUBLIC_` variable because the browser \"needs\" it. Anyone can read it in the bundle. Fix: keep the key on the server and expose a route handler or Server Action.",
        "Relying on proxy alone for authorisation. It is a quick optimistic check and a matcher can miss a path. Fix: check the session again in the route handler, Server Action or data function.",
        "Doing slow work in proxy, such as a database query on every request. Fix: keep it to redirects, rewrites and header changes; fetch data where it is needed.",
        "Forgetting that `NEXT_PUBLIC_` values are frozen at build time and deploying one image to several environments. Fix: build per environment, or fetch runtime config from your own endpoint.",
        "Using a regular `<img>` for large photos, or `<Image>` without width and height. Fix: use `next/image` with dimensions or `fill`, and declare remote hosts."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "Route handlers are route.ts files exporting GET, POST and friends with Web Request and Response. Validate input, and do not place one beside a page.",
        "As of Next.js 16, middleware.ts is proxy.ts: a gate for redirects, rewrites and headers, with a matcher. It is not a substitute for authorisation near the data.",
        "Metadata comes from a metadata export or generateMetadata in Server Components; next/image needs dimensions, next/font self-hosts fonts.",
        "Only NEXT_PUBLIC_ variables reach the browser, inlined at build time. error.tsx must be a Client Component; root layout errors need global-error.tsx."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"What is middleware in Next.js and what changed in version 16?\" Strong answer: code that runs before a request completes to redirect, rewrite or set headers; in 16 it is named proxy.ts with a proxy function. It should not be the only auth check.",
        "\"How do you expose an API in the App Router?\" Strong answer: a route.ts file with exported method handlers using Web Request and Response; mention validation, status codes, and that GET is not cached by default since 15.",
        "\"How do environment variables work, and what does NEXT_PUBLIC_ do?\" Strong answer: server-only by default; the prefix inlines the value into client JavaScript at build time, so it is public and fixed after the build.",
        "\"How would you handle SEO for dynamic pages?\" Strong answer: generateMetadata with params, a sitemap and robots file, Open Graph images, and server rendering so content is in the HTML."
      ]
    },
    {
      "kind": "quiz",
      "question": "A team stores a payment secret in `NEXT_PUBLIC_PAYMENT_KEY`. Who can read it?",
      "options": [
        "Only the server code, because Next.js treats every variable as a secret by default",
        "Anyone who can load the site, since it is inlined into browser code",
        "Only logged-in users",
        "No one, Next.js encrypts it"
      ],
      "answer": 1,
      "why": "Variables with the NEXT_PUBLIC_ prefix are replaced by their values in the JavaScript bundle at build time, so every visitor can read them."
    },
    {
      "kind": "quiz",
      "question": "Which statement about `error.tsx` is correct?",
      "options": [
        "It must be a Client Component",
        "It can be an async Server Component",
        "It also catches errors in the layout beside it",
        "It replaces the root layout when it fails"
      ],
      "answer": 0,
      "why": "Error boundaries are Client Components. error.tsx does not wrap the layout above it in the same segment, and root layout errors need global-error.tsx."
    },
    {
      "kind": "quiz",
      "question": "In Next.js 16, what is the correct file for request interception at the project root?",
      "options": [
        "middleware.ts exporting a function named middleware only",
        "proxy.ts exporting proxy (or a default function)",
        "app/proxy/route.ts",
        "next.proxy.config.ts"
      ],
      "answer": 1,
      "why": "Next.js 16 renamed middleware to proxy. The file is proxy.ts at the project root, exporting a function named proxy or a default export."
    }
  ]
};
