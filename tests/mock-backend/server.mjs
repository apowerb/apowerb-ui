#!/usr/bin/env node
/**
 * Mock apowerb backend for the chat — no database, no LLM, no network.
 *
 * Serves just enough of the API for the chat screen to run end to end, and
 * scripts the SSE stream from the text of the message so every response
 * state can be reproduced on demand:
 *
 *   "vide"   / "empty"      → a stream with no visible output at all
 *   "partiel"/ "partial"    → a long answer, slow enough to press Stop
 *   "erreur" / "error"      → a backend error event in the middle of the stream
 *   "outils" / "tools"      → thinking → tool call → result → chart → answer
 *   "graph"  / "chart"      → an answer with a ```chart fence
 *   "lent"   / "slow"       → a rate-limit pause event, then the answer
 *   anything else           → a short markdown answer, token by token
 *
 * It also serves the Orchestrator screen: the schedule list, creating one,
 * activating one, and running an agent now. Enough for the journey that
 * broke on 2026-09-08 to be played rather than described.
 *
 * Usage: node tests/mock-backend/server.mjs [port]     (default 8100)
 * Point the front at it: API_URL=http://127.0.0.1:8100 NEXT_PUBLIC_API_URL=http://localhost:8100
 * (real auth mode: any bearer token is accepted, /api/users/me answers a demo user; seed
 * localStorage th2_auth_token / th2_auth_user, or sign in through /api/auth/token below).
 */
import http from "node:http";

const PORT = Number(process.argv[2] || process.env.PORT || 8100);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AGENTS = [
  { agent_id: 1, agent_name: "Analyste", label: "Analyste", agent_description: "Chiffres, tableaux, graphiques", agent_type: "base", agent_model: "mock/instant", tags: "[]" },
  { agent_id: 2, agent_name: "Rédacteur", label: "Rédacteur", agent_description: "E-mails, résumés, traductions", agent_type: "base", agent_model: "mock/instant", tags: "[]" },
  { agent_id: 3, agent_name: "Support Outillé", label: "Support Outillé", agent_description: "Un agent qui appelle des outils", agent_type: "base", agent_model: "mock/instant", tags: "[]" },
];

const sessions = new Map();

// Scheduler state. In memory and per process: every run of the suite starts
// from the same two schedules, so a test never depends on what the one before
// it created.
let nextScheduleId = 3;
const schedules = [
  {
    id: 1,
    agent_id: 1,
    agent_name: "Analyste",
    schedule_interval: "@hourly",
    status: "active",
    start_time: "2026-09-09T06:00:00Z",
    next_run: "2026-09-09T14:00:00Z",
  },
  {
    id: 2,
    agent_id: 2,
    agent_name: "Rédacteur",
    schedule_interval: "@daily",
    status: "inactive",
    start_time: "2026-09-08T06:00:00Z",
    next_run: null,
  },
];
const scheduleRuns = new Map([[1, [
  { id: 101, schedule_id: 1, status: "completed", started_at: "2026-09-09T12:00:00Z", finished_at: "2026-09-09T12:00:12Z" },
]]]);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// ── SSE scripting ──────────────────────────────────────────────────────
function sse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  let closed = false;
  res.on("close", () => (closed = true));
  return {
    send(obj) {
      if (closed) return false;
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
      return true;
    },
    text(t) {
      return this.send({ content: { role: "model", parts: [{ text: t }] } });
    },
    thought(t) {
      return this.send({ content: { role: "model", parts: [{ thought: true, text: t }] } });
    },
    call(name, args) {
      return this.send({ content: { role: "model", parts: [{ functionCall: { name, args } }] } });
    },
    result(name, response) {
      return this.send({ content: { role: "model", parts: [{ functionResponse: { name, response } }] } });
    },
    usage(u) {
      return this.send({ usageMetadata: u });
    },
    end() {
      if (!closed) res.end();
    },
    get closed() {
      return closed;
    },
  };
}

// ADK sends the ACCUMULATED text of the turn on each event; the front dedups
// on that contract, so the mock honours it.
async function streamWords(s, text, { delay = 28 } = {}) {
  const words = text.split(/(\s+)/);
  let acc = "";
  for (const w of words) {
    if (s.closed) return false;
    acc += w;
    if (w.trim()) {
      s.text(acc);
      await sleep(delay);
    }
  }
  return true;
}

