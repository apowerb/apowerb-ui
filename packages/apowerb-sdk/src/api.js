import {
  apiUrl,
  clearAuth,
  getAuthToken,
  notifyUnauthorized,
  setAuthToken,
} from "./config.js";


function getAuthHeaders() {
  const token = getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// Token refresh lock — only one refresh at a time
let refreshPromise = null;

async function attemptTokenRefresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(apiUrl(`/api/auth/refresh-token`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) return null;
      const data = await response.json();
      const newToken = data.access_token;
      if (newToken) {
        setAuthToken(newToken);
        return newToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request(path, options = {}) {
  const { silent401, ...fetchOptions } = options;
  const url = apiUrl(`${path}`);
  const authHeaders = getAuthHeaders();

  // Only set Content-Type for requests with a body to avoid unnecessary CORS preflight
  const headers = {
    ...authHeaders,
    ...fetchOptions.headers,
  };
  if (fetchOptions.body) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(url, {
    headers,
    ...fetchOptions,
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // Reverse proxies (502/503/504) and some error pages return HTML or
    // plain text — don't explode on the parse, build a clean Error instead.
    if (!res.ok) {
      const snippet = (text || "").trim().slice(0, 200);
      const err = new Error(
        snippet
          ? `HTTP ${res.status}: ${snippet}`
          : `HTTP ${res.status} ${res.statusText || "error"}`,
      );
      err.status = res.status;
      throw err;
    }
    // Successful 2xx with a non-JSON body is an actual bug — surface it.
    console.error(`[API] Failed to parse JSON response from ${url}:`, text);
    throw new Error(
      `Invalid JSON response from server: ${text.slice(0, 100)}...`,
    );
  }

  if (!res.ok) {
    // Handle authentication errors
    if (res.status === 401 && !silent401) {
      // Try to refresh the token before giving up
      const newToken = await attemptTokenRefresh();
      if (newToken) {
        // Retry the original request with the fresh token
        const retryHeaders = {
          Authorization: `Bearer ${newToken}`,
          ...fetchOptions.headers,
        };
        if (fetchOptions.body) {
          retryHeaders["Content-Type"] = retryHeaders["Content-Type"] || "application/json";
        }
        const retryRes = await fetch(url, {
          headers: retryHeaders,
          ...fetchOptions,
        });
        if (retryRes.ok) {
          const retryText = await retryRes.text();
          try {
            return retryText ? JSON.parse(retryText) : {};
          } catch {
            return {};
          }
        }
      }
      // Refresh failed or retry still 401 — clear auth
      clearAuth();
      notifyUnauthorized();
    }

    const detail = body.detail;
    const errorMessage =
      typeof detail === "string"
        ? detail
        : detail
          ? JSON.stringify(detail)
          : body.message || `API error ${res.status}`;

    // Only log unexpected errors (not client-side conflicts or validation)
    if (res.status >= 500) {
      console.error(`[API] Server error ${url} (${res.status}):`, body);
    }

    const err = new Error(errorMessage);
    err.status = res.status;
    throw err;
  }

  return body;
}

// --- Agents ---
export const listAgents = () => request("/api/agents");

// th2prospect — profil emetteur (etape 0), owner-scope cote backend
export const getProspectionProfile = () => request("/api/prospection/profile");
export const setProspectionProfile = (data) =>
  request("/api/prospection/profile", { method: "POST", body: JSON.stringify(data) });

export const listAgentsForBi = async () => {
  const agents = await listAgents();
  return agents.filter((a) => a.agent_type !== "sub_agent");
};

export const getAgent = (id) => request(`/api/agents/${id}`);

export const createAgent = (data) =>
  request("/api/agents", { method: "POST", body: JSON.stringify(data) });

export const updateAgent = (id, data) =>
  request(`/api/agents/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteAgent = (id) =>
  request(`/api/agents/${id}`, { method: "DELETE" });

// Hot-reload an agent's ADK runtime so open chat sessions pick up the latest
// DB config (instruction, tools, model, ...) without requiring a new chat.
export const reloadAgent = (id) =>
  request(`/api/agents/${id}/reload`, { method: "POST" });

// Compare the agent's stored template snapshot against the live template.
// Returns { agent_id, template_id, is_in_sync, stored_hash, current_hash, drift_fields }.
// Used by TemplateDriftBanner to surface "template updated, click to sync".
export const getAgentTemplateStatus = (id) =>
  request(`/api/agents/${id}/template-status`);

// Overwrite the agent's instruction / tools / tags with the live template
// (user-owned knobs like model, model_params, mcp_servers, guardrails are
// left untouched). Returns the post-resync template-status payload.
export const resyncAgentTemplate = (id) =>
  request(`/api/agents/${id}/resync-template`, { method: "POST" });

// --- Tools ---
export const listTools = () => request("/api/tools");

export const listToolConfigs = () => request("/api/tools_config");

export const getToolConfig = (id) => request(`/api/tools_config/${id}`);

export const createToolConfig = (data) =>
  request("/api/tools_config", { method: "POST", body: JSON.stringify(data) });

export const deleteToolConfig = (id) =>
  request(`/api/tools_config/${id}`, { method: "DELETE" });

export const updateToolConfig = (id, data) =>
  request(`/api/tools_config/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const getToolExpectedParams = (toolName) =>
  request(`/api/tools/${encodeURIComponent(toolName)}/params`);

export const getToolsDocs = () => request("/api/tools/docs");

export const getModels = () => request("/api/models");

// --- MCP Configs ---
export const listMcpConfigs = () => request("/api/mcp_configs");

export const saveMcpConfig = (data) =>
  request("/api/mcp_configs", { method: "POST", body: JSON.stringify(data) });

export const updateMcpConfig = (mcpConfigId, data) =>
  request(`/api/mcp_configs/${mcpConfigId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

// --- Sessions ---
export const createSession = (data) =>
  request("/api/adk/sessions", { method: "POST", body: JSON.stringify(data) });

// Titre auto-généré d'une conversation à partir de son premier message.
export const generateTitle = (message, agentId) =>
  request("/api/adk/generate_title", {
    method: "POST",
    body: JSON.stringify({ message, agent_id: agentId != null ? String(agentId) : null }),
  });

export const updateSession = (agentName, userId, sessionId, data) =>
  request(`/api/adk/sessions/${agentName}/${userId}/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteSession = (agentName, userId, sessionId) =>
  request(`/api/adk/sessions/${agentName}/${userId}/${sessionId}`, {
    method: "DELETE",
  });

// --- Runs ---
export const runAgent = (data) =>
  request("/api/adk/run", { method: "POST", body: JSON.stringify(data) });

export const runAgentNow = (data) =>
  request("/api/adk/run_now", { method: "POST", body: JSON.stringify(data) });

// --- Session History ---
export const getSessionHistory = (agentName, userId, sessionId) =>
  request(`/api/adk/sessions/${agentName}/${userId}/${sessionId}`);

// --- Artifacts (silent401: don't clear auth on 401 — artifacts may fail independently) ---

/** Uploads and generated files live under the same routes, told apart by `kind`. */
const kindQuery = (kind) => (kind ? `?kind=${encodeURIComponent(kind)}` : "");

/**
 * The whole library in one request.
 *
 * Returns `{items, supported}`. `supported: false` means the backend is on
 * its local-disk fallback, which has no equivalent sweep — the caller falls
 * back to listing per session. Older backends answer 404, same thing.
 */
export const listArtifactLibrary = () =>
  request("/api/artifacts/library", { silent401: true });

export const listArtifacts = (agentName, userId, sessionId) =>
  request(`/api/artifacts/${agentName}/${userId}/${sessionId}`, {
    silent401: true,
  });

export const loadArtifact = (agentName, userId, sessionId, filename, kind) =>
  request(
    `/api/artifacts/${agentName}/${userId}/${sessionId}/${filename}${kindQuery(kind)}`,
    { silent401: true },
  );

export const executeArtifact = (
  agentName,
  userId,
  sessionId,
  filename,
  options,
  kind,
) =>
  request(
    `/api/artifacts/${agentName}/${userId}/${sessionId}/${filename}/execute${kindQuery(kind)}`,
    {
      method: "POST",
      body: JSON.stringify(options || {}),
      silent401: true,
    },
  );

// --- Scheduler ---
export const listPipelines = () => request("/api/pipelines");

export const listPipelineSchedules = (pipelineUuid) =>
  request(`/api/pipelines/${pipelineUuid}/schedules`);

export const listScheduleRuns = (pipelineUuid, scheduleId) =>
  request(`/api/pipelines/${pipelineUuid}/schedules/${scheduleId}/runs`);

export const scheduleAgentRun = (data) =>
  request("/api/adk/schedule_run", { method: "POST", body: JSON.stringify(data) });

export const updatePipelineSchedule = (pipelineUuid, scheduleId, data) =>
  request(`/api/pipelines/${pipelineUuid}/schedules/${scheduleId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const createAgentTrigger = (data) =>
  request("/api/pipelines/agents/triggers", { method: "POST", body: JSON.stringify(data) });

export const cancelPipelineRun = (runId) =>
  request(`/api/pipelines/runs/${runId}/cancel`, { method: "PUT" });

export const getPipelineRun = (runId) =>
  request(`/api/pipelines/runs/${runId}`);

export const getPipelineRunLogs = (runId) =>
  request(`/api/pipelines/runs/${runId}/logs`);

// --- Files ---
export const uploadFile = async (file, agentId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("agent_id", agentId);
  const token = getAuthToken();
  const res = await fetch(apiUrl(`/api/files/upload`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed (${res.status}): ${body}`);
  }
  return res.json();
};

export const uploadFileChunked = async (file, agentId, onProgress) => {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const filename = file.name;

  // Si le fichier est petit (<= CHUNK_SIZE), utiliser l'upload classique
  if (totalChunks <= 1) {
    onProgress?.(50);
    const result = await uploadFile(file, agentId);
    onProgress?.(100);
    return result;
  }

  // Upload chunks sequentially
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append("upload_id", uploadId);
    formData.append("agent_id", agentId);
    formData.append("chunk_index", String(i));
    formData.append("total_chunks", String(totalChunks));
    formData.append("filename", filename);
    formData.append("chunk", chunk, `${filename}.part${i}`);

    const token = getAuthToken();
    const res = await fetch(apiUrl(`/api/files/upload-chunk`), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Chunk upload failed (${res.status}): ${body}`);
    }

    onProgress?.(Math.round(((i + 1) / totalChunks) * 90)); // 0-90% pour les chunks
  }

  // Assembler
  const token = getAuthToken();
  const res = await fetch(apiUrl(`/api/files/upload-complete`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ upload_id: uploadId, agent_id: agentId, filename, total_chunks: totalChunks }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload complete failed (${res.status}): ${body}`);
  }

  onProgress?.(100);
  return res.json();
};

// --- Supervision ---
export const listAllSessions = () =>
  request("/api/adk/sessions/list");

export const getSessionTrace = (agentName, userId, sessionId) =>
  request(`/api/adk/sessions/${agentName}/${userId}/${sessionId}/trace`);

// --- SuperAgents ---
export const listSuperAgents = () => request("/api/superagents");

export const getSuperAgent = (templateId) =>
  request(`/api/superagents/${templateId}`);

// --- Agent Hub ---
export const listHubAgents = () => request("/api/hub");

export const getHubAgent = (hubId) => request(`/api/hub/${hubId}`);

export const publishToHub = (data) =>
  request("/api/hub/publish", { method: "POST", body: JSON.stringify(data) });

export const cloneFromHub = (data) =>
  request("/api/hub/clone", { method: "POST", body: JSON.stringify(data) });

export const deleteFromHub = (hubId) =>
  request(`/api/hub/${hubId}`, { method: "DELETE" });

// --- Billing ---
export const getBillingPackages = () => request("/api/billing/packages");

export const createBillingCheckout = (packageId, successUrl, cancelUrl) =>
  request("/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify({
      package_id: packageId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });

export const getBillingBalance = () => request("/api/billing/balance");

export const getBillingTransactions = (limit = 20) =>
  request(`/api/billing/transactions?limit=${limit}`);

export const getBillingPortal = (returnUrl) =>
  request(`/api/billing/portal?return_url=${encodeURIComponent(returnUrl)}`);

// --- Usage ---
export const getUsageSummary = (days = 30, { granularity, agentId } = {}) => {
  const params = new URLSearchParams({ days: String(days) });
  if (granularity) params.set("granularity", granularity);
  if (agentId != null) params.set("agent_id", String(agentId));
  return request(`/api/usage/summary?${params.toString()}`);
};

// Quota mensuel sur le modèle thaink2 mutualisé. `enabled: false` quand ce
// serveur ne sert pas de modèle par défaut — il n'y a alors rien à afficher.
export const getUsageQuota = () => request(`/api/usage/quota`);

// ---- Logging (agent observability, per conversation) ----

export const getLoggingConversations = (limit = 50) =>
  request(`/api/logging/conversations?limit=${limit}`);

export const getLoggingLogs = ({ conversationId, service, level, limit = 500 } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (conversationId) params.set("conversation_id", conversationId);
  if (service) params.set("service", service);
  if (level) params.set("level", level);
  return request(`/api/logging/logs?${params.toString()}`);
};

export const getLoggingSpans = ({ conversationId, limit = 1000 } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (conversationId) params.set("conversation_id", conversationId);
  return request(`/api/logging/spans?${params.toString()}`);
};

export const getLoggingStats = (hours = 24) =>
  request(`/api/logging/stats?hours=${hours}`);

export const getLoggingAlerts = () =>
  request("/api/logging/alerts?active=true");

export const getLoggingAnnotations = (conversationId) =>
  request(`/api/logging/annotations?conversation_id=${encodeURIComponent(conversationId)}`);

export const postLoggingAnnotation = ({ conversationId, traceId, note }) =>
  request("/api/logging/annotations", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      trace_id: traceId,
      note,
    }),
  });

