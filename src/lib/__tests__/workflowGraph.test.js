import { describe, it, expect } from "vitest";
import {
  NODE_ID_PATTERN,
  nextNodeId,
  createNode,
  duplicateNode,
  graphToFlow,
  flowToGraph,
  getUpstreamNodeIds,
  extractTemplateRefs,
  templateSuggestionsFor,
  validateGraphLocal,
  autoLayout,
  isRunnableType,
  createLoopBody,
  parseValidationMessage,
} from "@/lib/workflowGraph";

describe("parseValidationMessage", () => {
  it("splits code:value pairs and leaves bare codes alone", () => {
    expect(parseValidationMessage("unknownRoute:maybe")).toEqual({ code: "unknownRoute", value: "maybe" });
    expect(parseValidationMessage("classifierNeedsTwoRoutes")).toEqual({ code: "classifierNeedsTwoRoutes", value: null });
    expect(parseValidationMessage("templateNotUpstream:{{agentC.output}}")).toEqual({ code: "templateNotUpstream", value: "{{agentC.output}}" });
  });
});

describe("nextNodeId", () => {
  it("starts at 1 and matches the id pattern", () => {
    const id = nextNodeId("agent", []);
    expect(id).toBe("agent1");
    expect(NODE_ID_PATTERN.test(id)).toBe(true);
  });

  it("skips ids already in use", () => {
    expect(nextNodeId("agent", ["agent1", "agent2"])).toBe("agent3");
  });
});

describe("createNode / duplicateNode", () => {
  it("gives each type a sensible default config", () => {
    expect(createNode("trigger").config).toEqual({ kind: "manual" });
    expect(createNode("router").config).toEqual({ rules: [], default_route: "" });
    expect(createNode("classifier").config).toEqual({ agent_id: "", routes: [] });
    expect(createNode("merge").config).toEqual({});
  });

  it("duplicates with a new id and an independent config copy", () => {
    const original = createNode("agent", { id: "agent1", position: { x: 10, y: 10 } });
    original.config.agent_id = "agent7";
    const copy = duplicateNode(original, ["agent1"]);

    expect(copy.id).toBe("agent2");
    expect(copy.config.agent_id).toBe("agent7");
    expect(copy.position).toEqual({ x: 58, y: 58 });

    copy.config.agent_id = "agent9";
    expect(original.config.agent_id).toBe("agent7"); // no shared reference
  });
});

describe("graphToFlow / flowToGraph round trip", () => {
  const graph = {
    version: 1,
    nodes: [
      { id: "trigger1", type: "trigger", label: "Start", config: { kind: "manual" }, position: { x: 0, y: 0 } },
      { id: "router1", type: "router", label: "Split", config: { rules: [{ route: "a", field: "{{trigger1.payload}}", op: "eq", value: 1 }] }, position: { x: 200, y: 0 } },
    ],
    edges: [{ source: "trigger1", target: "router1", route: undefined }],
  };

  it("converts to xyflow shape and back to the same graph", () => {
    const { nodes, edges } = graphToFlow(graph);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe("trigger");
    expect(nodes[0].data.config).toEqual({ kind: "manual" });
    expect(edges[0].source).toBe("trigger1");

    const roundTripped = flowToGraph(nodes, edges);
    expect(roundTripped.nodes[1].config.rules[0].route).toBe("a");
    expect(roundTripped.edges[0]).toEqual({ source: "trigger1", target: "router1" });
  });

  it("keeps a route label through the round trip", () => {
    const withRoute = { ...graph, edges: [{ source: "trigger1", target: "router1", route: "a" }] };
    const { nodes, edges } = graphToFlow(withRoute);
    const back = flowToGraph(nodes, edges);
    expect(back.edges[0]).toEqual({ source: "trigger1", target: "router1", route: "a" });
  });

  // xyflow reserves "input"/"default"/"output"/"group" as built-in node type
  // names and styles `.react-flow__node-<type>` itself (fixed width, white
  // background, dark border) — our own "output" node type collides, and
  // that default styling rendered behind our custom card, showing as a
  // white rectangle once selected. This marker class lets globals.css
  // reset just that collision.
  it("marks output nodes so their xyflow reserved-type-name collision can be reset in CSS", () => {
    const { nodes } = graphToFlow({
      version: 1,
      nodes: [{ id: "out1", type: "output", config: {}, position: { x: 0, y: 0 } }],
      edges: [],
    });
    expect(nodes[0].className).toBe("workflow-output-node");
  });

  it("does not mark other node types", () => {
    const { nodes } = graphToFlow({
      version: 1,
      nodes: [{ id: "agent1", type: "agent", config: {}, position: { x: 0, y: 0 } }],
      edges: [],
    });
    expect(nodes[0].className).toBeUndefined();
  });
});

