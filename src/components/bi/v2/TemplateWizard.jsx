"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2, X, FileSpreadsheet, LayoutTemplate } from "lucide-react";
import { useRouter } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import {
  listDashboardTemplates,
  listBiDatasets,
  previewBiDataset,
  createDashboardFromTemplate,
} from "@/lib/api";
import { INPUT_CLS, BTN_CLS, BTN_PRIMARY_CLS } from "./editor/fields";

const STEPS = ["template", "dataset", "columns", "settings"];
const TYPE_KEYS = { date: "typeDate", string: "typeString", number: "typeNumber" };

const columnName = (c) => (typeof c === "string" ? c : c?.name);

/** Default-named dataset column for each template column (case-insensitive). */
export function autoMap(templateColumns, datasetColumns) {
  const byLower = new Map();
  for (const name of datasetColumns) {
    const k = name.trim().toLowerCase();
    if (!byLower.has(k)) byLower.set(k, name);
  }
  const out = {};
  for (const c of templateColumns) {
    const hit = c.default ? byLower.get(String(c.default).trim().toLowerCase()) : undefined;
    out[c.key] = hit ?? null;
  }
  return out;
}

function paramError(p, raw) {
  const s = String(raw ?? "").trim();
  if (!/^-?\d+$/.test(s)) return true;
  const n = Number(s);
  return (p.min != null && n < p.min) || (p.max != null && n > p.max);
}

function submitErrors(err, fallback) {
  const list = err?.detail?.errors;
  if (Array.isArray(list) && list.length) return list.map(String);
  return [err?.message || fallback];
}

