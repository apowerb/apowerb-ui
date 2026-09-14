import BugReportsAdmin from "@/components/bug-report/BugReportsAdmin";

// Chaque issue créée depuis un signalement renvoie ici pour voir la capture.
export default async function BugReportRoute({ params }) {
  const { id } = await params;
  return <BugReportsAdmin initialReportId={id} />;
}
