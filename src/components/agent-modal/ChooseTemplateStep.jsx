"use client";

import { useTranslations } from "use-intl";
import { Loader2, Rocket, ArrowRight } from "lucide-react";
import SuperAgentIcon from "./SuperAgentIcon";

export default function ChooseTemplateStep({
  templates,
  loadingTemplates,
  onFromScratch,
  onSelectTemplate,
}) {
  const t = useTranslations("ChooseTemplateStep");

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
      <p className="th-text-muted text-sm text-center">
        {t("prompt")}
      </p>

      {/* From Scratch option */}
      <button
        type="button"
        onClick={onFromScratch}
        className="w-full group relative overflow-hidden rounded-xl border th-border th-bg-surface hover:th-bg-surface-hover hover:th-border-hover transition-all duration-300 p-6 text-left"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-linear-to-br from-blue-500/20 to-blue-400/20 border border-blue-500/30">
            <Rocket size={24} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="th-text font-semibold text-lg">{t("fromScratchTitle")}</h3>
            <p className="th-text-faint text-sm mt-1">
              {t("fromScratchDescription")}
            </p>
          </div>
          <ArrowRight size={20} className="th-text-ghost group-hover:th-text-muted transition-colors" />
        </div>
      </button>

      {/* SuperAgent Templates */}
      <div>
        <h3 className="th-text-secondary text-sm font-semibold mb-3 uppercase tracking-wider">
          {t("superAgentTemplatesHeading")}
        </h3>
        {loadingTemplates ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin th-text-faint" size={24} />
          </div>
        ) : templates.length === 0 ? (
          <p className="th-text-faint text-sm text-center py-4">{t("noTemplatesAvailable")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {templates.map((tpl) => (
              <button
                key={tpl.template_id}
                type="button"
                onClick={() => onSelectTemplate(tpl)}
                className="group relative overflow-hidden rounded-xl border th-border th-bg-surface hover:th-bg-surface-hover hover:border-blue-500/30 transition-all duration-300 p-5 text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-linear-to-br from-blue-500/20 to-blue-400/20 border border-blue-500/30">
                    <SuperAgentIcon iconName={tpl.icon} size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="th-text font-semibold">{tpl.display_name || tpl.name}</h4>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                        SuperAgent
                      </span>
                    </div>
                    <p className="th-text-faint text-sm mt-1 line-clamp-2">{tpl.description}</p>
                    {tpl.tags && tpl.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tpl.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-[10px] th-bg-surface th-text-faint rounded-full border th-border">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ArrowRight size={20} className="th-text-ghost group-hover:text-blue-400 transition-colors shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
