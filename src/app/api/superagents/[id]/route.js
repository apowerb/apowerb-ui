import { proxyToBackend } from "@/lib/proxy";

export async function GET(request, { params }) {
  const { id } = await params;
  return proxyToBackend(request, `/api/superagents/${id}`);
}
