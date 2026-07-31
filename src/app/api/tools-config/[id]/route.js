import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ id }) => {
    return proxyToBackend(request, `/api/tools_config/${id}`);
  });
}

export const GET = handler;
export const DELETE = handler;
