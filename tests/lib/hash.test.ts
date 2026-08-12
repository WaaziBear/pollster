import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/hash";

describe("password hashing", () => {
  it("produces a bcrypt hash distinct from the plaintext", async () => {
    const hash = await hashPassword("Sup3rSecret");
    expect(hash).not.toBe("Sup3rSecret");
    // bcrypt hashes start with $2 and are 60 chars long.
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash.length).toBe(60);
  });

  it("uses a random salt so identical passwords hash differently", async () => {
    const [a, b] = await Promise.all([
      hashPassword("samePassword1"),
      hashPassword("samePassword1"),
    ]);
    expect(a).not.toBe(b);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct-horse-1");
    await expect(verifyPassword("correct-horse-1", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-1");
    await expect(verifyPassword("wrong-password-1", hash)).resolves.toBe(false);
  });
});
