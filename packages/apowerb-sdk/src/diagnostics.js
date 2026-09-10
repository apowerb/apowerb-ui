/**
 * Ce que l'application se souvient d'elle-même, pour le jour où ça casse.
 *
 * Un utilisateur qui signale un bug décrit ce qu'il a vu ; il ne sait ni
 * quelle requête a échoué, ni avec quel code, ni ce que la console a dit,
 * ni par quels écrans il est passé. Ces quatre choses sont pourtant celles
 * qui permettent de corriger. Ce module les garde en continu, dans des
 * anneaux bornés, pour qu'un signalement parte avec les preuves plutôt
 * qu'avec une promesse de les chercher.
 *
 * Trois règles de conception :
 *
 * - **Borné, toujours.** Ces tampons vivent dans un onglet ouvert des
 *   heures. Chaque anneau a une taille fixe ; rien ne grandit.
 * - **Rien de sensible.** Ni corps de requête, ni en-têtes, ni jeton. On
 *   garde la méthode, le chemin, le code, la durée et l'identifiant de
 *   corrélation — de quoi retrouver la trace serveur, pas de quoi la
 *   rejouer. La query string est expurgée avant d'être conservée.
 * - **Jamais bloquant.** Une erreur dans le journal de diagnostic ne doit
 *   pas casser la requête qu'elle observait.
 */

const MAX_API_CALLS = 20;
const MAX_CONSOLE = 50;
const MAX_TRAIL = 10;

// Valeurs de query string à ne jamais conserver. Même intention que la
// liste côté serveur : on masque, on ne devine pas par préfixe.
const SENSITIVE_PARAMS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "code",
  "id_token",
  "key",
  "password",
  "refresh_token",
  "secret",
  "session",
  "signature",
  "token",
]);

function ring(size) {
  const items = [];
  return {
    push(item) {
      items.push(item);
      if (items.length > size) items.shift();
    },
    all: () => items.slice(),
    clear: () => items.splice(0, items.length),
    get length() {
      return items.length;
    },
  };
}

const apiCalls = ring(MAX_API_CALLS);
const consoleEntries = ring(MAX_CONSOLE);
const trail = ring(MAX_TRAIL);
let lastAction = null;
let consoleHooked = false;

/** Masque la valeur des paramètres sensibles ; garde le chemin intact. */
export function scrubUrl(url) {
  if (!url) return url;
  const [head, query] = String(url).split("?");
  if (!query) return head;
  const kept = query.split("&").map((pair) => {
    const [name] = pair.split("=");
    return SENSITIVE_PARAMS.has(name.toLowerCase())
      ? `${name}=<redacted>`
      : pair;
  });
  return `${head}?${kept.join("&")}`;
}

/**
 * Enregistre un appel d'API terminé.
 *
 * `requestId` vient de l'en-tête `X-Request-ID` de la réponse : le serveur
 * le pose sur chaque réponse justement pour qu'un client puisse le lui
 * rendre. C'est la clé qui ressort les logs serveur du signalement.
 */
export function recordApiCall({
  method,
  path,
  status = null,
  requestId = null,
  durationMs = null,
  error = null,
}) {
  try {
    apiCalls.push({
      method: (method || "GET").toUpperCase(),
      path: scrubUrl(path),
      status,
      request_id: requestId,
      duration_ms: durationMs === null ? null : Math.round(durationMs),
      error: error ? String(error).slice(0, 500) : null,
      at: new Date().toISOString(),
    });
  } catch {
    // Un journal de diagnostic ne casse jamais ce qu'il observe.
  }
}

export function recordConsole({ level, message, source = null }) {
  try {
    consoleEntries.push({
      level: level || "log",
      message: String(message).slice(0, 2000),
      source: source ? scrubUrl(String(source)).slice(0, 500) : null,
      at: new Date().toISOString(),
    });
  } catch {
    /* idem */
  }
}

/**
 * Note un changement d'écran, en fermant la durée passée sur le précédent.
 *
 * Le temps passé est une donnée de diagnostic : trois secondes sur un
 * écran veut dire « traversé », trois minutes veut dire « c'est là que ça
 * s'est joué ».
 */
export function recordNavigation({ route, label = null }) {
  try {
    const now = Date.now();
    const previous = trail.all()[trail.length - 1];
    if (previous && !previous.dwell_ms) {
      previous.dwell_ms = now - previous._enteredAt;
    }
    if (previous && previous.route === route) return;
    trail.push({
      route,
      label,
      at: new Date(now).toISOString(),
      dwell_ms: null,
      _enteredAt: now,
    });
  } catch {
    /* idem */
  }
}

/** Le dernier geste de l'utilisateur : c'est lui qui a déclenché le défaut. */
export function recordAction({ label, kind = "clic", target = null }) {
  if (!label) return;
  lastAction = {
    label: String(label).slice(0, 200),
    kind,
    target: target ? String(target).slice(0, 300) : null,
    at: new Date().toISOString(),
  };
}

/**
 * Branche la capture des erreurs du navigateur.
 *
 * On n'intercepte QUE `console.error` et `console.warn` : `console.log`
 * remplirait l'anneau de bruit et ferait sortir l'erreur cherchée de la
 * fenêtre. Le `console.error` d'origine reste appelé — un outil de
 * diagnostic qui avale les messages qu'il observe est une régression.
 */
export function installBrowserErrorCapture(target = globalThis) {
  if (consoleHooked || !target?.addEventListener) return () => {};
  consoleHooked = true;

  const originals = {};
  for (const level of ["error", "warn"]) {
    const original = target.console?.[level];
    if (!original) continue;
    originals[level] = original;
    target.console[level] = (...args) => {
      recordConsole({
        level,
        message: args
          .map((arg) =>
            arg instanceof Error ? `${arg.name}: ${arg.message}` : String(arg),
          )
          .join(" "),
      });
      original.apply(target.console, args);
    };
  }

  const onError = (event) => {
    recordConsole({
      level: "error",
      message: event?.message || "erreur non identifiée",
      source: event?.filename
        ? `${event.filename}:${event.lineno}:${event.colno}`
        : null,
    });
  };
  const onRejection = (event) => {
    const reason = event?.reason;
    recordConsole({
      level: "error",
      message:
        reason instanceof Error
          ? `${reason.name}: ${reason.message}`
          : `Promesse rejetée : ${String(reason)}`,
    });
  };

  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);

  return () => {
    for (const [level, original] of Object.entries(originals)) {
      target.console[level] = original;
    }
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
    consoleHooked = false;
  };
}

/** L'instantané joint au signalement. */
export function snapshot() {
  const now = Date.now();
  const steps = trail.all().map((step) => ({
    route: step.route,
    label: step.label,
    at: step.at,
    dwell_ms: step.dwell_ms ?? now - step._enteredAt,
  }));
  return {
    api_calls: apiCalls.all(),
    console: consoleEntries.all(),
    navigation_trail: steps,
    last_action: lastAction,
  };
}

/** Remise à zéro — utilisée par les tests et après un envoi réussi. */
export function resetDiagnostics() {
  apiCalls.clear();
  consoleEntries.clear();
  trail.clear();
  lastAction = null;
}

export const DIAGNOSTIC_LIMITS = { MAX_API_CALLS, MAX_CONSOLE, MAX_TRAIL };
