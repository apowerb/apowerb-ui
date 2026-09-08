import { describe, it, expect, vi } from "vitest";
import {
  COMMAND_DEFS,
  COMMAND_GROUPS,
  buildCommands,
  matchCommands,
  scoreCommand,
  parseSlash,
  fillTemplate,
  placeholderRange,
  loadRecentCommandIds,
  recordRecentCommand,
} from "../chatCommands";

const t = (k) => k;

describe("COMMAND_DEFS (registry invariants)", () => {
  it("has unique ids and unique slash names", () => {
    const ids = COMMAND_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const slashes = COMMAND_DEFS.map((d) => d.slash).filter(Boolean);
    expect(new Set(slashes).size).toBe(slashes.length);
  });

  it("only uses known groups and always carries a label key and an icon", () => {
    for (const d of COMMAND_DEFS) {
      expect(COMMAND_GROUPS).toContain(d.group);
      expect(typeof d.labelKey).toBe("string");
      expect(typeof d.iconName).toBe("string");
      // A command either runs or inserts a template — never neither.
      expect(Boolean(d.run) || Boolean(d.insertKey)).toBe(true);
    }
  });
});

describe("buildCommands", () => {
  it("drops commands whose `when` rejects the context", () => {
    const noSession = buildCommands({ activeSession: null }, t).map((c) => c.id);
    expect(noSession).toContain("new-chat");
    expect(noSession).not.toContain("rename");
    expect(noSession).not.toContain("regenerate");

    const withReply = buildCommands(
      { activeSession: { id: "s1", messages: [{ role: "assistant", content: "hi" }] } },
      t,
    ).map((c) => c.id);
    expect(withReply).toContain("rename");
    expect(withReply).toContain("regenerate");
    expect(withReply).toContain("continue");
  });

  it("offers Stop only while streaming, and Regenerate only when idle", () => {
    const ctx = { activeSession: { id: "s1", messages: [{ role: "assistant", content: "x" }] } };
    const idle = buildCommands({ ...ctx, isStreaming: false }, t).map((c) => c.id);
    const busy = buildCommands({ ...ctx, isStreaming: true }, t).map((c) => c.id);
    expect(idle).toContain("regenerate");
    expect(idle).not.toContain("stop");
    expect(busy).toContain("stop");
    expect(busy).not.toContain("regenerate");
  });

  it("hides the admin screen unless the context says admin", () => {
    expect(buildCommands({}, t).map((c) => c.id)).not.toContain("go-admin");
    expect(buildCommands({ isAdmin: true }, t).map((c) => c.id)).toContain("go-admin");
  });

  it("binds run() to the context and forwards the slash argument", () => {
    const renameSession = vi.fn();
    const startRename = vi.fn();
    const ctx = { activeSession: { id: "s1", messages: [] }, renameSession, startRename };
    const rename = buildCommands(ctx, t).find((c) => c.id === "rename");
    rename.run("  Mon titre ");
    expect(renameSession).toHaveBeenCalledWith("s1", "Mon titre");
    rename.run("");
    expect(startRename).toHaveBeenCalledTimes(1);
  });

  it("resolves labels and templates through the translator", () => {
    const tr = (k) => `T:${k}`;
    const chart = buildCommands({}, tr).find((c) => c.id === "tpl-chart");
    expect(chart.label).toBe("T:tplChart");
    expect(chart.insert).toBe("T:tplChartInsert");
    expect(chart.argsHint).toBe("T:tplChartArgs");
  });
});

