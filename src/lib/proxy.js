/**
 * Server-side proxy utility for Next.js Route Handlers.
 *
 * Forwards requests to the FastAPI backend, preserving method, headers,
 * query string, and body. Used by all /api/* route handlers.
 *
 * The backend URL is read from the server-only env var API_URL
 * (NOT NEXT_PUBLIC_API_URL which is for the browser).
 */

const API_URL = process.env.API_URL || "http://localhost:8000";

/**
 * Forward an incoming Next.js request to the FastAPI backend.
 *
 * @param {Request} request  - the incoming Request object
 * @param {string}  backendPath - the backend path (e.g. "/api/auth/token")
 * @param {object}  [options]
 * @param {string}  [options.method]       - override HTTP method
 * @param {Record<string,string>} [options.extraHeaders] - additional headers
 * @returns {Promise<Response>}
 */
export async function proxyToBackend(request, backendPath, options = {}) {
  const method = options.method || request.method;

  // Build the full URL including query string
  const url = new URL(request.url);
  const search = url.search; // e.g. "?limit=20&offset=0"
  const target = `${API_URL}${backendPath}${search}`;

  // Forward relevant headers (auth, content-type, cookies)
  const headers = new Headers();

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("Cookie", cookie);
  }

  // Merge extra headers
  if (options.extraHeaders) {
    for (const [key, value] of Object.entries(options.extraHeaders)) {
      headers.set(key, value);
    }
  }

  // Forward body for methods that have one
  let body = null;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.arrayBuffer();
    if (body.byteLength === 0) body = null;
  }

  try {
    const backendRes = await fetch(target, { method, headers, body });

    // Collect response headers we want to forward back
    const responseHeaders = new Headers();
    const ct = backendRes.headers.get("content-type");
    if (ct) responseHeaders.set("Content-Type", ct);

    // Forward Set-Cookie headers (important for refresh token cookies)
    const setCookies = backendRes.headers.getSetCookie?.() || [];
    for (const sc of setCookies) {
      responseHeaders.append("Set-Cookie", sc);
    }

    // Buffer error responses so the body is never lost due to stream timing;
    // stream successful responses for performance.
    if (!backendRes.ok) {
      const errorBody = await backendRes.text();
      return new Response(errorBody, {
        status: backendRes.status,
        headers: responseHeaders,
      });
    }

    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[proxy] Failed to reach backend at ${target}:`, error.message);
    return Response.json(
      { detail: "Backend unavailable" },
      { status: 502 },
    );
  }
}
