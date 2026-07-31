"use client";

import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Edit3,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";

export default function ApprovalCard({ approval, onApprove, onReject, onModify }) {
  const t = useTranslations("ApprovalCard");
  const [expanded, setExpanded] = useState(false);
  const [modifyText, setModifyText] = useState("");
  const [showModify, setShowModify] = useState(false);

  if (!approval) return null;

  const isResolved = approval.status === "approved" || approval.status === "rejected";
  const isPending = approval.status === "pending";

  return (
    <div
      className={`my-2 rounded-xl border overflow-hidden ${
        isResolved
          ? approval.status === "approved"
            ? "border-blue-500/30 bg-blue-500/5"
            : "border-red-500/30 bg-red-500/5"
          : "border-purple-500/30 bg-purple-500/5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <ShieldAlert
          size={16}
          className={
            isResolved
              ? approval.status === "approved"
                ? "text-blue-400"
                : "text-red-400"
              : "text-purple-400"
          }
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium th-text-secondary truncate">
            {approval.action || t("actionRequiresApproval")}
          </p>
          {approval.description && (
            <p className="text-[11px] th-text-muted truncate">{approval.description}</p>
          )}
        </div>
        {isResolved && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              approval.status === "approved"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {approval.status === "approved" ? t("approved") : t("rejected")}
          </span>
        )}
      </div>

      {/* Expandable details */}
      {approval.details && (
        <div className="px-3 pb-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] th-text-faint hover:th-text-muted transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {t("details")}
          </button>
          {expanded && (
            <pre className="mt-1 p-2 th-bg-surface rounded-lg text-[11px] th-text-muted overflow-x-auto whitespace-pre-wrap">
              {typeof approval.details === "string"
                ? approval.details
                : JSON.stringify(approval.details, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Action buttons */}
      {isPending && (
        <div className="px-3 py-2 border-t th-border-secondary">
          {showModify ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={modifyText}
                onChange={(e) => setModifyText(e.target.value)}
                placeholder={t("modifiedInstructionsPlaceholder")}
                className="flex-1 px-2 py-1 glass-input focus:outline-none focus:border-purple-500/50"
              />
              <button
                onClick={() => {
                  onModify?.(approval.id, modifyText);
                  setShowModify(false);
                }}
                className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-lg hover:bg-purple-500/30 transition-colors"
              >
                {t("send")}
              </button>
              <button
                onClick={() => setShowModify(false)}
                className="px-2 py-1 th-text-faint text-xs hover:th-text-muted transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove?.(approval.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 text-blue-300 text-xs rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <CheckCircle2 size={14} />
                {t("approve")}
              </button>
              <button
                onClick={() => onReject?.(approval.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-300 text-xs rounded-lg hover:bg-red-500/30 transition-colors"
              >
                <XCircle size={14} />
                {t("reject")}
              </button>
              <button
                onClick={() => setShowModify(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 th-bg-surface th-text-muted text-xs rounded-lg hover:th-bg-surface-hover hover:th-text-secondary transition-colors"
              >
                <Edit3 size={14} />
                {t("modify")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
