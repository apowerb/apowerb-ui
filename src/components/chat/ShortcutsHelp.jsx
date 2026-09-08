"use client";

import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { Keyboard, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");
const MOD = IS_MAC ? "⌘" : "Ctrl";

const GROUPS = [
  {
    titleKey: "groupNavigate",
    items: [
      { keys: [`${MOD} K`], labelKey: "palette" },
      { keys: [`${MOD} ⇧ O`], labelKey: "newChat" },
      { keys: [`${MOD} ⇧ F`], labelKey: "findInThread" },
      { keys: [`${MOD} /`], labelKey: "thisHelp" },
    ],
  },
  {
    titleKey: "groupCompose",
    items: [
      { keys: ["/"], labelKey: "focusComposer" },
      { keys: ["/ …"], labelKey: "slashCommands" },
      { keys: ["@ …"], labelKey: "mentionAgent" },
      { keys: ["↑"], labelKey: "history" },
      { keys: ["Enter"], labelKey: "send" },
      { keys: ["⇧ Enter"], labelKey: "newline" },
      { keys: [`${MOD} B`, `${MOD} I`], labelKey: "markdown" },
    ],
  },
  {
    titleKey: "groupStream",
    items: [
      { keys: ["Esc"], labelKey: "stop" },
      { keys: ["```chart"], labelKey: "chartFence" },
    ],
  },
];

export default function ShortcutsHelp({ open, onClose }) {
  const t = useTranslations("ShortcutsHelp");
  const ref = useFocusTrap(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="glass-modal w-full max-w-lg rounded-2xl overflow-hidden animate-scale-up-center"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b th-border">
          <span className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/25 flex items-center justify-center">
            <Keyboard size={16} className="text-brand" />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold th-text">{t("title")}</h2>
            <p className="text-[11px] th-text-faint">{t("subtitle")}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg th-text-faint hover:th-text hover:th-bg-surface-hover" aria-label={t("close")}>
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 grid gap-5 sm:grid-cols-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {GROUPS.map((g) => (
            <section key={g.titleKey} className={g.titleKey === "groupCompose" ? "sm:row-span-2" : ""}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] th-text-ghost mb-2">{t(g.titleKey)}</h3>
              <ul className="space-y-1.5">
                {g.items.map((it) => (
                  <li key={it.labelKey} className="flex items-center justify-between gap-3 text-xs">
                    <span className="th-text-secondary">{t(it.labelKey)}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {it.keys.map((k) => (
                        <kbd key={k} className="px-1.5 py-0.5 rounded-md border th-border th-bg-surface text-[10px] font-mono th-text-muted">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
