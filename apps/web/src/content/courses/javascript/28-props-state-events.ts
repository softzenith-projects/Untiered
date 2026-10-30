import type { Chapter } from "@/content/courses/types";

export const chapterPropsStateEvents: Chapter = {
  "slug": "props-state-events",
  "title": "Props, State and Events: State Is a Snapshot",
  "summary": "Props flow down, events flow up, and state belongs to the component that owns it. Learn why `setCount(count + 1)` three times adds only one, when to use the updater form, and how to update objects and arrays without mutating them.",
  "minutes": 18,
  "blocks": [
    {
      "kind": "p",
      "text": "Two questions decide almost every React data bug: *who owns this value?* and *what does this render see?* Props answer the first for a child, state answers it for the owner, and the snapshot rule answers the second. This chapter makes all three exact."
    },
    {
      "kind": "h",
      "text": "The cricket scorecard"
    },
    {
      "kind": "analogy",
      "title": "A photo of the scoreboard",
      "text": "At a cricket match, the scorer updates the board after each ball. Imagine instead that every ball produced a *photograph* of the board, and each fan holds one photo. A fan who is holding the photo from the third over can shout \"it's 41 for 2!\" all day, and the photo will never change, even though the real board has moved on. A **render** is one photograph: its props, state and handler functions are frozen as they were. A state update does not edit your photo. It asks for a new photo to be taken. Where the analogy stops: React takes the new photo for you after the event finishes, and it can combine several updates into one photo (batching)."
    },
    {
      "kind": "h",
      "text": "Props flow down, events flow up"
    },
    {
      "kind": "p",
      "text": "**Props** are the inputs a parent passes to a child. They are read-only for the child: a child that wants a different value asks the parent, by calling a function the parent passed down as a prop (`onChange`, `onSelect`). **State** is memory that a component owns and that survives between renders. Calling the setter schedules a re-render of that component and its children. Data flows down as props, and requests to change it flow up as events. This one-way shape is what makes bugs traceable."
    },
    {
      "kind": "compare",
      "title": "Props or state?",
      "columns": [
        {
          "label": "Props",
          "items": [
            "Passed in by the parent.",
            "Read-only inside the child.",
            "Changes when the parent re-renders with new values."
          ]
        },
        {
          "label": "State",
          "items": [
            "Owned by the component that calls `useState`.",
            "Changed only through its setter.",
            "Survives re-renders; resets if the component unmounts."
          ]
        }
      ]
    },
    {
      "kind": "h",
      "text": "State is a snapshot"
    },
    {
      "kind": "concept",
      "title": "The snapshot rule (react.dev, \"State as a Snapshot\")",
      "text": "Within one render, the value of a state variable never changes, even inside async code. Calling `setCount(5)` does not change the `count` variable your running handler already holds. It queues an update. React applies the queue and calls your component again, and that new call receives the new value."
    },
    {
      "kind": "p",
      "text": "Below is a model of that mechanism, a few lines of plain JavaScript. It is a model and not React's source, but it reproduces the famous surprise: three `setCount(count + 1)` calls in a row add **one**, because every call read the same frozen `count` and queued the same target value. The updater form `setCount(n => n + 1)` queues a *function*, so each queued update receives the result of the previous one."
    },
    {
      "kind": "code",
      "caption": "A MODEL of state snapshots and batching in 50 lines. Runs in the course editor and under node. Not React's source code.",
      "code": "// A MODEL of \"state is a snapshot\" and batched updates. Not React's source.\nfunction createComponent(render) {\n  let state = 0;\n  let queue = []; // updates waiting for the next render\n  let handlers = {};\n  function setState(update) {\n    queue.push(update); // an update is queued, not applied\n  }\n  function renderOnce() {\n    // React processes the queue and uses the result as this render's snapshot\n    for (const update of queue) {\n      state = typeof update === \"function\" ? update(state) : update;\n    }\n    queue = [];\n    handlers = render(state, setState); // handlers close over THIS snapshot\n    return state;\n  }\n  function click(name) {\n    handlers[name](); // run the handler of the latest render\n    return renderOnce(); // one render after the whole event: batching\n  }\n  renderOnce();\n  return { click };\n}\n\nconst direct = createComponent((count, setCount) => ({\n  plus3() {\n    setCount(count + 1); // count is 0 in this snapshot\n    setCount(count + 1);\n    setCount(count + 1);\n    console.log(\"handler still sees count =\", count);\n  },\n}));\nconsole.log(\"direct ->\", direct.click(\"plus3\"));\n\nconst updater = createComponent((count, setCount) => ({\n  plus3() {\n    setCount((n) => n + 1);\n    setCount((n) => n + 1);\n    setCount((n) => n + 1);\n    console.log(\"handler still sees count =\", count);\n  },\n}));\nconsole.log(\"updater ->\", updater.click(\"plus3\"));\n\n// Read the new state on the next render, not inside the handler.\nlet seen = [];\nconst probe = createComponent((count, setCount) => {\n  seen.push(count);\n  return { go() { setCount(count + 1); } };\n});\nprobe.click(\"go\");\nprobe.click(\"go\");\nconsole.log(\"renders saw:\", seen.join(\", \"));\n",
      "output": "handler still sees count = 0\ndirect -> 1\nhandler still sees count = 0\nupdater -> 3\nrenders saw: 0, 1, 2",
      "tryIt": {
        "language": "javascript",
        "prompt": "Change the second component to call the updater form four times and predict the result. Then add a fourth `setCount(count + 1)` to the first and predict again."
      }
    },
    {
      "kind": "steps",
      "title": "What happens when a handler calls a setter",
      "steps": [
        {
          "label": "Run the handler",
          "text": "Your event handler runs to the end using the values from the render it belongs to. Setters only queue updates."
        },
        {
          "label": "Process the queue",
          "text": "After the event, React walks the queue in order. A value replaces the state; an updater function receives the pending state and returns the next."
        },
        {
          "label": "Re-render once",
          "text": "React calls the component one time with the final state. Updates from one event are batched into that single render, in React 18 and later, including those inside timeouts and promises."
        }
      ]
    },
    {
      "kind": "h",
      "text": "Updating objects and arrays"
    },
    {
      "kind": "p",
      "text": "State that holds an object or array must be replaced, not edited. React decides whether state changed by comparing the old and new value with `Object.is`. If you `push` onto the existing array and pass that same array back, the reference is identical and React has nothing to compare. Copy first: spread (`[...list, item]`, `{ ...obj, key: value }`), `map`, `filter`. Change only the path you need, and reuse the rest."
    },
    {
      "kind": "code",
      "caption": "A controlled input and immutable updates in a todo list. Runs inside a React app, so it is shown without output.",
      "code": "// Props down, events up, state updated without mutation. Runs inside a React app.\nimport { useState } from \"react\";\n\ntype Todo = { id: number; text: string; done: boolean };\n\nfunction TodoList({ initial }: { initial: Todo[] }) {\n  const [todos, setTodos] = useState(initial);\n  const [draft, setDraft] = useState(\"\");\n\n  function add() {\n    // new array, never todos.push(...)\n    setTodos([...todos, { id: Date.now(), text: draft, done: false }]);\n    setDraft(\"\");\n  }\n\n  function toggle(id: number) {\n    // new array, and a new object only for the item that changed\n    setTodos((current) => current.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));\n  }\n\n  return (\n    <>\n      <input value={draft} onChange={(e) => setDraft(e.target.value)} />\n      <button onClick={add} disabled={draft.trim() === \"\"}>\n        Add\n      </button>\n      <ul>\n        {todos.map((t) => (\n          <li key={t.id}>\n            <label>\n              <input type=\"checkbox\" checked={t.done} onChange={() => toggle(t.id)} />\n              {t.text}\n            </label>\n          </li>\n        ))}\n      </ul>\n    </>\n  );\n}\n"
    },
    {
      "kind": "p",
      "text": "The input above is **controlled**: its value comes from state (`value={draft}`) and every keystroke goes through `onChange` into `setDraft`. React, not the DOM, is the source of truth. An **uncontrolled** input keeps its own value in the DOM and you read it later through a ref or a form submit. Both are valid; controlled inputs make validation and clearing easy, uncontrolled ones cost fewer renders."
    },
    {
      "kind": "viz",
      "title": "Three setCount(count + 1) calls in one handler",
      "caption": "The queue that React processes after the handler returns, for count = 0.",
      "viz": {
        "type": "array",
        "frames": [
          {
            "cells": [
              {
                "value": 0,
                "pointers": [
                  "count"
                ]
              }
            ],
            "note": "Render 1: count is 0. The handler closes over this 0."
          },
          {
            "cells": [
              {
                "value": "0 + 1",
                "state": "active",
                "pointers": [
                  "queued"
                ]
              },
              {
                "value": "0 + 1",
                "state": "active",
                "pointers": [
                  "queued"
                ]
              },
              {
                "value": "0 + 1",
                "state": "active",
                "pointers": [
                  "queued"
                ]
              }
            ],
            "note": "Three calls queue the value 1 three times. The expression count + 1 was already evaluated against the frozen 0."
          },
          {
            "cells": [
              {
                "value": 1,
                "state": "done",
                "pointers": [
                  "count"
                ]
              }
            ],
            "note": "Render 2 receives 1. With the updater form the queue would be n => n + 1 three times, giving 3."
          }
        ]
      }
    },
    {
      "kind": "pitfall",
      "items": [
        "Reading state right after the setter and expecting the new value (`setN(n + 1); console.log(n)` prints the old one). Fix: use the value you computed, or read it on the next render.",
        "Writing `setCount(count + 1)` repeatedly, or inside a timeout, when the next value depends on the previous one. Fix: use `setCount(n => n + 1)`.",
        "Mutating state: `todos.push(x); setTodos(todos)` or `user.name = 'A'; setUser(user)`. The reference is the same, so the update is skipped or the UI is stale. Fix: build a new array or object.",
        "Switching an input between a `value` of `undefined` and a string, so it goes from uncontrolled to controlled. Fix: start from an empty string.",
        "Copying a prop into state (`useState(props.name)`) and expecting it to follow the prop. State uses the prop only on the first render. Fix: read the prop directly, or lift the state up."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "Props flow down and are read-only. Events flow up through functions passed as props. State is owned by one component.",
        "A render is a snapshot: its state and handlers are frozen. The setter queues an update and asks for a new render.",
        "Updates from one event are batched into one render. Use the updater form when the next state depends on the previous one.",
        "Treat state as immutable: copy arrays and objects with spread, map or filter instead of editing them."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"Why does this log the old value after setState?\" Strong answer: state is a snapshot for that render. The setter queues an update for the next render, so the running handler still holds the old value.",
        "\"What does the updater form of setState do and when do you need it?\" Strong answer: it passes a function that receives the latest pending state; use it when the next value depends on the previous, such as several updates in one event or inside async callbacks.",
        "\"What is batching?\" Strong answer: React groups the updates from one event or tick into a single re-render. Since React 18 this includes updates in promises and timeouts.",
        "\"Controlled versus uncontrolled components?\" Strong answer: controlled means React state holds the value and onChange updates it; uncontrolled means the DOM holds it and you read it by ref. Say when you would choose each."
      ]
    },
    {
      "kind": "quiz",
      "question": "`count` is 0. A handler runs `setCount(count + 5); setCount(count + 5);` and then the component re-renders. What is `count` on the next render?",
      "options": [
        "10",
        "5",
        "0",
        "It throws an error"
      ],
      "answer": 1,
      "why": "Both calls read the same frozen count of 0 and queue the value 5. The last replaces the first, so the result is 5, not 10."
    },
    {
      "kind": "quiz",
      "question": "Which line updates the list in a way React will notice?",
      "options": [
        "items.push(x); setItems(items)",
        "setItems(items.sort())",
        "setItems([...items, x])",
        "items[0] = x; setItems(items)"
      ],
      "answer": 2,
      "why": "Spreading builds a new array with a new reference. The others hand back the same array object, so there is no change for React to detect."
    },
    {
      "kind": "quiz",
      "question": "A child component receives `name` as a prop and runs `name = 'Asha'`. What should the child do to change it?",
      "options": [
        "Nothing: the assignment is fine",
        "Call a function prop that asks the parent to change it",
        "Call a setter from the child's own state to override the prop",
        "Wrap the assignment in useEffect"
      ],
      "answer": 1,
      "why": "Props are read-only. The owner of the value holds the state, and the child requests a change by calling a callback the parent passed down."
    }
  ]
};
