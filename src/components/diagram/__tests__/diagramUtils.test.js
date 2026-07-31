/**
 * Pure unit tests for diagramUtils.
 *
 * Covers the parsers (arrays, Python-ish strings, "None"/"null"/"") plus the
 * API → UI shape mapping in mapApiAgent.
 */

import { describe, it, expect } from "vitest";
import {
  categoryColors,
  typeToCategory,
  parseSubAgents,
  parseTools,
  parseOutputSchema,
  parseMcpServers,
  mapApiAgent,
  createEmptyAgentData,
} from "@/components/diagram/diagramUtils";

describe("parseSubAgents", () => {
  it("returns an array as-is", () => {
    const input = ["a", "b"];
    expect(parseSubAgents(input)).toBe(input);
  });

  it('returns [] for "None", "null", "" and null/undefined', () => {
    expect(parseSubAgents("None")).toEqual([]);
    expect(parseSubAgents("null")).toEqual([]);
    expect(parseSubAgents("")).toEqual([]);
    expect(parseSubAgents(null)).toEqual([]);
    expect(parseSubAgents(undefined)).toEqual([]);
  });

  it("parses a Python-style single-quoted list", () => {
    expect(parseSubAgents("['a', 'b']")).toEqual(["a", "b"]);
  });

  it("parses a JSON array string", () => {
    expect(parseSubAgents('["x","y"]')).toEqual(["x", "y"]);
  });

  it("returns [] for malformed strings", () => {
    expect(parseSubAgents("not-json")).toEqual([]);
  });
});

describe("parseTools", () => {
  it("returns an array as-is", () => {
    const input = ["tool_config1"];
    expect(parseTools(input)).toBe(input);
  });

  it("returns [] for falsy and Python/JSON empty strings", () => {
    expect(parseTools(null)).toEqual([]);
    expect(parseTools(undefined)).toEqual([]);
    expect(parseTools("")).toEqual([]);
    expect(parseTools("None")).toEqual([]);
    expect(parseTools("null")).toEqual([]);
    expect(parseTools("[]")).toEqual([]);
  });

  it('parses "[\'a\']" (Python style)', () => {
    expect(parseTools("['a', 'b']")).toEqual(["a", "b"]);
  });

  it("returns [] for non-array JSON payloads", () => {
    expect(parseTools('{"a":1}')).toEqual([]);
  });
});

describe("parseOutputSchema", () => {
  it("returns an object as-is", () => {
    const schema = { type: "object" };
    expect(parseOutputSchema(schema)).toBe(schema);
  });

  it("returns null for falsy inputs", () => {
    expect(parseOutputSchema(null)).toBeNull();
    expect(parseOutputSchema(undefined)).toBeNull();
    expect(parseOutputSchema("")).toBeNull();
  });

  it("parses a JSON string", () => {
    expect(parseOutputSchema('{"type":"object"}')).toEqual({ type: "object" });
  });

  it("returns null when the string is not valid JSON", () => {
    expect(parseOutputSchema("not-json")).toBeNull();
  });
});

describe("parseMcpServers", () => {
  it("returns the array unchanged", () => {
    const input = [{ name: "srv" }];
    expect(parseMcpServers(input)).toBe(input);
  });

  it("parses a JSON-string array", () => {
    expect(parseMcpServers('[{"name":"srv"}]')).toEqual([{ name: "srv" }]);
  });

  it("returns [] for invalid input", () => {
    expect(parseMcpServers(null)).toEqual([]);
    expect(parseMcpServers(undefined)).toEqual([]);
    expect(parseMcpServers("nope")).toEqual([]);
    expect(parseMcpServers(42)).toEqual([]);
  });
});

describe("mapApiAgent", () => {
  it("maps a minimal API agent with numeric id", () => {
    const api = {
      agent_id: 7,
      agent_name: "Foo",
      agent_type: "parallel",
      agent_tools: "[]",
      sub_agents: "None",
    };
    const mapped = mapApiAgent(api);
    expect(mapped.id).toBe("agent7");
    expect(mapped.agent_id).toBe(7);
    expect(mapped.label).toBe("Foo");
    expect(mapped.category).toBe("Parallel");
    expect(mapped.color).toBe(categoryColors.Parallel);
    expect(mapped.subAgents).toEqual([]);
    expect(mapped.agent_tools).toEqual([]);
    expect(mapped.selectedTool).toBe("");
  });

  it("falls back to agent_name when agent_id is missing", () => {
    const mapped = mapApiAgent({
      agent_name: "Orphan",
      agent_type: "base",
    });
    expect(mapped.id).toBe("Orphan");
    expect(mapped.category).toBe("Base");
  });

  it("extracts model_api_key and preserves other template params", () => {
    const mapped = mapApiAgent({
      agent_id: 1,
      agent_name: "X",
      agent_type: "sequential",
      agent_model_params: { model_api_key: "sk-123", temperature: 0.7 },
    });
    expect(mapped.model_api_key).toBe("sk-123");
    expect(mapped.template_model_params).toEqual({ temperature: 0.7 });
  });

  it("handles stringified agent_model_params", () => {
    const mapped = mapApiAgent({
      agent_id: 2,
      agent_name: "Y",
      agent_type: "sequential",
      agent_model_params: '{"model_api_key":"sk-abc"}',
    });
    expect(mapped.model_api_key).toBe("sk-abc");
    expect(mapped.template_model_params).toBeNull();
  });

  it("deduplicates sub_agents", () => {
    const mapped = mapApiAgent({
      agent_id: 3,
      agent_name: "Z",
      agent_type: "sequential",
      sub_agents: "['a', 'a', 'b']",
    });
    expect(mapped.subAgents).toEqual(["a", "b"]);
  });

  it("exposes the first tool in selectedTool", () => {
    const mapped = mapApiAgent({
      agent_id: 4,
      agent_name: "W",
      agent_type: "base",
      agent_tools: "['tool_config1', 'tool_config2']",
    });
    expect(mapped.selectedTool).toBe("tool_config1");
    expect(mapped.agent_tools).toEqual(["tool_config1", "tool_config2"]);
  });
});

describe("createEmptyAgentData", () => {
  it("returns a blank sequential agent skeleton", () => {
    const blank = createEmptyAgentData();
    expect(blank.agent_name).toBe("");
    expect(blank.agent_type).toBe("sequential");
    expect(blank.agent_tools).toEqual([]);
    expect(blank.mcp_servers).toEqual([]);
    expect(blank.memory_enabled).toBe(false);
    expect(blank.artifacts_enabled).toBe(false);
    expect(blank.guardrails_config).toBeNull();
    expect(blank.output_schema).toBeNull();
  });

  it("returns a fresh object on each call", () => {
    expect(createEmptyAgentData()).not.toBe(createEmptyAgentData());
  });
});

describe("typeToCategory mapping", () => {
  it("maps known backend agent_type values", () => {
    expect(typeToCategory.base).toBe("Base");
    expect(typeToCategory.sequential).toBe("Sequential");
    expect(typeToCategory.parallel).toBe("Parallel");
    expect(typeToCategory.loop).toBe("Loop");
    expect(typeToCategory.router).toBe("Router");
  });
});
