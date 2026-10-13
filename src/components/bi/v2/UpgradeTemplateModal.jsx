"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2, LayoutTemplate, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/Toast";
import { getDashboardSourceRequirements, upgradeDashboardFromTemplate } from "@/lib/api";
import { BTN_PRIMARY_CLS } from "./editor/fields";
import ModalShell, { CancelButton } from "./ModalShell";
import ChoiceCard from "./ChoiceCard";
import { ColumnMapper, ErrorList, ParamFields } from "./formParts";
import { autoMap, mappingBody, paramError, paramsBody, submitErrors } from "./templateLib";

/**
 * Rebuild a dashboard from the current version of its template. Without
 * provenance the user picks the template and maps its columns onto the
 * dashboard's own source ("attach and rebuild").
 */
export default function UpgradeTemplateModal({ dashboard, templates, onClose, onDone }) {
  const t = useTranslations("biTemplate");
  const toast = useToast();
  const provenance = dashboard.template || null;
  const attach = !provenance;

  const [templateId, setTemplateId] = useState(null);
  const [source, setSource] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [params, setParams] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!attach) return undefined;
    let alive = true;
    getDashboardSourceRequirements(dashboard.id)
      .then((reqs) => alive && setSource(reqs))
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [attach, dashboard.id]);

  const target = provenance ? templates.find((x) => x.id === provenance.id) : templates.find((x) => x.id === templateId);
  const names = useMemo(() => source?.columns.map((c) => c.current ?? c.key) || null, [source]);
  const types = useMemo(() => new Map((source?.columns || []).map((c) => [c.current ?? c.key, c.type])), [source]);
  const mapping = useMemo(
    () => (attach && target && names ? { ...autoMap(target.columns, names), ...overrides } : {}),
    [attach, target, names, overrides],
  );
  const missingRequired = attach && !!target && target.columns.some((c) => c.required && !mapping[c.key]);
  const paramsInvalid = attach && !!target && (target.params || []).some((p) => paramError(p, params[p.key]));
  const canSubmit = !submitting && (attach ? !!target && !!names && !missingRequired && !paramsInvalid : true);

  function selectTemplate(tpl) {
    setTemplateId(tpl.id);
    setOverrides({});
    setParams(Object.fromEntries((tpl.params || []).map((p) => [p.key, String(p.default ?? "")])));
  }

  async function submit() {
    setSubmitting(true);
    setErrors([]);
    try {
      const body = attach
        ? {
            template_id: target.id,
            columns: mappingBody(target.columns, mapping),
            params: paramsBody(target.params, params),
          }
        : {};
      const res = await upgradeDashboardFromTemplate(dashboard.id, body);
      toast.success(t("upgraded", { version: res.to_version }));
      onDone(res.dashboard);
      onClose();
    } catch (e) {
      setErrors(submitErrors(e, t("upgradeFailed")));
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={attach ? t("attachTitle") : t("upgradeTitle")}
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} label={t("cancel")} />
          <button type="button" disabled={!canSubmit} onClick={submit} className={BTN_PRIMARY_CLS + " !text-sm !px-4 !py-2"}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {attach ? t("attachSubmit") : t("upgradeSubmit")}
          </button>
        </>
      }
    >
      {provenance && (
        <p className="text-sm th-text-secondary">
          {t("upgradeIntro", {
            label: target?.label || provenance.id,
            from: provenance.version,
            to: target?.version ?? provenance.version,
          })}
        </p>
      )}
      {attach && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium th-text mb-2">{t("chooseTemplate")}</legend>
          {templates.length === 0 && <p className="text-sm th-text-muted">{t("noTemplates")}</p>}
          {templates.map((tpl) => (
            <ChoiceCard
              key={tpl.id}
              icon={LayoutTemplate}
              selected={tpl.id === templateId}
              title={tpl.label}
              subtitle={tpl.description}
              onSelect={() => selectTemplate(tpl)}
            />
          ))}
        </fieldset>
      )}
      {loadError && (
        <p role="alert" className="text-sm text-red-400">
          {t("loadFailed", { message: loadError })}
        </p>
      )}
      {attach && target && !names && !loadError && (
        <p className="flex items-center gap-2 text-sm th-text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("loading")}
        </p>
      )}
      {attach && target && names && (
        <>
          <p className="text-sm th-text-secondary">{t("mapIntroAttach", { source: source.source })}</p>
          <ColumnMapper
            columns={target.columns}
            options={names}
            types={types}
            mapping={mapping}
            onChange={(key, v) => setOverrides((o) => ({ ...o, [key]: v }))}
          />
          <ParamFields params={target.params} values={params} onChange={(k, v) => setParams((p) => ({ ...p, [k]: v }))} />
        </>
      )}
      <div
        role="note"
        className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200"
      >
        <TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
        <p>{t("upgradeWarning")}</p>
      </div>
      <ErrorList title={t("upgradeFailed")} errors={errors} />
    </ModalShell>
  );
}
