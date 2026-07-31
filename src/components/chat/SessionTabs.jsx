"use client";

import { Database, MessageSquare } from "lucide-react";

export default function SessionTabs({ activeTab, onTabChange, sourceCount = 0, chatEnabled = false }) {
  const tabs = [
    {
      id: "sources",
      label: "Sources",
      icon: Database,
      badge: sourceCount > 0 ? sourceCount : null,
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
      disabled: !chatEnabled,
    },
  ];

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b th-border bg-white/2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            onClick={() => { if (!isDisabled) { window.location.hash = tab.id; onTabChange(tab.id); } }}
            disabled={isDisabled}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${isActive
                ? "bg-brand/20 text-brand border border-brand/30"
                : isDisabled
                  ? "th-text-ghost cursor-not-allowed"
                  : "th-text-muted hover:th-text-secondary hover:th-bg-surface-hover"
              }
            `}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-brand/30 text-brand">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
