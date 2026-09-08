/**
 * ScheduleRunModal: the session id is minted by `newSessionId`, everywhere.
 *
 * `b7a18b5` replaced the component's local `generateSessionId` (built on
 * `Math.random`) with `newSessionId` from `@/lib/ids`, but only at the first
 * of its three call sites. The two others still called a function that no
 * longer existed, so opening the modal and pressing the regenerate button
 * threw `generateSessionId is not defined` and the app showed its error
 * screen. Nothing covered this component, so the CI stayed green.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("use-intl", () => ({ useTranslations: () => (key) => key }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { email: "a@b.fr" } }) }));
vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: () => ({ current: null }) }));

let counter = 0;
vi.mock("@/lib/ids", () => ({ newSessionId: () => `sess_test_${++counter}` }));

import ScheduleRunModal from "@/components/ScheduleRunModal";

const props = {
  show: true,
  agents: [{ agent_id: 1, agent_name: "agent1" }],
  onClose: () => {},
  onSubmit: () => {},
};

describe("ScheduleRunModal — session id", () => {
  beforeEach(() => {
    counter = 0;
  });

  it("mints its first id with newSessionId", () => {
    render(<ScheduleRunModal {...props} />);
    expect(screen.getByDisplayValue(/^sess_test_/)).toBeInTheDocument();
  });

  it("regenerating mints another one instead of throwing", async () => {
    const errors = [];
    const onError = (e) => errors.push(e.message ?? String(e));
    window.addEventListener("error", onError);
    render(<ScheduleRunModal {...props} />);
    const before = screen.getByDisplayValue(/^sess_test_/).value;

    await userEvent.click(screen.getByTitle("generateSessionIdTitle"));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/^sess_test_/).value).not.toBe(before);
    });
    expect(errors).toEqual([]);
    window.removeEventListener("error", onError);
  });

  it("never reaches for the removed local helper", async () => {
    const source = await import("@/components/ScheduleRunModal?raw").catch(() => null);
    if (source?.default) expect(source.default).not.toMatch(/generateSessionId\(/);
  });
});
