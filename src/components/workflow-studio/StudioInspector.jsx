"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  getUpstreamNodeIds,
  templateSuggestionsFor,
  LOOP_OPERATORS,
  CONVERT_TARGETS,
  HTTP_METHODS,
  HTTP_METHODS_WITH_BODY,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_MAX_RECIPIENTS,
  isHttpHeaderForbidden,
  nodeIdRenameError,
  filterToolOptions,
} from "@/lib/workflowGraph";
import { getTeamsWebhookStatus } from "@/lib/api";
import { Link } from "@/lib/navigation";

const ROUTER_OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in", "exists"];

// The label wraps its control (rather than a sibling `htmlFor`/`id` pair) so
// every field is accessibly labeled — and findable by `getByLabelText` in
// tests — without hand-generating a unique id per input.
function Field({ label, help, children }) {
  return (
    <div className="mb-3">
      <label className="block">
        <span className="block text-[11px] font-semibold th-text-secondary mb-1">{label}</span>
        {children}
      </label>
      {help && <p className="mt-1 text-[10px] th-text-ghost">{help}</p>}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand"
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select
      {...props}
      className="w-full px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text focus:outline-none focus:ring-1 focus:ring-brand"
    >
      {children}
    </select>
  );
}

function insertAtCursor(ref, value, onChange, snippet) {
  const el = ref.current;
  const current = value || "";
  if (!el || el.selectionStart == null) {
    onChange(current + snippet);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const next = current.slice(0, start) + snippet + current.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    try {
      el.selectionStart = el.selectionEnd = start + snippet.length;
    } catch {
      // selection API unsupported on this input type — harmless
    }
  });
}

/** A text input/textarea plus one-click `{{node...}}` chips for every upstream node. */
function TemplateInput({ value, onChange, placeholder, upstreamNodes, multiline, t }) {
  const ref = useRef(null);
  const suggestions = upstreamNodes.flatMap((n) => templateSuggestionsFor(n).slice(0, 1).map((snippet) => ({ node: n, snippet })));
  const Comp = multiline ? "textarea" : "input";
  return (
    <div>
      <Comp
        ref={ref}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand resize-y"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {suggestions.map(({ node, snippet }) => (
            <button
              key={snippet}
              type="button"
              title={t("upstreamValuesHelp")}
              onClick={() => insertAtCursor(ref, value, onChange, snippet)}
              className="px-1.5 py-0.5 text-[10px] font-mono rounded-md th-bg-elevated hover:th-bg-surface-hover th-text-faint border th-border-secondary"
            >
              {node.label || node.id}
            </button>
          ))}
        </div>
      )}
      {upstreamNodes.length === 0 && (
        <p className="mt-1 text-[10px] th-text-ghost">{t("upstreamValuesEmpty")}</p>
      )}
    </div>
  );
}

/** Object-value textarea: keeps its own text buffer so invalid-mid-typing JSON doesn't corrupt the saved config. */
function JsonField({ value, onChange, rows = 4, t }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      setText(JSON.stringify(value ?? {}, null, 2));
      setError(null);
    }
  }, [value]);

  const handleChange = (raw) => {
    setText(raw);
    try {
      const parsed = raw.trim() === "" ? {} : JSON.parse(raw);
      setError(null);
      lastValueRef.current = parsed;
      onChange(parsed);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <textarea
        value={text}
        rows={rows}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg th-bg-surface border ${error ? "border-red-500/60" : "th-border-secondary"} th-text resize-y focus:outline-none focus:ring-1 focus:ring-brand`}
      />
      {error && <p className="mt-1 text-[10px] text-red-400">{t("invalidJson", { message: error })}</p>}
    </div>
  );
}

/**
 * Editable node id. The draft is committed on Enter or blur, and only when the
 * server would accept it; Escape restores the current id. Mounted with
 * `key={node.id}` so selecting another node starts from a fresh draft.
 */
function NodeIdField({ nodeId, existingIds, onRename, t }) {
  const [draft, setDraft] = useState(nodeId);
  const [error, setError] = useState(null);

  const commit = () => {
    const candidate = draft.trim();
    const reason = nodeIdRenameError(candidate, nodeId, existingIds);
    if (reason) {
      setError(reason);
      return;
    }
    setError(null);
    if (candidate !== nodeId) onRename(nodeId, candidate);
  };

  return (
    <div className="mb-3">
      <label className="block">
        <span className="block text-[11px] font-semibold th-text-secondary mb-1">{t("nodeId")}</span>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(nodeId);
              setError(null);
            }
          }}
          aria-invalid={error ? true : undefined}
          className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg th-bg-surface border ${error ? "border-red-500/60" : "th-border-secondary"} th-text focus:outline-none focus:ring-1 focus:ring-brand`}
        />
      </label>
      {error ? (
        <p className="mt-1 text-[10px] text-red-400">{t(error === "duplicate" ? "nodeIdDuplicate" : "nodeIdInvalid")}</p>
      ) : (
        <p className="mt-1 text-[10px] th-text-ghost">{t("nodeIdHelp")}</p>
      )}
    </div>
  );
}

