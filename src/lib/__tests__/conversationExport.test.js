import { describe, it, expect } from "vitest";
import { formatConversationMarkdown, conversationToJson, exportFilename } from "../conversationExport";

const session = { id: "s1", title: "Étude Q3", agentName: "Analyste", agentId: "agent7", createdAt: 0 };
const messages = [
  { id: "u1", role: "user", content: "Bonjour", timestamp: 0 },
  { id: "a1", role: "assistant", content: "", thinking: "je réfléchis", toolCalls: [{ name: "db" }], timestamp: 0 },
  { id: "u2", role: "user", content: "[Response to x]", timestamp: 0, isSynthetic: true },
  { id: "a2", role: "assistant", content: "Moitié", status: "interrupted", timestamp: 0 },
  { id: "a3", role: "assistant", content: "", status: "empty", timestamp: 0 },
];

describe("formatConversationMarkdown", () => {
  it("writes a title, skips synthetic turns, falls back to thinking and marks states", () => {
    const md = formatConversationMarkdown(session, messages, { toolCalls: (n) => `${n} appel` });
    expect(md.startsWith("# Étude Q3")).toBe(true);
    expect(md).toContain("**Analyste**");
    expect(md).toContain("je réfléchis");
    expect(md).toContain("_[1 appel]_");
    expect(md).not.toContain("[Response to x]");
    expect(md).toContain("_(interrupted)_");
    expect(md).toContain("_(no content)_");
  });
});

describe("conversationToJson / exportFilename", () => {
  it("keeps the portable fields and drops previews", () => {
    const data = JSON.parse(conversationToJson(session, [{ id: "u", role: "user", content: "x", timestamp: 1, attachments: [{ name: "a.png", preview: "data:…" }] }]));
    expect(data.title).toBe("Étude Q3");
    expect(data.messages[0].attachments[0]).toEqual({ name: "a.png" });
    expect(typeof data.exportedAt).toBe("string");
  });

  it("builds a safe file name", () => {
    expect(exportFilename(session, "md")).toBe("etude-q3.md");
    expect(exportFilename({ title: "   " }, "json")).toBe("conversation.json");
  });
});
