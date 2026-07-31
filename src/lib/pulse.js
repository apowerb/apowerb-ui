/**
 * Server-side proxy to the telemetry ingest service (th2pulse ingest).
 *
 * The ingest service listens on localhost only and has no auth of its own,
 * so this proxy is the authorization boundary:
 *  - authentication: the caller's Bearer token is validated against the
 *    FastAPI backend (/api/users/me);
 *  - authorization: non-admin users only see their own conversations —
 *    a user_id filter derived from the *verified* backend identity is
 *    forced onto every downstream query (any client-supplied user_id is
 *    overwritten).
 * The ingest URL is read from the server-only env var PULSE_API_URL
 * (never exposed to the browser).
 */

const API_URL = process.env.API_URL || "http://localhost:8000";
const PULSE_API_URL = process.env.PULSE_API_URL || "http://127.0.0.1:4319";

/** Authenticate + authorize. Returns { identity, scopedUserId } or a Response. */
async function authorize(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }

  let identity;
  try {
    const check = await fetch(`${API_URL}/api/users/me`, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    });
    if (check.status === 401 || check.status === 403) {
      return Response.json({ detail: "Not authenticated" }, { status: check.status });
    }
    if (!check.ok) {
      // Backend trouble is a server error, not an auth failure — do not
      // send operators chasing expired tokens during an outage.
      return Response.json({ detail: "Backend unavailable" }, { status: 502 });
    }
    identity = await check.json();
  } catch (error) {
    console.error("[pulse] Auth check failed:", error.message);
    return Response.json({ detail: "Backend unavailable" }, { status: 502 });
  }

  const role = (identity?.role || "").toLowerCase();
  if (role !== "admin" && !identity?.email) {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }
  return {
    identity,
    scopedUserId: role === "admin" ? null : identity.email,
  };
}

function buildTarget(request, pulsePath, scopedUserId) {
  const params = new URL(request.url).searchParams;
  if (scopedUserId) params.set("user_id", scopedUserId);
  const qs = params.toString();
  return `${PULSE_API_URL}${pulsePath}${qs ? `?${qs}` : ""}`;
}

async function forward(target, init = {}) {
  try {
    const res = await fetch(target, { cache: "no-store", ...init });
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error(`[pulse] Failed to reach ingest at ${target}:`, error.message);
    return Response.json({ detail: "Logging store unavailable" }, { status: 502 });
  }
}

export async function pulseProxy(request, pulsePath) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  return forward(buildTarget(request, pulsePath, auth.scopedUserId));
}

/**
 * Write proxy (annotations): the author is ALWAYS the verified identity —
 * any client-supplied author is overwritten, admins included.
 */
export async function pulseProxyWrite(request, pulsePath) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  if (!auth.identity?.email) {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  body.author = auth.identity.email;

  return forward(buildTarget(request, pulsePath, auth.scopedUserId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
