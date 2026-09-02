import { describe, it, expect } from "vitest";
import { normalizeEmail, displayNameFromEmail } from "@/lib/utils";

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

describe("displayNameFromEmail", () => {
  it("returns the local-part before '@'", () => {
    expect(displayNameFromEmail("alice@example.com")).toBe("alice");
  });

  it("handles dotted/plus local-parts verbatim", () => {
    expect(displayNameFromEmail("first.last+tag@example.com")).toBe(
      "first.last+tag"
    );
  });

  it("falls back to the full string when there is no local-part", () => {
    expect(displayNameFromEmail("@example.com")).toBe("@example.com");
  });
});
