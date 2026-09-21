/**
 * Readable run errors with an action (request B) and the payload editor
 * modes of the test panel (request C), 21/09.
 */
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExecutionPanel from "@/components/workflow-studio/ExecutionPanel";
import { applyRunEvent, createRunState } from "@/lib/workflowRunState";

function failedRun(fields) {
  let s = createRunState();
  s = applyRunEvent(s, { event: "node_start", node_id: "w", type: "tool" });
  s = applyRunEvent(s, { event: "node_error", node_id: "w", ...fields });
  return applyRunEvent(s, { event: "error", ...fields });
}

function Panel({ runState = createRunState(), initial = "{}", onValue = () => {} }) {
  const [text, setText] = useState(initial);
  let error = null;
  try {
    JSON.parse(text);
  } catch (e) {
    error = e.message;
  }
  return (
    <>
      <ExecutionPanel
        open
        onToggle={() => {}}
        payloadText={text}
        onPayloadTextChange={(v) => {
          setText(v);
          onValue(v);
        }}
        payloadError={error}
        isRunning={false}
        runState={runState}
        onRun={() => {}}
        onCancel={() => {}}
      />
      <output data-testid="payload">{text}</output>
    </>
  );
}

const payload = () => JSON.parse(screen.getByTestId("payload").textContent);

describe("readable run errors", () => {
  it("names the tool, the problem and what to do about it", () => {
    render(
      <Panel
        runState={failedRun({
          code: "tool_arguments",
          detail: "get_weather : arguments refusés",
          params: { tool: "get_weather", problem: "missing a required argument: 'city'" },
        })}
      />,
    );
    const shown = screen.getAllByText(/get_weather rejected its arguments/i);
    expect(shown).toHaveLength(2);
    expect(shown[0]).toHaveTextContent("missing a required argument: 'city'");
    expect(shown[0]).toHaveTextContent(/Args/);
    expect(screen.queryByText(/arguments refusés/)).not.toBeInTheDocument();
  });

  it("explains a router that found no route", () => {
    render(<Panel runState={failedRun({ code: "no_route", detail: "r : aucune règle", params: { node: "prio" } })} />);
    expect(screen.getAllByText(/Router prio: no rule matched/i)).toHaveLength(2);
  });

  it("falls back to the detail for a code it does not know", () => {
    render(<Panel runState={failedRun({ code: "something_new", detail: "as the server wrote it" })} />);
    expect(screen.getAllByText("as the server wrote it").length).toBeGreaterThan(0);
  });
});

describe("payload editor", () => {
  it("sends plain text as a message", async () => {
    const user = userEvent.setup();
    render(<Panel />);
    await user.click(screen.getByRole("tab", { name: /^Text$/ }));
    await user.type(screen.getByRole("textbox", { name: /^Text$/ }), "Bonjour");
    expect(payload()).toEqual({ message: "Bonjour" });
  });

  it("edits an object payload as a form, reading typed values", async () => {
    const user = userEvent.setup();
    render(<Panel initial='{"order_id":"B7"}' />);
    await user.click(screen.getByRole("tab", { name: /^Form$/ }));
    expect(screen.getByDisplayValue("B7")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Add field/i }));
    const keys = screen.getAllByRole("textbox", { name: /^Field$/ });
    const values = screen.getAllByRole("textbox", { name: /^Value$/ });
    await user.type(keys[1], "amount");
    await user.type(values[1], "12");
    expect(payload()).toEqual({ order_id: "B7", amount: 12 });
  });

  it("keeps text mode closed on a structured payload, so it cannot be overwritten", () => {
    render(<Panel initial='{"order_id":"B7"}' />);
    expect(screen.getByRole("tab", { name: /^Text$/ })).toBeDisabled();
  });

  it("formats JSON on demand", async () => {
    const user = userEvent.setup();
    render(<Panel initial='{"a":1}' />);
    await user.click(screen.getByRole("button", { name: /Format/i }));
    expect(screen.getByTestId("payload").textContent).toBe('{\n  "a": 1\n}');
  });
});
