"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Save, Trash2, ChevronDown } from "lucide-react";
import { useTranslations } from "use-intl";
import { listSavedApiKeys, createSavedApiKey, deleteSavedApiKey } from "@/lib/api";
import ProviderIcon, { extractProvider } from "./ProviderIcon";

/** Strip "provider/" prefix → just the model id */
function stripProvider(model) {
  if (!model) return "";
  const slash = model.indexOf("/");
  return slash > 0 ? model.substring(slash + 1) : model;
}

export default function SavedApiKeySelector({ currentValue, currentModel, currentModelApiBase, onSelect, className = "" }) {
  const t = useTranslations("SavedApiKeySelector");
  const [savedKeys, setSavedKeys] = useState([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const fetchKeys = useCallback(async () => {
    try {
      const keys = await listSavedApiKeys();
      setSavedKeys(Array.isArray(keys) ? keys : []);
    } catch (e) {
      console.error("Failed to load saved API keys:", e);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // close dropdown on click outside
  useEffect(() => {
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (keyId) => {
    setSelectedKeyId(keyId);
    setDropdownOpen(false);
    if (keyId) {
      const key = savedKeys.find((k) => k.api_key_id === keyId);
      if (key) onSelect({
        api_key_value: key.api_key_value,
        model: key.model || null,
        model_api_base: key.model_api_base || null,
      });
    } else {
      onSelect({ api_key_value: "", model: null, model_api_base: null });
    }
  };

  const handleSave = () => {
    if (!currentValue || !currentValue.trim()) return;
    setSaveName(t("defaultKeyName"));
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    if (!saveName.trim()) return;
    setLoading(true);
    try {
      await createSavedApiKey({
        key_name: saveName,
        provider: extractProvider(currentModel) || "unknown",
        api_key_value: currentValue,
        model: currentModel || null,
        model_api_base: currentModelApiBase || null,
      });
      await fetchKeys();
      setShowSaveModal(false);
      setSaveName("");
    } catch (e) {
      console.error("Failed to save API key:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (keyId) => {
    if (!keyId) return;
    if (confirmDeleteId !== keyId) {
      setConfirmDeleteId(keyId);
      return;
    }
    setLoading(true);
    try {
      await deleteSavedApiKey(keyId);
      setSelectedKeyId("");
      setConfirmDeleteId(null);
      onSelect({ api_key_value: "", model: null, model_api_base: null });
      await fetchKeys();
    } catch (e) {
      console.error("Failed to delete API key:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Custom dropdown with provider icons */}
        <div className="relative flex-1 min-w-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => !loading && setDropdownOpen((o) => !o)}
            disabled={loading}
            className="glass-input w-full px-2 py-1.5 rounded-lg text-xs flex items-center gap-1.5 text-left"
          >
            {selectedKeyId ? (() => {
              const sel = savedKeys.find((k) => k.api_key_id === selectedKeyId);
              if (!sel) return <span className="th-text-faint truncate">{t("savedConfigsPlaceholder")}</span>;
              const prov = extractProvider(sel.model) || (sel.provider !== "unknown" ? sel.provider : null);
              return (
                <>
                  {prov && <ProviderIcon provider={prov} size={12} />}
                  <span className="truncate">{sel.key_name}</span>
                  {sel.model && <span className="th-text-faint truncate">({stripProvider(sel.model)})</span>}
                </>
              );
            })() : (
              <span className="th-text-faint truncate">{t("savedConfigsPlaceholder")}</span>
            )}
            <ChevronDown size={12} className="ml-auto shrink-0 th-text-faint" />
          </button>
          {dropdownOpen && (
            <div className="absolute z-50 mt-1 w-full bg-[var(--bg-dropdown)] backdrop-blur-xl rounded-xl shadow-2xl py-1 max-h-48 overflow-y-auto border th-border">
              <button
                type="button"
                onClick={() => handleSelect("")}
                className="w-full px-3 py-2 text-xs text-left th-text-faint hover:th-bg-surface-hover transition-colors"
              >
                {t("savedConfigsPlaceholder")}
              </button>
              {savedKeys.map((k) => {
                const prov = extractProvider(k.model) || (k.provider !== "unknown" ? k.provider : null);
                return (
                  <button
                    key={k.api_key_id}
                    type="button"
                    onClick={() => handleSelect(k.api_key_id)}
                    className={`w-full px-3 py-2 text-xs text-left flex items-center gap-1.5 transition-colors ${
                      selectedKeyId === k.api_key_id ? "th-bg-surface th-text" : "th-text-secondary hover:th-bg-surface-hover"
                    }`}
                  >
                    {prov && <ProviderIcon provider={prov} size={12} />}
                    <span className="truncate font-medium">{k.key_name}</span>
                    {k.model && <span className="th-text-faint truncate">({stripProvider(k.model)})</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {currentValue && currentValue.trim() && (
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="th-text-faint hover:text-blue-400 transition-colors"
            title={t("saveConfigTooltip")}
          >
            <Save size={14} />
          </button>
        )}
        {selectedKeyId && (
          <button
            type="button"
            onClick={() => handleDelete(selectedKeyId)}
            disabled={loading}
            className={`transition-colors ${confirmDeleteId === selectedKeyId ? "text-red-400" : "th-text-faint hover:text-red-400"}`}
            title={confirmDeleteId === selectedKeyId ? t("confirmDeleteTooltip") : t("deleteConfigTooltip")}
          >
            <Trash2 size={14} />
          </button>
        )}
        {confirmDeleteId === selectedKeyId && selectedKeyId && (
          <span className="text-[10px] text-red-400 whitespace-nowrap">{t("confirmQuestion")}</span>
        )}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 th-bg-overlay backdrop-blur-sm flex items-center justify-center z-200"
             onClick={() => setShowSaveModal(false)}>
          <div className="glass-modal rounded-2xl w-full max-w-sm p-6 shadow-2xl"
               onClick={e => e.stopPropagation()}>
            <h3 className="th-text font-semibold mb-4">{t("saveConfigTitle")}</h3>
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder={t("configNamePlaceholder")}
              className="glass-input w-full px-4 py-3 rounded-xl mb-4"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && saveName.trim() && confirmSave()}
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowSaveModal(false)}
                      className="px-4 py-2 rounded-xl th-text-muted hover:th-text transition-colors">
                {t("cancel")}
              </button>
              <button type="button" onClick={confirmSave} disabled={!saveName.trim() || loading}
                      className="px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors">
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
