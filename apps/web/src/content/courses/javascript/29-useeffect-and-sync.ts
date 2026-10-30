import type { Chapter } from "@/content/courses/types";

export const chapterUseeffectAndSync: Chapter = {
  "slug": "useeffect-and-sync",
  "title": "useEffect: Synchronising With the Outside World",
  "summary": "An effect is not componentDidMount. It keeps something outside React in sync with your state. Learn when effects run, what cleanup does, how the dependency array is compared, why StrictMode runs effects twice, and how a fetch race happens.",
  "minutes": 20,
  "blocks": [
    {
      "kind": "p",
      "text": "`useEffect` is the hook people misuse most, usually because they were taught it as \"run this on mount\". That picture breaks the moment a dependency changes or StrictMode runs the code twice. The correct picture is smaller and easier: an effect connects your component to something that React does not control (a server, a timer, a browser API) and keeps that connection matching your current values."
    },
    {
      "kind": "h",
      "text": "The mobile data pack"
    },
    {
      "kind": "analogy",
      "title": "Switching a prepaid data pack",
      "text": "When you change your phone plan, the telecom does not just start the new pack. It first ends the old one, and only then starts the new one. If it forgot to end the old pack, you would be billed for two plans at once. An **effect** is the \"start the pack\" function, and its **cleanup** is the \"end the pack\" function. When a value the effect depends on changes, React runs the old cleanup first and then the new effect. Where the analogy stops: React also runs cleanup when the component leaves the screen, and in development it may start, end and start again on purpose."
    },
    {
      "kind": "h",
      "text": "When effects run"
    },
    {
      "kind": "steps",
      "title": "The life of one effect",
      "steps": [
        {
          "label": "Render",
          "text": "Your component runs and describes the UI. Effects do not run here; render stays pure."
        },
        {
          "label": "Commit",
          "text": "React updates the DOM. Only then are effects scheduled. Most effects run after the browser has painted."
        },
        {
          "label": "Compare",
          "text": "For each effect React compares the new dependency array with the previous one, item by item, using `Object.is`. If nothing changed, the effect is skipped."
        },
        {
          "label": "Clean up, then set up",
          "text": "If something changed, React first calls the previous run's cleanup (it still remembers the old values), then runs the new setup."
        },
        {
          "label": "Unmount",
          "text": "When the component leaves, React runs the last cleanup."
        }
      ]
    },
    {
      "kind": "p",
      "text": "The model below reproduces those steps in plain JavaScript. It is a model and not React's source, but the order of the log lines is the order you will see in a real component. Look at three things: nothing runs when the dependency is unchanged, the old room is disconnected before the new one connects, and StrictMode adds one extra connect, disconnect, connect on mount."
    },
    {
      "kind": "code",
      "caption": "A MODEL of effect scheduling, dependency comparison and cleanup. Runs in the course editor and under node. The StrictMode part mimics development behaviour only.",
      "code": "// A MODEL of how effects are scheduled, cleaned up and compared. Not React's source.\nfunction createRuntime(component, { strictMode = false } = {}) {\n  let slots = [];\n  let pending = [];\n  let cursor = 0;\n\n  function useEffect(setup, deps) {\n    const i = cursor++;\n    const prev = slots[i];\n    const changed = !prev || !deps || deps.some((d, k) => !Object.is(d, prev.deps[k]));\n    if (changed) pending.push({ i, setup, deps });\n  }\n\n  function commit() {\n    // 1. clean up every effect that is about to re-run, using the OLD closure\n    for (const { i } of pending) {\n      if (slots[i] && slots[i].cleanup) slots[i].cleanup();\n    }\n    // 2. then run the new setups\n    for (const { i, setup, deps } of pending) {\n      slots[i] = { deps, cleanup: setup() };\n    }\n    pending = [];\n  }\n\n  function render(props) {\n    cursor = 0;\n    component(props, { useEffect });\n    commit();\n  }\n\n  function mount(props) {\n    render(props);\n    if (strictMode) {\n      // development only: clean up and set up again to expose missing cleanup\n      slots.forEach((s) => s && s.cleanup && s.cleanup());\n      slots.forEach((s, i) => (s.cleanup = null));\n      slots = [];\n      render(props);\n    }\n  }\n  function unmount() {\n    slots.forEach((s) => s && s.cleanup && s.cleanup());\n  }\n  return { render, mount, unmount };\n}\n\nfunction Chat({ room }, { useEffect }) {\n  useEffect(() => {\n    console.log(\"connect to\", room);\n    return () => console.log(\"disconnect from\", room);\n  }, [room]);\n}\n\nconsole.log(\"-- normal run --\");\nconst app = createRuntime(Chat);\napp.mount({ room: \"general\" });\napp.render({ room: \"general\" }); // same dependency: nothing happens\napp.render({ room: \"travel\" }); // changed: cleanup old, then setup new\napp.unmount();\n\nconsole.log(\"-- strict mode, development only --\");\ncreateRuntime(Chat, { strictMode: true }).mount({ room: \"general\" });\n",
      "output": "-- normal run --\nconnect to general\ndisconnect from general\nconnect to travel\ndisconnect from travel\n-- strict mode, development only --\nconnect to general\ndisconnect from general\nconnect to general",
      "tryIt": {
        "language": "javascript",
        "prompt": "Change the second render to `{ room: \"general\" }` and predict which lines disappear. Then pass `undefined` as the dependency array in `Chat` and predict what happens on each render."
      }
    },
    {
      "kind": "concept",
      "title": "The dependency array (react.dev, \"Synchronizing with Effects\")",
      "text": "No array: the effect runs after every render. Empty array `[]`: the effect runs after the first render only (and once more in development StrictMode). Array with values: it runs after the first render and again whenever a listed value changed. The array must list every reactive value (props, state, variables from the component body) that the effect reads. The lint rule `react-hooks/exhaustive-deps` checks this, and silencing it is how stale-closure bugs get in."
    },
    {
      "kind": "h",
      "text": "StrictMode runs your effect twice, on purpose"
    },
    {
      "kind": "p",
      "text": "In development, with `<StrictMode>`, React mounts the component, immediately runs the cleanup, and runs the setup again. This is not a bug. It is a test: an effect whose cleanup correctly reverses its setup behaves the same after the extra cycle. If your effect opens a connection and has no cleanup, the double run reveals two open connections. Production builds do not do this extra cycle."
    },
    {
      "kind": "h",
      "text": "The data fetching race"
    },
    {
      "kind": "p",
      "text": "A fetch inside an effect has a hazard: if the user types \"ja\" and then \"jav\", two requests are in flight, and the slow one for \"ja\" may arrive *after* the fast one for \"jav\". Without protection the stale answer overwrites the fresh one. The fix is the cleanup function: it marks the old run as stale (an `ignore` flag) or cancels it (an `AbortController`). Here is the race as a model, with and without the guard."
    },
    {
      "kind": "code",
      "caption": "A MODEL of the stale-response race and the cleanup guard, with delays of 10 ms and 40 ms so it is deterministic. Runs in the course editor and under node.",
      "code": "// A MODEL of the fetch race condition and the \"ignore\" flag that fixes it.\n// The fake server answers the slow query late, like a slow network would.\nfunction fakeSearch(query) {\n  const delay = query === \"ja\" ? 40 : 10; // \"ja\" is slow, \"jav\" is fast\n  return new Promise((resolve) => setTimeout(() => resolve(\"results for \" + query), delay));\n}\n\nfunction runEffect(query, setResult, useGuard) {\n  let ignore = false; // lives inside this effect run\n  fakeSearch(query).then((result) => {\n    if (useGuard && ignore) return;\n    setResult(result);\n  });\n  return () => {\n    ignore = true; // the cleanup marks this run as stale\n  };\n}\n\nfunction scenario(useGuard) {\n  return new Promise((done) => {\n    let shown = \"\";\n    const set = (r) => (shown = r);\n    // the user types \"ja\", then quickly \"jav\"\n    const cleanup1 = runEffect(\"ja\", set, useGuard);\n    cleanup1(); // React cleans up effect 1 before running effect 2\n    runEffect(\"jav\", set, useGuard);\n    setTimeout(() => {\n      console.log(useGuard ? \"with ignore flag :\" : \"without guard    :\", shown);\n      done();\n    }, 80);\n  });\n}\n\nscenario(false).then(() => scenario(true));\n",
      "output": "without guard    : results for ja\nwith ignore flag : results for jav",
      "tryIt": {
        "language": "javascript",
        "prompt": "Swap the two delays so the first request is the fast one. Predict whether the guard still matters, then run it."
      }
    },
    {
      "kind": "code",
      "caption": "The real pattern: an effect that fetches with an AbortController, and a value that needs no effect at all. Runs inside a React app, so no output is shown.",
      "code": "// Fetching in an effect with cleanup. Runs inside a React app (client component).\nimport { useEffect, useState } from \"react\";\n\nfunction UserCard({ userId }: { userId: string }) {\n  const [user, setUser] = useState<{ name: string } | null>(null);\n\n  useEffect(() => {\n    const controller = new AbortController();\n    setUser(null);\n\n    fetch(`/api/users/${userId}`, { signal: controller.signal })\n      .then((res) => res.json())\n      .then(setUser)\n      .catch((err) => {\n        if (err.name !== \"AbortError\") console.error(err);\n      });\n\n    return () => controller.abort(); // runs before the next effect and on unmount\n  }, [userId]); // re-run only when userId changes\n\n  return user ? <p>{user.name}</p> : <p>Loading...</p>;\n}\n\n// Not an effect: a value you can compute during render needs no state and no effect.\nfunction Price({ price, qty }: { price: number; qty: number }) {\n  const total = price * qty; // derived, always in sync\n  return <p>Total: {total}</p>;\n}\n"
    },
    {
      "kind": "compare",
      "title": "Does this need an effect?",
      "columns": [
        {
          "label": "No effect needed",
          "items": [
            "Values you can calculate from props or state (a total, a filtered list): compute them in render.",
            "Responding to a click: put the code in the event handler.",
            "Resetting state when a prop changes: use a `key` on the component."
          ]
        },
        {
          "label": "Effect is right",
          "items": [
            "Connecting to a server, WebSocket or browser API and disconnecting later.",
            "Subscribing to an external store or event and unsubscribing.",
            "Fetching on mount in code that has no data library (and guarding the race)."
          ]
        }
      ]
    },
    {
      "kind": "p",
      "text": "React's own guidance (\"You Might Not Need an Effect\") is that most effects people write are really derived values or event handlers in disguise. If an effect only sets state from other state, it causes an extra render and an out-of-sync frame. Data fetching in an app is increasingly done by a framework or a data library, which handles caching and races for you."
    },
    {
      "kind": "pitfall",
      "items": [
        "Treating `useEffect(fn, [])` as \"componentDidMount\". It is a synchronisation with no reactive dependencies, and it runs twice in development. Fix: write the cleanup so a repeat is harmless.",
        "Leaving out a dependency to stop an effect re-running. The effect then reads stale values forever. Fix: include it, and restructure the code (move the function inside, or use state updaters) so the dependency is stable.",
        "Putting an object or function created during render in the dependency array. It is a new reference each render, so the effect re-runs every render. Fix: depend on the primitive values, or move it inside the effect.",
        "Updating state in an effect that depends on that same state, causing an infinite loop. Fix: derive the value in render, or use an updater and fix the dependencies.",
        "Making the effect function itself `async`. It returns a promise, not a cleanup function. Fix: define an inner async function and call it."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "An effect synchronises something outside React with your current values. It is not a lifecycle hook.",
        "On a change React runs the previous cleanup first, then the new setup. Cleanup also runs on unmount.",
        "Dependencies are compared with Object.is. List everything reactive the effect reads, and do not silence the lint rule.",
        "StrictMode runs setup, cleanup, setup in development to check your cleanup. Guard fetches against races with ignore or AbortController."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"What is the dependency array and what happens if you omit it or leave it empty?\" Strong answer: no array means after every render, empty means after the first render, values mean when one of them changes by Object.is. Mention the exhaustive-deps lint rule.",
        "\"Why does my effect run twice?\" Strong answer: StrictMode in development mounts, cleans up and mounts again to test that cleanup works; it does not happen in production. Fix the missing cleanup, do not remove StrictMode.",
        "\"How do you avoid a race condition when fetching in useEffect?\" Strong answer: cleanup sets an ignore flag or aborts the request, so a stale response cannot call setState.",
        "\"When should you not use useEffect?\" Strong answer: for derived data, for responding to user events, and for resetting state on a prop change; use render calculation, handlers, and key."
      ]
    },
    {
      "kind": "quiz",
      "question": "A component has `useEffect(() => { ... }, [room])`. `room` changes from \"a\" to \"b\". In which order do things happen?",
      "options": [
        "Setup for b, then cleanup for a",
        "Cleanup for a, then setup for b",
        "Only setup for b runs",
        "Cleanup for b, then setup for a"
      ],
      "answer": 1,
      "why": "React ends the previous synchronisation (using the old values) before starting the new one, so there are never two active at once."
    },
    {
      "kind": "quiz",
      "question": "In development with StrictMode, a component mounts. An effect with an empty dependency array logs \"setup\" and its cleanup logs \"cleanup\". What appears?",
      "options": [
        "setup, once, with no cleanup",
        "setup, cleanup",
        "setup, cleanup, setup",
        "cleanup, setup"
      ],
      "answer": 2,
      "why": "StrictMode adds a mount, unmount, mount cycle to check that the cleanup reverses the setup. Production runs the effect once."
    },
    {
      "kind": "quiz",
      "question": "Which of these should be an effect?",
      "options": [
        "Computing the sum of cart items",
        "Showing a toast message to the user right after a button click",
        "Opening a WebSocket for a chat room and closing it later",
        "Filtering a list by a search box"
      ],
      "answer": 2,
      "why": "A WebSocket is an external system that must be connected and disconnected. The other three are derived values or responses to events."
    }
  ]
};
