"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  payloadRows,
  rowsToPayloadText,
  textToPayloadText,
  payloadMessage,
  formatPayloadText,
} from "@/lib/workflowPayload";

const MODES = ["json", "text", "form"];

function isMessageOnly(text) {
  try {
    const value = JSON.parse((text || "").trim() || "{}");
    const keys = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : null;
    return !!keys && (keys.length === 0 || (keys.length === 1 && typeof value.message === "string"));
  } catch {
    return false;
  }
}

const inputClass =
  "px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text placeholder:th-text-ghost";

/**
 * Test-run payload in three shapes: raw JSON, plain text (sent as
 * `{ "message": ... }`) or a key/value form. Every mode writes the same JSON
 * text through `onChange`, so the run itself does not care which one is used.
 */
export default function PayloadEditor({ value, onChange, error, t }) {
  const [mode, setMode] = useState("json");
  const [rows, setRows] = useState([]);
  const formRows = mode === "form" ? rows : null;

  const switchTo = (next) => {
    if (next === "form") {
      const initial = payloadRows(value);
      if (initial === null) return;
      setRows(initial.length ? initial : [{ key: "", value: "" }]);
    }
    setMode(next);
  };

  const updateRows = (next) => {
    setRows(next);
    onChange(rowsToPayloadText(next));
  };

  const formUnavailable = payloadRows(value) === null;
  // Text mode would overwrite a structured payload on the first keystroke:
  // it opens only on an empty payload or one that is just a message.
  const textUnavailable = !isMessageOnly(value);
  const unavailable = { form: formUnavailable, text: textUnavailable };

  return (
    <div>
      <div role="tablist" aria-label={t("payloadTitle")} className="flex gap-1 mb-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            disabled={mode !== m && !!unavailable[m]}
            title={mode !== m && unavailable[m] ? t(`payloadUnavailable_${m}`) : undefined}
            onClick={() => switchTo(m)}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border th-border-secondary disabled:opacity-40 ${mode === m ? "th-bg-surface th-text" : "th-text-ghost hover:th-text-secondary"}`}
          >
            {t(`payloadMode_${m}`)}
          </button>
        ))}
      </div>

      {mode === "json" && (
        <>
          <textarea
            aria-label={t("payloadTitle")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg th-bg-surface border ${error ? "border-red-500/60" : "th-border-secondary"} th-text resize-y focus:outline-none focus:ring-1 focus:ring-brand`}
          />
          <div className="flex items-center justify-between mt-1">
            {error ? <p className="text-[10px] text-red-400">{t("invalidJson", { message: error })}</p> : <span />}
            <button
              type="button"
              disabled={!!error}
              onClick={() => {
                const formatted = formatPayloadText(value);
                if (formatted !== null) onChange(formatted);
              }}
              className="text-[10px] font-medium th-text-ghost hover:th-text-secondary disabled:opacity-40"
            >
              {t("payloadFormat")}
            </button>
          </div>
        </>
      )}

      {mode === "text" && (
        <>
          <textarea
            aria-label={t("payloadMode_text")}
            value={payloadMessage(value)}
            onChange={(e) => onChange(textToPayloadText(e.target.value))}
            rows={8}
            placeholder={t("payloadTextPlaceholder")}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text resize-y focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <p className="mt-1 text-[10px] th-text-ghost">{t("payloadTextHelp")}</p>
        </>
      )}

      {formRows && (
        <>
          <div className="flex flex-col gap-1.5">
            {formRows.map((row, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input
                  aria-label={t("payloadFieldKey")}
                  value={row.key}
                  placeholder={t("payloadFieldKey")}
                  onChange={(e) => updateRows(formRows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                  className={`w-1/3 font-mono ${inputClass}`}
                />
                <input
                  aria-label={t("payloadFieldValue")}
                  value={row.value}
                  placeholder={t("payloadFieldValue")}
                  onChange={(e) => updateRows(formRows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                  className={`flex-1 min-w-0 ${inputClass}`}
                />
                <button
                  type="button"
                  title={t("payloadRemoveField")}
                  aria-label={t("payloadRemoveField")}
                  onClick={() => updateRows(formRows.filter((_, j) => j !== i))}
                  className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setRows([...formRows, { key: "", value: "" }])}
            className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary"
          >
            <Plus size={12} />
            {t("payloadAddField")}
          </button>
          <p className="mt-1 text-[10px] th-text-ghost">{t("payloadFormHelp")}</p>
        </>
      )}
    </div>
  );
}
