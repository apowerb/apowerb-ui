/**
 * Every node explains itself: what it does and what it gives downstream,
 * in both languages, with the references of the selected node.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import { NODE_FAMILIES } from "@/lib/workflowGraph";
import NodeUsageHelp from "@/components/workflow-studio/NodeUsageHelp";
import StudioPalette from "@/components/workflow-studio/StudioPalette";

describe("node usage help", () => {
  it("has a description and an output line for every node type, in English and French", () => {
    for (const messages of [en, fr]) {
      for (const type of Object.keys(NODE_FAMILIES)) {
        expect(messages.WorkflowNodeHelp[`${type}_what`], `${type}_what`).toBeTruthy();
        expect(messages.WorkflowNodeHelp[`${type}_output`], `${type}_output`).toBeTruthy();
      }
    }
  });

  it("shows the references of the selected node", () => {
    render(<NodeUsageHelp type="http" id="call_api" />);
    expect(screen.getByText("How to use this node")).toBeInTheDocument();
    expect(screen.getByText(/\{\{call_api\.status\}\}/)).toBeInTheDocument();
  });

  it("describes each palette entry in its tooltip", () => {
    render(<StudioPalette onAdd={() => {}} />);
    expect(screen.getByTitle(/^Router — Sends the flow down one branch/)).toBeInTheDocument();
  });
});
