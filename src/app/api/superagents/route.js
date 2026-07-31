import { proxyToBackend } from "@/lib/proxy";

export async function GET(request) {
  return proxyToBackend(request, "/api/superagents");
}
