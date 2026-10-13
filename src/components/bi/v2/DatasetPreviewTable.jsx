"use client";

import { useTranslations } from "use-intl";

const PREVIEW_ROWS = 5;

/** The first rows of a dataset, as the preview endpoint returns them. */
export default function DatasetPreviewTable({ name, columns, rows }) {
  const t = useTranslations("biTemplate");
  if (!columns?.length) return null;
  const shown = rows.slice(0, PREVIEW_ROWS);
  return (
    <div className="rounded-lg border th-border overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">{t("previewTitle", { name })}</caption>
        <thead>
          <tr className="border-b th-border">
            {columns.map((c) => (
              <th key={c.name} scope="col" className="text-left px-2.5 py-1.5 th-text-secondary font-semibold whitespace-nowrap">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} className="border-b last:border-b-0 th-border">
              {columns.map((c) => (
                <td key={c.name} className="px-2.5 py-1.5 th-text whitespace-nowrap max-w-[160px] truncate">
                  {row[c.name] ?? ""}
                </td>
              ))}
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-2.5 py-3 text-center th-text-muted">
                {t("previewEmpty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
