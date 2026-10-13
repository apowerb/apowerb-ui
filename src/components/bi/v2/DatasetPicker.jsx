"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { FileSpreadsheet, Search } from "lucide-react";
import { INPUT_CLS } from "./editor/fields";
import ChoiceCard from "./ChoiceCard";
import { filterByName } from "./templateLib";

/** Imported datasets with a name filter; one is selected at a time. */
export default function DatasetPicker({ datasets, selectedId, onSelect, legend }) {
  const t = useTranslations("biTemplate");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const shown = useMemo(() => filterByName(datasets, query, (d) => d.filename), [datasets, query]);

  return (
    <div className="space-y-2">
      {datasets.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 th-text-faint pointer-events-none" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("searchDatasets")}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className={INPUT_CLS + " !pl-8"}
          />
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium th-text mb-2">{legend}</legend>
        {datasets.length === 0 && <p className="text-sm th-text-muted">{t("noDatasets")}</p>}
        {datasets.length > 0 && shown.length === 0 && (
          <p className="text-sm th-text-muted">{t("noDatasetMatch", { query: query.trim() })}</p>
        )}
        {shown.map((ds) => (
          <ChoiceCard
            key={ds.file_id}
            icon={FileSpreadsheet}
            selected={ds.file_id === selectedId}
            title={ds.filename}
            subtitle={t("datasetInfo", { columns: ds.columns_count ?? 0, rows: ds.row_count ?? 0 })}
            onSelect={() => onSelect(ds.file_id)}
          />
        ))}
      </fieldset>
    </div>
  );
}
