/**
 * Unit tests for extracted sections of AgentModal.
 * Focuses on pure presentational/interaction logic, not on the API.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GuardrailsSection from "@/components/agent-modal/GuardrailsSection";
import OutputFormatSection from "@/components/agent-modal/OutputFormatSection";
import HeadersTextarea from "@/components/agent-modal/HeadersTextarea";
import SuperAgentIcon from "@/components/agent-modal/SuperAgentIcon";

describe("GuardrailsSection", () => {
  it("renders the collapsed header with label", () => {
    render(
      <GuardrailsSection
        guardrailsConfig={{}}
        toolConfigs={[]}
        selectedTools={[]}
        onChange={() => {}}
      />
    );
    expect(screen.getByText("Guardrails")).toBeInTheDocument();
  });

  it("shows the Active badge when blocked terms are present", () => {
    render(
      <GuardrailsSection
        guardrailsConfig={{ blocked_terms: ["badword"] }}
        toolConfigs={[]}
        selectedTools={[]}
        onChange={() => {}}
      />
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("expands and adds a blocked term", () => {
    const onChange = vi.fn();
    render(
      <GuardrailsSection
        guardrailsConfig={{}}
        toolConfigs={[]}
        selectedTools={[]}
        onChange={onChange}
      />
    );

    // Expand
    fireEvent.click(screen.getByText("Guardrails"));

    // Type a term and submit via the + button
    const input = screen.getByPlaceholderText(/Add blocked term/i);
    fireEvent.change(input, { target: { value: "forbidden" } });
    const plusButtons = screen.getAllByRole("button");
    // Find the add-term button (first + button after inputs)
    const addButton = plusButtons.find((b) => b.className.includes("bg-red-600/20"));
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ blocked_terms: ["forbidden"] })
    );
  });
});

describe("OutputFormatSection", () => {
  it("renders the collapsed header", () => {
    render(<OutputFormatSection outputSchema={null} onChange={() => {}} />);
    expect(screen.getByText("Output Format")).toBeInTheDocument();
  });

  it("shows Active badge when an instruction is set", () => {
    render(
      <OutputFormatSection
        outputSchema={{ instruction: "Return JSON" }}
        onChange={() => {}}
      />
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("toggles to instruction mode and emits a schema", () => {
    const onChange = vi.fn();
    render(<OutputFormatSection outputSchema={null} onChange={onChange} />);

    fireEvent.click(screen.getByText("Output Format"));

    const instructionRadio = screen.getByLabelText(/Custom instruction/i);
    fireEvent.click(instructionRadio);

    expect(onChange).toHaveBeenCalledWith({ instruction: "" });
  });

  it("calls onChange(null) when switching back to None", () => {
    const onChange = vi.fn();
    render(
      <OutputFormatSection
        outputSchema={{ instruction: "foo" }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("Output Format"));
    const noneRadio = screen.getByLabelText(/^None$/);
    fireEvent.click(noneRadio);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("HeadersTextarea", () => {
  it("renders the placeholder", () => {
    render(<HeadersTextarea value={{}} onChange={() => {}} />);
    expect(screen.getByPlaceholderText(/Authorization/)).toBeInTheDocument();
  });

  it("emits {} on blur when empty", () => {
    const onChange = vi.fn();
    render(<HeadersTextarea value={{}} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(/Authorization/);
    fireEvent.blur(textarea);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it("parses valid JSON on blur", () => {
    const onChange = vi.fn();
    render(<HeadersTextarea value={{}} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(/Authorization/);
    fireEvent.change(textarea, { target: { value: '{"X-Foo": "bar"}' } });
    fireEvent.blur(textarea);
    expect(onChange).toHaveBeenCalledWith({ "X-Foo": "bar" });
  });

  it("swallows invalid JSON on blur (no onChange call)", () => {
    const onChange = vi.fn();
    render(<HeadersTextarea value={{}} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(/Authorization/);
    fireEvent.change(textarea, { target: { value: "not json" } });
    fireEvent.blur(textarea);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("SuperAgentIcon", () => {
  it("renders a known Lucide icon by name", () => {
    const { container } = render(<SuperAgentIcon iconName="Database" />);
    // Lucide icons render as <svg>
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("falls back to an image when the name is unknown", () => {
    render(<SuperAgentIcon iconName="UnknownIcon" />);
    expect(screen.getByAltText("Agent")).toBeInTheDocument();
  });
});
