/**
 * What the trigger guide shows for each kind, and the ready-to-copy calls it
 * builds — pure, no React. The calls mirror the core's real contract:
 * `POST /api/workflows/defs/{id}/run` (Bearer access token, SSE answer) for
 * a manual start, `POST <webhook_url>` (202 {run_id}, optional
 * `X-Apowerb-Signature: sha256=<hex HMAC-SHA256 of the raw body>`) for a
 * webhook.
 */

// `steps` is how many numbered `${kind}_stepN` messages the guide shows;
// `response` picks the answer described under the call, when there is one.
export const TRIGGER_GUIDE = {
  manual: { publish: false, steps: 3, call: "run", response: "sse" },
  webhook: { publish: true, steps: 4, call: "webhook", response: "accepted" },
  schedule: { publish: true, steps: 3 },
  email: { publish: true, steps: 4 },
  agent_tool: { publish: true, steps: 4 },
  form: { publish: true, steps: 4, response: "accepted" },
  file: { publish: true, steps: 4 },
  workflow_done: { publish: true, steps: 3 },
};

export const TOKEN_PLACEHOLDER = "<ACCESS_TOKEN>";
export const SECRET_ENV = "APOWERB_WEBHOOK_SECRET";

/** The trigger routes are missing on this server (FastAPI's bare 404), not an unknown workflow. */
export function isMissingRouteError(err) {
  return err?.status === 404 && err.message === "Not Found";
}

function samplePayload(config) {
  const p = config?.sample_payload;
  return p && typeof p === "object" && !Array.isArray(p) ? p : {};
}

/** The request a manual start or a webhook call sends, built from the real id, URL and sample payload. */
export function triggerCall(kind, { origin, workflowId, webhookUrl, webhookUrlPlaceholder, config }) {
  const payload = samplePayload(config);
  if (TRIGGER_GUIDE[kind]?.call === "run") {
    return {
      url: `${origin}/api/workflows/defs/${workflowId}/run`,
      headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}`, "Content-Type": "application/json" },
      body: { payload },
      signed: false,
      stream: true,
    };
  }
  if (TRIGGER_GUIDE[kind]?.call === "webhook") {
    return {
      url: webhookUrl || webhookUrlPlaceholder,
      headers: { "Content-Type": "application/json" },
      body: payload,
      signed: !!config?.hmac,
      stream: false,
    };
  }
  return null;
}

const shellQuote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

export function curlSnippet(call) {
  const body = JSON.stringify(call.body);
  const headers = Object.entries(call.headers).map(([k, v]) => `  -H ${shellQuote(`${k}: ${v}`)} \\`);
  if (!call.signed) {
    return [`curl -N -X POST ${shellQuote(call.url)} \\`, ...headers, `  -d ${shellQuote(body)}`].join("\n");
  }
  return [
    `BODY=${shellQuote(body)}`,
    `SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$${SECRET_ENV}" -hex | sed 's/^.* //')`,
    `curl -X POST ${shellQuote(call.url)} \\`,
    ...headers,
    `  -H "X-Apowerb-Signature: sha256=$SIG" \\`,
    `  -d "$BODY"`,
  ].join("\n");
}

export function jsSnippet(call) {
  const body = JSON.stringify(call.body);
  const lines = [`const body = JSON.stringify(${body});`];
  const headers = { ...call.headers };
  if (call.signed) {
    lines.unshift(`import { createHmac } from "node:crypto";`);
    lines.push(`const sig = createHmac("sha256", process.env.${SECRET_ENV}).update(body).digest("hex");`);
  }
  const headerLines = Object.entries(headers).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  if (call.signed) headerLines.push(`    "X-Apowerb-Signature": \`sha256=\${sig}\`,`);
  lines.push(
    `const res = await fetch(${JSON.stringify(call.url)}, {`,
    `  method: "POST",`,
    `  headers: {`,
    ...headerLines,
    `  },`,
    `  body,`,
    `});`,
    call.stream ? `console.log(await res.text()); // server-sent events, one "data:" line each` : `console.log(res.status, await res.json()); // 202 {"run_id": ...}`,
  );
  return lines.join("\n");
}

export function pythonSnippet(call) {
  const body = JSON.stringify(call.body);
  const lines = ["import requests"];
  if (call.signed) lines.push("import hashlib, hmac, os");
  lines.push("", `body = ${JSON.stringify(body)}.encode()`);
  const headerLines = Object.entries(call.headers).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  if (call.signed) {
    lines.push(`sig = hmac.new(os.environ["${SECRET_ENV}"].encode(), body, hashlib.sha256).hexdigest()`);
    headerLines.push(`    "X-Apowerb-Signature": f"sha256={sig}",`);
  }
  lines.push(`res = requests.post(`, `    ${JSON.stringify(call.url)},`, `    data=body,`, `    headers={`, ...headerLines.map((l) => `    ${l}`), `    },`);
  if (call.stream) {
    lines.push(`    stream=True,`, `)`, `for line in res.iter_lines(decode_unicode=True):`, `    if line.startswith("data:"):`, `        print(line[5:].strip())`);
  } else {
    lines.push(`)`, `print(res.status_code, res.json())  # 202 {"run_id": ...}`);
  }
  return lines.join("\n");
}
