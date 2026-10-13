"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2, LayoutTemplate, Trash2 } from "lucide-react";
import { useRouter } from "@/lib/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import {
  listDashboardTemplates,
  listBiDatasets,
  createDashboardFromTemplate,
  deleteDashboardTemplate,
} from "@/lib/api";
import { INPUT_CLS, BTN_CLS, BTN_PRIMARY_CLS } from "./editor/fields";
import ModalShell, { CancelButton } from "./ModalShell";
import ChoiceCard from "./ChoiceCard";
import DatasetPicker from "./DatasetPicker";
import DatasetPreviewTable from "./DatasetPreviewTable";
import { ColumnMapper, ErrorList, LabelledInput, ParamFields } from "./formParts";
import { useDatasetPreview } from "./useDatasetPreview";
import { autoMap, mappingBody, paramError, paramsBody, submitErrors } from "./templateLib";

export { autoMap };

const STEPS = ["template", "dataset", "columns", "settings"];

export default function TemplateWizard({ onClose }) {
  const t = useTranslations("biTemplate");
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const organizationId = user?.email?.split("@")[1] || "default";

  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState(null);
  const [datasets, setDatasets] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [templateId, setTemplateId] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [title, setTitle] = useState("");
  const [params, setParams] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const template = templates?.find((x) => x.id === templateId) || null;
  const dataset = datasets?.find((d) => d.file_id === datasetId) || null;
  const preview = useDatasetPreview(step >= 2 ? datasetId : null, organizationId);
  const datasetColumns = useMemo(() => preview.columns?.map((c) => c.name) || null, [preview.columns]);
  const types = useMemo(() => new Map((preview.columns || []).map((c) => [c.name, c.type])), [preview.columns]);
  const mapping = useMemo(
    () => (template && datasetColumns ? { ...autoMap(template.columns, datasetColumns), ...overrides } : {}),
    [template, datasetColumns, overrides],
  );

  function selectTemplate(tpl) {
    setTemplateId(tpl.id);
    setTitle(tpl.label);
    setParams(Object.fromEntries((tpl.params || []).map((p) => [p.key, String(p.default ?? "")])));
    setOverrides({});
  }

  function selectDataset(id) {
    setDatasetId(id);
    setOverrides({});
  }

  useEffect(() => {
    let alive = true;
    Promise.all([listDashboardTemplates(), listBiDatasets(organizationId)])
      .then(([tpls, ds]) => {
        if (!alive) return;
        const list = Array.isArray(tpls) ? tpls : tpls?.items || [];
        setTemplates(list);
        setDatasets(ds?.datasets || []);
        if (list.length === 1) selectTemplate(list[0]);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [organizationId]);

  const missingRequired = useMemo(
    () => (template ? template.columns.some((c) => c.required && !mapping[c.key]) : true),
    [template, mapping],
  );
  const paramsInvalid = useMemo(
    () => (template?.params || []).some((p) => paramError(p, params[p.key])),
    [template, params],
  );

  const canNext = [!!template, !!datasetId, !!datasetColumns && !missingRequired, false][step];
  const canCreate = !!title.trim() && !paramsInvalid && !missingRequired && !submitting;

  async function create() {
    const sentTitle = title.trim();
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await createDashboardFromTemplate(template.id, {
        dataset_id: datasetId,
        title: sentTitle,
        columns: mappingBody(template.columns, mapping),
        params: paramsBody(template.params, params),
      });
      if (res?.title && res.title !== sentTitle) toast.info(t("renamedTo", { title: res.title }));
      else toast.success(t("created"));
      router.push(res.url);
      onClose();
    } catch (e) {
      setErrors(submitErrors(e, t("createFailed")));
      setSubmitting(false);
    }
  }

  async function removeTemplate(tpl) {
    setDeletingId(tpl.id);
    try {
      await deleteDashboardTemplate(tpl.id);
      setTemplates((list) => list.filter((x) => x.id !== tpl.id));
      if (templateId === tpl.id) setTemplateId(null);
      setConfirmDeleteId(null);
      toast.success(t("templateDeleted"));
    } catch (e) {
      toast.error(t("deleteFailed", { message: e.message }));
    } finally {
      setDeletingId(null);
    }
  }

  const loading = !loadError && (templates === null || datasets === null);
  const columnsLoading = step === 2 && !loadError && !preview.error && !datasetColumns;

  return (
    <ModalShell
      title={t("title")}
      onClose={onClose}
      subheader={
        <ol className="flex flex-wrap gap-x-4 gap-y-1 mb-4 shrink-0 text-xs font-semibold" aria-label={t("steps")}>
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined} className={i === step ? "text-brand" : "th-text-faint"}>
              {i + 1}. {t(`step_${s}`)}
            </li>
          ))}
        </ol>
      }
      footer={
        <>
          <CancelButton onClick={onClose} label={t("cancel")} />
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => {
                  setErrors([]);
                  setStep(step - 1);
                }}
                className={BTN_CLS + " !text-sm !px-4 !py-2"}
              >
                {t("back")}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setStep(step + 1)}
                className={BTN_PRIMARY_CLS + " !text-sm !px-4 !py-2"}
              >
                {t("next")}
              </button>
            ) : (
              <button type="button" disabled={!canCreate} onClick={create} className={BTN_PRIMARY_CLS + " !text-sm !px-4 !py-2"}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {t("create")}
              </button>
            )}
          </div>
        </>
      }
    >
      {(loadError || preview.error) && (
        <p role="alert" className="text-sm text-red-400">
          {t("loadFailed", { message: loadError || preview.error })}
        </p>
      )}
      {(loading || columnsLoading) && (
        <p className="flex items-center gap-2 text-sm th-text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("loading")}
        </p>
      )}

      {!loading && !loadError && step === 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium th-text mb-2">{t("chooseTemplate")}</legend>
          {templates.length === 0 && <p className="text-sm th-text-muted">{t("noTemplates")}</p>}
          {templates.map((tpl) => (
            <div key={tpl.id} className="space-y-2">
              <ChoiceCard
                icon={LayoutTemplate}
                selected={tpl.id === templateId}
                title={tpl.label}
                subtitle={tpl.description}
                badge={tpl.can_delete ? t("badgeMine") : tpl.origin === "user" ? t("badgeOrganization") : null}
                onSelect={() => selectTemplate(tpl)}
                actions={
                  tpl.can_delete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(tpl.id)}
                      aria-label={t("deleteTemplate", { label: tpl.label })}
                      className="shrink-0 px-3 rounded-xl border th-border th-text-muted hover:text-red-400 hover:border-red-500/40 transition-colors focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )
                }
              />
              {confirmDeleteId === tpl.id && (
                <div
                  role="alertdialog"
                  aria-label={t("deleteTemplate", { label: tpl.label })}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 space-y-2"
                >
                  <p>{t("deleteConfirm", { label: tpl.label })}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deletingId === tpl.id}
                      className={BTN_CLS + " !text-sm !px-3 !py-1.5"}
                    >
                      {t("keep")}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTemplate(tpl)}
                      disabled={deletingId === tpl.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                    >
                      {deletingId === tpl.id && <Loader2 size={14} className="animate-spin" />}
                      {t("delete")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </fieldset>
      )}

      {!loading && !loadError && step === 1 && (
        <DatasetPicker datasets={datasets} selectedId={datasetId} onSelect={selectDataset} legend={t("chooseDataset")} />
      )}

      {step === 2 && datasetColumns && template && (
        <div className="space-y-3">
          <p className="text-sm th-text-secondary">{t("mapIntro")}</p>
          <ColumnMapper
            columns={template.columns}
            options={datasetColumns}
            types={types}
            mapping={mapping}
            onChange={(key, v) => setOverrides((o) => ({ ...o, [key]: v }))}
          />
          <DatasetPreviewTable name={dataset?.filename} columns={preview.columns} rows={preview.rows} />
        </div>
      )}

      {step === 3 && template && (
        <div className="space-y-4">
          <LabelledInput label={t("titleLabel")}>
            {(id) => (
              <input
                id={id}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={INPUT_CLS}
                autoComplete="off"
              />
            )}
          </LabelledInput>
          <ParamFields params={template.params} values={params} onChange={(k, v) => setParams((p) => ({ ...p, [k]: v }))} />
          <ErrorList title={t("createFailed")} errors={errors} />
        </div>
      )}
    </ModalShell>
  );
}
