/**
 * Lecture de la checklist servie par `GET /api/config/setup`.
 *
 * Deux invariants tiennent tout l'écran : une capacité *optionnelle* ne bloque
 * rien (le stockage retombe sur un dossier local), et une capacité *inconnue*
 * de cette version de l'interface est réputée présente — un serveur plus
 * ancien ne doit pas faire disparaître un écran qui marchait.
 */
import { describe, it, expect } from "vitest";
import {
  blockerOf,
  capability,
  isConfigured,
  missingCapabilities,
  parseNotConfiguredError,
} from "@/lib/setup";

const STATUS = {
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
    {
      key: "google_integration",
      configured: true,
      optional: false,
      blocks: ["google_integrations", "google_webhooks"],
      missing: [],
      docs_url: "https://docs.apowerb.com/configuration/google",
    },
  ],
  missing_count: 1,
};

describe("lecture de la checklist de configuration", () => {
  it("rend la ligne d'une capacité, et null pour une inconnue", () => {
    expect(capability(STATUS, "orchestration").missing).toHaveLength(2);
    expect(capability(STATUS, "quantum")).toBeNull();
  });

  it("une capacité inconnue ou une checklist absente passe pour configurée", () => {
    expect(isConfigured(STATUS, "quantum")).toBe(true);
    expect(isConfigured(null, "orchestration")).toBe(true);
    expect(isConfigured(STATUS, "orchestration")).toBe(false);
  });

  it("ne retient que ce qui manque vraiment : ni configuré, ni optionnel", () => {
    const missing = missingCapabilities(STATUS, [
      "orchestration",
      "object_storage",
      "google_integration",
    ]);
    expect(missing.map((item) => item.key)).toEqual(["orchestration"]);
  });

  it("désigne la capacité qui bloque une fonctionnalité nommée", () => {
    expect(blockerOf(STATUS, "orchestrator").key).toBe("orchestration");
    // google_webhooks est bloqué par une capacité *configurée* : rien à dire.
    expect(blockerOf(STATUS, "google_webhooks")).toBeNull();
  });

  it("décode le 503 « pas configuré » et laisse passer les vraies pannes", () => {
    const body = {
      detail: {
        code: "NOT_CONFIGURED",
        capability: "orchestration",
        message: "orchestration is not configured on this server.",
      },
    };
    expect(parseNotConfiguredError(503, body).capability).toBe("orchestration");
    expect(parseNotConfiguredError(503, JSON.stringify(body)).capability).toBe(
      "orchestration",
    );
    // Une vraie indisponibilité de l'orchestrateur reste une panne.
    expect(parseNotConfiguredError(503, { detail: "upstream down" })).toBeNull();
    expect(parseNotConfiguredError(500, body)).toBeNull();
    expect(parseNotConfiguredError(503, "<html>502</html>")).toBeNull();
  });
});
