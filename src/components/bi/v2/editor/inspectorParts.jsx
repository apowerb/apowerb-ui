"use client";

import { useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Plus } from "lucide-react";
import {
  BTN_CLS,
  ColorPicker,
  NumberField,
  RowControls,
  SelectField,
  TextField,
  Toggle,
  colorToCss,
} from "./fields";
import { MEASURE_FORMATS, moveItem } from "./lib";

/** Keys usable as series/columns: measures first, then fields. */
export function keyOptions(measures, fields, t, numericOnly = false) {
  const opts = [];
  measures.forEach((m) => opts.push({ value: m.name, label: `${m.label || m.name} (${t("measure")})` }));
  fields
    .filter((f) => !numericOnly || f.type === "number" || f.role === "measure")
    .forEach((f) => {
      if (!measures.some((m) => m.name === f.name)) opts.push({ value: f.name, label: f.label || f.name });
    });
  return opts;
}

const MARKS = ["bar", "line", "area"];
const OPS = [">", ">=", "<", "<=", "==", "!="];

function ColorRules({ rules, onChange }) {
  const t = useTranslations("biEditor");
  const set = (i, patch) => onChange(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="rounded-lg border th-border p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <SelectField label={t("ruleOp")} value={r.op} options={OPS.map((o) => ({ value: o, label: o }))} onChange={(v) => set(i, { op: v })} />
            <NumberField label={t("ruleValue")} value={r.value} onCommit={(v) => set(i, { value: v ?? 0 })} />
          </div>
          <ColorPicker label={t("ruleColor")} value={r.color} onChange={(c) => set(i, { color: c || "accent" })} />
          <div className="flex justify-end">
            <RowControls index={i} count={rules.length} name={t("colorRule")} onRemove={() => onChange(rules.filter((_, k) => k !== i))} />
          </div>
        </div>
      ))}
      <button type="button" className={BTN_CLS} onClick={() => onChange([...rules, { op: ">=", value: 0, color: "good" }])}>
        <Plus size={13} /> {t("addColorRule")}
      </button>
    </div>
  );
}

