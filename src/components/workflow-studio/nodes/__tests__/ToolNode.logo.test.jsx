/**
 * apowerb roadmap #103: the studio's tool node shows the provider logo for
 * its resolved category (injected by WorkflowStudio as data.toolCategory,
 * mirroring how it already resolves data.subtitle from toolOptions),
 * falling back to the generic Wrench icon used before this change.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { ToolNode } from "@/components/workflow-studio/nodes/index.jsx";

function renderNode(data) {
  return render(
    <ReactFlowProvider>
      <ToolNode data={data} selected={false} />
    </ReactFlowProvider>,
  );
}

describe("ToolNode logo", () => {
  it("shows the generic wrench icon with no category", () => {
    const { container } = renderNode({ label: "My tool" });
    expect(container.querySelector("svg.lucide-wrench")).not.toBeNull();
  });

  it("shows the gmail logo for a gmail-category tool", () => {
    const { container } = renderNode({ label: "Send email", toolCategory: "tools_google_gmail" });
    expect(container.querySelector('svg[viewBox="52 42 88 66"]')).not.toBeNull();
  });

  it("shows the database icon for a text_to_sql-category tool", () => {
    const { container } = renderNode({ label: "Run query", toolCategory: "text_to_sql" });
    expect(container.querySelector("svg.lucide-database")).not.toBeNull();
  });

  it("falls back to the wrench icon for an unmapped category", () => {
    const { container } = renderNode({ label: "Get weather", toolCategory: "tools_weather" });
    expect(container.querySelector("svg.lucide-wrench")).not.toBeNull();
  });
});
