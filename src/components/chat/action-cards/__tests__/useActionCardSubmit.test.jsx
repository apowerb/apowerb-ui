import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useActionCardSubmit from "../useActionCardSubmit";

describe("useActionCardSubmit", () => {
  it("starts not submitting and isPending reflects card.status", () => {
    const { result } = renderHook(() =>
      useActionCardSubmit({ id: "c1", status: "pending" }),
    );
    expect(result.current.submitting).toBe(false);
    expect(result.current.isPending).toBe(true);
  });

  it("marks submitting=true after handleSubmit is called", async () => {
    const { result } = renderHook(() =>
      useActionCardSubmit({ id: "c1", status: "pending" }),
    );
    await act(async () => {
      await result.current.handleSubmit(() => {});
    });
    expect(result.current.submitting).toBe(true);
  });

  it("propagates async errors from the submitted function", async () => {
    const { result } = renderHook(() =>
      useActionCardSubmit({ id: "c1", status: "pending" }),
    );
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });
    await act(async () => {
      await expect(result.current.handleSubmit(fn)).rejects.toThrow("boom");
    });
    // submitting stays true — UI handles its own cleanup via card status updates
    expect(result.current.submitting).toBe(true);
  });

  it("isPending is false when card status is done", () => {
    const { result } = renderHook(() =>
      useActionCardSubmit({ id: "c1", status: "done" }),
    );
    expect(result.current.isPending).toBe(false);
  });

  it("isPending is false once submitting=true even if card is still pending", async () => {
    const { result } = renderHook(() =>
      useActionCardSubmit({ id: "c1", status: "pending" }),
    );
    await act(async () => {
      await result.current.handleSubmit(() => {});
    });
    expect(result.current.isPending).toBe(false);
  });
});
