import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterFormsAndStorage: Chapter = {
  slug: "forms-and-storage",
  title: "Forms and Browser Storage",
  summary: "Handling form submit and input events, the built-in validation API, and choosing between cookies, localStorage, sessionStorage and IndexedDB, with what each one means for security.",
  minutes: 19,
  blocks: [
    {
      kind: "p",
      text: "Almost every web app takes input and remembers something. Forms are how input arrives, and browser storage is where a page keeps data between visits. The choices matter: where you store a value decides who can read it, how long it lives, and whether it is sent to the server on every request.",
    },
    {
      kind: "h",
      text: "The suggestion box analogy",
    },
    {
      kind: "analogy",
      title: "A shop's order slip and its notice board",
      text: "A form is the order slip at a tea shop. You fill it, hand it over, and the shop checks it: wrong table number, and the slip is sent back. Browser storage is the shop's own board of notes. A **cookie** is a slip the shop pins to your shirt, so it is shown on every visit whether you want it or not. **localStorage** is a locker with your name that stays until you empty it. **sessionStorage** is a locker that is cleared when you leave. Where the analogy stops: anyone with a key to the page's JavaScript can open these lockers too, which is why you never put a secret in one.",
    },
    {
      kind: "h",
      text: "Form events and the validation API",
    },
    {
      kind: "code",
      code: `<form id="signup" novalidate>
  <input name="email" type="email" required />
  <input name="age" type="number" min="18" max="99" />
  <button>Join</button>
</form>

<script type="module">
  const form = document.querySelector("#signup");

  form.addEventListener("submit", (event) => {
    event.preventDefault();                       // stay on the page
    if (!form.checkValidity()) {
      form.reportValidity();                      // shows the browser's own messages
      return;
    }
    const data = new FormData(form);
    const body = Object.fromEntries(data);        // { email: "...", age: "..." } (strings)
    console.log(body);
  });

  form.email.addEventListener("input", (event) => {
    const input = event.target;                   // fires on every keystroke
    input.setCustomValidity(input.value.endsWith(".test") ? "Use a real address" : "");
  });
</script>`,
      caption: "Browser code, so it does not run here. The model below does the storage part.",
    },
    {
      kind: "p",
      text: "`submit` fires on the form, not on the button, and it also fires when the user presses Enter, so listen for `submit`, not `click`. `preventDefault()` stops the page reload. The **Constraint Validation API** (`required`, `type`, `min`, `pattern`, `checkValidity()`, `setCustomValidity()`) checks input without extra code. Every `FormData` value is a string, so convert numbers yourself. Use `input` for each keystroke and `change` for when the value is committed. Client-side validation helps the user; it never replaces checking on the server, because anyone can skip your page and send a request directly.",
    },
    {
      kind: "h",
      text: "Four places to keep data",
    },
    {
      kind: "table",
      head: ["Store", "Lifetime", "Size (roughly)", "Sent to server?", "Readable by page JavaScript?"],
      rows: [
        ["Cookie", "Until it expires, or end of session", "About 4 KB each (name, value and attributes)", "Yes, with every matching request", "Yes, unless marked `HttpOnly`"],
        ["localStorage", "Until cleared by the user or code", "About 5 MB per origin", "No", "Yes"],
        ["sessionStorage", "Until the tab is closed", "About 5 MB per origin", "No", "Yes"],
        ["IndexedDB", "Until cleared", "Large (browser-managed quota)", "No", "Yes"],
      ],
    },
    {
      kind: "p",
      text: "`localStorage` and `sessionStorage` share one small, **synchronous** API that stores **strings only**. IndexedDB is an asynchronous database for structured data, files and large amounts, and it is awkward to use directly; people usually use a small wrapper. Sizes depend on the browser, so treat the figures above as order of magnitude, and expect `setItem` to throw when the quota is full or when storage is disabled (some private modes).",
    },
    {
      kind: "p",
      text: "The sample is a **model**: a small object backed by a `Map` that behaves like the Storage interface, so you can see the string-only rule and a safe way to read JSON. It is not the browser's real `localStorage`, which exists only in a page.",
    },
    {
      kind: "code",
      code: `function makeStorage() {
  const data = new Map();
  return {
    setItem(key, value) {
      data.set(String(key), String(value));
    },
    getItem(key) {
      return data.has(String(key)) ? data.get(String(key)) : null;
    },
    removeItem(key) {
      data.delete(String(key));
    },
    get length() {
      return data.size;
    },
  };
}

const store = makeStorage();
store.setItem("count", 3);
console.log(typeof store.getItem("count"), store.getItem("count") + 1, Number(store.getItem("count")) + 1);

store.setItem("user", JSON.stringify({ name: "Asha" }));
console.log(JSON.parse(store.getItem("user")).name, store.getItem("missing"));

store.setItem("prefs", { dark: true });
console.log(store.getItem("prefs"));

function readJson(key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
store.setItem("broken", "{oops");
console.log(readJson("broken", "default"), readJson("none", 0), store.length);`,
      caption: "Everything is stored as a string, so numbers need converting back and objects need `JSON.stringify`. A missing key gives `null`, and corrupt JSON needs a fallback.",
      output: `string 31 4
Asha null
[object Object]
default 0 4`,
      tryIt: {
        language: "javascript",
        prompt: "Add an expiry: store `{ value, expiresAt }` as JSON and make `readJson` return the fallback after `expiresAt` has passed. Use a number you pass in, not the clock.",
      },
    },
    {
      kind: "h",
      text: "Security of each store",
    },
    {
      kind: "compare",
      title: "What an attacker or a mistake can do",
      columns: [
        {
          label: "localStorage / sessionStorage",
          items: [
            "Any script on the page can read it, including an injected one (XSS, chapter 25).",
            "Never store session tokens or secrets here if you can avoid it.",
            "Fine for preferences and drafts.",
          ],
        },
        {
          label: "Cookies",
          items: [
            "`HttpOnly`: JavaScript cannot read it, which limits XSS theft.",
            "`Secure`: sent only over HTTPS. `SameSite`: limits cross-site sending (CSRF).",
            "Sent on every request, so keep them small.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
      caption: "A response header the server sends for a login session. The page's JavaScript cannot read `sid`, but the browser attaches it to matching requests.",
    },
    {
      kind: "pitfall",
      items: [
        "Storing a login token in `localStorage`. An injected script can read it. Prefer an `HttpOnly` cookie for sessions.",
        "Storing an object directly: `setItem(\"u\", obj)` saves \"[object Object]\". Use `JSON.stringify` and `JSON.parse`.",
        "Calling `JSON.parse` on a missing or corrupted value and crashing the page. Check for `null` and wrap in `try`.",
        "Treating a number as a number after `getItem`. It is a string, and `\"3\" + 1` is `\"31\"`.",
        "Relying on client-side validation alone. Repeat every check on the server.",
        "Using `click` on the submit button instead of `submit` on the form, which misses the Enter key.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Listen for `submit` on the form, call `preventDefault()`, read values with `FormData`, and remember they are all strings.",
        "Built-in validation (`required`, `type`, `checkValidity()`) helps users but never replaces server checks.",
        "localStorage and sessionStorage are synchronous, string-only and readable by any script on the page; IndexedDB is async and for larger structured data.",
        "Cookies travel with requests; mark session cookies `HttpOnly`, `Secure` and `SameSite`.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Difference between cookies, localStorage and sessionStorage? A strong answer: lifetime (expiry vs forever vs tab), whether they are sent to the server (only cookies), size, and who can read them.",
        "Where should you store a JWT or session ID? A strong answer: an HttpOnly, Secure, SameSite cookie is safer than localStorage because injected scripts cannot read it; mention CSRF trade-offs.",
        "When would you use IndexedDB? A strong answer: large or structured offline data, files and blobs, where you need asynchronous, indexed access.",
        "How do you validate a form? A strong answer: use built-in constraints and `checkValidity` for fast feedback, custom validity for rules, and always validate again on the server.",
        "Why does `localStorage.setItem(\"n\", 1)` come back as a string? A strong answer: Storage holds strings only; values are converted on write, so parse on read.",
      ],
    },
    {
      kind: "quiz",
      question: `After localStorage.setItem("n", 5), what does localStorage.getItem("n") + 1 give?`,
      options: ["\"51\" as text", "6 as a number", "\"6\" as text", "NaN or an error"],
      answer: 0,
      why: "The stored value comes back as the string \"5\". Adding 1 to a string concatenates, so the result is \"51\". Number(...) converts it first.",
    },
    {
      kind: "quiz",
      question: `Which storage is cleared automatically when the tab is closed?`,
      options: ["sessionStorage", "localStorage", "A cookie with no expiry in every case", "IndexedDB"],
      answer: 0,
      why: "sessionStorage is scoped to one tab and discarded with it. localStorage and IndexedDB persist until cleared. Cookies depend on their expiry setting and the browser.",
    },
    {
      kind: "quiz",
      question: `Why is an HttpOnly cookie safer than localStorage for a session ID?`,
      options: [
        "Page scripts cannot read it, so XSS cannot copy it.",
        "The browser encrypts it before it is saved to disk.",
        "It is never sent to the server, so it cannot leak.",
        "It has no size limit, so it cannot be truncated.",
      ],
      answer: 0,
      why: "HttpOnly hides the cookie from document.cookie, so an injected script cannot read it. It is still sent with requests and is not encrypted by the browser. CSRF protection needs SameSite or a token.",
    },
  ],
};
