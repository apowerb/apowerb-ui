"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  Target,
  Scale,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Hash,
  Clock,
  Inbox,
  ShieldAlert,
} from "lucide-react";
import { resolveTone } from "@/lib/chart-tokens";

/**
 * Map of icon names (set in the chart config as `cfg.icon`) to actual
 * lucide-react components. Keep the set small and pre-imported so the
 * Next.js bundle doesn't pay for the entire lucide tree. Extend as
 * new dashboard widgets need new glyphs.
 */
const ICON_MAP = {
  mail: Mail,
  target: Target,
  scale: Scale,
  help: HelpCircle,
  alert: AlertTriangle,
  check: CheckCircle2,
  activity: Activity,
  hash: Hash,
  clock: Clock,
  inbox: Inbox,
  shield: ShieldAlert,
};

/**
 * Visual presets for the KPI tile.
 *
 * Two coordinate systems coexist for backward compatibility:
 *   - ``tone`` (preferred) — semantic intent: success / warning / danger
 *     / info / neutral. Either passed explicitly, or derived from a
 *     numeric value + thresholds via ``resolveTone`` in chart-tokens.
 *   - ``color`` (legacy) — raw palette keys like purple / blue / green
 *     that older chart configs still use. Mapped onto the tone palette
 *     below so the visual stays consistent.
 */
