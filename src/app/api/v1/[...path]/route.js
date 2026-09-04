import { proxyToBackend } from "@/lib/proxy";

/**
 * Every `/api/v1/*` call, proxied server-side: dashboards, charts, datasets,
 * CSV upload -- the whole BI surface.
 *
 * Without a handler here these paths fall through to the `fallback` rewrite,
 * whose destination is frozen at build time by `output: "standalone"`. In a
 * container that destination is `http://localhost:8000` -- the frontend itself,
 * where nothing listens -- so the request never leaves and Next answers 500:
 *
 *   Failed to proxy http://localhost:8000/api/v1/dashboards
 *   AggregateError: ECONNREFUSED ::1:8000, 127.0.0.1:8000
 *
 * The backend serves these routes perfectly: probed side by side, it answers
 * 401 on /api/v1/dashboards and 404 on an invented /api/v1/... . Only the hop
 * from this process was missing, which is why the screens looked like a broken
 * backend rather than a missing proxy.
 *
 * The guard is the backend's: `create_dashboard` takes the current user and no
 * role beyond that. This forwards, it does not decide.
 */

// `params` est une Promise ici : la déstructurer directement rend `undefined`,
// et l'URL construite perd son sous-chemin -- le backend répondrait alors 404
// sur `/api/v1/`, le même 404 pour toutes les routes, ce qui se lit à tort
// comme « le backend ne les a pas ». Même forme que `admin/[...path]`.
function forward(request, { params }) {
  return params.then(({ path }) =>
    proxyToBackend(request, `/api/v1/${path.join("/")}`),
  );
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
