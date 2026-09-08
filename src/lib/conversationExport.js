/**
 * Conversation export — one Markdown/JSON writer shared by the header menu,
 * the command palette and the `/export` slash command.
 */

import { formatDate, formatDateTime } from "@/lib/datetime";

const DEFAULT_LABELS = {
  agent: "Agent",
  date: "Date",
  user: "User",
  assistant: "Assistant",
  toolCalls: (n) => `${n} tool call${n > 1 ? "s" : ""}`,
  interrupted: "(interrupted)",
  empty: "(no content)",
};

/** Markdown transcript: title, meta, then every turn with its timestamp. */
export function formatConversationMarkdown(session, messages, labels = {}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const lines = [];
  lines.push(`# ${session?.title || session?.agentName || "Conversation"}`);
  lines.push(`${L.agent}: ${session?.agentName || session?.agentId || ""}`);
  lines.push(`${L.date}: ${formatDate(session?.createdAt || Date.now())}`);
  lines.push("---\n");
  for (const msg of messages || []) {
    if (msg.isSynthetic) continue;
    const role = msg.role === "user" ? L.user : session?.agentName || L.assistant;
    lines.push(`**${role}** (${formatDateTime(msg.timestamp)}):`);
    const rawContent = typeof msg.content === "string" ? msg.content : "";
    const thinking = typeof msg.thinking === "string" ? msg.thinking : "";
    const content = rawContent.trim() ? rawContent : thinking;
    if (content.trim()) lines.push(content);
    else if (msg.role === "assistant") lines.push(`_${L.empty}_`);
    if (msg.status === "interrupted") lines.push(`_${L.interrupted}_`);
    if (msg.toolCalls?.length) lines.push(`\n_[${L.toolCalls(msg.toolCalls.length)}]_`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Portable JSON: the session minus per-browser bookkeeping. */
export function conversationToJson(session, messages) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      id: session?.id,
      title: session?.title,
      agentId: session?.agentId,
      agentName: session?.agentName,
      createdAt: session?.createdAt,
      updatedAt: session?.updatedAt,
      tags: session?.tags || [],
      messages: (messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.thinking && { thinking: m.thinking }),
        ...(m.steps?.length && { steps: m.steps }),
        ...(m.toolCalls?.length && { toolCalls: m.toolCalls }),
        ...(m.actionCards?.length && { actionCards: m.actionCards }),
        ...(m.attachments?.length && { attachments: m.attachments.map(({ preview, ...a }) => a) }),
        ...(m.status && { status: m.status }),
        ...(m.error && { error: m.error }),
        ...(m.isSynthetic && { isSynthetic: true }),
        ...(m.meta && { meta: m.meta }),
      })),
    },
    null,
    2,
  );
}

/** File-safe name from a title. */
export function exportFilename(session, ext) {
  const base = String(session?.title || session?.agentName || "conversation")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "conversation";
  return `${base}.${ext}`;
}

/** Trigger a browser download of a text blob. No-op outside the browser. */
export function downloadText(filename, text, mime = "text/plain") {
  if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") return false;
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
