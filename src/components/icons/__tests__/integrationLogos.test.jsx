import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  GithubIcon,
  GoogleDriveIcon,
  GmailIcon,
  GoogleSheetsIcon,
  GoogleDocsIcon,
  OutlookIcon,
  TeamsIcon,
  SharePointIcon,
  OneDriveIcon,
  DEFAULT_TOOL_LOGO,
  DATABASE_TOOL_LOGO,
  getToolCategoryLogo,
} from "../integrationLogos";

describe("integration logo components", () => {
  it.each([
    ["GithubIcon", GithubIcon],
    ["GoogleDriveIcon", GoogleDriveIcon],
    ["GmailIcon", GmailIcon],
    ["GoogleSheetsIcon", GoogleSheetsIcon],
    ["GoogleDocsIcon", GoogleDocsIcon],
    ["OutlookIcon", OutlookIcon],
    ["TeamsIcon", TeamsIcon],
    ["SharePointIcon", SharePointIcon],
    ["OneDriveIcon", OneDriveIcon],
  ])("%s renders an svg", (_name, Icon) => {
    const { container } = render(<Icon size={20} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("width")).toBe("20");
  });
});

describe("getToolCategoryLogo", () => {
  it.each([
    ["tools_google_gmail", GmailIcon],
    ["gmail", GmailIcon],
    ["GMAIL", GmailIcon],
    ["tools_microsoft_outlook", OutlookIcon],
    ["tools_google_drive", GoogleDriveIcon],
    ["tools_google_sheets", GoogleSheetsIcon],
    ["tools_google_docs", GoogleDocsIcon],
    ["tools_microsoft_teams", TeamsIcon],
    ["tools_microsoft_onedrive", OneDriveIcon],
    ["tools_microsoft_sharepoint", SharePointIcon],
    ["tools_github", GithubIcon],
    ["tools_database", DATABASE_TOOL_LOGO],
    ["text_to_sql", DATABASE_TOOL_LOGO],
    ["tools_text_to_sql", DATABASE_TOOL_LOGO],
    ["sql_reporting", DATABASE_TOOL_LOGO],
  ])("maps category %s to the right logo", (category, expectedIcon) => {
    expect(getToolCategoryLogo(category)).toBe(expectedIcon);
  });

  it("disambiguates onedrive from generic google drive", () => {
    expect(getToolCategoryLogo("tools_microsoft_onedrive")).toBe(OneDriveIcon);
    expect(getToolCategoryLogo("tools_microsoft_onedrive")).not.toBe(GoogleDriveIcon);
  });

  it("falls back to the generic tool icon for an unknown category", () => {
    expect(getToolCategoryLogo("tools_weather")).toBe(DEFAULT_TOOL_LOGO);
    expect(getToolCategoryLogo("")).toBe(DEFAULT_TOOL_LOGO);
    expect(getToolCategoryLogo(undefined)).toBe(DEFAULT_TOOL_LOGO);
  });
});
