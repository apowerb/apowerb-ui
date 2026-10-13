"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import {
  AlertCircle,
  Check,
  Database,
  Filter,
  LayoutGrid,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Undo2,
} from "lucide-react";
import AddBlockPanel from "./AddBlockPanel";
import DataPanel from "./DataPanel";
import FiltersPanel from "./FiltersPanel";
import VisualInspector from "./VisualInspector";
import { ICON_BTN_CLS, TextField } from "./fields";
import { BLOCK_TYPES, getComponent } from "./lib";
import { useSpecEditor } from "./useSpecEditor";

const TABS = [
  { id: "block", icon: LayoutGrid },
  { id: "data", icon: Database },
  { id: "filters", icon: Filter },
  { id: "add", icon: Plus },
];

function SaveStatus({ status }) {
  const t = useTranslations("biEditor");
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs" data-status={status}>
      {status === "saving" && (
        <>
          <Loader2 size={13} className="animate-spin th-text-faint" /> <span className="th-text-muted">{t("saving")}</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check size={13} className="text-emerald-400" /> <span className="text-emerald-400">{t("saved")}</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle size={13} className="text-red-400" /> <span className="text-red-400">{t("saveError")}</span>
        </>
      )}
    </div>
  );
}

/** List of the blocks, shown in the "Block" tab when nothing is selected. */
function BlockList({ dashboard, onSelect }) {
  const t = useTranslations("biEditor");
  const comps = (dashboard.components || []).filter((c) => c.visual);
  if (!comps.length) return <p className="text-sm th-text-muted">{t("noBlocks")}</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs th-text-muted">{t("selectBlockHint")}</p>
      <ul className="space-y-1">
        {comps.map((c) => {
          const Icon = BLOCK_TYPES.find((b) => b.type === c.visual.type)?.icon || LayoutGrid;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect?.(c.id)}
                className="flex w-full items-center gap-2 rounded-lg border th-border px-2.5 py-1.5 text-left text-sm th-text hover:th-bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              >
                <Icon size={15} className="th-text-faint shrink-0" aria-hidden="true" />
                <span className="truncate">{c.visual.title || t(`types.${c.visual.type}`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Right-hand side editor of a spec v2 dashboard.
 *
 * Props:
 *  - dashboard: dashboard JSON ({id, title, sources, filters, components[{id, visual, position}]})
 *  - data: latest DashboardDataResponse (sources[name].fields, ...) or null
 *  - selectedComponentId / onSelectComponent(id|null)
 *  - onDashboardChange(newDashboard): called with the dashboard returned by every save
 *  - controller: optional useSpecEditor() result owned by the parent (its onDashboardChange is used)
 */
export default function SpecEditor({ dashboard, data = null, selectedComponentId = null, onSelectComponent, onDashboardChange, controller = null, tabRequest = null }) {
  const t = useTranslations("biEditor");
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("block");
  // `controller`: a spec editor owned by the screen (shared queue and undo history).
  const own = useSpecEditor({ dashboard, onDashboardChange });
  const sp = controller || own;

  // `tabRequest` = {tab, at}: a new `at` brings that tab forward (New Chart).
  const [prevRequest, setPrevRequest] = useState(tabRequest);
  if (tabRequest !== prevRequest) {
    setPrevRequest(tabRequest);
    if (tabRequest?.tab) {
      setTab(tabRequest.tab);
      setOpen(true);
    }
  }

  // A selection made on the canvas brings the Block tab forward.
  const [prevSelected, setPrevSelected] = useState(selectedComponentId);
  if (selectedComponentId !== prevSelected) {
    setPrevSelected(selectedComponentId);
    if (selectedComponentId) {
      setTab("block");
      setOpen(true);
    }
  }

  const editor = useMemo(
    () => ({
      dashboard,
      data,
      apply: sp.apply,
      dryRun: sp.dryRun,
      error: sp.error,
      onSelect: onSelectComponent,
    }),
    [dashboard, data, sp.apply, sp.dryRun, sp.error, onSelectComponent],
  );

  if (!open) {
    return (
      <div className="shrink-0 border-l th-border th-bg-surface p-1.5">
        <button type="button" className={ICON_BTN_CLS} onClick={() => setOpen(true)} aria-label={t("expand")} title={t("expand")}>
          <PanelRightOpen size={18} />
        </button>
      </div>
    );
  }

  const selected = selectedComponentId ? getComponent(dashboard, selectedComponentId) : null;
  const onKeyTabs = (e) => {
    const i = TABS.findIndex((x) => x.id === tab);
    if (e.key === "ArrowRight") setTab(TABS[(i + 1) % TABS.length].id);
    else if (e.key === "ArrowLeft") setTab(TABS[(i - 1 + TABS.length) % TABS.length].id);
  };

  return (
    <aside aria-label={t("editorTitle")} className="flex h-full w-[380px] max-w-full shrink-0 flex-col border-l th-border th-bg-surface">
      <div className="flex items-center gap-1 border-b th-border px-3 py-2">
        <h2 className="mr-auto text-sm font-bold th-text">{t("editorTitle")}</h2>
        <SaveStatus status={sp.status} />
        <button type="button" className={ICON_BTN_CLS} onClick={sp.undo} disabled={!sp.canUndo} aria-label={t("undo")} title={t("undo")}>
          <Undo2 size={16} />
        </button>
        <button type="button" className={ICON_BTN_CLS} onClick={sp.redo} disabled={!sp.canRedo} aria-label={t("redo")} title={t("redo")}>
          <Redo2 size={16} />
        </button>
        <button type="button" className={ICON_BTN_CLS} onClick={() => setOpen(false)} aria-label={t("collapse")} title={t("collapse")}>
          <PanelRightClose size={16} />
        </button>
      </div>

      {sp.error && (
        <div role="alert" className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{sp.error.message}</span>
        </div>
      )}

      <div role="tablist" aria-label={t("editorTitle")} className="flex border-b th-border px-2 pt-1" onKeyDown={onKeyTabs}>
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`biEditorTab-${id}`}
            aria-selected={tab === id}
            aria-controls="biEditorPanel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
              tab === id ? "border-blue-500 th-text" : "border-transparent th-text-muted hover:th-text"
            }`}
          >
            <Icon size={14} aria-hidden="true" /> {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      <div id="biEditorPanel" role="tabpanel" aria-labelledby={`biEditorTab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "block" && (
          <div className="space-y-4">
            {selected ? (
              <>
                <button type="button" className="text-xs th-text-muted underline hover:th-text" onClick={() => onSelectComponent?.(null)}>
                  {t("backToBlocks")}
                </button>
                <VisualInspector key={selected.id} editor={editor} componentId={selected.id} />
              </>
            ) : (
              <>
                <TextField
                  label={t("dashboardTitle")}
                  value={dashboard.title}
                  error={sp.error?.field === "dashboard_title" ? sp.error.message : null}
                  onCommit={(v) => v.trim() && sp.apply([{ op: "set_title", title: v.trim(), description: dashboard.description ?? null }], { field: "dashboard_title" })}
                />
                <BlockList dashboard={dashboard} onSelect={onSelectComponent} />
              </>
            )}
          </div>
        )}
        {tab === "data" && <DataPanel editor={editor} />}
        {tab === "filters" && <FiltersPanel editor={editor} />}
        {tab === "add" && (
          <AddBlockPanel
            editor={editor}
            onNeedSource={() => setTab("data")}
          />
        )}
      </div>
    </aside>
  );
}

export { SpecEditor };
