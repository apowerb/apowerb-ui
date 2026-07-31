// src/app/api/conversations/share/route.js
import { proxyToBackend } from "@/lib/proxy";

export async function POST(request) {
  return proxyToBackend(request, "/api/conversations/share");
}