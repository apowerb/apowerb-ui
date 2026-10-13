"use client";

import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { saveDashboardAsTemplate } from "@/lib/api";
import { INPUT_CLS, BTN_PRIMARY_CLS } from "./editor/fields";
import ModalShell, { CancelButton } from "./ModalShell";
import { ErrorList, LabelledInput } from "./formParts";
import { submitErrors } from "./templateLib";

const VISIBILITIES = ["private", "organization"];

/** Keep a dashboard's structure as a reusable template (private, or shared with the organization). */
export default function SaveAsTemplateModal({ dashboard, onClose, onSaved }) {
  const t = useTranslations("biTemplate");
  const toast = useToast();
  const groupId = useId();
  const [label, setLabel] = useState(dashboard.title || "");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  const canSubmit = !!label.trim() && !submitting;

  async function submit() {
    const body = { label: label.trim(), visibility };
    if (description.trim()) body.description = description.trim();
    setSubmitting(true);
    setErrors([]);
    try {
      const saved = await saveDashboardAsTemplate(dashboard.id, body);
      toast.success(t("templateSaved", { label: saved?.label || body.label }));
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setErrors(e.status === 409 ? [t("labelTaken")] : submitErrors(e, t("saveFailed")));
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={t("saveTitle")}
      onClose={onClose}
      size="max-w-lg"
      footer={
        <>
          <CancelButton onClick={onClose} label={t("cancel")} />
          <button type="button" disabled={!canSubmit} onClick={submit} className={BTN_PRIMARY_CLS + " !text-sm !px-4 !py-2"}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {t("saveSubmit")}
          </button>
        </>
      }
    >
      <p className="text-sm th-text-secondary">{t("saveIntro")}</p>
      <LabelledInput label={t("saveLabel")}>
        {(id) => (
          <input
            id={id}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={INPUT_CLS}
            autoComplete="off"
          />
        )}
      </LabelledInput>
      <LabelledInput label={t("saveDescription")}>
        {(id) => (
          <textarea
            id={id}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={INPUT_CLS}
          />
        )}
      </LabelledInput>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium th-text mb-1">{t("saveVisibility")}</legend>
        {VISIBILITIES.map((v) => (
          <label key={v} className="flex items-start gap-2 text-sm th-text cursor-pointer">
            <input
              type="radio"
              name={groupId}
              value={v}
              checked={visibility === v}
              onChange={() => setVisibility(v)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{t(v === "private" ? "visPrivate" : "visOrganization")}</span>
              <span className="block text-[11px] th-text-faint">{t(v === "private" ? "visPrivateHint" : "visOrganizationHint")}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <ErrorList title={t("saveFailed")} errors={errors} />
    </ModalShell>
  );
}
