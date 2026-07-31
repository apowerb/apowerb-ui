import { Suspense } from "react";
import WebhookManager from "@/components/WebhookManager";

export default function WebhooksPage() {
  return (
    <Suspense fallback={null}>
      <WebhookManager />
    </Suspense>
  );
}
