export const makeVisual = (over = {}) => ({
  type: "bar",
  title: "CA par semaine",
  subtitle: null,
  source: "ventes",
  x: "semaine",
  series: [{ key: "ca", mark: "bar", axis: "left", dash: false, color_rules: [], use_thresholds: false }],
  reference_lines: [],
  sort: null,
  top_n: null,
  columns: [],
  steps: [],
  click_filters: {},
  ignore_filters: [],
  ...over,
});

export const makeDashboard = (over = {}) => ({
  id: "d1",
  title: "Pilotage",
  spec_version: 2,
  sources: [
    {
      name: "ventes",
      label: "Ventes",
      kind: "dataset",
      dataset_id: "f1",
      transforms: [{ op: "filter", where: "ca > 0" }],
      fields: [],
      measures: [
        { name: "ca", label: "CA", expr: "SUM(ca)", format: "compact" },
        { name: "marge", label: "Marge", expr: "SUM(marge)", format: "number" },
      ],
    },
  ],
  filters: [],
  components: [{ id: "c1", component_type: "visual", position: { row: 0, col: 0, width: 6, height: 4 }, visual: makeVisual() }],
  ...over,
});

export const makeData = () => ({
  sources: {
    ventes: {
      row_count: 120,
      last_date: "2026-03-30",
      fields: [
        { name: "semaine", type: "date", role: "date", provenance: "real" },
        { name: "region", type: "string", role: "dimension", provenance: "real" },
        { name: "ca", type: "number", role: "measure", provenance: "real" },
      ],
    },
  },
});
