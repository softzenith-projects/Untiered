import type { Chapter } from "@/content/courses/types";

// The runnable sample is a plain-JavaScript model with a fake clock; its output was produced by running it under node.
// The password-hashing sample uses the real node:crypto; it was run on Node 24.13 and only its deterministic lines are shown.
export const chapterAuthAndData: Chapter = {
  slug: "auth-and-data",
  title: "Node.js: Authentication, Passwords, Databases and Config",
  summary:
    "Sessions versus JWTs, how to store passwords (hash with a salt, never encrypt), the cookie flags that matter, parameterised database queries, environment config, and a rate limiter you can run.",
  minutes: 26,
  blocks: [
    {
      kind: "p",
      text: "Two questions come before any feature in a real backend: **who is this?** (authentication) and **are they allowed to do this?** (authorisation). Getting them wrong is how data leaks, so interviewers probe the reasoning, not the library names. This chapter covers the reasoning, with the code you would write on Node: password storage, sessions and tokens, cookie flags, talking to a database safely, configuration, and a limit on how fast anyone may call you.",
    },
    {
      kind: "h",
      text: "The wedding-hall wristband analogy",
    },
    {
      kind: "analogy",
      title: "A guest list, or a wristband",
      text: "At a wedding hall there are two ways to know who may enter. One: the doorman keeps a **guest register** and ticks you in; to throw someone out he strikes the name off. That is a **session**: the server remembers you, and you carry only a ticket number. Two: at the first gate you are given a **stamped wristband** that says your name and table, stamped with a seal that is hard to forge. Any doorman can read it without a register. That is a **token** (a JWT is one). Where the analogy stops: a wristband stays valid until it expires, so removing a guest early means keeping a register of banned bands, which brings the register back.",
    },
    {
      kind: "h",
      text: "Passwords: hash, do not encrypt",
    },
    {
      kind: "concept",
      title: "Password hashing",
      text: "Never store a password, and never store something you can turn back into one. Store a **hash**: the output of a one-way function. Use a hash built to be **slow** (**scrypt**, **bcrypt** or **argon2**), not a fast one like SHA-256, so an attacker with a stolen database cannot try billions of guesses a second. Add a **salt**, a random value per user stored next to the hash, so two users with the same password get different hashes and ready-made lookup tables are useless. Compare in constant time.",
    },
    {
      kind: "code",
      caption:
        "Real Node (node:crypto): scrypt with a random salt and a constant-time comparison. Output from Node 24.13; the stored value itself is random, so only the true/false results are shown. It uses require and Buffer, so it does not run in the course editor.",
      code: `const { scryptSync, randomBytes, timingSafeEqual } = require("node:crypto");

function hashPassword(password) {
  const salt = randomBytes(16); // a new random salt for every password
  const hash = scryptSync(password, salt, 64);
  return salt.toString("hex") + ":" + hash.toString("hex");
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(actual, expected); // constant-time comparison
}

const stored = hashPassword("correct horse");
console.log("stored has salt and hash:", stored.split(":").length === 2);
console.log("right password:", verifyPassword("correct horse", stored));
console.log("wrong password:", verifyPassword("correct hose", stored));
console.log("same password, different hash:", hashPassword("correct horse") !== stored);
`,
      output: `stored has salt and hash: true
right password: true
wrong password: false
same password, different hash: true`,
    },
    {
      kind: "p",
      text: "In an application you would reach for a maintained library (`bcrypt` or `argon2` on npm) and its recommended cost settings rather than choosing parameters yourself. The sample uses the built-in `scryptSync` because it shows the three ideas with no install: slow hash, per-user salt, constant-time compare. In a request handler use the asynchronous `scrypt`, since the sync version blocks the one JavaScript thread (chapter 36).",
    },
    {
      kind: "h",
      text: "Sessions and tokens",
    },
    {
      kind: "compare",
      title: "Session cookie vs JWT",
      columns: [
        {
          label: "Server-side session",
          items: [
            "The cookie holds a random id; the data lives on the server (memory is not enough in production; use a database or Redis).",
            "Logout and \"sign out everywhere\" are instant: delete the record.",
            "Costs a lookup on every request.",
            "Simple and hard to get wrong for a normal website.",
          ],
        },
        {
          label: "JWT (signed token)",
          items: [
            "The token carries the claims and a signature; the server checks the signature, with no lookup.",
            "It is signed, not encrypted: anyone can read the payload, so put no secrets in it.",
            "Hard to revoke before it expires; keep it short-lived and pair it with a refresh token.",
            "Useful between services; not automatically better for a browser app.",
          ],
        },
      ],
    },
    {
      kind: "p",
      text: "Where the credential lives matters as much as its type. A cookie is sent by the browser automatically, which is convenient and is exactly why it needs flags. **`HttpOnly`** hides the cookie from JavaScript, so a script injected by an XSS bug cannot read it. **`Secure`** sends it only over HTTPS. **`SameSite`** (`Lax` or `Strict`) stops the browser attaching it to most cross-site requests, which blunts CSRF. Always set a lifetime (`Max-Age`). Storing a token in `localStorage` makes it readable by any script on the page, which is why many guides prefer an `HttpOnly` cookie for the browser.",
    },
    {
      kind: "p",
      text: "Below is a **model** with a fake clock so the output is exact: a session store with expiry and revocation, then a **token-bucket rate limiter** (3 requests of burst, one token back every 10 ms). Rate limiting protects login pages from password guessing and every endpoint from a runaway client; a real server keeps the counters per client key (an IP or a user id), often in Redis so several processes share them.",
    },
    {
      kind: "code",
      caption:
        "A MODEL of a session store and a token-bucket rate limiter, driven by a fake clock instead of Date.now. A real session id must be long and random, and real counters live in shared storage. Runs in the course editor and under node.",
      code: `// A MODEL of two server-side ideas with a fake clock, so the output is exact.
// 1) a session store: the server remembers who the cookie belongs to, and can revoke it.
// 2) a token-bucket rate limiter: 3 requests of burst, refilled at 1 token per 10 ms.
let now = 0; // fake clock in milliseconds

const sessions = new Map();
function login(user) {
  const id = "sess-" + (sessions.size + 1); // a real id must be long and random
  sessions.set(id, { user, expiresAt: now + 50 });
  return id;
}
function whoIs(id) {
  const s = sessions.get(id);
  if (!s) return "nobody (unknown session)";
  if (s.expiresAt <= now) {
    sessions.delete(id);
    return "nobody (expired)";
  }
  return s.user;
}

console.log("-- sessions --");
const id = login("asha");
console.log("t=" + now, whoIs(id));
now = 40;
console.log("t=" + now, whoIs(id));
sessions.delete(id); // logout, or "sign out everywhere": the server just forgets it
console.log("after revoke:", whoIs(id));
const id2 = login("ravi");
now = 100;
console.log("t=" + now, whoIs(id2));

console.log("-- rate limit --");
const bucket = { tokens: 3, last: now };
function allow() {
  const refill = Math.floor((now - bucket.last) / 10);
  if (refill > 0) {
    bucket.tokens = Math.min(3, bucket.tokens + refill);
    bucket.last += refill * 10;
  }
  if (bucket.tokens === 0) return false;
  bucket.tokens -= 1;
  return true;
}
const attempts = [0, 1, 2, 3, 4, 15, 16, 17];
for (const offset of attempts) {
  now = 100 + offset;
  console.log("t=" + now, allow() ? "200 OK" : "429 Too Many Requests");
}
`,
      output: `-- sessions --
t=0 asha
t=40 asha
after revoke: nobody (unknown session)
t=100 nobody (expired)
-- rate limit --
t=100 200 OK
t=101 200 OK
t=102 200 OK
t=103 429 Too Many Requests
t=104 429 Too Many Requests
t=115 200 OK
t=116 429 Too Many Requests
t=117 429 Too Many Requests`,
      tryIt: {
        language: "javascript",
        prompt:
          "Predict the rate-limit lines, then run it. Change the burst size from 3 to 5 (in both places) and the refill interval from 10 to 5. Which requests now succeed at t=103 and t=116?",
      },
    },
    {
      kind: "h",
      text: "Databases and configuration",
    },
    {
      kind: "p",
      text: "A Node server talks to a database through a **driver** (for PostgreSQL, `pg`). The rule that matters most is to send values **separately from the SQL text** with placeholders. Then the database never treats user input as SQL, which is what stops **SQL injection**. Use a **connection pool** so requests share a few open connections instead of opening one each. And keep **configuration** (database URL, secrets) out of the code: read it from environment variables. Current Node LTS can load a `.env` file for you with `node --env-file=.env server.js`, so a dotenv package is not needed for the basic case. Never commit the `.env` file; commit an `.env.example` with the key names and empty values.",
    },
    {
      kind: "code",
      caption:
        "Real Node with the pg package and a PostgreSQL database: a parameterised query, a pool, and config from the environment. Needs `npm install pg` and a running database, so it does not run in the course editor and no output is shown.",
      code: `import pg from "pg";

// DATABASE_URL comes from the environment, e.g.  node --env-file=.env server.js
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function findUserByEmail(email) {
  // WRONG (SQL injection): "select * from users where email = '" + email + "'"
  // RIGHT: the value travels separately from the SQL text
  const result = await pool.query("select id, name from users where email = $1", [email]);
  return result.rows[0] ?? null;
}

export async function shutdown() {
  await pool.end(); // let in-flight queries finish, then close the connections
}
`,
    },
    {
      kind: "pitfall",
      items: [
        "Storing passwords in plain text, or hashing them with plain SHA-256 or MD5. Fix: a slow, salted password hash (scrypt, bcrypt or argon2).",
        "Putting a secret, a password hash or personal data inside a JWT because \"it is encrypted\". It is only signed. Fix: keep the payload to an id and a few claims.",
        "Keeping sessions in a JavaScript object in memory in production. They vanish on restart and are not shared between processes. Fix: a database or Redis.",
        "Building SQL by joining strings with user input. Fix: placeholders and parameters, always.",
        "Setting a login cookie without HttpOnly, Secure and SameSite. Fix: set all three, plus an expiry.",
        "Checking permission only in the UI. Fix: authorise on the server for every request, including the owner check (is this record yours?).",
      ],
    },
    {
      kind: "remember",
      items: [
        "Authentication is who you are; authorisation is what you may do. Check both on the server, on every request.",
        "Passwords: slow salted hash (scrypt, bcrypt, argon2), compared in constant time. Never encrypt, never use a fast hash.",
        "A session keeps data on the server and revokes instantly; a JWT is signed not encrypted, and is hard to revoke before it expires.",
        "Cookies need HttpOnly, Secure and SameSite. Queries need placeholders. Secrets belong in environment variables, never in git.",
      ],
    },
    {
      kind: "interview",
      items: [
        "\"Sessions or JWTs: which would you use?\" Strong answer: for a browser app a server-side session in an HttpOnly cookie is simple and revocable; JWTs suit service-to-service calls or stateless needs, with short expiry and a refresh token, accepting that revocation is harder.",
        "\"How do you store passwords?\" Strong answer: never plain or encrypted; a slow, salted, one-way hash such as bcrypt, scrypt or argon2, with constant-time comparison; salt explained.",
        "\"What do HttpOnly, Secure and SameSite do?\" Strong answer: HttpOnly hides the cookie from scripts (XSS), Secure restricts to HTTPS, SameSite limits cross-site sending (CSRF).",
        "\"How do you prevent SQL injection?\" Strong answer: parameterised queries so input is data, not SQL; plus least-privilege database accounts.",
        "\"How would you rate-limit a login endpoint?\" Strong answer: a counter or token bucket per IP and per account in shared storage like Redis, return 429, and consider slowing repeated failures.",
      ],
    },
    {
      kind: "quiz",
      question: "Two users choose the same password. With a per-user salt, what do the stored hashes look like?",
      options: [
        "Identical, because the password is identical",
        "Different, because each hash was computed with its own random salt",
        "Identical, but the salts differ",
        "They cannot be stored in the same table",
      ],
      answer: 1,
      why: "The salt is mixed into the hash input, so the same password gives a different hash for each user. An attacker cannot spot shared passwords or use a precomputed table.",
    },
    {
      kind: "quiz",
      question: "An administrator disables a user's account right now. Which setup stops the user's existing login immediately?",
      options: [
        "A JWT that is valid for 30 days",
        "A server-side session, with the record deleted",
        "A JWT stored in localStorage",
        "A cookie with SameSite=Strict",
      ],
      answer: 1,
      why: "A session is only a pointer to server-side data. Deleting the record ends the login at once. A signed token stays valid until it expires unless you also keep a blocklist.",
    },
    {
      kind: "quiz",
      question: `The model's bucket holds 3 tokens and gains 1 token per 10 ms. Four requests arrive at t=0, then another at t=10. Which are answered 429?`,
      options: ["Only the 4th request", "The 4th and the one at t=10", "None of them", "Only the one at t=10"],
      answer: 0,
      why: "The first three spend the 3 tokens. The 4th at t=0 finds none and gets 429. By t=10 one token has been refilled, so the request at t=10 succeeds.",
    },
  ],
};
