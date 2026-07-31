const API_URL = process.env.API_URL || "http://localhost:8000";

export async function GET(request, { params }) {
  const { agentId } = await params; // Next.js 15+: params is a Promise
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id") || "";
  const authHeader = request.headers.get("authorization");

  try {
    const url = `${API_URL}/api/rag/stream/${agentId}?session_id=${encodeURIComponent(sessionId)}`;
    const response = await fetch(url, {
      headers: {
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error("[rag-stream] Error:", error);
    return Response.json(
      { error: error.message || "Failed to connect to backend" },
      { status: 500 },
    );
  }
}
