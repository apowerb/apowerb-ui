import { describe, it, expect, beforeEach } from "vitest";
import { loadDraft, saveDraft, removeDraft } from "../chatDrafts";

describe("chatDrafts", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips a draft per session in the raw format", () => {
    saveDraft("s1", "hello");
    expect(loadDraft("s1")).toBe("hello");
    expect(window.localStorage.getItem("th2chat:draft:s1")).toBe("hello");
  });

  it("saving an empty value clears the draft", () => {
    saveDraft("s1", "x");
    saveDraft("s1", "");
    expect(loadDraft("s1")).toBe("");
    expect(window.localStorage.getItem("th2chat:draft:s1")).toBeNull();
  });

  it("ignores a missing sessionId without throwing", () => {
    expect(loadDraft("")).toBe("");
    expect(() => saveDraft("", "x")).not.toThrow();
    expect(() => removeDraft("")).not.toThrow();
  });

  it("removeDraft deletes only the targeted session", () => {
    saveDraft("s1", "a");
    saveDraft("s2", "b");
    removeDraft("s1");
    expect(loadDraft("s1")).toBe("");
    expect(loadDraft("s2")).toBe("b");
  });
});
