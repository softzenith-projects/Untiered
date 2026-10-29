import type { Chapter } from "@/content/courses/types";

export const chapterMemoisationAndPerformance: Chapter = {
  "slug": "memoisation-and-performance",
  "title": "Memoisation and Performance: memo, useMemo, useCallback and the Compiler",
  "summary": "Why does a child re-render when nothing changed? Learn how `memo`, `useMemo` and `useCallback` rest on reference equality, when they actually help, what React Compiler 1.0 now does for you, and how `lazy` and `Suspense` split code.",
  "minutes": 18,
  "blocks": [
    {
      "kind": "p",
      "text": "A React component re-renders when its state changes or when its parent re-renders. The second reason surprises people: a child gets rendered again even when you pass it exactly the same data. Usually that is fine, because rendering is fast. When it is not, three tools let you skip work. All three work by one idea, **reference equality**, and all three have a cost. This chapter shows the idea, then the tools, then the compiler that now applies them for you."
    },
    {
      "kind": "h",
      "text": "The chai stall order slip"
    },
    {
      "kind": "analogy",
      "title": "Remembering yesterday's order",
      "text": "A chai stall owner has a regular who orders \"two cutting chai, less sugar\" every morning. If the owner remembers the order, he does not ask or write a fresh slip; he just starts pouring. But he only trusts his memory when the order is *exactly* the same. If the customer says it slightly differently each day, he has to listen again. **Memoisation** is that memory: React keeps the last result and skips the work if the inputs are the same as last time. Where the analogy stops: the owner compares meaning, but React compares by **reference**. Two objects with identical contents but created separately look different to React, like two differently worded slips."
    },
    {
      "kind": "h",
      "text": "Reference equality is the whole mechanism"
    },
    {
      "kind": "concept",
      "title": "How the three tools decide (react.dev, `memo` and `useMemo` references)",
      "text": "`memo(Component)` compares each prop with `Object.is` and skips the render if all are equal. `useMemo(fn, deps)` and `useCallback(fn, deps)` compare the dependency array item by item with `Object.is` and reuse the previous value or function if nothing changed. Primitives compare by value. Objects, arrays and functions compare by reference, and a literal in the component body is a new one on every render."
    },
    {
      "kind": "p",
      "text": "The model below shows the idea in plain JavaScript. It is a model, not React's source. A child wrapped in a `memo`-like helper is called three times. In the first run the parent builds a new options object each time, so the shallow comparison fails every time. In the second the parent keeps one object with a `useMemo`-like helper, so the child is skipped. The last part shows a memoised calculation re-running only when its input changes."
    },
    {
      "kind": "code",
      "caption": "A MODEL of memo and useMemo by Object.is comparison, with render counters. Runs in the course editor and under node. React's real versions also store the results per component instance.",
      "code": "// A MODEL of React.memo and useMemo: skip the work when the inputs are\n// \"the same\" by reference (Object.is). Not React's source.\nfunction shallowEqual(a, b) {\n  const ka = Object.keys(a);\n  const kb = Object.keys(b);\n  return ka.length === kb.length && ka.every((k) => Object.is(a[k], b[k]));\n}\n\nfunction memo(component) {\n  let lastProps = null;\n  let lastResult;\n  return function (props) {\n    if (lastProps && shallowEqual(lastProps, props)) return lastResult; // skipped\n    lastProps = props;\n    lastResult = component(props);\n    return lastResult;\n  };\n}\n\nfunction useMemoFactory() {\n  let deps = null;\n  let value;\n  return function useMemo(compute, nextDeps) {\n    if (deps && nextDeps.every((d, i) => Object.is(d, deps[i]))) return value;\n    deps = nextDeps;\n    value = compute();\n    return value;\n  };\n}\n\nlet childRenders = 0;\nconst Child = memo(({ options, label }) => {\n  childRenders++;\n  return `${label}:${options.sort}`;\n});\n\n// Parent renders three times with the same data.\nconsole.log(\"new object each time:\");\nfor (let i = 0; i < 3; i++) Child({ options: { sort: \"asc\" }, label: \"list\" });\nconsole.log(\"  child rendered\", childRenders, \"times\");\n\nchildRenders = 0;\nconst useMemo = useMemoFactory();\nconsole.log(\"object kept with useMemo:\");\nfor (let i = 0; i < 3; i++) {\n  const options = useMemo(() => ({ sort: \"asc\" }), []); // same reference each render\n  Child({ options, label: \"list\" });\n}\nconsole.log(\"  child rendered\", childRenders, \"times\");\n\nlet expensiveRuns = 0;\nconst useMemo2 = useMemoFactory();\nfor (const query of [\"dal\", \"dal\", \"roti\", \"roti\", \"dal\"]) {\n  useMemo2(() => {\n    expensiveRuns++;\n    return query.toUpperCase();\n  }, [query]);\n}\nconsole.log(\"expensive calculation ran\", expensiveRuns, \"times for 5 renders\");\n",
      "output": "new object each time:\n  child rendered 3 times\nobject kept with useMemo:\n  child rendered 1 times\nexpensive calculation ran 3 times for 5 renders",
      "tryIt": {
        "language": "javascript",
        "prompt": "Pass `options: \"asc\"` (a string) instead of an object in the first loop and predict the render count. Why does it change?"
      }
    },
    {
      "kind": "code",
      "caption": "memo, useMemo and useCallback working together, and lazy with Suspense. Runs inside a React app, so no output is shown.",
      "code": "// The three memoisation tools and code splitting. Runs inside a React app.\nimport { lazy, memo, Suspense, useCallback, useMemo, useState } from \"react\";\n\n// 1. memo: skip re-rendering this component when its props are shallow-equal.\nconst Row = memo(function Row({ name, onPick }: { name: string; onPick: (n: string) => void }) {\n  return <li onClick={() => onPick(name)}>{name}</li>;\n});\n\nfunction Menu({ items }: { items: string[] }) {\n  const [query, setQuery] = useState(\"\");\n  const [picked, setPicked] = useState(\"\");\n\n  // 2. useMemo: reuse a calculation while its dependencies are unchanged.\n  const visible = useMemo(() => items.filter((i) => i.includes(query)), [items, query]);\n\n  // 3. useCallback: keep the same function identity so memo(Row) can skip.\n  const pick = useCallback((name: string) => setPicked(name), []);\n\n  return (\n    <>\n      <input value={query} onChange={(e) => setQuery(e.target.value)} />\n      <p>Picked: {picked}</p>\n      <ul>\n        {visible.map((name) => (\n          <Row key={name} name={name} onPick={pick} />\n        ))}\n      </ul>\n    </>\n  );\n}\n\n// 4. Code splitting: the chart's JavaScript downloads only when it is first rendered.\nconst Chart = lazy(() => import(\"./Chart\"));\n\nfunction Report() {\n  return (\n    <Suspense fallback={<p>Loading chart...</p>}>\n      <Chart />\n    </Suspense>\n  );\n}\n"
    },
    {
      "kind": "h",
      "text": "When memoisation helps, and when it does not"
    },
    {
      "kind": "compare",
      "title": "Worth it, or noise?",
      "columns": [
        {
          "label": "Worth it",
          "items": [
            "The component is expensive to render, and it re-renders often with equal props (measured in the React DevTools Profiler).",
            "A calculation is slow (a big filter, sort or parse), and its inputs change rarely.",
            "A memoised value is an effect dependency and you do not want the effect to re-run."
          ]
        },
        {
          "label": "Usually noise",
          "items": [
            "Memoising cheap components or tiny calculations; the comparison costs about as much as the work.",
            "Wrapping a component in `memo` while passing it a new object, array or function on every render. The memo never hits.",
            "Adding it \"just in case\" before measuring."
          ]
        }
      ]
    },
    {
      "kind": "h",
      "text": "React Compiler 1.0"
    },
    {
      "kind": "p",
      "text": "React Compiler is a build-time tool that adds this memoisation automatically. React announced version 1.0 as stable on 7 October 2025. According to react.dev, it works on plain JavaScript and understands the Rules of React, and it memoises only components and hooks, not every function. It can skip the cascading re-render of a child, and it can skip an expensive calculation inside a component. It can even handle the inline arrow case that breaks a hand-written `useCallback`."
    },
    {
      "kind": "code",
      "caption": "Turning the compiler on in a Next.js 16 project (reactCompiler was promoted from experimental in 16 and is not on by default). Runs at build time inside a Next.js project, so no output is shown.",
      "code": "// next.config.ts: turn on React Compiler in Next.js 16 (promoted from experimental in 16).\n// Needs: npm install babel-plugin-react-compiler@latest\n// Runs at build time inside a Next.js project.\nimport type { NextConfig } from \"next\";\n\nconst nextConfig: NextConfig = {\n  reactCompiler: true,\n};\n\nexport default nextConfig;\n"
    },
    {
      "kind": "p",
      "text": "What does that mean for the hooks you just learned? React's guidance is: for new code, rely on the compiler and keep `useMemo` and `useCallback` where you need precise control; for existing code, leave existing memoisation in place, because removing it can change the compiler's output. Interviews still ask about all three, and many codebases run without the compiler, so you need both pictures."
    },
    {
      "kind": "h",
      "text": "Code splitting with lazy and Suspense"
    },
    {
      "kind": "p",
      "text": "Memoisation saves work after the page loads. **Code splitting** saves download time before it: `lazy(() => import('./Chart'))` tells the bundler to put the component in a separate file that downloads the first time React renders it. While it loads, the nearest `<Suspense fallback=...>` above it shows the fallback. Split on routes and on heavy, rarely used components, such as a chart or a rich-text editor."
    },
    {
      "kind": "pitfall",
      "items": [
        "Wrapping a component in `memo` and then passing it an inline object, array or arrow function. Every render creates a new reference, so memo never skips. Fix: stabilise the prop with `useMemo`/`useCallback`, or move the value out of the component.",
        "Omitting a dependency from `useMemo`/`useCallback` to keep the reference stable. The function then reads stale values. Fix: list every reactive value it reads and restructure so the list is small.",
        "Optimising without measuring. You add complexity and no speed. Fix: profile first, in the React DevTools Profiler, and fix the slow render itself (state placed too high, a huge list) before reaching for memo.",
        "Memoising a calculation that is cheap, then paying the comparison cost on every render. Fix: only memoise work you have measured as slow.",
        "Assuming the compiler fixes code that breaks the Rules of React (mutating props, reading refs in render). Fix: keep components pure; the compiler relies on it."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "memo, useMemo and useCallback all compare with Object.is. Objects, arrays and functions created in render are new references every time.",
        "memo skips a component render, useMemo caches a value, useCallback caches a function. useCallback(fn) is useMemo(() => fn).",
        "Measure first. Memoisation has a cost and does nothing when a prop changes identity on every render.",
        "React Compiler 1.0 memoises components and hooks automatically at build time; keep manual hooks for precise control and for codebases without it."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"What is the difference between useMemo and useCallback?\" Strong answer: useMemo caches the result of a calculation; useCallback caches the function itself. Both depend on a dependency array compared by Object.is.",
        "\"Why does my memoised child still re-render?\" Strong answer: a prop is a new reference each render (an inline object or function). Stabilise it, or the memo comparison fails.",
        "\"When should you not use useMemo?\" Strong answer: for cheap calculations, and before profiling. The comparison and memory have a cost and the code gets harder to read.",
        "\"Does React Compiler make useMemo obsolete?\" Strong answer: for most component code it memoises automatically, so you write them less. They remain an escape hatch for precise control, effect dependencies and codebases that do not use the compiler."
      ]
    },
    {
      "kind": "quiz",
      "question": "A parent renders `<Row options={{ sort: \"asc\" }} />` where `Row` is wrapped in `memo`. The parent re-renders with no change to its state. Does `Row` skip rendering?",
      "options": [
        "Yes, because the contents of options are all equal",
        "No, because options is a new object every render",
        "Yes, because memo compares JSON strings",
        "It depends on the browser"
      ],
      "answer": 1,
      "why": "memo compares props with Object.is. An object literal in the render body is a new reference each time, so the comparison fails and Row renders."
    },
    {
      "kind": "quiz",
      "question": "Which is the best first step when a screen feels slow?",
      "options": [
        "Wrap every component in memo and measure later",
        "Profile it and find the slow render",
        "Replace state with refs",
        "Add useCallback to all handlers"
      ],
      "answer": 1,
      "why": "Profiling shows which render is slow and why. Blanket memoisation adds comparison cost and often changes nothing."
    },
    {
      "kind": "quiz",
      "question": "What does `lazy(() => import(\"./Chart\"))` do?",
      "options": [
        "Delays the render by one second",
        "Loads the Chart code only when it is first rendered",
        "Caches Chart's output in localStorage",
        "Makes Chart render on the server only, never in the browser"
      ],
      "answer": 1,
      "why": "lazy splits the component into a separate chunk that downloads on first render, and Suspense shows the fallback while it loads."
    }
  ]
};
