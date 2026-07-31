import { proxyToBackend } from "@/lib/proxy";

export async function GET(request, { params }) {
  const path = (await params).path?.join("/") ?? "";
  return proxyToBackend(request, `/api/googledrivebrowser/${path}`);
}