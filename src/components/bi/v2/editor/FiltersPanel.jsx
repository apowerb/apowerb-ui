"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Plus } from "lucide-react";
import {
  BTN_CLS,
  BTN_PRIMARY_CLS,
  RowControls,
  Section,
  SelectField,
  TextField,
  Toggle,
} from "./fields";
import { PERIOD_PRESETS, allFields, fieldError, moveItem, uniqueIdent } from "./lib";

const FILTER_TYPES = ["select", "multi", "relative_period", "date_range"];

/** Editable properties shared by the add form and the inline edit of a filter. */
function FilterDetails({ filter, onChange, t }) {
  const presets = filter.presets || PERIOD_PRESETS;
  return (
    <div className="space-y-2.5">
      <TextField label={t("filterLabel")} value={filter.label} onCommit={(v) => onChange({ label: v || filter.label })} />
      {filter.type === "relative_period" ? (
        <>
          <div role="group" aria-label={t("presets")} className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">{t("presets")}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {PERIOD_PRESETS.map((p) => (
                <Toggle
                  key={p}
                  label={t(`period.${p}`)}
                  checked={presets.includes(p)}
                  onChange={(on) => {
                    const next = PERIOD_PRESETS.filter((x) => (x === p ? on : presets.includes(x)));
                    onChange({ presets: next, default: next.includes(filter.default) ? filter.default : next[0] ?? null });
                  }}
                />
              ))}
            </div>
          </div>
          <SelectField label={t("filterDefault")} value={filter.default} empty={t("noDefault")} options={presets.map((p) => ({ value: p, label: t(`period.${p}`) }))} onChange={(v) => onChange({ default: v })} />
        </>
      ) : filter.type === "select" ? (
        <TextField label={t("filterDefault")} value={filter.default == null ? "" : String(filter.default)} hint={t("filterDefaultHint")} onCommit={(v) => onChange({ default: v === "" ? null : v })} />
      ) : null}
    </div>
  );
}

function AddFilterForm({ editor, onDone }) {
  const t = useTranslations("biEditor");
  const { dashboard, data } = editor;
  const fields = allFields(dashboard, data);
  const [field, setField] = useState(fields[0]?.name || "");
  const [type, setType] = useState("select");
  const [label, setLabel] = useState("");
  const [def, setDef] = useState({});
  const f = fields.find((x) => x.name === field);

  const filter = {
    id: uniqueIdent(field, (dashboard.filters || []).map((x) => x.id)),
    label: label || f?.label || field,
    field,
    type,
    default: def.default ?? null,
    ...(type === "relative_period" ? { presets: def.presets || PERIOD_PRESETS } : {}),
  };

  return (
    <div className="space-y-3 rounded-xl border th-border p-3" role="group" aria-label={t("addFilter")}>
      <h4 className="text-sm font-semibold th-text">{t("addFilter")}</h4>
      <SelectField label={t("filterField")} value={field} options={fields.map((x) => ({ value: x.name, label: `${x.label || x.name} · ${x.source}` }))} onChange={(v) => setField(v || "")} error={fieldError(editor.error, "field")} />
      <SelectField label={t("filterType")} value={type} options={FILTER_TYPES.map((x) => ({ value: x, label: t(`filterTypes.${x}`) }))} onChange={(v) => { setType(v || "select"); setDef({}); }} />
      <FilterDetails filter={{ ...filter, label: filter.label }} t={t} onChange={({ label: l, ...rest }) => { if (l !== undefined) setLabel(l); if (Object.keys(rest).length) setDef((d) => ({ ...d, ...rest })); }} />
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN_CLS} onClick={onDone}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className={BTN_PRIMARY_CLS}
          disabled={!field}
          onClick={async () => {
            const next = await editor.apply([{ op: "upsert_filter", filter }], { field: "field" });
            if (next) onDone();
          }}
        >
          {t("addFilter")}
        </button>
      </div>
    </div>
  );
}

/** Dashboard-wide filters. editor = { dashboard, data, apply, error } */
export default function FiltersPanel({ editor }) {
  const t = useTranslations("biEditor");
  const filters = editor.dashboard.filters || [];
  const [adding, setAdding] = useState(false);
  const hasFields = allFields(editor.dashboard, editor.data).length > 0;

  // Filters have no position in the spec: reordering = remove then upsert the
  // affected tail in the new order (the server re-appends them in that order).
  const move = (from, to) => {
    const next = moveItem(filters, from, to);
    const first = Math.min(from, to);
    const tail = next.slice(first);
    editor.apply([
      ...tail.map((f) => ({ op: "remove_filter", id: f.id })),
      ...tail.map((f) => ({ op: "upsert_filter", filter: f })),
    ]);
  };

  return (
    <div className="space-y-4">
      <Section
        title={t("filters")}
        action={
          <button type="button" className={BTN_CLS} onClick={() => setAdding(true)} disabled={adding || !hasFields}>
            <Plus size={13} /> {t("addFilter")}
          </button>
        }
      >
        {adding && <AddFilterForm editor={editor} onDone={() => setAdding(false)} />}
        {!hasFields && <p className="text-xs th-text-faint">{t("filtersNeedSource")}</p>}
        {filters.length === 0 && hasFields && !adding && <p className="text-sm th-text-muted">{t("noFilters")}</p>}
        {filters.map((f, i) => (
          <details key={f.id} className="rounded-xl border th-border">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium th-text">{f.label}</span>
                <span className="block truncate text-[11px] th-text-faint">
                  {f.field} · {t(`filterTypes.${f.type}`)}
                </span>
              </span>
              <RowControls index={i} count={filters.length} name={f.label} onMove={move} onRemove={() => editor.apply([{ op: "remove_filter", id: f.id }])} />
            </summary>
            <div className="border-t th-border p-3">
              <FilterDetails filter={f} t={t} onChange={(patch) => editor.apply([{ op: "upsert_filter", filter: { ...f, ...patch } }], { field: "label" })} />
            </div>
          </details>
        ))}
      </Section>
    </div>
  );
}
