/**
 * Agent tool picker (AgentModal -> ToolsSection -> AddToolPanel). Confirms
 * a published workflow tool (`workflow:<tool_name>`, T2) renders its clean
 * leaf name here too, same as every other namespaced tool — the category
 * badge already says "workflow", repeating it in the row label would be
 * redundant. No description is rendered for ANY tool in this picker
 * (server contract for `/api/tools` is `{category: [name, ...]}`, no
 * description field) — nothing to add there.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AddToolPanel from "@/components/agent-modal/AddToolPanel";

function baseProps(overrides = {}) {
  return {
    allTools: {},
    addToolError: "",
    toolSearch: "",
    setToolSearch: vi.fn(),
    selectedNewTool: null,
    newToolParams: [],
    newToolValues: {},
    setNewToolValues: vi.fn(),
    newToolConfigName: "",
    setNewToolConfigName: vi.fn(),
    addingTool: false,
    onSelectNewTool: vi.fn(),
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onCreate: vi.fn(),
    ...overrides,
  };
}

describe("AddToolPanel", () => {
  it("shows a published workflow tool's clean leaf name under its category badge", () => {
    render(<AddToolPanel {...baseProps({ allTools: { workflow: ["workflow:send_report"] } })} />);

    expect(screen.getByText("send_report")).toBeInTheDocument();
    expect(screen.queryByText("workflow:send_report")).not.toBeInTheDocument();
    // Category header + per-row badge both say "workflow" (pre-existing, every category).
    expect(screen.getAllByText("workflow")).toHaveLength(2);
  });
});