export default function TemplateWizard({ onClose }) {
  const t = useTranslations("biTemplate");
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const organizationId = user?.email?.split("@")[1] || "default";
  const titleId = useId();
  const dialogRef = useRef(null);

  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState(null);
  const [datasets, setDatasets] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [templateId, setTemplateId] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [datasetColumns, setDatasetColumns] = useState(null);
  const [mapping, setMapping] = useState({});
  const [title, setTitle] = useState("");
  const [params, setParams] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  const template = templates?.find((x) => x.id === templateId) || null;

  function selectTemplate(tpl) {
    setTemplateId(tpl.id);
    setTitle(tpl.label);
    setParams(Object.fromEntries((tpl.params || []).map((p) => [p.key, String(p.default ?? "")])));
    setMapping({});
  }

  function selectDataset(id) {
    setDatasetId(id);
    setDatasetColumns(null);
    setMapping({});
  }

  useEffect(() => {
    let alive = true;
    Promise.all([listDashboardTemplates(), listBiDatasets(organizationId)])
      .then(([tpls, ds]) => {
        if (!alive) return;
        const list = Array.isArray(tpls) ? tpls : tpls?.items || [];
        setTemplates(list);
        setDatasets(ds?.datasets || []);
        if (list.length === 1) selectTemplate(list[0]);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [organizationId]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step !== 2 || !datasetId || datasetColumns) return;
    let alive = true;
    previewBiDataset(datasetId, organizationId)
      .then((res) => {
        if (!alive) return;
        const names = (res?.columns || []).map(columnName).filter(Boolean);
        setDatasetColumns(names);
        setMapping(autoMap(template.columns, names));
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [step, datasetId, datasetColumns, organizationId, template]);

  const missingRequired = useMemo(
    () => (template ? template.columns.some((c) => c.required && !mapping[c.key]) : true),
    [template, mapping],
  );
  const paramsInvalid = useMemo(
    () => (template?.params || []).some((p) => paramError(p, params[p.key])),
    [template, params],
  );

  const canNext = [
    !!template,
    !!datasetId,
    !!datasetColumns && !missingRequired,
    false,
  ][step];
  const canCreate = !!title.trim() && !paramsInvalid && !missingRequired && !submitting;

  async function create() {
    const sentTitle = title.trim();
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await createDashboardFromTemplate(template.id, {
        dataset_id: datasetId,
        title: sentTitle,
        columns: Object.fromEntries(template.columns.map((c) => [c.key, mapping[c.key] || null])),
        params: Object.fromEntries(
          (template.params || []).map((p) => [p.key, Number(String(params[p.key]).trim())]),
        ),
      });
      if (res?.title && res.title !== sentTitle) toast.info(t("renamedTo", { title: res.title }));
      else toast.success(t("created"));
      router.push(res.url);
      onClose();
    } catch (e) {
      setErrors(submitErrors(e, t("createFailed")));
      setSubmitting(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }

  const loading = !loadError && (templates === null || datasets === null);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="glass-card rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[92vh] flex flex-col animate-scale-in focus:outline-none"
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 id={titleId} className="text-xl font-bold th-text">
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="p-2 rounded-lg hover:th-bg-surface-hover th-text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X size={20} />
          </button>
        </div>

        <ol className="flex flex-wrap gap-x-4 gap-y-1 mb-4 shrink-0 text-xs font-semibold" aria-label={t("steps")}>
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={i === step ? "text-brand" : "th-text-faint"}
            >
              {i + 1}. {t(`step_${s}`)}
            </li>
          ))}
        </ol>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
          {loadError && (
            <p role="alert" className="text-sm text-red-400">
              {t("loadFailed", { message: loadError })}
            </p>
          )}
          {loading && (
            <p className="flex items-center gap-2 text-sm th-text-muted">
              <Loader2 size={16} className="animate-spin" />
              {t("loading")}
            </p>
          )}

          {!loading && !loadError && step === 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium th-text mb-2">{t("chooseTemplate")}</legend>
              {templates.length === 0 && <p className="text-sm th-text-muted">{t("noTemplates")}</p>}
              {templates.map((tpl) => (
                <ChoiceCard
                  key={tpl.id}
                  icon={LayoutTemplate}
                  selected={tpl.id === templateId}
                  title={tpl.label}
                  subtitle={tpl.description}
                  onSelect={() => selectTemplate(tpl)}
                />
              ))}
            </fieldset>
          )}

          {!loading && !loadError && step === 1 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium th-text mb-2">{t("chooseDataset")}</legend>
              {datasets.length === 0 && <p className="text-sm th-text-muted">{t("noDatasets")}</p>}
              {datasets.map((ds) => (
                <ChoiceCard
                  key={ds.file_id}
                  icon={FileSpreadsheet}
                  selected={ds.file_id === datasetId}
                  title={ds.filename}
                  subtitle={t("datasetInfo", { columns: ds.columns_count ?? 0, rows: ds.row_count ?? 0 })}
                  onSelect={() => selectDataset(ds.file_id)}
                />
              ))}
            </fieldset>
          )}

          {step === 2 && !loadError && !datasetColumns && (
            <p className="flex items-center gap-2 text-sm th-text-muted">
              <Loader2 size={16} className="animate-spin" />
              {t("loading")}
            </p>
          )}
          {step === 2 && datasetColumns && template && (
            <div className="space-y-3">
              <p className="text-sm th-text-secondary">{t("mapIntro")}</p>
              {template.columns.map((c) => (
                <ColumnRow
                  key={c.key}
                  column={c}
                  options={datasetColumns}
                  value={mapping[c.key] || ""}
                  onChange={(v) => setMapping((m) => ({ ...m, [c.key]: v || null }))}
                  t={t}
                />
              ))}
            </div>
          )}

          {step === 3 && template && (
            <div className="space-y-4">
              <LabelledInput label={t("titleLabel")}>
                {(id) => (
                  <input
                    id={id}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={INPUT_CLS}
                    autoComplete="off"
                  />
                )}
              </LabelledInput>
              {(template.params || []).map((p) => {
                const invalid = paramError(p, params[p.key]);
                return (
                  <LabelledInput
                    key={p.key}
                    label={p.label}
                    hint={t("rangeHint", { min: p.min, max: p.max })}
                    error={invalid ? t("paramInvalid", { min: p.min, max: p.max }) : null}
                  >
                    {(id, describedBy) => (
                      <input
                        id={id}
                        type="number"
                        inputMode="numeric"
                        step={1}
                        min={p.min}
                        max={p.max}
                        value={params[p.key] ?? ""}
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedBy}
                        onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                        className={INPUT_CLS}
                      />
                    )}
                  </LabelledInput>
                );
              })}
              {errors.length > 0 && (
                <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  <p className="font-semibold mb-1">{t("createFailed")}</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {errors.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 mt-4 shrink-0">
          <button type="button" onClick={onClose} className={BTN_CLS + " !text-sm !px-4 !py-2"}>
            {t("cancel")}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => {
                  setErrors([]);
                  setStep(step - 1);
                }}
                className={BTN_CLS + " !text-sm !px-4 !py-2"}
              >
                {t("back")}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStep(step + 1)}
                className={BTN_PRIMARY_CLS + " !text-sm !px-4 !py-2"}
              >
                {t("next")}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canCreate}
                onClick={create}
                className={BTN_PRIMARY_CLS + " !text-sm !px-4 !py-2"}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {t("create")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({ icon: Icon, selected, title, subtitle, onSelect }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-400/60 ${
        selected ? "bg-brand/10 border-brand/40" : "th-bg-surface th-border hover:th-bg-surface-hover"
      }`}
    >
      <input type="radio" className="sr-only" checked={selected} onChange={onSelect} />
      <Icon size={20} className="shrink-0 mt-0.5 th-text-secondary" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block font-semibold th-text truncate">{title}</span>
        {subtitle && <span className="block text-xs th-text-muted">{subtitle}</span>}
      </span>
    </label>
  );
}

function LabelledInput({ label, hint, error, children }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium th-text">
        {label}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={`${id}-hint`} className="text-[11px] th-text-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-[11px] text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function ColumnRow({ column, options, value, onChange, t }) {
  const id = useId();
  const typeKey = TYPE_KEYS[column.type];
  const expected = typeKey ? t(typeKey) : column.type;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 gap-y-1 items-start">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium th-text">
          {column.label}
        </label>
        <p className="text-[11px] th-text-faint">
          <span>{t("expected", { type: expected })}</span>
          {" · "}
          <span className={column.required ? "text-amber-400" : ""}>
            {column.required ? t("required") : t("optional")}
          </span>
        </p>
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={column.required}
        className={INPUT_CLS}
      >
        <option value="">{column.required ? t("pick") : t("none")}</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