describe("getUpstreamNodeIds", () => {
  // trigger1 -> tool1 -> router1 -> {agentA, agentB} -> merge1
  const edges = [
    { source: "trigger1", target: "tool1" },
    { source: "tool1", target: "router1" },
    { source: "router1", target: "agentA", route: "x" },
    { source: "router1", target: "agentB", route: "y" },
    { source: "agentA", target: "merge1" },
    { source: "agentB", target: "merge1" },
  ];

  it("finds every ancestor, not just direct parents", () => {
    const upstream = getUpstreamNodeIds("merge1", edges);
    expect(new Set(upstream)).toEqual(new Set(["agentA", "agentB", "router1", "tool1", "trigger1"]));
  });

  it("returns an empty list for a source node", () => {
    expect(getUpstreamNodeIds("trigger1", edges)).toEqual([]);
  });
});

describe("extractTemplateRefs / templateSuggestionsFor", () => {
  it("finds refs nested inside arrays and objects", () => {
    const refs = extractTemplateRefs({
      input: "Hello {{trigger1.payload.name}}",
      args: { nested: ["{{tool1.output}}", "plain text"] },
    });
    expect(refs.map((r) => r.raw)).toEqual([
      "{{trigger1.payload.name}}",
      "{{tool1.output}}",
    ]);
    expect(refs[0]).toMatchObject({ nodeId: "trigger1", path: "payload.name" });
  });

  // An agent's stored output is raw text (a scalar) — the engine has no
  // "output" field to resolve on it, so `{{agent1.output}}` fails at
  // validation with template_ref_invalid. Only the whole-node form
  // resolves. Was "suggests a bare and a dotted form for a node", asserting
  // the {{agent1.output}} suggestion the engine now rejects — rewritten for
  // the fix/workflow-template-refs decision (2026-09-22).
  it("suggests only the whole-node form for a scalar-output node", () => {
    const suggestions = templateSuggestionsFor({ id: "agent1", type: "agent" });
    expect(suggestions).toEqual(["{{agent1}}"]);
  });

  it("never suggests .output, .route or .payload, for any node type", () => {
    const nodeTypes = ["trigger", "agent", "tool", "router", "classifier", "merge", "loop", "approval", "output", "convert"];
    for (const type of nodeTypes) {
      const suggestions = templateSuggestionsFor({ id: "n1", type, config: {} });
      expect(suggestions).toContain("{{n1}}");
      for (const s of suggestions) {
        expect(s).not.toMatch(/\.output}}$/);
        expect(s).not.toMatch(/\.route}}$/);
        expect(s).not.toMatch(/\.payload}}$/);
      }
    }
  });

  it("suggests declared fields from a trigger's sample_payload", () => {
    const suggestions = templateSuggestionsFor({
      id: "trigger1",
      type: "trigger",
      config: { kind: "manual", sample_payload: { name: "Ada", age: 30 } },
    });
    expect(suggestions).toEqual(["{{trigger1}}", "{{trigger1.name}}", "{{trigger1.age}}"]);
  });

  it("suggests only the whole-node form for a trigger without sample_payload", () => {
    const suggestions = templateSuggestionsFor({ id: "trigger1", type: "trigger", config: { kind: "manual" } });
    expect(suggestions).toEqual(["{{trigger1}}"]);
  });

  // The engine stores a condition's input unchanged: neither its true/false
  // route nor an `.output` field is ever written, so only `{{id}}` resolves.
  it("offers only the whole-node ref for a condition", () => {
    expect(templateSuggestionsFor({ id: "cond1", type: "condition" })).toEqual(["{{cond1}}"]);
  });

  // Mirrors the engine's `_output_form`: these nodes' output keys are known
  // up front, and any other path is refused server-side.
  it("suggests the known output fields of set, extract, rag, http and notification", () => {
    expect(templateSuggestionsFor({ id: "s", type: "set", config: { fields: [{ key: "a", value: "x" }, { key: "" }] } })).toEqual(["{{s}}", "{{s.a}}"]);
    expect(templateSuggestionsFor({ id: "e", type: "extract", config: { fields: [{ name: "montant", type: "number" }] } })).toEqual(["{{e}}", "{{e.montant}}"]);
    expect(templateSuggestionsFor({ id: "r", type: "rag", config: {} })).toEqual(["{{r}}", "{{r.passages}}", "{{r.query}}"]);
    expect(templateSuggestionsFor({ id: "h", type: "http", config: {} })).toEqual(["{{h}}", "{{h.status}}", "{{h.body}}", "{{h.headers}}"]);
    expect(templateSuggestionsFor({ id: "n", type: "notification", config: {} })).toEqual(["{{n}}", "{{n.sent}}", "{{n.channel}}"]);
  });

  it("never suggests .output for the lot 1-4 nodes either", () => {
    for (const type of ["set", "extract", "rag", "http", "notification", "condition", "try", "subworkflow"]) {
      for (const s of templateSuggestionsFor({ id: "n1", type, config: {} })) {
        expect(s).not.toMatch(/\.output}}$/);
      }
    }
  });
});

