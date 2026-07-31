import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { locales, defaultLocale } from "./locales";

// Mode "sans routing par locale" : la langue vient d'un cookie NEXT_LOCALE,
// pas de l'URL. Aucune route ne change (pas de segment [locale]).
export default getRequestConfig(async () => {
  const store = await cookies();
  const candidate = store.get("NEXT_LOCALE")?.value;
  const locale = locales.includes(candidate) ? candidate : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
