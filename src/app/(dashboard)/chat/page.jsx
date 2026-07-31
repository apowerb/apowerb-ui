"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ChatContainer from "@/components/chat/ChatContainer";
import Loading from "../loading";

function ChatPageInner() {
  const searchParams = useSearchParams();
  const agentParam = searchParams.get("agent");
  const sessionParam = searchParams.get("session");
  const dashboardParam = searchParams.get("dashboard");

  return (
    <ChatContainer
      initialAgent={agentParam}
      initialSession={sessionParam}
      initialDashboard={dashboardParam}
    />
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ChatPageInner />
    </Suspense>
  );
}
