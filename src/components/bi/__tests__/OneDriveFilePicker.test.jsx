import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import OneDriveFilePicker from "../OneDriveFilePicker";

function mockListResponse(items) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ status: "success", items })),
    json: () => Promise.resolve({ status: "success", items }),
  };
}

describe("OneDriveFilePicker", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders header, search input, and a disabled Select button", async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockListResponse([])));
    render(
      <OneDriveFilePicker onFileSelected={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText(/browse onedrive/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search/i),
    ).toBeInTheDocument();
    const selectBtn = screen.getByRole("button", { name: /^select$/i });
    expect(selectBtn).toBeDisabled();
  });

  it("fetches the root folder on mount with file_type=xlsx", async () => {
    global.fetch = vi.fn(() => Promise.resolve(mockListResponse([])));
    render(
      <OneDriveFilePicker onFileSelected={vi.fn()} onCancel={vi.fn()} />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toMatch(/\/api\/onedrivebrowser\/list/);
    expect(calledUrl).toMatch(/file_type=spreadsheet/);
  });

  it("clicking an xlsx file enables Select then calls onFileSelected with the expected shape", async () => {
    const items = [
      {
        id: "folder_1",
        name: "My Folder",
        type: "folder",
        size: null,
        parentPath: "/drive/root:",
      },
      {
        id: "file_42",
        name: "Sales.xlsx",
        type: "file",
        size: 12345,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        parentPath: "/drive/root:/Reports",
      },
    ];
    global.fetch = vi.fn(() => Promise.resolve(mockListResponse(items)));
    const onFileSelected = vi.fn();

    render(
      <OneDriveFilePicker onFileSelected={onFileSelected} onCancel={vi.fn()} />,
    );

    // Wait for the file row to appear
    const fileRow = await screen.findByText("Sales.xlsx");
    fireEvent.click(fileRow);

    // Select button should now be enabled
    const selectBtn = screen.getByRole("button", { name: /^select$/i });
    await waitFor(() => expect(selectBtn).not.toBeDisabled());

    fireEvent.click(selectBtn);

    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected).toHaveBeenCalledWith({
      item_id: "file_42",
      item_path: "Reports/Sales.xlsx",
      filename: "Sales.xlsx",
    });
  });

  it("shows an inline Connect OneDrive button when API returns 401", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              status: "error",
              message: "OneDrive not connected",
            }),
          ),
        json: () =>
          Promise.resolve({
            status: "error",
            message: "OneDrive not connected",
          }),
      }),
    );

    render(
      <OneDriveFilePicker onFileSelected={vi.fn()} onCancel={vi.fn()} />,
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(/onedrive is not connected/i).length,
      ).toBeGreaterThan(0);
    });
    const connectBtn = screen.getByRole("button", { name: /connect onedrive/i });
    expect(connectBtn).not.toBeDisabled();
  });
});
