import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  buildTurns,
  collapseAgentRuns,
  logToItem,
  spanToItem,
  toolOutcome,
  matchesSearch,
  matchesSubFilter,
  subFilterOptions,
  turnStats,
  waterfallGeometry,
} from "@/lib/loggingTimeline";

const failingToolSpan = {
  name: "execute_tool tool_send_email",
  trace_id: "t1",
  span_id: "s1",
  ts: "2026-07-23T09:51:10Z",
  duration_ms: 76,
  attributes: {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.name": "tool_send_email",
    "gcp.vertex.agent.tool_response": JSON.stringify({
      code: "INTEGRATION_MISSING",
      message: "Google credentials are not configured",
    }),
  },
};

describe("toolOutcome", () => {
  it("flags business failures carried by the tool response", () => {
    const outcome = toolOutcome(failingToolSpan);
    expect(outcome.failed).toBe(true);
    expect(outcome.code).toBe("INTEGRATION_MISSING");
  });

  it("flags pending action cards as waiting, not failed", () => {
    const outcome = toolOutcome({
      attributes: {
        "gcp.vertex.agent.tool_response": JSON.stringify({
          status: "user_input_pending",
        }),
      },
    });
    expect(outcome.failed).toBe(false);
    expect(outcome.waiting).toBe(true);
  });

  it("survives malformed JSON responses", () => {
    expect(
      toolOutcome({ attributes: { "gcp.vertex.agent.tool_response": "{oops" } }),
    ).toBeNull();
  });
});

describe("spanToItem", () => {
  it("renders a failed tool as an ERROR row", () => {
    const item = spanToItem(failingToolSpan);
    expect(item.kind).toBe("ERROR");
    expect(item.label).toContain("tool_send_email");
    expect(item.label).toContain("INTEGRATION_MISSING");
  });

  it("renders LLM calls with the model name", () => {
    const item = spanToItem({
      name: "generate_content gemini/gemini-3-flash-preview",
      attributes: {},
    });
    expect(item.kind).toBe("LLM");
    expect(item.label).toContain("gemini-3-flash-preview");
  });

  it("drops structural spans", () => {
    expect(spanToItem({ name: "invocation", attributes: {} })).toBeNull();
    expect(spanToItem({ name: "call_llm", attributes: {} })).toBeNull();
  });

  it("surfaces an LLM call with OTLP error status as an ERROR row", () => {
    const item = spanToItem({
      name: "generate_content openai/Mistral-Small",
      status_code: "2",
      status_message: "APIError: litellm.APIError: Forbidden: authentication failed",
      attributes: { "gen_ai.request.model": "openai/Mistral-Small" },
    });
    expect(item.kind).toBe("ERROR");
    expect(item.label).toContain("LLM call failed");
    expect(item.label).toContain("Forbidden");
  });

  it("does NOT surface error status on structural spans (avoid 4x duplication)", () => {
    for (const name of ["call_llm", "invoke_agent a", "invocation"]) {
      expect(spanToItem({ name, status_code: "2", status_message: "boom", attributes: {} })).toBeNull();
    }
  });

  it("surfaces a tool span error status too", () => {
    const item = spanToItem({
      name: "execute_tool run_query",
      status_code: "STATUS_CODE_ERROR",
      status_message: "connection reset",
      attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "run_query" },
    });
    expect(item.kind).toBe("ERROR");
    expect(item.label).toContain("run_query failed");
  });
});

