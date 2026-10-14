"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { ChevronDown, LayoutTemplate } from "lucide-react";
import { listDashboardTemplates } from "@/lib/api";
import { useOptionalDashboardData } from "./DashboardDataContext";
import ReplaceSourceModal from "./ReplaceSourceModal";
import SaveAsTemplateModal from "./SaveAsTemplateModal";
import UpgradeTemplateModal from "./UpgradeTemplateModal";
import { isNewerVersion, templateLang } from "./templateLib";

const ITEM_CLS =
  "w-full text-left px-4 py-2.5 text-sm font-medium th-text hover:th-bg-surface-hover focus:outline-none focus-visible:bg-blue-500/20 transition-colors";

/** Template lifecycle actions of a v2 dashboard: replace the file, update to the template, save as template. */
export default function TemplateActionsMenu({ dashboard, onDashboardChange }) {
  const t = useTranslations("biTemplate");
  const data = useOptionalDashboardData();
  const [templates, setTemplates] = useState(null);
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    let alive = true;
    // the update keeps the dashboard language, so compare against templates in that language
    listDashboardTemplates(templateLang(dashboard.locale))
      .then((list) => alive && setTemplates(Array.isArray(list) ? list : list?.items || []))
      .catch(() => alive && setTemplates([]));
    return () => {
      alive = false;
    };
  }, [dashboard.id, dashboard.locale]);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector("[role=menuitem]")?.focus();
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const provenance = dashboard.template || null;
  const latest = provenance ? templates?.find((x) => x.id === provenance.id) : null;
  const canUpgrade = !!latest && isNewerVersion(latest.version, provenance.version);
  const canAttach = !provenance && (templates?.length ?? 0) > 0;

  function choose(name) {
    setOpen(false);
    setModal(name);
  }

  function closeModal() {
    setModal(null);
    buttonRef.current?.focus();
  }

  function changed(next) {
    onDashboardChange(next);
    data?.refresh();
  }

  function onMenuKeyDown(e) {
    const items = [...menuRef.current.querySelectorAll("[role=menuitem]")];
    const at = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("menuLabel")}
        title={t("menuTitle")}
        className="flex items-center gap-2 px-4 py-3 th-bg-surface border th-border hover:th-bg-surface-hover th-text-muted hover:th-text rounded-xl font-bold transition-all"
      >
        <LayoutTemplate size={20} aria-hidden="true" />
        <span className="text-sm hidden md:inline">{t("menuLabel")}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("menuLabel")}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] glass-card rounded-xl border th-border shadow-2xl shadow-black/40 z-50 overflow-hidden"
        >
          <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => choose("replace")}>
            {t("menuReplaceSource")}
          </button>
          {canUpgrade && (
            <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => choose("upgrade")}>
              {t("menuUpgrade")}
            </button>
          )}
          {canAttach && (
            <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => choose("upgrade")}>
              {t("menuAttach")}
            </button>
          )}
          <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => choose("save")}>
            {t("menuSave")}
          </button>
        </div>
      )}
      {modal === "replace" && <ReplaceSourceModal dashboardId={dashboard.id} onClose={closeModal} onDone={changed} />}
      {modal === "upgrade" && (
        <UpgradeTemplateModal dashboard={dashboard} templates={templates || []} onClose={closeModal} onDone={changed} />
      )}
      {modal === "save" && <SaveAsTemplateModal dashboard={dashboard} onClose={closeModal} />}
    </div>
  );
}
