import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArtifactsLibrary from "@/components/ArtifactsLibrary";

const push = vi.fn();

vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/artifacts",
  useSearchParams: () => ({ get: () => null }),
  Link: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "david@thaink2.com" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/api", () => ({
  listAllSessions: vi.fn(),
  listArtifacts: vi.fn(),
  listAgents: vi.fn(),
  listArtifactLibrary: vi.fn(),
  loadArtifact: vi.fn(),
  executeArtifact: vi.fn(),
  downloadAgentFile: vi.fn(),
}));

const { listAllSessions, listArtifacts, listAgents, listArtifactLibrary, loadArtifact, executeArtifact, downloadAgentFile } =
  await import("@/lib/api");

const SESSIONS = [
  { id: "s1", agent_name: "Invoice reader", agent_folder: "agent12", update_time: 2000 },
  { id: "s2", agent_name: "SQL helper", agent_folder: "agent7", update_time: 1000 },
];

beforeEach(() => {
  // jsdom implements neither of these.
  URL.createObjectURL = vi.fn(() => "blob:artifact");
  URL.revokeObjectURL = vi.fn();
  push.mockReset();
  listAllSessions.mockReset().mockResolvedValue({ sessions: SESSIONS });
  listAgents.mockReset().mockResolvedValue([]);
  listArtifactLibrary.mockReset().mockResolvedValue({ items: [], supported: false });
  listArtifacts
    .mockReset()
    .mockImplementation(async (agentFolder, _userId, sessionId) => {
      // "_shared" holds uploads made outside any conversation; these
      // sessions have none.
      if (sessionId === "_shared") return [];
      return agentFolder === "agent12"
        ? [{ filename: "invoice.py", language: "python", version: 2 }]
        : [{ filename: "query.sql", language: "sql", version: 1 }];
    });
  loadArtifact
    .mockReset()
    .mockResolvedValue({ code: "print('hello')", language: "python" });
  executeArtifact.mockReset().mockResolvedValue({
    stdout: "hello\n",
    stderr: "",
    exit_code: 0,
    duration_ms: 42,
  });
});

