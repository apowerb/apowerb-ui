/**
 * Le modèle par défaut porte le logo de l'application, et AUCUN nom de marque.
 *
 * Deux règles distinctes, toutes deux gardées ici.
 *
 * L'ICÔNE : une première version dessinait un monogramme « T2 » en SVG —
 * générique, alors que le logo existe déjà en asset et sert partout ailleurs.
 * Ce test empêche de re-dériver vers un substitut dessiné à la main.
 *
 * Le LIBELLÉ : il affichait « thaink2 », et l'infobulle du sélecteur promettait
 * une imputation « à votre crédit thaink2 » dans une build qui ne sait pas
 * facturer — la facturation est une brique commerciale. La clé technique reste
 * `thaink2` (elle est appariée avec le backend et ne s'affiche jamais) ; ce qui
 * se voit doit rester neutre, car l'exploitant d'une instance auto-hébergée
 * n'est pas thaink2.
 */
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === "string" ? src : ""} alt={alt} className={className} />
  ),
}));

import ProviderIcon from "@/components/ProviderIcon";

describe("ProviderIcon — modèle par défaut", () => {
  it("rend le logo de marque, pas un monogramme dessiné", () => {
    const { container } = render(<ProviderIcon provider="thaink2" size={14} />);
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs.every((i) => i.getAttribute("src").includes("thaink2_logo"))).toBe(true);
    // Aucun tracé maison ne doit subsister pour ce provider.
    expect(container.querySelector("svg path")).toBeNull();
  });

  it("fournit les deux variantes de thème (clair et sombre)", () => {
    const { container } = render(<ProviderIcon provider="thaink2" size={14} />);
    expect(container.querySelector(".brand-dark-only")).toBeInTheDocument();
    expect(container.querySelector(".brand-light-only")).toBeInTheDocument();
  });

  it("n'affiche pas le repli à deux lettres réservé aux providers inconnus", () => {
    const { container } = render(<ProviderIcon provider="thaink2" size={14} />);
    expect(container.textContent).not.toContain("TH");
  });

  it("affiche un nom quand showName est demandé", () => {
    const { container } = render(<ProviderIcon provider="thaink2" size={14} showName />);
    expect(container.textContent.trim()).not.toBe("");
  });

  it("ne nomme aucune marque dans le libellé visible", () => {
    const { container } = render(<ProviderIcon provider="thaink2" size={14} showName />);
    expect(container.textContent.toLowerCase()).not.toContain("thaink2");
  });

  it("laisse les providers tiers sur leur icône SVG d'origine", () => {
    const { container } = render(<ProviderIcon provider="anthropic" size={14} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
