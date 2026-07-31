/**
 * SSE proxy for real-time notifications.
 * Streams events from the backend to the browser without buffering.
 */

const API_URL = process.env.API_URL || "http://localhost:8000";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  const backendRes = await fetch(`${API_URL}/api/notifications/stream`, {
    headers: {
      Authorization: authHeader,
      Accept: "text/event-stream",
    },
  });

  if (!backendRes.ok) {
    return new Response(backendRes.statusText, { status: backendRes.status });
  }

  // Pipe the SSE stream straight through
  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
