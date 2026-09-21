"use client";

import { useId } from "react";
import { useTranslations } from "use-intl";
import { isValidModelApiBase } from "@/lib/modelApiBase";

/**
 * Champ « URL de l'API » (optionnel) du modèle d'un agent. Partagé par le
 * formulaire de création/édition et l'en-tête de l'éditeur diagramme.
 */
export default function ModelApiBaseField({ value, onChange, compact = false }) {
  const t = useTranslations("ModelApiBaseField");
  const id = useId();
  const invalid = !isValidModelApiBase(value);
  return (
    <div>
      <label
        htmlFor={id}
        className={
          compact
            ? "block text-xs th-text-faint mb-1"
            : "block text-sm font-medium th-text-muted mb-2 pl-1"
        }
      >
        {t("label")} <span className="th-text-ghost font-normal">{t("optional")}</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("placeholder")}
        aria-invalid={invalid}
        aria-describedby={`${id}-help`}
        className={
          compact
            ? "glass-input w-full px-3 py-1.5 rounded-lg font-mono text-xs"
            : "glass-input w-full px-4 py-3 rounded-xl font-mono text-sm"
        }
      />
      <p
        id={`${id}-help`}
        className={`text-xs mt-1.5 pl-1 ${invalid ? "text-red-400" : "th-text-ghost"}`}
      >
        {invalid ? t("invalid") : t("hint")}
      </p>
    </div>
  );
}
