import { Image } from "@/lib/navigation";

/**
 * Logo rond thaink2, adaptatif au thème.
 * Thème sombre → monogramme blanc ; thème clair → logo bleu d'origine.
 * Le swap se fait en CSS via les classes brand-dark-only / brand-light-only
 * (voir globals.css). Accepte les mêmes props que next/image (fill, width,
 * height, sizes, priority, className…).
 */
export default function BrandIcon({ className = "", alt = "thaink2", ...props }) {
  return (
    <>
      <Image
        src="/thaink2_logo_circle_white.png"
        alt={alt}
        className={`brand-dark-only ${className}`}
        {...props}
      />
      {/* Variante claire : décorative pour éviter un alt dupliqué (a11y) ;
          l'alt sémantique est porté par la variante sombre ci-dessus. */}
      <Image
        src="/thaink2_logo_circle.png"
        alt=""
        aria-hidden="true"
        className={`brand-light-only ${className}`}
        {...props}
      />
    </>
  );
}
