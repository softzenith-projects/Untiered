#!/usr/bin/env node
/**
 * Local-only demo data for Untiered Campus, so the college portal can be clicked through on
 * your own machine: invites cannot be accepted locally (email goes through SES) and every
 * dashboard is empty until students have completed work. See docs/guides/campus-local-testing.md.
 *
 * Usage (from the repo root; your local Supabase must be running and migrated):
 *
 *   npm run campus:seed-demo -- --yes --staff you@gmail.com
 *   npm run campus:seed-demo -- --yes --staff you@gmail.com:tpo --staff other@gmail.com:faculty --student me2@gmail.com
 *   npm run campus:seed-demo -- --yes --reset
 *
 *   --staff <email>[:role]   link an EXISTING local account as staff (tpo | college_admin | faculty,
 *                            default tpo). Repeatable. Sign in once first so the account exists.
 *   --student <email>        link an EXISTING local account as a student of "CSE 2027". Repeatable.
 *   --reset                  delete the demo college and everything tagged as demo, then stop.
 *   --yes                    required: confirms the printed target.
 *
 * Re-running replaces the demo data (idempotent). Everything is tagged so --reset removes exactly
 * what this script made: the organisation with slug `demo-engineering-college-demo`, the synthetic
 * users `demo-student-NN@example.invalid`, demo leads `demo-lead-N@example.invalid`, and the demo
 * programme template. Linked real accounts are never deleted, only their demo memberships go.
 *
 * Safety: refuses unless DATABASE_URL points at localhost / 127.0.0.1 (default: the Supabase CLI's
 * local port 54322). It reads no password: SQL runs through `docker exec ... psql` inside the
 * container that publishes the DB port. No AI is called. The scores are SYNTHETIC demo numbers,
 * not real interviews.
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export const DEMO_SLUG = "demo-engineering-college-demo";
export const DEMO_ORG_NAME = "Demo Engineering College (demo data)";
const STUDENT_EMAIL = (n) => `demo-student-${String(n).padStart(2, "0")}@example.invalid`;
const LEAD_EMAIL = (n) => `demo-lead-${n}@example.invalid`;
const TEMPLATE_TITLE = "Placement Starter, 3 weeks (demo data)";
const STAFF_ROLES = ["tpo", "college_admin", "faculty"];
const DAY = 86_400_000;

// ---------------------------------------------------------------------------------------
// Arguments and target
// ---------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const out = { yes: false, reset: false, staff: [], students: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes") out.yes = true;
    else if (a === "--reset") out.reset = true;
    else if (a === "--staff" || a === "--student") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${a} needs a value.`);
      if (a === "--student") out.students.push(v.trim().toLowerCase());
      else {
        const [email, role = "tpo"] = v.trim().split(":");
        if (!STAFF_ROLES.includes(role)) throw new Error(`Unknown staff role "${role}". Use ${STAFF_ROLES.join(", ")}.`);
        out.staff.push({ email: email.toLowerCase(), role });
      }
    } else throw new Error(`Unknown argument ${a}.`);
  }
  const all = [...out.staff.map((s) => s.email), ...out.students];
  if (new Set(all).size !== all.length) throw new Error("An email can be linked only once (as staff or as a student).");
  return out;
}

/** host, port, database of a jdbc: or postgres: URL. Never keeps credentials. */
export function parseTarget(url) {
  const cleaned = url.replace(/^jdbc:/, "");
  let u;
  try {
    u = new URL(cleaned);
  } catch {
    throw new Error("DATABASE_URL is not a URL this script understands.");
  }
  return { host: u.hostname.replace(/^\[|\]$/g, ""), port: u.port || "5432", db: u.pathname.replace(/^\//, "") || "postgres" };
}

export function isLocalHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function findContainer(port) {
  const rows = execFileSync("docker", ["ps", "--format", "{{.Names}}\t{{.Ports}}"], { encoding: "utf8" }).trim().split("\n");
  for (const row of rows) {
    const [name, ports = ""] = row.split("\t");
    if (new RegExp(`:${port}->5432/tcp`).test(ports)) return name;
  }
  throw new Error(`No running Docker container publishes port ${port}. Is your local Supabase running (npm run db:start)?`);
}

function makeRunner(container, db, user) {
  return (sql) =>
    execFileSync("docker", ["exec", "-i", container, "psql", "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-q", "-At", "-f", "-"], {
      input: sql,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
}

// ---------------------------------------------------------------------------------------
// SQL helpers and a deterministic random source
// ---------------------------------------------------------------------------------------

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replaceAll("'", "''")}'`);
const ts = (d) => `'${new Date(d).toISOString()}'::timestamptz`;
const uuid = () => randomUUID();

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RESET_SQL = `
delete from public.organisations where slug = ${q(DEMO_SLUG)};
delete from public.campus_leads where email like 'demo-lead-%@example.invalid';
delete from public.programme_templates where title = ${q(TEMPLATE_TITLE)};
delete from auth.users where email like 'demo-student-%@example.invalid';
`;

export const COUNT_SQL = `
select 'orgs', count(*) from public.organisations where slug = ${q(DEMO_SLUG)}
union all select 'users', count(*) from auth.users where email like 'demo-student-%@example.invalid'
union all select 'public_users', count(*) from public.users where email like 'demo-student-%@example.invalid'
union all select 'leads', count(*) from public.campus_leads where email like 'demo-lead-%@example.invalid'
union all select 'templates', count(*) from public.programme_templates where title = ${q(TEMPLATE_TITLE)}
union all select 'members', count(*) from public.org_members m join public.organisations o on o.id = m.org_id where o.slug = ${q(DEMO_SLUG)}
union all select 'assignments', count(*) from public.assignments a join public.organisations o on o.id = a.org_id where o.slug = ${q(DEMO_SLUG)}
union all select 'attempts', count(*) from public.assignment_attempts a join public.organisations o on o.id = a.org_id where o.slug = ${q(DEMO_SLUG)}
union all select 'reports', count(*) from public.session_reports r join auth.users u on u.id = r.user_id where u.email like 'demo-student-%@example.invalid'
union all select 'sessions', count(*) from public.sessions s join auth.users u on u.id = s.user_id where u.email like 'demo-student-%@example.invalid'
union all select 'answers', count(*) from public.user_step_answers s join auth.users u on u.id = s.user_id where u.email like 'demo-student-%@example.invalid';
`;

// ---------------------------------------------------------------------------------------
// The data
// ---------------------------------------------------------------------------------------

const DEPARTMENTS = [
  ["CSE", "Computer Science and Engineering"],
  ["ECE", "Electronics and Communication Engineering"],
  ["IT", "Information Technology"],
];
// [name, dept code, graduation year, students, ability bias]
const BATCHES = [
  ["CSE 2026", "CSE", 2026, 12, 3],
  ["CSE 2027", "CSE", 2027, 20, 5],
  ["ECE 2027", "ECE", 2027, 14, -4],
  ["IT 2027", "IT", 2027, 14, 0],
];
const BIAS_KEYS = ["coding", "core_cs", "technical_interview", "communication", "aptitude"];
const COMPETENCY_NAMES = {
  technical_fundamentals: ["Core concepts", "Problem solving", "Explaining trade-offs", "Accuracy", "Depth of understanding"],
  project_deep_dive: ["Ownership of the project", "Technical depth", "Design decisions", "Explaining clearly", "Handling follow-ups"],
  coding_practical: ["Approach", "Correctness", "Complexity analysis", "Code clarity", "Testing mindset"],
  aptitude: ["Quantitative reasoning", "Logical reasoning", "Speed and accuracy", "Working shown", "Estimation"],
  hr_fit_closing: ["Self-introduction", "Motivation", "Structure of answers", "Clarity of speech", "Handling a hard question"],
  behavioural_competency: ["Teamwork examples", "Ownership", "Structure of answers", "Reflection", "Clarity of speech"],
  custom_topic: ["Core concepts", "Applying the topic", "Explaining clearly", "Accuracy", "Handling follow-ups"],
};
const ROUND_LABEL = {
  technical_fundamentals: "Technical fundamentals",
  project_deep_dive: "Project deep dive",
  coding_practical: "Coding and practical",
  aptitude: "Aptitude",
  hr_fit_closing: "HR and fit",
  behavioural_competency: "Behavioural",
  custom_topic: "Custom topic",
};

/** Percentage -> a report payload the real code paths (ReportScore, ReportService.storedReport) read. */
function reportPayload(sessionId, roundType, focusTopic, pct, assessable, rng, completedAt, roundLabel) {
  const names = COMPETENCY_NAMES[roundType];
  const competencies = names.map((name) => {
    const score = Math.max(1, Math.min(5, Math.round((pct / 20) + (rng() - 0.5) * 1.6)));
    return {
      competency: name,
      score,
      maxScore: 5,
      rationale: "Synthetic demo data: this score was generated by the demo seed, not assessed from an interview.",
      evidenceQuote: "[Demo data: no real transcript exists for this score]",
      turnIndex: null,
    };
  });
  return {
    sessionId,
    companyName: "Demo Engineering College",
    roleTitle: "Software Engineer",
    roundType,
    roundLabel,
    focusTopic: roundType === "custom_topic" ? focusTopic : null,
    archetypeLabel: "Service-based IT",
    answeredTurns: assessable + 1,
    assessableTurns: assessable,
    generatedAt: new Date(completedAt).toISOString(),
    headline: "Demo report (synthetic data)",
    summary: "This report was generated by the local demo seed so the college dashboards have data. It is not the result of a real interview.",
    assistance: { totalAnswers: assessable + 1, unaidedAnswers: assessable + 1, assistedAnswers: 0, headline: "No assistance recorded (demo).", narrative: null, breakdown: [], moments: [] },
    competencies,
    annotations: [],
    communication: { structure: "Demo data.", fillerDensity: "Demo data.", pace: "Demo data.", rambling: "Demo data.", handlingUncertainty: "Demo data.", presence: null },
    strengths: [],
    developmentAreas: [],
    questionSources: { entries: [], employerRecognised: false, archetypeLabel: "", headline: "", disclosure: "" },
    practicePlan: [{ focus: "Demo practice item", why: "Placeholder in synthetic demo data.", drill: "Nothing to do: this is demo data." }],
    recommendedNextSession: "Demo data: no recommendation.",
    outcomeSimulation: { label: "Demo", likelihood: "n/a", reasoning: "Synthetic demo data." },
  };
}

/**
 * Builds the whole seed as one SQL transaction.
 * `live` is [{id, steps: [{id, correct, options: [id]}]}] of live Arena scenarios.
 */
export function buildSeedSql({ staff, students: linkedStudents, live, now = Date.now(), seed = 20261114 }) {
  const rng = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const normal = () => (rng() + rng() + rng() - 1.5) * 2;
  const sql = [];
  const orgId = uuid();
  const firstStaff = staff.find((s) => s.role !== "faculty") ?? null;
  const authorMemberId = firstStaff ? uuid() : null;

  sql.push("begin;", RESET_SQL);

  // --- college ------------------------------------------------------------------------------
  sql.push(`insert into public.organisations (id, name, slug, city, state, contact_name, contact_email, interview_allowance)
    values (${q(orgId)}, ${q(DEMO_ORG_NAME)}, ${q(DEMO_SLUG)}, 'Pune', 'Maharashtra', 'Demo TPO', 'demo-tpo@example.invalid', 500);`);

  const deptId = {};
  for (const [code, name] of DEPARTMENTS) {
    deptId[code] = uuid();
    sql.push(`insert into public.org_departments (id, org_id, code, name) values (${q(deptId[code])}, ${q(orgId)}, ${q(code)}, ${q(name)});`);
  }
  const batches = BATCHES.map(([name, dept, year, count, bias]) => ({ id: uuid(), name, dept, year, count, bias }));
  for (const b of batches) {
    sql.push(`insert into public.org_batches (id, org_id, department_id, graduation_year, name)
      values (${q(b.id)}, ${q(orgId)}, ${q(deptId[b.dept])}, ${b.year}, ${q(b.name)});`);
  }
  const cse27 = batches.find((b) => b.name === "CSE 2027");
  const it27 = batches.find((b) => b.name === "IT 2027");

  // --- staff (existing accounts) ---------------------------------------------------------------
  staff.forEach((s, i) => {
    const memberId = s === firstStaff ? authorMemberId : uuid();
    s.memberId = memberId;
    sql.push(`insert into public.org_members (id, org_id, user_id, role) values (${q(memberId)}, ${q(orgId)}, ${q(s.userId)}, ${q(s.role)});`);
    if (s.role === "faculty") {
      sql.push(`insert into public.org_faculty_scopes (org_id, member_id, department_id) values (${q(orgId)}, ${q(memberId)}, ${q(deptId.CSE)});`);
      sql.push(`insert into public.org_faculty_scopes (org_id, member_id, batch_id) values (${q(orgId)}, ${q(memberId)}, ${q(it27.id)});`);
    }
  });

  // --- synthetic students ----------------------------------------------------------------------
  // Profiles: spread so every readiness band, the attention list and the leaderboard have rows.
  const profiles = [
    ...Array(6).fill("strong"),
    ...Array(15).fill("ready"),
    ...Array(18).fill("improving"),
    ...Array(11).fill("weak"),
    ...Array(4).fill("none"),
    ...Array(6).fill("dormant"),
  ];
  for (let i = profiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
  }
  const range = (lo, hi) => lo + rng() * (hi - lo);
  const abilityOf = {
    strong: () => range(84, 94),
    ready: () => range(70, 83),
    improving: () => range(52, 69),
    weak: () => range(28, 49),
    none: () => range(40, 80),
    dormant: () => range(40, 75),
  };
  const engagementOf = { strong: 0.95, ready: 0.9, improving: 0.8, weak: 0.6, none: 0, dormant: 0.9 };

  const students = [];
  let n = 0;
  for (const b of batches) {
    for (let k = 0; k < b.count; k++) {
      n++;
      const profile = profiles[n - 1];
      const bias = {};
      for (const key of BIAS_KEYS) bias[key] = (rng() - 0.5) * 20;
      students.push({
        n,
        batch: b,
        userId: uuid(),
        memberId: uuid(),
        profile,
        ability: abilityOf[profile]() + b.bias,
        engagement: engagementOf[profile],
        bias,
        roll: `DEMO-${b.dept}${String(b.year).slice(2)}-${String(n).padStart(3, "0")}`,
        optIn: rng() < 0.4,
      });
    }
  }
  for (const s of students) {
    const email = STUDENT_EMAIL(s.n);
    const name = `Demo Student ${String(s.n).padStart(2, "0")}`;
    s.name = name;
    sql.push(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
      values (${q(s.userId)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${q(email)}, '', now(), now(), now());`);
    sql.push(`insert into public.users (id, email, display_name) values (${q(s.userId)}, ${q(email)}, ${q(name)})
      on conflict (id) do update set display_name = excluded.display_name;`);
    sql.push(`insert into public.org_members (id, org_id, user_id, role, batch_id, roll_number, consent_version, consented_at, joined_at, leaderboard_opt_in)
      values (${q(s.memberId)}, ${q(orgId)}, ${q(s.userId)}, 'student', ${q(s.batch.id)}, ${q(s.roll)}, 'demo', now(), ${ts(now - 60 * DAY)}, ${s.optIn});`);
  }
  // Linked real accounts as students: joined, no synthetic work, so they see assignments to take.
  linkedStudents.forEach((l, i) => {
    sql.push(`insert into public.org_members (id, org_id, user_id, role, batch_id, roll_number, consent_version, consented_at)
      values (${q(uuid())}, ${q(orgId)}, ${q(l.userId)}, 'student', ${q(cse27.id)}, ${q(`DEMO-LINKED-${String(i + 1).padStart(2, "0")}`)}, 'demo', now());`);
  });

  // --- invites ------------------------------------------------------------------------------------
  const invite = (n2, role, batch, status, name) =>
    sql.push(`insert into public.campus_invites (org_id, role, batch_id, email, full_name, status, joined_at, expires_at, send_status, last_sent_at, created_at)
      values (${q(orgId)}, ${q(role)}, ${batch ? q(batch.id) : "null"}, ${q(`demo-invite-${n2}@example.invalid`)}, ${q(name)}, ${q(status)},
              ${status === "joined" ? "now()" : "null"}, ${status === "expired" ? "now() - interval '3 days'" : "now() + interval '10 days'"},
              'sent', now() - interval '2 days', now() - interval '2 days');`);
  invite(1, "student", cse27, "invited", "Demo Invitee 01");
  invite(2, "student", cse27, "invited", "Demo Invitee 02");
  invite(3, "student", batches[2], "invited", "Demo Invitee 03");
  invite(4, "student", it27, "invited", "Demo Invitee 04");
  invite(5, "faculty", null, "invited", "Demo Faculty Invitee");
  invite(6, "student", it27, "expired", "Demo Invitee 06");

  // --- assignments -------------------------------------------------------------------------------------
  const allBatchIds = batches.map((b) => b.id);
  const scenarioPool = [...live];
  const takeScenarios = (count) => scenarioPool.splice(0, Math.min(count, scenarioPool.length)).map((s) => s.id);
  const sc1 = takeScenarios(2);
  const sc2 = takeScenarios(1);
  const sc3 = takeScenarios(1);
  const week = 7 * DAY;
  const programmeStart = new Date(now - 18 * DAY);
  const programmeStartOn = programmeStart.toISOString().slice(0, 10);
  const programmeOpens = (w) => Date.parse(`${programmeStartOn}T09:00:00+05:30`) + (w - 1) * week;

  /** kind, title, ... ; opens/due in ms. */
  const defs = [
    { title: "DBMS fundamentals round", kind: "interview", round: "technical_fundamentals", dur: 45, comp: "core_cs", topic: "dbms", opens: now - 8 * week, due: now - 6 * week, targets: allBatchIds, limit: 2, retake: 0.25 },
    { title: "Coding and practical round", kind: "interview", round: "coding_practical", dur: 60, comp: "coding", topic: "dsa", opens: now - 7 * week, due: now - 5 * week, targets: [batches[0].id, cse27.id, it27.id], limit: 1 },
    { title: "Project deep dive", kind: "interview", round: "project_deep_dive", dur: 45, comp: "technical_interview", topic: null, opens: now - 6 * week, due: now - 4 * week, targets: allBatchIds, limit: 1 },
    { title: "HR and fit round", kind: "interview", round: "hr_fit_closing", dur: 30, comp: "communication", topic: "communication", opens: now - 5 * week, due: now - 3 * week, targets: allBatchIds, limit: 1 },
    { title: "Aptitude practice round", kind: "interview", round: "aptitude", dur: 30, comp: "aptitude", topic: "aptitude", opens: now - 4 * week, due: now - 2 * week, targets: allBatchIds, limit: 1 },
    { title: "Operating systems deep dive", kind: "interview", round: "custom_topic", dur: 30, focus: "Operating systems", comp: "core_cs", topic: "os", opens: now - 3 * week, due: now - 1 * week, targets: [cse27.id, batches[2].id, it27.id], limit: 1 },
    sc1.length && { title: "Arena: concurrency and DSA scenarios", kind: "arena_scenarios", scenarios: sc1, comp: "coding", topic: "dsa", opens: now - 4 * week, due: now - 1 * week, targets: allBatchIds, limit: 1 },
    { title: "OOPs round (this week)", kind: "interview", round: "technical_fundamentals", dur: 30, comp: "core_cs", topic: "oops", opens: now - 5 * DAY, due: now + 9 * DAY, targets: allBatchIds, limit: 1, openNow: true },
    sc2.length && { title: "Arena: design scenario (open)", kind: "arena_scenarios", scenarios: sc2, comp: "technical_interview", topic: "system_design", opens: now - 3 * DAY, due: now + 11 * DAY, targets: allBatchIds, limit: 1, openNow: true },
    // Programme, three weekly modules, for CSE 2027 and IT 2027.
    { title: "Programme week 1: DBMS warm-up", kind: "interview", round: "technical_fundamentals", dur: 30, comp: "core_cs", topic: "dbms", opens: programmeOpens(1), due: programmeOpens(1) + week, targets: [cse27.id, it27.id], limit: 1, programmeWeek: 1 },
    sc3.length && { title: "Programme week 2: Arena scenario", kind: "arena_scenarios", scenarios: sc3, comp: "core_cs", topic: "os", opens: programmeOpens(2), due: programmeOpens(2) + week, targets: [cse27.id, it27.id], limit: 1, programmeWeek: 2 },
    { title: "Programme week 3: behavioural round", kind: "interview", round: "behavioural_competency", dur: 30, comp: "communication", topic: "communication", opens: programmeOpens(3), due: programmeOpens(3) + week, targets: [cse27.id, it27.id], limit: 1, programmeWeek: 3 },
  ].filter(Boolean);

  // Programme template and the programme run from it.
  const templateId = uuid();
  const programmeId = uuid();
  const tplModules = defs
    .filter((d) => d.programmeWeek)
    .map((d) =>
      d.kind === "interview"
        ? { week: d.programmeWeek, assignment: { kind: "interview", title: d.title.replace(/^Programme week \d: /, ""), roundType: d.round, durationMinutes: d.dur, candidateStage: "student", language: "english", allowLate: false, attemptLimit: 1, component: d.comp, topic: d.topic } }
        : { week: d.programmeWeek, assignment: { kind: "arena_scenarios", title: d.title.replace(/^Programme week \d: /, ""), scenarioIds: d.scenarios, allowLate: false, attemptLimit: 1, component: d.comp, topic: d.topic } },
    );
  sql.push(`insert into public.programme_templates (id, title, description, weeks, modules)
    values (${q(templateId)}, ${q(TEMPLATE_TITLE)}, 'A three-week starter programme, created by the local demo seed.', 3, ${q(JSON.stringify(tplModules))}::jsonb);`);
  sql.push(`insert into public.programmes (id, org_id, template_id, title, starts_on, weeks, created_by_member_id)
    values (${q(programmeId)}, ${q(orgId)}, ${q(templateId)}, 'Placement Starter (demo run)', ${q(programmeStartOn)}, 3, ${authorMemberId ? q(authorMemberId) : "null"});`);
  for (const b of [cse27, it27]) {
    sql.push(`insert into public.programme_targets (org_id, programme_id, batch_id) values (${q(orgId)}, ${q(programmeId)}, ${q(b.id)});`);
  }

  for (const d of defs) {
    d.id = uuid();
    const interview = d.kind === "interview";
    sql.push(`insert into public.assignments (id, org_id, created_by_member_id, kind, title, instructions, round_type, duration_minutes, role_title, candidate_stage,
        focus_topic, scenario_ids, opens_at, due_at, attempt_limit, interview_cap, readiness_component, topic, status, published_at, programme_id, programme_week)
      values (${q(d.id)}, ${q(orgId)}, ${authorMemberId ? q(authorMemberId) : "null"}, ${q(d.kind)}, ${q(d.title)},
        ${q("Demo assignment created by the local seed.")}, ${interview ? q(d.round) : "null"}, ${interview ? d.dur : "null"},
        ${interview ? "'Software Engineer'" : "null"}, ${interview ? "'student'" : "null"}, ${d.focus ? q(d.focus) : "null"},
        ${interview ? "null" : `array[${d.scenarios.map(q).join(",")}]::text[]`}, ${ts(d.opens)}, ${ts(d.due)}, ${d.limit}, ${interview ? 1 : "null"},
        ${q(d.comp)}, ${d.topic ? q(d.topic) : "null"}, 'published', ${ts(d.opens)},
        ${d.programmeWeek ? q(programmeId) : "null"}, ${d.programmeWeek ?? "null"});`);
    for (const batchId of d.targets) {
      sql.push(`insert into public.assignment_targets (org_id, assignment_id, batch_id) values (${q(orgId)}, ${q(d.id)}, ${q(batchId)});`);
    }
  }
  // A draft nobody can see yet.
  sql.push(`insert into public.assignments (org_id, created_by_member_id, kind, title, round_type, duration_minutes, candidate_stage, due_at, readiness_component, status)
    values (${q(orgId)}, ${authorMemberId ? q(authorMemberId) : "null"}, 'interview', 'Mock HR round (draft)', 'hr_fit_closing', 30, 'student', ${ts(now + 20 * DAY)}, 'communication', 'draft');`);

  // --- work done -----------------------------------------------------------------------------------------
  const stepsByScenario = new Map(live.map((s) => [s.id, s.steps]));
  const sessionsForNotes = [];
  for (const s of students) {
    if (s.profile === "none") continue;
    const dormantCutoff = now - 22 * DAY;
    for (const d of defs) {
      if (!d.targets.includes(s.batch.id)) continue;
      if (s.profile === "dormant" && d.due > dormantCutoff) continue;
      const open = d.openNow ? 0.55 : 1;
      if (rng() > s.engagement * open) continue;
      const windowEnd = Math.min(d.due - 3600_000, now - 3600_000);
      if (windowEnd <= d.opens + 3600_000) continue;
      const completedAt = d.opens + (windowEnd - d.opens) * Math.pow(rng(), 0.7);
      const weeksAgo = (now - completedAt) / week;
      const pct = Math.max(12, Math.min(99, s.ability + (s.bias[d.comp] ?? 0) + normal() * 9 + (4 - weeksAgo) * 1.1));

      if (d.kind === "arena_scenarios") {
        const steps = d.scenarios.flatMap((id) => stepsByScenario.get(id) ?? []);
        const partial = d.openNow && rng() < 0.4;
        const take = partial ? Math.max(1, Math.floor(steps.length / 2)) : steps.length;
        steps.slice(0, take).forEach((step, i) => {
          const correct = rng() * 100 < pct;
          const chosen = correct ? step.correct : (step.options.find((o) => o !== step.correct) ?? "demo-wrong");
          sql.push(`insert into public.user_step_answers (user_id, step_id, chosen_option_id, is_correct, answered_at)
            values (${q(s.userId)}, ${q(step.id)}, ${q(chosen)}, ${correct}, ${ts(completedAt - (take - i) * 90_000)});`);
        });
        continue;
      }

      const attempts = d.retake && rng() < d.retake ? 2 : 1;
      for (let a = 0; a < attempts; a++) {
        const at = a === 0 ? completedAt : Math.min(windowEnd, completedAt + (1 + rng() * 4) * DAY);
        const score = a === 0 ? pct : Math.min(99, pct + 3 + rng() * 8);
        if (d.openNow && a === 0 && rng() < 0.15) {
          sql.push(`insert into public.assignment_attempts (org_id, assignment_id, member_id, org_funded, status, started_at)
            values (${q(orgId)}, ${q(d.id)}, ${q(s.memberId)}, true, 'in_progress', ${ts(now - 2 * 3600_000)});`);
          break;
        }
        const sessionId = uuid();
        const started = at - d.dur * 60_000;
        const assessable = 4 + Math.floor(rng() * 5);
        const payload = reportPayload(sessionId, d.round, d.focus, score, assessable, rng, at, ROUND_LABEL[d.round]);
        sql.push(`insert into public.sessions (id, user_id, company_name, company_archetype, role_title, round_type, language, status, started_at, ended_at,
            created_at, consent_audio_at, duration_minutes, focus_topic, stated_level)
          values (${q(sessionId)}, ${q(s.userId)}, 'Demo Engineering College', 'service_based_it', 'Software Engineer', ${q(d.round)}, 'english', 'completed',
            ${ts(started)}, ${ts(at)}, ${ts(started)}, ${ts(started)}, ${d.dur}, ${d.focus ? q(d.focus) : "null"}, 'student');`);
        sql.push(`insert into public.session_reports (session_id, user_id, payload, generated_at)
          values (${q(sessionId)}, ${q(s.userId)}, ${q(JSON.stringify(payload))}::jsonb, ${ts(at)});`);
        sql.push(`insert into public.assignment_attempts (org_id, assignment_id, member_id, session_id, org_funded, status, started_at, ended_at)
          values (${q(orgId)}, ${q(d.id)}, ${q(s.memberId)}, ${q(sessionId)}, true, 'completed', ${ts(started)}, ${ts(at)});`);
        const roll = rng();
        if (roll < 0.04) {
          sql.push(`insert into public.session_integrity (session_id, user_id, tab_hidden, window_blur, pastes, pasted_chars)
            values (${q(sessionId)}, ${q(s.userId)}, ${8 + Math.floor(rng() * 10)}, ${6 + Math.floor(rng() * 8)}, ${2 + Math.floor(rng() * 3)}, ${900 + Math.floor(rng() * 1500)});`);
        } else if (roll < 0.22) {
          sql.push(`insert into public.session_integrity (session_id, user_id, tab_hidden, window_blur, pastes, pasted_chars)
            values (${q(sessionId)}, ${q(s.userId)}, ${Math.floor(rng() * 3)}, ${Math.floor(rng() * 3)}, 0, 0);`);
        }
        sessionsForNotes.push({ s, sessionId });
      }
    }
  }

  // --- staff notes ------------------------------------------------------------------------------------------
  if (authorMemberId) {
    const noteTargets = students.filter((s) => s.profile === "weak").slice(0, 2);
    const strong = students.find((s) => s.profile === "strong");
    const notes = [
      [noteTargets[0], "Demo note: struggled with DBMS joins. Suggest the normalisation scenarios before the next round."],
      [noteTargets[1], "Demo note: spoke to the TPO about attendance; will retake the aptitude round."],
      [strong, "Demo note: good candidate for the product-company shortlist."],
    ];
    for (const [stu, body] of notes) {
      if (!stu) continue;
      const withSession = sessionsForNotes.find((x) => x.s === stu);
      sql.push(`insert into public.campus_staff_comments (org_id, member_id, session_id, author_member_id, body)
        values (${q(orgId)}, ${q(stu.memberId)}, ${withSession ? q(withSession.sessionId) : "null"}, ${q(authorMemberId)}, ${q(body)});`);
    }
  }

  // --- leads ----------------------------------------------------------------------------------------------------
  sql.push(`insert into public.campus_leads (status, college_name, city, state, contact_name, contact_role, email, phone, approx_students, message, consented_at)
    values ('new', 'Demo Institute of Technology (demo lead)', 'Nagpur', 'Maharashtra', 'Demo Contact', 'tpo', ${q(LEAD_EMAIL(1))}, '+91 90000 00001', 900,
            'Demo lead created by the local seed.', now() - interval '1 day');`);
  sql.push(`insert into public.campus_leads (status, college_name, city, state, contact_name, contact_role, email, approx_students, notes, consented_at, status_changed_at)
    values ('contacted', 'Demo College of Engineering (demo lead)', 'Jaipur', 'Rajasthan', 'Demo Contact Two', 'faculty', ${q(LEAD_EMAIL(2))}, 400,
            'Demo lead: called once, sent the overview.', now() - interval '6 days', now() - interval '3 days');`);

  sql.push("commit;");
  return sql.join("\n");
}

// ---------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL || "jdbc:postgresql://localhost:54322/postgres";
  const target = parseTarget(url);
  if (!isLocalHost(target.host)) {
    console.error(`Refusing to run: the target database host is "${target.host}", not localhost/127.0.0.1. This script only seeds a local database.`);
    process.exit(1);
  }
  console.log(`Target database: ${target.host}:${target.port}/${target.db}`);
  if (!args.yes) {
    console.error("Add --yes to confirm that this is the local database you want to seed (or reset).");
    process.exit(1);
  }
  const run = makeRunner(findContainer(target.port), target.db, process.env.DATABASE_USER || "postgres");

  if (args.reset) {
    run(`begin;${RESET_SQL}commit;`);
    console.log("Demo data removed.");
    return;
  }

  const emails = [...args.staff.map((s) => s.email), ...args.students];
  const found = new Map();
  if (emails.length) {
    const out = run(`select id, lower(email) from public.users where lower(email) in (${emails.map(q).join(",")});`);
    for (const line of out.trim().split("\n").filter(Boolean)) {
      const [id, email] = line.split("|");
      found.set(email, id);
    }
    const missing = emails.filter((e) => !found.has(e));
    if (missing.length) {
      console.error(`No local account for: ${missing.join(", ")}. Sign in once with each (Google, in the running app) so the account exists, then re-run.`);
      process.exit(1);
    }
    const taken = run(
      `select u.email from public.org_members m join public.users u on u.id = m.user_id join public.organisations o on o.id = m.org_id
        where m.role = 'student' and m.status = 'joined' and o.slug <> ${q(DEMO_SLUG)} and u.id in (${args.students.map((e) => q(found.get(e))).join(",") || "null"});`,
    ).trim();
    if (taken) {
      console.error(`These accounts are already students of another college, and an account can be a student of only one: ${taken.split("\n").join(", ")}.`);
      process.exit(1);
    }
  }

  const live = loadLiveScenarios(run);
  const sql = buildSeedSql({
    staff: args.staff.map((s) => ({ ...s, userId: found.get(s.email) })),
    students: args.students.map((e) => ({ email: e, userId: found.get(e) })),
    live,
  });
  run(sql);
  console.log(run(COUNT_SQL).trim().split("\n").map((l) => l.replace("|", ": ")).join("\n"));
  console.log("\nDemo data is in place. See docs/guides/campus-local-testing.md for where to click. These scores are synthetic.");
  if (!args.staff.length) console.log("No --staff given: nobody can open the college portal yet. Re-run with --staff <your email>.");
}

function loadLiveScenarios(run) {
  const out = run(`select s.id, st.id, st.correct_option_id, st.options::text
      from public.arena_scenarios s join public.arena_scenario_steps st on st.scenario_id = s.id
     where s.status = 'live' order by s.id, st.position;`);
  const byScenario = new Map();
  for (const line of out.trim().split("\n").filter(Boolean)) {
    const [sid, stepId, correct, options] = line.split("|");
    let ids = [];
    try {
      ids = JSON.parse(options).map((o) => o.id).filter(Boolean);
    } catch {
      // Options without ids: the wrong answer falls back to a placeholder.
    }
    if (!byScenario.has(sid)) byScenario.set(sid, []);
    byScenario.get(sid).push({ id: stepId, correct, options: ids });
  }
  const live = [...byScenario].map(([id, steps]) => ({ id, steps }));
  if (live.length < 4) console.warn(`Only ${live.length} live Arena scenarios found: some scenario assignments will be skipped.`);
  return live;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/").split("/").pop())) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