const TONE_PRESETS = {
  success: { bg: "from-emerald-500/20 to-emerald-600/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  warning: { bg: "from-amber-500/20 to-amber-600/10",     text: "text-amber-400",   border: "border-amber-500/30"   },
  danger:  { bg: "from-red-500/20 to-red-600/10",         text: "text-red-400",     border: "border-red-500/30"     },
  info:    { bg: "from-blue-500/20 to-blue-600/10",       text: "text-blue-400",    border: "border-blue-500/30"    },
  neutral: { bg: "from-[var(--bg-surface)] to-[var(--bg-surface)]", text: "th-text", border: "th-border"            },
  // `muted` = BI tone (grey, matches charts non_rapproche #6b7280); NOT the th-text-muted CSS utility.
  muted:   { bg: "from-gray-500/20 to-gray-600/10",       text: "text-gray-400",   border: "border-gray-500/30"   },
};

const LEGACY_COLOR_TO_TONE = {
  purple: "info",
  blue: "info",
  green: "success",
  orange: "warning",
  red: "danger",
  cyan: "info",
  pink: "info",
  default: "neutral",
};

function getTonePreset({ tone, color, thresholds, value }) {
  // Priority: explicit thresholds > explicit tone > legacy color > neutral.
  if (thresholds) {
    const computed = resolveTone(value, thresholds);
    return TONE_PRESETS[computed] || TONE_PRESETS.neutral;
  }
  if (tone && TONE_PRESETS[tone]) return TONE_PRESETS[tone];
  if (color && LEGACY_COLOR_TO_TONE[color]) {
    return TONE_PRESETS[LEGACY_COLOR_TO_TONE[color]];
  }
  return TONE_PRESETS.neutral;
}

function formatValue(value, format) {
  if (value == null || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num)) return String(value);

  if (format === "compact") {
    if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  }
  if (format === "decimal2") return num.toFixed(2);
  if (format === "decimal1") return num.toFixed(1);
  if (format === "integer") return Math.round(num).toLocaleString();
  if (format === "percent") return `${(num * 100).toFixed(1)}`;

  // default: locale string with smart decimals
  return Number.isInteger(num) ? num.toLocaleString() : num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getTrendColor(direction, sentiment) {
  if (sentiment === "positive" && direction === "up") return "text-emerald-400";
  if (sentiment === "negative" && direction === "down") return "text-emerald-400";
  if (sentiment === "negative" && direction === "up") return "text-red-400";
  if (sentiment === "positive" && direction === "down") return "text-red-400";
  return "th-text-faint";
}

function TrendIcon({ direction, className }) {
  if (direction === "up") return <TrendingUp size={16} className={className} />;
  if (direction === "down") return <TrendingDown size={16} className={className} />;
  return <Minus size={16} className={className} />;
}

/**
 * StatCard — flexible KPI tile.
 *
 * Props:
 *   value:           number | string
 *   label:           string (title under the value)
 *   unit:            string (suffix, e.g. "%", "ms")
 *   prefix:          string (prefix, e.g. "$", "€")
 *   format:          "compact" | "decimal2" | "decimal1" | "integer" | "percent" | null
 *   tone:            "success" | "warning" | "danger" | "info" | "neutral" | "muted"
 *   thresholds:      { warning, danger, direction? }
 *   color:           legacy palette key — only used when neither tone
 *                    nor thresholds are provided.
 *   secondaryValue:  optional second value rendered as "value / secondary"
 *                    (Conformes / Non conformes pattern)
 *   secondaryTone:   tone for secondaryValue. Defaults to "warning"
 *                    so a "X conformes / Y non conformes" reads
 *                    intuitively green / amber.
 *   secondaryFormat: format for secondaryValue (defaults to format)
 *   description:     string (secondary text under label)
 *   trend:           { direction, sentiment, value, is_percentage, label }
 */
export default function StatCard({
  value,
  label,
  unit,
  prefix,
  format,
  tone,
  thresholds,
  color,
  icon,
  secondaryValue,
  secondaryTone,
  secondaryFormat,
  description,
  trend,
}) {
  const palette = getTonePreset({ tone, color, thresholds, value });
  const formattedValue = formatValue(value, format);

  const hasSecondary =
    secondaryValue !== undefined && secondaryValue !== null && secondaryValue !== "";
  const secondaryPalette = hasSecondary
    ? getTonePreset({
        tone: secondaryTone || "warning",
        thresholds: null,
        value: secondaryValue,
      })
    : null;
  const formattedSecondary = hasSecondary
    ? formatValue(secondaryValue, secondaryFormat || format)
    : null;

  // Resolve the icon component from the icon key (set in cfg.icon). Falls
  // back to no icon if the key is unknown or missing — never crash.
  const IconComponent = icon && ICON_MAP[String(icon).toLowerCase()];

  return (
    <div className={`rounded-xl flex flex-col items-center justify-center p-3 h-full bg-linear-to-br overflow-hidden ${palette.bg} border ${palette.border}`}>
      <div className="flex items-center justify-center gap-2">
        {IconComponent && (
          <IconComponent
            size={20}
            className={`shrink-0 ${palette.text} opacity-80`}
            aria-hidden="true"
          />
        )}
        <p className={`text-3xl font-black leading-none ${palette.text}`}>
          {prefix && <span className="text-2xl font-bold opacity-70 mr-0.5">{prefix}</span>}
          {formattedValue}
          {unit && <span className="text-2xl font-bold opacity-70 ml-1">{unit}</span>}
          {hasSecondary && (
            <>
              <span className="th-text-faint mx-2 text-3xl font-light">/</span>
              <span className={secondaryPalette.text}>{formattedSecondary}</span>
            </>
          )}
        </p>
      </div>
      <p className="text-[11px] th-text-faint mt-0.5 text-center leading-tight">{label}</p>
      {description && (
        <p className="text-[10px] th-text-faint text-center max-w-[200px] leading-tight">{description}</p>
      )}
      {trend && (
        <div className={`flex items-center gap-1 mt-2 ${getTrendColor(trend.direction, trend.sentiment)}`}>
          <TrendIcon direction={trend.direction} className={getTrendColor(trend.direction, trend.sentiment)} />
          <span className="text-xs font-semibold">
            {trend.value != null
              ? `${trend.value}${trend.is_percentage ? "%" : ""}`
              : ""}
          </span>
          {trend.label && (
            <span className="text-xs th-text-faint ml-1">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
