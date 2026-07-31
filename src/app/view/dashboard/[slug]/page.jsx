import { ToastProvider } from "@/components/Toast";
import PublicDashboardView from "@/components/bi/PublicDashboardView";

export default async function PublicDashboardPage({ params }) {
  const { slug } = await params;
  return (
    <ToastProvider>
      <PublicDashboardView slug={slug} />
    </ToastProvider>
  );
}
