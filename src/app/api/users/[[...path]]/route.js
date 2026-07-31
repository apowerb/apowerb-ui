import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ path }) => {
    const sub = path ? path.join("/") : "";
    const backendPath = sub ? `/api/users/${sub}` : "/api/users";
    return proxyToBackend(request, backendPath);
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
