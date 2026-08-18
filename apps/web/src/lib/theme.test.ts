import { describe, expect, it } from "vitest";
import { accessibleTextColor } from "./theme";

describe("accessible tenant accent text", () => {
  it("uses dark text for a light tenant accent", () => {
    expect(accessibleTextColor("#fef08a")).toBe("#000");
  });

  it("preserves white text for a dark seeded accent", () => {
    expect(accessibleTextColor("#5b21b6")).toBe("#fff");
  });
});
