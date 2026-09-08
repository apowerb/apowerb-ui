import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/datetime", () => ({ formatDateTime: () => "12:00", formatDate: () => "2026-09-08" }));
vi.mock("../InlineChart", () => ({ default: ({ source }) => <div data-testid="inline-chart">{source}</div> }));

import ChatMessage from "../ChatMessage";

const base = { id: "a1", role: "assistant", content: "Hello **world**", timestamp: 0, toolCalls: [], thinking: "" };

describe("ChatMessage — response states", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders an assistant reply as prose with the agent identity", () => {
    render(<ChatMessage message={base} agentName="Analyste" />);
    expect(screen.getByText("Analyste")).toBeInTheDocument();
    expect(screen.getByText("world").tagName).toBe("STRONG");
    expect(document.querySelector("article[data-status='done']")).not.toBeNull();
  });

  it("shows the empty-response notice with Regenerate on the last assistant turn", () => {
    const onRegenerate = vi.fn();
    render(<ChatMessage message={{ ...base, content: "", status: "empty" }} isLastAssistant onRegenerate={onRegenerate} />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("data-state", "empty");
    expect(notice).toHaveTextContent("No content returned");
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRegenerate).toHaveBeenCalledWith("a1");
  });

  it("derives 'empty' for a legacy blank reply without a stored status", () => {
    render(<ChatMessage message={{ ...base, content: "  " }} isLastAssistant onRegenerate={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "empty");
  });

  it("keeps partial text and offers Continue + Regenerate when interrupted", () => {
    const onContinue = vi.fn();
    render(<ChatMessage message={{ ...base, content: "Half of the", status: "interrupted" }} isLastAssistant onRegenerate={vi.fn()} onContinue={onContinue} />);
    expect(screen.getByText("Half of the")).toBeInTheDocument();
    expect(screen.getByText("Interrupted")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "interrupted");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "Regenerate" }).length).toBeGreaterThan(0);
  });

  it("shows the error message and a Retry on a failed turn", () => {
    const onRegenerate = vi.fn();
    render(<ChatMessage message={{ ...base, content: "", status: "error", error: "HTTP 502" }} isLastAssistant onRegenerate={onRegenerate} />);
    expect(screen.getByRole("status")).toHaveTextContent("HTTP 502");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRegenerate).toHaveBeenCalledWith("a1");
  });

  it("offers no state actions on an earlier turn (only the last one can be regenerated)", () => {
    render(<ChatMessage message={{ ...base, content: "", status: "empty" }} isLastAssistant={false} onRegenerate={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });

  it("renders no notice and a caret while streaming", () => {
    render(<ChatMessage message={{ ...base, content: "typing", isStreaming: true }} isStreaming />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector("article[aria-busy='true']")).not.toBeNull();
  });

  it("renders the reasoning trail from steps and lets it open", () => {
    const message = {
      ...base,
      steps: [
        { id: "s1", kind: "thinking", text: "Let me look that up.", startedAt: 0, endedAt: 800 },
        { id: "s2", kind: "tool", name: "search", args: { q: "x" }, status: "done", startedAt: 800, endedAt: 2300, result: { hits: 3 } },
      ],
    };
    render(<ChatMessage message={message} />);
    const trail = screen.getByRole("region", { name: "Reasoning trail" });
    expect(trail).toHaveTextContent("Reasoned for 2.3s");
    expect(trail).toHaveTextContent("1 tool");
    fireEvent.click(screen.getByRole("button", { name: /Reasoned for/ }));
    expect(screen.getByText("Let me look that up.")).toBeInTheDocument();
    expect(screen.getByText("search")).toBeInTheDocument();
  });

  it("renders a ```chart fence through InlineChart", () => {
    render(<ChatMessage message={{ ...base, content: "Here:\n\n```chart\n{\"data\":{\"a\":1}}\n```" }} />);
    expect(screen.getByTestId("inline-chart")).toHaveTextContent('{"data":{"a":1}}');
  });

  it("shows the branch navigator and reports navigation by message id", () => {
    const onNavigateBranch = vi.fn();
    const message = { ...base, _branches: [{ content: "v1" }, { content: "v2" }], _activeBranch: 1 };
    render(<ChatMessage message={message} onNavigateBranch={onNavigateBranch} />);
    expect(screen.getByText("2/2")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    // The "previous branch" chevron is the first enabled arrow before the counter.
    const prev = buttons.find((b) => !b.disabled && b.querySelector("svg.lucide-chevron-left"));
    fireEvent.click(prev);
    expect(onNavigateBranch).toHaveBeenCalledWith("a1", 0);
  });

  it("renders a user turn as a bubble with copy and edit actions", () => {
    const onEditPrompt = vi.fn();
    render(<ChatMessage message={{ id: "u1", role: "user", content: "Question ?", timestamp: 0 }} onEditPrompt={onEditPrompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit and resend" }));
    expect(onEditPrompt).toHaveBeenCalledWith("Question ?");
  });

  it("renders a synthetic user turn as a small italic line", () => {
    render(<ChatMessage message={{ id: "u2", role: "user", content: "Continue", timestamp: 0, isSynthetic: true }} />);
    expect(screen.getByText(/Continue/)).toHaveClass("italic");
  });
});
