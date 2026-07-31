"use client";

import { useState, useEffect, useCallback, Fragment, useRef } from "react";
import { useSearchParams } from "@/lib/navigation";
import { useTranslations } from "use-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  XCircle,
  ChevronDown,
  ChevronRight,
  Info,
  Activity,
  Filter,
  Mail,
  Pencil,
  Power,
} from "lucide-react";
import {
  listWebhookSubscriptions,
  createWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
  renewWebhookSubscription,
  listWebhookLogs,
  getWebhookLog,
  getWebhookLogBody,
  retriggerWebhookLog,
  listAgents,
} from "@/lib/api";
import { useToast } from "./Toast";
import WebhookAttachment from "./WebhookAttachment";
import { formatDateTime } from "@/lib/datetime";

// --- Constants ---

const PROVIDERS = [
  { key: "microsoft_outlook", label: "Microsoft Outlook" },
  { key: "google_gmail", label: "Google Gmail" },
];

const RESOURCE_PRESETS = {
  microsoft_outlook: [
    { labelKey: "resourceInbox", value: "me/mailFolders('Inbox')/messages" },
    { labelKey: "resourceSentItems", value: "me/mailFolders('SentItems')/messages" },
    { labelKey: "resourceAllEmails", value: "me/messages" },
  ],
  google_gmail: [
    { labelKey: "resourceInbox", value: "INBOX" },
    { labelKey: "resourceAllMessages", value: "ALL" },
    { labelKey: "resourceImportantMessages", value: "IMPORTANT" },
    { labelKey: "resourceStarredMessages", value: "STARRED" },
  ],
};

const CHANGE_TYPES = [
  { key: "created", labelKey: "changeTypeCreated" },
  { key: "updated", labelKey: "changeTypeModified" },
  { key: "deleted", labelKey: "changeTypeDeleted" },
];

const TEMPLATE_VARIABLES = {
  microsoft_outlook: [
    { name: "${sender}", descKey: "varSenderDesc" },
    { name: "${subject}", descKey: "varSubjectDesc" },
    { name: "${resource}", descKey: "varResourceDesc" },
  ],
  google_gmail: [
    { name: "${sender}", descKey: "varSenderDesc" },
    { name: "${subject}", descKey: "varSubjectDesc" },
    { name: "${date}", descKey: "varDateDesc" },
    { name: "${body_preview}", descKey: "varBodyPreviewDesc" },
  ],
};

// --- Helpers ---

function formatAgentResponse(raw) {
  if (!raw) return "";
  // Try parsing as JSON array of ADK events
  if (raw.trimStart().startsWith("[")) {
    try {
      const events = JSON.parse(raw);
      if (Array.isArray(events)) {
        const texts = events
          .filter(e => e?.content?.parts)
          .flatMap(e => e.content.parts)
          .filter(p => p?.text && !p?.functionCall && !p?.functionResponse)
          .map(p => p.text);
        if (texts.length > 0) return texts.join("\n\n");
      }
    } catch { /* not JSON, use as-is */ }
  }
  return raw;
}

function getRelativeTime(dateStr, t) {
  if (!dateStr) return "—";
  const now = new Date();
  const exp = new Date(dateStr);
  const diffMs = exp - now;
  const diffMin = Math.round(diffMs / 60000);
  const diffH = Math.round(diffMs / 3600000);
  const diffD = Math.round(diffMs / 86400000);

  if (diffMs < 0) return t("expiredLabel");
  if (diffMin < 60) return t("minsShort", { count: diffMin });
  if (diffH < 24) return t("hoursShort", { count: diffH });
  return t("daysShort", { count: diffD });
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const exp = new Date(dateStr);
  const now = new Date();
  return exp - now < 86400000 && exp - now > 0; // < 24h
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDate(dateStr) {
  return formatDateTime(dateStr);
}

function getResourceLabel(resource, t) {
  for (const presets of Object.values(RESOURCE_PRESETS)) {
    const match = presets.find((p) => p.value === resource);
    if (match) return t(match.labelKey);
  }
  return resource;
}

// --- Status Badge ---

function StatusBadge({ status, expirationDatetime }) {
  const t = useTranslations("WebhookManager");
  const expired = isExpired(expirationDatetime);
  const expiringSoon = isExpiringSoon(expirationDatetime);

  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/20 border border-gray-500/30 text-gray-400">
        <XCircle size={10} /> {t("statusDisabled")}
      </span>
    );
  }

  if (expired || status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 border border-purple-500/30 text-purple-400">
        <AlertCircle size={10} /> {t("statusExpired")}
      </span>
    );
  }

  if (expiringSoon) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-400/20 border border-purple-400/30 text-purple-400">
        <Clock size={10} /> {t("statusExpiringSoon")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-400">
      <CheckCircle2 size={10} /> {t("statusActive")}
    </span>
  );
}

// --- Stats Bar ---

