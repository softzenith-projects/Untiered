import type { Chapter } from "@/content/courses/types";

export const chapterCustomHooksAndPatterns: Chapter = {
  "slug": "custom-hooks-and-patterns",
  "title": "Custom Hooks, the Rules of Hooks and Reuse Patterns",
  "summary": "Why hooks cannot sit inside an `if`: React finds your state by call order. Build a tiny `useState` to see it break, then extract logic into custom hooks, compare hooks with HOCs and render props, and add an error boundary.",
  "minutes": 20,
  "blocks": [
    {
      "kind": "p",
      "text": "You have used `useState` and `useEffect` as if they were magic words. This chapter opens the box. Once you see how React finds your state between renders, the two Rules of Hooks stop being a lint rule you obey and become something you could have derived yourself. Then reuse becomes easy: a custom hook is only a function that calls hooks."
    },
    {
      "kind": "h",
      "text": "The cloakroom tokens"
    },
    {
      "kind": "analogy",
      "title": "Bags numbered by the order you handed them in",
      "text": "Imagine a cloakroom where the clerk does not use names. You hand in three bags in order, and get them back by the order: first bag, second bag, third bag. This works only if you always hand them in in the same order. If today you skip the first bag, the clerk's \"second bag\" is now your first, and you walk away with the wrong luggage. React stores a component's hook state in a list and gives it back **by call order**. Where the analogy stops: React is not confused on purpose. It simply has no names to go by, which is why the rules exist."
    },
    {
      "kind": "h",
      "text": "The rules, and the reason for them"
    },
    {
      "kind": "concept",
      "title": "The Rules of Hooks (react.dev, \"Rules of Hooks\")",
      "text": "Only call hooks at the top level of a component or another hook: not inside conditions, loops, nested functions, or after an early return. And only call them from React function components or custom hooks, never from plain functions or classes. Both rules guarantee the same hooks run in the same order on every render."
    },
    {
      "kind": "p",
      "text": "Here is the proof, as a model: a 25-line `useState` that stores values in an array and finds them with a cursor that restarts at 0 on each render. It is a model of the idea and not React's source. First the good case: a custom hook that calls `useState` inside, which works because the order never changes. Then a hook inside an `if`: on the second render the first slot is asked for the wrong value."
    },
    {
      "kind": "code",
      "caption": "A MODEL of hooks stored by call order, with a custom hook built on top. Runs in the course editor and under node. React's real implementation keeps a linked list per component, but call order is the same key.",
      "code": "// A MODEL of why hooks must be called in the same order every render.\n// React keeps your hook state in a list and finds it by call order, not by name.\nfunction createComponent(body) {\n  const slots = []; // one list per component instance\n  let cursor = 0;\n  let renders = 0;\n  let props = {};\n\n  function useState(initial) {\n    const i = cursor++; // the ONLY thing that identifies this hook\n    if (!(i in slots)) slots[i] = initial;\n    const set = (v) => (slots[i] = v);\n    return [slots[i], set];\n  }\n\n  return {\n    render(nextProps) {\n      props = nextProps;\n      cursor = 0;\n      renders++;\n      return body(props, { useState });\n    },\n  };\n}\n\n// A custom hook is just a function that calls other hooks.\nfunction useCounter(hooks, start) {\n  const [n, setN] = hooks.useState(start);\n  return { n, inc: () => setN(n + 1) };\n}\n\nconsole.log(\"-- hooks always in the same order --\");\nconst good = createComponent((props, hooks) => {\n  const [name] = hooks.useState(\"Asha\");\n  const counter = useCounter(hooks, 10);\n  return { name, n: counter.n, inc: counter.inc };\n});\nlet view = good.render({});\nview.inc();\nview = good.render({});\nconsole.log(view.name, view.n);\n\nconsole.log(\"-- a hook inside an if --\");\nlet latestSet;\nconst bad = createComponent((props, hooks) => {\n  if (props.showName) {\n    const [name] = hooks.useState(\"Asha\"); // skipped on the second render\n  }\n  const [count, setCount] = hooks.useState(100);\n  latestSet = setCount;\n  return count;\n});\nconsole.log(\"render 1 count =\", bad.render({ showName: true }));\nlatestSet(101); // writes to slot 1\nconsole.log(\"render 2 count =\", bad.render({ showName: false })); // now asks slot 0\n",
      "output": "-- hooks always in the same order --\nAsha 11\n-- a hook inside an if --\nrender 1 count = 100\nrender 2 count = Asha",
      "tryIt": {
        "language": "javascript",
        "prompt": "Move the `if` so it wraps the second hook and the conditional hook comes last. Predict whether the bug still appears, then run it."
      }
    },
    {
      "kind": "steps",
      "title": "What React does on each render",
      "steps": [
        {
          "label": "Reset the cursor",
          "text": "Before calling your component, the hook position goes back to 0."
        },
        {
          "label": "Each hook takes the next slot",
          "text": "`useState` reads slot 0, the next hook slot 1, and so on. There are no names, only positions."
        },
        {
          "label": "Mismatch means a bug",
          "text": "If one render skips a hook, every later hook reads the wrong slot. React detects some of these and throws an error, but a state mix-up is the quiet version."
        }
      ]
    },
    {
      "kind": "h",
      "text": "Custom hooks: reusing logic, not UI"
    },
    {
      "kind": "p",
      "text": "A **custom hook** is a function whose name starts with `use` and that calls other hooks. It lets two components share the *logic* (subscribe to the network status, debounce a value, read the window size) while each call gets its **own** state. Two components using `useOnlineStatus()` do not share a variable; they share a recipe. The `use` prefix matters: it is how the linter knows to enforce the rules inside it."
    },
    {
      "kind": "code",
      "caption": "A custom hook for the online status, an error boundary class, and how to test a hook. Runs inside a React app and a test runner, so no output is shown.",
      "code": "// A custom hook, an error boundary, and a hook test. Runs inside a React app / test runner.\nimport { Component, useEffect, useState, type ReactNode } from \"react\";\n\n// Custom hook: logic with state, shared by any component. The name must start with \"use\".\nfunction useOnlineStatus() {\n  const [online, setOnline] = useState(true);\n  useEffect(() => {\n    const on = () => setOnline(true);\n    const off = () => setOnline(false);\n    window.addEventListener(\"online\", on);\n    window.addEventListener(\"offline\", off);\n    return () => {\n      window.removeEventListener(\"online\", on);\n      window.removeEventListener(\"offline\", off);\n    };\n  }, []);\n  return online;\n}\n\nfunction StatusBar() {\n  const online = useOnlineStatus(); // each call gets its own state\n  return <p>{online ? \"Online\" : \"Offline\"}</p>;\n}\n\n// Error boundary: still written as a class, because it needs these two lifecycle methods.\nclass ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {\n  state = { failed: false };\n  static getDerivedStateFromError() {\n    return { failed: true }; // render the fallback on the next render\n  }\n  componentDidCatch(error: Error) {\n    console.error(\"caught\", error.message); // report it here\n  }\n  render() {\n    return this.state.failed ? this.props.fallback : this.props.children;\n  }\n}\n\n// Usage: <ErrorBoundary fallback={<p>Something went wrong</p>}><Widget /></ErrorBoundary>\n// It catches errors thrown while rendering below it, not errors inside event handlers.\n\n// Testing a hook with React Testing Library (renderHook), in a test file:\n// const { result } = renderHook(() => useCounter(5));\n// act(() => result.current.inc());\n// expect(result.current.n).toBe(6);\n"
    },
    {
      "kind": "h",
      "text": "Hooks, HOCs and render props"
    },
    {
      "kind": "p",
      "text": "Before hooks, logic was shared with two other patterns. A **higher-order component** is a function that takes a component and returns a wrapped one (`withAuth(Page)`). A **render prop** passes a function as a prop that the component calls to decide what to draw (`<Mouse render={pos => ...} />`). Both still work and you will meet them in older code and libraries. Hooks replaced most of their uses because they avoid the extra wrapper layers and the naming collisions."
    },
    {
      "kind": "compare",
      "title": "Sharing logic: the three styles",
      "columns": [
        {
          "label": "Custom hook",
          "items": [
            "A function call; no extra component in the tree.",
            "Composes: one hook can call another.",
            "Cannot share JSX layout by itself."
          ]
        },
        {
          "label": "HOC or render prop",
          "items": [
            "Adds a wrapper component, so the tree gets deeper.",
            "Can inject props or wrap rendering, which a hook cannot do alone.",
            "Props can collide; harder to type and to read."
          ]
        }
      ]
    },
    {
      "kind": "h",
      "text": "Error boundaries"
    },
    {
      "kind": "p",
      "text": "If a component throws while rendering, React unmounts the whole tree unless something catches it. An **error boundary** is a component that catches errors from its children during rendering and shows a fallback. React's reference states that there is currently no way to write an error boundary as a function component: it must be a class with `static getDerivedStateFromError` (to choose the fallback) and optionally `componentDidCatch` (to log). It does **not** catch errors in event handlers, in asynchronous code such as timers, or during server rendering. Put one around a section that can fail independently, not just at the root."
    },
    {
      "kind": "p",
      "text": "To test a custom hook, render it inside a throwaway component. React Testing Library provides `renderHook` for exactly that: you get the hook's current return value in `result.current` and wrap state changes in `act`. Test the behaviour (\"after inc the count is one higher\"), not how many times it rendered."
    },
    {
      "kind": "pitfall",
      "items": [
        "Calling a hook inside an `if`, loop or after an early `return`. State attaches to the wrong slot, or React throws. Fix: call all hooks first; put the condition inside the hook or the JSX.",
        "Calling a hook from a normal function or an event handler. Hooks only work during render. Fix: call it at the top of the component and use the result in the handler.",
        "Naming a custom hook without the `use` prefix. The linter stops checking it. Fix: always start with `use`.",
        "Expecting two components that call the same custom hook to share state. Each call is independent. Fix: lift the state to a parent or use Context if they must share it.",
        "Wrapping the whole app in a single error boundary and nothing else. One failing widget blanks the screen. Fix: wrap sections that can fail on their own."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "React finds hook state by call order. Call the same hooks in the same order on every render.",
        "Hooks go at the top level of a component or custom hook; never in conditions, loops, nested functions or after an early return.",
        "A custom hook is a function starting with use that calls hooks. It shares logic, not state: each call has its own.",
        "Error boundaries are classes and catch render-time errors in their children, not event handler, timer or server-render errors."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"Why can't you call hooks inside conditions?\" Strong answer: React identifies hooks by call order, so a skipped hook shifts every later hook onto the wrong state. Show a small example of the mismatch.",
        "\"What is a custom hook and what is it for?\" Strong answer: a function starting with use that calls other hooks, to share stateful logic. Each call has independent state.",
        "\"Hooks versus HOCs or render props?\" Strong answer: hooks avoid wrapper components and compose by calling each other; HOCs and render props can still inject or wrap rendering and exist in older libraries.",
        "\"What do error boundaries catch, and what do they miss?\" Strong answer: they catch errors thrown while rendering their children; they miss event handlers, async code and server rendering, so those need try/catch or other handling."
      ]
    },
    {
      "kind": "quiz",
      "question": "A component calls `useState` inside `if (props.show)`. On a render where `show` is false, what is the likely result?",
      "options": [
        "The hook returns undefined for that render only and nothing else changes",
        "Later hooks read the wrong state slots, or React throws an error",
        "Nothing, hooks are matched by variable name",
        "React caches the hook for the next show"
      ],
      "answer": 1,
      "why": "Hook state is stored in an ordered list. Skipping a call shifts every later hook onto the wrong slot, which gives wrong values or an error."
    },
    {
      "kind": "quiz",
      "question": "Two components each call `useOnlineStatus()`. How many independent copies of its state exist?",
      "options": [
        "One, shared by both components that call it",
        "Two, one per component instance",
        "One per page load",
        "None, the state is global"
      ],
      "answer": 1,
      "why": "A custom hook shares logic, not state. Every component instance that calls it gets its own state."
    },
    {
      "kind": "quiz",
      "question": "A button's `onClick` handler throws an error. Does a surrounding error boundary catch it?",
      "options": [
        "Yes, every error thrown anywhere below it, including handlers",
        "No, boundaries do not catch event handler errors",
        "Only if the handler is async",
        "Only in production builds"
      ],
      "answer": 1,
      "why": "Error boundaries catch errors thrown during rendering. Event handler errors do not happen during render, so handle them with try/catch."
    }
  ]
};
