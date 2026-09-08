/**
 * Chat command registry — the one place that says what the chat can drive.
 *
 * Pure module, no React: the palette (⌘K), the composer's `/` menu and the
 * keyboard shortcuts all read the SAME definitions, so a command added here
 * shows up everywhere at once. Icons are resolved by the UI layer from
 * `iconName`, labels by next-intl from `labelKey` (namespace ChatCommands).
 *
 * A command definition:
 *   id        stable identifier ("new-chat")
 *   group     conversation | agent | compose | navigate | settings
 *   labelKey  i18n key under ChatCommands
 *   descKey   optional i18n key for the one-line description
 *   keywords  extra words that should match (both languages welcome)
 *   slash     name usable as `/name` in the composer (optional)
 *   args      i18n key of the argument hint shown after `/name` (optional)
 *   shortcut  human-readable shortcut, display only ("⌘⇧O")
 *   iconName  lucide icon name resolved by the UI
 *   when      (ctx) => boolean — availability, defaults to always
 *   run       (ctx, args) => void — the action, receives the context built by
 *             useChatCommands and the raw argument string from `/name args`
 *   insert    a template inserted into the composer instead of running
 *             (compose group). `{arg}` is replaced by the slash argument.
 */

export const COMMAND_GROUPS = ["conversation", "agent", "compose", "navigate", "settings"];

const needsSession = (ctx) => !!ctx.activeSession;
const needsAssistantReply = (ctx) =>
  !!ctx.activeSession && (ctx.activeSession.messages || []).some((m) => m.role === "assistant");

