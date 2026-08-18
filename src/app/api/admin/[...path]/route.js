import { proxyToBackend } from "@/lib/proxy";

/**
 * Every `/api/admin/*` call, proxied server-side.
 *
 * Without a handler here these paths fall through to the `fallback` rewrite,
 * whose destination is frozen at build time by `output: "standalone"` -- so
 * they would leave for `localhost:8000` inside the container and answer 500.
 * The panel would render and do nothing, which is the harder bug to read.
 *
 * The guard is the backend's: every route under `/api/admin` is admin-only
 * there. This forwards, it does not decide.
 */

function forward(request, { params }) {
  const { path } = params;
  return proxyToBackend(request, `/api/admin/${(path ?? []).join("/")}`);
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
