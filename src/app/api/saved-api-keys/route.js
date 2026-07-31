import { proxyToBackend } from "@/lib/proxy";

function handler(request) {
  return proxyToBackend(request, "/api/saved-api-keys");
}

export const GET = handler;
export const POST = handler;
