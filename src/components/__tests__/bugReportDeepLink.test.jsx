/**
 * Le lien d'une issue vers l'écran de triage doit ouvrir le signalement.
 *
 * Mesuré le 14/09/2026 : chaque issue créée depuis un signalement renvoie à
 * `/admin/bug-reports/<id>` pour voir la capture d'écran — et cette adresse
 * répondait 404, seule la liste `/admin/bug-reports` existait. Les issues
 * déjà publiées portent ces liens : c'est la route qui doit exister.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  listBugReports: vi.fn(),
  listBugReportAreas: vi.fn(),
  getBugReport: vi.fn(),
  updateBugReport: vi.fn(),
  createBugReportIssue: vi.fn(),
  fetchBugReportScreenshot: vi.fn(),
  listBugReportEvents: vi.fn(async () => []),
}));

import { listBugReports, listBugReportAreas, getBugReport } from "@/lib/api";
import BugReportsAdmin from "@/components/bug-report/BugReportsAdmin";

beforeEach(() => {
  listBugReports.mockResolvedValue({ items: [] });
  listBugReportAreas.mockResolvedValue([]);
  getBugReport.mockReset().mockResolvedValue({
    id: 7, title: "[/chat] Une erreur", status: "new", severity: "major", area: "chat",
  });
});

describe("lien direct vers un signalement", () => {
  it("la route /admin/bug-reports/<id> existe et transmet l'identifiant", async () => {
    // Chemin en variable : si la route manque, seul ce cas échoue.
    const route = "@/app/(dashboard)/admin/bug-reports/[id]/page";
    const { default: ReportRoute } = await import(/* @vite-ignore */ route);

    const element = await ReportRoute({ params: Promise.resolve({ id: "7" }) });

    expect(element.type).toBe(BugReportsAdmin);
    expect(element.props.initialReportId).toBe("7");
  });

  it("l'écran de triage ouvre le signalement demandé", async () => {
    render(<BugReportsAdmin initialReportId="7" />);

    await waitFor(() => expect(getBugReport).toHaveBeenCalledWith("7"));
  });

  it("sans identifiant, il n'ouvre rien", async () => {
    render(<BugReportsAdmin />);

    await waitFor(() => expect(listBugReports).toHaveBeenCalled());
    expect(getBugReport).not.toHaveBeenCalled();
  });
});
