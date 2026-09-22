"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  TRIGGER_KINDS,
  EMAIL_PROVIDERS,
  FILE_PROVIDERS,
  FORM_FIELD_TYPES,
  TOOL_SCHEMA_FIELD_TYPES,
  WORKFLOW_DONE_ON,
  COMMON_TIMEZONES,
  CRON_PRESETS,
  buildCronFromPreset,
  classifyCron,
  triggerKindChangePatch,
} from "@/lib/workflowTriggers";
import { Field, TextInput, SelectInput } from "./StudioInspector";
import TriggerStatusPanel from "./TriggerStatusPanel";
import TriggerUsageGuide from "./TriggerUsageGuide";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday-first, matches the "weekdaysAt"/"weeklyAt" presets

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-xs th-text-secondary mb-3">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="rounded th-border-secondary" />
      {label}
    </label>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-lg border th-border-secondary ${active ? "th-bg-surface th-text" : "th-text-ghost hover:th-text-secondary"}`}
    >
      {children}
    </button>
  );
}

// --- schedule ----------------------------------------------------------------

function ScheduleFields({ config, patch, t }) {
  const isRecurring = config.cron != null && config.cron !== "";
  const cronInfo = classifyCron(config.cron || "");
  const needsTime = ["dailyAt", "weekdaysAt", "weeklyAt"].includes(cronInfo.preset);

  const applyPreset = (preset) => {
    const hour = cronInfo.hour ?? 9;
    const minute = cronInfo.minute ?? 0;
    const weekday = cronInfo.weekday ?? 1;
    patch({ cron: buildCronFromPreset(preset, { hour, minute, weekday }) });
  };

  return (
    <>
      <Field label={t("scheduleMode")}>
        <div role="tablist" className="flex gap-1.5">
          <ToggleButton active={isRecurring} onClick={() => patch({ cron: "0 9 * * *", at: null })}>
            {t("scheduleModeRecurring")}
          </ToggleButton>
          <ToggleButton active={!isRecurring} onClick={() => patch({ cron: null, at: config.at || new Date(Date.now() + 3600_000).toISOString() })}>
            {t("scheduleModeOnce")}
          </ToggleButton>
        </div>
      </Field>

      {isRecurring ? (
        <>
          <Field label={t("schedulePresets")}>
            <div className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md border th-border-secondary ${cronInfo.preset === preset ? "bg-brand/15 text-[#5B8AFF] border-brand/30" : "th-text-ghost hover:th-text-secondary"}`}
                >
                  {t(`cronPreset_${preset}`)}
                </button>
              ))}
            </div>
          </Field>

          {needsTime && (
            <Field label={t("scheduleTime")}>
              <div className="flex gap-1.5 items-center">
                <TextInput
                  type="number"
                  min={0}
                  max={23}
                  aria-label={t("scheduleHour")}
                  value={cronInfo.hour}
                  onChange={(e) =>
                    patch({ cron: buildCronFromPreset(cronInfo.preset, { hour: Number(e.target.value), minute: cronInfo.minute, weekday: cronInfo.weekday ?? 1 }) })
                  }
                />
                <span className="th-text-ghost">:</span>
                <TextInput
                  type="number"
                  min={0}
                  max={59}
                  aria-label={t("scheduleMinute")}
                  value={cronInfo.minute}
                  onChange={(e) =>
                    patch({ cron: buildCronFromPreset(cronInfo.preset, { hour: cronInfo.hour, minute: Number(e.target.value), weekday: cronInfo.weekday ?? 1 }) })
                  }
                />
                {cronInfo.preset === "weeklyAt" && (
                  <SelectInput
                    aria-label={t("scheduleWeekday")}
                    value={cronInfo.weekday}
                    onChange={(e) => patch({ cron: buildCronFromPreset("weeklyAt", { hour: cronInfo.hour, minute: cronInfo.minute, weekday: Number(e.target.value) }) })}
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>{t(`weekday_${d}`)}</option>
                    ))}
                  </SelectInput>
                )}
              </div>
            </Field>
          )}

          <Field label={t("scheduleCron")} help={t("scheduleCronHelp")}>
            <TextInput value={config.cron || ""} onChange={(e) => patch({ cron: e.target.value })} placeholder="0 9 * * *" />
          </Field>
        </>
      ) : (
        <Field label={t("scheduleAt")}>
          <TextInput
            type="datetime-local"
            value={(config.at || "").slice(0, 16)}
            onChange={(e) => patch({ at: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </Field>
      )}

      <Field label={t("scheduleTimezone")}>
        <SelectInput value={config.timezone || "Europe/Paris"} onChange={(e) => patch({ timezone: e.target.value })}>
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </SelectInput>
      </Field>
    </>
  );
}

