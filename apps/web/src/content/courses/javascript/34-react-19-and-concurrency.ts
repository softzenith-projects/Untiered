import type { Chapter } from "@/content/courses/types";

export const chapterReact19AndConcurrency: Chapter = {
  "slug": "react-19-and-concurrency",
  "title": "React 19: Actions, use, Transitions and Server Components",
  "summary": "What React 19 added for forms and data (`useActionState`, `useFormStatus`, `useOptimistic`, `use`), what concurrent rendering gives you (`useTransition`, `useDeferredValue`), and what a Server Component is. Each fact is checked against react.dev.",
  "minutes": 22,
  "blocks": [
    {
      "kind": "p",
      "text": "React 19 became stable on 5 December 2024. Its main idea is an **Action**: an async function that React tracks for you, with a pending flag, error handling and optimistic updates already built in. Next to it sits an older idea that finally matured, **concurrent rendering**: React can start an update, pause it for something more urgent, and finish later. This chapter covers both, and then the thing that makes frameworks like Next.js different, Server Components."
    },
    {
      "kind": "h",
      "text": "The cinema ticket window"
    },
    {
      "kind": "analogy",
      "title": "Booking a seat while the clerk checks",
      "text": "At a cinema counter you ask for seat F7. The clerk prints a provisional ticket straight away so you can walk to the gate (the **optimistic** result), while the booking system confirms in the background. If the seat was already taken, the ticket is cancelled and you are told. Meanwhile the clerk keeps serving the queue instead of freezing. An **Action** is the whole booking request with its \"please wait\" state. **Optimistic UI** is the provisional ticket. A **transition** is the clerk deciding the booking can wait if someone urgent walks up. Where the analogy stops: React shows the optimistic value only while the Action runs, then replaces it with the real value, whatever that is."
    },
    {
      "kind": "h",
      "text": "Actions: async work that React tracks"
    },
    {
      "kind": "concept",
      "title": "What counts as an Action (react.dev, \"React 19\" and \"useTransition\")",
      "text": "An **Action** is a function run inside a transition, which can be async. React keeps `isPending` true until it finishes, handles errors through error boundaries, and lets you update optimistic state. A function passed to a form's `action` prop is run as an Action. In React 19, `startTransition` accepts async functions. Updates made after an `await` are not automatically part of the transition; wrap them in another `startTransition`."
    },
    {
      "kind": "compare",
      "title": "The form hooks, in one view",
      "columns": [
        {
          "label": "useActionState and useFormStatus",
          "items": [
            "`useActionState(fn, initialState)` returns `[state, formAction, isPending]`. The function gets (previousState, formData) when used as a form action.",
            "Calls are queued, each one receiving the previous call's result as `previousState`.",
            "`useFormStatus()` comes from react-dom and returns `{ pending }` for the parent `<form>`, so a design-system button needs no props."
          ]
        },
        {
          "label": "useOptimistic and use",
          "items": [
            "`useOptimistic(value, reducer?)` returns `[optimisticState, setOptimistic]`. It shows the optimistic value only while an Action runs, then goes back to `value`. Call the setter inside an Action.",
            "`use(promise)` reads a promise during render and suspends. The promise must come from a cache or a Server Component, not be created in render.",
            "`use(Context)` reads context, and unlike hooks it can be called conditionally."
          ]
        }
      ]
    },
    {
      "kind": "p",
      "text": "The model below isolates one part: what the user sees across an Action, with and without a failure. It is a model of the visible sequence, not React's implementation. Notice that the optimistic value appears immediately and disappears when the Action ends, and that the *real* value is the only thing that survives. A failed save therefore \"rolls back\" without any rollback code: the real value never changed."
    },
    {
      "kind": "code",
      "caption": "A MODEL of an Action with a pending flag and an optimistic value that reverts. Runs in the course editor and under node, using timers of 20 ms.",
      "code": "// A MODEL of an Action with a pending flag and an optimistic value that reverts.\n// Not React's source: it only reproduces the visible sequence of states.\nfunction createLikeButton(save) {\n  let likes = 3; // the real value (what useOptimistic calls `value`)\n  let optimistic = null; // shown only while an Action is running\n  let pending = false;\n\n  const view = () => `likes=${optimistic ?? likes} pending=${pending}`;\n\n  async function action() {\n    pending = true;\n    optimistic = likes + 1; // set immediately, before the server answers\n    console.log(\"click      ->\", view());\n    try {\n      likes = await save(likes + 1); // the real value changes only if saving works\n    } catch (err) {\n      console.log(\"save failed:\", err.message);\n    }\n    optimistic = null; // when the Action ends, the UI shows the real value again\n    pending = false;\n    console.log(\"action end ->\", view());\n  }\n  return { action };\n}\n\nconst ok = createLikeButton(\n  (n) => new Promise((resolve) => setTimeout(() => resolve(n), 20)),\n);\nconst failing = createLikeButton(\n  () => new Promise((_, reject) => setTimeout(() => reject(new Error(\"offline\")), 20)),\n);\n\nconsole.log(\"-- server accepts --\");\nok.action().then(() => {\n  console.log(\"-- server fails --\");\n  return failing.action();\n});\n",
      "output": "-- server accepts --\nclick      -> likes=4 pending=true\naction end -> likes=4 pending=false\n-- server fails --\nclick      -> likes=4 pending=true\nsave failed: offline\naction end -> likes=3 pending=false",
      "tryIt": {
        "language": "javascript",
        "prompt": "Change the failing save so it rejects after 5 ms and the working one after 40 ms, and predict whether the printed sequence changes. Then make the working save return `n + 1` instead of `n` and predict the final likes."
      }
    },
    {
      "kind": "code",
      "caption": "All five new tools in a few lines each: a form Action with useActionState and useFormStatus, useOptimistic inside a transition, use() with Suspense, and useDeferredValue. Runs inside a React app, so no output is shown.",
      "code": "// React 19 form Actions, optimistic UI and use(). Runs inside a React app (client components).\nimport { Suspense, use, useActionState, useDeferredValue, useOptimistic, useState, useTransition } from \"react\";\nimport { useFormStatus } from \"react-dom\";\n\n// 1. A form Action: the function receives (previousState, formData) and may be async.\nasync function subscribe(previous: { message: string }, formData: FormData) {\n  const email = String(formData.get(\"email\") ?? \"\");\n  if (!email.includes(\"@\")) return { message: \"Enter a valid email\" };\n  await fetch(\"/api/subscribe\", { method: \"POST\", body: formData });\n  return { message: `Subscribed ${email}` };\n}\n\nfunction SubmitButton() {\n  const { pending } = useFormStatus(); // reads the status of the parent <form>\n  return <button disabled={pending}>{pending ? \"Sending...\" : \"Subscribe\"}</button>;\n}\n\nexport function SubscribeForm() {\n  const [state, formAction, isPending] = useActionState(subscribe, { message: \"\" });\n  return (\n    <form action={formAction}>\n      <input name=\"email\" type=\"email\" />\n      <SubmitButton />\n      <p aria-live=\"polite\">{isPending ? \"Working...\" : state.message}</p>\n    </form>\n  );\n}\n\n// 2. Optimistic UI: show the expected result while the Action runs; it reverts on failure.\nexport function LikeButton({ likes, save }: { likes: number; save: () => Promise<void> }) {\n  const [optimisticLikes, addOptimistic] = useOptimistic(likes, (current, add: number) => current + add);\n  const [, startTransition] = useTransition();\n  return (\n    <button\n      onClick={() =>\n        startTransition(async () => {\n          addOptimistic(1); // must run inside an Action / transition\n          await save();\n        })\n      }\n    >\n      {optimisticLikes} likes\n    </button>\n  );\n}\n\n// 3. use(): read a promise during render. The promise must be created outside render\n// (for example in a Server Component or a cache), otherwise it is a new one every render.\nexport function Comments({ commentsPromise }: { commentsPromise: Promise<string[]> }) {\n  const comments = use(commentsPromise); // suspends until resolved\n  return (\n    <ul>\n      {comments.map((c) => (\n        <li key={c}>{c}</li>\n      ))}\n    </ul>\n  );\n}\nexport function Page({ commentsPromise }: { commentsPromise: Promise<string[]> }) {\n  return (\n    <Suspense fallback={<p>Loading comments...</p>}>\n      <Comments commentsPromise={commentsPromise} />\n    </Suspense>\n  );\n}\n\n// 4. useDeferredValue: keep typing responsive while a slow list catches up.\nexport function Search({ items }: { items: string[] }) {\n  const [query, setQuery] = useState(\"\");\n  const deferred = useDeferredValue(query);\n  return (\n    <>\n      <input value={query} onChange={(e) => setQuery(e.target.value)} />\n      <p>{items.filter((i) => i.includes(deferred)).length} matches</p>\n    </>\n  );\n}\n"
    },
    {
      "kind": "h",
      "text": "Concurrent rendering: urgent versus not urgent"
    },
    {
      "kind": "p",
      "text": "Typing in a box must feel instant, even if a big list below has to be recalculated. **Concurrent rendering** lets React treat the two updates differently. `useTransition` returns `[isPending, startTransition]`: updates inside `startTransition` are non-blocking and interruptible, so if the user types again, React handles the typing first and restarts the slow render. `useDeferredValue(value)` does the same job when you do not own the state (it comes from props): React re-renders at once with the old value, then renders the new value in the background. A transition cannot control a text input; the input value itself must update synchronously."
    },
    {
      "kind": "compare",
      "title": "useTransition or useDeferredValue?",
      "columns": [
        {
          "label": "useTransition",
          "items": [
            "You own the state and can wrap the setter.",
            "Gives you `isPending` for a spinner.",
            "Marks a particular update as not urgent."
          ]
        },
        {
          "label": "useDeferredValue",
          "items": [
            "The value comes from props or another hook.",
            "No `isPending`; compare the deferred and current value yourself.",
            "A lagging copy of a value that React renders in the background."
          ]
        }
      ]
    },
    {
      "kind": "h",
      "text": "Server Components, briefly"
    },
    {
      "kind": "p",
      "text": "A **Server Component** renders ahead of time on the server (or at build time), not in the browser. It can be an `async` function that reads a database directly, and its code is not sent to the client. It cannot hold state, run effects or handle clicks. A **Client Component**, marked with `'use client'` at the top of its file, is the ordinary kind that you have written so far: it is also prerendered on the server for the first load, then hydrated in the browser. A Server Component can render Client Components, passing them props that must be serialisable. The directive `'use server'` is a different thing: it marks **Server Functions** (what a form Action can call), not Server Components. Chapter 40 builds on this in Next.js."
    },
    {
      "kind": "code",
      "caption": "A Server Component rendering a Client Component, as a framework like Next.js runs them. Runs inside a framework with RSC support, so no output is shown.",
      "code": "// A Server Component (no directive) and a Client Component ('use client'), as a framework\n// such as Next.js runs them. Server Components have no state or effects and may be async.\n\n// ---- app/notes.tsx : a Server Component (runs on the server or at build time) ----\nimport { LikeButton } from \"./like-button\";\n\nexport default async function Notes() {\n  const notes: { id: number; text: string }[] = await db.notes.findMany(); // direct data access\n  return (\n    <ul>\n      {notes.map((n) => (\n        <li key={n.id}>\n          {n.text} <LikeButton id={n.id} />\n        </li>\n      ))}\n    </ul>\n  );\n}\n\n// ---- app/like-button.tsx : a Client Component (hydrated in the browser) ----\n// 'use client'\n// import { useState } from \"react\";\n// export function LikeButton({ id }: { id: number }) {\n//   const [liked, setLiked] = useState(false);\n//   return <button onClick={() => setLiked(!liked)}>{liked ? \"Liked\" : \"Like\"}</button>;\n// }\n"
    },
    {
      "kind": "pitfall",
      "items": [
        "Creating a promise during render and passing it to `use()`. It is a new promise every render, so React suspends forever or warns. Fix: create it outside render, in a cache, or in a Server Component and pass it down.",
        "Calling the `useOptimistic` setter outside an Action. React warns and the optimistic value flashes then reverts. Fix: call it inside `startTransition` or a form action.",
        "Updating state after an `await` inside an Action and expecting it to be a transition. The context is lost after the await. Fix: wrap that update in another `startTransition`.",
        "Using `useFormStatus` in the same component that renders the `<form>`. It reads the *parent* form, so it returns nothing useful there. Fix: call it in a child component such as the submit button.",
        "Wrapping the text input's own state update in a transition. Input updates must be synchronous. Fix: keep the input state urgent and defer the expensive derived value."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "An Action is an async function run in a transition: React tracks pending, errors and optimistic state for you.",
        "useActionState returns [state, formAction, isPending]; useFormStatus reads the parent form's pending flag; useOptimistic reverts when the Action ends.",
        "use(promise) reads a promise in render and can be called conditionally, but the promise must be stable, not created in render.",
        "Transitions mark updates as non-urgent and interruptible. Server Components render on the server and send no component code to the browser."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"What is new in React 19?\" Strong answer: Actions and the hooks around them (useActionState, useFormStatus, useOptimistic), the use API, ref as a prop, and stable Server Components support. Avoid listing every item; explain Actions first.",
        "\"What does useTransition do, and how is it different from useDeferredValue?\" Strong answer: both let urgent updates stay responsive; transition wraps a state update you own and gives isPending, deferred value lags a value you receive.",
        "\"How does use differ from other hooks?\" Strong answer: it reads a promise or context during render, can be called conditionally, and (despite the name) is not a hook in the sense of the Rules of Hooks; it still must be called during render and not in try/catch.",
        "\"What is the difference between a Server Component and a Client Component?\" Strong answer: Server Components render on the server, can be async and access data directly, but cannot hold state or handle events; 'use client' marks the boundary where interactivity starts."
      ]
    },
    {
      "kind": "quiz",
      "question": "A like button uses `useOptimistic`. The save call fails and the real value never changes. What does the user see after the Action ends?",
      "options": [
        "The optimistic value stays",
        "The real value again",
        "An empty button",
        "A thrown render error always"
      ],
      "answer": 1,
      "why": "Optimistic state renders only while the Action runs. When it ends, React shows the real value, which was never changed, so the UI reverts."
    },
    {
      "kind": "quiz",
      "question": "Inside an Action you write `await save(); setCount(5);` in a plain async function passed to `startTransition`. Is `setCount` a transition update?",
      "options": [
        "Yes, everything in the function counts as one transition update",
        "No, updates after an await need their own startTransition",
        "Only in production",
        "Only if it is the last line"
      ],
      "answer": 1,
      "why": "React loses the async context after an await, so updates after it must be wrapped in another startTransition to be treated as transitions."
    },
    {
      "kind": "quiz",
      "question": "Which marks a file's components as Client Components?",
      "options": [
        "'use server' at the top",
        "'use client' at the top",
        "export const client = true",
        "A .client.tsx file name"
      ],
      "answer": 1,
      "why": "The 'use client' directive marks the boundary to client code. 'use server' is for Server Functions, which is a different feature."
    }
  ]
};
