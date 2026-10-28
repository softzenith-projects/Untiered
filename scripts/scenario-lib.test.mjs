import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCatalogue, loadScenarios, validateScenario } from "./scenario-lib.mjs";

const catalogue = loadCatalogue();
const { scenarios } = loadScenarios();
const base = scenarios.find((s) => s.course_slug === "dsa");
const copy = () => structuredClone(base);

test("all authored scenarios validate and have 5 ordered steps", () => {
  assert.equal(scenarios.length, 20);
  assert.equal(scenarios.filter((scenario) => scenario.course_slug === "ai-agents").length, 2);
  // limited-stock-checkout and password-change-sessions are drafts: maggi-flash-sale and
  // the-other-phone tell the same stories in more depth, and a learner shouldn't meet each twice.
  assert.equal(scenarios.filter((scenario) => scenario.course_slug === "system-design" && scenario.status === "live").length, 10);
  assert.equal(scenarios.filter((scenario) => scenario.course_slug === "system-design" && scenario.status === "draft").length, 4);
  for (const scenario of scenarios) {
    assert.equal(scenario.steps.length, 5);
    assert.deepEqual(validateScenario(scenario, catalogue), []);
  }
});

test("rejects system maps with links to missing components", () => {
  const scenario = structuredClone(scenarios.find((value) => value.slug === "fest-night"));
  scenario.steps[0].system_state.links.push(["students", "missing"]);
  assert.match(validateScenario(scenario, catalogue).join(";"), /invalid system_state graph/);
});

test("rejects missing, duplicate, and too few options", () => {
  const missing = copy(); missing.steps[0].correct_option_id = "missing";
  assert.match(validateScenario(missing, catalogue).join(";"), /exactly one correct/);
  const duplicate = copy(); duplicate.steps[0].options[1].id = duplicate.steps[0].options[0].id;
  assert.match(validateScenario(duplicate, catalogue).join(";"), /duplicate option/);
  const short = copy(); short.steps[0].options.pop();
  assert.match(validateScenario(short, catalogue).join(";"), /3-4 options/);
});

test("rejects missing explanation, probe context and unknown concepts", () => {
  const value = copy(); value.steps[1].context_note = ""; value.steps[2].explanation = "";
  value.steps[3].concept_ids = ["unknown"];
  const errors = validateScenario(value, catalogue).join(";");
  assert.match(errors, /probe without context_note/);
  assert.match(errors, /empty explanation/);
  assert.match(errors, /unknown concept id/);
});

test("rejects concepts that the campaign never tests", () => {
  const value = copy();
  value.concept_ids.push("amortized-analysis");
  assert.match(validateScenario(value, catalogue).join(";"), /is not tested/);
});

test("checks complexity notation and code snippets", () => {
  const complexity = copy(); complexity.steps[1].options[0].text = "linear";
  assert.match(validateScenario(complexity, catalogue).join(";"), /invalid complexity expression/);
  const code = copy(); code.steps[0].step_type = "debug";
  assert.match(validateScenario(code, catalogue).join(";"), /code-based step without snippet/);
});

test("rejects explanations that name options by letter, since the Arena shuffles them", () => {
  for (const explanation of ["A explains it. B is false.", "Option A is right.", "Not C: statics are roots.", "The answer is (B)."]) {
    const s = copy();
    s.steps[0].explanation = explanation;
    assert.match(validateScenario(s, catalogue).join(), /refers to an option by letter/, explanation);
  }
  const s = copy();
  s.steps[0].explanation = "A heap of size k keeps the best five; sorting all of them is wasted work.";
  assert.deepEqual(validateScenario(s, catalogue), []);
});

test("the right answer is not given away by being the longest option", () => {
  // Authors pad the right answer with its justification and leave the wrong ones short;
  // a reader learns to pick the longest. No course may let that work more than 40% of the time.
  for (const slug of new Set(scenarios.map((s) => s.course_slug))) {
    const steps = scenarios.filter((s) => s.course_slug === slug).flatMap((s) => s.steps);
    const longest = steps.filter((step) => {
      const correct = step.options.find((o) => o.id === step.correct_option_id).text.length;
      return step.options.every((o) => o.id === step.correct_option_id || o.text.length < correct);
    });
    assert.ok(longest.length <= steps.length * 0.4, `${slug}: right answer is the longest in ${longest.length} of ${steps.length} steps`);
  }
});
