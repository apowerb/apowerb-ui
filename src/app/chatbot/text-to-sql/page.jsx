"use client";

import ChatContainer from "@/components/chat/ChatContainer";
import ChatPageShell from "@/components/chat/ChatPageShell";
import { Database } from "lucide-react";

function textToSqlFilter(agent) {
  try {
    const raw = agent.tags || "";
    const tags = typeof raw === "string" && raw.trim().startsWith("[")
      ? JSON.parse(raw)
      : Array.isArray(raw) ? raw : [];
    return tags.some((t) => String(t).toLowerCase() === "text-to-sql");
  } catch {
    return false;
  }
}

export default function TextToSqlPage() {
  return (
    <ChatPageShell
      icon={Database}
      label="Data Explorer"
      tag="Text-to-SQL"
      tagColor="#00c2a8"
      description="Query your databases in plain English"
    >
      <ChatContainer
        agentFilter={textToSqlFilter}
        filterLabel="Text-to-SQL"
        sessionKeywords={["text_to_sql"]}
      />
    </ChatPageShell>
  );
}