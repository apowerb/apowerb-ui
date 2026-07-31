"use client";

import { useLocale, useTranslations } from "use-intl";
import { useRouter } from "@/lib/navigation";
import { useState, useRef, useEffect } from "react";
import { Languages } from "lucide-react";
import { locales, localeNames } from "@/i18n/locales";
import FlagIcon, { FLAGS } from "./FlagIcon";

// L'écriture du cookie vit hors du composant : c'est un effet de bord sur le
// document, pas de l'état de rendu (et le compilateur React le voit ainsi).
function persistLocale(loc) {
  document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000; samesite=lax`;
}

// Sélecteur de langue. Écrit un cookie NEXT_LOCALE (lu côté serveur par
// src/i18n/request.js) puis rafraîchit pour re-rendre avec la nouvelle langue.
export function LanguageToggle() {
  const locale = useLocale();
  const t = useTranslations("LanguageToggle");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const select = (loc) => {
    persistLocale(loc);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={`${t("label")} — ${localeNames[locale] || locale}`}
        aria-label={`${t("label")} — ${localeNames[locale] || locale}`}
        className="w-9 h-9 flex items-center justify-center rounded-lg th-text-faint hover:th-text hover:th-bg-surface-hover transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {/* Le drapeau de la langue ACTIVE : la barre dit d'un coup d'œil dans
            quelle langue on est, là où une icône générique ne disait rien.
            Repli sur l'icône générique si la locale n'a pas de drapeau. */}
        {FLAGS[locale] ? (
          <FlagIcon locale={locale} size={18} className="rounded-[2px] overflow-hidden" />
        ) : (
          <Languages size={18} />
        )}
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 min-w-[9rem] rounded-lg border th-border th-bg-elevated shadow-lg overflow-hidden z-50">
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => select(loc)}
              className={`w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm hover:th-bg-surface-hover transition-colors ${
                loc === locale ? "th-text font-semibold" : "th-text-faint"
              }`}
            >
              {/* Le menu garde les noms : c'est un choix explicite, pas la
                  barre d'icônes — un drapeau seul y serait deviné, pas lu. */}
              <FlagIcon locale={loc} size={16} className="rounded-[2px] overflow-hidden" />
              {localeNames[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
