import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FollowUpSuggestions, {
  suggestFollowUps,
  detectLang,
} from "../FollowUpSuggestions";

describe("detectLang", () => {
  it("detects French from diacritics", () => {
    expect(detectLang("Peux-tu résumer ça ?")).toBe("fr");
  });
  it("detects French from stopwords without diacritics", () => {
    expect(detectLang("donne moi un exemple pour la base de donnees")).toBe("fr");
  });
  it("detects French for short non-accented input (FR-first audience)", () => {
    expect(detectLang("ok")).toBe("fr");
    expect(detectLang("on a un probleme")).toBe("fr");
    expect(detectLang("liste les tables")).toBe("fr");
  });
  it("detects English from clearly English text", () => {
    expect(detectLang("Can you give me an example of the query?")).toBe("en");
    expect(detectLang("please summarize what you found")).toBe("en");
  });
  it("returns English only for truly empty input", () => {
    expect(detectLang("")).toBe("en");
    expect(detectLang(null)).toBe("en");
  });
  it("stays French when a French history is mixed with one English chip", () => {
    // Simulates aggregated recent user messages diluting a single EN chip click.
    expect(
      detectLang("explique moi la base de donnees clients Go deeper"),
    ).toBe("fr");
  });
});

describe("suggestFollowUps", () => {
  it("returns [] for empty/invalid content", () => {
    expect(suggestFollowUps("")).toEqual([]);
    expect(suggestFollowUps(null)).toEqual([]);
  });

  it("uses the French set when lang=fr", () => {
    expect(suggestFollowUps("Une réponse.", "fr")).toContain("Approfondis ce point");
  });

  it("uses the English set when lang=en (and by default)", () => {
    expect(suggestFollowUps("A reply.", "en")).toContain("Go deeper");
    expect(suggestFollowUps("A reply.")).toContain("Go deeper");
  });

  it("localizes the contextual code chip", () => {
    const md = "Voici:\n```js\nconst a = 1;\n```";
    expect(suggestFollowUps(md, "fr")).toContain("Explique ce code pas à pas");
    expect(suggestFollowUps(md, "en")).toContain("Walk me through this code");
  });

  it("does NOT add a code chip for an inline ``` in prose", () => {
    expect(suggestFollowUps("Utilisez ``` pour ouvrir un bloc.", "fr")).not.toContain(
      "Explique ce code pas à pas",
    );
  });

  it("adds a chart chip for a real markdown table but not for shell pipes", () => {
    expect(
      suggestFollowUps("Data:\n| a | b |\n|---|---|\n| 1 | 2 |", "en"),
    ).toContain("Chart this data");
    expect(suggestFollowUps("Run:\n| grep x | sort | uniq |", "en")).not.toContain(
      "Chart this data",
    );
  });

  it("never returns duplicates and stays capped at 4", () => {
    const out = suggestFollowUps(
      "```\ncode\n```\n- item\n" + "y".repeat(700) + "\nData:\n| a | b |\n|-|-|",
      "en",
    );
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBe(4);
  });
});

describe("FollowUpSuggestions component", () => {
  it("renders nothing for empty/null content", () => {
    const { container, rerender } = render(
      <FollowUpSuggestions content="" onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
    rerender(<FollowUpSuggestions content={null} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("speaks French when the user wrote French", () => {
    render(
      <FollowUpSuggestions
        content="Réponse."
        userText="Peux-tu m'aider à écrire ça ?"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Approfondis ce point")).toBeInTheDocument();
  });

  it("speaks English when the user wrote English", () => {
    render(
      <FollowUpSuggestions
        content="Reply."
        userText="Can you help me write this for the report?"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Go deeper")).toBeInTheDocument();
  });

  it("fires onSelect with the chip text, only once on double-click", () => {
    const onSelect = vi.fn();
    render(
      <FollowUpSuggestions
        content="Reply."
        userText="please help with the report"
        onSelect={onSelect}
      />,
    );
    const chip = screen.getByText("Go deeper");
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Go deeper");
  });

  it("disables the chips when disabled is set", () => {
    render(
      <FollowUpSuggestions
        content="Reply."
        userText="please help with the report"
        onSelect={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByText("Go deeper").closest("button")).toBeDisabled();
  });
});
