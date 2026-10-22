import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listWorkflowRuns, getWorkflowRunTrace } from "../api";
import { configureClient, resetClientConfig } from "@apowerb/apowerb-sdk/config";
import { RUNS_PAGE_SIZE, runsQuery, pageOf, runTriggerKey, runError, runFailedNode, parseRunDate } from "../workflowRuns";

const authStorage = { getToken: vi.fn(() => "tok-1"), setToken: vi.fn(), clear: vi.fn() };
const json = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

describe("run history API", () => {
  beforeEach(() => {
    configureClient({ storage: authStorage });
    global.fetch = vi.fn();
  });
  afterEach(() => {
    resetClientConfig();
    vi.restoreAllMocks();
  });

  it("asks for one workflow's runs, filtered and paged", async () => {
    global.fetch.mockResolvedValueOnce(json([]));
    await listWorkflowRuns({ workflowId: "wf 1", status: "error", limit: 21, offset: 40 });
    const url = new URL(global.fetch.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/api/workflows/runs");
    expect(Object.fromEntries(url.searchParams)).toEqual({ workflow_id: "wf 1", status: "error", limit: "21", offset: "40" });
  });

  it("sends no filter it was not given", async () => {
    global.fetch.mockResolvedValueOnce(json([]));
    await listWorkflowRuns({ workflowId: "wf1", limit: 21 });
    expect(global.fetch.mock.calls[0][0]).toBe("/api/workflows/runs?workflow_id=wf1&limit=21");
  });

  it("reads a run's trace", async () => {
    const trace = { events: [{ event: "done" }], truncated: false, available: true };
    global.fetch.mockResolvedValueOnce(json(trace));
    expect(await getWorkflowRunTrace("r/1")).toEqual(trace);
    expect(global.fetch.mock.calls[0][0]).toBe("/api/workflows/runs/r%2F1/trace");
  });
});

describe("runsQuery / pageOf", () => {
  it("maps each filter to its statuses and pages by offset, one row more", () => {
    expect(runsQuery("wf1", "all", 0)).toEqual({ workflowId: "wf1", status: null, limit: RUNS_PAGE_SIZE + 1, offset: 0 });
    expect(runsQuery("wf1", "failures", 2)).toMatchObject({ status: "error", offset: 2 * RUNS_PAGE_SIZE });
    expect(runsQuery("wf1", "awaiting", 0)).toMatchObject({ status: "awaiting" });
  });

  it("says there is a next page only when the extra row came back", () => {
    const rows = Array.from({ length: RUNS_PAGE_SIZE + 1 }, (_, i) => ({ run_id: `r${i}` }));
    expect(pageOf(rows)).toEqual({ rows: rows.slice(0, RUNS_PAGE_SIZE), hasMore: true });
    expect(pageOf(rows.slice(0, 3))).toEqual({ rows: rows.slice(0, 3), hasMore: false });
    expect(pageOf(null)).toEqual({ rows: [], hasMore: false });
  });
});

describe("a row's trigger and failure", () => {
  it("names the trigger, a replay first", () => {
    expect(runTriggerKey({ trigger_kind: "schedule" })).toBe("schedule");
    expect(runTriggerKey({ trigger_kind: "schedule", replay_of: "r0" })).toBe("replay");
    expect(runTriggerKey({ trigger_kind: "chat" })).toBe("other");
  });

  it("gives errorText the structured code, or the raw message", () => {
    expect(runError({ status: "error", error_message: "boom", error: { code: "http_timeout", params: { node: "http1" }, node_id: "http1" } })).toEqual({
      code: "http_timeout",
      detail: "boom",
      ref: null,
      params: { node: "http1" },
    });
    expect(runError({ status: "error", error_message: "old run", error: null })).toEqual({ code: null, detail: "old run", ref: null });
    expect(runError({ status: "success" })).toBeNull();
  });

  it("splits the faulty node of a loop or try body", () => {
    expect(runFailedNode({ status: "error", error: { node_id: "agent2" } })).toEqual(["agent2", null]);
    expect(runFailedNode({ status: "error", error: { node_id: "loop1.agent2" } })).toEqual(["loop1", "agent2"]);
    expect(runFailedNode({ status: "error", error: { node_id: null } })).toBeNull();
    expect(runFailedNode({ status: "success" })).toBeNull();
  });

  it("reads the engine's timestamps", () => {
    expect(parseRunDate("2026-10-21 10:00:00.123456").toISOString()).toMatch(/^2026-10-21T/);
    expect(parseRunDate(null)).toBeNull();
    expect(parseRunDate("nope")).toBeNull();
  });
});
