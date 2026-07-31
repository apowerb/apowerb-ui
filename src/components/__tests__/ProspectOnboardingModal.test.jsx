import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ProspectOnboardingModal from "@/components/ProspectOnboardingModal";

vi.mock("@/lib/api", () => ({
  getProspectionProfile: vi.fn(),
  setProspectionProfile: vi.fn().mockResolvedValue({ profile: {} }),
}));

const fire = () =>
  window.dispatchEvent(new CustomEvent("th2prospect:agent-created"));

describe("ProspectOnboardingModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ne rend rien par defaut", () => {
    const { container } = render(<ProspectOnboardingModal />);
    expect(container.firstChild).toBeNull();
  });

  it("s'affiche a la creation d'un agent th2prospect si profil absent", async () => {
    const { getProspectionProfile } = await import("@/lib/api");
    getProspectionProfile.mockResolvedValue({ profile: {} });
    render(<ProspectOnboardingModal />);
    fire();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  it("s'affiche pre-rempli si le profil existe deja (a chaque creation)", async () => {
    const { getProspectionProfile } = await import("@/lib/api");
    getProspectionProfile.mockResolvedValue({ profile: { company_name: "ACME" } });
    render(<ProspectOnboardingModal />);
    fire();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByDisplayValue("ACME")).toBeInTheDocument();
  });

  it("persiste le profil au submit", async () => {
    const api = await import("@/lib/api");
    api.getProspectionProfile.mockResolvedValue({ profile: {} });
    render(<ProspectOnboardingModal />);
    fire();
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.change(screen.getByPlaceholderText(/thaink2/i), {
      target: { value: "MaBoite" },
    });
    fireEvent.click(screen.getByText(/Enregistrer et continuer/i));
    await waitFor(() =>
      expect(api.setProspectionProfile).toHaveBeenCalledWith(
        expect.objectContaining({ company_name: "MaBoite" }),
      ),
    );
  });
});
