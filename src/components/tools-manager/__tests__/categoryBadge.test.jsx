import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { CategoryBadge } from "@/components/tools-manager/ui";

describe("CategoryBadge", () => {
  it("shows the brand logo when the category has one", () => {
    const { container } = render(
      <CategoryBadge info={{ Icon: Wrench, logo: "/integrations/notion.png" }} className="w-10 h-10" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("/integrations/notion.png");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("falls back to the keyword icon without a logo", () => {
    const { container } = render(<CategoryBadge info={{ Icon: Wrench, logo: null }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
