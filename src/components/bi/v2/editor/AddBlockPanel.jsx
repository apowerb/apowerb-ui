"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { SelectField } from "./fields";
import { BLOCK_TYPES, defaultVisual, measuresFor, newId } from "./lib";

/**
 * Gallery of block types. One click adds a block pre-filled from the chosen
 * dashboard source (first date on x, first measure as series, ...) and
 * selects it.
 * editor = { dashboard, data, apply, onSelect }
 */
export default function AddBlockPanel({ editor, onNeedSource }) {
  const t = useTranslations("biEditor");
  const { dashboard, data, apply, onSelect } = editor;
  const sources = dashboard.sources || [];
  const hasSource = sources.length > 0;
  const [sourceName, setSourceName] = useState(null);

  const add = async (type) => {
    const draft = defaultVisual(type, dashboard, data, { noteTitle: t("noteDefaultTitle"), noteText: t("noteDefaultText") }, sourceName);
    if (!draft) return;
    const { visual, ops } = measuresFor(draft, dashboard, data);
    const id = newId();
    const next = await apply([...ops, { op: "add_visual", visual, component_id: id }]);
    if (next) onSelect?.(id);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs th-text-muted">{t("addIntro")}</p>
      {sources.length > 1 && (
        <SelectField
          label={t("blockSource")}
          value={sourceName || sources[0].name}
          options={sources.map((s) => ({ value: s.name, label: s.label || s.name }))}
          onChange={setSourceName}
        />
      )}
      {!hasSource && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-300">
          {t("addNeedsSource")}{" "}
          {onNeedSource && (
            <button type="button" className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" onClick={onNeedSource}>
              {t("goToData")}
            </button>
          )}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {BLOCK_TYPES.map(({ type, icon: Icon }) => {
          const disabled = type !== "note" && !hasSource;
          return (
            <li key={type}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => add(type)}
                className="group flex h-full w-full flex-col items-start gap-1.5 rounded-xl border th-border p-2.5 text-left hover:th-bg-surface-hover hover:th-border-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="flex h-9 w-full items-center justify-center rounded-lg th-bg-input text-blue-400 group-hover:text-blue-300" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span className="text-sm font-medium th-text">{t(`types.${type}`)}</span>
                <span className="text-[11px] leading-snug th-text-faint">{t(`typeHints.${type}`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
