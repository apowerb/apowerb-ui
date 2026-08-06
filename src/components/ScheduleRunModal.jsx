"use client";

import { X, Calendar, RefreshCw, CheckCircle2, Loader2, Clock, Play } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslations } from "use-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { toDateTimeLocalValue } from "@/lib/datetime";
import { newSessionId } from "@/lib/ids";

const INTERVAL_PRESETS = [
  { value: "@every_5m", labelKey: "intervalEvery5m" },
  { value: "@every_15m", labelKey: "intervalEvery15m" },
  { value: "@hourly", labelKey: "intervalHourly" },
  { value: "@daily", labelKey: "intervalDaily" },
  { value: "custom", labelKey: "intervalCustomCron" },
];

export default function ScheduleRunModal({
  show,
  agents = [],
  preselectedAgent = null,
  prefilledMessage = "",
  onClose,
  onSubmit,
  runNowMode = false,
  onRunNow,
  existingSchedule = null,
}) {
  const t = useTranslations("ScheduleRunModal");
  const { user } = useAuth();
  const modalRef = useFocusTrap(show);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const [agentName, setAgentName] = useState("");
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState(newSessionId());
  const [scheduleInterval, setScheduleInterval] = useState("@hourly");
  const [customCron, setCustomCron] = useState("");
  const [startTime, setStartTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const isEditMode = !runNowMode && !!existingSchedule;

  // Pre-select agent when provided
  useEffect(() => {
    if (preselectedAgent) {
      setAgentName(preselectedAgent.agent_name || "");
    }
  }, [preselectedAgent]);

  // Reset state when modal opens
  useEffect(() => {
    if (show) {
      setResult(null);
      setError(null);
      setSubmitting(false);
      if (!preselectedAgent) {
        setAgentName("");
      }
      setMessage(prefilledMessage || "");
      setSessionId(generateSessionId());
      setScheduleInterval("@hourly");
      setCustomCron("");
      setStartTime("");

      if (existingSchedule && !runNowMode) {
        // Pre-fill from existing schedule
        const interval = existingSchedule.schedule_interval || "@hourly";
        if (INTERVAL_PRESETS.some(p => p.value === interval)) {
          setScheduleInterval(interval);
          setCustomCron("");
        } else {
          setScheduleInterval("custom");
          setCustomCron(interval);
        }
        if (existingSchedule.start_time) {
          // UTC -> wall-clock local pour <input datetime-local> (sinon -2h)
          try {
            const local = toDateTimeLocalValue(existingSchedule.start_time);
            setStartTime(local);
          } catch {
            setStartTime("");
          }
        }
      }
    }
  }, [show, preselectedAgent, prefilledMessage, existingSchedule, runNowMode]);

  if (!show) return null;

  const gradient = "from-blue-500/80 to-blue-600/80";
  const userId = user?.email || user?.id || "scheduler";

  const handleSubmit = async () => {
    if (!agentName || !message.trim()) return;
    if (!runNowMode && scheduleInterval === "custom" && !customCron.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const selectedAgent = agents.find((a) => a.agent_name === agentName);
      const agentId = selectedAgent
        ? String(selectedAgent.agent_id)
        : agentName;

      if (runNowMode) {
        const payload = {
          agent_name: agentName,
          agent_id: agentId,
          user_id: userId,
          session_id: newSessionId(),
          new_message: { role: "user", parts: [{ text: message }] },
        };
        const res = await onRunNow(payload);
        setResult(res || { success: true });
        setTimeout(() => onClose(), 1500);
      } else {
        const resolvedInterval = scheduleInterval === "custom" ? customCron : scheduleInterval;
        const payload = {
          agent_id: agentId,
          user_id: userId,
          session_id: sessionId,
          new_message: { role: "user", content: message },
          streaming: false,
          schedule_interval: resolvedInterval,
        };
        if (startTime) {
          payload.start_time = new Date(startTime).toISOString();
        }
        const res = await onSubmit(payload);
        setResult(res);
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      console.error(runNowMode ? "Run now failed:" : "Schedule run failed:", err);
      setError(err.message || t("genericErrorFallback"));
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = runNowMode
    ? !agentName || !message.trim() || submitting
    : !agentName || !message.trim() || submitting || (scheduleInterval === "custom" && !customCron.trim());

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[40] perspective-1000"
      onClick={onClose}
    >
      <div className="absolute inset-0 th-bg-overlay backdrop-blur-md animate-fade-in" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-run-modal-title"
        className="relative w-full max-w-2xl mx-4 animate-scale-up-center max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute -inset-1 bg-linear-to-r ${gradient} rounded-2xl blur-lg opacity-40 animate-breathe`}
        />

        <div className="relative flex flex-col glass-modal rounded-2xl shadow-2xl overflow-hidden h-full">
          <div
            className={`shrink-0 h-28 bg-linear-to-br ${gradient} p-6 relative overflow-hidden`}
          >
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute -right-20 -top-20 w-32 h-32 bg-white/20 rounded-full blur-2xl" />

            <div className="relative flex justify-between items-start z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl border border-white/20 shadow-lg">
                  {runNowMode ? (
                    <Play size={24} className="text-white" />
                  ) : (
                    <Calendar size={24} className="text-white" />
                  )}
                </div>
                <div>
                  <h2 id="schedule-run-modal-title" className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                    {runNowMode ? t("titleRunNow") : isEditMode ? t("titleUpdateSchedule") : t("titleScheduleRun")}
                  </h2>
                  <p className="text-white/70 text-sm font-medium">
                    {runNowMode
                      ? t("subtitleRunNow")
                      : isEditMode
                        ? t("subtitleUpdateSchedule")
                        : t("subtitleScheduleRun")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="bg-white/20 hover:bg-black/40 text-white/80 hover:text-white p-2 rounded-full transition-all backdrop-blur-sm border border-white/20 ring-1 ring-transparent hover:ring-white/20"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
            {/* Result Banner */}
            {result && (
              <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <CheckCircle2 size={20} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  {runNowMode ? (
                    <div className="space-y-2">
                      <p className="text-blue-400 font-semibold">{t("runCompleted")}</p>
                      {result?.content && (
                        <pre className="mt-1 p-3 th-bg-overlay rounded-lg text-xs th-text-secondary font-mono overflow-x-auto max-h-48 custom-scrollbar whitespace-pre-wrap">
                          {typeof result.content === "string"
                            ? result.content
                            : JSON.stringify(result.content, null, 2)}
                        </pre>
                      )}
                      {!result?.content && result?.events && (
                        <pre className="mt-1 p-3 th-bg-overlay rounded-lg text-xs th-text-secondary font-mono overflow-x-auto max-h-48 custom-scrollbar whitespace-pre-wrap">
                          {JSON.stringify(result.events, null, 2)}
                        </pre>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-blue-400 font-semibold">
                        {isEditMode ? t("scheduleUpdatedBanner") : t("scheduleCreatedBanner")}
                      </p>
                      <div className="th-text-muted font-mono text-xs space-y-0.5">
                        <p>{t("resultScheduleIdLabel")} <span className="th-text-secondary">{result.schedule_id}</span></p>
                        <p>{t("resultAgentLabel")} <span className="th-text-secondary">{result.agent_name}</span></p>
                        <p>{t("resultIntervalLabel")} <span className="th-text-secondary">{result.schedule_interval}</span></p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && !result && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <X size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-red-400 font-semibold">
                    {runNowMode ? t("runFailedBanner") : t("scheduleFailedBanner")}
                  </p>
                  <p className="th-text-muted text-xs mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Agent Selector */}
            <div>
              <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
                {t("agentLabel")} <span className="text-red-400">*</span>
              </label>
              <select
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl appearance-none cursor-pointer"
              >
                <option value="" className="th-bg-modal th-text">
                  {t("selectAgentPlaceholder")}
                </option>
                {agents.map((agent) => (
                  <option
                    key={agent.agent_id}
                    value={agent.agent_name}
                    className="th-bg-modal th-text"
                  >
                    {agent.agent_name} ({agent.agent_id})
                  </option>
                ))}
              </select>
            </div>

            {/* User ID (read-only, from auth) */}
            <div>
              <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
                {t("userIdLabel")}
              </label>
              <input
                type="text"
                value={userId}
                disabled
                className="glass-input w-full px-4 py-3 rounded-xl opacity-60"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
                {t("messageLabel")} <span className="text-red-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                rows={4}
                className="glass-input w-full px-4 py-3 rounded-xl resize-none"
              />
            </div>

            {/* Schedule-only fields: hidden when runNowMode is true */}
            {!runNowMode && (
              <>
                {/* Session ID */}
                <div>
                  <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
                    {t("sessionIdLabel")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      placeholder={t("sessionIdPlaceholder")}
                      className="glass-input flex-1 px-4 py-3 rounded-xl"
                    />
                    <button
                      onClick={() => setSessionId(generateSessionId())}
                      className="glass-btn px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl font-medium transition-all border border-blue-500/20"
                      title={t("generateSessionIdTitle")}
                    >
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </div>

                {/* Schedule Interval */}
                <div>
                  <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
                    {t("scheduleIntervalLabel")} <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={scheduleInterval}
                    onChange={(e) => setScheduleInterval(e.target.value)}
                    className="glass-input w-full px-4 py-3 rounded-xl appearance-none cursor-pointer"
                  >
                    {INTERVAL_PRESETS.map((preset) => (
                      <option
                        key={preset.value}
                        value={preset.value}
                        className="th-bg-modal th-text"
                      >
                        {t(preset.labelKey)}
                      </option>
                    ))}
                  </select>
                  {scheduleInterval === "custom" && (
                    <input
                      type="text"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      placeholder={t("customCronPlaceholder")}
                      className="glass-input w-full px-4 py-3 rounded-xl mt-2"
                    />
                  )}
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-sm font-medium th-text-muted mb-2 pl-1">
                    {t("startTimeLabel")}{" "}
                    <span className="th-text-ghost font-normal">{t("optionalSuffix")}</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="th-text-faint shrink-0" />
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="glass-input flex-1 px-4 py-3 rounded-xl"
                    />
                  </div>
                  <p className="th-text-ghost text-xs mt-1.5 pl-1">
                    {t("leaveEmptyHint")}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="shrink-0 p-6 th-bg-overlay border-t th-border-secondary flex gap-3">
            <button
              onClick={onClose}
              className="glass-btn flex-1 px-4 py-3 border th-border th-text-secondary rounded-xl hover:th-bg-surface hover:th-text font-semibold transition-all"
            >
              {result ? t("closeAction") : t("cancelAction")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitDisabled}
              className={`glass-btn flex-1 px-4 py-3 text-white rounded-xl font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-linear-to-r ${gradient} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2`}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {runNowMode ? t("runningEllipsis") : isEditMode ? t("updatingEllipsis") : t("schedulingEllipsis")}
                </>
              ) : runNowMode ? (
                <>
                  <Play size={18} />
                  {t("runNowAction")}
                </>
              ) : isEditMode ? (
                t("updateScheduleAction")
              ) : (
                t("scheduleRunAction")
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
