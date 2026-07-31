/**
 * Helpers de formatage date/heure pour l'affichage.
 *
 * Règle : TOUJOURS afficher en Europe/Paris avec DST géré par Intl
 * (jamais hardcoder +2).
 *
 * Parsing : le backend sérialise les DateTime naïfs (sans timezone) via
 * Python isoformat() → chaîne sans Z ni offset (ex. "2026-05-28T14:30:00").
 * new Date("2026-05-28T14:30:00") les interprète en heure LOCALE du
 * navigateur — incorrect. On ajoute Z si la chaîne n'a pas d'info de
 * timezone pour forcer une interprétation UTC.
 */

const TZ = "Europe/Paris";

/**
 * Normalise une valeur entrante en objet Date.
 * Retourne null si invalide.
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {Date|null}
 */
export function toDate(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Si pas d'info timezone (pas de Z, pas de +HH:MM, pas de -HH:MM à la fin)
    // on ajoute Z pour forcer UTC — correspond au comportement du backend Python
    // qui sérialise ses DateTime naïfs (stockés en UTC) sans suffixe.
    const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(trimmed);
    const normalized = hasOffset ? trimmed : trimmed + "Z";
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Formate date ET heure en fr-FR, timezone Europe/Paris.
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Formate uniquement la date en fr-FR, timezone Europe/Paris.
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Convertit une valeur (datetime UTC naif, ISO, ms, Date) en chaine pour
 * un <input type="datetime-local"> : "YYYY-MM-DDTHH:MM" exprimee en heure
 * LOCALE du navigateur (l'input attend du wall-clock local, pas de l'UTC).
 * Retourne "" si invalide.
 */
export function toDateTimeLocalValue(value) {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