export const COMMAND_DEFS = [
  // ── Conversation ──────────────────────────────────────────────
  {
    id: "new-chat",
    group: "conversation",
    labelKey: "newChat",
    descKey: "newChatDesc",
    keywords: ["nouvelle conversation", "new chat", "start", "create"],
    slash: "new",
    shortcut: "⌘⇧O",
    iconName: "Plus",
    run: (ctx) => ctx.newChat?.(),
  },
  {
    id: "rename",
    group: "conversation",
    labelKey: "rename",
    descKey: "renameDesc",
    keywords: ["title", "titre", "renommer"],
    slash: "rename",
    args: "renameArgs",
    iconName: "Pencil",
    when: needsSession,
    run: (ctx, args) => {
      const title = (args || "").trim();
      if (title) ctx.renameSession?.(ctx.activeSession.id, title);
      else ctx.startRename?.();
    },
  },
  {
    id: "pin",
    group: "conversation",
    labelKey: "pin",
    keywords: ["épingler", "favorite", "favori"],
    slash: "pin",
    iconName: "Pin",
    when: needsSession,
    run: (ctx) => ctx.pinSession?.(ctx.activeSession.id, !ctx.activeSession.pinned),
  },
  {
    id: "archive",
    group: "conversation",
    labelKey: "archive",
    keywords: ["archiver", "hide", "masquer"],
    slash: "archive",
    iconName: "Archive",
    when: needsSession,
    run: (ctx) => ctx.archiveSession?.(ctx.activeSession.id, !ctx.activeSession.archived),
  },
  {
    id: "delete",
    group: "conversation",
    labelKey: "delete",
    descKey: "deleteDesc",
    keywords: ["supprimer", "remove", "trash"],
    slash: "delete",
    iconName: "Trash2",
    when: needsSession,
    run: (ctx) => ctx.deleteSession?.(ctx.activeSession.id),
  },
  {
    id: "copy-conversation",
    group: "conversation",
    labelKey: "copyConversation",
    keywords: ["copier", "clipboard", "markdown"],
    slash: "copy",
    iconName: "Copy",
    when: needsSession,
    run: (ctx) => ctx.copyConversation?.(),
  },
  {
    id: "download-md",
    group: "conversation",
    labelKey: "downloadMd",
    descKey: "downloadMdDesc",
    keywords: ["export", "télécharger", "markdown", "save"],
    slash: "export",
    iconName: "Download",
    when: needsSession,
    run: (ctx) => ctx.downloadConversation?.("md"),
  },
  {
    id: "download-json",
    group: "conversation",
    labelKey: "downloadJson",
    descKey: "downloadJsonDesc",
    keywords: ["export", "json", "backup", "sauvegarde"],
    iconName: "FileJson",
    when: needsSession,
    run: (ctx) => ctx.downloadConversation?.("json"),
  },
  {
    id: "share",
    group: "conversation",
    labelKey: "share",
    descKey: "shareDesc",
    keywords: ["partager", "link", "lien", "public"],
    slash: "share",
    iconName: "Share2",
    when: (ctx) => needsSession(ctx) && (ctx.activeSession.messages || []).length > 0,
    run: (ctx) => ctx.shareConversation?.(),
  },
  {
    id: "search-thread",
    group: "conversation",
    labelKey: "searchThread",
    descKey: "searchThreadDesc",
    keywords: ["find", "chercher", "rechercher", "filter"],
    slash: "find",
    args: "findArgs",
    shortcut: "⌘⇧F",
    iconName: "Search",
    when: needsSession,
    run: (ctx, args) => ctx.searchThread?.((args || "").trim()),
  },
  {
    id: "regenerate",
    group: "conversation",
    labelKey: "regenerate",
    descKey: "regenerateDesc",
    keywords: ["retry", "again", "régénérer", "refaire"],
    slash: "retry",
    iconName: "RefreshCw",
    when: (ctx) => needsAssistantReply(ctx) && !ctx.isStreaming,
    run: (ctx) => ctx.regenerateLast?.(),
  },
  {
    id: "continue",
    group: "conversation",
    labelKey: "continue",
    descKey: "continueDesc",
    keywords: ["resume", "suite", "poursuivre"],
    slash: "continue",
    iconName: "StepForward",
    when: (ctx) => needsAssistantReply(ctx) && !ctx.isStreaming,
    run: (ctx) => ctx.continueLast?.(),
  },
  {
    id: "stop",
    group: "conversation",
    labelKey: "stop",
    keywords: ["abort", "cancel", "arrêter", "annuler"],
    shortcut: "Esc",
    iconName: "Square",
    when: (ctx) => !!ctx.isStreaming,
    run: (ctx) => ctx.stopStreaming?.(),
  },
  {
    id: "artifacts-panel",
    group: "conversation",
    labelKey: "artifactsPanel",
    descKey: "artifactsPanelDesc",
    keywords: ["artefacts", "code", "files", "fichiers", "canvas"],
    slash: "artifacts",
    iconName: "PanelRight",
    when: (ctx) => needsSession(ctx) && (ctx.artifactCount || 0) > 0,
    run: (ctx) => ctx.toggleArtifacts?.(),
  },

  // ── Agent ─────────────────────────────────────────────────────
  {
    id: "switch-agent",
    group: "agent",
    labelKey: "switchAgent",
    descKey: "switchAgentDesc",
    keywords: ["agent", "changer", "@", "with"],
    slash: "agent",
    args: "agentArgs",
    iconName: "Bot",
    run: (ctx, args) => ctx.switchAgent?.((args || "").trim()),
  },
  {
    id: "reload-agent",
    group: "agent",
    labelKey: "reloadAgent",
    descKey: "reloadAgentDesc",
    keywords: ["refresh", "recharger", "config"],
    slash: "reload",
    iconName: "RotateCw",
    when: needsSession,
    run: (ctx) => ctx.reloadAgent?.(),
  },
  {
    id: "open-agent",
    group: "agent",
    labelKey: "openAgent",
    descKey: "openAgentDesc",
    keywords: ["factory", "edit", "configure", "instructions"],
    iconName: "SquarePen",
    when: needsSession,
    run: (ctx) => ctx.navigate?.("/agents", { select: ctx.activeSession.agentId }),
  },

  // ── Compose (prompt templates) ────────────────────────────────
  {
    id: "tpl-chart",
    group: "compose",
    labelKey: "tplChart",
    descKey: "tplChartDesc",
    keywords: ["graphique", "plot", "visualise", "bar", "line"],
    slash: "chart",
    args: "tplChartArgs",
    iconName: "BarChart3",
    insertKey: "tplChartInsert",
  },
  {
    id: "tpl-table",
    group: "compose",
    labelKey: "tplTable",
    keywords: ["tableau", "grid", "columns"],
    slash: "table",
    args: "tplTableArgs",
    iconName: "Table2",
    insertKey: "tplTableInsert",
  },
  {
    id: "tpl-summary",
    group: "compose",
    labelKey: "tplSummary",
    keywords: ["résumé", "tl;dr", "recap", "bullet"],
    slash: "summary",
    iconName: "ListChecks",
    insertKey: "tplSummaryInsert",
  },
  {
    id: "tpl-steps",
    group: "compose",
    labelKey: "tplSteps",
    keywords: ["plan", "étapes", "how to", "procédure"],
    slash: "steps",
    args: "tplStepsArgs",
    iconName: "ListOrdered",
    insertKey: "tplStepsInsert",
  },
  {
    id: "tpl-translate",
    group: "compose",
    labelKey: "tplTranslate",
    keywords: ["traduire", "language", "langue"],
    slash: "translate",
    args: "tplTranslateArgs",
    iconName: "Languages",
    insertKey: "tplTranslateInsert",
  },
  {
    id: "tpl-email",
    group: "compose",
    labelKey: "tplEmail",
    keywords: ["mail", "courriel", "draft", "rédiger"],
    slash: "email",
    args: "tplEmailArgs",
    iconName: "Mail",
    insertKey: "tplEmailInsert",
  },
  {
    id: "tpl-explain",
    group: "compose",
    labelKey: "tplExplain",
    keywords: ["expliquer", "simple", "eli5", "clarify"],
    slash: "explain",
    args: "tplExplainArgs",
    iconName: "Lightbulb",
    insertKey: "tplExplainInsert",
  },

  // ── Navigate ──────────────────────────────────────────────────
  { id: "go-home", group: "navigate", labelKey: "goHome", keywords: ["accueil", "dashboard", "studio"], slash: "home", iconName: "Home", run: (ctx) => ctx.navigate?.("/") },
  { id: "go-agents", group: "navigate", labelKey: "goAgents", keywords: ["factory", "agents"], slash: "agents", iconName: "Users", run: (ctx) => ctx.navigate?.("/agents") },
  { id: "go-artifacts", group: "navigate", labelKey: "goArtifacts", keywords: ["library", "bibliothèque", "files"], slash: "library", iconName: "FileCode", run: (ctx) => ctx.navigate?.("/artifacts") },
  { id: "go-bi", group: "navigate", labelKey: "goBi", keywords: ["dashboards", "charts", "reporting", "analytics"], slash: "bi", iconName: "BarChart3", run: (ctx) => ctx.navigate?.("/bi") },
  { id: "go-tools", group: "navigate", labelKey: "goTools", keywords: ["tool box", "outils", "mcp"], slash: "tools", iconName: "Wrench", run: (ctx) => ctx.navigate?.("/tool-box") },
  { id: "go-integrations", group: "navigate", labelKey: "goIntegrations", keywords: ["google", "microsoft", "github", "oauth", "connect"], slash: "integrations", iconName: "PlugZap", run: (ctx) => ctx.navigate?.("/integrations") },
  { id: "go-webhooks", group: "navigate", labelKey: "goWebhooks", keywords: ["events", "triggers", "déclencheurs"], slash: "webhooks", iconName: "Webhook", run: (ctx) => ctx.navigate?.("/webhooks") },
  { id: "go-orchestrator", group: "navigate", labelKey: "goOrchestrator", keywords: ["schedule", "planifier", "cron", "runs"], slash: "schedule", iconName: "Calendar", run: (ctx) => ctx.navigate?.("/orchestrator") },
  { id: "go-logging", group: "navigate", labelKey: "goLogging", keywords: ["logs", "traces", "agentops", "monitoring"], slash: "logs", iconName: "ScrollText", when: (ctx) => ctx.isAdmin !== false, run: (ctx) => ctx.navigate?.("/logging") },
  { id: "go-marketplace", group: "navigate", labelKey: "goMarketplace", keywords: ["hub", "store", "publish", "clone"], slash: "marketplace", iconName: "Store", run: (ctx) => ctx.navigate?.("/marketplace") },
  { id: "go-admin", group: "navigate", labelKey: "goAdmin", keywords: ["users", "groups", "permissions", "utilisateurs"], slash: "admin", iconName: "ShieldCheck", when: (ctx) => ctx.isAdmin === true, run: (ctx) => ctx.navigate?.("/admin") },
  { id: "go-help", group: "navigate", labelKey: "goHelp", keywords: ["aide", "docs", "documentation"], slash: "help", iconName: "CircleHelp", run: (ctx) => ctx.navigate?.("/help") },

  // ── Settings ──────────────────────────────────────────────────
  {
    id: "toggle-theme",
    group: "settings",
    labelKey: "toggleTheme",
    keywords: ["dark", "light", "sombre", "clair", "thème"],
    slash: "theme",
    iconName: "SunMoon",
    run: (ctx) => ctx.toggleTheme?.(),
  },
  {
    id: "language",
    group: "settings",
    labelKey: "language",
    descKey: "languageDesc",
    keywords: ["langue", "français", "english", "locale"],
    slash: "lang",
    args: "languageArgs",
    iconName: "Globe",
    run: (ctx, args) => ctx.setLocale?.((args || "").trim().toLowerCase()),
  },
  {
    id: "shortcuts",
    group: "settings",
    labelKey: "shortcuts",
    descKey: "shortcutsDesc",
    keywords: ["keyboard", "clavier", "raccourcis", "hotkeys", "?"],
    slash: "shortcuts",
    shortcut: "⌘/",
    iconName: "Keyboard",
    run: (ctx) => ctx.openShortcuts?.(),
  },
];

