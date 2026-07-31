import { describe, it, expect } from "vitest";
import {
  filterAndSortTools,
  toolLeafName,
} from "@/components/tools-manager/toolsManagerUtils";

describe("toolLeafName", () => {
  it("returns the human-facing leaf name (mirrors UI display)", () => {
    expect(toolLeafName("pkg.mod.tool_send_email")).toBe("send_email");
    expect(toolLeafName("tool_alpha")).toBe("alpha");
    expect(toolLeafName("plain")).toBe("plain");
  });
});

describe("filterAndSortTools", () => {
  const tools = {
    tools_db: ["b_query", "a_insert"],
    tools_ai: ["tool_zebra", "tool_alpha", "mid_tool"],
  };

  it("sorts tools alphabetically WITHIN each category (LANE-C fix a)", () => {
    const res = filterAndSortTools(tools, {
      toolSearch: "",
      categoryFilter: "all",
      toolSortAsc: true,
    });
    const ai = res.find(([c]) => c === "tools_ai")[1];
    const db = res.find(([c]) => c === "tools_db")[1];
    expect(ai).toEqual(["tool_alpha", "mid_tool", "tool_zebra"]);
    expect(db).toEqual(["a_insert", "b_query"]);
  });

  it("still orders categories by toolSortAsc (no regression)", () => {
    const asc = filterAndSortTools(tools, {
      toolSearch: "",
      categoryFilter: "all",
      toolSortAsc: true,
    }).map(([c]) => c);
    const desc = filterAndSortTools(tools, {
      toolSearch: "",
      categoryFilter: "all",
      toolSortAsc: false,
    }).map(([c]) => c);
    expect(asc).toEqual(["tools_ai", "tools_db"]);
    expect(desc).toEqual(["tools_db", "tools_ai"]);
  });

  it("does not mutate the input arrays", () => {
    const snapshot = JSON.parse(JSON.stringify(tools));
    filterAndSortTools(tools, {
      toolSearch: "",
      categoryFilter: "all",
      toolSortAsc: true,
    });
    expect(tools).toEqual(snapshot);
  });
});
