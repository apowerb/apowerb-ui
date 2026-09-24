/**
 * Badge ambre "Preview" dans la barre du studio de workflows (roadmap#100).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

import StudioTopBar from "@/components/workflow-studio/StudioTopBar";

const baseProps = {
  name: "Lead triage",
  onNameChange: vi.fn(),
  status: "draft",
  version: 1,
  saveState: "idle",
  validation: { errors: [] },
  onOpenVersions: vi.fn(),
  onExport: vi.fn(),
  testOpen: false,
  onToggleTest: vi.fn(),
  onPublish: vi.fn(),
  onUnpublish: vi.fn(),
  publishing: false,
  conflict: null,
  onReloadConflict: vi.fn(),
};

describe("Badge Preview — barre du studio (roadmap#100)", () => {
  it("affiche le badge Preview avec son infobulle dans la barre du studio", () => {
    render(<StudioTopBar {...baseProps} />);
    const badge = screen.getByTestId("preview-badge");
    expect(badge).toHaveTextContent("Preview");
    expect(badge).toHaveAttribute("title", "Preview feature — feedback welcome");
  });
});
