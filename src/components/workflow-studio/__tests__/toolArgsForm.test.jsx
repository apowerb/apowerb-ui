/**
 * Generated tool-args form (21/09): the inspector's `tool` node renders one
 * field per parameter from `GET /api/workflows/tools/schema`, cached per
 * tool_ref through the real `useToolSchemas()` hook (only `@/lib/api` is
 * mocked, so the caching/race behaviour under test is production code, not
 * a stub of it).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import { useToolSchemas } from "@/components/workflow-studio/hooks/useToolSchemas";
import { graphToFlow, validateGraphLocal } from "@/lib/workflowGraph";

const { getToolSchema } = vi.hoisted(() => ({ getToolSchema: vi.fn() }));
vi.mock("@/lib/api", () => ({ getToolSchema }));

const trigger = { id: "t", type: "trigger", config: {} };
// needsConfig: false keeps both tools in the visible "ready to use" group so
// this file, which is about the generated-schema form and not the grouping
// UI itself, does not have to expand the collapsed "needs config" group.
const toolOptions = [
  { value: "demo.tool", label: "Demo tool", needsConfig: false },
  { value: "demo.other", label: "Other tool", needsConfig: false },
];

function demoSchema(overrides = {}) {
  return {
    tool: "demo.tool",
    description: "A demo tool",
    params: [
      { name: "url", type: "string", required: true, description: "Target URL" },
      { name: "retries", type: "integer", required: false, default: 3, description: "Retry count" },
      { name: "verbose", type: "boolean", required: false, default: false },
      { name: "payload", type: "object", required: false, description: "Request body" },
      { name: "mode", type: "string", required: false, enum: ["fast", "slow"] },
    ],
    accepts_kwargs: false,
    needs_agent_context: false,
    ...overrides,
  };
}

function otherSchema() {
  return {
    tool: "demo.other",
    description: "Another tool",
    params: [{ name: "query", type: "string", required: true, description: "Search text" }],
    accepts_kwargs: false,
    needs_agent_context: false,
  };
}

/** Mirrors WorkflowStudio: one shared `useToolSchemas()` cache handed down to the inspector. */
function Inspector({ graph, nodeId, onConfig }) {
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

/** Two independent tool nodes so selection can move between them without unmounting the cache. */
function TwoNodeInspector({ graph, initialNodeId, onConfig }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const [nodeId, setNodeId] = useState(initialNodeId);
  const { schemas, ensure } = useToolSchemas();
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <>
      <button type="button" onClick={() => setNodeId("a")}>select a</button>
      <button type="button" onClick={() => setNodeId("b")}>select b</button>
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
    </>
  );
}

beforeEach(() => {
  getToolSchema.mockReset();
});

