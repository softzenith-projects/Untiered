import type { Chapter } from "@/content/courses/types";

export const chapterRefsAndDom: Chapter = {
  "slug": "refs-and-dom",
  "title": "Refs: A Mutable Box and a Handle to the DOM",
  "summary": "`useRef` gives you a box that survives re-renders without causing them. Use it for DOM nodes (focus, scroll, measure) and for values that are not part of the picture. Learn why `ref` is a plain prop in React 19 and when refs are the wrong tool.",
  "minutes": 14,
  "blocks": [
    {
      "kind": "p",
      "text": "State is for values that change what the user sees. Some values change nothing on screen: a timer id, the previous value, the DOM node of an input you want to focus. Putting those in state would trigger renders for no reason. A **ref** is React's answer: a place to keep something between renders that React does not watch."
    },
    {
      "kind": "h",
      "text": "The locker key"
    },
    {
      "kind": "analogy",
      "title": "A locker at the railway cloak room",
      "text": "A cloak room gives you a numbered locker and a key. Your bag stays in the same locker all day, however many times you walk past. You can swap the bag inside without telling the station master, and nobody redraws the station notice board because of it. A **ref** is that locker: `useRef(initial)` hands back the same object, {`current`}, on every render, and changing `current` does not trigger a render. **State** is the notice board: change it and the board is redrawn. Where the analogy stops: React also fills one special kind of locker for you, with a DOM node, once the screen is on."
    },
    {
      "kind": "h",
      "text": "A ref is one object that outlives renders"
    },
    {
      "kind": "p",
      "text": "`useRef(0)` returns a plain object `{ current: 0 }` and keeps handing back that same object on every render of the same component instance. Compare three ways to keep a number. A **local variable** is recreated each render, so it forgets. **State** survives and asks for a render when it changes. A **ref** survives and does not ask for one. The model below shows all three side by side in 40 lines of plain JavaScript. It is a model of the idea, not React's source."
    },
    {
      "kind": "code",
      "caption": "A MODEL of a local variable, a ref and state across three renders, using a small hook array. Runs in the course editor and under node.",
      "code": "// A MODEL of three places to keep a value: a local variable, a ref, and state.\n// Not React's source: a tiny hook array so you can watch each one across renders.\nfunction createComponent(body) {\n  const slots = [];\n  let i = 0;\n  let renders = 0;\n  let handlers = {};\n  const hooks = {\n    useRef(initial) {\n      const slot = i++;\n      if (!(slot in slots)) slots[slot] = { current: initial }; // one box, made once\n      return slots[slot];\n    },\n    useState(initial) {\n      const slot = i++;\n      if (!(slot in slots)) slots[slot] = initial;\n      const set = (v) => {\n        slots[slot] = v;\n        queueMicrotask(render); // changing state schedules a render\n      };\n      return [slots[slot], set];\n    },\n  };\n  function render() {\n    i = 0;\n    renders++;\n    handlers = body(hooks, renders);\n  }\n  render();\n  return { fire: (name) => handlers[name]() };\n}\n\nconst app = createComponent((hooks, renders) => {\n  let local = 0; // recreated on every render\n  const clicks = hooks.useRef(0); // the same object on every render\n  const [label, setLabel] = hooks.useState(\"a\");\n\n  local += 1;\n  clicks.current += 1;\n  console.log(`render ${renders}: local=${local} ref=${clicks.current} state=${label}`);\n\n  return {\n    changeState: () => setLabel(label + \"!\"), // asks for a render\n    changeRef: () => (clicks.current += 10), // silently changes the box\n  };\n});\n\napp.fire(\"changeRef\"); // no render follows\napp.fire(\"changeState\"); // render 2 follows\nsetTimeout(() => {\n  app.fire(\"changeState\"); // render 3\n}, 0);\n",
      "output": "render 1: local=1 ref=1 state=a\nrender 2: local=1 ref=12 state=a!\nrender 3: local=1 ref=13 state=a!!",
      "tryIt": {
        "language": "javascript",
        "prompt": "Call `app.fire(\"changeRef\")` once more before the first `changeState` and predict the ref value shown on render 2."
      }
    },
    {
      "kind": "concept",
      "title": "When to use which (react.dev, \"Referencing Values with Refs\")",
      "text": "If a value is shown on screen, put it in state. If a value is only needed by your event handlers or effects, and changing it should not redraw anything, a ref is right: timer ids, the previous value of a prop, an instance of a non-React library. Do not read or write `ref.current` during render, because that makes the output depend on something React cannot track."
    },
    {
      "kind": "h",
      "text": "Refs to DOM nodes"
    },
    {
      "kind": "p",
      "text": "Pass a ref to a DOM element's `ref` attribute and React sets `ref.current` to the node after the commit step, and back to `null` when the node is removed. That is how you call imperative browser APIs that have no declarative form: `focus()`, `scrollIntoView()`, measuring a size, controlling a video element."
    },
    {
      "kind": "compare",
      "title": "ref in function components",
      "columns": [
        {
          "label": "Before React 19",
          "items": [
            "A function component did not receive `ref` as a prop.",
            "You wrapped it in `forwardRef` to pass a ref through.",
            "Wrapper code was needed even for simple pass-through."
          ]
        },
        {
          "label": "React 19",
          "items": [
            "`ref` is an ordinary prop for function components.",
            "`forwardRef` is no longer needed in new code and is planned to be deprecated.",
            "A callback ref can return a cleanup function."
          ]
        }
      ]
    },
    {
      "kind": "code",
      "caption": "A focusable input using ref as a prop (React 19) and a callback ref with cleanup. Runs inside a React app, so no output is shown.",
      "code": "// useRef as a DOM handle, and ref as an ordinary prop (React 19). Runs inside a React app.\nimport { useRef } from \"react\";\n\n// React 19: a function component receives ref like any other prop. No forwardRef needed.\nfunction TextField({ label, ref }: { label: string; ref?: React.Ref<HTMLInputElement> }) {\n  return (\n    <label>\n      {label}\n      <input ref={ref} />\n    </label>\n  );\n}\n\nfunction SearchBar() {\n  const inputRef = useRef<HTMLInputElement>(null); // null until React attaches the node\n\n  function focusIt() {\n    inputRef.current?.focus(); // read refs in handlers or effects, never during render\n  }\n\n  return (\n    <>\n      <TextField label=\"Search\" ref={inputRef} />\n      <button onClick={focusIt}>Focus the field</button>\n    </>\n  );\n}\n\n// React 19: a callback ref may return a cleanup function, called when the node detaches.\nfunction Measured() {\n  return (\n    <div\n      ref={(node) => {\n        if (!node) return;\n        const observer = new ResizeObserver(() => console.log(node.offsetWidth));\n        observer.observe(node);\n        return () => observer.disconnect();\n      }}\n    />\n  );\n}\n"
    },
    {
      "kind": "p",
      "text": "React's announcement for 19 states that function components can accept `ref` as a prop and that `forwardRef` will be deprecated in a future version, with a codemod planned. Older codebases still use it, so you must be able to read both. Refs passed to class components are not passed as props, because they refer to the class instance."
    },
    {
      "kind": "steps",
      "title": "When React fills a DOM ref",
      "steps": [
        {
          "label": "Render",
          "text": "React runs your component. `ref.current` is still `null` on first mount, so reading it here gives nothing."
        },
        {
          "label": "Commit",
          "text": "React creates or updates the DOM nodes."
        },
        {
          "label": "Attach",
          "text": "React sets `ref.current` to the node. After this, effects and event handlers can use it."
        },
        {
          "label": "Detach",
          "text": "When the element is removed, React sets `ref.current` to `null` (or calls the cleanup your callback ref returned)."
        }
      ]
    },
    {
      "kind": "pitfall",
      "items": [
        "Using a ref for something the screen shows. Changing `ref.current` will not update the UI. Fix: use state.",
        "Reading `inputRef.current` during render. It is `null` on the first render and unreliable after. Fix: read it in an event handler or effect.",
        "Using refs to do what props and state already do (setting text, toggling classes by hand). Fix: keep refs for focus, scroll, measurement and integration with non-React code.",
        "Forgetting the null check, because the node is `null` until mounted and after unmount. Fix: `ref.current?.focus()`.",
        "Reaching into a child's DOM from a parent through its internals. Fix: let the child expose a small, explicit API (a prop or `useImperativeHandle`)."
      ]
    },
    {
      "kind": "remember",
      "items": [
        "useRef returns one object, {current}, that stays the same across renders. Changing current does not re-render.",
        "State is for what the user sees; a ref is for values only handlers and effects need, and for DOM nodes.",
        "React fills a DOM ref after commit and clears it on removal. Do not read or write refs during render.",
        "React 19: function components take ref as a normal prop, so forwardRef is not needed in new code."
      ]
    },
    {
      "kind": "interview",
      "items": [
        "\"What is the difference between useRef and useState?\" Strong answer: both survive re-renders; setting state triggers a render and is for displayed data, while mutating ref.current does not trigger a render and is for non-visual values and DOM nodes.",
        "\"How do you focus an input on button click?\" Strong answer: create a ref with useRef(null), attach it to the input, call inputRef.current?.focus() in the handler.",
        "\"What is forwardRef and is it still needed?\" Strong answer: it let a function component receive a ref; in React 19 ref is a regular prop for function components, so it is not needed in new code, though older code still uses it.",
        "\"Why not store a counter in a ref instead of state?\" Strong answer: changes will not re-render the component, so the UI goes out of date."
      ]
    },
    {
      "kind": "quiz",
      "question": "A component does `ref.current += 1` in a click handler and displays `ref.current` in its JSX. After a click, what does the user see?",
      "options": [
        "The new number immediately, because React notices the ref change",
        "The old number until something else re-renders the component",
        "An error about mutating a ref",
        "Nothing, the component unmounts"
      ],
      "answer": 1,
      "why": "Writing to a ref does not schedule a render. The display updates only when something else (a state change, a parent render) causes the component to render again."
    },
    {
      "kind": "quiz",
      "question": "What is `inputRef.current` when the component first renders, before it is committed?",
      "options": [
        "The input element",
        "undefined",
        "null",
        "An empty string"
      ],
      "answer": 2,
      "why": "The ref was created with null, and React attaches the DOM node only after the commit step."
    },
    {
      "kind": "quiz",
      "question": "In React 19, how does a function component receive a ref from its parent?",
      "options": [
        "Only by wrapping it in forwardRef",
        "As a normal prop named ref",
        "Through useContext",
        "It cannot receive refs"
      ],
      "answer": 1,
      "why": "React 19 passes ref to function components as a regular prop, which makes forwardRef unnecessary for new code."
    }
  ]
};
