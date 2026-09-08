"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import * as Icons from "lucide-react";
import { Bot, ChevronRight, CornerDownLeft } from "lucide-react";

/**
 * The popover above the composer for `/commands` and `@agents`. Fully
 * keyboard-driven by the parent (it owns the textarea): the menu only paints
 * `items` and `index`, and reports clicks.
 */
export default function ComposerMenu({ kind, items, index, onPick, onHover }) {
  const t = useTranslations("ComposerMenu");
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!items?.length) {
    return (
      <div className="absolute left-0 right-0 bottom-full mb-2 rounded-xl border th-border shadow-2xl px-3 py-2 text-[11px] th-text-faint" style={{ background: "var(--bg-dropdown)" }} role="status">
        {kind === "slash" ? t("noCommand") : t("noAgent")}
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label={kind === "slash" ? t("commandsLabel") : t("agentsLabel")}
      className="absolute left-0 right-0 bottom-full mb-2 max-h-72 overflow-y-auto custom-scrollbar rounded-xl border th-border shadow-2xl py-1 animate-fade-in"
      style={{ background: "var(--bg-dropdown)" }}
    >
      <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] th-text-ghost flex items-center justify-between">
        <span>{kind === "slash" ? t("commandsLabel") : t("agentsLabel")}</span>
        <span className="font-normal normal-case tracking-normal">{t("hint")}</span>
      </div>
      {items.map((item, i) => {
        const selected = i === index;
        const Icon = kind === "slash" ? (item.iconName && Icons[item.iconName]) || ChevronRight : Bot;
        return (
          <div
            key={item.id}
            id={`composer-menu-${item.id}`}
            ref={selected ? activeRef : null}
            role="option"
            aria-selected={selected}
            onMouseEnter={() => onHover?.(i)}
            onMouseDown={(e) => {
              e.preventDefault(); // keep the textarea focused
              onPick(item);
            }}
            className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer text-sm transition-colors ${
              selected ? "th-bg-surface-hover" : "hover:th-bg-surface"
            }`}
          >
            <Icon size={14} className={`shrink-0 ${kind === "slash" ? "text-brand" : "text-brand"}`} />
            <span className="flex items-baseline gap-2 min-w-0 flex-1">
              <span className="th-text-secondary font-medium truncate">
                {kind === "slash" ? `/${item.slash}` : item.label}
              </span>
              <span className="text-[11px] th-text-ghost truncate">
                {kind === "slash" ? item.label : item.sub}
              </span>
            </span>
            {kind === "slash" && item.argsHint && (
              <span className="text-[10px] th-text-ghost italic shrink-0 hidden sm:inline">{item.argsHint}</span>
            )}
            {selected && <CornerDownLeft size={12} className="th-text-ghost shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
