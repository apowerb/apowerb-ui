import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ id }) => {
    return proxyToBackend(request, `/api/agents/${id}/resync-template`);
  });
}

export const POST = handler;
