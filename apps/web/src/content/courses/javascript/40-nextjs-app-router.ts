import type { Chapter } from "@/content/courses/types";

export const chapterNextjsAppRouter: Chapter = {
  "slug": "nextjs-app-router",
  "title": "Next.js App Router: Routes, Layouts and the Server/Client Boundary",
  "summary": "In the App Router the folders are the routes, components are Server Components by default, and `'use client'` marks where the browser takes over. Learn the file conventions, the boundary as a serialisation rule, and Server Actions (as of Next.js 16).",
  "minutes": 24,
  "blocks": [
    {
      "kind": "p",
      "text": "Next.js is a React framework: it adds routing, server rendering, bundling and a place to run server code. Its current router is the **App Router**, built on React Server Components. Everything in this chapter is true as of **Next.js 16**; the file names are stable across recent versions, but the details of caching move fast, so the next chapter covers that separately."
    },
    {
      "kind": "h",
      "text": "The college campus map"
    },
    {
      "kind": "analogy",
      "title": "Building names are the addresses",
      "text": "On a college campus, the layout of buildings and floors is the map. \"Block C, second floor, Room 12\" is both the place and the address. The App Router works the same way: a folder is a URL segment, so `app/blog/[slug]/page.tsx` *is* the page at `/blog/some-post`. The main gate and the corridor shared by every room (the **layout**) wrap every room inside. Where the analogy stops: some rooms are prepared in advance by the staff (the server) and delivered ready, while others are only furnished by the visitor (the browser). Next.js lets you choose, room by room."
    },
    {
      "kind": "h",
      "text": "Folders are routes; special files do the work"
    },
    {
      "kind": "p",
      "text": "A folder inside `app/` becomes a URL segment. A folder only becomes reachable when it contains a `page` file. Special file names add behaviour: `layout` wraps the pages beneath it and stays mounted while you navigate between them; `loading` shows a fallback while the page's data is pending; `error` catches errors in that segment; `not-found` renders a 404; `route` defines an HTTP endpoint instead of a page (it cannot sit beside a `page` at the same segment). A folder in square brackets, such as `[slug]`, is a **dynamic segment** whose value arrives in `params`. A folder in parentheses, such as `(shop)`, groups files without adding anything to the URL."
    },
    {
      "kind": "code",
      "caption": "A MODEL of file-based routing: it turns a list of file paths into a route table and matches URLs, including a dynamic segment and a route group. It is not Next.js's router, and it skips parallel routes. Runs in the course editor and under node.",
      "code": "// A MODEL of file-based routing. Not Next.js's router: it applies the same idea,\n// \"the folder structure is the route table\", to a list of file paths.\nconst files = [\n  \"app/layout.tsx\",\n  \"app/page.tsx\",\n  \"app/blog/layout.tsx\",\n  \"app/blog/page.tsx\",\n  \"app/blog/[slug]/page.tsx\",\n  \"app/(shop)/cart/page.tsx\", // (group) folders organise files but add nothing to the URL\n  \"app/dashboard/@stats/page.tsx\", // ignored by this model: parallel routes\n  \"app/api/health/route.ts\",\n];\n\nfunction buildRoutes(paths) {\n  const routes = [];\n  for (const file of paths) {\n    const parts = file.replace(/^app\\//, \"\").split(\"/\");\n    const name = parts.pop(); // page.tsx, layout.tsx, route.ts\n    if (parts.some((p) => p.startsWith(\"@\"))) continue;\n    const segments = parts.filter((p) => !(p.startsWith(\"(\") && p.endsWith(\")\")));\n    if (name.startsWith(\"page.\") || name.startsWith(\"route.\")) {\n      routes.push({ pattern: \"/\" + segments.join(\"/\"), segments, file, kind: name.split(\".\")[0] });\n    }\n  }\n  return routes;\n}\n\nfunction layoutsFor(route, paths) {\n  if (route.kind === \"route\") return []; // route handlers do not use layouts\n  // layouts wrap the page from the root down to the route's own folder\n  const chain = [];\n  for (let i = 0; i <= route.segments.length; i++) {\n    const folder = [\"app\", ...route.segments.slice(0, i)].join(\"/\");\n    const layout = paths.find((f) => f.startsWith(folder + \"/layout.\"));\n    if (layout) chain.push(layout);\n  }\n  return chain;\n}\n\nfunction match(url, routes) {\n  const wanted = url.split(\"/\").filter(Boolean);\n  for (const route of routes) {\n    if (route.segments.length !== wanted.length) continue;\n    const params = {};\n    const ok = route.segments.every((seg, i) => {\n      if (seg.startsWith(\"[\") && seg.endsWith(\"]\")) {\n        params[seg.slice(1, -1)] = wanted[i]; // dynamic segment\n        return true;\n      }\n      return seg === wanted[i];\n    });\n    if (ok) return { route, params };\n  }\n  return null;\n}\n\nconst routes = buildRoutes(files);\nfor (const url of [\"/\", \"/blog\", \"/blog/hooks-explained\", \"/cart\", \"/api/health\", \"/missing\"]) {\n  const hit = match(url, routes);\n  if (!hit) {\n    console.log(url, \"-> 404\");\n    continue;\n  }\n  const layouts = layoutsFor(hit.route, files).length;\n  console.log(url, \"->\", hit.route.file, JSON.stringify(hit.params), \"layouts:\", layouts);\n}\n",
      "output": "/ -> app/page.tsx {} layouts: 1\n/blog -> app/blog/page.tsx {} layouts: 2\n/blog/hooks-explained -> app/blog/[slug]/page.tsx {\"slug\":\"hooks-explained\"} layouts: 2\n/cart -> app/(shop)/cart/page.tsx {} layouts: 1\n/api/health -> app/api/health/route.ts {} layouts: 0\n/missing -> 404",
      "tryIt": {
        "language": "javascript",
        "prompt": "Add `\"app/blog/[slug]/layout.tsx\"` to the list and predict the layout count for `/blog/hooks-explained`. Then add a second page at `app/(shop)/blog/page.tsx` and predict which file `/blog` matches."
      }
    },
    {
      "kind": "code",
      "caption": "A root layout, a dynamic page that awaits params, and a loading file. Runs inside a Next.js 16 project, so no output is shown.",
      "code": "// The App Router file conventions, as of Next.js 16. Runs inside a Next.js project.\n\n// ---- app/layout.tsx : the root layout, required, wraps every page ----\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body>{children}</body>\n    </html>\n  );\n}\n\n// ---- app/blog/[slug]/page.tsx : a Server Component by default ----\n// params is a Promise: since Next.js 15, request APIs are async.\nexport default async function Page({ params }: { params: Promise<{ slug: string }> }) {\n  const { slug } = await params;\n  const post = await getPost(slug); // runs on the server; the DB client never reaches the browser\n  return (\n    <article>\n      <h1>{post.title}</h1>\n      <LikeButton likes={post.likes} /> {/* a Client Component, see below */}\n    </article>\n  );\n}\n\n// ---- app/blog/[slug]/loading.tsx : shown (via Suspense) while the page above is pending ----\nexport function Loading() {\n  return <p>Loading post...</p>;\n}\n"
    },
    {
      "kind": "h",
      "text": "Server Components by default"
    },
    {
      "kind": "concept",
      "title": "Layouts and pages are Server Components (nextjs.org, \"Server and Client Components\")",
      "text": "In the App Router every component is a **Server Component** unless a file says otherwise. A Server Component renders on the server, can be `async`, can read a database or use a secret directly, and its JavaScript is not sent to the browser. A **Client Component** is one defined in a file that starts with `'use client'`. You need one when you use state, event handlers, effects, browser-only APIs such as `localStorage`, or custom hooks built on them."
    },
    {
      "kind": "compare",
      "title": "Where should it run?",
      "columns": [
        {
          "label": "Server Component",
          "items": [
            "Fetch data close to the source.",
            "Use API keys and tokens without exposing them.",
            "Send less JavaScript to the browser.",
            "Cannot use state, effects or event handlers."
          ]
        },
        {
          "label": "Client Component",
          "items": [
            "State and event handlers (`onClick`, `onChange`).",
            "Effects and browser APIs (`window`, `localStorage`).",
            "Prerendered to HTML on the server for the first load, then hydrated.",
            "Its module imports join the client bundle."
          ]
        }
      ]
    },
    {
      "kind": "h",
      "text": "The boundary is a serialisation rule"
    },
    {
      "kind": "p",
      "text": "`'use client'` declares a **boundary** between the server and client module graphs. Once a file has it, the modules it imports and the components it renders directly are in the client bundle, so you do not mark every child. Placing the directive on a large layout ships far more JavaScript than needed, so mark the smallest interactive leaf (a search box, a like button), not the page. Two related facts that tutorials often get wrong: the directive does *not* mean \"renders only in the browser\" (Client Components are prerendered to HTML on the server too), and a Server Component *can* be passed into a Client Component as `children`, because it is rendered on the server first and sent as output."
    },
    {
      "kind": "p",
      "text": "Because the server and the browser are different machines, props sent from a Server Component to a Client Component travel as data in the RSC payload. They must be **serialisable**, which excludes functions (other than Server Functions) and class instances. The model below turns that rule into a check you can run. It is simplified: React accepts more types than this one does, such as Map, Set and Promise."
    },
    {
      "kind": "code",
      "caption": "A MODEL of the Server to Client Component boundary as a serialisation check. It rejects functions and class instances, which is the rule that surprises people. Simplified: real React also allows Map, Set, Promise, FormData and more. Runs in the course editor and under node.",
      "code": "// A MODEL of the Server -> Client Component boundary as a serialisation check.\n// Props cross the boundary as data (the RSC payload), so a function cannot go\n// across. SIMPLIFIED: React accepts more types (Map, Set, Promise, FormData...).\nfunction serialisable(value, path = \"props\") {\n  if (value === null || [\"string\", \"number\", \"boolean\", \"undefined\", \"bigint\"].includes(typeof value)) {\n    return null;\n  }\n  if (typeof value === \"function\") {\n    return `${path} is a function. Functions cannot be passed from a Server to a Client Component`;\n  }\n  if (value instanceof Date) return null;\n  if (Array.isArray(value)) {\n    for (let i = 0; i < value.length; i++) {\n      const problem = serialisable(value[i], `${path}[${i}]`);\n      if (problem) return problem;\n    }\n    return null;\n  }\n  const proto = Object.getPrototypeOf(value);\n  if (proto !== Object.prototype) {\n    return `${path} is a class instance. Only plain objects can cross the boundary`;\n  }\n  for (const [key, v] of Object.entries(value)) {\n    const problem = serialisable(v, `${path}.${key}`);\n    if (problem) return problem;\n  }\n  return null;\n}\n\nfunction renderClientComponent(name, props) {\n  const problem = serialisable(props);\n  if (problem) return `${name}: ERROR ${problem}`;\n  // what actually travels: JSON-like data, not live objects\n  return `${name}: ok, sent fields: ${Object.keys(props).join(\", \")}`;\n}\n\nclass Post {\n  constructor(title) {\n    this.title = title;\n  }\n}\n\nconsole.log(renderClientComponent(\"LikeButton\", { likes: 12, postedAt: new Date(0) }));\nconsole.log(renderClientComponent(\"LikeButton\", { likes: 12, onLike: () => {} }));\nconsole.log(renderClientComponent(\"PostCard\", { post: new Post(\"Hooks\") }));\nconsole.log(renderClientComponent(\"PostCard\", { post: { ...new Post(\"Hooks\") }, tags: [\"react\", \"next\"] }));\n",
      "output": "LikeButton: ok, sent fields: likes, postedAt\nLikeButton: ERROR props.onLike is a function. Functions cannot be passed from a Server to a Client Component\nPostCard: ERROR props.post is a class instance. Only plain objects can cross the boundary\nPostCard: ok, sent fields: post, tags",
      "tryIt": {
        "language": "javascript",
        "prompt": "Add a field `tags: new Set([\"react\"])` to the first call and predict what this model does, then say whether real React would accept it."
      }
    },
    {
      "kind": "steps",
      "title": "What happens on the first visit to a page",
      "steps": [
        {
          "label": "Server render",
          "text": "Server Components render into the RSC payload. Client Components and that payload are used to prerender the HTML."
        },
        {
          "label": "HTML arrives",
          "text": "The browser shows a fast, non-interactive preview of the route straight away."
        },
        {
          "label": "Reconcile",
          "text": "The RSC payload is used to reconcile the server and client trees, with placeholders where Client Components go."
        },
        {
          "label": "Hydrate",
          "text": "JavaScript for Client Components loads and attaches event handlers, so the page becomes interactive."
        }
      ]
    },
    {
      "kind": "h",
      "text": "Server Actions: mutations without writing an endpoint"
    },
    {
      "kind": "p",
      "text": "A **Server Function** is an async function that runs on the server and that the client can call over the network. When one is used for a form or mutation it is a **Server Action**. You mark it with `'use server'`, either at the top of a function body or at the top of a separate file (which marks all its exports). Passing it to a form's `action` prop calls it with the submitted `FormData`; in a Server Component the form even works before JavaScript has loaded. After changing data, call `revalidatePath` or `revalidateTag` and `redirect`. One security fact matters more than the rest: a Server Action is reachable by a direct POST request, not only through your UI, so check authentication and authorisation inside every action."
    },
    {
      "kind": "code",
      "caption": "A Client Component and a Server Action with the auth check inside it. Runs inside a Next.js 16 project, so no output is shown.",
      "code": "// A Client Component and a Server Action, as of Next.js 16. Runs inside a Next.js project.\n\n// ---- app/ui/like-button.tsx ----\n\"use client\"; // everything this file imports joins the client bundle\n\nimport { useState } from \"react\";\n\nexport default function LikeButton({ likes }: { likes: number }) {\n  const [count, setCount] = useState(likes);\n  return <button onClick={() => setCount(count + 1)}>{count} likes</button>;\n}\n\n// ---- app/actions.ts ---- (in its own file; the directive marks every export a Server Function)\n// \"use server\";\n//\n// import { revalidatePath } from \"next/cache\";\n// import { redirect } from \"next/navigation\";\n//\n// export async function createPost(formData: FormData) {\n//   const session = await auth();                     // check auth INSIDE every action:\n//   if (!session?.user) throw new Error(\"Unauthorized\"); // it is a public POST endpoint\n//   await db.posts.insert({ title: String(formData.get(\"title\")) });\n//   revalidatePath(\"/posts\");\n//   redirect(\"/posts\");                               // throws; nothing after it runs\n// }\n\n// ---- app/posts/new/page.tsx : a form that calls the action, works before JS loads ----\n// import { createPost } from \"@/app/actions\";\n// export default function NewPost() {\n//   return (\n//     <form action={createPost}>\n//       <input name=\"title\" />\n//       <button>Create</button>\n//     </form>\n//   );\n// }\n"
    },
    {
      "kind": "pitfall",
      "items": [
        "Putting `'use client'` on a whole layout or page \"to make it work\". Everything under it joins the client bundle. Fix: move the directive to the smallest interactive component and keep the rest on the server.",
        "Passing a function, or a class instance, as a prop from a Server Component to a Client Component. It cannot be serialised. Fix: pass plain data, and define the handler inside the Client Component (or pass a Server Action).",
        "Reading `params` or `searchParams` synchronously. Since Next.js 15 they are Promises, and 16 removed synchronous access. Fix: `const { slug } = await params`.",
        "Trusting that a Server Action is protected because only your form calls it. It is a public POST endpoint. Fix: verify the session and the user's permission inside the action.",
        "Using a context provider in a Server Component. Context is not supported there. Fix: put the provider in a small Client Component that takes `children` and render it in the layout."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "Folders are URL segments; a segment is reachable only with a page (or route) file. layout wraps, loading and error handle the in-between states.",
        "Components are Server Components by default. Add 'use client' only where you need state, events, effects or browser APIs, and keep it on small leaves.",
        "Props crossing from server to client must be serialisable data: no ordinary functions, no class instances.",
        "A Server Action is a public POST endpoint: authenticate and authorise inside it, then revalidate and redirect."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"What is the difference between Server and Client Components?\" Strong answer: Server Components render on the server, can be async and keep secrets and heavy dependencies off the client, but cannot use state or events; Client Components (use client) add interactivity and are also prerendered on the server for the first load.",
        "\"Does 'use client' mean the component only runs in the browser?\" Strong answer: no. It marks a module boundary; the component is still prerendered to HTML on the server, then hydrated. It also does not need repeating on every child.",
        "\"How do layouts differ from templates and pages?\" Strong answer: a layout wraps child segments and persists across navigation without re-mounting, so its state is kept; a page is the unique UI of a route.",
        "\"How do Server Actions work and what are the risks?\" Strong answer: 'use server' functions called through a POST that Next.js generates; they must authenticate and validate input themselves because anyone can call the endpoint."
      ]
    },
    {
      "kind": "quiz",
      "question": "A Server Component passes `onSave={() => save()}` to a Client Component. What happens?",
      "options": [
        "It works, the function is sent to the browser as a serialised copy of its source code",
        "It fails: ordinary functions cannot be serialised across the boundary",
        "It works only in development",
        "It becomes a Server Action automatically"
      ],
      "answer": 1,
      "why": "Props cross the boundary as serialised data. Ordinary functions are not serialisable; only functions marked 'use server' (Server Functions) can be passed."
    },
    {
      "kind": "quiz",
      "question": "Which file path creates a page at `/blog/hooks` for a dynamic post?",
      "options": [
        "app/blog/[slug]/page.tsx",
        "app/blog/slug.tsx",
        "app/blog/(slug)/index.tsx",
        "pages/blog/[slug]/route.ts"
      ],
      "answer": 0,
      "why": "A folder in square brackets is a dynamic segment, and the folder needs a page file to be reachable. The slug arrives in params."
    },
    {
      "kind": "quiz",
      "question": "A file starts with `'use client'` and renders `<Chart />`, which it imports. Where does Chart's code end up?",
      "options": [
        "Only on the server",
        "In the client bundle too",
        "In neither, it is not imported",
        "In a service worker"
      ],
      "answer": 1,
      "why": "The directive marks a boundary: the modules a Client Component imports and the components it renders directly are included in the client bundle."
    }
  ]
};
