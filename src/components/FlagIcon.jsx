"use client";

/**
 * Drapeaux des locales, en SVG inline.
 *
 * Volontairement PAS des emoji (🇫🇷 / 🇬🇧) : Windows ne rend pas les
 * séquences d'indicateurs régionaux et affiche « FR » / « GB » en lettres —
 * ce qui viderait de son sens un sélecteur censé être purement visuel.
 * Un SVG rend à l'identique partout.
 *
 * Tracés simplifiés, lisibles à 18px : c'est un repère de langue, pas une
 * reproduction héraldique.
 */

function FrFlag({ size }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 30 21" aria-hidden="true">
      <rect width="30" height="21" fill="#FFFFFF" />
      <rect width="10" height="21" fill="#002395" />
      <rect x="20" width="10" height="21" fill="#ED2939" />
    </svg>
  );
}

function GbFlag({ size }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 30 21" aria-hidden="true">
      <rect width="30" height="21" fill="#012169" />
      {/* Diagonales blanches puis rouges (saltires) */}
      <path d="M0,0 L30,21 M30,0 L0,21" stroke="#FFFFFF" strokeWidth="4.2" />
      <path d="M0,0 L30,21 M30,0 L0,21" stroke="#C8102E" strokeWidth="2.1" />
      {/* Croix centrale */}
      <path d="M15,0 V21 M0,10.5 H30" stroke="#FFFFFF" strokeWidth="7" />
      <path d="M15,0 V21 M0,10.5 H30" stroke="#C8102E" strokeWidth="4.2" />
    </svg>
  );
}

const FLAGS = { fr: FrFlag, en: GbFlag };

/** Drapeau de la locale, ou `null` si la locale n'en a pas (jamais un carré vide). */
export default function FlagIcon({ locale, size = 18, className = "" }) {
  const Flag = FLAGS[locale];
  if (!Flag) return null;
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <Flag size={size} />
    </span>
  );
}

export { FLAGS };
