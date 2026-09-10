"use client";

/**
 * Le formulaire de signalement.
 *
 * Trois partis pris, chacun contre un mode d'échec précis des rapports
 * de bug écrits à la main :
 *
 * - **trois champs courts au lieu d'un grand.** « Décrivez votre
 *   problème » produit « ça marche pas ». Demander séparément ce que la
 *   personne faisait, ce qu'elle attendait et ce qu'elle a vu produit un
 *   rapport reproductible, parce que ce sont les seules choses qu'elle
 *   seule sait ;
 * - **la capture est prise avant l'ouverture du modal.** Prise après,
 *   elle photographierait le formulaire au lieu du défaut ;
 * - **le contexte technique est visible, replié.** Cacher ce qu'on envoie
 *   à quelqu'un qui envoie une capture de son écran est le meilleur moyen
 *   de lui apprendre à ne plus rien envoyer.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { listBugReportAreas, snapshot, submitBugReport } from "@/lib/api";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const SEVERITIES = ["blocker", "major", "minor", "cosmetic"];

export default function BugReportModal({
  show,
  onClose,
  screenshot = null,
  context = {},
}) {
  const t = useTranslations("BugReportModal");
  const modalRef = useFocusTrap(show);

  const [areas, setAreas] = useState([]);
  const [area, setArea] = useState("");
  // `null` = « l'utilisateur n'a pas touché au champ », distinct de la
  // chaîne vide qui veut dire « il l'a effacé exprès ». La valeur affichée
  // est dérivée plus bas au lieu d'être posée par un effet : un effet qui
  // écrit dans l'état déclenche un rendu en cascade, et écraserait la
  // saisie si le contexte changeait pendant la frappe.
  const [whereIWasEdit, setWhereIWasEdit] = useState(null);
  const [whatIDid, setWhatIDid] = useState("");
  const [expected, setExpected] = useState("");
  const [observed, setObserved] = useState("");
  const [severity, setSeverity] = useState("major");
  const [attachScreenshot, setAttachScreenshot] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // L'instantané est figé à l'ouverture. Le recalculer à l'envoi y
  // ajouterait les appels d'API du formulaire lui-même, qui noieraient
  // l'appel fautif dans un anneau de vingt entrées.
  const diagnostics = useMemo(() => (show ? snapshot() : null), [show]);

  useEffect(() => {
    if (!show) return undefined;
    const onEscape = (event) => {
      if (event.key === "Escape" && !sending) onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [show, sending, onClose]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    listBugReportAreas()
      .then((options) => {
        if (cancelled) return;
        setAreas(options);
        // Pré-sélection : la route dit mieux que l'utilisateur ce qui a
        // cassé. Elle reste modifiable — l'écran affiché n'est pas
        // toujours le coupable.
        if (!area && context.suggestedArea) setArea(context.suggestedArea);
      })
      .catch(() => {
        // Liste indisponible : le champ reste vide et le serveur déduira
        // la zone. Un menu vide ne doit pas empêcher de signaler.
        if (!cancelled) setAreas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [show, area, context.suggestedArea]);

  if (!show) return null;

  // Ce que l'interface a détecté, tant que l'utilisateur n'a rien écrit.
  const whereIWas = whereIWasEdit ?? context.whereIWas ?? "";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!whatIDid.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await submitBugReport({
        area: area || null,
        where_i_was: whereIWas || null,
        what_i_did: whatIDid,
        expected: expected || null,
        observed: observed || null,
        severity,
        context: {
          ...context.client,
          navigation_trail: diagnostics?.navigation_trail || [],
          last_action: diagnostics?.last_action || null,
        },
        api_calls: diagnostics?.api_calls || [],
        console: diagnostics?.console || [],
        screenshot: attachScreenshot ? screenshot : null,
        // Le consentement porte sur ce que l'utilisateur a vu dans
        // l'aperçu, pas sur une case cochée à l'aveugle.
        screenshot_consent: Boolean(attachScreenshot && screenshot),
      });
      setResult(created);
    } catch (submitError) {
      setError(submitError?.message || t("errorGeneric"));
    } finally {
      setSending(false);
    }
  };

  const failingCall = (diagnostics?.api_calls || [])
    .filter((call) => call.status === null || call.status >= 400)
    .slice(-1)[0];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[60]"
      onClick={() => !sending && onClose()}
    >
      <div className="absolute inset-0 th-bg-overlay backdrop-blur-md animate-fade-in" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
        className="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col animate-scale-up-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex flex-col glass-modal rounded-2xl shadow-2xl overflow-hidden">
          <div className="shrink-0 flex items-center gap-3 p-5 border-b th-border">
            <Bug className="w-5 h-5 th-text-accent" aria-hidden="true" />
            <h2 id="bug-report-title" className="text-lg font-semibold th-text">
              {t("title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="ml-auto p-1 rounded-lg th-hover disabled:opacity-50"
              aria-label={t("close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {result ? (
            <Confirmation result={result} onClose={onClose} t={t} />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <Field label={t("areaLabel")} hint={t("areaHint")}>
                  <select
                    value={area}
                    onChange={(event) => setArea(event.target.value)}
                    className="w-full th-input rounded-lg px-3 py-2"
                  >
                    <option value="">{t("areaPlaceholder")}</option>
                    {areas.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("whereLabel")} hint={t("whereHint")}>
                  <input
                    type="text"
                    value={whereIWas}
                    onChange={(event) => setWhereIWasEdit(event.target.value)}
                    placeholder={t("wherePlaceholder")}
                    className="w-full th-input rounded-lg px-3 py-2"
                  />
                </Field>

                <Field label={t("whatLabel")} hint={t("whatHint")} required>
                  <textarea
                    value={whatIDid}
                    onChange={(event) => setWhatIDid(event.target.value)}
                    required
                    rows={3}
                    placeholder={t("whatPlaceholder")}
                    className="w-full th-input rounded-lg px-3 py-2 resize-y"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("expectedLabel")}>
                    <textarea
                      value={expected}
                      onChange={(event) => setExpected(event.target.value)}
                      rows={2}
                      className="w-full th-input rounded-lg px-3 py-2 resize-y"
                    />
                  </Field>
                  <Field label={t("observedLabel")}>
                    <textarea
                      value={observed}
                      onChange={(event) => setObserved(event.target.value)}
                      rows={2}
                      className="w-full th-input rounded-lg px-3 py-2 resize-y"
                    />
                  </Field>
                </div>

                <Field label={t("severityLabel")}>
                  <div className="flex flex-wrap gap-2">
                    {SEVERITIES.map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSeverity(level)}
                        aria-pressed={severity === level}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                          severity === level
                            ? "th-bg-accent th-text-on-accent border-transparent"
                            : "th-border th-hover"
                        }`}
                      >
                        {t(`severity.${level}`)}
                      </button>
                    ))}
                  </div>
                </Field>

                {screenshot && (
                  <div className="rounded-xl border th-border overflow-hidden">
                    <label className="flex items-center gap-2 p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={attachScreenshot}
                        onChange={(event) =>
                          setAttachScreenshot(event.target.checked)
                        }
                      />
                      <ImageIcon className="w-4 h-4" aria-hidden="true" />
                      <span className="text-sm th-text">{t("screenshotLabel")}</span>
                    </label>
                    {attachScreenshot && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screenshot}
                          alt={t("screenshotAlt")}
                          className="w-full max-h-64 object-contain th-bg-subtle"
                        />
                        <p className="text-xs th-text-muted p-3">
                          {t("screenshotNotice")}
                        </p>
                      </>
                    )}
                  </div>
                )}

                <TechnicalDetails
                  open={showDetails}
                  onToggle={() => setShowDetails((value) => !value)}
                  diagnostics={diagnostics}
                  failingCall={failingCall}
                  context={context.client}
                  t={t}
                />

                {error && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 text-sm th-text-danger"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {error}
                  </p>
                )}
              </div>

              <div className="shrink-0 flex items-center justify-end gap-3 p-5 border-t th-border">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  className="px-4 py-2 rounded-lg th-hover disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={sending || !whatIDid.trim()}
                  className="px-4 py-2 rounded-lg th-bg-accent th-text-on-accent disabled:opacity-50 flex items-center gap-2"
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("submit")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, required = false, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium th-text mb-1">
        {label}
        {required && <span className="th-text-danger"> *</span>}
      </span>
      {hint && <span className="block text-xs th-text-muted mb-1.5">{hint}</span>}
      {children}
    </label>
  );
}

/**
 * Ce qui part avec le signalement, montré tel quel.
 *
 * On affiche l'appel fautif en premier parce que c'est celui qui répond
 * à « pourquoi ça a cassé » ; le reste est du contexte.
 */
