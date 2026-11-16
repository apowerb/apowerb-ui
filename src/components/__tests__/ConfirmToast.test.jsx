/**
 * The confirmation is a native modal <dialog>: the browser owns the top layer,
 * the inert page, focus containment, Esc and focus return. These tests pin the
 * contract the callers rely on; jsdom does not implement showModal(), so
 * vitest.setup.js stubs it.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConfirmToast from "../ConfirmToast";

afterEach(() => vi.restoreAllMocks());

function setup(props = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <ConfirmToast message="Delete this chart?" onConfirm={onConfirm} onCancel={onCancel} {...props} />
  );
  return { onConfirm, onCancel, ...view };
}

describe("ConfirmToast", () => {
  it("renders nothing without a message", () => {
    setup({ message: null });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a native modal dialog named by its message", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    setup();
    const dialog = screen.getByRole("dialog", { name: "Delete this chart?" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(showModal).toHaveBeenCalledTimes(1);
    // The native modal already carries these; repeating them is an error.
    expect(dialog).not.toHaveAttribute("role");
    expect(dialog).not.toHaveAttribute("aria-modal");
  });

  it("confirms from the primary button, which holds focus when it opens", () => {
    const { onConfirm, onCancel } = setup();
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(document.activeElement).toBe(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels from the Cancel button", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels on the browser's close request (Esc, back gesture, click outside)", () => {
    const { onConfirm, onCancel } = setup();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not confirm when Enter is pressed while Cancel has focus", () => {
    const { onConfirm } = setup();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Enter", code: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("closes the dialog when the message goes away", () => {
    const close = vi.spyOn(HTMLDialogElement.prototype, "close");
    const { rerender } = setup();
    rerender(<ConfirmToast message={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(close).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hands focus back to the control that opened it", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { rerender } = setup();
    expect(document.activeElement).not.toBe(opener);
    rerender(<ConfirmToast message={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("takes a neutral tone with its own label and no irreversibility hint", () => {
    setup({ message: "Send it again?", confirmLabel: "Send again", hint: null, tone: "neutral" });
    expect(screen.getByRole("button", { name: "Send again" })).toBeInTheDocument();
    expect(screen.queryByText("This action cannot be undone.")).toBeNull();
  });

  // jsdom has no `closedby`, like Safari today: the component then dismisses
  // on a press that both starts and ends outside the dialog's box.
  describe("click outside, where the browser does not support closedby", () => {
    function openAt() {
      const view = setup();
      const dialog = screen.getByRole("dialog");
      dialog.getBoundingClientRect = () => ({ left: 100, right: 300, top: 100, bottom: 200 });
      return { ...view, dialog };
    }
    function press(dialog, [downX, downY], [upX, upY]) {
      fireEvent.pointerDown(dialog, { clientX: downX, clientY: downY });
      fireEvent.pointerUp(dialog, { clientX: upX, clientY: upY });
    }

    it("cancels when the press starts and ends on the backdrop", () => {
      const { dialog, onCancel, onConfirm } = openAt();
      press(dialog, [10, 10], [12, 11]);
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("does not cancel for a press inside the dialog", () => {
      const { dialog, onCancel } = openAt();
      press(dialog, [150, 150], [160, 150]);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("does not cancel when a press that began inside is released outside", () => {
      const { dialog, onCancel } = openAt();
      press(dialog, [150, 150], [10, 10]);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
