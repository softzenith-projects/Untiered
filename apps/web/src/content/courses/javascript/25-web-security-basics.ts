import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterWebSecurityBasics: Chapter = {
  slug: "web-security-basics",
  title: "Web Security Basics",
  summary: "Cross-site scripting and how escaping stops it, CSRF and SameSite cookies, what CORS does and does not protect, Content-Security-Policy, prototype pollution, and handling user input safely.",
  minutes: 20,
  blocks: [
    {
      kind: "p",
      text: "Anything a user types, and anything that arrives in a URL, a form, a cookie or an API response, is **untrusted input**. Most web attacks are one mistake repeated: treating untrusted text as code or as an instruction. This chapter names the five attacks every web developer should recognise and the habit that stops each one. It teaches defence, not attack technique.",
    },
    {
      kind: "h",
      text: "The bank counter analogy",
    },
    {
      kind: "analogy",
      title: "A cheque that carries its own instructions",
      text: "Imagine a bank clerk who obeys any note handed over the counter, even one that says \"also give the bearer everything in the safe\". The mistake is not the customer's handwriting; it is a clerk who cannot tell a customer's data from the bank's own orders. Injection attacks are that mistake in a website: the page mixes the user's text with its own code, and the browser cannot tell the difference. Where the analogy stops: a clerk can ask for a signature. A browser has to be told, with escaping and headers, which parts are only text.",
    },
    {
      kind: "h",
      text: "XSS: when text becomes script",
    },
    {
      kind: "p",
      text: "**Cross-site scripting (XSS)** happens when a page puts untrusted text into HTML as markup, so an attacker's script runs inside your site with your user's session. The root fix is to keep data and markup apart: put text in with `textContent` (the browser treats it as plain text), or **escape** it so characters such as `<` become harmless entities. Frameworks like React escape text in JSX for you; the danger returns when you use `innerHTML`, `dangerouslySetInnerHTML` or `eval`.",
    },
    {
      kind: "code",
      code: `// Dangerous: the string is parsed as HTML.
comment.innerHTML = userText;

// Safe: the string is only ever text.
comment.textContent = userText;`,
      caption: "Browser code. Pick the second whenever the text is not meant to be markup.",
    },
    {
      kind: "p",
      text: "The sample below is a **model** of escaping and of prototype pollution, two things you can see with plain JavaScript. It does not exercise a browser or a real attack surface.",
    },
    {
      kind: "code",
      code: `const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
console.log(escapeHtml('<img src=x onerror="doBadThing()">'));

function unsafeMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === "object" && source[key] !== null) {
      target[key] = unsafeMerge(target[key] ?? {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (typeof source[key] === "object" && source[key] !== null) {
      target[key] = safeMerge(Object.hasOwn(target, key) ? target[key] : {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
safeMerge({}, payload);
console.log("after safeMerge:", {}.isAdmin);
unsafeMerge({}, payload);
console.log("after unsafeMerge:", {}.isAdmin);
delete Object.prototype.isAdmin;
console.log("cleaned up:", {}.isAdmin);`,
      caption: "Escaping turns markup into text. The unsafe merge writes through `__proto__` onto `Object.prototype`, so every plain object now appears to be an admin. The last line removes the damage so nothing else is affected.",
      output: `&lt;img src=x onerror=&quot;doBadThing()&quot;&gt;
after safeMerge: undefined
after unsafeMerge: true
cleaned up: undefined`,
      tryIt: {
        language: "javascript",
        prompt: "In `unsafeMerge`, skip the key `\"__proto__\"` with an `if` and run again. Does `{}.isAdmin` still become true?",
      },
    },
    {
      kind: "concept",
      title: "Prototype pollution",
      text: "Chapter 12 showed that objects inherit from `Object.prototype`. If code copies keys from untrusted JSON into an object **without checking the key**, a payload with the key `__proto__` (or `constructor.prototype`) changes the shared prototype instead of one object, and every object in the program inherits the attacker's property. Defences: reject those keys, merge into objects made with `Object.create(null)`, use `Map`, and keep libraries updated. Never write a recursive merge that trusts its input.",
    },
    {
      kind: "h",
      text: "CSRF, CORS and CSP, which are not the same thing",
    },
    {
      kind: "compare",
      title: "Three acronyms people mix up",
      columns: [
        {
          label: "CSRF",
          items: [
            "An attacker's page makes your browser send a request to a site where you are logged in; your cookie goes along.",
            "Defences: `SameSite` cookies, anti-CSRF tokens, checking the `Origin` header.",
            "Protects the **server**.",
          ],
        },
        {
          label: "CORS",
          items: [
            "A browser rule: JavaScript on one origin may read a response from another only if that server allows it with headers.",
            "Does not stop the request being sent, and does not stop non-browser clients.",
            "Controls what **page code can read**.",
          ],
        },
        {
          label: "CSP",
          items: [
            "A response header listing where scripts, styles and images may load from.",
            "Limits damage if XSS slips through: inline or foreign scripts are refused.",
            "A **second line of defence**, not a fix for escaping.",
          ],
        },
      ],
    },
    {
      kind: "code",
      code: `# Response headers a server might send
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'
Access-Control-Allow-Origin: https://app.example.com`,
      caption: "A session cookie that scripts cannot read and that is not sent on most cross-site requests, a policy allowing only your own scripts, and a CORS allowance for one named origin. Values are illustrative.",
    },
    {
      kind: "p",
      text: "CORS is the one most often misunderstood. It is enforced by the **browser**, not the server, and it exists to protect users from malicious pages reading private data. Setting `Access-Control-Allow-Origin: *` on an endpoint that returns private data is a mistake; and fixing a CORS error by disabling it in your own browser fixes nothing for anyone else. For authenticated APIs, name the exact origin.",
    },
    {
      kind: "h",
      text: "Habits that cover most of it",
    },
    {
      kind: "list",
      ordered: true,
      items: [
        "Treat all input as untrusted, wherever it came from: forms, URLs, cookies, headers, uploaded files, API responses.",
        "Keep data and code apart: `textContent`, parameterised database queries, and escaping for the context (HTML, URL, attribute).",
        "Validate on the server. The browser's checks are a convenience only.",
        "Put session cookies in `HttpOnly; Secure; SameSite`, and never keep secrets in `localStorage` or in client code.",
        "Do not run strings as code: avoid `eval`, `new Function` and `setTimeout(\"string\")`.",
        "Keep dependencies updated, and add a Content-Security-Policy as a safety net.",
      ],
    },
    {
      kind: "pitfall",
      items: [
        "Using `innerHTML` or `dangerouslySetInnerHTML` with user-supplied text. Use `textContent`, or sanitise with a maintained library if you must render HTML.",
        "Believing CORS protects your API. It only governs which pages in a browser can read responses; the request still reaches the server. Authenticate and authorise on the server.",
        "Storing tokens in `localStorage` where XSS can read them.",
        "Hiding a button in the UI and treating that as access control. Check permissions in the backend.",
        "Merging untrusted JSON into an object recursively with no key check, which allows prototype pollution.",
        "Putting a secret in client-side code or a `NEXT_PUBLIC_`-style variable. Anything shipped to the browser is public.",
      ],
    },
    {
      kind: "remember",
      items: [
        "Most attacks mix untrusted data with code; keep them apart with `textContent`, escaping and parameterised queries.",
        "XSS runs the attacker's script on your page; CSRF makes the victim's browser send a request; CORS is a browser read-permission rule; CSP limits what a page may load.",
        "Use `HttpOnly; Secure; SameSite` cookies for sessions, and always validate and authorise on the server.",
        "Prototype pollution comes from unchecked keys like `__proto__` in merges; reject them or use `Object.create(null)`.",
      ],
    },
    {
      kind: "interview",
      items: [
        "What is XSS and how do you prevent it? A strong answer: attacker script running in your page via unescaped input; prevent with output escaping or textContent, avoiding innerHTML, and a CSP as backup.",
        "What is CSRF and how do you stop it? A strong answer: a forged cross-site request using the victim's cookies; use SameSite cookies, anti-CSRF tokens and Origin checks.",
        "What does CORS do, and does it secure your API? A strong answer: the browser blocks cross-origin reads unless the server allows them; it does not secure the API from other clients, so you still need server-side auth.",
        "What is a Content-Security-Policy? A strong answer: a header restricting script, style and other sources; limits the impact of injected code.",
        "What is prototype pollution? A strong answer: writing to `Object.prototype` through keys like `__proto__` in an unsafe merge or assignment, affecting every object; prevent by key checks, `Object.create(null)` or `Map`.",
      ],
    },
    {
      kind: "quiz",
      question: `Which line is safe if userText comes from a form field?`,
      options: ["el.textContent = userText", "el.insertAdjacentHTML(\"beforeend\", userText)", "eval(userText)", "el.outerHTML = userText"],
      answer: 0,
      why: "textContent treats the string as plain text, so no markup or script in it is parsed. innerHTML, outerHTML and eval all interpret the string as HTML or code.",
    },
    {
      kind: "quiz",
      question: `A page at https://a.example calls fetch on https://api.example, and the browser reports a CORS error. What does that error mean?`,
      options: [
        "The browser would not let the page read it.",
        "The API server has been hacked or gone offline.",
        "The request was never sent over the network at all.",
        "The page has a syntax error in its script file.",
      ],
      answer: 0,
      why: "CORS is enforced by the browser on the reading side. The server may well have processed the request, but the response lacked the headers allowing this origin, so page code is not given it.",
    },
    {
      kind: "quiz",
      question: `Which cookie attribute stops page JavaScript from reading the cookie?`,
      options: ["HttpOnly", "Secure", "SameSite", "Path"],
      answer: 0,
      why: "HttpOnly hides the cookie from document.cookie. Secure limits it to HTTPS, SameSite limits cross-site sending, and Path limits which URLs get it.",
    },
  ],
};
