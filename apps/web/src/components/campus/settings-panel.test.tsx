import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditEntryView } from "@untiered/shared";

import { CampusGate } from "./campus-context";
import { SettingsPanel } from "./settings-panel";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchCampusOrg: vi.fn(),
  updateCampusOrg: vi.fn(),
  fetchAuditLog: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ ...api, ApiRequestError: class ApiRequestError extends Error {} }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/campus/settings",
  useRouter: () => ({ push: vi.fn() }),
}));

const entry = (id: number, action: string): AuditEntryView => ({
  id,
  occurredAt: "2026-11-10T10:00:00Z",
  actorName: "Asha Rao",
  actorKind: "member",
  action,
  targetType: "batch",
  targetId: null,
});

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchMeCampus.mockResolvedValue({
      student: null,
      staff: [{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role: "college_admin" }],
    });
    api.fetchCampusOrg.mockResolvedValue({
      id: "o1",
      name: "Alpha College",
      slug: "alpha",
      city: null,
      state: null,
      logoUrl: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      status: "active",
      interviewAllowance: 0,
      interviewsUsed: 0,
      createdAt: "2026-11-01T00:00:00Z",
    });
  });

  it("pages through the audit log with a cursor", async () => {
    api.fetchAuditLog
      .mockResolvedValueOnce({ items: [entry(2, "batch.created")], nextCursor: "c1" })
      .mockResolvedValueOnce({ items: [entry(1, "member.removed")], nextCursor: null });
    render(
      <CampusGate title="Settings">
        <SettingsPanel />
      </CampusGate>,
    );

    expect(await screen.findByText("batch.created")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("member.removed")).toBeInTheDocument();
    expect(api.fetchAuditLog).toHaveBeenLastCalledWith("o1", { accessToken: "token" }, "c1");
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Action" })).toBeInTheDocument();
  });
});
