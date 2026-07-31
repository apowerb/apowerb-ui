import { proxyToBackend } from "@/lib/proxy";

function handler(request) {
  return proxyToBackend(request, "/api/webhooks/");
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