describe("logToItem", () => {
  it("labels elided GenAI events by role when capture is off", () => {
    const item = logToItem({
      severity: null,
      event_name: "gen_ai.user.message",
      body: '{"content": "<elided>"}',
    });
    expect(item.kind).toBe("AGENT");
    expect(item.label).toBe("User (content elided)");
  });

  it("shows captured (masked) content prefixed by role", () => {
    const item = logToItem({
      severity: null,
      event_name: "gen_ai.user.message",
      body: '{"content": "Envoie un email à [masked email] stp"}',
    });
    expect(item.label).toBe("User: Envoie un email à [masked email] stp");
  });

  it("truncates long captured content", () => {
    const long = "a".repeat(300);
    const item = logToItem({
      severity: null,
      event_name: "gen_ai.assistant.message",
      body: JSON.stringify({ content: long }),
    });
    expect(item.label.length).toBeLessThan(180);
    expect(item.label.endsWith("…")).toBe(true);
  });

  it("extracts text from the Gemini {content:{parts:[...]}} shape", () => {
    const item = logToItem({
      severity: null,
      event_name: "gen_ai.user.message",
      body: JSON.stringify({ content: { parts: [{ text: "Draft the sprint emails" }] } }),
    });
    expect(item.label).toBe("User: Draft the sprint emails");
  });

  it("labels tool calls and results without leaking thought_signature", () => {
    const call = logToItem({
      severity: null,
      event_name: "gen_ai.user.message",
      body: JSON.stringify({ content: { parts: [
        { function_call: { name: "tool_run_sourcing", args: { limit: 20 },
          id: "call_abc__thought__BASE64NOISE" } },
        { thought_signature: "BASE64NOISE" },
      ] } }),
    });
    expect(call.label).toContain("→ call tool_run_sourcing");
    expect(call.label).toContain('"limit":20');
    expect(call.label).not.toContain("BASE64NOISE");

    const resp = logToItem({
      severity: null,
      event_name: "gen_ai.user.message",
      body: JSON.stringify({ content: { parts: [
        { function_response: { name: "tool_run_sourcing" } },
      ] } }),
    });
    expect(resp.label).toContain("← tool_run_sourcing result");
  });

  it("uses the real speaker from content.role, not the event name", () => {
    // ADK replays history as gen_ai.user.message even for model turns.
    const asModel = logToItem({
      severity: null,
      event_name: "gen_ai.user.message",
      body: JSON.stringify({ content: { role: "model", parts: [{ text: "J'ai rédigé 39 e-mails" }] } }),
    });
    expect(asModel.label).toBe("Assistant: J'ai rédigé 39 e-mails");

    const asUser = logToItem({
      severity: null,
      event_name: "gen_ai.user.message",
      body: JSON.stringify({ content: { role: "user", parts: [{ text: "Reprend le processus" }] } }),
    });
    expect(asUser.label).toBe("User: Reprend le processus");
  });

  it("does not prefix a role on self-describing tool activity", () => {
    const call = logToItem({
      severity: null,
      event_name: "gen_ai.user.message",
      body: JSON.stringify({ content: { role: "model", parts: [
        { function_call: { name: "tool_run_sourcing", args: {} } },
      ] } }),
    });
    expect(call.label.startsWith("→ call tool_run_sourcing")).toBe(true);
    expect(call.label).not.toContain("Assistant:");
  });

  it("keeps app log severities", () => {
    expect(logToItem({ severity: "WARNING", body: "retry" }).kind).toBe("WARN");
    expect(logToItem({ severity: "ERROR", body: "boom" }).kind).toBe("ERROR");
  });
});

