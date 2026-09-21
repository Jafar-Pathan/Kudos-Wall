import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx: TrpcContext = {
  user: null,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
};

describe("Kudos Wall read models", () => {
  it("returns a populated company feed when the database has no rows", async () => {
    const result = await appRouter.createCaller(ctx).kudos.feed({ limit: 10 });
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    expect(result.rows[0]).toMatchObject({ points: 50, tags: expect.arrayContaining(["#Teamwork"]) });
  });

  it("filters the leaderboard by department", async () => {
    const result = await appRouter.createCaller(ctx).leaderboard.list({ department: "Design" });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((row) => row.department === "Design")).toBe(true);
  });
});
