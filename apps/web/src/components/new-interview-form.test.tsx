import type { EntitlementView, LoopBrief, PrepPlan, RoundDraft } from "@untiered/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewInterviewForm } from "./new-interview-form";

const composeRound = vi.hoisted(() => vi.fn());
const startSession = vi.hoisted(() => vi.fn());
const fetchLoopBrief = vi.hoisted(() => vi.fn());
const fetchPrepPlan = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const fetchEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  composeRound,
  startSession,
  fetchLoopBrief,
  fetchPrepPlan,
  fetchEntitlement,
  ApiRequestError: class ApiRequestError extends Error {},
}));

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function briefFor(companyName: string, confidence: "recognised" | "inferred" = "recognised"): LoopBrief {
  return {
    company: {
      slug: companyName.toLowerCase(),
      name: companyName,
      archetype: "service_based_it",
      archetypeLabel: "Service-based IT firm",
      archetypeInProse: "a service-based IT loop",
      archetypeConfidence: confidence,
    },
    hasSources: false,
    sourcedStages: [],
    generalPattern: [],
    publicSourcePattern: null,
    modelKnowledge: null,
    bankCoverage: { questionCount: 0, roundTypes: [], bankUrl: `/questions/${companyName.toLowerCase()}` },
  };
}

const emptyPlan: PrepPlan = { items: [], unsimulatedStages: [] };

/** Past the "how they interview" step and into the setup form, for tests about setup itself. */
async function skipBrief() {
  await waitFor(() => expect(screen.getByRole("button", { name: /let me pick/i })).toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: /let me pick/i }));
}

const draft: RoundDraft = {
  companyName: "Infosys",
  roleTitle: "Senior Backend Engineer",
  level: "5 years",
  roundType: "techno_managerial",
  roundLabel: "Techno-managerial",
  durationMinutes: 40,
  focusTopic: null,
  language: "english",
  understood: "A techno-managerial round for a Senior Backend Engineer at Infosys.",
  assumptions: ["Read 'MR round' as techno-managerial", "Assumed a 40-minute round"],
  confidence: "high",
  archetypeLabel: "Service-based IT",
  archetypeConfidence: "recognised",
  groundingNote: "Run as a service-based IT loop. These are general patterns for that kind of employer.",
};

