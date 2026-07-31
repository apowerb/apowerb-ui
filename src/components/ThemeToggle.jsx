"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "use-intl";
import { Sun, Moon } from "lucide-react";
import { useState } from "react";

/**
 * Bascule clair / sombre.
 *
 * Pas de libellé texte : l'état est déjà porté par la position du curseur ET
 * par son icône (lune / soleil). Le mot « Dark » / « Light » à côté était
 * redondant et cassait l'alignement de la barre d'icônes (demande Farid,
 * 27/07/26 : « restons sur des icônes, pas de texte »).
 *
 * Le sens n'est pas perdu pour autant : title + aria-label annoncent l'action,
 * désormais traduits — ils sont devenus les seuls porteurs de texte.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("ThemeToggle");
  const [mounted] = useState(() => typeof window !== "undefined");

  if (!mounted) return <div className="h-8" />;

  const isDark = theme === "dark";
  const label = isDark ? t("switchToLight") : t("switchToDark");

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="group flex items-center"
      title={label}
      aria-label={label}
    >
      {/* Toggle track */}
      <div
        className={`relative w-12 h-7 shrink-0 rounded-full transition-colors duration-300 ${
          isDark
            ? "bg-slate-600"
            : "bg-blue-200"
        }`}
      >
        {/* Thumb */}
        <div
          className={`absolute top-[3px] w-[22px] h-[22px] rounded-full shadow-sm transition-all duration-300 flex items-center justify-center ${
            isDark
              ? "left-[3px] bg-slate-300"
              : "left-[25px] bg-white"
          }`}
        >
          {isDark ? (
            <Moon size={12} className="text-slate-700" />
          ) : (
            <Sun size={12} className="text-purple-400" />
          )}
        </div>
      </div>
    </button>
  );
}
