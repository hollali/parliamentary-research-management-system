import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminDashboardView } from "../components/AdminDashboardView";
import { useApp } from "../context/AppContext";
import { getOfficers } from "../lib/api";
import { ToastProvider } from "../lib/toast";

vi.mock("../context/AppContext", () => ({
  useApp: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  getOfficers: vi.fn(),
}));

const mockUseApp = vi.mocked(useApp);
const mockGetOfficers = vi.mocked(getOfficers);

describe("AdminDashboardView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOfficers.mockResolvedValue([]);
    mockUseApp.mockReturnValue({
      requests: [
        {
          id: "REQ-100",
          title: "Climate policy review",
          topic: "Climate policy",
          category: "Environment",
          member: "Jane Doe",
          submitterId: "mp-1",
          assignedOfficerId: null,
          assignedOfficerName: null,
          teamName: null,
          assignedOfficers: [],
          status: "IN_PROGRESS",
          priority: "STANDARD",
          dateSubmitted: "2026-07-01",
          deadline: "2026-07-30",
          description: "Needs analysis",
          language: "English",
          draftVersion: 1,
          attachments: [],
          comments: [],
          content: "",
        },
      ],
      history: [],
      updateRequestStatus: vi.fn(),
      updateRequestPriority: vi.fn(),
    } as any);
  });

  it("opens a details modal when the view action is clicked", async () => {
    render(
      <ToastProvider>
        <AdminDashboardView onNavigate={vi.fn()} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /view details/i }));

    expect(
      await screen.findByRole("heading", { name: /climate policy review/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Needs analysis")).toBeInTheDocument();
  });
});
