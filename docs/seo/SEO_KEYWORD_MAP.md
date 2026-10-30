# Keyword-to-page map

**Every keyword here is a hypothesis.** No keyword tool, Search Console or ranking data was
available, so this document has no search volumes, difficulty scores or rankings, and none should
be inferred from the order. Use Search Console's Performance report to replace these guesses once
there are impressions to read.

"Substantiated by" names what in the product backs the page. A page without that does not get built.

## Pages that exist and are indexable

Titles and descriptions below are live in the code on `develop`.

### `/` Homepage

| Field | Value |
|---|---|
| Intent | Commercial: find and try an AI mock interview tool |
| Main theme | AI mock interviews |
| Related queries | AI mock interview, spoken mock interview practice, mock interview for software engineers, TCS or Infosys interview practice |
| Audience | Job seekers in India preparing for service-based IT, Big Four, product and European rounds |
| Title | AI Mock Interviews for Software and IT Roles · Untiered |
| Description | Spoken AI mock interviews for the loops people actually sit: service-based IT, Big Four, European competency rounds, global product. Every score quotes what you said. 3 free mock interviews for life. |
| H1 | A mock interview that interrupts you. (unchanged; has the phrase, keeps the brand voice) |
| Internal links | `/pricing`, `/about`, gated `/courses` and `/interview/new` |
| Content gap | Only the first archetype is in the initial HTML. No plain statement of how a round runs step by step beyond the CTA band |
| Substantiated by | The product itself |

### `/pricing`

| Field | Value |
|---|---|
| Intent | Commercial: what does it cost |
| Main theme | AI mock interview pricing |
| Related queries | free AI mock interview, mock interview cost India |
| Audience | Candidates comparing options |
| Title | AI Mock Interview Pricing · Untiered |
| Description | Untiered pricing: 3 free mock interviews for life, then interview credits from ₹199. One-off payments, no subscription. |
| H1 | Pricing |
| Internal links | `/`, `/refund-policy`, `/login?next=/upgrade` |
| Content gap | None needed |
| Substantiated by | `CREDIT_PACKS` and the API's `BillingProperties.DEFAULT_PACKS` |

### `/about`, `/contact`, `/privacy`, `/terms`, `/refund-policy`

Navigational and trust pages. Indexable because people look for them and because payment review
and Google's OAuth review read them. Not worth targeting a keyword. Titles and descriptions are set.

## Course pages

The catalogue and overviews are public and indexable once released (owner, 30 October 2026).
Chapters stay behind sign-in and cannot rank. The titles and descriptions below are the plan; the
live text is `seoTitle` and `seoDescription` in each course's `index.ts`, with minor wording
differences. Facts come from the course content on `develop`.

| URL | Intent | Main theme | Related queries | Audience | Recommended title | Recommended description | H1 | Substantiated by |
|---|---|---|---|---|---|---|---|---|
| `/courses` | Informational | Free software interview courses | free coding courses for interviews, interview preparation course | Freshers and early-career engineers | Free Software Engineering Interview Courses · Untiered | Free interactive courses in Java, JavaScript, data structures, AI agents and system design, written for interview preparation. | Courses | 5 courses, 201 chapters |
| `/courses/java` | Informational | Java interview preparation | learn Java from scratch, Java interview questions for freshers | Beginners; assumes no programming | Java Programming Course for Interviews · Untiered | From your first line of code to the interview round that asks about it. 35 chapters of runnable Java. | Java Programming | 35 chapters, about 8 h |
| `/courses/javascript` | Informational | JavaScript interview preparation | JavaScript event loop, closures interview, React interview preparation | Frontend and full-stack candidates | JavaScript, React and Node for Interviews · Untiered | How JavaScript really runs, then React, Node.js and Next.js, to the depth interviews ask. 44 chapters. | JavaScript, React and Node | 44 chapters, about 15 h; every sample tested against Node |
| `/courses/dsa` | Informational | Data structures and algorithms preparation | DSA for coding interviews, coding interview patterns | Coding-round candidates | Data Structures and Algorithms for Coding Interviews · Untiered | The patterns behind every coding round, explained once so you keep them. 30 chapters. | Data Structures & Algorithms | 30 chapters, about 7 h |
| `/courses/system-design` | Informational | System design interview preparation | system design for beginners, system design interview practice | Mid-level engineers and ambitious freshers | System Design Interview Course · Untiered | From one request to resilient distributed and AI systems: practise the trade-offs, then assemble the architecture yourself. 59 chapters. | System Design | 59 chapters, about 15 h |
| `/courses/ai-agents` | Informational | AI agents explained | what is an AI agent, how language models work, agentic AI course | Beginners; no ML background | AI and Agentic AI Course for Beginners · Untiered | From what a language model is to an agent you assemble and run yourself, in plain language and grounded in the papers. 33 chapters. | AI and Agentic AI | 33 chapters, about 8 h |
| `/courses/<course>/<chapter>` (gated) | Informational | Specific concept, for example "closures" or "binary search" | Per chapter | Learners | Chapter title · Untiered | From the chapter's own summary | Chapter title | Only if opened later. Original prose, runnable code, self-check |

