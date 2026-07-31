import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ id }) => {
    return proxyToBackend(request, `/api/agents/${id}/template-status`);
  });
}

export const GET = handler;
