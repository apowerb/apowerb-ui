"use client";

import { useId, useState } from "react";
import { Send, Check, Loader2 } from "lucide-react";
import { STATUS_STYLES } from "./statusStyles";
import useActionCardSubmit from "./useActionCardSubmit";

export default function UserInputCard({ card, onRespond }) {
  const [value, setValue] = useState("");
  const inputId = useId();
  const { submitting, handleSubmit } = useActionCardSubmit(card);

  if (!card) return null;
  const { data = {}, status, response } = card;
  const inputType = data.input_type || "text";
  const border = STATUS_STYLES[status] || STATUS_STYLES.pending;

  const isEmpty = value === "" || value === null || value === undefined;
  const canSubmit = !isEmpty && !submitting && status === "pending";

  const sendValue = () => {
    if (!canSubmit) return;
    const payload =
      inputType === "number"
        ? { type: "number", value: Number(value) }
        : { type: inputType, value: String(value) };
    handleSubmit(() => onRespond?.(payload));
  };

  const sendChoice = (choice) => {
    if (submitting || status !== "pending") return;
    handleSubmit(() =>
      onRespond?.({ type: "chips", value: String(choice) }),
    );
  };

  const onKeyDown = (e) => {
    if (inputType === "multiline") return;
    if (e.key === "Enter") {
      e.preventDefault();
      sendValue();
    }
  };

  const inputClass =
    "flex-1 px-2.5 py-1.5 rounded-lg th-bg-surface border th-border text-xs th-text-secondary outline-none focus:border-blue-500/40 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0";

  return (
    <div
      role="group"
      aria-label={card.ariaLabel || "User input request"}
      className={`my-3 rounded-xl border overflow-hidden ${border}`}
    >
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <label
          htmlFor={inputId}
          className="text-xs font-medium th-text-secondary"
        >
          {data.question}
        </label>

        {status === "done" ? (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg th-bg-surface text-xs th-text-muted">
            <Check size={12} className="text-emerald-400 shrink-0" />
            <span className="truncate">{String(response?.value ?? response ?? "")}</span>
          </div>
        ) : inputType === "chips" ? (
          <div className="flex flex-col gap-2">
            {(data.choices || []).length > 0 && (
              <div
                className="flex flex-wrap gap-1.5"
                data-testid="chips-options"
              >
                {(data.choices || []).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => sendChoice(choice)}
                    disabled={submitting || status !== "pending"}
                    className="px-2.5 py-1.5 rounded-lg th-bg-surface border th-border hover:border-blue-500/40 hover:text-blue-300 th-text-secondary text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={
                  data.placeholder || "Or type another answer…"
                }
                disabled={submitting}
                className={inputClass}
              />
              <button
                type="button"
                onClick={sendValue}
                disabled={!canSubmit}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {submitting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={12} />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {inputType === "select" ? (
              <select
                id={inputId}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={submitting}
                className={inputClass}
              >
                <option value="" disabled>
                  Select an answer…
                </option>
                {(data.choices || []).map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            ) : inputType === "multiline" ? (
              <textarea
                id={inputId}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={data.placeholder || ""}
                rows={3}
                disabled={submitting}
                className={`${inputClass} resize-y`}
              />
            ) : inputType === "date" ? (
              <input
                id={inputId}
                type="date"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={submitting}
                className={inputClass}
              />
            ) : inputType === "number" ? (
              <input
                id={inputId}
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={data.placeholder || ""}
                disabled={submitting}
                className={inputClass}
              />
            ) : (
              <input
                id={inputId}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={data.placeholder || ""}
                disabled={submitting}
                className={inputClass}
              />
            )}

            <button
              type="button"
              onClick={sendValue}
              disabled={!canSubmit}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
            >
              {submitting ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send size={12} />
                  Send
                </>
              )}
            </button>
          </div>
        )}

        {status === "error" && (
          <p className="flex items-center gap-1 text-[11px] text-red-400">
            {card.errorMessage || "Action failed"}
          </p>
        )}
      </div>
    </div>
  );
}
