import { proxyToBackend } from "@/lib/proxy";

/**
 * Last line of defence for `/api/*`: every path no dedicated handler claims is
 * proxied server-side from here, with the backend URL read at runtime.
 *
 * Without this, such paths fell through to the `fallback` rewrite of
 * next.config.mjs, whose destination `output: "standalone"` freezes at build
 * time -- `http://localhost:8000`, the frontend's own container, where nothing
 * listens. Three times the same class of breakage looked like a broken feature:
 * `/api/users/me` (nobody could log in), `/api/v1/*` (no dashboards), and on
 * 08/09/2026 `/api/tools_config` and `/api/mcp_configs` on the demo:
 *
 *   Failed to proxy http://localhost:8000/api/tools_config
 *   Error: connect ECONNREFUSED 127.0.0.1:8000
 *
 * so no tool could be created. A dedicated handler per route is a whack-a-mole;
 * this one catches whatever is left. Specific handlers (`agents`, `v1/[...path]`,
 * `users/[[...path]]`, ...) keep precedence: Next matches them before a catch-all.
 *
 * This forwards, it does not decide: authentication and authorisation stay the
 * backend's.
 */

// `params` is a Promise here (Next 15+): destructuring it directly yields
// `undefined` and the built URL loses its sub-path. Same shape as `v1/[...path]`.
function forward(request, { params }) {
  return params.then(({ path }) =>
    proxyToBackend(request, `/api/${path.join("/")}`),
  );
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
