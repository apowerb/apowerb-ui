"use client";

import { useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2, Play } from "lucide-react";
import { BTN_CLS, BTN_PRIMARY_CLS, Field, INPUT_CLS, NumberField, SelectField, TextField, Toggle } from "./fields";
import { MEASURE_FORMATS, SQL_FUNCTIONS, fieldError, slugify, wordAt, IDENT_RE } from "./lib";

const PREVIEW_ID = "preview_measure";

/**
 * Create / edit a measure of a source.
 * editor = { dashboard, data, apply, dryRun, error }; fields = FieldSpec[] of the source.
 */
export default function MeasureEditor({ editor, sourceName, measure, fields, onClose }) {
  const t = useTranslations("biEditor");
  const isNew = !measure;
  const [label, setLabel] = useState(measure?.label || "");
  const [typedName, setName] = useState(measure?.name || "");
  const [nameTouched, setNameTouched] = useState(!isNew);
  const [expr, setExpr] = useState(measure?.expr || "");
  const [format, setFormat] = useState(measure?.format || "number");
  const [unit, setUnit] = useState(measure?.unit || "");
  const [useTh, setUseTh] = useState(!!measure?.thresholds);
  const [th, setTh] = useState(measure?.thresholds || { direction: "higher_is_better", good: 0, warn: 0 });
  const [preview, setPreview] = useState(null); // {state: loading|ok|error, text}
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [showSugg, setShowSugg] = useState(false);
  const exprRef = useRef(null);
  const listId = useId();

  const name = nameTouched ? typedName : slugify(label);

  const { word, start, end } = wordAt(expr, caret);
  const suggestions =
    showSugg && word.length > 0
      ? [
          ...fields.map((f) => ({ text: f.name, kind: "field" })),
          ...SQL_FUNCTIONS.map((f) => ({ text: f, kind: "fn" })),
        ]
          .filter((s) => s.text.toLowerCase().startsWith(word.toLowerCase()) && s.text.toLowerCase() !== word.toLowerCase())
          .slice(0, 8)
      : [];

  const accept = (s) => {
    const ins = s.kind === "fn" ? `${s.text}(` : s.text;
    const next = expr.slice(0, start) + ins + expr.slice(end);
    const c = start + ins.length;
    setExpr(next);
    setCaret(c);
    setActive(0);
    setShowSugg(false);
    requestAnimationFrame(() => {
      if (exprRef.current) {
        exprRef.current.focus();
        try {
          exprRef.current.setSelectionRange(c, c);
        } catch {
          /* ignore */
        }
      }
    });
  };

  const onExprKey = (e) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      accept(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSugg(false);
    }
  };

  const build = () => {
    const m = { name, label: label || name, expr, format };
    if (unit) m.unit = unit;
    if (measure?.description) m.description = measure.description;
    if (useTh) m.thresholds = { direction: th.direction, good: Number(th.good) || 0, warn: Number(th.warn) || 0 };
    return m;
  };
  const nameValid = IDENT_RE.test(name);
  const canSubmit = nameValid && expr.trim().length > 0 && label.trim().length > 0;

  const runPreview = async () => {
    setPreview({ state: "loading" });
    try {
      const ops = [
        { op: "upsert_measure", source: sourceName, measure: build() },
        { op: "add_visual", component_id: PREVIEW_ID, visual: { type: "kpi", source: sourceName, kpi: { measure: name } } },
      ];
      const res = await editor.dryRun(ops);
      const comp = res?.data?.components?.[PREVIEW_ID];
      if (comp?.error) setPreview({ state: "error", text: comp.error });
      else if (comp?.value) setPreview({ state: "ok", text: comp.value.formatted ?? String(comp.value.value) });
      else setPreview({ state: "error", text: t("previewNoValue") });
    } catch (err) {
      setPreview({ state: "error", text: err.message });
    }
  };

  const save = async () => {
    const next = await editor.apply([{ op: "upsert_measure", source: sourceName, measure: build() }], { field: "expr" });
    if (next) onClose();
  };

  const exprErr = fieldError(editor.error, "expr");

  return (
    <div className="space-y-3 rounded-xl border th-border p-3" aria-label={isNew ? t("newMeasure") : t("editMeasure", { name: measure.label })} role="group">
      <h4 className="text-sm font-semibold th-text">{isNew ? t("newMeasure") : t("editMeasure", { name: measure.label })}</h4>
      <TextField label={t("measureLabel")} value={label} debounce={0} onCommit={setLabel} error={fieldError(editor.error, "label")} />
      <TextField
        label={t("measureName")}
        value={name}
        debounce={0}
        disabled={!isNew}
        mono
        hint={isNew ? t("measureNameHint") : undefined}
        error={!nameValid && name ? t("measureNameInvalid") : fieldError(editor.error, "name")}
        onCommit={(v) => {
          setNameTouched(true);
          setName(v);
        }}
      />

      <Field label={t("formula")} htmlFor={`${listId}-expr`} error={exprErr} hint={t("formulaHint")}>
        <div className="relative">
          <textarea
            id={`${listId}-expr`}
            ref={exprRef}
            rows={4}
            value={expr}
            spellCheck={false}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={`${listId}-sugg`}
            aria-autocomplete="list"
            aria-activedescendant={suggestions.length ? `${listId}-s${active}` : undefined}
            aria-invalid={exprErr ? true : undefined}
            onChange={(e) => {
              setExpr(e.target.value);
              setCaret(e.target.selectionStart);
              setShowSugg(true);
              setActive(0);
            }}
            onKeyDown={onExprKey}
            onKeyUp={(e) => !["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key) && setCaret(e.target.selectionStart)}
            onClick={(e) => setCaret(e.target.selectionStart)}
            onBlur={() => setTimeout(() => setShowSugg(false), 120)}
            className={`${INPUT_CLS} font-mono text-xs resize-y`}
          />
          {suggestions.length > 0 && (
            <ul id={`${listId}-sugg`} role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-auto rounded-lg border th-border th-bg-modal shadow-lg">
              {suggestions.map((s, i) => (
                <li
                  key={s.text}
                  id={`${listId}-s${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    accept(s);
                  }}
                  className={`flex cursor-pointer items-center justify-between px-2.5 py-1 font-mono text-xs ${i === active ? "bg-blue-500/20" : ""}`}
                >
                  <span>{s.text}</span>
                  <span className="text-[10px] th-text-faint">{s.kind === "fn" ? t("sqlFunction") : t("fieldKind")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <SelectField label={t("format")} value={format} options={MEASURE_FORMATS.map((f) => ({ value: f, label: t(`formats.${f}`) }))} onChange={(v) => setFormat(v || "number")} />
        <TextField label={t("unit")} value={unit} debounce={0} onCommit={setUnit} />
      </div>

      <Toggle label={t("thresholds")} checked={useTh} onChange={setUseTh} />
      {useTh && (
        <div className="grid grid-cols-3 gap-2">
          <SelectField
            label={t("direction")}
            value={th.direction}
            options={[{ value: "higher_is_better", label: t("higherBetter") }, { value: "lower_is_better", label: t("lowerBetter") }]}
            onChange={(v) => setTh({ ...th, direction: v })}
          />
          <NumberField label={t("thGood")} value={th.good} onCommit={(v) => setTh((p) => ({ ...p, good: v ?? 0 }))} />
          <NumberField label={t("thWarn")} value={th.warn} onCommit={(v) => setTh((p) => ({ ...p, warn: v ?? 0 }))} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_CLS} disabled={!canSubmit || preview?.state === "loading"} onClick={runPreview}>
          {preview?.state === "loading" ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} {t("preview")}
        </button>
        <div aria-live="polite" className="min-w-0 text-xs">
          {preview?.state === "ok" && (
            <span className="font-semibold text-emerald-400">
              {t("previewValue")} <span data-testid="measure-preview">{preview.text}</span>
            </span>
          )}
          {preview?.state === "error" && (
            <span role="alert" className="text-red-400 break-words" data-testid="measure-preview-error">
              {preview.text}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" className={BTN_CLS} onClick={onClose}>
          {t("cancel")}
        </button>
        <button type="button" className={BTN_PRIMARY_CLS} disabled={!canSubmit} onClick={save}>
          {t("save")}
        </button>
      </div>
    </div>
  );
}
