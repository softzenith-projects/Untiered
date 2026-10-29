import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../content/scenarios");
export const TIERS = ["foundations", "intermediate", "advanced", "expert"];
const TYPES = new Set(["design_choice", "algo_choice", "complexity", "predict_output", "debug", "tradeoff"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPLEXITY = /^O\([A-Za-z0-9 +*/^().]+\)$/;
const present = (value) => typeof value === "string" && value.trim().length > 0;
// The Arena shows options in a shuffled order, so "A is right, B invents a limit" points at
// the wrong cards on screen. Explanations name options by what they say instead. A bare
// capital B, C or D (or "option A") is the tell; a capital A alone is usually an article.
const LETTER_REFERENCE = /(?:^|[\s(])[B-D](?=$|[\s.,:;)])|\b[Oo]ption\s+[A-D]\b|\bA (?:is|explains|enforces|checks|breaks|would|fails|invents)\b/;

export function loadCatalogue(root = ROOT) {
  const catalogue = JSON.parse(readFileSync(join(root, "concepts.json"), "utf8"));
  for (const course of catalogue.courses) {
    const ids = course.concepts.map((concept) => concept.id);
    if (!SLUG.test(course.slug) || new Set(ids).size !== ids.length) throw new Error(`Invalid concepts for ${course.slug}`);
    for (const concept of course.concepts) {
      if (!SLUG.test(concept.id) || !present(concept.name) || !TIERS.includes(concept.tier) ||
          !Array.isArray(concept.prerequisite_concept_ids) ||
          concept.prerequisite_concept_ids.some((id) => !ids.includes(id) || id === concept.id)) {
        throw new Error(`Invalid concept ${course.slug}:${concept.id}`);
      }
    }
  }
  return catalogue;
}

export function validateScenario(s, catalogue) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const course = catalogue.courses.find((c) => c.slug === s.course_slug);
  if (!course) fail("unknown course_slug");
  if (!SLUG.test(s.slug ?? "")) fail("invalid slug");
  for (const key of ["title", "hook", "context", "solution_brief"]) if (!present(s[key])) fail(`empty ${key}`);
  if (!TIERS.includes(s.tier)) fail("invalid tier");
  if (!["draft", "reviewed", "live"].includes(s.status)) fail("invalid status");
  if (!Number.isInteger(s.estimated_minutes) || s.estimated_minutes < 1 || s.estimated_minutes > 60) fail("invalid estimated_minutes");
  const known = new Set(course?.concepts.map((c) => c.id) ?? []);
  const declared = new Set(s.concept_ids ?? []);
  const covered = new Set();
  const conceptsValid = (ids, path) => {
    if (!Array.isArray(ids) || ids.length === 0) return fail(`${path}: concept_ids required`);
    for (const id of ids) if (!known.has(id)) fail(`${path}: unknown concept id ${id}`);
  };
  conceptsValid(s.concept_ids, "scenario");
  if (!Array.isArray(s.steps) || s.steps.length < 2) fail("at least two steps required");
  else s.steps.forEach((step, index) => {
    const path = `step ${index + 1}`;
    if (step.kind !== (index === 0 ? "initial" : "probe")) fail(`${path}: invalid kind/order`);
    if (!TYPES.has(step.step_type)) fail(`${path}: invalid step_type`);
    if (!present(step.prompt)) fail(`${path}: empty prompt`);
    if (index > 0 && !present(step.context_note)) fail(`${path}: probe without context_note`);
    if (!Array.isArray(step.options) || step.options.length < 3 || step.options.length > 4) fail(`${path}: 3-4 options required`);
    else {
      const ids = step.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length || step.options.some((o) => !present(o.id) || !present(o.text))) fail(`${path}: invalid or duplicate option`);
      if (ids.filter((id) => id === step.correct_option_id).length !== 1) fail(`${path}: exactly one correct option required`);
      if (step.step_type === "complexity" && step.options.some((o) => !COMPLEXITY.test(o.text))) fail(`${path}: invalid complexity expression`);
    }
    if (!present(step.explanation)) fail(`${path}: empty explanation`);
    else if (LETTER_REFERENCE.test(step.explanation)) fail(`${path}: explanation refers to an option by letter`);
    if (!present(step.bottleneck_note)) fail(`${path}: empty bottleneck_note`);
    if (["predict_output", "debug"].includes(step.step_type) && !present(step.code_snippet)) fail(`${path}: code-based step without snippet`);
    if (present(step.code_snippet) && !present(step.language)) fail(`${path}: snippet language required`);
    if (step.system_state !== undefined) {
      const state = step.system_state;
      if (!state || !Array.isArray(state.nodes) || !state.nodes.length ||
          state.nodes.some((node) => !present(node)) || new Set(state.nodes).size !== state.nodes.length ||
          !Array.isArray(state.links) || state.links.some((link) => !Array.isArray(link) || link.length !== 2 || link.some((node) => !state.nodes.includes(node)))) {
        fail(`${path}: invalid system_state graph`);
      }
    }
    conceptsValid(step.concept_ids, path);
    for (const id of step.concept_ids ?? []) {
      if (!declared.has(id)) fail(`${path}: concept ${id} not declared on scenario`);
      covered.add(id);
    }
  });
  for (const id of declared) if (!covered.has(id)) fail(`scenario concept ${id} is not tested`);
  return errors;
}

export function loadScenarios(root = ROOT) {
  const catalogue = loadCatalogue(root);
  const scenarios = [];
  for (const course of catalogue.courses) {
    for (const name of readdirSync(join(root, course.slug)).filter((n) => n.endsWith(".json"))) {
      const scenario = JSON.parse(readFileSync(join(root, course.slug, name), "utf8"));
      if (scenario.slug !== name.slice(0, -5)) throw new Error(`${name}: slug does not match filename`);
      const errors = validateScenario(scenario, catalogue);
      if (errors.length) throw new Error(`${name}: ${errors.join("; ")}`);
      scenarios.push(scenario);
    }
  }
  const ids = scenarios.map((s) => `${s.course_slug}/${s.slug}`);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate scenario slug");
  return { catalogue, scenarios };
}