describe("NewInterviewForm", () => {
  beforeEach(() => {
    // Nothing used today unless a test says otherwise.
    fetchEntitlement.mockReset().mockResolvedValue(allowance({}));
    composeRound.mockReset();
    startSession.mockReset();
    push.mockReset();
    fetchLoopBrief.mockReset().mockImplementation((query: { company: string }) =>
      Promise.resolve(briefFor(query.company)),
    );
    fetchPrepPlan.mockReset().mockResolvedValue(emptyPlan);
  });

  it("carries the structured company, role and round into the consent setup", async () => {
    render(<NewInterviewForm />);

    await userEvent.click(screen.getByRole("button", { name: "Amazon" }));
    await userEvent.type(screen.getByRole("textbox", { name: /^role\b/i }), "Software Development Engineer");
    await userEvent.click(screen.getByRole("radio", { name: /system design/i }));
    await userEvent.click(screen.getByRole("button", { name: /continue to interview setup/i }));

    expect(screen.getByDisplayValue("Amazon")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Software Development Engineer")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /system or solution design/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /record my voice/i })).not.toBeChecked();
  });

  it("turns a named Java round into a focused custom interview", async () => {
    composeRound.mockResolvedValue({
      ...draft,
      roundType: "custom_topic",
      roundLabel: "Custom topic",
      durationMinutes: 20,
      focusTopic: "Java collections",
    });
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys Java round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));

    await waitFor(() => expect(screen.getByDisplayValue("Java collections")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: /how infosys interviews/i })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /custom topic/i })).toBeChecked();
    expect(screen.queryByRole("textbox", { name: /company/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /role/i })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("combobox", { name: /Length/i }))
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["10", "20", "30"]);

    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    await userEvent.click(screen.getByRole("button", { name: /begin interview/i }));

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          roundType: "custom_topic",
          focusTopic: "Java collections",
          durationMinutes: 20,
          companyName: "General practice",
          roleTitle: "Topic practice",
        }),
      ),
    );
  });

  it("opens a course topic as a prefilled custom interview", () => {
    render(<NewInterviewForm initialTopic="Java: Collections" />);

    expect(screen.getByRole("radio", { name: /custom topic/i })).toBeChecked();
    expect(screen.getByDisplayValue("Java: Collections")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Length/i })).toHaveValue("20");
    expect(composeRound).not.toHaveBeenCalled();
  });

  it("opens a dashboard quick start with company and role filled in, still editable", () => {
    render(<NewInterviewForm initialCompany="Deloitte" initialRole="Business Analyst" />);

    expect(screen.getByRole("textbox", { name: /company/i })).toHaveValue("Deloitte");
    expect(screen.getByRole("textbox", { name: /^role\b/i })).toHaveValue("Business Analyst");
    expect(composeRound).not.toHaveBeenCalled();
  });

  it("opens a catalogue round with that interview type already selected", () => {
    render(<NewInterviewForm initialRoundType="system_design" />);

    expect(screen.getByRole("radio", { name: /system or solution design/i })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /Length/i })).toHaveValue("40");
    expect(composeRound).not.toHaveBeenCalled();
  });

  /**
   * Chosen from the rounds page: the round is settled, so the picker gives way to a summary
   * with a way back. Company and role remain useful context, but neither blocks practice.
   */
  it("locks a catalogue round and starts even when employer and role are blank", async () => {
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm initialRoundType="system_design" roundPreselected />);

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /system or solution design/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /change round/i })).toHaveAttribute("href", "/rounds");
    // A topic only survives on the server for a custom-topic round, so it is not asked for here.
    expect(screen.queryByLabelText(/topic to practise/i)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Length/i })).toHaveValue("40");

    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    const begin = screen.getByRole("button", { name: /begin interview/i });
    expect(begin).toBeEnabled();
    expect(screen.getByRole("textbox", { name: /company/i })).not.toBeRequired();
    expect(screen.getByRole("textbox", { name: /role/i })).not.toBeRequired();
    await userEvent.click(begin);

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          companyName: "",
          roleTitle: "",
          roundType: "system_design",
          focusTopic: undefined,
          consentAudio: true,
        }),
      ),
    );
  });

  it("keeps the consent gate on a catalogue round", async () => {
    render(<NewInterviewForm initialRoundType="behavioural_competency" roundPreselected />);

    await userEvent.type(screen.getByRole("textbox", { name: /company/i }), "Infosys");
    await userEvent.type(screen.getByRole("textbox", { name: /role/i }), "Engineer");

    expect(screen.getByRole("button", { name: /begin interview/i })).toBeDisabled();
    expect(screen.getByText(/voice recording is required to continue/i)).toBeInTheDocument();
    expect(screen.getByText(/we do not save the answer audio/i)).toBeInTheDocument();
    expect(screen.getByText(/sent to Gemini for assessment/i)).toBeInTheDocument();
  });

  it("asks only for the topic when the catalogue round is a custom topic", async () => {
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm initialRoundType="custom_topic" roundPreselected />);

    expect(screen.getByLabelText(/topic to practise/i)).toBeRequired();
    expect(screen.queryByRole("textbox", { name: /company/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /role/i })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Length/i })).toHaveValue("20");

    await userEvent.type(screen.getByLabelText(/topic to practise/i), "Java collections");
    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    await userEvent.click(screen.getByRole("button", { name: /begin interview/i }));

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          companyName: "General practice",
          roleTitle: "Topic practice",
          roundType: "custom_topic",
          focusTopic: "Java collections",
        }),
      ),
    );
  });

  it("tells a candidate who has used today's allowance before they fill anything in", async () => {
    fetchEntitlement.mockResolvedValue(
      allowance({
        allowed: false,
        reason: "daily_rounds_reached",
        message: "You have used today's free practice (2 rounds or 60 minutes a day).",
        remainingRoundsToday: 0,
      }),
    );
    render(<NewInterviewForm />);

    expect(await screen.findByRole("heading", { name: /today.s free practice is used/i })).toBeInTheDocument();
    expect(screen.getByText(/pro · coming soon/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/describe the interview/i)).not.toBeInTheDocument();
  });

  it("offers only round lengths that fit in the minutes left today", async () => {
    fetchEntitlement.mockResolvedValue(allowance({ remainingRoundsToday: 1, remainingMinutesToday: 20 }));
    render(<NewInterviewForm initialRoundType="system_design" roundPreselected />);

    const length = screen.getByRole("combobox", { name: /Length/i });
    await waitFor(() => expect(length).toHaveValue("20"));
    const offered = within(length).getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(offered).toEqual(["10", "20"]);
    expect(screen.getByText(/20 free minutes left today/i)).toBeInTheDocument();
  });

  it("turns one line into a round, and shows it back before anything starts", async () => {
    composeRound.mockResolvedValue(draft);
    render(<NewInterviewForm />);

    await userEvent.type(
      screen.getByLabelText(/describe the interview/i),
      "Infosys MR round next Tuesday",
    );
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
    await skipBrief();

    await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());
    expect(composeRound).toHaveBeenCalledWith("token", "Infosys MR round next Tuesday");
    expect(screen.getByDisplayValue("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /techno-managerial/i })).toBeChecked();

    // Nothing has been created yet. The candidate still has to consent and confirm.
    expect(startSession).not.toHaveBeenCalled();
  });

  /**
   * A wrong guess would waste the round — the wrong employer means the wrong rubric, and
   * they find out half an hour in. Everything the model filled in has to be visible, and
   * everything has to be editable.
   */
  it("lists what it assumed, and lets the candidate correct it", async () => {
    composeRound.mockResolvedValue(draft);
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
    await skipBrief();
    await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());

    expect(screen.getByText(/read 'mr round' as techno-managerial/i)).toBeInTheDocument();

    const role = screen.getByDisplayValue("Senior Backend Engineer");
    await userEvent.clear(role);
    await userEvent.type(role, "Technology Lead");
    await userEvent.click(screen.getByRole("radio", { name: /behavioural/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    await userEvent.click(screen.getByRole("button", { name: /begin interview/i }));

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          companyName: "Infosys",
          roleTitle: "Technology Lead",
          roundType: "behavioural_competency",
        }),
      ),
    );
  });

  it("shows the grounding note, so an unrecognised employer is known before the round", async () => {
    composeRound.mockResolvedValue({
      ...draft,
      companyName: "Sagitec Solutions",
      archetypeConfidence: "inferred",
      groundingNote:
        "We do not have specific information about Sagitec Solutions, so this runs on general service-based IT patterns.",
    });
    render(<NewInterviewForm />);

    fetchLoopBrief.mockResolvedValue(briefFor("Sagitec Solutions", "inferred"));

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Sagitec round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
    await skipBrief();

    await waitFor(() =>
      expect(screen.getByText(/we do not have specific information about sagitec/i)).toBeInTheDocument(),
    );
  });

  it("still starts a round when the composer cannot read the sentence", async () => {
    composeRound.mockRejectedValue(new Error("upstream down"));
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "something unparseable");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));

    // Degrades to the form rather than dead-ending: the round is the point, not the composer.
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /begin interview/i })).toBeInTheDocument();
  });

  it("offers a way in for someone who would rather just fill it in", async () => {
    render(<NewInterviewForm />);

    await userEvent.click(screen.getByRole("button", { name: /fill it in yourself/i }));

    expect(screen.getByRole("button", { name: /begin interview/i })).toBeInTheDocument();
    expect(composeRound).not.toHaveBeenCalled();
  });

  /**
   * The camera is offered again, now that there is a face to look back. What it is *not*
   * is a recording: nothing from it is uploaded, so the checkbox says so and the flag it
   * sets means "open the camera", not "keep what it sees".
   */
  it("offers the camera, and starts the round with it when it is asked for", async () => {
    composeRound.mockResolvedValue(draft);
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
    await skipBrief();
    await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());

    expect(screen.getByText(/nothing from it is uploaded, recorded or scored/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /turn my camera on/i }));
    await userEvent.click(screen.getByRole("button", { name: /begin interview/i }));

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ consentAudio: true, consentVideo: true }),
      ),
    );
  });

  /** Voice is required and the camera is not, so declining it must still start a round. */
  it("starts without the camera when it is left alone", async () => {
    composeRound.mockResolvedValue(draft);
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
    await skipBrief();
    await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    await userEvent.click(screen.getByRole("button", { name: /begin interview/i }));

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ consentAudio: true, consentVideo: false }),
      ),
    );
  });

  /**
   * The default state of the field, and the one most candidates will leave it in — it
   * must not change what is sent to the server (task 051).
   */
  it("sends no candidateStage when the career question is left alone", async () => {
    composeRound.mockResolvedValue(draft);
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
    await skipBrief();
    await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    await userEvent.click(screen.getByRole("button", { name: /begin interview/i }));

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ candidateStage: undefined }),
      ),
    );
  });

  /** A candidate who does answer has it carried through to the request, unaltered. */
  it("sends what the candidate said about their own stage", async () => {
    composeRound.mockResolvedValue(draft);
    startSession.mockResolvedValue({ id: "8b0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f" });
    render(<NewInterviewForm />);

    await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
    await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
    await skipBrief();
    await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());

    await userEvent.selectOptions(
      screen.getByLabelText(/where are you in your career/i),
      "student",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /record my voice/i }));
    await userEvent.click(screen.getByRole("button", { name: /begin interview/i }));

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ candidateStage: "student" }),
      ),
    );
  });

  it("will not start without consent to record the candidate's voice", async () => {
    render(<NewInterviewForm />);
    await userEvent.click(screen.getByRole("button", { name: /fill it in yourself/i }));

    await userEvent.type(screen.getByPlaceholderText("Infosys"), "TCS");
    await userEvent.type(screen.getByPlaceholderText("Senior Backend Engineer"), "Systems Engineer");

    expect(screen.getByRole("button", { name: /begin interview/i })).toBeDisabled();
    expect(screen.getByText(/voice recording is required/i)).toBeInTheDocument();
  });

  describe("getting back to the loop brief", () => {
    it("offers a Back button on setup when the candidate came from the brief, and it returns there", async () => {
      composeRound.mockResolvedValue(draft);
      render(<NewInterviewForm />);

      await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
      await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
      await skipBrief();
      await waitFor(() => expect(screen.getByDisplayValue("Infosys")).toBeInTheDocument());

      const back = screen.getByRole("button", { name: /back to how infosys interviews/i });
      await userEvent.click(back);

      // Back on the brief, not the setup form.
      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /how infosys interviews/i })).toBeInTheDocument(),
      );
      expect(screen.queryByDisplayValue("Infosys")).not.toBeInTheDocument();
    });

    it("offers a campus-placement option at the start, off by default and keyboard reachable", async () => {
      render(<NewInterviewForm />);

      const box = screen.getByRole("checkbox", { name: /fresher preparing for campus placement/i });
      expect(box).not.toBeChecked();
      expect(screen.queryByRole("combobox", { name: /where are you right now/i })).not.toBeInTheDocument();

      box.focus();
      expect(box).toHaveFocus();
      await userEvent.keyboard(" ");
      expect(box).toBeChecked();
      expect(screen.getByRole("combobox", { name: /where are you right now/i })).toHaveValue("student");
    });

    it("lets a fresher continue without inventing a role or interview description", async () => {
      render(<NewInterviewForm />);

      const description = screen.getByLabelText(/describe the interview/i);
      expect(description).toBeRequired();
      expect(screen.getByRole("button", { name: /set up the round/i })).toBeDisabled();

      await userEvent.click(screen.getByRole("checkbox", { name: /fresher preparing for campus placement/i }));

      expect(description).not.toBeRequired();
      const continueButton = screen.getByRole("button", { name: /set up my campus round/i });
      expect(continueButton).toBeEnabled();
      await userEvent.click(continueButton);

      expect(composeRound).not.toHaveBeenCalled();
      expect(screen.getByRole("radio", { name: /technical fundamentals/i })).toBeChecked();
      expect(screen.getByRole("textbox", { name: /role \(optional for freshers\)/i })).not.toBeRequired();
      expect(screen.getByRole("combobox", { name: /where are you in your career/i })).toHaveValue("student");
      expect(screen.getByText(/campus placements may not name a role yet/i)).toBeInTheDocument();
    });

    it("carries the campus stage into the brief and plan fetches, and prefills the setup stage", async () => {
      composeRound.mockResolvedValue(draft);
      render(<NewInterviewForm />);

      await userEvent.click(screen.getByRole("checkbox", { name: /fresher preparing for campus placement/i }));
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: /where are you right now/i }),
        "recent_graduate",
      );
      await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys campus round");
      await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
      await skipBrief();

      const expected = { company: "Infosys", role: "Senior Backend Engineer", level: "recent_graduate" };
      expect(fetchLoopBrief).toHaveBeenCalledWith(expected, { accessToken: "token" });
      expect(fetchPrepPlan).toHaveBeenCalledWith(expected, { accessToken: "token" });
      expect(screen.getByRole("combobox", { name: /where are you in your career/i })).toHaveValue(
        "recent_graduate",
      );
    });

    it("leaves the level unset and the stage blank when the option is not used", async () => {
      composeRound.mockResolvedValue(draft);
      render(<NewInterviewForm />);

      await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
      await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));
      await skipBrief();

      expect(fetchLoopBrief).toHaveBeenCalledWith(
        { company: "Infosys", role: "Senior Backend Engineer" },
        { accessToken: "token" },
      );
      expect(screen.getByRole("combobox", { name: /where are you in your career/i })).toHaveValue("");
    });

    it("has no Back button when the candidate never saw a brief", async () => {
      render(<NewInterviewForm />);
      await userEvent.click(screen.getByRole("button", { name: /fill it in yourself/i }));

      expect(screen.queryByRole("button", { name: /back to how/i })).not.toBeInTheDocument();
    });

    it("returns from the brief to editing the description", async () => {
      composeRound.mockResolvedValue(draft);
      render(<NewInterviewForm />);

      await userEvent.type(screen.getByLabelText(/describe the interview/i), "Infosys MR round");
      await userEvent.click(screen.getByRole("button", { name: /set up the round/i }));

      await waitFor(() =>
        expect(screen.getByRole("heading", { name: /how infosys interviews/i })).toBeInTheDocument(),
      );
      await userEvent.click(screen.getByRole("button", { name: /edit the description/i }));

      expect(screen.getByLabelText(/describe the interview/i)).toBeInTheDocument();
    });
  });
});

function allowance(over: Partial<EntitlementView>): EntitlementView {
  return {
    allowed: true,
    reason: "allowed",
    message: "Free practice today: 2 rounds and 60 minutes left.",
    remainingFree: null,
    dailyRoundLimit: 2,
    dailyMinuteLimit: 60,
    remainingRoundsToday: 2,
    remainingMinutesToday: 60,
    ...over,
  };
}
