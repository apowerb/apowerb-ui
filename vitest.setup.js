import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// i18n en test : on mocke next-intl pour résoudre via le vrai catalogue
// messages/en.json. Ainsi les tests existants, qui assertent sur le texte
// anglais visible, passent sans modification et sans avoir à envelopper chaque
// render dans un NextIntlClientProvider.
// Meme mock pour use-intl : les composants migres depuis next-intl
// importent les hooks depuis le coeur agnostique du framework. Sans ceci,
// ils ne resoudraient plus aucun message en test.
vi.mock("use-intl", async (importOriginal) => {
  const actual = await importOriginal();
  const messages = (await import("./messages/en.json")).default;

  return {
    ...actual,
    useTranslations: (namespace) =>
      actual.createTranslator({ locale: "en", messages, namespace }),
    useLocale: () => "en",
    useFormatter: () => ({
      dateTime: (v) => String(v),
      number: (v) => String(v),
      relativeTime: (v) => String(v),
      list: (v) => (Array.isArray(v) ? v.join(", ") : String(v)),
    }),
    useNow: () => new Date(0),
    useTimeZone: () => "UTC",
  };
});

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal();
  const { createTranslator } = await import("use-intl");
  const messages = (await import("./messages/en.json")).default;

  return {
    ...actual,
    // Vrai moteur ICU (pluriels, interpolation, rich) branché sur en.json.
    useTranslations: (namespace) =>
      createTranslator({ locale: "en", messages, namespace }),
    useLocale: () => "en",
    useFormatter: () => ({
      dateTime: (v) => String(v),
      number: (v) => String(v),
      relativeTime: (v) => String(v),
      list: (v) => (Array.isArray(v) ? v.join(", ") : String(v)),
    }),
    useNow: () => new Date(0),
    useTimeZone: () => "UTC",
  };
});
