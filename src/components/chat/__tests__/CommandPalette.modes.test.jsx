import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";

const h = vi.hoisted(() => ({
  setActiveSession: vi.fn(),
  sessions: [{ id: "s1", title: "Projet Alpha", agentName: "Agent A", messages: [] }],
  listAgents: vi.fn(),
  listArtifactLibrary: vi.fn(),
  listDashboards: vi.fn(),
  listSkills: vi.fn(),
}));

vi.mock("@/hooks/useChatSessions", () => ({
  useChatSessions: () => ({ sessions: h.sessions, setActiveSession: h.setActiveSession }),
}));
vi.mock("@/hooks/useFocusTrap", () => ({ useFocusTrap: () => ({ current: null }) }));
vi.mock("@/lib/api", () => ({
  listAgents: h.listAgents,
  listArtifactLibrary: h.listArtifactLibrary,
  listDashboards: h.listDashboards,
  listSkills: h.listSkills,
}));

import CommandPalette, { paletteMode } from "../CommandPalette";

const commands = [
  { id: "new-chat", label: "New conversation", description: "Pick an agent", keywords: [], slash: "new", iconName: "Plus", shortcut: "⌘⇧O" },
  { id: "toggle-theme", label: "Toggle light / dark theme", keywords: ["dark"], slash: "theme", iconName: "SunMoon" },
];

const openPalette = () => fireEvent.keyDown(document, { key: "k", metaKey: true });
const input = () => screen.getByLabelText("Search");

describe("paletteMode", () => {
  it("reads the mode prefix", () => {
    expect(paletteMode(">x")).toBe(">");
    expect(paletteMode("@a")).toBe("@");
    expect(paletteMode("#d")).toBe("#");
    expect(paletteMode("plain")).toBe("");
    expect(paletteMode("")).toBe("");
  });
});

describe("CommandPalette — modes", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb) => {
      cb();
      return 0;
    });
    Element.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
    h.setActiveSession.mockClear();
    h.listAgents.mockReset().mockResolvedValue([{ agent_id: 3, agent_name: "Analyste", agent_description: "Chiffres" }]);
    h.listArtifactLibrary.mockReset().mockResolvedValue([{ id: 1, filename: "report.py", agent_name: "Analyste" }]);
    h.listDashboards.mockReset().mockResolvedValue({ items: [{ id: 9, title: "Ventes 2026" }] });
    h.listSkills.mockReset().mockRejectedValue(new Error("404")); // brick absent → group empty, no crash
  });

  it("'>' lists commands only and Enter runs the selected one", () => {
    const runCommand = vi.fn();
    render(<CommandPalette onNewChat={vi.fn()} commands={commands} runCommand={runCommand} />);
    openPalette();
    fireEvent.change(input(), { target: { value: ">theme" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Toggle light / dark theme");
    expect(screen.queryByText("Projet Alpha")).toBeNull();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(runCommand).toHaveBeenCalledWith("toggle-theme", "");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("'@' loads agents lazily and hands the pick to onPickAgent", async () => {
    const onPickAgent = vi.fn();
    render(<CommandPalette onNewChat={vi.fn()} commands={commands} runCommand={vi.fn()} onPickAgent={onPickAgent} />);
    openPalette();
    await act(async () => {
      fireEvent.change(input(), { target: { value: "@ana" } });
    });
    expect(h.listAgents).toHaveBeenCalledTimes(1);
    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent("Analyste");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onPickAgent).toHaveBeenCalledTimes(1);
    expect(onPickAgent.mock.calls[0][0].agent_name).toBe("Analyste");
  });

  it("'#' lists platform objects, tolerating a missing brick, and navigates", async () => {
    const navigate = vi.fn();
    render(<CommandPalette onNewChat={vi.fn()} commands={commands} runCommand={vi.fn()} navigate={navigate} />);
    openPalette();
    await act(async () => {
      fireEvent.change(input(), { target: { value: "#" } });
    });
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("report.py"), expect.stringContaining("Ventes 2026")]));
    fireEvent.change(input(), { target: { value: "#ventes" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(navigate).toHaveBeenCalledWith("/bi/9");
  });

  it("default mode keeps New chat first and adds matching commands after sessions", () => {
    render(<CommandPalette onNewChat={vi.fn()} commands={commands} runCommand={vi.fn()} />);
    openPalette();
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("New chat");
    fireEvent.change(input(), { target: { value: "theme" } });
    const labels = screen.getAllByRole("option").map((o) => o.textContent);
    expect(labels.some((l) => l.includes("Toggle light / dark theme"))).toBe(true);
  });
  it("leaves ⌘K alone when it was consumed upstream or pressed over a text selection", () => {
    render(<CommandPalette onNewChat={vi.fn()} commands={commands} runCommand={vi.fn()} navigate={vi.fn()} />);
    const consumed = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true });
    consumed.preventDefault();
    act(() => {
      document.dispatchEvent(consumed);
    });
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();

    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.value = "see the docs";
    ta.setSelectionRange(8, 12);
    act(() => {
      fireEvent.keyDown(ta, { key: "k", metaKey: true });
    });
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();

    ta.setSelectionRange(3, 3);
    act(() => {
      fireEvent.keyDown(ta, { key: "k", metaKey: true });
    });
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    ta.remove();
  });
});
