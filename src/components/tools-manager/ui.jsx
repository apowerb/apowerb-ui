"use client";

import React, { useCallback, useMemo } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { useTranslations } from "use-intl";
import { getCategoryMeta } from "../HelpPage";
import { categoryIcon, humanizeCategory } from "./toolsManagerUtils";

/**
 * Small presentational building blocks shared by the Tool Box tabs, so every
 * tab gets the same toolbar, card surface and button vocabulary.
 */

export function Toolbar({ children }) {
  return <div className="flex flex-wrap items-center gap-2 mb-4">{children}</div>;
}

export function SearchField({ value, onChange, placeholder, label, clearLabel }) {
  return (
    <div className="relative flex-1 min-w-56 max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint pointer-events-none" />
      <input
        type="search"
        aria-label={label || placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && value) onChange(""); }}
        className="w-full h-10 pl-9 pr-9 th-bg-surface border th-border rounded-xl text-sm th-text placeholder-[var(--text-faint)] focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          title={clearLabel}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md th-text-faint hover:th-text hover:bg-white/10 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Native select styled like the search field — keyboard and screen-reader friendly. */
export function SelectField({ value, onChange, options, label }) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none pl-3 pr-9 th-bg-surface border th-border rounded-xl text-sm th-text focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 th-text-faint pointer-events-none" />
    </div>
  );
}

/** Pill-style segmented control for a handful of mutually exclusive filters. */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-10 items-center p-1 gap-0.5 th-bg-surface border th-border rounded-xl">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={`h-full px-3 rounded-lg text-xs font-semibold transition-all ${
              active ? "bg-blue-500/20 text-blue-400 shadow-sm" : "th-text-muted hover:th-text-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ResultCount({ children }) {
  return <span className="text-xs th-text-faint ml-auto tabular-nums whitespace-nowrap">{children}</span>;
}

/** Static card surface (no hover lift — lists should not jiggle under the cursor). */
export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`rounded-2xl border th-border th-bg-surface ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Square icon button with a tooltip; `tone="danger"` for destructive actions. */
export function IconButton({ icon: Icon, label, onClick, tone = "default", ...rest }) {
  const tones = {
    default: "th-text-muted hover:th-text hover:bg-white/10",
    danger: "th-text-muted hover:text-red-400 hover:bg-red-500/10",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${tones[tone]}`}
      {...rest}
    >
      <Icon size={15} />
    </button>
  );
}

export function SecondaryButton({ icon: Icon, children, ...rest }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold th-bg-surface border th-border th-text-secondary hover:th-text hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      {...rest}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function PrimaryButton({ icon: Icon, children, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={`btn-brand inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold shadow-sm ${className}`}
      {...rest}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

/** Small rounded label; `tone` picks one of the theme-aware tints. */
export function Badge({ tone = "neutral", mono = false, children, title }) {
  const tones = {
    neutral: "th-bg-surface th-text-muted border th-border",
    blue: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
    green: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${mono ? "font-mono" : ""} ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Empty / no-result placeholder with an optional call to action. */
export function EmptyPanel({ icon: Icon, title, description, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed th-border">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl th-bg-surface border th-border flex items-center justify-center mb-4">
          <Icon size={26} className="th-text-faint" />
        </div>
      )}
      <h3 className="text-base font-semibold th-text">{title}</h3>
      {description && <p className="text-sm th-text-muted max-w-md mt-1.5">{description}</p>}
      {children && <div className="flex flex-wrap items-center justify-center gap-2 mt-5">{children}</div>}
    </div>
  );
}

/** Translated label, description and icon for a portfolio tool category. */
export function useCategoryInfo() {
  const t = useTranslations("HelpPage");
  const meta = useMemo(() => getCategoryMeta(t), [t]);
  return useCallback((category) => {
    const key = String(category || "").replace(/^tools_/, "");
    return {
      label: meta[key]?.label || humanizeCategory(key),
      description: meta[key]?.description || "",
      Icon: categoryIcon(key),
    };
  }, [meta]);
}
