import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ArtifactEditCard from "../ArtifactEditCard";

function makeCard(overrides = {}) {
  return {
    id: "card_1",
    kind: "artifact_edit",
    status: "pending",
    data: {
      filename: "README.md",
      summary: "Add section about install",
      diff: "+ new line\n- old line\n  context",
    },
    ...overrides,
  };
}

describe("ArtifactEditCard", () => {
  it("renders filename, summary and diff", () => {
    render(<ArtifactEditCard card={makeCard()} onRespond={vi.fn()} />);
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByText("Add section about install")).toBeInTheDocument();
    expect(screen.getByText(/new line/)).toBeInTheDocument();
    expect(screen.getByText(/old line/)).toBeInTheDocument();
  });

  it("renders a +/- counts badge in header", () => {
    render(<ArtifactEditCard card={makeCard()} onRespond={vi.fn()} />);
    // One add, one remove, three lines
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
    expect(screen.getByText(/[-−]1/)).toBeInTheDocument();
    expect(screen.getByText(/3 lines/)).toBeInTheDocument();
  });

  it("collapses diffs larger than 20 lines with a Show all button", () => {
    const diff = Array.from({ length: 25 }, (_, i) => `+ line ${i}`).join("\n");
    render(
      <ArtifactEditCard
        card={makeCard({ data: { filename: "big.md", diff } })}
        onRespond={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /show all 25 lines/i })).toBeInTheDocument();
    // Not all 25 lines rendered yet
    expect(screen.queryByText(/line 24/)).toBeNull();
  });

  it("expands to show all lines when Show all is clicked", () => {
    const diff = Array.from({ length: 25 }, (_, i) => `+ line ${i}`).join("\n");
    render(
      <ArtifactEditCard
        card={makeCard({ data: { filename: "big.md", diff } })}
        onRespond={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show all 25 lines/i }));
    expect(screen.getByText(/line 24/)).toBeInTheDocument();
  });

  it("calls onRespond('applied') when Apply is clicked", () => {
    const onRespond = vi.fn();
    render(<ArtifactEditCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onRespond).toHaveBeenCalledWith("applied");
  });

  it("calls onRespond with sendFollowup=false when Cancel is clicked", () => {
    const onRespond = vi.fn();
    render(<ArtifactEditCard card={makeCard()} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onRespond).toHaveBeenCalledWith("rejected", { sendFollowup: false });
  });

  it("adds a title attribute on the filename for full-name tooltip", () => {
    const { container } = render(
      <ArtifactEditCard
        card={makeCard({ data: { filename: "very-long-filename-to-truncate.md", diff: "" } })}
        onRespond={vi.fn()}
      />,
    );
    const span = container.querySelector(`[title="very-long-filename-to-truncate.md"]`);
    expect(span).not.toBeNull();
  });
});
