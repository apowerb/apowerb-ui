/**
 * fix/workflow-template-refs (2026-09-22): the Output node's type ("output")
 * collides with xyflow's reserved built-in node type names, so xyflow's own
 * default node stylesheet (fixed width, solid white background, dark
 * border) rendered behind our custom card — a white rectangle poking out
 * past its rounded corners once selected, with the "Résultat" label lost
 * in the mess. `graphToFlow` now tags Output nodes with a `className`
 * xyflow appends to that same wrapper (see workflowGraph.test.js for the
 * data-level coverage); globals.css resets the collision on it.
 *
 * jsdom can't load the project's compiled CSS (vitest.config.js sets
 * `css: false`) or exercise xyflow's internal NodeWrapper without a
 * ResizeObserver polyfill (the project's own convention is to mock
 * StudioCanvas rather than render real `<ReactFlow>` — see
 * WorkflowStudio.test.jsx). This is therefore a regression guard on
 * OutputNode/NodeShell's own render output, not a substitute for the
 * data-level test that exercises the actual fix.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { OutputNode } from "@/components/workflow-studio/nodes/index.jsx";

describe("OutputNode selected", () => {
  it("keeps its label visible and its card classes intact", () => {
    const { getByText, container } = render(
      <ReactFlowProvider>
        <OutputNode data={{ label: "Résultat" }} selected />
      </ReactFlowProvider>,
    );

    const label = getByText("Résultat");
    expect(label.className).toContain("th-text");
    expect(label.className).not.toMatch(/opacity-0|invisible|hidden/);

    const shell = container.querySelector(".node-shell");
    expect(shell).not.toBeNull();
    expect(shell.className).toContain("rounded-2xl");
  });
});
