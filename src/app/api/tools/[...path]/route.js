import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ path }) => {
    const backendPath = `/api/tools/${path.join("/")}`;
    return proxyToBackend(request, backendPath);
  });
}

export const GET = handler;
