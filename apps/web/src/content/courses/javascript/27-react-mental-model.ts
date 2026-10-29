import type { Chapter } from "@/content/courses/types";

export const chapterReactMentalModel: Chapter = {
  "slug": "react-mental-model",
  "title": "The React Mental Model: Components, Render, Commit and Keys",
  "summary": "React is a function from state to a description of the screen. See what a component really is, the three steps from a click to pixels, why React diffs two trees, and why `key` decides whether your input keeps what the user typed.",
  "minutes": 18,
  "blocks": [
    {
      "kind": "p",
      "text": "Most React confusion comes from one wrong picture: that you tell the page what to *change*. You do not. You write a function that says what the page should *look like* for the current data, and React works out the changes. Once that picture is right, hooks, re-renders and keys stop being rules to memorise and become consequences."
    },
    {
      "kind": "h",
      "text": "The railway reservation chart"
    },
    {
      "kind": "analogy",
      "title": "The chart-pasting clerk",
      "text": "Before a train leaves, a clerk pastes a printed reservation chart on the platform board. If one berth is cancelled, the clerk does not repaint the whole board. A new chart is printed, laid next to the old one, and only the changed lines are corrected. A **component** is the printing machine: give it the booking data and it prints a chart (a description of the screen). **React** is the clerk who compares the new chart with the old and touches only what differs. Where the analogy stops: the clerk matches rows by their position on paper. React matches children by their **key** when you give one, and that matching decides which row keeps its handwritten notes (its state)."
    },
    {
      "kind": "h",
      "text": "A component is a function of its inputs"
    },
    {
      "kind": "p",
      "text": "A **component** is a JavaScript function that takes props and returns **JSX**, a syntax that compiles to calls like `React.createElement(type, props, ...children)`. Each call returns a plain object, a *React element*: a description of one piece of UI, not a DOM node. The function below describes a menu. Given the same props, it must return the same description, which is why React asks you to keep render free of side effects."
    },
    {
      "kind": "code",
      "caption": "A component in JSX (TSX). Runs inside a React app; this course editor cannot run JSX, so the next block shows the same component without it.",
      "code": "// A component is a function from props and state to a description of the UI.\n// Runs in a React app (browser or server render). Not runnable in the course editor.\nfunction Menu({ items }: { items: { id: string; name: string; price: number }[] }) {\n  return (\n    <ul>\n      {items.map((item) => (\n        <li key={item.id}>\n          {item.name}: Rs {item.price}\n        </li>\n      ))}\n    </ul>\n  );\n}\n"
    },
    {
      "kind": "p",
      "text": "JSX is only syntax. Here is the same component written with `React.createElement`, rendered to an HTML string by `react-dom/server` on the repo's installed React. Notice the output is HTML text: the component produced a description, and a renderer turned it into something concrete."
    },
    {
      "kind": "code",
      "caption": "Run with node 24 against the repo's installed react and react-dom (19.3.1). It needs the packages installed, so it is not runnable in the course editor.",
      "output": "19.3.1\n<ul><li>Dal: Rs 90</li><li>Roti: Rs 10</li></ul>",
      "code": "const { createRequire } = require(\"node:module\");\nconst r = createRequire(process.cwd() + \"/apps/web/package.json\");\nconst React = r(\"react\");\nconst { renderToStaticMarkup } = r(\"react-dom/server\");\nconst h = React.createElement;\nfunction Menu({ items }) {\n  return h(\"ul\", null, items.map((i) => h(\"li\", { key: i.id }, i.name + \": Rs \" + i.price)));\n}\nconsole.log(React.version);\nconsole.log(renderToStaticMarkup(h(Menu, { items: [{ id: \"a\", name: \"Dal\", price: 90 }, { id: \"b\", name: \"Roti\", price: 10 }] })));\n"
    },
    {
      "kind": "h",
      "text": "From a click to pixels: trigger, render, commit"
    },
    {
      "kind": "steps",
      "title": "The three steps React takes (react.dev, \"Render and Commit\")",
      "steps": [
        {
          "label": "Trigger",
          "text": "Something asks for a render: the first mount, or a state update (a `set` function call) in a component."
        },
        {
          "label": "Render",
          "text": "React calls your component functions to get the new description. This step must be pure: no DOM writes, no network calls. React may call a component more than once, and in development StrictMode deliberately does so to expose impure code."
        },
        {
          "label": "Commit",
          "text": "React compares the new description with the previous one and applies only the differences to the real DOM. Effects and refs are attached after this step."
        }
      ]
    },
    {
      "kind": "concept",
      "title": "Render does not mean paint",
      "text": "\"Render\" in React means *calling your component function*. It does not mean the browser drew anything. A component can render and produce no DOM change at all, if its description equals the previous one. Only the commit touches the DOM."
    },
    {
      "kind": "h",
      "text": "Reconciliation: comparing two trees"
    },
    {
      "kind": "p",
      "text": "Comparing any two trees exactly is expensive, so React uses two cheap rules. First, elements of **different types** (a `<div>` replaced by a `<span>`, or `<Cart>` by `<Menu>`) are treated as unrelated: the old subtree is thrown away, along with its state, and a new one is built. Second, for a **list of children**, React matches old and new by `key`. An element with the same key and type is the same instance, so it keeps its state and DOM node; a new key means a fresh instance."
    },
    {
      "kind": "compare",
      "title": "Same position, or same identity?",
      "columns": [
        {
          "label": "Key = array index",
          "items": [
            "Identity follows the position in the list.",
            "Reorder, insert at the top or delete: instance 0 stays instance 0.",
            "The state that belonged to one item now sits on a different item."
          ]
        },
        {
          "label": "Key = stable id from your data",
          "items": [
            "Identity follows the item.",
            "Reorder, insert or delete: each item keeps its own state and DOM node.",
            "Costs nothing extra; the id already exists in your data."
          ]
        }
      ]
    },
    {
      "kind": "code",
      "caption": "A MODEL, not React's source: a dozen lines that apply the keyed matching rule to a reordered list. The first item has typed state; watch where it lands. Runs in the course editor and under node.",
      "code": "// A MODEL of keyed reconciliation. This is not React's source: real React\n// diffs fibres, but the rule it applies to a list of children is the one below.\nfunction reconcile(oldList, newList, keyOf) {\n  const byKey = new Map();\n  oldList.forEach((inst, i) => byKey.set(keyOf(inst.element, i), inst));\n  return newList.map((element, i) => {\n    const match = byKey.get(keyOf(element, i));\n    if (match) return { element, state: match.state }; // same key: keep state\n    return { element, state: \"\" }; // new key: fresh instance\n  });\n}\n\nconst before = [\n  { element: { id: \"dal\" }, state: \"typed: 2 plates\" },\n  { element: { id: \"roti\" }, state: \"\" },\n  { element: { id: \"rice\" }, state: \"\" },\n];\nconst after = [{ id: \"rice\" }, { id: \"dal\" }, { id: \"roti\" }]; // reordered\n\nconst byIndex = reconcile(before, after, (el, i) => i);\nconst byId = reconcile(before, after, (el) => el.id);\n\nconsole.log(\"index keys:\");\nbyIndex.forEach((inst) => console.log(\" \", inst.element.id, \"->\", JSON.stringify(inst.state)));\nconsole.log(\"id keys:\");\nbyId.forEach((inst) => console.log(\" \", inst.element.id, \"->\", JSON.stringify(inst.state)));\n",
      "output": "index keys:\n  rice -> \"typed: 2 plates\"\n  dal -> \"\"\n  roti -> \"\"\nid keys:\n  rice -> \"\"\n  dal -> \"typed: 2 plates\"\n  roti -> \"\"",
      "tryIt": {
        "language": "javascript",
        "prompt": "Reorder `after` again (put `roti` first) and predict which instance holds the state under each kind of key before you run it."
      }
    },
    {
      "kind": "viz",
      "title": "Index keys: the typed text stays at position 0",
      "caption": "The same reorder as the model above. Each cell is a list position; the note says whose state it holds.",
      "viz": {
        "type": "array",
        "frames": [
          {
            "cells": [
              {
                "value": "dal",
                "state": "active",
                "pointers": [
                  "typed: 2 plates"
                ]
              },
              {
                "value": "roti"
              },
              {
                "value": "rice"
              }
            ],
            "note": "Before: the user typed \"2 plates\" into the dal row. Dal is at position 0."
          },
          {
            "cells": [
              {
                "value": "rice",
                "state": "swap",
                "pointers": [
                  "typed: 2 plates"
                ]
              },
              {
                "value": "dal"
              },
              {
                "value": "roti"
              }
            ],
            "note": "After the reorder with key = index: position 0 is reused, so rice now shows the text that was typed for dal."
          },
          {
            "cells": [
              {
                "value": "rice"
              },
              {
                "value": "dal",
                "state": "done",
                "pointers": [
                  "typed: 2 plates"
                ]
              },
              {
                "value": "roti"
              }
            ],
            "note": "With key = id: the dal instance moved to position 1 and took its state with it."
          }
        ]
      }
    },
    {
      "kind": "h",
      "text": "Why keys also cost you when you misuse them"
    },
    {
      "kind": "p",
      "text": "Never make a key with `Math.random()` or generate it during render: a different key each render means React throws the instance away every time, so inputs lose focus and state resets on every keystroke. Keys only need to be unique among siblings, not across the app. Using the index is acceptable only for a static list that is never reordered, filtered or inserted into (react.dev, \"Rendering Lists\")."
    },
    {
      "kind": "pitfall",
      "items": [
        "Using `index` as the key for a list the user can reorder, filter or delete from. Typed text, checkboxes and focus then stick to the position instead of the item. Fix: use a stable id from the data.",
        "Using `Math.random()` or `crypto.randomUUID()` as a key during render. The key changes every render, so the whole list remounts and state is lost. Fix: create the id when the item is created, not when it is rendered.",
        "Defining a component inside another component. Each parent render creates a new function, so React sees a different type and remounts the child. Fix: define components at module level and pass data as props.",
        "Mutating props or reading and writing a variable outside the component during render. React may render twice and the results will differ. Fix: keep render pure and move side effects to event handlers or effects."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "A component is a function of props and state that returns a description of the UI, not DOM nodes.",
        "Updates run trigger, then render (call your functions), then commit (patch the DOM). Render must be pure.",
        "React reuses an instance when the type and position (or key) match. A different type or key means a new instance and lost state.",
        "Keys give list items identity. Use a stable id from your data, never the index for a list that changes, never a random value."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"What is the virtual DOM and why does React use it?\" A strong answer: it is the tree of elements your components return; React compares the new tree with the previous one and applies the minimal set of DOM changes. It exists so you can write UI as a function of state, and it is not claimed to be faster than hand-tuned DOM code.",
        "\"Why do we need a key in a list?\" Strong answer: keys give siblings identity across renders, so React can keep the right state and DOM node when the list reorders, grows or shrinks.",
        "\"Why can using the index as a key cause bugs?\" Strong answer: identity then follows position, so state attached to one item (an input's text) ends up on a different item after a reorder. Give the typed-text example.",
        "\"What is the difference between render and commit?\" Strong answer: render calls components and must be pure; commit updates the DOM and runs layout effects and refs. Mention StrictMode double rendering as a purity check in development."
      ]
    },
    {
      "kind": "quiz",
      "question": "A list of rows with local input state uses `key={index}`. The user types in row 0, then the list is reversed. What happens?",
      "options": [
        "The typed text moves with its item to the end of the list",
        "The typed text stays in row 0, now a different item",
        "React throws a duplicate key error",
        "All inputs in the list are cleared"
      ],
      "answer": 1,
      "why": "With index keys identity follows position. Position 0 is the same instance after the reversal, so it keeps its state, but it now displays a different item."
    },
    {
      "kind": "quiz",
      "question": "What does \"render\" mean in React?",
      "options": [
        "Painting the finished pixels onto the screen for the user",
        "Calling the component function to get a new description",
        "Writing changes into the real DOM",
        "Downloading the component's code"
      ],
      "answer": 1,
      "why": "Render is only the call to your function. Applying changes to the DOM is the commit step, and the browser paints after that."
    },
    {
      "kind": "quiz",
      "question": "A parent renders `<Form />` in one branch and `<Panel />` in another, at the same place in the tree. The condition flips. What happens to the Form's state?",
      "options": [
        "It is kept and given to Panel",
        "It is paused until the condition flips back",
        "It is discarded, because the type changed",
        "It is saved in the browser automatically"
      ],
      "answer": 2,
      "why": "Elements of different types at the same position are treated as unrelated. The old subtree is unmounted, so its state is gone."
    }
  ]
};
