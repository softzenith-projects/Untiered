# System Design course — source and licence notes

The lesson prose, quiz questions, examples, diagrams and architecture-lab scenario wording
in this course are original to Untiered. They were not copied from a commercial
course, interview-question bank, repository README, or linked third-party article.

The curriculum structure and general technical vocabulary were informed by these openly
licensed primary sources:

- **System Design Primer**, Donne Martin — CC BY 4.0. Reviewed revision
  `ae9bbd7b02d90b9866215de185217d33f39ab733` (2026-09-24):
  <https://github.com/donnemartin/system-design-primer/tree/ae9bbd7b02d90b9866215de185217d33f39ab733>.
  Licence: <https://github.com/donnemartin/system-design-primer/blob/ae9bbd7b02d90b9866215de185217d33f39ab733/LICENSE.txt>.
  Used to cross-check the coverage of distributed-system fundamentals and generic case
  study categories. No externally linked images or articles were copied.
- **AI Agents for Beginners**, Microsoft — MIT. Reviewed revision
  `25b7985f3b2dc37a84f4a7387ccd3c9f0e5b1595` (2026-09-24):
  <https://github.com/microsoft/ai-agents-for-beginners/tree/25b7985f3b2dc37a84f4a7387ccd3c9f0e5b1595>.
  Licence: <https://github.com/microsoft/ai-agents-for-beginners/blob/25b7985f3b2dc37a84f4a7387ccd3c9f0e5b1595/LICENSE>.
  Used to cross-check agent design, tool-use, safety and multi-agent curriculum coverage.
- **Generative AI for Beginners**, Microsoft — MIT. Reviewed revision
  `d8ec07e31c4b32bd283d565c1abd9b58bb5cf2e8` (2026-09-24):
  <https://github.com/microsoft/generative-ai-for-beginners/tree/d8ec07e31c4b32bd283d565c1abd9b58bb5cf2e8>.
  Licence: <https://github.com/microsoft/generative-ai-for-beginners/blob/d8ec07e31c4b32bd283d565c1abd9b58bb5cf2e8/LICENSE>.
  Used to cross-check retrieval, vector-search, evaluation and responsible-AI coverage.
- **Kubernetes documentation** — CC BY 4.0. Reviewed website revision
  `2ad36cb0f1215e344d9108c0edaf3cbee081dce0` (2026-09-24):
  <https://github.com/kubernetes/website/tree/2ad36cb0f1215e344d9108c0edaf3cbee081dce0>.
  Licence: <https://kubernetes.io/docs/contribute/advanced/#license>.
  Used to cross-check the distinction between readiness and liveness probes and general
  horizontal-scaling, rollout and health-check terminology. No Kubernetes logos, diagrams
  or copied prose are used.
- **QuickFIX/J**, Contributors to the QuickFIX/J project — QuickFIX Software License
  Version 1.0. Reviewed revision `0ffe2f49cee24b1b55ce81283294d1b9ceaffb5b`
  (2026-09-25):
  <https://github.com/quickfix-j/quickfixj/tree/0ffe2f49cee24b1b55ce81283294d1b9ceaffb5b>.
  Licence: <https://github.com/quickfix-j/quickfixj/blob/0ffe2f49cee24b1b55ce81283294d1b9ceaffb5b/LICENSE>.
  Used only to cross-check public FIX gateway and order-message vocabulary for the generic
  retail-brokerage exercise. No source code, protocol examples or repository prose are used.
- **H3**, Uber Technologies, Inc. and contributors — Apache License 2.0:
  Reviewed revision `cd62033b337b128ea7c4749f2302143b424187fc` (2026-09-25):
  <https://github.com/uber/h3/tree/cd62033b337b128ea7c4749f2302143b424187fc>.
  Licence: <https://github.com/uber/h3/blob/cd62033b337b128ea7c4749f2302143b424187fc/LICENSE>.
  Used only to cross-check the public concept of hierarchical geospatial cells for the
  generic ride-dispatch exercise. No H3 code, diagrams, indexes or prose are included.

Product-shaped case studies deliberately use generic names such as “collaborative document
editor” and “ticket booking platform”. They do not claim to describe any named company's
private architecture. Educative, ByteByteGo, LeetCode company tags and other proprietary or
non-redistributable course material were not used.

**Fanout** (fanout.sh, *System Design Course: Concepts, Cases and Builds*) is a paid
course with no open licence. On 28 October 2026 only the module headings on its public
course page (e.g. "NoSQL, partitioning and IDs", "Storage engines", "Analytics and
sketches") were compared against this course's chapter list to find missing topics. That
comparison led to the "Inside the data layer" chapters (`data-internals.ts`). No Fanout
lesson, note, lab, diagram or example was opened, copied, paraphrased or used as a source;
those chapters are original writing.

The local `Course Materials/SysDesign` filenames were treated only as a coverage checklist.
No PDF or video was transcribed, paraphrased, extracted, embedded or used as a factual source.
All teaching expression and all quiz/scenario wording in this directory are original.