export function SeriesEditor({ series, onChange, measures, fields, errors = {} }) {
  const t = useTranslations("biEditor");
  const set = (i, patch) => onChange(series.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const options = keyOptions(measures, fields, t, true);
  const firstFree = options.find((o) => !series.some((s) => s.key === o.value)) || options[0];
  return (
    <div className="space-y-2">
      {series.map((s, i) => {
        const name = s.label || s.key;
        return (
          <details key={`${s.key}-${i}`} className="group rounded-lg border th-border" open={series.length === 1}>
            <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm th-text focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 rounded-lg">
              <span className="h-3 w-3 rounded-full border th-border shrink-0" style={{ background: colorToCss(s.color) }} aria-hidden="true" />
              <span className="flex-1 truncate">{name}</span>
              <span className="text-[11px] th-text-faint">{t(`mark.${s.mark || "bar"}`)}</span>
              <RowControls index={i} count={series.length} name={name} onMove={(a, b) => onChange(moveItem(series, a, b))} onRemove={() => onChange(series.filter((_, k) => k !== i))} />
            </summary>
            <div className="space-y-2.5 border-t th-border p-2.5">
              <SelectField label={t("seriesKey")} value={s.key} options={options.some((o) => o.value === s.key) ? options : [{ value: s.key, label: s.key }, ...options]} onChange={(v) => set(i, { key: v })} error={errors.key} />
              <TextField label={t("seriesLabel")} value={s.label} placeholder={s.key} onCommit={(v) => set(i, { label: v || null })} />
              <div className="grid grid-cols-2 gap-2">
                <SelectField label={t("seriesMark")} value={s.mark || "bar"} options={MARKS.map((m) => ({ value: m, label: t(`mark.${m}`) }))} onChange={(v) => set(i, { mark: v })} />
                <SelectField label={t("seriesAxis")} value={s.axis || "left"} options={[{ value: "left", label: t("axisLeft") }, { value: "right", label: t("axisRight") }]} onChange={(v) => set(i, { axis: v })} />
              </div>
              <Toggle label={t("seriesDash")} checked={s.dash} onChange={(v) => set(i, { dash: v })} />
              <Toggle label={t("useThresholds")} hint={t("useThresholdsHint")} checked={s.use_thresholds} onChange={(v) => set(i, { use_thresholds: v })} />
              <ColorPicker label={t("seriesColor")} value={s.color} onChange={(c) => set(i, { color: c })} />
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">{t("colorRules")}</p>
                <ColorRules rules={s.color_rules || []} onChange={(r) => set(i, { color_rules: r })} />
              </div>
            </div>
          </details>
        );
      })}
      <button type="button" className={BTN_CLS} disabled={!firstFree} onClick={() => onChange([...series, { key: firstFree.value, mark: "bar", axis: "left" }])}>
        <Plus size={13} /> {t("addSeries")}
      </button>
    </div>
  );
}

export function ReferenceLinesEditor({ lines, onChange, measures }) {
  const t = useTranslations("biEditor");
  const set = (i, patch) => onChange(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const byMeasure = l.measure != null;
        return (
          <div key={i} className="rounded-lg border th-border p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <SelectField
                label={t("refKind")}
                value={byMeasure ? "measure" : "value"}
                options={[{ value: "value", label: t("refFixed") }, { value: "measure", label: t("refMeasure") }]}
                onChange={(v) => set(i, v === "measure" ? { measure: measures[0]?.name ?? null, value: null } : { measure: null, value: 0 })}
              />
              {byMeasure ? (
                <SelectField label={t("measure")} value={l.measure} options={measures.map((m) => ({ value: m.name, label: m.label || m.name }))} onChange={(v) => set(i, { measure: v })} />
              ) : (
                <NumberField label={t("refValue")} value={l.value} onCommit={(v) => set(i, { value: v ?? 0 })} />
              )}
            </div>
            <TextField label={t("refLabel")} value={l.label} onCommit={(v) => set(i, { label: v || null })} />
            <Toggle label={t("seriesDash")} checked={l.dash !== false} onChange={(v) => set(i, { dash: v })} />
            <ColorPicker label={t("seriesColor")} value={l.color} onChange={(c) => set(i, { color: c })} />
            <div className="flex justify-end">
              <RowControls index={i} count={lines.length} name={l.label || t("refLine")} onRemove={() => onChange(lines.filter((_, k) => k !== i))} />
            </div>
          </div>
        );
      })}
      <button type="button" className={BTN_CLS} onClick={() => onChange([...lines, { value: 0, label: null, color: "muted", dash: true }])}>
        <Plus size={13} /> {t("addRefLine")}
      </button>
    </div>
  );
}

