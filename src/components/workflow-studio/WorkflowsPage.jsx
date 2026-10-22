"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Workflow as WorkflowIcon, Copy, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useTranslations, useFormatter, useNow } from "use-intl";
import { Link, useRouter } from "@/lib/navigation";
import { listWorkflowDefs, createWorkflowDef, duplicateWorkflowDef, deleteWorkflowDef, resumeWorkflowRun } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { consumeWorkflowRun } from "@/lib/workflowSse";
import CreateWorkflowModal from "./CreateWorkflowModal";
import AwaitingDecisionsList from "./AwaitingDecisionsList";
import { errorText } from "./ExecutionPanel";
import PreviewBadge from "@/components/PreviewBadge";

// POST et duplicate renvoient le workflow complet (graphe compris) ; la liste,
// elle, ne porte que ``node_count``. On ramène les deux à la forme de la liste.
function toSummary(workflow) {
  if (workflow.node_count != null) return workflow;
  return { ...workflow, node_count: workflow.graph?.nodes?.length ?? 0 };
}

function WorkflowCard({ workflow, onDuplicate, onDelete, duplicatingId, duplicateError, deleteTarget, onOpenDelete, onCloseDelete, deleting, deleteError }) {
  const t = useTranslations("WorkflowsPage");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const isPublished = workflow.status === "published";
  const confirming = deleteTarget === workflow.workflow_id;

  return (
    <div className="rounded-2xl th-bg-surface border th-border-secondary hover:th-border-hover p-4 flex flex-col transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/workflows/${workflow.workflow_id}`} className="min-w-0 flex-1">
          <h3 className="text-sm font-bold th-text truncate hover:text-[#5B8AFF]">{workflow.name}</h3>
        </Link>
        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold ${isPublished ? "bg-emerald-500/15 text-emerald-300" : "th-bg-elevated th-text-faint"}`}>
          {isPublished ? t("statusPublished") : t("statusDraft")}
        </span>
      </div>
      {workflow.description && <p className="text-xs th-text-ghost mb-2 line-clamp-2">{workflow.description}</p>}
      <div className="flex items-center gap-2 text-[11px] th-text-ghost mb-3">
        <span>{t("version", { version: workflow.version })}</span>
        <span>·</span>
        <span>{t("nodeCount", { count: workflow.node_count ?? 0 })}</span>
      </div>
      <p className="text-[11px] th-text-ghost mb-3">
        {t("updated", { when: format.relativeTime(new Date(workflow.updated_at), now) })}
      </p>

      {confirming ? (
        <div className="mt-auto p-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-[11px] text-red-300 mb-2">{t("deleteConfirmBody", { name: workflow.name })}</p>
          {deleteError && <p className="text-[11px] text-red-400 mb-2">{t("deleteFailed", { message: deleteError })}</p>}
          <div className="flex gap-1.5">
            <button type="button" disabled={deleting} onClick={() => onDelete(workflow.workflow_id)} className="flex-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50">
              {deleting ? t("deleting") : t("deleteConfirmAction")}
            </button>
            <button type="button" disabled={deleting} onClick={onCloseDelete} className="px-2 py-1 text-[11px] font-medium rounded-lg th-bg-elevated th-text-secondary">
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-1.5">
          <Link href={`/workflows/${workflow.workflow_id}`} className="flex-1 text-center px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90">
            {t("open")}
          </Link>
          <button
            type="button"
            title={t("duplicate")}
            disabled={duplicatingId === workflow.workflow_id}
            onClick={() => onDuplicate(workflow.workflow_id)}
            className="p-1.5 rounded-lg th-text-secondary hover:th-text hover:th-bg-surface-hover border th-border-secondary disabled:opacity-50"
          >
            {duplicatingId === workflow.workflow_id ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
          </button>
          <button
            type="button"
            title={t("delete")}
            onClick={() => onOpenDelete(workflow.workflow_id)}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border th-border-secondary"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
      {duplicateError?.id === workflow.workflow_id && (
        <p role="alert" className="mt-2 text-[11px] text-red-400">{t("duplicateFailed", { message: duplicateError.message })}</p>
      )}
    </div>
  );
}

// What is told after an answer sent from the list: the run is followed to its
// terminal event, then summed up in one line.
function resumeOutcome(terminal, td, te) {
  switch (terminal?.event) {
    case "done":
      return { tone: "ok", text: td("resumeDone") };
    case "awaiting_input":
      return { tone: "ok", text: td("resumeAwaiting") };
    case "cancelled":
      return { tone: "warn", text: td("resumeCancelled") };
    case "error":
      return { tone: "error", text: td("resumeFailed", { message: errorText(te, terminal) }) };
    default:
      return { tone: "error", text: td("resumeFailed", { message: errorText(te, { code: "server_unreachable", params: { status: "-" } }) }) };
  }
}

export default function WorkflowsPage() {
  const t = useTranslations("WorkflowsPage");
  const td = useTranslations("WorkflowDecision");
  const te = useTranslations("WorkflowExecutionPanel");
  const { user } = useAuth();
  const userEmail = user?.email ?? null;
  const [resumeStatus, setResumeStatus] = useState(null);
  const [decisionsKey, setDecisionsKey] = useState(0);
  // `?decision=<run_id>`: the link of a decision notice (mail, Teams).
  const [linkedRunId] = useState(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("decision"),
  );
  const resumeGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const router = useRouter();
  const [workflows, setWorkflows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [duplicateError, setDuplicateError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const fetchList = useCallback(
    () =>
      listWorkflowDefs()
        .then((data) => setWorkflows(Array.isArray(data) ? data : []))
        .catch((err) => setLoadError(err.message)),
    [],
  );

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const retryLoad = () => {
    setLoadError(null);
    fetchList();
  };

  const filtered = useMemo(() => {
    if (!workflows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter((w) => w.name?.toLowerCase().includes(q));
  }, [workflows, query]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // An assignee cannot open the workflow in the studio (owner only): the answer
  // is sent from here. A refusal (404, 409, 422) is thrown to the dialog; once
  // accepted, the rest of the run is followed in the background. The stream is
  // never cut (the engine would cancel a run whose answer is given): leaving
  // the page, or answering another decision, only stops listening to it.
  const answerDecision = async (decision, body) => {
    const response = await resumeWorkflowRun(decision.runId, body, { signal: new AbortController().signal });
    const generation = ++resumeGenerationRef.current;
    const latest = () => mountedRef.current && resumeGenerationRef.current === generation;
    setResumeStatus({ tone: "info", text: td("resumeRunning") });
    let outcome;
    consumeWorkflowRun(response)
      .then((terminal) => {
        outcome = resumeOutcome(terminal, td, te);
      })
      .catch(() => {
        outcome = resumeOutcome(null, td, te);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setDecisionsKey((n) => n + 1);
        if (latest()) setResumeStatus(outcome);
      });
  };

  const handleCreate = async ({ name, description, graph }) => {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createWorkflowDef({ name, description, graph });
      setShowCreate(false);
      setWorkflows((prev) => [toSummary(created), ...(prev || [])]);
      router.push(`/workflows/${created.workflow_id}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (id) => {
    setDuplicatingId(id);
    setDuplicateError(null);
    try {
      const copy = await duplicateWorkflowDef(id);
      setWorkflows((prev) => [toSummary(copy), ...(prev || [])]);
    } catch (err) {
      setDuplicateError({ id, message: err.message });
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteWorkflowDef(id);
      setWorkflows((prev) => (prev || []).filter((w) => w.workflow_id !== id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="w-full">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold th-text">{t("title")}</h1>
              <PreviewBadge />
            </div>
            <p className="text-sm th-text-ghost mt-1">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => { setCreateError(null); setShowCreate(true); }}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90"
          >
            <Plus size={15} />
            {t("createButton")}
          </button>
        </div>

        <div className="relative mb-5 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-ghost" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>

        {resumeStatus && (
          <p
            role="status"
            className={`mb-3 text-xs ${resumeStatus.tone === "error" ? "text-red-400" : resumeStatus.tone === "warn" ? "text-amber-300" : "th-text-secondary"}`}
          >
            {resumeStatus.text}
          </p>
        )}
        <AwaitingDecisionsList
          hideWhenEmpty
          className="mb-6"
          openRunId={linkedRunId}
          onAnswer={answerDecision}
          userEmail={userEmail}
          studioLink
          refreshKey={decisionsKey}
        />

        {loadError && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 mb-5">
            <AlertTriangle size={16} className="shrink-0" />
            <p className="text-sm flex-1">{t("loadFailed", { message: loadError })}</p>
            <button type="button" onClick={retryLoad} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/20 hover:bg-red-500/30">
              {t("retry")}
            </button>
          </div>
        )}

        {workflows === null && !loadError && (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin th-text-ghost" />
          </div>
        )}

        {workflows && workflows.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20 rounded-2xl border th-border-secondary th-bg-surface">
            <WorkflowIcon size={28} className="th-text-ghost mb-3" />
            <p className="text-sm font-semibold th-text mb-1">{t("emptyTitle")}</p>
            <p className="text-xs th-text-ghost max-w-sm">{t("emptyBody")}</p>
          </div>
        )}

        {workflows && workflows.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-20 rounded-2xl border th-border-secondary th-bg-surface">
            <p className="text-sm font-semibold th-text mb-1">{t("emptySearchTitle", { query })}</p>
            <p className="text-xs th-text-ghost mb-3">{t("emptySearchBody")}</p>
            <button type="button" onClick={() => setQuery("")} className="text-xs font-semibold text-[#5B8AFF] hover:underline">
              {t("clearSearch")}
            </button>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((w) => (
              <WorkflowCard
                key={w.workflow_id}
                workflow={w}
                duplicatingId={duplicatingId}
              duplicateError={duplicateError}
                onDuplicate={handleDuplicate}
                deleteTarget={deleteTarget}
                onOpenDelete={setDeleteTarget}
                onCloseDelete={() => { setDeleteTarget(null); setDeleteError(null); }}
                onDelete={handleDelete}
                deleting={deleting}
                deleteError={deleteTarget === w.workflow_id ? deleteError : null}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateWorkflowModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          creating={creating}
          error={createError}
        />
      )}
    </div>
  );
}
