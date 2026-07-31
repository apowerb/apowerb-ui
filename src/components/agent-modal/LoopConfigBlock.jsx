"use client";

import { useTranslations } from "use-intl";

export default function LoopConfigBlock({ newAgent, setNewAgent }) {
  const t = useTranslations("LoopConfigBlock");
  const isFixed =
    newAgent.loop_exit_instruction === null ||
    newAgent.loop_exit_instruction === undefined;

  return (
    <div className="space-y-3 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
      <label className="block text-sm font-medium text-purple-300/80">{t("title")}</label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="loopMode"
            value="fixed"
            checked={isFixed}
            onChange={() =>
              setNewAgent((prev) => ({
                ...prev,
                loop_exit_instruction: null,
                loop_max_iterations: prev.loop_max_iterations || 3,
              }))
            }
            className="accent-purple-500"
          />
          <span className="text-sm th-text-secondary">{t("fixedIterations")}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="loopMode"
            value="conditional"
            checked={!isFixed}
            onChange={() =>
              setNewAgent((prev) => ({
                ...prev,
                loop_exit_instruction: prev.loop_exit_instruction || "",
                loop_max_iterations: null,
              }))
            }
            className="accent-purple-500"
          />
          <span className="text-sm th-text-secondary">{t("llmConditionalExit")}</span>
        </label>
      </div>
      {isFixed && (
        <input
          type="number"
          min={1}
          max={100}
          value={newAgent.loop_max_iterations || ""}
          onChange={(e) =>
            setNewAgent((prev) => ({
              ...prev,
              loop_max_iterations: parseInt(e.target.value) || null,
            }))
          }
          placeholder={t("iterationsPlaceholder")}
          className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
        />
      )}
      {!isFixed && (
        <textarea
          value={newAgent.loop_exit_instruction || ""}
          onChange={(e) =>
            setNewAgent((prev) => ({ ...prev, loop_exit_instruction: e.target.value }))
          }
          placeholder={t("exitConditionPlaceholder")}
          rows={3}
          className="glass-input w-full px-4 py-2.5 rounded-xl text-sm resize-none"
        />
      )}
    </div>
  );
}
