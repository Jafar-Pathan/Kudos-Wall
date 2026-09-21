import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  hashToken,
  logDevEmail,
  verifyEmailToken,
  createPasswordReset,
  resetPasswordWithToken,
} from "./auth";

describe("auth flows: email verification and password reset simulation", () => {
  it("computes deterministic sha256 token hash", () => {
    const rawToken = "test-token-123456";
    const hash1 = hashToken(rawToken);
    const hash2 = hashToken(rawToken);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("logs simulated emails to docs/dev-emails.log", () => {
    const testEmail = "reviewer-demo@example.com";
    const testLink = "http://localhost:3000/verify-email?token=abcdef123456";

    logDevEmail("verification", testEmail, testLink);

    const logFile = path.resolve(process.cwd(), "docs", "dev-emails.log");
    expect(fs.existsSync(logFile)).toBe(true);
    const content = fs.readFileSync(logFile, "utf8");
    expect(content).toContain(testEmail);
    expect(content).toContain(testLink);
    expect(content).toContain("[DEV EMAIL SIMULATION] EMAIL VERIFICATION SIMULATION");
  });

  it("rejects invalid or expired email verification tokens", async () => {
    await expect(verifyEmailToken("nonexistent-invalid-token")).rejects.toThrow();
  });

  it("rejects invalid or expired password reset tokens", async () => {
    await expect(
      resetPasswordWithToken("invalid-reset-token", "Newpassword123"),
    ).rejects.toThrow();
  });
});
