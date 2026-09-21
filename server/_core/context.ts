import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../models";
import { authConfig, getUserByRefreshToken, verifyAccessToken } from "../auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  const header = opts.req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    user = (await verifyAccessToken(header.slice(7))) ?? null;
  }
  // Fallback: check HTTP-only refresh cookie if Authorization header is missing
  if (!user && opts.req.headers.cookie) {
    try {
      const cookies = parseCookieHeader(opts.req.headers.cookie);
      const rawRefreshToken = cookies[authConfig.refreshCookieName];
      if (rawRefreshToken) {
        user = (await getUserByRefreshToken(rawRefreshToken)) ?? null;
      }
    } catch {
      // Ignore cookie parse errors
    }
  }
  return { req: opts.req, res: opts.res, user };
}
