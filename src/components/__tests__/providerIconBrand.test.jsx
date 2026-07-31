/**
 * L'icône du fournisseur thaink2 doit être le VRAI logo de marque.
 *
 * Une première version dessinait un monogramme « T2 » en SVG — générique et
 * étranger à la marque, alors que le logo (la méduse) existe déjà en asset et
 * est utilisé partout ailleurs dans l'app. Ce test empêche de re-dériver vers
 * un substitut dessiné à la main.
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

describe("ProviderIcon — thaink2", () => {
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

  it("affiche le nom quand showName est demandé", () => {
    const { container } = render(<ProviderIcon provider="thaink2" size={14} showName />);
    expect(container.textContent).toContain("thaink2");
  });

  it("laisse les providers tiers sur leur icône SVG d'origine", () => {
    const { container } = render(<ProviderIcon provider="anthropic" size={14} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