export const getUsageAgentDetail = (agentId, days = 30) =>
  request(`/api/usage/agents/${agentId}?days=${days}`);

export const getPublicConfig = async () => {
  const res = await fetch(apiUrl(`/api/config`));
  if (!res.ok) return { billing_enabled: true };
  return res.json();
};

// --- RAG Knowledge Base ---
export const indexRagFiles = async (files, agentId, sessionId) => {
  const formData = new FormData();
  formData.append("agent_id", agentId);
  if (sessionId) formData.append("session_id", sessionId);
  files.forEach((f) => formData.append("files", f));
  const token = getAuthToken();
  const res = await fetch(apiUrl(`/api/rag/index-files`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RAG file indexing failed (${res.status}): ${body}`);
  }
  return res.json();
};

export const indexRagUrl = (data) =>
  request("/api/rag/index-url", { method: "POST", body: JSON.stringify(data) });

export const indexRagDb = (data) =>
  request("/api/rag/index-db", { method: "POST", body: JSON.stringify(data) });

export const indexRagDbNl = (data) =>
  request("/api/rag/index-db-nl", { method: "POST", body: JSON.stringify(data) });

export const indexRagS3 = (data) =>
  request("/api/rag/index-s3", { method: "POST", body: JSON.stringify(data) });

export const getRagStatus = (knowledgeId, agentId) =>
  request(`/api/rag/status/${knowledgeId}?agent_id=${encodeURIComponent(agentId)}`);

export const listRagKnowledge = (agentId, sessionId) =>
  request(`/api/rag/knowledge/${agentId}${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`);

// --- Saved API Keys ---
export const listSavedApiKeys = () => request("/api/saved-api-keys");

export const createSavedApiKey = (data) =>
  request("/api/saved-api-keys", { method: "POST", body: JSON.stringify(data) });

export const deleteSavedApiKey = (id) =>
  request(`/api/saved-api-keys/${id}`, { method: "DELETE" });

// --- Webhook Subscriptions ---
export const listWebhookSubscriptions = () =>
  request("/api/webhooks/subscriptions");

export const createWebhookSubscription = (data) =>
  request("/api/webhooks/subscriptions", { method: "POST", body: JSON.stringify(data) });

export const updateWebhookSubscription = (id, data) =>
  request(`/api/webhooks/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteWebhookSubscription = (id) =>
  request(`/api/webhooks/subscriptions/${id}`, { method: "DELETE" });

export const renewWebhookSubscription = (id) =>
  request(`/api/webhooks/subscriptions/${id}/renew`, { method: "POST" });

export const listWebhookLogs = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/webhooks/logs${query ? `?${query}` : ""}`);
};

export const getWebhookLog = (id) =>
  request(`/api/webhooks/logs/${id}`);

export const retriggerWebhookLog = (logId) =>
  request(`/api/webhooks/logs/${logId}/retrigger`, { method: "POST" });

export const getWebhookLogBody = async (id) => {
  const token = getAuthToken();
  const res = await fetch(`/api/webhooks/logs/${id}/body`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

// Fetch one webhook attachment WITH auth and return a short-lived object URL.
//
// The serve endpoint is Bearer-authenticated like every other API route.
// A plain ``window.open(url)`` is a top-level navigation that carries no
// Authorization header, so the backend answers 401 ("Not authenticated").
// We therefore fetch the bytes with the token, wrap them in a Blob, and
// hand back an object URL the caller can open in a new tab. The 401 ->
// refresh -> retry dance mirrors ``request`` so an expired access token
// doesn't break the preview.
export const fetchWebhookLogAttachmentObjectUrl = async (logId, filename) => {
  const path = apiUrl(`/api/webhooks/logs/${logId}/attachments/${encodeURIComponent(filename)}`);
  let res = await fetch(path, { headers: getAuthHeaders() });
  if (res.status === 401) {
    const newToken = await attemptTokenRefresh();
    if (newToken) {
      res = await fetch(path, { headers: { Authorization: `Bearer ${newToken}` } });
    } else {
      // Refresh failed — clear auth and stop here instead of falling
      // through on the stale 401 ``res`` (mirrors ``request``).
      clearAuth();
      notifyUnauthorized();
      const err = new Error("HTTP 401");
      err.status = 401;
      throw err;
    }
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

// --- Notifications ---
export const listNotifications = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/notifications${query ? `?${query}` : ""}`);
};

export const getUnreadNotificationCount = () =>
  request("/api/notifications/unread-count");

export const markNotificationRead = (id) =>
  request(`/api/notifications/${id}/read`, { method: "PATCH" });

export const markAllNotificationsRead = () =>
  request("/api/notifications/read-all", { method: "POST" });

// --- Emailing / Outlook ---
export const getOutlookAuthUrl = () =>
  request("/api/emailing/microsoft/auth-url");

export const getOutlookStatus = () =>
  request("/api/emailing/microsoft/status");

// --- BI & Reporting ---
export const listDashboards = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/v1/dashboards${query ? `?${query}` : ""}`);
};
export const getDashboard = (id) => request(`/api/v1/dashboards/${id}`);
export const getDashboardBySlug = (slug) =>
  request(`/api/v1/dashboards/by-slug/${encodeURIComponent(slug)}`);
// Add a chart to the user's chat dashboard (user-triggered "Send to dashboard").
export const sendChartToDashboard = (chartId, sessionId) => {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return request(`/api/v1/charts/${encodeURIComponent(chartId)}/send-to-dashboard${qs}`, {
    method: "POST",
  });
};
export const listSharedDashboards = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/v1/dashboards/shared${query ? `?${query}` : ""}`);
};
export const createDashboard = (data) =>
  request("/api/v1/dashboards", { method: "POST", body: JSON.stringify(data) });
