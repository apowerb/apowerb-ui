import SchedulerManager from "@/components/SchedulerManager";
import { RequiresSetup } from "@/components/SetupNotice";

// Sans th2etl, l'orchestrateur n'a rien a lister : l'ecran entier est
// remplace par « pas encore configure » plutot que par un 503.
export default function OrchestratorPage() {
  return (
    <RequiresSetup capability="orchestration">
      <SchedulerManager />
    </RequiresSetup>
  );
}
