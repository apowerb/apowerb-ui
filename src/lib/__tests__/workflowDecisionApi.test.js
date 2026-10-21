import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listAwaitingDecisions, resumeWorkflowRun, abandonWorkflowRun } from "../api";
import { configureClient, resetClientConfig } from "@apowerb/apowerb-sdk/config";

const authStorage = { getToken: vi.fn(() => "tok-1"), setToken: vi.fn(), clear: vi.fn() };

const json = (body, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
});

describe("human decision API", () => {
  beforeEach(() => {
    configureClient({ storage: authStorage });
    global.fetch = vi.fn();
  });
  afterEach(() => {
    resetClientConfig();
    vi.restoreAllMocks();
  });

  it("lists the runs waiting for me", async () => {
    const rows = [{ run_id: "r1", workflow_id: "w1" }];
    global.fetch.mockResolvedValueOnce(json(rows));
    expect(await listAwaitingDecisions()).toEqual(rows);
    expect(global.fetch.mock.calls[0][0]).toBe("/api/workflows/runs/awaiting");
  });

  it("resumes a run with the raw Response (an SSE stream), sending only what was answered", async () => {
    const res = { ok: true, status: 200, body: {} };
    global.fetch.mockResolvedValueOnce(res);
    const signal = new AbortController().signal;
    expect(await resumeWorkflowRun("r 1", { choice: "oui" }, { signal })).toBe(res);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/workflows/runs/r%201/resume");
    expect(opts.method).toBe("POST");
    expect(opts.signal).toBe(signal);
    expect(opts.headers).toMatchObject({ Authorization: "Bearer tok-1", "Content-Type": "application/json" });
    expect(JSON.parse(opts.body)).toEqual({ choice: "oui" });
  });

  it("sends a text answer alone", async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, body: {} });
    await resumeWorkflowRun("r1", { text: "Plan B" });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ text: "Plan B" });
  });

  it.each([
    [409, "decision_already_answered"],
    [422, "decision_invalid_answer"],
  ])("throws the coded %s before any stream, keeping detail.code", async (status, code) => {
    global.fetch.mockResolvedValueOnce({ ok: false, status, text: async () => JSON.stringify({ detail: { code } }) });
    await expect(resumeWorkflowRun("r1", { choice: "x" })).rejects.toMatchObject({ status, detail: { code } });
  });

  it("throws a 404 with its status, and a proxy HTML page without showing it", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => JSON.stringify({ detail: "Not found" }) });
    await expect(resumeWorkflowRun("r1", {})).rejects.toMatchObject({ status: 404, message: "Not found" });
    global.fetch.mockResolvedValueOnce({ ok: false, status: 502, text: async () => "<html>Bad gateway</html>" });
    await expect(resumeWorkflowRun("r1", {})).rejects.toMatchObject({ status: 502, message: "HTTP 502" });
  });

  it("abandons a run (204, empty body)", async () => {
    global.fetch.mockResolvedValueOnce(json(undefined, 204));
    await expect(abandonWorkflowRun("r1")).resolves.toBeDefined();
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/workflows/runs/r1/abandon");
    expect(opts.method).toBe("POST");
  });
});