// --- email ---------------------------------------------------------------------

function EmailFields({ config, patch, t }) {
  return (
    <>
      <Field label={t("emailProvider")}>
        <SelectInput value={config.provider || "outlook"} onChange={(e) => patch({ provider: e.target.value })}>
          {EMAIL_PROVIDERS.map((p) => (
            <option key={p} value={p}>{t(`emailProvider_${p}`)}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t("emailFromFilter")} help={t("emailFromFilterHelp")}>
        <TextInput value={config.from_filter || ""} onChange={(e) => patch({ from_filter: e.target.value || null })} placeholder={t("emailFromFilterPlaceholder")} />
      </Field>
      <Field label={t("emailSubjectFilter")} help={t("emailSubjectFilterHelp")}>
        <TextInput value={config.subject_filter || ""} onChange={(e) => patch({ subject_filter: e.target.value || null })} placeholder={t("emailSubjectFilterPlaceholder")} />
      </Field>
    </>
  );
}

// --- agent_tool ------------------------------------------------------------------

function SchemaFieldRow({ field, onChange, onRemove, t }) {
  return (
    <div className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <input
          value={field.name || ""}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder={t("schemaFieldName")}
          className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text"
        />
        <select
          value={field.type || "string"}
          onChange={(e) => onChange({ ...field, type: e.target.value })}
          aria-label={t("schemaFieldType")}
          className="px-1.5 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text"
        >
          {TOOL_SCHEMA_FIELD_TYPES.map((ty) => (
            <option key={ty} value={ty}>{t(`schemaFieldType_${ty}`)}</option>
          ))}
        </select>
        <button type="button" onClick={onRemove} title={t("removeSchemaField")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
          <Trash2 size={12} />
        </button>
      </div>
      <input
        value={field.description || ""}
        onChange={(e) => onChange({ ...field, description: e.target.value })}
        placeholder={t("schemaFieldDescription")}
        className="px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text"
      />
      <label className="flex items-center gap-1.5 text-[11px] th-text-secondary">
        <input type="checkbox" checked={!!field.required} onChange={(e) => onChange({ ...field, required: e.target.checked })} />
        {t("schemaFieldRequired")}
      </label>
    </div>
  );
}

function SchemaEditor({ schema, onChange, t }) {
  const update = (i, next) => onChange(schema.map((f, j) => (j === i ? next : f)));
  const remove = (i) => onChange(schema.filter((_, j) => j !== i));
  const add = () => onChange([...schema, { name: "", type: "string", description: "", required: false }]);
  return (
    <div>
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("inputSchema")}</label>
      <div className="flex flex-col gap-2">
        {schema.map((f, i) => (
          <SchemaFieldRow key={i} field={f} onChange={(next) => update(i, next)} onRemove={() => remove(i)} t={t} />
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary"
      >
        <Plus size={12} />
        {t("addSchemaField")}
      </button>
    </div>
  );
}

function AgentToolFields({ config, patch, t }) {
  return (
    <>
      <Field label={t("toolName")} help={t("toolNameHelp")}>
        <TextInput value={config.tool_name || ""} onChange={(e) => patch({ tool_name: e.target.value })} placeholder="get_weather" />
      </Field>
      <Field label={t("toolDescription")}>
        <textarea
          value={config.description || ""}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text resize-y focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </Field>
      <SchemaEditor schema={config.input_schema || []} onChange={(input_schema) => patch({ input_schema })} t={t} />
    </>
  );
}

// --- form --------------------------------------------------------------------

function OptionsEditor({ options, onChange, t }) {
  const opts = options || [];
  const update = (i, v) => onChange(opts.map((o, j) => (j === i ? v : o)));
  const remove = (i) => onChange(opts.filter((_, j) => j !== i));
  const add = () => onChange([...opts, ""]);
  return (
    <div className="mt-1.5">
      <span className="block text-[10px] font-semibold th-text-ghost mb-1">{t("formFieldOptions")}</span>
      <div className="flex flex-col gap-1">
        {opts.map((o, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={o}
              onChange={(e) => update(i, e.target.value)}
              aria-label={t("formFieldOptions")}
              className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text"
            />
            <button type="button" onClick={() => remove(i)} title={t("removeOption")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1 text-[10px] font-medium th-text-ghost hover:th-text-secondary flex items-center gap-1">
        <Plus size={10} />
        {t("addOption")}
      </button>
    </div>
  );
}

function FormFieldRow({ field, onChange, onRemove, t }) {
  return (
    <div className="p-2 rounded-lg th-bg-surface border th-border-secondary flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <input
          value={field.name || ""}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder={t("formFieldName")}
          className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono rounded-md th-bg-elevated border th-border-secondary th-text"
        />
        <input
          value={field.label || ""}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder={t("formFieldLabelField")}
          className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text"
        />
        <button type="button" onClick={onRemove} title={t("removeField")} className="p-1 rounded-md text-red-400 hover:bg-red-500/10 shrink-0">
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <select
          value={field.type || "text"}
          onChange={(e) => onChange({ ...field, type: e.target.value })}
          aria-label={t("formFieldTypeLabel")}
          className="px-1.5 py-1 text-[11px] rounded-md th-bg-elevated border th-border-secondary th-text"
        >
          {FORM_FIELD_TYPES.map((ty) => (
            <option key={ty} value={ty}>{t(`formFieldType_${ty}`)}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] th-text-secondary">
          <input type="checkbox" checked={!!field.required} onChange={(e) => onChange({ ...field, required: e.target.checked })} />
          {t("formFieldRequired")}
        </label>
      </div>
      {field.type === "select" && <OptionsEditor options={field.options} onChange={(options) => onChange({ ...field, options })} t={t} />}
    </div>
  );
}

function FormFieldsEditor({ fields, onChange, t }) {
  const update = (i, next) => onChange(fields.map((f, j) => (j === i ? next : f)));
  const remove = (i) => onChange(fields.filter((_, j) => j !== i));
  const add = () => onChange([...fields, { name: "", label: "", type: "text", required: false, options: null }]);
  return (
    <div>
      <label className="block text-[11px] font-semibold th-text-secondary mb-1.5">{t("formFields")}</label>
      <div className="flex flex-col gap-2">
        {fields.map((f, i) => (
          <FormFieldRow key={i} field={f} onChange={(next) => update(i, next)} onRemove={() => remove(i)} t={t} />
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg th-bg-surface hover:th-bg-surface-hover th-text-secondary border th-border-secondary"
      >
        <Plus size={12} />
        {t("addFormField")}
      </button>
    </div>
  );
}

function FormFields({ config, patch, t }) {
  return (
    <>
      <Field label={t("formTitle")}>
        <TextInput value={config.title || ""} onChange={(e) => patch({ title: e.target.value })} />
      </Field>
      <Field label={t("formDescription")}>
        <textarea
          value={config.description || ""}
          onChange={(e) => patch({ description: e.target.value || null })}
          rows={2}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg th-bg-surface border th-border-secondary th-text resize-y focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </Field>
      <Field label={t("formAccess")} help={t("formAccessHelp")}>
        <SelectInput value={config.access || "authenticated"} onChange={(e) => patch({ access: e.target.value })}>
          <option value="authenticated">{t("formAccess_authenticated")}</option>
          <option value="public">{t("formAccess_public")}</option>
        </SelectInput>
      </Field>
      <FormFieldsEditor fields={config.fields || []} onChange={(fields) => patch({ fields })} t={t} />
    </>
  );
}

// --- file ----------------------------------------------------------------------

// No folder browser exists yet for either provider in this repo (the
// existing OneDrive/Google Drive pickers select *files*, not folders) — the
// contract's fallback applies: a plain id + a human label the person types
// themselves, good enough until a dedicated folder picker lands.
function FileFields({ config, patch, t }) {
  return (
    <>
      <Field label={t("fileProvider")}>
        <SelectInput value={config.provider || "onedrive"} onChange={(e) => patch({ provider: e.target.value, folder_id: "", folder_label: "" })}>
          {FILE_PROVIDERS.map((p) => (
            <option key={p} value={p}>{t(`fileProvider_${p}`)}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t("fileFolder")} help={t("fileFolderHelp")}>
        <TextInput value={config.folder_id || ""} onChange={(e) => patch({ folder_id: e.target.value })} placeholder={t("fileFolderIdPlaceholder")} />
      </Field>
      <Field label={t("fileFolderLabel")}>
        <TextInput value={config.folder_label || ""} onChange={(e) => patch({ folder_label: e.target.value })} placeholder={t("fileFolderLabelPlaceholder")} />
      </Field>
      <Field label={t("fileInterval")} help={t("fileIntervalHelp")}>
        <TextInput
          type="number"
          min={5}
          max={1440}
          value={config.interval_min ?? 15}
          onChange={(e) => patch({ interval_min: e.target.value === "" ? "" : Number(e.target.value) })}
        />
      </Field>
    </>
  );
}

// --- workflow_done ---------------------------------------------------------------

function WorkflowDoneFields({ config, patch, workflowOptions, t }) {
  return (
    <>
      <Field label={t("workflowDoneTarget")}>
        {workflowOptions.length === 0 ? (
          <p className="text-xs th-text-ghost">{t("workflowDoneNone")}</p>
        ) : (
          <SelectInput value={config.workflow_id || ""} onChange={(e) => patch({ workflow_id: e.target.value })}>
            <option value="">{t("workflowDoneTargetPlaceholder")}</option>
            {workflowOptions.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </SelectInput>
        )}
      </Field>
      <Field label={t("workflowDoneOn")}>
        <SelectInput value={config.on || "success"} onChange={(e) => patch({ on: e.target.value })}>
          {WORKFLOW_DONE_ON.map((o) => (
            <option key={o} value={o}>{t(`workflowDoneOn_${o}`)}</option>
          ))}
        </SelectInput>
      </Field>
    </>
  );
}

/**
 * The trigger node's whole inspector section: the 8-kind selector, the
 * kind-specific form below it, and (once the workflow has an id) the live
 * status panel. Lives outside `StudioInspector.jsx` because the 8 forms
 * together are as big as the rest of that file.
 */
export default function TriggerInspector({ nodeId, config, patch, workflowId, workflowOptions = [], triggerRefreshKey, t }) {
  const kind = config.kind || "manual";
  const [liveState, setLiveState] = useState(null);

  return (
    <>
      <Field label={t("triggerKind")}>
        <SelectInput value={kind} onChange={(e) => patch(triggerKindChangePatch(config, e.target.value))}>
          {TRIGGER_KINDS.map((k) => (
            <option key={k} value={k}>{t(`triggerKind_${k}`)}</option>
          ))}
        </SelectInput>
      </Field>

      {kind === "manual" && <p className="text-xs th-text-ghost mb-3">{t("triggerKindManualHelp")}</p>}
      {kind === "webhook" && <Checkbox checked={config.hmac} onChange={(hmac) => patch({ hmac })} label={t("webhookHmac")} />}
      {kind === "schedule" && <ScheduleFields config={config} patch={patch} t={t} />}
      {kind === "email" && <EmailFields config={config} patch={patch} t={t} />}
      {kind === "agent_tool" && <AgentToolFields config={config} patch={patch} t={t} />}
      {kind === "form" && <FormFields config={config} patch={patch} t={t} />}
      {kind === "file" && <FileFields config={config} patch={patch} t={t} />}
      {kind === "workflow_done" && <WorkflowDoneFields config={config} patch={patch} workflowOptions={workflowOptions} t={t} />}

      <TriggerUsageGuide kind={kind} config={config} workflowId={workflowId} nodeId={nodeId} webhookUrl={liveState?.webhook_url} />

      {workflowId && <TriggerStatusPanel workflowId={workflowId} kind={kind} refreshKey={triggerRefreshKey} onState={setLiveState} t={t} />}
    </>
  );
}
