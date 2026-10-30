import type { Chapter } from "@/content/courses/types";

export const chapterNextjsRenderingAndCaching: Chapter = {
  "slug": "nextjs-rendering-and-caching",
  "title": "Next.js Rendering and Caching: SSG, SSR, ISR, PPR and Cache Components",
  "summary": "When is a page's HTML built, and how long may it be reused? Learn the rendering modes, what Next.js 15 changed (`fetch` no longer cached by default), what Next.js 16 Cache Components adds (`'use cache'`, `cacheLife`, `cacheTag`), and how revalidation works.",
  "minutes": 24,
  "blocks": [
    {
      "kind": "p",
      "text": "Caching is the part of Next.js that changed most between versions, so this chapter names the version for every fact. Read it in this order: first the question every page must answer (*when is this HTML built?*), then the old defaults and why Next.js 15 changed them, and then the model that is current as of **Next.js 16**, Cache Components. Docs for this area are updated often; check nextjs.org before you rely on a detail."
    },
    {
      "kind": "h",
      "text": "The sweet shop counter"
    },
    {
      "kind": "analogy",
      "title": "Fresh jalebi, boxed laddoo and custom orders",
      "text": "A sweet shop has three kinds of items. Laddoos are packed in boxes in the morning, so any customer is served instantly (**static**, built ahead of time). Jalebis are fried when you ask, so they are always fresh but you wait (**dynamic**, built per request). Some boxes are repacked every hour so they are quick but never very old (**revalidation**). A modern counter does something cleverer: the shop front and the boxed laddoos are ready at once, and only your custom order is prepared while you watch (**partial prerendering**). Where the analogy stops: the shop knows the item is old by looking at it; Next.js only knows by a time limit you set or a tag you invalidate."
    },
    {
      "kind": "h",
      "text": "When is the HTML built?"
    },
    {
      "kind": "table",
      "head": [
        "Mode",
        "When the HTML is built",
        "Good for"
      ],
      "rows": [
        [
          "Static (SSG)",
          "At build time, once, then served from a CDN",
          "Pages that are the same for everyone, such as docs or a landing page"
        ],
        [
          "Dynamic (SSR)",
          "On the server, for every request",
          "Pages that depend on the user or on live data"
        ],
        [
          "Incremental (ISR)",
          "At build time, then rebuilt in the background after a time limit or an event",
          "Mostly-static content that changes now and then"
        ],
        [
          "Client (CSR)",
          "In the browser after JavaScript loads",
          "Highly interactive areas behind a login"
        ],
        [
          "Partial prerendering (PPR)",
          "A static shell at build time, and dynamic parts streamed in per request",
          "Pages with a stable frame and a few personal or live parts"
        ]
      ]
    },
    {
      "kind": "h",
      "text": "The old defaults, and what Next.js 15 changed"
    },
    {
      "kind": "p",
      "text": "In Next.js 13 and 14, a `fetch` in a Server Component was cached by default, and so were GET route handlers. People were caught out by stale data they never asked to cache. **Next.js 15 reversed this**: fetch requests, GET route handlers and the client router cache for pages are no longer cached by default. Next.js 15 also made request APIs asynchronous: `params`, `searchParams`, `cookies()` and `headers()` must be awaited. Under the previous model that is still used when Cache Components is off, you opt in per request."
    },
    {
      "kind": "code",
      "caption": "The previous model: fetch options, segment config, tags and revalidation (Next.js 15, and 16 with cacheComponents off). Runs inside a Next.js project, so no output is shown.",
      "code": "// The previous caching model (Next.js 15, and 16 without cacheComponents).\n// Runs inside a Next.js project.\n\n// Next.js 15 and later: fetch is NOT cached unless you ask.\nexport default async function Page() {\n  const live = await fetch(\"https://api.example.com/price\"); // fetched on every request\n  const frozen = await fetch(\"https://api.example.com/terms\", { cache: \"force-cache\" });\n  const hourly = await fetch(\"https://api.example.com/menu\", {\n    next: { revalidate: 3600, tags: [\"menu\"] }, // time-based, and taggable\n  });\n  // ...\n}\n\n// Segment config applies to the whole route:\nexport const revalidate = 600; // must be a literal number; 60 * 10 is not allowed\n\n// After a mutation, in a Server Action or Route Handler:\n// import { revalidateTag, revalidatePath } from \"next/cache\";\n// revalidateTag(\"menu\", \"max\"); // Next.js 16 signature; the one-argument form is deprecated\n// revalidatePath(\"/menu\");\n\n// Prerender known dynamic routes at build time:\nexport async function generateStaticParams() {\n  return [{ slug: \"hooks\" }, { slug: \"keys\" }];\n}\n"
    },
    {
      "kind": "p",
      "text": "Three caches sit behind those options and are worth telling apart. *Request memoisation* deduplicates identical calls inside one render, and lasts one request. The *data cache* stores results across requests until time or a tag expires them. A *route cache* holds prerendered pages. The model below builds the first two so you can see how they differ. The first sample is the data cache with a fake clock, so it prints the same thing every time."
    },
    {
      "kind": "code",
      "caption": "A MODEL of a data cache with time-based revalidation, stale-while-revalidate, and tag invalidation, using a fake clock. Not Next.js's implementation. Its tag invalidation expires the entry immediately, like updateTag() does in a Server Action; revalidateTag(tag, 'max') in Next.js 16 is gentler and serves stale content while refreshing. Runs in the course editor and under node.",
      "code": "// A MODEL of a data cache with time-based and tag-based revalidation.\n// Not Next.js's implementation: it shows the rules with a fake clock so the\n// output is the same every time. Stale-while-revalidate serves the old value\n// once, while the refresh happens.\nfunction createCache(clock) {\n  const entries = new Map(); // key -> { value, storedAt, revalidate, tags }\n  let fetches = 0;\n\n  async function cached(key, loader, { revalidate = Infinity, tags = [] } = {}) {\n    const hit = entries.get(key);\n    const now = clock.now;\n    if (hit && !hit.invalid && now - hit.storedAt < hit.revalidate) {\n      return { value: hit.value, status: \"HIT\" };\n    }\n    if (hit && !hit.invalid) {\n      // time is up: serve the stale value now, refresh for the next request\n      refresh(key, loader, { revalidate, tags }, now);\n      return { value: hit.value, status: \"STALE\" };\n    }\n    const value = await loader(++fetches);\n    entries.set(key, { value, storedAt: now, revalidate, tags });\n    return { value, status: \"MISS\" };\n  }\n  async function refresh(key, loader, options, now) {\n    const value = await loader(++fetches);\n    entries.set(key, { value, storedAt: now, ...options });\n  }\n  function revalidateTag(tag) {\n    for (const entry of entries.values()) if (entry.tags.includes(tag)) entry.invalid = true;\n  }\n  return { cached, revalidateTag };\n}\n\nconst clock = { now: 0 };\nconst cache = createCache(clock);\nconst loadPrice = async (n) => \"price v\" + n; // pretend network call\n\nasync function request(label) {\n  const r = await cache.cached(\"price\", loadPrice, { revalidate: 60, tags: [\"price\"] });\n  console.log(`t=${String(clock.now).padStart(3)}s ${label.padEnd(18)} ${r.status.padEnd(5)} ${r.value}`);\n}\n\n(async () => {\n  await request(\"first visitor\");\n  clock.now = 30;\n  await request(\"30s later\");\n  clock.now = 61;\n  await request(\"after 60s window\"); // old value served, refresh starts\n  await new Promise((r) => setTimeout(r, 0)); // let the refresh finish\n  await request(\"next visitor\");\n  cache.revalidateTag(\"price\"); // e.g. a Server Action just changed the price\n  await request(\"after revalidateTag\");\n})();\n",
      "output": "t=  0s first visitor      MISS  price v1\nt= 30s 30s later          HIT   price v1\nt= 61s after 60s window   STALE price v1\nt= 61s next visitor       HIT   price v2\nt= 61s after revalidateTag MISS  price v3",
      "tryIt": {
        "language": "javascript",
        "prompt": "Change `revalidate: 60` to `10` and the second request to t=30. Predict the status of each line before you run it."
      }
    },
    {
      "kind": "code",
      "caption": "A MODEL of per-request deduplication, like React's cache() and fetch memoization within a render. Three callers share one real call, and the memo is dropped after the request. Runs in the course editor and under node.",
      "code": "// A MODEL of per-request deduplication (what React's cache() and fetch memoization\n// do inside ONE render pass). The memo lives for one request and is then dropped,\n// which is different from the data cache above that lives across requests.\nfunction createRequestScope() {\n  const memo = new Map();\n  let realCalls = 0;\n  function dedupe(key, fn) {\n    if (!memo.has(key)) {\n      memo.set(key, fn(++realCalls)); // store the promise, so concurrent callers share it\n    }\n    return memo.get(key);\n  }\n  return { dedupe, calls: () => realCalls };\n}\n\nasync function getUser(scope, id) {\n  return scope.dedupe(\"user:\" + id, async (n) => `user ${id} (database call #${n})`);\n}\n\nasync function handleRequest(name) {\n  const scope = createRequestScope(); // new scope per request\n  // Header, sidebar and page body all ask for the same user.\n  const [a, b, c] = await Promise.all([getUser(scope, 7), getUser(scope, 7), getUser(scope, 7)]);\n  console.log(name, \"->\", a === b && b === c ? \"same result for all three\" : \"different\", \"| real calls:\", scope.calls());\n}\n\nhandleRequest(\"request 1\").then(() => handleRequest(\"request 2\"));\n",
      "output": "request 1 -> same result for all three | real calls: 1\nrequest 2 -> same result for all three | real calls: 1",
      "tryIt": {
        "language": "javascript",
        "prompt": "Remove the per-request scope by moving `createRequestScope()` out of `handleRequest` and predict what the second request prints. Which real-world bug does that match?"
      }
    },
    {
      "kind": "h",
      "text": "Cache Components: the model as of Next.js 16"
    },
    {
      "kind": "concept",
      "title": "Opt-in caching with 'use cache' (nextjs.org, \"Caching\" and the Next.js 16 release post)",
      "text": "Cache Components is switched on with `cacheComponents: true` in the Next config. Everything runs at request time by default; you opt in to caching with the `'use cache'` directive on a function, component or file. `cacheLife('hours')` says how long the result stays fresh, and `cacheTag('posts')` labels it for invalidation. Arguments and captured values become part of the cache key. Components that read runtime data (cookies, headers, `searchParams`, `params`) must sit behind a `<Suspense>` boundary. This gives Partial Prerendering as the default rendering model: a static shell plus streamed dynamic parts."
    },
    {
      "kind": "code",
      "caption": "One page with static content, cached content and streamed runtime content, plus updateTag() in a Server Action. Runs inside a Next.js 16 project with Cache Components, so no output is shown.",
      "code": "// Cache Components (Next.js 16): caching is opt-in with 'use cache'.\n// Runs inside a Next.js 16 project with cacheComponents: true. No output is shown.\n\n// ---- next.config.ts ----\n// const nextConfig = { cacheComponents: true, partialPrefetching: true };\n\n// ---- app/blog/page.tsx ----\nimport { Suspense } from \"react\";\nimport { cookies } from \"next/headers\";\nimport { cacheLife, cacheTag } from \"next/cache\";\n\nexport default function BlogPage() {\n  return (\n    <>\n      <h1>Our Blog</h1>               {/* static: part of the prerendered shell */}\n      <BlogPosts />                    {/* cached: also in the shell, refreshed by cacheLife */}\n      <Suspense fallback={<p>Loading your preferences...</p>}>\n        <UserPreferences />            {/* runtime data: streams at request time */}\n      </Suspense>\n    </>\n  );\n}\n\nasync function BlogPosts() {\n  \"use cache\";\n  cacheLife(\"hours\");\n  cacheTag(\"posts\");\n  const res = await fetch(\"https://api.example.com/posts\");\n  const posts: { id: string; title: string }[] = await res.json();\n  return (\n    <ul>\n      {posts.map((p) => (\n        <li key={p.id}>{p.title}</li>\n      ))}\n    </ul>\n  );\n}\n\nasync function UserPreferences() {\n  const theme = (await cookies()).get(\"theme\")?.value ?? \"light\"; // runtime API, inside Suspense\n  return <p>Your theme: {theme}</p>;\n}\n\n// ---- app/actions.ts ----\n// \"use server\";\n// import { updateTag } from \"next/cache\";\n// export async function publish() {\n//   await db.posts.insert(/* ... */);\n//   updateTag(\"posts\"); // Server Actions only: expire and read fresh data in the same request\n// }\n"
    },
    {
      "kind": "steps",
      "title": "How the three kinds of content in that page are treated",
      "steps": [
        {
          "label": "Static",
          "text": "Plain markup and pure computations complete at build time and become part of the static shell."
        },
        {
          "label": "Cached",
          "text": "A 'use cache' component is rendered once, stored with its lifetime, and included in the shell as long as the lifetime is not too short."
        },
        {
          "label": "Streamed",
          "text": "A component reading cookies() or uncached data sits behind Suspense: its fallback is in the shell and the content arrives at request time."
        }
      ]
    },
    {
      "kind": "compare",
      "title": "Invalidating after a change (Next.js 16)",
      "columns": [
        {
          "label": "updateTag and refresh",
          "items": [
            "`updateTag(tag)` is for Server Actions only and gives read-your-writes: the data is expired and read fresh in the same request.",
            "`refresh()` is for Server Actions only and refreshes uncached data; it does not touch the cache."
          ]
        },
        {
          "label": "revalidateTag and revalidatePath",
          "items": [
            "`revalidateTag(tag, profile)` marks tagged entries stale with stale-while-revalidate; the one-argument form is deprecated.",
            "`revalidatePath('/posts')` invalidates a route path. Both can be called from Server Actions and Route Handlers."
          ]
        }
      ]
    },
    {
      "kind": "pitfall",
      "items": [
        "Assuming `fetch` is cached because a tutorial said so. That was true in Next.js 13 and 14, and false from 15. Fix: check the version, and opt in with `cache: 'force-cache'` or `'use cache'`.",
        "Calling `cookies()`, `headers()` or reading `params` synchronously. Since 15 they are async, and 16 removed the synchronous form. Fix: `await` them.",
        "Reading runtime data in a Cache Components page without a `<Suspense>` boundary. The dev overlay reports a blocking route. Fix: wrap the component that reads it, or pass the value to a cached function as an argument.",
        "Testing caching in development. Pages are rendered on demand there. Fix: run `next build` and `next start`.",
        "Using `Math.random()` or `Date.now()` in a cached component and wondering why every visitor sees the same value. Fix: that is what caching means; move it behind `connection()` and Suspense for a per-request value."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "Ask first: when is this HTML built? Build time (static), per request (dynamic), rebuilt on a timer or event (ISR), or a static shell with streamed parts (PPR).",
        "Next.js 15 stopped caching fetch and GET route handlers by default, and made params, searchParams, cookies() and headers() async.",
        "As of Next.js 16, Cache Components make caching opt-in with 'use cache', cacheLife and cacheTag; runtime data needs Suspense.",
        "After a mutation: updateTag in a Server Action for read-your-writes, revalidateTag(tag, profile) for stale-while-revalidate, revalidatePath for a route."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"Explain SSR, SSG and ISR.\" Strong answer: when the HTML is built (per request, at build time, or at build time with background rebuilds) and what each costs. Then say how the App Router expresses them: dynamic APIs, static by default, revalidate or cacheLife.",
        "\"Is fetch cached in Next.js?\" Strong answer: version-dependent. Cached by default in 13 and 14, not cached in 15 and later. In 16 with Cache Components, you opt in with 'use cache'. Show you know it changed.",
        "\"What is Partial Prerendering?\" Strong answer: a static shell served instantly from the CDN, with dynamic parts behind Suspense streamed in at request time; in Next.js 16 it is the default model with Cache Components.",
        "\"How do you refresh cached data after a form submit?\" Strong answer: in the Server Action, update the data then call updateTag or revalidateTag for tagged data, or revalidatePath for a route, and explain the difference between them."
      ]
    },
    {
      "kind": "quiz",
      "question": "A Next.js 15 app has `const r = await fetch(url)` in a Server Component with no options. How often is the network called?",
      "options": [
        "Once at build time, then reused until the next full redeploy of the app",
        "On every request, since fetch is no longer cached by default",
        "Once per hour",
        "Once per user session"
      ],
      "answer": 1,
      "why": "Next.js 15 stopped caching fetch by default. Caching is something you opt in to, for example with cache: 'force-cache' or next.revalidate."
    },
    {
      "kind": "quiz",
      "question": "With Cache Components, a component reads `cookies()` and has no `<Suspense>` above it. What do you get?",
      "options": [
        "A silent fallback to client rendering, with no warning in the console",
        "A blocking-route insight telling you to add Suspense or cache",
        "The cookie value is cached for every user",
        "The page becomes a Pages Router page"
      ],
      "answer": 1,
      "why": "Runtime APIs such as cookies need a Suspense boundary so the static shell can still be built. The dev overlay reports a blocking route otherwise."
    },
    {
      "kind": "quiz",
      "question": "Which describes request memoisation, as opposed to the data cache?",
      "options": [
        "Results kept across many requests and users until a time limit or a tag expires them again",
        "Identical calls within one render share one result and the memo ends with the request",
        "A CDN storing static files",
        "The browser's HTTP cache"
      ],
      "answer": 1,
      "why": "Request memoisation lives for one render pass, so header, sidebar and page can ask for the same data once. The data cache outlives the request."
    }
  ]
};
