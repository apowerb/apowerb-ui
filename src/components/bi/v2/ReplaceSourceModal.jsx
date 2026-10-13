"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import { getDashboardSourceRequirements, listBiDatasets, replaceDashboardSource } from "@/lib/api";
import { BTN_PRIMARY_CLS } from "./editor/fields";
import ModalShell, { CancelButton } from "./ModalShell";
import DatasetPicker from "./DatasetPicker";
import DatasetPreviewTable from "./DatasetPreviewTable";
import { ColumnMapper, ErrorList } from "./formParts";
import { useDatasetPreview } from "./useDatasetPreview";
import { mappingBody, prefillMapping, submitErrors } from "./templateLib";

/** Swap the file behind a dashboard, keeping its title, status and blocks. */
export default function ReplaceSourceModal({ dashboardId, onClose, onDone }) {
  const t = useTranslations("biTemplate");
  const toast = useToast();
  const { user } = useAuth();
  const organizationId = user?.email?.split("@")[1] || "default";

  const [requirements, setRequirements] = useState(null);
  const [datasets, setDatasets] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([getDashboardSourceRequirements(dashboardId), listBiDatasets(organizationId)])
      .then(([reqs, ds]) => {
        if (!alive) return;
        setRequirements(reqs);
        setDatasets(ds?.datasets || []);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [dashboardId, organizationId]);

  const preview = useDatasetPreview(datasetId, organizationId);
  const dataset = datasets?.find((d) => d.file_id === datasetId) || null;
  const columns = useMemo(() => requirements?.columns || [], [requirements]);
  const names = useMemo(() => preview.columns?.map((c) => c.name) || null, [preview.columns]);
  const types = useMemo(() => new Map((preview.columns || []).map((c) => [c.name, c.type])), [preview.columns]);
  const mapping = useMemo(
    () => (names ? { ...prefillMapping(columns, names), ...overrides } : {}),
    [columns, names, overrides],
  );
  const missingRequired = columns.some((c) => c.required && !mapping[c.key]);
  const canSubmit = !!names && !missingRequired && !submitting;

  async function submit() {
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await replaceDashboardSource(dashboardId, {
        dataset_id: datasetId,
        columns: mappingBody(columns, mapping),
      });
      toast.success(t("sourceReplaced"));
      onDone(res.dashboard);
      onClose();
    } catch (e) {
      setErrors(submitErrors(e, t("sourceFailed")));
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={t("sourceTitle")}
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} label={t("cancel")} />
          <button type="button" disabled={!canSubmit} onClick={submit} className={BTN_PRIMARY_CLS + " !text-sm !px-4 !py-2"}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {t("sourceSubmit")}
          </button>
        </>
      }
    >
      {loadError && (
        <p role="alert" className="text-sm text-red-400">
          {t("loadFailed", { message: loadError })}
        </p>
      )}
      {!loadError && !(requirements && datasets) && (
        <p className="flex items-center gap-2 text-sm th-text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("loading")}
        </p>
      )}
      {requirements && datasets && (
        <>
          <p className="text-sm th-text-secondary">{t("sourceIntro", { source: requirements.source })}</p>
          <DatasetPicker
            datasets={datasets}
            selectedId={datasetId}
            onSelect={(id) => {
              setDatasetId(id);
              setOverrides({});
            }}
            legend={t("chooseNewDataset")}
          />
        </>
      )}
      {datasetId && preview.loading && (
        <p className="flex items-center gap-2 text-sm th-text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("loading")}
        </p>
      )}
      {preview.error && (
        <p role="alert" className="text-sm text-red-400">
          {t("loadFailed", { message: preview.error })}
        </p>
      )}
      {names && (
        <>
          <p className="text-sm th-text-secondary">{t("mapIntroSource")}</p>
          <ColumnMapper
            columns={columns}
            options={names}
            types={types}
            mapping={mapping}
            onChange={(key, v) => setOverrides((o) => ({ ...o, [key]: v }))}
          />
          <DatasetPreviewTable name={dataset?.filename} columns={preview.columns} rows={preview.rows} />
        </>
      )}
      <ErrorList title={t("sourceFailed")} errors={errors} />
    </ModalShell>
  );
}
