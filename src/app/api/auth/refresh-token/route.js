import { proxyToBackend } from "@/lib/proxy";

export async function POST(request) {
  return proxyToBackend(request, "/api/auth/refresh-token");
}
