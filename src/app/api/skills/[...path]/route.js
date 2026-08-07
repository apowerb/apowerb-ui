import { proxyToBackend } from "@/lib/proxy";

// The skills export links were the only browser calls that reached the backend
// directly, through `NEXT_PUBLIC_API_URL`. That variable is inlined at build
// time, so a published image froze whatever the build saw -- nothing set, hence
// localhost. Routing them through the proxy like every other /api call makes
// them follow the runtime `API_URL` instead, and removes the last reason for
// the browser to know the backend address at all.
function handler(request, { params }) {
  return params.then(({ path }) => {
    const backendPath = `/api/skills/${path.join("/")}`;
    return proxyToBackend(request, backendPath);
  });
}

export const GET = handler;
