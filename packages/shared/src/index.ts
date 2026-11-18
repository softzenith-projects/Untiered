/**
 * Contract for the versioned public API in `apps/api`.
 *
 * Hand-written for now — see HANDOFF.md. Generating these from an OpenAPI document
 * the backend already publishes is the right end state; it was not worth the
 * complexity on the scaffolding run. Until then, changing a response shape in the
 * backend means changing it here in the same commit.
 *
 * The web app and, in Phase 3, the mobile apps consume the same contract.
 */

export * from "./api.js";
export * from "./domain.js";
export * from "./interview.js";
export * from "./question-bank.js";
export * from "./loop-brief.js";
export * from "./course-progress.js";
export * from "./arena.js";
export * from "./billing.js";
export * from "./campus.js";
export * from "./college-packages.js";
