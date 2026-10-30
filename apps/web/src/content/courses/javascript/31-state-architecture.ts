import type { Chapter } from "@/content/courses/types";

export const chapterStateArchitecture: Chapter = {
  "slug": "state-architecture",
  "title": "State Architecture: Lifting State, useReducer and Context",
  "summary": "Where should state live, and how should it change? Lift it to the nearest common parent, move complex updates into a reducer, share it with Context, and know exactly why Context re-renders every consumer. Then decide when a library is worth it.",
  "minutes": 20,
  "blocks": [
    {
      "kind": "p",
      "text": "A small app can keep every value next to the component that uses it. A larger one cannot: two components far apart need the same data, an update has six steps, and a prop is passed through five layers that do not care about it. This chapter is about the tools React gives you for those three problems, and the cost of each."
    },
    {
      "kind": "h",
      "text": "The housing society notice board"
    },
    {
      "kind": "analogy",
      "title": "One notice board for the whole society",
      "text": "In a housing society, if two flats need to agree on the water-tank schedule, they do not each write their own copy. The society keeps one schedule on the main notice board, and every flat reads that one. Changes go through the secretary, who writes a clear entry (\"Tank B cleaning, Sunday\") instead of every resident scribbling over the board. **Lifting state** is moving the schedule to the board both flats can see. A **reducer** is the secretary: every change is a named request handled by one set of rules. **Context** is the notice board you can read from any floor without passing the note down every staircase. Where the analogy stops: when the board changes, React re-reads it for *every* flat that looked at it, whether or not that flat cares about the part that changed."
    },
    {
      "kind": "h",
      "text": "Step 1: lift state up"
    },
    {
      "kind": "p",
      "text": "When two sibling components need the same value, move the state to their closest common parent and pass it down as props, with a callback for changes. That is called **lifting state up**. It keeps one source of truth, so the two cannot disagree. Do it as late as possible: state should live as close as it can to where it is used (\"colocation\"), because every render of the owner re-renders its children."
    },
    {
      "kind": "h",
      "text": "Step 2: useReducer for updates with rules"
    },
    {
      "kind": "p",
      "text": "`useState` is enough when an update is \"set this value\". When one user action touches several fields, or the next state depends on a set of rules, a **reducer** keeps those rules in one pure function: `(state, action) => newState`. Components do not change state; they *dispatch* an action describing what happened. A reducer cannot do I/O, cannot mutate its arguments, and returns a new object. That makes it easy to test with plain inputs and outputs, without rendering anything."
    },
    {
      "kind": "code",
      "caption": "A MODEL of useReducer: a pure reducer, a dispatch that applies it, and a history log. Runs in the course editor and under node. React's real useReducer also schedules a render, which this model leaves out.",
      "code": "// A MODEL of useReducer: one pure function decides every state change.\nfunction reducer(state, action) {\n  switch (action.type) {\n    case \"add\":\n      return { ...state, items: [...state.items, { name: action.name, qty: 1 }] };\n    case \"inc\":\n      return {\n        ...state,\n        items: state.items.map((it) => (it.name === action.name ? { ...it, qty: it.qty + 1 } : it)),\n      };\n    case \"clear\":\n      return { ...state, items: [] };\n    default:\n      throw new Error(\"Unknown action: \" + action.type); // fail loudly\n  }\n}\n\nfunction createReducerHook(reducerFn, initial) {\n  let state = initial;\n  const history = [];\n  function dispatch(action) {\n    const next = reducerFn(state, action); // pure: same inputs, same output\n    history.push(`${action.type} -> ${next === state ? \"same state\" : \"new state\"}`);\n    state = next;\n  }\n  return { dispatch, get: () => state, history };\n}\n\nconst cart = createReducerHook(reducer, { items: [] });\ncart.dispatch({ type: \"add\", name: \"dal\" });\ncart.dispatch({ type: \"inc\", name: \"dal\" });\ncart.dispatch({ type: \"inc\", name: \"ghee\" }); // nothing matches, but map still copies\nconst before = cart.get();\ncart.dispatch({ type: \"clear\" });\n\nconsole.log(JSON.stringify(before.items));\nconsole.log(JSON.stringify(cart.get().items));\nconsole.log(cart.history.join(\"\\n\"));\ntry {\n  cart.dispatch({ type: \"oops\" });\n} catch (err) {\n  console.log(err.message);\n}\n// the old snapshot is untouched, which is what lets React compare and undo\nconsole.log(\"old state unchanged:\", before.items.length);\n",
      "output": "[{\"name\":\"dal\",\"qty\":2}]\n[]\nadd -> new state\ninc -> new state\ninc -> new state\nclear -> new state\nUnknown action: oops\nold state unchanged: 1",
      "tryIt": {
        "language": "javascript",
        "prompt": "Add an `\"inc\"` action for an item that does not exist and predict whether the reducer returns the same state object or a new one. Then change `map` so it returns the same array when nothing matched and predict the log."
      }
    },
    {
      "kind": "h",
      "text": "Step 3: Context for values many components read"
    },
    {
      "kind": "p",
      "text": "**Context** lets a provider make a value available to every component beneath it, without passing props through each level. A component reads it with `useContext` (or `use(Context)` in React 19). It suits values that change rarely and are needed widely: the current user, the theme, the locale."
    },
    {
      "kind": "concept",
      "title": "How Context decides to re-render (react.dev, \"Passing Data Deeply with Context\")",
      "text": "When a provider's value changes (compared with `Object.is`), React re-renders every component that reads that context, even if it uses only one field of an object value. If the provider builds a new object on each render, the value changes on every render, and all consumers re-render every time."
    },
    {
      "kind": "code",
      "caption": "A MODEL of the reference comparison behind Context. The first provide() in each case differs from the previous object, so it counts once; the rest show the effect. Runs in the course editor and under node.",
      "code": "// A MODEL of why Context re-renders its consumers: they compare the provider's\n// value by reference. Not React's source.\nfunction createContext() {\n  const consumers = [];\n  let value;\n  return {\n    subscribe(name) {\n      const consumer = { name, renders: 0 };\n      consumers.push(consumer);\n      return consumer;\n    },\n    provide(next) {\n      const changed = !Object.is(value, next); // reference comparison\n      value = next;\n      if (changed) consumers.forEach((c) => c.renders++); // every consumer re-renders\n    },\n  };\n}\n\nconst ctx = createContext();\nconst header = ctx.subscribe(\"Header\");\nconst cartIcon = ctx.subscribe(\"CartIcon\");\nctx.provide(null); // first mount: both render once... counted below as the baseline\nheader.renders = 0;\ncartIcon.renders = 0;\n\n// Case 1: the provider builds a new object every render\nfor (let i = 0; i < 3; i++) {\n  ctx.provide({ user: \"asha\", theme: \"light\" }); // new reference each time\n}\nconsole.log(\"new object each render ->\", header.renders, cartIcon.renders);\n\nheader.renders = 0;\ncartIcon.renders = 0;\n\n// Case 2: the provider keeps the same object until something really changes\nconst stable = { user: \"asha\", theme: \"light\" };\nfor (let i = 0; i < 3; i++) {\n  ctx.provide(stable);\n}\nconsole.log(\"stable reference       ->\", header.renders, cartIcon.renders);\n\nctx.provide({ user: \"asha\", theme: \"dark\" }); // a genuine change\nconsole.log(\"after a real change    ->\", header.renders, cartIcon.renders);\n",
      "output": "new object each render -> 3 3\nstable reference       -> 1 1\nafter a real change    -> 2 2",
      "tryIt": {
        "language": "javascript",
        "prompt": "Make the stable case mutate `stable.theme` between calls, then predict the renders. Why does mutation make it worse, not better?"
      }
    },
    {
      "kind": "code",
      "caption": "A reducer shared through two contexts (state and dispatch), written with React 19's <Context value> syntax, and a memoised object value. Runs inside a React app, so no output is shown.",
      "code": "// useReducer + Context: one owner of the state, many readers. Runs inside a React app.\nimport { createContext, useContext, useMemo, useReducer, type Dispatch } from \"react\";\n\ntype State = { items: { name: string; qty: number }[] };\ntype Action = { type: \"add\"; name: string } | { type: \"clear\" };\n\nfunction reducer(state: State, action: Action): State {\n  switch (action.type) {\n    case \"add\":\n      return { items: [...state.items, { name: action.name, qty: 1 }] };\n    case \"clear\":\n      return { items: [] };\n  }\n}\n\nconst CartState = createContext<State | null>(null);\nconst CartDispatch = createContext<Dispatch<Action> | null>(null);\n\nexport function CartProvider({ children }: { children: React.ReactNode }) {\n  const [state, dispatch] = useReducer(reducer, { items: [] });\n  // React 19: render the Context itself as the provider (<Context.Provider> still works).\n  return (\n    <CartDispatch value={dispatch}>\n      <CartState value={state}>{children}</CartState>\n    </CartDispatch>\n  );\n}\n\nexport function useCart() {\n  const state = useContext(CartState);\n  if (!state) throw new Error(\"useCart must be used inside CartProvider\");\n  return state;\n}\n\n// Splitting state and dispatch means a button that only dispatches does not re-render\n// when the items change: dispatch keeps the same identity for the life of the component.\nexport function ClearButton() {\n  const dispatch = useContext(CartDispatch)!;\n  return <button onClick={() => dispatch({ type: \"clear\" })}>Clear</button>;\n}\n\n// If you do pass an object as a context value, keep its reference stable.\nexport function ThemeProvider({ theme, children }: { theme: string; children: React.ReactNode }) {\n  const value = useMemo(() => ({ theme }), [theme]);\n  return <ThemeContext value={value}>{children}</ThemeContext>;\n}\nconst ThemeContext = createContext<{ theme: string } | null>(null);\n"
    },
    {
      "kind": "compare",
      "title": "Reaching for the right tool",
      "columns": [
        {
          "label": "Built-in tools",
          "items": [
            "Lift state for two or three nearby components.",
            "useReducer when updates have rules or many fields.",
            "Context for low-frequency, widely read values (theme, user, locale)."
          ]
        },
        {
          "label": "An external store library",
          "items": [
            "State that many distant components read and change often.",
            "You need to subscribe to a slice and re-render only for that slice.",
            "Derived data, devtools or persistence that you would otherwise rebuild by hand."
          ]
        }
      ]
    },
    {
      "kind": "p",
      "text": "React does not ship a built-in way to subscribe to *part* of a context. If a frequently changing value sits in one context, every consumer re-renders on every change. The built-in answers are to split contexts by how often they change (state versus dispatch above), keep the value's reference stable, or move to a library built for selective subscription. Choose a library when you can name the problem it solves, not before."
    },
    {
      "kind": "viz",
      "title": "Lifting state: two siblings, one owner",
      "caption": "The owner holds the value; each child gets it as a prop and asks to change it through a callback.",
      "viz": {
        "type": "array",
        "frames": [
          {
            "cells": [
              {
                "value": "Filter",
                "pointers": [
                  "own state"
                ]
              },
              {
                "value": "List",
                "pointers": [
                  "own state"
                ]
              }
            ],
            "note": "Before: Filter and List each keep their own copy. They can disagree."
          },
          {
            "cells": [
              {
                "value": "Page",
                "state": "active",
                "pointers": [
                  "owns filter"
                ]
              },
              {
                "value": "Filter",
                "pointers": [
                  "filter, onChange"
                ]
              },
              {
                "value": "List",
                "pointers": [
                  "filter"
                ]
              }
            ],
            "note": "After: Page owns the value. Filter receives it and an onChange callback; List receives the same value."
          },
          {
            "cells": [
              {
                "value": "Page",
                "state": "done",
                "pointers": [
                  "setFilter called"
                ]
              },
              {
                "value": "Filter",
                "state": "done"
              },
              {
                "value": "List",
                "state": "done"
              }
            ],
            "note": "A change flows up through onChange, the owner updates, and both children re-render with the same new value."
          }
        ]
      }
    },
    {
      "kind": "pitfall",
      "items": [
        "Putting everything in one global Context object. Every consumer re-renders on every change. Fix: split by update frequency, or use a store library with selectors.",
        "Passing `value={{ a, b }}` to a provider inline. A new object each render re-renders all consumers. Fix: `useMemo` the value, or keep primitives and stable references.",
        "Copying server data into state and syncing it with effects. Two sources of truth drift apart. Fix: keep one source (the fetched data) and derive the rest.",
        "A reducer that mutates the state or does I/O. It breaks comparisons and double-run checks in StrictMode. Fix: return new objects and run side effects in handlers or effects.",
        "Lifting state too high \"just in case\". Every keystroke then re-renders half the app. Fix: keep state as local as the sharing allows."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "Keep state as local as possible. When siblings share it, lift it to the nearest common parent.",
        "A reducer is a pure function (state, action) => new state. Components dispatch actions; they do not set fields.",
        "Context re-renders every consumer when the provider's value changes by reference. Split contexts and keep values stable.",
        "Reach for a state library when you can name the problem (selective subscription, heavy shared state), not by default."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"When would you use useReducer over useState?\" Strong answer: when state is an object with several fields updated together, when the next state follows rules, or when you want the logic in one testable pure function.",
        "\"Does Context cause performance problems?\" Strong answer: it re-renders all consumers whenever the value changes by reference, even if they use one field. Mitigate by splitting contexts, stabilising the value, or using a store with selectors.",
        "\"What is prop drilling and how do you fix it?\" Strong answer: passing props through layers that do not use them. Options: composition (pass children or elements), Context, or a store; composition is often the simplest.",
        "\"Redux, Zustand or Context?\" Strong answer: no single winner; name the problem (frequency of updates, number of readers, need for devtools or middleware) and pick the smallest tool that solves it."
      ]
    },
    {
      "kind": "quiz",
      "question": "A provider renders `<Ctx value={{ user, theme }}>` and re-renders for an unrelated reason. What happens to consumers of `Ctx`?",
      "options": [
        "Nothing happens, since user and theme did not change at all",
        "They re-render, because the object is a new reference",
        "Only consumers that read theme re-render",
        "React throws a warning and stops"
      ],
      "answer": 1,
      "why": "The inline object is created again on every render, so Object.is says the value changed, and every consumer re-renders."
    },
    {
      "kind": "quiz",
      "question": "Which statement about a reducer is correct?",
      "options": [
        "It may call fetch to load data from a server when it runs",
        "It must return a new state object instead of mutating",
        "It receives only the action",
        "It runs once at startup"
      ],
      "answer": 1,
      "why": "A reducer is pure: it takes the current state and an action and returns the next state without mutating its inputs or doing I/O."
    },
    {
      "kind": "quiz",
      "question": "Two sibling components must always show the same selected tab. Where should the selected tab live?",
      "options": [
        "In each sibling, kept in sync with an effect",
        "In a global variable outside React",
        "In their closest common parent",
        "In localStorage only"
      ],
      "answer": 2,
      "why": "Lifting the state to the nearest common parent gives one source of truth, passed down as props."
    }
  ]
};
