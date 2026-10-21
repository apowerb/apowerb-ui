/**
 * Eden AI et Azure AI Foundry ont leur logo, comme Anthropic ou OpenAI,
 * et non le repli à deux lettres réservé aux providers inconnus.
 */
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import ProviderIcon from "@/components/ProviderIcon";

describe("ProviderIcon — Eden AI et Azure AI Foundry", () => {
  it.each([
    ["edenai", "ED"],
    ["azure_ai", "AZ"],
  ])("%s rend un logo, pas le monogramme %s", (provider, monogram) => {
    const { container } = render(<ProviderIcon provider={provider} size={14} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.textContent).not.toContain(monogram);
  });

  it("Eden AI : deux icônes sur la page ne partagent pas leurs masques", () => {
    const { container } = render(
      <>
        <ProviderIcon provider="edenai" size={14} />
        <ProviderIcon provider="edenai" size={14} />
      </>,
    );
    const ids = [...container.querySelectorAll("mask")].map((m) => m.id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
  });
});