Each overview now shows who it is for (`level`), what you can do afterwards (`outcome`) and the
syllabus. **Content gap:** there is no sample of the teaching yet, which is the likeliest reason a
search engine would treat an overview as thin. Add one if Search Console reports that.

## Pages that do not exist

All **proposed, not built**, because each needs a decision or content that does not yet exist.

| Proposed URL | Intent | Main theme | Related queries | Audience | Title and description | H1 and outline | Required unique content | Indexable? |
|---|---|---|---|---|---|---|---|---|
| `/mock-interviews` | Commercial | Technical interview practice online | online technical interview practice, coding interview practice | Software candidates | "Online Technical Interview Practice, Spoken · Untiered". What a round is like and what the report shows | "Practise a technical interview out loud": how a round runs; follow-ups; the report; languages | A real sample transcript and report. May duplicate the homepage if thin, so consider improving `/` first | Yes, if it is distinct from `/` |
| `/mock-interviews/freshers` | Commercial | Software interview preparation for freshers | fresher interview preparation, campus placement interview practice | Final-year students and new graduates | "Mock Interviews for Freshers and Campus Placements · Untiered" | "Interview practice with no experience to talk about": what changes for freshers; project walkthroughs; HR rounds | Must describe what the product really does for freshers (tasks 048 and 051). Verify before writing | Yes |
| `/mock-interviews/service-based-it` | Commercial | Service-based IT interview practice | TCS interview preparation, Infosys interview practice, Big Four technical interview | Service-based IT candidates | "Mock Interviews for Service-Based IT and Big Four Roles · Untiered" | "Practise the rounds service companies run": technical, project walkthrough, techno-managerial, HR | The product's differentiator. Built from the same data as `LOOPS`, stated as typical, never as one employer's process | Yes |
| `/mock-interviews/hindi-english` | Commercial | Hindi-English mock interview | Hindi mock interview, code-switched interview practice | Candidates who interview in both languages | "Hindi-English AI Mock Interviews · Untiered" | "Practise the way the conversation really goes" | Real feature and few competitors per `CLAUDE.md`. Needs a real example. Demand is unknown: test with Search Console first | Yes |
| `/interviews/<employer>` | Informational | `<employer>` interview process | `<employer>` interview rounds, `<employer>` interview questions | Candidates targeting that employer | "`<Employer>` Interview Process and Practice · Untiered" | "How `<employer>` interviews run": rounds, with tier, recency and corroboration shown; practise this | **Sourced data only**, with provenance visible, as `CLAUDE.md` requires. `docs/source-register` has sources for 29 employers. Build only where sources support a page distinct from its neighbours | Only where sourced |

**`/interviews/<employer>` carries the most risk on this list.** `CLAUDE.md` calls organic search on
these queries a primary acquisition channel, and also calls an invented claim about a real employer
the most damaging failure this product has. Templated pages with the employer name swapped would
be both a doorway-page problem and that failure. Start with a few employers with strong sources.

## Themes from the brief, and where they landed

| Theme | Page | Status |
|---|---|---|
| AI mock interviews for software engineers | `/` | Live on `develop` |
| Online technical interview practice | `/` now; `/mock-interviews` proposed | Partly covered |
| Software engineering interview preparation | `/courses` | Public once released |
| Coding interview practice | `/courses/dsa`; `/arena` stays gated | Public once released |
| Data structures and algorithms preparation | `/courses/dsa` | Public once released |
| System design interview preparation | `/courses/system-design` | Public once released |
| Interview preparation for freshers | `/mock-interviews/freshers` | Proposed |
| Java interview preparation | `/courses/java`. The live course offering is real, so the theme is relevant | Public once released |
