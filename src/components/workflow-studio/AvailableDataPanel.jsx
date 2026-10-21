"use client";

import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, FileText } from "lucide-react";
import { templateSuggestionsFor } from "@/lib/workflowGraph";
import { shapeOf } from "@/lib/availableData";
import { renderWorkflowPreview } from "@/lib/api";

const MAX_ROWS = 10;
const MAX_COLUMNS = 8;
const MAX_KEYS = 30;
const MAX_TEXT = 600;
const PREVIEW_DEBOUNCE_MS = 400;

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function formatSize(bytes) {
  if (typeof bytes !== "number") return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scalarText(value) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * One insertable value: clicking inserts `{{path}}` where the cursor is,
 * dragging carries it as text, which a browser drops at the caret of any field.
 */
function Insertable({ path, onInsert, className = "", children, ...rest }) {
  const snippet = `{{${path}}}`;
  return (
    <button
      type="button"
      draggable
      title={snippet}
      onClick={() => onInsert(snippet)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", snippet);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={`text-left rounded-md hover:th-bg-surface-hover cursor-grab ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function MoreNotShown({ count, t }) {
  if (count <= 0) return null;
  return <p className="text-[10px] th-text-ghost">{t("availableDataMore", { count })}</p>;
}

function FilesView({ value, path, onInsert, t }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {value.slice(0, MAX_ROWS).map((file, i) => (
        <li key={i}>
          <Insertable path={`${path}.${i}`} onInsert={onInsert} className="w-full flex items-center gap-1.5 px-1 py-0.5">
            <FileText size={11} aria-hidden="true" className="shrink-0 th-text-faint" />
            <span className="text-[11px] th-text truncate">{file.name}</span>
            <span className="text-[10px] th-text-ghost truncate">{file.content_type}</span>
            <span className="text-[10px] th-text-ghost ml-auto shrink-0">{formatSize(file.size)}</span>
          </Insertable>
        </li>
      ))}
      <MoreNotShown count={value.length - MAX_ROWS} t={t} />
    </ul>
  );
}

function TableView({ value, path, label, onInsert, t }) {
  const columns = [...new Set(value.slice(0, MAX_ROWS).flatMap((row) => Object.keys(row)))].slice(0, MAX_COLUMNS);
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="text-[10px] font-mono border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col" className="px-1 py-0.5 text-left font-semibold th-text-secondary border-b th-border-secondary">
                <Insertable path={`${path}.0.${col}`} onInsert={onInsert} className="px-0.5">{col}</Insertable>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {value.slice(0, MAX_ROWS).map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} className="px-1 py-0.5 th-text-faint max-w-[8rem] truncate">
                  {col in row ? (
                    <Insertable path={`${path}.${i}.${col}`} onInsert={onInsert} className="px-0.5 max-w-full truncate">
                      {scalarText(row[col])}
                    </Insertable>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <MoreNotShown count={value.length - MAX_ROWS} t={t} />
    </div>
  );
}

function TextView({ value, t }) {
  const text = scalarText(value);
  return (
    <>
      <pre className="text-[10px] th-text-faint whitespace-pre-wrap break-words max-h-32 overflow-y-auto p-1.5 rounded-md th-bg-surface">
        {text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text}
      </pre>
      {text.length > MAX_TEXT && <MoreNotShown count={text.length - MAX_TEXT} t={t} />}
    </>
  );
}

/** One key of a JSON tree: objects and lists fold, leaves show their value. */
function TreeRow({ name, value, path, depth, onInsert, t }) {
  const shape = shapeOf(value);
  const nested = shape !== "text" && shape !== "empty";
  // First level open: the fields people pick most; deeper levels on demand.
  const [open, setOpen] = useState(depth === 0);
  return (
    <li>
      <div className="flex items-center gap-0.5">
        {nested ? (
          <button type="button" aria-expanded={open} aria-label={name} onClick={() => setOpen((o) => !o)} className="p-0.5 th-text-faint">
            {open ? <ChevronDown size={10} aria-hidden="true" /> : <ChevronRight size={10} aria-hidden="true" />}
          </button>
        ) : (
          <span className="w-[14px] shrink-0" />
        )}
        <Insertable path={path} onInsert={onInsert} className="flex items-baseline gap-1 min-w-0 px-1 py-0.5">
          <span className="text-[11px] font-mono th-text">{name}</span>{" "}
          {!nested && <span className="text-[10px] font-mono th-text-ghost truncate">{scalarText(value)}</span>}
          {shape === "table" || shape === "files" ? (
            <span className="text-[10px] th-text-ghost">[{value.length}]</span>
          ) : null}
        </Insertable>
      </div>
      {nested && open && (
        <div className="ml-3.5">
          <ValueView value={value} path={path} label={name} depth={depth + 1} onInsert={onInsert} t={t} />
        </div>
      )}
    </li>
  );
}

function TreeView({ value, path, depth, onInsert, t }) {
  const entries = isPlainObject(value) ? Object.entries(value) : value.map((v, i) => [String(i), v]);
  return (
    <ul className="flex flex-col">
      {entries.slice(0, MAX_KEYS).map(([key, child]) => (
        <TreeRow key={key} name={key} value={child} path={`${path}.${key}`} depth={depth} onInsert={onInsert} t={t} />
      ))}
      <MoreNotShown count={entries.length - MAX_KEYS} t={t} />
    </ul>
  );
}

function ValueView({ value, path, label, depth = 0, onInsert, t }) {
  switch (shapeOf(value)) {
    case "files":
      return <FilesView value={value} path={path} onInsert={onInsert} t={t} />;
    case "table":
      return <TableView value={value} path={path} label={label} onInsert={onInsert} t={t} />;
    case "json":
      return <TreeView value={value} path={path} depth={depth} onInsert={onInsert} t={t} />;
    case "text":
      return <TextView value={value} t={t} />;
    default:
      return <p className="text-[10px] th-text-ghost">{t("availableDataEmpty")}</p>;
  }
}

function UpstreamNodeData({ node, outputs, onInsert, t }) {
  const label = node.data?.label || node.id;
  const ran = Object.hasOwn(outputs, node.id);
  // Canvas nodes keep their config under `data`, as in templateExamples.
  const known = templateSuggestionsFor({ ...node, config: node.config ?? node.data?.config }).slice(1);
  return (
    <div className="py-1.5 border-t th-border-secondary first:border-t-0">
      <Insertable path={node.id} onInsert={onInsert} className="flex items-baseline gap-1.5 px-1 mb-1">
        <span className="text-[11px] font-semibold th-text">{label}</span>
        <span className="text-[10px] font-mono th-text-ghost">{`{{${node.id}}}`}</span>
      </Insertable>
      {ran ? (
        <ValueView value={outputs[node.id]} path={node.id} label={label} onInsert={onInsert} t={t} />
      ) : (
        <>
          <p className="text-[10px] th-text-ghost px-1">{t("availableDataNoRun")}</p>
          {known.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1 px-1">
              <span className="text-[10px] th-text-ghost">{t("availableDataKnownFields")}</span>
              {known.map((snippet) => (
                <Insertable
                  key={snippet}
                  path={snippet.slice(2, -2)}
                  onInsert={onInsert}
                  className="px-1.5 py-0.5 text-[10px] font-mono th-bg-elevated th-text-faint border th-border-secondary"
                >
                  {snippet}
                </Insertable>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * "Available data": what each upstream node produced in the last test run,
 * shaped (JSON tree, table, text, files), each value one click away from the
 * field being edited. `onInsert(snippet)` returns false when no field can
 * take it, so the panel asks to click inside one first.
 */
export default function AvailableDataPanel({ upstreamNodes, outputs = {}, onInsert, t }) {
  const [needsField, setNeedsField] = useState(false);
  if (upstreamNodes.length === 0) return null;
  const insert = (snippet) => setNeedsField(onInsert(snippet) === false);
  return (
    <section aria-label={t("availableDataTitle")} className="mb-3 rounded-lg border th-border-secondary th-bg-elevated p-2">
      <h4 className="text-[11px] font-semibold th-text-secondary">{t("availableDataTitle")}</h4>
      <p className="mb-1 text-[10px] th-text-ghost">{t("availableDataHelp")}</p>
      {needsField && <p className="mb-1 text-[10px] text-amber-400">{t("availableDataPickField")}</p>}
      <div className="max-h-80 overflow-y-auto">
        {upstreamNodes.map((node) => (
          <UpstreamNodeData key={node.id} node={node} outputs={outputs} onInsert={insert} t={t} />
        ))}
      </div>
    </section>
  );
}

function previewErrorText(err, t) {
  const detail = err?.detail;
  if (detail?.code === "template_ref_invalid") {
    return t("renderPreviewRefInvalid", { ref: `{{${detail.params?.ref || ""}}}` });
  }
  return t("renderPreviewError");
}

/**
 * The input as the engine would render it with the last test run's outputs
 * (`POST /api/workflows/render-preview`): same `render`, so it never drifts
 * from a real run. Nothing to show before a run or for an empty template.
 */
export function InputPreview({ template, nodeId, outputs, t }) {
  const [state, setState] = useState({ status: "idle" });
  const active = Boolean(template) && Object.keys(outputs).length > 0;
  const outputsKey = JSON.stringify(outputs);

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ status: "loading" });
      Promise.resolve(renderWorkflowPreview({ template, outputs: JSON.parse(outputsKey), node_id: nodeId }, { signal: controller.signal }))
        .then((res) => {
          if (!controller.signal.aborted) setState({ status: "ready", rendered: res?.rendered });
        })
        .catch((err) => {
          if (!controller.signal.aborted) setState({ status: "error", error: err });
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `t` stays out: translated at render, so a new translator never refetches.
  }, [active, template, nodeId, outputsKey]);

  if (!active) return null;
  return (
    <div className="mb-3">
      <span className="block text-[11px] font-semibold th-text-secondary mb-1">{t("renderPreviewTitle")}</span>
      {state.status === "error" ? (
        <p className="text-[10px] text-amber-400">{previewErrorText(state.error, t)}</p>
      ) : state.status === "ready" ? (
        <pre className="text-[10px] th-text-faint whitespace-pre-wrap break-words max-h-40 overflow-y-auto p-1.5 rounded-md th-bg-surface">
          {typeof state.rendered === "string" ? state.rendered : JSON.stringify(state.rendered, null, 2)}
        </pre>
      ) : (
        <p className="text-[10px] th-text-ghost">{t("renderPreviewLoading")}</p>
      )}
    </div>
  );
}
