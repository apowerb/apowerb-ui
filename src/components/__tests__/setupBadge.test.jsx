/**
 * La pastille de la barre latérale et le bandeau de stockage.
 *
 * Deux règles qui tiennent à la personne qui regarde : le compteur de ce qui
 * reste à configurer n'a de sens que pour un administrateur (lui seul peut y
 * remédier), et le mode de stockage se dit à tout le monde — un fichier
 * déposé dans un dossier local part avec le conteneur.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("use-intl", () => ({
  useTranslations: () => (key, values) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const getSetupStatus = vi.fn();
vi.mock("@/lib/api", () => ({
  getSetupStatus: (...args) => getSetupStatus(...args),
}));

let currentUser = { role: "USER" };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: currentUser }),
}));

import SetupBadge from "@/components/SetupBadge";
import { StorageModeNotice } from "@/components/SetupNotice";
import { invalidateSetupStatus } from "@/hooks/useSetupStatus";

const LOCAL_STORAGE_STATUS = {
  items: [
    {
      key: "object_storage",
      configured: true,
      mode: "local",
      optional: true,
      blocks: [],
      missing: ["S3_BUCKET_NAME"],
      docs_url: "https://docs.apowerb.com/configuration/storage",
    },
  ],
  missing_count: 2,
};

async function serve(status, user) {
  currentUser = user;
  getSetupStatus.mockResolvedValue(status);
  await invalidateSetupStatus();
}

describe("SetupBadge", () => {
  beforeEach(() => getSetupStatus.mockReset());

  it("compte pour un administrateur", async () => {
    await serve(LOCAL_STORAGE_STATUS, { role: "ADMIN" });
    render(<SetupBadge />);
    expect(await screen.findByTestId("setup-badge")).toHaveTextContent("2");
  });

  it("reste muette pour un utilisateur : il ne peut rien y faire", async () => {
    await serve(LOCAL_STORAGE_STATUS, { role: "USER" });
    const { container } = render(<SetupBadge />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("disparaît quand tout est configuré", async () => {
    await serve({ items: [], missing_count: 0 }, { role: "ADMIN" });
    const { container } = render(<SetupBadge />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("StorageModeNotice", () => {
  beforeEach(() => getSetupStatus.mockReset());

  it("prévient tout le monde que le dossier local est éphémère", async () => {
    await serve(LOCAL_STORAGE_STATUS, { role: "USER" });
    render(<StorageModeNotice />);
    expect(await screen.findByTestId("storage-mode-notice")).toBeInTheDocument();
    expect(screen.getByText("storageLocal")).toBeInTheDocument();
    // Le lien de configuration ne s'adresse qu'a qui peut configurer.
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("propose S3 à un administrateur", async () => {
    await serve(LOCAL_STORAGE_STATUS, { role: "ADMIN" });
    render(<StorageModeNotice />);
    expect(await screen.findByRole("link")).toHaveAttribute(
      "href",
      "https://docs.apowerb.com/configuration/storage",
    );
  });

  it("se tait quand le stockage est un S3", async () => {
    await serve(
      {
        items: [
          {
            key: "object_storage",
            configured: true,
            mode: "s3",
            optional: true,
            blocks: [],
            missing: [],
            docs_url: "https://docs.apowerb.com/configuration/storage",
          },
        ],
        missing_count: 0,
      },
      { role: "ADMIN" },
    );
    const { container } = render(<StorageModeNotice />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
