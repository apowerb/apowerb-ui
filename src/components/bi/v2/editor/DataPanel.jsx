"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Database, Pencil, Plus, Trash2 } from "lucide-react";
import { toSourceSpec } from "../sources";
import MeasureEditor from "./MeasureEditor";
import SourcePicker from "./SourcePicker";
import {
  BTN_CLS,
  BTN_PRIMARY_CLS,
  ConfirmButton,
  ICON_BTN_CLS,
  Section,
  SelectField,
  TextField,
} from "./fields";
import { fieldError, sourceFields, uniqueIdent } from "./lib";

const PROV_CLS = {
  real: "bg-emerald-500/15 text-emerald-400",
  simulated: "bg-amber-500/15 text-amber-400",
  forecast: "bg-violet-500/15 text-violet-400",
};

export function ProvenanceBadge({ value }) {
  const t = useTranslations("biEditor");
  const v = value || "real";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PROV_CLS[v] || PROV_CLS.real}`}>{t(`provenance.${v}`)}</span>;
}

/** Human-readable one-liner of a transform step. */
export function describeTransform(step, t) {
  const by = (step.by || []).join(", ");
  switch (step.op) {
    case "filter":
      return t("transform.filter", { where: step.where });
    case "derive":
      return t("transform.derive", { column: step.column, expr: step.expr });
    case "aggregate":
      return t("transform.aggregate", { groupBy: (step.group_by || []).join(", "), cols: Object.keys(step.aggregates || {}).join(", ") });
    case "join":
      return t("transform.join", { source: step.source, on: (step.on || []).join(", "), how: step.how || "left" });
    case "sql":
      return t("transform.sql", { query: step.query });
    case "naive_forecast":
      return t("transform.naive_forecast", { value: step.value, output: step.output || "prevision" });
    case "forecast":
      return t("transform.forecast", { value: step.value, horizon: step.horizon ?? 8, output: step.output || "prevision_moteur" });
    case "inventory_sim":
      return t("transform.inventory_sim", { by });
    default:
      return step.op;
  }
}

function TransformsView({ source, editor }) {
  const t = useTranslations("biEditor");
  const [text, setText] = useState(() => JSON.stringify(source.transforms || [], null, 2));
  const [jsonError, setJsonError] = useState(null);
  const steps = source.transforms || [];

  const serialized = JSON.stringify(source.transforms || [], null, 2);
  const [prevSerialized, setPrevSerialized] = useState(serialized);
  if (serialized !== prevSerialized) {
    setPrevSerialized(serialized);
    setText(serialized);
  }

  const applyJson = () => {
    let parsed;
    try {
      parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error(t("transformsNotArray"));
    } catch (e) {
      setJsonError(e.message);
      return;
    }
    setJsonError(null);
    editor.apply([{ op: "upsert_source", source: { ...source, transforms: parsed } }], { field: "transforms" });
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">{t("transforms")}</p>
      {steps.length === 0 ? (
        <p className="text-xs th-text-faint">{t("noTransforms")}</p>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-xs th-text-secondary">
          {steps.map((s, i) => (
            <li key={i} className="break-words">
              <span className="rounded bg-white/5 px-1 font-mono text-[10px] mr-1">{s.op}</span>
              {describeTransform(s, t)}
            </li>
          ))}
        </ol>
      )}
      <details className="rounded-lg border th-border">
        <summary className="cursor-pointer px-2 py-1.5 text-xs th-text-secondary rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">{t("advancedJson")}</summary>
        <div className="space-y-2 border-t th-border p-2">
          <TextField label={t("transformsJson")} multiline rows={8} mono value={text} debounce={600} onCommit={setText} error={jsonError || fieldError(editor.error, "transforms")} />
          <button type="button" className={BTN_CLS} onClick={applyJson}>
            {t("applyJson")}
          </button>
        </div>
      </details>
    </div>
  );
}

function AddSourceForm({ editor, onDone }) {
  const t = useTranslations("biEditor");
  const { dashboard } = editor;
  const [kind, setKind] = useState("new");
  const [label, setLabel] = useState("");
  const [parent, setParent] = useState("");
  const sources = dashboard.sources || [];
  const taken = sources.map((s) => s.name);

  const save = async (source) => {
    const next = await editor.apply([{ op: "upsert_source", source }], { field: "source" });
    if (next) onDone();
  };

  const addDerived = () => {
    const name = uniqueIdent(label || parent, taken);
    save({ name, label: label || name, kind: "source", parent, transforms: [], fields: [], measures: [] });
  };

  return (
    <div className="space-y-3 rounded-xl border th-border p-3" role="group" aria-label={t("addSource")}>
      <h4 className="text-sm font-semibold th-text">{t("addSource")}</h4>
      <SelectField
        label={t("sourceKind")}
        value={kind}
        options={[{ value: "new", label: t("kindNew") }, ...(sources.length ? [{ value: "source", label: t("kindDerived") }] : [])]}
        onChange={(v) => setKind(v || "new")}
      />
      <TextField label={t("sourceLabel")} value={label} debounce={0} onCommit={setLabel} />
      {kind === "new" ? (
        <>
          <SourcePicker onPick={(pick) => save(toSourceSpec(pick, taken, label))} />
          {fieldError(editor.error, "source") && <p role="alert" className="text-[11px] text-red-400">{fieldError(editor.error, "source")}</p>}
        </>
      ) : (
        <SelectField label={t("parentSource")} value={parent} empty={t("chooseSource")} options={sources.map((s) => ({ value: s.name, label: s.label || s.name }))} onChange={(v) => setParent(v || "")} error={fieldError(editor.error, "parent")} />
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN_CLS} onClick={onDone}>
          {t("cancel")}
        </button>
        {kind === "source" && (
          <button type="button" className={BTN_PRIMARY_CLS} disabled={!parent} onClick={addDerived}>
            {t("addSource")}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Sources, fields and measures of the dashboard.
 * editor = { dashboard, data, apply, dryRun, error }
 */
export default function DataPanel({ editor }) {
  const t = useTranslations("biEditor");
  const { dashboard, data } = editor;
  const sources = dashboard.sources || [];
  const [adding, setAdding] = useState(false);
  const [measureEdit, setMeasureEdit] = useState(null); // {source, measure|null}

  return (
    <div className="space-y-4">
      <Section
        title={t("sources")}
        action={
          <button type="button" className={BTN_CLS} onClick={() => setAdding(true)} disabled={adding}>
            <Plus size={13} /> {t("addSource")}
          </button>
        }
      >
        {adding && <AddSourceForm editor={editor} onDone={() => setAdding(false)} />}
        {sources.length === 0 && !adding && <p className="text-sm th-text-muted">{t("noSources")}</p>}
        {sources.map((s) => {
          const meta = data?.sources?.[s.name];
          const fields = sourceFields(dashboard, data, s.name);
          return (
            <details key={s.name} className="rounded-xl border th-border" open={sources.length === 1}>
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">
                <Database size={14} className="th-text-faint shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium th-text">{s.label || s.name}</span>
                  <span className="block truncate text-[11px] th-text-faint">
                    {s.kind === "connector" ? t(`connector.${s.source_type}`) : t(`kind.${s.kind}`)}
                    {meta ? ` · ${t("rowCount", { count: meta.row_count })}` : ""}
                    {meta?.last_date ? ` · ${t("lastDate", { date: meta.last_date })}` : ""}
                  </span>
                </span>
              </summary>
              <div className="space-y-4 border-t th-border p-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">{t("fields")}</p>
                  {fields.length === 0 && <p className="text-xs th-text-faint">{t("noFields")}</p>}
                  <ul className="space-y-1">
                    {fields.map((f) => (
                      <li key={f.name} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate font-mono th-text" title={f.label || f.name}>
                          {f.name}
                        </span>
                        <span className="th-text-faint">{t(`fieldType.${f.type || "string"}`)}</span>
                        <ProvenanceBadge value={f.provenance} />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">{t("measures")}</p>
                    <button type="button" className={BTN_CLS} onClick={() => setMeasureEdit({ source: s.name, measure: null })}>
                      <Plus size={13} /> {t("newMeasure")}
                    </button>
                  </div>
                  {(s.measures || []).length === 0 && <p className="text-xs th-text-faint">{t("noMeasures")}</p>}
                  <ul className="space-y-1">
                    {(s.measures || []).map((m) => (
                      <li key={m.name} className="flex items-center gap-2 rounded-lg border th-border px-2 py-1.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm th-text">{m.label}</span>
                          <code className="block truncate font-mono text-[11px] th-text-faint">{m.expr}</code>
                        </span>
                        <button type="button" className={ICON_BTN_CLS} aria-label={t("editMeasure", { name: m.label })} onClick={() => setMeasureEdit({ source: s.name, measure: m })}>
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className={ICON_BTN_CLS}
                          aria-label={t("deleteMeasure", { name: m.label })}
                          onClick={() => editor.apply([{ op: "remove_measure", source: s.name, name: m.name }])}
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {measureEdit && measureEdit.source === s.name && (
                    <MeasureEditor
                      key={measureEdit.measure?.name || "new"}
                      editor={editor}
                      sourceName={s.name}
                      measure={measureEdit.measure}
                      fields={fields}
                      onClose={() => setMeasureEdit(null)}
                    />
                  )}
                </div>

                <TransformsView source={s} editor={editor} />

                <ConfirmButton label={t("deleteSource")} confirmLabel={t("deleteSourceConfirm")} name={s.label || s.name} onConfirm={() => editor.apply([{ op: "remove_source", name: s.name }])} />
              </div>
            </details>
          );
        })}
      </Section>
    </div>
  );
}
