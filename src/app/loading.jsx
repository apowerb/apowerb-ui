import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("Loading");
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-[var(--border-primary)] border-t-[var(--color-brand,#013DFF)] rounded-full animate-spin" />
        <p className="text-sm th-text-muted animate-pulse">{t("loading")}</p>
      </div>
    </div>
  );
}
