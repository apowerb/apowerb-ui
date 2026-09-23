/**
 * Ce que le bouton Export écrit vraiment dans le fichier.
 *
 * Le test lit le Blob remis au navigateur, et non l'appel à une fonction
 * interne : c'est le contenu du fichier qui compte, et c'est là qu'un champ
 * oublié se voit — la description manquait, mesuré sur agent-dev le 23/09.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowStudio from "@/components/workflow-studio/WorkflowStudio";

vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  usePathname: () => "/workflows/wf1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/components/workflow-studio/StudioCanvas", () => ({
  default: () => <div data-testid="canvas-mock" />,
}));

const api = vi.hoisted(() => ({
  getWorkflowDef: vi.fn(),
  updateWorkflowDef: vi.fn(),
  listAgents: vi.fn(),
  listTools: vi.fn(),
  listToolConfigs: vi.fn(),
  listWorkflowDefs: vi.fn(),
  runWorkflowDef: vi.fn(),
  cancelWorkflowRun: vi.fn(),
  listWorkflowRevisions: vi.fn(),
  restoreWorkflowRevision: vi.fn(),
  getWorkflowTriggerState: vi.fn(),
  rotateWorkflowTrigger: vi.fn(),
  getPublicConfig: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@/lib/api", () => api);

const GRAPH = {
  version: 1,
  nodes: [
    { id: "trigger1", type: "trigger", config: { kind: "manual" }, position: { x: 0, y: 0 } },
    { id: "out1", type: "output", config: { value: "done" }, position: { x: 200, y: 0 } },
  ],
  edges: [{ source: "trigger1", target: "out1" }],
};

const WORKFLOW = {
  workflow_id: "wf1",
  name: "Lead triage",
  description: "Routes a lead to the right agent",
  status: "draft",
  version: 2,
  graph: GRAPH,
};

let exported;

beforeEach(() => {
  vi.clearAllMocks();
  exported = [];
  api.getWorkflowDef.mockResolvedValue(WORKFLOW);
  api.listAgents.mockResolvedValue([]);
  api.listTools.mockResolvedValue({});
  api.listToolConfigs.mockResolvedValue([]);
  api.listWorkflowDefs.mockResolvedValue([]);
  api.listWorkflowRevisions.mockResolvedValue([]);
  api.getWorkflowTriggerState.mockResolvedValue({});
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: (blob) => {
      exported.push(blob);
      return "blob:export";
    },
    revokeObjectURL: () => {},
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("exporting a workflow", () => {
  it("writes the name, the description and the graph", async () => {
    const user = userEvent.setup();
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Export/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Export/i }));

    await waitFor(() => expect(exported).toHaveLength(1));
    const file = JSON.parse(await exported[0].text());
    expect(file.name).toBe("Lead triage");
    expect(file.description).toBe("Routes a lead to the right agent");
    expect(file.graph.nodes.map((n) => n.id)).toEqual(["trigger1", "out1"]);
  });

  it("keeps the description after a save, which does not return it", async () => {
    const user = userEvent.setup();
    api.updateWorkflowDef.mockResolvedValue({ ...WORKFLOW, description: undefined, version: 3 });
    render(<WorkflowStudio workflowId="wf1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Export/i })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Publish/i }).closest("button"));
    await waitFor(() => expect(api.updateWorkflowDef).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /Export/i }));

    await waitFor(() => expect(exported).toHaveLength(1));
    expect(JSON.parse(await exported[0].text()).description).toBe("Routes a lead to the right agent");
  });
});