export const updateDashboard = (id, data) =>
  request(`/api/v1/dashboards/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteDashboard = (id) =>
  request(`/api/v1/dashboards/${id}`, { method: "DELETE" });
export const publishDashboard = (id, data = {}) =>
  request(`/api/v1/dashboards/${id}/publish`, { method: "POST", body: JSON.stringify(data) });

export const unpublishDashboard = (id) =>
  request(`/api/v1/dashboards/${id}/unpublish`, { method: "POST" });

export const getPublicDashboard = (slug) =>
  request(`/api/v1/dashboards/public/${slug}`, { silent401: true });

export const getPublicChartData = (chartId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/v1/public/charts/${chartId}/data${query ? `?${query}` : ""}`, { silent401: true });
};

export const listCharts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/v1/charts${query ? `?${query}` : ""}`);
};
export const getChart = (id) => request(`/api/v1/charts/${id}`);
export const createChart = (data) =>
  request("/api/v1/charts", { method: "POST", body: JSON.stringify(data) });
export const updateChart = (id, data) =>
  request(`/api/v1/charts/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteChart = (id) =>
  request(`/api/v1/charts/${id}`, { method: "DELETE" });
export const getChartData = (chartId, params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/api/v1/charts/${chartId}/data${query ? `?${query}` : ""}`);
};

export async function scheduleChartRefresh(chartId, { agentId, interval, startTime, messageTemplate }) {
  return request(`/api/v1/charts/${chartId}/schedule-refresh`, {
    method: "POST",
    body: JSON.stringify({
      agent_id: agentId,
      interval,
      start_time: startTime || undefined,
      message_template: messageTemplate || undefined,
    }),
  });
}

export const addDashboardComponent = (dashboardId, data) =>
  request(`/api/v1/dashboards/${dashboardId}/components`, { method: "POST", body: JSON.stringify(data) });
export const removeDashboardComponent = (dashboardId, componentId) =>
  request(`/api/v1/dashboards/${dashboardId}/components/${componentId}`, { method: "DELETE" });
export const moveDashboardComponent = (dashboardId, componentId, data) =>
  request(`/api/v1/dashboards/${dashboardId}/components/${componentId}/position`, { method: "PATCH", body: JSON.stringify(data) });
export const updateDashboardComponent = (dashboardId, componentId, data) =>
  request(`/api/v1/dashboards/${dashboardId}/components/${componentId}`, { method: "PATCH", body: JSON.stringify(data) });

// Link/unlink agent to dashboard
export const linkAgentToDashboard = (dashboardId, agentId) =>
  request(`/api/v1/dashboards/${dashboardId}/agent`, {
    method: "PATCH",
    body: JSON.stringify({ agent_id: agentId }),
  });

// Get agent linked to dashboard
export const getDashboardAgent = (dashboardId) =>
  request(`/api/v1/dashboards/${dashboardId}/agent`);

export const getBiStats = (organizationId) =>
  request(`/api/v1/bi/stats?organization_id=${encodeURIComponent(organizationId || "default")}`);

export const listBiDatasets = (organizationId) =>
  request(`/api/v1/bi/datasets?organization_id=${encodeURIComponent(organizationId || "default")}`);

export const previewBiDataset = (fileId, organizationId) =>
  request(`/api/v1/bi/datasets/${encodeURIComponent(fileId)}/preview?organization_id=${encodeURIComponent(organizationId || "default")}`);

export const previewOnedriveSpreadsheet = ({ itemPath, itemId = null, sheetName = null }) =>
  request("/api/v1/bi/onedrive/preview", {
    method: "POST",
    body: JSON.stringify({
      item_path: itemPath,
      item_id: itemId,
      sheet_name: sheetName,
    }),
  });

export const listBiDbConfigs = (organizationId) =>
  request(`/api/v1/bi/tool-configs/database?organization_id=${encodeURIComponent(organizationId || "default")}`);

export const deleteBiDataset = (fileId, organizationId) =>
  request(`/api/v1/bi/datasets/${encodeURIComponent(fileId)}?organization_id=${encodeURIComponent(organizationId || "default")}`, { method: "DELETE" });

// --- Skills ---
export const listSkills = () => request("/api/skills");
export const listPortfolioSkills = () => request("/api/skills/portfolio");
export const getSkill = (id) => request(`/api/skills/${id}`);
export const createSkill = (data) =>
  request("/api/skills", { method: "POST", body: JSON.stringify(data) });
export const updateSkill = (id, data) =>
  request(`/api/skills/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSkill = (id) =>
  request(`/api/skills/${id}`, { method: "DELETE" });

export const exportSkill = (id, format = "json") =>
  apiUrl(`/api/skills/${id}/export?format=${encodeURIComponent(format)}`);

export const exportPortfolioSkill = (name, format = "json") =>
  apiUrl(`/api/skills/portfolio/${encodeURIComponent(name)}/export?format=${encodeURIComponent(format)}`);

export const importSkill = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const token = getAuthToken();
  const res = await fetch(apiUrl(`/api/skills/import`), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text();
    let message;
    try {
      const parsed = JSON.parse(body);
      message = parsed.detail || `Import failed (${res.status})`;
    } catch {
      message = `Import failed (${res.status}): ${body}`;
    }
    throw new Error(message);
  }
  return res.json();
};

