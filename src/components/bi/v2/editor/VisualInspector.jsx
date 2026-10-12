"use client";

import { useTranslations } from "use-intl";
import { Copy } from "lucide-react";
import {
  BTN_CLS,
  ConfirmButton,
  NumberField,
  Section,
  SelectField,
  TextField,
  Toggle,
} from "./fields";
import {
  ColumnsEditor,
  ReferenceLinesEditor,
  SeriesEditor,
  StepsEditor,
  TemplateField,
} from "./inspectorParts";
import {
  BLOCK_TYPES,
  CHART_TYPES,
  fieldError,
  getComponent,
  isDateField,
  isDimensionField,
  newId,
  sourceFields,
  sourceMeasures,
  typeChangeChanges,
} from "./lib";

const PROVENANCES = ["real", "simulated", "forecast"];
const SORTS = ["x_asc", "x_desc", "value_asc", "value_desc"];

/**
 * Inspector of one visual block.
 * editor = { dashboard, data, apply(ops,{field}), error, onSelect }
 */
export default function VisualInspector({ editor, componentId }) {
  const t = useTranslations("biEditor");
  const { dashboard, data, apply, error, onSelect } = editor;
  const comp = getComponent(dashboard, componentId);
  const visual = comp?.visual;
  if (!visual) {
    return <p className="text-sm th-text-muted">{t("notEditable")}</p>;
  }

  const sources = dashboard.sources || [];
  const filters = dashboard.filters || [];
  const fields = visual.source ? sourceFields(dashboard, data, visual.source) : [];
  const measures = visual.source ? sourceMeasures(dashboard, visual.source) : [];
  const isChart = CHART_TYPES.includes(visual.type);
  const needsSource = visual.type !== "note";
  const err = (name) => fieldError(error, name);

  const update = (changes, field) =>
    apply([{ op: "update_visual", component_id: componentId, changes }], { field: field || Object.keys(changes)[0] });

  const xOptions = fields
    .filter((f) => isDimensionField(f) || isDateField(f))
    .map((f) => ({ value: f.name, label: f.label || f.name }));
  if (visual.x && !xOptions.some((o) => o.value === visual.x)) xOptions.unshift({ value: visual.x, label: visual.x });

  const changeSource = (name) => {
    if (!name || name === visual.source) return;
    const f = sourceFields(dashboard, data, name);
    const keep = (k) => f.some((x) => x.name === k) || sourceMeasures(dashboard, name).some((m) => m.name === k);
    update(
      {
        source: name,
        x: visual.x && f.some((x) => x.name === visual.x) ? visual.x : null,
        series: (visual.series || []).filter((s) => keep(s.key)),
        columns: (visual.columns || []).filter((c) => keep(c.key)),
      },
      "source",
    );
  };

  // --- interactions -------------------------------------------------------
  const clickActive = Object.keys(visual.click_filters || {}).length > 0;
  const matchingFilter = visual.x ? filters.find((f) => f.field === visual.x) : null;
  const toggleClick = (on) => {
    if (!on) return update({ click_filters: {} }, "click_filters");
    if (matchingFilter) return update({ click_filters: { [matchingFilter.id]: visual.x } }, "click_filters");
    return undefined; // proposal shown below
  };
  const createClickFilter = () => {
    const id = visual.x;
    const label = fields.find((f) => f.name === id)?.label || id;
    return apply(
      [
        { op: "upsert_filter", filter: { id, label, field: id, type: "select", default: null } },
        { op: "update_visual", component_id: componentId, changes: { click_filters: { [id]: id } } },
      ],
      { field: "click_filters" },
    );
  };

  const duplicate = async () => {
    const id = newId();
    const copy = { ...JSON.parse(JSON.stringify(visual)), title: visual.title ? t("copyOf", { title: visual.title }) : null };
    const next = await apply([{ op: "add_visual", visual: copy, component_id: id }]);
    if (next) onSelect?.(id);
  };
  const remove = async () => {
    const next = await apply([{ op: "remove_component", component_id: componentId }]);
    if (next) onSelect?.(null);
  };

  return (
    <div className="space-y-4">
      <Section title={t("general")}>
        <TextField label={t("title")} value={visual.title} onCommit={(v) => update({ title: v || null }, "title")} error={err("title")} />
        <TextField label={t("subtitle")} value={visual.subtitle} onCommit={(v) => update({ subtitle: v || null }, "subtitle")} error={err("subtitle")} hint={t("templateHint")} />

        <div role="group" aria-labelledby="biEditorTypeLabel" className="space-y-1">
          <p id="biEditorTypeLabel" className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">
            {t("blockType")}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {BLOCK_TYPES.map(({ type, icon: Icon }) => (
              <button
                key={type}
                type="button"
                title={t(`types.${type}`)}
                aria-label={t(`types.${type}`)}
                aria-pressed={visual.type === type}
                onClick={() => visual.type !== type && update(typeChangeChanges(visual, type, dashboard, data), "type")}
                className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                  visual.type === type ? "border-blue-500 bg-blue-500/15 th-text" : "th-border th-text-muted hover:th-bg-surface-hover"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="truncate max-w-full">{t(`types.${type}`)}</span>
              </button>
            ))}
          </div>
          {err("type") && <p role="alert" className="text-[11px] text-red-400">{err("type")}</p>}
        </div>

        {needsSource && (
          <SelectField
            label={t("source")}
            value={visual.source}
            empty={t("chooseSource")}
            options={sources.map((s) => ({ value: s.name, label: s.label || s.name }))}
            onChange={changeSource}
            error={err("source")}
          />
        )}
      </Section>

      {(isChart || visual.type === "table") && needsSource && (
        <Section title={visual.type === "table" ? t("rows") : t("axisX")}>
          <SelectField
            label={visual.type === "table" ? t("rowField") : t("axisXField")}
            value={visual.x}
            empty={t("none")}
            options={xOptions}
            onChange={(v) => update({ x: v }, "x")}
            error={err("x")}
          />
        </Section>
      )}

      {isChart && (
        <>
          <Section title={t("series")}>
            <SeriesEditor series={visual.series || []} measures={measures} fields={fields} onChange={(s) => update({ series: s }, "series")} errors={{ key: err("key") }} />
            {err("series") && <p role="alert" className="text-[11px] text-red-400">{err("series")}</p>}
          </Section>
          <Section title={t("refLines")}>
            <ReferenceLinesEditor lines={visual.reference_lines || []} measures={measures} onChange={(l) => update({ reference_lines: l }, "reference_lines")} />
          </Section>
          <Section title={t("sorting")}>
            <SelectField label={t("sort")} value={visual.sort} empty={t("sortDefault")} options={SORTS.map((s) => ({ value: s, label: t(`sorts.${s}`) }))} onChange={(v) => update({ sort: v }, "sort")} />
            <NumberField label={t("topN")} value={visual.top_n} min={1} max={500} onCommit={(v) => update({ top_n: v }, "top_n")} error={err("top_n")} />
          </Section>
        </>
      )}

      {visual.type === "kpi" && (
        <Section title={t("kpi")}>
          <SelectField
            label={t("measure")}
            value={visual.kpi?.measure}
            empty={t("chooseMeasure")}
            options={measures.map((m) => ({ value: m.name, label: m.label || m.name }))}
            onChange={(v) => update({ kpi: { ...(visual.kpi || {}), measure: v } }, "measure")}
            error={err("measure") || err("kpi")}
          />
          <SelectField
            label={t("compare")}
            value={visual.kpi?.compare}
            empty={t("noCompare")}
            options={[{ value: "previous_period", label: t("comparePeriod") }, { value: "previous_point", label: t("comparePoint") }]}
            onChange={(v) => update({ kpi: { ...(visual.kpi || {}), compare: v } }, "compare")}
          />
          <TextField label={t("targetLabel")} value={visual.kpi?.target_label} onCommit={(v) => update({ kpi: { ...(visual.kpi || {}), target_label: v || null } }, "target_label")} />
          <TemplateField label={t("secondary")} rows={2} measures={measures} value={visual.kpi?.secondary} onCommit={(v) => update({ kpi: { ...(visual.kpi || {}), secondary: v || null } }, "secondary")} error={err("secondary")} />
        </Section>
      )}

      {visual.type === "table" && (
        <Section title={t("columns")}>
          <ColumnsEditor columns={visual.columns || []} measures={measures} fields={fields} onChange={(c) => update({ columns: c }, "columns")} />
          <Toggle label={t("totalRow")} checked={visual.total_row} onChange={(v) => update({ total_row: v }, "total_row")} />
          <SelectField
            label={t("highlightFilter")}
            value={visual.highlight_filter}
            empty={t("none")}
            options={filters.map((f) => ({ value: f.id, label: f.label || f.id }))}
            onChange={(v) => update({ highlight_filter: v }, "highlight_filter")}
          />
          <NumberField label={t("topN")} value={visual.top_n} min={1} max={500} onCommit={(v) => update({ top_n: v }, "top_n")} error={err("top_n")} />
          <SelectField label={t("sort")} value={visual.sort} empty={t("sortDefault")} options={SORTS.map((s) => ({ value: s, label: t(`sorts.${s}`) }))} onChange={(v) => update({ sort: v }, "sort")} />
        </Section>
      )}

      {visual.type === "waterfall" && (
        <Section title={t("steps")}>
          <StepsEditor steps={visual.steps || []} measures={measures} onChange={(s) => update({ steps: s }, "steps")} />
        </Section>
      )}

      {visual.type === "text" && (
        <Section title={t("textTemplate")}>
          <TemplateField label={t("textTemplate")} measures={measures} value={visual.text} onCommit={(v) => update({ text: v || null }, "text")} error={err("text")} />
          <p className="text-[11px] th-text-faint">{t("templateHint")}</p>
        </Section>
      )}

      {visual.type === "note" && (
        <Section title={t("noteSection")}>
          <TextField label={t("noteText")} multiline rows={6} mono value={visual.text} onCommit={(v) => update({ text: v || null }, "text")} error={err("text")} hint={t("markdownHint")} />
          <div role="group" aria-label={t("badges")} className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">{t("badges")}</p>
            <Toggle
              label={t("badgesAuto")}
              checked={visual.badges == null}
              onChange={(on) => update({ badges: on ? null : [] }, "badges")}
            />
            {visual.badges != null &&
              PROVENANCES.map((p) => (
                <Toggle
                  key={p}
                  label={t(`provenance.${p}`)}
                  checked={visual.badges.includes(p)}
                  onChange={(on) => update({ badges: on ? [...visual.badges, p] : visual.badges.filter((b) => b !== p) }, "badges")}
                />
              ))}
          </div>
        </Section>
      )}

      {(isChart || visual.type === "table") && (
        <Section title={t("interactions")}>
          <Toggle label={t("clickFilters")} hint={t("clickFiltersHint")} checked={clickActive} disabled={!visual.x} onChange={toggleClick} />
          {!clickActive && visual.x && !matchingFilter && (
            <div className="rounded-lg border th-border p-2 space-y-1.5">
              <p className="text-xs th-text-secondary">{t("noMatchingFilter", { field: visual.x })}</p>
              <button type="button" className={BTN_CLS} onClick={createClickFilter}>
                {t("createFilterAndEnable", { field: visual.x })}
              </button>
            </div>
          )}
          {err("click_filters") && <p role="alert" className="text-[11px] text-red-400">{err("click_filters")}</p>}
          {filters.length > 0 && (
            <div role="group" aria-label={t("ignoredFilters")} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide th-text-muted">{t("ignoredFilters")}</p>
              {filters.map((f) => (
                <Toggle
                  key={f.id}
                  label={f.label || f.id}
                  checked={(visual.ignore_filters || []).includes(f.id)}
                  onChange={(on) =>
                    update(
                      { ignore_filters: on ? [...(visual.ignore_filters || []), f.id] : (visual.ignore_filters || []).filter((x) => x !== f.id) },
                      "ignore_filters",
                    )
                  }
                />
              ))}
            </div>
          )}
        </Section>
      )}

      <Section>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BTN_CLS} onClick={duplicate}>
            <Copy size={13} /> {t("duplicate")}
          </button>
          <ConfirmButton label={t("delete")} confirmLabel={t("deleteConfirm")} onConfirm={remove} />
        </div>
      </Section>
    </div>
  );
}
