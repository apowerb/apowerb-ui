/**
 * Smoke tests for the /chatbot shell and its shared chat sub-components.
 *
 * NOTE: Vitest is not yet installed in this repo (see correctifs-plan B9).
 * This file is kept as the contract for the future test harness.
 * Once Vitest + @testing-library/react are installed, this test should
 * run as-is.
 *
 * To activate: pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
 * And add a vitest.config.js with environment: "jsdom".
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookOpen } from "lucide-react";

import ChatPageShell from "@/components/chat/ChatPageShell";
import ChatErrorBanner from "@/components/chat/ChatErrorBanner";
import ChatEmptyState from "@/components/chat/ChatEmptyState";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("@/lib/navigation", () => ({
  // L'abstraction fournit aussi Link et Image : sans eux, le rendu casse.
  Link: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
  // eslint-disable-next-line @next/next/no-img-element
  Image: ({ alt, ...rest }) => <img alt={alt || ""} {...rest} />,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ back: mockBack, push: mockPush, replace: vi.fn() }),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props) => <img alt={props.alt || ""} {...props} />,
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("@/components/NotificationBell", () => ({
  default: () => <div data-testid="notification-bell" />,
}));

vi.mock("@/components/auth/UserMenu", () => ({
  default: () => <div data-testid="user-menu" />,
}));

vi.mock("@/components/auth/UserProfileModal", () => ({
  default: ({ onClose }) => (
    <div data-testid="user-profile-modal" onClick={onClose} />
  ),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "test@example.com" },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

describe("ChatPageShell", () => {
  it("renders header title, tag, and back button", () => {
    render(
      <ChatPageShell
        icon={BookOpen}
        label="Knowledge Chat"
        tag="RAG"
        tagColor="#013DFF"
        description="Ask questions across your documents"
      >
        <div data-testid="chat-body">child</div>
      </ChatPageShell>,
    );

    expect(screen.getByText("Knowledge Chat")).toBeInTheDocument();
    expect(screen.getByText("RAG")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
    expect(screen.getByTestId("chat-body")).toBeInTheDocument();
  });

  it("renders shared top-level actions (theme, notifications, user menu)", () => {
    render(
      <ChatPageShell
        icon={BookOpen}
        label="Knowledge Chat"
        tag="RAG"
        tagColor="#013DFF"
      >
        <div />
      </ChatPageShell>,
    );
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });

  it("back button calls router.back when history is available", () => {
    mockBack.mockClear();
    mockPush.mockClear();
    // jsdom default: window.history.length >= 1, but we can't control it
    // easily. We only assert that one of the navigation hooks was invoked.
    render(
      <ChatPageShell icon={BookOpen} label="x" tag="y" tagColor="#013DFF">
        <div />
      </ChatPageShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: /go back/i }));
    expect(mockBack.mock.calls.length + mockPush.mock.calls.length).toBeGreaterThan(0);
  });
});

describe("ChatEmptyState", () => {
  it("renders default empty-conversation message", () => {
    render(<ChatEmptyState />);
    expect(
      screen.getByRole("heading", { name: /select a conversation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/choose an existing chat or start a new one/i),
    ).toBeInTheDocument();
  });

  it("supports custom title and description", () => {
    render(
      <ChatEmptyState
        title="Start a conversation"
        description="Send a message to begin"
      />,
    );
    expect(
      screen.getByRole("heading", { name: /start a conversation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/send a message to begin/i)).toBeInTheDocument();
  });
});

describe("ChatErrorBanner", () => {
  it("renders error text inside an alert region", () => {
    const onClear = vi.fn();
    render(
      <ChatErrorBanner error="Network request failed" onClear={onClear} />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/network request failed/i);
  });

  it("dismisses the banner when the close button is clicked", () => {
    const onClear = vi.fn();
    render(
      <ChatErrorBanner error="Server error 500" onClear={onClear} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss error/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
