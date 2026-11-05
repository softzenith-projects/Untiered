import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { FREE_ROUNDS_LIFETIME_TEXT, FREE_ROUNDS_TEXT, LEGAL } from "@/lib/legal";

/**
 * The free tier is three interviews for life, not one a day (owner, 29 October 2026). The
 * old wording outlived the change once already, in places no test looked at, so this
 * reads every user-facing source file for a daily interview allowance.
 */
const SRC = join(__dirname, "..");
const SKIPPED = ["content/courses", "lib/arena", "components/arena", "app/arena"];

const DAILY_ALLOWANCE = [
  /\b(interviews?|rounds?)\b[^"'`\n]{0,40}\b(a|per|each) day\b/i,
  /\bone (round|interview) today\b/i,
  /\bdaily (free|limit|allowance|interviews?|rounds?)\b/i,
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("the free allowance, as the product states it", () => {
  it("is three mock interviews for life", () => {
    expect(LEGAL.freeRounds).toBe(3);
    expect(FREE_ROUNDS_TEXT).toBe("3 mock interviews");
    expect(FREE_ROUNDS_LIFETIME_TEXT).toBe("Your first 3 mock interviews are on us. Forever.");
  });

  // Every page that states the allowance says "for life", so "your first 3" cannot be read
  // as a quota that comes back. The terms also say, in words, that it never resets.
  it.each(["app/terms/page.tsx", "app/privacy/page.tsx", "app/upgrade/page.tsx", "app/page.tsx"])(
    "%s states the allowance as a lifetime one",
    (page) => {
      const source = readFileSync(join(SRC, page), "utf8");
      expect(source).toContain("FREE_ROUNDS_LIFETIME_TEXT");
      expect(source).not.toMatch(/\bFREE_ROUNDS_TEXT\b/);
    },
  );

  it("says in the terms that the free interviews do not reset or come back", () => {
    const terms = readFileSync(join(SRC, "app/terms/page.tsx"), "utf8").replace(/\s+/g, " ");
    expect(terms).toMatch(/does not reset each day, month or year, and it does not come back once used/);
  });

  it("is never described as a daily allowance in user-facing copy", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const path = relative(SRC, file).replace(/\\/g, "/");
      if (SKIPPED.some((skip) => path.startsWith(skip))) continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          // Comments explain the configurable allowance to engineers; only shipped text counts.
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (DAILY_ALLOWANCE.some((pattern) => pattern.test(line))) offenders.push(`${path}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
