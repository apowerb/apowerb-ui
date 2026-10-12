"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { ChevronUp, ChevronDown, X, Trash2 } from "lucide-react";
import { HEX_RE, SEMANTIC_COLORS, SWATCHES, insertAt } from "./lib";

export const INPUT_CLS =
  "w-full rounded-lg border th-border th-bg-input px-2.5 py-1.5 text-sm th-text placeholder:th-text-faint " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:opacity-50";
export const BTN_CLS =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border th-border px-2.5 py-1.5 text-xs font-medium th-text " +
  "hover:th-bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const BTN_PRIMARY_CLS =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white " +
  "hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const ICON_BTN_CLS =
  "p-1 rounded-md th-text-faint hover:th-text hover:th-bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:opacity-30 disabled:cursor-not-allowed";

/** Labelled form row with an inline error. */
export function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-wide th-text-muted">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] th-text-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-[11px] text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Text input committed after `debounce` ms of inactivity, on blur and on
 * unmount. The draft is resynchronised with `value` whenever it is not dirty.
 * `ref.current.insert(text)` inserts at the caret.
 */
export function TextField({
  label,
  value,
  onCommit,
  error,
  hint,
  multiline = false,
  mono = false,
  rows = 3,
  placeholder,
  debounce = 400,
  disabled = false,
  ref,
  ...rest
}) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  const draftRef = useRef(value ?? "");
  const dirty = useRef(false);
  const timer = useRef(null);
  const commitRef = useRef(onCommit);
  const el = useRef(null);

  useEffect(() => {
    commitRef.current = onCommit;
  });

  useEffect(() => {
    if (!dirty.current) {
      setDraft(value ?? "");
      draftRef.current = value ?? "";
    }
  }, [value]);

  const flush = () => {
    clearTimeout(timer.current);
    if (dirty.current) {
      dirty.current = false;
      commitRef.current?.(draftRef.current);
    }
  };
  useEffect(() => () => flush(), []);

  const change = (v) => {
    setDraft(v);
    draftRef.current = v;
    dirty.current = true;
    clearTimeout(timer.current);
    if (debounce === 0) flush();
    else timer.current = setTimeout(flush, debounce);
  };

  useImperativeHandle(ref, () => ({
    insert(token) {
      const pos = el.current ? el.current.selectionStart : null;
      const { text, caret } = insertAt(draftRef.current, token, pos);
      change(text);
      requestAnimationFrame(() => {
        if (el.current) {
          el.current.focus();
          try {
            el.current.setSelectionRange(caret, caret);
          } catch {
            /* not focusable in this environment */
          }
        }
      });
    },
  }));

  const Tag = multiline ? "textarea" : "input";
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Tag
        id={id}
        ref={el}
        value={draft}
        rows={multiline ? rows : undefined}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
        className={`${INPUT_CLS} ${mono ? "font-mono text-xs" : ""} ${multiline ? "resize-y" : ""}`}
        {...rest}
      />
    </Field>
  );
}

/** Number input with the same debounce; empty = null. */
export function NumberField({ label, value, onCommit, error, min, max, step, placeholder, disabled }) {
  return (
    <TextField
      label={label}
      value={value == null ? "" : String(value)}
      error={error}
      placeholder={placeholder}
      disabled={disabled}
      type="number"
      min={min}
      max={max}
      step={step}
      onCommit={(raw) => {
        const n = raw === "" ? null : Number(raw);
        onCommit(Number.isFinite(n) ? n : null);
      }}
    />
  );
}

/** options: [{value, label}] ; `empty` adds a leading blank option. */
export function SelectField({ label, value, onChange, options, empty, error, hint, disabled }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className={INPUT_CLS}
      >
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint, disabled }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-sm th-text cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded accent-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400/60"
        />
        {label}
      </label>
      {hint && <p className="ml-6 text-[11px] th-text-faint">{hint}</p>}
    </div>
  );
}

export function Section({ title, children, action }) {
  return (
    <section className="space-y-2.5 border-t th-border pt-3 first:border-t-0 first:pt-0">
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h3 className="text-xs font-bold uppercase tracking-wider th-text-secondary">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Up / down / remove controls of a list row. */
export function RowControls({ index, count, onMove, onRemove, name }) {
  const t = useTranslations("biEditor");
  return (
    <div className="flex items-center shrink-0">
      {onMove && (
        <>
          <button type="button" className={ICON_BTN_CLS} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={t("moveUp", { name })}>
            <ChevronUp size={14} />
          </button>
          <button type="button" className={ICON_BTN_CLS} disabled={index >= count - 1} onClick={() => onMove(index, index + 1)} aria-label={t("moveDown", { name })}>
            <ChevronDown size={14} />
          </button>
        </>
      )}
      {onRemove && (
        <button type="button" className={ICON_BTN_CLS} onClick={() => onRemove(index)} aria-label={t("remove", { name })}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Destructive button with an inline confirmation (no window.confirm). */
export function ConfirmButton({ label, confirmLabel, onConfirm, disabled, name }) {
  const t = useTranslations("biEditor");
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={`${BTN_CLS} text-red-400`} aria-label={name ? `${label} ${name}` : label}>
        <Trash2 size={13} /> {label}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={confirmLabel} className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1.5">
      <span className="text-xs text-red-300">{confirmLabel}</span>
      <button
        type="button"
        autoFocus
        className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {t("confirm")}
      </button>
      <button type="button" className={BTN_CLS} onClick={() => setAsking(false)}>
        {t("cancel")}
      </button>
    </div>
  );
}

export function colorToCss(color) {
  if (!color) return "transparent";
  return SEMANTIC_COLORS[color] || (HEX_RE.test(color) ? color : "transparent");
}

/** Semantic palette + swatches + custom hex. */
export function ColorPicker({ label, value, onChange }) {
  const t = useTranslations("biEditor");
  const id = useId();
  const isCustom = value && !SEMANTIC_COLORS[value];
  const [hex, setHex] = useState(isCustom ? value : "");
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setHex(value && !SEMANTIC_COLORS[value] ? value : "");
  }

  const swatch = (key, css, aria, selected) => (
    <button
      key={key}
      type="button"
      title={aria}
      aria-label={aria}
      aria-pressed={selected}
      onClick={() => onChange(key)}
      className={`h-5 w-5 rounded-full border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${selected ? "ring-2 ring-offset-1 ring-blue-400 border-white/60" : "th-border"}`}
      style={{ background: css }}
    />
  );

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5">
        {Object.keys(SEMANTIC_COLORS).map((k) => swatch(k, SEMANTIC_COLORS[k], t(`color.${k}`), value === k))}
        <span className="mx-1 h-4 w-px th-border border-l" aria-hidden="true" />
        {SWATCHES.map((h) => swatch(h, h, h, value && value.toLowerCase() === h))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={t("colorPick")}
          value={HEX_RE.test(hex) ? hex : "#3b82f6"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 rounded border th-border bg-transparent p-0.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400"
        />
        <input
          id={id}
          aria-label={t("colorHex")}
          placeholder="#rrggbb"
          value={hex}
          onChange={(e) => {
            setHex(e.target.value);
            if (HEX_RE.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          className={`${INPUT_CLS} font-mono text-xs`}
          aria-invalid={hex !== "" && !HEX_RE.test(hex) ? true : undefined}
        />
        {value && (
          <button type="button" className={ICON_BTN_CLS} onClick={() => onChange(null)} aria-label={t("colorClear")}>
            <X size={14} />
          </button>
        )}
      </div>
    </fieldset>
  );
}
