const API_URL = process.env.API_URL || "http://localhost:8000";

export async function POST(request) {
  const body = await request.json();

  // Forward auth and cookie headers
  const authHeader = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");

  try {
    // Forward to backend SSE endpoint
    const response = await fetch(`${API_URL}/api/adk/run_sse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
        ...(cookie && { Cookie: cookie }),
      },
      body: JSON.stringify({
        ...body,
        run_mode: "run_sse",
        streaming: true,
      }),
    });

    const contentType = response.headers.get("content-type") || "";

    // If backend returns SSE stream, proxy it
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

    // Otherwise return JSON response (non-streaming fallback)
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.error("[run-sse] Error:", error);
    return Response.json(
      { error: error.message || "Failed to connect to backend" },
      { status: 502 },
    );
  }
}
