import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProFeatureRequestForm } from "./pro-feature-request-form";
import { ApiRequestError, submitProFeatureRequest } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: vi.fn(() => "token") }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  submitProFeatureRequest: vi.fn(),
}));

describe("ProFeatureRequestForm", () => {
  beforeEach(() => {
    vi.mocked(useAccessToken).mockReturnValue("token");
    vi.mocked(submitProFeatureRequest).mockReset().mockResolvedValue(undefined);
  });

  it("cannot be sent empty", () => {
    render(<ProFeatureRequestForm />);

    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  });

  it("sends the chosen feature keys and trimmed note, then thanks the candidate", async () => {
    const user = userEvent.setup();
    render(<ProFeatureRequestForm />);

    await user.click(screen.getByRole("checkbox", { name: /more interviews after your free ones/i }));
    await user.click(screen.getByRole("checkbox", { name: /deeper practice recommendations/i }));
    await user.type(screen.getByLabelText(/anything else/i), "  Mock HR rounds  ");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(submitProFeatureRequest).toHaveBeenCalledWith("token", {
      features: ["more_practice", "recommendations"],
      note: "Mock HR rounds",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/request has been recorded/i);
  });

  it("shows the API's message when the daily cap is reached", async () => {
    vi.mocked(submitProFeatureRequest).mockRejectedValue(
      new ApiRequestError(429, "too_many_requests", "Thanks, you have sent several today. Please try again tomorrow."),
    );
    const user = userEvent.setup();
    render(<ProFeatureRequestForm />);

    await user.click(screen.getByRole("checkbox", { name: /progress views/i }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/try again tomorrow/i);
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });
});
