/**
 * Quota mensuel de tokens sur le modèle thaink2 mutualisé.
 *
 * Le backend refuse un run dépassé par un HTTP 402 portant un corps
 * structuré. Sans le décodage ci-dessous, l'utilisateur verrait
 * « HTTP error 402: {"detail":{...} } » — techniquement exact, humainement
 * inutilisable.
 */

export const QUOTA_EXCEEDED_CODE = "QUOTA_EXCEEDED";

/**
 * Extrait les données de quota d'une réponse d'erreur, ou `null` si ce
 * n'en est pas une. Tolère un corps déjà parsé, une chaîne JSON, ou du
 * texte quelconque — une erreur réseau ne doit pas casser le décodage.
 */
export function parseQuotaError(status, body) {
  if (status !== 402) return null;

  let payload = body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  const detail = payload?.detail ?? payload;
  if (!detail || detail.code !== QUOTA_EXCEEDED_CODE) return null;

  return {
    code: detail.code,
    message: detail.message || "",
    usedTokens: detail.used_tokens ?? null,
    limitTokens: detail.limit_tokens ?? null,
    resetsAt: detail.resets_at ?? null,
  };
}

/** Formate un nombre de tokens de façon lisible : 1 234 567 → « 1,2 M ». */
export function formatTokens(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")} k`;
  return String(n);
}
