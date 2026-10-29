"use client";

import type { CandidateStage, EntitlementView, RoundDraft, RoundType } from "@untiered/shared";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, CONTROL_CLASS, Input, Radio } from "@/components/ui/field";
import { DailyLimitNotice, isDailyLimitReached } from "@/components/daily-limit-notice";
import { LoopBriefStep } from "@/components/loop-brief-step";
import { ApiRequestError, composeRound, fetchEntitlement, startSession } from "@/lib/api";
import { loadVoices, pickVoice } from "@/lib/browser-speech";
import { ROUND_CATALOGUE } from "@/lib/rounds";
import { useAccessToken } from "@/lib/use-access-token";


/**
 * Short, neutral starting points: a role and an employer, nothing more. Long first-person
 * sentences ("I always fumble the escalation questions") read as if they were somebody
 * else's round, and every candidate saw the same four. One product company, one more, a
 * service firm and a Big Four firm still show the range without telling a story.
 */
const EXAMPLES = [
  "SDE 1 at Amazon",
  "Software Engineer at Microsoft",
  "Systems Engineer at Infosys",
  "Analyst at Deloitte",
];

/**
 * Setting up a round.
 *
 * The composer comes first because a candidate knows what they are walking into as a
 * sentence, not as four fields: "Infosys MR round next Tuesday" is how they think about
 * it, and making them decompose that into company, role, round type and duration is work
 * we can do for them.
 *
 * The draft is always shown back before anything starts. A setup that quietly guessed
 * wrong would waste the round — the wrong employer means the wrong rubric, and they find
 * out half an hour in — so the model proposes and the candidate confirms, with everything
 * it assumed listed where they can see it.
 *
 * Company and role are still named per session and nothing is stored as a target
 * (PRD 05). The composer changes how they are typed, not what is kept.
 */
