// src/app/api/conversations/share/[shareId]/route.js
import { proxyToBackend } from "@/lib/proxy";

export async function GET(request, { params }) {
  return proxyToBackend(request, `/api/conversations/share/${params.shareId}`);
}