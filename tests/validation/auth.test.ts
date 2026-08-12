import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema, emailSchema, passwordSchema } from "@/lib/validation/auth";

describe("emailSchema", () => {
  it("accepts a valid email", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("rejects an empty email", () => {
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts a password with a letter and a number, >= 8 chars", () => {
    expect(passwordSchema.safeParse("password1").success).toBe(true);
  });

  it("rejects a password shorter than 8 chars", () => {
    expect(passwordSchema.safeParse("pass1").success).toBe(false);
  });

  it("rejects a password with no number", () => {
    expect(passwordSchema.safeParse("passwordonly").success).toBe(false);
  });

  it("rejects a password with no letter", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts valid signup input", () => {
    const res = signupSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "hunter2xy",
    });
    expect(res.success).toBe(true);
  });

  it("allows an empty name", () => {
    const res = signupSchema.safeParse({
      name: "",
      email: "jane@example.com",
      password: "hunter2xy",
    });
    expect(res.success).toBe(true);
  });

  it("collects field errors for bad email + password", () => {
    const res = signupSchema.safeParse({ email: "bad", password: "short" });
    expect(res.success).toBe(false);
    if (!res.success) {
      const flat = res.error.flatten().fieldErrors;
      expect(flat.email).toBeTruthy();
      expect(flat.password).toBeTruthy();
    }
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password (no policy re-check on login)", () => {
    const res = loginSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(res.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const res = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(res.success).toBe(false);
  });
});