const LONG = `# Rapport de synthèse

Voici une réponse volontairement **longue**, envoyée mot à mot, pour laisser le temps d'appuyer sur *Arrêter*.

1. Premier point : la demande est bien reçue et le contexte est chargé.
2. Deuxième point : les données ont été relues ligne par ligne.
3. Troisième point : les écarts ont été classés par gravité.
4. Quatrième point : les hypothèses restantes sont listées ci-dessous.

> Une citation pour vérifier le rendu des blocs.

| Colonne | Valeur |
|---|---|
| Alpha | 12 |
| Beta | 27 |

Et enfin un paragraphe de conclusion qui n'arrivera peut-être jamais si vous avez interrompu la réponse à temps, ce qui est précisément le but de ce scénario de test.`;

const CHART = `Voici les ventes du dernier trimestre :

\`\`\`chart
{"type":"bar","title":"Ventes par mois (k€)","x":"mois","series":["ventes","objectif"],"unit":"k€","data":[{"mois":"Juil.","ventes":42,"objectif":40},{"mois":"Août","ventes":31,"objectif":40},{"mois":"Sept.","ventes":58,"objectif":45}]}
\`\`\`

Septembre dépasse nettement l'objectif après un mois d'août en retrait (saisonnalité habituelle).`;

async function scenario(s, text) {
  const q = (text || "").toLowerCase();
  if (/\b(vide|empty)\b/.test(q)) {
    // Nothing visible at all: the front must render an explicit empty state.
    await sleep(600);
    s.usage({ promptTokenCount: 12, candidatesTokenCount: 0, totalTokenCount: 12 });
    return s.end();
  }
  if (/(partiel|partial)/.test(q)) {
    await streamWords(s, LONG, { delay: 120 });
    s.usage({ promptTokenCount: 30, candidatesTokenCount: 220, totalTokenCount: 250 });
    return s.end();
  }
  if (/\b(erreur|error)\b/.test(q)) {
    await streamWords(s, "Je commence à répondre, puis le fournisseur tombe en", { delay: 60 });
    await sleep(300);
    s.send({ error: "Upstream model error (503): provider unavailable", status: 503, code: 503 });
    return s.end();
  }
  if (/(lent|slow)/.test(q)) {
    s.send({ info: "rate_limit_retry", delay_seconds: 3, attempt: 1, max_attempts: 2 });
    await sleep(3000);
    await streamWords(s, "Merci d'avoir patienté : la limite du fournisseur est passée et voici la réponse complète, rédigée après la pause.");
    s.usage({ promptTokenCount: 20, candidatesTokenCount: 40, totalTokenCount: 60 });
    return s.end();
  }
  if (/\b(outils?|tools?)\b/.test(q)) {
    s.thought("L'utilisateur veut des chiffres. Je dois d'abord interroger la base, puis produire un graphique.");
    await sleep(700);
    s.thought(" Je commence par la requête SQL sur les ventes.");
    await sleep(500);
    s.call("query_sales_db", { table: "sales", period: "2026-Q3", group_by: "month" });
    await sleep(1200);
    s.result("query_sales_db", {
      sql: "SELECT month, SUM(amount) AS total FROM sales WHERE quarter = '2026-Q3' GROUP BY month",
      row_count: 3,
      data: [{ month: "Juillet", total: 42000 }, { month: "Août", total: 31000 }, { month: "Septembre", total: 58000 }],
    });
    await sleep(400);
    s.thought("Trois lignes, cohérentes. Je vérifie maintenant les objectifs avant de tracer.");
    await sleep(500);
    s.call("fetch_targets", { period: "2026-Q3" });
    await sleep(900);
    s.result("fetch_targets", { error: "targets service timed out after 5s" });
    await sleep(300);
    s.thought(" Les objectifs sont indisponibles : je trace les ventes seules et je le signale.");
    await sleep(400);
    await streamWords(s, CHART.replace('"series":["ventes","objectif"]', '"series":["ventes"]').replace(/,"objectif":\d+/g, "") + "\n\n⚠️ Les objectifs n'ont pas pu être chargés (service indisponible).");
    s.usage({ promptTokenCount: 88, candidatesTokenCount: 140, totalTokenCount: 228 });
    return s.end();
  }
  if (/\b(graph(ique)?|chart)\b/.test(q)) {
    await streamWords(s, CHART);
    s.usage({ promptTokenCount: 18, candidatesTokenCount: 90, totalTokenCount: 108 });
    return s.end();
  }
  await streamWords(
    s,
    `Bien reçu : « ${text.trim().slice(0, 80)} ».\n\nVoici une réponse **courte** avec un peu de *Markdown*, une liste :\n\n- un point\n- un autre point\n\net un extrait de code :\n\n\`\`\`python\nprint("bonjour depuis le mock")\n\`\`\`\n\nEssayez « outils », « graphique », « vide », « partiel », « erreur » ou « lent » pour les autres scénarios.`,
  );
  s.usage({ promptTokenCount: 15, candidatesTokenCount: 60, totalTokenCount: 75 });
  return s.end();
}

