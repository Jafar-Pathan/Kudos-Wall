import { describe, expect, it } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "./auth";

describe("credential authentication", () => {
  it("hashes and verifies a valid password without storing plaintext", async () => {
    const password = "teamwork123";
    const encoded = await hashPassword(password);
    expect(encoded).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", encoded)).resolves.toBe(false);
  });

  it("requires length and mixed password content", () => {
    expect(() => validatePassword("short1")).toThrow("PASSWORD_TOO_SHORT");
    expect(() => validatePassword("longpassword")).toThrow("PASSWORD_COMPLEXITY");
    expect(() => validatePassword("teamwork123")).not.toThrow();
  });
});
