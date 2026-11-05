import type { ReportCompetency } from "@untiered/shared";

/**
 * A demo round for the homepage's sample report (owner, 4 November 2026).
 *
 * Invented, and labelled as a sample wherever it is shown: no real candidate's answers
 * appear on a public page. Scores and quotes are shaped exactly like a real report's, so
 * the report's own chart components can draw them.
 */
export const SAMPLE_REPORT = {
  roundLabel: "Technical round",
  context: "Backend engineer · product company rubric",
  headline: "A solid technical round with one gap in system design.",
  summary: "You handled the coding questions well but struggled to reason about scale.",
  wordsPerMinute: 171,
  answers: 5,
  unaidedAnswers: 4,
  nextAction: {
    focus: "Back-of-envelope estimation",
    drill: "Size three systems a day for a week: users, requests per second, storage.",
  },
  competencies: [
    {
      competency: "Coding",
      score: 4,
      maxScore: 5,
      rationale: "Clean solution, and named the complexity without being asked.",
      evidenceQuote: "I'd use a hashmap here so the lookup is O(1) instead of scanning the list.",
      turnIndex: 0,
    },
    {
      competency: "System design",
      score: 2,
      maxScore: 5,
      rationale: "Reached a workable shape only after the question was narrowed.",
      evidenceQuote: "I'd shard by user id so one wallet lands on one node.",
      turnIndex: 2,
    },
    {
      competency: "Communication and clarity",
      score: 3,
      maxScore: 5,
      rationale: "Clear once it got going; the first answer took a while to find its point.",
      evidenceQuote: "So basically, yeah, it was a worker, and it kind of just ran.",
      turnIndex: 1,
    },
    {
      competency: "Ownership",
      score: 3.2,
      maxScore: 5,
      rationale: "Said what they built, but less about what they decided.",
      evidenceQuote: "I wrote the retry logic, the rest of the team owned the queue.",
      turnIndex: 3,
    },
    {
      competency: "Estimating scale",
      score: 1.5,
      maxScore: 5,
      rationale: "No attempt to size the load before choosing a design.",
      evidenceQuote: "I'm not sure how many requests that would be, maybe a lot?",
      turnIndex: 4,
    },
  ] satisfies ReportCompetency[],
};