/**
 * Bind definitions to a context: resolves labels, drops unavailable commands.
 * `t` is the ChatCommands translator; the labels stay strings so the pure
 * matcher below can rank on them.
 */
export function buildCommands(ctx = {}, t = (k) => k) {
  // Prompt templates hold literal braces ("{arg}", JSON samples) that ICU
  // would try to format: read them raw when the translator allows it.
  const raw = typeof t.raw === "function" ? (k) => t.raw(k) : t;
  return COMMAND_DEFS.filter((def) => (def.when ? def.when(ctx) : true)).map((def) => ({
    id: def.id,
    group: def.group,
    label: t(def.labelKey),
    description: def.descKey ? t(def.descKey) : "",
    argsHint: def.args ? t(def.args) : "",
    keywords: def.keywords || [],
    slash: def.slash || null,
    shortcut: def.shortcut || null,
    iconName: def.iconName || null,
    insert: def.insertKey ? raw(def.insertKey) : null,
    run: (args) => (def.run ? def.run(ctx, args) : undefined),
  }));
}

// ── Matching ────────────────────────────────────────────────────

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Every character of `q` appears in `s`, in order (VS Code style). Cheap and
// forgiving for typos such as "artfact".
function isSubsequence(q, s) {
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] === q[i]) i++;
  }
  return i === q.length;
}

