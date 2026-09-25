import { describe, it, expect } from "vitest";
import {
  MCP_TEMPLATES,
  isToolConfig,
  mcpEndpoint,
  parseToolNames,
  templateForMcp,
} from "../toolsManagerUtils";

describe("MCP server display", () => {
  it("never shows the query string of an MCP URL (it carries API keys)", () => {
    const mcp = { transport: "http", url: "https://mcp.tavily.com/mcp/?tavilyApiKey=tvly-SECRET" };
    expect(mcpEndpoint(mcp)).toBe("https://mcp.tavily.com/mcp/");
    expect(mcpEndpoint(mcp)).not.toContain("SECRET");
  });

  it("summarises a database server as a DSN without password", () => {
    const mcp = {
      transport: "http", mcp_type: "toolbox-db", url: "http://localhost:5000",
      db_config: { db_type: "postgres", user: "reader", host: "db.example.com", port: "5432", database: "sales" },
    };
    expect(mcpEndpoint(mcp)).toBe("postgres://reader@db.example.com:5432/sales");
  });

  it("summarises a stdio server as its command line", () => {
    expect(mcpEndpoint({ transport: "stdio", command: "npx", args: ["-y", "srv"] })).toBe("npx -y srv");
  });

  it("re-opens a saved stdio server on the Local process template, not HTTP", () => {
    expect(templateForMcp({ transport: "stdio" })).toBe("custom-stdio");
    expect(templateForMcp({ transport: "http" })).toBe("custom-http");
    expect(templateForMcp({ transport: "http", mcp_type: "toolbox-db" })).toBe("toolbox-db");
  });

  it("spells every template accent as literal Tailwind classes", () => {
    // Classes built at render time (`bg-${color}-500/10`) are never compiled.
    for (const tpl of MCP_TEMPLATES) {
      expect(tpl.accent.tile).toMatch(/^bg-[a-z]+-500\/15 text-[a-z]+-[45]00$/);
      expect(tpl.accent.active).toMatch(/^border-[a-z]+-500\/50 /);
    }
  });
});

describe("tool configurations", () => {
  it("leaves MCP servers out of the configurations list", () => {
    expect(isToolConfig({ tool_category: "mcp_server" })).toBe(false);
    expect(isToolConfig({ tool_category: "emailing" })).toBe(true);
  });

  it("reads tool_name as one tool or a JSON list", () => {
    expect(parseToolNames("a.tool_x")).toEqual(["a.tool_x"]);
    expect(parseToolNames('["a.tool_x","a.tool_y"]')).toEqual(["a.tool_x", "a.tool_y"]);
    expect(parseToolNames("[not json")).toEqual(["[not json"]);
    expect(parseToolNames("")).toEqual([]);
  });
});
