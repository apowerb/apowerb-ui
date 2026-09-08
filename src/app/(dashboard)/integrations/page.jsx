import IntegrationsManager from "@/components/IntegrationsManager";
import { SetupNotice } from "@/components/SetupNotice";

// L'ecran marche meme sans Google ni Microsoft (les autres connecteurs
// restent la) : un bandeau, pas un blocage, et il disparait des que les deux
// identifiants OAuth sont poses.
export default function IntegrationsPage() {
  return (
    <div className="flex flex-col h-full">
      <SetupNotice
        capabilities={["google_integration", "microsoft_integration"]}
        className="mx-6 mt-4"
      />
      <div className="flex-1 min-h-0">
        <IntegrationsManager />
      </div>
    </div>
  );
}
