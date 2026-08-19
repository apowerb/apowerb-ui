// src/app/api/conversations/share/[shareId]/route.js
import { proxyToBackend } from "@/lib/proxy";

// `params` est une Promise : `params.shareId` rend `undefined`, et le lien
// partagé part vers `/api/conversations/share/undefined`. Défaut jumeau de
// celui du panneau de contrôle, trouvé en auditant tous les handlers.
export async function GET(request, { params }) {
  const { shareId } = await params;
  return proxyToBackend(request, `/api/conversations/share/${shareId}`);
}