function TechnicalDetails({ open, onToggle, diagnostics, failingCall, context, t }) {
  const counts = {
    calls: diagnostics?.api_calls?.length || 0,
    console: diagnostics?.console?.length || 0,
    trail: diagnostics?.navigation_trail?.length || 0,
  };

  return (
    <div className="rounded-xl border th-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 p-3 text-sm th-hover rounded-xl"
      >
        {open ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <span className="th-text">{t("detailsTitle")}</span>
        <span className="ml-auto text-xs th-text-muted">
          {t("detailsSummary", counts)}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 text-xs th-text-muted">
          {failingCall && (
            <p className="th-text">
              <strong>{t("failingCall")}</strong>{" "}
              <code>
                {failingCall.method} {failingCall.path} →{" "}
                {failingCall.status ?? t("noResponse")}
              </code>
              {failingCall.request_id && (
                <>
                  {" "}
                  <span className="th-text-muted">
                    (request_id&nbsp;: <code>{failingCall.request_id}</code>)
                  </span>
                </>
              )}
            </p>
          )}
          {context?.route && (
            <p>
              {t("route")} : <code>{context.route}</code>
            </p>
          )}
          {context?.app_version && (
            <p>
              {t("version")} : <code>{context.app_version}</code>
            </p>
          )}
          {diagnostics?.navigation_trail?.length > 0 && (
            <p>
              {t("trail")} :{" "}
              {diagnostics.navigation_trail
                .map((step) => step.label || step.route)
                .join(" → ")}
            </p>
          )}
          <p className="th-text-muted italic">{t("detailsPrivacy")}</p>
        </div>
      )}
    </div>
  );
}

function Confirmation({ result, onClose, t }) {
  return (
    <div className="p-8 text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full th-bg-success flex items-center justify-center">
        <Check className="w-6 h-6 th-text-on-accent" />
      </div>
      <h3 className="text-lg font-semibold th-text">{t("sentTitle")}</h3>
      <p className="text-sm th-text-muted">
        {result.duplicate_of
          ? t("sentDuplicate", { count: result.occurrences })
          : t("sentNew", { id: result.id })}
      </p>
      {result.logs_attached > 0 && (
        <p className="text-sm th-text-muted">
          {t("sentLogs", { count: result.logs_attached })}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-lg th-bg-accent th-text-on-accent"
      >
        {t("done")}
      </button>
    </div>
  );
}
