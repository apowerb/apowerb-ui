"use client";

/**
 * Le point d'entrée du signalement, et la mémoire qui le rend utile.
 *
 * Ce composant fait deux choses que rien d'autre ne peut faire à sa
 * place, parce qu'elles demandent d'être montées en permanence :
 *
 * - **il tient le fil de navigation.** Un défaut vient souvent de
 *   l'écran d'où l'on arrive, avec un filtre resté posé ou une sélection
 *   vidée. Reconstituer ce chemin après coup est impossible ; l'observer
 *   en continu coûte une ligne par changement de route ;
 * - **il capte les erreurs du navigateur** avant qu'elles disparaissent
 *   dans une console que personne n'ouvrira.
 *
 * Le bouton, lui, prend la capture **avant** d'ouvrir le formulaire :
 * l'inverse photographierait le formulaire au lieu du défaut.
 */

import { useCallback, useEffect, useState } from "react";
import { Bug, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "use-intl";

import { installBrowserErrorCapture, recordAction, recordNavigation } from "@/lib/api";
import { captureScreenshot } from "@/lib/bugScreenshot";
import BugReportModal from "./BugReportModal";

/** Nom lisible d'un écran, déduit de sa route. */
function screenLabel(pathname) {
  if (!pathname || pathname === "/") return "Accueil";
  const segments = pathname.split("/").filter(Boolean);
  const meaningful = segments.filter(
    (segment) => !/^\d+$/.test(segment) && !/^[0-9a-f-]{16,}$/i.test(segment),
  );
  const last = meaningful[meaningful.length - 1] || segments[0];
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ");
}

/** Ce que la machine sait de l'endroit et du moment. */
function clientContext(pathname) {
  if (typeof window === "undefined") return {};
  return {
    url: window.location.href,
    route: pathname,
    screen: screenLabel(pathname),
    app_version: process.env.NEXT_PUBLIC_APP_VERSION || null,
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    locale: navigator.language,
    theme: document.documentElement.dataset.theme || null,
    occurred_at: new Date().toISOString(),
  };
}

export default function BugReportLauncher() {
  const t = useTranslations("BugReportModal");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [context, setContext] = useState({});

  useEffect(() => installBrowserErrorCapture(), []);

  useEffect(() => {
    if (pathname) recordNavigation({ route: pathname, label: screenLabel(pathname) });
  }, [pathname]);

  // Le dernier geste : capté en phase de capture pour voir le clic même
  // quand le gestionnaire de l'élément arrête la propagation — c'est
  // justement sur ces éléments-là que les défauts se produisent.
  useEffect(() => {
    const onClick = (event) => {
      const actionable = event.target?.closest?.(
        "button, a, [role='button'], [role='menuitem'], [role='tab']",
      );
      if (!actionable) return;
      const label =
        actionable.getAttribute("aria-label") ||
        actionable.innerText?.trim().slice(0, 80) ||
        actionable.getAttribute("title");
      if (label) {
        recordAction({
          label,
          kind: "clic",
          target: actionable.tagName.toLowerCase(),
        });
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const openReport = useCallback(async () => {
    setCapturing(true);
    setContext({
      client: clientContext(pathname),
      whereIWas: screenLabel(pathname),
    });
    try {
      setScreenshot(await captureScreenshot());
    } finally {
      setCapturing(false);
      setOpen(true);
    }
  }, [pathname]);

  const close = useCallback(() => {
    setOpen(false);
    setScreenshot(null);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openReport}
        disabled={capturing}
        title={t("launcher")}
        aria-label={t("launcher")}
        // Masqué de la capture : le bouton n'a pas à figurer sur l'image
        // du défaut qu'il sert à signaler.
        data-bug-report-mask
        className="fixed bottom-4 right-4 z-[50] w-11 h-11 rounded-full shadow-lg th-bg-surface th-border border flex items-center justify-center th-hover print:hidden"
      >
        {capturing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Bug className="w-5 h-5" />
        )}
      </button>

      <BugReportModal
        show={open}
        onClose={close}
        screenshot={screenshot}
        context={context}
      />
    </>
  );
}
