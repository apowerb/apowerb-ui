"use client";

/**
 * La pastille d'alerte.
 *
 * Trois états, parce que trois messages différents :
 * - **rien** : pas de pastille du tout. Un « 0 » affiché en permanence
 *   devient du décor, et on cesse de le voir le jour où il passe à 1 ;
 * - **ambre** : des signalements attendent le triage ;
 * - **rouge, qui pulse** : au moins un bloquant. Le mouvement est réservé
 *   à ce cas — s'il clignotait aussi pour trois coquilles d'affichage,
 *   il ne voudrait plus rien dire.
 */

export default function BugReportBadge({ news = 0, blockers = 0, className = "" }) {
  if (!news && !blockers) return null;

  const urgent = blockers > 0;
  const valeur = urgent ? blockers : news;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5
        rounded-full text-[11px] font-semibold tabular-nums border
        ${urgent
          ? "bg-red-500/15 text-red-300 border-red-500/50"
          : "bg-amber-500/15 text-amber-300 border-amber-500/40"}
        ${className}`}
      title={
        urgent
          ? `${blockers} bloquant(s) — ${news} en attente`
          : `${news} signalement(s) en attente`
      }
    >
      {urgent && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1" aria-hidden="true" />
      )}
      {valeur > 99 ? "99+" : valeur}
    </span>
  );
}
