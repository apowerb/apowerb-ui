"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Bot, Coins, Users, Zap } from "lucide-react";
import { getAdminMetrics } from "@/lib/api";
import { CATEGORICAL_PALETTE } from "@/lib/chart-tokens";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";

const WINDOWS = [7, 30, 90];

/** Thousands separators everywhere, and a short form past a million: a
 *  raw 2 483 119 in a tile is read as "some number", not as a quantity. */
function compact(n) {
  const value = Number(n) || 0;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  return value.toLocaleString();
}

function Tile({ icon: Icon, label, value, hint, tone = "" }) {
  return (
    <div className="th-bg-surface border th-border rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 th-text-muted text-[11px] font-medium">
        <Icon size={13} />
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold th-text ${tone}`}>{value}</div>
      {hint && <div className="text-[11px] th-text-faint mt-0.5">{hint}</div>}
    </div>
  );
}

function Panel({ title, subtitle, children, empty }) {
  return (
    <div className="th-bg-surface border th-border rounded-xl p-4">
      <h3 className="text-sm font-bold th-text">{title}</h3>
      {subtitle && <p className="text-[11px] th-text-faint mt-0.5">{subtitle}</p>}
      <div className="mt-3 h-56">
        {empty ? (
          <div className="h-full flex items-center justify-center text-xs th-text-ghost">
            {empty}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

const AXIS = { stroke: "var(--th-text-faint, #94a3b8)", fontSize: 11 };
const TOOLTIP_STYLE = {
  background: "var(--surface-2)",
  border: "1px solid var(--surface-4)",
  borderRadius: 10,
  fontSize: 12,
};

/** Platform usage. Everything drawn here comes from data that is actually
 *  dated: LLM calls and sessions. Agents are counted, never plotted over
 *  time — `th2agents_store.created_at` is a varchar, and parsing it would
 *  invent a precision the column does not have.
 */
export default function DashboardTab() {
  const t = useTranslations("Admin");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAdminMetrics(days)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <EmptyState title={t("metricsFailed")} description={error} />;
  }

  const totals = data?.totals || {};
  const daily = (data?.daily || []).map((point) => ({
    ...point,
    // Recharts labels the axis with whatever it is given: a bare ISO date
    // on 90 ticks is unreadable.
    label: point.day.slice(5),
    tokens: (point.input_tokens || 0) + (point.output_tokens || 0),
  }));
  const noUsage = daily.every((point) => !point.tokens && !point.sessions);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs th-text-muted">
          {data?.scope === "organization" ? t("metricsScopeOrg") : t("metricsScopePlatform")}
        </p>
        <div className="flex gap-1 p-0.5 rounded-lg th-bg-input border th-border">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                days === w ? "btn-brand" : "th-text-muted hover:th-text"
              }`}
            >
              {t("windowDays", { days: w })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile
          icon={Users}
          label={t("kpiUsers")}
          value={compact(totals.users)}
          hint={t("kpiUsersHint", { active: totals.users_active || 0, days })}
        />
        <Tile
          icon={Bot}
          label={t("kpiAgents")}
          value={compact(totals.agents)}
          hint={t("kpiNeverUsed", { count: totals.never_used || 0 })}
        />
        <Tile
          icon={Activity}
          label={t("kpiSessions")}
          value={compact(totals.sessions)}
          hint={t("kpiInWindow", { days })}
        />
        <Tile
          icon={Zap}
          label={t("kpiCalls")}
          value={compact(totals.llm_calls)}
          hint={t("kpiInWindow", { days })}
        />
        <Tile
          icon={Coins}
          label={t("kpiTokens")}
          value={compact(totals.tokens)}
          hint={t("kpiBilledToPlatform", {
            count: compact(totals.tokens_billed_to_platform),
          })}
        />
      </div>

      <Panel
        title={t("chartTokensTitle")}
        subtitle={t("chartTokensSubtitle")}
        empty={noUsage ? t("noUsageInWindow") : null}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-4)" />
            <XAxis dataKey="label" {...AXIS} minTickGap={24} />
            <YAxis {...AXIS} tickFormatter={compact} width={48} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => Number(v).toLocaleString()}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="input_tokens"
              name={t("seriesInput")}
              stackId="1"
              stroke={CATEGORICAL_PALETTE[0]}
              fill={CATEGORICAL_PALETTE[0]}
              fillOpacity={0.35}
            />
            <Area
              type="monotone"
              dataKey="output_tokens"
              name={t("seriesOutput")}
              stackId="1"
              stroke={CATEGORICAL_PALETTE[1]}
              fill={CATEGORICAL_PALETTE[1]}
              fillOpacity={0.35}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title={t("chartSessionsTitle")}
          subtitle={t("chartSessionsSubtitle")}
          empty={noUsage ? t("noUsageInWindow") : null}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-4)" />
              <XAxis dataKey="label" {...AXIS} minTickGap={24} />
              <YAxis {...AXIS} allowDecimals={false} width={32} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="sessions"
                name={t("kpiSessions")}
                stroke={CATEGORICAL_PALETTE[3]}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel
          title={t("chartModelsTitle")}
          subtitle={t("chartModelsSubtitle")}
          empty={!data?.by_model?.length ? t("noUsageInWindow") : null}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.by_model || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-4)" />
              <XAxis type="number" {...AXIS} tickFormatter={compact} />
              <YAxis type="category" dataKey="label" {...AXIS} width={130} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => Number(v).toLocaleString()}
              />
              <Bar dataKey="tokens" name={t("kpiTokens")} radius={[0, 4, 4, 0]}>
                {(data?.by_model || []).map((_, i) => (
                  <Cell key={i} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <TopTable title={t("topUsersTitle")} rows={data?.top_users} t={t} empty={t("noUsageInWindow")} />
        <TopTable title={t("topAgentsTitle")} rows={data?.top_agents} t={t} empty={t("noUsageInWindow")} />
      </div>
    </div>
  );
}

/** A ranked list beats a pie for eight labelled quantities: the reader
 *  wants the names and the numbers, not the angles. */
function TopTable({ title, rows, t, empty }) {
  const items = rows || [];
  const max = items.reduce((m, r) => Math.max(m, r.tokens || 0), 0) || 1;
  return (
    <div className="th-bg-surface border th-border rounded-xl p-4">
      <h3 className="text-sm font-bold th-text">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs th-text-ghost mt-3">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((row) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="th-text-secondary truncate" title={row.label}>
                  {row.label}
                </span>
                <span className="th-text-muted shrink-0 tabular-nums">
                  {compact(row.tokens)} · {t("callsShort", { count: row.calls })}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full th-bg-input overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (row.tokens / max) * 100)}%`,
                    background: CATEGORICAL_PALETTE[0],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
