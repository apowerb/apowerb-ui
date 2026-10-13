"use client";

import { useId } from "react";
import { useTranslations } from "use-intl";
import { INPUT_CLS } from "./editor/fields";
import { paramError, typeMismatch } from "./templateLib";

const TYPE_KEYS = { date: "typeDate", string: "typeString", number: "typeNumber" };

export function LabelledInput({ label, hint, error, children }) {
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

export function ParamFields({ params, values, onChange }) {
  const t = useTranslations("biTemplate");
  return (params || []).map((p) => {
    const invalid = paramError(p, values[p.key]);
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
            value={values[p.key] ?? ""}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(p.key, e.target.value)}
            className={INPUT_CLS}
          />
        )}
      </LabelledInput>
    );
  });
}

export function ErrorList({ title, errors }) {
  if (!errors.length) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
      <p className="font-semibold mb-1">{title}</p>
      <ul className="list-disc pl-5 space-y-0.5">
        {errors.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

function ColumnRow({ column, options, value, actualType, onChange }) {
  const t = useTranslations("biTemplate");
  const id = useId();
  const typeKey = TYPE_KEYS[column.type];
  const expected = typeKey ? t(typeKey) : column.type;
  const mismatch = value ? typeMismatch(column.type, actualType) : null;
  const warningId = `${id}-warn`;
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
      <div className="min-w-0 space-y-1">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={column.required}
          aria-describedby={mismatch ? warningId : undefined}
          className={INPUT_CLS}
        >
          <option value="">{column.required ? t("pick") : t("none")}</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {mismatch && (
          <p id={warningId} className="text-[11px] text-amber-400">
            {t("typeWarning", { column: value, actual: t(TYPE_KEYS[mismatch]), expected })}
          </p>
        )}
      </div>
    </div>
  );
}

/** One select per template/requirement column; `types` maps a dataset column to its reported type. */
export function ColumnMapper({ columns, options, types, mapping, onChange }) {
  return (
    <div className="space-y-3">
      {columns.map((c) => (
        <ColumnRow
          key={c.key}
          column={c}
          options={options}
          value={mapping[c.key] || ""}
          actualType={types?.get(mapping[c.key])}
          onChange={(v) => onChange(c.key, v || null)}
        />
      ))}
    </div>
  );
}
