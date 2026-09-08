import { Suspense } from "react";
import WebhookManager from "@/components/WebhookManager";
import { SetupNotice } from "@/components/SetupNotice";

// Les declencheurs Google et Outlook ont besoin des memes identifiants OAuth
// que les integrations ; les webhooks entrants generiques marchent sans eux.
export default function WebhooksPage() {
  return (
    <div className="flex flex-col h-full">
      <SetupNotice
        capabilities={["google_integration", "microsoft_integration"]}
        className="mx-6 mt-4"
      />
      <div className="flex-1 min-h-0">
        <Suspense fallback={null}>
          <WebhookManager />
        </Suspense>
      </div>
    </div>
  );
}
