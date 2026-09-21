import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return {
    user: {
      id: 9,
      openId: "local_test",
      name: "Test Teammate",
      email: "test@example.com",
      passwordHash: "scrypt$private",
      loginMethod: "password",
      role: "user",
      department: "Engineering",
      avatar: null,
      givingAllowance: 100,
      earnedPoints: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("profile and account auth", () => {
  it("never exposes passwordHash or openId from auth.me", async () => {
    const result = await appRouter.createCaller(context()).auth.me();
    expect(result).toMatchObject({ id: 9, email: "test@example.com" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("openId");
  });

  it("rejects a short new password before touching the database", async () => {
    await expect(appRouter.createCaller(context()).profile.changePassword({
      currentPassword: "oldPassword1",
      newPassword: "short",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