export function ColumnsEditor({ columns, onChange, measures, fields }) {
  const t = useTranslations("biEditor");
  const set = (i, patch) => onChange(columns.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const options = keyOptions(measures, fields, t);
  const firstFree = options.find((o) => !columns.some((c) => c.key === o.value)) || options[0];
  return (
    <div className="space-y-2">
      {columns.map((c, i) => {
        const name = c.label || c.key;
        return (
          <details key={`${c.key}-${i}`} className="rounded-lg border th-border">
            <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm th-text rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">
              <span className="flex-1 truncate">{name}</span>
              <RowControls index={i} count={columns.length} name={name} onMove={(a, b) => onChange(moveItem(columns, a, b))} onRemove={() => onChange(columns.filter((_, k) => k !== i))} />
            </summary>
            <div className="space-y-2.5 border-t th-border p-2.5">
              <SelectField label={t("columnKey")} value={c.key} options={options.some((o) => o.value === c.key) ? options : [{ value: c.key, label: c.key }, ...options]} onChange={(v) => set(i, { key: v })} />
              <TextField label={t("columnLabel")} value={c.label} placeholder={c.key} onCommit={(v) => set(i, { label: v || null })} />
              <SelectField label={t("format")} value={c.format} empty={t("formatAuto")} options={MEASURE_FORMATS.map((f) => ({ value: f, label: t(`formats.${f}`) }))} onChange={(v) => set(i, { format: v })} />
              <Toggle label={t("useThresholds")} checked={c.use_thresholds} onChange={(v) => set(i, { use_thresholds: v })} />
            </div>
          </details>
        );
      })}
      <button type="button" className={BTN_CLS} disabled={!firstFree} onClick={() => onChange([...columns, { key: firstFree.value }])}>
        <Plus size={13} /> {t("addColumn")}
      </button>
    </div>
  );
}

const STEP_KINDS = ["start", "increase", "decrease", "end"];

export function StepsEditor({ steps, onChange, measures }) {
  const t = useTranslations("biEditor");
  const set = (i, patch) => onChange(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <details key={i} className="rounded-lg border th-border">
          <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm th-text rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">
            <span className="flex-1 truncate">{s.label || s.measure}</span>
            <span className="text-[11px] th-text-faint">{t(`stepKind.${s.kind}`)}</span>
            <RowControls index={i} count={steps.length} name={s.label || s.measure} onMove={(a, b) => onChange(moveItem(steps, a, b))} onRemove={() => onChange(steps.filter((_, k) => k !== i))} />
          </summary>
          <div className="space-y-2.5 border-t th-border p-2.5">
            <TextField label={t("stepLabel")} value={s.label} onCommit={(v) => set(i, { label: v || s.measure })} />
            <SelectField label={t("measure")} value={s.measure} options={measures.map((m) => ({ value: m.name, label: m.label || m.name }))} onChange={(v) => set(i, { measure: v })} />
            <SelectField label={t("stepKindLabel")} value={s.kind} options={STEP_KINDS.map((k) => ({ value: k, label: t(`stepKind.${k}`) }))} onChange={(v) => set(i, { kind: v })} />
            <ColorPicker label={t("seriesColor")} value={s.color} onChange={(c) => set(i, { color: c })} />
          </div>
        </details>
      ))}
      <button
        type="button"
        className={BTN_CLS}
        disabled={!measures.length}
        onClick={() => onChange([...steps, { label: measures[0].label || measures[0].name, measure: measures[0].name, kind: "increase" }])}
      >
        <Plus size={13} /> {t("addStep")}
      </button>
    </div>
  );
}

/** Text template with insertion of `{{measure|format}}` tokens at the caret. */
export function TemplateField({ label, value, onCommit, measures, error, rows = 4 }) {
  const t = useTranslations("biEditor");
  const ref = useRef(null);
  const [measure, setMeasure] = useState("");
  const [format, setFormat] = useState("");
  const insert = () => {
    const m = measure || measures[0]?.name;
    if (!m) return;
    ref.current?.insert(format ? `{{${m}|${format}}}` : `{{${m}}}`);
  };
  return (
    <div className="space-y-1.5">
      <TextField ref={ref} label={label} value={value} onCommit={onCommit} multiline rows={rows} mono error={error} />
      {measures.length > 0 && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SelectField label={t("insertMeasure")} value={measure || measures[0].name} options={measures.map((m) => ({ value: m.name, label: m.label || m.name }))} onChange={(v) => setMeasure(v || "")} />
          </div>
          <div className="w-28">
            <SelectField label={t("format")} value={format} empty={t("formatAuto")} options={MEASURE_FORMATS.map((f) => ({ value: f, label: f }))} onChange={(v) => setFormat(v || "")} />
          </div>
          <button type="button" className={BTN_CLS} onClick={insert}>
            {t("insert")}
          </button>
        </div>
      )}
    </div>
  );
}
