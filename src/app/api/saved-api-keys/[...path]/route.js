import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ path }) => {
    const backendPath = `/api/saved-api-keys/${path.join("/")}`;
    return proxyToBackend(request, backendPath);
  });
}

export const GET = handler;
export const DELETE = handler;
