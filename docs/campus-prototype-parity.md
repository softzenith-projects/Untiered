# Campus prototype parity: gap list

The owner's clickable prototype (`untiered-campus-prototype.html`) is the spec for how the
Campus portal should behave and what each screen shows. This file compares every prototype view
with the real app and records what was built. Demo data, the role switcher, the "Prototype"
banner, "Use the sample file", "Next question (demo)" and "Skip to report (demo)" are ignored.

Verdicts: **SAME**, **REAL HAS MORE** (kept), **MISSING** (build), **WRONG** (the prototype is
wrong or demo-only; skipped, with the reason).

Rules kept throughout: nothing the real app does today is removed or weakened (filters,
permissions, audit logging, the evidence threshold, 404-not-403 isolation, faculty scoping).
Aggregation is computed on the server. Join consent wording and `CONSENT_VERSION` are untouched.

## Staff

### overview (`/campus`)
| # | Difference | Verdict |
|---|---|---|
| 1 | Headline tiles: joined, active in 14 days, completions in last 30 days with change vs previous 30 | SAME (already `KpiRow`) |
| 2 | Headline tile "Interview-ready or strong" (count and % of joined) | MISSING (tile; the figure is `pipeline.interviewReady`) |
| 3 | Real also has an "Average score" tile with change, practice pipeline, skills, heatmap, batches | REAL HAS MORE |
| 4 | Conversion flow, readiness bands, component averages, weakest topics, weekly sparkline, heatmap, batches table | SAME |

### students (`/campus/students`)
| # | Difference | Verdict |
|---|---|---|
| 5 | "Last active" column (Today / N days ago / Not joined) | MISSING (adds `lastActiveAt` to `MemberView`) |
| 6 | Per-row "View readiness" link for joined students | MISSING |
| 7 | Open-invites note (single use, lapse after 14 days, resend makes no new account) | MISSING (static copy on the Invites tab, no count) |
| 8 | One status select Invited / Joined, not active / Active | WRONG for the real shape: real splits Students and Invites tabs with department and batch filters. Kept |
| 9 | Real: edit batch and roll number, remove, invite form, load more | REAL HAS MORE |

### import (`/campus/students/import`)
| # | Difference | Verdict |
|---|---|---|
| 10 | Drop zone, preview with ready and need-fixing counts, per-row check, start over, send invites | SAME (real uploads the file and validates on the server) |
| 11 | "No accounts are created at import" note | MISSING (copy only) |
| 12 | "Use the sample file" | WRONG: demo-only |

### assignments list (`/campus/assignments`)
| # | Difference | Verdict |
|---|---|---|
| 13 | Header tiles: college interviews used of allowance, published and draft counts, overdue student tasks | MISSING. The allowance is already on `GET /campus/orgs/{org}` (any staff), so TPO, college admin and faculty see it read-only |
| 14 | Per-assignment done / in progress / overdue | SAME (real shows every status column) |
| 15 | "Publish" button in the list for a draft | WRONG: real publishes from the detail page after a confirmation. Kept |
| 16 | Real: status filter, due and relative time, kind summary | REAL HAS MORE |

### new assignment (`/campus/assignments/new`)
| # | Difference | Verdict |
|---|---|---|
| 17 | Kind, round, length, company and role, title, batch, deadline, attempts, interview cap, save and publish | SAME |
| 18 | Real: individual students, instructions, candidate stage, language, focus topic, readiness component and topic, MCQ and Arena builders, late attempts | REAL HAS MORE |

### assignment detail (`/campus/assignments/[id]`)
| # | Difference | Verdict |
|---|---|---|
| 19 | Stat tiles: completed (with % of recipients), in progress, not started, overdue | MISSING (from the `counts` the server already returns) |
| 20 | "Report" link on a completed interview row | MISSING (adds `completedSessionId` to `RecipientProgress`; opens the audited staff report) |
| 21 | "Student" link on the other rows | MISSING |
| 22 | Draft view with publish and a note that students do not see a draft | SAME (real adds edit, archive, confirmation) |
| 23 | Real: batch and status filters, sorting, MCQ and scenario scores, last activity, edit published deadline | REAL HAS MORE |

### readiness (`/campus/readiness`)
| # | Difference | Verdict |
|---|---|---|
| 24 | Batch, band, search; sort by overall and each component; Export CSV; band pills; "Not attempted" | SAME |
| 25 | Real: department and completion filters, server-side sort and paging, audited export | REAL HAS MORE |

### student detail (`/campus/readiness/[memberId]`)
| # | Difference | Verdict |
|---|---|---|
| 26 | Overall, band, components, "Not attempted", score over time, staff notes | SAME (real adds weights, suggested topics, evidence links) |
| 27 | "Last active" | MISSING (staff-only block on the staff readiness read) |
| 28 | "Needs attention" callout naming the reasons | MISSING (reasons from the same `AttentionRules` as the attention list) |
| 29 | "Assigned work" list with status and a Report link | MISSING |
| 30 | Integrity counts on assigned rounds (window switches, pastes, unusually fast answers) | MISSING (new staff route; counts only, never a verdict) |

