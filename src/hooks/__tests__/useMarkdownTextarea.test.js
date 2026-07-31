import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMarkdownTextarea } from "../useMarkdownTextarea";

// Build a minimal textarea stand-in that tracks selection.
function createTextareaStub() {
  const el = {
    _value: "",
    selectionStart: 0,
    selectionEnd: 0,
    focus: vi.fn(),
  };
  Object.defineProperty(el, "value", {
    get() {
      return this._value;
    },
    set(v) {
      this._value = v;
    },
  });
  return el;
}

// We need rAF to run synchronously for tests.
beforeEach(() => {
  global.requestAnimationFrame = (cb) => {
    cb();
    return 0;
  };
});

function setup(initial = "") {
  let value = initial;
  const setValue = vi.fn((v) => {
    value = v;
  });
  const stub = createTextareaStub();
  const ref = { current: stub };
  const { result } = renderHook(() =>
    useMarkdownTextarea(ref, { value, setValue }),
  );
  return { result, ref, setValue, getValue: () => value };
}

function selectRange(ref, start, end = start) {
  ref.current.selectionStart = start;
  ref.current.selectionEnd = end;
}

function fakeEvent(overrides = {}) {
  return {
    preventDefault: vi.fn(),
    key: "",
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    clipboardData: { getData: () => "" },
    ...overrides,
  };
}

describe("useMarkdownTextarea", () => {
  it("Ctrl+B wraps selection in **…**", () => {
    const { result, ref, setValue } = setup("hello world");
    selectRange(ref, 6, 11); // "world"
    const e = fakeEvent({ key: "b", ctrlKey: true });
    act(() => {
      const consumed = result.current.handleKeyDown(e);
      expect(consumed).toBe(true);
    });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(setValue).toHaveBeenCalledWith("hello **world**");
  });

  it("Ctrl+I on empty selection inserts *italic* with caret placeholder", () => {
    const { result, ref, setValue } = setup("");
    selectRange(ref, 0);
    const e = fakeEvent({ key: "i", metaKey: true });
    act(() => {
      result.current.handleKeyDown(e);
    });
    expect(setValue).toHaveBeenCalledWith("*italic*");
  });

  it("Ctrl+K on selection inserts [sel](url) with caret on url", () => {
    const { result, ref, setValue } = setup("click here");
    selectRange(ref, 6, 10); // "here"
    act(() => {
      result.current.handleKeyDown(fakeEvent({ key: "k", ctrlKey: true }));
    });
    expect(setValue).toHaveBeenCalledWith("click [here](url)");
  });

  it("Enter on a bullet line inserts the next marker", () => {
    const { result, ref, setValue } = setup("- item one");
    selectRange(ref, 10); // end of line
    const e = fakeEvent({ key: "Enter" });
    act(() => {
      result.current.handleKeyDown(e);
    });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(setValue).toHaveBeenCalledWith("- item one\n- ");
  });

  it("Enter on empty bullet line removes the marker", () => {
    const { result, ref, setValue } = setup("- item\n- ");
    selectRange(ref, 9); // after the space
    act(() => {
      result.current.handleKeyDown(fakeEvent({ key: "Enter" }));
    });
    // Marker line becomes just the indent (empty)
    expect(setValue).toHaveBeenCalledWith("- item\n");
  });

  it("Enter on an ordered list line increments the number", () => {
    const { result, ref, setValue } = setup("1. first");
    selectRange(ref, 8);
    act(() => {
      result.current.handleKeyDown(fakeEvent({ key: "Enter" }));
    });
    expect(setValue).toHaveBeenCalledWith("1. first\n2. ");
  });

  it("Shift+Enter does NOT trigger list continuation", () => {
    const { result, ref } = setup("- item");
    selectRange(ref, 6);
    const e = fakeEvent({ key: "Enter", shiftKey: true });
    act(() => {
      const consumed = result.current.handleKeyDown(e);
      expect(consumed).toBe(false);
    });
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it("Paste URL over selection wraps it in a link", () => {
    const { result, ref, setValue } = setup("visit th2ai.com");
    selectRange(ref, 6, 15); // "th2ai.com"
    const e = fakeEvent({
      clipboardData: { getData: () => "https://example.com" },
    });
    act(() => {
      const consumed = result.current.handlePaste(e);
      expect(consumed).toBe(true);
    });
    expect(setValue).toHaveBeenCalledWith(
      "visit [th2ai.com](https://example.com)",
    );
  });

  it("Paste URL without selection is ignored (returns false)", () => {
    const { result, ref } = setup("text");
    selectRange(ref, 4);
    const e = fakeEvent({
      clipboardData: { getData: () => "https://example.com" },
    });
    act(() => {
      const consumed = result.current.handlePaste(e);
      expect(consumed).toBe(false);
    });
  });

  it("applyAction('ul') prefixes current line with '- '", () => {
    const { result, ref, setValue } = setup("todo");
    selectRange(ref, 4);
    act(() => {
      result.current.applyAction("ul");
    });
    expect(setValue).toHaveBeenCalledWith("- todo");
  });
});
