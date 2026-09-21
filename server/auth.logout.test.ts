import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { authConfig } from "./auth";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    passwordHash: null,
    name: "Sample User",
    loginMethod: "password",
    role: "user",
    department: "Engineering",
    avatar: null,
    givingAllowance: 100,
    earnedPoints: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: { cookie: "" } } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the refresh cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const result = await appRouter.createCaller(ctx).auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(authConfig.refreshCookieName);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: 0, secure: true, sameSite: "none", httpOnly: true, path: "/" });
  });
});