### staff report (`/campus/readiness/[memberId]/reports/[sessionId]`)
| # | Difference | Verdict |
|---|---|---|
| 31 | Report, integrity section, read-only banner | SAME |
| 32 | "Opening this report is written to the audit log" | MISSING (copy; the server already audits `report.viewed`) |

### attention (`/campus/attention`)
| # | Difference | Verdict |
|---|---|---|
| 33 | Reason pills, most reasons first, open the student | SAME |
| 34 | "Has a staff note" marker | MISSING (adds `hasStaffNote` to `AttentionRow`, scoped like the notes) |
| 35 | Real: reason filter, overall, band, overdue, last active | REAL HAS MORE |

### programmes (`/campus/programmes`, `/campus/programmes/[id]`)
| # | Difference | Verdict |
|---|---|---|
| 36 | Week-by-week view: title, unlock date, locked or open, % of students who completed the week | MISSING (new `GET .../programmes/{id}/weeks`, computed on the server, faculty scoped) |
| 37 | Certificate preview | MISSING (preview sheet with a sample name; real certificates stay on `/campus/me/certificates/...`) |
| 38 | "Start a programme" | SAME (real does it: template, batches, start date, schedule preview, confirm) |
| 39 | Per-student progress table, archive | REAL HAS MORE |
| 40 | Prototype limits programmes to the TPO | WRONG: real lets faculty read their batches' programmes. Kept |

### batch report (`/campus/reports/batch`)
| # | Difference | Verdict |
|---|---|---|
| 41 | Printable report: band counts, per-batch table, evidence footnote | SAME (real adds heatmap, student rows, filters, audit) |

## Student

### join (`/campus/join`)
| # | Difference | Verdict |
|---|---|---|
| 42 | What the college sees, what stays private, three checkboxes, join button | SAME. Consent wording and `CONSENT_VERSION` untouched |

### me (`/campus/me`)
| # | Difference | Verdict |
|---|---|---|
| 43 | "Assigned to you" at the top of the page | MISSING (mounts the existing `AssignedToYou`, which also lists programmes) |
| 44 | My readiness with a ring | MISSING (ring added; components and "Not attempted" already the same) |
| 45 | Leaderboard with opt-in toggle | SAME |
| 46 | Programme progress and certificate | SAME once 43 is mounted (`ProgrammesBlock`) |
| 47 | "Leave college" | MISSING on this page (it is on the profile); mounts the existing section |

### start (assigned round, `/interview/new?assignment=`)
| # | Difference | Verdict |
|---|---|---|
| 48 | Recording consent before start | SAME (real is stronger: camera, audio, stored consent) |
| 49 | "What this round counts" notice before consent | SAME (`ASSIGNED_INTEGRITY_NOTICE`) |
| 50 | "Counts, never a verdict; nobody is failed automatically" | MISSING (one sentence appended to the notice; true per contract module 5) |

### room and report
| # | Difference | Verdict |
|---|---|---|
| 51 | Krivih, speaking indicator, timer, round label, camera shown never recorded, exit | SAME |
| 52 | "Next question (demo)", "Skip to report (demo)" | WRONG: demo-only |
| 53 | Report: score, strengths, missing concepts, practise next, integrity counts | SAME (`OwnIntegritySection`) |

## Platform admin

### leads (`/admin/campus/leads`)
| # | Difference | Verdict |
|---|---|---|
| 54 | "Students" column | MISSING (`approxStudents`, already on `LeadView`) |
| 55 | Per-row "Convert" opening the convert form, "Mark contacted" in the row | MISSING (row buttons; the form is the existing prefilled `ConvertForm`) |
| 56 | Convert allowance defaulting to half the students | WRONG: an invented commercial default; the allowance stays an explicit choice |
| 57 | Real: search, status filter, notes, delete, deep link, converted link | REAL HAS MORE |

### colleges (`/admin/campus`)
| # | Difference | Verdict |
|---|---|---|
| 58 | Allowance used / total as a bar | MISSING (bar plus the numbers) |
| 59 | Real: create form, status, staff and student counts, detail page | REAL HAS MORE |

### usage (`/admin/campus/usage`)
| # | Difference | Verdict |
|---|---|---|
| 60 | Interviews by round type per college | MISSING (adds `interviewsByRound` to `OrgUsageRow`) |
| 61 | Used, left in the allowance | SAME (used and allowance shown; "left" derived in the page) |
| 62 | Real: date range, AI cost, cost per interview | REAL HAS MORE |

### register (`/colleges`)
| # | Difference | Verdict |
|---|---|---|
| 63 | Hero and registration form | SAME (real adds captcha, honeypot, consent, more sections) |

## Summary

Counted per row above (63 rows): SAME 21, REAL HAS MORE 11, MISSING 25, WRONG 6 (rows 8, 12, 15,
40, 52 and 56). Build notes are appended below as each screen lands.
