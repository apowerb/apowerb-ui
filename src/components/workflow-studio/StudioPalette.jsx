"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "use-intl";
import { NODE_FAMILIES, UNRUNNABLE_NODE_TYPES } from "@/lib/workflowGraph";
import { NODE_ICONS } from "./nodeIcons";


const FAMILY_ORDER = ["trigger", "intelligence", "tools", "logic", "output"];
const FAMILY_LABEL_KEY = {
  trigger: "familyTrigger",
  intelligence: "familyIntelligence",
  tools: "familyTools",
  logic: "familyLogic",
  output: "familyOutput",
};

const PALETTE_ITEMS = Object.entries(NODE_FAMILIES).map(([type, meta]) => ({
  type,
  ...meta,
  icon: NODE_ICONS[type],
}));

const EMPTY_HIDDEN = new Set();

// One JSON blob rather than one key per family: fewer localStorage round
// trips, and the whole thing is small (5 booleans).
const COLLAPSE_STORAGE_KEY = "workflow-studio:palette-collapsed-families";

/** localStorage can be unavailable or throw (private browsing, quota,
 * disabled storage) — every read/write is best-effort, never fatal. */
function readStoredCollapsed() {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredCollapsed(value) {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Collapse state just won't survive a reload — not worth surfacing.
  }
}

/**
 * Left-hand node palette: drag onto the canvas, or click to add at a
 * default spot (the caller decides where — usually near the viewport
 * center). Types in `UNRUNNABLE_NODE_TYPES` (currently just `approval`) stay
 * visible with a "soon" badge, per design. `hiddenTypes` instead removes a
 * type from the list entirely — used by the loop/try body editor to drop
 * `loop`/`try`/`approval` so a body can't nest another flow-control
 * container in this pass.
 *
 * Families are collapsible: each header is a real <button> that toggles
 * `aria-expanded` and the family's items, and the collapsed/expanded state
 * per family is remembered in localStorage across sessions. Typing a
 * non-empty search always shows every family expanded (so results aren't
 * hidden behind a collapsed header) without touching the stored
 * preference — clearing the search restores it.
 */
export default function StudioPalette({ onAdd, hiddenTypes = EMPTY_HIDDEN }) {
  const t = useTranslations("WorkflowPalette");
  const tHelp = useTranslations("WorkflowNodeHelp");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(() => readStoredCollapsed());

  const items = useMemo(() => {
    const visible = PALETTE_ITEMS.filter((item) => !hiddenTypes.has(item.type));
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((item) => t(`node${capitalize(item.type)}`).toLowerCase().includes(q));
  }, [query, hiddenTypes, t]);

  const isSearching = query.trim().length > 0;

  const groups = FAMILY_ORDER.map((family) => ({
    family,
    items: items.filter((i) => i.family === family),
  })).filter((g) => g.items.length > 0);

  const onDragStart = (e, type) => {
    e.dataTransfer.setData("application/workflow-node-type", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  const toggleFamily = (family) => {
    setCollapsed((prev) => {
      const next = { ...prev, [family]: !prev[family] };
      writeStoredCollapsed(next);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full th-bg-sidebar border-r th-border-secondary w-14 xl:w-64 shrink-0">
      <div className="hidden xl:block p-3 border-b th-border-secondary">
        <div className="text-xs font-semibold uppercase tracking-wider th-text-ghost mb-2 px-0.5">
          {t("title")}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 th-text-ghost" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
        {groups.length === 0 && (
          <p className="text-xs th-text-ghost px-2 py-4 text-center">{t("noResults", { query })}</p>
        )}
        {groups.map((group, index) => {
          const isCollapsed = !isSearching && !!collapsed[group.family];
          const contentId = `palette-family-items-${group.family}`;
          return (
            <div key={group.family}>
              {index > 0 && (
                // Icon-only mode (<1280px) hides the family title below —
                // this line replaces it as the visual family boundary.
                <hr
                  data-testid="palette-family-separator"
                  className="block xl:hidden mb-2 -mt-1 th-border-secondary"
                />
              )}
              <button
                type="button"
                onClick={() => toggleFamily(group.family)}
                aria-expanded={!isCollapsed}
                aria-controls={contentId}
                data-testid={`palette-family-header-${group.family}`}
                className="hidden xl:flex items-center justify-between w-full px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider th-text-ghost hover:th-text-secondary transition-colors"
              >
                <span>{t(FAMILY_LABEL_KEY[group.family])}</span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                />
              </button>
              {!isCollapsed && (
                <div id={contentId} className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const soon = UNRUNNABLE_NODE_TYPES.has(item.type);
                    return (
                      <button
                        key={item.type}
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStart(e, item.type)}
                        onClick={() => onAdd?.(item.type)}
                        title={`${t(`node${capitalize(item.type)}`)} — ${tHelp(`${item.type}_what`)} ${t("dragHint")}`}
                        className="flex items-center justify-center xl:justify-start gap-2.5 px-0 xl:px-2.5 py-2 rounded-xl th-bg-surface hover:th-bg-surface-hover border th-border-secondary hover:th-border-hover text-left transition-colors cursor-grab active:cursor-grabbing"
                      >
                        <span className={`p-1.5 rounded-lg bg-linear-to-br ${colorGradient(item.color)} shadow-sm shrink-0`}>
                          <Icon size={13} className="text-white" />
                        </span>
                        <span className="hidden xl:block flex-1 min-w-0 text-xs font-medium th-text-secondary truncate">
                          {t(`node${capitalize(item.type)}`)}
                        </span>
                        {soon && (
                          <span className="hidden xl:inline px-1.5 py-0.5 text-[9px] font-semibold rounded th-bg-elevated th-text-ghost border th-border-secondary shrink-0">
                            {t("soon")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function colorGradient(color) {
  const map = {
    amber: "from-amber-400 to-amber-600",
    brand: "from-brand to-brand-secondary",
    violet: "from-violet-500 to-purple-600",
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-blue-500 to-blue-600",
  };
  return map[color] || map.brand;
}
