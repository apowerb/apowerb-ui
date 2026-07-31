import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  uploadFileChunked: vi.fn(),
}));

import ActionCard from "../ActionCard";

describe("ActionCard dispatcher", () => {
  it("renders UserInputCard for kind=user_input", () => {
    render(
      <ActionCard
        card={{
          id: "c1",
          kind: "user_input",
          status: "pending",
          data: { question: "Q?", input_type: "text" },
        }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByText("Q?")).toBeInTheDocument();
  });

  it("renders ConfirmDestructiveCard for kind=confirm_destructive", () => {
    render(
      <ActionCard
        card={{
          id: "c1",
          kind: "confirm_destructive",
          status: "pending",
          data: { action: "Nuke", impact: "gone" },
        }}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByText("Nuke")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });

  it("renders null for unknown kinds", () => {
    const { container } = render(
      <ActionCard
        card={{ id: "c1", kind: "unknown_kind", status: "pending", data: {} }}
        onRespond={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
