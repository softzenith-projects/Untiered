# Third-party material this product's own rubric drew on

This is **not** the source register. `docs/source-register/` lists pages the interviewer may
treat as knowledge about a *named employer*, and every entry there is fetched, read and
cited to the candidate. This file is for something different and much smaller: openly
licensed material that informed how *we* decided to interview, where the licence asks for
attribution and where saying nothing would be taking credit for somebody else's thinking.

Nothing listed here is quoted to a candidate, cited in a report, or treated as evidence
about any employer's process.

## Tech Interview Handbook

- Repository: <https://github.com/yangshun/tech-interview-handbook>
- Pages consulted: <https://www.techinterviewhandbook.org/behavioral-interview/> and
  <https://www.techinterviewhandbook.org/behavioral-interview-questions/>
- Licence: MIT. Copyright (c) Yangshun Tay.

What we took: the framing that a candidate with no job history answers competency
questions from coursework, projects, clubs and societies rather than from work — and that
preparing a small number of flexible stories beats memorising many answers. That framing
shaped the campus version of the behavioural round's ground to cover
(`CampusRounds` in `apps/api/.../interview/CandidateStage.kt`, task 048).

What we did not take: any question text, any answer, any rubric wording. No content was
copied; this is attribution for an idea we would otherwise be quietly passing off as our
own.

## Pipecat — user-turn completion

- Repository: <https://github.com/pipecat-ai/pipecat>
- File consulted: `src/pipecat/turns/user_turn_completion_mixin.py`, the instructions
  rendered by `_render_completion_instructions`.
- Licence: BSD 2-Clause. Copyright (c) Daily and the Pipecat contributors.

What we took: the protocol of having the model say whether the user had finished before it
answers — complete, cut off mid-thought, or asking for time — the rule that "complete" means
conversationally complete rather than long, the cues it lists for each (a phrase left open on
a conjunction or an unfinished list; "let me think", "give me a second"), and its default
waits of five and ten seconds for the two unfinished verdicts. Adapted, in our own words and
with interview examples, as the turn-completion section of the turn prompt
(`apps/api/src/main/resources/ai/prompts/assess-answer-turn-completion.md`) behind
`interviewos.interviewer.turn-state`, and as the waits in `InterviewerRulesProperties`.

What we did not take: any code, and none of the prompt text verbatim. Our verdicts are JSON
fields in the response schema rather than Pipecat's marker characters, and the candidate
intents (`repeat_request`, `self_correction` and the rest) are ours.

## What was looked for and not found

Recorded because the absence is load-bearing, and because somebody will otherwise look
again. As of September 2026 there is no openly licensed corpus of Indian campus interview
material, no openly licensed aptitude, quantitative or logical-reasoning set, and no
openly licensed set of DSA problem statements that a commercial product may use — CSES and
Project Euler are CC BY-NC-SA, and the NonCommercial clause rules both out. Aptitude and
coding material is therefore generated through the question pool and carries the
`model_knowledge` tier, which is what the candidate is told.