describe("collapseAgentRuns", () => {
  it("collapses consecutive identical redacted events", () => {
    const rows = collapseAgentRuns([
      { kind: "AGENT", label: "Message (content elided)" },
      { kind: "AGENT", label: "Message (content elided)" },
      { kind: "AGENT", label: "Message (content elided)" },
      { kind: "TOOL", label: "Tool x" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].count).toBe(3);
  });
});

describe("buildTimeline / buildTurns", () => {
  const data = {
    spans: [
      { ...failingToolSpan },
      { name: "invocation", trace_id: "t1", span_id: "s0", ts: "2026-07-23T09:51:09Z", duration_ms: 3000, attributes: {} },
    ],
    logs: [
      { severity: null, event_name: "gen_ai.choice", body: "{}", trace_id: "t1", ts: "2026-07-23T09:51:11Z" },
      { severity: null, event_name: "gen_ai.choice", body: "{}", trace_id: "t2", ts: "2026-07-23T09:52:00Z" },
    ],
  };

  it("assigns stable ids and turn durations, independent of filter", () => {
    const { items, counts, turnDurations } = buildTimeline(data);
    expect(counts.ERROR).toBe(1);
    expect(turnDurations.get("t1")).toBe(3000);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("shows the latest turn first and keeps rows chronological inside", () => {
    const { items } = buildTimeline(data);
    const turns = buildTurns(items, "ALL");
    expect(turns[0].traceId).toBe("t2");
    expect(turns[0].no).toBe(2);
  });

  it("filters by kind without renumbering turns", () => {
    const { items } = buildTimeline(data);
    const turns = buildTurns(items, "ERROR");
    expect(turns).toHaveLength(1);
    expect(turns[0].traceId).toBe("t1");
    expect(turns[0].no).toBe(1);
  });

  it("keeps turn stats truthful under filtering", () => {
    const { items } = buildTimeline(data);
    const turns = buildTurns(items, "ERROR");
    // The filtered t1 turn still reports its full composition.
    expect(turns[0].stats.errors).toBe(1);
    expect(turns[0].stats.toolCalls).toBe(1);
  });
});

describe("sub-filters", () => {
  const toolItem = {
    kind: "TOOL",
    ts: "2026-07-23T10:00:00Z",
    span: {
      name: "execute_tool send_mail",
      duration_ms: 76,
      attributes: { "gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": "send_mail" },
    },
  };
  const llmItem = {
    kind: "LLM",
    ts: "2026-07-23T10:00:01Z",
    span: {
      name: "generate_content gemini/gemini-3-flash-preview",
      duration_ms: 2000,
      attributes: {},
    },
  };
  const agentItem = { kind: "AGENT", ts: "2026-07-23T10:00:02Z", log: {} };

  it("collects distinct options from loaded items", () => {
    const opts = subFilterOptions([toolItem, llmItem, agentItem]);
    expect(opts.tools).toEqual(["send_mail"]);
    expect(opts.models).toEqual(["gemini-3-flash-preview"]);
    expect(opts.hasSlow).toBe(true);
  });

  it("matches by tool, model and slowness", () => {
    expect(matchesSubFilter(toolItem, { type: "tool", value: "send_mail" })).toBe(true);
    expect(matchesSubFilter(llmItem, { type: "tool", value: "send_mail" })).toBe(false);
    expect(matchesSubFilter(llmItem, { type: "model", value: "gemini-3-flash-preview" })).toBe(true);
    expect(matchesSubFilter(llmItem, { type: "slow" })).toBe(true);
    expect(matchesSubFilter(toolItem, { type: "slow" })).toBe(false);
    expect(matchesSubFilter(agentItem, null)).toBe(true);
  });

  it("applies the sub-filter inside buildTurns", () => {
    const turns = buildTurns(
      [{ ...toolItem, trace: "t1" }, { ...llmItem, trace: "t1" }],
      "ALL",
      { type: "tool", value: "send_mail" },
    );
    expect(turns).toHaveLength(1);
    expect(turns[0].items).toHaveLength(1);
    expect(turns[0].items[0].kind).toBe("TOOL");
  });
});

describe("matchesSearch", () => {
  const errorItem = {
    kind: "ERROR",
    label: "Tool tool_send_email failed — INTEGRATION_MISSING: Google credentials…",
    span: {
      name: "execute_tool tool_send_email",
      attributes: {
        "gen_ai.tool.name": "tool_send_email",
        "gcp.vertex.agent.tool_response": '{"code": "INTEGRATION_MISSING"}',
      },
    },
  };

  it("matches labels, tool names, attribute keys and values, case-insensitively", () => {
    expect(matchesSearch(errorItem, "integration_missing")).toBe(true);
    expect(matchesSearch(errorItem, "send_email")).toBe(true);
    expect(matchesSearch(errorItem, "tool_response")).toBe(true);
    expect(matchesSearch(errorItem, "nonexistent")).toBe(false);
  });

  it("empty query matches everything", () => {
    expect(matchesSearch(errorItem, "")).toBe(true);
    expect(matchesSearch(errorItem, "  ")).toBe(true);
  });

  it("combines with filters inside buildTurns", () => {
    const items = [
      { ...errorItem, ts: "2026-07-23T10:00:00Z", trace: "t1" },
      { kind: "AGENT", label: "Model response", ts: "2026-07-23T10:00:01Z", trace: "t1", log: {} },
    ];
    const turns = buildTurns(items, "ALL", null, "integration_missing");
    expect(turns).toHaveLength(1);
    expect(turns[0].items).toHaveLength(1);
    expect(turns[0].items[0].kind).toBe("ERROR");
  });
});

describe("turnStats", () => {
  const llmItem = {
    kind: "LLM",
    ts: "2026-07-23T10:00:00Z",
    span: {
      duration_ms: 2000,
      attributes: {
        "gen_ai.request.model": "gemini/gemini-3-flash-preview",
        "gen_ai.usage.input_tokens": 7727,
        "gen_ai.usage.output_tokens": "312",
      },
    },
  };
  const failedTool = {
    kind: "ERROR",
    ts: "2026-07-23T10:00:02Z",
    span: { duration_ms: 76, attributes: {} },
  };

  it("aggregates llm/tool/token/model info and the time window", () => {
    const s = turnStats([llmItem, failedTool]);
    expect(s.llmCalls).toBe(1);
    expect(s.llmMs).toBe(2000);
    expect(s.toolCalls).toBe(1);
    expect(s.toolFails).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.inputTokens).toBe(7727);
    expect(s.outputTokens).toBe(312);
    expect(s.models).toEqual(["gemini-3-flash-preview"]);
    expect(s.window.end - s.window.start).toBe(2076);
  });
});

describe("waterfallGeometry", () => {
  const window = { start: 1000, end: 11000 }; // 10 s span

  it("positions and scales spans proportionally", () => {
    const geo = waterfallGeometry(
      { ts: new Date(3500).toISOString(), span: { duration_ms: 2500 } },
      window,
    );
    expect(geo.leftPct).toBeCloseTo(25);
    expect(geo.widthPct).toBeCloseTo(25);
  });

  it("renders instant events as zero-width (dot) and clamps overflow", () => {
    const dot = waterfallGeometry({ ts: new Date(1000).toISOString() }, window);
    expect(dot.widthPct).toBe(0);
    const clamped = waterfallGeometry(
      { ts: new Date(10000).toISOString(), span: { duration_ms: 99999 } },
      window,
    );
    expect(clamped.leftPct + clamped.widthPct).toBeLessThanOrEqual(100);
  });

  it("returns null on degenerate windows", () => {
    expect(waterfallGeometry({ ts: 0 }, { start: 5, end: 5 })).toBeNull();
    expect(waterfallGeometry({ ts: 0 }, null)).toBeNull();
  });
});
