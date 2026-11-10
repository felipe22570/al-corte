import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("combines Tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("preserves semantic text colors and resolves text style conflicts", () => {
    expect(cn("text-amount", "text-foreground")).toBe("text-amount text-foreground");
    expect(cn("text-small", "text-body")).toBe("text-body");
    expect(cn("bg-card", "bg-primary-soft")).toBe("bg-primary-soft");
  });
});
