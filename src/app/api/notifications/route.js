import { proxyToBackend } from "@/lib/proxy";

export async function GET(request) {
  return proxyToBackend(request, "/api/notifications");
}

export async function POST(request) {
  return proxyToBackend(request, "/api/notifications");
}
