/** Parse hub timestamps ("YYYY-MM-DD HH:MM:SS", non-ISO) into a sortable epoch; 0 if unparseable. */
export function hubTime(value) {
  if (!value) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(value));
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const t = Date.parse(String(value));
  return Number.isNaN(t) ? 0 : t;
}

/** Comparators for the marketplace (HubBrowser) sort control. */
export const HUB_SORTERS = {
  "name-asc": (a, b) =>
    (a.hub_name || "").localeCompare(b.hub_name || "", undefined, { sensitivity: "base" }),
  "name-desc": (a, b) =>
    (b.hub_name || "").localeCompare(a.hub_name || "", undefined, { sensitivity: "base" }),
  recent: (a, b) =>
    hubTime(b.published_at || b.created_at) - hubTime(a.published_at || a.created_at),
  oldest: (a, b) =>
    hubTime(a.published_at || a.created_at) - hubTime(b.published_at || b.created_at),
};
