/**
 * Which deployment am I looking at?
 *
 * Every instance shipped the same browser-tab title, so a window holding
 * production, dev and a local server showed three identical tabs. The label
 * comes from the host the request was served on, so one image can run
 * anywhere and still name itself correctly; DEPLOYMENT_LABEL overrides it
 * when the host says nothing useful (a bare IP, a tunnel, a preview URL).
 */

// Words that mark a host as "not production", matched on the host's own
// separators so "development.example.com" counts and "devon.example.com"
// does not.
const NON_PROD = {
  local: /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/,
  dev: /(^|[-.])(dev|development)([-.]|$)/,
  staging: /(^|[-.])(staging|stg)([-.]|$)/,
  preprod: /(^|[-.])(preprod|pre-prod|uat)([-.]|$)/,
  test: /(^|[-.])(test|qa|sandbox)([-.]|$)/,
  preview: /(^|[-.])(preview|pr-\d+)([-.]|$)/,
};

/**
 * @param host  the Host header, with or without a port ("agent-dev.thaink2.fr:3000")
 * @param override  DEPLOYMENT_LABEL, used verbatim when set
 * @returns a short label ("agent-dev", "local"), or "" for production
 */
export function deploymentLabel(host, override) {
  const forced = String(override || "").trim();
  if (forced) return forced;

  const name = String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  if (!name) return "";

  if (NON_PROD.local.test(name)) return "local";

  const kind = Object.keys(NON_PROD).find((k) => k !== "local" && NON_PROD[k].test(name));
  if (!kind) return ""; // production: the plain title, as before

  // The first label carries the identity people recognise ("agent-dev",
  // "dev-apowerb"); it already contains the marker, so it stands alone.
  const first = name.split(".")[0];
  return first.includes(kind) ? first : `${first}-${kind}`;
}

/** "agent-dev · apowerb — …" in dev, the untouched title in production. */
export function titleFor(baseTitle, label) {
  return label ? `${label} · ${baseTitle}` : baseTitle;
}