// --- Email Campaigns ---
export const launchCampaign = (payload) =>
  request("/api/campaigns/launch-from-dashboard", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getCampaignStatus = (campaignId) =>
  request(`/api/campaigns/${encodeURIComponent(campaignId)}/status`, {
    method: "GET",
  });

export async function getOnedriveExcelPreview(
  itemPath,
  { sheetName = null, limit = 5 } = {},
) {
  const params = new URLSearchParams({
    item_path: itemPath,
    limit: String(limit),
  });
  if (sheetName) params.append("sheet_name", String(sheetName));
  return await request(
    `/api/onedrivebrowser/excel-preview?${params.toString()}`,
    { method: "GET" },
  );
}

export const uploadBiCsv = async (file, separator = "auto", organizationId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("separator", separator);
  formData.append("organization_id", organizationId || "default");
  const token = getAuthToken();
  // Upload directly to backend to bypass Next.js proxy body size limit
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const url = backendUrl
    ? `${backendUrl}/api/v1/bi/upload-csv`
    : apiUrl(`/api/v1/bi/upload-csv`);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error(`CSV upload failed (${res.status})`);
  return res.json();
};

// ---- Control panel (admin only: users, groups, organisations, permissions)
// Published on 18/08/2026 with the panel itself: it lived in the commercial
// client while the routes lived in a private brick, and both moved together.
// Every route below is admin-only server-side -- these helpers do not guard,
// they call.
// Every route below answers 403 to a non-admin. The screen still has to
// handle that: a role can be revoked while a tab stays open.

export const listAdminUsers = () => request("/api/admin/users");

// The password is set by the administrator and travels in this one request
// body: hashed server-side, never echoed back by any response.
export const createAdminUser = ({ email, firstName, lastName, password, role }) =>
  request("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      first_name: firstName,
      last_name: lastName,
      password,
      ...(role ? { role } : {}),
    }),
  });

