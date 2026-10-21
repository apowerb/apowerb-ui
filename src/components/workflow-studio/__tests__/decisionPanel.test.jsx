/**
 * The human decision in the test panel and on the canvas: the run parked on a
 * decision, how to reopen the dialog, and the node's own look.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { ApprovalNode } from "@/components/workflow-studio/nodes";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";
import StudioPalette from "@/components/workflow-studio/StudioPalette";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
}));
vi.mock("@/components/bi/ChartRenderer", () => ({ default: () => null }));

const reduce = (events) => events.reduce(applyRunEvent, createRunState());
const AWAITING_RUN = [
  { event: "run_started", run_id: "r1" },
  { event: "node_start", node_id: "decision1", type: "approval" },
  { event: "awaiting_input", run_id: "r1", node_id: "decision1", question: "Valider ?", mode: "choices", choices: [{ route: "oui", label: "Oui" }], assignee: null },
];

function panel(runState, extra = {}) {
  return render(
    <ExecutionPanel
      open
      onToggle={() => {}}
      payloadText="{}"
      onPayloadTextChange={() => {}}
      payloadError={null}
      isRunning={false}
      runState={runState}
      onRun={() => {}}
      onCancel={() => {}}
      {...extra}
    />,
  );
}

describe("ExecutionPanel — a run waiting for a decision", () => {
  it("says so in the header badge and on the decision's row", () => {
    panel(reduce(AWAITING_RUN), { nodeLabels: { decision1: "Validation" } });
    expect(screen.getAllByText("Waiting for a decision").length).toBeGreaterThanOrEqual(2);
  });

  it("offers a button that reopens the dialog", async () => {
    const onOpenDecision = vi.fn();
    const user = userEvent.setup();
    panel(reduce(AWAITING_RUN), { onOpenDecision });
    await user.click(screen.getByRole("button", { name: "Answer" }));
    expect(onOpenDecision).toHaveBeenCalledTimes(1);
  });

  it("offers no button once the run moved on, or without a handler", () => {
    panel(reduce([...AWAITING_RUN, { event: "run_started" }]), { onOpenDecision: vi.fn() });
    expect(screen.queryByRole("button", { name: "Answer" })).toBeNull();
  });

  it("does not show the answer button during a replay of the recording", () => {
    panel(reduce(AWAITING_RUN), { onOpenDecision: vi.fn(), replay: { active: true, total: 3, index: 3, playing: false, speed: 1, play() {}, pause() {}, stepForward() {}, stepBack() {}, seek() {}, setSpeed() {}, exit() {} } });
    expect(screen.queryByRole("button", { name: "Answer" })).toBeNull();
  });

  it("marks nodes replayed from before the answer", () => {
    const s = reduce([
      { event: "run_started" },
      { event: "node_start", node_id: "trigger1", type: "trigger", replayed: true },
      { event: "node_complete", node_id: "trigger1", output: "x", replayed: true },
    ]);
    panel(s);
    expect(screen.getByText("Before the answer")).toBeInTheDocument();
  });

  it("renders the slot under the run button", () => {
    panel(createRunState(), { children: <p>slot content</p> });
    expect(screen.getByText("slot content")).toBeInTheDocument();
  });
});

describe("ApprovalNode on the canvas", () => {
  const data = (extra = {}) => ({ label: "", config: { question: "Q", mode: "both", choices: [{ route: "oui", label: "Oui" }, { route: "non", label: "Non" }] }, ...extra });

  it("is called Human decision, no longer 'soon', and lists its routes", () => {
    render(<ApprovalNode data={data()} selected={false} />);
    expect(screen.getByText("Human decision")).toBeInTheDocument();
    expect(screen.queryByText(/soon/i)).toBeNull();
    expect(screen.getByText("Oui")).toBeInTheDocument();
    expect(screen.getByText("Non")).toBeInTheDocument();
    expect(screen.getByText("Written answer")).toBeInTheDocument();
  });

  it("text mode shows no route chips", () => {
    render(<ApprovalNode data={data({ config: { question: "Q", mode: "text", choices: [] } })} selected={false} />);
    expect(screen.queryByText("Written answer")).toBeNull();
  });

  it("shows the waiting state while its run is parked", () => {
    render(<ApprovalNode data={data({ runStatus: "awaiting" })} selected={false} />);
    expect(screen.getByText("Waiting for a decision")).toBeInTheDocument();
  });
});

describe("palette", () => {
  it("offers the human decision without a Soon badge", () => {
    render(<StudioPalette onAdd={() => {}} />);
    const btn = screen.getByRole("button", { name: /Human decision/ });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toHaveTextContent("Soon");
  });
});
