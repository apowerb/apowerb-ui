"use client";

import { useState } from "react";
import { ArrowLeft, AlertTriangle, CheckCircle2, Loader2, History, Play, Rocket, RotateCcw, X } from "lucide-react";
import { useTranslations } from "use-intl";
import { Link } from "@/lib/navigation";
import { parseValidationMessage } from "@/lib/workflowGraph";

export default function StudioTopBar({
  name,
  onNameChange,
  status,
  version,
  saveState,
  validation,
  onOpenVersions,
  testOpen,
  onToggleTest,
  onPublish,
  onUnpublish,
  publishing,
  conflict,
  onReloadConflict,
}) {
  const t = useTranslations("WorkflowStudio");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [showValidation, setShowValidation] = useState(false);

  const errorCount = (validation?.errors || []).filter((e) => e.level !== "warning").length;
  const isPublished = status === "published";

  const commitName = () => {
    setEditingName(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) onNameChange(trimmed);
    else setDraftName(name);
  };

  return (
    <div className="shrink-0">
      <div className="h-14 px-4 flex items-center gap-3 border-b th-border-secondary th-bg-sidebar">
        <Link href="/workflows" title={t("backToList")} className="p-1.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover shrink-0">
          <ArrowLeft size={16} />
        </Link>

        {editingName ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") { setDraftName(name); setEditingName(false); }
            }}
            placeholder={t("namePlaceholder")}
            className="text-sm font-bold th-text bg-transparent border-b border-brand focus:outline-none px-0.5 min-w-0 max-w-64"
          />
        ) : (
          <button type="button" onClick={() => { setDraftName(name); setEditingName(true); }} className="text-sm font-bold th-text truncate max-w-64 hover:opacity-80 text-left">
            {name || t("namePlaceholder")}
          </button>
        )}

        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${isPublished ? "bg-emerald-500/15 text-emerald-300" : "th-bg-surface th-text-faint"}`}>
          {isPublished ? t("statusPublished") : t("statusDraft")}
        </span>
        <span className="text-[10px] th-text-ghost shrink-0">{t("version", { version })}</span>

        <span className="text-[11px] th-text-ghost flex items-center gap-1 shrink-0">
          {saveState === "saving" && <Loader2 size={11} className="animate-spin" />}
          {saveState === "idle" && <CheckCircle2 size={11} className="text-emerald-400/70" />}
          {saveState === "error" && <AlertTriangle size={11} className="text-red-400" />}
          {t(saveState === "saving" ? "saving" : saveState === "error" ? "saveError" : "saveIdle")}
        </span>

        <div className="flex-1" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowValidation((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${errorCount > 0 ? "border-red-500/40 text-red-300 hover:bg-red-500/10" : "th-border-secondary th-text-secondary hover:th-bg-surface-hover"}`}
          >
            {errorCount > 0 ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
            {t("validCount", { count: errorCount })}
          </button>
          {showValidation && (
            <ValidationPopoverContent errors={validation?.errors || []} onClose={() => setShowValidation(false)} />
          )}
        </div>

        <button type="button" onClick={onOpenVersions} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium th-text-secondary hover:th-bg-surface-hover border th-border-secondary">
          <History size={13} />
          {t("versionsButton")}
        </button>

        <button type="button" onClick={onToggleTest} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${testOpen ? "bg-brand/15 text-[#5B8AFF] border-brand/30" : "th-text-secondary hover:th-bg-surface-hover th-border-secondary"}`}>
          <Play size={13} />
          {t("testButton")}
        </button>

        {isPublished ? (
          <button type="button" onClick={onUnpublish} disabled={publishing} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium th-text-secondary hover:th-bg-surface-hover border th-border-secondary disabled:opacity-50">
            <RotateCcw size={13} />
            {publishing ? t("unpublishing") : t("unpublishButton")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing || errorCount > 0}
            title={errorCount > 0 ? t("publishBlockedTitle") : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90 disabled:opacity-40"
          >
            <Rocket size={13} />
            {publishing ? t("publishing") : t("publishButton")}
          </button>
        )}
      </div>

      {conflict && (
        <div className="px-4 py-2 flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-200">
          <AlertTriangle size={14} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">{t("conflictTitle")}</p>
            <p className="text-[11px] opacity-90">{t("conflictBody", { version: conflict.currentVersion })}</p>
          </div>
          <button type="button" onClick={onReloadConflict} className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40">
            {t("conflictReload")}
          </button>
        </div>
      )}
    </div>
  );
}

function ValidationPopoverContent({ errors, onClose }) {
  const t = useTranslations("WorkflowStudio");
  const tv = useTranslations("WorkflowValidation");

  const format = (err) => {
    const { code, value } = parseValidationMessage(err.message);
    let text;
    try {
      text = tv(code, { value });
    } catch {
      text = tv("unknown", { value: err.message });
    }
    return err.nodeId ? tv("onNode", { node: err.nodeId, message: text }) : text;
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border th-border-secondary th-bg-modal shadow-2xl z-30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold th-text">{t("validationPanelTitle")}</h4>
        <button type="button" onClick={onClose} className="p-1 rounded-md th-text-ghost hover:th-text">
          <X size={12} />
        </button>
      </div>
      {errors.length === 0 ? (
        <p className="text-xs th-text-secondary">{t("validationNone")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {errors.map((err, i) => (
            <li key={i} className={`text-[11px] flex items-start gap-1.5 ${err.level === "warning" ? "th-text-ghost" : "text-red-400"}`}>
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span>{format(err)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
