import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ params: segments }) => {
    const backendPath = `/api/adk/sessions/${segments.join("/")}`;
    return proxyToBackend(request, backendPath);
  });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
