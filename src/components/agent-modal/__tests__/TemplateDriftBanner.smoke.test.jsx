/**
 * Smoke tests for TemplateDriftBanner.
 *
 * Covers the four render branches:
 *   - in-sync → renders nothing
 *   - free-form agent (no template) → renders nothing
 *   - template_unknown → renders nothing
 *   - drifted → banner visible + button wired
 *
 * Plus: clicking 'Update from template' calls the resync API and the
 * onResynced callback fires with the new status.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TemplateDriftBanner from "@/components/agent-modal/TemplateDriftBanner";

vi.mock("@/lib/api", () => ({
  getAgentTemplateStatus: vi.fn(),
  resyncAgentTemplate: vi.fn(),
}));

import { getAgentTemplateStatus, resyncAgentTemplate } from "@/lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TemplateDriftBanner", () => {
  it("renders nothing when agent is in sync", async () => {
    getAgentTemplateStatus.mockResolvedValue({
      agent_id: 6,
      template_id: "ar_assistant",
      is_in_sync: true,
      stored_hash: "abc",
      current_hash: "abc",
      drift_fields: [],
    });
    const { container } = render(<TemplateDriftBanner agentId={6} />);
    await waitFor(() => expect(getAgentTemplateStatus).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for free-form agents (template_id=null)", async () => {
    getAgentTemplateStatus.mockResolvedValue({
      agent_id: 1,
      template_id: null,
      is_in_sync: true,
      stored_hash: null,
      current_hash: null,
      drift_fields: [],
    });
    const { container } = render(<TemplateDriftBanner agentId={1} />);
    await waitFor(() => expect(getAgentTemplateStatus).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when template is unknown to the registry", async () => {
    getAgentTemplateStatus.mockResolvedValue({
      agent_id: 6,
      template_id: "ghost_template",
      is_in_sync: true,
      stored_hash: "abc",
      current_hash: null,
      drift_fields: [],
      template_unknown: true,
    });
    const { container } = render(<TemplateDriftBanner agentId={6} />);
    await waitFor(() => expect(getAgentTemplateStatus).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner with drift fields when out of sync", async () => {
    getAgentTemplateStatus.mockResolvedValue({
      agent_id: 6,
      template_id: "ar_assistant",
      is_in_sync: false,
      stored_hash: "abc",
      current_hash: "def",
      drift_fields: ["agent_instruction", "agent_tools"],
    });
    render(<TemplateDriftBanner agentId={6} />);
    await waitFor(() =>
      expect(screen.getByText(/ar_assistant/)).toBeTruthy(),
    );
    expect(screen.getByText(/agent_instruction, agent_tools/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Update from template/i })).toBeTruthy();
  });

  it("strips the 'agent' prefix from agentId when calling the API", async () => {
    getAgentTemplateStatus.mockResolvedValue({
      agent_id: 6,
      template_id: "ar_assistant",
      is_in_sync: true,
      stored_hash: "abc",
      current_hash: "abc",
      drift_fields: [],
    });
    render(<TemplateDriftBanner agentId="agent6" />);
    await waitFor(() =>
      expect(getAgentTemplateStatus).toHaveBeenCalledWith("6"),
    );
  });

  it("calls resyncAgentTemplate after confirmation and fires onResynced", async () => {
    getAgentTemplateStatus.mockResolvedValue({
      agent_id: 6,
      template_id: "ar_assistant",
      is_in_sync: false,
      stored_hash: "abc",
      current_hash: "def",
      drift_fields: ["agent_instruction"],
    });
    resyncAgentTemplate.mockResolvedValue({
      agent_id: 6,
      template_id: "ar_assistant",
      is_in_sync: true,
      stored_hash: "def",
      current_hash: "def",
      drift_fields: [],
    });

    const onResynced = vi.fn();
    render(<TemplateDriftBanner agentId={6} onResynced={onResynced} />);

    const updateBtn = await screen.findByRole("button", {
      name: /Update from template/i,
    });
    fireEvent.click(updateBtn);

    const confirmBtn = await screen.findByRole("button", {
      name: /Confirm resync/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(resyncAgentTemplate).toHaveBeenCalledWith("6"));
    await waitFor(() => expect(onResynced).toHaveBeenCalledTimes(1));
    expect(onResynced.mock.calls[0][0]).toMatchObject({
      template_id: "ar_assistant",
      is_in_sync: true,
    });
  });
});
