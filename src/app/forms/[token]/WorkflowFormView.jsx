"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { Loader2, AlertCircle, CheckCircle2, LogIn } from "lucide-react";
import BrandIcon from "@/components/brand/BrandIcon";
import { getWorkflowFormDefinition, submitWorkflowForm } from "@/lib/api";

function emptyValueFor(type) {
  return type === "boolean" ? false : "";
}

function initialValues(fields) {
  const values = {};
  for (const field of fields || []) {
    values[field.name] = emptyValueFor(field.type);
  }
  return values;
}

/** Client-side mirror of the required check the server re-does — a required
 * boolean (e.g. "I agree") must be checked, not merely present. */
function fieldError(field, value, t) {
  if (!field.required) return null;
  if (field.type === "boolean") return value === true ? null : t("requiredFieldError");
  return value == null || String(value).trim() === "" ? t("requiredFieldError") : null;
}

/** `""` for an optional field becomes `null` rather than an empty string on
 * the wire, matching how the trigger's own config editor treats blanks
 * (see `workflowTriggers.js`'s `from_filter: value || null`). */
function coerceValue(field, raw) {
  if (field.type === "boolean") return !!raw;
  if (field.type === "number") {
    if (raw === "" || raw == null) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  return raw === "" ? null : raw;
}

function FormField({ field, value, error, onChange, t }) {
  const id = `form-field-${field.name}`;
  const baseInputClass =
    "w-full px-3 py-2 rounded-lg text-sm th-bg-surface border th-border-secondary th-text focus:outline-none focus:ring-1 focus:ring-brand";

  if (field.type === "boolean") {
    return (
      <div className="mb-4">
        <label htmlFor={id} className="flex items-center gap-2 text-sm th-text-secondary">
          <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
          {field.required && <span className="text-red-400"> *</span>}
        </label>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  let control;
  if (field.type === "textarea") {
    control = <textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} className={baseInputClass} />;
  } else if (field.type === "number") {
    control = <input id={id} type="number" value={value} onChange={(e) => onChange(e.target.value)} className={baseInputClass} />;
  } else if (field.type === "select") {
    control = (
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={baseInputClass}>
        <option value="">{t("selectPlaceholder")}</option>
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  } else if (field.type === "date") {
    control = <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={baseInputClass} />;
  } else {
    control = <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} className={baseInputClass} />;
  }

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium th-text mb-1.5">
        {field.label}
        {field.required && <span className="text-red-400"> *</span>}
      </label>
      {control}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function InfoCard({ icon, title, body, children }) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-16 px-6 rounded-2xl text-center"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      {icon}
      <div>
        <p className="font-semibold th-text mb-1">{title}</p>
        {body && <p className="text-sm th-text-faint">{body}</p>}
      </div>
      {children}
    </div>
  );
}

function loginHref(token) {
  return `/login?redirect=${encodeURIComponent(`/forms/${token}`)}`;
}

/**
 * Public page behind a `form`-kind workflow trigger — no dashboard chrome,
 * no `AuthProvider` (mirrors `SharedConversationView`). Loads the
 * definition, renders it, validates required fields client-side, submits,
 * and shows the confirmation. A 401 (either at load or at submit, when
 * `access: "authenticated"`) points at `/login?redirect=` back to this page
 * instead of silently failing.
 */
export default function WorkflowFormView({ token }) {
  const t = useTranslations("WorkflowFormView");
  const [phase, setPhase] = useState("loading"); // loading | notFound | needsAuth | error | ready
  const [loadErrorMessage, setLoadErrorMessage] = useState("");
  const [definition, setDefinition] = useState(null);
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null); // { kind: "401" | "other", message }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getWorkflowFormDefinition(token)
      .then((def) => {
        if (cancelled) return;
        setDefinition(def);
        setValues(initialValues(def.fields));
        setPhase("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404) setPhase("notFound");
        else if (err.status === 401) setPhase("needsAuth");
        else {
          setLoadErrorMessage(err.message);
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleChange = (name, val) => {
    setValues((v) => ({ ...v, [name]: val }));
    setFieldErrors((e) => (e[name] ? { ...e, [name]: null } : e));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    for (const field of definition.fields || []) {
      const msg = fieldError(field, values[field.name], t);
      if (msg) errors[field.name] = msg;
    }
    if (Object.keys(errors).some((k) => errors[k])) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitError(null);
    setSubmitting(true);
    const payload = {};
    for (const field of definition.fields || []) {
      payload[field.name] = coerceValue(field, values[field.name]);
    }
    try {
      await submitWorkflowForm(token, payload);
      setSubmitted(true);
    } catch (err) {
      if (err.status === 401) setSubmitError({ kind: "401" });
      else setSubmitError({ kind: "other", message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen th-text th-bg-body">
      <div className="max-w-xl mx-auto px-4 py-12">
        <Link href="/" className="flex items-center gap-2.5 mb-8 group w-fit">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
            }}
          >
            <BrandIcon alt="TH2" width={32} height={32} className="rounded-full" />
          </div>
          <span className="text-sm font-semibold th-text-muted">{t("backHome")}</span>
        </Link>

        {phase === "loading" && (
          <div className="flex flex-col items-center gap-4 py-24">
            <Loader2 size={32} className="animate-spin text-brand" />
            <p className="th-text-faint">{t("loading")}</p>
          </div>
        )}

        {phase === "notFound" && (
          <InfoCard icon={<AlertCircle size={36} className="text-red-400" />} title={t("notFoundTitle")} body={t("notFoundBody")} />
        )}

        {phase === "needsAuth" && (
          <InfoCard icon={<LogIn size={36} className="text-brand" />} title={t("authRequiredTitle")} body={t("authRequiredBody")}>
            <Link href={loginHref(token)} className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand text-white">
              {t("signIn")}
            </Link>
          </InfoCard>
        )}

        {phase === "error" && (
          <InfoCard icon={<AlertCircle size={36} className="text-red-400" />} title={t("genericErrorTitle")} body={t("genericErrorBody", { message: loadErrorMessage })} />
        )}

        {phase === "ready" && definition && (
          submitted ? (
            <InfoCard icon={<CheckCircle2 size={36} className="text-emerald-400" />} title={t("successTitle")} body={t("successBody")} />
          ) : (
            <div
              className="rounded-2xl p-6"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <h1 className="text-lg font-semibold th-text mb-1.5">{definition.title}</h1>
              {definition.description && <p className="text-sm th-text-faint mb-6">{definition.description}</p>}

              <form onSubmit={handleSubmit} noValidate>
                {(definition.fields || []).map((field) => (
                  <FormField
                    key={field.name}
                    field={field}
                    value={values[field.name]}
                    error={fieldErrors[field.name]}
                    onChange={(v) => handleChange(field.name, v)}
                    t={t}
                  />
                ))}

                {submitError?.kind === "401" && (
                  <InfoCard icon={<LogIn size={28} className="text-brand" />} title={t("authRequiredTitle")} body={t("authRequiredBody")}>
                    <Link href={loginHref(token)} className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold bg-brand text-white">
                      {t("signIn")}
                    </Link>
                  </InfoCard>
                )}
                {submitError?.kind === "other" && (
                  <p className="mb-4 text-sm text-red-400">{t("submitFailed", { message: submitError.message })}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white disabled:opacity-50"
                >
                  {submitting ? t("submitting") : t("submit")}
                </button>
              </form>
            </div>
          )
        )}
      </div>
    </div>
  );
}
