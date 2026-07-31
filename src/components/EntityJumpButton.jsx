"use client";

import { useRouter } from "@/lib/navigation";
import {
  MessageSquare,
  User,
  PlugZap,
  Wrench,
  Webhook,
  BarChart3,
  Store,
  ArrowUpRight,
} from "lucide-react";
import { buildJumpUrl } from "@/lib/jumps";

const KIND_META = {
  chat:         { Icon: MessageSquare, tooltip: "Open in chat",          color: "hover:text-brand hover:bg-brand/10"           },
  agent:        { Icon: User,          tooltip: "Open agent",            color: "hover:text-purple-400 hover:bg-purple-500/10" },
  integrations: { Icon: PlugZap,       tooltip: "Open integrations",     color: "hover:text-blue-400 hover:bg-blue-500/10"     },
  tools:        { Icon: Wrench,        tooltip: "Open tool box",         color: "hover:text-blue-400 hover:bg-blue-500/10"     },
  webhooks:     { Icon: Webhook,       tooltip: "Open webhooks",         color: "hover:text-blue-400 hover:bg-blue-500/10"     },
  bi:           { Icon: BarChart3,     tooltip: "Open BI",               color: "hover:text-blue-400 hover:bg-blue-500/10"     },
  marketplace:  { Icon: Store,         tooltip: "Open marketplace",      color: "hover:text-blue-400 hover:bg-blue-500/10"     },
  external:     { Icon: ArrowUpRight,  tooltip: "Open",                  color: "hover:text-brand hover:bg-brand/10"           },
};

/**
 * Small icon-only jump button — a coherent pattern across the app.
 *
 * Either pass a "to" kind/params that maps to a route via buildJumpUrl,
 * or pass a custom "href", or pass an "onClick" handler for bespoke logic.
 *
 * Props:
 *   to:       "chat" | "agent" | "integrations" | "tools" | ...
 *   params:   extra query params for the URL
 *   onClick:  overrides "to" routing, called on click (e is passed)
 *   href:     overrides "to" routing with an explicit URL
 *   title:    overrides the default tooltip
 *   size:     icon size (default 13)
 *   className: extra classes appended to the base button classes
 */
export default function EntityJumpButton({
  to,
  params,
  onClick,
  href,
  title,
  size = 13,
  className = "",
  disabled = false,
}) {
  const router = useRouter();
  const meta = KIND_META[to] || KIND_META.external;
  const Icon = meta.Icon;
  const tooltip = title ?? meta.tooltip;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (onClick) return onClick(e);
    const target = href || (to ? buildJumpUrl(to, params) : null);
    if (target) router.push(target);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip}
      className={`p-1.5 rounded-lg th-text-faint transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${meta.color} ${className}`}
    >
      <Icon size={size} />
    </button>
  );
}
