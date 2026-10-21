"use client";

import { FlaskConical } from "lucide-react";
import { shapeFieldPaths, MAX_FIELD_CHIPS } from "@/lib/workflowShapes";

const SOURCE_KEY = { static: "shapeSourceStatic", learned: "shapeSourceLearned", run: "shapeSourceRun" };

/**
 * "Fields from the previous step": for each node wired straight into this
 * one, the fields its output is known to have — from the configuration, the
 * tool's last answer, or this session's test. A click puts `{{node.field}}`
 * into this node's input (`onInsert`); nothing is filled on its own. A node
 * whose output is still unknown offers "Test up to here" instead, which asks
 * before running anything.
 */
export default function UpstreamShapeHint({ parents, shapes, canInsert, onInsert, onTestUntil, isRunning, t }) {
  if (!parents.length) return null;
  return (
    <section data-upstream-shapes className="mb-3 rounded-lg border th-border-secondary th-bg-surface p-2">
      <p className="text-[11px] font-semibold th-text-secondary">{t("shapeTitle")}</p>
      <p className="mb-1.5 text-[10px] th-text-ghost">{canInsert ? t("shapeInsertHelp") : t("shapeNoInputHelp")}</p>
      {parents.map((parent) => {
        const known = shapes[parent.id];
        const label = parent.data?.label || parent.id;
        const paths = known ? shapeFieldPaths(known.shape).slice(0, MAX_FIELD_CHIPS) : [];
        return (
          <div key={parent.id} data-upstream-node={parent.id} className="mb-1.5 last:mb-0">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold th-text truncate">{label}</span>
              {known && <span className="text-[10px] th-text-ghost">· {t(SOURCE_KEY[known.source] || "shapeSourceStatic")}</span>}
            </div>
            {known ? (
              <div className="mt-1 flex flex-wrap gap-1">
                <FieldChip label={t("shapeWholeOutput")} type={known.shape?.type} disabled={!canInsert} onClick={() => onInsert(parent.id, "")} />
                {paths.map((f) => (
                  <FieldChip key={f.path} label={f.path} type={f.type} disabled={!canInsert} onClick={() => onInsert(parent.id, f.path)} />
                ))}
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] th-text-ghost">{t("shapeUnknown")}</span>
                <TestUntilButton nodeLabel={label} onClick={() => onTestUntil(parent.id)} disabled={isRunning} t={t} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function FieldChip({ label, type, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text-faint hover:th-bg-surface-hover disabled:opacity-60 disabled:cursor-default"
    >
      {label}
      {type && <span className="th-text-ghost">{type}</span>}
    </button>
  );
}

export function TestUntilButton({ nodeLabel, onClick, disabled, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={t("testUntilHelp")}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md th-text-brand border th-border-secondary hover:th-bg-surface-hover disabled:opacity-50"
    >
      <FlaskConical size={11} aria-hidden="true" />
      {nodeLabel ? t("testUntilNode", { node: nodeLabel }) : t("testUntil")}
    </button>
  );
}
