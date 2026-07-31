import { describe, it, expect } from "vitest";
import { ACTIONS } from "@/contexts/ChatContext";

describe("ChatContext ACTIONS - action cards", () => {
  it("should export ADD_ACTION_CARD action type", () => {
    expect(ACTIONS.ADD_ACTION_CARD).toBe("ADD_ACTION_CARD");
  });

  it("should export UPDATE_ACTION_CARD action type", () => {
    expect(ACTIONS.UPDATE_ACTION_CARD).toBe("UPDATE_ACTION_CARD");
  });

  it("should export PROMOTE_THINKING_TO_CONTENT action type", () => {
    expect(ACTIONS.PROMOTE_THINKING_TO_CONTENT).toBe("PROMOTE_THINKING_TO_CONTENT");
  });
});
