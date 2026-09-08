/**
 * Ce que cette installation a configuré, côté écran.
 *
 * Le cœur sert la vérité sur `GET /api/config/setup` (une ligne par capacité :
 * `configured`, `optional`, `blocks`, et — pour un administrateur seulement —
 * les *noms* des variables manquantes, jamais leurs valeurs). Les helpers ci-
 * dessous ne décident rien : ils lisent cette réponse pour qu'un écran puisse
 * dire « pas encore configuré, contactez votre administrateur » au lieu
 * d'échouer.
 *
 * David, 08/09/2026 : un utilisateur non-admin ne doit jamais rencontrer un
 * 4xx/5xx pour une fonctionnalité qui n'est simplement pas installée.
 */

export const NOT_CONFIGURED_CODE = "NOT_CONFIGURED";

/** La ligne de checklist d'une capacité, ou `null` si le serveur ne la sert pas. */
export function capability(status, key) {
  return status?.items?.find((item) => item.key === key) ?? null;
}

/**
 * Une capacité est-elle utilisable ? Une capacité inconnue rend `true` :
 * un serveur plus ancien qui n'annonce pas la ligne ne doit pas faire
 * disparaître un écran qui marchait.
 */
export function isConfigured(status, key) {
  const item = capability(status, key);
  return item ? item.configured : true;
}

/**
 * Les capacités demandées qui manquent vraiment : ni configurées, ni
 * optionnelles. Une capacité optionnelle (le stockage, qui retombe sur un
 * dossier local) n'a rien à bloquer — elle s'affiche ailleurs, en information.
 */
export function missingCapabilities(status, keys) {
  return (status?.items ?? []).filter(
    (item) => keys.includes(item.key) && !item.configured && !item.optional,
  );
}

/**
 * La capacité qui bloque une fonctionnalité nommée (`blocks` du cœur :
 * "outlook_webhooks", "google_integrations", "orchestrator"...), ou `null`.
 */
export function blockerOf(status, feature) {
  return (
    (status?.items ?? []).find(
      (item) => !item.configured && (item.blocks ?? []).includes(feature),
    ) ?? null
  );
}

/**
 * Décode le refus « pas configuré » que le cœur renvoie en 503 :
 * `{"detail": {"code": "NOT_CONFIGURED", "capability": "orchestration"}}`.
 * Rend `null` pour tout le reste — une vraie panne doit rester une panne.
 * Même tolérance que `parseQuotaError` : corps déjà parsé, chaîne JSON, ou
 * texte quelconque.
 */
export function parseNotConfiguredError(status, body) {
  if (status !== 503) return null;

  let payload = body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  const detail = payload?.detail ?? payload;
  if (!detail || detail.code !== NOT_CONFIGURED_CODE) return null;
  return {
    capability: detail.capability ?? null,
    message: detail.message ?? null,
  };
}
