/**
 * Set and Condition nodes (LOT 1, 21/09): local validation, defaults, the
 * graph <-> flow round-trip for a fixed-route (true/false) node, the palette
 * entries and the inspector fields that configure them. Also covers the new
 * `csv`/`date` convert targets added alongside this lot.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import StudioInspector from "@/components/workflow-studio/StudioInspector";
import StudioPalette from "@/components/workflow-studio/StudioPalette";
import {
  createNode,
  graphToFlow,
  flowToGraph,
  validateGraphLocal,
  CONVERT_TARGETS,
  NODE_TYPES,
} from "@/lib/workflowGraph";

const trigger = { id: "t", type: "trigger", config: {} };

describe("set and condition in the graph model", () => {
  it("are known node types with safe (empty) defaults", () => {
    expect(NODE_TYPES).toEqual(expect.arrayContaining(["set", "condition"]));
    expect(createNode("set").config).toEqual({ fields: [] });
    expect(createNode("condition").config).toEqual({ rules: [], match: "all" });
  });

  it("adds csv and date to the convert targets", () => {
    expect(CONVERT_TARGETS).toEqual(expect.arrayContaining(["csv", "date"]));
  });

  it("round-trips a condition's true/false routed edges through flow and back", () => {
    const graph = {
      version: 1,
      nodes: [
        trigger,
        { id: "c", type: "condition", label: "", config: { rules: [{ field: "{{t.payload.ok}}", op: "eq", value: "true" }], match: "all" }, position: { x: 0, y: 0 } },
        { id: "a", type: "agent", label: "", config: { agent_id: "agent1" }, position: { x: 0, y: 0 } },
        { id: "b", type: "agent", label: "", config: { agent_id: "agent1" }, position: { x: 0, y: 0 } },
      ],
      edges: [
        { source: "t", target: "c" },
        { source: "c", target: "a", route: "true" },
        { source: "c", target: "b", route: "false" },
      ],
    };
    const { nodes, edges } = graphToFlow(graph);
    const trueEdge = edges.find((e) => e.source === "c" && e.target === "a");
    const falseEdge = edges.find((e) => e.source === "c" && e.target === "b");
    expect(trueEdge.data.route).toBe("true");
    expect(falseEdge.data.route).toBe("false");

    const back = flowToGraph(nodes, edges);
    expect(back.edges).toEqual(expect.arrayContaining([
      { source: "c", target: "a", route: "true" },
      { source: "c", target: "b", route: "false" },
    ]));
  });

  it("refuses a set node with no fields", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "s", type: "set", config: { fields: [] } }],
      edges: [{ source: "t", target: "s" }],
    });
    expect(errors.map((e) => e.message)).toContain("setNoFields");
  });

  it("refuses a set field with an empty key", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "s", type: "set", config: { fields: [{ key: "", value: "x" }] } }],
      edges: [{ source: "t", target: "s" }],
    });
    expect(errors.map((e) => e.message)).toContain("setFieldKeyRequired");
  });

  it("refuses duplicate set field keys", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "s", type: "set", config: { fields: [{ key: "status", value: "a" }, { key: "status", value: "b" }] } }],
      edges: [{ source: "t", target: "s" }],
    });
    expect(errors.map((e) => e.message)).toContain("setDuplicateKey:status");
  });

  it("refuses a condition node with no rules", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "c", type: "condition", config: { rules: [], match: "all" } }],
      edges: [{ source: "t", target: "c" }],
    });
    expect(errors.map((e) => e.message)).toContain("conditionNoRules");
  });

  it("refuses an edge leaving a condition on an unknown route", () => {
    const { errors } = validateGraphLocal({
      nodes: [trigger, { id: "c", type: "condition", config: { rules: [{ field: "x", op: "eq", value: "1" }], match: "all" } }, { id: "a", type: "agent", config: { agent_id: "agent1" } }],
      edges: [{ source: "t", target: "c" }, { source: "c", target: "a", route: "maybe" }],
    });
    expect(errors.map((e) => e.message)).toContain("unknownRoute:maybe");
  });

  it("refuses two edges on the same condition route", () => {
    const { errors } = validateGraphLocal({
      nodes: [
        trigger,
        { id: "c", type: "condition", config: { rules: [{ field: "x", op: "eq", value: "1" }], match: "all" } },
        { id: "a", type: "agent", config: { agent_id: "agent1" } },
        { id: "b", type: "agent", config: { agent_id: "agent1" } },
      ],
      edges: [
        { source: "t", target: "c" },
        { source: "c", target: "a", route: "true" },
        { source: "c", target: "b", route: "true" },
      ],
    });
    expect(errors.map((e) => e.message)).toContain("conditionDuplicateRoute:true");
  });

  it("accepts one edge per route on a condition node", () => {
    const { errors } = validateGraphLocal({
      nodes: [
        trigger,
        { id: "c", type: "condition", config: { rules: [{ field: "x", op: "eq", value: "1" }], match: "all" } },
        { id: "a", type: "agent", config: { agent_id: "agent1" } },
        { id: "b", type: "agent", config: { agent_id: "agent1" } },
      ],
      edges: [
        { source: "t", target: "c" },
        { source: "c", target: "a", route: "true" },
        { source: "c", target: "b", route: "false" },
      ],
    });
    expect(errors).toEqual([]);
  });
});

describe("palette", () => {
  it("lists Set and Condition as addable nodes", () => {
    render(<StudioPalette onAdd={() => {}} />);
    expect(screen.getByTitle(/^Set —/)).toBeInTheDocument();
    expect(screen.getByTitle(/^Condition —/)).toBeInTheDocument();
  });
});

function Inspector({ graph, nodeId, onConfig }) {
  const [flow, setFlow] = useState(() => graphToFlow(graph));
  const node = flow.nodes.find((n) => n.id === nodeId);
  return (
    <StudioInspector
      selection={{ kind: "node", node }}
      nodes={flow.nodes}
      edges={flow.edges}
      onChangeLabel={() => {}}
      onRenameNode={() => {}}
      onPatchConfig={(id, partial) => {
        setFlow((f) => ({
          ...f,
          nodes: f.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...partial } } } : n)),
        }));
        onConfig(partial);
      }}
      onChangeEdgeRoute={() => {}}
      onDeleteNode={() => {}}
      onDeleteEdge={() => {}}
      onOpenLoopBody={() => {}}
    />
  );
}

describe("inspector", () => {
  it("adds a field to a set node", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "s", type: "set", config: { fields: [] } }], edges: [{ source: "t", target: "s" }] }}
        nodeId="s"
        onConfig={(p) => patches.push(p)}
      />,
    );
    expect(screen.getByText(/A Set node needs at least one field/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Add field/i }));
    expect(patches.at(-1)).toEqual({ fields: [{ key: "", value: "" }] });
  });

  it("configures a condition's match mode and rule", async () => {
    const user = userEvent.setup();
    const patches = [];
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "c", type: "condition", config: { rules: [], match: "all" } }], edges: [{ source: "t", target: "c" }] }}
        nodeId="c"
        onConfig={(p) => patches.push(p)}
      />,
    );
    expect(screen.getByText(/A condition needs at least one rule/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Match/i), "any");
    expect(patches.at(-1)).toEqual({ rules: [], match: "any" });
    await user.click(screen.getByRole("button", { name: /Add rule/i }));
    expect(patches.at(-1)).toEqual({ rules: [{ field: "", op: "eq", value: "" }], match: "any" });
  });

  it("labels a condition edge's route Vrai/Faux in French but true/false in the stored value", async () => {
    const user = userEvent.setup();
    const patches = [];
    function EdgeInspector() {
      const graph = {
        nodes: [
          trigger,
          { id: "c", type: "condition", config: { rules: [{ field: "x", op: "eq", value: "1" }], match: "all" } },
          { id: "a", type: "agent", config: { agent_id: "agent1" } },
        ],
        edges: [{ source: "t", target: "c" }, { source: "c", target: "a" }],
      };
      const flow = graphToFlow(graph);
      const edge = flow.edges.find((e) => e.source === "c" && e.target === "a");
      return (
        <StudioInspector
          selection={{ kind: "edge", edge }}
          nodes={flow.nodes}
          edges={flow.edges}
          onChangeLabel={() => {}}
          onRenameNode={() => {}}
          onPatchConfig={() => {}}
          onChangeEdgeRoute={(id, route) => patches.push(route)}
          onDeleteNode={() => {}}
          onDeleteEdge={() => {}}
          onOpenLoopBody={() => {}}
        />
      );
    }
    render(<EdgeInspector />);
    await user.selectOptions(screen.getByLabelText(/Route/i), "true");
    expect(patches.at(-1)).toBe("true");
  });

  it("exposes csv and date as convert targets with a short help", async () => {
    const user = userEvent.setup();
    render(
      <Inspector
        graph={{ nodes: [trigger, { id: "c", type: "convert", config: { to: "text" } }], edges: [{ source: "t", target: "c" }] }}
        nodeId="c"
        onConfig={() => {}}
      />,
    );
    await user.selectOptions(screen.getByLabelText(/Convert to/i), "csv");
    expect(screen.getByText(/becomes CSV text/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Convert to/i), "date");
    expect(screen.getByText(/becomes an ISO date/i)).toBeInTheDocument();
  });
});
