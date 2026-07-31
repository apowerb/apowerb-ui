"use client";

import ChatContainer from "@/components/chat/ChatContainer";
import ChatPageShell from "@/components/chat/ChatPageShell";
import { BookOpen } from "lucide-react";

function ragFilter(agent) {
  try {
    const raw = agent.tags || "";
    const tags = typeof raw === "string" && raw.trim().startsWith("[")
      ? JSON.parse(raw)
      : Array.isArray(raw) ? raw : [];
    return tags.some((t) => String(t).toLowerCase() === "rag");
  } catch {
    return false;
  }
}

export default function RagPage() {
  return (
    <ChatPageShell
      icon={BookOpen}
      label="Knowledge Chat"
      tag="RAG"
      tagColor="var(--color-brand)"
      description="Ask questions across your documents"
    >
      <ChatContainer
        agentFilter={ragFilter}
        filterLabel="RAG"
        sessionKeywords={["rag_assistant", "knowledge_assistant"]}
      />
    </ChatPageShell>
  );
}