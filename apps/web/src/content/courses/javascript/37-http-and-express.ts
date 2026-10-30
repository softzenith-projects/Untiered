import type { Chapter } from "@/content/courses/types";

// The runnable sample is a plain-JavaScript model of Express-style middleware; its output was produced by running it under node.
// The real Express code is not run here. Express 5 behaviour is stated from its documentation and flagged in the task report.
export const chapterHttpAndExpress: Chapter = {
  slug: "http-and-express",
  title: "HTTP, Express and Middleware",
  summary:
    "What an HTTP request and response contain, the status codes that matter, and how Express (written against Express 5) passes a request through a chain of middleware with next(), including the error path.",
  minutes: 24,
  blocks: [
    {
      kind: "p",
      text: "Almost every Node job interview ends up at a web server. Underneath, a server is a function that receives a **request** and must produce a **response**. **Express** is a small, widely used framework that organises that function into routes and a chain of reusable steps called **middleware**. If you understand the chain, you understand Express, and you can also answer \"how would you add logging, login checks or error handling?\" for any framework.",
    },
    {
      kind: "h",
      text: "The railway-ticket-counter queue analogy",
    },
    {
      kind: "analogy",
      title: "A request walks past a line of counters",
      text: "Imagine a visit to a railway reservation office. At the first window a guard notes your name in a register (**logging**). At the second, a clerk checks your ID and sends you away if you have none (**authentication**). At the third, someone checks your form is filled in properly (**validation**). Only then do you reach the window that actually issues the ticket (the **route handler**). Each window either deals with you completely or says \"go to the next window\". If anything goes wrong anywhere, you are sent to the complaints desk (**error middleware**). Where the analogy stops: a real office has the windows in fixed places, but in Express the order is simply the order in which you wrote `app.use` and `app.get`, which is why a mistake in that order is so common.",
    },
    {
      kind: "h",
      text: "HTTP in one page",
    },
    {
      kind: "p",
      text: "An HTTP request has a **method** (what to do), a **path** (which thing), **headers** (extra facts, such as the login cookie) and sometimes a **body**. The response has a **status code**, headers and a body. The method describes the intent: `GET` reads, `POST` creates, `PUT` replaces, `PATCH` changes part, `DELETE` removes. A method is **idempotent** if doing it twice has the same effect as once: `GET`, `PUT` and `DELETE` are, `POST` is not. That is why a browser warns before resending a form.",
    },
    {
      kind: "table",
      head: ["Status", "Meaning", "Use it when"],
      rows: [
        ["200 OK", "It worked", "A GET or update that returns data"],
        ["201 Created", "A new thing now exists", "A POST that created a record"],
        ["204 No Content", "It worked, nothing to send back", "A DELETE"],
        ["400 Bad Request", "The client sent something invalid", "Validation failed"],
        ["401 Unauthorized", "Not logged in (or bad credentials)", "No valid session or token"],
        ["403 Forbidden", "Logged in, but not allowed", "A normal user opens an admin route"],
        ["404 Not Found", "No such thing", "The id or path does not exist"],
        ["409 Conflict", "Clashes with current state", "Creating a duplicate email"],
        ["429 Too Many Requests", "Slow down", "Rate limit reached"],
        ["500 Internal Server Error", "The server failed", "A bug or a down database; never the client's fault"],
      ],
    },
    {
      kind: "p",
      text: "The family is the first digit: 2xx success, 3xx redirect, 4xx the **client** is at fault, 5xx the **server** is at fault. Interviewers like the 401 versus 403 question: 401 means \"I do not know who you are\", 403 means \"I know who you are, and the answer is no\".",
    },
    {
      kind: "h",
      text: "Middleware is a function with next()",
    },
    {
      kind: "concept",
      title: "Middleware",
      text: "A **middleware** is a function `(req, res, next)`. It may read or change `req` and `res`. Then it does exactly one of two things: **end the response** (`res.send(...)`, `res.json(...)`) or **call `next()`** to pass the request on. If it does neither, the request hangs until the client gives up. A middleware with **four** parameters, `(err, req, res, next)`, is an **error handler**: Express skips it for normal requests and runs it only when an error was passed on.",
    },
    {
      kind: "p",
      text: "The sample is a **model** of how that works, not Express itself. It keeps a list of layers, walks it with a `next` function, skips layers whose route does not match, and switches into error mode when `next(err)` is called or a handler throws. The rule that picks error handlers is the same one Express uses: a function with four parameters (checked by `handler.length`).",
    },
    {
      kind: "code",
      caption:
        "A MODEL of an Express-style app: use, get, a next() chain, a response that stops the chain, an error handler, and a 404 fallback. It is not Express and omits routing patterns, params and body parsing. Runs in the course editor and under node.",
      code: `// A MODEL of an Express-style app. Not Express: it shows route matching and how
// next() hands control down a chain, including the error path.
function createApp() {
  const stack = []; // each entry: { method, path, handler }
  const app = {
    use(handler) {
      stack.push({ method: null, path: null, handler });
    },
    get(path, ...handlers) {
      for (const handler of handlers) stack.push({ method: "GET", path, handler });
    },
    handle(method, path) {
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        send(body) {
          console.log("  ->", this.statusCode, body);
        },
      };
      const req = { method, path };
      let i = 0;
      let lastErr = null;
      function next(err) {
        if (err) lastErr = err;
        const layer = stack[i++];
        if (!layer) {
          if (lastErr) return res.status(500).send("Internal error");
          return res.status(404).send("Not found");
        }
        if (layer.method && (layer.method !== method || layer.path !== path)) return next();
        const isErrorHandler = layer.handler.length === 4;
        if (lastErr && !isErrorHandler) return next(); // skip normal handlers while in error mode
        if (!lastErr && isErrorHandler) return next(); // skip error handlers when all is well
        try {
          if (isErrorHandler) {
            const e = lastErr;
            lastErr = null;
            layer.handler(e, req, res, next);
          } else {
            layer.handler(req, res, next);
          }
        } catch (thrown) {
          next(thrown);
        }
      }
      next();
    },
  };
  return app;
}

const app = createApp();
app.use((req, res, next) => {
  console.log("  log:", req.method, req.path);
  next();
});
app.get("/hello", (req, res) => res.send("hello"));
app.get(
  "/admin",
  (req, res, next) => {
    console.log("  auth check fails");
    res.status(401).send("Unauthorised"); // responds and does NOT call next()
  },
  (req, res) => res.send("secret"),
);
app.get("/boom", () => {
  throw new Error("database is down");
});
app.use((err, req, res, next) => {
  console.log("  error handler saw:", err.message);
  res.status(500).send("Something went wrong");
});

for (const path of ["/hello", "/admin", "/boom", "/nope"]) {
  console.log("request", path);
  app.handle("GET", path);
}
`,
      output: `request /hello
  log: GET /hello
  -> 200 hello
request /admin
  log: GET /admin
  auth check fails
  -> 401 Unauthorised
request /boom
  log: GET /boom
  error handler saw: database is down
  -> 500 Something went wrong
request /nope
  log: GET /nope
  -> 404 Not found`,
      tryIt: {
        language: "javascript",
        prompt:
          "Move the logging `app.use` below the `/hello` route and predict which requests still print a log line. Then add `next()` to the /admin auth check and predict what /admin returns.",
      },
    },
    {
      kind: "steps",
      title: "The life of one request",
      steps: [
        { label: "Arrives", text: "Node's HTTP server hands Express a request and a response object." },
        { label: "Middleware, in order", text: "Each matching layer runs in the order it was registered; each calls next() or ends the response." },
        { label: "Route handler", text: "The handler matching the method and path builds the response (res.json, res.status(404).send)." },
        { label: "Error path", text: "A thrown error or next(err) skips ahead to the first error handler (four parameters)." },
        { label: "Fallback", text: "If no layer answered, Express sends 404; a final error handler is the safety net for 500." },
      ],
    },
    {
      kind: "h",
      text: "The same ideas in real Express",
    },
    {
      kind: "p",
      text: "The code below uses the real `express` package, so it needs `npm install express` and a terminal, and it does not run in the course editor. It is written for **Express 5**, the current major version as published on npm; check the package page for the version you install. In Express 5, a rejected promise from an `async` handler is passed to the error handler for you. In Express 4 you had to catch it yourself and call `next(err)`.",
    },
    {
      kind: "code",
      caption:
        "Real Express 5: JSON body parsing, a validated POST that returns 201 or 400, a 404 for a missing id, and a final error handler. Needs `npm install express`; it does not run in the course editor, so no output is shown.",
      code: `import express from "express";

const app = express();
app.use(express.json()); // parses a JSON body into req.body

const todos = new Map(); // a stand-in for a database
let nextId = 1;

function requireTitle(req, res, next) {
  const title = req.body?.title;
  if (typeof title !== "string" || title.trim() === "") {
    return res.status(400).json({ error: "title is required" }); // ends the chain
  }
  next();
}

app.post("/todos", requireTitle, (req, res) => {
  const todo = { id: nextId++, title: req.body.title.trim() };
  todos.set(todo.id, todo);
  res.status(201).json(todo); // 201: something new now exists
});

app.get("/todos/:id", (req, res) => {
  const todo = todos.get(Number(req.params.id));
  if (!todo) return res.status(404).json({ error: "not found" });
  res.json(todo);
});

app.use((err, req, res, next) => {
  console.error(err); // log the detail on the server...
  res.status(500).json({ error: "internal error" }); // ...but never send a stack trace to the client
});

app.listen(3000, () => console.log("listening on 3000"));
`,
    },
    {
      kind: "compare",
      title: "Designing the REST API",
      columns: [
        {
          label: "Good shape",
          items: [
            "Nouns in the path: `/todos`, `/todos/12`.",
            "The method says the action: `GET`, `POST`, `DELETE`.",
            "Status codes carry meaning: 201 for created, 404 for missing.",
            "Errors come back as a small JSON object, not an HTML page.",
          ],
        },
        {
          label: "Common mistakes",
          items: [
            "Verbs in the path: `/getTodo`, `/deleteTodo`.",
            "Everything is `POST` and every reply is `200` with an error inside.",
            "Returning a stack trace to the client.",
            "Trusting `req.body` without validating type and size.",
          ],
        },
      ],
    },
    {
      kind: "pitfall",
      items: [
        "A middleware that neither responds nor calls `next()`. The request hangs forever. Fix: every code path ends the response or calls next().",
        "Calling `next()` after sending a response, so a second handler tries to send again and Express throws \"headers already sent\". Fix: `return res.send(...)` to stop the function.",
        "Registering the error handler before the routes, so it never sees their errors. Fix: error middleware goes last. Also give it all four parameters, or Express treats it as an ordinary middleware.",
        "Registering `express.json()` after the routes that read `req.body`, so the body is undefined. Fix: body parsers go before the routes that need them.",
        "Sending 200 for everything, or 500 for a validation failure. Fix: 4xx when the client sent something wrong, 5xx only when the server failed.",
      ],
    },
    {
      kind: "remember",
      items: [
        "A request is a method, a path, headers and a body; a response is a status, headers and a body. 4xx means the client is wrong, 5xx means the server is.",
        "Middleware is (req, res, next). It must end the response or call next(); order of registration is order of execution.",
        "An error handler has four parameters and goes last; errors reach it by next(err) or a throw.",
        "Express 5 forwards a rejected promise from an async handler to the error handler; in Express 4 you caught it yourself.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"What is middleware in Express?\" Strong answer: a function (req, res, next) that runs in registration order and either ends the response or calls next(); used for logging, auth, parsing and validation.",
        "\"How does error handling work in Express?\" Strong answer: a four-argument function registered after the routes, reached through next(err) or a thrown error; mention that async errors are forwarded automatically in Express 5.",
        "\"What is the difference between 401 and 403?\" Strong answer: 401 is not authenticated; 403 is authenticated but not permitted.",
        "\"Which HTTP methods are idempotent?\" Strong answer: GET, PUT and DELETE; POST is not, so a retry could create a duplicate and the API needs an idempotency key or a unique constraint.",
        "\"How would you design a REST endpoint to create and fetch a resource?\" Strong answer: POST /things returns 201 and the new resource; GET /things/:id returns 200 or 404; validate input and return 400 with a clear message.",
      ],
    },
    {
      kind: "quiz",
      question: `An Express app registers, in this order: a logger that calls next(), then a route that sends "ok" for GET /a. What happens on GET /b?`,
      options: [
        "The logger runs, no route matches, and Express answers 404",
        "The route for /a runs anyway because it is the nearest",
        "The request hangs because no route matched",
        "Express answers 500 because /b is unknown",
      ],
      answer: 0,
      why: "The logger runs and calls next(). No later layer matches /b, so Express reaches the end of the chain and sends its default 404.",
    },
    {
      kind: "quiz",
      question: "A user is logged in but opens /admin and is not an administrator. Which status code is the best fit?",
      options: ["401", "403", "404", "500"],
      answer: 1,
      why: "The server knows who the user is, and refuses on permission. That is 403 Forbidden. 401 would mean the server does not know who they are.",
    },
    {
      kind: "quiz",
      question: `In the model, what does this handler do?
app.use((req, res, next) => {
  console.log("checking");
});`,
      options: [
        "It logs and passes the request on to the next layer",
        "It logs, then the request hangs, because the chain was neither ended nor continued",
        "It logs and Express automatically calls next() for it",
        "It logs and then sends a 404",
      ],
      answer: 1,
      why: "A middleware must end the response or call next(). This one does neither, so nothing else runs and the client waits until it times out.",
    },
  ],
};
