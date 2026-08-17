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

  // Forward body for methods that have one.
  //
  // `payload` is a copy fetch can never reach, because fetch DETACHES whatever
  // buffer it sends. A fresh copy is handed over on every attempt below, and
  // this one stays intact.
  let payload = null;
  if (method !== "GET" && method !== "HEAD") {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 0) payload = Uint8Array.from(new Uint8Array(buffer));
  }

  try {
    // `redirect: "manual"` is the actual fix, not a detail.
    //
    // Letting fetch follow a redirect makes it REPLAY the body on a buffer it
    // has already detached, which throws "Cannot perform
    // ArrayBuffer.prototype.slice on a detached ArrayBuffer" and surfaces as
    // the useless message "fetch failed" -> 502. Every sign-up hit exactly
    // that: the backend answers 307 on `POST /api/users` and redirects to
    // `/api/users/`. `POST /api/auth/token` never redirects, which is why
    // logging in worked while signing up did not.
    //
    // Handing fetch a fresh copy each time is not enough on its own -- the
    // replay happens inside fetch, on the copy it already consumed. So we do
    // the following ourselves, with a new copy per attempt.
    let backendRes;
    let attemptUrl = target;
    for (let hop = 0; ; hop++) {
      backendRes = await fetch(attemptUrl, {
        method,
        headers,
        body: payload ? Uint8Array.from(payload) : null,
        redirect: "manual",
      });

      const isRedirect = backendRes.status >= 300 && backendRes.status < 400;
      if (!isRedirect || hop >= 3) break;

      const location = backendRes.headers.get("location");
      if (!location) break;

      // Resolved against the backend, and only followed when it stays on the
      // backend: a redirect is attacker-influencable input, and blindly
      // following it would turn this proxy into an open relay.
      const next = new URL(location, attemptUrl);
      if (next.origin !== new URL(API_URL).origin) break;
      attemptUrl = next.toString();
    }

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
    // `error.message` on a failed fetch is the useless string "fetch failed";
    // the reason lives in `error.cause`. Logging only the message cost a long
    // debugging detour on a 502 that had nothing to do with the network.
    const cause = error.cause
      ? ` (cause: ${error.cause.code || error.cause.name}: ${error.cause.message})`
      : "";
    console.error(
      `[proxy] Failed to reach backend at ${target}: ${error.message}${cause}`,
    );
    return Response.json(
      { detail: "Backend unavailable" },
      { status: 502 },
    );
  }
}