// ── Routes ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" });
    return res.end();
  }
  log(req.method, path);

  if (path === "/api/auth/token" && req.method === "POST") {
    await readBody(req);
    return json(res, 200, { access_token: `mock_token_${Date.now()}`, token_type: "bearer" });
  }
  if (path === "/api/adk/run_sse" && req.method === "POST") {
    const body = await readBody(req);
    const text = body?.new_message?.parts?.map((p) => p.text).join(" ") || "";
    const s = sse(res);
    try {
      await scenario(s, text);
    } catch (e) {
      log("scenario error", e);
      s.end();
    }
    return;
  }
  if (path === "/api/adk/sessions" && req.method === "POST") {
    const body = await readBody(req);
    sessions.set(body.session_id, { ...body, messages: [] });
    return json(res, 200, { id: body.session_id, ...body });
  }
  if (path.startsWith("/api/adk/sessions/")) {
    if (req.method === "DELETE") return json(res, 200, { ok: true });
    if (req.method === "PATCH" || req.method === "PUT") return json(res, 200, { ok: true });
    return json(res, 200, { messages: [] });
  }
  if (path === "/api/adk/generate_title" && req.method === "POST") {
    const body = await readBody(req);
    const words = String(body.message || "").split(/\s+/).slice(0, 5).join(" ");
    await sleep(200);
    return json(res, 200, { title: words ? words[0].toUpperCase() + words.slice(1) : "Conversation" });
  }
  if (path === "/api/adk/sessions/list") return json(res, 200, { sessions: [] });
  if (path === "/api/agents" && req.method === "GET") return json(res, 200, AGENTS);
  if (/^\/api\/agents\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop());
    const a = AGENTS.find((x) => x.agent_id === id);
    return a ? json(res, 200, a) : json(res, 404, { detail: "Not found" });
  }
  if (/^\/api\/agents\/[^/]+\/reload$/.test(path)) return json(res, 200, { ok: true });
  if (path === "/api/config") return json(res, 200, { default_llm_available: false, default_llm_model_id: "mock/default" });
  if (path === "/api/config/default-llm/usage") return json(res, 404, { detail: "Not found" });
  if (path === "/api/models") return json(res, 200, []);
  if (path === "/api/users/me") {
    // Backend shape (snake_case): the SDK's mapBackendUser turns it into the
    // front-end user. Any bearer token is accepted — this is a mock.
    return json(res, 200, {
      user_id: "user_demo",
      email: "demo@th2.ai",
      username: "demo",
      first_name: "Elom",
      last_name: "Demo",
      role: "USER",
      avatar_url: null,
      mfa_enabled: false,
      onboarding_completed: true,
      created_at: "2026-01-15T00:00:00.000Z",
    });
  }
  if (path === "/api/auth/refresh-token") return json(res, 401, { detail: "no refresh cookie in the mock" });
  if (path === "/api/notifications/unread-count") return json(res, 200, { count: 0 });
  if (path === "/api/notifications") return json(res, 200, []);
  if (path === "/api/notifications/stream") {
    const s = sse(res);
    const id = setInterval(() => s.send({ type: "ping" }), 15000);
    res.on("close", () => clearInterval(id));
    return;
  }
  if (path === "/api/integrations") return json(res, 200, []);
  if (path.startsWith("/api/artifacts/library")) {
    return json(res, 200, [
      { id: 1, filename: "rapport_q3.md", agent_name: "Analyste", session_id: "s", created_at: new Date().toISOString() },
      { id: 2, filename: "ventes.csv", agent_name: "Analyste", session_id: "s", created_at: new Date().toISOString() },
    ]);
  }
  if (path.startsWith("/api/artifacts/")) return json(res, 200, []);
  if (path === "/api/v1/dashboards" || path === "/api/dashboards") return json(res, 200, { items: [{ id: 9, title: "Ventes 2026", description: "Suivi mensuel" }] });
  if (path === "/api/skills") return json(res, 200, [{ id: 1, name: "resume-executif", description: "Résumé en 5 points" }]);
  if (path.startsWith("/api/health")) return json(res, 200, { status: "ok" });

  // ── Orchestrator ───────────────────────────────────────────────────────
  // The screen is wrapped in `RequiresSetup capability="orchestration"`, so
  // the checklist has to say it is configured or nothing renders at all --
  // and it would render anyway on a network error, since `useSetupStatus`
  // fails open. Served properly here so the screen appears for the right
  // reason rather than by fallback.
  if (path === "/api/config/setup") {
    const docs = "https://docs.apowerb.com/configuration";
    return json(res, 200, {
      items: [
        { key: "orchestration", configured: true, mode: null, optional: false, blocks: ["orchestrator"], missing: [], docs_url: `${docs}/orchestration` },
        { key: "default_llm", configured: true, mode: null, optional: false, blocks: ["shared_model"], missing: [], docs_url: `${docs}/default-llm` },
      ],
      missing_count: 0,
    });
  }

  const runsMatch = path.match(/^\/api\/pipelines\/[^/]+\/schedules\/(\d+)\/runs$/);
  if (runsMatch) return json(res, 200, scheduleRuns.get(Number(runsMatch[1])) || []);

  if (path.match(/^\/api\/pipelines\/[^/]+\/schedules$/) && req.method === "GET") {
    return json(res, 200, schedules);
  }

  const updateMatch = path.match(/^\/api\/pipelines\/[^/]+\/schedules\/(\d+)$/);
  if (updateMatch && req.method === "PUT") {
    const body = await readBody(req);
    const found = schedules.find((s) => s.id === Number(updateMatch[1]));
    if (!found) return json(res, 404, { detail: "no such schedule" });
    Object.assign(found, body);
    log("schedule", found.id, "->", JSON.stringify(body));
    return json(res, 200, found);
  }

  if (path === "/api/adk/schedule_run" && req.method === "POST") {
    const body = await readBody(req);
    const agent = AGENTS.find((a) => a.agent_id === Number(body.agent_id)) || AGENTS[0];
    const created = {
      id: nextScheduleId++,
      agent_id: agent.agent_id,
      agent_name: agent.agent_name,
      schedule_interval: body.schedule_interval || "@hourly",
      status: "active",
      start_time: body.start_time || null,
      next_run: "2026-09-09T15:00:00Z",
    };
    schedules.push(created);
    log("scheduled", created.agent_name, created.schedule_interval, "id", created.id);
    // The modal reads `schedule_id` -- not `id` -- off this answer to fill in
    // its confirmation panel.
    return json(res, 200, {
      schedule_id: created.id,
      agent_name: created.agent_name,
      schedule_interval: created.schedule_interval,
      status: "active",
    });
  }

  if (path === "/api/adk/run_now" && req.method === "POST") {
    const body = await readBody(req);
    log("run now", body.agent_name, "session", body.session_id);
    return json(res, 200, { success: true, run_id: 999, session_id: body.session_id });
  }

  if (path.startsWith("/api/pipelines/runs/")) {
    if (path.endsWith("/logs")) return json(res, 200, { logs: "mock run log\n" });
    if (path.endsWith("/cancel")) return json(res, 200, { cancelled: true });
    return json(res, 200, { id: 101, status: "completed" });
  }

  if (path === "/api/pipelines") return json(res, 200, [{ uuid: "agents" }]);

  return json(res, 404, { detail: `mock: no route for ${req.method} ${path}` });
});

server.listen(PORT, "127.0.0.1", () => log(`mock apowerb backend listening on http://127.0.0.1:${PORT}`));
