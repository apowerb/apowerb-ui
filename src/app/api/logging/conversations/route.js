import { pulseProxy } from "@/lib/pulse";

export async function GET(request) {
  return pulseProxy(request, "/conversations");
}
