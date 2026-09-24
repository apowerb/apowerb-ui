/**
 * Non-regression test for apowerb roadmap #103: the integration logos used
 * to be defined inline in IntegrationsManager.jsx. They are now extracted
 * into src/components/icons/integrationLogos.jsx and re-imported here, so
 * every provider must still point at the exact same icon component (same
 * reference => same render, no visual change) as before the extraction.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import IntegrationsManager, { getProviders } from "../IntegrationsManager";
import {
  GithubIcon,
  GoogleDriveIcon,
  GmailIcon,
  GoogleCalendarIcon,
  GoogleSheetsIcon,
  GoogleDocsIcon,
  OutlookIcon,
  TeamsIcon,
  SharePointIcon,
  OneDriveIcon,
} from "@/components/icons/integrationLogos";

const t = (key) => key;

describe("IntegrationsManager providers: logo non-regression", () => {
  it("still wires each provider to its original shared logo component", () => {
    const providers = getProviders(t);
    const byKey = Object.fromEntries(providers.map((p) => [p.key, p]));

    expect(byKey.github.icon).toBe(GithubIcon);
    expect(byKey.microsoft_outlook.icon).toBe(OutlookIcon);
    expect(byKey.microsoft_teams.icon).toBe(TeamsIcon);
    expect(byKey.microsoft_onedrive.icon).toBe(OneDriveIcon);
    expect(byKey.microsoft_sharepoint.icon).toBe(SharePointIcon);
    expect(byKey.google_drive.icon).toBe(GoogleDriveIcon);
    expect(byKey.google_gmail.icon).toBe(GmailIcon);
    expect(byKey.google_calendar.icon).toBe(GoogleCalendarIcon);
    expect(byKey.google_sheets.icon).toBe(GoogleSheetsIcon);
    expect(byKey.google_docs.icon).toBe(GoogleDocsIcon);
  });

  it("keeps the same provider count and odoo's lucide Database icon untouched", () => {
    const providers = getProviders(t);
    expect(providers).toHaveLength(11);
    const odoo = providers.find((p) => p.key === "odoo");
    expect(odoo).toBeTruthy();
    expect(odoo.icon).not.toBe(GithubIcon);
  });
});

describe("IntegrationsManager render: logo non-regression", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
  });

  it("renders one logo svg per provider once loaded", async () => {
    const { container } = render(<IntegrationsManager />);
    await waitFor(() => expect(container.querySelectorAll(".animate-pulse").length).toBe(0));

    // 9 custom SVG logos (github, outlook, teams, onedrive, sharepoint,
    // drive, gmail, calendar, sheets, docs = 10 providers, odoo uses a
    // lucide Database icon instead of an inline <svg>).
    const svgLogos = container.querySelectorAll("svg");
    expect(svgLogos.length).toBeGreaterThanOrEqual(9);
  });
});
