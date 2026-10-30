import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterDomAndEvents: Chapter = {
  slug: "dom-and-events",
  title: "The DOM and Events",
  summary: "How the browser turns HTML into a tree you can change, how a click travels down and back up that tree, and how event delegation, preventDefault and listener options work.",
  minutes: 20,
  blocks: [
    {
      kind: "p",
      text: "When a browser loads a page it parses the HTML into a tree of objects called the **DOM** (Document Object Model). JavaScript does not edit the HTML text. It reads and changes this tree, and the browser redraws the page to match. **Events** are how the page talks back: a click, a key press or a form submit creates an event object that travels through the tree, and your listeners get a chance to react.",
    },
    {
      kind: "h",
      text: "The school building analogy",
    },
    {
      kind: "analogy",
      title: "A bell rung in a classroom",
      text: "Picture a school: the building contains floors, floors contain classrooms, classrooms contain desks. If a student at a desk drops a bell, the sound is heard at the desk first, but it also carries up to the classroom, the floor and the whole building. Any of them may decide to react. An event does the same: it starts at the element you clicked and then **bubbles** up through every parent. Before that, there is a quiet first pass from the building down to the desk, called **capturing**. Where the analogy stops: a real sound cannot be stopped halfway. An event can, with `stopPropagation()`.",
    },
    {
      kind: "h",
      text: "Selecting and changing the tree",
    },
    {
      kind: "code",
      code: `// index.html contains: <ul id="todos"></ul> <button id="add">Add</button>
const list = document.querySelector("#todos");
const button = document.querySelector("#add");

function addItem(text) {
  const li = document.createElement("li");
  li.textContent = text;          // safe: treated as text, not HTML
  li.dataset.id = String(list.children.length + 1);
  list.append(li);
}

button.addEventListener("click", () => addItem("Buy tea"));

list.children[0]?.classList.toggle("done");
document.querySelectorAll("li").forEach((li) => li.setAttribute("tabindex", "0"));
list.firstElementChild?.remove();`,
      caption: "Real DOM code. It needs a browser page, so it does not run here. The model further down does.",
    },
    {
      kind: "p",
      text: "`querySelector` returns the first match for a CSS selector (or `null`), and `querySelectorAll` returns all matches. `createElement`, `append`, `remove`, `classList`, `setAttribute` and `dataset` build and modify the tree. Prefer **`textContent`** to `innerHTML` for user text: `innerHTML` parses its string as HTML, which is the door to the injection bugs in chapter 25.",
    },
    {
      kind: "h",
      text: "How an event travels",
    },
    {
      kind: "steps",
      title: "The three phases of one click",
      steps: [
        { label: "Capture", text: "The event starts at the window and moves **down** through each ancestor toward the target. Only listeners registered with `capture: true` run." },
        { label: "Target", text: "The event arrives at the element that was actually clicked, `event.target`. Its own listeners run." },
        { label: "Bubble", text: "The event moves **back up** through the ancestors. Ordinary listeners run on each. Most events bubble; a few, such as `focus`, `blur` and `mouseenter`, do not." },
      ],
    },
    {
      kind: "p",
      text: "The sample below is a **model**: a plain-JavaScript tree of objects that follows the same three phases, so you can see the order without a browser. It is not the real DOM, but the ordering and the rules for `stopPropagation` match what the browser does.",
    },
    {
      kind: "code",
      code: `function node(name, parent = null) {
  return { name, parent, listeners: [] };
}
function on(n, type, fn, capture = false) {
  n.listeners.push({ type, fn, capture });
}
function dispatch(target, type) {
  const path = [];
  for (let n = target; n; n = n.parent) path.unshift(n);
  const event = {
    type,
    target,
    stopped: false,
    stopPropagation() {
      this.stopped = true;
    },
  };
  const run = (n, phase) => {
    for (const l of n.listeners) {
      const right = phase === "target" || (phase === "capture") === l.capture;
      if (l.type === type && right) l.fn(event);
    }
  };
  for (const n of path.slice(0, -1)) {
    if (!event.stopped) run(n, "capture");
  }
  if (!event.stopped) run(target, "target");
  for (const n of path.slice(0, -1).reverse()) {
    if (!event.stopped) run(n, "bubble");
  }
}

const list = node("ul");
const li = node("li", list);
const button = node("button", li);
const log = [];
on(list, "click", () => log.push("ul capture"), true);
on(list, "click", (e) => log.push("ul bubble, target " + e.target.name));
on(li, "click", () => log.push("li"));
on(button, "click", () => log.push("button"));
dispatch(button, "click");
console.log(log.join(" > "));

const keys = [];
on(li, "keydown", (e) => {
  keys.push("li stops it");
  e.stopPropagation();
});
on(list, "keydown", () => keys.push("ul never sees it"));
dispatch(button, "keydown");
console.log(keys);

const clicked = [];
on(list, "tap", (e) => {
  if (e.target.name.startsWith("item")) clicked.push(e.target.name);
});
const first = node("item-1", list);
dispatch(first, "tap");
const later = node("item-2", list);
dispatch(later, "tap");
dispatch(list, "tap");
console.log(clicked);`,
      caption: "A model of capture, target, bubble, `stopPropagation` and delegation. The last part adds an item after the listener was attached, and the one listener on `list` still covers it.",
      output: `ul capture > button > li > ul bubble, target button
[ 'li stops it' ]
[ 'item-1', 'item-2' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Make the `li` click listener call `e.stopPropagation()`. Which entries disappear from the first line?",
      },
    },
    {
      kind: "concept",
      title: "Event delegation",
      text: "Instead of adding a listener to every item, add **one** listener to their common parent and check `event.target`. Because events bubble, the parent hears about every click inside it, including items that did not exist when you attached the listener. It saves memory, keeps working when items are added or removed, and is what the last lines of the model show. In the browser, use `event.target.closest(\"li\")` rather than a name check, so a click on a child element inside the `li` still counts.",
    },
    {
      kind: "h",
      text: "Listener options, preventDefault and stopPropagation",
    },
    {
      kind: "code",
      code: `const link = document.querySelector("a");
const controller = new AbortController();

link.addEventListener(
  "click",
  (event) => {
    event.preventDefault();               // stop the browser's own action (follow the link)
    console.log(event.target, event.currentTarget);
  },
  { once: true, signal: controller.signal },
);

document.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onResize, { signal: controller.signal });

controller.abort();                        // removes every listener tied to the signal`,
      caption: "Browser-only code. `once` runs the listener a single time, `passive` promises not to call `preventDefault`, and `signal` lets one `abort()` remove many listeners.",
    },
    {
      kind: "compare",
      title: "preventDefault vs stopPropagation",
      columns: [
        {
          label: "preventDefault()",
          items: ["Cancels the browser's default action.", "Examples: following a link, submitting a form.", "The event still bubbles to parents."],
        },
        {
          label: "stopPropagation()",
          items: ["Stops the event moving to further elements.", "The default action still happens.", "Other listeners on the same element still run."],
        },
      ],
    },
    {
      kind: "p",
      text: "`event.target` is the element that started the event; `event.currentTarget` is the element whose listener is running right now. In a delegated listener they differ, which is the whole point. Use a **passive** listener for `scroll` and `touchmove` so the browser can scroll without waiting for your code. Remove listeners when the element goes away, or use `{ signal }`, to avoid the leaks from chapter 10.",
    },
    {
      kind: "pitfall",
      items: [
        "Using `innerHTML` with user text. Use `textContent`, or build elements with `createElement`.",
        "Calling `querySelector` before the element exists. Run the script after the DOM is parsed (put it at the end of `body`, use `defer`, or listen for `DOMContentLoaded`).",
        "Passing a call instead of a function: `addEventListener(\"click\", handle())` runs `handle` immediately. Pass `handle`.",
        "Removing a listener with a different function than you added. An inline arrow is a new function each time; keep a reference or use a `signal`.",
        "Confusing `target` and `currentTarget` inside a delegated handler. `target` is the clicked child.",
        "Using `stopPropagation` to fix a problem elsewhere. It silently breaks listeners higher up, such as analytics or a dropdown that closes on outside click.",
      ],
    },
    {
      kind: "remember",
      items: [
        "The DOM is a tree of objects built from HTML; JavaScript changes the tree and the browser redraws.",
        "An event goes down (capture), hits the target, then bubbles up. Ordinary listeners run in the bubble phase.",
        "Delegation is one listener on a parent that inspects `event.target`; it covers items added later.",
        "`preventDefault` stops the browser's action; `stopPropagation` stops travel to other elements. Use `textContent` for text, not `innerHTML`.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Explain event bubbling and capturing. A strong answer: three phases (capture down, target, bubble up); listeners default to the bubble phase and `capture: true` opts into the first pass.",
        "What is event delegation and why use it? A strong answer: one listener on an ancestor using `event.target`; fewer listeners, and it handles elements added later.",
        "Difference between `preventDefault` and `stopPropagation`? A strong answer: the first cancels the default browser action; the second stops the event travelling to other elements; they are independent.",
        "Difference between `target` and `currentTarget`? A strong answer: `target` is where the event began; `currentTarget` is the element the running listener is attached to.",
        "How do you avoid memory leaks with listeners? A strong answer: remove them when the element goes away, or tie them to an `AbortController` signal; do not capture large objects in long-lived handlers.",
      ],
    },
    {
      kind: "quiz",
      question: `A button is inside a div. Both have ordinary click listeners (the div logs "div", the button logs "button"). You click the button. What is logged?`,
      options: ["button, then div", "div, then button", "button only", "div only"],
      answer: 0,
      why: "Ordinary listeners run in the bubble phase, which starts at the target and moves up. The button's listener runs first, then the div's.",
    },
    {
      kind: "quiz",
      question: `Which call stops a link from navigating, while letting parents still hear the click?`,
      options: ["event.preventDefault()", "event.stopPropagation()", "event.stopImmediatePropagation()", "return false from an arrow"],
      answer: 0,
      why: "preventDefault cancels the default action (navigation) but does not affect travel through the tree. stopPropagation does the opposite, and an arrow function returning false does nothing in addEventListener.",
    },
    {
      kind: "quiz",
      question: `A list has one delegated click listener on the ul. Which statement is true?`,
      options: [
        "An li added after the listener was attached still works.",
        "Each li must also get its own listener to be clickable.",
        "Only the first li is covered by the listener.",
        "A new li must be added before the listener, or it fails.",
      ],
      answer: 0,
      why: "The listener lives on the parent and clicks bubble up to it from any current child, so items added later are covered automatically.",
    },
  ],
};
