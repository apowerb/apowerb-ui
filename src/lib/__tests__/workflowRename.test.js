import { describe, it, expect } from "vitest";
import { graphToFlow, flowToGraph, renameNodeId, nodeIdRenameError, filterToolOptions } from "@/lib/workflowGraph";

const GRAPH = {
  version: 1,
  nodes: [
    { id: "start", type: "trigger", config: {} },
    { id: "lookup", type: "tool", config: { tool: "erp.get", args: { id: "{{start.order_id}}" } } },
    {
      id: "prio",
      type: "router",
      config: { rules: [{ route: "urgent", field: "{{ lookup.amount }}", op: "gt", value: 10 }], default_route: "lookup" },
    },
    { id: "lookup2", type: "agent", config: { agent_id: "agent1", input: "{{lookup2.x}} {{lookup}} {{lookupx.y}}" } },
    {
      id: "loop",
      type: "loop",
      config: {
        mode: "foreach",
        items: "{{lookup.items}}",
        body: {
          version: 1,
          nodes: [
            { id: "trigger1", type: "trigger", config: {} },
            { id: "lookup", type: "tool", config: { tool: "erp.get" } },
            { id: "w", type: "agent", config: { input: "{{lookup.item}}" } },
          ],
          edges: [],
        },
      },
    },
  ],
  edges: [
    { source: "start", target: "lookup" },
    { source: "lookup", target: "prio" },
    { source: "prio", target: "lookup2", route: "urgent" },
  ],
};

describe("renameNodeId", () => {
  const { nodes, edges } = graphToFlow(GRAPH);
  const out = renameNodeId(nodes, edges, "lookup", "order");
  const g = flowToGraph(out.nodes, out.edges);
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));

  it("renames the node and every edge touching it", () => {
    expect(g.nodes.map((n) => n.id)).toEqual(["start", "order", "prio", "lookup2", "loop"]);
    expect(g.edges).toEqual([
      { source: "start", target: "order" },
      { source: "order", target: "prio" },
      { source: "prio", target: "lookup2", route: "urgent" },
    ]);
  });

  it("rewrites templates in every top-level config, rules included", () => {
    expect(byId.prio.config.rules[0].field).toBe("{{ order.amount }}");
    expect(byId.loop.config.items).toBe("{{order.items}}");
  });

  it("leaves loop bodies alone: a body has its own id space", () => {
    const body = byId.loop.config.body;
    expect(body.nodes.map((n) => n.id)).toEqual(["trigger1", "lookup", "w"]);
    expect(body.nodes[2].config.input).toBe("{{lookup.item}}");
  });

  it("leaves ids that merely share a prefix, and route labels, untouched", () => {
    expect(byId.lookup2.config.input).toBe("{{lookup2.x}} {{order}} {{lookupx.y}}");
    expect(byId.prio.config.default_route).toBe("lookup");
    expect(byId.prio.config.rules[0].route).toBe("urgent");
  });

  it("does not mutate its input", () => {
    expect(nodes[1].id).toBe("lookup");
    expect(edges[0].target).toBe("lookup");
  });
});

describe("nodeIdRenameError", () => {
  const ids = ["start", "lookup"];
  it("accepts a new valid id and the unchanged id", () => {
    expect(nodeIdRenameError("order_2", "lookup", ids)).toBeNull();
    expect(nodeIdRenameError("lookup", "lookup", ids)).toBeNull();
  });
  it("rejects duplicates and ids the server would refuse", () => {
    expect(nodeIdRenameError("start", "lookup", ids)).toBe("duplicate");
    expect(nodeIdRenameError("2fast", "lookup", ids)).toBe("invalid");
    expect(nodeIdRenameError("with space", "lookup", ids)).toBe("invalid");
    expect(nodeIdRenameError("", "lookup", ids)).toBe("invalid");
  });
});

describe("filterToolOptions", () => {
  const options = [
    { value: "erp.tool_get_order", label: "ERP — Get order" },
    { value: "weather.get_weather", label: "Weather" },
    { value: "mail.send", label: "Send mail" },
  ];
  it("matches label or value, case- and accent-insensitively", () => {
    expect(filterToolOptions(options, "ORDER").map((o) => o.value)).toEqual(["erp.tool_get_order"]);
    expect(filterToolOptions(options, "wéather").map((o) => o.value)).toEqual(["weather.get_weather"]);
    expect(filterToolOptions(options, "mail send").map((o) => o.value)).toEqual(["mail.send"]);
  });
  it("returns everything for an empty query", () => {
    expect(filterToolOptions(options, "  ")).toHaveLength(3);
  });
});
