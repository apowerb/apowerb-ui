import { proxyToBackend } from "@/lib/proxy";

function handler(request, { params }) {
  return params.then(({ path }) => {
    const backendPath = `/api/notifications/${path.join("/")}`;
    return proxyToBackend(request, backendPath);
  });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
