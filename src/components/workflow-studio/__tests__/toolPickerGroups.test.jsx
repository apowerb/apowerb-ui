/**
 * Tool picker grouping (roadmap #102): the flat tool <select> in the tool
 * node's inspector is split into three optgroups - the caller's own tool
 * configurations, catalog tools ready to use, and catalog tools that still
 * need a configuration - in that order. The last group is collapsed by
 * default and links to the Tool Box instead of duplicating its setup flow.
 *
 * Mirrors toolArgsForm.test.jsx's harness (only `@/lib/api` is mocked, so
 * `useToolSchemas()` and `StudioInspector` run as production code).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import { useToolSchemas } from "@/components/workflow-studio/hooks/useToolSchemas";
import { graphToFlow } from "@/lib/workflowGraph";

const { getToolSchema } = vi.hoisted(() => ({ getToolSchema: vi.fn() }));
vi.mock("@/lib/api", () => ({ getToolSchema }));

const trigger = { id: "t", type: "trigger", config: {} };

const toolOptions = [
  // catalog, ready to use
  { value: "erp.get_order", label: "Get order (erp)", source: "catalog", needsConfig: false },
  { value: "erp.list_clients", label: "List clients (erp)", source: "catalog", needsConfig: false },
  // catalog, needs configuration
  { value: "weather.get_weather", label: "Get weather (weather)", source: "catalog", needsConfig: true },
  // catalog, no needs_config field at all - an older core that has not
  // shipped the flag yet. Must fall back to "needs config", never "ready".
  { value: "legacy.tool", label: "Legacy tool (legacy)", source: "catalog" },
  // the caller's own tool configuration
  { value: "tool_config7", label: "My CRM config", source: "config" },
];

function Inspector({ nodeId, onConfig }) {
  const graph = { nodes: [trigger, { id: "n", type: "tool", config: { tool: "", args: {} } }], edges: [{ source: "t", target: "n" }] };
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const { schemas, ensure } = useToolSchemas();
  const node = flow.nodes.find((n) => n.id === nodeId);
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
      onPatchConfig={(id, partial) => {
        setFlow((f) => ({
          ...f,
          nodes: f.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...partial } } } : n)),
        }));
        onConfig?.(partial);
      }}
      onChangeEdgeRoute={() => {}}
      onDeleteNode={() => {}}
      onDeleteEdge={() => {}}
      onOpenLoopBody={() => {}}
    />
  );
}

beforeEach(() => {
  getToolSchema.mockReset();
  getToolSchema.mockResolvedValue({ tool: "x", params: [], accepts_kwargs: true, needs_agent_context: false });
});

describe("tool picker grouping", () => {
  it("renders the three groups in order, with the right items in each", () => {
    render(<Inspector nodeId="n" />);
    const picker = screen.getByRole("combobox", { name: /^Tool$/ });
    const groups = within(picker).getAllByRole("group");

    expect(groups.map((g) => g.getAttribute("label"))).toEqual(["My configurations", "Ready to use", "Needs configuration"]);
    expect(within(groups[0]).getAllByRole("option").map((o) => o.value)).toEqual(["tool_config7"]);
    expect(within(groups[1]).getAllByRole("option").map((o) => o.value)).toEqual(["erp.get_order", "erp.list_clients"]);
  });

  it("treats an item with no needs_config field as needing configuration, same as needsConfig: true", async () => {
    render(<Inspector nodeId="n" />);
    const picker = screen.getByRole("combobox", { name: /^Tool$/ });
    const needsConfigGroup = within(picker).getAllByRole("group")[2];

    // Collapsed by default: neither option is rendered yet.
    expect(within(needsConfigGroup).queryAllByRole("option")).toHaveLength(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Needs configuration \(2\)/ }));
    const expanded = within(picker).getAllByRole("group")[2];
    expect(within(expanded).getAllByRole("option").map((o) => o.value)).toEqual(["weather.get_weather", "legacy.tool"]);
  });

  it("keeps the needs-config group collapsed by default and expands it on click, with a link to the Tool Box", async () => {
    const user = userEvent.setup();
    render(<Inspector nodeId="n" />);
    const toggle = screen.getByRole("button", { name: /Needs configuration \(2\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const link = screen.getByRole("link", { name: "Open the Tool Box" });
    expect(link).toHaveAttribute("href", "/tool-box");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const picker = screen.getByRole("combobox", { name: /^Tool$/ });
    const needsConfigGroup = within(picker).getAllByRole("group")[2];
    expect(within(needsConfigGroup).getAllByRole("option").map((o) => o.value)).toEqual(["weather.get_weather", "legacy.tool"]);
  });

  it("still filters the picker by search text across groups, and reveals a collapsed-group match", async () => {
    const user = userEvent.setup();
    render(<Inspector nodeId="n" />);
    const picker = screen.getByRole("combobox", { name: /^Tool$/ });

    await user.type(screen.getByRole("searchbox", { name: /Search tools/i }), "weather");

    // "weather.get_weather" lives in the collapsed "needs config" group -
    // an active search reveals its own matches without a manual expand.
    expect(within(picker).getAllByRole("option").map((o) => o.value)).toEqual(["", "weather.get_weather"]);
  });

  it("still lets the user pick a tool, from a group that is visible by default", async () => {
    const onConfig = vi.fn();
    const user = userEvent.setup();
    render(<Inspector nodeId="n" onConfig={onConfig} />);
    const picker = screen.getByRole("combobox", { name: /^Tool$/ });

    await user.selectOptions(picker, "erp.list_clients");

    expect(onConfig).toHaveBeenCalledWith({ tool: "erp.list_clients" });
    expect(picker).toHaveValue("erp.list_clients");
  });

  it("keeps an already-selected needs-config tool visible even while the group stays collapsed", async () => {
    function SelectedInspector() {
      const graph = { nodes: [trigger, { id: "n", type: "tool", config: { tool: "weather.get_weather", args: {} } }], edges: [{ source: "t", target: "n" }] };
      const [flow] = useState(() => graphToFlow(graph));
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
    render(<SelectedInspector />);
    await waitFor(() => expect(getToolSchema).toHaveBeenCalledWith("weather.get_weather", expect.anything()));
    const picker = screen.getByRole("combobox", { name: /^Tool$/ });
    expect(picker).toHaveValue("weather.get_weather");
    // Still collapsed - the toggle has not been clicked.
    expect(screen.getByRole("button", { name: /Needs configuration \(2\)/ })).toHaveAttribute("aria-expanded", "false");
  });
});