/**
 * Score a command against a query. 0 = no match. Higher = better.
 * Exposed for tests; the palette and the slash menu only sort by it.
 */
export function scoreCommand(cmd, query, { mode = "palette" } = {}) {
  const q = normalize(query);
  if (!q) return 1;
  const slash = normalize(cmd.slash);
  const label = normalize(cmd.label);
  const keywords = (cmd.keywords || []).map(normalize);

  if (mode === "slash") {
    if (!slash) return 0;
    if (slash === q) return 100;
    if (slash.startsWith(q)) return 80;
  } else if (slash === q) {
    return 95;
  }
  if (label === q) return 90;
  if (label.startsWith(q)) return 75;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 65;
  if (label.includes(q)) return 55;
  if (keywords.some((k) => k === q)) return 50;
  if (keywords.some((k) => k.startsWith(q))) return 45;
  if (keywords.some((k) => k.includes(q))) return 40;
  if (slash && slash.startsWith(q)) return 35;
  if (q.length >= 3 && isSubsequence(q, label.replace(/\s+/g, ""))) return 20;
  return 0;
}

/**
 * Filter + rank commands for a query. `mode: "slash"` only returns commands
 * that own a `/name` and ranks the name first; `"palette"` ranks labels first.
 * Ties keep the registry order, which is the display order by group.
 */
export function matchCommands(commands, query, { mode = "palette", limit = 50 } = {}) {
  const scored = [];
  commands.forEach((cmd, idx) => {
    if (mode === "slash" && !cmd.slash) return;
    const score = scoreCommand(cmd, query, { mode });
    if (score > 0) scored.push({ cmd, score, idx });
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.slice(0, limit).map((s) => s.cmd);
}

// ── Slash parsing ───────────────────────────────────────────────

const SLASH_RE = /^\/([a-z][a-z0-9-]*)?(?:\s+([\s\S]*))?$/i;

/**
 * Read a composer draft as a slash command. Returns null unless the draft
 * starts with "/" on its very first character (a "/" later in a sentence, a
 * path such as "/api/agents", or "/ 3" stays plain text).
 *
 * "/"            -> { name: "", args: "" }         (menu with everything)
 * "/ren"         -> { name: "ren", args: "" }      (menu filtered)
 * "/rename Foo"  -> { name: "rename", args: "Foo" }
 */
export function parseSlash(text) {
  if (typeof text !== "string" || !text.startsWith("/")) return null;
  if (text.length > 1 && !/[a-z]/i.test(text[1])) return null;
  const m = text.match(SLASH_RE);
  if (!m) return null;
  return { name: (m[1] || "").toLowerCase(), args: (m[2] || "").trim() };
}

/**
 * Fill a compose template: `{arg}` receives the slash argument; when there is
 * no argument, the placeholder is kept between « » so the user sees where to
 * type and the selection helper can highlight it.
 */
export function fillTemplate(template, args) {
  const arg = (args || "").trim();
  if (!template) return "";
  if (!template.includes("{arg}")) return arg ? `${template} ${arg}` : template;
  return template.replace(/\{arg\}/g, arg || "«…»");
}

/** Cursor range of the first «…» placeholder, so the composer can select it. */
export function placeholderRange(text) {
  const i = typeof text === "string" ? text.indexOf("«…»") : -1;
  return i === -1 ? null : { start: i, end: i + 3 };
}

// ── Recent commands (per browser) ───────────────────────────────

const RECENT_KEY = "th2_chat_recent_commands";
const RECENT_MAX = 6;

export function loadRecentCommandIds(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function recordRecentCommand(id, storage = globalThis.localStorage) {
  if (!id) return [];
  const next = [id, ...loadRecentCommandIds(storage).filter((x) => x !== id)].slice(0, RECENT_MAX);
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage full or unavailable — recents are a convenience, never a failure
  }
  return next;
}
