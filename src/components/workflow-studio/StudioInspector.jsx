"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { useTranslations } from "use-intl";
import { insertFieldPatch, effectfulBodyNodes } from "@/lib/workflowShapes";
import UpstreamShapeHint, { TestUntilButton } from "./UpstreamShapeHint";
import { getToolCategoryLogo, isProviderLogo } from "@/components/icons/integrationLogos";
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
  EXTRACT_FIELD_TYPES,
  CLASSIFIER_ENGINES,
  UNCERTAIN_ROUTE,
  JEV_MIN_CONFIDENCE_DEFAULT,
  DB_WRITE_CONNECTION_PATTERN,
  RAG_TOP_K_MIN,
  RAG_TOP_K_MAX,
  TRY_ROUTES,
  TRY_RETRIES_CAP,
  TRY_RETRY_DELAY_MS_CAP,
  CONDITION_ROUTES,
  approvalRoutes,
  onErrorModesFor,
  routesOnError,
  ERROR_ROUTE,
  NODE_TIMEOUT_TYPES,
  NODE_TIMEOUT_MIN,
  NODE_TIMEOUT_MAX,
  nodeIdRenameError,
  filterToolOptions,
  groupToolOptions,
} from "@/lib/workflowGraph";
import TriggerInspector from "./TriggerInspector";
import ApprovalInspector from "./ApprovalInspector";
import NodeUsageHelp from "./NodeUsageHelp";
import { templateExamplesFor } from "@/lib/templateExamples";
import { missingRefs } from "@/lib/availableData";
import AvailableDataPanel, { InputPreview } from "./AvailableDataPanel";
import { getTeamsWebhookStatus } from "@/lib/api";
import { Link } from "@/lib/navigation";

const ROUTER_OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in", "exists"];

// The label wraps its control (rather than a sibling `htmlFor`/`id` pair) so
// every field is accessibly labeled — and findable by `getByLabelText` in
// tests — without hand-generating a unique id per input.
// Exported: TriggerInspector.jsx reuses these three primitives so the 8
// trigger-kind forms look exactly like the rest of the inspector instead of
// duplicating their Tailwind classes.
export function Field({ label, help, children }) {
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

export function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand"
    />
  );
}

export function SelectInput({ children, ...props }) {
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

/**
 * Shared by every template field of the inspected node: the outputs its
 * upstream nodes produced in the last test run (for the orange warning) and
 * `setActive`, so the field last focused receives what the "Available data"
 * panel inserts.
 */
const TemplateFieldContext = createContext({ outputs: {}, setActive: () => {} });

/** Registers a field as the panel's insertion target when it gets the focus. */
function useActiveTemplateField(ref, value, onChange) {
  const { setActive } = useContext(TemplateFieldContext);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });
  return () => setActive({ ref, latest });
}

/** References the last test run would not resolve, in orange under the field. */
function MissingRefsWarning({ value, t }) {
  const { outputs } = useContext(TemplateFieldContext);
  const missing = missingRefs(value, outputs);
  if (missing.length === 0) return null;
  return (
    <div className="mt-1">
      {missing.map((ref) => (
        <p key={ref.raw} className="text-[10px] text-amber-400">
          {t(ref.scalar ? "templateRefThroughText" : "templateRefMissing", { ref: ref.raw, node: ref.nodeId })}
        </p>
      ))}
    </div>
  );
}

/**
 * "Examples" menu of a template field: ready-made values built from the
 * nearest upstream node (see lib/templateExamples). Picking one fills an
 * empty field, or is appended after the text already there.
 */
function TemplateExamples({ kind, upstreamNodes, onPick, t }) {
  const [open, setOpen] = useState(false);
  const examples = templateExamplesFor(kind, upstreamNodes, (key) => t.raw(key));
  if (examples.length === 0) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={open}
        title={t("templateExamplesHelp")}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-md th-text-brand hover:th-bg-surface-hover"
      >
        {t("templateExamples")}
        <ChevronDown size={10} aria-hidden="true" className={open ? "rotate-180" : undefined} />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 rounded-lg border th-border-secondary th-bg-elevated p-1.5">
          <p className="text-[10px] th-text-ghost">{t("templateExamplesHelp")}</p>
          {examples.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                onPick(ex.snippet);
                setOpen(false);
              }}
              className="text-left px-1.5 py-1 rounded-md hover:th-bg-surface-hover"
            >
              <span className="block text-[11px] font-semibold th-text">{t(ex.labelKey)}</span>
              <span className="block text-[10px] font-mono th-text-faint whitespace-pre-wrap break-all">{ex.snippet}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A text input/textarea plus one-click `{{node...}}` chips for every
 * upstream node, and an optional "Examples" menu (`examples` = field kind). `numeric` only hints the on-screen keyboard/font — the
 * value stays free text so a `{{node.output}}` template still fits, which
 * is why a tool's number/integer arguments use this instead of `type="number"`.
 */
export function TemplateInput({ value, onChange, placeholder, upstreamNodes, multiline, numeric, examples, t }) {
  const ref = useRef(null);
  const activate = useActiveTemplateField(ref, value, onChange);
  const suggestions = upstreamNodes.flatMap((n) => templateSuggestionsFor(n).slice(0, 1).map((snippet) => ({ node: n, snippet })));
  const Comp = multiline ? "textarea" : "input";
  return (
    <div>
      <Comp
        ref={ref}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={activate}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        inputMode={!multiline && numeric ? "decimal" : undefined}
        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand resize-y"
      />
      <MissingRefsWarning value={value} t={t} />
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
      {examples && (
        <TemplateExamples
          kind={examples}
          upstreamNodes={upstreamNodes}
          onPick={(snippet) => onChange((value || "") + snippet)}
          t={t}
        />
      )}
      {upstreamNodes.length === 0 && (
        <p className="mt-1 text-[10px] th-text-ghost">{t("upstreamValuesEmpty")}</p>
      )}
    </div>
  );
}

