import DataPoolPage from "@/components/bi/DataPoolPage";
import { StorageModeNotice } from "@/components/SetupNotice";

// L'import BI marche toujours : sans S3, les fichiers vont dans un dossier
// local. Ce n'est pas une panne a signaler, c'est un mode a connaitre — le
// dossier part avec le conteneur.
export default function DataPoolRoute() {
  return (
    <div className="flex flex-col h-full">
      <StorageModeNotice className="mx-6 mt-4" />
      <div className="flex-1 min-h-0">
        <DataPoolPage />
      </div>
    </div>
  );
}
