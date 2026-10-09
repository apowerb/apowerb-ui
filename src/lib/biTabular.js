// Tabular formats accepted by the BI import (`POST /api/v1/bi/upload-csv`).
// The backend converts every non-CSV format to CSV before storing it.
export const BI_TABULAR_EXTENSIONS = [
  ".csv",
  ".tsv",
  ".txt",
  ".xlsx",
  ".xlsm",
  ".xls",
  ".ods",
  ".json",
  ".jsonl",
  ".parquet",
];

// Value for the `accept` attribute of the BI file inputs.
export const BI_TABULAR_ACCEPT = BI_TABULAR_EXTENSIONS.join(",");

export function isBiTabularFile(name) {
  if (typeof name !== "string") return false;
  const lower = name.toLowerCase();
  return BI_TABULAR_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
