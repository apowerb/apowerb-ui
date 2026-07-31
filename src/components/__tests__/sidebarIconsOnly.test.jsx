/**
 * Barre latérale en icônes seules (demande Farid, 27/07/26) :
 * « restons sur des icônes, pas de texte ».
 *
 * Ce qui est verrouillé ici : plus de mot « Dark »/« Light » visible, et un
 * drapeau — pas une icône générique — pour la langue active. L'accessibilité
 * ne doit PAS payer le prix du nettoyage visuel : le sens migre vers
 * aria-label, on le vérifie explicitement.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const setTheme = vi.fn();
let currentTheme = "dark";
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}));

let currentLocale = "fr";
vi.mock("use-intl", () => ({
  useTheme: undefined,
  useLocale: () => currentLocale,
  useTranslations: () => (key) => key,
}));

const refresh = vi.fn();
vi.mock("@/lib/navigation", () => ({
  // L'abstraction fournit aussi Link et Image : sans eux, le rendu casse.
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ refresh }),
}));

import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import FlagIcon from "@/components/FlagIcon";

describe("ThemeToggle — icône seule", () => {
  beforeEach(() => {
    setTheme.mockReset();
    currentTheme = "dark";
  });

  it("n'affiche plus le mot Dark / Light", () => {
    render(<ThemeToggle />);
    expect(screen.queryByText("Dark")).not.toBeInTheDocument();
    expect(screen.queryByText("Light")).not.toBeInTheDocument();
    expect(screen.getByRole("button").textContent.trim()).toBe("");
  });

  it("garde un libellé accessible qui annonce l'action", () => {
    render(<ThemeToggle />);
    // En thème sombre, l'action proposée est de passer en clair.
    expect(screen.getByRole("button")).toHaveAccessibleName("switchToLight");
  });

  it("bascule toujours le thème", async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button"));
    expect(setTheme).toHaveBeenCalledWith("light");
  });
});

describe("LanguageToggle — drapeau de la langue active", () => {
  beforeEach(() => {
    currentLocale = "fr";
  });

  it("rend un drapeau SVG, pas un emoji (Windows ne rend pas les emoji drapeaux)", () => {
    const { container } = render(<FlagIcon locale="fr" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).toBe("");
  });

  it("ne rend rien pour une locale sans drapeau, plutôt qu'un carré vide", () => {
    const { container } = render(<FlagIcon locale="de" />);
    expect(container.innerHTML).toBe("");
  });

  it("affiche le drapeau de la locale courante dans la barre", () => {
    const { container } = render(<LanguageToggle />);
    expect(container.querySelector("button svg")).toBeInTheDocument();
  });

  it("annonce la langue active dans le libellé accessible", () => {
    render(<LanguageToggle />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("Français");
  });

  it("garde les noms de langue dans le menu déroulant", async () => {
    render(<LanguageToggle />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Français")).toBeInTheDocument();
    expect(screen.getByText("English")).toBeInTheDocument();
  });
});