export const changeAdminUserRole = (userId, role) =>
  request(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });

// The catalogue of permissions this build can enforce. Never hardcode it
// here: one added server-side must show up without a front deploy.
export const listAdminPermissions = () => request("/api/admin/permissions");

export const listAdminGroups = () => request("/api/admin/groups");

export const createAdminGroup = ({ name, description }) =>
  request("/api/admin/groups", {
    method: "POST",
    body: JSON.stringify({ name, ...(description ? { description } : {}) }),
  });

export const deleteAdminGroup = (groupId) =>
  request(`/api/admin/groups/${groupId}`, { method: "DELETE" });

// Replaces the whole set rather than adding to it — the screen is a list of
// checkboxes, and an add-only call would make unticking one impossible.
export const setAdminGroupPermissions = (groupId, permissions) =>
  request(`/api/admin/groups/${groupId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });

export const addAdminGroupMember = (groupId, userId) =>
  request(`/api/admin/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });

export const removeAdminGroupMember = (groupId, userId) =>
  request(`/api/admin/groups/${groupId}/members/${userId}`, { method: "DELETE" });

// ---- Supervision ----
// Replaces listAllSessions() for this screen: that one fans out one ADK HTTP
// call per agent to return camelCase fields the table never read. This reads
// the tables directly, and carries the opening request, the step and tool
// counts, and whether anything errored.
export const listSupervisionSessions = ({ limit = 200, offset = 0 } = {}) =>
  // `/api/supervision`, not `/api/evaluations`: supervision stays in the
  // core while evaluation moves to a commercial brick.
  request(`/api/supervision/sessions?limit=${limit}&offset=${offset}`);

