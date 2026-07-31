"use client";

import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";

const statusIcons = {
  pending: <Clock size={14} className="th-text-faint" />,
  running: <Loader2 size={14} className="text-purple-300 animate-spin" />,
  done: <CheckCircle2 size={14} className="text-blue-400" />,
  error: <XCircle size={14} className="text-purple-400" />,
};

export default function WorkflowPanel({
  workflowState,
  onRun,
  onStop,
  canvasEmpty,
}) {
  const t = useTranslations("WorkflowPanel");
  const [expandedStep, setExpandedStep] = useState(null);

  const { status, steps, error } = workflowState;
  const isRunning = status === "running";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="th-bg-elevated backdrop-blur-xl border-t th-border-secondary flex flex-col shadow-[0_-4px_20px_-8px_var(--shadow-color)] z-20 transition-all duration-300">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b th-border-secondary">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 th-text font-bold tracking-wide">
            <Activity size={18} className="text-brand" />
            <span>{t("title")}</span>
          </div>

          <div className="h-4 w-px th-border mx-2" style={{ width: 1, backgroundColor: "var(--border-primary)" }}></div>

          {isRunning && (
            <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-300/10 text-purple-300 border border-purple-300/20 flex items-center gap-1.5 animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              {t("processingBadge")}
            </span>
          )}
          {isDone && (
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              {t("completedBadge")}
            </span>
          )}
          {isError && (
            <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
              <XCircle size={12} />
              {t("failedBadge")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-sm font-bold uppercase tracking-wider transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-95 border border-red-500/30"
            >
              <Square size={12} className="fill-current" />
              {t("stopAction")}
            </button>
          ) : (
            <button
              onClick={onRun}
              disabled={canvasEmpty}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
                canvasEmpty
                  ? "th-bg-surface th-text-ghost cursor-not-allowed border th-border"
                  : "bg-blue-600/80 hover:bg-blue-500 text-white hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 border border-blue-500/30"
              }`}
            >
              <Play size={12} className="fill-current" />
              {isDone || isError ? t("rerunWorkflowAction") : t("runWorkflowAction")}
            </button>
          )}
        </div>
      </div>

      {/* Steps list */}
      <div
        className={`transition-all duration-300 ${steps.length > 0 ? "max-h-64" : "max-h-0"} overflow-y-auto custom-scrollbar th-bg-surface`}
      >
        {steps.map((step) => (
          <div
            key={step.id}
            className={`border-b th-border-secondary transition-colors ${
              step.status === "running" ? "bg-purple-300/5" : ""
            } ${step.status === "error" ? "bg-purple-500/5" : ""} hover:th-bg-surface-hover`}
          >
            <div
              className="flex items-center gap-4 px-6 py-3 cursor-pointer group"
              onClick={() =>
                setExpandedStep(expandedStep === step.id ? null : step.id)
              }
            >
              <div className="shrink-0">{statusIcons[step.status]}</div>

              <span
                className={`text-sm font-medium flex-1 truncate ${step.status === "done" ? "th-text-secondary" : "th-text"}`}
              >
                {step.label}
              </span>

              {step.type && (
                <span className="text-[10px] font-mono th-text-ghost th-bg-surface px-2 py-0.5 rounded border th-border-secondary">
                  {step.type}
                </span>
              )}

              {step.duration != null && (
                <span className="text-xs font-mono th-text-faint">
                  {(step.duration / 1000).toFixed(2)}s
                </span>
              )}

              {step.result != null && (
                <span
                  className={`transition-transform duration-200 ${expandedStep === step.id ? "rotate-180" : ""}`}
                >
                  <ChevronDown
                    size={14}
                    className="th-text-ghost group-hover:th-text-secondary"
                  />
                </span>
              )}
            </div>

            {/* Expanded result */}
            {expandedStep === step.id && step.result != null && (
              <div className="px-6 pb-4 pt-1 animate-slide-up">
                <div className="th-bg-surface rounded-lg border th-border overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 th-bg-elevated border-b th-border-secondary text-[10px] font-mono th-text-faint uppercase tracking-wider">
                    <Terminal size={10} /> {t("outputLabel")}
                  </div>
                  <pre className="p-3 text-xs font-mono text-blue-600 dark:text-blue-200 overflow-x-auto whitespace-pre-wrap max-h-40 custom-scrollbar">
                    {typeof step.result === "string"
                      ? step.result
                      : JSON.stringify(step.result, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Error message */}
            {expandedStep === step.id && step.error && (
              <div className="px-6 pb-4 pt-1 animate-slide-up">
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-xs text-purple-600 dark:text-purple-300 font-mono">
                  <span className="font-bold block mb-1">{t("errorTraceLabel")}</span>
                  {step.error}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Global error */}
        {isError && error && (
          <div className="px-6 py-4 bg-purple-500/10 border-t border-purple-500/20">
            <div className="flex items-start gap-3">
              <XCircle size={16} className="text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-purple-400 mb-1">
                  {t("workflowFailedTitle")}
                </p>
                <p className="text-xs text-purple-600/80 dark:text-purple-300/80 font-mono">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
