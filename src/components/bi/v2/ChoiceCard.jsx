"use client";

/** Radio card: icon, title, subtitle, optional badge; `actions` sit beside the card, outside its label. */
export default function ChoiceCard({ icon: Icon, selected, title, subtitle, badge, actions, onSelect }) {
  return (
    <div className="flex items-stretch gap-2">
      <label
        className={`flex flex-1 min-w-0 items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-400/60 ${
          selected ? "bg-brand/10 border-brand/40" : "th-bg-surface th-border hover:th-bg-surface-hover"
        }`}
      >
        <input type="radio" className="sr-only" checked={selected} onChange={onSelect} />
        <Icon size={20} className="shrink-0 mt-0.5 th-text-secondary" aria-hidden="true" />
        <span className="min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="block font-semibold th-text truncate">{title}</span>
            {badge && (
              <span className="shrink-0 rounded-full border th-border px-2 py-0.5 text-[10px] font-semibold th-text-secondary">
                {badge}
              </span>
            )}
          </span>
          {subtitle && <span className="block text-xs th-text-muted">{subtitle}</span>}
        </span>
      </label>
      {actions}
    </div>
  );
}
