import { uniqueIdent } from "./editor/lib";

const stem = (filename) => (filename || "").replace(/\.[^.]+$/, "");

/** Table name of a `SELECT * FROM <table>` query built by the source picker. */
const tableOf = (query) => /\bfrom\s+([^\s;]+)/i.exec(query || "")?.[1] || "";

function connectorOf(pick) {
  switch (pick.type) {
    case "db":
      return {
        label: `${tableOf(pick.query) || pick.dbName || "sql"}${pick.configName ? ` (${pick.configName})` : ""}`,
        base: tableOf(pick.query) || pick.dbName || "sql",
        spec: { kind: "connector", source_type: "database", connection_config_id: pick.connection_config_id, query: pick.query },
      };
    case "onedrive_excel":
      return {
        label: stem(pick.filename) || "OneDrive",
        base: stem(pick.filename) || "onedrive",
        spec: { kind: "connector", source_type: "onedrive_excel", source_options: { item_id: pick.item_id, item_path: pick.item_path } },
      };
    case "agent":
      return {
        label: "Agent",
        base: "agent",
        spec: {
          kind: "connector",
          source_type: "agent",
          // Omitted rather than empty, as for agent charts: the core then falls
          // back on the agent's output contract.
          source_options: { agent_ids: pick.agent_ids, ...(pick.message ? { message: pick.message } : {}) },
        },
      };
    default:
      throw new Error(`Unknown data source type: ${pick.type}`);
  }
}

/**
 * Dashboard source (spec v2) from what the source picker returns: an imported
 * or Data pool file becomes a `dataset` source, a database table, a OneDrive
 * workbook or agents become a `connector` source read like a chart source.
 * `taken` are the names already used in the dashboard, `label` overrides the
 * default label.
 */
export function toSourceSpec(pick, taken = [], label = "") {
  const { label: auto, base, spec } =
    pick?.type === "csv"
      ? { label: stem(pick.filename) || "data", base: stem(pick.filename) || "data", spec: { kind: "dataset", dataset_id: pick.file_id } }
      : connectorOf(pick || {});
  return {
    name: uniqueIdent(label || base, taken),
    label: label || auto,
    ...spec,
    transforms: [],
    fields: [],
    measures: [],
  };
}