function StatsBar({ total, active, disabled, expired }) {
  const t = useTranslations("WebhookManager");
  const cards = [
    { label: t("statsTotalLabel"),    value: total,    icon: Webhook,      color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    { label: t("statsActiveLabel"),   value: active,   icon: CheckCircle2, color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    { label: t("statsDisabledLabel"), value: disabled,  icon: XCircle,      color: "text-gray-400",   bg: "bg-gray-500/10",   border: "border-gray-500/20" },
    { label: t("statsExpiredLabel"),  value: expired,  icon: AlertCircle,  color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={`${c.bg} ${c.border} border rounded-xl p-4 flex items-center gap-3`}>
            <div className={`p-2 rounded-lg ${c.bg}`}>
              <Icon size={20} className={c.color} />
            </div>
            <div>
              <p className="text-2xl font-black th-text">{c.value}</p>
              <p className="text-xs th-text-muted">{c.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Create Form ---

function CreateForm({ agents, onCreated, onCancel }) {
  const t = useTranslations("WebhookManager");
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [provider, setProvider] = useState(PROVIDERS[0].key);
  const [resource, setResource] = useState(RESOURCE_PRESETS[PROVIDERS[0].key][0].value);
  const [changeTypes, setChangeTypes] = useState(["created"]);
  const [agentId, setAgentId] = useState("");
  const [template, setTemplate] = useState("New email from ${sender}: ${subject}");

  const isGmail = provider === "google_gmail";

  const toggleChangeType = (key) => {
    if (isGmail) return; // Gmail only supports "created"
    setChangeTypes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    const firstPreset = RESOURCE_PRESETS[newProvider]?.[0];
    if (firstPreset) setResource(firstPreset.value);
    // Gmail only supports "created" via Pub/Sub watch
    if (newProvider === "google_gmail") {
      setChangeTypes(["created"]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agentId) {
      toast.warning(t("selectAgentWarning"));
      return;
    }
    if (changeTypes.length === 0) {
      toast.warning(t("selectChangeTypeWarning"));
      return;
    }

    setSubmitting(true);
    try {
      await createWebhookSubscription({
        provider,
        resource,
        change_type: changeTypes.join(","),
        agent_id: parseInt(agentId, 10),
        agent_message_template: template,
      });
      toast.success(t("createSuccessToast"));
      onCreated();
    } catch (err) {
      toast.error(err.message || t("createErrorToast"));
    } finally {
      setSubmitting(false);
    }
  };

  const presets = RESOURCE_PRESETS[provider] || [];

  return (
    <div className="th-bg-surface border th-border rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold th-text flex items-center gap-2">
          <Plus size={20} className="text-blue-400" />
          {t("newSubscriptionTitle")}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:th-bg-surface-hover transition-colors"
        >
          <X size={18} className="th-text-muted" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Provider */}
        <div>
          <label className="block text-xs font-semibold th-text-secondary mb-1.5">{t("providerLabel")}</label>
          <div className="relative">
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl th-bg-elevated border th-border th-text text-sm appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {PROVIDERS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 th-text-muted pointer-events-none" />
          </div>
        </div>

        {/* Resource */}
        <div>
          <label className="block text-xs font-semibold th-text-secondary mb-1.5">{t("resourceToMonitorLabel")}</label>
          <div className="relative">
            <select
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl th-bg-elevated border th-border th-text text-sm appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {presets.map((p) => (
                <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 th-text-muted pointer-events-none" />
          </div>
          <p className="text-[10px] th-text-faint mt-1 font-mono">{resource}</p>
        </div>

        {/* Change types */}
        <div>
          <label className="block text-xs font-semibold th-text-secondary mb-1.5">{t("changeTypesLabel")}</label>
          {isGmail ? (
            <div className="flex gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium bg-blue-500/20 border-blue-500/40 text-blue-300 cursor-default">
                <div className="w-4 h-4 rounded border flex items-center justify-center bg-blue-500 border-blue-500">
                  <CheckCircle2 size={10} className="text-white" />
                </div>
                {t("newMessageLabel")}
              </div>
              <p className="flex items-center text-[10px] th-text-faint">
                {t("gmailOnlyNote")}
              </p>
            </div>
          ) : (
            <div className="flex gap-3">
              {CHANGE_TYPES.map((ct) => (
                <label
                  key={ct.key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                    changeTypes.includes(ct.key)
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                      : "th-bg-elevated th-border th-text-secondary hover:th-bg-surface-hover"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={changeTypes.includes(ct.key)}
                    onChange={() => toggleChangeType(ct.key)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    changeTypes.includes(ct.key)
                      ? "bg-blue-500 border-blue-500"
                      : "th-border"
                  }`}>
                    {changeTypes.includes(ct.key) && (
                      <CheckCircle2 size={10} className="text-white" />
                    )}
                  </div>
                  {t(ct.labelKey)}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Agent */}
        <div>
          <label className="block text-xs font-semibold th-text-secondary mb-1.5">{t("agentToTriggerLabel")}</label>
          <div className="relative">
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl th-bg-elevated border th-border th-text text-sm appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="">{t("selectAgentPlaceholder")}</option>
              {agents.map((a) => (
                <option key={a.agent_id} value={a.agent_id}>
                  {a.agent_name || a.name} (#{a.agent_id})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 th-text-muted pointer-events-none" />
          </div>
        </div>

        {/* Message template */}
        <div>
          <label className="block text-xs font-semibold th-text-secondary mb-1.5">
            {t("messageTemplateLabel")}
          </label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl th-bg-elevated border th-border th-text text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="New email from ${sender}: ${subject}"
          />
          <div className="mt-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info size={12} className="text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">{t("availableVariablesLabel")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(TEMPLATE_VARIABLES[provider] || []).map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => setTemplate((prev) => prev + v.name)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 transition-colors"
                  title={t(v.descKey)}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl th-bg-elevated border th-border th-text-secondary text-sm font-semibold hover:th-bg-surface-hover transition-all"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-brand flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:scale-105"
          >
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> {t("creatingEllipsis")}</>
            ) : (
              <><Plus size={14} /> {t("createSubscriptionButton")}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Delete Confirmation ---

function DeleteConfirm({ subscription, onConfirm, onCancel, deleting }) {
  const t = useTranslations("WebhookManager");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="th-bg-surface border th-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/20">
            <Trash2 size={20} className="text-red-400" />
          </div>
          <h3 className="text-lg font-bold th-text">{t("deleteSubscriptionTitle")}</h3>
        </div>
        <p className="th-text-secondary text-sm mb-6">
          {t("deleteConfirmPrefix")}{" "}
          <span className="font-semibold th-text">{getResourceLabel(subscription.resource, t)}</span>
          {t("deleteConfirmSuffix")}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl th-bg-elevated border th-border th-text-secondary text-sm font-semibold hover:th-bg-surface-hover transition-all"
          >
            {t("cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-all disabled:opacity-50"
          >
            {deleting ? (
              <><Loader2 size={14} className="animate-spin" /> {t("deletingEllipsis")}</>
            ) : (
              <><Trash2 size={14} /> {t("deleteButton")}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Edit Form ---

function EditForm({ subscription, agents, onSaved, onCancel }) {
  const t = useTranslations("WebhookManager");
  const toast = useToast();
  const [agentId, setAgentId] = useState(String(subscription.agent_id || ""));
  const [changeTypes, setChangeTypes] = useState(
    (subscription.change_type || "created").split(",").map((s) => s.trim())
  );
  const [template, setTemplate] = useState(subscription.agent_message_template || "");
  const [saving, setSaving] = useState(false);

  const editProvider = subscription.provider || "microsoft_outlook";
  const isGmail = editProvider === "google_gmail";

  const toggleChangeType = (ct) => {
    if (isGmail) return; // Gmail only supports "created"
    setChangeTypes((prev) =>
      prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct]
    );
  };

  const handleSave = async () => {
    if (!agentId) {
      toast.error(t("selectAgentWarning"));
      return;
    }
    if (changeTypes.length === 0) {
      toast.error(t("selectChangeTypeWarning"));
      return;
    }
    setSaving(true);
    try {
      await updateWebhookSubscription(subscription.id, {
        agent_id: Number(agentId),
        change_type: changeTypes.join(","),
        agent_message_template: template || null,
      });
      toast.success(t("updateSuccessToast"));
      onSaved();
    } catch (err) {
      toast.error(err.message || t("updateErrorToast"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="th-bg-surface border th-border rounded-2xl p-6 backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold th-text flex items-center gap-2">
          <Pencil size={18} className="text-purple-400" />
          {t("editSubscriptionTitle", { id: subscription.id })}
        </h3>
        <button onClick={onCancel} className="th-text-muted hover:th-text transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="text-xs th-text-faint space-y-1">
        <div>{t("editProviderLabel")} <span className="font-semibold">{PROVIDERS.find((p) => p.key === editProvider)?.label || editProvider}</span></div>
        <div>{t("editResourceLabel")} <span className="font-mono">{subscription.resource}</span> {t("editResourceNotEditableNote")}</div>
      </div>

      {/* Change types */}
      <div>
        <label className="block text-xs font-semibold th-text-secondary mb-1.5">{t("changeTypesLabel")}</label>
        {isGmail ? (
          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium bg-blue-500/20 border-blue-500/40 text-blue-300 cursor-default">
              <div className="w-4 h-4 rounded border flex items-center justify-center bg-blue-500 border-blue-500">
                <CheckCircle2 size={10} className="text-white" />
              </div>
              {t("newMessageLabel")}
            </div>
            <p className="flex items-center text-[10px] th-text-faint">
              {t("gmailOnlyNote")}
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            {CHANGE_TYPES.map((ct) => (
              <label
                key={ct.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                  changeTypes.includes(ct.key)
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : "th-bg-elevated th-border th-text-secondary hover:th-bg-surface-hover"
                }`}
              >
                <input
                  type="checkbox"
                  checked={changeTypes.includes(ct.key)}
                  onChange={() => toggleChangeType(ct.key)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  changeTypes.includes(ct.key) ? "bg-blue-500 border-blue-500" : "th-border"
                }`}>
                  {changeTypes.includes(ct.key) && <CheckCircle2 size={10} className="text-white" />}
                </div>
                {t(ct.labelKey)}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Agent */}
      <div>
        <label className="block text-xs font-semibold th-text-secondary mb-1.5">{t("agentToTriggerLabel")}</label>
        <div className="relative">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl th-bg-elevated border th-border th-text text-sm appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">{t("selectAgentPlaceholder")}</option>
            {agents.map((a) => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.agent_name || a.name} (#{a.agent_id})
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 th-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Template */}
      <div>
        <label className="block text-xs font-semibold th-text-secondary mb-1.5">{t("messageTemplateLabel")}</label>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 rounded-xl th-bg-elevated border th-border th-text text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          placeholder="New email from ${sender}: ${subject}"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {(TEMPLATE_VARIABLES[editProvider] || []).map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => setTemplate((prev) => prev + v.name)}
              className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all font-mono"
              title={t(v.descKey)}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-400 hover:bg-purple-500 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
          {t("saveButton")}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 th-bg-elevated border th-border th-text-secondary rounded-xl font-bold text-sm hover:th-bg-surface-hover transition-all"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}

// --- Subscription Table ---

function SubscriptionTable({ subscriptions, agents, onRenew, onDelete, onEdit, onToggle, renewingId, togglingId }) {
  const t = useTranslations("WebhookManager");
  const agentMap = Object.fromEntries(agents.map((a) => [a.agent_id, a]));

  if (subscriptions.length === 0) {
    return (
      <div className="th-bg-surface border th-border rounded-2xl p-12 text-center backdrop-blur-xl">
        <Webhook size={48} className="th-text-faint mx-auto mb-4 opacity-30" />
        <p className="th-text-secondary text-sm font-medium">{t("noSubscriptionsTitle")}</p>
        <p className="th-text-faint text-xs mt-1">{t("noSubscriptionsDesc")}</p>
      </div>
    );
  }

  return (
    <div className="th-bg-surface border th-border rounded-2xl overflow-hidden backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b th-border">
              <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colAgent")}</th>
              <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colProvider")}</th>
              <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colResource")}</th>
              <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colEvent")}</th>
              <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colStatus")}</th>
              <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colExpiration")}</th>
              <th className="text-right text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => {
              const agent = agentMap[sub.agent_id];
              const expired = isExpired(sub.expiration_datetime);
              const expiringSoon = isExpiringSoon(sub.expiration_datetime);

              return (
                <tr
                  key={sub.id}
                  className="border-b th-border last:border-b-0 hover:th-bg-surface-hover transition-colors"
                >
                  {/* Agent */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-400">
                          {agent ? (agent.agent_name || agent.name || "?").charAt(0).toUpperCase() : "?"}
                        </span>
                      </div>
                      <div>
                        <p className="th-text text-sm font-semibold">
                          {agent ? (agent.agent_name || agent.name) : t("agentFallback", { id: sub.agent_id })}
                        </p>
                        <p className="th-text-faint text-[10px]">{t("agentIdLabel", { id: sub.agent_id })}</p>
                      </div>
                    </div>
                  </td>

                  {/* Provider */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                      sub.provider === "google_gmail"
                        ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                        : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                    }`}>
                      <Mail size={12} />
                      {PROVIDERS.find((p) => p.key === sub.provider)?.label || sub.provider || "Outlook"}
                    </span>
                  </td>

                  {/* Resource */}
                  <td className="px-5 py-4">
                    <p className="th-text text-sm font-medium">{getResourceLabel(sub.resource, t)}</p>
                    <p className="th-text-faint text-[10px] font-mono truncate max-w-[200px]">{sub.resource}</p>
                  </td>

                  {/* Change type */}
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(sub.change_type || "").split(",").map((ct) => (
                        <span
                          key={ct}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-400"
                        >
                          {ct.trim()}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge status={sub.status} expirationDatetime={sub.expiration_datetime} />
                  </td>

                  {/* Expiration */}
                  <td className="px-5 py-4">
                    <p className={`text-sm font-medium ${
                      expired ? "text-purple-400" : expiringSoon ? "text-purple-400" : "th-text-secondary"
                    }`}>
                      {getRelativeTime(sub.expiration_datetime, t)}
                    </p>
                    <p className="th-text-faint text-[10px]">{formatDate(sub.expiration_datetime)}</p>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onToggle(sub.id, sub.status === "active" ? "disabled" : "active")}
                        disabled={togglingId === sub.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          sub.status === "active"
                            ? "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                            : "bg-gray-500/10 border border-gray-500/20 text-gray-400 hover:bg-gray-500/20"
                        } disabled:opacity-50`}
                        title={sub.status === "active" ? t("disableTitle") : t("enableTitle")}
                      >
                        {togglingId === sub.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Power size={12} />
                        )}
                      </button>
                      <button
                        onClick={() => onEdit(sub)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-400/10 border border-purple-400/20 text-purple-400 hover:bg-purple-400/20 text-xs font-semibold transition-all"
                        title={t("editTitle")}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => onRenew(sub.id)}
                        disabled={renewingId === sub.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                        title={t("renewButton")}
                      >
                        {renewingId === sub.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {t("renewButton")}
                      </button>
                      <button
                        onClick={() => onDelete(sub)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-all"
                        title={t("deleteButton")}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Activity Helpers ---

function getRelativeTimeAgo(dateStr, t) {
  if (!dateStr) return "—";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  if (diffMs < 0) return t("justNow");
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffSec < 60) return t("justNow");
  if (diffMin < 60) return t("minAgo", { count: diffMin });
  if (diffH < 24) return t("hAgo", { count: diffH });
  if (diffD < 7) return t("dAgo", { count: diffD });
  return formatDate(dateStr);
}

function formatDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function LogStatusBadge({ status }) {
  const t = useTranslations("WebhookManager");
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-400">
        <CheckCircle2 size={10} /> {t("logStatusSuccess")}
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-400/20 border border-purple-400/30 text-purple-400">
        <Clock size={10} className="animate-spin" /> {t("logStatusPending")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 border border-red-500/30 text-red-400">
      <XCircle size={10} /> {t("logStatusError")}
    </span>
  );
}

// --- Activity Tab ---

const ACTIVITY_PAGE_SIZE = 50;

function ActivityTab({ agents, subscriptions, focusLogId }) {
  const t = useTranslations("WebhookManager");
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filterSubId, setFilterSubId] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [emailBodyCache, setEmailBodyCache] = useState({});
  const [retriggering, setRetriggering] = useState(null);
  const rowRefs = useRef({});
  const focusHandledForRef = useRef(null);

  const agentMap = Object.fromEntries(agents.map((a) => [a.agent_id, a]));

  // Fetch the first page. Replaces the current list — used for the
  // initial load, manual refresh, and filter changes.
  const fetchFirstPage = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const params = {
        limit: String(ACTIVITY_PAGE_SIZE),
        offset: "0",
      };
      if (filterSubId) params.subscription_id = filterSubId;
      const data = await listWebhookLogs(params);
      const fetched = data.logs || [];
      setLogs(fetched);
      setHasMore(fetched.length === ACTIVITY_PAGE_SIZE);
    } catch (err) {
      toast.error(t("errorLoadingActivityToast", { message: err.message || t("unknownError") }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterSubId, toast, t]);

  // Load the next page. Appends to the existing list — Activity is
  // ordered newest-first, so "load more" walks backward in time.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const params = {
        limit: String(ACTIVITY_PAGE_SIZE),
        offset: String(logs.length),
      };
      if (filterSubId) params.subscription_id = filterSubId;
      const data = await listWebhookLogs(params);
      const fetched = data.logs || [];
      // Defensive dedupe — a refresh racing with load-more could
      // otherwise produce duplicate rows.
      setLogs((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        const merged = [...prev];
        for (const log of fetched) {
          if (!seen.has(log.id)) merged.push(log);
        }
        return merged;
      });
      setHasMore(fetched.length === ACTIVITY_PAGE_SIZE);
    } catch (err) {
      toast.error(t("errorLoadingMoreToast", { message: err.message || t("unknownError") }));
    } finally {
      setLoadingMore(false);
    }
  }, [logs.length, filterSubId, hasMore, loadingMore, toast, t]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  // Auto-refresh every 30 seconds — only the first page so we don't
  // disturb the load-more position the operator may have built up.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFirstPage(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchFirstPage]);

  // Deep-link: when the URL carries ?log=<id>, expand that row and
  // scroll to it. If the log isn't in the currently loaded page, fetch
  // it on its own and prepend it so it's visible without forcing the
  // operator to load-more N times.
  useEffect(() => {
    if (!focusLogId || loading) return;
    if (focusHandledForRef.current === focusLogId) return;

    const targetId = Number(focusLogId);
    if (Number.isNaN(targetId)) return;

    const present = logs.some((l) => l.id === targetId);

    const expandAndScroll = () => {
      setExpandedId(targetId);
      focusHandledForRef.current = focusLogId;
      // Defer until DOM has the expanded row mounted.
      requestAnimationFrame(() => {
        const node = rowRefs.current[targetId];
        if (node && typeof node.scrollIntoView === "function") {
          node.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    };

    if (present) {
      expandAndScroll();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await getWebhookLog(targetId);
        if (cancelled || !data?.log) return;
        // Prepend if not already present (race with auto-refresh).
        setLogs((prev) => {
          if (prev.some((l) => l.id === data.log.id)) return prev;
          return [data.log, ...prev];
        });
        // Wait one frame for the row to mount before expanding.
        requestAnimationFrame(expandAndScroll);
      } catch (err) {
        toast.error(
          t("couldNotLoadLogToast", { id: targetId, message: err.message || t("unknownError") }),
        );
        focusHandledForRef.current = focusLogId;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusLogId, logs, loading, toast, t]);

  const handleRetrigger = async (e, log) => {
    e.stopPropagation();
    if (log.status === "success") {
      const ok = window.confirm(
        t("retriggerConfirmMessage")
      );
      if (!ok) return;
    }
    setRetriggering(log.id);
    try {
      await retriggerWebhookLog(log.id);
      toast.success(t("requeuedToast"));
      fetchFirstPage(true);
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("already_running_or_queued")) {
        toast.error(t("alreadyRunningToast"));
      } else if (msg.includes("subscription_inactive")) {
        toast.error(t("subscriptionInactiveToast"));
      } else {
        toast.error(msg || t("retriggerErrorToast"));
      }
    } finally {
      setRetriggering(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      if (next !== null && emailBodyCache[next] === undefined) {
        setEmailBodyCache((c) => ({ ...c, [next]: null }));
        getWebhookLogBody(next)
          .then((html) => setEmailBodyCache((c) => ({ ...c, [next]: html })))
          .catch(() => setEmailBodyCache((c) => ({ ...c, [next]: "" })));
      }
      return next;
    });
  };

  // Backward-compat alias for in-component callers (Refresh button).
  const fetchLogs = fetchFirstPage;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="th-bg-surface border th-border p-8 rounded-2xl text-center">
          <Loader2 size={32} className="text-blue-400 animate-spin mx-auto mb-3" />
          <p className="th-text-secondary text-sm">{t("loadingActivity")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-muted pointer-events-none" />
            <select
              value={filterSubId}
              onChange={(e) => setFilterSubId(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-xl th-bg-elevated border th-border th-text text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="">{t("allSubscriptionsOption")}</option>
              {subscriptions.map((sub) => {
                const agent = agentMap[sub.agent_id];
                const agentLabel = agent ? (agent.agent_name || agent.name) : t("agentFallback", { id: sub.agent_id });
                return (
                  <option key={sub.id} value={sub.id}>
                    #{sub.id} — {agentLabel} — {getResourceLabel(sub.resource, t)}
                  </option>
                );
              })}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 th-text-muted pointer-events-none" />
          </div>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 th-bg-elevated border th-border th-text-secondary rounded-xl text-sm font-semibold transition-all hover:th-bg-surface-hover disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {t("refreshButton")}
        </button>
      </div>

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="th-bg-surface border th-border rounded-2xl p-12 text-center backdrop-blur-xl">
          <Activity size={48} className="th-text-faint mx-auto mb-4 opacity-30" />
          <p className="th-text-secondary text-sm font-medium">{t("noActivityTitle")}</p>
          <p className="th-text-faint text-xs mt-1">
            {t("noActivityDesc")}
          </p>
        </div>
      ) : (
        <div className="th-bg-surface border th-border rounded-2xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b th-border">
                  <th className="w-8 px-3 py-3" />
                  <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colStatus")}</th>
                  <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colEmail")}</th>
                  <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colAgent")}</th>
                  <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colResponse")}</th>
                  <th className="text-left text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colDuration")}</th>
                  <th className="text-right text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colDate")}</th>
                  <th className="text-center text-[10px] font-semibold th-text-faint uppercase tracking-widest px-5 py-3">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const agent = agentMap[log.agent_id];
                  const isExpanded = expandedId === log.id;

                  const isFocused = focusLogId != null && Number(focusLogId) === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr
                        ref={(el) => {
                          if (el) rowRefs.current[log.id] = el;
                          else delete rowRefs.current[log.id];
                        }}
                        onClick={() => toggleExpand(log.id)}
                        className={
                          "border-b th-border last:border-b-0 hover:th-bg-surface-hover transition-colors cursor-pointer" +
                          (isFocused ? " bg-blue-500/5" : "")
                        }
                      >
                        {/* Expand chevron */}
                        <td className="px-3 py-4">
                          <ChevronRight
                            size={14}
                            className={`th-text-muted transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <LogStatusBadge status={log.status} />
                        </td>

                        {/* Email */}
                        <td className="px-5 py-4">
                          <div className="flex items-start gap-2 max-w-[250px]">
                            <Mail size={14} className="th-text-muted shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="th-text text-sm font-medium truncate" title={log.email_subject}>
                                {log.email_subject || "—"}
                              </p>
                              <p className="th-text-faint text-[10px] truncate" title={log.email_sender}>
                                {log.email_sender || "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Agent */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-blue-400">
                                {agent ? (agent.agent_name || agent.name || "?").charAt(0).toUpperCase() : "?"}
                              </span>
                            </div>
                            <p className="th-text text-sm font-medium truncate">
                              {agent ? (agent.agent_name || agent.name) : t("agentFallback", { id: log.agent_id })}
                            </p>
                          </div>
                        </td>

                        {/* Response (truncated) */}
                        <td className="px-5 py-4">
                          <p className="th-text-secondary text-xs max-w-[200px] truncate" title={formatAgentResponse(log.agent_response)}>
                            {formatAgentResponse(log.agent_response) || "—"}
                          </p>
                        </td>

                        {/* Duration */}
                        <td className="px-5 py-4">
                          <span className="th-text-secondary text-sm font-mono">
                            {formatDuration(log.duration_ms)}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-4 text-right">
                          <p className="th-text-secondary text-sm">{getRelativeTimeAgo(log.created_at, t)}</p>
                          <p className="th-text-faint text-[10px]">{formatDate(log.created_at)}</p>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-4 text-center">
                          <button
                            title={log.status === "error" ? log.error_message : undefined}
                            disabled={["pending", "in_progress"].includes(log.status) || retriggering === log.id}
                            onClick={(e) => handleRetrigger(e, log)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg th-bg-elevated border th-border th-text-secondary text-xs font-semibold hover:th-bg-surface-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {retriggering === log.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RefreshCw size={12} />
                            )}
                            {t("retryButton")}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="border-b th-border last:border-b-0">
                          <td colSpan={8} className="px-5 py-0">
                            <div className="overflow-hidden transition-all duration-200">
                              <div className="py-4 space-y-3">
                                {/* Event type */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold th-text-faint uppercase tracking-wide w-32 shrink-0">
                                    {t("eventLabel")}
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-400">
                                    {log.trigger_event || "—"}
                                  </span>
                                </div>

                                {/* Message sent to agent */}
                                <div>
                                  <p className="text-[10px] font-semibold th-text-faint uppercase tracking-wide mb-1">
                                    {t("messageSentToAgentLabel")}
                                  </p>
                                  <div className="th-bg-elevated border th-border rounded-xl p-3">
                                    <p className="th-text text-xs whitespace-pre-wrap break-words">
                                      {log.agent_message || "—"}
                                    </p>
                                  </div>
                                </div>

                                {/* Agent response (full, markdown-rendered) */}
                                <div>
                                  <p className="text-[10px] font-semibold th-text-faint uppercase tracking-wide mb-1">
                                    {t("agentResponseLabel")}
                                  </p>
                                  <div className="th-bg-elevated border th-border rounded-xl p-3 break-words">
                                    {(() => {
                                      const text = formatAgentResponse(log.agent_response);
                                      if (!text) return <span className="th-text-faint text-xs">—</span>;
                                      return (
                                        <div className="prose prose-sm prose-invert max-w-none th-text text-xs prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-code:text-[11px] prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/5 prose-pre:text-[11px]">
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {text}
                                          </ReactMarkdown>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* Email body */}
                                {emailBodyCache[log.id] && (
                                  <div>
                                    <p className="text-[10px] font-semibold th-text-faint uppercase tracking-wide mb-1">
                                      {t("emailBodyLabel")}
                                    </p>
                                    <iframe
                                      sandbox=""
                                      srcDoc={emailBodyCache[log.id]}
                                      style={{ width: "100%", height: "280px", border: "1px solid var(--th-border)", borderRadius: "12px" }}
                                      title={t("emailBodyIframeTitle")}
                                    />
                                  </div>
                                )}

                                {/* Attachments */}
                                {log.attachments && log.attachments.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold th-text-faint uppercase tracking-wide mb-2">
                                      {t("attachmentsLabel", { count: log.attachments.length })}
                                    </p>
                                    <div className="space-y-3">
                                      {log.attachments.map((att, idx) => (
                                        <WebhookAttachment key={`${att.filename}-${idx}`} logId={log.id} att={att} />
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Error message — only when the final outcome wasn't a success.
                                    Otherwise we'd surface the failure message of an earlier
                                    retry attempt on a run that ultimately succeeded. */}
                                {log.error_message && log.status !== "success" && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-1">
                                      {t("errorLabel")}
                                    </p>
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                      <p className="text-red-400 text-xs whitespace-pre-wrap break-words">
                                        {log.error_message}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Meta info */}
                                <div className="flex items-center gap-6 pt-1">
                                  <span className="th-text-faint text-[10px]">
                                    {t("subscriptionIdMeta", { id: log.subscription_id })}
                                  </span>
                                  <span className="th-text-faint text-[10px]">
                                    {t("durationMeta", { duration: formatDuration(log.duration_ms) })}
                                  </span>
                                  <span className="th-text-faint text-[10px]">
                                    {formatDate(log.created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="border-t th-border px-5 py-3 flex items-center justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 th-bg-elevated border th-border th-text-secondary rounded-xl text-sm font-semibold transition-all hover:th-bg-surface-hover disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t("loadingEllipsis")}
                  </>
                ) : (
                  <>{t("loadMoreButton")}</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function WebhookManager() {
  const t = useTranslations("WebhookManager");
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [renewingId, setRenewingId] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // subscription being edited
  const [togglingId, setTogglingId] = useState(null);
  const searchParams = useSearchParams();
  const focusLogId = searchParams?.get("log") || null;
  const tabFromUrl = searchParams?.get("tab") || null;
  const [activeTab, setActiveTab] = useState(
    focusLogId || tabFromUrl === "activity" ? "activity" : "subscriptions",
  );

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [subsResult, agentsResult] = await Promise.allSettled([
        listWebhookSubscriptions(),
        listAgents(),
      ]);
      if (subsResult.status === "fulfilled") {
        setSubscriptions(subsResult.value.subscriptions || []);
      } else {
        console.error("[WebhookManager] Failed to load subscriptions:", subsResult.reason);
      }
      if (agentsResult.status === "fulfilled") {
        const data = agentsResult.value;
        setAgents(Array.isArray(data) ? data : data.agents || []);
      } else {
        console.error("[WebhookManager] Failed to load agents:", agentsResult.reason);
      }
      // Show error only if both failed
      if (subsResult.status === "rejected" && agentsResult.status === "rejected") {
        toast.error(t("errorLoadingWebhooksToast", { message: subsResult.reason?.message || t("unknownError") }));
      }
    } catch (err) {
      toast.error(t("errorLoadingWebhooksToast", { message: err.message || t("unknownError") }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRenew = async (id) => {
    setRenewingId(id);
    try {
      const updated = await renewWebhookSubscription(id);
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updated } : s))
      );
      toast.success(t("renewSuccessToast"));
    } catch (err) {
      if (err.status === 410) {
        // Subscription no longer exists — remove from UI
        setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      }
      toast.error(err.message || t("renewErrorToast"));
    } finally {
      setRenewingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWebhookSubscription(deleteTarget.id);
      setSubscriptions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success(t("deleteSuccessToast"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || t("deleteErrorToast"));
    } finally {
      setDeleting(false);
    }
  };

  const handleCreated = () => {
    setShowCreateForm(false);
    fetchData(true);
  };

  const handleEdited = () => {
    setEditTarget(null);
    fetchData(true);
  };

  const handleToggle = async (id, newStatus) => {
    setTogglingId(id);
    try {
      await updateWebhookSubscription(id, { status: newStatus });
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
      toast.success(newStatus === "active" ? t("webhookEnabledToast") : t("webhookDisabledToast"));
    } catch (err) {
      toast.error(err.message || t("toggleErrorToast"));
    } finally {
      setTogglingId(null);
    }
  };

  // Stats
  const activeCount = subscriptions.filter(
    (s) => !isExpired(s.expiration_datetime) && s.status === "active"
  ).length;
  const disabledCount = subscriptions.filter(
    (s) => s.status === "disabled"
  ).length;
  const expiredCount = subscriptions.filter(
    (s) => isExpired(s.expiration_datetime) || s.status === "expired"
  ).length;

  return (
    <div className="h-full flex flex-col th-bg-body overflow-hidden">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteConfirm
          subscription={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Header */}
      <header className="shrink-0 p-6 bg-linear-to-r from-brand/20 to-brand-secondary/20 border-b th-border backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-linear-to-br from-brand to-brand-secondary rounded-2xl shadow-lg">
              <Webhook size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black th-text tracking-tight">{t("pageTitle")}</h1>
              <p className="th-text-muted text-sm font-medium mt-1">
                {t("pageSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-3 th-bg-elevated border th-border th-text-secondary rounded-xl font-bold transition-all hover:th-bg-surface-hover hover:scale-105 disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover border border-brand/30 text-white rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">{t("newSubscriptionButton")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <StatsBar total={subscriptions.length} active={activeCount} disabled={disabledCount} expired={expiredCount} />

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b th-border">
            <button
              onClick={() => setActiveTab("subscriptions")}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
                activeTab === "subscriptions"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent th-text-muted hover:th-text-secondary hover:border-gray-500/30"
              }`}
            >
              <Webhook size={16} />
              {t("subscriptionsTab")}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === "subscriptions"
                  ? "bg-blue-500/20 text-blue-400"
                  : "th-bg-elevated th-text-faint"
              }`}>
                {subscriptions.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${
                activeTab === "activity"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent th-text-muted hover:th-text-secondary hover:border-gray-500/30"
              }`}
            >
              <Activity size={16} />
              {t("activityTab")}
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "subscriptions" && (
            <>
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="th-bg-surface border th-border p-8 rounded-2xl text-center">
                    <Loader2 size={32} className="text-blue-400 animate-spin mx-auto mb-3" />
                    <p className="th-text-secondary text-sm">{t("loadingWebhooks")}</p>
                  </div>
                </div>
              ) : (
                <>
                  {showCreateForm && (
                    <CreateForm
                      agents={agents}
                      onCreated={handleCreated}
                      onCancel={() => setShowCreateForm(false)}
                    />
                  )}

                  {editTarget && (
                    <EditForm
                      subscription={editTarget}
                      agents={agents}
                      onSaved={handleEdited}
                      onCancel={() => setEditTarget(null)}
                    />
                  )}

                  <p className="th-text-faint text-xs font-semibold uppercase tracking-widest">
                    {t("subscriptionsCountLabel", { count: subscriptions.length })}
                  </p>

                  <SubscriptionTable
                    subscriptions={subscriptions}
                    agents={agents}
                    onRenew={handleRenew}
                    onDelete={setDeleteTarget}
                    onEdit={(sub) => { setEditTarget(sub); setShowCreateForm(false); }}
                    onToggle={handleToggle}
                    renewingId={renewingId}
                    togglingId={togglingId}
                  />
                </>
              )}
            </>
          )}

          {activeTab === "activity" && (
            <ActivityTab agents={agents} subscriptions={subscriptions} focusLogId={focusLogId} />
          )}
        </div>
      </div>
    </div>
  );
}
