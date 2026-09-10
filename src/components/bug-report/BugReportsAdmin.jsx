"use client";

/**
 * Écran de triage : la relecture humaine qui précède toute publication.
 *
 * Sa raison d'être tient en une phrase : un signalement contient les logs
 * serveur de la requête fautive et, souvent, une capture de l'écran d'un
 * utilisateur. Envoyer cela vers un traqueur de tickets sans que
 * personne l'ait regardé, c'est publier les données d'un client par
 * automatisme. D'où le bouton « Créer l'issue », et pas un envoi
 * automatique à la réception.
 *
 * Ce que l'écran montre, dans l'ordre où on en a besoin : ce que
 * l'utilisateur a vu, où il était, comment reproduire, puis la preuve
 * technique.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bug,
  ExternalLink,
  Github,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useTranslations } from "use-intl";

import {
  createBugReportIssue,
  fetchBugReportScreenshot,
  getBugReport,
  listBugReportAreas,
  listBugReports,
  updateBugReport,
} from "@/lib/api";

const STATUSES = ["new", "triaged", "issue_created", "duplicate", "rejected", "resolved"];

const SEVERITY_STYLE = {
  blocker: "th-badge-danger",
  major: "th-badge-warning",
  minor: "th-badge-muted",
  cosmetic: "th-badge-muted",
};

export default function BugReportsAdmin() {
  const t = useTranslations("BugReportsAdmin");
  const [items, setItems] = useState([]);
  const [areas, setAreas] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listBugReports({ status: statusFilter, area: areaFilter });
      setItems(page.items || []);
    } catch (loadError) {
      setError(loadError?.message || String(loadError));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, areaFilter]);

  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect -- chargement asynchrone, setState dans les callbacks
  }, [load]);

  useEffect(() => {
    listBugReportAreas().then(setAreas).catch(() => setAreas([]));
  }, []);

  const openDetail = async (id) => {
    setSelected({ loading: true, id });
    try {
      setSelected(await getBugReport(id));
    } catch (detailError) {
      setSelected(null);
      setError(detailError?.message || String(detailError));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold th-text flex items-center gap-2">
          <Bug className="w-6 h-6 th-text-accent" aria-hidden="true" />
          {t("title")}
        </h1>
        <p className="text-sm th-text-muted max-w-3xl">{t("subtitle")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="th-input rounded-lg px-3 py-1.5 text-sm"
          aria-label={t("filterStatus")}
        >
          <option value="">{t("filterAll")}</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>

        <select
          value={areaFilter}
          onChange={(event) => setAreaFilter(event.target.value)}
          className="th-input rounded-lg px-3 py-1.5 text-sm"
          aria-label={t("filterArea")}
        >
          <option value="">{t("filterAll")}</option>
          {areas.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={load}
          className="p-1.5 rounded-lg th-hover"
          aria-label="Rafraîchir"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm th-text-danger">
          <AlertTriangle className="w-4 h-4" /> {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ul className="space-y-2">
          {!loading && items.length === 0 && (
            <li className="text-sm th-text-muted">{t("empty")}</li>
          )}
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openDetail(item.id)}
                aria-current={selected?.id === item.id}
                className={`w-full text-left p-3 rounded-xl border transition ${
                  selected?.id === item.id ? "th-border-accent" : "th-border th-hover"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${SEVERITY_STYLE[item.severity] || ""}`}>
                    {item.severity}
                  </span>
                  <span className="text-sm th-text flex-1">{item.title}</span>
                  {item.occurrences > 1 && (
                    <span className="text-xs th-text-muted shrink-0">
                      ×{item.occurrences}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs th-text-muted">
                  <span>{t(`status.${item.status}`)}</span>
                  {item.area && <span>· {item.area}</span>}
                  {item.route && <code className="truncate">· {item.route}</code>}
                </div>
              </button>
            </li>
          ))}
        </ul>

        {selected && !selected.loading && (
          <Detail report={selected} onChanged={(next) => { setSelected(next); load(); }} t={t} />
        )}
      </div>
    </div>
  );
}

function Detail({ report, onChanged, t }) {
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState(report.admin_note || "");
  const [failure, setFailure] = useState(null);

  const publish = async () => {
    setPublishing(true);
    setFailure(null);
    try {
      onChanged(await createBugReportIssue(report.id));
    } catch (publishError) {
      // 409 = le garde a refusé un dépôt public ; 501 = rien de configuré.
      // Deux situations distinctes, deux remèdes distincts : on ne les
      // fond pas dans « échec ».
      setFailure(
        publishError?.status === 409
          ? t("refusalPublicRepo")
          : publishError?.status === 501
            ? t("notConfigured")
            : publishError?.message || String(publishError),
      );
    } finally {
      setPublishing(false);
    }
  };

  const saveNote = async () => {
    onChanged(await updateBugReport(report.id, { admin_note: note }));
  };

  return (
    <section className="p-4 rounded-xl border th-border space-y-4 overflow-hidden">
      <header className="flex items-start gap-3">
        <h2 className="text-lg font-medium th-text flex-1">{report.title}</h2>
        {report.issue_url ? (
          <a
            href={report.issue_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm th-text-accent"
          >
            <ExternalLink className="w-4 h-4" /> {t("openIssue")}
          </a>
        ) : (
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg th-bg-accent th-text-on-accent text-sm disabled:opacity-50"
          >
            {publishing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Github className="w-4 h-4" />
            )}
            {publishing ? t("creating") : t("createIssue")}
          </button>
        )}
      </header>

      {failure && (
        <p role="alert" className="text-sm th-text-danger">
          {failure}
        </p>
      )}

      <Block title={t("observed")}>{report.observed}</Block>
      <Block title={t("expected")}>{report.expected}</Block>
      <Block title={t("whereIWas")}>
        {report.where_i_was}
        {report.context?.navigation_trail?.length > 0 && (
          <p className="mt-1 text-xs th-text-muted">
            {report.context.navigation_trail
              .map((step) => step.label || step.route)
              .join(" → ")}
          </p>
        )}
        {report.context?.last_action?.label && (
          <p className="mt-1 text-xs th-text-muted">
            {report.context.last_action.kind} : {report.context.last_action.label}
          </p>
        )}
      </Block>
      <Block title={t("reproduction")}>
        <pre className="whitespace-pre-wrap text-sm">{report.what_i_did}</pre>
      </Block>

      <Block title={t("serverLogs")}>
        {report.server_logs?.length > 0 ? (
          <pre className="text-xs overflow-x-auto th-bg-subtle p-2 rounded-lg max-h-64">
            {report.server_logs
              .map(
                (line) =>
                  `${line.timestamp} ${line.level} ${line.logger} — ${line.message}`,
              )
              .join("\n")}
          </pre>
        ) : (
          <p className="text-sm th-text-muted">
            {t("noServerLogs")}
            {report.request_ids?.length > 0 && (
              <code className="block mt-1">{report.request_ids.join(", ")}</code>
            )}
          </p>
        )}
      </Block>

      {report.api_calls?.length > 0 && (
        <Block title={t("apiCalls")}>
          <pre className="text-xs overflow-x-auto th-bg-subtle p-2 rounded-lg max-h-48">
            {report.api_calls
              .map(
                (call) =>
                  `${call.method} ${call.path} → ${call.status ?? "—"}${
                    call.request_id ? `  (${call.request_id})` : ""
                  }`,
              )
              .join("\n")}
          </pre>
        </Block>
      )}

      {report.console?.length > 0 && (
        <Block title={t("consoleErrors")}>
          <pre className="text-xs overflow-x-auto th-bg-subtle p-2 rounded-lg max-h-48">
            {report.console
              .map((entry) => `[${entry.level}] ${entry.message}`)
              .join("\n")}
          </pre>
        </Block>
      )}

      {report.has_screenshot && (
        <Block title={t("screenshot")}>
          <AuthenticatedImage id={report.id} alt={t("screenshot")} />
        </Block>
      )}

      <Block title={t("note")}>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="w-full th-input rounded-lg px-3 py-2"
        />
        <button
          type="button"
          onClick={saveNote}
          className="mt-2 px-3 py-1.5 rounded-lg th-hover text-sm border th-border"
        >
          {t("saveNote")}
        </button>
      </Block>
    </section>
  );
}

function Block({ title, children }) {
  if (!children) return null;
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide th-text-muted mb-1">{title}</h3>
      <div className="th-text text-sm">{children}</div>
    </div>
  );
}

/**
 * La capture vient d'une route authentifiée, donc d'un `fetch` et non
 * d'un `src` d'image — qui partirait sans en-tête et récolterait un 401.
 * Le blob obtenu est affiché via une URL locale, révoquée au démontage
 * pour ne pas laisser l'image en mémoire après la fermeture de l'écran.
 */
function AuthenticatedImage({ id, alt }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    fetchBugReportScreenshot(id)
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!url) return <p className="text-sm th-text-muted">…</p>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="max-w-full rounded-lg border th-border" />;
}
