import { proxyToBackend } from "@/lib/proxy";

export async function GET(request) {
  return proxyToBackend(request, "/api/adk/sessions");
}

export async function POST(request) {
  return proxyToBackend(request, "/api/adk/sessions");
}
