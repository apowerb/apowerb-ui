import { proxyToBackend } from "@/lib/proxy";

function handler(request) {
  return proxyToBackend(request, "/api/hub");
}

export const GET = handler;
export const POST = handler;