// ---- Control panel: editing, demands, organisations ----

// What this administrator may do. Without it the screen would have to infer
// the boundary from what it happens to receive, and a filtered list looks
// exactly like a small one.
export const getAdminContext = () => request("/api/admin/me");

// Platform usage over a window, scoped server-side to what this
// administrator administers — an aggregate is the easiest place for a
// boundary to vanish unnoticed.
export const getAdminMetrics = (days = 30) =>
  request(`/api/admin/metrics?days=${days}`);

// The email is deliberately not editable: every ownership table joins on it.
export const editAdminUser = (userId, { firstName, lastName, plan }) =>
  request(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      ...(plan ? { plan } : {}),
    }),
  });

// Refused server-side while the account still holds anything — the response
// says what, so the screen can show it rather than a bare failure.
export const deleteAdminUser = (userId) =>
  request(`/api/admin/users/${userId}`, { method: "DELETE" });

// Invalidates every token the account holds, refresh cookie included.
// Scheduled agent runs are untouched: they carry a different token type.
export const forceRelogin = (userId) =>
  request(`/api/admin/users/${userId}/force-relogin`, { method: "POST" });

// Demands a second factor, or stops demanding it. Enabling MFA *for*
// someone stays impossible by construction — the secret is born when they
// scan the QR code.
export const setMfaRequired = (userId, required) =>
  request(`/api/admin/users/${userId}/require-mfa`, {
    method: "POST",
    body: JSON.stringify({ required }),
  });

// Sends the core's own reset link. No temporary password is ever minted:
// an administrator who could set one could sign in as that person.
export const demandPasswordReset = (userId) =>
  request(`/api/admin/users/${userId}/password-reset`, { method: "POST" });

export const demandEmailVerification = (userId) =>
  request(`/api/admin/users/${userId}/require-email-verification`, { method: "POST" });

// The locked-out case. Enabling MFA for someone else is impossible: the
// secret is created when they scan the QR code.
export const disableAdminUserMfa = (userId) =>
  request(`/api/admin/users/${userId}/disable-mfa`, { method: "POST" });

/**
 * Fetches a file's bytes through the authenticated API and hands back a Blob.
 *
 * A PDF or an image has no text body to rebuild client-side: downloading it
 * from what the artifact endpoint returns would write an empty file. The
 * download route serves the object itself.
 */
export const downloadAgentFile = async (agentName, filename) => {
  const token = getAuthToken();
  const res = await fetch(
    apiUrl(`/api/files/${agentName}/${encodeURIComponent(filename)}`),
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  return res.blob();
};
