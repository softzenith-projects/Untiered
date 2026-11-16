#!/usr/bin/env node
// Regenerates the campus MCQ bank seed migration (contract "Module 4b") from the course
// content: supabase/migrations/20261114130000_campus_mcq_bank.sql.
//
//   node scripts/export-mcq-bank.mjs
//
// The bank is every course-derived multiple-choice challenge (apps/web/src/lib/campus/mcq-bank.ts).
// The course content is TypeScript behind the web app's path aliases, so rather than add a
// loader this runs the bank's own Vitest file with MCQ_BANK_WRITE=1, which writes the
// migration before checking it. Without the variable the same test is the drift check CI runs.
//
// No dependencies beyond the web app's own dev tooling (Vitest).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps", "web");

// The web app's own Vitest, run with this Node: no shell, so nothing is re-parsed.
const vitest = path.join(path.dirname(createRequire(path.join(web, "package.json")).resolve("vitest/package.json")), "vitest.mjs");

const result = spawnSync(process.execPath, [vitest, "run", "src/lib/campus/mcq-bank.test.ts"], {
  cwd: web,
  stdio: "inherit",
  env: { ...process.env, MCQ_BANK_WRITE: "1" },
});

if (result.status !== 0) {
  console.error("export-mcq-bank: the exporter failed; the migration may not have been written.");
  process.exit(result.status ?? 1);
}
console.log("export-mcq-bank: wrote supabase/migrations/20261114130000_campus_mcq_bank.sql");
