"use client";

import { MessageSquare } from "lucide-react";

export default function ChatEmptyState({
  icon: Icon = MessageSquare,
  title = "Select a conversation",
  description = "Choose an existing chat or start a new one",
}) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Icon size={48} className="mx-auto mb-4 text-brand/50" />
        <h3 className="text-lg font-semibold th-text-faint mb-2">{title}</h3>
        <p className="text-sm th-text-ghost">{description}</p>
      </div>
    </div>
  );
}
