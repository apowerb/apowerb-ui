"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import { Languages, Loader2, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/Toast";
import { upgradeDashboardFromTemplate } from "@/lib/api";
import { BTN_PRIMARY_CLS } from "./editor/fields";
import ModalShell, { CancelButton } from "./ModalShell";
import ChoiceCard from "./ChoiceCard";
import { ErrorList } from "./formParts";
import { submitErrors, templateLang } from "./templateLib";

// each language under its own name, whatever the app language
const LANGUAGES = [
  { code: "fr", name: "Français" },
  { code: "en", name: "English" },
];

/** Rebuild a dashboard from its stock template in the other language; the mapping and params are kept. */
export default function ChangeLanguageModal({ dashboard, template, onClose, onDone }) {
  const t = useTranslations("biTemplate");
  const toast = useToast();
  const current = templateLang(dashboard.locale);
  const [lang, setLang] = useState(current === "fr" ? "en" : "fr");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  async function submit() {
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await upgradeDashboardFromTemplate(dashboard.id, { lang });
      toast.success(t("languageChanged"));
      onDone(res.dashboard);
      onClose();
    } catch (e) {
      setErrors(submitErrors(e, t("languageFailed")));
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={t("languageTitle")}
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} label={t("cancel")} />
          <button
            type="button"
            disabled={submitting || lang === current}
            onClick={submit}
            className={BTN_PRIMARY_CLS + " !text-sm !px-4 !py-2"}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {t("languageSubmit")}
          </button>
        </>
      }
    >
      <p className="text-sm th-text-secondary">
        {t("languageIntro", { label: template.label, version: template.version })}
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t("languageTitle")}</legend>
        {LANGUAGES.map((l) => (
          <ChoiceCard
            key={l.code}
            icon={Languages}
            selected={l.code === lang}
            title={l.name}
            badge={l.code === current ? t("languageCurrent") : null}
            onSelect={() => setLang(l.code)}
          />
        ))}
      </fieldset>
      <div
        role="note"
        className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
      >
        <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
        <p>{t("upgradeWarning")}</p>
      </div>
      <ErrorList title={t("languageFailed")} errors={errors} />
    </ModalShell>
  );
}