function ArgValueInput({ value, onChange, placeholder }) {
  const ref = useRef(null);
  const activate = useActiveTemplateField(ref, value, onChange);
  return (
    <input
      ref={ref}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onFocus={activate}
      placeholder={placeholder}
      className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text"
    />
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

/**
 * Tool select with a search box: the catalogue runs to hundreds of entries.
 * Options are grouped into the caller's own configurations, catalog tools
 * ready to use, and catalog tools that still need a configuration (see
 * groupToolOptions) - the last group is collapsed by default, since it's
 * usually the biggest and rarely what someone is looking for, and links to
 * the Tool Box instead of duplicating its setup flow here.
 */
function ToolPicker({ value, options, onChange, t }) {
  const [query, setQuery] = useState("");
  const [needsConfigOpen, setNeedsConfigOpen] = useState(false);
  const filtered = filterToolOptions(options, query);
  const selected = options.find((o) => o.value === value);
  const shown = selected && !filtered.includes(selected) ? [selected, ...filtered] : filtered;
  const { configured, ready, needsConfig } = groupToolOptions(shown);
  const hasQuery = query.trim() !== "";
  // A live search should surface its own matches even while the group is
  // collapsed; leaving the query empty restores the default collapsed view.
  const needsConfigVisible = needsConfigOpen || (hasQuery && needsConfig.length > 0);
  const needsConfigShown = needsConfigVisible ? needsConfig : needsConfig.filter((tool) => tool === selected);

  // Native <option> elements cannot render markup (a logo) in any browser,
  // so the per-tool provider logo (apowerb roadmap #103) is shown next to
  // the select instead, reflecting whichever tool is currently chosen.
  // getToolCategoryLogo is a pure lookup into a fixed, module-level table
  // (see integrationLogos.jsx) — it always returns the same stable
  // component reference for a given category, never a freshly created
  // component, so rendering it below doesn't remount on every render
  // despite the static-components rule's heuristic (it can't verify
  // that a call expression's result is a stable reference).
  const SelectedLogo = getToolCategoryLogo(selected?.category);
  const brandLogo = isProviderLogo(SelectedLogo);
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
        <div className="flex items-center gap-2">
          <span
            data-testid="tool-picker-logo"
            data-variant={brandLogo ? "logo" : "plain"}
            className={`shrink-0 w-7 h-7 rounded-md border th-border-secondary flex items-center justify-center ${brandLogo ? "bg-white" : "th-bg-surface"}`}
          >
            {/* eslint-disable-next-line react-hooks/static-components -- stable lookup, see comment above */}
            <SelectedLogo size={brandLogo ? 18 : 14} />
          </span>
          <SelectInput value={value || ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">{t("toolPlaceholder")}</option>
            {configured.length > 0 && (
              <optgroup label={t("toolGroupConfigured")}>
                {configured.map((tool) => <option key={tool.value} value={tool.value}>{tool.label}</option>)}
              </optgroup>
            )}
            {ready.length > 0 && (
              <optgroup label={t("toolGroupReady")}>
                {ready.map((tool) => <option key={tool.value} value={tool.value}>{tool.label}</option>)}
              </optgroup>
            )}
            {needsConfig.length > 0 && (
              <optgroup label={t("toolGroupNeedsConfig")}>
                {needsConfigShown.map((tool) => <option key={tool.value} value={tool.value}>{tool.label}</option>)}
              </optgroup>
            )}
          </SelectInput>
        </div>
      </Field>
      {needsConfig.length > 0 && (
        <div className="-mt-2 mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-expanded={needsConfigVisible}
            onClick={() => setNeedsConfigOpen((o) => !o)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-md th-text-brand hover:th-bg-surface-hover"
          >
            {t("toolGroupNeedsConfig")} ({needsConfig.length})
            <ChevronDown size={10} aria-hidden="true" className={needsConfigVisible ? "rotate-180" : undefined} />
          </button>
          <Link href="/tool-box" className="text-[10px] th-text-ghost underline">
            {t("toolGroupNeedsConfigLink")}
          </Link>
        </div>
      )}
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

/**
 * The field/operator/value trio shared by every rule-based editor (router's
 * routing rules, a condition's boolean rules). Router rules also carry a
 * `route` name; that extra input is rendered by the caller, right after this.
 */
function RuleFieldOpValueRow({ rule, onChange, onRemove, t }) {
  return (
    <>
      <div className="flex gap-1.5">
        <input value={rule.field || ""} onChange={(e) => onChange({ field: e.target.value })} placeholder={t("ruleFieldPlaceholder")} className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text" />
        <button type="button" onClick={onRemove} title={t("removeRule")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex gap-1.5">
        <select value={rule.op || "eq"} onChange={(e) => onChange({ op: e.target.value })} className="px-1.5 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text">
          {ROUTER_OPS.map((op) => (
            <option key={op} value={op}>{t(`op${op.charAt(0).toUpperCase()}${op.slice(1)}`)}</option>
          ))}
        </select>
        <input value={rule.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} placeholder={t("ruleValue")} className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text" />
      </div>
    </>
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
            <RuleFieldOpValueRow rule={rule} onChange={(patch) => update(i, patch)} onRemove={() => remove(i)} t={t} />
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

/** A condition node's rules: same field/op/value trio as the router, but no per-rule route — the two outputs are the fixed `true`/`false` routes, combined by `match`. */
function ConditionRulesEditor({ rules, match, onChange, t }) {
  const update = (i, patch) => {
    const next = rules.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ rules: next, match });
  };
  const remove = (i) => onChange({ rules: rules.filter((_, idx) => idx !== i), match });
  const add = () => onChange({ rules: [...rules, { field: "", op: "eq", value: "" }], match });

  return (
    <div>
      <Field label={t("conditionMatch")}>
        <SelectInput value={match || "all"} onChange={(e) => onChange({ rules, match: e.target.value })}>
          <option value="all">{t("conditionMatchAll")}</option>
          <option value="any">{t("conditionMatchAny")}</option>
        </SelectInput>
      </Field>
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("rulesTitle")}</label>
      <div className="flex flex-col gap-2">
        {rules.map((rule, i) => (
          <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
            <RuleFieldOpValueRow rule={rule} onChange={(patch) => update(i, patch)} onRemove={() => remove(i)} t={t} />
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary">
        <Plus size={12} />
        {t("addRule")}
      </button>
      {rules.length === 0 && <p className="mt-1.5 text-[10px] text-amber-400">{t("conditionRulesMin")}</p>}
    </div>
  );
}

/** A set node's `key -> value` fields: an array (not a plain object like ArgsEditor's tool args) so duplicate keys can be typed and then flagged by validation instead of silently overwriting each other. */
function SetFieldsEditor({ fields, onChange, upstreamNodes, t }) {
  const update = (i, patch) => {
    const next = fields.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i) => onChange(fields.filter((_, idx) => idx !== i));
  const add = () => onChange([...fields, { key: "", value: "" }]);

  return (
    <div>
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("setFields")}</label>
      <div className="flex flex-col gap-2">
        {fields.map((f, i) => (
          <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
            <div className="flex gap-1.5 items-center">
              <input value={f.key || ""} onChange={(e) => update(i, { key: e.target.value })} placeholder={t("setFieldKeyPlaceholder")} className="w-1/3 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text" />
              <input value={f.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} placeholder={t("setFieldValuePlaceholder")} className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text" />
              <button type="button" onClick={() => remove(i)} title={t("removeField")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
            {upstreamNodes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {upstreamNodes.map((n) => (
                  <button key={n.id} type="button" onClick={() => update(i, { value: `${f.value || ""}{{${n.id}.output}}` })} className="px-1.5 py-0.5 text-[10px] font-mono rounded-md th-bg-elevated hover:th-bg-surface-hover th-text-faint border th-border-secondary">
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
        {t("addField")}
      </button>
      {fields.length === 0 && <p className="mt-1.5 text-[10px] text-amber-400">{t("setFieldsMin")}</p>}
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

/**
 * Decimal input that keeps what is typed ("0." on the way to "0.9") and only
 * reports parsed numbers; an empty box reports `undefined` (key removed).
 */
function DecimalInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  return (
    <TextInput
      {...props}
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === "") return onCommit(undefined);
        const n = Number(raw.replace(",", "."));
        if (Number.isFinite(n)) onCommit(n);
      }}
    />
  );
}

/** Column -> value template rows of a db_write node; order is kept, a clashing column name is ignored. */
function DbWriteValuesEditor({ values, onChange, t }) {
  const entries = Object.entries(values || {});
  const commit = (next) => onChange(Object.fromEntries(next));
  const rename = (i, key) => {
    if (entries.some(([k], idx) => idx !== i && k === key)) return;
    commit(entries.map((e, idx) => (idx === i ? [key, e[1]] : e)));
  };
  const setValue = (i, value) => commit(entries.map((e, idx) => (idx === i ? [e[0], value] : e)));
  const add = () => {
    let name = "column";
    for (let n = 2; entries.some(([k]) => k === name); n += 1) name = `column${n}`;
    commit([...entries, [name, ""]]);
  };
  return (
    <div className="mb-3">
      <span className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("dbWriteValues")}</span>
      <div className="flex flex-col gap-2">
        {entries.map(([col, val], i) => (
          <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <input
                value={col}
                onChange={(e) => rename(i, e.target.value)}
                placeholder={t("dbWriteColumnPlaceholder")}
                aria-label={t("dbWriteColumn")}
                className="flex-1 min-w-0 px-2 py-1 text-[11px] font-semibold rounded-md th-bg-elevated border th-border-secondary th-text"
              />
              <button type="button" onClick={() => commit(entries.filter((_, idx) => idx !== i))} title={t("removeDbWriteColumn")} aria-label={t("removeDbWriteColumn")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
            <input
              value={typeof val === "string" ? val : JSON.stringify(val)}
              onChange={(e) => setValue(i, e.target.value)}
              placeholder={t("dbWriteValuePlaceholder")}
              aria-label={t("dbWriteValue")}
              className="px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text"
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary">
        <Plus size={12} />
        {t("addDbWriteColumn")}
      </button>
      <p className="mt-1.5 text-[10px] th-text-ghost">{t("dbWriteValuesHelp")}</p>
    </div>
  );
}

/** Add/remove editor for an extract node's declared fields: name, type, description, required. */
function ExtractFieldsEditor({ fields, onChange, t }) {
  const update = (i, patch) => {
    const next = fields.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i) => onChange(fields.filter((_, idx) => idx !== i));
  const add = () => onChange([...fields, { name: "", type: "string", description: "", required: false }]);

  return (
    <div>
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("extractFieldsTitle")}</label>
      <div className="flex flex-col gap-2">
        {fields.map((f, i) => (
          <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <input
                value={f.name || ""}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder={t("extractFieldNamePlaceholder")}
                aria-label={t("extractFieldName")}
                className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text"
              />
              <select
                value={f.type || "string"}
                onChange={(e) => update(i, { type: e.target.value })}
                aria-label={t("extractFieldType")}
                className="px-1.5 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text"
              >
                {EXTRACT_FIELD_TYPES.map((type) => <option key={type} value={type}>{t(`extractFieldType_${type}`)}</option>)}
              </select>
              <button type="button" onClick={() => remove(i)} title={t("removeField")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
            <textarea
              value={f.description || ""}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder={t("extractFieldDescriptionPlaceholder")}
              aria-label={t("extractFieldDescription")}
              rows={2}
              className="px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text resize-y"
            />
            <label className="flex items-center gap-1.5 text-[11px] th-text-secondary">
              <input type="checkbox" checked={!!f.required} onChange={(e) => update(i, { required: e.target.checked })} />
              {t("extractFieldRequired")}
            </label>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary">
        <Plus size={12} />
        {t("addExtractField")}
      </button>
      {(fields.length < 1 || fields.length > 30) && <p className="mt-1.5 text-[10px] text-amber-400">{t("extractFieldsCountHelp")}</p>}
    </div>
  );
}

function ArgsEditor({ args, onChange, upstreamNodes, t, titleKey = "args" }) {
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
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t(titleKey)}</label>
      <div className="flex flex-col gap-2">
        {entries.map(([key, value], i) => (
          <div key={i} className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
            <div className="flex gap-1.5 items-center">
              <input value={key} onChange={(e) => update(key, e.target.value, value)} placeholder={t("argKey")} className="w-1/3 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text" />
              <ArgValueInput value={value} onChange={(v) => updateValue(key, v)} placeholder={t("argValue")} />
              <button type="button" onClick={() => remove(key)} title={t("removeArg")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
            <MissingRefsWarning value={value} t={t} />
            {upstreamNodes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {upstreamNodes.map((n) => (
                  <button key={n.id} type="button" onClick={() => updateValue(key, `${value || ""}${templateSuggestionsFor(n)[0]}`)} className="px-1.5 py-0.5 text-[10px] font-mono rounded-md th-bg-elevated hover:th-bg-surface-hover th-text-faint border th-border-secondary">
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

/** Binary on/off control for a boolean tool argument — always writes an explicit `true`/`false`. */
function BooleanSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-brand ${checked ? "bg-brand border-brand" : "th-bg-surface th-border-secondary"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-1"}`}
      />
    </button>
  );
}

// A whole value that is nothing but one `{{...}}` template — the only shape
// a template can take inside an array/object/any argument, since the rest
// of that value has to be valid JSON.
const WHOLE_TEMPLATE_RE = /^\{\{[^{}]+\}\}$/;

/**
 * JSON textarea for a tool argument typed array/object/any: same buffered-text
 * pattern as `JsonField` (typing invalid JSON never corrupts the saved
 * config), plus one extra accepted shape — the whole field can also be a
 * single `{{node.output}}` template, kept as a raw string for the run-time
 * template engine to resolve.
 */
function ToolJsonOrTemplateField({ value, onChange, t }) {
  const stringify = (v) => (v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 2));
  const [text, setText] = useState(() => stringify(value));
  const [error, setError] = useState(null);
  // Same "adjust state when a prop changes" pattern as JsonField: a value
  // coming from outside (undo, other node) resets the buffer during render.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(stringify(value));
    setError(null);
  }

  const handleChange = (raw) => {
    setText(raw);
    const trimmed = raw.trim();
    if (trimmed === "") {
      setError(null);
      setSyncedValue(undefined);
      onChange(undefined);
      return;
    }
    if (WHOLE_TEMPLATE_RE.test(trimmed)) {
      setError(null);
      setSyncedValue(trimmed);
      onChange(trimmed);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setError(null);
      setSyncedValue(parsed);
      onChange(parsed);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <textarea
        value={text}
        rows={4}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg th-bg-surface border ${error ? "border-red-500/60" : "th-border-secondary"} th-text resize-y focus:outline-none focus:ring-1 focus:ring-brand`}
      />
      {error && <p className="mt-1 text-[10px] text-red-400">{t("invalidJson", { message: error })}</p>}
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
 * One field for one schema parameter. `enum` wins over `type` (a string
 * with a fixed set of values is still a dropdown), then dispatches on
 * `type`; anything outside the known families (an unlisted type) degrades
 * to a plain template text field rather than disappearing.
 */
function ToolArgField({ param, value, onChange, upstreamNodes, t }) {
  const label = param.required ? `${param.name} *` : param.name;
  const help = param.description || undefined;
  const hasDefault = param.default !== undefined && param.default !== null;
  const placeholder = hasDefault ? String(param.default) : undefined;

  if (Array.isArray(param.enum) && param.enum.length > 0) {
    return (
      <Field label={label} help={help}>
        <SelectInput value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">{hasDefault ? t("toolArgDefaultOption", { value: placeholder }) : t("toolArgUnsetOption")}</option>
          {param.enum.map((opt) => (
            <option key={String(opt)} value={opt}>{String(opt)}</option>
          ))}
        </SelectInput>
      </Field>
    );
  }

  if (param.type === "boolean") {
    return (
      <Field label={label} help={help}>
        <BooleanSwitch checked={Boolean(value ?? param.default ?? false)} onChange={onChange} />
      </Field>
    );
  }

  if (param.type === "array" || param.type === "object" || param.type === "any") {
    return (
      <Field label={label} help={help}>
        <ToolJsonOrTemplateField value={value} onChange={onChange} t={t} />
      </Field>
    );
  }

  return (
    <Field label={label} help={help}>
      <TemplateInput
        value={typeof value === "string" || value === undefined ? value : String(value)}
        onChange={onChange}
        placeholder={placeholder}
        upstreamNodes={upstreamNodes}
        numeric={param.type === "number" || param.type === "integer"}
        t={t}
      />
    </Field>
  );
}

/**
 * `config.args` entries the schema doesn't know about. A `tool_config`-style
 * tool that declared `accepts_kwargs` gets the free-form `ArgsEditor` for
 * them (they're legitimate, just not declared); otherwise each one is a
 * warning with a one-click way to drop it.
 */
function ExtraArgsSection({ args, schemaNames, acceptsKwargs, onChange, upstreamNodes, t }) {
  const extraEntries = Object.entries(args || {}).filter(([key]) => !schemaNames.has(key));
  if (extraEntries.length === 0) return null;

  if (acceptsKwargs) {
    const extraArgs = Object.fromEntries(extraEntries);
    const onExtraChange = (nextExtra) => {
      const next = { ...args };
      for (const [key] of extraEntries) delete next[key];
      onChange({ ...next, ...nextExtra });
    };
    return (
      <div className="mt-3 pt-3 border-t th-border-secondary">
        <ArgsEditor args={extraArgs} onChange={onExtraChange} upstreamNodes={upstreamNodes} t={t} titleKey="toolExtraArgsTitle" />
      </div>
    );
  }

  const removeArg = (key) => {
    const next = { ...args };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="mt-3 pt-3 border-t th-border-secondary flex flex-col gap-1.5">
      <label className="block text-[11px] font-semibold text-amber-400">{t("toolUnknownArgsTitle")}</label>
      {extraEntries.map(([key]) => (
        <div key={key} className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-2">
          <p className="text-[11px] th-text truncate">{t("toolUnknownArg", { value: key })}</p>
          <button type="button" onClick={() => removeArg(key)} title={t("removeArg")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Tool node body: the picker plus, once the schema for `config.tool` is
 * cached, a form generated from it instead of the free-form `ArgsEditor`.
 * `schemaEntry`/`ensureToolSchema` come from `useToolSchemas()`, lifted to
 * the studio so the cache survives re-selecting a node. Falls back to the
 * classic `ArgsEditor` whenever there's no usable schema — no tool picked
 * yet, still loading, or the fetch failed — so the node is always editable.
 */
// What an agent or tool node must return. "any" keeps the old behaviour;
// "json" stops the run when an agent answers in prose instead, so a later
// `{{id.field}}` never silently reads nothing.
const OUTPUT_TYPES = ["any", "text", "json"];

/**
 * What a node that can fail does when it does (`on_error`), its time limit
 * (`timeout_s`) and, for http, whether a 4xx/5xx answer is a failure.
 * `accept_error_status` is always written explicitly: a missing key means
 * "accept", the behaviour of nodes saved before the option.
 */
function ErrorHandlingFields({ type, config, patch, t }) {
  const modes = onErrorModesFor(type);
  return (
    <>
      {NODE_TIMEOUT_TYPES.has(type) && (
        <Field label={t("nodeTimeout")} help={t("nodeTimeoutHelp", { max: NODE_TIMEOUT_MAX })}>
          <TextInput
            type="number"
            min={NODE_TIMEOUT_MIN}
            max={NODE_TIMEOUT_MAX}
            value={config.timeout_s ?? ""}
            onChange={(e) => patch({ timeout_s: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </Field>
      )}
      {type === "http" && (
        <Field label={t("httpAcceptErrorStatus")} help={t("httpAcceptErrorStatusHelp")}>
          <BooleanSwitch checked={config.accept_error_status !== false} onChange={(v) => patch({ accept_error_status: v })} />
        </Field>
      )}
      <Field label={t("onError")} help={t("onErrorHelp")}>
        <SelectInput value={config.on_error || "fail"} onChange={(e) => patch({ on_error: e.target.value === "fail" ? undefined : e.target.value })}>
          {modes.map((m) => <option key={m} value={m}>{t(`onError_${m}`)}</option>)}
        </SelectInput>
      </Field>
    </>
  );
}

/** Each retry of a try runs its body again: the steps that reach outside the Studio happen once per attempt. */
function TryEffectsWarning({ body, retries, t }) {
  const effects = effectfulBodyNodes(body);
  if (!retries || effects.length === 0) return null;
  return (
    <div data-testid="try-effects-warning" className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
      <p className="font-semibold mb-1">{t("tryEffectsWarning", { count: retries + 1 })}</p>
      <ul className="list-disc pl-4">
        {effects.map((e) => (
          <li key={e.id}>
            {e.label} <span className="opacity-70">({t(`testUntilEffect_${e.type}`)})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Settings of the workflow itself, shown when nothing is selected. */
function WorkflowSettingsFields({ status, settings, onChange, t }) {
  // Unset: on once published, off on a draft — as the engine decides.
  const notify = settings?.notify_on_failure ?? status === "published";
  return (
    <div className="w-full text-left border-t th-border-secondary pt-3 mt-3">
      <p className="text-xs font-bold th-text mb-2">{t("workflowSettingsTitle")}</p>
      <Field label={t("notifyOnFailure")} help={t("notifyOnFailureHelp")}>
        <BooleanSwitch checked={notify} onChange={(v) => onChange({ ...(settings || {}), notify_on_failure: v })} />
      </Field>
    </div>
  );
}

function OutputTypeField({ config, patch, t }) {
  return (
    <Field label={t("outputType")} help={t("outputTypeHelp")}>
      <SelectInput value={config.output_type || "any"} onChange={(e) => patch({ output_type: e.target.value === "any" ? undefined : e.target.value })}>
        {OUTPUT_TYPES.map((v) => <option key={v} value={v}>{t(`outputType_${v}`)}</option>)}
      </SelectInput>
    </Field>
  );
}

function ToolArgsSection({ config, patch, toolOptions, schemaEntry, ensureToolSchema, upstreamNodes, t }) {
  useEffect(() => {
    if (config.tool) ensureToolSchema(config.tool);
  }, [config.tool, ensureToolSchema]);

  const args = config.args || {};
  const setArgs = (next) => patch({ args: next });
  const schema = schemaEntry?.status === "ready" ? schemaEntry.schema : null;
  const schemaNames = new Set((schema?.params || []).map((p) => p.name));

  const setArg = (name, value) => {
    const next = { ...args };
    const isEmpty = value === undefined || value === "" || (typeof value === "string" && value.trim() === "");
    if (isEmpty) delete next[name];
    else next[name] = value;
    setArgs(next);
  };

  return (
    <>
      {toolOptions.length === 0 ? (
        <Field label={t("toolLabel")}>
          <p className="text-xs th-text-ghost">{t("toolNone")}</p>
        </Field>
      ) : (
        <ToolPicker value={config.tool} options={toolOptions} onChange={(tool) => patch({ tool })} t={t} />
      )}

      {config.tool && schemaEntry?.status === "loading" && (
        <p className="mb-2 text-[10px] th-text-ghost">{t("toolSchemaLoading")}</p>
      )}
      {config.tool && schemaEntry?.status === "error" && (
        <p className="mb-2 text-[10px] th-text-ghost">{t("toolSchemaUnavailable")}</p>
      )}
      {schema?.needs_agent_context && (
        <p className="mb-2 text-[10px] text-amber-400">{t("toolNeedsAgentContext")}</p>
      )}

      {schema ? (
        <>
          {(schema.params || []).map((param) => (
            <ToolArgField key={param.name} param={param} value={args[param.name]} onChange={(v) => setArg(param.name, v)} upstreamNodes={upstreamNodes} t={t} />
          ))}
          <ExtraArgsSection
            args={args}
            schemaNames={schemaNames}
            acceptsKwargs={!!schema.accepts_kwargs}
            onChange={setArgs}
            upstreamNodes={upstreamNodes}
            t={t}
          />
        </>
      ) : (
        <ArgsEditor args={args} onChange={setArgs} upstreamNodes={upstreamNodes} t={t} />
      )}
    </>
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
  workflowId,
  triggerRefreshKey,
  toolSchemas = {},
  ensureToolSchema = () => {},
  workflowOptions = [],
  currentWorkflowId,
  onChangeLabel,
  onRenameNode,
  onPatchConfig,
  onChangeEdgeRoute,
  onDeleteNode,
  onDeleteEdge,
  onOpenLoopBody,
  // "Test up to here" and the known output shape of each node (proactive
  // Studio, step 2) — top-level canvas only: a loop body has neither.
  upstreamShapes = {},
  onTestUntil,
  isRunning = false,
  runOutputs = {},
  // The workflow's own settings (failure alert), edited with nothing selected.
  workflowStatus,
  workflowSettings = null,
  onChangeSettings,
}) {
  const t = useTranslations("WorkflowInspector");
  // Field the "Available data" panel inserts into: the template field last
  // focused, while it is still on screen.
  const activeFieldRef = useRef(null);

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
      <div className="w-80 shrink-0 border-l th-border-secondary th-bg-sidebar p-4 hidden xl:flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold th-text-secondary mb-1">{t("emptyTitle")}</p>
          <p className="text-xs th-text-ghost">{t("emptyBody")}</p>
        </div>
        {onChangeSettings && (
          <WorkflowSettingsFields status={workflowStatus} settings={workflowSettings} onChange={onChangeSettings} t={t} />
        )}
      </div>
    );
  }

  if (selection.kind === "edge") {
    const edge = selection.edge;
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const routes = routesOf(sourceNode);
    // A node with an error output and no routes of its own: the edge is
    // either its success (no route) or its error output.
    const errorOutputOnly = !routes && sourceNode && routesOnError({ type: sourceNode.type, config: sourceNode.data?.config });
    return (
      <div data-studio-inspector className="w-80 shrink-0 border-l th-border-secondary th-bg-sidebar p-4 overflow-y-auto h-full max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:shadow-2xl max-xl:bg-[var(--bg-modal)]">
        <h3 className="text-sm font-bold th-text mb-3">{t("edgeTitle")}</h3>
        <Field label={t("edgeFrom")}><TextInput value={edge.source} disabled /></Field>
        <Field label={t("edgeTo")}><TextInput value={edge.target} disabled /></Field>
        {errorOutputOnly ? (
          <Field label={t("edgeRoute")}>
            <SelectInput value={edge.data?.route || ""} onChange={(e) => onChangeEdgeRoute(edge.id, e.target.value)}>
              <option value="">{t("edgeRouteSuccess")}</option>
              <option value={ERROR_ROUTE}>{t("edgeRouteError")}</option>
            </SelectInput>
          </Field>
        ) : routes ? (
          <Field label={t("edgeRoute")}>
            <SelectInput value={edge.data?.route || ""} onChange={(e) => onChangeEdgeRoute(edge.id, e.target.value)}>
              <option value="">{t("edgeRoutePlaceholder")}</option>
              {routes.map((r) => <option key={r} value={r}>{routeOptionLabel(sourceNode, r, t)}</option>)}
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
  const directParents = [...new Set(edges.filter((e) => e.target === node.id).map((e) => e.source))]
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean);
  // Last test run, kept in page memory only (outputs can hold client data).
  const upstreamOutputs = Object.fromEntries(upstreamIds.filter((id) => Object.hasOwn(runOutputs, id)).map((id) => [id, runOutputs[id]]));
  const fieldContext = { outputs: upstreamOutputs, setActive: (field) => (activeFieldRef.current = field) };
  // `fallback(snippet)` when no field is focused; false = nothing inserted.
  const insertSnippet = (snippet, fallback) => {
    const field = activeFieldRef.current;
    if (field?.ref.current?.isConnected) {
      insertAtCursor(field.ref, field.latest.current.value, field.latest.current.onChange, snippet);
      return true;
    }
    if (!fallback) return false;
    fallback(snippet);
    return true;
  };

  return (
    <TemplateFieldContext.Provider value={fieldContext}>
    <div data-studio-inspector className="w-80 shrink-0 border-l th-border-secondary th-bg-sidebar p-4 overflow-y-auto h-full max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-20 max-xl:shadow-2xl max-xl:bg-[var(--bg-modal)]">
      <h3 className="text-sm font-bold th-text mb-3">{t("title")}</h3>
      <NodeUsageHelp key={node.type} type={node.type} id={node.id} />
      <NodeIdField key={node.id} nodeId={node.id} existingIds={nodes.map((n) => n.id)} onRename={onRenameNode} t={t} />
      <Field label={t("label")}>
        <TextInput value={node.data.label || ""} onChange={(e) => onChangeLabel(node.id, e.target.value)} placeholder={t("labelPlaceholder")} />
      </Field>
      {onTestUntil && (
        <>
          <div className="mb-3">
            <TestUntilButton onClick={() => onTestUntil(node.id)} disabled={isRunning} t={t} />
          </div>
          {/* Agent and tool nodes show these fields in "Available data". */}
          {node.type !== "agent" && node.type !== "tool" && (
            <UpstreamShapeHint
              parents={directParents}
              shapes={upstreamShapes}
              canInsert={insertFieldPatch(node, "n", "") !== null}
              onInsert={(sourceId, path) => {
                const next = insertFieldPatch(node, sourceId, path);
                if (next) patch(next);
              }}
              onTestUntil={onTestUntil}
              isRunning={isRunning}
              t={t}
            />
          )}
        </>
      )}

      {node.type === "trigger" && (
        <>
          <TriggerInspector
            nodeId={node.id}
            config={config}
            patch={patch}
            workflowId={workflowId}
            workflowOptions={workflowOptions.filter((w) => String(w.value) !== String(workflowId))}
            triggerRefreshKey={triggerRefreshKey}
            t={t}
          />
          {config.kind !== "agent_tool" && config.kind !== "form" && (
            <Field label={t("samplePayload")} help={t("samplePayloadHelp")}>
              <JsonField value={config.sample_payload} onChange={(v) => patch({ sample_payload: v })} t={t} />
            </Field>
          )}
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
            <TemplateInput value={config.input} onChange={(v) => patch({ input: v })} upstreamNodes={upstreamNodes} multiline examples="agentInput" t={t} />
            {!config.input?.trim() && <p className="mt-1 text-[10px] text-amber-300/90 leading-snug">{t("inputEmptyHint")}</p>}
          </Field>
          <InputPreview template={config.input} nodeId={node.id} outputs={upstreamOutputs} t={t} />
          <AvailableDataPanel
            upstreamNodes={upstreamNodes}
            outputs={upstreamOutputs}
            shapes={upstreamShapes}
            onInsert={(snippet) => insertSnippet(snippet, (s) => patch({ input: `${config.input || ""}${s}` }))}
            onTestUntil={onTestUntil}
            isRunning={isRunning}
            t={t}
          />
          <OutputTypeField config={config} patch={patch} t={t} />
          <Field label={t("onQuestion")} help={t("onQuestionHelp")}>
            <SelectInput value={config.on_question || "continue"} onChange={(e) => patch({ on_question: e.target.value === "continue" ? undefined : e.target.value })}>
              <option value="continue">{t("onQuestion_continue")}</option>
              <option value="fail">{t("onQuestion_fail")}</option>
            </SelectInput>
          </Field>
        </>
      )}

      {node.type === "tool" && (
        <ToolArgsSection
          config={config}
          patch={patch}
          toolOptions={toolOptions}
          schemaEntry={toolSchemas[config.tool || ""]}
          ensureToolSchema={ensureToolSchema}
          upstreamNodes={upstreamNodes}
          t={t}
        />
      )}
      {node.type === "tool" && (
        <AvailableDataPanel
          upstreamNodes={upstreamNodes}
          outputs={upstreamOutputs}
          shapes={upstreamShapes}
          onInsert={(snippet) => insertSnippet(snippet, null)}
          onTestUntil={onTestUntil}
          isRunning={isRunning}
          t={t}
        />
      )}
      {node.type === "tool" && <OutputTypeField config={config} patch={patch} t={t} />}

      {node.type === "router" && (
        <RulesEditor rules={config.rules || []} defaultRoute={config.default_route} onChange={(v) => patch(v)} t={t} />
      )}

      {node.type === "classifier" && (
        <>
          <Field label={t("classifierEngine")} help={t(config.engine === "jev" ? "classifierEngineHelp_jev" : "classifierEngineHelp_agent")}>
            <SelectInput
              value={config.engine || "agent"}
              onChange={(e) => patch({ engine: e.target.value === "agent" ? undefined : e.target.value })}
            >
              {CLASSIFIER_ENGINES.map((engine) => <option key={engine} value={engine}>{t(`classifierEngine_${engine}`)}</option>)}
            </SelectInput>
          </Field>
          {config.engine === "jev" ? (
            <>
              <Field label={t("classifierText")} help={t("classifierTextHelp")}>
                <TemplateInput value={config.text} onChange={(v) => patch({ text: v || undefined })} upstreamNodes={upstreamNodes} multiline t={t} />
              </Field>
              <Field label={t("classifierMinConfidence")} help={t("classifierMinConfidenceHelp", { route: UNCERTAIN_ROUTE })}>
                <DecimalInput
                  key={node.id}
                  value={config.min_confidence ?? JEV_MIN_CONFIDENCE_DEFAULT}
                  onCommit={(v) => patch({ min_confidence: v })}
                />
              </Field>
              <Field label={t("classifierInstructions")}>
                <TemplateInput value={config.instructions} onChange={(v) => patch({ instructions: v || undefined })} upstreamNodes={upstreamNodes} multiline t={t} />
              </Field>
            </>
          ) : (
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
          )}
          <RoutesEditor routes={config.routes || []} onChange={(routes) => patch({ routes })} t={t} />
          {config.engine === "jev" && <p className="mt-1.5 text-[10px] th-text-ghost">{t("classifierUncertainHelp", { route: UNCERTAIN_ROUTE })}</p>}
        </>
      )}

      {node.type === "merge" && <p className="text-xs th-text-ghost">{t("mergeHelp")}</p>}

      {node.type === "convert" && (
        <>
          <Field label={t("convertTo")} help={(config.to === "csv" || config.to === "date") ? t(`convertTo_${config.to}_help`) : undefined}>
            <SelectInput value={config.to || "text"} onChange={(e) => patch({ to: e.target.value })}>
              {CONVERT_TARGETS.map((to) => <option key={to} value={to}>{t(`convertTo_${to}`)}</option>)}
            </SelectInput>
          </Field>
          <Field label={t("convertInput")} help={t("convertInputHelp")}>
            <TemplateInput value={config.input} onChange={(v) => patch({ input: v || undefined })} upstreamNodes={upstreamNodes} examples="convertInput" t={t} />
          </Field>
        </>
      )}

      {node.type === "output" && (
        <Field label={t("outputValue")} help={t("outputValueHelp")}>
          <TemplateInput value={config.value} onChange={(v) => patch({ value: v || undefined })} upstreamNodes={upstreamNodes} multiline examples="outputValue" t={t} />
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
            <TemplateInput value={config.url} onChange={(v) => patch({ url: v })} placeholder={t("httpUrlPlaceholder")} upstreamNodes={upstreamNodes} examples="httpUrl" t={t} />
          </Field>
          <HttpHeadersEditor headers={config.headers || []} onChange={(headers) => patch({ headers })} t={t} />
          {HTTP_METHODS_WITH_BODY.has(config.method || "GET") && (
            <Field label={t("httpBody")} help={t("httpBodyHelp")}>
              <TemplateInput value={config.body} onChange={(v) => patch({ body: v || undefined })} multiline upstreamNodes={upstreamNodes} examples="httpBody" t={t} />
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

      {node.type === "extract" && (
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
          <Field label={t("extractInput")} help={t("extractInputHelp")}>
            <TemplateInput value={config.input} onChange={(v) => patch({ input: v || undefined })} upstreamNodes={upstreamNodes} multiline examples="extractInput" t={t} />
          </Field>
          <ExtractFieldsEditor fields={config.fields || []} onChange={(fields) => patch({ fields })} t={t} />
          <p className="mt-1.5 text-[10px] th-text-ghost">{t("extractFieldsHelp", { id: node.id })}</p>
        </>
      )}

      {node.type === "document" && (
        <>
          <Field label={t("documentFiles")} help={t("documentFilesHelp")}>
            <TemplateInput value={config.files} onChange={(v) => patch({ files: v })} placeholder={t("documentFilesPlaceholder")} upstreamNodes={upstreamNodes} t={t} />
          </Field>
          <p className="mt-1.5 text-[10px] th-text-ghost">{t("documentOutputHelp", { id: node.id })}</p>
        </>
      )}

      {node.type === "db_write" && (
        <>
          <Field label={t("dbWriteConnection")} help={t("dbWriteConnectionHelp")}>
            <TextInput
              list={`dbwrite-connections-${node.id}`}
              value={config.connection || ""}
              onChange={(e) => patch({ connection: e.target.value })}
              placeholder="tool_config0"
            />
            <datalist id={`dbwrite-connections-${node.id}`}>
              {toolOptions.filter((o) => DB_WRITE_CONNECTION_PATTERN.test(o.value)).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </datalist>
          </Field>
          <Field label={t("dbWriteTable")} help={t("dbWriteTableHelp")}>
            <TextInput value={config.table || ""} onChange={(e) => patch({ table: e.target.value })} placeholder="documents_recus" />
          </Field>
          <DbWriteValuesEditor values={config.values || {}} onChange={(values) => patch({ values })} t={t} />
        </>
      )}

      {node.type === "rag" && (
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
          <Field label={t("ragQuery")} help={t("ragHelp", { id: node.id })}>
            <TemplateInput value={config.query} onChange={(v) => patch({ query: v })} upstreamNodes={upstreamNodes} examples="ragQuery" t={t} />
          </Field>
          <Field label={t("ragTopK")} help={t("ragTopKHelp")}>
            <TextInput
              type="number"
              min={RAG_TOP_K_MIN}
              max={RAG_TOP_K_MAX}
              value={config.top_k ?? ""}
              onChange={(e) => patch({ top_k: e.target.value === "" ? "" : Number(e.target.value) })}
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
                <TemplateInput value={config.body} onChange={(v) => patch({ body: v })} multiline upstreamNodes={upstreamNodes} examples="notificationBody" t={t} />
              </Field>
            </>
          )}
          {config.channel === "teams" && (
            <>
              <Field label={t("notificationSubject")}>
                <TextInput value={config.subject || ""} onChange={(e) => patch({ subject: e.target.value })} />
              </Field>
              <Field label={t("notificationBody")}>
                <TemplateInput value={config.body} onChange={(v) => patch({ body: v })} multiline upstreamNodes={upstreamNodes} examples="notificationBody" t={t} />
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

      {node.type === "set" && (
        <SetFieldsEditor fields={config.fields || []} onChange={(fields) => patch({ fields })} upstreamNodes={upstreamNodes} t={t} />
      )}

      {node.type === "condition" && (
        <ConditionRulesEditor rules={config.rules || []} match={config.match || "all"} onChange={(v) => patch(v)} t={t} />
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
              <TemplateInput value={config.items} onChange={(v) => patch({ items: v })} placeholder={t("loopItemsPlaceholder")} upstreamNodes={upstreamNodes} examples="loopItems" t={t} />
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

      {node.type === "try" && (
        <>
          <TryEffectsWarning body={config.body} retries={config.retries} t={t} />
          <Field label={t("tryRetries")} help={t("tryRetriesHelp")}>
            <TextInput
              type="number"
              min={0}
              max={TRY_RETRIES_CAP}
              value={config.retries ?? 0}
              onChange={(e) => patch({ retries: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </Field>
          <Field label={t("tryRetryDelay")} help={t("tryRetryDelayHelp")}>
            <TextInput
              type="number"
              min={0}
              max={TRY_RETRY_DELAY_MS_CAP}
              step={100}
              value={config.retry_delay_ms ?? 0}
              onChange={(e) => patch({ retry_delay_ms: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </Field>
          <Field label={t("tryBody")} help={t("tryBodyHelp")}>
            <button
              type="button"
              onClick={() => onOpenLoopBody(node.id)}
              className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary"
            >
              {t("tryBodyOpen")}
              <ChevronRight size={14} />
            </button>
          </Field>
        </>
      )}

      {node.type === "subworkflow" && (
        <>
          <Field label={t("subworkflowTarget")}>
            {(() => {
              const available = workflowOptions.filter((w) => String(w.value) !== String(currentWorkflowId));
              return available.length === 0 ? (
                <p className="text-xs th-text-ghost">{t("subworkflowNone")}</p>
              ) : (
                <SelectInput value={config.workflow_id || ""} onChange={(e) => patch({ workflow_id: e.target.value })}>
                  <option value="">{t("subworkflowPlaceholder")}</option>
                  {available.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </SelectInput>
              );
            })()}
          </Field>
          <Field label={t("subworkflowInput")} help={t("subworkflowInputHelp")}>
            <TemplateInput value={config.input} onChange={(v) => patch({ input: v || undefined })} upstreamNodes={upstreamNodes} multiline examples="subworkflowInput" t={t} />
          </Field>
        </>
      )}

      {node.type === "approval" && <ApprovalInspector config={config} patch={patch} upstreamNodes={upstreamNodes} t={t} />}

      {onErrorModesFor(node.type).length > 0 && <ErrorHandlingFields type={node.type} config={config} patch={patch} t={t} />}

      <DeleteButton onClick={() => onDeleteNode(node.id)} label={t("deleteNode")} />
    </div>
    </TemplateFieldContext.Provider>
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
    const routes = (cfg.routes || []).map((r) => r.route).filter(Boolean);
    const withUncertain = cfg.engine === "jev" ? [...routes, UNCERTAIN_ROUTE] : routes;
    return routesOnError({ type: "classifier", config: cfg }) ? [...withUncertain, ERROR_ROUTE] : withUncertain;
  }
  if (sourceNode.type === "try") {
    return TRY_ROUTES;
  }
  if (sourceNode.type === "condition") {
    return CONDITION_ROUTES;
  }
  if (sourceNode.type === "approval") {
    return approvalRoutes(cfg) ?? []; // mode text: no route to pick
  }
  return null;
}

/** "true"/"false" and a try's "ok"/"error" are shown translated; a router/classifier's routes are free text and shown as-is. */
function routeOptionLabel(sourceNode, route, t) {
  if (sourceNode?.type === "try") return t(`tryRoute_${route}`);
  if (sourceNode?.type === "condition") {
    return route === "true" ? t("conditionRouteTrue") : t("conditionRouteFalse");
  }
  if (sourceNode?.type === "approval" && route === "text") return t("approvalRouteText");
  if (sourceNode?.type === "classifier" && route === ERROR_ROUTE && sourceNode.data?.config?.on_error === "route") {
    return t("edgeRouteError");
  }
  if (sourceNode?.type === "classifier" && route === UNCERTAIN_ROUTE && sourceNode.data?.config?.engine === "jev") {
    return t("classifierRouteUncertain");
  }
  return route;
}
