"use client";

import React from "react";
import { Hash, Layers, Settings2, Database, Zap } from "lucide-react";

/**
 * Top-of-page metric cards for the Tool Box page.
 * Pure presentational — all figures come from `stats`.
 */
export default function StatsBar({ stats }) {
  const cards = [
    { label: "Available Tools",   value: stats.totalTools,      icon: Hash,      color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
    { label: "Tool Categories",   value: stats.totalCategories, icon: Layers,    color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { label: "My Configurations", value: stats.totalConfigs,    icon: Settings2, color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
    { label: "MCP Servers",       value: stats.totalMcp,        icon: Database,  color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { label: "Skills",            value: stats.totalSkills,     icon: Zap,       color: "text-purple-300", bg: "bg-purple-400/10", border: "border-purple-400/20" },
  ];
  return (
    <div className="grid grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`${card.bg} ${card.border} border rounded-xl p-4 flex items-center gap-3`}>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <Icon size={20} className={card.color} />
            </div>
            <div>
              <p className="text-2xl font-black th-text">{card.value}</p>
              <p className="text-xs th-text-muted">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
