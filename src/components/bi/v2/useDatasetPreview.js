"use client";

import { useEffect, useState } from "react";
import { previewBiDataset } from "@/lib/api";
import { columnName } from "./templateLib";

const IDLE = { loading: false, columns: null, rows: [], error: null };

/** Columns ({name, type}) and sample rows of an imported dataset, loaded when `datasetId` is set. */
export function useDatasetPreview(datasetId, organizationId) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!datasetId) return undefined;
    let alive = true;
    previewBiDataset(datasetId, organizationId)
      .then((res) => {
        if (!alive) return;
        const columns = (res?.columns || [])
          .map((c) => ({ name: columnName(c), type: typeof c === "string" ? undefined : c?.type }))
          .filter((c) => c.name);
        setResult({ id: datasetId, columns, rows: res?.sample_rows || res?.rows || [], error: null });
      })
      .catch((e) => alive && setResult({ id: datasetId, columns: null, rows: [], error: e.message }));
    return () => {
      alive = false;
    };
  }, [datasetId, organizationId]);

  if (!datasetId) return IDLE;
  if (result?.id !== datasetId) return { ...IDLE, loading: true };
  return { loading: false, columns: result.columns, rows: result.rows, error: result.error };
}
