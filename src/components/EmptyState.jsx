"use client";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  className = ""
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl th-bg-surface flex items-center justify-center mb-5">
          <Icon className="w-8 h-8 th-text-faint" />
        </div>
      )}
      <h3 className="text-base font-semibold th-text mb-2">{title}</h3>
      {description && (
        <p className="text-sm th-text-muted max-w-sm mb-6">{description}</p>
      )}
      {action && actionLabel && (
        <button
          onClick={action}
          className="btn-brand px-5 py-2.5 rounded-xl text-sm font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
