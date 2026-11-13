import type { IntegritySummary } from "@untiered/shared";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INTEGRITY_DISCLAIMER, IntegritySection, IntegritySummaryPanel, OwnIntegritySection } from "./integrity-summary";

const fetchIntegrity = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ fetchIntegrity }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));

const recorded: IntegritySummary = {
  recorded: true,
  tabHidden: 3,
  windowBlur: 1,
  pastes: 2,
  pastedChars: 1240,
  fastAnswers: 0,
  longPauses: 1,
  notes: [
    "Switched away from the interview tab 3 times.",
    "The interview window lost focus once.",
    "Pasted text twice, 1,240 characters in total.",
    "1 answer included a pause of 20 seconds or longer.",
  ],
};

const notRecorded: IntegritySummary = {
  recorded: false,
  tabHidden: 0,
  windowBlur: 0,
  pastes: 0,
  pastedChars: 0,
  fastAnswers: 0,
  longPauses: 0,
  notes: [],
};

beforeEach(() => vi.clearAllMocks());

describe("IntegritySummaryPanel", () => {
  it("shows the counts, the notes and that they are not conclusions", () => {
    render(<IntegritySummaryPanel summary={recorded} />);

    const section = screen.getByRole("region", { name: "Integrity signals" });
    expect(section).toHaveTextContent(INTEGRITY_DISCLAIMER);
    expect(INTEGRITY_DISCLAIMER).toBe("These are counts, not conclusions. They never change a score.");
    expect(screen.getByText("Tab switches").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Characters pasted").nextElementSibling).toHaveTextContent("1,240");
    for (const note of recorded.notes) expect(screen.getByText(note)).toBeInTheDocument();
    // Neutral: not announced as an alert or styled as a warning.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing at all for a round that was not assigned", () => {
    const { container } = render(<IntegritySummaryPanel summary={notRecorded} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("loading the section", () => {
  it("shows the student's own recorded summary", async () => {
    fetchIntegrity.mockResolvedValue(recorded);
    render(<OwnIntegritySection sessionId="s1" />);
    expect(await screen.findByRole("heading", { name: "Integrity signals" })).toBeInTheDocument();
    expect(fetchIntegrity).toHaveBeenCalledWith("s1", expect.objectContaining({ accessToken: "token" }));
  });

  it("stays hidden when the round was not recorded", async () => {
    fetchIntegrity.mockResolvedValue(notRecorded);
    const { container } = render(<OwnIntegritySection sessionId="s1" />);
    await waitFor(() => expect(fetchIntegrity).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden, without an error, when the summary cannot be loaded", async () => {
    const load = vi.fn().mockRejectedValue(new Error("offline"));
    const { container } = render(<IntegritySection load={load} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
