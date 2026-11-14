import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildSeedSql, isLocalHost, parseArgs, parseTarget, RESET_SQL } from "./campus-demo-seed.mjs";

const script = fileURLToPath(new URL("./campus-demo-seed.mjs", import.meta.url));

test("parseArgs reads repeatable staff and student flags, defaulting the role to tpo", () => {
  const args = parseArgs(["--yes", "--staff", "A@x.com", "--staff", "b@x.com:faculty", "--student", "c@x.com"]);
  assert.deepEqual(args.staff, [
    { email: "a@x.com", role: "tpo" },
    { email: "b@x.com", role: "faculty" },
  ]);
  assert.deepEqual(args.students, ["c@x.com"]);
  assert.throws(() => parseArgs(["--staff", "a@x.com:principal"]), /Unknown staff role/);
  assert.throws(() => parseArgs(["--staff", "a@x.com", "--student", "a@x.com"]), /only once/);
});

test("only a local database host is accepted, and credentials are never kept", () => {
  assert.deepEqual(parseTarget("jdbc:postgresql://127.0.0.1:55322/postgres"), { host: "127.0.0.1", port: "55322", db: "postgres" });
  assert.deepEqual(parseTarget("postgresql://postgres:secret@localhost:54322/postgres"), { host: "localhost", port: "54322", db: "postgres" });
  assert.ok(isLocalHost("localhost") && isLocalHost("127.0.0.1"));
  assert.ok(!isLocalHost("db.abcdefgh.supabase.co") && !isLocalHost("aws-0-ap.pooler.supabase.com"));
});

test("running against a non-local host is refused before anything else", () => {
  assert.throws(
    () => execFileSync(process.execPath, [script, "--yes"], { env: { ...process.env, DATABASE_URL: "postgresql://u:p@db.example.supabase.co:5432/postgres" }, stdio: "pipe" }),
    (error) => /Refusing to run/.test(String(error.stderr)) && !String(error.stderr + error.stdout).includes(":p@"),
  );
});

test("the seed is one transaction that resets first and tags every synthetic row", () => {
  const live = Array.from({ length: 5 }, (_, i) => ({
    id: `demo:scenario-${i}`,
    steps: [{ id: `demo:scenario-${i}:1`, correct: "a", options: ["a", "b"] }],
  }));
  const sql = buildSeedSql({ staff: [], students: [], live, now: Date.parse("2026-11-14T10:00:00Z") });
  assert.ok(sql.startsWith("begin;") && sql.trimEnd().endsWith("commit;"));
  assert.ok(sql.indexOf(RESET_SQL.trim().split("\n")[0]) < sql.indexOf("insert into public.organisations"));
  assert.equal((sql.match(/demo-student-\d\d@example\.invalid/g) ?? []).length >= 60, true);
  assert.ok(!/Demo Student \d+@/.test(sql));
});

// Needs a local Postgres in Docker. Set CAMPUS_SEED_TEST_DATABASE_URL=jdbc:postgresql://127.0.0.1:55322/postgres
const dbUrl = process.env.CAMPUS_SEED_TEST_DATABASE_URL;
test("seed -> counts -> reset leaves zero demo rows", { skip: !dbUrl && "CAMPUS_SEED_TEST_DATABASE_URL not set" }, () => {
  const env = { ...process.env, DATABASE_URL: dbUrl };
  const run = (...flags) => execFileSync(process.execPath, [script, "--yes", ...flags], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const counts = (out) => Object.fromEntries(out.split("\n").filter((l) => /^\w+: \d+$/.test(l)).map((l) => l.split(": ")).map(([k, v]) => [k, Number(v)]));

  const seeded = counts(run());
  assert.equal(seeded.orgs, 1);
  assert.equal(seeded.users, 60);
  assert.equal(seeded.leads, 2);
  assert.equal(seeded.templates, 1);
  assert.ok(seeded.assignments >= 9 && seeded.reports > 100 && seeded.answers > 0 && seeded.attempts >= seeded.reports);

  const again = counts(run()); // idempotent: re-running replaces, never doubles
  assert.equal(again.users, 60);
  assert.equal(again.orgs, 1);

  run("--reset");
  // A reseed with nothing linked prints counts; a reset prints none, so ask for them via a seed-less check.
  const probe = execFileSync("docker", ["ps", "--format", "{{.Names}}\t{{.Ports}}"], { encoding: "utf8" });
  const port = parseTarget(dbUrl).port;
  const container = probe.split("\n").find((l) => l.includes(`:${port}->5432`))?.split("\t")[0];
  const left = execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-At", "-c",
      "select (select count(*) from public.organisations where slug like 'demo-engineering-college%') + (select count(*) from auth.users where email like 'demo-student-%@example.invalid') + (select count(*) from public.campus_leads where email like 'demo-lead-%@example.invalid') + (select count(*) from public.programme_templates where title like '%(demo data)')"],
    { encoding: "utf8" },
  ).trim();
  assert.equal(left, "0");
});
