"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "use-intl";
import {
  Search,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Hash,
  Table2,
  AreaChart as AreaChartIcon,
  GripVertical,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { listCharts } from "@/lib/api";

function getDropSize(chartType) {
  if (chartType === "stat") return { w: 3, h: 3 };
  if (chartType === "table") return { w: 12, h: 6 };
  return { w: 6, h: 4 };
}

export default function ChartSidebar({ onClose, onDragStart, onDragEnd, usedChartIds }) {
  const t = useTranslations("ChartSidebar");
  const CHART_TYPE_META = {
    bar:       { icon: BarChart3,      label: t("chartTypeBar"),       color: "text-blue-400" },
    line:      { icon: LineChartIcon,  label: t("chartTypeLine"),      color: "text-blue-400" },
    pie:       { icon: PieChartIcon,   label: t("chartTypePie"),       color: "text-purple-400" },
    donut:     { icon: PieChartIcon,   label: t("chartTypeDonut"),     color: "text-purple-400" },
    area:      { icon: AreaChartIcon,  label: t("chartTypeArea"),      color: "text-blue-400" },
    scatter:   { icon: BarChart3,      label: t("chartTypeScatter"),   color: "text-purple-400" },
    heatmap:   { icon: BarChart3,      label: t("chartTypeHeatmap"),   color: "text-purple-400" },
    histogram: { icon: BarChart3,      label: t("chartTypeHistogram"), color: "text-indigo-400" },
    table:     { icon: Table2,         label: t("chartTypeTable"),     color: "text-slate-400" },
    stat:      { icon: Hash,           label: t("chartTypeKpi"),       color: "text-purple-400" },
  };
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCharts = useCallback(async () => {
    try {
      // Backend caps page_size at 100 — fetch multiple pages
      let allCharts = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const res = await listCharts({ page, page_size: 100 });
        allCharts = allCharts.concat(res.items || []);
        hasNext = res.has_next;
        page++;
      }
      setCharts(allCharts);
    } catch (err) {
      console.error("Failed to load charts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  const filtered = charts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.title || "").toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.chart_type || "").toLowerCase().includes(q)
    );
  });

  const usedSet = new Set(usedChartIds || []);

  const handleDragStart = (e, chart) => {
    const size = getDropSize(chart.chart_type);
    const payload = JSON.stringify({
      chartId: chart.id,
      chartTitle: chart.title || chart.name,
      chartType: chart.chart_type,
    });
    e.dataTransfer.setData("text/plain", payload);
    e.dataTransfer.effectAllowed = "copy";
    onDragStart?.(size);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
  };

  return (
    <div className="w-[300px] shrink-0 border-l th-border th-bg-surface backdrop-blur-sm flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b th-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold th-text uppercase tracking-wider">{t("chartsLibrary")}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:th-bg-surface-hover th-text-faint transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 th-text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="glass-input w-full pl-9 pr-3 py-2 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Chart list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin th-text-faint" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xs th-text-faint">
              {search ? t("noChartsMatch") : t("noChartsAvailable")}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((chart) => {
              const meta = CHART_TYPE_META[chart.chart_type] || CHART_TYPE_META.bar;
              const Icon = meta.icon;
              const isUsed = usedSet.has(chart.id);

              return (
                <div
                  key={chart.id}
                  draggable
                  unselectable="on"
                  onDragStart={(e) => handleDragStart(e, chart)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-3 p-3 rounded-lg border transition-all select-none ${
                    isUsed
                      ? "th-border bg-white/[0.02] opacity-50"
                      : "border-transparent hover:th-bg-surface hover:th-border cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <GripVertical
                    size={14}
                    className="th-text-faint opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  />
                  <div className={`p-1.5 rounded-md th-bg-surface shrink-0 ${meta.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium th-text truncate">
                      {chart.title || chart.name}
                    </p>
                    <p className="text-xs th-text-faint capitalize">{meta.label}</p>
                  </div>
                  {isUsed && (
                    <Check size={14} className="text-blue-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t th-border">
        <p className="text-xs th-text-faint text-center">
          {t("dragHint")}
        </p>
      </div>
    </div>
  );
}
