"use client";

import { useState } from "react";
import { X, Wand2, GitBranch } from "lucide-react";
import { useTranslations } from "use-intl";
import { createNode } from "@/lib/workflowGraph";

function blankTemplate() {
  return { version: 1, nodes: [createNode("trigger", { id: "trigger1" })], edges: [] };
}

function routedTemplate() {
  const trigger = createNode("trigger", { id: "trigger1", position: { x: 0, y: 0 } });
  const tool = createNode("tool", { id: "tool1", position: { x: 240, y: 0 } });
  const router = createNode("router", { id: "router1", position: { x: 480, y: 0 } });
  router.config = { rules: [{ route: "a", field: "{{tool1.status}}", op: "eq", value: "ok" }], default_route: "b" };
  const agentA = createNode("agent", { id: "agentA", position: { x: 720, y: -90 } });
  const agentB = createNode("agent", { id: "agentB", position: { x: 720, y: 90 } });
  return {
    version: 1,
    nodes: [trigger, tool, router, agentA, agentB],
    edges: [
      { source: "trigger1", target: "tool1" },
      { source: "tool1", target: "router1" },
      { source: "router1", target: "agentA", route: "a" },
      { source: "router1", target: "agentB", route: "b" },
    ],
  };
}

export default function CreateWorkflowModal({ onClose, onCreate, creating, error }) {
  const t = useTranslations("WorkflowsPage");
  const [template, setTemplate] = useState("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const graph = template === "template" ? routedTemplate() : blankTemplate();
    onCreate({ name: name.trim(), description: description.trim() || undefined, graph });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md rounded-2xl th-bg-modal border th-border-secondary shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold th-text">{t("createModalTitle")}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg th-text-ghost hover:th-text">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTemplate("blank")}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${template === "blank" ? "border-brand bg-brand/10" : "th-border-secondary th-bg-surface hover:th-bg-surface-hover"}`}
          >
            <Wand2 size={16} className="mt-0.5 shrink-0 text-[#5B8AFF]" />
            <span>
              <span className="block text-xs font-semibold th-text">{t("createBlank")}</span>
              <span className="block text-[11px] th-text-ghost mt-0.5">{t("createBlankDesc")}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTemplate("template")}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${template === "template" ? "border-brand bg-brand/10" : "th-border-secondary th-bg-surface hover:th-bg-surface-hover"}`}
          >
            <GitBranch size={16} className="mt-0.5 shrink-0 text-[#5B8AFF]" />
            <span>
              <span className="block text-xs font-semibold th-text">{t("createTemplate")}</span>
              <span className="block text-[11px] th-text-ghost mt-0.5">{t("createTemplateDesc")}</span>
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="w-full px-3 py-2 text-sm rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg th-bg-surface border th-border-secondary th-text placeholder:th-text-ghost focus:outline-none focus:ring-1 focus:ring-brand resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{t("createFailed", { message: error })}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium rounded-lg th-text-secondary hover:th-bg-surface-hover">
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-linear-to-r from-brand to-brand-secondary text-white hover:opacity-90 disabled:opacity-50"
          >
            {creating ? t("creating") : t("create")}
          </button>
        </div>
      </form>
    </div>
  );
}
