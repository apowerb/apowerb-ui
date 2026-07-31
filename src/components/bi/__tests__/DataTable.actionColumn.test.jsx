import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DataTable from "../DataTable";

// Lightweight mock — we just need to verify AttachmentMenu is rendered
// with the right webhookLogId, not test its internals here.
vi.mock("../AttachmentMenu", () => ({
  default: ({ webhookLogId }) => (
    <button data-testid="attachment-menu" data-webhook-id={webhookLogId}>
      Voir PJ
    </button>
  ),
}));

const ROWS = [
  { Fournisseur: "SOCOMEC", Montant: 1200, WebhookLogId: 101 },
  { Fournisseur: "TILCO", Montant: 800, WebhookLogId: null },
];
const COLUMNS = ["Fournisseur", "Montant", "WebhookLogId"];

const ACTION_COLUMN = {
  type: "webhook_attachment",
  source_column: "WebhookLogId",
};

describe("DataTable actionColumn", () => {
  it("injects AttachmentMenu when chart config has actionColumn.type === 'webhook_attachment'", () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        actionColumn={ACTION_COLUMN}
      />
    );
    const menus = screen.getAllByTestId("attachment-menu");
    expect(menus).toHaveLength(2);
    expect(menus[0]).toHaveAttribute("data-webhook-id", "101");
    // React omits the attribute when value is null
    expect(menus[1]).not.toHaveAttribute("data-webhook-id");
  });

  it("hides the source_column (WebhookLogId) from column headers", () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        actionColumn={ACTION_COLUMN}
      />
    );
    // The raw numeric column should NOT appear as a header
    const headers = screen.queryAllByRole("columnheader");
    const texts = headers.map((h) => h.textContent);
    expect(texts.some((t) => /webhooklogid/i.test(t))).toBe(false);
  });

  it("renders Actions column header when actionColumn is present", () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
        actionColumn={ACTION_COLUMN}
      />
    );
    expect(screen.getByText(/actions/i)).toBeInTheDocument();
  });

  it("no Actions column and no AttachmentMenu when actionColumn is absent", () => {
    render(
      <DataTable
        data={ROWS}
        columns={COLUMNS}
      />
    );
    expect(screen.queryByTestId("attachment-menu")).not.toBeInTheDocument();
    expect(screen.queryByText(/^actions$/i)).not.toBeInTheDocument();
    // WebhookLogId column should appear (no filtering without actionColumn)
    const headers = screen.getAllByRole("columnheader");
    const texts = headers.map((h) => h.textContent);
    expect(texts.some((t) => /webhooklogid/i.test(t))).toBe(true);
  });
});
