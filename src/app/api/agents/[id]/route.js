import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ id }) => {
    return proxyToBackend(request, `/api/agents/${id}`);
  });
}

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
