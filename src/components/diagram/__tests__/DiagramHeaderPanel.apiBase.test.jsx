import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api", () => ({ getDefaultLlmUsage: vi.fn().mockResolvedValue({ enabled: false }) }));
vi.mock("@/components/SavedApiKeySelector", () => ({ default: () => <div /> }));

import DiagramHeaderPanel from "@/components/diagram/DiagramHeaderPanel";

const base = { canvasOrderLength: 0, showApiKey: false, setShowApiKey: () => {}, toolConfigs: [] };

describe("DiagramHeaderPanel — API URL", () => {
  it("modifie model_api_base en gardant les autres params du modèle", () => {
    const updateAgentData = vi.fn();
    const agentData = {
      agent_model: "openai/llama-3-70b", agent_type: "base",
      template_model_params: { temperature: 0.1, model_api_base: "https://a.example/v1" },
    };
    render(<DiagramHeaderPanel {...base} updateAgentData={updateAgentData} agentData={agentData} />);
    const input = screen.getByLabelText(/API URL/);
    expect(input).toHaveValue("https://a.example/v1");
    fireEvent.change(input, { target: { value: "https://b.example/v1" } });
    expect(updateAgentData).toHaveBeenCalledWith({
      ...agentData,
      template_model_params: { temperature: 0.1, model_api_base: "https://b.example/v1" },
    });
  });

  it("masqué pour thaink2/default", () => {
    render(<DiagramHeaderPanel {...base} updateAgentData={() => {}} agentData={{ agent_model: "thaink2/default", agent_type: "base" }} />);
    expect(screen.getByLabelText(/API URL/).closest(".hidden")).not.toBeNull();
  });
});
