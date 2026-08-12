import { describe, it, expect } from "vitest";
import { normalizeEmail } from "@/lib/utils";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("is idempotent", () => {
    const once = normalizeEmail("Foo@Bar.io");
    expect(normalizeEmail(once)).toBe(once);
  });

  it("leaves an already-normalized email unchanged", () => {
    expect(normalizeEmail("a@b.com")).toBe("a@b.com");
  });
});