describe("generated tool args form", () => {
  it("renders one field per parameter family, plus the enum dropdown", async () => {
    getToolSchema.mockResolvedValue(demoSchema());
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: {} } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
      />,
    );

    // string (required — labelled with a trailing "*")
    expect(await screen.findByLabelText(/^url \*/)).toBeInTheDocument();
    // number/integer — still a template-capable text field, with the default as placeholder
    expect(screen.getByLabelText(/^retries$/)).toHaveAttribute("placeholder", "3");
    // boolean — a switch
    expect(screen.getByRole("switch", { name: /^verbose$/ })).toBeInTheDocument();
    // array/object/any — a JSON textarea
    expect(screen.getByLabelText(/^payload$/).tagName).toBe("TEXTAREA");
    // enum — a dropdown with exactly the declared options plus the unset one
    const modeSelect = screen.getByLabelText(/^mode$/);
    expect(modeSelect.tagName).toBe("SELECT");
    expect(Array.from(modeSelect.options).map((o) => o.value)).toEqual(["", "fast", "slow"]);
  });

  it("writes typed values into config.args", async () => {
    getToolSchema.mockResolvedValue(demoSchema());
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: {} } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
        onConfig={(p) => patches.push(p)}
      />,
    );

    await user.type(await screen.findByLabelText(/^url \*/), "https://x");
    expect(patches.at(-1)).toEqual({ args: { url: "https://x" } });

    await user.click(screen.getByRole("switch", { name: /^verbose$/ }));
    expect(patches.at(-1)).toEqual({ args: { url: "https://x", verbose: true } });

    await user.selectOptions(screen.getByLabelText(/^mode$/), "fast");
    expect(patches.at(-1)).toEqual({ args: { url: "https://x", verbose: true, mode: "fast" } });
  });

  it("clearing a field removes its key so the tool's default applies", async () => {
    getToolSchema.mockResolvedValue(demoSchema());
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: { url: "https://x", mode: "fast" } } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
        onConfig={(p) => patches.push(p)}
      />,
    );

    await user.clear(await screen.findByLabelText(/^url \*/));
    expect(patches.at(-1)).toEqual({ args: { mode: "fast" } });

    await user.selectOptions(screen.getByLabelText(/^mode$/), "");
    expect(patches.at(-1)).toEqual({ args: {} });
  });

  it("fetches a tool's schema only once even across two selections", async () => {
    getToolSchema.mockResolvedValue(demoSchema());
    render(
      <TwoNodeInspector
        graph={{
          nodes: [
            trigger,
            { id: "a", type: "tool", config: { tool: "demo.tool", args: {} } },
            { id: "b", type: "tool", config: { tool: "demo.tool", args: {} } },
          ],
          edges: [{ source: "t", target: "a" }, { source: "t", target: "b" }],
        }}
        initialNodeId="a"
      />,
    );

    await screen.findByLabelText(/^url \*/);
    expect(getToolSchema).toHaveBeenCalledTimes(1);

    const user = userEvent.setup();
    await user.click(screen.getByText("select b"));
    await screen.findByLabelText(/^url \*/);
    expect(getToolSchema).toHaveBeenCalledTimes(1);
  });

  it("switching the picker to another tool fetches and renders that tool's own fields", async () => {
    getToolSchema.mockImplementation((tool) => (tool === "demo.tool" ? Promise.resolve(demoSchema()) : Promise.resolve(otherSchema())));
    const user = userEvent.setup();
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: {} } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
      />,
    );
    await screen.findByLabelText(/^url \*/);

    await user.selectOptions(screen.getByRole("combobox", { name: /^Tool$/ }), "demo.other");
    expect(await screen.findByLabelText(/^query \*/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^url \*/)).not.toBeInTheDocument();
    expect(getToolSchema).toHaveBeenCalledWith("demo.tool", expect.anything());
    expect(getToolSchema).toHaveBeenCalledWith("demo.other", expect.anything());
  });

  it("accepts_kwargs: true shows unmatched args in an editable 'other arguments' section", async () => {
    getToolSchema.mockResolvedValue(demoSchema({ accepts_kwargs: true }));
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: { url: "https://x", extra_flag: "on" } } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
      />,
    );
    await screen.findByLabelText(/^url \*/);
    expect(screen.getByText(/Other arguments/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("extra_flag")).toBeInTheDocument();
    expect(screen.getByDisplayValue("on")).toBeInTheDocument();
  });

  it("accepts_kwargs: false flags unmatched args as unknown, removable on click", async () => {
    getToolSchema.mockResolvedValue(demoSchema({ accepts_kwargs: false }));
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: { url: "https://x", extra_flag: "on" } } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
        onConfig={(p) => patches.push(p)}
      />,
    );
    await screen.findByLabelText(/^url \*/);
    expect(screen.getByText(/isn't a parameter of this tool/i)).toBeInTheDocument();

    await user.click(screen.getByTitle("Remove"));
    expect(patches.at(-1)).toEqual({ args: { url: "https://x" } });
  });

  it("falls back to the free-form args editor when the schema fails to load", async () => {
    getToolSchema.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: { anything: "1" } } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
      />,
    );
    expect(await screen.findByText(/free-form editor/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("anything")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
  });

  it("warns when a tool only works inside an agent node", async () => {
    getToolSchema.mockResolvedValue(demoSchema({ needs_agent_context: true }));
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: {} } }], edges: [{ source: "t", target: "n" }] }}
        nodeId="n"
      />,
    );
    expect(await screen.findByText(/only works inside an agent node/i)).toBeInTheDocument();
  });
});

describe("required tool args in graph validation", () => {
  it("warns (without blocking) when a required parameter has no value", () => {
    const toolSchemas = { "demo.tool": { status: "ready", schema: demoSchema() } };
    const graph = {
      nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: {} } }],
      edges: [{ source: "t", target: "n" }],
    };

    const { valid, errors } = validateGraphLocal(graph, { toolSchemas });
    const warning = errors.find((e) => e.message === "toolMissingRequiredArg:url");
    expect(warning).toEqual({ nodeId: "n", message: "toolMissingRequiredArg:url", level: "warning" });
    expect(valid).toBe(true); // a warning never blocks validity
  });

  it("stays quiet once the required parameter is filled in", () => {
    const toolSchemas = { "demo.tool": { status: "ready", schema: demoSchema() } };
    const graph = {
      nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: { url: "https://x" } } }],
      edges: [{ source: "t", target: "n" }],
    };

    const { errors } = validateGraphLocal(graph, { toolSchemas });
    expect(errors.some((e) => e.message.startsWith("toolMissingRequiredArg"))).toBe(false);
  });

  it("skips the check entirely when the schema isn't cached yet", () => {
    const graph = {
      nodes: [trigger, { id: "n", type: "tool", config: { tool: "demo.tool", args: {} } }],
      edges: [{ source: "t", target: "n" }],
    };
    const { errors } = validateGraphLocal(graph); // no ctx at all — existing callers are unaffected
    expect(errors.some((e) => e.message.startsWith("toolMissingRequiredArg"))).toBe(false);
  });
});