describe("validateGraphLocal", () => {
  it("refuses a second trigger: only the first would be armed, yet each would emit the payload", () => {
    const result = validateGraphLocal({
      nodes: [
        { id: "t1", type: "trigger", config: { kind: "manual" } },
        { id: "t2", type: "trigger", config: { kind: "manual" } },
        { id: "a", type: "agent", config: { agent_id: "agent1" } },
      ],
      edges: [{ source: "t1", target: "a" }, { source: "t2", target: "a" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ nodeId: "t2", message: "multipleTriggers:2" });
    expect(result.errors.filter((e) => e.nodeId === "t1" && e.message.startsWith("multipleTriggers"))).toEqual([]);
  });

  const validGraph = {
    version: 1,
    nodes: [
      { id: "trigger1", type: "trigger", config: { kind: "manual" }, position: { x: 0, y: 0 } },
      { id: "router1", type: "router", config: { rules: [{ route: "yes", field: "{{trigger1.ok}}", op: "eq", value: true }], default_route: "no" }, position: { x: 200, y: 0 } },
      { id: "agentA", type: "agent", config: { agent_id: "agent1" }, position: { x: 400, y: -80 } },
      { id: "agentB", type: "agent", config: { agent_id: "agent2" }, position: { x: 400, y: 80 } },
    ],
    edges: [
      { source: "trigger1", target: "router1" },
      { source: "router1", target: "agentA", route: "yes" },
      { source: "router1", target: "agentB", route: "no" },
    ],
  };

  it("accepts a well-formed graph", () => {
    const result = validateGraphLocal(validGraph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("flags a router edge with no route label", () => {
    const graph = {
      ...validGraph,
      edges: [...validGraph.edges.slice(0, 1), { source: "router1", target: "agentA" }],
    };
    const result = validateGraphLocal(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.startsWith("missingRoute:"))).toBe(true);
  });

  it("flags a route label that isn't declared on the router", () => {
    const graph = {
      ...validGraph,
      edges: [validGraph.edges[0], { source: "router1", target: "agentA", route: "maybe" }],
    };
    const result = validateGraphLocal(graph);
    expect(result.errors.some((e) => e.message === "unknownRoute:maybe")).toBe(true);
  });

  it("flags a classifier with fewer than 2 routes", () => {
    const graph = {
      version: 1,
      nodes: [{ id: "classifier1", type: "classifier", config: { agent_id: "agent1", routes: [{ route: "only", description: "" }] }, position: { x: 0, y: 0 } }],
      edges: [],
    };
    const result = validateGraphLocal(graph);
    expect(result.errors.some((e) => e.message === "classifierNeedsTwoRoutes")).toBe(true);
  });

  it("flags a template pointing at a node that is not upstream", () => {
    const graph = {
      version: 1,
      nodes: [
        { id: "agentA", type: "agent", config: { agent_id: "agent1" }, position: { x: 0, y: 0 } },
        { id: "agentB", type: "agent", config: { agent_id: "agent2", input: "{{agentC.output}}" }, position: { x: 200, y: 0 } },
        { id: "agentC", type: "agent", config: { agent_id: "agent3" }, position: { x: 400, y: 0 } },
      ],
      edges: [{ source: "agentA", target: "agentB" }],
    };
    const result = validateGraphLocal(graph);
    expect(result.errors.some((e) => e.message === "templateNotUpstream:{{agentC.output}}")).toBe(true);
  });

  // The engine JSON-parses an agent's reply when it can, so a real field
  // path (e.g. {{agentA.montant}}) is legitimate — only the legacy
  // {{id.output}} pastille form is worth flagging, and only as a
  // non-blocking warning (it resolves whenever the agent replies in JSON).
  it("warns, without failing validity, on the legacy {{agentX.output}} form", () => {
    const graph = {
      version: 1,
      nodes: [
        { id: "agentA", type: "agent", config: { agent_id: "agent1" }, position: { x: 0, y: 0 } },
        { id: "agentB", type: "agent", config: { agent_id: "agent2", input: "{{agentA.output}}" }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: "agentA", target: "agentB" }],
    };
    const result = validateGraphLocal(graph);
    expect(result.valid).toBe(true);
    const warning = result.errors.find((e) => e.message === "templateRefLegacyOutput:{{agentA.output}}");
    expect(warning).toMatchObject({ level: "warning" });
  });

  it("does not flag a real field path on an agent's (JSON) output", () => {
    const graph = {
      version: 1,
      nodes: [
        { id: "agentA", type: "agent", config: { agent_id: "agent1" }, position: { x: 0, y: 0 } },
        { id: "agentB", type: "agent", config: { agent_id: "agent2", input: "{{agentA.montant}}" }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: "agentA", target: "agentB" }],
    };
    const result = validateGraphLocal(graph);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("warns on the legacy {{trigger.payload}} form when the sample has no payload key", () => {
    const graph = {
      version: 1,
      nodes: [
        { id: "trigger", type: "trigger", config: { sample_payload: { email: "a@b.c" } }, position: { x: 0, y: 0 } },
        { id: "agentA", type: "agent", config: { agent_id: "agent1", input: "{{trigger.payload}}" }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: "trigger", target: "agentA" }],
    };
    const result = validateGraphLocal(graph);
    expect(result.valid).toBe(true);
    const warning = result.errors.find((e) => e.message === "templateRefLegacyPayload:{{trigger.payload}}");
    expect(warning).toMatchObject({ level: "warning" });
  });

  it("does not flag {{trigger.payload}} when the sample really has a payload key", () => {
    const graph = {
      version: 1,
      nodes: [
        { id: "trigger", type: "trigger", config: { sample_payload: { payload: { x: 1 } } }, position: { x: 0, y: 0 } },
        { id: "agentA", type: "agent", config: { agent_id: "agent1", input: "{{trigger.payload}} {{trigger.email}}" }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: "trigger", target: "agentA" }],
    };
    expect(validateGraphLocal(graph).errors).toEqual([]);
  });

  it("flags .route on an upstream router as template_ref_invalid", () => {
    const graph = {
      version: 1,
      nodes: [
        { id: "router1", type: "router", config: { rules: [{ route: "yes", field: "x", op: "eq", value: 1 }], default_route: "no" }, position: { x: 0, y: 0 } },
        { id: "agentA", type: "agent", config: { agent_id: "agent1", input: "{{router1.route}}" }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: "router1", target: "agentA", route: "yes" }],
    };
    const result = validateGraphLocal(graph);
    expect(result.errors.some((e) => e.message === "templateRefInvalid:{{router1.route}}")).toBe(true);
  });

  it("flags .route on an upstream condition or try as template_ref_invalid", () => {
    for (const type of ["condition", "try"]) {
      const graph = {
        version: 1,
        nodes: [
          { id: "trigger", type: "trigger", config: {}, position: { x: 0, y: 0 } },
          { id: "c", type, config: {}, position: { x: 100, y: 0 } },
          { id: "agentA", type: "agent", config: { agent_id: "agent1", input: "{{c.route}}" }, position: { x: 200, y: 0 } },
        ],
        edges: [{ source: "trigger", target: "c" }, { source: "c", target: "agentA", route: type === "try" ? "ok" : "true" }],
      };
      const result = validateGraphLocal(graph);
      expect(result.errors.some((e) => e.message === "templateRefInvalid:{{c.route}}")).toBe(true);
    }
  });

  it("flags a field a known-output node doesn't produce, and accepts one it does", () => {
    const graph = (ref) => ({
      version: 1,
      nodes: [
        { id: "trigger", type: "trigger", config: {}, position: { x: 0, y: 0 } },
        { id: "h", type: "http", config: { method: "GET", url: "https://x.fr", headers: [], timeout_s: 10 }, position: { x: 100, y: 0 } },
        { id: "agentA", type: "agent", config: { agent_id: "agent1", input: ref }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: "trigger", target: "h" }, { source: "h", target: "agentA" }],
    });
    const bad = validateGraphLocal(graph("{{h.output}}"));
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => e.message === "templateRefUnknownField:{{h.output}}")).toBe(true);
    const good = validateGraphLocal(graph("{{h.body.items}}"));
    expect(good.errors.some((e) => e.message.startsWith("templateRef"))).toBe(false);
  });

  it("reports an approval node as a warning without failing validity", () => {
    const graph = {
      version: 1,
      nodes: [{ id: "approval1", type: "approval", config: {}, position: { x: 0, y: 0 } }],
      edges: [],
    };
    const result = validateGraphLocal(graph);
    expect(result.valid).toBe(true);
    expect(result.errors.some((e) => e.message === "notRunnable:approval" && e.level === "warning")).toBe(true);
    expect(isRunnableType("approval")).toBe(false);
    expect(isRunnableType("agent")).toBe(true);
  });
});

describe("loop node — serialization and validation", () => {
  it("createNode gives a loop a valid-shaped default config (backend runs loop since 21/09)", () => {
    const node = createNode("loop", { id: "loop1" });
    expect(node.config.mode).toBe("foreach");
    expect(node.config.max_iterations).toBe(10);
    expect(node.config.body.nodes).toHaveLength(1);
    expect(node.config.body.nodes[0].type).toBe("trigger");
    expect(isRunnableType("loop")).toBe(true);

    const outerTrigger = createNode("trigger", { id: "trigger1" });
    const loopWithItems = { ...node, config: { ...node.config, items: "{{trigger1.payload.rows}}" } };
    const result = validateGraphLocal({
      version: 1,
      nodes: [outerTrigger, loopWithItems],
      edges: [{ source: "trigger1", target: "loop1" }],
    });
    expect(result.valid).toBe(true);
  });

  it("round-trips the loop body opaquely through graphToFlow/flowToGraph", () => {
    const node = createNode("loop", { id: "loop1" });
    node.config.items = "{{trigger1.payload.rows}}";
    const graph = { version: 1, nodes: [node], edges: [] };

    const { nodes, edges } = graphToFlow(graph);
    expect(nodes[0].data.config.body.nodes[0].id).toBe("trigger1");

    const back = flowToGraph(nodes, edges);
    expect(back.nodes[0].config).toEqual(node.config);
  });

  it("flags a missing or out-of-range max_iterations", () => {
    const make = (max_iterations) => ({
      version: 1,
      nodes: [
        { id: "trigger1", type: "trigger", config: { kind: "manual" }, position: { x: 0, y: 0 } },
        { id: "loop1", type: "loop", config: { mode: "foreach", items: "{{trigger1.payload}}", max_iterations, body: createLoopBody() }, position: { x: 200, y: 0 } },
      ],
      edges: [{ source: "trigger1", target: "loop1" }],
    });
    expect(validateGraphLocal(make(undefined)).errors.some((e) => e.message.startsWith("loopMaxIterations:"))).toBe(true);
    expect(validateGraphLocal(make(0)).errors.some((e) => e.message.startsWith("loopMaxIterations:"))).toBe(true);
    expect(validateGraphLocal(make(101)).errors.some((e) => e.message.startsWith("loopMaxIterations:"))).toBe(true);
    expect(validateGraphLocal(make(100)).valid).toBe(true);
  });

  it("requires items in foreach mode and a full rule in until mode", () => {
    const foreachGraph = {
      version: 1,
      nodes: [{ id: "loop1", type: "loop", config: { mode: "foreach", items: "", max_iterations: 5, body: createLoopBody() }, position: { x: 0, y: 0 } }],
      edges: [],
    };
    expect(validateGraphLocal(foreachGraph).errors.some((e) => e.message === "loopItemsRequired")).toBe(true);

    const untilGraph = {
      version: 1,
      nodes: [{ id: "loop1", type: "loop", config: { mode: "until", until: { field: "" }, max_iterations: 5, body: createLoopBody() }, position: { x: 0, y: 0 } }],
      edges: [],
    };
    expect(validateGraphLocal(untilGraph).errors.some((e) => e.message === "loopUntilRequired")).toBe(true);

    const validUntil = {
      version: 1,
      nodes: [{ id: "loop1", type: "loop", config: { mode: "until", until: { field: "{{iteration.output.done}}", op: "eq", value: true }, max_iterations: 5, body: createLoopBody() }, position: { x: 0, y: 0 } }],
      edges: [],
    };
    expect(validateGraphLocal(validUntil).valid).toBe(true);
  });

  it("requires exactly one trigger in the body and reports it under the loop's namespaced id", () => {
    const zeroTriggers = {
      version: 1,
      nodes: [{
        id: "loop1", type: "loop",
        config: { mode: "foreach", items: "{{trigger1.payload}}", max_iterations: 5, body: { version: 1, nodes: [], edges: [] } },
        position: { x: 0, y: 0 },
      }],
      edges: [],
    };
    const result = validateGraphLocal(zeroTriggers);
    expect(result.errors.some((e) => e.message === "loopBodyTriggerCount:0")).toBe(true);

    const twoTriggers = {
      version: 1,
      nodes: [{
        id: "loop1", type: "loop",
        config: {
          mode: "foreach", items: "{{trigger1.payload}}", max_iterations: 5,
          body: { version: 1, nodes: [{ id: "trigger1", type: "trigger", config: { kind: "manual" }, position: { x: 0, y: 0 } }, { id: "trigger2", type: "trigger", config: { kind: "manual" }, position: { x: 0, y: 100 } }], edges: [] },
        },
        position: { x: 0, y: 0 },
      }],
      edges: [],
    };
    expect(validateGraphLocal(twoTriggers).errors.some((e) => e.message === "loopBodyTriggerCount:2")).toBe(true);
  });

  it("validates the body's own graph recursively, namespacing errors as loopId.innerId", () => {
    const graph = {
      version: 1,
      nodes: [{
        id: "loop1", type: "loop",
        config: {
          mode: "foreach", items: "{{trigger1.payload}}", max_iterations: 5,
          body: {
            version: 1,
            nodes: [
              { id: "trigger1", type: "trigger", config: { kind: "manual" }, position: { x: 0, y: 0 } },
              { id: "router1", type: "router", config: { rules: [{ route: "a", field: "{{trigger1.item}}", op: "eq", value: 1 }] }, position: { x: 200, y: 0 } },
              { id: "agentA", type: "agent", config: { agent_id: "agent1" }, position: { x: 400, y: 0 } },
            ],
            // route edge is missing its label -> body-level error, expected
            // to surface as "loop1.router1"
            edges: [{ source: "trigger1", target: "router1" }, { source: "router1", target: "agentA" }],
          },
        },
        position: { x: 0, y: 0 },
      }],
      edges: [],
    };
    const result = validateGraphLocal(graph);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.nodeId === "loop1.router1" && e.message.startsWith("missingRoute:"))).toBe(true);
  });
});

describe("autoLayout", () => {
  it("returns [] for an empty graph without touching dagre", () => {
    expect(autoLayout([], [])).toEqual([]);
  });

  it("assigns a position to every node", () => {
    const nodes = [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 0, y: 0 } },
    ];
    const edges = [{ source: "a", target: "b" }];
    const laidOut = autoLayout(nodes, edges);
    expect(laidOut).toHaveLength(2);
    for (const n of laidOut) {
      expect(typeof n.position.x).toBe("number");
      expect(typeof n.position.y).toBe("number");
    }
    // Left-to-right: "a" (source) should end up left of "b" (target).
    const a = laidOut.find((n) => n.id === "a");
    const b = laidOut.find((n) => n.id === "b");
    expect(a.position.x).toBeLessThan(b.position.x);
  });
});
