import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parse as parseCookieHeader } from "cookie";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  authConfig,
  changeUserPassword,
  createCredentialUser,
  getUserByEmail,
  issueAuthTokens,
  markUserSignedIn,
  revokeRefreshToken,
  rotateRefreshToken,
  updateUserProfile,
  verifyPassword,
} from "./auth";
import {
  addReactionAtomic,
  createKudosAtomic,
  getDb,
  getFeed,
  getLeaderboard,
  getProfileStats,
  getUserByOpenId,
  resetAllowances,
  searchUsers,
} from "./db";
import type { User } from "./models";

const departmentSchema = z.enum(["Engineering", "Design", "Marketing", "Sales"]);
const reactionSchema = z.enum(["thumbs", "party", "fire"]);

const fallbackPeople = [
  { id: 101, name: "Maya Patel", email: "maya@northstar.co", avatar: "MP", department: "Design" },
  { id: 102, name: "Jordan Lee", email: "jordan@northstar.co", avatar: "JL", department: "Engineering" },
  { id: 103, name: "Sofia Chen", email: "sofia@northstar.co", avatar: "SC", department: "Marketing" },
  { id: 104, name: "Owen Williams", email: "owen@northstar.co", avatar: "OW", department: "Sales" },
  { id: 105, name: "Priya Nair", email: "priya@northstar.co", avatar: "PN", department: "Engineering" },
];

const fallbackFeed = [
  { id: 1, senderId: 102, recipientId: 101, points: 50, message: "Maya turned a fuzzy brief into a crisp system that made the whole launch feel easy. Thank you for bringing so much clarity to the team.", tags: ["#Teamwork", "#Innovation"], reactions: { thumbs: 12, party: 4, fire: 7 }, sender: fallbackPeople[1], recipient: fallbackPeople[0], createdAt: new Date(Date.now() - 1000 * 60 * 32) },
  { id: 2, senderId: 104, recipientId: 103, points: 20, message: "Sofia stayed close to every customer signal and helped us sharpen the story before the review. Huge customer obsession energy.", tags: ["#CustomerObsession"], reactions: { thumbs: 8, party: 2, fire: 3 }, sender: fallbackPeople[3], recipient: fallbackPeople[2], createdAt: new Date(Date.now() - 1000 * 60 * 95) },
  { id: 3, senderId: 101, recipientId: 105, points: 50, message: "Priya unblocked the analytics handoff in record time and left the docs better than she found them. Absolute teammate behavior.", tags: ["#Teamwork"], reactions: { thumbs: 19, party: 5, fire: 6 }, sender: fallbackPeople[0], recipient: fallbackPeople[4], createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4) },
  { id: 4, senderId: 103, recipientId: 104, points: 10, message: "Owen made the customer story land with warmth and precision. The room was with us from the first slide.", tags: ["#CustomerObsession", "#Teamwork"], reactions: { thumbs: 6, party: 1, fire: 4 }, sender: fallbackPeople[2], recipient: fallbackPeople[3], createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8) },
];

const fallbackLeaderboard = [
  { id: 101, name: "Maya Patel", avatar: "MP", department: "Design", earnedPoints: 420 },
  { id: 105, name: "Priya Nair", avatar: "PN", department: "Engineering", earnedPoints: 365 },
  { id: 103, name: "Sofia Chen", avatar: "SC", department: "Marketing", earnedPoints: 310 },
  { id: 102, name: "Jordan Lee", avatar: "JL", department: "Engineering", earnedPoints: 260 },
  { id: 104, name: "Owen Williams", avatar: "OW", department: "Sales", earnedPoints: 235 },
];

function getCurrentUserId(ctxUser: { id: number } | null | undefined) {
  return ctxUser?.id ?? 101;
}

function publicUser(user: Record<string, any>) {
  const { passwordHash: _passwordHash, openId: _openId, ...safe } = user;
  return safe;
}

