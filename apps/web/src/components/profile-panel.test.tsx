import type { ProfileDetails } from "@untiered/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePanel } from "./profile-panel";
import { resetCourseProgress } from "@/lib/use-course-progress";

const fetchProfile = vi.hoisted(() => vi.fn());
const updateProfile = vi.hoisted(() => vi.fn());
const fetchMe = vi.hoisted(() => vi.fn());
const fetchSessions = vi.hoisted(() => vi.fn());
const fetchArenaProgress = vi.hoisted(() => vi.fn());
const fetchCourseProgress = vi.hoisted(() => vi.fn());
const uploadResume = vi.hoisted(() => vi.fn());
const uploadAvatar = vi.hoisted(() => vi.fn());
const ApiRequestError = vi.hoisted(() => class ApiRequestError extends Error {});
const auth = vi.hoisted(() => ({ token: "token" as string | null | undefined }));

vi.mock("@/lib/api", () => ({
  fetchProfile,
  fetchMe,
  fetchSessions,
  fetchArenaProgress,
  fetchCourseProgress,
  updateProfile,
  uploadResume,
  deleteResume: vi.fn(),
  uploadAvatar,
  upsertSkill: vi.fn(),
  deleteSkill: vi.fn(),
  ApiRequestError,
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => auth.token }));

const profile = (over: Partial<ProfileDetails> = {}): ProfileDetails => ({
  resume: null,
  skills: [],
  avatarUrl: null,
  currentLevel: null,
  targetLevel: null,
  linkedinUrl: null,
  ...over,
});

/**
 * The reported bug, which was end to end: the profile was write-only. Everything typed
 * into this form persisted correctly and nothing ever came back, so on the next visit the
 * fields were blank again and the save looked as though it had failed.
 */
