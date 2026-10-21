"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { APPROVAL_MODES } from "@/lib/workflowGraph";
import { Field, SelectInput, TextInput, TemplateInput } from "./StudioInspector";

/**
 * Inspector of a human-decision node (`approval`): the question (a template,
 * like every other field), how the person answers, the choices — each one a
 * route to wire — and who answers. `patch` merges into the node's config.
 */
export default function ApprovalInspector({ config, patch, upstreamNodes, t: ti }) {
  const t = useTranslations("WorkflowDecision");
  const mode = config.mode;
  const choices = Array.isArray(config.choices) ? config.choices : [];
  const hasChoices = mode === "choices" || mode === "both";

  const updateChoice = (index, partial) =>
    patch({ choices: choices.map((c, i) => (i === index ? { ...c, ...partial } : c)) });
  const removeChoice = (index) => patch({ choices: choices.filter((_, i) => i !== index) });
  const addChoice = () => patch({ choices: [...choices, { route: "", label: "" }] });

  return (
    <>
      <Field label={t("inspQuestion")} help={t("inspQuestionHelp")}>
        <TemplateInput value={config.question} onChange={(v) => patch({ question: v })} upstreamNodes={upstreamNodes} multiline t={ti} />
      </Field>

      <Field label={t("inspMode")}>
        <SelectInput value={mode || ""} onChange={(e) => patch({ mode: e.target.value })}>
          {!APPROVAL_MODES.includes(mode) && <option value="">{String(mode ?? "")}</option>}
          {APPROVAL_MODES.map((m) => <option key={m} value={m}>{t(`inspMode_${m}`)}</option>)}
        </SelectInput>
      </Field>
      {mode === "text" && <p className="-mt-1.5 mb-3 text-[10px] th-text-ghost">{t("inspTextModeHelp")}</p>}

      {hasChoices && (
        <div className="mb-3">
          <p className="text-[11px] font-semibold th-text-secondary mb-1.5">{t("inspChoices")}</p>
          <div className="flex flex-col gap-1.5">
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <label className="flex-1 min-w-0">
                  <span className="sr-only">{t("inspChoiceRoute")}</span>
                  <input
                    aria-label={t("inspChoiceRoute")}
                    value={c.route || ""}
                    onChange={(e) => updateChoice(i, { route: e.target.value })}
                    placeholder={t("inspChoiceRoute")}
                    className="w-full px-2 py-1 text-[11px] font-semibold rounded-md th-bg-elevated border th-border-secondary th-text"
                  />
                </label>
                <label className="flex-1 min-w-0">
                  <span className="sr-only">{t("inspChoiceLabel")}</span>
                  <input
                    aria-label={t("inspChoiceLabel")}
                    value={c.label || ""}
                    onChange={(e) => updateChoice(i, { label: e.target.value })}
                    placeholder={t("inspChoiceLabel")}
                    className="w-full px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text"
                  />
                </label>
                <button type="button" aria-label={t("inspRemoveChoice", { index: i + 1 })} onClick={() => removeChoice(i)} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addChoice} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold th-text-secondary hover:th-text">
            <Plus size={12} />
            {t("inspAddChoice")}
          </button>
          <p className="mt-1 text-[10px] th-text-ghost">{t("inspChoicesHelp")}</p>
          {mode === "both" && <p className="mt-1 text-[10px] th-text-ghost">{t("inspTextRouteHelp")}</p>}
        </div>
      )}

      <Field label={t("inspAssignee")} help={t("inspAssigneeHelp")}>
        <TextInput
          type="email"
          value={config.assignee || ""}
          onChange={(e) => patch({ assignee: e.target.value || undefined })}
          placeholder={t("inspAssigneePlaceholder")}
        />
      </Field>
    </>
  );
}
