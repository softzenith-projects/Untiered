import type { Chapter } from "@/content/courses/types";

// Every runnable sample's output below was produced by running it under node.
export const chapterFetchAndAbort: Chapter = {
  slug: "fetch-and-abort",
  title: "fetch, Errors, AbortController and Retries",
  summary: "How fetch really reports failure (a 404 is not an error), reading JSON, cancelling and timing out requests with AbortController, retrying with backoff, and CORS in one page.",
  minutes: 20,
  blocks: [
    {
      kind: "p",
      text: "`fetch` is how a browser (and in current Node LTS versions) makes a network request. It returns a promise, so everything you learned about promises and `await` applies. This chapter is about the parts people get wrong in interviews: what counts as failure, how to cancel, and how to retry without making an outage worse.",
    },
    {
      kind: "p",
      text: "**A note on what runs here.** A lesson sandbox cannot call the network, so the runnable samples use a small **model** of `fetch` built on `setTimeout`. It behaves like the real one in the ways we care about (what resolves, what rejects, what cancelling does), but it is not the real `fetch`. The real code is shown in plain code blocks that you copy into your own project.",
    },
    {
      kind: "h",
      text: "The courier analogy",
    },
    {
      kind: "analogy",
      title: "Sending a courier to a government office",
      text: "You send a courier to an office for a certificate. The courier can come back with a **letter saying \"request refused, wrong form\"**: that is still a successful trip, because the courier got there and returned with an answer. The trip only **fails** if the courier never reaches the office (road closed) or you call them back. `fetch` works the same: a 404 or 500 is a response that arrived, so the promise **fulfils**; only a network failure, a blocked request or a cancellation makes it **reject**. Where the analogy stops: you can call a courier back, but the office may already have started your request. Cancelling stops you waiting; it may not stop the server working.",
    },
    {
      kind: "h",
      text: "A 404 is not an error",
    },
    {
      kind: "code",
      code: `// A MODEL of fetch, built on setTimeout. It never touches the network.
function makeController() {
  const signal = { aborted: false, handlers: [] };
  return {
    signal,
    abort() {
      if (signal.aborted) return;
      signal.aborted = true;
      signal.handlers.forEach((handler) => handler());
    },
  };
}

const routes = {
  "/users": { status: 200, body: { users: ["Asha", "Ravi"] }, ms: 20 },
  "/missing": { status: 404, body: { error: "not found" }, ms: 10 },
  "/slow": { status: 200, body: { users: [] }, ms: 60 },
};

function fakeFetch(url, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const route = routes[url];
    if (!route) {
      setTimeout(() => reject(new TypeError("Failed to fetch")), 5);
      return;
    }
    const timer = setTimeout(() => {
      resolve({
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        json: () => Promise.resolve(route.body),
      });
    }, route.ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      };
      if (signal.aborted) return onAbort();
      signal.handlers.push(onAbort);
    }
  });
}

async function main() {
  const res = await fakeFetch("/missing");
  console.log("resolved, ok:", res.ok, "status:", res.status);

  try {
    await fakeFetch("/nowhere");
  } catch (e) {
    console.log("rejected:", e.name, "-", e.message);
  }

  const response = await fakeFetch("/users");
  if (!response.ok) throw new Error("HTTP " + response.status);
  const data = await response.json();
  console.log(data.users.length, "users:", data.users);
}
main();`,
      caption: "The model fetch (above the line) and the behaviour that matters: a 404 resolves, a network failure rejects, and the body is read with a second promise.",
      output: `resolved, ok: false status: 404
rejected: TypeError - Failed to fetch
2 users: [ 'Asha', 'Ravi' ]`,
      tryIt: {
        language: "javascript",
        prompt: "Change the last request to `/missing`. The check `if (!response.ok)` now throws. Wrap `main()` with a `.catch` to print the message.",
      },
    },
    {
      kind: "p",
      text: "Here is the same thing with the real API. Run this in a browser console or in current Node.",
    },
    {
      kind: "code",
      code: `async function getUsers() {
  const response = await fetch("https://api.example.com/users");
  if (!response.ok) {
    throw new Error("Request failed with status " + response.status);
  }
  return response.json();
}

try {
  const users = await getUsers();
  console.log(users);
} catch (error) {
  console.error("Could not load users:", error.message);
}`,
      caption: "The real fetch. Not run here (no network in the sandbox). Always check `response.ok` yourself; `response.json()` is a second promise and rejects if the body is not valid JSON.",
    },
    {
      kind: "h",
      text: "Cancelling and timing out",
    },
    {
      kind: "concept",
      title: "AbortController",
      text: "An **`AbortController`** has a `signal` you pass to `fetch` (`fetch(url, { signal })`) and an `abort()` method. Calling `abort()` makes the pending `fetch` promise reject with an error named **`AbortError`**. The signal can be shared, so one call can cancel several requests. Use it to cancel a search request when the user types again, and when a component goes away.",
    },
    {
      kind: "code",
      code: `// A MODEL of fetch, built on setTimeout. It never touches the network.
function makeController() {
  const signal = { aborted: false, handlers: [] };
  return {
    signal,
    abort() {
      if (signal.aborted) return;
      signal.aborted = true;
      signal.handlers.forEach((handler) => handler());
    },
  };
}

const routes = {
  "/users": { status: 200, body: { users: ["Asha", "Ravi"] }, ms: 20 },
  "/missing": { status: 404, body: { error: "not found" }, ms: 10 },
  "/slow": { status: 200, body: { users: [] }, ms: 60 },
};

function fakeFetch(url, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const route = routes[url];
    if (!route) {
      setTimeout(() => reject(new TypeError("Failed to fetch")), 5);
      return;
    }
    const timer = setTimeout(() => {
      resolve({
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        json: () => Promise.resolve(route.body),
      });
    }, route.ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        reject(error);
      };
      if (signal.aborted) return onAbort();
      signal.handlers.push(onAbort);
    }
  });
}

async function getWithTimeout(url, ms) {
  const controller = makeController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fakeFetch(url, { signal: controller.signal });
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log("fast:", await getWithTimeout("/users", 40));
  try {
    console.log("slow:", await getWithTimeout("/slow", 30));
  } catch (e) {
    console.log(e.name === "AbortError" ? "timed out, aborted" : "other error: " + e.message);
  }
}
main();`,
      caption: "The model with a controller. A request that is too slow is aborted by a timer; the AbortError is told apart from real failures.",
      output: `fast: 200
timed out, aborted`,
      tryIt: {
        language: "javascript",
        prompt: "Raise the timeout for \"/slow\" to 100. What does it print now, and why is `clearTimeout` in `finally`?",
      },
    },
    {
      kind: "code",
      code: `let controller;
const searchBox = document.querySelector("input");

searchBox.addEventListener("input", async () => {
  controller?.abort();                 // cancel the previous search
  controller = new AbortController();
  try {
    const res = await fetch("/api/search?q=" + searchBox.value, { signal: controller.signal });
    render(await res.json());
  } catch (error) {
    if (error.name !== "AbortError") throw error;
  }
});

try {
  const res = await fetch("/api/slow", { signal: AbortSignal.timeout(5000) });
  console.log(await res.json());
} catch (error) {
  if (error.name === "TimeoutError") console.log("took longer than 5 seconds");
  else throw error;
}`,
      caption: "The real thing: cancelling a stale search, and a five-second timeout. AbortSignal.timeout(ms) builds a signal that aborts itself after the delay; a rejection from it has the name TimeoutError, while a manual abort has the name AbortError. Not run here.",
    },
    {
      kind: "p",
      text: "A common wrong answer to \"add a timeout to fetch\" is `Promise.race([fetch(url), timeoutPromise])`. That makes your code stop waiting, but the request **keeps running** in the background. Only the abort signal actually cancels it.",
    },
    {
      kind: "h",
      text: "Retrying with backoff",
    },
    {
      kind: "p",
      text: "Some failures are temporary: a dropped connection, a server returning 503. Retry those, but wait longer each time (**exponential backoff**) so you do not hammer a server that is already struggling. Real systems also add a random delay (**jitter**) so that thousands of clients do not all retry at the same instant. Do not retry errors that will not change, such as 400 or 404, and be careful retrying requests that change data unless the server makes them safe to repeat.",
    },
    {
      kind: "code",
      code: `let calls = 0;
async function flaky() {
  calls++;
  if (calls < 3) throw new TypeError("Failed to fetch (attempt " + calls + ")");
  return "ok on attempt " + calls;
}

async function retry(fn, retries, baseMs) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries) throw e;
      const delay = baseMs * 2 ** attempt;
      console.log("retry in", delay, "ms after:", e.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

retry(flaky, 3, 10).then(console.log);`,
      caption: "A retry helper with backoff. The flaky function fails twice and succeeds on the third attempt. Delays are tiny here so the sample runs fast; real ones start around a few hundred milliseconds.",
      output: `retry in 10 ms after: Failed to fetch (attempt 1)
retry in 20 ms after: Failed to fetch (attempt 2)
ok on attempt 3`,
      tryIt: {
        language: "javascript",
        prompt: "Set `retries` to 1. What is printed, and how do you handle the final failure for the caller?",
      },
    },
    {
      kind: "h",
      text: "CORS in one page",
    },
    {
      kind: "concept",
      title: "Same-origin policy and CORS",
      text: "A page may freely load code from other sites, but by default it may not **read the response** of a request to a different origin (scheme + host + port). **CORS** (Cross-Origin Resource Sharing) is how a server opts in: it replies with an `Access-Control-Allow-Origin` header naming the origins allowed to read the response. For requests that could change data (a custom header, or a method such as `PUT` or `DELETE`, or JSON content type), the browser first sends a **preflight** `OPTIONS` request to ask permission. The browser enforces this; it is not a server-side check, which is why Node code calling the same URL is not blocked. A CORS failure appears in `fetch` as a rejected promise with a generic `TypeError`, with the real reason in the browser console.",
    },
    {
      kind: "pitfall",
      items: [
        "Treating a 404 or 500 as a rejection. Without `if (!res.ok)` your code reads an error page as data.",
        "Forgetting that `res.json()` is async: `const data = res.json()` is a promise, not the data.",
        "Using `Promise.race` for a timeout and believing the request was cancelled.",
        "Retrying instantly in a tight loop, or forever. Back off and cap the attempts.",
        "Trying to fix a CORS error in the client. It must be fixed in the server's response headers (or by calling through your own server).",
      ],
    },
    {
      kind: "remember",
      items: [
        "`fetch` fulfils for any HTTP response, including 404 and 500. Check `response.ok`. It rejects for network failure, CORS blocks and aborts.",
        "`response.json()` returns another promise, so await it.",
        "Cancel with `AbortController` (`signal` passed to fetch, `abort()` rejects with `AbortError`); `AbortSignal.timeout(ms)` gives a ready-made timeout. `Promise.race` alone does not cancel.",
        "Retry only transient failures, with exponential backoff, jitter and a cap. CORS is the browser enforcing the server's `Access-Control-*` headers.",
      ],
    },
    {
      kind: "interview",
      items: [
        "Does `fetch` reject on a 404 or 500? A strong answer: no. It fulfils; check `response.ok` or `response.status`. It rejects only on network failure, a CORS block, or an abort.",
        "How do you cancel a fetch? A strong answer: pass an `AbortSignal` from an `AbortController`, call `abort()`, and handle the `AbortError`. Mention that `Promise.race` with a timer does not cancel the request.",
        "How would you add retries? A strong answer: retry only transient failures, use exponential backoff with jitter and a cap on attempts, and think about idempotency.",
        "What is CORS and why does it exist? A strong answer: the browser's same-origin policy blocks cross-origin reads; the server grants access with headers; preflight for non-simple requests; it protects users, not servers.",
        "How do you stop an out-of-order response overwriting a newer one in a search box? A strong answer: abort the previous request, or ignore stale responses by tracking a request id.",
      ],
    },
    {
      kind: "quiz",
      question: "A server replies with status 500. What does `await fetch(url)` do?",
      options: [
        "Throws a TypeError",
        "Resolves with a response whose `ok` is false",
        "Never settles",
        "Resolves with `null`",
      ],
      answer: 1,
      why: "The response arrived, so the promise fulfils. Only network-level failures and aborts reject.",
    },
    {
      kind: "quiz",
      question: "A retry helper waits `100 * 2 ** attempt` ms, with attempt counting from 0. What are the waits before the first three retries?",
      options: ["100, 100, 100", "100, 200, 400", "200, 400, 800", "100, 300, 900"],
      answer: 1,
      why: "2 ** 0 = 1, 2 ** 1 = 2 and 2 ** 2 = 4, so the waits are 100, 200 and 400 ms.",
    },
    {
      kind: "quiz",
      question: "Why is `Promise.race([fetch(url), timeout(5000)])` not a true timeout?",
      options: [
        "Because `race` only works with two promises of the same type.",
        "Because the fetch keeps running after the race is decided; only an abort signal cancels it.",
        "Because `timeout` always wins.",
        "Because `fetch` cannot be inside an array.",
      ],
      answer: 1,
      why: "`race` only decides which promise your code listens to. The losing request still consumes network and server resources unless you abort it.",
    },
  ],
};
