/**
 * apowerb roadmap #103: the tool picker (native <select> in the "tool" node
 * inspector) now shows the selected tool's provider logo next to it, based
 * on the tool's category. Kept minimal on purpose (no custom dropdown/
 * per-<option> icon — native <option> elements cannot render markup in any
 * browser) to avoid conflicting with the #102 branch, which restructures
 * this same menu into three groups.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import { useToolSchemas } from "@/components/workflow-studio/hooks/useToolSchemas";
import { graphToFlow } from "@/lib/workflowGraph";

const { getToolSchema } = vi.hoisted(() => ({ getToolSchema: vi.fn() }));
vi.mock("@/lib/api", () => ({ getToolSchema }));

const trigger = { id: "t", type: "trigger", config: {} };

const toolOptions = [
  { value: "gmail.tool_send", label: "send (gmail)", category: "tools_google_gmail" },
  { value: "db.tool_query", label: "query (database)", category: "tools_database" },
  { value: "weather.get", label: "get (weather)", category: "tools_weather" },
];

function Inspector({ nodeId }) {
  const [flow] = useState(() =>
    graphToFlow({
      nodes: [trigger, { id: "n", type: "tool", config: { tool: nodeId ? toolOptions.find((o) => o.value === nodeId)?.value : undefined, args: {} } }],
      edges: [{ source: "t", target: "n" }],
    }),
  );
  const { schemas, ensure } = useToolSchemas();
  const node = flow.nodes.find((n) => n.id === "n");
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      toolOptions={toolOptions}
      toolSchemas={schemas}
      ensureToolSchema={ensure}
      onChangeLabel={() => {}}
      onRenameNode={() => {}}
      onPatchConfig={() => {}}
      onChangeEdgeRoute={() => {}}
      onDeleteNode={() => {}}
      onDeleteEdge={() => {}}
      onOpenLoopBody={() => {}}
    />
  );
}

beforeEach(() => {
  getToolSchema.mockReset();
  getToolSchema.mockResolvedValue({ tool: "x", params: [], accepts_kwargs: false, needs_agent_context: false });
});

describe("ToolPicker logo", () => {
  it("shows the generic fallback icon when no tool is selected", () => {
    render(<Inspector nodeId={undefined} />);
    const logo = screen.getByTestId("tool-picker-logo");
    expect(logo.querySelector("svg.lucide-wrench")).not.toBeNull();
  });

  it("shows the gmail logo when a gmail-category tool is selected", () => {
    render(<Inspector nodeId="gmail.tool_send" />);
    const logo = screen.getByTestId("tool-picker-logo");
    // GmailIcon's distinctive viewBox from integrationLogos.jsx
    expect(logo.querySelector('svg[viewBox="52 42 88 66"]')).not.toBeNull();
  });

  it("shows the database icon when a database-category tool is selected", () => {
    render(<Inspector nodeId="db.tool_query" />);
    const logo = screen.getByTestId("tool-picker-logo");
    expect(logo.querySelector("svg.lucide-database")).not.toBeNull();
  });

  it("falls back to the generic icon for an unmapped category", () => {
    render(<Inspector nodeId="weather.get" />);
    const logo = screen.getByTestId("tool-picker-logo");
    expect(logo.querySelector("svg.lucide-wrench")).not.toBeNull();
  });
  it("shows a provider logo larger, on a light background", () => {
    render(<Inspector nodeId="gmail.tool_send" />);
    const logo = screen.getByTestId("tool-picker-logo");
    expect(logo.dataset.variant).toBe("logo");
    expect(logo.className).toContain("bg-white");
    expect(logo.querySelector("svg").getAttribute("width")).toBe("18");
  });

  it("keeps the themed background for generic icons", () => {
    render(<Inspector nodeId="db.tool_query" />);
    const logo = screen.getByTestId("tool-picker-logo");
    expect(logo.dataset.variant).toBe("plain");
    expect(logo.className).not.toContain("bg-white");
  });
});