/** Tool select with a search box: the catalogue runs to hundreds of entries. */
function ToolPicker({ value, options, onChange, t }) {
  const [query, setQuery] = useState("");
  const filtered = filterToolOptions(options, query);
  const selected = options.find((o) => o.value === value);
  const shown = selected && !filtered.includes(selected) ? [selected, ...filtered] : filtered;
  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t("toolSearch")}
        placeholder={t("toolSearch")}
        className="w-full mb-1.5 px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <Field label={t("toolLabel")} help={filtered.length === 0 ? t("toolSearchEmpty") : undefined}>
        <SelectInput value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("toolPlaceholder")}</option>
          {shown.map((tool) => <option key={tool.value} value={tool.value}>{tool.label}</option>)}
        </SelectInput>
      </Field>
    </>
  );
}

function DeleteButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
    >
      <Trash2 size={12} />
      {label}
    </button>
  );
}

function RulesEditor({ rules, defaultRoute, onChange, t }) {
  const update = (i, patch) => {
    const next = rules.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ rules: next, default_route: defaultRoute });
  };
  const remove = (i) => onChange({ rules: rules.filter((_, idx) => idx !== i), default_route: defaultRoute });
  const add = () => onChange({ rules: [...rules, { route: "", field: "", op: "eq", value: "" }], default_route: defaultRoute });

  return (
    <div>
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("rulesTitle")}</label>
      <div className="flex flex-col gap-2">
        {rules.map((rule, i) => (
          <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <input value={rule.field || ""} onChange={(e) => update(i, { field: e.target.value })} placeholder={t("ruleFieldPlaceholder")} className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text" />
              <button type="button" onClick={() => remove(i)} title={t("removeRule")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="flex gap-1.5">
              <select value={rule.op || "eq"} onChange={(e) => update(i, { op: e.target.value })} className="px-1.5 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text">
                {ROUTER_OPS.map((op) => (
                  <option key={op} value={op}>{t(`op${op.charAt(0).toUpperCase()}${op.slice(1)}`)}</option>
                ))}
              </select>
              <input value={rule.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} placeholder={t("ruleValue")} className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text" />
            </div>
            <input value={rule.route || ""} onChange={(e) => update(i, { route: e.target.value })} placeholder={t("ruleRoutePlaceholder")} className="px-2 py-1 text-[11px] font-semibold rounded-md th-bg-elevated border th-border-secondary th-text" />
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary">
        <Plus size={12} />
        {t("addRule")}
      </button>
      <div className="mt-2.5">
        <label className="block text-[11px] font-semibold th-text-secondary mb-1">{t("defaultRoute")}</label>
        <input value={defaultRoute || ""} onChange={(e) => onChange({ rules, default_route: e.target.value })} placeholder={t("defaultRoutePlaceholder")} className="w-full px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost" />
      </div>
    </div>
  );
}

function RoutesEditor({ routes, onChange, t }) {
  const update = (i, patch) => {
    const next = routes.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i) => onChange(routes.filter((_, idx) => idx !== i));
  const add = () => onChange([...routes, { route: "", description: "" }]);

  return (
    <div>
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("routesTitle")}</label>
      <div className="flex flex-col gap-2">
        {routes.map((r, i) => (
          <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <input value={r.route || ""} onChange={(e) => update(i, { route: e.target.value })} placeholder={t("routeNamePlaceholder")} className="flex-1 min-w-0 px-2 py-1 text-[11px] font-semibold rounded-md th-bg-elevated border th-border-secondary th-text" />
              <button type="button" onClick={() => remove(i)} title={t("removeRoute")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
            <textarea value={r.description || ""} onChange={(e) => update(i, { description: e.target.value })} placeholder={t("routeDescriptionPlaceholder")} rows={2} className="px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text resize-y" />
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary">
        <Plus size={12} />
        {t("addRoute")}
      </button>
      {routes.length < 2 && <p className="mt-1.5 text-[10px] text-amber-400">{t("routesMin")}</p>}
    </div>
  );
}

function ArgsEditor({ args, onChange, upstreamNodes, t }) {
  const entries = Object.entries(args || {});
  const update = (key, newKey, value) => {
    const next = {};
    for (const [k, v] of entries) next[k === key ? newKey : k] = k === key ? value : v;
    onChange(next);
  };
  const updateValue = (key, value) => onChange({ ...args, [key]: value });
  const remove = (key) => {
    const next = { ...args };
    delete next[key];
    onChange(next);
  };
  const add = () => onChange({ ...args, "": "" });

  return (
    <div>
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("args")}</label>
      <div className="flex flex-col gap-2">
        {entries.map(([key, value], i) => (
          <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
            <div className="flex gap-1.5 items-center">
              <input value={key} onChange={(e) => update(key, e.target.value, value)} placeholder={t("argKey")} className="w-1/3 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text" />
              <input value={value ?? ""} onChange={(e) => updateValue(key, e.target.value)} placeholder={t("argValue")} className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text" />
              <button type="button" onClick={() => remove(key)} title={t("removeArg")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
            {upstreamNodes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {upstreamNodes.map((n) => (
                  <button key={n.id} type="button" onClick={() => updateValue(key, `${value || ""}{{${n.id}.output}}`)} className="px-1.5 py-0.5 text-[10px] font-mono rounded-md th-bg-elevated hover:th-bg-surface-hover th-text-faint border th-border-secondary">
                    {n.label || n.id}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary">
        <Plus size={12} />
        {t("addArg")}
      </button>
    </div>
  );
}

/** Key/value editor for the http node's headers: flags Authorization/Proxy-Authorization/Cookie/X-Api-Key (any case) inline, since those can only ever carry a secret. */
function HttpHeadersEditor({ headers, onChange, t }) {
  const update = (i, patch) => {
    const next = headers.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i) => onChange(headers.filter((_, idx) => idx !== i));
  const add = () => onChange([...headers, { key: "", value: "" }]);

  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("httpHeaders")}</label>
      <div className="flex flex-col gap-2">
        {headers.map((h, i) => {
          const forbidden = isHttpHeaderForbidden(h?.key);
          return (
            <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
              <div className="flex gap-1.5 items-center">
                <input
                  value={h.key || ""}
                  onChange={(e) => update(i, { key: e.target.value })}
                  placeholder={t("httpHeaderKey")}
                  className={`w-1/3 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border ${forbidden ? "border-red-500/60" : "th-border-secondary"} th-text`}
                />
                <input value={h.value || ""} onChange={(e) => update(i, { value: e.target.value })} placeholder={t("httpHeaderValue")} className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text" />
                <button type="button" onClick={() => remove(i)} title={t("removeArg")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
              {forbidden && <p className="text-[10px] text-red-400">{t("httpHeaderForbidden", { key: h.key })}</p>}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={add} className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary">
        <Plus size={12} />
        {t("addHeader")}
      </button>
    </div>
  );
}

/** Email recipients for the notification node: add/remove, capped at NOTIFICATION_MAX_RECIPIENTS. */
function NotificationRecipientsEditor({ to, onChange, t }) {
  const update = (i, value) => {
    const next = to.slice();
    next[i] = value;
    onChange(next);
  };
  const remove = (i) => onChange(to.filter((_, idx) => idx !== i));
  const add = () => onChange([...to, ""]);

  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("notificationRecipients")}</label>
      <div className="flex flex-col gap-1.5">
        {to.map((r, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={r}
              onChange={(e) => update(i, e.target.value)}
              placeholder={t("notificationRecipientPlaceholder")}
              className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text"
            />
            <button type="button" onClick={() => remove(i)} title={t("removeArg")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={to.length >= NOTIFICATION_MAX_RECIPIENTS}
        className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary disabled:opacity-40"
      >
        <Plus size={12} />
        {t("notificationAddRecipient")}
      </button>
      {to.length === 0 && <p className="mt-1.5 text-[10px] text-amber-400">{t("notificationRecipientsMin")}</p>}
    </div>
  );
}

/**
 * Right-hand contextual inspector. `node`/`edge` come from the parent
 * already resolved from the selection; `onPatchConfig` merges a partial
 * config object (shallow) — callers that need to replace a whole sub-object
 * (rules/routes/body) pass it wholesale as one key.
 */
export default function StudioInspector({
  selection,
  nodes,
  edges,
  agentOptions = [],
  toolOptions = [],
  onChangeLabel,
  onRenameNode,
  onPatchConfig,
  onChangeEdgeRoute,
  onDeleteNode,
  onDeleteEdge,
  onOpenLoopBody,
}) {
  const t = useTranslations("WorkflowInspector");

  // Reused across the early returns below, so declared unconditionally
  // (rules of hooks) rather than inside the `node.type === "notification"`
  // branch further down.
  const notificationTeamsChannel =
    selection?.kind === "node" &&
    selection.node?.type === "notification" &&
    selection.node?.data?.config?.channel === "teams";
  const [teamsWebhookConfigured, setTeamsWebhookConfigured] = useState(null);

  useEffect(() => {
    if (!notificationTeamsChannel) {
      setTeamsWebhookConfigured(null); // eslint-disable-line react-hooks/set-state-in-effect -- resets status when the selection changes away from the teams channel
      return;
    }
    let cancelled = false;
    Promise.resolve(getTeamsWebhookStatus())
      .then((res) => {
        if (cancelled) return;
        setTeamsWebhookConfigured(typeof res?.configured === "boolean" ? res.configured : null);
      })
      .catch(() => {
        if (!cancelled) setTeamsWebhookConfigured(null);
      });
    return () => {
      cancelled = true;
    };
  }, [notificationTeamsChannel]);

  if (!selection) {
    return (
      <div className="w-80 shrink-0 border-l th-border-secondary th-bg-sidebar p-4 hidden xl:flex flex-col items-center justify-center text-center h-full">
        <p className="text-sm font-semibold th-text-secondary mb-1">{t("emptyTitle")}</p>
        <p className="text-xs th-text-ghost">{t("emptyBody")}</p>
      </div>
    );
  }

  if (selection.kind === "edge") {
    const edge = selection.edge;
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const routes = routesOf(sourceNode);
    return (
      <div className="w-80 shrink-0 border-l th-border-secondary th-bg-sidebar p-4 overflow-y-auto h-full max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:shadow-2xl max-xl:bg-[var(--bg-modal)]">
        <h3 className="text-sm font-bold th-text mb-3">{t("edgeTitle")}</h3>
        <Field label={t("edgeFrom")}><TextInput value={edge.source} disabled /></Field>
        <Field label={t("edgeTo")}><TextInput value={edge.target} disabled /></Field>
        {routes ? (
          <Field label={t("edgeRoute")}>
            <SelectInput value={edge.data?.route || ""} onChange={(e) => onChangeEdgeRoute(edge.id, e.target.value)}>
              <option value="">{t("edgeRoutePlaceholder")}</option>
              {routes.map((r) => <option key={r} value={r}>{r}</option>)}
            </SelectInput>
          </Field>
        ) : (
          <Field label={t("edgeRoute")}>
            <TextInput value={edge.data?.route || ""} onChange={(e) => onChangeEdgeRoute(edge.id, e.target.value)} />
          </Field>
        )}
        <DeleteButton onClick={() => onDeleteEdge(edge.id)} label={t("deleteEdge")} />
      </div>
    );
  }

  const node = selection.node;
  const config = node.data.config || {};
  const upstreamIds = getUpstreamNodeIds(node.id, edges);
  const upstreamNodes = upstreamIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean);
  const patch = (partial) => onPatchConfig(node.id, partial);

  return (
    <div className="w-80 shrink-0 border-l th-border-secondary th-bg-sidebar p-4 overflow-y-auto h-full max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:shadow-2xl max-xl:bg-[var(--bg-modal)]">
      <h3 className="text-sm font-bold th-text mb-3">{t("title")}</h3>
      <NodeIdField key={node.id} nodeId={node.id} existingIds={nodes.map((n) => n.id)} onRename={onRenameNode} t={t} />
      <Field label={t("label")}>
        <TextInput value={node.data.label || ""} onChange={(e) => onChangeLabel(node.id, e.target.value)} placeholder={t("labelPlaceholder")} />
      </Field>

      {node.type === "trigger" && (
        <>
          <Field label={t("triggerKind")}>
            <SelectInput value={config.kind || "manual"} onChange={(e) => patch({ kind: e.target.value })}>
              <option value="manual">{t("triggerKindManual")}</option>
            </SelectInput>
          </Field>
          <Field label={t("samplePayload")} help={t("samplePayloadHelp")}>
            <JsonField value={config.sample_payload} onChange={(v) => patch({ sample_payload: v })} t={t} />
          </Field>
        </>
      )}

      {node.type === "agent" && (
        <>
          <Field label={t("agentLabel")}>
            {agentOptions.length === 0 ? (
              <p className="text-xs th-text-ghost">{t("agentNone")}</p>
            ) : (
              <SelectInput value={config.agent_id || ""} onChange={(e) => patch({ agent_id: e.target.value })}>
                <option value="">{t("agentPlaceholder")}</option>
                {agentOptions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </SelectInput>
            )}
          </Field>
          <Field label={t("input")} help={t("inputHelp")}>
            <TemplateInput value={config.input} onChange={(v) => patch({ input: v })} upstreamNodes={upstreamNodes} multiline t={t} />
          </Field>
        </>
      )}

      {node.type === "tool" && (
        <>
          {toolOptions.length === 0 ? (
            <Field label={t("toolLabel")}>
              <p className="text-xs th-text-ghost">{t("toolNone")}</p>
            </Field>
          ) : (
            <ToolPicker value={config.tool} options={toolOptions} onChange={(tool) => patch({ tool })} t={t} />
          )}
          <ArgsEditor args={config.args} onChange={(args) => patch({ args })} upstreamNodes={upstreamNodes} t={t} />
        </>
      )}

      {node.type === "router" && (
        <RulesEditor rules={config.rules || []} defaultRoute={config.default_route} onChange={(v) => patch(v)} t={t} />
      )}

      {node.type === "classifier" && (
        <>
          <Field label={t("agentLabel")} help={t("classifierAgentHelp")}>
            {agentOptions.length === 0 ? (
              <p className="text-xs th-text-ghost">{t("agentNone")}</p>
            ) : (
              <SelectInput value={config.agent_id || ""} onChange={(e) => patch({ agent_id: e.target.value })}>
                <option value="">{t("agentPlaceholder")}</option>
                {agentOptions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </SelectInput>
            )}
          </Field>
          <RoutesEditor routes={config.routes || []} onChange={(routes) => patch({ routes })} t={t} />
        </>
      )}

      {node.type === "merge" && <p className="text-xs th-text-ghost">{t("mergeHelp")}</p>}

      {node.type === "convert" && (
        <>
          <Field label={t("convertTo")}>
            <SelectInput value={config.to || "text"} onChange={(e) => patch({ to: e.target.value })}>
              {CONVERT_TARGETS.map((to) => <option key={to} value={to}>{t(`convertTo_${to}`)}</option>)}
            </SelectInput>
          </Field>
          <Field label={t("convertInput")} help={t("convertInputHelp")}>
            <TemplateInput value={config.input} onChange={(v) => patch({ input: v || undefined })} upstreamNodes={upstreamNodes} t={t} />
          </Field>
        </>
      )}

      {node.type === "output" && (
        <Field label={t("outputValue")} help={t("outputValueHelp")}>
          <TemplateInput value={config.value} onChange={(v) => patch({ value: v || undefined })} upstreamNodes={upstreamNodes} multiline t={t} />
        </Field>
      )}

      {node.type === "http" && (
        <>
          <Field label={t("httpMethod")}>
            <SelectInput value={config.method || "GET"} onChange={(e) => patch({ method: e.target.value })}>
              {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </SelectInput>
          </Field>
          <Field label={t("httpUrl")} help={t("httpUrlHelp")}>
            <TemplateInput value={config.url} onChange={(v) => patch({ url: v })} placeholder={t("httpUrlPlaceholder")} upstreamNodes={upstreamNodes} t={t} />
          </Field>
          <HttpHeadersEditor headers={config.headers || []} onChange={(headers) => patch({ headers })} t={t} />
          {HTTP_METHODS_WITH_BODY.has(config.method || "GET") && (
            <Field label={t("httpBody")} help={t("httpBodyHelp")}>
              <TemplateInput value={config.body} onChange={(v) => patch({ body: v || undefined })} multiline upstreamNodes={upstreamNodes} t={t} />
            </Field>
          )}
          <Field label={t("httpTimeout")} help={t("httpTimeoutHelp")}>
            <TextInput
              type="number"
              min={1}
              max={30}
              value={config.timeout_s ?? ""}
              onChange={(e) => patch({ timeout_s: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </Field>
        </>
      )}

      {node.type === "notification" && (
        <>
          <Field label={t("notificationChannel")}>
            <SelectInput value={config.channel || "app"} onChange={(e) => patch({ channel: e.target.value })}>
              {NOTIFICATION_CHANNELS.map((c) => <option key={c} value={c}>{t(`notificationChannel_${c}`)}</option>)}
            </SelectInput>
          </Field>
          {config.channel === "email" && (
            <>
              <NotificationRecipientsEditor to={config.to || []} onChange={(to) => patch({ to })} t={t} />
              <Field label={t("notificationSubject")}>
                <TextInput value={config.subject || ""} onChange={(e) => patch({ subject: e.target.value })} />
              </Field>
              <Field label={t("notificationBody")}>
                <TemplateInput value={config.body} onChange={(v) => patch({ body: v })} multiline upstreamNodes={upstreamNodes} t={t} />
              </Field>
            </>
          )}
          {config.channel === "teams" && (
            <>
              <Field label={t("notificationSubject")}>
                <TextInput value={config.subject || ""} onChange={(e) => patch({ subject: e.target.value })} />
              </Field>
              <Field label={t("notificationBody")}>
                <TemplateInput value={config.body} onChange={(v) => patch({ body: v })} multiline upstreamNodes={upstreamNodes} t={t} />
              </Field>
              <p className="text-xs th-text-ghost">{t("notificationTeamsHelp")}</p>
              {teamsWebhookConfigured === false && (
                <p className="text-xs text-amber-400 mt-1">
                  {t("notificationTeamsWebhookMissing")}{" "}
                  <Link href="/integrations" className="underline">
                    {t("notificationTeamsWebhookMissingLink")}
                  </Link>
                </p>
              )}
            </>
          )}
          {(config.channel || "app") === "app" && <p className="text-xs th-text-ghost">{t("notificationAppHelp")}</p>}
        </>
      )}

      {node.type === "loop" && (
        <>
          <Field label={t("loopMode")}>
            <SelectInput value={config.mode || "foreach"} onChange={(e) => patch({ mode: e.target.value })}>
              <option value="foreach">{t("loopModeForeach")}</option>
              <option value="until">{t("loopModeUntil")}</option>
            </SelectInput>
          </Field>
          <Field label={t("loopMaxIterations")} help={t("loopMaxIterationsHelp")}>
            <TextInput
              type="number"
              min={1}
              max={100}
              value={config.max_iterations ?? ""}
              onChange={(e) => patch({ max_iterations: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </Field>
          {config.mode === "until" ? (
            <>
              <Field label={t("loopUntilField")}>
                <TextInput
                  value={config.until?.field || ""}
                  onChange={(e) => patch({ until: { ...config.until, field: e.target.value } })}
                  placeholder={t("loopUntilFieldPlaceholder")}
                />
              </Field>
              <Field label={t("loopUntilOp")}>
                <SelectInput value={config.until?.op || "eq"} onChange={(e) => patch({ until: { ...config.until, op: e.target.value } })}>
                  {LOOP_OPERATORS.map((op) => (
                    <option key={op} value={op}>{t(`op${op.charAt(0).toUpperCase()}${op.slice(1)}`)}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={t("loopUntilValue")}>
                <TextInput value={config.until?.value ?? ""} onChange={(e) => patch({ until: { ...config.until, value: e.target.value } })} />
              </Field>
            </>
          ) : (
            <Field label={t("loopItems")} help={t("loopItemsHelp")}>
              <TemplateInput value={config.items} onChange={(v) => patch({ items: v })} placeholder={t("loopItemsPlaceholder")} upstreamNodes={upstreamNodes} t={t} />
            </Field>
          )}
          <Field label={t("loopBody")} help={t("loopBodyHelp")}>
            <button
              type="button"
              onClick={() => onOpenLoopBody(node.id)}
              className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary"
            >
              {t("loopBodyOpen")}
              <ChevronRight size={14} />
            </button>
          </Field>
        </>
      )}

      {node.type === "approval" && <p className="text-xs th-text-ghost">{t("soonHelp")}</p>}

      <DeleteButton onClick={() => onDeleteNode(node.id)} label={t("deleteNode")} />
    </div>
  );
}

function routesOf(sourceNode) {
  if (!sourceNode) return null;
  const cfg = sourceNode.data?.config || {};
  if (sourceNode.type === "router") {
    const routes = new Set((cfg.rules || []).map((r) => r.route).filter(Boolean));
    if (cfg.default_route) routes.add(cfg.default_route);
    return [...routes];
  }
  if (sourceNode.type === "classifier") {
    return (cfg.routes || []).map((r) => r.route).filter(Boolean);
  }
  return null;
}
