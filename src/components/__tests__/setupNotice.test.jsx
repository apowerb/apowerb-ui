/**
 * « Pas encore configuré » — ce que voit un utilisateur, ce que voit un
 * administrateur.
 *
 * David, 08/09/2026 : personne ne doit rencontrer un 4xx/5xx pour une
 * fonctionnalité qui n'est pas installée. Et le cœur ne sert les NOMS des
 * variables manquantes qu'aux administrateurs : l'écran ne doit jamais les
 * afficher à quelqu'un d'autre — ni inventer de valeur.
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

import { SetupNotice, RequiresSetup } from "@/components/SetupNotice";
import { invalidateSetupStatus } from "@/hooks/useSetupStatus";

const ORCHESTRATION_MISSING = {
  items: [
    {
      key: "orchestration",
      configured: false,
      optional: false,
      blocks: ["orchestrator"],
      missing: ["TH2ETL_BASE_URL", "TH2ETL_API_KEY"],
      docs_url: "https://docs.apowerb.com/configuration/orchestration",
    },
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
  missing_count: 1,
};

async function serve(status, user = { role: "USER" }) {
  currentUser = user;
  getSetupStatus.mockResolvedValue(status);
  await invalidateSetupStatus();
}

describe("SetupNotice", () => {
  beforeEach(() => {
    getSetupStatus.mockReset();
  });

  it("dit à un utilisateur de contacter son administrateur, sans nommer une variable", async () => {
    await serve(ORCHESTRATION_MISSING);
    render(<SetupNotice capabilities={["orchestration"]} />);

    const notice = await screen.findByTestId("setup-notice");
    expect(notice).toHaveAttribute("data-capabilities", "orchestration");
    expect(screen.getByText("noticeUser")).toBeInTheDocument();
    expect(screen.queryByText(/TH2ETL_BASE_URL/)).toBeNull();
  });

  it("donne à un administrateur les noms des variables et le lien de doc", async () => {
    await serve(ORCHESTRATION_MISSING, { role: "ADMIN" });
    render(<SetupNotice capabilities={["orchestration"]} />);

    expect(await screen.findByTestId("setup-notice")).toBeInTheDocument();
    expect(screen.getByText(/TH2ETL_BASE_URL · TH2ETL_API_KEY/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /docs/ })).toHaveAttribute(
      "href",
      "https://docs.apowerb.com/configuration/orchestration",
    );
  });

  it("ne dit rien d'une capacité optionnelle : le stockage local marche", async () => {
    await serve(ORCHESTRATION_MISSING, { role: "ADMIN" });
    const { container } = render(<SetupNotice capabilities={["object_storage"]} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("ne dit rien quand la checklist n'a pas répondu", async () => {
    await serve(null);
    const { container } = render(<SetupNotice capabilities={["orchestration"]} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("RequiresSetup", () => {
  beforeEach(() => {
    getSetupStatus.mockReset();
  });

  it("remplace l'écran quand la capacité manque", async () => {
    await serve(ORCHESTRATION_MISSING);
    render(
      <RequiresSetup capability="orchestration">
        <p>tâches planifiées</p>
      </RequiresSetup>,
    );

    expect(await screen.findByTestId("requires-setup")).toHaveAttribute(
      "data-capability",
      "orchestration",
    );
    expect(screen.queryByText("tâches planifiées")).toBeNull();
    expect(screen.getByText("noticeUser")).toBeInTheDocument();
  });

  it("laisse l'écran quand la capacité est configurée", async () => {
    await serve({
      items: [
        {
          key: "orchestration",
          configured: true,
          optional: false,
          blocks: ["orchestrator"],
          missing: [],
          docs_url: "https://docs.apowerb.com/configuration/orchestration",
        },
      ],
      missing_count: 0,
    });
    render(
      <RequiresSetup capability="orchestration">
        <p>tâches planifiées</p>
      </RequiresSetup>,
    );
    expect(await screen.findByText("tâches planifiées")).toBeInTheDocument();
  });
});
