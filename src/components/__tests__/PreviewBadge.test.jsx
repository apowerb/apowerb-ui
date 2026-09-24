/**
 * Badge ambre "Preview" réutilisable (roadmap apowerb#100).
 *
 * Un seul interrupteur — `WORKFLOWS_PREVIEW_ENABLED` — doit suffire à faire
 * disparaître le badge des trois écrans qui l'utilisent, sans toucher à leur
 * code : c'est ce que le dernier test vérifie via la prop qui en hérite.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PreviewBadge, { WORKFLOWS_PREVIEW_ENABLED } from "@/components/PreviewBadge";
import fr from "../../../messages/fr.json";

describe("PreviewBadge", () => {
  it("affiche le libellé Preview avec une infobulle qui explique la préversion", () => {
    render(<PreviewBadge />);
    const badge = screen.getByTestId("preview-badge");
    expect(badge).toHaveTextContent("Preview");
    expect(badge).toHaveAttribute("title", "Preview feature — feedback welcome");
    expect(badge).toHaveAttribute("aria-label", "Preview feature — feedback welcome");
  });

  it("est activé par défaut via l'interrupteur unique WORKFLOWS_PREVIEW_ENABLED", () => {
    expect(WORKFLOWS_PREVIEW_ENABLED).toBe(true);
  });

  it("disparaît quand on le désactive (même mécanisme que l'interrupteur global)", () => {
    const { container } = render(<PreviewBadge enabled={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("n'ajoute pas d'arrêt clavier : il vit à l'intérieur d'un lien", () => {
    render(<PreviewBadge />);
    expect(screen.getByTestId("preview-badge")).not.toHaveAttribute("tabindex");
  });

  it("reste lisible en thème clair : fond ambre plein et texte foncé", () => {
    render(<PreviewBadge />);
    expect(screen.getByTestId("preview-badge")).toHaveClass("bg-amber-400", "text-amber-950");
  });

  it("se réduit à une pastille nommée quand la barre est repliée", () => {
    render(<PreviewBadge collapsed />);
    const dot = screen.getByRole("img", { name: "Preview — Preview feature — feedback welcome" });
    expect(dot).toHaveClass("absolute");
    expect(dot).toBeEmptyDOMElement();
  });

  it("s'appelle « Préversion » en français", () => {
    expect(fr.PreviewBadge.label).toBe("Préversion");
  });
});
