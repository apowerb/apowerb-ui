/**
 * Capture d'écran d'un signalement de bug, masquée avant d'être produite.
 *
 * Une capture part avec tout ce que l'utilisateur avait sous les yeux —
 * le nom de ses clients, le contenu d'une conversation, parfois un mot de
 * passe affiché par un gestionnaire. Deux garde-fous, dans cet ordre :
 *
 * 1. **le masquage a lieu dans le DOM cloné** que html2canvas fabrique
 *    (`onclone`), jamais dans la page réelle : masquer puis démasquer la
 *    vraie page ferait clignoter l'interface et, si la capture échoue au
 *    milieu, laisserait l'écran de l'utilisateur masqué ;
 * 2. **l'utilisateur voit l'aperçu** et confirme avant l'envoi. Le
 *    consentement porte sur ce qu'il a vu, pas sur une case cochée à
 *    l'aveugle.
 *
 * Marquer un élément à masquer : `data-bug-report-mask` sur le nœud.
 * Les champs mot de passe le sont d'office.
 */

const MASK_ATTRIBUTE = "data-bug-report-mask";
// Largeur maximale de l'image produite. Au-delà, on n'ajoute que du poids :
// un défaut d'affichage se voit à 1600 px de large.
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.85;

/** Sélecteurs masqués sans que personne ait à les annoter. */
const ALWAYS_MASKED = [
  'input[type="password"]',
  `[${MASK_ATTRIBUTE}]`,
  "[data-sensitive]",
];

function maskElement(element) {
  if (!element?.style) return;
  // Un filtre plutôt qu'un remplacement de texte : la mise en page reste
  // exacte, donc le bug d'affichage qu'on cherchait à montrer reste
  // visible autour de la zone masquée.
  element.style.filter = "blur(6px)";
  element.style.userSelect = "none";
  if (element.tagName === "INPUT") {
    element.setAttribute("value", "••••••••");
  }
}

export function maskSensitiveNodes(root) {
  if (!root?.querySelectorAll) return 0;
  let masked = 0;
  for (const selector of ALWAYS_MASKED) {
    for (const element of root.querySelectorAll(selector)) {
      maskElement(element);
      masked += 1;
    }
  }
  return masked;
}

/**
 * Produit une data URL JPEG de la page visible, champs sensibles masqués.
 *
 * Retourne `null` plutôt que de lever : un signalement sans capture reste
 * un signalement utile, et l'utilisateur ne doit pas perdre son texte
 * parce qu'un canvas a échoué.
 */
export async function captureScreenshot(target = null) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  try {
    const { default: html2canvas } = await import("html2canvas-pro");
    const element = target || document.body;

    const canvas = await html2canvas(element, {
      backgroundColor: null,
      // 1 et non 2 : une capture de diagnostic n'a pas besoin du Retina,
      // et le poids se paie sur la limite d'envoi.
      scale: 1,
      useCORS: true,
      logging: false,
      // Ce qui est à l'écran, pas la page entière déroulée : c'est ce que
      // l'utilisateur décrit.
      windowHeight: window.innerHeight,
      height: window.innerHeight,
      scrollY: -window.scrollY,
      onclone: (clonedDocument) => {
        maskSensitiveNodes(clonedDocument.body);
      },
    });

    const scaled = downscale(canvas);
    return scaled.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch (error) {
    console.warn("[bug-report] Capture impossible :", error?.message || error);
    return null;
  }
}

function downscale(canvas) {
  if (canvas.width <= MAX_WIDTH) return canvas;
  const ratio = MAX_WIDTH / canvas.width;
  const small = document.createElement("canvas");
  small.width = MAX_WIDTH;
  small.height = Math.round(canvas.height * ratio);
  small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
  return small;
}

export const BUG_REPORT_MASK_ATTRIBUTE = MASK_ATTRIBUTE;