describe("ProfilePanel", () => {
  beforeEach(() => {
    auth.token = "token";
    resetCourseProgress();
    fetchProfile.mockReset();
    updateProfile.mockReset();
    fetchMe.mockReset();
    fetchSessions.mockReset();
    fetchArenaProgress.mockReset();
    fetchCourseProgress.mockReset();
    uploadResume.mockReset();
    fetchMe.mockResolvedValue({
      id: "candidate-1",
      email: "candidate@example.com",
      displayName: "Candidate",
      preferredLanguage: "english",
      createdAt: "2026-09-01T00:00:00Z",
      profile: {},
    });
    fetchSessions.mockResolvedValue([]);
    fetchArenaProgress.mockResolvedValue({
      xp: 0,
      streak: { current: 0, longest: 0, lastActiveDate: null },
      badges: [],
      cards: {},
      masteredChallengeIds: [],
      dailyQuestionCompletions: {},
    });
    fetchCourseProgress.mockResolvedValue({ completed: {} });
  });

  it("shows resume details while interview history and Arena are still loading", async () => {
    fetchProfile.mockResolvedValue(profile({ targetLevel: "Staff Engineer" }));
    fetchSessions.mockImplementation(() => new Promise(() => {}));
    fetchArenaProgress.mockImplementation(() => new Promise(() => {}));

    render(<ProfilePanel />);

    expect(await screen.findByText("Working toward Staff Engineer")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resume & Skills" })).toBeInTheDocument();
    expect(screen.getByText("Rounds completed").parentElement).toHaveTextContent("—");
  });

  it("says a photo was refused beside the photo, not at the foot of the page", async () => {
    fetchProfile.mockResolvedValue(profile());
    uploadAvatar.mockRejectedValue(new ApiRequestError("Keep the photo under 2MB."));

    const { container } = render(<ProfilePanel />);
    await screen.findByRole("button", { name: "Add profile photo" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="image"]');
    await userEvent.upload(input!, new File(["x"], "me.png", { type: "image/png" }));

    const identity = screen.getByRole("region", { name: "Profile identity" });
    expect(await within(identity).findByRole("alert")).toHaveTextContent("Keep the photo under 2MB.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("confirms a new photo beside the photo", async () => {
    fetchProfile.mockResolvedValue(profile());
    uploadAvatar.mockResolvedValue(profile({ avatarUrl: "https://example.com/new.png" }));

    const { container } = render(<ProfilePanel />);
    await screen.findByRole("button", { name: "Add profile photo" });
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="image"]');
    await userEvent.upload(input!, new File(["x"], "me.png", { type: "image/png" }));

    const identity = screen.getByRole("region", { name: "Profile identity" });
    await waitFor(() => expect(within(identity).getByRole("status")).toBeInTheDocument());
    expect(screen.getByAltText("Profile photo")).toHaveAttribute("src", "https://example.com/new.png");
  });

  it("shows the uploaded resume before the profile reconciliation finishes", async () => {
    fetchProfile.mockResolvedValueOnce(profile());
    fetchProfile.mockImplementationOnce(() => new Promise(() => {}));
    uploadResume.mockResolvedValue({
      id: "resume-1",
      filename: "cv.pdf",
      status: "parsed",
      error: null,
      uploadedAt: "2026-10-13T00:00:00Z",
      headline: "Backend engineer",
      employments: [],
      projects: [],
      detectedSkills: [],
      lowConfidenceFields: [],
      totalExperienceMonths: 0,
      gapCount: 0,
      shortTenureCount: 0,
    });

    const { container } = render(<ProfilePanel />);
    await userEvent.click(await screen.findByRole("tab", { name: "Resume & Skills" }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="pdf"]');
    expect(input).not.toBeNull();
    await userEvent.upload(input!, new File(["resume"], "cv.pdf", { type: "application/pdf" }));

    expect((await screen.findAllByText("cv.pdf")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Reading it…" })).toBeDisabled();
  });

  it("does not show the previous account while a replacement profile request fails", async () => {
    fetchProfile.mockResolvedValueOnce(profile({ targetLevel: "Private target A" }));
    fetchMe.mockResolvedValueOnce({
      id: "candidate-a",
      email: "private-a@example.com",
      displayName: "Private Candidate A",
      preferredLanguage: "english",
      createdAt: "2026-09-01T00:00:00Z",
      profile: {},
    });
    fetchSessions.mockResolvedValueOnce([]);

    const view = render(<ProfilePanel />);
    expect(await screen.findByRole("heading", { name: "Private Candidate A" })).toBeInTheDocument();

    fetchProfile.mockRejectedValueOnce(new Error("account B failed"));
    fetchMe.mockRejectedValueOnce(new Error("account B failed"));
    fetchSessions.mockRejectedValueOnce(new Error("account B failed"));
    fetchArenaProgress.mockRejectedValueOnce(new Error("account B failed"));
    auth.token = "account-b";
    view.rerender(<ProfilePanel />);

    expect(screen.queryByText("Private Candidate A")).not.toBeInTheDocument();
    expect(screen.queryByText("Private target A")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchProfile).toHaveBeenCalledWith({ accessToken: "account-b" }));
    expect(screen.queryByText("Private Candidate A")).not.toBeInTheDocument();
  });

  it("puts identity, learning progress, interview history and Arena activity in one overview", async () => {
    fetchProfile.mockResolvedValue(profile({ avatarUrl: "https://example.com/avatar.png", targetLevel: "Staff Engineer" }));
    fetchCourseProgress.mockResolvedValue({
      completed: { java: ["intro", "loops"], dsa: ["arrays"] },
    });
    fetchSessions.mockResolvedValue([
      {
        id: "round-1",
        companyName: "Acme",
        roleTitle: "Backend Engineer",
        roundType: "technical_fundamentals",
        status: "completed",
        startedAt: "2026-09-20T10:00:00Z",
        endedAt: "2026-09-20T10:30:00Z",
        hasReport: true,
        reportExpired: false,
        reportExpiresAt: null,
        reportRetentionDays: 30,
      },
      {
        id: "round-2",
        companyName: "Example Co",
        roleTitle: "Platform Engineer",
        roundType: "behavioural_competency",
        status: "completed",
        startedAt: "2026-09-21T10:00:00Z",
        endedAt: "2026-09-21T10:30:00Z",
        hasReport: true,
        reportExpired: false,
        reportExpiresAt: null,
        reportRetentionDays: 30,
      },
    ]);
    fetchArenaProgress.mockResolvedValue({
      xp: 120,
      streak: { current: 4, longest: 7, lastActiveDate: "2026-09-24" },
      badges: [],
      cards: {},
      masteredChallengeIds: [],
      dailyQuestionCompletions: {},
    });

    render(
      <ProfilePanel
        outlines={[
          { slug: "java", title: "Java Programming", chapters: [{ slug: "intro", title: "Intro" }, { slug: "loops", title: "Loops" }] },
          { slug: "dsa", title: "Data Structures", chapters: [{ slug: "arrays", title: "Arrays" }, { slug: "trees", title: "Trees" }] },
        ]}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Candidate" })).toBeInTheDocument();
    expect(screen.getByAltText("Profile photo")).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(await screen.findByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("4 days")).toBeInTheDocument();
    expect(screen.getAllByText("Example Co")[0]).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/courses/dsa/trees");
  });

  it("separates overview, resume and skills, and reports into accessible tabs", async () => {
    fetchProfile.mockResolvedValue(profile());
    fetchSessions.mockResolvedValue([
      {
        id: "round-1",
        companyName: "Amazon",
        roleTitle: "Backend Engineer",
        roundType: "system_design",
        status: "completed",
        startedAt: "2026-09-20T10:00:00Z",
        endedAt: "2026-09-20T10:30:00Z",
        hasReport: true,
        reportExpired: false,
        reportExpiresAt: null,
        reportRetentionDays: 30,
      },
    ]);

    render(<ProfilePanel />);
    const overview = await screen.findByRole("tab", { name: "Overview" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Resume & Skills" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reports" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Resume & Skills" }));
    expect(screen.getByRole("heading", { name: "Your resume" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "What you know" })).toBeVisible();

    await userEvent.click(screen.getByRole("tab", { name: "Reports" }));
    expect(screen.getByRole("heading", { name: /recent interview reports/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /read report/i })).toHaveAttribute("href", "/report/round-1");
  });

  it("shows back what was saved, rather than an empty form", async () => {
    fetchProfile.mockResolvedValue(
      profile({
        currentLevel: "Senior Member of Technical Staff",
        targetLevel: "Staff Engineer",
        linkedinUrl: "https://linkedin.com/in/naman",
      }),
    );

    render(<ProfilePanel />);

    await waitFor(() =>
      expect(screen.getByLabelText(/linkedin/i)).toHaveValue("https://linkedin.com/in/naman"),
    );
    expect(screen.getByLabelText(/current level/i)).toHaveValue("Senior Member of Technical Staff");
    expect(screen.getByLabelText(/target level/i)).toHaveValue("Staff Engineer");
  });

  /**
   * The candidate told us their current role by uploading a resume. Making them type it
   * again into a box labelled "as your employer titles it" is asking the same question
   * twice.
   */
  it("fills the current role in from the resume when nothing has been saved", async () => {
    fetchProfile.mockResolvedValue(
      profile({
        resume: {
          id: "r1",
          filename: "cv.pdf",
          status: "parsed",
          error: null,
          uploadedAt: "2026-09-08T00:00:00Z",
          headline: "Backend engineer",
          employments: [
            { employer: "Infosys", title: "Engineer", startDate: "2019-07-01", endDate: "2022-02-01", current: false },
            { employer: "Salesforce", title: "SMTS", startDate: "2022-03-01", endDate: null, current: true },
          ],
          projects: [],
          detectedSkills: [],
          lowConfidenceFields: [],
          totalExperienceMonths: 86,
          gapCount: 0,
          shortTenureCount: 0,
        },
      }),
    );

    render(<ProfilePanel />);

    await waitFor(() => expect(screen.getByLabelText(/current level/i)).toHaveValue("SMTS"));
  });

  /**
   * Blank fields have to reach the server. The form used to drop them before sending, and
   * the server reads absent as "leave it alone", so a field could never be emptied once
   * it had been filled in.
   */
  it("can empty a field that was filled in before", async () => {
    fetchProfile.mockResolvedValue(profile({ linkedinUrl: "https://linkedin.com/in/wrong" }));
    updateProfile.mockResolvedValue(profile());

    render(<ProfilePanel />);
    const linkedin = await screen.findByLabelText(/linkedin/i);
    await waitFor(() => expect(linkedin).toHaveValue("https://linkedin.com/in/wrong"));

    await userEvent.clear(linkedin);
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith("token", expect.objectContaining({ linkedinUrl: "" })),
    );
  });

});