describe("ArtifactsLibrary", () => {
  it("lists the artifacts of every session with their agent", async () => {
    render(<ArtifactsLibrary />);

    expect(await screen.findByText("invoice.py")).toBeInTheDocument();
    expect(screen.getByText("query.sql")).toBeInTheDocument();

    // Each agent name appears twice: on its artifact card, and as an option of
    // the agent filter. Asserting on the card alone would break the moment the
    // filter is rendered.
    expect(screen.getAllByText("Invoice reader").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SQL helper").length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: "All agents" })).toBeInTheDocument();
  });

  it("resolves every translation key it renders", async () => {
    // The suite resolves i18n through the real messages/en.json, so a missing
    // key surfaces as its own raw name — which is what this asserts against.
    const { container } = render(<ArtifactsLibrary />);
    await screen.findByText("invoice.py");

    expect(screen.getByText("Artifacts")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Every file your agents produced and every file you sent them, across all conversations",
      ),
    ).toBeInTheDocument();
    // No untranslated key leaked into the DOM (e.g. "Artifacts.pageTitle").
    expect(container.textContent).not.toMatch(/Artifacts\.\w+/);
  });

  it("loads the body of an artifact when it is selected", async () => {
    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    await user.click(await screen.findByText("invoice.py"));

    await waitFor(() =>
      expect(loadArtifact).toHaveBeenCalledWith(
        "agent12",
        "david@thaink2.com",
        "s1",
        "invoice.py",
        // Without the kind, an upload of the same name would answer instead.
        "output",
      ),
    );
    expect(await screen.findByText(/print\('hello'\)/)).toBeInTheDocument();
  });

  it("filters the list on the search term", async () => {
    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    await screen.findByText("invoice.py");
    await user.type(
      screen.getByPlaceholderText("Search by file, language or agent..."),
      "sql",
    );

    expect(screen.queryByText("invoice.py")).not.toBeInTheDocument();
    expect(screen.getByText("query.sql")).toBeInTheDocument();
  });

  it("routes to the conversation that produced the artifact", async () => {
    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    await user.click(await screen.findByText("invoice.py"));
    await user.click(
      await screen.findByTitle("Open the conversation that produced it"),
    );

    expect(push).toHaveBeenCalledWith("/chat?agent=agent12&session=s1");
  });

  it("shows an empty state rather than a blank screen when nothing was produced", async () => {
    listArtifacts.mockResolvedValue([]);
    render(<ArtifactsLibrary />);

    expect(await screen.findByText("No artifact yet")).toBeInTheDocument();
  });

  it("reports a failing session list instead of pretending it is empty", async () => {
    listAllSessions.mockRejectedValue(new Error("network down"));
    render(<ArtifactsLibrary />);

    expect(
      await screen.findByText("Failed to load artifacts: network down"),
    ).toBeInTheDocument();
  });

  it("runs a code artifact and shows its output", async () => {
    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    await user.click(await screen.findByText("invoice.py"));
    await user.click(await screen.findByTitle("Run code"));

    await waitFor(() =>
      expect(executeArtifact).toHaveBeenCalledWith(
        "agent12",
        "david@thaink2.com",
        "s1",
        "invoice.py",
        {},
        "output",
      ),
    );
    // "hello" also appears in the source itself (print('hello')), so assert on
    // the stdout block rather than on the bare string.
    expect(await screen.findByText("Exit: 0")).toBeInTheDocument();
    expect(screen.getByText("stdout")).toBeInTheDocument();
    expect(screen.getByText("42ms")).toBeInTheDocument();
  });

  it("tags uploads and generated artifacts differently", async () => {
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) => {
      if (agentFolder !== "agent12") return [];
      return sessionId === "_shared"
        ? [{ filename: "brief.pdf", language: "text", version: 0, kind: "input" }]
        : [{ filename: "invoice.py", language: "python", version: 2, kind: "output" }];
    });

    render(<ArtifactsLibrary />);

    expect(await screen.findByText("brief.pdf")).toBeInTheDocument();
    // Each label also appears as an option of the kind filter.
    expect(screen.getAllByText("Input").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Output").length).toBeGreaterThan(1);
  });

  it("filters the list down to uploads", async () => {
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) => {
      if (agentFolder !== "agent12") return [];
      return sessionId === "_shared"
        ? [{ filename: "brief.pdf", language: "text", version: 0, kind: "input" }]
        : [{ filename: "invoice.py", language: "python", version: 2, kind: "output" }];
    });

    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    await screen.findByText("brief.pdf");
    // Two selects in the filter bar, in order: agent, then kind.
    await user.selectOptions(screen.getAllByRole("combobox")[1], "input");

    expect(screen.queryByText("invoice.py")).not.toBeInTheDocument();
    expect(screen.getByText("brief.pdf")).toBeInTheDocument();
  });

  it("reads an upload with its own kind, not as a generated artifact", async () => {
    // The two can share a filename inside one session; only the kind tells
    // the API which one the tab is showing.
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) =>
      agentFolder === "agent12" && sessionId === "_shared"
        ? [{ filename: "brief.pdf", language: "text", version: 0, kind: "input" }]
        : [],
    );
    loadArtifact.mockResolvedValue({ code: "brief", kind: "input" });

    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    await user.click(await screen.findByText("brief.pdf"));

    await waitFor(() =>
      expect(loadArtifact).toHaveBeenCalledWith(
        "agent12",
        "david@thaink2.com",
        "_shared",
        "brief.pdf",
        "input",
      ),
    );
  });

  it("offers no conversation link for an upload that has none", async () => {
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) =>
      agentFolder === "agent12" && sessionId === "_shared"
        ? [{ filename: "brief.pdf", language: "text", version: 0, kind: "input" }]
        : [],
    );

    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    await user.click(await screen.findByText("brief.pdf"));

    // Routing to "_shared" would open a conversation that never existed.
    expect(
      screen.queryByTitle("Open the conversation that produced it"),
    ).not.toBeInTheDocument();
  });

  it("opens an HTML artifact on its rendering, not its markup", async () => {
    // A generated report is meant to be looked at; its markup was shown
    // first for no reason other than being the stored form.
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) =>
      agentFolder === "agent12" && sessionId !== "_shared"
        ? [{ filename: "rapport.html", language: "html", version: 0, kind: "output" }]
        : [],
    );
    loadArtifact.mockResolvedValue({ code: "<h1>bonjour</h1>", language: "html" });

    const user = userEvent.setup();
    render(<ArtifactsLibrary />);
    await user.click(await screen.findByText("rapport.html"));

    // The preview is an iframe; the source view would render the markup as text.
    await waitFor(() =>
      expect(document.querySelector("iframe")).toBeInTheDocument(),
    );
    // And the toggle offers the way back to the source.
    expect(screen.getByTitle("Show code")).toBeInTheDocument();
  });

  it("opens a non-HTML artifact on its source", async () => {
    const user = userEvent.setup();
    render(<ArtifactsLibrary />);
    await user.click(await screen.findByText("invoice.py"));

    await screen.findByText(/print\('hello'\)/);
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("previews a PDF instead of describing it", async () => {
    // A PDF has no source to show, but the browser has a viewer for it —
    // "this file is binary" was a fallback standing in for a preview.
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) =>
      agentFolder === "agent12" && sessionId !== "_shared"
        ? [{ filename: "contrat.pdf", language: "pdf", version: 0, kind: "input" }]
        : [],
    );
    loadArtifact.mockResolvedValue({ code: "", binary: true, language: "pdf" });
    downloadAgentFile.mockResolvedValue(
      new Blob(["%PDF"], { type: "application/pdf" }),
    );

    const user = userEvent.setup();
    render(<ArtifactsLibrary />);
    await user.click(await screen.findByText("contrat.pdf"));

    await waitFor(() =>
      expect(document.querySelector("iframe")).toBeInTheDocument(),
    );
    // Copying a body that does not exist would do nothing.
    expect(screen.queryByTitle("Copy code")).not.toBeInTheDocument();
  });

  it("describes a file the browser cannot display", async () => {
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) =>
      agentFolder === "agent12" && sessionId !== "_shared"
        ? [{ filename: "archive.zip", language: "text", version: 0, kind: "input" }]
        : [],
    );
    loadArtifact.mockResolvedValue({ code: "", binary: true, language: "text" });
    downloadAgentFile.mockResolvedValue(
      new Blob(["PK"], { type: "application/zip" }),
    );

    const user = userEvent.setup();
    render(<ArtifactsLibrary />);
    await user.click(await screen.findByText("archive.zip"));

    expect(
      await screen.findByText("This file is binary — use Download to open it."),
    ).toBeInTheDocument();
  });

  it("downloads a binary file from the API, not from an empty body", async () => {
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) =>
      agentFolder === "agent12" && sessionId !== "_shared"
        ? [{ filename: "contrat.pdf", language: "pdf", version: 0, kind: "input" }]
        : [],
    );
    loadArtifact.mockResolvedValue({ code: "", binary: true, language: "pdf" });
    downloadAgentFile.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));

    const user = userEvent.setup();
    render(<ArtifactsLibrary />);
    await user.click(await screen.findByText("contrat.pdf"));
    await user.click(await screen.findByTitle("Download file"));

    await waitFor(() =>
      expect(downloadAgentFile).toHaveBeenCalledWith("agent12", "contrat.pdf"),
    );
  });

  it("shows a legacy file with its own tag", async () => {
    // Files written before the artifact layout existed: 455 of them on dev,
    // uploads and generated reports mixed together with nothing left to tell
    // them apart — hence a tag of their own rather than a guess.
    listArtifacts.mockImplementation(async (agentFolder, _userId, sessionId) =>
      agentFolder === "agent12" && sessionId !== "_shared"
        ? [{ filename: "rapport.html", language: "html", version: 0, kind: "legacy" }]
        : [],
    );

    render(<ArtifactsLibrary />);

    expect(await screen.findByText("rapport.html")).toBeInTheDocument();
    // Once on the card, once as the filter option.
    expect(screen.getAllByText("Legacy").length).toBeGreaterThan(1);
  });

  it("offers no run button for a language the backend cannot execute", async () => {
    listArtifacts.mockImplementation(async (_agentFolder, _userId, sessionId) =>
      sessionId === "_shared"
        ? []
        : [{ filename: "notes.txt", language: "text", version: 1 }],
    );
    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    // The filename shows on the card and again in the preview header once
    // selected — click the first occurrence, the card.
    const cards = await screen.findAllByText("notes.txt");
    await user.click(cards[0]);

    expect(screen.queryByTitle("Run code")).not.toBeInTheDocument();
  });

  it("surfaces a failed run instead of staying silent", async () => {
    executeArtifact.mockRejectedValue(new Error("docker unavailable"));
    const user = userEvent.setup();
    render(<ArtifactsLibrary />);

    await user.click(await screen.findByText("invoice.py"));
    await user.click(await screen.findByTitle("Run code"));

    expect(await screen.findByText(/docker unavailable/)).toBeInTheDocument();
  });
});
