import { pulseProxy, pulseProxyWrite } from "@/lib/pulse";

export async function GET(request) {
  return pulseProxy(request, "/annotations");
}

export async function POST(request) {
  return pulseProxyWrite(request, "/annotations");
}