describe("scoreCommand / matchCommands", () => {
  const cmds = buildCommands({ activeSession: { id: "s1", messages: [] } }, t);

  it("returns everything (registry order) for an empty query", () => {
    const all = matchCommands(cmds, "");
    expect(all.map((c) => c.id)).toEqual(cmds.map((c) => c.id));
  });

  it("ranks an exact slash name above a label match in slash mode", () => {
    const res = matchCommands(cmds, "new", { mode: "slash" });
    expect(res[0].id).toBe("new-chat");
  });

  it("slash mode ignores commands without a slash name", () => {
    const res = matchCommands(cmds, "", { mode: "slash" });
    expect(res.every((c) => c.slash)).toBe(true);
    expect(res.map((c) => c.id)).not.toContain("download-json");
  });

  it("matches keywords, accents and typos", () => {
    expect(matchCommands(cmds, "épingler")[0].id).toBe("pin");
    expect(matchCommands(cmds, "epingler")[0].id).toBe("pin");
    expect(matchCommands(cmds, "clavier")[0].id).toBe("shortcuts");
    // subsequence: "artfcts" -> "goArtifacts" (typo-tolerant)
    expect(matchCommands(cmds, "artfcts").map((c) => c.id)).toContain("go-artifacts");
  });

  it("scores 0 for unrelated text", () => {
    expect(scoreCommand(cmds[0], "zzzz-nothing")).toBe(0);
    expect(matchCommands(cmds, "zzzz-nothing")).toEqual([]);
  });

  it("prefers a label prefix over a keyword hit", () => {
    const a = scoreCommand({ label: "Share", keywords: ["link"] }, "sha");
    const b = scoreCommand({ label: "Copy", keywords: ["share"] }, "sha");
    expect(a).toBeGreaterThan(b);
  });
});

describe("parseSlash", () => {
  it("recognises a bare slash and a name with arguments", () => {
    expect(parseSlash("/")).toEqual({ name: "", args: "" });
    expect(parseSlash("/ren")).toEqual({ name: "ren", args: "" });
    expect(parseSlash("/rename Projet Alpha")).toEqual({ name: "rename", args: "Projet Alpha" });
    expect(parseSlash("/Translate  en anglais ")).toEqual({ name: "translate", args: "en anglais" });
  });

  it("keeps multi-line arguments", () => {
    expect(parseSlash("/email bonjour\nligne 2").args).toBe("bonjour\nligne 2");
  });

  it("ignores text that merely contains a slash, paths, and non-letter starts", () => {
    expect(parseSlash("hello /rename")).toBeNull();
    expect(parseSlash("/api/agents")).toBeNull(); // a path, not a command
    expect(parseSlash("/ 3")).toBeNull();
    expect(parseSlash("/3")).toBeNull();
    expect(parseSlash("")).toBeNull();
    expect(parseSlash(null)).toBeNull();
  });
});

describe("fillTemplate / placeholderRange", () => {
  it("replaces {arg} with the argument or a visible placeholder", () => {
    expect(fillTemplate("Translate into {arg}:", "French")).toBe("Translate into French:");
    expect(fillTemplate("Translate into {arg}:", "")).toBe("Translate into «…»:");
    expect(placeholderRange("Translate into «…»:")).toEqual({ start: 15, end: 18 });
    expect(placeholderRange("no placeholder")).toBeNull();
  });

  it("appends the argument when the template has no slot", () => {
    expect(fillTemplate("Summarise this", "")).toBe("Summarise this");
    expect(fillTemplate("Summarise this", "briefly")).toBe("Summarise this briefly");
  });
});

describe("recent commands", () => {
  function memoryStorage() {
    const map = new Map();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  }

  it("keeps the most recent first, deduplicated, capped at six", () => {
    const s = memoryStorage();
    ["a", "b", "c", "a", "d", "e", "f", "g"].forEach((id) => recordRecentCommand(id, s));
    expect(loadRecentCommandIds(s)).toEqual(["g", "f", "e", "d", "a", "c"]);
  });

  it("survives a broken storage", () => {
    const broken = { getItem: () => "{not json", setItem: () => { throw new Error("full"); } };
    expect(loadRecentCommandIds(broken)).toEqual([]);
    expect(recordRecentCommand("x", broken)).toEqual(["x"]);
  });
});