export function NewInterviewForm({
  initialRoundType,
  initialTopic = "",
  roundPreselected = false,
  initialCompany = "",
  initialRole = "",
}: {
  initialRoundType?: RoundType;
  initialTopic?: string;
  roundPreselected?: boolean;
  /** Filled in from a dashboard quick start; the candidate can still change both. */
  initialCompany?: string;
  initialRole?: string;
}) {
  const router = useRouter();
  const accessToken = useAccessToken();
  const topic = initialTopic.trim();

  const [query, setQuery] = useState("");
  const [structuredCompany, setStructuredCompany] = useState(initialCompany);
  const [structuredRole, setStructuredRole] = useState(initialRole);
  const [structuredRound, setStructuredRound] = useState<RoundType>(
    initialRoundType ?? "coding_practical",
  );
  const [draft, setDraft] = useState<RoundDraft | null>(() =>
    topic === "" && !initialRoundType ? null : blankDraft(topic, initialRoundType),
  );
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Past the "how they interview" step, either because the candidate chose a round from
  // it or asked to skip straight to setup.
  const [pastBrief, setPastBrief] = useState(false);
  const [chosenRoundType, setChosenRoundType] = useState<RoundType | null>(null);
  // Chosen where company and role are named, optional, and empty means "as before". When it
  // is a student or graduate the brief and plan follow the campus loop, and the setup form's
  // stated stage starts from it.
  const [stage, setStage] = useState<CandidateStage | "">("");
  const campus = stage === "student" || stage === "recent_graduate";
  // Today's allowance, read once so a candidate who has used it is told before filling
  // anything in. The server enforces it either way; this only saves them the wasted form.
  const [entitlement, setEntitlement] = useState<EntitlementView | null>(null);
  // Bumped after a purchase, so the allowance is read again and the setup unlocks.
  const [entitlementRead, setEntitlementRead] = useState(0);
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchEntitlement({ accessToken })
      .then((value) => {
        if (active) setEntitlement(value);
      })
      .catch(() => {
        // Not knowing the allowance is not a reason to block setup; the start call will say.
      });
    return () => {
      active = false;
    };
  }, [accessToken, entitlementRead]);

  if (isDailyLimitReached(entitlement) && entitlement) {
    return (
      <div className="flex flex-col gap-6">
        <DailyLimitNotice entitlement={entitlement} onPurchased={() => setEntitlementRead((read) => read + 1)} />
        <a href="/dashboard" className="w-fit text-caption font-medium text-accent hover:underline">
          Back to your dashboard
        </a>
      </div>
    );
  }

  async function read(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || reading || (query.trim() === "" && !campus)) return;

    // A campus candidate often does not have a role title yet — that is the point of
    // placement season. The stage is enough to choose the campus loop, so do not make
    // them invent a job title (or spend a composer call on an empty sentence) before
    // they can reach the editable setup.
    if (query.trim() === "" && campus) {
      setError(null);
      setDraft(blankCampusDraft());
      return;
    }

    setReading(true);
    setError(null);
    try {
      setDraft(await composeRound(accessToken, query.trim()));
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "We could not read that just now. Fill the round in yourself and it starts the same way.",
      );
      setDraft(blankDraft());
    } finally {
      setReading(false);
    }
  }

  function continueStructured(event: React.FormEvent) {
    event.preventDefault();
    if (structuredRole.trim() === "" && !campus) return;
    const next = blankDraft("", structuredRound);
    const companyName = structuredCompany.trim();
    const roleTitle = structuredRole.trim();
    setQuery([companyName, roleTitle].filter(Boolean).join(" · "));
    setDraft({
      ...next,
      companyName,
      roleTitle,
      understood: roleTitle
        ? `${roleTitle}${companyName ? ` at ${companyName}` : ""}`
        : "Campus-placement practice round",
    });
    // This path is already an explicit choice of company, role and round; the brief is
    // optional context, not another gate before the consent screen.
    setPastBrief(true);
  }

  if (draft) {
    const hasCompany = draft.companyName.trim() !== "";

    const onEdit = () => {
      setDraft(null);
      setError(null);
      setPastBrief(false);
      setChosenRoundType(null);
    };

    if (!roundPreselected && hasCompany && draft.roundType !== "custom_topic" && !pastBrief) {
      return (
        <LoopBriefStep
          companyName={draft.companyName}
          roleTitle={draft.roleTitle}
          stage={stage}
          accessToken={accessToken}
          onChooseRound={(roundType) => {
            setChosenRoundType(roundType);
            setPastBrief(true);
          }}
          onSkip={() => setPastBrief(true)}
          onEdit={onEdit}
        />
      );
    }

    return (
      <RoundSetup
        draft={chosenRoundType ? { ...draft, roundType: chosenRoundType } : draft}
        query={query}
        initialStage={stage}
        error={error}
        onEdit={onEdit}
        roundPreselected={roundPreselected}
        // The brief was shown first whenever a company was recognised — that's the only
        // path into this screen with `hasCompany` true, so it's also the only case
        // "back to the brief" makes sense.
        onBackToBrief={
          !roundPreselected && hasCompany && draft.roundType !== "custom_topic"
            ? () => {
                setChosenRoundType(null);
                setPastBrief(false);
              }
            : null
        }
        onStart={(id) => router.push(`/interview/${id}`)}
        accessToken={accessToken}
        minutesLeftToday={entitlement?.remainingMinutesToday ?? null}
        creditBalance={entitlement?.creditBalance ?? 0}
        fundedByCredit={entitlement?.funding === "credit"}
      />
    );
  }

  const selectedStructuredRound = ROUND_CATALOGUE.find((round) => round.value === structuredRound);

  return (
    <div className="flex flex-col gap-10">
      <header className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center">
        <p className="eyebrow text-accent">AI mock interviews</p>
        <h1 className="text-display text-balance text-ink">Practise the interview you actually want.</h1>
        <p className="max-w-2xl text-body text-ink-muted">
          Choose the company, role and round. We will shape the interview around that context,
          then let you review the recording settings before it begins.
        </p>
      </header>

      <form onSubmit={continueStructured} className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)] lg:items-stretch">
        <div className="card flex flex-col gap-7 p-6 sm:p-8">
          <section aria-labelledby="target-context" className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-wash text-caption font-bold text-accent">1</span>
              <div>
                <h2 id="target-context" className="text-heading text-ink">Target company and role</h2>
                <p className="text-caption text-ink-muted">These tune the questions and evaluation criteria for this session.</p>
              </div>
            </div>

            {/* Side by side from `sm`: at the page grid's width one field per row ran ~700px for a name or a job title. */}
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <Field label="Company (optional)" hint="Leave this blank for employer-neutral practice.">
                  <Input
                    value={structuredCompany}
                    onChange={(event) => setStructuredCompany(event.target.value)}
                    placeholder="Amazon"
                    autoComplete="organization"
                    maxLength={120}
                  />
                </Field>
                <div className="flex flex-wrap gap-2" aria-label="Suggested companies">
                  {["Amazon", "Google", "Microsoft", "Infosys", "Deloitte"].map((company) => (
                    <button
                      key={company}
                      type="button"
                      onClick={() => setStructuredCompany(company)}
                      className="min-h-11 rounded-full border border-line bg-surface-raised px-3 py-2 text-caption text-ink-muted transition-colors hover:border-accent/40 hover:bg-accent-wash hover:text-ink"
                    >
                      {company}
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label={campus ? "Role (optional for freshers)" : "Role"}
                hint={campus ? "It is fine if campus hiring has not named a role yet." : "Use the title you are preparing to interview for."}
              >
                <Input
                  value={structuredRole}
                  onChange={(event) => setStructuredRole(event.target.value)}
                  placeholder="Software Development Engineer"
                  autoComplete="organization-title"
                  required={!campus}
                  maxLength={120}
                />
              </Field>
            </div>

            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-surface-sunken px-4 py-3 focus-within:ring-2 focus-within:ring-accent">
              <Checkbox
                checked={campus}
                onChange={(event) => setStage(event.target.checked ? "student" : "")}
                className="mt-1"
              />
              <span>
                <span className="block text-caption font-semibold text-ink">I am preparing for campus placement</span>
                <span className="block text-caption text-ink-muted">Role becomes optional and the interview starts at fresher level.</span>
              </span>
            </label>
          </section>

          <section aria-labelledby="choose-round" className="flex flex-col gap-4 border-t border-line pt-7">
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-wash text-caption font-bold text-accent">2</span>
              <div>
                <h2 id="choose-round" className="text-heading text-ink">Choose a round</h2>
                <p className="text-caption text-ink-muted">Start with the stage you need to practise now.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {STRUCTURED_ROUNDS.map((roundType, index) => {
                const round = ROUND_CATALOGUE.find((item) => item.value === roundType);
                if (!round) return null;
                const selected = structuredRound === round.value;
                return (
                  <label
                    key={round.value}
                    className={`min-h-11 cursor-pointer rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-accent ${selected ? "border-accent bg-accent-wash shadow-[var(--shadow-sm)]" : "border-line bg-surface-raised hover:border-accent/40"}`}
                  >
                    <Radio
                      name="structuredRound"
                      value={round.value}
                      checked={selected}
                      onChange={() => setStructuredRound(round.value)}
                      className="sr-only"
                    />
                    <span className="block text-micro font-semibold text-ink-subtle">0{index + 1}</span>
                    <span className="mt-4 block text-heading text-ink">{SHORT_ROUND_LABELS[round.value] ?? round.label}</span>
                    <span className="mt-1 block text-caption text-ink-muted">{round.eyebrow}</span>
                  </label>
                );
              })}
            </div>
            <Link href="/rounds" className="self-start text-caption font-semibold text-accent hover:underline">
              See every round type <span aria-hidden>→</span>
            </Link>
          </section>
        </div>

        <aside aria-live="polite" className="hero-band flex flex-col p-6 sm:p-8">
          <span aria-hidden className="grid size-14 place-items-center rounded-2xl bg-highlight text-title font-bold text-navy">
            {(structuredCompany.trim()[0] ?? structuredRole.trim()[0] ?? "U").toUpperCase()}
          </span>
          <p className="mt-7 eyebrow text-accent-on-navy">Your practice session</p>
          <h2 className="mt-3 text-title text-on-navy">{structuredRole.trim() || (campus ? "Campus placement" : "Choose your target role")}</h2>
          <p className="mt-1 text-caption text-on-navy-muted">
            {structuredCompany.trim() || "General practice"} · {selectedStructuredRound ? (SHORT_ROUND_LABELS[selectedStructuredRound.value] ?? selectedStructuredRound.label) : "Interview round"}
          </p>
          <ul className="mt-6 grid gap-3 border-y border-on-navy/15 py-6 text-caption text-on-navy-muted">
            <li><span className="mr-2 text-accent-on-navy" aria-hidden>✓</span>Adaptive follow-up questions</li>
            <li><span className="mr-2 text-accent-on-navy" aria-hidden>✓</span>Evaluation matched to your selected round</li>
            <li><span className="mr-2 text-accent-on-navy" aria-hidden>✓</span>Detailed feedback after the round</li>
          </ul>
          <div className="mt-5 rounded-xl bg-on-navy/8 p-4">
            <p className="text-caption font-semibold text-on-navy">Included in your current access</p>
            <p className="mt-1 text-caption text-on-navy-muted">
              {entitlement?.message ?? "Your practice availability is checked before the interview begins."}
            </p>
          </div>
          <Button type="submit" size="lg" className="mt-auto w-full translate-y-0">
            Continue to interview setup <span aria-hidden>→</span>
          </Button>
          <p className="mt-3 text-center text-micro text-on-navy-muted">You will confirm recording and camera choices next.</p>
        </aside>
      </form>

      <form onSubmit={read} className="flex flex-col gap-6 rounded-surface border border-line bg-surface-sunken/65 p-5 sm:p-7">
        <div className="flex flex-col gap-1">
          <p className="eyebrow text-accent">Prefer to describe it?</p>
          <h2 className="text-title text-ink">Tell us what you are walking into.</h2>
          <p className="max-w-2xl text-caption text-ink-muted">
            Use one line when the round is more specific than the choices above. We will read it,
            show back what we understood, and let you correct every field.
          </p>
        </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <label htmlFor="composer" className="sr-only">
          Describe the interview you are preparing for
        </label>
        <textarea
          id="composer"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          maxLength={600}
          required={!campus}
          placeholder={
            campus
              ? "Optional — add a company, branch, or placement round if you know it."
              : "SDE 1 at Amazon, Java backend, 2 years of experience."
          }
          className="w-full resize-none rounded-xl border border-line bg-surface px-5 py-4 text-body text-ink shadow-[var(--shadow-sm)] placeholder:text-ink-subtle transition-colors focus:border-accent focus:outline-none"
        />

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={campus}
              onChange={(event) => setStage(event.target.checked ? "student" : "")}
              className="mt-1 size-4 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-ink">
                I am a fresher preparing for campus placement
              </span>
              <span className="text-caption text-ink-muted">
                Campus loops are different: a written test, then a technical and an HR interview
                on your syllabus and projects. You can leave the interview description blank and
                choose the details on the next screen.
              </span>
            </span>
          </label>
          {campus ? (
            <label className="flex flex-col gap-1 pl-7">
              <span className="text-caption text-ink-muted">Where are you right now?</span>
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value as CandidateStage)}
                className={`${CONTROL_CLASS} sm:max-w-xs`}
              >
                <option value="student">Student, still studying</option>
                <option value="recent_graduate">Recent graduate, no job yet</option>
              </select>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={reading || (query.trim() === "" && !campus) || !accessToken}
            aria-busy={reading}
          >
            {reading
              ? "Reading that…"
              : campus && query.trim() === ""
                ? "Set up my campus round"
                : "Set up the round"}
          </Button>
          <button
            type="button"
            onClick={() => setDraft(blankDraft())}
            className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Or fill it in yourself
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-body text-danger">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="composer-examples" className="flex flex-wrap items-center gap-2">
        <p id="composer-examples" className="text-caption text-ink-muted">
          For example:
        </p>
        <ul className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                onClick={() => setQuery(example)}
                className="rounded-full border border-line bg-surface-raised px-3.5 py-1.5 text-caption text-ink-muted transition-colors hover:border-accent/40 hover:bg-accent-wash hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
      </section>
      </form>
    </div>
  );
}

/**
 * The draft, shown back for correction. Every field is editable — the model proposes and
 * the candidate decides, because they are the one who knows what they are walking into.
 */
function RoundSetup({
  draft,
  query,
  initialStage,
  error: composeError,
  onEdit,
  onBackToBrief,
  onStart,
  accessToken,
  roundPreselected,
  minutesLeftToday = null,
  creditBalance = 0,
  fundedByCredit = false,
}: {
  draft: RoundDraft;
  query: string;
  /** What was picked at the start; the stated-stage dropdown begins here and can still be changed. */
  initialStage: CandidateStage | "";
  error: string | null;
  onEdit: () => void;
  /** Null when this session never went through the loop brief, so there's nowhere to go back to. */
  onBackToBrief: (() => void) | null;
  onStart: (sessionId: string) => void;
  accessToken: string | null | undefined;
  /** True when the candidate deliberately chose this round from the rounds catalogue. */
  roundPreselected: boolean;
  /** Free minutes left today, or null when there is no daily limit (or it is unknown). */
  minutesLeftToday?: number | null;
  /** Paid interviews held. Any at all lifts the free-minutes cap on the round's length. */
  creditBalance?: number;
  /** True when the free allowance is already used, so any round started now is paid for. */
  fundedByCredit?: boolean;
}) {
  const [companyName, setCompanyName] = useState(draft.companyName);
  const [roleTitle, setRoleTitle] = useState(draft.roleTitle);
  const [roundType, setRoundType] = useState<RoundType>(draft.roundType);
  const [focusTopic, setFocusTopic] = useState(draft.focusTopic ?? "");
  const [durationMinutes, setDurationMinutes] = useState(draft.durationMinutes);
  const [language, setLanguage] = useState(draft.language);
  const [consentAudio, setConsentAudio] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  // Optional, and left blank by default: leaving it blank must behave exactly as it did
  // before this field existed, deriving the stage from the role title and resume alone.
  const [candidateStage, setCandidateStage] = useState<CandidateStage | "">(initialStage);
  /*
   * Whether this browser can read the questions out itself. Decided here because the
   * session is created here, and the opening question is synthesised as part of creating
   * it — by the time the room exists it is already too late to save the call.
   */
  const [speaksLocally, setSpeaksLocally] = useState(false);

  useEffect(() => {
    let active = true;
    void loadVoices().then((voices) => {
      if (active) setSpeaksLocally(pickVoice(voices, language) !== null);
    });
    return () => {
      active = false;
    };
  }, [language]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lengthOptions = (roundType === "custom_topic" ? CUSTOM_LENGTHS : ROUND_LENGTHS).filter(
    (option) => minutesLeftToday === null || creditBalance > 0 || option.minutes <= minutesLeftToday,
  );
  // The chosen length, kept inside what is left today: one that cannot start would only be
  // refused by the server after the candidate had filled everything in.
  const effectiveMinutes = lengthOptions.some((option) => option.minutes === durationMinutes)
    ? durationMinutes
    : (lengthOptions.at(-1)?.minutes ?? durationMinutes);
  // Mirrors the server, which spends free practice first: a credit pays only when the free
  // allowance is gone or this round is longer than the free minutes left.
  const usesCredit =
    creditBalance > 0 && (fundedByCredit || (minutesLeftToday !== null && effectiveMinutes > minutesLeftToday));
  const selectedRound = ROUND_CATALOGUE.find((item) => item.value === roundType);
  // The server keeps a focus topic only for a custom-topic round and drops it for every
  // other one, so asking for it anywhere else would collect words that go nowhere.
  const topicRequired = roundType === "custom_topic";
  const campusCandidate = candidateStage === "student" || candidateStage === "recent_graduate";
  // A custom-topic round is deliberately not preparation for one employer or job title.
  // The database still keeps a complete session context for every client, so the request
  // carries explicit neutral values rather than stale/autofilled fields the candidate
  // never chose for this round.
  const effectiveCompanyName = topicRequired ? CUSTOM_TOPIC_COMPANY : companyName.trim();
  const effectiveRoleTitle = topicRequired ? CUSTOM_TOPIC_ROLE : roleTitle.trim();

  const ready =
    (!topicRequired || focusTopic.trim() !== "") &&
    lengthOptions.length > 0 &&
    consentAudio &&
    !!accessToken;

  function selectRound(value: RoundType) {
    setRoundType(value);
    if (value === "custom_topic" && ![10, 20, 30].includes(durationMinutes)) {
      setDurationMinutes(20);
    } else if (value !== "custom_topic" && durationMinutes === 10) {
      setDurationMinutes(40);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || pending) return;

    setPending(true);
    setError(null);
    try {
      const session = await startSession(accessToken, {
        speaksLocally,
        companyName: effectiveCompanyName,
        roleTitle: effectiveRoleTitle,
        roundType,
        language,
        consentAudio,
        // Whether to open the camera, not whether to keep what it sees. Nothing from it
        // is recorded, uploaded or analysed — it is on so the candidate practises
        // being looked at, which is a benefit that never leaves their own screen.
        consentVideo: cameraOn,
        durationMinutes: effectiveMinutes,
        candidateStage: candidateStage === "" ? undefined : candidateStage,
        focusTopic: topicRequired ? focusTopic.trim() : undefined,
      });
      onStart(session.id);
    } catch (cause) {
      setPending(false);
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : "The interview could not be started. Please try again.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <header className="hero-band relative overflow-hidden p-7 sm:p-9">
        <div aria-hidden="true" className="absolute -top-20 -right-14 size-56 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex flex-col gap-3">
        <p className="pill pill-navy w-fit">
          {roundPreselected ? "Practise this round" : "Confirm your round"}
        </p>
        {onBackToBrief ? (
          <button
            type="button"
            onClick={onBackToBrief}
            className="self-start text-caption text-on-navy-muted underline-offset-4 hover:text-on-navy hover:underline"
          >
            ← Back to how {draft.companyName} interviews
          </button>
        ) : null}
        <h1 className="text-title text-balance text-on-navy">
          {roundPreselected
            ? (selectedRound?.label ?? draft.roundLabel)
            : draft.understood || "Set up your round"}
        </h1>
        {roundPreselected ? (
          <p className="max-w-2xl text-body text-on-navy-muted">
            {topicRequired
              ? "The topic is the whole scope. Choose what to practise, then agree to recording and begin."
              : "The round is chosen. Add an employer or role if you want extra tailoring, or leave both blank for general practice."}
          </p>
        ) : null}
        {!roundPreselected && query ? (
          <p className="text-caption text-on-navy-muted">
            From: &ldquo;{query}&rdquo;{" "}
            <button
              type="button"
              onClick={onEdit}
              className="text-on-navy underline-offset-4 hover:underline"
            >
              edit
            </button>
          </p>
        ) : null}
        </div>
      </header>

      {composeError ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-body text-danger">
          {composeError}
        </p>
      ) : null}

      {!roundPreselected && draft.assumptions.length > 0 ? (
        <section aria-labelledby="assumed" className="rounded-2xl border border-highlight/35 bg-highlight/10 p-5 sm:p-6">
          <h2 id="assumed" className="pb-2 font-mono text-micro tracking-widest text-ink-subtle uppercase">
            What we filled in for you
          </h2>
          <ul className="flex flex-col gap-1">
            {draft.assumptions.map((assumption) => (
              <li key={assumption} className="text-caption text-ink-muted">
                {assumption}
              </li>
            ))}
          </ul>
          <p className="pt-3 text-caption text-ink-subtle">
            Change anything below that is wrong. The wrong employer means the wrong rubric, and
            you would find out half an hour in.
          </p>
        </section>
      ) : null}

      {!topicRequired ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Company (optional)" hint="Add it for employer-shaped questions, or leave it blank for general practice.">
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Infosys"
              autoComplete="organization"
              maxLength={120}
              className={CONTROL_CLASS}
            />
          </Field>
          <Field
            label={campusCandidate ? "Role (optional for freshers)" : "Role (optional)"}
            hint={
              campusCandidate
                ? "Campus placements may not name a role yet. Leave this blank and we will use your stage, syllabus and projects."
                : "Add it to tune the level and function, or leave it blank for role-neutral practice."
            }
          >
            <input
              value={roleTitle}
              onChange={(event) => setRoleTitle(event.target.value)}
              placeholder="Senior Backend Engineer"
              autoComplete="organization-title"
              maxLength={120}
              className={CONTROL_CLASS}
            />
          </Field>
        </div>
      ) : null}

      {!topicRequired && companyName.trim() !== "" ? (
        <p className="text-caption text-ink-muted">{draft.groundingNote}</p>
      ) : null}

      <Field
        label="Where are you in your career?"
        hint="Optional — so the questions match where you are. Leave it blank and we'll go by the role and resume."
      >
        <select
          value={candidateStage}
          onChange={(event) => setCandidateStage(event.target.value as CandidateStage | "")}
          className={CONTROL_CLASS}
        >
          <option value="">Prefer not to say</option>
          <option value="student">Student, still studying</option>
          <option value="recent_graduate">Recent graduate, no job yet</option>
          <option value="professional">Working professional</option>
        </select>
      </Field>

      {roundPreselected && selectedRound ? (
        <section
          aria-labelledby="chosen-round"
          className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent-wash p-5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-start sm:justify-between sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
              {selectedRound.eyebrow}
            </p>
            <h2 id="chosen-round" className="text-heading text-ink">
              {selectedRound.label}
            </h2>
            <p className="max-w-prose text-caption text-ink-muted">{selectedRound.blurb}</p>
          </div>
          <Link
            href="/rounds"
            className="shrink-0 self-start rounded-full border border-line bg-surface-raised px-4 py-2 text-caption font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Change round
          </Link>
        </section>
      ) : (
      <fieldset className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <legend className="pb-1 text-heading text-ink">Which round?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROUND_CATALOGUE.map((round) => {
            const selected = roundType === round.value;
            return (
              <label
                key={round.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                  selected
                    ? "border-accent/40 bg-accent-wash shadow-[var(--shadow-sm)]"
                    : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunken"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="roundType"
                    value={round.value}
                    checked={selected}
                    onChange={() => selectRound(round.value)}
                    className="size-4 accent-accent"
                  />
                  <span className="text-body font-medium text-ink">{round.label}</span>
                </span>
                <span className="pl-[1.625rem] text-caption text-ink-muted">{round.blurb}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      )}

      {topicRequired ? (
        <Field
          label="Topic to practise"
          hint="The interviewer stays within this scope. Try Java collections, operating systems, SQL joins, or SOLID principles."
        >
          <input
            value={focusTopic}
            onChange={(event) => setFocusTopic(event.target.value)}
            placeholder="Java collections"
            required
            maxLength={160}
            autoFocus
            className={CONTROL_CLASS}
          />
        </Field>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Length"
          hint={
            lengthOptions.length === 0
              ? `Only ${minutesLeftToday} free minutes are left today, which is shorter than this round can run. Choose a different round, or come back tomorrow.`
              : minutesLeftToday === null
                ? "Real rounds are time-boxed. The clock ends this one."
                : `Real rounds are time-boxed. ${minutesLeftToday} free minutes left today${
                    creditBalance > 0 ? "; a longer round uses a paid interview." : "."
                  }`
          }
        >
          <select
            value={effectiveMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            className={CONTROL_CLASS}
          >
            {lengthOptions.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Language" hint="The register the interviewer uses.">
          <select
            value={language}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "english" || value === "hindi_english") setLanguage(value);
            }}
            className={CONTROL_CLASS}
          >
            <option value="english">English</option>
            <option value="hindi_english">Hindi-English, code-switched</option>
          </select>
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4 rounded-2xl border border-accent/25 bg-accent-wash p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <legend className="px-2 text-heading text-ink">Before we start</legend>
        <p className="text-caption text-ink-muted">
          This interview is spoken. With your consent, each answer is recorded in your browser
          and sent to Gemini for assessment. We do not save the answer audio. Your transcript and
          report are kept for 28 days, and you can delete them earlier.{" "}
          <Link href={"/privacy" as Route} target="_blank" className="font-medium text-accent hover:underline">
            How we handle your data
          </Link>
        </p>
        <Consent
          checked={consentAudio}
          onChange={setConsentAudio}
          title="Record my voice"
          detail="Required. Each recording is used to assess your answer, then discarded after processing."
        />
        <Consent
          checked={cameraOn}
          onChange={setCameraOn}
          title="Turn my camera on"
          detail="Optional. You and the interviewer face each other, the way a real interview runs. Your camera stays on your screen — nothing from it is uploaded, recorded or scored."
        />
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-body text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={!ready || pending} aria-busy={pending}>
          {pending ? "Setting up…" : "Begin interview"}
        </Button>
        {!consentAudio ? (
          <p className="text-caption text-ink-subtle">Voice recording is required to continue.</p>
        ) : usesCredit ? (
          <p className="text-caption text-ink-muted">
            Uses 1 of your {creditBalance} paid {creditBalance === 1 ? "interview" : "interviews"} when it begins.
          </p>
        ) : null}
      </div>
    </form>
  );
}

const CUSTOM_LENGTHS = [
  { minutes: 10, label: "10 minutes — a quick topic check" },
  { minutes: 20, label: "20 minutes — focused practice" },
  { minutes: 30, label: "30 minutes — a thorough topic round" },
];

const STRUCTURED_ROUNDS: RoundType[] = [
  "coding_practical",
  "system_design",
  "behavioural_competency",
];

const SHORT_ROUND_LABELS: Partial<Record<RoundType, string>> = {
  coding_practical: "Coding",
  system_design: "System design",
  behavioural_competency: "Behavioural",
};

/** Neutral stored context for a round whose scope is the topic, not an employer or role. */
const CUSTOM_TOPIC_COMPANY = "General practice";
const CUSTOM_TOPIC_ROLE = "Topic practice";

const ROUND_LENGTHS = [
  { minutes: 10, label: "10 minutes — a focused check-in" },
  { minutes: 20, label: "20 minutes — a short round" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 40, label: "40 minutes — a typical round" },
  { minutes: 60, label: "60 minutes — a full panel" },
];

/** The manual path: the same setup with nothing filled in and nothing assumed. */
function blankDraft(focusTopic = "", initialRoundType?: RoundType): RoundDraft {
  const customTopic = focusTopic.trim();
  const catalogueRound = ROUND_CATALOGUE.find((round) => round.value === initialRoundType);
  const roundType = customTopic === "" ? (catalogueRound?.value ?? "project_deep_dive") : "custom_topic";
  const roundLabel = customTopic === "" ? (catalogueRound?.label ?? "Project deep-dive") : "Custom topic";
  return {
    companyName: "",
    roleTitle: "",
    level: "",
    roundType,
    roundLabel,
    durationMinutes: roundType === "custom_topic" ? 20 : 40,
    language: "english",
    understood:
      customTopic !== ""
        ? `Practise ${customTopic} in a focused interview.`
        : catalogueRound
          ? `Set up a ${catalogueRound.label.toLowerCase()} interview.`
          : "Who are you interviewing with?",
    assumptions: [],
    confidence: "low",
    archetypeLabel: "",
    archetypeConfidence: "inferred",
    groundingNote: "",
    focusTopic: customTopic === "" ? null : customTopic,
  };
}

/** The no-role-yet path for campus candidates, with a useful first round preselected. */
function blankCampusDraft(): RoundDraft {
  return {
    ...blankDraft("", "technical_fundamentals"),
    understood: "Set up a campus-placement practice round.",
  };
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">{label}</span>
      {children}
      <span className="text-caption text-ink-subtle">{hint}</span>
    </label>
  );
}

function Consent({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-raised p-4 transition-colors hover:border-accent/30">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-accent"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-body text-ink">{title}</span>
        <span className="text-caption text-ink-muted">{detail}</span>
      </span>
    </label>
  );
}
