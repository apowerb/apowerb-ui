/**
 * Suggesting the next node: after each node, the canvas offers the two or
 * three types that usually follow, wired to the branch that still has none
 * and pre-filled with what they should read. Rules only — no model call.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NextNodeSuggestions from "@/components/workflow-studio/NextNodeSuggestions";
import { suggestNextNodes, firstUnwiredRoute, prefillFor, applySuggestion } from "@/lib/nextNodeSuggestions";

const trigger = { id: "trigger1", type: "trigger", config: { kind: "manual" } };
const agent = { id: "agent1", type: "agent", config: { agent_id: "a1" } };
const output = { id: "output1", type: "output", config: {} };

describe("suggestNextNodes", () => {
  it("offers what usually follows, most likely first, and reads the node it hangs off", () => {
    const suggestions = suggestNextNodes(trigger, [trigger, output], []);
    expect(suggestions.map((s) => s.type)).toEqual(["agent", "classifier", "convert"]);
    expect(suggestions[0]).toEqual({ type: "agent", route: null, config: { input: "{{trigger1}}" } });
  });

  it("puts Output first while the workflow has none", () => {
    const tool = { id: "tool1", type: "tool", config: { tool: "search" } };
    expect(suggestNextNodes(tool, [trigger, tool], []).map((s) => s.type)).toEqual(["output", "convert", "notification"]);
    expect(suggestNextNodes(tool, [trigger, tool, output], []).map((s) => s.type)).toEqual(["convert", "output", "notification"]);
  });

  it("says nothing after a terminal node or one already wired", () => {
    expect(suggestNextNodes(output, [output], [])).toEqual([]);
    expect(suggestNextNodes(agent, [agent, output], [{ source: "agent1", target: "output1" }])).toEqual([]);
  });

  it("targets the first branch of a routing node that has no edge yet", () => {
    const router = { id: "router1", type: "router", config: { rules: [{ route: "urgent" }], default_route: "normal" } };
    const edges = [{ source: "router1", target: "output1", data: { route: "urgent" } }];
    expect(firstUnwiredRoute(router, [])).toBe("urgent");
    expect(firstUnwiredRoute(router, edges)).toBe("normal");
    expect(suggestNextNodes(router, [router, output], edges).map((s) => s.route)).toEqual(["normal", "normal"]);
    expect(suggestNextNodes(router, [router, output], [...edges, { source: "router1", target: "output2", data: { route: "normal" } }])).toEqual([]);
  });

  it("knows the fixed branches of condition and try", () => {
    expect(firstUnwiredRoute({ id: "cond1", type: "condition", config: {} }, [])).toBe("true");
    expect(firstUnwiredRoute({ id: "try1", type: "try", config: {} }, [])).toBe("ok");
  });

  it("reads a canvas node's config under data, like the rest of the studio", () => {
    const canvasRouter = { id: "router1", type: "router", data: { config: { rules: [{ route: "a" }] } } };
    expect(firstUnwiredRoute(canvasRouter, [])).toBe("a");
  });

  it("pre-fills the field each type reads from", () => {
    expect(prefillFor("output", agent)).toEqual({ value: "{{agent1}}" });
    expect(prefillFor("notification", agent)).toEqual({ body: "{{agent1}}" });
    expect(prefillFor("rag", agent)).toEqual({ query: "{{agent1}}" });
    expect(prefillFor("condition", agent)).toEqual({});
  });
});

describe("applySuggestion", () => {
  it("adds the node right of its source, wires the branch and keeps the pre-filled config", () => {
    const nodes = [{ ...trigger, position: { x: 0, y: 0 } }];
    const { nodes: next, edges, node } = applySuggestion(nodes, [], nodes[0], { type: "agent", route: null, config: { input: "{{trigger1}}" } });

    expect(next).toHaveLength(2);
    expect(node.id).toBe("agent1");
    expect(node.data.config).toEqual({ agent_id: "", input: "{{trigger1}}" });
    expect(node.position.x).toBeGreaterThan(0);
    expect(edges).toEqual([
      expect.objectContaining({ source: "trigger1", target: "agent1", type: "route", data: { route: null } }),
    ]);
  });

  it("carries the branch name onto the new edge", () => {
    const router = { id: "router1", type: "router", position: { x: 0, y: 0 }, data: { config: { rules: [{ route: "urgent" }] } } };
    const { edges, node } = applySuggestion([router], [], router, { type: "output", route: "urgent", config: { value: "{{router1}}" } });

    expect(edges[0].data).toEqual({ route: "urgent" });
    expect(node.data.config.value).toBe("{{router1}}");
  });

  it("never reuses an id already on the canvas", () => {
    const nodes = [{ ...trigger, position: { x: 0, y: 0 } }, { ...agent, position: { x: 100, y: 0 } }];
    const { node } = applySuggestion(nodes, [], nodes[0], { type: "agent", route: null, config: {} });
    expect(node.id).toBe("agent2");
  });
});

describe("NextNodeSuggestions", () => {
  const suggestions = [
    { type: "agent", route: null, config: {} },
    { type: "output", route: "normal", config: {} },
  ];

  it("names each type, shows the branch it would wire, and hands the pick back", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<NextNodeSuggestions suggestions={suggestions} onPick={onPick} />);

    expect(screen.getByRole("button", { name: /Agent/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /normal/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Agent/ }));
    expect(onPick).toHaveBeenCalledWith(suggestions[0]);
  });

  it("renders nothing without suggestions", () => {
    const { container } = render(<NextNodeSuggestions suggestions={[]} onPick={() => {}} />);
    expect(container.textContent).toBe("");
  });
});
