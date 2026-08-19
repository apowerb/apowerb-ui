"use client";

import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";

/**
 * Outcome of running an artifact: exit code, duration, stdout and stderr.
 *
 * Shared by the chat side panel and the artifacts library so a run reads the
 * same way wherever it was started.
 */
export default function ArtifactExecutionResult({ result, isRunning }) {
  const t = useTranslations("ArtifactExecution");

  if (isRunning) {
    return (
      <div className="border-t th-border p-3 flex items-center gap-2 th-text-muted text-xs">
        <Loader2 size={14} className="animate-spin" />
        <span>{t("runningEllipsis")}</span>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="border-t th-border text-xs font-mono">
      <div className="flex items-center gap-3 px-3 py-2 border-b th-border-secondary th-bg-surface">
        <span
          className={`font-medium ${
            result.exit_code === 0 ? "text-blue-400" : "text-red-400"
          }`}
        >
          {t("exitCode", { code: result.exit_code })}
        </span>
        <span className="th-text-faint">{result.duration_ms}ms</span>
      </div>

      {result.stdout && (
        <div className="p-3">
          <div className="th-text-faint text-[10px] uppercase tracking-wider mb-1">
            stdout
          </div>
          <pre className="text-blue-300/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto custom-scrollbar">
            {result.stdout}
          </pre>
        </div>
      )}

      {result.stderr && (
        <div className="p-3 pt-0">
          <div className="th-text-faint text-[10px] uppercase tracking-wider mb-1">
            stderr
          </div>
          <pre className="text-red-300/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto custom-scrollbar">
            {result.stderr}
          </pre>
        </div>
      )}

      {!result.stdout && !result.stderr && (
        <div className="p-3 th-text-faint italic">{t("noOutput")}</div>
      )}
    </div>
  );
}

/** Languages the backend can execute (see apowerb LANGUAGE_IMAGES). */
export const RUNNABLE_LANGUAGES = [
  "python",
  "javascript",
  "js",
  "bash",
  "sh",
  "ruby",
  "go",
];

export function isRunnable(language) {
  return RUNNABLE_LANGUAGES.includes(language?.toLowerCase());
}