function refreshTokenFromRequest(req: { headers: { cookie?: string } }) {
  return parseCookieHeader(req.headers.cookie ?? "")[authConfig.refreshCookieName];
}

function setRefreshCookie(ctx: { req: Parameters<typeof getSessionCookieOptions>[0]; res: { cookie: Function } }, token: string) {
  ctx.res.cookie(authConfig.refreshCookieName, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: authConfig.refreshTokenTtlMs,
  });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user ? publicUser(opts.ctx.user) : null),
    signup: publicProcedure.input(z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(320),
      password: z.string().min(8).max(128),
      department: departmentSchema.default("Engineering"),
    })).mutation(async ({ ctx, input }) => {
      if (await getUserByEmail(input.email)) throw new TRPCError({ code: "CONFLICT", message: "An account with that email already exists." });
      try {
        const user = await createCredentialUser(input);
        const tokens = await issueAuthTokens(user);
        setRefreshCookie(ctx, tokens.refreshToken);
        return { user: publicUser(user), accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
      } catch (error) {
        if (error instanceof Error && error.message === "PASSWORD_COMPLEXITY") throw new TRPCError({ code: "BAD_REQUEST", message: "Password must contain at least one letter and one number." });
        if (error instanceof Error && error.message === "PASSWORD_TOO_SHORT") throw new TRPCError({ code: "BAD_REQUEST", message: "Password must be at least 8 characters." });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create your account." });
      }
    }),
    signin: publicProcedure.input(z.object({ email: z.string().trim().email(), password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
      await markUserSignedIn(user.id);
      const tokens = await issueAuthTokens(user);
      setRefreshCookie(ctx, tokens.refreshToken);
      return { user: publicUser(user), accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
    }),
    refresh: publicProcedure.mutation(async ({ ctx }) => {
      const current = refreshTokenFromRequest(ctx.req);
      if (!current) throw new TRPCError({ code: "UNAUTHORIZED", message: "Refresh token is missing." });
      try {
        const tokens = await rotateRefreshToken(current);
        setRefreshCookie(ctx, tokens.refreshToken);
        return { user: publicUser(tokens.user), accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
      } catch {
        ctx.res.clearCookie(authConfig.refreshCookieName, { ...getSessionCookieOptions(ctx.req), maxAge: 0 });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Refresh token is invalid or expired." });
      }
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeRefreshToken(refreshTokenFromRequest(ctx.req));
      ctx.res.clearCookie(authConfig.refreshCookieName, { ...getSessionCookieOptions(ctx.req), maxAge: 0 });
      return { success: true } as const;
    }),
  }),
  kudos: router({
    overview: publicProcedure.query(async ({ ctx }) => {
      if (ctx.user) {
        const db = await getDb();
        const person = db ? await getUserByOpenId(ctx.user.openId) : undefined;
        const stats = db ? await getProfileStats(ctx.user.id) : { sent: 0, received: 0, badges: [] };
        return {
          allowance: person?.givingAllowance ?? 100,
          received: stats.received,
          sent: stats.sent,
        };
      }
      // Guest/demo mode
      return { allowance: 72, received: 14, sent: 8 };
    }),
    feed: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(30).default(10), cursor: z.string().optional(), search: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const result = await getFeed(input.limit, input.cursor);
        if (!result.rows.length && !ctx.user) {
          // Guest/demo mode: show fallback feed
          const needle = input.search?.toLowerCase().trim();
          const filtered = needle ? fallbackFeed.filter((item) => `${item.message} ${item.sender.name} ${item.recipient.name}`.toLowerCase().includes(needle)) : fallbackFeed;
          return { rows: filtered, nextCursor: undefined };
        }
        if (!input.search) return result;
        const needle = input.search.toLowerCase().trim();
        return { ...result, rows: result.rows.filter((item) => `${item.message} ${item.sender?.name ?? ""} ${item.recipient?.name ?? ""}`.toLowerCase().includes(needle)) };
      }),
    searchUsers: publicProcedure
      .input(z.object({ query: z.string().default(""), excludeId: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const result = await searchUsers(input.query, input.excludeId);
        if (result.length) return result;
        // Only show fallback people in guest/demo mode
        if (!ctx.user) return fallbackPeople.filter((person) => String(person.id) !== input.excludeId && `${person.name} ${person.email}`.toLowerCase().includes(input.query.toLowerCase())).slice(0, 8);
        return [];
      }),
    give: protectedProcedure
      .input(z.object({ recipientId: z.string(), points: z.union([z.literal(10), z.literal(20), z.literal(50)]), message: z.string().trim().min(8).max(280), tags: z.array(z.enum(["#Teamwork", "#CustomerObsession", "#Innovation"])).min(1).max(3) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await createKudosAtomic({ senderId: ctx.user.id, ...input });
        } catch (error) {
          const code = error instanceof Error ? error.message : "UNKNOWN";
          const message = code === "SELF_GIFT" ? "Choose a teammate other than yourself." : code === "INSUFFICIENT_ALLOWANCE" ? "You do not have enough points left this month." : code === "USER_NOT_FOUND" ? "That teammate could not be found." : "We could not send this recognition right now.";
          throw new TRPCError({ code: code === "UNKNOWN" ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST", message });
        }
      }),
    react: protectedProcedure
      .input(z.object({ kudosId: z.string(), reaction: reactionSchema }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await addReactionAtomic(input.kudosId, ctx.user.id, input.reaction);
        } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That reaction could not be saved." });
        }
      }),
  }),
  leaderboard: router({
    list: publicProcedure.input(z.object({ department: departmentSchema.optional() }).optional()).query(async ({ ctx, input }) => {
      const result = await getLeaderboard(input?.department);
      if (result.length || ctx.user) return result.sort((a, b) => b.earnedPoints - a.earnedPoints).slice(0, 10);
      // Guest/demo mode: show fallback leaderboard
      return fallbackLeaderboard.filter((row) => !input?.department || row.department === input.department);
    }),
  }),
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      const person = db ? await getUserByOpenId(ctx.user.openId) : undefined;
      const stats = db ? await getProfileStats(ctx.user.id) : { sent: 0, received: 0, badges: [] };
      return {
        person: person ?? { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, avatar: null, department: ctx.user.department ?? "Engineering" },
        stats,
        allowance: person?.givingAllowance ?? 100,
        earnedPoints: person?.earnedPoints ?? 0,
      };
    }),
    update: protectedProcedure.input(z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(320),
      department: departmentSchema,
    })).mutation(async ({ ctx, input }) => {
      const existing = await getUserByEmail(input.email);
      if (existing && existing.id !== ctx.user.id) throw new TRPCError({ code: "CONFLICT", message: "That email is already in use." });
      try {
        const updated = await updateUserProfile({ id: ctx.user.id, ...input });
        return publicUser(updated);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "We could not update your profile." });
      }
    }),
    changePassword: protectedProcedure.input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    })).mutation(async ({ ctx, input }) => {
      try {
        await changeUserPassword({ id: ctx.user.id, ...input });
        return { success: true } as const;
      } catch (error) {
        const code = error instanceof Error ? error.message : "UNKNOWN";
        if (code === "CURRENT_PASSWORD_INVALID") throw new TRPCError({ code: "BAD_REQUEST", message: "Your current password is incorrect." });
        if (code === "PASSWORD_TOO_SHORT") throw new TRPCError({ code: "BAD_REQUEST", message: "New password must be at least 8 characters." });
        if (code === "PASSWORD_COMPLEXITY") throw new TRPCError({ code: "BAD_REQUEST", message: "New password must contain at least one letter and one number." });
        throw new TRPCError({ code: "BAD_REQUEST", message: "We could not change your password." });
      }
    }),
  }),
  admin: router({
    resetAllowances: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
      return { updated: await resetAllowances() };
    }),
  }),
});

export type AppRouter = typeof appRouter;
