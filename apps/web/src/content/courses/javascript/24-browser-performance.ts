import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterBrowserPerformance: Chapter = {
  slug: "browser-performance",
  title: "Browser Performance",
  summary: "What the browser does between your code and the pixels, why reading layout right after a write is slow, and how requestAnimationFrame, IntersectionObserver, workers, lazy loading and cleaning up listeners keep a page smooth.",
  minutes: 19,
  blocks: [
    {
      kind: "p",
      text: "A page feels fast when it responds to a tap at once and animates without stutter. A screen refreshes about 60 times a second, so each **frame** has roughly 16 milliseconds to run your JavaScript and draw the result. JavaScript and rendering share one main thread. If your code holds it for 100 ms, the page cannot paint, scroll or respond for 100 ms. That is the whole performance problem in the browser.",
    },
    {
      kind: "h",
      text: "The thali counter analogy",
    },
    {
      kind: "analogy",
      title: "One cook, one counter, a queue of orders",
      text: "A small canteen has one cook who both cooks and serves. While he spends ten minutes on a big biryani order, nobody is served, and the queue at the counter grows. The fix is not a faster cook alone. Break the big order into small pieces, do the heavy cooking in a back kitchen (a worker), and do not reset the whole counter each time one plate moves. Where the analogy stops: the back kitchen cannot touch the counter. A worker cannot reach the DOM; it only exchanges messages.",
    },
    {
      kind: "h",
      text: "What happens in a frame",
    },
    {
      kind: "steps",
      title: "From your code to pixels",
      steps: [
        { label: "JavaScript", text: "Event handlers and your code run and change the DOM or styles." },
        { label: "Style and layout", text: "The browser works out which rules apply and where every box goes and how big it is. Changing width, height, margin or the tree causes layout (reflow)." },
        { label: "Paint", text: "It draws the boxes into layers. Changing colour or shadow repaints without a new layout." },
        { label: "Composite", text: "The layers are combined on the GPU. Changing `transform` and `opacity` can often skip layout and paint, which is why animations use them." },
      ],
    },
    {
      kind: "concept",
      title: "Layout thrashing",
      text: "The browser normally batches your changes and lays the page out **once** per frame. But if you write (change a style) and then read something that depends on layout (`offsetHeight`, `getBoundingClientRect()`, `scrollTop`), the browser must lay out immediately to answer you. Doing that in a loop forces a layout on every pass. The cure is to batch: do all the **reads** first, then all the **writes**.",
    },
    {
      kind: "p",
      text: "The sample is a **model**: an object that counts how many times a layout would be forced. It is not a real page, but it follows the rule above, so you can see why the order of reads and writes matters.",
    },
    {
      kind: "code",
      code: `function makePage() {
  let dirty = false;
  let layouts = 0;
  return {
    write() {
      dirty = true;
    },
    read() {
      if (dirty) {
        layouts += 1;
        dirty = false;
      }
      return 120;
    },
    frame() {
      if (dirty) {
        layouts += 1;
        dirty = false;
      }
      return layouts;
    },
  };
}

function thrash(page, count) {
  for (let i = 0; i < count; i++) {
    page.write();
    page.read();
  }
  return page.frame();
}
function batched(page, count) {
  const heights = [];
  for (let i = 0; i < count; i++) heights.push(page.read());
  for (let i = 0; i < count; i++) page.write();
  return page.frame();
}

console.log("write then read each time:", thrash(makePage(), 5));
console.log("all reads, then all writes:", batched(makePage(), 5));`,
      caption: "Same five elements. Interleaving forces five layouts; grouping needs one at the end of the frame.",
      output: `write then read each time: 5
all reads, then all writes: 1`,
      tryIt: {
        language: "javascript",
        prompt: "Change both counts to 100. What happens to the two numbers, and what does that say about the cost?",
      },
    },
    {
      kind: "h",
      text: "Do work once per frame",
    },
    {
      kind: "p",
      text: "Events like `scroll` and `mousemove` can fire many times per frame. Run heavy work in each one and the page janks. **`requestAnimationFrame`** (rAF) asks the browser to call you just before the next paint, so you can record the latest value in the event and do the visible work once per frame. The model below uses a 16 ms timer as a stand-in for the frame, so it is an illustration of the pattern, not the browser's scheduler.",
    },
    {
      kind: "code",
      code: `let latestY = 0;
let queued = false;
let renders = 0;

function requestFrame(callback) {
  setTimeout(callback, 16);
}

function onScroll(y) {
  latestY = y;
  if (queued) return;
  queued = true;
  requestFrame(() => {
    queued = false;
    renders += 1;
    console.log("render at y=" + latestY + " after 5 events, renders: " + renders);
  });
}

for (let i = 1; i <= 5; i++) {
  setTimeout(() => onScroll(i * 100), i);
}`,
      caption: "Five scroll events arrive in a few milliseconds. The handler only remembers the newest position, and one render does the work.",
      output: "render at y=500 after 5 events, renders: 1",
      tryIt: {
        language: "javascript",
        prompt: "Move the scroll events apart: use `i * 20` as the delay. How many renders happen now?",
      },
    },
    {
      kind: "h",
      text: "Observers, workers and lazy loading",
    },
    {
      kind: "code",
      code: `// 1. Run code when an element becomes visible: no scroll listener, no layout reads.
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.src = entry.target.dataset.src;   // load the real image now
      observer.unobserve(entry.target);
    }
  }
}, { rootMargin: "200px" });
document.querySelectorAll("img[data-src]").forEach((img) => observer.observe(img));

// 2. Heavy computation off the main thread.
const worker = new Worker("./heavy.js");
worker.postMessage({ numbers: bigArray });
worker.onmessage = (event) => console.log("sum:", event.data);

// 3. Built-in lazy loading, no JavaScript needed:
//    <img src="photo.jpg" loading="lazy" width="600" height="400" alt="...">`,
      caption: "Browser code, shown for reading. `IntersectionObserver` replaces scroll polling, a Web Worker runs on its own thread, and `loading=\"lazy\"` defers off-screen images.",
    },
    {
      kind: "compare",
      title: "Pick the right tool",
      columns: [
        {
          label: "Long task on main thread",
          items: ["Blocks painting and input.", "Split into chunks, or move to a Web Worker.", "Workers talk by `postMessage` and cannot touch the DOM."],
        },
        {
          label: "Work tied to the screen",
          items: ["Use `requestAnimationFrame` for visual updates.", "Use `IntersectionObserver` for \"is it visible\".", "Animate `transform` and `opacity`."],
        },
        {
          label: "Many events",
          items: ["`debounce` waits for a pause (search box).", "`throttle` runs at most once per interval (resize).", "Chapter 21 builds both."],
        },
      ],
    },
    {
      kind: "h",
      text: "Memory leaks",
    },
    {
      kind: "p",
      text: "A page that grows slower over time usually has a **leak**: memory kept alive by something that should have been released. Common causes are listeners added and never removed, timers (`setInterval`) never cleared, detached DOM nodes still referenced from a variable or cache, and closures that hold large data (chapter 10). The fix is to pair every `addEventListener`, `setInterval` and `observer.observe` with its cleanup, ideally in one place, or tie the listeners to an `AbortController`. Use the browser's performance and memory panels to confirm; do not guess.",
    },
    {
      kind: "pitfall",
      items: [
        "Reading layout values (`offsetHeight`, `getBoundingClientRect`) between writes inside a loop. Read all first, then write.",
        "Running real work in every `scroll` or `mousemove` event. Record the value and do the work once per frame, or throttle.",
        "Animating `top`, `left` or `width`. Prefer `transform` and `opacity`, which can skip layout.",
        "Optimising before measuring. Profile first; the slow part is rarely where you guess.",
        "Starting a `setInterval` or a listener and never clearing it when the component or page section goes away.",
        "Loading every image up front. Add `width` and `height` to stop layout jumps, and `loading=\"lazy\"` below the fold.",
      ],
    },
    {
      kind: "remember",
      items: [
        "JavaScript and painting share the main thread; a frame has about 16 ms, so keep tasks short.",
        "Writing then reading layout in a loop forces repeated layouts. Batch reads before writes.",
        "Use `requestAnimationFrame` for visual updates, `IntersectionObserver` for visibility, Web Workers for heavy computation, and `transform` for animation.",
        "Every listener, timer and observer you add needs a matching cleanup, or memory leaks.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is the difference between reflow and repaint? A strong answer: reflow recomputes geometry and is expensive; repaint redraws pixels without changing layout; transform and opacity can avoid both.",
        "What is layout thrashing and how do you avoid it? A strong answer: alternating reads and writes forces synchronous layouts; batch all reads, then all writes.",
        "When would you use `requestAnimationFrame` over `setTimeout`? A strong answer: for visual updates, because it runs just before the next repaint, and most browsers pause it in background tabs.",
        "How do you keep a heavy calculation from freezing the page? A strong answer: split it into chunks, or run it in a Web Worker and message the result back.",
        "How do you find and prevent a memory leak? A strong answer: take heap snapshots to find retained nodes; remove listeners, clear timers, and drop references when done.",
      ],
    },
    {
      kind: "quiz",
      question: `Which change is cheapest for an animation?`,
      options: ["Animating transform", "Animating the width", "Animating the left value", "Animating the margin"],
      answer: 0,
      why: "transform (and opacity) can be handled on the compositor without recomputing layout or repainting. width, left and margin change geometry, so the browser must lay out again each frame.",
    },
    {
      kind: "quiz",
      question: `In a loop over 50 elements, you set el.style.width and then read el.offsetHeight on each. What happens?`,
      options: [
        "A forced layout up to 50 times.",
        "One layout, at the end of the loop.",
        "No layout, since styles are lazy.",
        "A layout only for the first element.",
      ],
      answer: 0,
      why: "Reading offsetHeight after a write makes the browser compute layout now to give a correct answer. Doing that on each pass repeats the work. Grouping reads before writes avoids it.",
    },
    {
      kind: "quiz",
      question: `Why can a Web Worker not update the page directly?`,
      options: [
        "It has its own thread and no DOM access.",
        "It runs only after the page has fully loaded.",
        "Its code is compiled differently from page code.",
        "It is allowed only for network requests.",
      ],
      answer: 0,
      why: "A worker has its own global scope and thread, with no document or window. It sends results back with postMessage, and the main thread updates the DOM.",
    },
  ],
};
